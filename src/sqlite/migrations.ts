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
    // Version 1: Create usage_counters table (wrapped in transaction for crash safety)
    const migrateV1 = db.transaction(() => {
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
          record_id TEXT,
          PRIMARY KEY (provider, key_index, window_type, period_key)
        )
      `);

      db.prepare('INSERT INTO schema_info (version, migrated_at) VALUES (?, ?)').run(1, Date.now());
    });
    migrateV1();
  }

  // Future migrations go here (use same db.transaction() pattern):
  // if (currentVersion < 2) {
  //   const migrateV2 = db.transaction(() => { ... });
  //   migrateV2();
  // }
}
