import type {
  LanguageModelV3,
  LanguageModelV3GenerateResult,
  LanguageModelV3StreamResult,
} from '@ai-sdk/provider';
import type { EventEmitter } from 'node:events';
import debugFactory from 'debug';
import type { RouterConfig } from '../types/config.js';
import type { ModelCatalog } from '../types/interfaces.js';
import type { KeySelector } from '../selection/KeySelector.js';
import type { ProviderRegistry } from '../wrapper/provider-registry.js';
import { createProviderInstance } from '../wrapper/provider-registry.js';
import type { CooldownManager } from '../usage/cooldown.js';
import { createRetryProxy } from '../wrapper/retry-proxy.js';
import { QuotaExhaustedError } from '../errors/quota-exhausted-error.js';
import { RateLimitError } from '../errors/rate-limit-error.js';
import { ProviderError } from '../errors/provider-error.js';
import { AllProvidersExhaustedError } from '../errors/all-providers-exhausted-error.js';
import { RouterEvent } from '../constants/index.js';
import type { FallbackResolver } from './FallbackResolver.js';
import type { BudgetTracker } from '../budget/BudgetTracker.js';
import type { AffinityCache } from './AffinityCache.js';
import type { FallbackBehavior, FallbackCandidate, ProviderAttempt } from './types.js';

const debug = debugFactory('llm-router:fallback');

// ── Types ──────────────────────────────────────────────────────────

export interface FallbackProxyDeps {
  primaryProvider: string;
  primaryModelName: string;
  primaryModelId: string;
  primaryRetryProxy: LanguageModelV3;
  config: RouterConfig;
  catalog: ModelCatalog;
  keySelector: KeySelector;
  registry: ProviderRegistry;
  cooldownManager: CooldownManager;
  disabledKeys: Set<string>;
  emitter: EventEmitter;
  requestId: string;
  providerRef: { current: string };
  modelIdRef: { current: string };
  keyIndexRef: { current: number };
  budgetTracker: BudgetTracker;
  fallbackResolver: FallbackResolver;
  affinityCache: AffinityCache;
  reasoning: boolean;
  estimatedTokens?: number;
}

// ── Helpers ────────────────────────────────────────────────────────

function safeEmit(emitter: EventEmitter, event: string, payload: unknown): void {
  try {
    emitter.emit(event, payload);
  } catch {
    // Fire-and-forget: never let event emission break fallback flow
  }
}

/**
 * Returns true if the error should trigger cross-provider fallback.
 * Only quota exhaustion, rate limiting, and server errors trigger fallback.
 */
function isFallbackTrigger(error: unknown): boolean {
  if (error instanceof QuotaExhaustedError) return true;
  if (error instanceof RateLimitError) return true;
  if (error instanceof ProviderError && error.errorType === 'server') return true;
  return false;
}

/**
 * Get per-provider fallback behavior, falling back to global config.
 */
function getProviderBehavior(provider: string, config: RouterConfig): FallbackBehavior {
  const override = config.providers[provider]?.fallback?.behavior;
  if (override) return override;
  return config.fallback.behavior;
}

/**
 * Build a ProviderAttempt record from an error.
 */
function buildProviderAttempt(provider: string, modelId: string, error: unknown): ProviderAttempt {
  let reason: ProviderAttempt['reason'] = 'quota_exhausted';
  let earliestRecovery: string | undefined;

  if (error instanceof QuotaExhaustedError) {
    reason = 'quota_exhausted';
    const nextReset = error.metadata?.['nextReset'];
    if (typeof nextReset === 'string') {
      earliestRecovery = nextReset;
    }
  } else if (error instanceof RateLimitError) {
    reason = 'rate_limited';
    const recovery = error.metadata?.['earliestRecovery'];
    if (typeof recovery === 'string') {
      earliestRecovery = recovery;
    }
  } else if (error instanceof ProviderError && error.errorType === 'server') {
    reason = 'server_error';
  }

  const attempt: ProviderAttempt = { provider, modelId, reason };
  if (error instanceof Error) {
    attempt.error = error;
  }
  if (earliestRecovery !== undefined) {
    attempt.earliestRecovery = earliestRecovery;
  }
  return attempt;
}

/**
 * Determine exhaustion type string from error for provider:exhausted event.
 */
