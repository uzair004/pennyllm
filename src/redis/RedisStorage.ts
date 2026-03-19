import type Redis from 'ioredis';
import type { RedisOptions } from 'ioredis';
import debugFactory from 'debug';
import type { StorageBackend, StructuredUsage } from '../types/interfaces.js';
import type { TimeWindow, UsageRecord } from '../types/domain.js';
import { PennyLLMError } from '../errors/base.js';
import { getPeriodKey } from '../usage/periods.js';

const debug = debugFactory('pennyllm:redis');

/**
 * Configuration options for RedisStorage
 */
export interface RedisStorageOptions {
  /** Redis connection URL (redis://...) or ioredis options object */
  connection: string | Record<string, unknown>;
  /** Key prefix for all Redis keys (default: 'pennyllm:') */
  prefix?: string;
}

/**
 * Map window type strings back to durationMs values for reconstructing TimeWindow
 */
const WINDOW_DURATION_MS: Record<TimeWindow['type'], number> = {
  'per-minute': 60_000,
  hourly: 3_600_000,
  daily: 86_400_000,
  monthly: 2_592_000_000,
  'rolling-30d': 2_592_000_000,
  lifetime: 100 * 365 * 24 * 60 * 60 * 1000,
};

/**
 * Redis storage backend implementation using ioredis.
 * Provides persistent, multi-process safe usage tracking via atomic HINCRBY pipelines.
 */
export class RedisStorage implements StorageBackend {
  private readonly client: Redis;
  private readonly prefix: string;
  private closed: boolean = false;

  private constructor(client: Redis, prefix: string) {
    this.client = client;
    this.prefix = prefix;
  }

  /**
   * Create a new RedisStorage instance.
   * Dynamically imports ioredis to avoid hard dependency.
   */
  static async create(options: RedisStorageOptions): Promise<RedisStorage> {
    let IoRedis: typeof Redis;
    try {
      const mod = await import('ioredis');
      IoRedis = mod.default;
    } catch {
      throw new PennyLLMError(
        'ioredis is required for RedisStorage. Install it: npm install ioredis',
        { code: 'MISSING_PEER_DEPENDENCY' },
      );
    }

    const prefix = options.prefix ?? 'pennyllm:';

    const client =
      typeof options.connection === 'string'
        ? new IoRedis(options.connection)
        : new IoRedis(options.connection as RedisOptions);

    // Wait for connection readiness
    if (client.status === 'ready') {
      debug('Redis client already ready');
    } else {
      await new Promise<void>((resolve, reject) => {
        client.once('ready', () => resolve());
        client.once('error', (err: Error) =>
          reject(
            new PennyLLMError('Redis connection failed: ' + err.message, {
              code: 'REDIS_CONNECTION_ERROR',
              cause: err,
            }),
          ),
        );
      });
    }

    debug('RedisStorage connected with prefix: %s', prefix);
    return new RedisStorage(client, prefix);
  }

  /**
   * Build a Redis key from components
   */
  private makeKey(
    provider: string,
    keyIndex: number,
    windowType: string,
    periodKey: string,
  ): string {
    return `${this.prefix}${provider}:${keyIndex}:${windowType}:${periodKey}`;
  }

  /**
   * Get TTL in seconds for a given time window (2x safety margin)
   */
  private getTtlForWindow(window: TimeWindow): number {
    switch (window.type) {
      case 'per-minute':
        return 120; // 2 minutes
      case 'hourly':
        return 7200; // 2 hours
      case 'daily':
        return 172800; // 2 days
      case 'monthly':
        return 5184000; // 60 days
      case 'rolling-30d':
        return 172800; // 2 days (per daily bucket)
      case 'lifetime':
        return 100 * 365 * 24 * 60 * 60; // ~100 years in seconds
      default: {
        const _exhaustive: never = window.type;
        throw new PennyLLMError(`Unknown window type: ${String(_exhaustive)}`, {
          code: 'INVALID_WINDOW_TYPE',
        });
      }
    }
  }

  /**
   * Throw if storage is closed
   */
  private ensureOpen(): void {
    if (this.closed) {
      throw new PennyLLMError('Storage backend is closed', { code: 'STORAGE_CLOSED' });
    }
  }

  /**
   * Parse a Redis key back into its components
   */
  private parseKey(
    redisKey: string,
  ): { provider: string; keyIndex: number; windowType: string; periodKey: string } | null {
    // Key format: {prefix}{provider}:{keyIndex}:{windowType}:{periodKey}
    const withoutPrefix = redisKey.slice(this.prefix.length);
    const parts = withoutPrefix.split(':');
    // At minimum: provider, keyIndex, windowType, periodKey (4 parts)
    // But periodKey can contain colons (e.g. YYYY-MM-DDTHH)
    if (parts.length < 4) return null;
    const provider = parts[0]!;
    const keyIndex = Number(parts[1]);
    const windowType = parts[2]!;
    const periodKey = parts.slice(3).join(':');
    if (isNaN(keyIndex)) return null;
    return { provider, keyIndex, windowType, periodKey };
  }

