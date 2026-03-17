/**
 * PennyLLM - Intelligent API key rotation and quota management
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

// Storage adapters (optional peer dependencies)
// Users import directly: import { SqliteStorage } from 'pennyllm/sqlite'
// Users import directly: import { RedisStorage } from 'pennyllm/redis'
// Type-only exports are safe (erased at compile time)
export type { SqliteStorageOptions } from './sqlite/index.js';
export type { RedisStorageOptions } from './redis/index.js';

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

// Debug
export { DebugLogger } from './debug/index.js';

// Budget
export { BudgetTracker } from './budget/index.js';

// Chain (new in Phase 12)
export type {
  ChainEntry,
  ChainResult,
  ChainStatus,
  ChainFilter,
  ChainAttempt,
  ChainEntryStatus,
} from './chain/index.js';

// Providers (new in Phase 12)
export type { ProviderModule, ProviderModelDef } from './providers/types.js';
export { getAllProviders, getProviderModule } from './providers/registry.js';

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
  ProviderTier,
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
  ChainResolvedEvent,
  ProviderDepletedEvent,
  ProviderStaleEvent,
} from './types/index.js';

// Errors
export {
  AllProvidersExhaustedError,
  AuthError,
  ConfigError,
  PennyLLMError,
  NetworkError,
  ProviderError,
  RateLimitError,
  QuotaExhaustedError,
} from './errors/index.js';