function getExhaustionType(error: unknown): string {
  if (error instanceof QuotaExhaustedError) return 'quota';
  if (error instanceof RateLimitError) return 'cooldown';
  if (error instanceof ProviderError && error.errorType === 'server') return 'server';
  return 'unknown';
}

// ── Shared fallback orchestration ──────────────────────────────────

interface AttemptResult {
  result: unknown;
  candidate?: FallbackCandidate;
  fallbackKeyIndexRef?: { current: number };
}

/**
 * Shared fallback orchestration logic used by both doGenerate and doStream.
 *
 * callFn receives a LanguageModelV3 proxy and calls the appropriate method
 * (doGenerate or doStream) on it.
 */
async function attemptWithFallback(
  callFn: (model: LanguageModelV3) => PromiseLike<unknown>,
  deps: FallbackProxyDeps,
): Promise<AttemptResult> {
  const triedProviders: ProviderAttempt[] = [];

  // 1. Infer required capabilities from request context
  const requiredCaps = deps.fallbackResolver.inferCapabilities({}, deps.reasoning);
  const originalModelMeta = await deps.catalog.getModel(deps.primaryModelId);

  // 2. Check per-provider fallback behavior
  if (getProviderBehavior(deps.primaryProvider, deps.config) === 'hard-stop') {
    debug('Provider %s has hard-stop behavior, no fallback', deps.primaryProvider);
    const result = await callFn(deps.primaryRetryProxy);
    return { result };
  }

  // 3. Check if fallback is globally enabled
  if (!deps.config.fallback.enabled) {
    debug('Fallback globally disabled');
    const result = await callFn(deps.primaryRetryProxy);
    return { result };
  }

  // 4. Build affinity key
  const affinityKey = `${deps.primaryProvider}:${JSON.stringify(requiredCaps)}`;

  // 5. Check affinity cache
  const cachedAffinity = deps.affinityCache.get(affinityKey);

  // 6. Try primary provider first
  let primaryError: unknown;
  try {
    const result = await callFn(deps.primaryRetryProxy);
    return { result };
  } catch (error) {
    if (!isFallbackTrigger(error)) throw error;
    primaryError = error;
    triedProviders.push(buildProviderAttempt(deps.primaryProvider, deps.primaryModelId, error));
  }

  // 7. Emit provider:exhausted event
  const exhaustionType = getExhaustionType(primaryError);
  safeEmit(deps.emitter, RouterEvent.PROVIDER_EXHAUSTED, {
    provider: deps.primaryProvider,
    modelId: deps.primaryModelId,
    exhaustionType,
    requestId: deps.requestId,
    timestamp: Date.now(),
  });

  // 8. Try affinity cache hit first (if cached provider not already excluded)
  if (cachedAffinity && !triedProviders.some((a) => a.provider === cachedAffinity.provider)) {
    try {
      const affinityResult = await tryCandidate(
        callFn,
        deps,
        cachedAffinity.provider,
        cachedAffinity.modelId,
      );

      if (affinityResult) {
        // Success via cached affinity
        deps.affinityCache.set(affinityKey, cachedAffinity.provider, cachedAffinity.modelId);

        safeEmit(deps.emitter, RouterEvent.FALLBACK_TRIGGERED, {
          fromProvider: deps.primaryProvider,
          toProvider: cachedAffinity.provider,
          fromModel: deps.primaryModelId,
          toModel: cachedAffinity.modelId,
          reason: triedProviders[0]?.reason ?? 'unknown',
          requestId: deps.requestId,
          timestamp: Date.now(),
        });

        return {
          result: affinityResult.result,
          candidate: affinityResult.candidate,
          fallbackKeyIndexRef: affinityResult.fallbackKeyIndexRef,
        };
      }
    } catch (error) {
      triedProviders.push(
        buildProviderAttempt(cachedAffinity.provider, cachedAffinity.modelId, error),
      );
    }
  }

  // 9. Resolve fallback candidates via resolver
  const resolveOpts: {
    configuredProviders: string[];
    excludeProviders: string[];
    budgetRemaining: number;
    estimatedTokens?: number;
    originalQualityTier?: import('../constants/index.js').QualityTierType;
  } = {
    configuredProviders: Object.keys(deps.config.providers).filter(
      (p) => deps.config.providers[p]?.enabled !== false,
    ),
    excludeProviders: triedProviders.map((a) => a.provider),
    budgetRemaining: await deps.budgetTracker.getRemainingBudget(),
  };
  if (deps.estimatedTokens !== undefined) {
    resolveOpts.estimatedTokens = deps.estimatedTokens;
  }
  if (originalModelMeta?.qualityTier !== undefined) {
    resolveOpts.originalQualityTier = originalModelMeta.qualityTier;
  }
  const candidates = await deps.fallbackResolver.resolve(
    deps.primaryModelId,
    requiredCaps,
    resolveOpts,
  );

  // 10. Try each candidate up to maxDepth - 1 (primary was attempt 1)
  for (const candidate of candidates.slice(0, deps.config.fallback.maxDepth - 1)) {
    // Budget gate: if model is not free and budget is exceeded, skip
    if (!candidate.isFree) {
      const budgetExceeded = await deps.budgetTracker.isExceeded();
      if (budgetExceeded) {
        triedProviders.push({
          provider: candidate.provider,
          modelId: candidate.modelId,
          reason: 'budget_exceeded',
        });
        continue;
      }
    }

    try {
      const candidateResult = await tryCandidateFull(callFn, deps, candidate);

      if (candidateResult) {
        // Success! Update all refs for middleware to record against correct provider
        deps.providerRef.current = candidate.provider;
        deps.modelIdRef.current = candidate.modelId;
        deps.keyIndexRef.current = candidateResult.fallbackKeyIndexRef.current;

        // Update affinity cache
        deps.affinityCache.set(affinityKey, candidate.provider, candidate.modelId);

        // Emit fallback:triggered event
        safeEmit(deps.emitter, RouterEvent.FALLBACK_TRIGGERED, {
          fromProvider: deps.primaryProvider,
          toProvider: candidate.provider,
          fromModel: deps.primaryModelId,
          toModel: candidate.modelId,
          reason: triedProviders[0]?.reason ?? 'unknown',
          requestId: deps.requestId,
          timestamp: Date.now(),
        });

        return {
          result: candidateResult.result,
          candidate,
          fallbackKeyIndexRef: candidateResult.fallbackKeyIndexRef,
        };
      }
    } catch (error) {
      triedProviders.push(buildProviderAttempt(candidate.provider, candidate.modelId, error));
      continue;
    }
  }

  // 11. All providers exhausted
  throw new AllProvidersExhaustedError(deps.primaryModelId, triedProviders);
}

