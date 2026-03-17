import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { KeySelector } from './KeySelector.js';
import { RateLimitError } from '../errors/rate-limit-error.js';
import type { RouterConfig } from '../types/config.js';
import type { PolicyEngine } from '../policy/PolicyEngine.js';
import type { CooldownManager } from '../usage/cooldown.js';
import type { EvaluationResult } from '../policy/types.js';

// Mock PolicyEngine
const mockPolicyEngine = (eligible = true): PolicyEngine => {
  const result: EvaluationResult = {
    eligible,
    limits: [],
    enforcement: 'hard-block',
  };
  return {
    evaluate: vi.fn().mockResolvedValue(result),
  } as unknown as PolicyEngine;
};

// Mock CooldownManager
const mockCooldownManager = (inCooldown = false): CooldownManager => {
  return {
    getCooldown: vi
      .fn()
      .mockReturnValue(
        inCooldown ? { until: new Date().toISOString(), reason: '429 rate limit' } : null,
      ),
  } as unknown as CooldownManager;
};

// Mock config
const mockConfig = (keys: string[]): RouterConfig => ({
  version: '1.0',
  providers: {
    test: { keys, enabled: true, priority: 100, tier: 'free' },
  },
  strategy: 'priority',
  budget: { monthlyLimit: 0, alertThresholds: [0.8, 0.95] },
  estimation: { defaultMaxTokens: 1024 },
  cooldown: { defaultDurationMs: 60000 },
  applyRegistryDefaults: false,
  dryRun: false,
  debug: false,
});

describe('KeySelector', () => {
  describe('per-provider-override', () => {
    it.todo('uses per-provider strategy when configured');
    it.todo('per-request override takes precedence over per-provider');
    it.todo('falls back to global default when no override');
  });

  describe('skip-ineligible', () => {
    it('skips keys in cooldown', async () => {
      const config = mockConfig(['key0', 'key1']);
      const policyEngine = mockPolicyEngine(true);
      const cooldownManager = {
        getCooldown: vi.fn((_provider, keyIndex) => {
          if (keyIndex === 0) {
            return { until: new Date().toISOString(), reason: '429 rate limit' };
          }
          return null;
        }),
      } as unknown as CooldownManager;
      const emitter = new EventEmitter();

      const selector = new KeySelector(config, policyEngine, cooldownManager, emitter);
      const result = await selector.selectKey('test');

      // Should skip key 0 (in cooldown) and select key 1
      expect(result.keyIndex).toBe(1);
    });

    it.todo('skips keys that exceeded quota');

    it('throws RateLimitError when all keys in cooldown', async () => {
      const config = mockConfig(['key0', 'key1']);
      const policyEngine = mockPolicyEngine(true);
      const cooldownManager = mockCooldownManager(true);
      const emitter = new EventEmitter();

      const selector = new KeySelector(config, policyEngine, cooldownManager, emitter);

      await expect(selector.selectKey('test')).rejects.toThrow(RateLimitError);
    });

    it.todo('throws QuotaExhaustedError when all keys exhausted');
    it.todo('emits provider:exhausted event before throwing');
  });

  describe('custom-strategy', () => {
    it.todo('accepts custom strategy as function');
    it.todo('accepts custom strategy as object with name and selectKey');
    it.todo('falls back to default strategy on custom strategy error');
  });

  describe('single-key-shortcircuit', () => {
    it.todo('skips strategy logic for single-key provider');
    it.todo('still emits key:selected event for single key');
  });

  describe('events', () => {
    it.todo('emits key:selected on every selection');
    it.todo('includes strategy name and reason in event payload');
  });
});
