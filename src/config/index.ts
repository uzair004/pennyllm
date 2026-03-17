import debugFactory from 'debug';
import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { ZodError } from 'zod';
import type { LanguageModelV3 } from '@ai-sdk/provider';
import { wrapLanguageModel } from 'ai';
import type { RouterConfig } from '../types/config.js';
import type { StorageBackend, ModelCatalog, SelectionStrategy } from '../types/interfaces.js';
import { MemoryStorage } from '../storage/index.js';
import { ConfigError } from '../errors/config-error.js';
import { configSchema, type ConfigInput } from './schema.js';
import { formatConfigErrors } from './validation.js';
import { loadConfigFile } from './loader.js';
import { PolicyEngine } from '../policy/PolicyEngine.js';
import { resolvePolicies } from '../policy/resolver.js';
import type { Policy } from '../types/domain.js';
import { checkStaleness } from '../policy/staleness.js';
import { UsageTracker } from '../usage/UsageTracker.js';
import type { UsageSnapshot, ProviderUsage, EstimationConfig } from '../usage/types.js';
import { DefaultModelCatalog } from '../catalog/DefaultModelCatalog.js';
import { KeySelector } from '../selection/KeySelector.js';
import type { SelectionContext, SelectionResult } from '../selection/types.js';
import { ProviderRegistry, createProviderInstance } from '../wrapper/provider-registry.js';
import { createRouterMiddleware } from '../wrapper/middleware.js';
import { createRetryProxy } from '../wrapper/retry-proxy.js';
import { BudgetTracker } from '../budget/BudgetTracker.js';
import { DebugLogger } from '../debug/index.js';
import { buildChain } from '../chain/chain-builder.js';
import { createChainProxy, getChainStatus } from '../chain/ChainExecutor.js';
import type { ChainEntry, ChainFilter, ChainStatus } from '../chain/types.js';
import { checkProviderStaleness, getProviderModule } from '../providers/registry.js';
import type {
  KeySelectedEvent,
  UsageRecordedEvent,
  LimitWarningEvent,
  LimitExceededEvent,
  FallbackTriggeredEvent,
  ErrorEvent,
  ChainResolvedEvent,
  ProviderDepletedEvent,
  ProviderStaleEvent,
} from '../types/events.js';
import type { BudgetAlertEvent, BudgetExceededEvent } from '../budget/types.js';
import { RouterEvent } from '../constants/index.js';

const debug = debugFactory('pennyllm:config');

/**
 * Router instance interface with chain-based routing
 */
export interface Router {
  model: (
    modelId: string,
    options?: { strategy?: string; estimatedTokens?: number; requestId?: string },
  ) => Promise<{ keyIndex: number; key: string; reason: string }>;
  wrapModel: (
    modelId: string,
    options?: {
      strategy?: string;
      estimatedTokens?: number;
      requestId?: string;
    },
  ) => Promise<LanguageModelV3>;
  chat: (filter?: ChainFilter) => LanguageModelV3;
  getStatus: () => ChainStatus;
  getUsage: {
    (): Promise<UsageSnapshot>;
    (provider: string): Promise<ProviderUsage>;
  };
  resetUsage: (provider?: string, keyIndex?: number) => Promise<void>;
  health: () => Promise<unknown>;
  getConfig: () => RouterConfig & { resolvedPolicies: ReturnType<PolicyEngine['getAllPolicies']> };
  storage: StorageBackend;
  policy: PolicyEngine;
  usage: UsageTracker;
  catalog: ModelCatalog;
  selection: KeySelector;
  budget: BudgetTracker;
  close: () => Promise<void>;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  off: (event: string, handler: (...args: unknown[]) => void) => void;
  // Typed observability hooks
  onKeySelected: (cb: (event: KeySelectedEvent) => void) => () => void;
  onUsageRecorded: (cb: (event: UsageRecordedEvent) => void) => () => void;
  onLimitWarning: (cb: (event: LimitWarningEvent) => void) => () => void;
  onLimitExceeded: (cb: (event: LimitExceededEvent) => void) => () => void;
  onFallbackTriggered: (cb: (event: FallbackTriggeredEvent) => void) => () => void;
  onBudgetAlert: (cb: (event: BudgetAlertEvent) => void) => () => void;
  onBudgetExceeded: (cb: (event: BudgetExceededEvent) => void) => () => void;
  onError: (cb: (event: ErrorEvent) => void) => () => void;
  onChainResolved: (cb: (event: ChainResolvedEvent) => void) => () => void;
  onProviderDepleted: (cb: (event: ProviderDepletedEvent) => void) => () => void;
  onProviderStale: (cb: (event: ProviderStaleEvent) => void) => () => void;
}

