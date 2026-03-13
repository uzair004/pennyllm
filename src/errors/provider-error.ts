import { LLMRouterError } from './base.js';
import type { AttemptRecord, ErrorType } from '../wrapper/error-classifier.js';

function getSuggestion(errorType: ErrorType, provider: string): string {
  switch (errorType) {
    case 'rate_limit':
      return `All keys for ${provider} are rate-limited. Wait or add more keys.`;
    case 'auth':
      return `All keys for ${provider} failed authentication. Verify your API keys.`;
    case 'server':
      return `Provider ${provider} is experiencing issues. Try again later.`;
    case 'network':
      return `Network error reaching ${provider}. Check connectivity.`;
    case 'unknown':
    default:
      return `Unexpected error from ${provider}. Check logs for details.`;
  }
}

/**
 * Error thrown when all keys for a provider have been exhausted through retries.
 * Includes the error type discriminator and full attempt history.
 */
export class ProviderError extends LLMRouterError {
  public readonly errorType: ErrorType;
  public readonly attempts: AttemptRecord[];
  public readonly modelId: string;

  constructor(
    provider: string,
    modelId: string,
    errorType: ErrorType,
    attempts: AttemptRecord[],
    options?: { cause?: Error },
  ) {
    const suggestion = getSuggestion(errorType, provider);

    super(
      `All keys exhausted for ${provider}/${modelId} (${errorType}): ${attempts.length} attempt(s) failed`,
      {
        code: `PROVIDER_${errorType.toUpperCase()}`,
        suggestion,
        metadata: { provider, modelId, errorType, attempts },
        ...(options?.cause !== undefined ? { cause: options.cause } : {}),
      },
    );
    this.name = 'ProviderError';
    this.errorType = errorType;
    this.attempts = attempts;
    this.modelId = modelId;
  }
}
