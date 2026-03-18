import type { RouterEventPayload } from '../types/events.js';

/** Credit configuration for a provider (from user config) */
export interface CreditConfig {
  balance: number;
  costRates: {
    inputPer1MTokens: number;
    outputPer1MTokens: number;
  };
  expiresAt?: string;
  alertThresholds: number[];
  expiryWarningDays: number;
}

/** Credit status for a provider (from getStatus()) */
export interface CreditStatus {
  provider: string;
  balance: number;
  consumed: number;
  remaining: number;
  percentUsed: number;
  expiresAt?: string;
  expired: boolean;
  exhausted: boolean;
}

/** credit:low event payload */
export interface CreditLowEvent extends RouterEventPayload {
  provider: string;
  threshold: number;
  remaining: number;
  balance: number;
  percentRemaining: number;
}

/** credit:exhausted event payload */
export interface CreditExhaustedEvent extends RouterEventPayload {
  provider: string;
  balance: number;
  consumed: number;
  reason: 'depleted' | 'expired';
}

/** credit:expiring event payload */
export interface CreditExpiringEvent extends RouterEventPayload {
  provider: string;
  expiresAt: string;
  daysRemaining: number;
}
