import type { EnforcementBehaviorType, LimitTypeValue } from '../constants/index.js';
import type { Policy, PolicyLimit } from '../types/domain.js';

/**
 * Per-key configuration - either a simple string or object with limits and label
 */
export type KeyConfig = string | { key: string; label?: string; limits?: PolicyLimit[] };

/**
 * Resolved policy for a specific API key after three-layer merge
 */
export interface ResolvedPolicy {
  provider: string;
  keyId: string;
  keyIndex: number;
  limits: PolicyLimit[];
  enforcement: EnforcementBehaviorType;
  metadata?: Policy['metadata'];
  modelLimits?: Map<string, PolicyLimit[]>;
}

/**
 * Per-limit evaluation detail
 */
export interface LimitStatus {
  type: LimitTypeValue;
  current: number;
  max: number;
  remaining: number;
  percentUsed: number;
  resetAt: Date;
}

/**
 * Result of evaluating a key against policy limits
 */
export interface EvaluationResult {
  eligible: boolean;
  limits: LimitStatus[];
  closestLimit?: LimitStatus;
  enforcement: EnforcementBehaviorType;
}

/**
 * Event emitted when a policy's metadata is stale
 */
export interface PolicyStaleEvent {
  provider: string;
  researchedDate: string;
  daysOld: number;
  suggestion: string;
}
