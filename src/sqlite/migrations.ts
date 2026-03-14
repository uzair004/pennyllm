import type BetterSqlite3 from 'better-sqlite3';

export const SCHEMA_VERSION = 1;

/**
 * Run forward-only migrations on the database.
 * Creates schema_info and usage_counters tables if they don't exist.
 */
export function migrate(db: BetterSqlite3.Database): void {
  // Create schema_info table for version tracking
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_info (
      version INTEGER NOT NULL,
      migrated_at INTEGER NOT NULL
    )
  `);

  // Check current version
  const row = db.prepare('SELECT MAX(version) AS version FROM schema_info').get() as
    | { version: number | null }
    | undefined;
  const currentVersion = row?.version ?? 0;

  if (currentVersion < 1) {
    // Version 1: Create usage_counters table
    db.exec(`
      CREATE TABLE IF NOT EXISTS usage_counters (
        provider TEXT NOT NULL,
        key_index INTEGER NOT NULL,
        window_type TEXT NOT NULL,
        period_key TEXT NOT NULL,
        prompt_tokens INTEGER NOT NULL DEFAULT 0,
        completion_tokens INTEGER NOT NULL DEFAULT 0,
        call_count INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (provider, key_index, window_type, period_key)
      )
    `);

    // Record migration
    db.prepare('INSERT INTO schema_info (version, migrated_at) VALUES (?, ?)').run(1, Date.now());
  }

  // Future migrations go here:
  // if (currentVersion < 2) { ... }
}
