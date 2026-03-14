import type { PolicyLimit, TimeWindow } from '../types/domain.js';
import { LimitType } from '../constants/index.js';

/**
 * Duration constants in milliseconds for each window type
 */
const DURATIONS = {
  'per-minute': 60_000,
  hourly: 3_600_000,
  daily: 86_400_000,
  monthly: 2_592_000_000, // 30 days
  'rolling-30d': 2_592_000_000,
} as const;

type WindowType = keyof typeof DURATIONS;

function createWindow(type: WindowType): TimeWindow {
  return { type, durationMs: DURATIONS[type] };
}

/**
 * Create a token-based limit (tracks prompt + completion tokens).
 *
 * @example
 * ```typescript
 * createTokenLimit(250_000, 'per-minute')  // 250K TPM
 * createTokenLimit(1_000_000, 'daily')     // 1M tokens/day
 * ```
 */
export function createTokenLimit(value: number, window: WindowType): PolicyLimit {
  return { type: LimitType.TOKENS, value, window: createWindow(window) };
}

/**
 * Create a rate limit (tracks requests per time window).
 *
 * @example
 * ```typescript
 * createRateLimit(15, 'per-minute')  // 15 RPM
 * createRateLimit(1000, 'daily')     // 1000 RPD
 * ```
 */
export function createRateLimit(value: number, window: WindowType): PolicyLimit {
  return { type: LimitType.RATE, value, window: createWindow(window) };
}

/**
 * Create a call count limit (tracks total API calls).
 *
 * @example
 * ```typescript
 * createCallLimit(1000, 'monthly')  // 1000 calls/month
 * createCallLimit(50, 'daily')      // 50 calls/day
 * ```
 */
export function createCallLimit(value: number, window: WindowType): PolicyLimit {
  return { type: LimitType.CALLS, value, window: createWindow(window) };
}
