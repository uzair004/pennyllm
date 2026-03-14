---
phase: 10-sqlite-redis-advanced-features
plan: 03
subsystem: api
tags: [tsup, subpath-exports, peer-dependencies, eventemitter, dry-run, observability]

# Dependency graph
requires:
  - phase: 10-sqlite-redis-advanced-features (plans 01-02)
    provides: SqliteStorage and RedisStorage adapter implementations
provides:
  - Subpath exports for llm-router/sqlite and llm-router/redis
  - Optional peer dependencies for better-sqlite3 and ioredis
  - 8 typed observability hook helpers on Router interface
  - Dry-run mode via dryRun config option
affects: [phase-11-developer-experience, phase-12-testing]

# Tech tracking
tech-stack:
  added: []
  patterns: [typed-hook-factory, dry-run-middleware-intercept, subpath-exports]

key-files:
  created: []
  modified:
    - package.json
    - tsup.config.ts
    - src/index.ts
    - src/config/schema.ts
    - src/types/config.ts
    - src/wrapper/middleware.ts
    - src/config/index.ts
    - src/wrapper/router-model.ts
    - src/selection/KeySelector.test.ts

key-decisions:
  - 'Dry-run intercept happens AFTER key selection so events still fire'
  - 'routerModel() convenience function always sets dryRun: false'
  - 'Type-only exports for SqliteStorageOptions/RedisStorageOptions from main index'

patterns-established:
  - 'createHook<T> factory: wraps EventEmitter.on with typed callback and returns unsubscribe function'
  - 'Mock V3 generate result: content array, finishReason with unified/raw, usage with inputTokens/outputTokens sub-objects, warnings array'

requirements-completed: [DX-03, DX-04]

# Metrics
duration: 7m
completed: 2026-03-14
---

# Phase 10 Plan 03: Build Wiring, Observability Hooks & Dry-Run Summary

**Subpath exports for sqlite/redis adapters, 8 typed observability hooks on Router, and dry-run mode returning mock responses without API calls**

## Performance

- **Duration:** 7m 4s
- **Started:** 2026-03-14T18:27:25Z
- **Completed:** 2026-03-14T18:34:46Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Package exports `./sqlite` and `./redis` configured with types, ESM, and CJS outputs via tsup
- better-sqlite3 and ioredis declared as optional peer dependencies
- 8 typed hook helpers (onKeySelected, onUsageRecorded, onLimitWarning, onLimitExceeded, onFallbackTriggered, onBudgetAlert, onBudgetExceeded, onError) on Router interface returning unsubscribe functions
- dryRun config option validated by Zod, defaults to false, middleware intercepts before API call
- Dry-run mock responses satisfy exact LanguageModelV3GenerateResult and LanguageModelV3StreamResult types

## Task Commits

Each task was committed atomically:

1. **Task 1: Build wiring -- package.json exports, tsup entry points, peer dependencies, main exports** - `ef2aa89` (feat)
2. **Task 2: Typed observability hooks on Router + dry-run mode with config schema** - `fe3e0ea` (feat)

## Files Created/Modified

- `package.json` - Subpath exports for ./sqlite and ./redis, optional peer dependencies
- `tsup.config.ts` - Entry points for sqlite and redis bundles
- `src/index.ts` - Type-only exports for SqliteStorageOptions and RedisStorageOptions
- `src/config/schema.ts` - dryRun boolean option with .default(false) in Zod schema
- `src/types/config.ts` - dryRun field added to RouterConfig interface
- `src/wrapper/middleware.ts` - Dry-run intercept in wrapGenerate and wrapStream with mock responses
- `src/config/index.ts` - Typed hook helpers, createHook factory, dryRun passed to middleware
- `src/wrapper/router-model.ts` - dryRun: false passed to middleware in routerModel convenience function
- `src/selection/KeySelector.test.ts` - dryRun field added to mock RouterConfig

## Decisions Made

- Dry-run intercept happens in middleware (AFTER key selection), so key:selected events still fire in dry-run mode
- routerModel() convenience function always uses dryRun: false since it's a simple path without full router context
- Type-only exports for storage adapter option types are safe from main index (erased at compile time, no peer dep crash)
- Mock V3 responses include all required fields: content array, finishReason with unified/raw, usage with full sub-objects, warnings array

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added dryRun to routerModel middleware call**

- **Found during:** Task 2 (tsc --noEmit)
- **Issue:** src/wrapper/router-model.ts also calls createRouterMiddleware but wasn't updated with the new dryRun parameter
- **Fix:** Added `dryRun: false` to the middleware options in routerModel()
- **Files modified:** src/wrapper/router-model.ts
- **Verification:** tsc --noEmit passes
- **Committed in:** fe3e0ea (Task 2 commit)

**2. [Rule 3 - Blocking] Added dryRun to KeySelector test mock config**

- **Found during:** Task 2 (tsc --noEmit)
- **Issue:** KeySelector.test.ts constructs RouterConfig manually without the new dryRun field
- **Fix:** Added `dryRun: false` to the mock config factory
- **Files modified:** src/selection/KeySelector.test.ts
- **Verification:** tsc --noEmit passes, vitest run passes
- **Committed in:** fe3e0ea (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes required to maintain type-safety after adding dryRun to RouterConfig. No scope creep.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 10 complete: all 3 plans executed
- SQLite and Redis adapters built, wired into build system, and importable via subpath exports
- Typed observability hooks provide DX sugar over EventEmitter
- Dry-run mode enables config validation without API calls
- Ready for Phase 11 (Developer Experience Polish) and Phase 12 (Testing & Validation)

## Self-Check: PASSED

All 8 modified source files verified present. All 6 dist output files (sqlite + redis: .mjs, .cjs, .d.ts) verified present. Both task commits (ef2aa89, fe3e0ea) verified in git log.

---

_Phase: 10-sqlite-redis-advanced-features_
_Completed: 2026-03-14_
