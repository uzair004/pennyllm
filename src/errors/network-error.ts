import { LLMRouterError } from './base.js';

/**
 * Error thrown when a network-level failure occurs (DNS, connection refused, timeout).
 */
export class NetworkError extends LLMRouterError {
  constructor(message: string, options?: { cause?: Error; errorCode?: string }) {
    const metadata: Record<string, unknown> = {};
    if (options?.errorCode !== undefined) {
      metadata['errorCode'] = options.errorCode;
    }

    super(message, {
      code: 'NETWORK_ERROR',
      suggestion: 'Check network connectivity. The provider may be unreachable.',
      ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
      ...(options?.cause !== undefined ? { cause: options.cause } : {}),
    });
    this.name = 'NetworkError';
  }
}