/**
 * Try a candidate by provider/modelId (used for affinity cache hits).
 */
async function tryCandidate(
  callFn: (model: LanguageModelV3) => PromiseLike<unknown>,
  deps: FallbackProxyDeps,
  provider: string,
  modelId: string,
): Promise<{
  result: unknown;
  candidate: FallbackCandidate;
  fallbackKeyIndexRef: { current: number };
} | null> {
  const modelName = modelId.substring(modelId.indexOf('/') + 1);

  // Look up candidate metadata from catalog
  const meta = await deps.catalog.getModel(modelId);
  if (!meta) return null;

  const candidate: FallbackCandidate = {
    provider,
    modelId,
    modelName,
    qualityTier: meta.qualityTier,
    capabilities: meta.capabilities,
    pricing: meta.pricing,
    contextWindow: meta.contextWindow,
    isFree:
      meta.pricing !== null &&
      meta.pricing.promptPer1MTokens === 0 &&
      meta.pricing.completionPer1MTokens === 0,
  };

  const result = await tryCandidateFull(callFn, deps, candidate);
  if (!result) return null;

  return { result: result.result, candidate, fallbackKeyIndexRef: result.fallbackKeyIndexRef };
}

/**
 * Attempt to call a specific fallback candidate.
 * Creates a retry proxy for the candidate and calls it.
 */
