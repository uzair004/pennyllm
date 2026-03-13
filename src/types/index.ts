/**
 * Type definitions for LLM Router
 */

// Configuration types
export type { BudgetConfig, CooldownConfig, ProviderConfig, RouterConfig } from './config.js';

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
  CatalogRefreshedEvent,
  ConfigLoadedEvent,
  ErrorEvent,
  FallbackTriggeredEvent,
  KeySelectedEvent,
  LimitExceededEvent,
  LimitWarningEvent,
  PolicyStaleEvent,
  ProviderExhaustedEvent,
  RouterEventMap,
  RouterEventPayload,
  RouterEvents,
  UsageRecordedEvent,
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
