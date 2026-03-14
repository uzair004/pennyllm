/**
 * LLM Router - Intelligent API key rotation and quota management
 */

// Config and Router
export {
  createRouter,
  defineConfig,
  configSchema,
  loadConfigFile,
  DEFAULT_CONFIG,
} from './config/index.js';
export type { ConfigInput, ConfigOutput, Router } from './config/index.js';

// Storage
export { MemoryStorage } from './storage/index.js';

// Policy
export {
  PolicyEngine,
  createTokenLimit,
  createRateLimit,
  createCallLimit,
} from './policy/index.js';

// Usage
export { UsageTracker, CooldownManager } from './usage/index.js';

// Catalog
export { DefaultModelCatalog } from './catalog/index.js';

// Selection
export {
  KeySelector,
  PriorityStrategy,
  RoundRobinStrategy,
  LeastUsedStrategy,
} from './selection/index.js';

// Wrapper (AI SDK integration)
export {
  ProviderRegistry,
  createRouterMiddleware,
  routerModel,
  createModelWrapper,
} from './wrapper/index.js';
export type { ProviderFactory } from './wrapper/index.js';

// Constants
export {
  EnforcementBehavior,
  LimitType,
  ModelStatus,
  Provider,
  QualityTier,
  RouterEvent,
  Strategy,
} from './constants/index.js';
export type {
  EnforcementBehaviorType,
  LimitTypeValue,
  ModelStatusType,
  ProviderType,
  QualityTierType,
  RouterEventType,
  StrategyType,
} from './constants/index.js';

// Types
export type {
  BudgetAlertEvent,
  BudgetConfig,
  BudgetExceededEvent,
  CandidateKey,
  CatalogRefreshedEvent,
  CerebrasProviderConfig,
  CloudflareProviderConfig,
  CohereProviderConfig,
  ConfigLoadedEvent,
  CooldownConfig,
  DeepSeekProviderConfig,
  ErrorEvent,
  EstimationConfig,
  EstimationResult,
  FallbackCandidate,
  FallbackConfig,
  FallbackTriggeredEvent,
  GitHubProviderConfig,
  GoogleProviderConfig,
  GroqProviderConfig,
  HuggingFaceProviderConfig,
  KeySelectedEvent,
  KeyUsage,
  KeyUsageWindow,
  LimitExceededEvent,
  LimitWarningEvent,
  MistralProviderConfig,
  ModelCatalog,
  ModelListFilter,
  ModelMetadata,
  NvidiaProviderConfig,
  OpenRouterProviderConfig,
  Policy,
  PolicyLimit,
  PolicyStaleEvent,
  ProviderAttempt,
  ProviderConfig,
  ProviderExhaustedEvent,
  ProviderFallbackOverride,
  ProviderUsage,
  QwenProviderConfig,
  ResetWindow,
  RouterConfig,
  RouterEventMap,
  RouterEventPayload,
  RouterEvents,
  SelectionContext,
  SelectionResult,
  SelectionStrategy,
  StorageBackend,
  TimeWindow,
  UsageRecord,
  UsageRecordedEvent,
  UsageSnapshot,
} from './types/index.js';

// Errors
export {
  AllProvidersExhaustedError,
  ConfigError,
  LLMRouterError,
  RateLimitError,
  QuotaExhaustedError,
} from './errors/index.js';
