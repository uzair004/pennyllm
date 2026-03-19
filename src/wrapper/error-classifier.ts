import { APICallError } from '@ai-sdk/provider';
import { ProviderError } from '../errors/index.js';

// ── Types ──────────────────────────────────────────────────────────

export type ErrorType = 'rate_limit' | 'auth' | 'server' | 'network' | 'unknown';

export type CooldownClass = 'short' | 'long' | 'permanent';

export interface ClassifiedError {
  type: ErrorType;
  statusCode?: number;
  retryAfter?: string;
  message: string;
  original: unknown;
  retryable: boolean;
  cooldownMs?: number;
  cooldownClass?: CooldownClass;
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

// ── Cooldown parsing helpers ────────────────────────────────────────

/**
 * Parse a Retry-After header value into milliseconds.
 * Handles both delta-seconds ("60") and HTTP-date ("Thu, 01 Dec 2025 16:00:00 GMT") formats.
 */
function parseRetryAfter(header: string | undefined): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  if (!isNaN(seconds) && seconds >= 0) return seconds * 1000;
  const date = new Date(header);
  if (!isNaN(date.getTime())) return Math.max(0, date.getTime() - Date.now());
  return undefined;
}

/**
 * Parse x-ratelimit-reset-* headers as fallback for cooldown duration.
 * Tries x-ratelimit-reset-requests first (Groq, SambaNova), then x-ratelimit-reset (Google).
 * Values may be epoch seconds or ISO date strings.
 */
function parseRateLimitReset(headers: Record<string, string> | undefined): number | undefined {
  if (!headers) return undefined;
  const resetValue = headers['x-ratelimit-reset-requests'] ?? headers['x-ratelimit-reset'];
  if (!resetValue) return undefined;
  const asNumber = Number(resetValue);
  if (!isNaN(asNumber)) {
    // If looks like epoch (> year 2000 in seconds), treat as absolute
    if (asNumber > 1_000_000_000) return Math.max(0, asNumber * 1000 - Date.now());
    // Otherwise treat as relative seconds
    return asNumber * 1000;
  }
  const date = new Date(resetValue);
  if (!isNaN(date.getTime())) return Math.max(0, date.getTime() - Date.now());
  return undefined;
}

/**
 * Classify cooldown duration into short/long/permanent.
 * Short: < 2 minutes. Long: >= 2 minutes. Permanent: Infinity (402 credit exhaustion).
 */
function classifyCooldown(cooldownMs: number): CooldownClass {
  if (cooldownMs === Infinity) return 'permanent';
  return cooldownMs < 120_000 ? 'short' : 'long';
}

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
      // Compute cooldownMs from retry-after header, falling back to x-ratelimit-reset-* headers
      const cooldownMs =
        parseRetryAfter(retryAfter) ?? parseRateLimitReset(error.responseHeaders ?? undefined);
      if (cooldownMs !== undefined) {
        result.cooldownMs = cooldownMs;
        result.cooldownClass = classifyCooldown(cooldownMs);
      }
      return result;
    }

    if (statusCode === 402) {
      return {
        type: 'rate_limit',
        statusCode: 402,
        message: `${error.message} (credits exhausted)`,
        original: error,
        retryable: false,
        cooldownMs: Infinity,
        cooldownClass: 'permanent',
      };
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
      return classified.retryable;
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
