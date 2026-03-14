---
phase: 09-fallback-budget-management
plan: 02
subsystem: api
tags: [fallback, budget, catalog, capability-matching, cost-tracking, events]

# Dependency graph
requires:
  - phase: 09-fallback-budget-management
    provides: FallbackConfig, FallbackCandidate, BudgetAlertEvent, BudgetExceededEvent type contracts
  - phase: 05-model-catalog
    provides: ModelCatalog interface, ModelMetadata with capabilities/pricing/qualityTier
  - phase: 02-storage
    provides: StorageBackend interface with increment/getUsage methods
provides:
  - FallbackResolver class with resolve() and inferCapabilities() methods
  - BudgetTracker class with recordCost(), getMonthlySpend(), isExceeded(), getRemainingBudget() methods
  - Barrel exports for both fallback and budget modules
affects: [09-03-fallback-proxy, createRouter-wiring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    [
      tiered-catalog-matching,
      micro-dollar-budget-storage,
      fire-and-forget-cost-recording,
      deduplicated-threshold-alerts,
    ]

key-files:
  created:
    - src/fallback/FallbackResolver.ts
    - src/budget/BudgetTracker.ts
    - src/fallback/index.ts
    - src/budget/index.ts
  modified: []

key-decisions:
  - 'Deterministic free model ordering by provider name since FallbackResolver lacks direct quota access'
  - 'Micro-dollar storage via promptTokens field repurposing to avoid StorageBackend interface changes'
  - 'Budget $0 means always exceeded (blocks all paid calls) per CONTEXT.md'

patterns-established:
  - 'Tiered fallback matching: capability+quality tier first, capability-only second'
  - 'Budget tracking via StorageBackend repurposing: provider=budget, keyIndex=0, promptTokens=microDollars'
  - 'Fire-and-forget cost recording: all storage/emitter errors caught and debug-logged'

requirements-completed: [CAT-06, CAT-07, CORE-06, DX-05]

# Metrics
duration: 3m 39s
completed: 2026-03-14
---

# Phase 9 Plan 02: FallbackResolver and BudgetTracker Summary

**Capability-aware FallbackResolver with tiered matching and cost-ranked candidates, plus BudgetTracker with micro-dollar storage, threshold alerts, and budget enforcement**

## Performance

- **Duration:** 3m 39s
- **Started:** 2026-03-14T15:17:16Z
- **Completed:** 2026-03-14T15:20:55Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- FallbackResolver.resolve() returns ranked FallbackCandidate[] filtered to configured providers with tiered matching (capability+tier, then capability-only)
- FallbackResolver.inferCapabilities() defensively extracts toolCall, vision from request params; reasoning from explicit flag
- BudgetTracker.recordCost() stores micro-dollars via StorageBackend with monthly window, skips free calls
- BudgetTracker emits deduplicated budget:alert events at configured thresholds and budget:exceeded when cap hit

## Task Commits

Each task was committed atomically:

1. **Task 1: FallbackResolver - capability matching and provider ranking** - `4df19dd` (feat)
2. **Task 2: BudgetTracker - cost recording, threshold checking, events** - `c06ef1e` (feat)

## Files Created/Modified

- `src/fallback/FallbackResolver.ts` - FallbackResolver class with resolve(), inferCapabilities(), and isFreeModel helper
- `src/fallback/index.ts` - Barrel exports for FallbackResolver and all fallback types
- `src/budget/BudgetTracker.ts` - BudgetTracker class with recordCost(), getMonthlySpend(), isExceeded(), getRemainingBudget(), checkThresholds()
- `src/budget/index.ts` - Barrel exports for BudgetTracker and budget event types

## Decisions Made

- **Deterministic free model ordering:** Within free models, sort by provider name for deterministic ordering since FallbackResolver doesn't have direct access to per-provider usage/quota data. The FallbackProxy (Plan 03) handles actual quota-based selection among candidates from the same provider.
- **Micro-dollar storage repurposing:** Budget costs stored as micro-dollars (cost \* 1,000,000) in the promptTokens field of StorageBackend to avoid adding new methods to the interface. This keeps StorageBackend contract stable for Phase 10 adapters.
- **$0 budget = always exceeded:** When monthlyLimit is 0, isExceeded() returns true and getRemainingBudget() returns 0, effectively blocking all paid calls per CONTEXT.md specification.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- FallbackResolver importable from `src/fallback/index.ts` with full type safety
- BudgetTracker importable from `src/budget/index.ts` with full type safety
- Both classes ready for orchestration in Plan 03 (FallbackProxy)
- FallbackProxy will wire: catch errors from retry proxy -> query FallbackResolver -> check BudgetTracker -> create per-provider retry proxies

---

_Phase: 09-fallback-budget-management_
_Completed: 2026-03-14_
