import { APICallError } from '@ai-sdk/provider';
import { ProviderError } from '../errors/index.js';

// ── Types ──────────────────────────────────────────────────────────

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

// ── Network error codes ────────────────────────────────────────────

const NETWORK_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ENOTFOUND',
  'ECONNRESET',
  'EAI_AGAIN',
]);

// ── classifyError ──────────────────────────────────────────────────

/**
 * Classify an error into a typed category. Pure function, no side effects.
 *
 * Uses APICallError.isInstance() (never instanceof) per AI SDK convention.
 * Checks both error.code and error.cause.code for Node.js network errors
 * (fetch() wraps system errors in TypeError with cause).
 */
export function classifyError(error: unknown): ClassifiedError {
  // 1. Check for APICallError (HTTP-level failures from AI SDK)
  if (APICallError.isInstance(error)) {
    const statusCode = error.statusCode;

    if (statusCode === 429) {
      const retryAfter = error.responseHeaders?.['retry-after'];
      const result: ClassifiedError = {
        type: 'rate_limit',
        statusCode: 429,
        message: error.message,
        original: error,
        retryable: true,
      };
      if (retryAfter !== undefined) {
        result.retryAfter = retryAfter;
      }
      return result;
    }

    if (statusCode === 401 || statusCode === 403) {
      return {
        type: 'auth',
        statusCode,
        message: error.message,
        original: error,
        retryable: true,
      };
    }

    if (statusCode !== undefined && statusCode >= 500) {
      return {
        type: 'server',
        statusCode,
        message: error.message,
        original: error,
        retryable: false,
      };
    }

    // Other APICallError status codes
    const result: ClassifiedError = {
      type: 'unknown',
      message: error.message,
      original: error,
      retryable: false,
    };
    if (statusCode !== undefined) {
      result.statusCode = statusCode;
    }
    return result;
  }

  // 2. Check for network errors (Node.js system errors)
  const directCode = (error as NodeJS.ErrnoException).code;
  const causeCode = (error as { cause?: { code?: string } }).cause?.code;

  const networkCode = directCode ?? causeCode;
  if (networkCode !== undefined && NETWORK_ERROR_CODES.has(networkCode)) {
    return {
      type: 'network',
      message: error instanceof Error ? error.message : String(error),
      original: error,
      retryable: true,
    };
  }

  // 3. Fallback
  return {
    type: 'unknown',
    message: error instanceof Error ? error.message : String(error),
    original: error,
    retryable: false,
  };
}

// ── shouldRetry ────────────────────────────────────────────────────

/**
 * Determine whether the retry proxy should attempt with a different key.
 * Pure function based on user decisions from CONTEXT.md:
 * - server: false (provider is down)
 * - unknown: false
 * - network: retry once only (triedKeys.size <= 1)
 * - rate_limit/auth: true (try all available keys)
 */
export function shouldRetry(classified: ClassifiedError, triedKeys: Set<number>): boolean {
  switch (classified.type) {
    case 'server':
      return false;
    case 'unknown':
      return false;
    case 'network':
      return triedKeys.size <= 1;
    case 'rate_limit':
      return true;
    case 'auth':
      return true;
    default:
      return classified.retryable;
  }
}

// ── buildFinalError ────────────────────────────────────────────────

/**
 * Build the appropriate PennyLLMError subclass for a classified error.
 * Always returns PennyLLMError subclass (never APICallError) to prevent
 * double-retry with the AI SDK's own retry mechanism.
 */
export function buildFinalError(
  provider: string,
  modelId: string,
  classified: ClassifiedError,
  attempts: AttemptRecord[],
  originalError: unknown,
): ProviderError {
  const cause = originalError instanceof Error ? originalError : undefined;
  const opts = cause !== undefined ? { cause } : {};

  return new ProviderError(provider, modelId, classified.type, attempts, opts);
}

// ── makeAttemptRecord ──────────────────────────────────────────────

/**
 * Build an AttemptRecord from a ClassifiedError.
 * Uses conditional property inclusion for optional fields
 * (exactOptionalPropertyTypes compliance).
 */
export function makeAttemptRecord(keyIndex: number, classified: ClassifiedError): AttemptRecord {
  const record: AttemptRecord = {
    keyIndex,
    errorType: classified.type,
    providerMessage: classified.message,
  };
  if (classified.statusCode !== undefined) {
    record.statusCode = classified.statusCode;
  }
  if (classified.retryAfter !== undefined) {
    record.retryAfter = classified.retryAfter;
  }
  return record;
}
