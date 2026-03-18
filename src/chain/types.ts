import type { QualityTierType } from '../constants/index.js';
import type { CooldownClass } from '../wrapper/error-classifier.js';
import type { ProviderModelDef } from '../providers/types.js';
import type { CreditStatus } from '../credit/types.js';

/**
 * A single entry in the model priority chain.
 * Built at createRouter() time, immutable for the session.
 */
export interface ChainEntry {
  /** Provider ID e.g. 'cerebras' */
  provider: string;
  /** Full model ID e.g. 'cerebras/llama-4-maverick' */
  modelId: string;
  /** API model ID e.g. 'llama-4-maverick' (what SDK expects) */
  apiModelId: string;
  /** Quality tier for filtering */
  qualityTier: QualityTierType;
  /** Whether this is a free-tier model */
  free: boolean;
  /** Model capabilities for per-request filtering */
  capabilities: ProviderModelDef['capabilities'];
  /** Whether this model has been 404'd this session (mutable) */
  stale: boolean;
}

/**
 * Record of a single chain attempt (for error reporting).
 */
export interface ChainAttempt {
  provider: string;
  modelId: string;
  chainPosition: number;
  errorType: string;
  statusCode?: number;
  cooldownMs?: number;
  cooldownClass?: CooldownClass;
  message: string;
}

/**
 * Result from successful chain execution.
 */
export interface ChainResult {
  result: unknown;
  chainPosition: number;
  entry: ChainEntry;
  attempts: ChainAttempt[];
  fallbackUsed: boolean;
}

/**
 * Per-request filter options for router.chat().
 */
export interface ChainFilter {
  capabilities?: Array<'toolCall' | 'reasoning' | 'vision' | 'structuredOutput'>;
  provider?: string;
  tier?: QualityTierType;
}

/**
 * Status of a single chain entry (for router.getStatus()).
 */
export interface ChainEntryStatus {
  provider: string;
  modelId: string;
  qualityTier: QualityTierType;
  free: boolean;
  status: 'available' | 'cooling' | 'depleted' | 'stale';
  cooldownUntil?: string;
  cooldownClass?: CooldownClass;
  creditStatus?: CreditStatus;
}

/**
 * Full chain status (for router.getStatus()).
 */
export interface ChainStatus {
  entries: ChainEntryStatus[];
  totalModels: number;
  availableModels: number;
  depletedProviders: string[];
}
