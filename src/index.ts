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
export { PolicyEngine } from './policy/index.js';

// Usage
export { UsageTracker, CooldownManager } from './usage/index.js';

// Constants
export {
  EnforcementBehavior,
  LimitType,
  Provider,
  QualityTier,
  RouterEvent,
  Strategy,
} from './constants/index.js';
export type {
  EnforcementBehaviorType,
  LimitTypeValue,
  ProviderType,
  QualityTierType,
  RouterEventType,
  StrategyType,
} from './constants/index.js';

// Types
export type {
  BudgetConfig,
  ConfigLoadedEvent,
  ErrorEvent,
  EstimationConfig,
  EstimationResult,
  FallbackTriggeredEvent,
  KeySelectedEvent,
  KeyUsage,
  KeyUsageWindow,
  LimitExceededEvent,
  LimitWarningEvent,
  ModelCatalog,
  ModelMetadata,
  Policy,
  PolicyLimit,
  PolicyStaleEvent,
  ProviderConfig,
  ProviderUsage,
  ResetWindow,
  RouterConfig,
  RouterEventMap,
  RouterEventPayload,
  RouterEvents,
  SelectionStrategy,
  StorageBackend,
  TimeWindow,
  UsageRecord,
  UsageRecordedEvent,
  UsageSnapshot,
} from './types/index.js';

// Errors
export { ConfigError, LLMRouterError } from './errors/index.js';
