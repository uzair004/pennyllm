import type { StrategyType } from '../constants/index.js';
import type { FallbackConfig, ProviderFallbackOverride } from '../fallback/types.js';
import type { KeyConfig } from '../policy/types.js';
import type { PolicyLimit } from './domain.js';

/**
 * Budget configuration
 */
export interface BudgetConfig {
  monthlyLimit: number;
  alertThresholds: number[];
}

/**
 * Estimation configuration
 */
export interface EstimationConfig {
  defaultMaxTokens: number;
}

/**
 * Cooldown configuration
 */
export interface CooldownConfig {
  defaultDurationMs: number;
}

/**
 * Provider-specific configuration
 */
export interface ProviderConfig {
  keys: KeyConfig[];
  strategy?: StrategyType;
  limits?: PolicyLimit[];
  enabled?: boolean;
  fallback?: ProviderFallbackOverride;
}

/**
 * Main router configuration
 */
export interface RouterConfig {
  version: '1.0';
  providers: Record<string, ProviderConfig>;
  strategy: StrategyType;
  budget: BudgetConfig;
  estimation: EstimationConfig;
  cooldown: CooldownConfig;
  fallback: FallbackConfig;
  warningThreshold?: number;
  applyRegistryDefaults: boolean;
  dryRun: boolean;
  debug: boolean;
}
