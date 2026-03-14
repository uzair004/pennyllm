import debug from 'debug';
import { EventEmitter } from 'node:events';
import type { RouterConfig } from '../types/config.js';
import type { SelectionStrategy } from '../types/interfaces.js';
import type { PolicyEngine } from '../policy/PolicyEngine.js';
import type { CooldownManager } from '../usage/cooldown.js';
import { RateLimitError } from '../errors/rate-limit-error.js';
import { QuotaExhaustedError } from '../errors/quota-exhausted-error.js';
import { PriorityStrategy } from './strategies/priority.js';
import { RoundRobinStrategy } from './strategies/round-robin.js';
import { LeastUsedStrategy } from './strategies/least-used.js';
import type { CandidateKey, SelectionContext, SelectionResult } from './types.js';

const log = debug('llm-router:selection');

/**
 * KeySelector orchestrates key selection across strategies
 * Coordinates policy evaluation, cooldown checking, strategy execution, and event emission
 */
export class KeySelector {
  private readonly config: RouterConfig;
  private readonly policyEngine: PolicyEngine;
  private readonly cooldownManager: CooldownManager;
  private readonly emitter: EventEmitter;
  private readonly customStrategy:
    | SelectionStrategy
    | ((context: SelectionContext) => SelectionResult | Promise<SelectionResult>)
    | undefined;
  private readonly strategies: Map<string, SelectionStrategy>;
  private readonly selectionCounts: Map<string, number>;

  constructor(
    config: RouterConfig,
    policyEngine: PolicyEngine,
    cooldownManager: CooldownManager,
    emitter: EventEmitter,
    customStrategy?:
      | SelectionStrategy
      | ((context: SelectionContext) => SelectionResult | Promise<SelectionResult>),
  ) {
    this.config = config;
    this.policyEngine = policyEngine;
    this.cooldownManager = cooldownManager;
    this.emitter = emitter;
    this.customStrategy = customStrategy;
    this.selectionCounts = new Map();

    // Initialize built-in strategies
    this.strategies = new Map();
    this.strategies.set('priority', new PriorityStrategy());
    this.strategies.set('round-robin', new RoundRobinStrategy());
    this.strategies.set('least-used', new LeastUsedStrategy());

    log('KeySelector initialized with %d built-in strategies', this.strategies.size);
  }

