---
phase: 04-usage-tracking-core
plan: 01
subsystem: usage-tracking
tags: [foundation, types, utilities, storage]
dependency_graph:
  requires: [Phase 2 (MemoryStorage), Phase 3 (PolicyEngine)]
  provides: [usage types, period calculator, token estimation, cooldown manager, structured usage]
  affects: [StorageBackend interface, MemoryStorage implementation, config schema]
tech_stack:
  added: [src/usage module, calendar-aware period keys, structured usage API]
  patterns: [period calculation, token estimation, cooldown management, call counting]
key_files:
  created:
    - src/usage/types.ts
    - src/usage/periods.ts
    - src/usage/estimation.ts
    - src/usage/cooldown.ts
    - src/usage/index.ts
  modified:
    - src/types/interfaces.ts
    - src/storage/MemoryStorage.ts
    - src/policy/PolicyEngine.ts
    - src/config/schema.ts
    - src/types/config.ts
    - tests/contracts/storage.contract.ts
    - src/storage/MemoryStorage.test.ts
decisions:
  - Monthly periods use calendar year+month keys (YYYY-MM), not duration division
  - Rolling 30-day windows use daily bucket keys for summation
  - Token estimation returns null on any error (graceful degradation)
  - CooldownManager parses Retry-After as int seconds or HTTP date
  - StorageBackend.increment callCount parameter is optional (backward-compatible)
  - StorageBackend.getUsage returns structured object instead of number (breaking change)
  - Call counts tracked in parallel Map alongside token usage in MemoryStorage
  - Period key cleanup uses calendar comparison for hourly/daily/monthly windows
  - Estimation config schema validates defaultMaxTokens, tokenEstimator is runtime-only
metrics:
  duration: 6m 47s
  completed: 2026-03-13T03:13:19Z
  tasks: 2
  commits: 2
  files_created: 5
  files_modified: 7
---

# Phase 04 Plan 01: Usage Tracking Foundation

**One-liner:** Built usage tracking utilities with calendar-aware period calculation, token estimation, cooldown management, and structured usage API for StorageBackend.

## Overview

Phase 04 Plan 01 established the foundation layer for usage tracking by creating the `src/usage/` module with types, period calculation, token estimation, and cooldown management utilities. Updated StorageBackend interface and MemoryStorage implementation to support call counts, structured usage data, and calendar-aware period keys. Extended config schema with estimation section.

**Status:** Complete ✓
**Duration:** 6m 47s
**Commits:** a3181e1, 88e3dff

## Implementation Summary

### Task 1: Usage types, period calculator, estimation, and cooldown utilities

**Commit:** a3181e1
**Files:** 5 created in `src/usage/`

Created the `src/usage/` module with complete usage tracking utilities:

**src/usage/types.ts** - Usage API types:

- `EstimationConfig` interface: `{ defaultMaxTokens: number; tokenEstimator?: (text: string) => number }`
- `EstimationResult` interface: `{ prompt: number; completion: number }`
- `KeyUsageWindow` interface: All primitive/string values for JSON serialization
- `KeyUsage`, `ProviderUsage`, `UsageSnapshot` interfaces for usage API
- `StructuredUsage` interface for StorageBackend.getUsage() return type

**src/usage/periods.ts** - Calendar-aware period calculation:

- `getPeriodKey(window, timestamp)`: Handles all 5 window types
  - `per-minute`: `Math.floor(timestamp / durationMs).toString()` (fixed 60s boundaries)
  - `hourly`: ISO slice to `YYYY-MM-DDTHH` (UTC hour boundaries)
  - `daily`: ISO slice to `YYYY-MM-DD` (UTC day boundaries)
  - `monthly`: ISO slice to `YYYY-MM` (calendar month, NOT duration division)
  - `rolling-30d`: Same as daily (daily bucket for summation)
- `getResetAt(window, timestamp)`: Returns Date at next boundary
  - Uses `Date.UTC()` for calendar-based windows
  - Handles month rollover correctly

