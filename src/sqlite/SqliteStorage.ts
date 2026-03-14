import type BetterSqlite3 from 'better-sqlite3';
import debugFactory from 'debug';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { StorageBackend, StructuredUsage } from '../types/interfaces.js';
import type { TimeWindow, UsageRecord } from '../types/domain.js';
import { LLMRouterError } from '../errors/base.js';
import { getPeriodKey } from '../usage/periods.js';
import { getDefaultDbPath } from './paths.js';
import { migrate } from './migrations.js';

type Database = BetterSqlite3.Database;
type Statement = BetterSqlite3.Statement;

const debug = debugFactory('llm-router:sqlite');

/**
 * Duration constants for reconstructing TimeWindow from stored window_type
 */
const DURATION_MAP: Record<string, number> = {
  'per-minute': 60_000,
  hourly: 3_600_000,
  daily: 86_400_000,
  monthly: 2_592_000_000,
  'rolling-30d': 2_592_000_000,
};

export interface SqliteStorageOptions {
  /** Path to SQLite database file. Defaults to XDG data directory. */
  path?: string;
}

interface CounterRow {
  provider: string;
  key_index: number;
  window_type: string;
  period_key: string;
  prompt_tokens: number;
  completion_tokens: number;
  call_count: number;
  updated_at: number;
  record_id: string | null;
}

/**
 * SQLite-backed storage adapter for persistent usage tracking.
 * Uses better-sqlite3 for synchronous, high-performance access.
 *
 * Requires better-sqlite3 as a peer dependency:
 *   npm install better-sqlite3
 */
export class SqliteStorage implements StorageBackend {
  private db: Database | null;
  private closed: boolean;

  // Prepared statements
  private upsertStmt!: Statement;
  private putStmt!: Statement;
  private getByCompositeStmt!: Statement;
  private getUsageStmt!: Statement;
  private getByProviderStmt!: Statement;
  private resetStmt!: Statement;
  private resetAllStmt!: Statement;
  private resetByProviderStmt!: Statement;
  private resetByProviderKeyStmt!: Statement;
  private cleanupStmt!: Statement;

  private constructor(db: Database) {
    this.db = db;
    this.closed = false;
    this.prepareStatements(db);
  }

  /**
   * Create a new SqliteStorage instance.
   * Dynamically imports better-sqlite3 to avoid hard dependency.
   */
  static async create(options?: SqliteStorageOptions): Promise<SqliteStorage> {
    let Sqlite3Constructor: typeof BetterSqlite3;
    try {
      const mod = await import('better-sqlite3');
      Sqlite3Constructor = mod.default;
    } catch {
      throw new LLMRouterError(
        'better-sqlite3 is required for SqliteStorage. Install it: npm install better-sqlite3',
        { code: 'MISSING_PEER_DEPENDENCY' },
      );
    }

    const dbPath = options?.path ?? getDefaultDbPath();
    debug('Opening database at %s', dbPath);

    // Ensure parent directory exists
    mkdirSync(dirname(dbPath), { recursive: true });

    const db = new Sqlite3Constructor(dbPath);

    // Enable WAL mode for concurrent read performance
    db.pragma('journal_mode = WAL');

    // Run migrations
    migrate(db);

    debug('Database ready (WAL mode, schema v1)');
    return new SqliteStorage(db);
  }

  private prepareStatements(db: Database): void {
    this.upsertStmt = db.prepare(`
      INSERT INTO usage_counters (provider, key_index, window_type, period_key, prompt_tokens, completion_tokens, call_count, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (provider, key_index, window_type, period_key) DO UPDATE SET
        prompt_tokens = prompt_tokens + excluded.prompt_tokens,
        completion_tokens = completion_tokens + excluded.completion_tokens,
        call_count = call_count + excluded.call_count,
        updated_at = excluded.updated_at
    `);

    this.putStmt = db.prepare(`
      INSERT INTO usage_counters (provider, key_index, window_type, period_key, prompt_tokens, completion_tokens, call_count, updated_at, record_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (provider, key_index, window_type, period_key) DO UPDATE SET
        prompt_tokens = excluded.prompt_tokens,
        completion_tokens = excluded.completion_tokens,
        call_count = excluded.call_count,
        updated_at = excluded.updated_at,
        record_id = excluded.record_id
    `);

    this.getByCompositeStmt = db.prepare(
      'SELECT * FROM usage_counters WHERE provider = ? AND key_index = ? AND window_type = ? AND period_key = ?',
    );

    this.getUsageStmt = db.prepare(
      'SELECT prompt_tokens, completion_tokens, call_count FROM usage_counters WHERE provider = ? AND key_index = ? AND window_type = ? AND period_key = ?',
    );

    this.getByProviderStmt = db.prepare('SELECT * FROM usage_counters WHERE provider = ?');

    this.resetStmt = db.prepare(
      'DELETE FROM usage_counters WHERE provider = ? AND key_index = ? AND window_type = ? AND period_key = ?',
    );

    this.resetAllStmt = db.prepare('DELETE FROM usage_counters');

    this.resetByProviderStmt = db.prepare('DELETE FROM usage_counters WHERE provider = ?');

    this.resetByProviderKeyStmt = db.prepare(
      'DELETE FROM usage_counters WHERE provider = ? AND key_index = ?',
    );

    this.cleanupStmt = db.prepare(
      'DELETE FROM usage_counters WHERE window_type = ? AND period_key < ?',
    );
  }

