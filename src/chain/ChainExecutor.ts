import type { LanguageModelV3 } from '@ai-sdk/provider';
import type { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import type { RouterConfig } from '../types/config.js';
import type { CooldownManager } from '../usage/cooldown.js';
import type { BudgetTracker } from '../budget/BudgetTracker.js';
import type { KeySelector } from '../selection/KeySelector.js';
import type { UsageTracker } from '../usage/UsageTracker.js';
import type { CreditTracker } from '../credit/CreditTracker.js';
import type {
  ChainEntry,
  ChainAttempt,
  ChainFilter,
  ChainResult,
  ChainEntryStatus,
  ChainStatus,
} from './types.js';
import { classifyError } from '../wrapper/error-classifier.js';
import type { CooldownClass } from '../wrapper/error-classifier.js';
import { AllProvidersExhaustedError } from '../errors/all-providers-exhausted-error.js';
import { RouterEvent } from '../constants/index.js';
import { createRetryProxy } from '../wrapper/retry-proxy.js';
import { getProviderModule } from '../providers/registry.js';
import { ConfigError } from '../errors/config-error.js';
import debugFactory from 'debug';

const debug = debugFactory('pennyllm:chain');

// ── Types ──────────────────────────────────────────────────────────

export interface ChainExecutorDeps {
  chain: ChainEntry[];
  config: RouterConfig;
  cooldownManager: CooldownManager;
  budgetTracker: BudgetTracker;
  keySelector: KeySelector;
  disabledKeys: Set<string>;
  emitter: EventEmitter;
  usageTracker?: UsageTracker;
  creditTracker?: CreditTracker;
  /** Mutable refs updated by ChainExecutor on resolution for middleware */
  providerRef?: { current: string };
  keyIndexRef?: { current: number };
  modelIdRef?: { current: string };
}

// ── Provider factory cache ─────────────────────────────────────────

/**
 * Cache for provider model factories to avoid repeated dynamic imports.
 * Keyed by provider ID, value is the factory function.
 */
const factoryCache = new Map<string, (modelId: string) => LanguageModelV3>();

async function getOrCreateFactory(
  provider: string,
  apiKey: string,
): Promise<(modelId: string) => LanguageModelV3> {
  const cacheKey = `${provider}:${apiKey.slice(0, 8)}`;
  const cached = factoryCache.get(cacheKey);
  if (cached) return cached;

  const mod = getProviderModule(provider);
  if (!mod) {
    throw new ConfigError(`No provider module found for '${provider}'`, {
      field: 'providers',
    });
  }

  try {
    const factory = await mod.createFactory(apiKey);
    factoryCache.set(cacheKey, factory);
    return factory;
  } catch (error) {
    const opts: { field: string; cause?: Error } = { field: 'providers' };
    if (error instanceof Error) {
      opts.cause = error;
    }
    throw new ConfigError(
      `Failed to create factory for provider '${provider}': ${error instanceof Error ? error.message : String(error)}`,
      opts,
    );
  }
}

// ── Helpers ────────────────────────────────────────────────────────

function safeEmit(emitter: EventEmitter, event: string, payload: unknown): void {
  try {
    emitter.emit(event, payload);
  } catch {
    // Fire-and-forget: never let event emission break chain execution
  }
}

/**
 * Filter chain entries by optional ChainFilter.
 */
function applyFilter(chain: ChainEntry[], filter: ChainFilter | undefined): ChainEntry[] {
  if (!filter) return chain;

  return chain.filter((entry) => {
    // Filter by provider
    if (filter.provider && entry.provider !== filter.provider) return false;

    // Filter by quality tier
    if (filter.tier && entry.qualityTier !== filter.tier) return false;

    // Filter by capabilities (all must match)
    if (filter.capabilities && filter.capabilities.length > 0) {
      for (const cap of filter.capabilities) {
        if (!entry.capabilities[cap]) return false;
      }
    }

    return true;
  });
}

// ── Core execution ─────────────────────────────────────────────────

/**
 * Walk the model chain, trying each entry in order.
 * For each entry: check stale, check cooldown, check budget, create retry proxy, attempt call.
 * On success: emit chain:resolved, return result.
 * On failure: classify error, record attempt, advance to next entry.
 * If all entries exhausted: throw AllProvidersExhaustedError.
 */
async function executeChain(
  callFn: (model: LanguageModelV3) => PromiseLike<unknown>,
  chain: ChainEntry[],
  filter: ChainFilter | undefined,
  deps: ChainExecutorDeps,
  requestId: string,
): Promise<ChainResult> {
  const startTime = Date.now();
  const filteredChain = applyFilter(chain, filter);

  if (filteredChain.length === 0) {
    throw new AllProvidersExhaustedError('pennyllm/chain', [
      {
        provider: 'pennyllm',
        modelId: 'pennyllm/chain',
        reason: 'no_match',
      },
    ]);
  }

  const attempts: ChainAttempt[] = [];

  for (let position = 0; position < filteredChain.length; position++) {
    const entry = filteredChain[position]!;

    // a. Check stale
    if (entry.stale) {
      debug('Skipping stale model %s at position %d', entry.modelId, position);
      continue;
    }

    // b. Check provider-level cooldown BEFORE attempting API call
    if (deps.cooldownManager.isProviderInCooldown(entry.provider)) {
      debug('Skipping provider %s (in cooldown) at position %d', entry.provider, position);
      continue;
    }

    // b2. Check credit depletion for providers with credit config
    if (deps.creditTracker && deps.creditTracker.shouldSkip(entry.provider)) {
      debug(
        'Skipping provider %s (credits exhausted/expired) at position %d',
        entry.provider,
        position,
      );
      continue;
    }

    // c. Check budget for paid models
    if (!entry.free) {
      const budgetExceeded = await deps.budgetTracker.isExceeded();
      if (budgetExceeded) {
        debug('Skipping paid model %s (budget exceeded) at position %d', entry.modelId, position);
        continue;
      }
    }

    // d. Create retry proxy for this entry
    try {
      const providerConfig = deps.config.providers[entry.provider];
      if (!providerConfig || providerConfig.keys.length === 0) {
        debug('No keys configured for provider %s, skipping', entry.provider);
        continue;
      }

      // Select initial key
      const selection = await deps.keySelector.selectKey(entry.provider, entry.apiModelId, {
        requestId,
      });

      const keyConfig = providerConfig.keys[selection.keyIndex];
      if (keyConfig === undefined) {
        debug('Key index %d not found for provider %s', selection.keyIndex, entry.provider);
        continue;
      }

      const apiKey = typeof keyConfig === 'string' ? keyConfig : keyConfig.key;

      // Get factory and create initial model
      const factory = await getOrCreateFactory(entry.provider, apiKey);
      const initialModel = factory(entry.apiModelId);

      // Mutable ref for retry proxy to update
      const keyIndexRef = { current: selection.keyIndex };

      const retryProxy = createRetryProxy({
        provider: entry.provider,
        modelName: entry.apiModelId,
        modelId: entry.modelId,
        initialModel,
        initialKeyIndex: selection.keyIndex,
        initialKey: apiKey,
        config: deps.config,
        registry: await getProviderRegistry(deps),
        cooldownManager: deps.cooldownManager,
        disabledKeys: deps.disabledKeys,
        emitter: deps.emitter,
        requestId,
        keyIndexRef,
        keySelector: deps.keySelector,
      });

      // e. Attempt call
      const result = await callFn(retryProxy);

      // f. Success!
      deps.cooldownManager.onProviderSuccess(entry.provider);

      // Update mutable refs for middleware
      if (deps.providerRef) deps.providerRef.current = entry.provider;
      if (deps.keyIndexRef) deps.keyIndexRef.current = keyIndexRef.current;
      if (deps.modelIdRef) deps.modelIdRef.current = entry.modelId;

      const fallbackUsed = position > 0;

      // Emit chain:resolved event
      safeEmit(deps.emitter, RouterEvent.CHAIN_RESOLVED, {
        resolvedModel: entry.modelId,
        resolvedProvider: entry.provider,
        chainPosition: position,
        fallbackUsed,
        attempts: attempts.map((a) => ({
          provider: a.provider,
          modelId: a.modelId,
          errorType: a.errorType,
        })),
        requestId,
        latencyMs: Date.now() - startTime,
        timestamp: Date.now(),
      });

      return {
        result,
        chainPosition: position,
        entry,
        attempts,
        fallbackUsed,
      };
    } catch (error) {
      // g. Error: classify and record
      const classified = classifyError(error);

      const attempt: ChainAttempt = {
        provider: entry.provider,
        modelId: entry.modelId,
        chainPosition: position,
        errorType: classified.type,
        message: classified.message,
      };
      if (classified.statusCode !== undefined) {
        attempt.statusCode = classified.statusCode;
      }
      if (classified.cooldownMs !== undefined) {
        attempt.cooldownMs = classified.cooldownMs;
      }
      if (classified.cooldownClass !== undefined) {
        attempt.cooldownClass = classified.cooldownClass;
      }
      attempts.push(attempt);

      debug(
        'Chain entry %s failed at position %d: %s (status: %s)',
        entry.modelId,
        position,
        classified.type,
        classified.statusCode ?? 'none',
      );

      // Record rate limit event for observability
      if (classified.type === 'rate_limit' && deps.usageTracker) {
        const cooldownMs = classified.cooldownMs ?? deps.config.cooldown.defaultDurationMs;
        deps.usageTracker.recordRateLimitEvent(
          entry.provider,
          0, // keyIndex not easily available after retry proxy exhaustion
          cooldownMs,
          true,
        );
      }

      // Set provider-level cooldown when all keys exhausted
      if (classified.type === 'rate_limit' || classified.type === 'auth') {
        const cooldownMs = classified.cooldownMs ?? deps.config.cooldown.defaultDurationMs;
        const cooldownClass = classified.cooldownClass ?? 'short';
        deps.cooldownManager.setProviderCooldown(
          entry.provider,
          cooldownMs,
          cooldownClass,
          `Chain: ${classified.message}`,
        );
      }

      // Confirm credit exhaustion on 402 for credit providers
      if (classified.statusCode === 402 && deps.creditTracker) {
        deps.creditTracker.confirmExhaustion(entry.provider);
      }

      // Mark model stale on 404
      if (classified.statusCode === 404) {
        entry.stale = true;
        debug('Marked %s as stale (404)', entry.modelId);
      }

      // Continue to next entry
    }
  }

  // 4. Entire chain exhausted
  throw new AllProvidersExhaustedError(
    'pennyllm/chain',
    attempts.map((a) => ({
      provider: a.provider,
      modelId: a.modelId,
      reason:
        a.errorType === 'rate_limit' ? ('rate_limited' as const) : ('quota_exhausted' as const),
    })),
  );
}

// ── Provider registry helper ───────────────────────────────────────

/**
 * Lazy-init ProviderRegistry from deps. The retry proxy needs it for key rotation.
 * We use a module-level cache to avoid repeated imports.
 */
let cachedRegistry: import('../wrapper/provider-registry.js').ProviderRegistry | null = null;

async function getProviderRegistry(
  deps: ChainExecutorDeps,
): Promise<import('../wrapper/provider-registry.js').ProviderRegistry> {
  if (cachedRegistry) return cachedRegistry;

  const { ProviderRegistry } = await import('../wrapper/provider-registry.js');
  const registry = new ProviderRegistry();

  // Register all configured providers using their modules
  const configuredProviders = Object.keys(deps.config.providers).filter(
    (p) => deps.config.providers[p]?.enabled !== false,
  );

  for (const providerId of configuredProviders) {
    const mod = getProviderModule(providerId);
    if (!mod) continue;

    // Register a sync factory that wraps the async createFactory
    // Pre-cache the factory for the first key
    const providerConfig = deps.config.providers[providerId];
    if (!providerConfig || providerConfig.keys.length === 0) continue;

    const firstKeyConfig = providerConfig.keys[0]!;
    const firstApiKey = typeof firstKeyConfig === 'string' ? firstKeyConfig : firstKeyConfig.key;

    try {
      const factory = await mod.createFactory(firstApiKey);
      // Register sync wrapper -- createFactory returns same shape for any key for most providers
      registry.register(providerId, () => {
        // For key rotation, the retry proxy recreates via createProviderInstance
        // which calls this factory. The factory is SDK-specific and typically
        // returns a function that accepts modelId.
        return factory;
      });
    } catch (err) {
      debug(
        'Failed to pre-init provider %s: %s',
        providerId,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  cachedRegistry = registry;
  return registry;
}

// ── createChainProxy ───────────────────────────────────────────────

/**
 * Create a LanguageModelV3-compatible proxy that walks the model chain
 * on each doGenerate/doStream call.
 *
 * This replaces FallbackProxy with a deterministic chain-walking approach:
 * cooldown check -> budget gate -> retry proxy (key rotation) -> next entry.
 */
export function createChainProxy(deps: ChainExecutorDeps, filter?: ChainFilter): LanguageModelV3 {
  const proxy: LanguageModelV3 = {
    specificationVersion: 'v3' as const,
    provider: 'pennyllm',
    modelId: 'pennyllm/chain',
    supportedUrls: {},

    async doGenerate(params) {
      const requestId = randomUUID();
      const { result } = await executeChain(
        (model) => model.doGenerate(params),
        deps.chain,
        filter,
        deps,
        requestId,
      );
      return result as Awaited<ReturnType<LanguageModelV3['doGenerate']>>;
    },

    async doStream(params) {
      const requestId = randomUUID();
      const { result } = await executeChain(
        (model) => model.doStream(params),
        deps.chain,
        filter,
        deps,
        requestId,
      );
      // Mid-stream errors are NOT retryable (surface to user)
      return result as Awaited<ReturnType<LanguageModelV3['doStream']>>;
    },
  };

  return proxy;
}

// ── getChainStatus ─────────────────────────────────────────────────

/**
 * Get current status of all chain entries.
 * Reports which models are available, cooling down, depleted, or stale.
 */
export function getChainStatus(
  chain: ChainEntry[],
  cooldownManager: CooldownManager,
  creditTracker?: CreditTracker,
): ChainStatus {
  const entries: ChainEntryStatus[] = chain.map((entry) => {
    let status: ChainEntryStatus['status'] = 'available';
    let cooldownUntil: string | undefined;
    let cooldownClass: CooldownClass | undefined;

    if (entry.stale) {
      status = 'stale';
    } else if (cooldownManager.isProviderDepleted(entry.provider)) {
      status = 'depleted';
      cooldownClass = 'permanent';
    } else if (cooldownManager.isProviderInCooldown(entry.provider)) {
      status = 'cooling';
      const cd = cooldownManager.getProviderCooldown(entry.provider);
      if (cd) {
        cooldownUntil = cd.until;
        cooldownClass = cd.cooldownClass;
      }
    }

    const entryStatus: ChainEntryStatus = {
      provider: entry.provider,
      modelId: entry.modelId,
      qualityTier: entry.qualityTier,
      free: entry.free,
      status,
    };
    if (cooldownUntil !== undefined) entryStatus.cooldownUntil = cooldownUntil;
    if (cooldownClass !== undefined) entryStatus.cooldownClass = cooldownClass;
    if (creditTracker) {
      const cs = creditTracker.getStatus(entry.provider);
      if (cs !== undefined) {
        entryStatus.creditStatus = cs;
      }
    }
    return entryStatus;
  });

  return {
    entries,
    totalModels: chain.length,
    availableModels: entries.filter((e) => e.status === 'available').length,
    depletedProviders: [
      ...new Set(entries.filter((e) => e.status === 'depleted').map((e) => e.provider)),
    ],
  };
}