**src/usage/estimation.ts** - Token estimation with error handling:

- `estimateTokens(messages, options, config)`: Estimates prompt + completion tokens
- Concatenates all text content from messages (skips images/files)
- Adds system prompt and tools (JSON.stringify) to prompt text
- Uses custom `config.tokenEstimator` or `defaultCharRatioEstimator` (~4 chars/token)
- Completion: uses `options.maxTokens` or `config.defaultMaxTokens`
- Returns `null` on any error (graceful degradation, no blocking)

**src/usage/cooldown.ts** - 429 rate limit cooldown management:

- `CooldownManager` class with `Map<string, { until: number; reason: string }>`
- `setCooldown(provider, keyIndex, retryAfterHeader?, defaultCooldownMs)`: Parses Retry-After
  - Tries `parseInt()` for seconds first
  - Falls back to `Date()` constructor for HTTP date
  - Uses default (60s) if both fail
- `isInCooldown(provider, keyIndex)`: Checks active cooldown with lazy cleanup
- `getCooldown(provider, keyIndex)`: Returns `{ until: ISO string, reason }` or null
- `clearAll()` and `clear(provider, keyIndex)` for reset operations

**src/usage/index.ts** - Barrel exports for all utilities and types

**Verification:** `npm run build` succeeded, all 5 files compile cleanly.

### Task 2: StorageBackend interface update, MemoryStorage update, and config schema extension

**Commit:** 88e3dff
**Files:** 7 modified

Updated storage layer and config to support Phase 4 requirements:

**src/types/interfaces.ts** - Extended StorageBackend interface:

- Added `StructuredUsage` interface for getUsage() return type
- Updated `increment()` signature: added optional `callCount?: number` parameter (backward-compatible)
- Updated `getUsage()` return type: `Promise<number>` → `Promise<StructuredUsage>` (breaking change)
- Added `resetAll(provider?, keyIndex?)` method for bulk reset operations

**src/storage/MemoryStorage.ts** - Updated implementation:

- Imported `getPeriodKey` from `../usage/periods.js`
- Replaced `makeKey()` to use `getPeriodKey(window, Date.now())` instead of duration division
- Added `callCounts: Map<string, number>` to track call counts alongside tokens
- Updated `increment()`: accepts optional `callCount` parameter, increments both token and call counters
- Updated `getUsage()`: returns structured object `{ promptTokens, completionTokens, totalTokens, callCount }`
- Updated `cleanupExpired()`: compares period keys (calendar-aware) instead of numeric division
  - Extracts period key from composite key (4th segment)
  - Compares with current period key from `getPeriodKey()`
  - Cleans up both `data` and `callCounts` Maps
- Implemented `resetAll(provider?, keyIndex?)`: bulk delete with prefix matching
- Updated `reset()` and `close()` to also clear callCounts Map

**src/policy/PolicyEngine.ts** - Fixed compatibility:

- Updated `evaluate()` to destructure new getUsage return: `const { totalTokens: current } = await this.storage.getUsage(...)`
- One-line change preserves existing behavior

**src/config/schema.ts** - Added estimation config:

- Created `estimationSchema`: `z.object({ defaultMaxTokens: z.number().int().positive().default(1024) }).default({ defaultMaxTokens: 1024 })`
- Added comment: "tokenEstimator function is NOT validated by Zod (runtime option, not JSON config)"
- Added `estimation: estimationSchema` to configSchema
- Added `warningThreshold: z.number().min(0).max(1).optional()` to configSchema

**src/types/config.ts** - Added estimation types:

- Added `EstimationConfig` interface: `{ defaultMaxTokens: number }`
- Added `estimation: EstimationConfig` field to RouterConfig

**tests/contracts/storage.contract.ts** - Updated contract tests:

- All `expect(usage).toBe(number)` → `expect(usage.totalTokens).toBe(number)`
- Added assertions for `promptTokens`, `completionTokens`, `callCount` fields
- Tests verify structured return type is correct

