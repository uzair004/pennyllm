import type { EvaluationResult } from '../policy/types.js';

/**
 * Candidate key with eligibility and evaluation status
 */
export interface CandidateKey {
  keyIndex: number;
  label?: string;
  eligible: boolean;
  cooldown: { until: string; reason: string } | null;
  evaluation: EvaluationResult;
}

/**
 * Context for key selection
 */
export interface SelectionContext {
  provider: string;
  model?: string;
  candidates: CandidateKey[];
  estimatedTokens?: number;
}

/**
 * Result of key selection
 */
export interface SelectionResult {
  keyIndex: number;
  reason: string;
}
