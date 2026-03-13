import { describe, it } from 'vitest';

describe('KeySelector', () => {
  describe('per-provider-override', () => {
    it.todo('uses per-provider strategy when configured');
    it.todo('per-request override takes precedence over per-provider');
    it.todo('falls back to global default when no override');
  });

  describe('skip-ineligible', () => {
    it.todo('skips keys in cooldown');
    it.todo('skips keys that exceeded quota');
    it.todo('throws RateLimitError when all keys in cooldown');
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
