import debug from 'debug';
import { EventEmitter } from 'node:events';
import type { StorageBackend } from '../types/interfaces.js';
import type { EvaluationResult, LimitStatus, ResolvedPolicy } from './types.js';
import { getResetAt } from '../usage/periods.js';

const log = debug('pennyllm:policy:engine');

/**
 * PolicyEngine evaluates API keys against resolved policies
 * Read-only async evaluation with event emission for warnings and exceeded limits
 */
export class PolicyEngine {
  private readonly policyMap: Map<string, ResolvedPolicy>;
  private readonly storage: StorageBackend;
  private readonly emitter: EventEmitter;
  private readonly warningThreshold: number;
  private readonly firedWarnings: Set<string>;

  constructor(
    resolvedPolicies: ResolvedPolicy[],
    storage: StorageBackend,
    emitter: EventEmitter,
    options?: { warningThreshold?: number },
  ) {
    this.storage = storage;
    this.emitter = emitter;
    this.warningThreshold = options?.warningThreshold ?? 0.8;
    this.firedWarnings = new Set<string>();

    // Build lookup map keyed by provider:keyIndex for O(1) access
    this.policyMap = new Map();
    for (const policy of resolvedPolicies) {
      const key = `${policy.provider}:${policy.keyIndex}`;
      this.policyMap.set(key, policy);
      log(
        'Registered policy for %s (key %d) with %d limits',
        policy.provider,
        policy.keyIndex,
        policy.limits.length,
      );
    }

    log('PolicyEngine initialized with %d policies', resolvedPolicies.length);
  }

  /**
   * Evaluate whether a key is eligible based on current usage and limits
   * Optionally include estimated token usage for pre-call checks
   */
  async evaluate(
    provider: string,
    keyIndex: number,
    estimatedTokens?: { prompt: number; completion: number },
  ): Promise<EvaluationResult> {
    const policyKey = `${provider}:${keyIndex}`;
    const policy = this.policyMap.get(policyKey);

    // No policy found (custom provider with no limits)
    if (!policy) {
      log('No policy found for %s key %d — always eligible', provider, keyIndex);
      return {
        eligible: true,
        limits: [],
        enforcement: 'hard-block',
      };
    }

    // Empty limits array means always available
    if (policy.limits.length === 0) {
      log('No limits configured for %s key %d — always eligible', provider, keyIndex);
      return {
        eligible: true,
        limits: [],
        enforcement: policy.enforcement,
      };
    }

    // Query usage for all limits concurrently
    const limitStatusPromises = policy.limits.map(async (limit) => {
      const usage = await this.storage.getUsage(provider, keyIndex, limit.window);
      const current =
        limit.type === 'rate' || limit.type === 'calls' ? usage.callCount : usage.totalTokens;

      // Calculate reset time (next window boundary, calendar-aware)
      const now = Date.now();
      const resetAt = getResetAt(limit.window, now);

      // For pre-call checks with estimation, project usage after the upcoming call
      let effectiveCurrent = current;
      if (estimatedTokens) {
        if (limit.type === 'rate' || limit.type === 'calls') {
          effectiveCurrent = current + 1;
        } else {
          effectiveCurrent = current + estimatedTokens.prompt + estimatedTokens.completion;
        }
      }

      const remaining = Math.max(0, limit.value - effectiveCurrent);
      const percentUsed = (effectiveCurrent / limit.value) * 100;

      const status: LimitStatus = {
        type: limit.type,
        current,
        max: limit.value,
        remaining,
        percentUsed,
        resetAt,
      };

      return { status, limit };
    });

    const results = await Promise.all(limitStatusPromises);
    const limitStatuses = results.map((r) => r.status);

    // Determine eligibility (all limits must be under max)
    const eligible = limitStatuses.every((status) => status.remaining > 0);

    // Find closest limit (highest percent used)
    let closestLimit: LimitStatus | undefined;
    let maxPercent = -1;
    for (const status of limitStatuses) {
      if (status.percentUsed > maxPercent) {
        maxPercent = status.percentUsed;
        closestLimit = status;
      }
    }

    // Emit events for warnings and exceeded limits
    for (const { status, limit } of results) {
      // Warning event (with deduplication)
      if (status.percentUsed >= this.warningThreshold * 100) {
        const warningKey = `${provider}:${keyIndex}:${limit.type}`;
        if (!this.firedWarnings.has(warningKey)) {
          this.emitter.emit('limit:warning', {
            timestamp: Date.now(),
            provider,
            keyIndex,
            limitType: limit.type,
            currentUsage: status.current,
            limit: limit.value,
            threshold: this.warningThreshold,
          });
          this.firedWarnings.add(warningKey);
          log(
            'Warning fired for %s key %d limit %s (%d%% used)',
            provider,
            keyIndex,
            limit.type,
            status.percentUsed,
          );
        }
      }

      // Exceeded event (no deduplication — fire every time)
      if (status.percentUsed >= 100) {
        this.emitter.emit('limit:exceeded', {
          timestamp: Date.now(),
          provider,
          keyIndex,
          limitType: limit.type,
        });
        log('Exceeded event fired for %s key %d limit %s', provider, keyIndex, limit.type);
      }
    }

    log(
      'Evaluated %s key %d: eligible=%s, limits=%d, closest=%s (%d%%)',
      provider,
      keyIndex,
      eligible,
      limitStatuses.length,
      closestLimit?.type,
      closestLimit?.percentUsed.toFixed(1),
    );

    const result: EvaluationResult = {
      eligible,
      limits: limitStatuses,
      enforcement: policy.enforcement,
    };

    // Only include closestLimit if it exists (exactOptionalPropertyTypes compliance)
    if (closestLimit) {
      result.closestLimit = closestLimit;
    }

    return result;
  }

  /**
   * Get resolved policy for a specific key
   */
  getPolicy(provider: string, keyIndex: number): ResolvedPolicy | undefined {
    return this.policyMap.get(`${provider}:${keyIndex}`);
  }

  /**
   * Get all resolved policies
   */
  getAllPolicies(): ResolvedPolicy[] {
    return Array.from(this.policyMap.values());
  }

  /**
   * Reset warning deduplication (useful for testing or when usage drops)
   */
  resetWarnings(): void {
    this.firedWarnings.clear();
    log('Warning deduplication set cleared');
  }
}
