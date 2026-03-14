---
phase: 10-sqlite-redis-advanced-features
plan: 01
subsystem: database
tags: [sqlite, better-sqlite3, storage, persistence, WAL, XDG]

# Dependency graph
requires:
  - phase: 02-storage-contract
    provides: StorageBackend interface and contract tests
  - phase: 04-usage-tracking
    provides: getPeriodKey() for composite key generation
provides:
  - SqliteStorage implementing StorageBackend with persistent SQLite storage
  - XDG-aware default database paths (macOS/Linux/Windows)
  - Schema migration framework with version tracking
affects: [10-02, 10-03, 11-registry-defaults, 12-cli-playground]

# Tech tracking
tech-stack:
  added: [better-sqlite3, @types/better-sqlite3]
  patterns: [dynamic peer dependency import, prepared statement caching, WAL mode, lazy expiration cleanup, record_id preservation]

key-files:
  created:
    - src/sqlite/SqliteStorage.ts
    - src/sqlite/migrations.ts
    - src/sqlite/paths.ts
    - src/sqlite/index.ts
    - src/sqlite/SqliteStorage.test.ts
  modified:
    - package.json
    - package-lock.json

key-decisions:
  - "Dynamic import of better-sqlite3 with LLMRouterError on missing peer dep"
  - "record_id column added to preserve original IDs from put() in get() round-trip"
  - "better-sqlite3 installed as dev dependency (peer dep for consumers)"

patterns-established:
  - "Dynamic peer dependency import: try/catch around import() with clear MISSING_PEER_DEPENDENCY error"
  - "Prepared statement caching: all SQL queries prepared once in constructor, reused per operation"
  - "Composite primary key for usage counters: (provider, key_index, window_type, period_key)"

requirements-completed: [USAGE-02]

# Metrics
duration: 20m
completed: 2026-03-14
---

# Phase 10 Plan 01: SQLite Storage Summary

**SqliteStorage implementing StorageBackend with better-sqlite3, WAL mode, XDG paths, auto-migration, and lazy cleanup passing all 10 contract tests**

## Performance

- **Duration:** 20 min
- **Started:** 2026-03-14T16:23:25Z
- **Completed:** 2026-03-14T16:44:16Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- SqliteStorage class implementing all 7 StorageBackend methods with synchronous better-sqlite3
- All 10 contract tests pass including increment atomicity, deterministic IDs, close guards, and put/get round-trip
- XDG-aware default paths for macOS (Application Support), Linux ($XDG_DATA_HOME), Windows (%APPDATA%)
- WAL mode enabled, schema auto-migration with version tracking, lazy expired row cleanup

## Task Commits

Each task was committed atomically:

1. **Task 1: Create SQLite paths, migrations, and SqliteStorage class** - `b733e17` (feat)
2. **Task 2: Install better-sqlite3 dev dependency and run contract tests** - `e222471` (test)

## Files Created/Modified

- `src/sqlite/SqliteStorage.ts` - StorageBackend implementation using better-sqlite3 with prepared statements
- `src/sqlite/migrations.ts` - Schema DDL and forward-only migration with version tracking
- `src/sqlite/paths.ts` - XDG data directory resolution for macOS, Linux, Windows
- `src/sqlite/index.ts` - Barrel export for SqliteStorage and SqliteStorageOptions
- `src/sqlite/SqliteStorage.test.ts` - Contract test runner using temp directories
- `package.json` - Added better-sqlite3 and @types/better-sqlite3 as dev dependencies

## Decisions Made

- **Dynamic peer dep import:** better-sqlite3 is dynamically imported in `create()` factory with clear `MISSING_PEER_DEPENDENCY` error when not installed. This avoids hard dependency -- users who don't need SQLite don't need to install it.
- **record_id column:** Added nullable `record_id TEXT` column to preserve original record IDs from `put()` operations. Without this, `get()` would generate composite-key IDs that don't match the original UUID, failing contract test 10.
- **Installed better-sqlite3 in Task 1:** Plan specified Task 2 for installation, but Task 1's verification (`tsc --noEmit`) requires the type declarations. Installed early as Rule 3 auto-fix.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed better-sqlite3 in Task 1 instead of Task 2**

- **Found during:** Task 1 (TypeScript compilation verification)
- **Issue:** `tsc --noEmit` fails without `@types/better-sqlite3` installed, but plan defers installation to Task 2
- **Fix:** Installed `better-sqlite3` and `@types/better-sqlite3` as dev dependencies during Task 1
- **Files modified:** package.json, package-lock.json
- **Verification:** `tsc --noEmit` passes for all sqlite files
- **Committed in:** b733e17 (Task 1 commit)

**2. [Rule 1 - Bug] Added record_id column for put/get round-trip**

- **Found during:** Task 2 (contract test 10 failure)
- **Issue:** `get()` reconstructed IDs from composite key, not matching original UUID from `put()`
- **Fix:** Added `record_id TEXT` column to schema, `put()` stores original ID, `get()` returns it
- **Files modified:** src/sqlite/migrations.ts, src/sqlite/SqliteStorage.ts
- **Verification:** All 10 contract tests pass
- **Committed in:** e222471 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered

- Pre-existing `tests/config.test.ts` timeout failure ("loads config from file path") confirmed unrelated to our changes
- Pre-existing type errors in `src/redis/RedisStorage.ts` (uncommitted Phase 10 Plan 02 WIP) -- not our concern

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- SqliteStorage ready for use as persistent storage backend
- `./sqlite` subpath export can be added when package.json exports are updated (Phase 10 Plan 03)
- Redis storage adapter (Plan 02) can follow same contract test pattern

## Self-Check: PASSED

- All 5 created files verified on disk
- Commit b733e17 verified in git log
- Commit e222471 verified in git log
- All 10 contract tests pass
- No regressions in full test suite (1 pre-existing timeout failure)

---

_Phase: 10-sqlite-redis-advanced-features_
_Completed: 2026-03-14_
