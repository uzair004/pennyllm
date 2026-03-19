---
phase: 18-usage-tracking-fixes
plan: 01
subsystem: usage
tags: [usage-tracking, policy-engine, deduplication, bug-fix]

requires:
  - phase: 17-core-routing-fixes
    provides: core routing bug fixes completed
provides:
  - Fixed rolling-30d usage query (no more 30x inflation)
  - LRU dedup eviction preserving 9000+ recent entries
  - Division-by-zero guard in PolicyEngine
affects: [19-dead-code-cleanup, 20-type-safety]

tech-stack:
  added: []
  patterns: [map-based-lru-eviction, ternary-zero-guard]

key-files:
  created: []
  modified:
    - src/usage/UsageTracker.ts
    - src/policy/PolicyEngine.ts

key-decisions:
  - 'Used Map insertion-order for LRU eviction instead of separate LRU data structure'
  - 'percentUsed=100 when limit.value=0 (fully consumed semantics)'

patterns-established:
  - 'LRU eviction via Map.keys() iterator delete for bounded dedup sets'

requirements-completed: [USAGE-01, USAGE-03, USAGE-06]

duration: 3min
completed: 2026-03-19
---

# Phase 18 Plan 01: Usage Tracking Fixes Summary

**Fixed 30x rolling-30d usage inflation, dedup bulk-clear data loss, and PolicyEngine division-by-zero**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-19T04:40:15Z
- **Completed:** 2026-03-19T04:43:39Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Removed rolling-30d special case that queried same daily bucket 30 times, causing 30x inflated usage reports
- Replaced Set.clear() dedup with Map-based LRU eviction keeping 9000+ recent entries
- Added zero-guard in PolicyEngine.evaluate() so limit.value=0 returns 100% used (not Infinity)

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix rolling-30d inflation and dedup bulk-clear in UsageTracker** - `597a6ce` (fix)
2. **Task 2: Fix PolicyEngine division by zero on limit.value === 0** - `20764ef` (fix)

## Files Created/Modified

- `src/usage/UsageTracker.ts` - Removed rolling-30d 30-bucket loop, changed dedup Set to Map with LRU eviction
- `src/policy/PolicyEngine.ts` - Added ternary guard for limit.value === 0 on percentUsed calculation

## Decisions Made

- Used ES2015+ Map insertion-order guarantee for LRU eviction (evict oldest 1000 of 10000+ entries) rather than a separate LRU library -- keeps zero dependencies
- When limit.value is 0, percentUsed returns 100 (fully consumed) rather than 0 (no limit) -- matches "zero capacity" semantics

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Changed `let usage` to `const usage` after removing conditional branch**

- **Found during:** Task 1 (rolling-30d fix)
- **Issue:** ESLint prefer-const error after removing the if/else branch left `let` with single assignment
- **Fix:** Merged declaration and assignment into `const usage = await ...`
- **Files modified:** src/usage/UsageTracker.ts
- **Verification:** ESLint passes via pre-commit hook
- **Committed in:** 597a6ce (part of Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Trivial lint fix required by removing conditional. No scope creep.

## Issues Encountered

- Pre-existing tsc rootDir error from test files importing outside src/ -- unrelated to changes, did not block

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Usage tracking now produces accurate data for all window types
- PolicyEngine handles edge case of zero-value limits correctly
- Ready for remaining 18-xx plans (credit reset, backoff, round-robin drift)

---

_Phase: 18-usage-tracking-fixes_
_Completed: 2026-03-19_
