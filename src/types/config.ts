import type { StrategyType } from '../constants/index.js';
import type { PolicyLimit } from './domain.js';

/**
 * Storage backend configuration
 */
export interface StorageConfig {
  type: 'sqlite' | 'redis' | 'memory';
  path?: string;
  url?: string;
}

/**
 * Budget configuration
 */
export interface BudgetConfig {
  monthlyLimit: number;
  alertThresholds: number[];
}

/**
 * Provider-specific configuration
 */
export interface ProviderConfig {
  keys: string[];
  strategy?: StrategyType;
  limits?: PolicyLimit[];
  enabled?: boolean;
}

/**
 * Main router configuration
 */
export interface RouterConfig {
  version: '1.0';
  providers: Record<string, ProviderConfig>;
  strategy: StrategyType;
  storage: StorageConfig;
  budget: BudgetConfig;
}
