import { describe, it, expect } from 'vitest';
import * as LLMRouter from '../src/index.js';

describe('Public API exports', () => {
  it('exports createRouter function', () => {
    expect(typeof LLMRouter.createRouter).toBe('function');
  });

  it('exports defineConfig function', () => {
    expect(typeof LLMRouter.defineConfig).toBe('function');
  });

  it('exports configSchema (Zod schema)', () => {
    expect(typeof LLMRouter.configSchema).toBe('object');
    expect(typeof LLMRouter.configSchema.parse).toBe('function');
  });

  it('exports loadConfigFile function', () => {
    expect(typeof LLMRouter.loadConfigFile).toBe('function');
  });

  it('exports DEFAULT_CONFIG object', () => {
    expect(typeof LLMRouter.DEFAULT_CONFIG).toBe('object');
    expect(LLMRouter.DEFAULT_CONFIG.version).toBe('1.0');
    expect(LLMRouter.DEFAULT_CONFIG.strategy).toBe('round-robin');
    expect(LLMRouter.DEFAULT_CONFIG.storage.type).toBe('sqlite');
  });

  it('exports Strategy constants', () => {
    expect(typeof LLMRouter.Strategy).toBe('object');
    expect(LLMRouter.Strategy.ROUND_ROBIN).toBe('round-robin');
    expect(LLMRouter.Strategy.LEAST_USED).toBe('least-used');
  });

  it('exports Provider constants', () => {
    expect(typeof LLMRouter.Provider).toBe('object');
    expect(LLMRouter.Provider.GOOGLE).toBe('google');
    expect(LLMRouter.Provider.GROQ).toBe('groq');
    expect(LLMRouter.Provider.OPENROUTER).toBe('openrouter');
    expect(LLMRouter.Provider.MISTRAL).toBe('mistral');
    expect(LLMRouter.Provider.HUGGINGFACE).toBe('huggingface');
    expect(LLMRouter.Provider.CEREBRAS).toBe('cerebras');
    expect(LLMRouter.Provider.DEEPSEEK).toBe('deepseek');
    expect(LLMRouter.Provider.QWEN).toBe('qwen');
    expect(LLMRouter.Provider.CLOUDFLARE).toBe('cloudflare');
    expect(LLMRouter.Provider.NVIDIA).toBe('nvidia');
    expect(LLMRouter.Provider.COHERE).toBe('cohere');
    expect(LLMRouter.Provider.GITHUB).toBe('github');
  });

  it('exports RouterEvent constants', () => {
    expect(typeof LLMRouter.RouterEvent).toBe('object');
    expect(LLMRouter.RouterEvent.KEY_SELECTED).toBe('key:selected');
    expect(LLMRouter.RouterEvent.USAGE_RECORDED).toBe('usage:recorded');
    expect(LLMRouter.RouterEvent.LIMIT_WARNING).toBe('limit:warning');
    expect(LLMRouter.RouterEvent.LIMIT_EXCEEDED).toBe('limit:exceeded');
    expect(LLMRouter.RouterEvent.FALLBACK_TRIGGERED).toBe('fallback:triggered');
    expect(LLMRouter.RouterEvent.CONFIG_LOADED).toBe('config:loaded');
    expect(LLMRouter.RouterEvent.ERROR).toBe('error');
  });

  it('exports LimitType constants', () => {
    expect(typeof LLMRouter.LimitType).toBe('object');
    expect(LLMRouter.LimitType.TOKENS).toBe('tokens');
    expect(LLMRouter.LimitType.CALLS).toBe('calls');
    expect(LLMRouter.LimitType.RATE).toBe('rate');
    expect(LLMRouter.LimitType.DAILY).toBe('daily');
    expect(LLMRouter.LimitType.MONTHLY).toBe('monthly');
  });

  it('exports EnforcementBehavior constants', () => {
    expect(typeof LLMRouter.EnforcementBehavior).toBe('object');
    expect(LLMRouter.EnforcementBehavior.HARD_BLOCK).toBe('hard-block');
    expect(LLMRouter.EnforcementBehavior.THROTTLE).toBe('throttle');
    expect(LLMRouter.EnforcementBehavior.SILENT_CHARGE).toBe('silent-charge');
  });

  it('exports QualityTier constants', () => {
    expect(typeof LLMRouter.QualityTier).toBe('object');
    expect(LLMRouter.QualityTier.FRONTIER).toBe('frontier');
    expect(LLMRouter.QualityTier.HIGH).toBe('high');
    expect(LLMRouter.QualityTier.MID).toBe('mid');
    expect(LLMRouter.QualityTier.SMALL).toBe('small');
  });

  it('exports LLMRouterError class', () => {
    expect(typeof LLMRouter.LLMRouterError).toBe('function');

    const error = new LLMRouter.LLMRouterError('test error', {
      code: 'TEST_ERROR',
      suggestion: 'Try again',
    });

    expect(error.name).toBe('LLMRouterError');
    expect(error.code).toBe('TEST_ERROR');
    expect(error.suggestion).toBe('Try again');
    expect(error.message).toBe('test error');
  });

  it('exports ConfigError class', () => {
    expect(typeof LLMRouter.ConfigError).toBe('function');

    const error = new LLMRouter.ConfigError('config error', {
      field: 'providers',
    });

    expect(error.name).toBe('ConfigError');
    expect(error.code).toBe('CONFIG_ERROR');
    expect(error.message).toBe('config error');
  });

  it('LLMRouterError.toJSON returns expected shape', () => {
    const error = new LLMRouter.LLMRouterError('test error', {
      code: 'TEST_ERROR',
      suggestion: 'Try again',
      metadata: { key: 'value' },
    });

    const json = error.toJSON();

    expect(json.name).toBe('LLMRouterError');
    expect(json.code).toBe('TEST_ERROR');
    expect(json.message).toBe('test error');
    expect(json.suggestion).toBe('Try again');
    expect(json.metadata).toEqual({ key: 'value' });
    expect(typeof json.stack).toBe('string');
  });
});
