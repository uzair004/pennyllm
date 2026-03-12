import type {
  EnforcementBehaviorType,
  LimitTypeValue,
  QualityTierType,
} from '../constants/index.js';

/**
 * Time window definitions for quota tracking
 */
export interface TimeWindow {
  type: 'per-minute' | 'hourly' | 'daily' | 'monthly' | 'rolling-30d';
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
    promptPer1kTokens: number;
    completionPer1kTokens: number;
  } | null;
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
