---
phase: 14-health-scoring-circuit-breakers
plan: 01
subsystem: health
tags: [circuit-breaker, rolling-window, health-scoring, fsm, cooldown]

requires:
  - phase: 13-credit-based-limits
    provides: CreditTracker pattern, EventEmitter-based class design
provides:
  - HealthScorer class with rolling window and circuit breaker FSM
  - CircuitState, RollingWindow, CircuitInfo, SkipResult types
  - ProviderRecoveredEvent type and RouterEvent constant
  - circuit_open reason for ProviderAttempt
affects: [14-02, chain-executor, fallback-routing]

tech-stack:
  added: []
  patterns: [circular-buffer-rolling-window, three-state-circuit-breaker-fsm, escalating-cooldowns]

key-files:
  created:
    - src/health/types.ts
    - src/health/HealthScorer.ts
  modified:
    - src/types/events.ts
    - src/constants/index.ts
    - src/types/domain.ts

key-decisions:
  - 'No external exports: HealthScorer is internal-only, not exported from barrel'
  - 'Fresh window on reset: successful half-open probe clears all history'

patterns-established:
  - 'Circuit breaker FSM: closed -> open -> half-open -> closed/open'
  - 'Escalating cooldown schedule: 30s, 1m, 2m, 5m, 15m cap'
  - 'Rolling window with circular buffer for O(1) outcome recording'

requirements-completed: [CORE-03]

duration: 3min
completed: 2026-03-18
---

# Phase 14 Plan 01: HealthScorer Summary

**HealthScorer with 10-request rolling window health scoring and three-state circuit breaker FSM with escalating cooldowns (30s-15m)**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-18T05:37:35Z
- **Completed:** 2026-03-18T05:40:29Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Created health type system: CircuitState, RollingWindow, CircuitInfo, SkipResult, ProviderRecoveredEvent
- Implemented HealthScorer with circular buffer rolling window (10 requests) and circuit breaker FSM
- Escalating cooldowns: 30s -> 1m -> 2m -> 5m -> 15m cap with full reset on recovery
- Added provider:recovered event emission on successful half-open probe
- forceNearestHalfOpen for all-circuits-open edge case fallback

## Task Commits

Each task was committed atomically:

1. **Task 1: Health types, event type, and RouterEvent constant** - `7c817ce` (feat)
2. **Task 2: HealthScorer class implementation** - `be54159` (feat)

## Files Created/Modified

- `src/health/types.ts` - CircuitState, RollingWindow, CircuitInfo, SkipResult, ProviderRecoveredEvent types
- `src/health/HealthScorer.ts` - HealthScorer class with rolling window and circuit breaker FSM
- `src/types/events.ts` - Added ProviderRecoveredEvent to RouterEventMap and RouterEvents union
- `src/constants/index.ts` - Added PROVIDER_RECOVERED constant
- `src/types/domain.ts` - Added circuit_open to ProviderAttempt.reason union

## Decisions Made

- HealthScorer is internal-only, not exported from any barrel index
- Successful half-open probe resets rolling window to fresh state (not just circuit state)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- HealthScorer ready for integration into chain executor (14-02)
- shouldSkip/recordSuccess/recordFailure API matches chain execution flow
- forceNearestHalfOpen ready for all-providers-exhausted fallback logic

---

_Phase: 14-health-scoring-circuit-breakers_
_Completed: 2026-03-18_
