import type { TimeWindow } from '../types/domain.js';

/**
 * Generate a period key for a given time window and timestamp
 * Uses calendar-aware boundaries for hourly/daily/monthly windows
 */
export function getPeriodKey(window: TimeWindow, timestamp: number): string {
  const date = new Date(timestamp);

  switch (window.type) {
    case 'per-minute': {
      // Fixed 60-second boundaries
      return Math.floor(timestamp / window.durationMs).toString();
    }
    case 'hourly': {
      // UTC hour boundaries: YYYY-MM-DDTHH
      const iso = date.toISOString();
      return iso.slice(0, 13); // YYYY-MM-DDTHH
    }
    case 'daily': {
      // UTC day boundaries: YYYY-MM-DD
      const iso = date.toISOString();
      return iso.slice(0, 10); // YYYY-MM-DD
    }
    case 'monthly': {
      // Calendar month: YYYY-MM (NOT duration division)
      const iso = date.toISOString();
      return iso.slice(0, 7); // YYYY-MM
    }
    case 'rolling-30d': {
      // Daily bucket for summation
      const iso = date.toISOString();
      return iso.slice(0, 10); // YYYY-MM-DD
    }
    default: {
      // Exhaustiveness check
      const _exhaustive: never = window.type;
      throw new Error(`Unknown window type: ${String(_exhaustive)}`);
    }
  }
}

/**
 * Calculate the reset time for a given time window and timestamp
 * Returns the next boundary when the window resets
 */
export function getResetAt(window: TimeWindow, timestamp: number): Date {
  const date = new Date(timestamp);

  switch (window.type) {
    case 'per-minute': {
      // Next 60-second boundary
      const nextBoundary = Math.ceil(timestamp / window.durationMs) * window.durationMs;
      return new Date(nextBoundary);
    }
    case 'hourly': {
      // Next UTC hour boundary
      const year = date.getUTCFullYear();
      const month = date.getUTCMonth();
      const day = date.getUTCDate();
      const hour = date.getUTCHours();
      const nextHour = Date.UTC(year, month, day, hour + 1, 0, 0, 0);
      return new Date(nextHour);
    }
    case 'daily': {
      // Next UTC midnight
      const year = date.getUTCFullYear();
      const month = date.getUTCMonth();
      const day = date.getUTCDate();
      const nextDay = Date.UTC(year, month, day + 1, 0, 0, 0, 0);
      return new Date(nextDay);
    }
    case 'monthly': {
      // First of next month at UTC midnight
      const year = date.getUTCFullYear();
      const month = date.getUTCMonth();
      const nextMonth = Date.UTC(year, month + 1, 1, 0, 0, 0, 0);
      return new Date(nextMonth);
    }
    case 'rolling-30d': {
      // Next UTC midnight (daily bucket boundary)
      const year = date.getUTCFullYear();
      const month = date.getUTCMonth();
      const day = date.getUTCDate();
      const nextDay = Date.UTC(year, month, day + 1, 0, 0, 0, 0);
      return new Date(nextDay);
    }
    default: {
      // Exhaustiveness check
      const _exhaustive: never = window.type;
      throw new Error(`Unknown window type: ${String(_exhaustive)}`);
    }
  }
}
