import type { LimitTypeValue } from '../constants/index.js';
import type { LLMRouterError } from '../errors/base.js';
import type { PolicyStaleEvent as PolicyStaleEventType } from '../policy/types.js';

// Re-export PolicyStaleEvent so it can be exported from types/index.ts
export type { PolicyStaleEventType as PolicyStaleEvent };

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
 * Error event
 */
export interface ErrorEvent extends RouterEventPayload {
  error: LLMRouterError;
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
  'policy:stale': PolicyStaleEventType;
  error: ErrorEvent;
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
  | PolicyStaleEventType
  | ErrorEvent;