  /**
   * Select a key for the given provider
   */
  async selectKey(
    provider: string,
    model?: string,
    options?: {
      strategy?: string;
      estimatedTokens?: number;
      requestId?: string;
    },
  ): Promise<SelectionResult> {
    // Get provider config
    const providerConfig = this.config.providers[provider];
    if (!providerConfig) {
      throw new Error(`Provider ${provider} not configured`);
    }

    const keys = providerConfig.keys;

    // Single-key short-circuit
    if (keys.length === 1) {
      log('Single-key short-circuit for provider %s', provider);
      const cooldown = this.cooldownManager.getCooldown(provider, 0);
      if (cooldown) {
        log('Single key %s:0 in cooldown until %s', provider, cooldown.until);
        throw new RateLimitError(provider, [{ keyIndex: 0, cooldownUntil: cooldown.until }]);
      }

      const evaluation = await this.policyEngine.evaluate(
        provider,
        0,
        options?.estimatedTokens !== undefined
          ? { prompt: options.estimatedTokens, completion: 0 }
          : undefined,
      );

      if (!evaluation.eligible) {
        log('Single key %s:0 not eligible', provider);
        const nextReset = evaluation.closestLimit?.resetAt.toISOString();
        const keyData: { keyIndex: number; nextReset?: string } = { keyIndex: 0 };
        if (nextReset !== undefined) {
          keyData.nextReset = nextReset;
        }
        throw new QuotaExhaustedError(provider, [keyData]);
      }

      // Emit event and track metrics
      this.emitter.emit('key:selected', {
        provider,
        model,
        keyIndex: 0,
        label: typeof keys[0] === 'object' ? keys[0].label : undefined,
        strategy: 'single-key',
        reason: 'only key available',
        timestamp: Date.now(),
        requestId: options?.requestId,
      });

      const metricsKey = `${provider}:0`;
      this.selectionCounts.set(metricsKey, (this.selectionCounts.get(metricsKey) ?? 0) + 1);

      return { keyIndex: 0, reason: 'only key available' };
    }

    // Build candidate list
    log('Building candidate list for provider %s with %d keys', provider, keys.length);
    const candidates: CandidateKey[] = [];
    for (let i = 0; i < keys.length; i++) {
      const keyConfig = keys[i];
      const label = typeof keyConfig === 'object' ? keyConfig.label : undefined;
      const cooldown = this.cooldownManager.getCooldown(provider, i);
      const evaluation = await this.policyEngine.evaluate(
        provider,
        i,
        options?.estimatedTokens !== undefined
          ? { prompt: options.estimatedTokens, completion: 0 }
          : undefined,
      );

      if (cooldown) {
        log('Key %s:%d in cooldown until %s', provider, i, cooldown.until);
      }
      if (!evaluation.eligible) {
        log('Key %s:%d not eligible (quota exhausted)', provider, i);
      }

      candidates.push({
        keyIndex: i,
        eligible: evaluation.eligible,
        cooldown,
        evaluation,
        ...(label !== undefined ? { label } : {}),
      });
    }

    // Check if all exhausted/cooldown
    const exhaustedKeys = candidates.filter((c) => !c.eligible && !c.cooldown);
    const cooldownKeys = candidates.filter((c) => c.cooldown !== null);
    const availableCount = candidates.filter((c) => c.eligible && !c.cooldown).length;

    if (availableCount === 0) {
      log(
        'No keys available for provider %s (exhausted: %d, cooldown: %d)',
        provider,
        exhaustedKeys.length,
        cooldownKeys.length,
      );

      // Find earliest recovery
      let earliestRecovery: string | undefined;
      for (const candidate of candidates) {
        if (candidate.cooldown) {
          if (!earliestRecovery || candidate.cooldown.until < earliestRecovery) {
            earliestRecovery = candidate.cooldown.until;
          }
        } else if (candidate.evaluation.closestLimit?.resetAt) {
          const resetAt = candidate.evaluation.closestLimit.resetAt.toISOString();
          if (!earliestRecovery || resetAt < earliestRecovery) {
            earliestRecovery = resetAt;
          }
        }
      }

      // Determine exhaustion type
      const exhaustionType: 'cooldown' | 'quota' | 'mixed' =
        cooldownKeys.length > 0 && exhaustedKeys.length > 0
          ? 'mixed'
          : cooldownKeys.length > 0
            ? 'cooldown'
            : 'quota';

      // Emit provider:exhausted event
      this.emitter.emit('provider:exhausted', {
        provider,
        totalKeys: keys.length,
        exhaustedCount: exhaustedKeys.length,
        cooldownCount: cooldownKeys.length,
        earliestRecovery,
        exhaustionType,
        timestamp: Date.now(),
      });

      // Throw appropriate error
      if (cooldownKeys.length > 0 && exhaustedKeys.length === 0) {
        // All in cooldown
        throw new RateLimitError(
          provider,
          cooldownKeys.map((c) => ({ keyIndex: c.keyIndex, cooldownUntil: c.cooldown!.until })),
        );
      } else if (exhaustedKeys.length > 0) {
        // Some exhausted (quota is the limiting factor)
        const exhaustedData = exhaustedKeys.map((c) => {
          const data: { keyIndex: number; nextReset?: string } = { keyIndex: c.keyIndex };
          const nextReset = c.evaluation.closestLimit?.resetAt.toISOString();
          if (nextReset !== undefined) {
            data.nextReset = nextReset;
          }
          return data;
        });
        throw new QuotaExhaustedError(provider, exhaustedData);
      } else {
        // Mixed case - throw quota exhausted
        const allData = candidates.map((c) => {
          const data: { keyIndex: number; nextReset?: string } = { keyIndex: c.keyIndex };
          const nextReset = c.evaluation.closestLimit?.resetAt.toISOString();
          if (nextReset !== undefined) {
            data.nextReset = nextReset;
          }
          return data;
        });
        throw new QuotaExhaustedError(provider, allData);
      }
    }

    // Resolve strategy
    const strategy = this.resolveStrategy(provider, options?.strategy);
    log('Resolved strategy: %s', strategy.name);

    // Execute strategy with fallback
    let result: SelectionResult;
    try {
      const context: SelectionContext = { provider, candidates };
      if (model !== undefined) {
        context.model = model;
      }
      if (options?.estimatedTokens !== undefined) {
        context.estimatedTokens = options.estimatedTokens;
      }
      result = await strategy.selectKey(context);
    } catch (strategyError) {
      // Custom strategy failed — fall back to provider default
      log('Custom strategy error, falling back: %s', strategyError);
      const fallbackStrategy = this.getProviderStrategy(provider);
      const context: SelectionContext = { provider, candidates };
      if (model !== undefined) {
        context.model = model;
      }
      if (options?.estimatedTokens !== undefined) {
        context.estimatedTokens = options.estimatedTokens;
      }
      result = await fallbackStrategy.selectKey(context);
    }

    // Emit key:selected event
    const selectedCandidate = candidates.find((c) => c.keyIndex === result.keyIndex);
    this.emitter.emit('key:selected', {
      provider,
      model,
      keyIndex: result.keyIndex,
      label: selectedCandidate?.label,
      strategy: strategy.name,
      reason: result.reason,
      timestamp: Date.now(),
      requestId: options?.requestId,
    });

    // Track selection metrics
    const metricsKey = `${provider}:${result.keyIndex}`;
    this.selectionCounts.set(metricsKey, (this.selectionCounts.get(metricsKey) ?? 0) + 1);

    log(
      'Selected key %s:%d (strategy: %s, reason: %s)',
      provider,
      result.keyIndex,
      strategy.name,
      result.reason,
    );
    return result;
  }

