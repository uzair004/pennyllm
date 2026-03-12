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

// Re-export default policies
export { googlePolicy, groqPolicy, openrouterPolicy, shippedDefaults } from './defaults/index.js';
