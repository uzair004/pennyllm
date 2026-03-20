import { describe, it, expect } from 'vitest';
import * as PennyLLM from '../src/index.js';

describe('Public API exports', () => {
  it('exports createRouter function', () => {
    expect(typeof PennyLLM.createRouter).toBe('function');
  });

  it('exports defineConfig function', () => {
    expect(typeof PennyLLM.defineConfig).toBe('function');
  });

  it('exports configSchema (Zod schema)', () => {
    expect(typeof PennyLLM.configSchema).toBe('object');
    expect(typeof PennyLLM.configSchema.parse).toBe('function');
  });

  it('exports loadConfigFile function', () => {
    expect(typeof PennyLLM.loadConfigFile).toBe('function');
  });

  it('exports DEFAULT_CONFIG object', () => {
    expect(typeof PennyLLM.DEFAULT_CONFIG).toBe('object');
    expect(PennyLLM.DEFAULT_CONFIG.version).toBe('1.0');
    expect(PennyLLM.DEFAULT_CONFIG.strategy).toBe('priority');
    expect(PennyLLM.DEFAULT_CONFIG.storage.type).toBe('memory');
  });

  it('exports Strategy constants', () => {
    expect(typeof PennyLLM.Strategy).toBe('object');
    expect(PennyLLM.Strategy.ROUND_ROBIN).toBe('round-robin');
    expect(PennyLLM.Strategy.LEAST_USED).toBe('least-used');
  });

  it('exports Provider constants', () => {
    expect(typeof PennyLLM.Provider).toBe('object');
    expect(PennyLLM.Provider.CEREBRAS).toBe('cerebras');
    expect(PennyLLM.Provider.GOOGLE).toBe('google');
    expect(PennyLLM.Provider.GROQ).toBe('groq');
    expect(PennyLLM.Provider.SAMBANOVA).toBe('sambanova');
    expect(PennyLLM.Provider.NVIDIA).toBe('nvidia');
    expect(PennyLLM.Provider.MISTRAL).toBe('mistral');
  });

  it('exports RouterEvent constants', () => {
    expect(typeof PennyLLM.RouterEvent).toBe('object');
    expect(PennyLLM.RouterEvent.KEY_SELECTED).toBe('key:selected');
    expect(PennyLLM.RouterEvent.USAGE_RECORDED).toBe('usage:recorded');
    expect(PennyLLM.RouterEvent.LIMIT_WARNING).toBe('limit:warning');
    expect(PennyLLM.RouterEvent.LIMIT_EXCEEDED).toBe('limit:exceeded');
    expect(PennyLLM.RouterEvent.FALLBACK_TRIGGERED).toBe('fallback:triggered');
    expect(PennyLLM.RouterEvent.CONFIG_LOADED).toBe('config:loaded');
    expect(PennyLLM.RouterEvent.ERROR).toBe('error');
  });

  it('exports LimitType constants', () => {
    expect(typeof PennyLLM.LimitType).toBe('object');
    expect(PennyLLM.LimitType.TOKENS).toBe('tokens');
    expect(PennyLLM.LimitType.CALLS).toBe('calls');
    expect(PennyLLM.LimitType.RATE).toBe('rate');
    expect(PennyLLM.LimitType.DAILY).toBe('daily');
    expect(PennyLLM.LimitType.MONTHLY).toBe('monthly');
  });

  it('exports EnforcementBehavior constants', () => {
    expect(typeof PennyLLM.EnforcementBehavior).toBe('object');
    expect(PennyLLM.EnforcementBehavior.HARD_BLOCK).toBe('hard-block');
    expect(PennyLLM.EnforcementBehavior.THROTTLE).toBe('throttle');
    expect(PennyLLM.EnforcementBehavior.SILENT_CHARGE).toBe('silent-charge');
  });

  it('exports QualityTier constants', () => {
    expect(typeof PennyLLM.QualityTier).toBe('object');
    expect(PennyLLM.QualityTier.FRONTIER).toBe('frontier');
    expect(PennyLLM.QualityTier.HIGH).toBe('high');
    expect(PennyLLM.QualityTier.MID).toBe('mid');
    expect(PennyLLM.QualityTier.SMALL).toBe('small');
  });

  it('exports PennyLLMError class', () => {
    expect(typeof PennyLLM.PennyLLMError).toBe('function');

    const error = new PennyLLM.PennyLLMError('test error', {
      code: 'TEST_ERROR',
      suggestion: 'Try again',
    });

    expect(error.name).toBe('PennyLLMError');
    expect(error.code).toBe('TEST_ERROR');
    expect(error.suggestion).toBe('Try again');
    expect(error.message).toBe('test error');
  });

  it('exports ConfigError class', () => {
    expect(typeof PennyLLM.ConfigError).toBe('function');

    const error = new PennyLLM.ConfigError('config error', {
      field: 'providers',
    });

    expect(error.name).toBe('ConfigError');
    expect(error.code).toBe('CONFIG_ERROR');
    expect(error.message).toBe('config error');
  });

  it('PennyLLMError.toJSON returns expected shape', () => {
    const error = new PennyLLM.PennyLLMError('test error', {
      code: 'TEST_ERROR',
      suggestion: 'Try again',
      metadata: { key: 'value' },
    });

    const json = error.toJSON();

    expect(json.name).toBe('PennyLLMError');
    expect(json.code).toBe('TEST_ERROR');
    expect(json.message).toBe('test error');
    expect(json.suggestion).toBe('Try again');
    expect(json.metadata).toEqual({ key: 'value' });
    expect(typeof json.stack).toBe('string');
  });
});
