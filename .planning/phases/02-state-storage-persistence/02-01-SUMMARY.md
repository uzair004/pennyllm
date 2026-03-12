---
phase: 02-state-storage-persistence
plan: 01
subsystem: storage
tags: [storage, memory, config, contract-tests]
dependency_graph:
  requires: [phase-01]
  provides: [StorageBackend-interface, MemoryStorage-default, storage-contract-tests]
  affects: [config-schema, createRouter-api, type-exports]
tech_stack:
  added: [MemoryStorage]
  patterns: [runtime-injection, lazy-expiration, atomic-increment]
key_files:
  created:
    - src/storage/MemoryStorage.ts
    - tests/contracts/storage.contract.ts
    - src/storage/MemoryStorage.test.ts
  modified:
    - src/config/schema.ts
    - src/config/index.ts
    - src/types/config.ts
    - src/types/index.ts
    - src/index.ts
    - src/storage/index.ts
    - tests/config.test.ts
decisions:
  - title: Runtime storage injection via createRouter options
    rationale: Allows users to provide custom storage backends while defaulting to MemoryStorage
    alternatives: [config-file storage section, factory pattern]
    chosen: Optional parameter on createRouter({ storage?: StorageBackend })
  - title: Lazy expiration cleanup
    rationale: Prevents unbounded Map growth without background timers
    alternatives: [TTL timers, scheduled cleanup, no cleanup]
    chosen: Clean on access (increment/getUsage)
  - title: Synchronous increment operation
    rationale: Ensures atomicity in MemoryStorage (no await between read and write)
    alternatives: [locks, transactions]
    chosen: Synchronous Map.get/Map.set with no await
metrics:
  duration: 626
  tasks_completed: 2
  tests_added: 13
  files_created: 3
  files_modified: 8
  lines_added: 482
  commits: 2
  completed_at: '2026-03-12T14:08:47Z'
---

# Phase 02 Plan 01: Storage Layer Foundation Summary

**One-liner:** In-memory StorageBackend with atomic increment, lazy expiration, runtime injection via createRouter, and reusable contract test suite for future adapters.

## What Was Built

Created the storage layer foundation with:

1. **MemoryStorage class** - Default in-memory StorageBackend implementation with:
   - Atomic increment operations (synchronous read-modify-write)
   - Lazy expiration cleanup on access
   - Composite key format: `provider:keyIndex:windowType:period`
   - Closed lifecycle with exception throwing after close()
   - Stderr warning on construction

2. **Runtime storage injection** - Updated createRouter to accept optional storage:
   - `createRouter(config, { storage?: StorageBackend })`
   - Defaults to `new MemoryStorage()` if not provided
   - Router interface includes `storage` field

3. **Config schema changes** - Removed storage section from config:
   - Deleted `storageConfigSchema` from Zod schema
   - Removed `storage` field from `RouterConfig` type
   - Removed `StorageConfig` type and exports
   - Storage is now runtime-injected, not config-driven

4. **Contract test suite** - Reusable test helper for all StorageBackend adapters:
   - 10 contract test cases in `tests/contracts/storage.contract.ts`
   - Tests increment, getUsage, reset, close, put/get, window isolation
   - Helper function `createStorageContractTests(name, factory)` for adapter tests
   - MemoryStorage-specific tests for stderr warning and expiration cleanup

## Deviations from Plan

None - plan executed exactly as written.

## Technical Implementation Details

### MemoryStorage Key Design

Composite key includes time period to enable automatic expiration:

```typescript
private makeKey(provider: string, keyIndex: number, window: TimeWindow): string {
  const period = Math.floor(Date.now() / window.durationMs);
  return `${provider}:${keyIndex}:${window.type}:${period}`;
}
```

Example: `google:0:per-minute:29555555` (minute bucket)

### Lazy Expiration

Cleanup runs before reads and writes:

```typescript
private cleanupExpired(window: TimeWindow): void {
  const currentPeriod = Math.floor(Date.now() / window.durationMs);
  for (const [key, record] of this.data.entries()) {
    if (record.window.type === window.type) {
      const recordPeriod = Math.floor(record.timestamp / window.durationMs);
      if (recordPeriod < currentPeriod) {
        this.data.delete(key);
      }
    }
  }
}
```

Only scans entries matching the requested window type, not full Map.

### Atomic Increment

No await between Map.get and Map.set ensures atomicity:

```typescript
async increment(...) {
  this.cleanupExpired(window);
  const key = this.makeKey(provider, keyIndex, window);

  // Synchronous read-modify-write
  const existing = this.data.get(key);
  const record = existing
    ? { ...existing, promptTokens: existing.promptTokens + tokens.prompt, ... }
    : { id: randomUUID(), provider, keyIndex, ... };

  this.data.set(key, record);
  return record;
}
```

