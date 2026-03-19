# Phase 21: Build & Docs - Research

**Researched:** 2026-03-19
**Domain:** TypeScript build hygiene, resource cleanup, SQLite migration safety, documentation accuracy
**Confidence:** HIGH

## Summary

Phase 21 addresses four independent hardening issues: a TypeScript compilation error caused by test files importing outside `rootDir`, missing resource cleanup in `router.close()`, an inaccurate dependency claim in README, and unwrapped SQLite migrations. All four issues are well-scoped, localized, and have straightforward fixes.

The tsc error is caused by three `.test.ts` files inside `src/` importing from `tests/contracts/storage.contract.ts` which is outside the configured `rootDir: "./src"`. The close() method only calls `catalog.close()` and `storage.close()` but does not remove EventEmitter listeners or detach the DebugLogger. The README claims "Zero runtime dependencies beyond peer deps" but package.json lists 5 production dependencies. SQLite migrations execute multiple DDL statements without a transaction wrapper.

**Primary recommendation:** Fix each issue independently -- they have no interdependencies.

<phase_requirements>

## Phase Requirements

| ID       | Description                                                       | Research Support                                                                                                                                                                              |
| -------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BUILD-01 | `tsc --noEmit` passes (fix rootDir import from test files)        | Three test files in `src/` import `../../tests/contracts/storage.contract.ts`. Fix by either moving contract to `src/`, adding tsconfig exclusion, or creating a separate tsconfig for tests. |
| BUILD-02 | `router.close()` cleans up EventEmitter listeners and DebugLogger | Current `close()` only calls `catalog.close()` and `storage.close()`. Must also call `emitter.removeAllListeners()` and `debugLogger.detach()`.                                               |
| BUILD-03 | README dependency count corrected (5 deps, not 3)                 | README says "Zero runtime dependencies beyond peer deps". Actual production deps: `@ai-sdk/provider`, `debug`, `jiti`, `nanospinner`, `zod`.                                                  |
| BUILD-04 | SQLite migrations wrapped in transactions for crash safety        | `src/sqlite/migrations.ts` runs CREATE TABLE + INSERT without a transaction. `better-sqlite3` provides `db.transaction()` for this.                                                           |

</phase_requirements>

## Standard Stack

No new libraries needed. All fixes use existing project dependencies.

### Core (already in project)

| Library        | Version | Purpose        | Relevant To |
| -------------- | ------- | -------------- | ----------- |
| typescript     | ^5.7.2  | Compiler       | BUILD-01    |
| better-sqlite3 | ^12.8.0 | SQLite adapter | BUILD-04    |

## Architecture Patterns

### BUILD-01: tsc rootDir violation

**Current state:** `tsconfig.json` sets `rootDir: "./src"` and `include: ["src/**/*"]`. Three test files inside `src/` import from `tests/contracts/storage.contract.ts`:

- `src/redis/RedisStorage.test.ts`
- `src/sqlite/SqliteStorage.test.ts`
- `src/storage/MemoryStorage.test.ts`

**Recommended fix:** Exclude test files from the build compilation. Options (in order of preference):

1. **Add `tsconfig.build.json`** that extends base tsconfig and adds `"exclude": ["src/**/*.test.ts"]`. Update `npm run typecheck` to use `tsconfig.build.json`. This is the standard TypeScript pattern for separating build from test compilation.

2. **Move test files out of `src/`** into `tests/` directory. More disruptive, changes import paths.

3. **Move `storage.contract.ts` into `src/`**. Conceptually wrong -- test contracts belong in test directory.

**Best approach:** Option 1. Create `tsconfig.build.json`:

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "dist", "tests", "src/**/*.test.ts"]
}
```

Update `package.json` scripts:

```json
"typecheck": "tsc --noEmit -p tsconfig.build.json",
"build": "tsup"
```

Note: `tsup` uses its own compilation, so it is unaffected. The `tsc --noEmit` command is the one that fails. Vitest has its own tsconfig handling and will continue to find test files.

### BUILD-02: router.close() resource cleanup

**Current state** (`src/config/index.ts` lines 478-482):

```typescript
close: async () => {
  debug('Closing router');
  await catalog.close();
  await storage.close();
},
```

**Missing cleanup:**

1. **EventEmitter listeners** -- The `emitter` created at line 148 accumulates listeners from:
   - `createHook()` calls (14 typed hooks at lines 490-504)
   - Direct `emitter.on(RouterEvent.REQUEST_COMPLETE, ...)` at line 218 (credit consumption)
   - Any user-registered `router.on(...)` calls

2. **DebugLogger** -- Created conditionally at lines 514-517, `debugLogger.attach(router)` registers ~10 hook subscriptions via `onKeySelected`, `onFallbackTriggered`, etc. The `debugLogger` variable is scoped inside the conditional block and not accessible in `close()`.

**Recommended fix:**

```typescript
// Hoist debugLogger reference to closure scope
let debugLogger: DebugLogger | null = null;

