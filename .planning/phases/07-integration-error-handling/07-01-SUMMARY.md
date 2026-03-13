---
phase: 07-integration-error-handling
plan: 01
subsystem: errors
tags: [error-classification, retry-logic, api-errors, events, ai-sdk]

requires:
  - phase: 01-project-setup
    provides: LLMRouterError base class, TypeScript scaffolding
  - phase: 06-ai-sdk-integration
    provides: Vercel AI SDK wrapper layer, provider registry
provides:
  - AuthError, ProviderError, NetworkError error classes
  - classifyError() centralized error classification function
  - shouldRetry() retry decision function
  - buildFinalError() error wrapping function
  - makeAttemptRecord() attempt record builder
  - 7 new event payload interfaces for Phase 7 events
  - 7 new RouterEvent constants
  - ErrorType and AttemptRecord types
affects: [07-02-retry-proxy, 09-fallback-chains]

tech-stack:
  added: []
  patterns:
    - 'Error classification via APICallError.isInstance() (never instanceof)'
    - 'Exhaustive switch for ErrorType with default fallback'
    - 'Conditional property inclusion for exactOptionalPropertyTypes'

key-files:
  created:
    - src/errors/auth-error.ts
    - src/errors/provider-error.ts
    - src/errors/network-error.ts
    - src/wrapper/error-classifier.ts
  modified:
    - src/errors/index.ts
    - src/constants/index.ts
    - src/types/events.ts
    - src/types/index.ts
    - src/wrapper/index.ts

key-decisions:
  - 'Switch-based suggestion lookup instead of Record index for type safety under noUncheckedIndexedAccess'
  - 'Type stubs created before functions to satisfy cross-file imports within same plan'

patterns-established:
  - 'Error classification: classifyError() returns ClassifiedError with type discriminator'
  - 'Retry decisions: shouldRetry() is pure function of classified error and tried keys'
  - 'Error wrapping: buildFinalError() always returns LLMRouterError subclass, never APICallError'

requirements-completed: [INTG-03]

duration: 6min
completed: 2026-03-13
---

# Phase 7 Plan 01: Error Classification Foundation Summary

**Error classification system with 3 error classes, classifyError/shouldRetry functions, and 7 event types for retry proxy integration**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-13T18:56:51Z
- **Completed:** 2026-03-13T19:02:45Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Three new error classes (AuthError, ProviderError, NetworkError) with actionable suggestions and proper serialization
- classifyError() correctly maps APICallError status codes (429, 401/403, 500+) and Node.js network errors (ECONNREFUSED, ETIMEDOUT, etc.) to typed classifications
- shouldRetry() enforces user decisions: no server retry, single network retry, all-keys for rate_limit/auth
- buildFinalError() wraps in LLMRouterError subclasses (not APICallError) to prevent AI SDK double-retry
- 7 new event payload interfaces and RouterEvent constants ready for the retry proxy (Plan 02)

## Task Commits

Each task was committed atomically:

1. **Task 1: Error classes, event types, and RouterEvent constants** - `1cc1eb0` (feat)
2. **Task 2: Error classifier and retry decision functions** - `f056f31` (feat)

## Files Created/Modified

- `src/errors/auth-error.ts` - AuthError class for 401/403 failures
- `src/errors/provider-error.ts` - ProviderError with type discriminator and attempts array
- `src/errors/network-error.ts` - NetworkError for connection failures
- `src/wrapper/error-classifier.ts` - classifyError, shouldRetry, buildFinalError, makeAttemptRecord
- `src/errors/index.ts` - Updated exports with 3 new error classes
- `src/constants/index.ts` - 7 new RouterEvent constants
- `src/types/events.ts` - 7 new event payload interfaces added to RouterEventMap
- `src/types/index.ts` - New event types exported
- `src/wrapper/index.ts` - Classifier functions and types exported

## Decisions Made

- Used switch-based suggestion lookup in ProviderError instead of Record index, because noUncheckedIndexedAccess makes Record lookups possibly-undefined even when all keys are covered
- Created type stubs (ErrorType, AttemptRecord, ClassifiedError) in Task 1 so provider-error.ts import resolves before error-classifier.ts functions are written in Task 2

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created type stubs to resolve cross-file import**

- **Found during:** Task 1 (committing error classes)
- **Issue:** provider-error.ts imports ErrorType from error-classifier.ts which doesn't exist yet (Task 2). ESLint lint-staged fails on commit.
- **Fix:** Created error-classifier.ts with type definitions only, filled in functions in Task 2
- **Files modified:** src/wrapper/error-classifier.ts
- **Verification:** ESLint passes, commit succeeds
- **Committed in:** 1cc1eb0 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary to allow atomic commits. No scope creep.

## Issues Encountered

- ESLint noUncheckedIndexedAccess strict mode required switch-based pattern instead of Record lookup for ProviderError suggestions. Resolved with exhaustive switch + default case.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Error classification foundation complete, ready for Plan 02 (retry proxy)
- classifyError(), shouldRetry(), buildFinalError() all available for import
- Event types and constants ready for proxy to emit events
- All 83 existing tests pass with no regressions

---

_Phase: 07-integration-error-handling_
_Completed: 2026-03-13_