  async increment(
    provider: string,
    keyIndex: number,
    tokens: { prompt: number; completion: number },
    window: TimeWindow,
    callCount?: number,
  ): Promise<UsageRecord> {
    this.ensureOpen();

    const periodKey = getPeriodKey(window, Date.now());
    const key = this.makeKey(provider, keyIndex, window.type, periodKey);
    const ttlSeconds = this.getTtlForWindow(window);

    const pipeline = this.client.pipeline();
    pipeline.hincrby(key, 'prompt_tokens', tokens.prompt);
    pipeline.hincrby(key, 'completion_tokens', tokens.completion);
    pipeline.hincrby(key, 'call_count', callCount ?? 0);
    pipeline.expire(key, ttlSeconds);

    const results = await pipeline.exec();
    if (!results) {
      throw new PennyLLMError('Redis pipeline returned null', { code: 'REDIS_ERROR' });
    }

    // Pipeline exec returns [[error, result], ...] for each command
    const promptTokens = Number(results[0]?.[1]) || 0;
    const completionTokens = Number(results[1]?.[1]) || 0;

    debug(
      'increment(%s, %d, %s) prompt: %d, completion: %d, calls: +%d',
      provider,
      keyIndex,
      window.type,
      promptTokens,
      completionTokens,
      callCount ?? 0,
    );

    return {
      id: key,
      provider,
      keyIndex,
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      timestamp: Date.now(),
      window,
      estimated: false,
    };
  }

  async getUsage(provider: string, keyIndex: number, window: TimeWindow): Promise<StructuredUsage> {
    this.ensureOpen();

    const periodKey = getPeriodKey(window, Date.now());
    const key = this.makeKey(provider, keyIndex, window.type, periodKey);

    const fields = await this.client.hgetall(key);

    const promptTokens = Number(fields['prompt_tokens']) || 0;
    const completionTokens = Number(fields['completion_tokens']) || 0;
    const callCount = Number(fields['call_count']) || 0;

    debug(
      'getUsage(%s, %d, %s) tokens: %d, calls: %d',
      provider,
      keyIndex,
      window.type,
      promptTokens + completionTokens,
      callCount,
    );

    return {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      callCount,
    };
  }

  async get(key: string): Promise<UsageRecord[]> {
    this.ensureOpen();

    const pattern = `${this.prefix}${key}:*`;
    const keys = await this.scanKeys(pattern);
    const results: UsageRecord[] = [];

    for (const redisKey of keys) {
      const fields = await this.client.hgetall(redisKey);
      const parsed = this.parseKey(redisKey);
      if (!parsed) continue;

      const windowType = parsed.windowType as TimeWindow['type'];
      const durationMs = WINDOW_DURATION_MS[windowType];
      if (durationMs === undefined) continue;

      const promptTokens = Number(fields['prompt_tokens']) || 0;
      const completionTokens = Number(fields['completion_tokens']) || 0;

      results.push({
        id: redisKey,
        provider: parsed.provider,
        keyIndex: parsed.keyIndex,
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        timestamp: Date.now(),
        window: { type: windowType, durationMs },
        estimated: false,
      });
    }

    debug('get(%s) returned %d records', key, results.length);
    return results;
  }

  async put(record: UsageRecord): Promise<void> {
    this.ensureOpen();

    const periodKey = getPeriodKey(record.window, record.timestamp);
    const key = this.makeKey(record.provider, record.keyIndex, record.window.type, periodKey);
    const ttlSeconds = this.getTtlForWindow(record.window);

    const pipeline = this.client.pipeline();
    pipeline.hset(key, 'prompt_tokens', record.promptTokens.toString());
    pipeline.hset(key, 'completion_tokens', record.completionTokens.toString());
    pipeline.hset(key, 'call_count', '0');
    pipeline.expire(key, ttlSeconds);
    await pipeline.exec();

    debug('put() stored record with key: %s', key);
  }

  async reset(provider: string, keyIndex: number, window: TimeWindow): Promise<void> {
    this.ensureOpen();

    const periodKey = getPeriodKey(window, Date.now());
    const key = this.makeKey(provider, keyIndex, window.type, periodKey);
    await this.client.del(key);

    debug('reset(%s, %d, %s) deleted key', provider, keyIndex, window.type);
  }

  async resetAll(provider?: string, keyIndex?: number): Promise<void> {
    this.ensureOpen();

    let pattern: string;
    if (!provider) {
      pattern = `${this.prefix}*`;
    } else if (keyIndex === undefined) {
      pattern = `${this.prefix}${provider}:*`;
    } else {
      pattern = `${this.prefix}${provider}:${keyIndex}:*`;
    }

    const keys = await this.scanKeys(pattern);

    // Delete in batches of 100
    for (let i = 0; i < keys.length; i += 100) {
      const batch = keys.slice(i, i + 100);
      if (batch.length > 0) {
        await this.client.del(...batch);
      }
    }

    debug('resetAll(%s, %s) deleted %d keys', provider, keyIndex, keys.length);
  }

  async close(): Promise<void> {
    this.closed = true;
    await this.client.quit();
    debug('RedisStorage closed');
  }

  /**
   * Scan Redis keys matching a pattern using cursor-based iteration (non-blocking)
   */
  private async scanKeys(pattern: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor = '0';

    do {
      const [nextCursor, batch] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      keys.push(...batch);
    } while (cursor !== '0');

    return keys;
  }
}