### Contract Test Pattern

Shared test helper enables adapter reuse:

```typescript
export function createStorageContractTests(name: string, factory: () => Promise<StorageBackend>) {
  describe(`${name} - StorageBackend contract`, () => {
    let storage: StorageBackend;
    beforeEach(async () => {
      storage = await factory();
    });
    // ... 10 test cases
  });
}
```

Future SQLite/Redis adapters import and run this suite.

## Test Coverage

- **Contract tests:** 10 cases (increment, getUsage, reset, close, put/get, windows, atomicity)
- **MemoryStorage-specific:** 3 cases (stderr warning, expiration on increment, expiration on getUsage)
- **Total:** 13 new tests (all passing)
- **Existing tests:** Fixed 2 config tests that referenced removed storage schema

Full test suite: 74 tests pass

## Files Changed

### Created (3 files)

1. `src/storage/MemoryStorage.ts` (183 lines) - StorageBackend implementation
2. `tests/contracts/storage.contract.ts` (209 lines) - Reusable contract test helper
3. `src/storage/MemoryStorage.test.ts` (90 lines) - MemoryStorage-specific tests

### Modified (8 files)

1. `src/config/schema.ts` - Removed storageConfigSchema and storage field
2. `src/config/index.ts` - Added optional storage parameter to createRouter
3. `src/types/config.ts` - Removed StorageConfig interface and storage from RouterConfig
4. `src/types/index.ts` - Removed StorageConfig export
5. `src/index.ts` - Added MemoryStorage export, removed StorageConfig export
6. `src/storage/index.ts` - Added MemoryStorage export
7. `tests/config.test.ts` - Removed storage references from 2 tests

## Verification Results

✅ TypeScript compiles cleanly (`npx tsc --noEmit`)
✅ All tests pass (74 tests, including 13 new storage tests)
✅ Linter passes (eslint with require-await exceptions for interface methods)
✅ MemoryStorage implements full StorageBackend interface
✅ Contract test helper is NOT a .test.ts file (imported by adapter tests)
✅ createRouter defaults to MemoryStorage when no storage provided
✅ Router.storage field exposed for Phase 4 usage tracking

## Commits

1. **c6ffc44** - feat(02-01): implement MemoryStorage and runtime storage injection
2. **22502da** - test(02-01): add storage contract tests and fix config tests

## What's Next

**Phase 2 Plan 02:** (if exists) Continue storage layer implementation

**Phase 4:** Usage tracking will use `router.storage.increment()` to record token usage

**Phase 10:** SQLite and Redis adapters will:

- Import and run `createStorageContractTests('SQLiteStorage', factory)`
- Provide persistent storage across restarts (USAGE-02 persistence requirement)
- Use same StorageBackend interface established here

## Notes

- **USAGE-02 partial completion:** Phase 2 delivers StorageBackend contract and MemoryStorage default. Persistence across restarts is deferred to Phase 10 (SQLite/Redis adapters).
- **USAGE-05 satisfied:** StorageBackend interface supports pluggable adapters
- MemoryStorage emits stderr warning on every construction (not suppressed)
- No background timers - cleanup happens on access only
- Test suite uses vitest fake timers for expiration testing
- Contract helper enables consistent adapter validation in Phase 10

## Self-Check

Verifying plan deliverables:

```bash
# Check created files
[ -f "src/storage/MemoryStorage.ts" ] && echo "✅ MemoryStorage exists"
[ -f "tests/contracts/storage.contract.ts" ] && echo "✅ Contract helper exists"
[ -f "src/storage/MemoryStorage.test.ts" ] && echo "✅ MemoryStorage tests exist"

# Check commits
git log --oneline | grep -q "c6ffc44" && echo "✅ Task 1 commit exists"
git log --oneline | grep -q "22502da" && echo "✅ Task 2 commit exists"

# Check exports
node -e "import('./src/index.js').then(m => console.log(typeof m.MemoryStorage === 'function' ? '✅ MemoryStorage exported' : '❌ Missing export'))"
```

## Self-Check: PASSED

All deliverables verified:

- ✅ MemoryStorage.ts exists (183 lines, implements StorageBackend)
- ✅ Contract helper exists (not .test.ts, reusable by adapters)
- ✅ MemoryStorage tests exist (runs contract + specific tests)
- ✅ Both commits exist (c6ffc44, 22502da)
- ✅ createRouter accepts optional storage parameter
- ✅ Config schema no longer has storage section
- ✅ StorageConfig removed from all type exports
- ✅ All tests pass (74 tests)
