---
phase: 17-core-routing-fixes
plan: 01
subsystem: routing
tags: [error-handling, circuit-breaker, retry-logic, rate-limit]

requires:
  - phase: 16-v2-completion
    provides: chain executor and error classifier foundation
provides:
  - '402 credit-exhaustion errors no longer retried across keys'
  - 'Bounded recursion in executeChain forceNearestHalfOpen fallback'
affects: [18-usage-tracking-fixes, chain-executor, error-classifier]

tech-stack:
  added: []
  patterns: [bounded-recursion-guard, retryable-field-delegation]

key-files:
  created: []
  modified:
    - src/wrapper/error-classifier.ts
    - src/chain/ChainExecutor.ts

key-decisions:
  - 'MAX_FORCE_HALFOPEN_DEPTH=1 allows exactly one retry probe before clean failure'
  - 'Delegate rate_limit retry decision to classified.retryable field already set by classifyError'

patterns-established:
  - 'Depth parameter pattern for bounded recursion in async chain functions'

requirements-completed: [ROUTE-04, ROUTE-02]

duration: 1min
completed: 2026-03-19
---

# Phase 17 Plan 01: Core Routing Bug Fixes Summary

**Fixed 402 credit-exhaustion retry waste and infinite recursion stack overflow in chain executor**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-19T04:37:16Z
- **Completed:** 2026-03-19T04:38:32Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- 402 credit-exhaustion errors now immediately throw instead of cycling through all keys
- executeChain recursion bounded to max 1 retry via forceNearestHalfOpen, preventing stack overflow
- Both fixes are minimal single-point changes with no behavioral side effects on existing 429 handling

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix shouldRetry to respect retryable field for rate_limit errors** - `d7583cf` (fix)
2. **Task 2: Add recursion depth guard to executeChain's forceNearestHalfOpen fallback** - `84ceea3` (fix)

## Files Created/Modified

- `src/wrapper/error-classifier.ts` - shouldRetry returns classified.retryable for rate_limit case instead of unconditional true
- `src/chain/ChainExecutor.ts` - Added MAX_FORCE_HALFOPEN_DEPTH constant and depth parameter to bound recursive retries

## Decisions Made

- Set MAX_FORCE_HALFOPEN_DEPTH to 1 (allows one probe attempt before clean AllProvidersExhaustedError)
- Delegated retry decision to the retryable field that classifyError already sets correctly (false for 402, true for 429)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Error classifier and chain executor are patched for correctness
- Ready for remaining Phase 17 plans (key rotation, singleton, async key fixes)
- Pre-existing TypeScript error in RedisStorage.test.ts (rootDir import) is unrelated and out of scope

---

_Phase: 17-core-routing-fixes_
_Completed: 2026-03-19_
