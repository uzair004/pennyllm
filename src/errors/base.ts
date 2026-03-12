/**
 * Base error class for all LLM Router errors
 */
export class LLMRouterError extends Error {
  public readonly code: string;
  public readonly suggestion?: string;
  public readonly metadata?: Record<string, unknown>;
  public override readonly cause?: Error;

  constructor(
    message: string,
    options?: {
      code?: string;
      suggestion?: string;
      metadata?: Record<string, unknown>;
      cause?: Error;
    },
  ) {
    super(message);
    this.name = 'LLMRouterError';
    this.code = options?.code ?? 'UNKNOWN_ERROR';
    if (options?.suggestion !== undefined) {
      this.suggestion = options.suggestion;
    }
    if (options?.metadata !== undefined) {
      this.metadata = options.metadata;
    }
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }

    // Maintain proper stack trace for where error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Serialize error to JSON
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      suggestion: this.suggestion,
      metadata: this.metadata,
      stack: this.stack,
    };
  }
}
