import type { LimitTypeValue } from '../constants/index.js';
import type { LLMRouterError } from '../errors/base.js';
import type { PolicyStaleEvent as PolicyStaleEventType } from '../policy/types.js';
import type { CatalogRefreshedEvent as CatalogRefreshedEventType } from '../catalog/types.js';

// Re-export PolicyStaleEvent so it can be exported from types/index.ts
export type { PolicyStaleEventType as PolicyStaleEvent };
export type { CatalogRefreshedEventType as CatalogRefreshedEvent };

/**
 * Base event payload
 */
export interface RouterEventPayload {
  timestamp: number;
  requestId?: string;
}

/**
 * Key selected event
 */
export interface KeySelectedEvent extends RouterEventPayload {
  provider: string;
  keyIndex: number;
  model?: string;
  label?: string;
  strategy: string;
  reason: string;
  remainingQuota?: number;
}

/**
 * Usage recorded event
 */
export interface UsageRecordedEvent extends RouterEventPayload {
  provider: string;
  keyIndex: number;
  promptTokens: number;
  completionTokens: number;
  estimated: boolean;
  windows: string[];
}

/**
 * Limit warning event
 */
export interface LimitWarningEvent extends RouterEventPayload {
  provider: string;
  keyIndex: number;
  limitType: LimitTypeValue;
  currentUsage: number;
  limit: number;
  threshold: number;
}

/**
 * Limit exceeded event
 */
export interface LimitExceededEvent extends RouterEventPayload {
  provider: string;
  keyIndex: number;
  limitType: LimitTypeValue;
}

/**
 * Fallback triggered event
 */
export interface FallbackTriggeredEvent extends RouterEventPayload {
  fromProvider: string;
  toProvider: string;
  reason: string;
}

/**
 * Config loaded event
 */
export interface ConfigLoadedEvent extends RouterEventPayload {
  providerCount: number;
  keyCount: number;
}

/**
 * Provider exhausted event
 */
export interface ProviderExhaustedEvent extends RouterEventPayload {
  provider: string;
  totalKeys: number;
  exhaustedCount: number;
  cooldownCount: number;
  earliestRecovery: string | null;
}

/**
 * Error event
 */
export interface ErrorEvent extends RouterEventPayload {
  error: LLMRouterError;
}

/**
 * Error rate limit event - emitted when a key hits 429
 */
export interface ErrorRateLimitEvent extends RouterEventPayload {
  provider: string;
  keyIndex: number;
  modelId: string;
  statusCode: number;
  message: string;
}

/**
 * Error auth event - emitted when a key hits 401/403
 */
export interface ErrorAuthEvent extends RouterEventPayload {
  provider: string;
  keyIndex: number;
  modelId: string;
  statusCode: number;
  message: string;
}

/**
 * Error server event - emitted when a key hits 500+
 */
export interface ErrorServerEvent extends RouterEventPayload {
  provider: string;
  keyIndex: number;
  modelId: string;
  statusCode: number;
  message: string;
}

/**
 * Error network event - emitted on connection failure
 */
export interface ErrorNetworkEvent extends RouterEventPayload {
  provider: string;
  keyIndex: number;
  modelId: string;
  message: string;
}

/**
 * Key retried event - emitted when retrying with a different key
 */
export interface KeyRetriedEvent extends RouterEventPayload {
  provider: string;
  modelId: string;
  failedKeyIndex: number;
  newKeyIndex: number;
  reason: string;
  attempt: number;
  maxAttempts: number;
}

/**
 * Key disabled event - emitted when a key is put into cooldown
 */
export interface KeyDisabledEvent extends RouterEventPayload {
  provider: string;
  keyIndex: number;
  reason: string;
  statusCode: number;
}

/**
 * Request complete event - emitted after successful LLM call
 */
export interface RequestCompleteEvent extends RouterEventPayload {
  provider: string;
  modelId: string;
  keyIndex: number;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  retries: number;
}

/**
 * Type-safe event map
 */
export interface RouterEventMap {
  'key:selected': KeySelectedEvent;
  'usage:recorded': UsageRecordedEvent;
  'limit:warning': LimitWarningEvent;
  'limit:exceeded': LimitExceededEvent;
  'fallback:triggered': FallbackTriggeredEvent;
  'config:loaded': ConfigLoadedEvent;
  'provider:exhausted': ProviderExhaustedEvent;
  'catalog:refreshed': CatalogRefreshedEventType;
  'policy:stale': PolicyStaleEventType;
  error: ErrorEvent;
  'error:rate_limit': ErrorRateLimitEvent;
  'error:auth': ErrorAuthEvent;
  'error:server': ErrorServerEvent;
  'error:network': ErrorNetworkEvent;
  'key:retried': KeyRetriedEvent;
  'key:disabled': KeyDisabledEvent;
  'request:complete': RequestCompleteEvent;
}

/**
 * Union of all event payloads
 */
export type RouterEvents =
  | KeySelectedEvent
  | UsageRecordedEvent
  | LimitWarningEvent
  | LimitExceededEvent
  | FallbackTriggeredEvent
  | ConfigLoadedEvent
  | ProviderExhaustedEvent
  | CatalogRefreshedEventType
  | PolicyStaleEventType
  | ErrorEvent
  | ErrorRateLimitEvent
  | ErrorAuthEvent
  | ErrorServerEvent
  | ErrorNetworkEvent
  | KeyRetriedEvent
  | KeyDisabledEvent
  | RequestCompleteEvent;
