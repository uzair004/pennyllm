---
phase: 18-usage-tracking-fixes
plan: 02
subsystem: usage-tracking
tags: [timewindow, credit-tracking, cooldown, round-robin, backoff]

requires:
  - phase: 17-core-routing-fixes
    provides: core routing and key rotation fixes
provides:
  - lifetime TimeWindow type for non-resetting credit buckets
  - conditional cooldown backoff respecting Retry-After headers
  - stable round-robin key selection across cooldown changes
affects: [credit-tracking, cooldown, selection-strategies]

tech-stack:
  added: []
  patterns:
    - 'lifetime window type for data that must never expire or rotate'
    - 'conditional backoff: hold counter at 1 when provider sends Retry-After'
    - 'stable index round-robin: cycle full candidate list, skip ineligible in loop'

key-files:
  created: []
  modified:
    - src/types/domain.ts
    - src/usage/periods.ts
    - src/credit/CreditTracker.ts
    - src/storage/MemoryStorage.ts
    - src/sqlite/SqliteStorage.ts
    - src/redis/RedisStorage.ts
    - src/usage/cooldown.ts
    - src/selection/strategies/round-robin.ts

key-decisions:
  - "Used 'lifetime' window type instead of overloading 'monthly' with large durationMs"
  - "Lifetime period key is fixed string 'lifetime' so it never rotates across months"
  - 'Redis lifetime TTL set to ~100 years (not 0 which would delete the key)'

patterns-established:
  - "Lifetime window: getPeriodKey returns 'lifetime', getResetAt returns max Date, cleanup is a no-op"

requirements-completed: [USAGE-02, USAGE-04, USAGE-05]

duration: 4min
completed: 2026-03-19
---

# Phase 18 Plan 02: Credit Window, Cooldown Backoff, Round-Robin Fixes Summary

**Lifetime window type for credit persistence, conditional backoff respecting Retry-After headers, and stable round-robin cycling through full candidate list**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-19T05:00:17Z
- **Completed:** 2026-03-19T05:04:45Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Credit data now stored under fixed 'lifetime' period key that survives month boundaries and process restarts
- Cooldown backoff counter stays at 1 when provider sends Retry-After header, only escalates without it
- Round-robin indexes over full candidates list with stable position, skipping cooldown keys in loop

## Task Commits

Each task was committed atomically:

1. **Task 1: Add lifetime window type and fix credit tracking month-boundary bug** - `d9f7783` (fix)
2. **Task 2: Fix cooldown backoff counter and round-robin modulo drift** - `9b39ba7` (fix)

## Files Created/Modified

- `src/types/domain.ts` - Added 'lifetime' to TimeWindow type union
- `src/usage/periods.ts` - Added lifetime cases to getPeriodKey and getResetAt
- `src/credit/CreditTracker.ts` - Changed CREDIT_WINDOW from 'monthly' to 'lifetime'
- `src/sqlite/SqliteStorage.ts` - Added lifetime to DURATION_MAP
- `src/redis/RedisStorage.ts` - Added lifetime to WINDOW_DURATION_MS and getTtlForWindow
- `src/usage/cooldown.ts` - Conditional backoff increment based on Retry-After presence
- `src/selection/strategies/round-robin.ts` - Stable index cycling through full candidate list

## Decisions Made

- Used 'lifetime' window type instead of overloading 'monthly' with large durationMs -- cleaner semantics and no month-boundary edge cases
- Lifetime period key is the fixed string 'lifetime' so storage never rotates buckets
- Redis lifetime TTL set to ~100 years in seconds (not 0, which would delete the key immediately)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added lifetime support to RedisStorage**

- **Found during:** Task 1 (lifetime window type)
- **Issue:** RedisStorage has its own WINDOW_DURATION_MS record and getTtlForWindow exhaustive switch that both needed 'lifetime' support. Plan only mentioned SqliteStorage and MemoryStorage.
- **Fix:** Added lifetime entry to WINDOW_DURATION_MS and lifetime case to getTtlForWindow with ~100 year TTL
- **Files modified:** src/redis/RedisStorage.ts
- **Verification:** tsc --noEmit passes
- **Committed in:** d9f7783 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary for compilation -- exhaustive switch would fail without lifetime case. No scope creep.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All phase 18 plans complete (usage tracking fixes)
- Ready for phase 19 (dead code cleanup)

---

_Phase: 18-usage-tracking-fixes_
_Completed: 2026-03-19_
