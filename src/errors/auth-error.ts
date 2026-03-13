import { LLMRouterError } from './base.js';

/**
 * Error thrown when a provider returns 401 or 403 (authentication/authorization failure).
 */
export class AuthError extends LLMRouterError {
  constructor(
    provider: string,
    keyIndex: number,
    statusCode: number,
    options?: { cause?: Error; providerMessage?: string },
  ) {
    const metadata: Record<string, unknown> = { provider, keyIndex, statusCode };
    if (options?.providerMessage !== undefined) {
      metadata['providerMessage'] = options.providerMessage;
    }

    super(`Authentication failed for ${provider} (key ${keyIndex}): HTTP ${statusCode}`, {
      code: 'AUTH_FAILED',
      suggestion: `Verify your API key for ${provider} is valid and has not been revoked`,
      metadata,
      ...(options?.cause !== undefined ? { cause: options.cause } : {}),
    });
    this.name = 'AuthError';
  }
}
