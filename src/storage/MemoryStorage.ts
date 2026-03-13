import debugFactory from 'debug';
import { randomUUID } from 'node:crypto';
import type { StorageBackend } from '../types/interfaces.js';
import type { TimeWindow, UsageRecord } from '../types/domain.js';
import { LLMRouterError } from '../errors/base.js';
import { getPeriodKey } from '../usage/periods.js';

const debug = debugFactory('llm-router:storage');

/**
 * In-memory storage backend implementation
 * WARNING: Data does not persist across restarts
 */
export class MemoryStorage implements StorageBackend {
  private data: Map<string, UsageRecord>;
  private callCounts: Map<string, number>;
  private closed: boolean;

  constructor() {
    this.data = new Map();
    this.callCounts = new Map();
    this.closed = false;

    // Emit warning to stderr
    process.stderr.write(
      'Warning: Using in-memory storage — usage data will not persist across restarts. Use a storage adapter for persistence.\n',
    );

    debug('MemoryStorage initialized');
  }

  /**
   * Generate composite key for storage using calendar-aware period keys
   */
  private makeKey(provider: string, keyIndex: number, window: TimeWindow): string {
    const periodKey = getPeriodKey(window, Date.now());
    return `${provider}:${keyIndex}:${window.type}:${periodKey}`;
  }

  /**
   * Clean up expired records for a specific window type
   */
  private cleanupExpired(window: TimeWindow): void {
    const currentPeriodKey = getPeriodKey(window, Date.now());

    for (const [key, record] of this.data.entries()) {
      if (record.window.type === window.type) {
        // Extract period key from composite key (4th segment: provider:keyIndex:type:periodKey)
        const segments = key.split(':');
        const storedPeriodKey = segments.slice(3).join(':'); // Handle period keys with colons

        // If period keys differ, record is expired
        if (storedPeriodKey !== currentPeriodKey) {
          this.data.delete(key);
          this.callCounts.delete(key);
          debug('Cleaned up expired record: %s', key);
        }
      }
    }
  }

  /**
   * Throw if storage is closed
   */
  private ensureOpen(): void {
    if (this.closed) {
      throw new LLMRouterError('Storage backend is closed', { code: 'STORAGE_CLOSED' });
    }
  }

  /**
   * Retrieve usage records for a specific key prefix
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async get(key: string): Promise<UsageRecord[]> {
    this.ensureOpen();

    const results: UsageRecord[] = [];
    const prefix = `${key}:`;

    for (const [mapKey, record] of this.data.entries()) {
      if (mapKey.startsWith(prefix)) {
        results.push(record);
      }
    }

    debug('get(%s) returned %d records', key, results.length);
    return results;
  }

  /**
   * Store a usage record
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async put(record: UsageRecord): Promise<void> {
    this.ensureOpen();

    const key = this.makeKey(record.provider, record.keyIndex, record.window);
    this.data.set(key, record);

    debug('put() stored record with key: %s', key);
  }

  /**
   * Increment usage atomically and return updated record
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async increment(
    provider: string,
    keyIndex: number,
    tokens: { prompt: number; completion: number },
    window: TimeWindow,
    callCount?: number,
  ): Promise<UsageRecord> {
    this.ensureOpen();

    // Clean up expired records first
    this.cleanupExpired(window);

    const key = this.makeKey(provider, keyIndex, window);

    // Synchronous read-modify-write (no await between get and set)
    const existing = this.data.get(key);

    const record: UsageRecord = existing
      ? {
          ...existing,
          promptTokens: existing.promptTokens + tokens.prompt,
          completionTokens: existing.completionTokens + tokens.completion,
          totalTokens: existing.totalTokens + tokens.prompt + tokens.completion,
        }
      : {
          id: randomUUID(),
          provider,
          keyIndex,
          promptTokens: tokens.prompt,
          completionTokens: tokens.completion,
          totalTokens: tokens.prompt + tokens.completion,
          timestamp: Date.now(),
          window,
          estimated: false,
        };

    this.data.set(key, record);

    // Increment call count
    const currentCallCount = this.callCounts.get(key) ?? 0;
    this.callCounts.set(key, currentCallCount + (callCount ?? 0));

    debug(
      'increment() updated key: %s (prompt: +%d, completion: +%d, total: %d, calls: +%d)',
      key,
      tokens.prompt,
      tokens.completion,
      record.totalTokens,
      callCount ?? 0,
    );

    return record;
  }

  /**
   * Get current usage for a key within a time window
   * Returns structured usage data with token counts and call count
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async getUsage(
    provider: string,
    keyIndex: number,
    window: TimeWindow,
  ): Promise<{
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    callCount: number;
  }> {
    this.ensureOpen();

    // Clean up expired records first
    this.cleanupExpired(window);

    const key = this.makeKey(provider, keyIndex, window);
    const record = this.data.get(key);
    const callCount = this.callCounts.get(key) ?? 0;

    const usage = {
      promptTokens: record?.promptTokens ?? 0,
      completionTokens: record?.completionTokens ?? 0,
      totalTokens: record?.totalTokens ?? 0,
      callCount,
    };

    debug(
      'getUsage(%s, %d, %s) returned tokens: %d, calls: %d',
      provider,
      keyIndex,
      window.type,
      usage.totalTokens,
      usage.callCount,
    );

    return usage;
  }

  /**
   * Reset usage for a key within a time window
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async reset(provider: string, keyIndex: number, window: TimeWindow): Promise<void> {
    this.ensureOpen();

    const key = this.makeKey(provider, keyIndex, window);
    const deleted = this.data.delete(key);
    this.callCounts.delete(key);

    debug('reset(%s, %d, %s) deleted: %s', provider, keyIndex, window.type, deleted);
  }

  /**
   * Reset all usage data, optionally filtered by provider and/or key
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async resetAll(provider?: string, keyIndex?: number): Promise<void> {
    this.ensureOpen();

    if (!provider) {
      // Clear everything
      this.data.clear();
      this.callCounts.clear();
      debug('resetAll() cleared all data');
      return;
    }

    const prefix = keyIndex !== undefined ? `${provider}:${keyIndex}:` : `${provider}:`;

    // Delete entries matching the prefix
    let deletedCount = 0;
    for (const key of this.data.keys()) {
      if (key.startsWith(prefix)) {
        this.data.delete(key);
        this.callCounts.delete(key);
        deletedCount++;
      }
    }

    debug('resetAll(%s, %s) deleted %d entries', provider, keyIndex, deletedCount);
  }

  /**
   * Close storage and clear all data
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async close(): Promise<void> {
    this.closed = true;
    this.data.clear();
    this.callCounts.clear();
    debug('MemoryStorage closed');
  }
}
