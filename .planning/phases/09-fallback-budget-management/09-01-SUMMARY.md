---
phase: 09-fallback-budget-management
plan: 01
subsystem: api
tags: [fallback, budget, types, zod, config, error-handling]

# Dependency graph
requires:
  - phase: 01-project-setup
    provides: TypeScript scaffolding, base error class, config schema
  - phase: 05-model-catalog
    provides: ModelMetadata, QualityTierType, catalog types
provides:
  - FallbackConfig, FallbackCandidate, ProviderAttempt type contracts
  - BudgetAlertEvent, BudgetExceededEvent event interfaces
  - AllProvidersExhaustedError with recovery tracking
  - fallbackConfigSchema with cross-field validation
  - BUDGET_ALERT and BUDGET_EXCEEDED RouterEvent constants
affects: [09-02-fallback-resolver, 09-03-budget-tracker]

# Tech tracking
tech-stack:
  added: []
  patterns: [cross-field-zod-validation, exhaustion-type-categorization]

key-files:
  created:
    - src/fallback/types.ts
    - src/budget/types.ts
    - src/errors/all-providers-exhausted-error.ts
  modified:
    - src/config/schema.ts
    - src/types/config.ts
    - src/types/events.ts
    - src/types/index.ts
    - src/constants/index.ts
    - src/errors/index.ts
    - src/index.ts
    - src/selection/KeySelector.ts

key-decisions:
  - 'Exhaustion type categorization: cooldown/quota/mixed for ProviderExhaustedEvent'
  - 'Cross-field validation: cheapest-paid behavior requires non-zero budget'

patterns-established:
  - 'Fallback type contract pattern: FallbackCandidate includes isFree flag for budget awareness'
  - 'ProviderAttempt reason enum: quota_exhausted, rate_limited, server_error, budget_exceeded, no_match, auth_failed'

requirements-completed: [CORE-04, CORE-05, CORE-06, DX-05]

# Metrics
duration: 4m 14s
completed: 2026-03-14
---

# Phase 9 Plan 01: Fallback/Budget Type Contracts Summary

**Fallback and budget type contracts with FallbackConfig, ProviderAttempt, AllProvidersExhaustedError, Zod schemas with cross-field validation, and budget event types**

## Performance

- **Duration:** 4m 14s
- **Started:** 2026-03-14T15:09:34Z
- **Completed:** 2026-03-14T15:13:48Z
- **Tasks:** 1
- **Files modified:** 12

## Accomplishments

- Defined complete type contracts for fallback resolution: FallbackConfig, FallbackCandidate, ProviderAttempt, AffinityEntry, FallbackProxyOptions
- Created budget event interfaces (BudgetAlertEvent, BudgetExceededEvent) extending RouterEventPayload
- Implemented AllProvidersExhaustedError with automatic earliest recovery computation across all attempts
- Added fallbackConfigSchema with .default({}) for zero-config and cross-field cheapest-paid + $0 budget validation
- Extended ProviderExhaustedEvent with exhaustionType and FallbackTriggeredEvent with fromModel/toModel

## Task Commits

Each task was committed atomically:

1. **Task 1: Fallback and budget type contracts, config schema, error class** - `539cfc5` (feat)

## Files Created/Modified

- `src/fallback/types.ts` - FallbackConfig, FallbackCandidate, ProviderAttempt, AffinityEntry, FallbackProxyOptions, ProviderFallbackOverride
- `src/budget/types.ts` - BudgetAlertEvent, BudgetExceededEvent event interfaces
- `src/errors/all-providers-exhausted-error.ts` - AllProvidersExhaustedError with attempts and earliestRecovery
- `src/config/schema.ts` - fallbackConfigSchema, providerFallbackOverrideSchema, cross-field validation
- `src/types/config.ts` - Added fallback to RouterConfig and ProviderConfig
- `src/types/events.ts` - Added exhaustionType, fromModel/toModel, budget event re-exports, RouterEventMap update
- `src/types/index.ts` - Export new fallback and budget types
- `src/constants/index.ts` - BUDGET_ALERT and BUDGET_EXCEEDED constants
- `src/errors/index.ts` - Export AllProvidersExhaustedError
- `src/index.ts` - Export new error and types from package root
- `src/selection/KeySelector.ts` - Emit exhaustionType in provider:exhausted event
- `src/selection/KeySelector.test.ts` - Add fallback field to mock RouterConfig

## Decisions Made

- **Exhaustion type categorization:** ProviderExhaustedEvent now includes `exhaustionType: 'cooldown' | 'quota' | 'mixed'` computed from the ratio of cooldown vs quota-exhausted keys
- **Cross-field validation chaining:** `.strict().refine()` order ensures unknown fields are rejected before cross-field logic runs

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated KeySelector exhausted event emission**

- **Found during:** Task 1
- **Issue:** ProviderExhaustedEvent gained required `exhaustionType` field but existing emission in KeySelector.ts didn't include it
- **Fix:** Added exhaustionType computation and included in event emission
- **Files modified:** src/selection/KeySelector.ts
- **Verification:** tsc --noEmit passes
- **Committed in:** 539cfc5

**2. [Rule 1 - Bug] Updated test mock config**

- **Found during:** Task 1
- **Issue:** KeySelector.test.ts mock RouterConfig missing new required `fallback` field
- **Fix:** Added fallback object with default values to mockConfig
- **Files modified:** src/selection/KeySelector.test.ts
- **Verification:** tsc --noEmit passes
- **Committed in:** 539cfc5

---

**Total deviations:** 2 auto-fixed (2 bugs from new required fields)
**Impact on plan:** Both fixes necessary for type correctness after adding required fields. No scope creep.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All type contracts ready for Plan 02 (FallbackResolver) and Plan 03 (BudgetTracker)
- FallbackConfig, ProviderAttempt, FallbackCandidate importable from src/fallback/types.ts
- AllProvidersExhaustedError importable from src/errors/index.ts
- Config schema accepts fallback section with sensible defaults

---

_Phase: 09-fallback-budget-management_
_Completed: 2026-03-14_