  private ensureOpen(): void {
    if (this.closed) {
      throw new LLMRouterError('Storage backend is closed', { code: 'STORAGE_CLOSED' });
    }
  }

  /**
   * Clean up expired rows for a given window type.
   * Rows with period_key less than the current period are expired.
   */
  private cleanupExpired(window: TimeWindow): void {
    const currentPeriodKey = getPeriodKey(window, Date.now());
    this.cleanupStmt.run(window.type, currentPeriodKey);
  }

  /**
   * Build a deterministic ID from the composite key
   */
  private makeId(
    provider: string,
    keyIndex: number,
    windowType: string,
    periodKey: string,
  ): string {
    return `${provider}:${keyIndex}:${windowType}:${periodKey}`;
  }

  /**
   * Reconstruct a TimeWindow from a stored window_type string
   */
  private windowFromType(windowType: string): TimeWindow {
    const durationMs = DURATION_MAP[windowType];
    if (durationMs === undefined) {
      throw new LLMRouterError(`Unknown window type in database: ${windowType}`, {
        code: 'INVALID_WINDOW_TYPE',
      });
    }
    return { type: windowType as TimeWindow['type'], durationMs };
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async increment(
    provider: string,
    keyIndex: number,
    tokens: { prompt: number; completion: number },
    window: TimeWindow,
    callCount?: number,
  ): Promise<UsageRecord> {
    this.ensureOpen();
    this.cleanupExpired(window);

    const periodKey = getPeriodKey(window, Date.now());
    const now = Date.now();

    this.upsertStmt.run(
      provider,
      keyIndex,
      window.type,
      periodKey,
      tokens.prompt,
      tokens.completion,
      callCount ?? 0,
      now,
    );

    // Read back updated values
    const row = this.getByCompositeStmt.get(
      provider,
      keyIndex,
      window.type,
      periodKey,
    ) as CounterRow;

    const id = this.makeId(provider, keyIndex, window.type, periodKey);

    debug(
      'increment() key=%s prompt=+%d completion=+%d total=%d',
      id,
      tokens.prompt,
      tokens.completion,
      Number(row.prompt_tokens) + Number(row.completion_tokens),
    );

    return {
      id,
      provider,
      keyIndex,
      promptTokens: Number(row.prompt_tokens),
      completionTokens: Number(row.completion_tokens),
      totalTokens: Number(row.prompt_tokens) + Number(row.completion_tokens),
      timestamp: Number(row.updated_at),
      window,
      estimated: false,
    };
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async getUsage(provider: string, keyIndex: number, window: TimeWindow): Promise<StructuredUsage> {
    this.ensureOpen();

    const periodKey = getPeriodKey(window, Date.now());
    const row = this.getUsageStmt.get(provider, keyIndex, window.type, periodKey) as
      | { prompt_tokens: number; completion_tokens: number; call_count: number }
      | undefined;

    if (!row) {
      return { promptTokens: 0, completionTokens: 0, totalTokens: 0, callCount: 0 };
    }

    const promptTokens = Number(row.prompt_tokens) || 0;
    const completionTokens = Number(row.completion_tokens) || 0;

    return {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      callCount: Number(row.call_count) || 0,
    };
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async get(key: string): Promise<UsageRecord[]> {
    this.ensureOpen();

    const rows = this.getByProviderStmt.all(key) as CounterRow[];

    return rows.map((row) => ({
      id:
        row.record_id ?? this.makeId(row.provider, row.key_index, row.window_type, row.period_key),
      provider: row.provider,
      keyIndex: Number(row.key_index),
      promptTokens: Number(row.prompt_tokens),
      completionTokens: Number(row.completion_tokens),
      totalTokens: Number(row.prompt_tokens) + Number(row.completion_tokens),
      timestamp: Number(row.updated_at),
      window: this.windowFromType(row.window_type),
      estimated: false,
    }));
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async put(record: UsageRecord): Promise<void> {
    this.ensureOpen();

    const periodKey = getPeriodKey(record.window, record.timestamp);

    // Use REPLACE semantics (not additive) via putStmt, preserving original record ID
    this.putStmt.run(
      record.provider,
      record.keyIndex,
      record.window.type,
      periodKey,
      record.promptTokens,
      record.completionTokens,
      0, // call_count not tracked in put
      record.timestamp,
      record.id,
    );
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async reset(provider: string, keyIndex: number, window: TimeWindow): Promise<void> {
    this.ensureOpen();

    const periodKey = getPeriodKey(window, Date.now());
    this.resetStmt.run(provider, keyIndex, window.type, periodKey);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async resetAll(provider?: string, keyIndex?: number): Promise<void> {
    this.ensureOpen();

    if (provider === undefined) {
      this.resetAllStmt.run();
      return;
    }

    if (keyIndex === undefined) {
      this.resetByProviderStmt.run(provider);
      return;
    }

    this.resetByProviderKeyStmt.run(provider, keyIndex);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;

    if (this.db) {
      this.db.close();
      this.db = null;
    }

    debug('SqliteStorage closed');
  }
}