**src/storage/MemoryStorage.test.ts** - Updated specific behavior tests:

- Updated expiration tests to use `usage.totalTokens` and `usage.callCount`

**Verification:** `npm test` passed all 74 tests (4 test files, 13 MemoryStorage tests, 23 config tests, 14 exports tests, 24 build tests).

## Deviations from Plan

None - plan executed exactly as written. All tasks completed successfully with no auto-fixes, architectural changes, or blocking issues.

## Verification Results

1. ✓ `npm run build` compiles cleanly (no TypeScript errors)
2. ✓ `npm test` passes all 74 tests
3. ✓ `getPeriodKey('monthly', timestamp)` produces "YYYY-MM" format keys (calendar-aware, verified in code)
4. ✓ `estimateTokens()` returns null when estimation throws (try-catch with debug logging)
5. ✓ `CooldownManager.isInCooldown()` returns false after cooldown expires (lazy cleanup implemented)
6. ✓ `MemoryStorage.getUsage()` returns structured object with promptTokens, completionTokens, totalTokens, callCount (verified in tests)
7. ✓ Config schema accepts `{ estimation: { defaultMaxTokens: 2048 } }` and defaults to 1024 (Zod schema validation)

## Key Decisions

1. **Monthly period keys use calendar boundaries** - `YYYY-MM` format instead of `Math.floor(timestamp / durationMs)`. This ensures monthly limits align with calendar months (e.g., March 1-31) not arbitrary 30-day periods. Affects MemoryStorage period key generation and cleanup.

2. **Rolling 30-day windows use daily buckets** - Same period key as daily windows. Plan 02 will sum the last 30 daily buckets for rolling window calculation. This keeps period keys consistent across window types.

3. **Token estimation fails gracefully** - Returns `null` on any error instead of throwing. Allows usage tracking to continue even if estimation fails (e.g., malformed messages, custom estimator errors). Caller must handle null return.

4. **CooldownManager supports two Retry-After formats** - Parses both int seconds and HTTP date strings. Falls back to default cooldown (60s) if both parse attempts fail. Handles real-world API responses.

5. **StorageBackend.increment callCount is optional** - Defaults to 0 for backward compatibility. Existing callers (PolicyEngine) don't pass callCount and get 0. Phase 4 Plan 02 will pass callCount=1 when recording actual API calls.

6. **StorageBackend.getUsage return type is breaking** - Changed from `Promise<number>` to `Promise<StructuredUsage>`. PolicyEngine updated immediately to use `.totalTokens` field. Future adapters must return structured object.

7. **Call counts tracked in parallel Map** - Separate `callCounts: Map<string, number>` instead of extending UsageRecord. UsageRecord is a domain type (src/types/domain.ts) and shouldn't be modified for storage implementation details. Parallel Map keeps concerns separated.

8. **Period key cleanup uses string comparison** - For calendar-based windows, compares stored period key string vs current period key from `getPeriodKey()`. If they differ, record is expired. Simpler than parsing timestamps for calendar math.

9. **Estimation config in schema, estimator in runtime** - `defaultMaxTokens` validated by Zod in config schema. `tokenEstimator` function is runtime-only (passed to createRouter options, not JSON config). Zod .strict() would reject functions in JSON.

## Files Changed

**Created (5 files):**

- `src/usage/types.ts` (73 lines) - Usage API types
- `src/usage/periods.ts` (100 lines) - Period calculation utilities
- `src/usage/estimation.ts` (61 lines) - Token estimation with error handling
- `src/usage/cooldown.ts` (102 lines) - Cooldown manager for 429 rate limits
- `src/usage/index.ts` (20 lines) - Barrel exports

**Modified (7 files):**

