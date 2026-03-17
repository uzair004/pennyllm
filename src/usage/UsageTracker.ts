import debug from 'debug';
import type { EventEmitter } from 'node:events';
import type { StorageBackend } from '../types/interfaces.js';
import type { ResolvedPolicy } from '../policy/types.js';
import type {
  EstimationConfig,
  EstimationResult,
  UsageSnapshot,
  ProviderUsage,
  KeyUsage,
  KeyUsageWindow,
} from './types.js';
import { CooldownManager } from './cooldown.js';
import { estimateTokens } from './estimation.js';
import { getResetAt } from './periods.js';

const log = debug('pennyllm:usage');

/**
 * Core usage tracking class
 * Records LLM call usage, provides estimation, manages cooldowns, exposes usage API
 */
export class UsageTracker {
  private storage: StorageBackend;
  private emitter: EventEmitter;
  private estimationConfig: EstimationConfig;
  private cooldown: CooldownManager;
  private recordedRequests: Set<string>;
  private estimatedRecords: Map<string, number>;
  private policyMap: Map<string, ResolvedPolicy>;

  constructor(
    storage: StorageBackend,
    policies: ResolvedPolicy[],
    emitter: EventEmitter,
    estimationConfig: EstimationConfig,
  ) {
    this.storage = storage;
    this.emitter = emitter;
    this.estimationConfig = estimationConfig;
    this.cooldown = new CooldownManager(storage);
    this.recordedRequests = new Set();
    this.estimatedRecords = new Map();

    // Build policy map for O(1) lookup
    this.policyMap = new Map();
    for (const policy of policies) {
      const key = `${policy.provider}:${policy.keyIndex}`;
      this.policyMap.set(key, policy);
    }

    log('UsageTracker initialized with %d policies', policies.length);
  }

  /**
   * Estimate token usage for a request
   * Returns null if estimation fails
   */
  estimate(
    messages: Array<{ role: string; content: unknown }>,
    options?: { system?: string; tools?: unknown[]; maxTokens?: number },
  ): EstimationResult | null {
    return estimateTokens(messages, options ?? {}, this.estimationConfig);
  }

