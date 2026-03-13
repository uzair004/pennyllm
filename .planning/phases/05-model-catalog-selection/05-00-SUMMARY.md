---
phase: 05-model-catalog-selection
plan: 00
subsystem: testing
tags: [vitest, test-scaffolds, tdd, phase-5]

# Dependency graph
requires:
  - phase: 04-usage-tracking-core
    provides: Testing patterns with Vitest and it.todo() placeholders
provides:
  - 4 test scaffold files with 47 pending test cases for Phase 5 behaviors
  - Test structure for DefaultModelCatalog with 24 test cases
  - Test structure for RoundRobinStrategy with 4 test cases
  - Test structure for LeastUsedStrategy with 4 test cases
  - Test structure for KeySelector with 15 test cases
affects: [05-01, 05-02, 05-03, 05-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Wave 0 test scaffold pattern with it.todo() for pending implementation'
    - 'Test-first behavior specification via todo test cases'

key-files:
  created:
    - src/catalog/DefaultModelCatalog.test.ts
    - src/selection/strategies/round-robin.test.ts
    - src/selection/strategies/least-used.test.ts
    - src/selection/KeySelector.test.ts
  modified: []

key-decisions:
  - "Used it.todo() for all test cases since implementation classes don't exist yet"
  - 'Created strategies subdirectory for selection strategy tests'
  - 'Followed Vitest pattern established in MemoryStorage.test.ts'

patterns-established:
  - 'Pattern 1: Wave 0 test scaffolds specify expected behaviors upfront before implementation'
  - 'Pattern 2: Test files only import vitest describe/it, avoiding unresolved module references'

requirements-completed:
  [CAT-01, CAT-02, CAT-03, CAT-04, CAT-05, ALGO-01, ALGO-02, ALGO-03, ALGO-04, ALGO-05]

# Metrics
duration: 6m 44s
completed: 2026-03-13
---

# Phase 5 Plan 00: Test Scaffolds for Model Catalog and Selection

**Created 47 pending test cases across 4 test files specifying all Phase 5 behavioral expectations for catalog refresh, selection strategies, and key selection logic**

## Performance

- **Duration:** 6m 44s
- **Started:** 2026-03-13T06:55:43Z
- **Completed:** 2026-03-13T07:02:27Z
- **Tasks:** 1
- **Files created:** 4

## Accomplishments

- Created DefaultModelCatalog.test.ts with 24 pending tests covering refresh, capabilities, quality tiers, pricing, offline fallback, filtering, and cleanup
- Created round-robin.test.ts with 4 pending tests for even distribution, per-provider state, skip ineligible, and reset logic
- Created least-used.test.ts with 4 pending tests for quota-aware selection, no-limit handling, tiebreakers, and skip ineligible
- Created KeySelector.test.ts with 15 pending tests for per-provider override, skip ineligible, custom strategies, single-key shortcircuit, and events

## Task Commits

Each task was committed atomically:

1. **Task 1: Create catalog and selection test scaffolds with pending cases** - `080563b` (test)

## Files Created/Modified

- `src/catalog/DefaultModelCatalog.test.ts` - Test scaffold with 24 it.todo() cases for catalog behaviors (refresh, capabilities, quality-tiers, pricing, offline-fallback, listModels, close)
- `src/selection/strategies/round-robin.test.ts` - Test scaffold with 4 it.todo() cases for round-robin even distribution and per-provider cycling
- `src/selection/strategies/least-used.test.ts` - Test scaffold with 4 it.todo() cases for least-used quota-aware selection
- `src/selection/KeySelector.test.ts` - Test scaffold with 15 it.todo() cases for key selection (per-provider override, skip ineligible, custom strategy, single-key shortcircuit, events)

## Decisions Made

**Created strategies directory:** The src/selection/strategies directory didn't exist, so it was created to hold the round-robin and least-used test files as specified in the plan.

**Test-only imports:** Test files import only from vitest (describe, it) and don't reference implementation types yet, avoiding compilation errors since the implementation classes don't exist. This follows the plan's guidance to use it.todo() for cases that cannot compile yet.

**Followed existing patterns:** Used the same Vitest test structure established in src/storage/MemoryStorage.test.ts (describe/it blocks, it.todo() for pending tests).

## Deviations from Plan

None - plan executed exactly as written. The strategies directory was created as a necessary prerequisite (not a deviation, just an implied step).

## Issues Encountered

None. All test files created successfully and run without errors under Vitest, showing 47 todo tests as expected.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Test scaffolds are in place and ready for implementation. Plans 05-02 and 05-03 can now reference these test files in their `<verify>` commands. The tests establish WHAT behaviors to validate, and implementation plans will fill in the actual test logic during execution.

## Self-Check: PASSED

All claimed files and commits verified:

- ✓ src/catalog/DefaultModelCatalog.test.ts exists
- ✓ src/selection/strategies/round-robin.test.ts exists
- ✓ src/selection/strategies/least-used.test.ts exists
- ✓ src/selection/KeySelector.test.ts exists
- ✓ Commit 080563b exists in git history

---

_Phase: 05-model-catalog-selection_
_Completed: 2026-03-13_
