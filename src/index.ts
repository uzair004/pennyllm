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
  FallbackTriggeredEvent,
  KeySelectedEvent,
  LimitExceededEvent,
  LimitWarningEvent,
  ModelCatalog,
  ModelMetadata,
  Policy,
  PolicyLimit,
  ProviderConfig,
  ResetWindow,
  RouterConfig,
  RouterEventMap,
  RouterEventPayload,
  RouterEvents,
  SelectionStrategy,
  StorageBackend,
  StorageConfig,
  TimeWindow,
  UsageRecord,
  UsageRecordedEvent,
} from './types/index.js';

// Errors
export { ConfigError, LLMRouterError } from './errors/index.js';
