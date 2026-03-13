import { LLMRouterError } from './base.js';

/**
 * Error thrown when all keys for a provider have exhausted their quotas
 */
export class QuotaExhaustedError extends LLMRouterError {
  constructor(provider: string, keys: Array<{ keyIndex: number; nextReset?: string }>) {
    if (keys.length === 0) {
      throw new Error('QuotaExhaustedError requires at least one key');
    }

    const keysWithReset = keys.filter((k) => k.nextReset !== undefined);
    const nextReset =
      keysWithReset.length > 0
        ? keysWithReset.reduce((earliest, key) => {
            if (key.nextReset === undefined) return earliest;
            if (earliest === undefined) return key.nextReset;
            const keyTime = new Date(key.nextReset).getTime();
            return keyTime < new Date(earliest).getTime() ? key.nextReset : earliest;
          }, keysWithReset[0]!.nextReset)
        : undefined;

    const suggestion =
      nextReset !== undefined
        ? `All ${keys.length} key(s) for ${provider} have exhausted their quotas. Next reset at ${new Date(nextReset).toISOString()}.`
        : `All ${keys.length} key(s) for ${provider} have exhausted their quotas.`;

    super(`Provider ${provider} exhausted: all keys over quota`, {
      code: 'QUOTA_EXHAUSTED',
      suggestion,
      metadata: { provider, keys, nextReset },
    });

    this.name = 'QuotaExhaustedError';
  }
}
