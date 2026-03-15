import type { ProviderAttempt } from '../fallback/types.js';
import { PennyLLMError } from './base.js';

/**
 * Error thrown when all providers have been exhausted during fallback
 */
export class AllProvidersExhaustedError extends PennyLLMError {
  public readonly attempts: ProviderAttempt[];
  public readonly earliestRecovery: string | null;

  constructor(originalModelId: string, attempts: ProviderAttempt[], options?: { cause?: Error }) {
    const attemptsWithRecovery = attempts.filter((a) => a.earliestRecovery !== undefined);
    const earliestRecovery =
      attemptsWithRecovery.length > 0
        ? attemptsWithRecovery.reduce((earliest, attempt) => {
            if (attempt.earliestRecovery === undefined) return earliest;
            if (earliest === '') return attempt.earliestRecovery;
            const attemptTime = new Date(attempt.earliestRecovery).getTime();
            return attemptTime < new Date(earliest).getTime() ? attempt.earliestRecovery : earliest;
          }, '')
        : null;

    const providerSummary = attempts.map((a) => `${a.provider} (${a.reason})`).join(', ');

    const recoveryMessage =
      earliestRecovery !== null
        ? ` Earliest recovery: ${new Date(earliestRecovery).toISOString()}.`
        : '';

    const suggestion =
      `Tried ${attempts.length} provider(s) for ${originalModelId}: ${providerSummary}.${recoveryMessage} ` +
      `Consider adding more providers, increasing budget, or waiting for quota reset.`;

    const constructorOptions: {
      code: string;
      suggestion: string;
      metadata: Record<string, unknown>;
      cause?: Error;
    } = {
      code: 'ALL_PROVIDERS_EXHAUSTED',
      suggestion,
      metadata: { originalModelId, attempts, earliestRecovery },
    };

    if (options?.cause !== undefined) {
      constructorOptions.cause = options.cause;
    }

    super(
      `All providers exhausted for ${originalModelId}: no available fallback`,
      constructorOptions,
    );

    this.name = 'AllProvidersExhaustedError';
    this.attempts = attempts;
    this.earliestRecovery = earliestRecovery;
  }
}
