import { EventEmitter } from 'node:events';
import debugFactory from 'debug';
import type { StorageBackend } from '../types/interfaces.js';
import type { TimeWindow } from '../types/domain.js';
import type { CooldownManager } from '../usage/cooldown.js';
import type {
  CreditConfig,
  CreditStatus,
  CreditLowEvent,
  CreditExhaustedEvent,
  CreditExpiringEvent,
} from './types.js';
import { RouterEvent } from '../constants/index.js';

const debug = debugFactory('pennyllm:credit');

/**
 * Credit time window: never expires (credits don't reset like monthly quotas).
 * Uses a 100-year durationMs to prevent storage expiration.
 */
const CREDIT_WINDOW: TimeWindow = {
  type: 'monthly',
  durationMs: 100 * 365 * 24 * 60 * 60 * 1000,
};

/**
 * CreditTracker records credit consumption and manages depletion state
 * for trial-tier providers with finite credit balances.
 *
 * Storage key pattern:
 * - provider: 'credit:{providerId}', keyIndex: 0
 * - Cost stored as micro-dollars in promptTokens field
 * - completionTokens field unused (0)
 * - callCount not used
 */
export class CreditTracker {
  private readonly storage: StorageBackend;
  private readonly cooldownManager: CooldownManager;
  private readonly emitter: EventEmitter;
  private readonly configs: Map<string, CreditConfig>;

  /** Per-provider dedup set of threshold percentages that have already fired */
  private readonly alertsFired: Map<string, Set<number>> = new Map();

  /** In-memory cache of consumed micro-dollars per provider */
  private readonly consumedCache: Map<string, number> = new Map();

  /** Mutable balance map for topUp support (do NOT mutate CreditConfig objects) */
  private readonly balances: Map<string, number> = new Map();

  constructor(
    storage: StorageBackend,
    cooldownManager: CooldownManager,
    emitter: EventEmitter,
    configs: Map<string, CreditConfig>,
  ) {
    this.storage = storage;
    this.cooldownManager = cooldownManager;
    this.emitter = emitter;
    this.configs = configs;
  }

  /**
   * Load persisted credit consumption from storage and check expiry warnings.
   * Called once at startup. Fire-and-forget pattern.
   */
  async loadPersistedCredits(): Promise<void> {
    for (const [provider, config] of this.configs) {
      // Initialize balance from config
      this.balances.set(provider, config.balance);

      try {
        const usage = await this.storage.getUsage(`credit:${provider}`, 0, CREDIT_WINDOW);
        this.consumedCache.set(provider, usage.promptTokens);
      } catch (error) {
        debug('Failed to load persisted credits for %s: %O', provider, error);
        this.consumedCache.set(provider, 0);
      }

      // Check expiry warnings at startup
      if (config.expiresAt !== undefined) {
        const expiresMs = new Date(config.expiresAt).getTime();
        const warningMs = config.expiryWarningDays * 24 * 60 * 60 * 1000;
        const now = Date.now();

        if (now < expiresMs && expiresMs - now <= warningMs) {
          const daysRemaining = Math.ceil((expiresMs - now) / (24 * 60 * 60 * 1000));
          const payload: CreditExpiringEvent = {
            provider,
            expiresAt: config.expiresAt,
            daysRemaining,
            timestamp: now,
          };
          try {
            this.emitter.emit(RouterEvent.CREDIT_EXPIRING, payload);
          } catch {
            // fire-and-forget
          }
        }
      }
    }
  }

  /**
   * Record credit consumption after a request.
   * Fire-and-forget: storage failures are logged but never thrown.
   */
  async recordConsumption(
    provider: string,
    usage: { promptTokens: number; completionTokens: number },
  ): Promise<void> {
    const config = this.configs.get(provider);
    if (!config) return; // No-op for non-credit providers

    // Calculate cost in dollars
    const cost =
      (usage.promptTokens * config.costRates.inputPer1MTokens +
        usage.completionTokens * config.costRates.outputPer1MTokens) /
      1_000_000;

    if (cost <= 0) return;

    // Convert to micro-dollars
    const microDollars = Math.round(cost * 1_000_000);

    // Persist to storage
    try {
      await this.storage.increment(
        `credit:${provider}`,
        0,
        { prompt: microDollars, completion: 0 },
        CREDIT_WINDOW,
        1,
      );
    } catch (error) {
      debug('Failed to record credit consumption for %s: %O', provider, error);
    }

    // Update in-memory cache
    const current = this.consumedCache.get(provider) ?? 0;
    const newConsumed = current + microDollars;
    this.consumedCache.set(provider, newConsumed);

    // Check thresholds
    this.checkThresholds(provider, newConsumed);

    // Log if estimated exhausted (but do NOT mark depleted -- wait for 402)
    const balance = this.balances.get(provider) ?? config.balance;
    const remaining = balance * 1_000_000 - newConsumed;
    if (remaining <= 0) {
      debug(
        'Provider %s estimated credit exhausted (balance: $%d, consumed: $%d) -- awaiting 402 confirmation',
        provider,
        balance,
        newConsumed / 1_000_000,
      );
    }
  }

