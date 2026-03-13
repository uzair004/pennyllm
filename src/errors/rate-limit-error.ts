import { LLMRouterError } from './base.js';

/**
 * Error thrown when all keys for a provider are rate-limited
 */
export class RateLimitError extends LLMRouterError {
  constructor(provider: string, keys: Array<{ keyIndex: number; cooldownUntil: string }>) {
    if (keys.length === 0) {
      throw new Error('RateLimitError requires at least one key');
    }

    const earliestRecovery = keys.reduce((earliest, key) => {
      const keyTime = new Date(key.cooldownUntil).getTime();
      return keyTime < new Date(earliest).getTime() ? key.cooldownUntil : earliest;
    }, keys[0]!.cooldownUntil);

    const recoveryDate = new Date(earliestRecovery);
    const suggestion = `All ${keys.length} key(s) for ${provider} are rate-limited. Earliest recovery at ${recoveryDate.toISOString()}.`;

    super(`Provider ${provider} exhausted: all keys rate-limited`, {
      code: 'RATE_LIMITED',
      suggestion,
      metadata: { provider, keys, earliestRecovery },
    });

    this.name = 'RateLimitError';
  }
}
