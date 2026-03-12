import { LLMRouterError } from './base.js';

/**
 * Error thrown when configuration is invalid
 */
export class ConfigError extends LLMRouterError {
  constructor(
    message: string,
    options?: {
      field?: string;
      cause?: Error;
    },
  ) {
    const superOptions: {
      code: string;
      suggestion: string;
      metadata?: Record<string, unknown>;
      cause?: Error;
    } = {
      code: 'CONFIG_ERROR',
      suggestion: 'Check your configuration against the schema',
    };

    if (options?.field !== undefined) {
      superOptions.metadata = { field: options.field };
    }
    if (options?.cause !== undefined) {
      superOptions.cause = options.cause;
    }

    super(message, superOptions);
    this.name = 'ConfigError';
  }
}
