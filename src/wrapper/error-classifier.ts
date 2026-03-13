/**
 * Error classification types.
 * Functions (classifyError, shouldRetry, buildFinalError, makeAttemptRecord)
 * are added in Task 2.
 */

export type ErrorType = 'rate_limit' | 'auth' | 'server' | 'network' | 'unknown';

export interface ClassifiedError {
  type: ErrorType;
  statusCode?: number;
  retryAfter?: string;
  message: string;
  original: unknown;
  retryable: boolean;
}

export interface AttemptRecord {
  keyIndex: number;
  errorType: string;
  statusCode?: number;
  providerMessage: string;
  retryAfter?: string;
}
