import type { TimeWindow } from '../types/domain.js';

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
}

/**
 * Complete usage snapshot across all providers
 */
export interface UsageSnapshot {
  providers: ProviderUsage[];
  timestamp: string;
}

/**
 * Structured usage data returned by StorageBackend.getUsage()
 */
export interface StructuredUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  callCount: number;
}