/**
 * Create a router instance from configuration with chain-based routing
 * @param configOrPath - Configuration object or path to config file
 * @param options - Optional configuration options
 * @param options.storage - Custom storage backend (defaults to MemoryStorage)
 * @param options.tokenEstimator - Custom token estimation function
 * @param options.catalog - Custom model catalog (defaults to DefaultModelCatalog)
 * @param options.strategy - Custom selection strategy
 * @returns Router instance
 * @throws {ConfigError} If configuration is invalid
 */
export async function createRouter(
  configOrPath: ConfigInput | string,
  options?: {
    storage?: StorageBackend;
    tokenEstimator?: (text: string) => number;
    catalog?: ModelCatalog;
    strategy?:
      | SelectionStrategy
      | ((context: SelectionContext) => SelectionResult | Promise<SelectionResult>);
  },
): Promise<Router> {
  let config: RouterConfig;

  try {
    if (typeof configOrPath === 'string') {
      // Load from file
      config = await loadConfigFile(configOrPath);
    } else {
      // Validate object
      config = configSchema.parse(configOrPath) as RouterConfig;
    }

    // Resolve storage backend
    const storage = options?.storage ?? new MemoryStorage();

    // Create EventEmitter for router events
    const emitter = new EventEmitter();

    // Resolve policies with empty defaults (shipped defaults removed in Phase 8)
    const emptyDefaults = new Map<string, Policy>();
    const resolvedPolicies = resolvePolicies(config, emptyDefaults);

    // Create PolicyEngine
    const policyEngineOptions: { warningThreshold?: number } = {};
    if (config.warningThreshold !== undefined) {
      policyEngineOptions.warningThreshold = config.warningThreshold;
    }
    const policyEngine = new PolicyEngine(resolvedPolicies, storage, emitter, policyEngineOptions);

    // Check for stale policies at startup
    checkStaleness(resolvedPolicies, emitter);

    // Build EstimationConfig
    const estimationConfig: EstimationConfig = {
      defaultMaxTokens: config.estimation.defaultMaxTokens,
    };
    if (options?.tokenEstimator !== undefined) {
      estimationConfig.tokenEstimator = options.tokenEstimator;
    }

    // Create UsageTracker
    const usageTracker = new UsageTracker(storage, resolvedPolicies, emitter, estimationConfig);

    // Initialize catalog
    const catalog = options?.catalog ?? new DefaultModelCatalog(emitter);

    // Eager init: fetch catalog at startup (non-blocking -- falls back to static)
    try {
      await catalog.refresh();
    } catch (err) {
      debug(
        'Catalog initial fetch failed, will use static snapshot: %s',
        err instanceof Error ? err.message : String(err),
      );
    }

    // Initialize KeySelector
    const cooldownManager = usageTracker.getCooldownManager();
    const keySelector = new KeySelector(
      config,
      policyEngine,
      cooldownManager,
      emitter,
      options?.strategy,
    );

    // Create BudgetTracker
    const budgetTracker = new BudgetTracker(storage, config.budget, emitter);

    // Shared disabled keys set across all wrapModel calls for this router instance
    const disabledKeys = new Set<string>();

    // Build model priority chain at startup
    const chain: ChainEntry[] = buildChain(config);

    // Check provider staleness at startup
    const configuredProviderIds = Object.keys(config.providers).filter(
      (p) => config.providers[p]?.enabled !== false,
    );
    checkProviderStaleness(configuredProviderIds, emitter);

    // Load persisted cooldowns at startup
    await usageTracker.loadPersistedCooldowns();

    // Register async provider factories from provider modules
    const providerRegistry = new ProviderRegistry();
    for (const providerId of configuredProviderIds) {
      const mod = getProviderModule(providerId);
      if (mod) {
        providerRegistry.registerAsync(providerId, mod.createFactory.bind(mod));
      }
    }

    // Lazy-init default registry for wrapModel (legacy path, loads @ai-sdk/* directly)
    let defaultRegistry: ProviderRegistry | null = null;

    async function getDefaultRegistry(): Promise<ProviderRegistry> {
      if (defaultRegistry === null) {
        defaultRegistry = await ProviderRegistry.createDefault();
      }
      return defaultRegistry;
    }

    debug('Router created with config (keys redacted), chain has %d models', chain.length);

    // Typed hook helper factory -- wraps emitter.on and returns unsubscribe function
    function createHook<T>(eventName: string): (cb: (event: T) => void) => () => void {
      return (cb: (event: T) => void) => {
        const handler = (...args: unknown[]) => cb(args[0] as T);
        emitter.on(eventName, handler);
        return () => {
          emitter.off(eventName, handler);
        };
      };
    }

    // Return implementation with chain-based routing
    const routerImpl: Router = {} as Router;

    // Assign router methods
    Object.assign(routerImpl, {
      model: async (
        modelId: string,
        opts?: { strategy?: string; estimatedTokens?: number; requestId?: string },
      ) => {
        // Parse provider/model format: 'google/gemini-2.0-flash'
        const slashIndex = modelId.indexOf('/');
        if (slashIndex === -1) {
          throw new ConfigError(
            'Model ID must be in provider/model format (e.g., "google/gemini-2.0-flash")',
            {
              field: 'modelId',
            },
          );
        }
        const provider = modelId.substring(0, slashIndex);
        const model = modelId.substring(slashIndex + 1);

        // Check model in catalog (warn but allow unknown)
        const modelMeta = await catalog.getModel(modelId);
        if (!modelMeta) {
          debug('Model %s not in catalog, proceeding with selection', modelId);
        }

        // Select key
        const selectOptions: { strategy?: string; estimatedTokens?: number; requestId?: string } =
          {};
        if (opts?.strategy !== undefined) {
          selectOptions.strategy = opts.strategy;
        }
        if (opts?.estimatedTokens !== undefined) {
          selectOptions.estimatedTokens = opts.estimatedTokens;
        }
        if (opts?.requestId !== undefined) {
          selectOptions.requestId = opts.requestId;
        }
        const result = await keySelector.selectKey(provider, model, selectOptions);

        // Resolve actual API key string
        const providerConfig = config.providers[provider];
        if (!providerConfig) {
          throw new ConfigError(`Provider ${provider} not configured`, { field: 'providers' });
        }
        const keyConfig = providerConfig.keys[result.keyIndex];
        if (keyConfig === undefined) {
          throw new ConfigError(`Key index ${result.keyIndex} not found for provider ${provider}`, {
            field: 'providers',
          });
        }
        const apiKey = typeof keyConfig === 'string' ? keyConfig : keyConfig.key;

        return {
          keyIndex: result.keyIndex,
          key: apiKey,
          reason: result.reason,
        };
      },

      wrapModel: async (
        modelId: string,
        opts?: {
          strategy?: string;
          estimatedTokens?: number;
          requestId?: string;
        },
      ) => {
        // Reuse existing router.model() logic for selection + key resolution
        const selection = await routerImpl.model(modelId, opts);

        // Parse provider and model name
        const provider = modelId.substring(0, modelId.indexOf('/'));
        const modelName = modelId.substring(modelId.indexOf('/') + 1);

        // Generate requestId if not provided
        const requestId = opts?.requestId ?? randomUUID();

        // Create base model with selected API key (lazy-init registry on first call)
        const registry = await getDefaultRegistry();
        const baseModel = createProviderInstance(registry, provider, modelName, selection.key);

        // Mutable refs shared between retry proxy and middleware
        const keyIndexRef = { current: selection.keyIndex };
        const providerRef = { current: provider };
        const modelIdRef = { current: modelId };

        // Create retry proxy that wraps base model with key rotation
        const retryProxy = createRetryProxy({
          provider,
          modelName,
          modelId,
          initialModel: baseModel,
          initialKeyIndex: selection.keyIndex,
          initialKey: selection.key,
          config,
          registry,
          cooldownManager,
          disabledKeys,
          emitter,
          requestId,
          keyIndexRef,
          keySelector,
        });

        // Create middleware for usage tracking (uses refs for correct key after retry)
        const middleware = createRouterMiddleware({
          providerRef,
          keyIndexRef,
          modelIdRef,
          tracker: usageTracker,
          requestId,
          dryRun: config.dryRun,
        });

        // Wrap retry proxy with middleware
        const wrappedModel = wrapLanguageModel({
          model: retryProxy,
          middleware,
          modelId,
          providerId: 'pennyllm',
        });
        return wrappedModel;
      },

      chat: (filter?: ChainFilter) => {
        const providerRef = { current: '' };
        const keyIndexRef = { current: 0 };
        const modelIdRef = { current: 'pennyllm/chain' };

        const chainProxy = createChainProxy(
          {
            chain,
            config,
            cooldownManager,
            budgetTracker,
            keySelector,
            disabledKeys,
            emitter,
            usageTracker,
            providerRef,
            keyIndexRef,
            modelIdRef,
          },
          filter,
        );

        const middleware = createRouterMiddleware({
          providerRef,
          keyIndexRef,
          modelIdRef,
          tracker: usageTracker,
          requestId: randomUUID(),
          dryRun: config.dryRun,
        });

        return wrapLanguageModel({
          model: chainProxy,
          middleware,
          modelId: 'pennyllm/chain',
          providerId: 'pennyllm',
        });
      },

      getStatus: () => {
        return getChainStatus(chain, cooldownManager);
      },

      getUsage: (async (provider?: string) => {
        if (provider !== undefined) {
          return usageTracker.getUsage(provider);
        }
        return usageTracker.getUsage();
      }) as Router['getUsage'],
      resetUsage: async (provider?: string, keyIndex?: number) => {
        return usageTracker.resetUsage(provider, keyIndex);
      },
      // eslint-disable-next-line @typescript-eslint/require-await
      health: async () => {
        debug('health() stub called');
        return { status: 'ok' };
      },
      getConfig: () => ({
        ...config,
        resolvedPolicies: policyEngine.getAllPolicies(),
      }),
      storage,
      policy: policyEngine,
      usage: usageTracker,
      catalog,
      selection: keySelector,
      budget: budgetTracker,

      close: async () => {
        debug('Closing router');
        await catalog.close();
        await storage.close();
      },
      on: (event: string, handler: (...args: unknown[]) => void) => {
        emitter.on(event, handler);
      },
      off: (event: string, handler: (...args: unknown[]) => void) => {
        emitter.off(event, handler);
      },
      // Typed observability hooks
      onKeySelected: createHook<KeySelectedEvent>(RouterEvent.KEY_SELECTED),
      onUsageRecorded: createHook<UsageRecordedEvent>(RouterEvent.USAGE_RECORDED),
      onLimitWarning: createHook<LimitWarningEvent>(RouterEvent.LIMIT_WARNING),
      onLimitExceeded: createHook<LimitExceededEvent>(RouterEvent.LIMIT_EXCEEDED),
      onFallbackTriggered: createHook<FallbackTriggeredEvent>(RouterEvent.FALLBACK_TRIGGERED),
      onBudgetAlert: createHook<BudgetAlertEvent>(RouterEvent.BUDGET_ALERT),
      onBudgetExceeded: createHook<BudgetExceededEvent>(RouterEvent.BUDGET_EXCEEDED),
      onError: createHook<ErrorEvent>(RouterEvent.ERROR),
      onChainResolved: createHook<ChainResolvedEvent>(RouterEvent.CHAIN_RESOLVED),
      onProviderDepleted: createHook<ProviderDepletedEvent>(RouterEvent.PROVIDER_DEPLETED),
      onProviderStale: createHook<ProviderStaleEvent>(RouterEvent.PROVIDER_STALE),
    });

    // Enable debug mode from config flag or DEBUG env var
    const shouldDebug = config.debug || /pennyllm/.test(process.env['DEBUG'] ?? '');
    if (shouldDebug) {
      const debugLogger = new DebugLogger();
      debugLogger.attach(routerImpl);
    }

    return routerImpl;
  } catch (error) {
    if (error instanceof ConfigError) {
      throw error;
    }
    if (error instanceof ZodError) {
      const formatted = formatConfigErrors(error, configOrPath);
      const configErrorOpts: { field?: string; cause?: Error } = { cause: error };
      if (formatted.field !== undefined) {
        configErrorOpts.field = formatted.field;
      }
      throw new ConfigError(formatted.message, configErrorOpts);
    }
    const options: { field?: string; cause?: Error } = {};
    if (error instanceof Error) {
      options.cause = error;
    }
    throw new ConfigError('Failed to create router', options);
  }
}

// Re-exports
export { configSchema } from './schema.js';
export { loadConfigFile } from './loader.js';
export { defineConfig } from './define-config.js';
export { DEFAULT_CONFIG } from './defaults.js';
export type { ConfigInput, ConfigOutput } from './schema.js';
