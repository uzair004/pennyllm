import type {
  EnforcementBehaviorType,
  LimitTypeValue,
  ModelStatusType,
  QualityTierType,
} from '../constants/index.js';

/**
 * Time window definitions for quota tracking
 */
export interface TimeWindow {
  type: 'per-minute' | 'hourly' | 'daily' | 'monthly' | 'rolling-30d' | 'lifetime';
  durationMs: number;
}

/**
 * Policy limit specification
 */
export interface PolicyLimit {
  type: LimitTypeValue;
  value: number;
  window: TimeWindow;
}

/**
 * Reset window configuration
 */
export interface ResetWindow {
  type: TimeWindow['type'];
  resetAt: 'calendar' | 'rolling';
}

/**
 * Provider policy with rate limits and enforcement behavior
 */
export interface Policy {
  id: string;
  provider: string;
  version: string;
  limits: PolicyLimit[];
  enforcement: EnforcementBehaviorType;
  resetWindows: ResetWindow[];
  metadata: {
    researchedDate: string;
    confidence: 'high' | 'medium' | 'low';
    sourceUrl?: string;
  };
}

/**
 * Model metadata with capabilities and pricing
 */
export interface ModelMetadata {
  id: string;
  provider: string;
  name: string;
  capabilities: {
    reasoning: boolean;
    toolCall: boolean;
    structuredOutput: boolean;
    vision: boolean;
  };
  qualityTier: QualityTierType;
  contextWindow: number;
  pricing: {
    promptPer1MTokens: number;
    completionPer1MTokens: number;
  } | null;
  status: ModelStatusType;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Usage record for quota tracking
 */
export interface UsageRecord {
  id: string;
  provider: string;
  keyIndex: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  timestamp: number;
  window: TimeWindow;
  estimated: boolean;
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
    | 'auth_failed'
    | 'circuit_open';
  error?: Error;
  earliestRecovery?: string;
  estimatedRecoveryMs?: number;
}