// ... later in the conditional:
if (shouldDebug) {
  debugLogger = new DebugLogger();
  debugLogger.attach(routerImpl);
}

// In close():
close: async () => {
  debug('Closing router');
  if (debugLogger) {
    debugLogger.detach();
  }
  emitter.removeAllListeners();
  await catalog.close();
  await storage.close();
},
```

**Order matters:** Detach debugLogger first (uses individual `off()` calls), then remove all listeners (bulk cleanup), then close storage backends.

**HealthScorer:** No intervals or timers -- purely in-memory maps. No cleanup needed.

**CooldownManager / UsageTracker:** No intervals or timers found in codebase (`setInterval` only appears in CLI timeout code). No cleanup needed.

### BUILD-03: README dependency claim

**Current state:** README line 31 says:

> "Works with Vercel AI SDK. Zero runtime dependencies beyond peer deps."

**Actual production dependencies** (from `package.json` `dependencies` field):
| Package | Version | Purpose |
|---------|---------|---------|
| `@ai-sdk/provider` | ^3.0.0 | AI SDK provider types |
| `debug` | ^4.3.0 | Debug logging |
| `jiti` | ^2.6.1 | Config file loading (TypeScript/ESM) |
| `nanospinner` | ^1.2.2 | CLI spinner |
| `zod` | ^3.23.0 | Config validation |

**Recommended fix:** Replace the claim with accurate text:

```
Works with [Vercel AI SDK](https://sdk.vercel.ai/). 5 runtime dependencies — `@ai-sdk/provider`, `debug`, `jiti`, `nanospinner`, `zod`.
```

### BUILD-04: SQLite migration transaction safety

**Current state** (`src/sqlite/migrations.ts`):

```typescript
export function migrate(db: BetterSqlite3.Database): void {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_info (...)`);
  const row = db.prepare('SELECT MAX(version) AS version FROM schema_info').get();
  const currentVersion = row?.version ?? 0;
  if (currentVersion < 1) {
    db.exec(`CREATE TABLE IF NOT EXISTS usage_counters (...)`);
    db.prepare('INSERT INTO schema_info (version, migrated_at) VALUES (?, ?)').run(1, Date.now());
  }
}
```

**Problem:** If the process crashes between `CREATE TABLE usage_counters` and the `INSERT INTO schema_info`, the table exists but the version record does not. Next startup would try to re-create the table (harmless due to `IF NOT EXISTS`) but the pattern breaks for future migrations that alter existing tables.

**Recommended fix:** Use `better-sqlite3`'s synchronous transaction API:

```typescript
export function migrate(db: BetterSqlite3.Database): void {
  // schema_info must exist before we can check version
  db.exec(`CREATE TABLE IF NOT EXISTS schema_info (...)`);

  const row = db.prepare('SELECT MAX(version) AS version FROM schema_info').get();
  const currentVersion = row?.version ?? 0;

  if (currentVersion < 1) {
    const runMigration = db.transaction(() => {
      db.exec(`CREATE TABLE IF NOT EXISTS usage_counters (...)`);
      db.prepare('INSERT INTO schema_info (version, migrated_at) VALUES (?, ?)').run(1, Date.now());
    });
    runMigration();
  }
}
```

**Key detail:** `better-sqlite3`'s `db.transaction()` returns a function that wraps the callback in `BEGIN`/`COMMIT` with automatic `ROLLBACK` on exception. This is synchronous and idiomatic for `better-sqlite3`. Source: better-sqlite3 documentation -- `db.transaction(fn)` is the recommended approach (not manual `BEGIN`/`COMMIT`).

**Note on DDL in transactions:** SQLite supports transactional DDL (CREATE TABLE, ALTER TABLE). Unlike some databases, DDL in SQLite is fully transactional, so wrapping CREATE TABLE in a transaction is safe and correct.

## Don't Hand-Roll

| Problem              | Don't Build                  | Use Instead                            | Why                                         |
| -------------------- | ---------------------------- | -------------------------------------- | ------------------------------------------- |
| Transaction wrapping | Manual BEGIN/COMMIT/ROLLBACK | `db.transaction()` from better-sqlite3 | Handles rollback on exception automatically |
| Test file exclusion  | Complex tsconfig rewriting   | `tsconfig.build.json` extends pattern  | Standard TypeScript project pattern         |

## Common Pitfalls

### Pitfall 1: removeAllListeners() ordering

**What goes wrong:** Calling `emitter.removeAllListeners()` before detaching DebugLogger means `debugLogger.detach()` calls `emitter.off()` on already-removed listeners (no-ops but wasteful).
**How to avoid:** Detach DebugLogger first, then removeAllListeners.

### Pitfall 2: tsconfig.build.json not used by tsup

**What goes wrong:** Assuming tsup reads tsconfig.build.json -- it does not by default.
**How to avoid:** Only update the `typecheck` script. tsup has its own config (`tsup.config.ts` or `package.json`). Verify tsup still builds correctly after changes.

### Pitfall 3: schema_info table itself needs to exist before transaction

**What goes wrong:** Putting `CREATE TABLE schema_info` inside the migration transaction -- but you need to query it first to determine the current version.
**How to avoid:** Keep `CREATE TABLE IF NOT EXISTS schema_info` outside the transaction, only wrap the versioned migration steps.

### Pitfall 4: Forgetting credit tracker's emitter.on listener

**What goes wrong:** `close()` removes emitter listeners but the `REQUEST_COMPLETE` handler (line 218) captures `creditTracker` in closure. If `removeAllListeners()` is called, this is cleaned up. But if selectively removing listeners, this one could be missed.
**How to avoid:** Use `emitter.removeAllListeners()` for complete cleanup rather than trying to track individual listeners.

## Code Examples

### better-sqlite3 transaction wrapping

```typescript
// Source: better-sqlite3 API documentation
const runMigrationV1 = db.transaction(() => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS usage_counters (
      provider TEXT NOT NULL,
      key_index INTEGER NOT NULL,
      -- ... columns ...
      PRIMARY KEY (provider, key_index, window_type, period_key)
    )
  `);
  db.prepare('INSERT INTO schema_info (version, migrated_at) VALUES (?, ?)').run(1, Date.now());
});
runMigrationV1();
```

### tsconfig.build.json pattern

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "dist", "tests", "src/**/*.test.ts"]
}
```

