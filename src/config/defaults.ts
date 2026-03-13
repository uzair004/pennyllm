import { Strategy } from '../constants/index.js';

/**
 * Default configuration values applied when not explicitly set
 */
export const DEFAULT_CONFIG = {
  version: '1.0' as const,
  strategy: Strategy.PRIORITY,
  storage: { type: 'sqlite' as const },
  budget: { monthlyLimit: 0, alertThresholds: [0.8, 0.95] },
  cooldown: { defaultDurationMs: 60000 },
};