  /**
   * Record usage for a completed LLM call
   * Fire-and-forget pattern - never throws
   */
  async record(
    provider: string,
    keyIndex: number,
    usage: { promptTokens: number; completionTokens: number } | null,
    requestId: string,
    estimation: EstimationResult | null,
  ): Promise<void> {
    try {
      // Deduplication check
      if (this.recordedRequests.has(requestId)) {
        log('Skipping duplicate requestId: %s', requestId);
        return;
      }

      // Add to deduplication set (with lazy cleanup)
      this.recordedRequests.add(requestId);
      if (this.recordedRequests.size > 10000) {
        log('Clearing deduplication set (size limit exceeded)');
        this.recordedRequests.clear();
        this.recordedRequests.add(requestId); // Re-add current
      }

      // Determine tokens
      let tokens: { promptTokens: number; completionTokens: number };
      let estimated: boolean;

      if (usage !== null) {
        // Provider reported usage
        tokens = usage;
        estimated = false;
      } else if (estimation !== null) {
        // Fall back to estimation
        tokens = { promptTokens: estimation.prompt, completionTokens: estimation.completion };
        estimated = true;
      } else {
        // Both null - use zeros
        tokens = { promptTokens: 0, completionTokens: 0 };
        estimated = false;
      }

      // Track estimated records
      if (estimated) {
        const key = `${provider}:${keyIndex}`;
        this.estimatedRecords.set(key, (this.estimatedRecords.get(key) ?? 0) + 1);
      }

      // Multi-window recording
      const policyKey = `${provider}:${keyIndex}`;
      const policy = this.policyMap.get(policyKey);

      if (!policy) {
        log('No policy found for %s, skipping recording', policyKey);
        return;
      }

      const windowTypes: string[] = [];

      // Increment storage for each window in the policy
      for (const limit of policy.limits) {
        await this.storage.increment(
          provider,
          keyIndex,
          { prompt: tokens.promptTokens, completion: tokens.completionTokens },
          limit.window,
          1, // callCount
        );
        windowTypes.push(limit.window.type);
      }

      // Emit usage:recorded event
      this.emitter.emit('usage:recorded', {
        timestamp: Date.now(),
        requestId,
        provider,
        keyIndex,
        promptTokens: tokens.promptTokens,
        completionTokens: tokens.completionTokens,
        estimated,
        windows: windowTypes,
      });

      log(
        'Recorded usage for %s: prompt=%d, completion=%d, estimated=%s',
        policyKey,
        tokens.promptTokens,
        tokens.completionTokens,
        estimated,
      );
    } catch (error) {
      // Fire-and-forget: log errors but never throw
      log('Failed to record usage: %s', error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Handle 429 rate limit response
   * Sets cooldown and records call (no tokens)
   */
  handle429(provider: string, keyIndex: number, retryAfterHeader?: string): void {
    try {
      // Set cooldown
      this.cooldown.setCooldown(provider, keyIndex, retryAfterHeader);

      // Record 429 call (no tokens, just callCount)
      const policyKey = `${provider}:${keyIndex}`;
      const policy = this.policyMap.get(policyKey);

      if (!policy) {
        log('No policy found for %s, skipping 429 recording', policyKey);
        return;
      }

      // Increment call count for all windows (no tokens)
      for (const limit of policy.limits) {
        // Fire and forget
        void this.storage.increment(
          provider,
          keyIndex,
          { prompt: 0, completion: 0 },
          limit.window,
          1,
        );
      }

      log('Handled 429 for %s, cooldown set', policyKey);
    } catch (error) {
      log('Failed to handle 429: %s', error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Get usage snapshot for all providers or a specific provider
   */
  async getUsage(): Promise<UsageSnapshot>;
  async getUsage(provider: string): Promise<ProviderUsage>;
  async getUsage(provider?: string): Promise<UsageSnapshot | ProviderUsage> {
    const providers: ProviderUsage[] = [];

    // Group policies by provider
    const providerPolicies = new Map<string, ResolvedPolicy[]>();
    for (const policy of this.policyMap.values()) {
      if (provider && policy.provider !== provider) {
        continue;
      }

      if (!providerPolicies.has(policy.provider)) {
        providerPolicies.set(policy.provider, []);
      }
      providerPolicies.get(policy.provider)!.push(policy);
    }

    // Build usage for each provider
    for (const [providerName, policies] of providerPolicies) {
      const keys: KeyUsage[] = [];
      let totalPromptTokens = 0;
      let totalCompletionTokens = 0;
      let totalCallCount = 0;

      for (const policy of policies) {
        const windows: KeyUsageWindow[] = [];
        // Track per-key totals from the largest window only (avoid double-counting across windows)
        let keyPromptTokens = 0;
        let keyCompletionTokens = 0;
        let keyCallCount = 0;
        let largestWindowDuration = 0;

        // Query each window in the policy
        for (const limit of policy.limits) {
          let usage: {
            promptTokens: number;
            completionTokens: number;
            totalTokens: number;
            callCount: number;
          };

          if (limit.window.type === 'rolling-30d') {
            // Rolling 30-day: sum last 30 daily buckets
            let promptSum = 0;
            let completionSum = 0;
            let callSum = 0;

            // TODO: Query last 30 daily buckets individually when storage supports historical queries
            // For now, query current daily bucket only (limitation until Phase 10)
            for (let i = 0; i < 30; i++) {
              const dailyUsage = await this.storage.getUsage(providerName, policy.keyIndex, {
                type: 'daily',
                durationMs: 24 * 60 * 60 * 1000,
              });
              promptSum += dailyUsage.promptTokens;
              completionSum += dailyUsage.completionTokens;
              callSum += dailyUsage.callCount;
            }

            usage = {
              promptTokens: promptSum,
              completionTokens: completionSum,
              totalTokens: promptSum + completionSum,
              callCount: callSum,
            };
          } else {
            // Single query for other window types
            usage = await this.storage.getUsage(providerName, policy.keyIndex, limit.window);
          }

          // Calculate remaining
          let remaining: number;
          if (limit.type === 'tokens') {
            remaining = limit.value - usage.totalTokens;
          } else if (limit.type === 'calls' || limit.type === 'rate') {
            remaining = limit.value - usage.callCount;
          } else {
            // daily/monthly type limits use totalTokens
            remaining = limit.value - usage.totalTokens;
          }

          // Calculate percent used
          const percentUsed =
            limit.value > 0 ? Math.min(100, (1 - remaining / limit.value) * 100) : 0;

          // Get reset time
          const resetAt = getResetAt(limit.window, Date.now());

          windows.push({
            type: limit.window.type,
            promptTokens: usage.promptTokens,
            completionTokens: usage.completionTokens,
            totalTokens: usage.totalTokens,
            callCount: usage.callCount,
            limit: limit.value,
            remaining: Math.max(0, remaining),
            percentUsed,
            resetAt: resetAt.toISOString(),
          });

          // Use the largest window for totals (avoids double-counting across windows)
          if (limit.window.durationMs > largestWindowDuration) {
            largestWindowDuration = limit.window.durationMs;
            keyPromptTokens = usage.promptTokens;
            keyCompletionTokens = usage.completionTokens;
            keyCallCount = usage.callCount;
          }
        }

        // Accumulate totals from largest window only
        totalPromptTokens += keyPromptTokens;
        totalCompletionTokens += keyCompletionTokens;
        totalCallCount += keyCallCount;

        // Get cooldown status
        const cooldownStatus = this.cooldown.getCooldown(providerName, policy.keyIndex);

        // Get estimated records
        const estimatedCount = this.estimatedRecords.get(`${providerName}:${policy.keyIndex}`) ?? 0;

        keys.push({
          keyIndex: policy.keyIndex,
          windows,
          cooldown: {
            active: cooldownStatus !== null,
            until: cooldownStatus?.until ?? null,
            reason: cooldownStatus?.reason ?? null,
          },
          estimatedRecords: estimatedCount,
        });
      }

      providers.push({
        provider: providerName,
        keys,
        totals: {
          promptTokens: totalPromptTokens,
          completionTokens: totalCompletionTokens,
          totalTokens: totalPromptTokens + totalCompletionTokens,
          callCount: totalCallCount,
        },
      });
    }

    // Return based on request type
    if (provider) {
      const providerUsage = providers.find((p) => p.provider === provider);
      if (!providerUsage) {
        // Return empty usage for unknown provider
        return {
          provider,
          keys: [],
          totals: {
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            callCount: 0,
          },
        };
      }
      return providerUsage;
    }

    return {
      providers,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Reset usage counters
   */
  async resetUsage(provider?: string, keyIndex?: number): Promise<void> {
    // Clear storage
    await this.storage.resetAll(provider, keyIndex);

    // Clear cooldowns based on scope
    if (provider === undefined && keyIndex === undefined) {
      // Full reset
      this.cooldown.clearAll();
      this.recordedRequests.clear();
      this.estimatedRecords.clear();
    } else if (keyIndex === undefined && provider !== undefined) {
      // Provider reset - clear all keys for that provider
      const providerPrefix = `${provider}:`;
      for (const [key] of this.estimatedRecords) {
        if (key.startsWith(providerPrefix)) {
          this.estimatedRecords.delete(key);
          const parts = key.split(':');
          if (parts.length === 2 && parts[1] !== undefined) {
            const idx = parseInt(parts[1], 10);
            if (!isNaN(idx)) {
              this.cooldown.clear(provider, idx);
            }
          }
        }
      }
    } else if (provider !== undefined && keyIndex !== undefined) {
      // Specific key reset
      this.cooldown.clear(provider, keyIndex);
      this.estimatedRecords.delete(`${provider}:${keyIndex}`);
    }

    log('Usage reset: provider=%s, keyIndex=%s', provider ?? 'all', keyIndex ?? 'all');
  }

  /**
   * Load persisted cooldowns from storage.
   * Should be called once at startup (e.g., from createRouter).
   */
  async loadPersistedCooldowns(): Promise<void> {
    await this.cooldown.loadPersistedCooldowns();
  }

  /**
   * Get the CooldownManager instance (for Phase 5 selection)
   */
  getCooldownManager(): CooldownManager {
    return this.cooldown;
  }
}
