import type { TimeWindow } from '../types/domain.js';

export type { StructuredUsage } from '../types/interfaces.js';

/**
 * Configuration for token estimation
 */
export interface EstimationConfig {
  defaultMaxTokens: number;
  tokenEstimator?: (text: string) => number;
}

/**
 * Result of token estimation
 */
export interface EstimationResult {
  prompt: number;
  completion: number;
}

/**
 * Usage data for a specific key within a time window
 */
export interface KeyUsageWindow {
  type: TimeWindow['type'];
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  callCount: number;
  limit: number;
  remaining: number;
  percentUsed: number;
  resetAt: string;
}

/**
 * Rate limit observability stats per provider/key.
 * Populated by ChainExecutor on 429/402 errors.
 */
export interface RateLimitStats {
  /** Total number of 429/402 responses received */
  rateLimitHits: number;
  /** ISO timestamp of the most recent rate limit event, or null if none */
  lastRateLimited: string | null;
  /** Number of times a cooldown was triggered (provider-level or key-level) */
  cooldownsTriggered: number;
  /** Total milliseconds spent in cooldown (sum of all cooldown durations) */
  totalCooldownMs: number;
}

/**
 * Usage data for a specific API key
 */
export interface KeyUsage {
  keyIndex: number;
  windows: KeyUsageWindow[];
  cooldown: {
    active: boolean;
    until: string | null;
    reason: string | null;
  };
  estimatedRecords: number;
  rateLimitStats: RateLimitStats;
}

/**
 * Usage data for a provider (all keys)
 */
export interface ProviderUsage {
  provider: string;
  keys: KeyUsage[];
  totals: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    callCount: number;
  };
  rateLimitStats: RateLimitStats;
}

/**
 * Complete usage snapshot across all providers
 */
export interface UsageSnapshot {
  providers: ProviderUsage[];
  timestamp: string;
}
