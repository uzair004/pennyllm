/**
 * Type definitions for PennyLLM
 */

// Configuration types
export type {
  BudgetConfig,
  CooldownConfig,
  ProviderConfig,
  ProviderTier,
  RouterConfig,
} from './config.js';

// Legacy fallback types (moved from fallback module)
export type { FallbackCandidate, ProviderAttempt } from './domain.js';

// Domain types
export type {
  ModelMetadata,
  Policy,
  PolicyLimit,
  ResetWindow,
  TimeWindow,
  UsageRecord,
} from './domain.js';

// Event types
export type {
  BudgetAlertEvent,
  BudgetExceededEvent,
  CatalogRefreshedEvent,
  ConfigLoadedEvent,
  ErrorAuthEvent,
  ErrorEvent,
  ErrorNetworkEvent,
  ErrorRateLimitEvent,
  ErrorServerEvent,
  FallbackTriggeredEvent,
  KeyDisabledEvent,
  KeyRetriedEvent,
  KeySelectedEvent,
  LimitExceededEvent,
  LimitWarningEvent,
  PolicyStaleEvent,
  ProviderExhaustedEvent,
  RequestCompleteEvent,
  RouterEventMap,
  RouterEventPayload,
  RouterEvents,
  UsageRecordedEvent,
  ChainResolvedEvent,
  ProviderDepletedEvent,
  ProviderStaleEvent,
  CreditLowEvent,
  CreditExhaustedEvent,
  CreditExpiringEvent,
} from './events.js';

// Interface types
export type { ModelCatalog, SelectionStrategy, StorageBackend } from './interfaces.js';

// Usage types
export type {
  KeyUsageWindow,
  KeyUsage,
  ProviderUsage,
  UsageSnapshot,
  EstimationConfig,
  EstimationResult,
} from '../usage/types.js';

// Catalog types
export type { ModelListFilter } from '../catalog/types.js';

// Selection types
export type { CandidateKey, SelectionContext, SelectionResult } from '../selection/types.js';

// Credit types
export type { CreditConfig, CreditStatus } from '../credit/types.js';

// Provider config types
export type {
  GoogleProviderConfig,
  GroqProviderConfig,
  MistralProviderConfig,
  CerebrasProviderConfig,
  NvidiaProviderConfig,
} from './providers.js';
