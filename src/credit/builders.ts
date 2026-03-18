import type { CreditConfig } from './types.js';

/**
 * Builder for credit-based limit configuration.
 * Consistent with createTokenLimit/createRateLimit/createCallLimit.
 */
export function createCreditLimit(options: {
  balance: number;
  costRates: { inputPer1MTokens: number; outputPer1MTokens: number };
  expiresAt?: string;
  alertThresholds?: number[];
  expiryWarningDays?: number;
}): CreditConfig {
  const config: CreditConfig = {
    balance: options.balance,
    costRates: options.costRates,
    alertThresholds: options.alertThresholds ?? [0.2, 0.05],
    expiryWarningDays: options.expiryWarningDays ?? 7,
  };
  if (options.expiresAt !== undefined) {
    config.expiresAt = options.expiresAt;
  }
  return config;
}