### EventEmitter cleanup

```typescript
// Node.js EventEmitter API
emitter.removeAllListeners(); // Removes all listeners for all events
```

## Validation Architecture

### Test Framework

| Property           | Value                                   |
| ------------------ | --------------------------------------- | --------- |
| Framework          | vitest 2.1.8                            |
| Config file        | vitest uses tsconfig.json (default)     |
| Quick run command  | `npx vitest run --reporter=verbose 2>&1 | tail -20` |
| Full suite command | `npm run test`                          |

### Phase Requirements -> Test Map

| Req ID   | Behavior                    | Test Type   | Automated Command                                                | File Exists?         |
| -------- | --------------------------- | ----------- | ---------------------------------------------------------------- | -------------------- |
| BUILD-01 | tsc --noEmit exits 0        | smoke       | `npx tsc --noEmit -p tsconfig.build.json`                        | N/A (compiler check) |
| BUILD-02 | close() removes listeners   | manual-only | Verify by code inspection -- emitter.removeAllListeners() called | N/A                  |
| BUILD-03 | README accuracy             | manual-only | Verify README text matches package.json dependencies             | N/A                  |
| BUILD-04 | Migrations use transactions | smoke       | `npx tsc --noEmit -p tsconfig.build.json` (compiles)             | N/A                  |

**Justification for manual-only:** Per CLAUDE.md, tests are deferred. BUILD-01 and BUILD-04 are verified by compilation and code inspection. BUILD-02 and BUILD-03 are documentation/cleanup tasks.

### Sampling Rate

- **Per task commit:** `npx tsc --noEmit -p tsconfig.build.json`
- **Per wave merge:** `npm run test`
- **Phase gate:** `tsc --noEmit` exits 0

### Wave 0 Gaps

None -- no new test infrastructure needed. Verification is via `tsc --noEmit` and code review.

## Sources

### Primary (HIGH confidence)

- Direct codebase inspection of `tsconfig.json`, `src/config/index.ts`, `src/sqlite/migrations.ts`, `src/debug/DebugLogger.ts`, `README.md`, `package.json`
- `tsc --noEmit` output confirming exact error (rootDir violation from 3 test files)

### Secondary (MEDIUM confidence)

- better-sqlite3 `db.transaction()` API -- well-established, widely documented
- SQLite transactional DDL support -- well-known SQLite feature

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - no new dependencies, all existing
- Architecture: HIGH - all four issues directly observed in codebase with clear fixes
- Pitfalls: HIGH - pitfalls derived from actual code structure

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable -- no external dependency changes)
