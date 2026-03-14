/**
 * Policy module
 */

// Re-export domain types
export type { Policy, PolicyLimit, ResetWindow } from '../types/domain.js';

// Re-export policy types
export type {
  EvaluationResult,
  KeyConfig,
  LimitStatus,
  PolicyStaleEvent,
  ResolvedPolicy,
} from './types.js';

// Re-export resolver functions
export { mergeLimits, resolvePolicies } from './resolver.js';

// Re-export PolicyEngine
export { PolicyEngine } from './PolicyEngine.js';

// Re-export staleness checker
export { checkStaleness } from './staleness.js';
