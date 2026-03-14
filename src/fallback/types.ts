import type { QualityTierType } from '../constants/index.js';
import type { ModelMetadata } from '../types/domain.js';

/**
 * Fallback behavior options
 */
export type FallbackBehavior = 'auto' | 'hard-stop' | 'cheapest-paid';

/**
 * Per-provider fallback override
 */
export interface ProviderFallbackOverride {
  behavior?: FallbackBehavior;
}

/**
 * Top-level fallback configuration
 */
export interface FallbackConfig {
  enabled: boolean;
  maxDepth: number;
  strictModel: boolean;
  behavior: 'auto' | 'hard-stop';
  modelMappings?: Record<string, string>;
  reasoning: boolean;
}

/**
 * Result of fallback resolution - a candidate provider/model
 */
export interface FallbackCandidate {
  provider: string;
  modelId: string;
  modelName: string;
  qualityTier: QualityTierType;
  capabilities: ModelMetadata['capabilities'];
  pricing: ModelMetadata['pricing'];
  contextWindow: number;
  isFree: boolean;
}

/**
 * Record of a single provider attempt during fallback
 */
export interface ProviderAttempt {
  provider: string;
  modelId: string;
  reason:
    | 'quota_exhausted'
    | 'rate_limited'
    | 'server_error'
    | 'budget_exceeded'
    | 'no_match'
    | 'auth_failed';
  error?: Error;
  earliestRecovery?: string;
}

/**
 * Affinity cache entry
 */
export interface AffinityEntry {
  provider: string;
  modelId: string;
  timestamp: number;
}

/**
 * Options passed to FallbackProxy.create
 */
export interface FallbackProxyOptions {
  strictModel: boolean;
  reasoning: boolean;
  estimatedTokens?: number;
}