async function tryCandidateFull(
  callFn: (model: LanguageModelV3) => PromiseLike<unknown>,
  deps: FallbackProxyDeps,
  candidate: FallbackCandidate,
): Promise<{
  result: unknown;
  fallbackKeyIndexRef: { current: number };
} | null> {
  const fallbackSelection = await deps.keySelector.selectKey(
    candidate.provider,
    candidate.modelName,
    { requestId: deps.requestId },
  );

  const providerConfig = deps.config.providers[candidate.provider];
  if (!providerConfig) return null;

  const keyConfig = providerConfig.keys[fallbackSelection.keyIndex];
  if (keyConfig === undefined) return null;

  const apiKey = typeof keyConfig === 'string' ? keyConfig : keyConfig.key;

  // Create a fresh base model for fallback provider
  const fallbackModel = createProviderInstance(
    deps.registry,
    candidate.provider,
    candidate.modelName,
    apiKey,
  );

  // Create retry proxy for the fallback provider (each gets its own)
  const fallbackKeyIndexRef = { current: fallbackSelection.keyIndex };
  const fallbackRetryProxy = createRetryProxy({
    provider: candidate.provider,
    modelName: candidate.modelName,
    modelId: candidate.modelId,
    initialModel: fallbackModel,
    initialKeyIndex: fallbackSelection.keyIndex,
    initialKey: apiKey,
    config: deps.config,
    registry: deps.registry,
    cooldownManager: deps.cooldownManager,
    disabledKeys: deps.disabledKeys,
    emitter: deps.emitter,
    requestId: deps.requestId,
    keyIndexRef: fallbackKeyIndexRef,
    keySelector: deps.keySelector,
  });

  const result = await callFn(fallbackRetryProxy);
  return { result, fallbackKeyIndexRef };
}

// ── createFallbackProxy ────────────────────────────────────────────

/**
 * Create a LanguageModelV3-compatible proxy that wraps a primary retry proxy
 * and orchestrates cross-provider fallback on terminal errors.
 *
 * On QuotaExhaustedError, RateLimitError, or server ProviderError from the
 * primary provider, the proxy queries FallbackResolver for alternative providers,
 * checks budget, and tries each candidate with its own retry proxy.
 */
export function createFallbackProxy(deps: FallbackProxyDeps): LanguageModelV3 {
  const proxy: LanguageModelV3 = {
    specificationVersion: 'v3' as const,
    provider: 'llm-router',
    modelId: deps.primaryModelId,
    supportedUrls: deps.primaryRetryProxy.supportedUrls,

    async doGenerate(params) {
      const { result, candidate } = await attemptWithFallback(
        (model) => model.doGenerate(params),
        deps,
      );

      const generateResult = result as LanguageModelV3GenerateResult;

      // Add fallback metadata to response via providerMetadata
      if (candidate) {
        try {
          if (generateResult.providerMetadata) {
            generateResult.providerMetadata['llm-router'] = {
              fallbackUsed: true,
              originalModel: deps.primaryModelId,
              actualModel: candidate.modelId,
            };
          }
        } catch {
          // providerMetadata might be read-only in some AI SDK versions
          debug('Could not augment providerMetadata with fallback info');
        }

        // Record cost for budget tracking (fire-and-forget)
        const usage = generateResult.usage;
        deps.budgetTracker
          .recordCost(
            candidate.provider,
            candidate.modelId,
            {
              promptTokens: Number(usage.inputTokens?.total) || 0,
              completionTokens: Number(usage.outputTokens?.total) || 0,
            },
            candidate.pricing,
          )
          .catch((err: unknown) =>
            debug('Budget recording failed: %s', err instanceof Error ? err.message : String(err)),
          );
      }

      return generateResult;
    },

    async doStream(params) {
      const { result, candidate } = await attemptWithFallback(
        (model) => model.doStream(params),
        deps,
      );

      const streamResult = result as LanguageModelV3StreamResult;

      // providerMetadata is not available on LanguageModelV3StreamResult
      // (only on generate results), so we skip metadata augmentation for streams
      if (candidate) {
        // Budget recording at stream setup (actual usage tracked by middleware TransformStream)
        // Use zero tokens since we don't know actual usage until stream completes
        deps.budgetTracker
          .recordCost(
            candidate.provider,
            candidate.modelId,
            { promptTokens: 0, completionTokens: 0 },
            candidate.pricing,
          )
          .catch((err: unknown) =>
            debug('Budget recording failed: %s', err instanceof Error ? err.message : String(err)),
          );
      }

      return streamResult;
    },
  };

  return proxy;
}
