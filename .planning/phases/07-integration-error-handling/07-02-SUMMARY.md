---
phase: 07-integration-error-handling
plan: 02
subsystem: wrapper
tags: [retry, proxy, key-rotation, error-handling, vercel-ai-sdk, languagemodelv3]

# Dependency graph
requires:
  - phase: 07-integration-error-handling
    provides: error classification (classifyError, shouldRetry, buildFinalError, ProviderError)
provides:
  - createRetryProxy() function returning LanguageModelV3-compatible object
  - Transparent key rotation on 429/auth errors in doGenerate and doStream
  - Updated wrapModel() with retry proxy integration
  - Middleware keyIndexRef pattern for correct post-retry usage tracking
  - Shared disabledKeys Set for router session lifetime
affects: [fallback-chains, provider-integration, testing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    [retry-proxy-pattern, mutable-keyIndexRef, fire-and-forget-events, no-APICallError-throws]

key-files:
  created:
    - src/wrapper/retry-proxy.ts
  modified:
    - src/wrapper/middleware.ts
    - src/wrapper/router-model.ts
    - src/wrapper/index.ts
    - src/config/index.ts

key-decisions:
  - 'Mutable keyIndexRef pattern for middleware to track correct key after retry'
  - 'disabledKeys Set in createRouter scope shared across all wrapModel calls'
  - 'routerModel() kept simple without retry proxy (retry available via router.wrapModel())'
  - 'ErrorEventPayload interface to avoid index signature access under exactOptionalPropertyTypes'

patterns-established:
  - 'Mutable ref pattern: { current: number } shared between proxy and middleware for post-retry state sync'
  - 'Fire-and-forget event emission: try/catch around every emitter.emit() call'
  - 'getNextKey helper: keySelector re-selection with tried/disabled key filtering'

requirements-completed: [INTG-02, INTG-05]

# Metrics
duration: 5m 17s
completed: 2026-03-13
---

# Phase 7 Plan 02: Retry Proxy Summary

**Retry proxy with transparent key rotation on provider errors, wired into router.wrapModel() with mutable keyIndex tracking for correct post-retry usage recording**

## Performance

- **Duration:** 5m 17s
- **Started:** 2026-03-13T19:06:14Z
- **Completed:** 2026-03-13T19:11:31Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Built createRetryProxy() returning LanguageModelV3-compatible proxy with doGenerate/doStream retry logic
- Integrated retry proxy into router.wrapModel() with shared disabledKeys Set and mutable keyIndexRef
- Updated middleware from plain keyIndex to keyIndexRef.current for correct post-retry usage tracking
- All 83 existing tests pass with no regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Create retry proxy with key rotation** - `28cbb6f` (feat)
2. **Task 2: Integrate retry proxy into wrapModel and fix middleware keyIndex tracking** - `bb76d0e` (feat)

## Files Created/Modified

- `src/wrapper/retry-proxy.ts` - createRetryProxy() function with doGenerate/doStream retry logic, key rotation, event emission
- `src/wrapper/middleware.ts` - Updated to accept keyIndexRef (mutable ref) instead of plain keyIndex
- `src/wrapper/router-model.ts` - Updated to keyIndexRef pattern, added note about retry via router.wrapModel()
- `src/config/index.ts` - Integrated retry proxy, added disabledKeys Set, imported createRetryProxy
- `src/wrapper/index.ts` - Added createRetryProxy and RetryProxyOptions exports

## Decisions Made

- **Mutable keyIndexRef pattern:** Shared `{ current: number }` object between retry proxy and middleware so middleware records usage against the key that actually succeeded after retries, not the initial key.
- **disabledKeys in createRouter scope:** Auth-failed keys (401/403) persist across multiple wrapModel() calls within the same router instance, preventing repeated attempts with known-bad keys.
- **routerModel() without retry:** The standalone convenience function remains simple. Retry support is available through `router.wrapModel()` which has access to all retry dependencies.
- **ErrorEventPayload interface:** Created a typed interface for error event payloads to avoid index signature access issues under `exactOptionalPropertyTypes`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed index signature access under exactOptionalPropertyTypes**

- **Found during:** Task 1 (retry proxy creation)
- **Issue:** Using `Record<string, unknown>` for error payload caused TS4111 error when accessing `.statusCode` property (must use bracket notation for index signatures)
- **Fix:** Created typed `ErrorEventPayload` interface and `buildErrorPayload()` helper function
- **Files modified:** src/wrapper/retry-proxy.ts
- **Verification:** `npx tsc --noEmit` passes cleanly (no new errors)
- **Committed in:** 28cbb6f (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Necessary for TypeScript strict mode compliance. No scope creep.

## Issues Encountered

None - plan executed as specified with one minor TypeScript strictness adaptation.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 7 complete: error classification (Plan 01) + retry proxy (Plan 02) deliver INTG-02, INTG-03, INTG-05
- Retry proxy transparently rotates keys on 429/auth failures
- doStream retries on setup errors only (no mid-stream retry per user decision)
- All errors thrown are PennyLLMError subclasses (no AI SDK double-retry)
- Ready for Phase 8 (provider integration testing) or Phase 9 (fallback chains)

---

_Phase: 07-integration-error-handling_
_Completed: 2026-03-13_