  /**
   * Get selection statistics
   */
  getSelectionStats(): Record<string, number> {
    return Object.fromEntries(this.selectionCounts);
  }

  /**
   * Reset selection statistics
   */
  resetStats(): void {
    this.selectionCounts.clear();
    log('Selection statistics cleared');
  }

  /**
   * Resolve strategy based on override, provider config, and global config
   */
  private resolveStrategy(provider: string, override?: string): SelectionStrategy {
    // Per-request override
    if (override) {
      const builtIn = this.strategies.get(override);
      if (builtIn) {
        return builtIn;
      }
      // If override is 'custom' or doesn't match built-in, use custom strategy
      if (this.customStrategy) {
        return this.wrapCustomStrategy(this.customStrategy);
      }
    }

    // Custom strategy if provided and no override
    if (this.customStrategy && !override) {
      return this.wrapCustomStrategy(this.customStrategy);
    }

    // Per-provider strategy
    const providerStrategy = this.config.providers[provider]?.strategy;
    if (providerStrategy) {
      const builtIn = this.strategies.get(providerStrategy);
      if (builtIn) {
        return builtIn;
      }
    }

    // Global default
    const globalStrategy = this.config.strategy;
    const builtIn = this.strategies.get(globalStrategy);
    if (builtIn) {
      return builtIn;
    }

    // Fallback to priority (should never happen)
    return this.strategies.get('priority')!;
  }

  /**
   * Get provider strategy (built-in only, no custom)
   */
  private getProviderStrategy(provider: string): SelectionStrategy {
    const providerStrategy = this.config.providers[provider]?.strategy;
    if (providerStrategy) {
      const builtIn = this.strategies.get(providerStrategy);
      if (builtIn) {
        return builtIn;
      }
    }

    const globalStrategy = this.config.strategy;
    const builtIn = this.strategies.get(globalStrategy);
    if (builtIn) {
      return builtIn;
    }

    return this.strategies.get('priority')!;
  }

  /**
   * Wrap custom strategy function into SelectionStrategy object
   */
  private wrapCustomStrategy(
    custom:
      | SelectionStrategy
      | ((context: SelectionContext) => SelectionResult | Promise<SelectionResult>),
  ): SelectionStrategy {
    if (typeof custom === 'function') {
      return {
        name: 'custom',
        selectKey: async (context: SelectionContext) => {
          const result = custom(context);
          return result instanceof Promise ? result : Promise.resolve(result);
        },
      };
    }
    return custom;
  }
}