- `src/types/interfaces.ts` (+15 lines) - Extended StorageBackend interface
- `src/storage/MemoryStorage.ts` (+40 lines) - Calendar-aware periods, call counts, structured usage
- `src/policy/PolicyEngine.ts` (+3 lines) - Use structured getUsage return
- `src/config/schema.ts` (+12 lines) - Add estimation schema
- `src/types/config.ts` (+6 lines) - Add EstimationConfig type
- `tests/contracts/storage.contract.ts` (+18 lines) - Update for structured usage
- `src/storage/MemoryStorage.test.ts` (+3 lines) - Update for structured usage

**Total:** 5 files created, 7 files modified, 363 lines added (usage module), 97 lines modified (storage/config/tests)

## Technical Notes

### Period Key Format Reference

| Window Type   | Period Key Format    | Example           | Reset Boundary      |
| ------------- | -------------------- | ----------------- | ------------------- |
| `per-minute`  | Numeric string       | `"29556186"`      | Next 60s boundary   |
| `hourly`      | `YYYY-MM-DDTHH`      | `"2026-03-13T03"` | Next UTC hour       |
| `daily`       | `YYYY-MM-DD`         | `"2026-03-13"`    | Next UTC midnight   |
| `monthly`     | `YYYY-MM`            | `"2026-03"`       | First of next month |
| `rolling-30d` | `YYYY-MM-DD` (daily) | `"2026-03-13"`    | Next UTC midnight   |

### Composite Key Format

MemoryStorage composite keys: `${provider}:${keyIndex}:${window.type}:${periodKey}`

Examples:

- `google:0:per-minute:29556186`
- `google:0:hourly:2026-03-13T03`
- `google:0:monthly:2026-03`

### Calendar-Aware Cleanup Algorithm

```typescript
// Old (duration division, not calendar-aware):
const recordPeriod = Math.floor(record.timestamp / window.durationMs);
if (recordPeriod < currentPeriod) {
  /* expired */
}

// New (calendar-aware):
const currentPeriodKey = getPeriodKey(window, Date.now());
const storedPeriodKey = key.split(':').slice(3).join(':');
if (storedPeriodKey !== currentPeriodKey) {
  /* expired */
}
```

This correctly handles month boundaries (February 28 → March 1), hour boundaries (23:59 → 00:00), etc.

## Next Steps

Plan 04-02 will:

1. Implement `UsageTracker` class using the utilities built in this plan
2. Wire `recordUsage()` to increment storage with actual token counts
3. Implement `getUsage()` API for querying current usage across all windows
4. Integrate cooldown manager for 429 response handling
5. Use token estimation for pre-call limit checks in PolicyEngine

Dependencies satisfied: All utilities and updated storage layer ready for Plan 02 assembly.

## Self-Check

Verifying all claimed artifacts exist and commits are valid.

```bash
# Check created files
[ -f "src/usage/types.ts" ] && echo "FOUND: src/usage/types.ts" || echo "MISSING: src/usage/types.ts"
[ -f "src/usage/periods.ts" ] && echo "FOUND: src/usage/periods.ts" || echo "MISSING: src/usage/periods.ts"
[ -f "src/usage/estimation.ts" ] && echo "FOUND: src/usage/estimation.ts" || echo "MISSING: src/usage/estimation.ts"
[ -f "src/usage/cooldown.ts" ] && echo "FOUND: src/usage/cooldown.ts" || echo "MISSING: src/usage/cooldown.ts"
[ -f "src/usage/index.ts" ] && echo "FOUND: src/usage/index.ts" || echo "MISSING: src/usage/index.ts"

# Check commits exist
git log --oneline --all | grep -q "a3181e1" && echo "FOUND: a3181e1" || echo "MISSING: a3181e1"
git log --oneline --all | grep -q "88e3dff" && echo "FOUND: 88e3dff" || echo "MISSING: 88e3dff"
```

**Result:** PASSED

- ✓ All 5 usage module files exist
- ✓ Commit a3181e1 exists (Task 1)
- ✓ Commit 88e3dff exists (Task 2)
