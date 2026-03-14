import { EventEmitter } from 'node:events';
import debugFactory from 'debug';
import type { StorageBackend } from '../types/interfaces.js';
import type { ModelMetadata, TimeWindow } from '../types/domain.js';
import type { BudgetConfig } from '../types/config.js';
import { RouterEvent } from '../constants/index.js';
import type { BudgetAlertEvent, BudgetExceededEvent } from './types.js';

const debug = debugFactory('llm-router:budget');

/**
 * Monthly time window for budget storage
 */
const MONTHLY_WINDOW: TimeWindow = {
  type: 'monthly',
  durationMs: 30 * 24 * 60 * 60 * 1000,
};

/**
 * BudgetTracker records cost after paid calls using StorageBackend with
 * monthly key pattern. Emits budget:alert at configured thresholds and
 * budget:exceeded when cap hit. Free calls are NOT tracked.
 *
 * Budget storage key pattern:
 * - provider: 'budget', keyIndex: 0
 * - Cost stored as micro-dollars in promptTokens field
 * - completionTokens field unused (0)
 * - callCount tracks number of paid calls
 */
export class BudgetTracker {
  private readonly storage: StorageBackend;
  private readonly budgetConfig: BudgetConfig;
  private readonly emitter: EventEmitter;
  private readonly alertsFired: Set<number> = new Set();
  private paidCallCount = 0;

  constructor(storage: StorageBackend, budgetConfig: BudgetConfig, emitter: EventEmitter) {
    this.storage = storage;
    this.budgetConfig = budgetConfig;
    this.emitter = emitter;
  }

  /**
   * Record cost after a paid call. Fire-and-forget pattern.
   *
   * - If pricing is null: log warning and return (cost not tracked)
   * - If pricing is all zeros (free model): return immediately
   * - Calculate cost and store as micro-dollars
   * - Check thresholds for budget events
   */
  async recordCost(
    _provider: string,
    modelId: string,
    usage: { promptTokens: number; completionTokens: number },
    pricing: ModelMetadata['pricing'],
  ): Promise<void> {
    // No pricing data: skip tracking, log warning
    if (pricing === null) {
      debug('Model %s has no pricing data, cost not tracked', modelId);
      return;
    }

    // Free model: skip tracking
    if (pricing.promptPer1MTokens === 0 && pricing.completionPer1MTokens === 0) {
      return;
    }

    // Calculate cost in dollars
    const cost =
      (usage.promptTokens * pricing.promptPer1MTokens +
        usage.completionTokens * pricing.completionPer1MTokens) /
      1_000_000;

    // Guard against bad data
    if (cost <= 0) {
      return;
    }

    // Store as micro-dollars
    const microDollars = Math.round(cost * 1_000_000);

    try {
      await this.storage.increment(
        'budget',
        0,
        { prompt: microDollars, completion: 0 },
        MONTHLY_WINDOW,
        1,
      );
    } catch (error) {
      debug('Failed to record budget cost: %O', error);
      return;
    }

    this.paidCallCount++;

    await this.checkThresholds(cost);
  }

  /**
   * Get current month's total spend in dollars
   */
  async getMonthlySpend(): Promise<number> {
    try {
      const usage = await this.storage.getUsage('budget', 0, MONTHLY_WINDOW);
      return usage.promptTokens / 1_000_000;
    } catch (error) {
      debug('Failed to get monthly spend: %O', error);
      return 0;
    }
  }

  /**
   * Check if budget is exceeded.
   * - $0 budget = always exceeded (prevents any paid calls)
   * - Otherwise: true when spend >= limit
   */
  async isExceeded(): Promise<boolean> {
    if (this.budgetConfig.monthlyLimit === 0) {
      return true;
    }
    return (await this.getMonthlySpend()) >= this.budgetConfig.monthlyLimit;
  }

  /**
   * Get remaining budget in dollars.
   * - $0 budget = 0 remaining
   * - Otherwise: max(0, limit - spent)
   */
  async getRemainingBudget(): Promise<number> {
    if (this.budgetConfig.monthlyLimit === 0) {
      return 0;
    }
    const spent = await this.getMonthlySpend();
    return Math.max(0, this.budgetConfig.monthlyLimit - spent);
  }

  /**
   * Clear fired alerts and reset paid call counter.
   * Called on month boundary or manually.
   */
  resetAlerts(): void {
    this.alertsFired.clear();
    this.paidCallCount = 0;
  }

  /**
   * Check budget thresholds and emit events.
   * Fire-and-forget: all emitter.emit() calls wrapped in try/catch.
   */
  private async checkThresholds(lastRequestCost: number): Promise<void> {
    if (this.budgetConfig.monthlyLimit <= 0) {
      return;
    }

    let spent: number;
    try {
      spent = await this.getMonthlySpend();
    } catch {
      return;
    }

    const ratio = spent / this.budgetConfig.monthlyLimit;

    // Check each configured threshold
    for (const threshold of this.budgetConfig.alertThresholds) {
      if (ratio >= threshold && !this.alertsFired.has(threshold)) {
        this.alertsFired.add(threshold);

        const payload: BudgetAlertEvent = {
          threshold,
          spent,
          limit: this.budgetConfig.monthlyLimit,
          remaining: Math.max(0, this.budgetConfig.monthlyLimit - spent),
          avgCostPerRequest: this.paidCallCount > 0 ? spent / this.paidCallCount : 0,
          timestamp: Date.now(),
        };

        try {
          this.emitter.emit(RouterEvent.BUDGET_ALERT, payload);
        } catch (error) {
          debug('Failed to emit budget:alert event: %O', error);
        }
      }
    }

    // Check if budget exceeded
    if (spent >= this.budgetConfig.monthlyLimit) {
      const payload: BudgetExceededEvent = {
        spent,
        limit: this.budgetConfig.monthlyLimit,
        lastRequestCost,
        timestamp: Date.now(),
      };

      try {
        this.emitter.emit(RouterEvent.BUDGET_EXCEEDED, payload);
      } catch (error) {
        debug('Failed to emit budget:exceeded event: %O', error);
      }
    }
  }
}