  /**
   * Confirm credit exhaustion after receiving a 402 from the provider.
   * Marks the provider as permanently depleted via CooldownManager.
   */
  confirmExhaustion(provider: string): void {
    this.cooldownManager.setProviderCooldown(provider, Infinity, 'permanent', 'Credits exhausted');

    const config = this.configs.get(provider);
    const consumed = this.consumedCache.get(provider) ?? 0;
    const balance = this.balances.get(provider) ?? config?.balance ?? 0;

    const payload: CreditExhaustedEvent = {
      provider,
      balance,
      consumed: consumed / 1_000_000,
      reason: 'depleted',
      timestamp: Date.now(),
    };
    try {
      this.emitter.emit(RouterEvent.CREDIT_EXHAUSTED, payload);
    } catch {
      // fire-and-forget
    }

    debug('Provider %s credits confirmed exhausted (402 received)', provider);
  }

  /**
   * Check if a provider's credits are estimated exhausted.
   * Does NOT mark depleted -- this is informational only.
   */
  isEstimatedExhausted(provider: string): boolean {
    const config = this.configs.get(provider);
    if (!config) return false;

    const consumed = this.consumedCache.get(provider) ?? 0;
    const balance = this.balances.get(provider) ?? config.balance;
    const remaining = balance * 1_000_000 - consumed;
    return remaining <= 0;
  }

  /**
   * Check if a provider's credits have expired (past expiresAt date).
   */
  isExpired(provider: string): boolean {
    const config = this.configs.get(provider);
    if (!config || config.expiresAt === undefined) return false;
    return Date.now() > new Date(config.expiresAt).getTime();
  }

  /**
   * Determine if a provider should be skipped in the chain.
   *
   * - Expired credits: skip immediately (mark depleted)
   * - Estimated exhausted: let the call through (per "try one more" strategy)
   * - Non-credit providers: never skip
   */
  shouldSkip(provider: string): boolean {
    if (!this.configs.has(provider)) return false;

    // Check expiry first
    if (this.isExpired(provider)) {
      // Mark depleted if not already
      if (!this.cooldownManager.isProviderDepleted(provider)) {
        this.cooldownManager.setProviderCooldown(
          provider,
          Infinity,
          'permanent',
          'Credits expired',
        );

        const config = this.configs.get(provider)!;
        const consumed = this.consumedCache.get(provider) ?? 0;
        const balance = this.balances.get(provider) ?? config.balance;

        const payload: CreditExhaustedEvent = {
          provider,
          balance,
          consumed: consumed / 1_000_000,
          reason: 'expired',
          timestamp: Date.now(),
        };
        try {
          this.emitter.emit(RouterEvent.CREDIT_EXHAUSTED, payload);
        } catch {
          // fire-and-forget
        }
      }
      return true;
    }

    // Estimated exhausted: let call through (402 will confirm)
    // Return false -- do NOT skip
    return false;
  }

  /**
   * Top up a provider's credit balance.
   * Increases balance, clears depletion state, and resets alert dedup.
   */
  topUp(provider: string, amount: number): void {
    const config = this.configs.get(provider);
    if (!config) {
      throw new Error(`No credit configuration found for provider '${provider}'`);
    }

    const currentBalance = this.balances.get(provider) ?? config.balance;
    const newBalance = currentBalance + amount;
    this.balances.set(provider, newBalance);

    // Clear depletion if provider was depleted
    if (this.cooldownManager.isProviderDepleted(provider)) {
      this.cooldownManager.onProviderSuccess(provider);
    }

    // Reset alert dedup (thresholds may need re-firing at new levels)
    this.alertsFired.delete(provider);

    debug('Provider %s topped up by $%d, new balance: $%d', provider, amount, newBalance);
  }

  /**
   * Get credit status for a provider.
   * Returns undefined if provider has no credit configuration.
   */
  getStatus(provider: string): CreditStatus | undefined {
    const config = this.configs.get(provider);
    if (!config) return undefined;

    const consumed = (this.consumedCache.get(provider) ?? 0) / 1_000_000;
    const balance = this.balances.get(provider) ?? config.balance;
    const remaining = Math.max(0, balance - consumed);
    const percentUsed = balance > 0 ? ((balance - remaining) / balance) * 100 : 100;

    const status: CreditStatus = {
      provider,
      balance,
      consumed,
      remaining,
      percentUsed,
      expired: this.isExpired(provider),
      exhausted:
        this.isEstimatedExhausted(provider) || this.cooldownManager.isProviderDepleted(provider),
    };

    if (config.expiresAt !== undefined) {
      status.expiresAt = config.expiresAt;
    }

    return status;
  }

  /**
   * Check alert thresholds and emit credit:low events.
   * Uses percentRemaining to compare against thresholds.
   */
  private checkThresholds(provider: string, consumed: number): void {
    const config = this.configs.get(provider);
    if (!config) return;

    const balance = this.balances.get(provider) ?? config.balance;
    if (balance <= 0) return;

    const balanceMicro = balance * 1_000_000;
    const percentRemaining = (balanceMicro - consumed) / balanceMicro;

    // Get or create alert dedup set for this provider
    let fired = this.alertsFired.get(provider);
    if (!fired) {
      fired = new Set();
      this.alertsFired.set(provider, fired);
    }

    for (const threshold of config.alertThresholds) {
      if (percentRemaining <= threshold && !fired.has(threshold)) {
        fired.add(threshold);

        const remaining = Math.max(0, (balanceMicro - consumed) / 1_000_000);
        const payload: CreditLowEvent = {
          provider,
          threshold,
          remaining,
          balance,
          percentRemaining: Math.max(0, percentRemaining),
          timestamp: Date.now(),
        };

        try {
          this.emitter.emit(RouterEvent.CREDIT_LOW, payload);
        } catch {
          // fire-and-forget
        }
      }
    }
  }
}
