import type { RouterEventPayload } from '../types/events.js';

/**
 * Budget alert event - fires at configured thresholds
 */
export interface BudgetAlertEvent extends RouterEventPayload {
  threshold: number;
  spent: number;
  limit: number;
  remaining: number;
  avgCostPerRequest: number;
}

/**
 * Budget exceeded event - fires when cap hit
 */
export interface BudgetExceededEvent extends RouterEventPayload {
  spent: number;
  limit: number;
  lastRequestCost: number;
}
