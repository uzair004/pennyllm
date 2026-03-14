---
phase: 09-fallback-budget-management
plan: 03
subsystem: api
tags: [fallback, proxy, affinity-cache, budget-gating, middleware, cross-provider, orchestration]

# Dependency graph
requires:
  - phase: 09-fallback-budget-management
    provides: FallbackResolver, BudgetTracker, AllProvidersExhaustedError, type contracts
  - phase: 07-error-retry
    provides: createRetryProxy, ProviderError, error classification
  - phase: 06-ai-sdk-integration
    provides: createRouterMiddleware, wrapLanguageModel, ProviderRegistry
provides:
  - createFallbackProxy() returning LanguageModelV3 with cross-provider fallback orchestration
  - AffinityCache class for short-term fallback resolution caching
  - Updated createRouterMiddleware with providerRef/modelIdRef for post-fallback tracking
  - Router.budget exposing BudgetTracker instance
  - Full createRouter() integration: wrapModel() -> middleware -> FallbackProxy -> RetryProxy
affects: [10-storage-adapters, 11-registry-defaults, 12-cli-playground]

# Tech tracking
tech-stack:
  added: []
  patterns:
    [
      fallback-proxy-pattern,
      provider-ref-tracking,
      shared-attempt-helper,
      affinity-cache-ttl,
      conditional-property-inclusion,
    ]

key-files:
  created:
    - src/fallback/FallbackProxy.ts
    - src/fallback/AffinityCache.ts
  modified:
    - src/fallback/index.ts
    - src/wrapper/middleware.ts
    - src/wrapper/router-model.ts
    - src/config/index.ts
    - src/index.ts

key-decisions:
  - 'PromiseLike callFn type: LanguageModelV3 methods return PromiseLike not Promise'
  - 'Stream results skip providerMetadata augmentation: LanguageModelV3StreamResult has no providerMetadata field'
  - 'Pass empty Map to resolvePolicies: retry proxy handles runtime 429s as safety net'
  - 'Provider config types as JSDoc aliases for IDE discoverability'

patterns-established:
  - 'FallbackProxy pattern: LanguageModelV3 proxy wrapping retry proxy with shared attemptWithFallback helper'
  - 'Provider-ref tracking: mutable { current: string } refs for providerRef/modelIdRef shared across proxy and middleware'
  - 'Affinity cache: 60s TTL cache avoids repeated resolution during burst traffic'
  - 'Budget gate pattern: check isExceeded() before trying paid fallback candidates'

requirements-completed: [CORE-04, CORE-05, CAT-06, CAT-07]

# Metrics
duration: 8m 54s
completed: 2026-03-14
---

# Phase 9 Plan 03: FallbackProxy Integration Summary

**Cross-provider fallback orchestration via FallbackProxy with budget gating, affinity caching, provider-ref middleware tracking, and full createRouter integration**

## Performance

- **Duration:** 8m 54s
- **Started:** 2026-03-14T15:24:17Z
- **Completed:** 2026-03-14T15:33:11Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- FallbackProxy wraps primary retry proxy and orchestrates cross-provider fallback on QuotaExhaustedError, RateLimitError, and server ProviderError
- Shared attemptWithFallback() helper eliminates code duplication between doGenerate and doStream
- Budget gate blocks paid fallback models when budget is exceeded, free models always allowed
- AffinityCache stores last successful fallback for 60s to avoid repeated resolution during burst traffic
- Middleware now uses providerRef/modelIdRef refs so usage is recorded against the provider that actually succeeded after fallback
- createRouter() creates FallbackResolver, BudgetTracker, AffinityCache at startup and wires them into wrapModel()
- Router.budget exposes BudgetTracker for external access (budget queries, alerts)
- wrapModel() accepts reasoning option for per-request capability inference
- BudgetTracker, FallbackResolver, AffinityCache, createFallbackProxy, ProviderError, AuthError, NetworkError all exported from package root

## Task Commits

Each task was committed atomically:

1. **Task 1: AffinityCache, FallbackProxy, and middleware provider-ref update** - `f3c2701` (feat)
2. **Task 2: Wire FallbackProxy and BudgetTracker into createRouter** - `8fe4f9b` (feat)

## Files Created/Modified

- `src/fallback/FallbackProxy.ts` - createFallbackProxy() with attemptWithFallback shared helper, isFallbackTrigger, budget gating, affinity cache, provider-ref updates
- `src/fallback/AffinityCache.ts` - Simple TTL cache for short-term fallback affinity (get/set/clear)
- `src/fallback/index.ts` - Added AffinityCache, createFallbackProxy, FallbackProxyDeps exports
- `src/wrapper/middleware.ts` - Changed from static provider/model strings to providerRef/modelIdRef mutable refs
- `src/wrapper/router-model.ts` - Updated routerModel() middleware call to use ref objects for backward compatibility
- `src/config/index.ts` - Added FallbackResolver/BudgetTracker/AffinityCache creation, FallbackProxy wiring in wrapModel(), Router.budget, reasoning option
- `src/index.ts` - Added BudgetTracker, FallbackResolver, AffinityCache, createFallbackProxy, ProviderError, AuthError, NetworkError exports

## Decisions Made

- **PromiseLike instead of Promise in callFn type:** LanguageModelV3 doGenerate/doStream return PromiseLike, not Promise. The shared attemptWithFallback helper's callFn parameter type reflects this.
- **Stream results skip providerMetadata augmentation:** LanguageModelV3StreamResult type does not have a providerMetadata field (only LanguageModelV3GenerateResult does). Stream fallback info is not augmented to avoid runtime errors.
- **Conditional property inclusion for exactOptionalPropertyTypes:** estimatedTokens and originalQualityTier built conditionally to satisfy strict TypeScript mode.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated config/index.ts middleware call in Task 1**

- **Found during:** Task 1 (middleware signature change)
- **Issue:** Changing createRouterMiddleware to accept providerRef/modelIdRef broke the existing call in config/index.ts, which was technically a Task 2 file
- **Fix:** Updated the middleware call in config/index.ts as part of Task 1 to keep tsc --noEmit passing
- **Files modified:** src/config/index.ts
- **Verification:** tsc --noEmit passes
- **Committed in:** f3c2701

---

**Total deviations:** 1 auto-fixed (1 blocking issue from cross-task dependency)
**Impact on plan:** Necessary for type correctness after middleware signature change. No scope creep.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 9 complete: all 3 plans executed
- Cross-provider fallback fully operational: wrapModel() -> middleware -> FallbackProxy -> RetryProxy -> provider API
- Budget tracking active for all paid calls through FallbackProxy
- Ready for Phase 10 (Storage Adapters) or Phase 11 (Registry Defaults)
- All 83 existing tests pass

---

_Phase: 09-fallback-budget-management_
_Completed: 2026-03-14_
