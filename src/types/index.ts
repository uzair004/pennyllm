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

// Fallback types (kept for fallback module, will be cleaned up in Plan 06)
export type { FallbackCandidate, ProviderAttempt } from '../fallback/types.js';

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

// Provider config types
export type {
  GoogleProviderConfig,
  GroqProviderConfig,
  OpenRouterProviderConfig,
  MistralProviderConfig,
  HuggingFaceProviderConfig,
  CerebrasProviderConfig,
  DeepSeekProviderConfig,
  QwenProviderConfig,
  CloudflareProviderConfig,
  NvidiaProviderConfig,
  CohereProviderConfig,
  GitHubProviderConfig,
} from './providers.js';
