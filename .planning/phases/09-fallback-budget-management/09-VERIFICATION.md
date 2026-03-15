---
phase: 09-fallback-budget-management
verified: 2026-03-14T20:45:00Z
status: passed
score: 25/25 must-haves verified
re_verification: false
---

# Phase 09: Fallback & Budget Management Verification Report

**Phase Goal:** Router enforces budget caps, handles exhaustion with capability-aware fallback to matching models (reasoning -> reasoning), and routes to cheapest paid options when budget allows

**Verified:** 2026-03-14T20:45:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                                   | Status     | Evidence                                                                                                                                   |
| --- | ----------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Fallback config section exists in schema with enabled, maxDepth, strictModel, behavior, modelMappings, reasoning fields | ✓ VERIFIED | `fallbackConfigSchema` in schema.ts lines 55-64 includes all required fields with defaults                                                 |
| 2   | Per-provider fallback behavior override exists in provider config schema                                                | ✓ VERIFIED | `providerFallbackOverrideSchema` in schema.ts lines 33-37, added to `providerConfigSchema` line 49                                         |
| 3   | Config validation rejects cheapest-paid behavior with $0 budget                                                         | ✓ VERIFIED | Cross-field `.refine()` validation in schema.ts lines 118-132 checks for cheapest-paid + $0 budget combo                                   |
| 4   | AllProvidersExhaustedError class includes attempts array, earliest recovery time, and actionable suggestion             | ✓ VERIFIED | Class in all-providers-exhausted-error.ts has `attempts` (line 8), `earliestRecovery` (line 9), and suggestion generation (lines 30-32)    |
| 5   | Budget event types (budget:alert, budget:exceeded) are defined with correct payloads                                    | ✓ VERIFIED | `BudgetAlertEvent` and `BudgetExceededEvent` in budget/types.ts lines 6-21, added to RouterEventMap in events.ts lines 196-197             |
| 6   | ProviderExhaustedEvent has exhaustionType field                                                                         | ✓ VERIFIED | Field defined in events.ts line 96 with union type 'cooldown' \| 'quota' \| 'mixed'                                                        |
| 7   | FallbackTriggeredEvent includes fromModel and toModel fields                                                            | ✓ VERIFIED | Fields defined in events.ts lines 75-76 as optional strings                                                                                |
| 8   | FallbackResolver finds capability-matching models from catalog filtered to configured providers only                    | ✓ VERIFIED | `resolve()` method calls `catalog.listModels()` with capability filter (lines 148, 169), then filters to `configuredProviders` (line 174)  |
| 9   | Tiered matching tries same quality tier first, then relaxes to any tier                                                 | ✓ VERIFIED | Tier 1 query with `qualityTier` filter (line 148), fallback to Tier 2 without tier filter (line 169)                                       |
| 10  | Ranking orders free providers first (most remaining quota), then cheapest paid                                          | ✓ VERIFIED | Sorting logic in FallbackResolver.ts lines 186-201: free first, then unknown pricing, then cheapest paid by promptPer1MTokens              |
| 11  | Context window pre-check skips models that cannot fit estimated prompt size                                             | ✓ VERIFIED | Context window filtering in FallbackResolver.ts lines 179-181 filters out models where `contextWindow < estimatedTokens`                   |
| 12  | BudgetTracker records cost after paid calls using StorageBackend with monthly key pattern                               | ✓ VERIFIED | `recordCost()` method in BudgetTracker.ts calls `storage.increment('budget', 0, ...)` with MONTHLY_WINDOW (lines 83-89)                    |
| 13  | BudgetTracker emits budget:alert at configured thresholds and budget:exceeded when cap hit                              | ✓ VERIFIED | `checkThresholds()` emits BUDGET_ALERT (line 180) and BUDGET_EXCEEDED (line 197) events with proper payloads                               |
| 14  | Free calls are NOT tracked in budget                                                                                    | ✓ VERIFIED | `recordCost()` returns early if pricing is all zeros (lines 64-66)                                                                         |
| 15  | Missing pricing models pass through with warning event                                                                  | ✓ VERIFIED | `recordCost()` logs warning and returns early if pricing is null (lines 58-61)                                                             |
| 16  | When primary provider is exhausted, router automatically tries alternative providers                                    | ✓ VERIFIED | `attemptWithFallback()` in FallbackProxy.ts catches fallback-triggerable errors (line 164) and iterates through candidates (lines 255-300) |
| 17  | Fallback respects per-provider behavior config (auto, hard-stop, cheapest-paid)                                         | ✓ VERIFIED | `getProviderBehavior()` helper (lines 76-80) checks provider override then falls back to global config                                     |
| 18  | Default behavior is try-alternatives, hard-stop is opt-in                                                               | ✓ VERIFIED | `fallbackConfigSchema` defaults `behavior` to 'auto' (line 60), hard-stop check in FallbackProxy line 150                                  |
| 19  | Same-provider keys are exhausted first (via retry proxy) before cross-provider fallback                                 | ✓ VERIFIED | Primary call goes through `primaryRetryProxy` (line 157), cross-provider fallback only triggered on terminal errors                        |
| 20  | Middleware records usage against the provider/key that actually succeeded (not original)                                | ✓ VERIFIED | Middleware uses `providerRef.current` (lines 36, 68) which is updated on fallback success (FallbackProxy line 273)                         |
| 21  | Response metadata includes fallback info via providerMetadata without breaking AI SDK contract                          | ✓ VERIFIED | FallbackProxy augments `result.providerMetadata['pennyllm']` with fallback info (lines 425-431 in full file)                               |
| 22  | All providers exhausted throws AllProvidersExhaustedError with rich recovery info                                       | ✓ VERIFIED | `AllProvidersExhaustedError` thrown at FallbackProxy line 304 with `triedProviders` array                                                  |
| 23  | Budget gate blocks paid fallback models when budget is exceeded                                                         | ✓ VERIFIED | Budget check in FallbackProxy lines 257-263: skips paid models when `budgetTracker.isExceeded()` returns true                              |
| 24  | Short-term affinity cache avoids repeated resolution during burst traffic                                               | ✓ VERIFIED | `AffinityCache` class with 60s TTL, used in FallbackProxy (affinity key check line 200+, set on success line 277+)                         |
| 25  | Server errors (500) on primary also trigger cross-provider fallback                                                     | ✓ VERIFIED | `isFallbackTrigger()` includes `ProviderError` with `errorType === 'server'` (line 69)                                                     |

**Score:** 25/25 truths verified

### Required Artifacts

| Artifact                                      | Expected                                                                                                                                  | Status     | Details                                                                                                                                               |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/fallback/types.ts`                       | FallbackConfig, FallbackCandidate, ProviderAttempt, AffinityEntry, FallbackProxyOptions, ProviderFallbackOverride, FallbackBehavior types | ✓ VERIFIED | All types defined with proper fields, 76 lines, exports all required interfaces                                                                       |
| `src/budget/types.ts`                         | BudgetAlertEvent, BudgetExceededEvent interfaces                                                                                          | ✓ VERIFIED | Both event interfaces defined extending RouterEventPayload, 22 lines                                                                                  |
| `src/errors/all-providers-exhausted-error.ts` | AllProvidersExhaustedError with ProviderAttempt tracking                                                                                  | ✓ VERIFIED | Complete error class with attempts, earliestRecovery computation, actionable suggestion, 59 lines                                                     |
| `src/config/schema.ts`                        | fallbackConfigSchema and providerFallbackOverrideSchema with cross-field validation                                                       | ✓ VERIFIED | Both schemas defined with defaults, cross-field refine validates cheapest-paid + $0 budget (lines 118-132)                                            |
| `src/fallback/FallbackResolver.ts`            | FallbackResolver class with resolve() and inferCapabilities() methods                                                                     | ✓ VERIFIED | Complete class with tiered matching, capability inference, ranking logic, 221 lines                                                                   |
| `src/budget/BudgetTracker.ts`                 | BudgetTracker class with recordCost(), getMonthlySpend(), isExceeded(), getRemainingBudget() methods                                      | ✓ VERIFIED | Complete class with micro-dollar storage, threshold checking, event emission, 211 lines                                                               |
| `src/fallback/FallbackProxy.ts`               | createFallbackProxy() returning LanguageModelV3 that orchestrates cross-provider fallback                                                 | ✓ VERIFIED | Complete proxy with attemptWithFallback shared helper, budget gating, affinity cache, provider-ref updates, 493 lines                                 |
| `src/fallback/AffinityCache.ts`               | AffinityCache class with get/set/TTL                                                                                                      | ✓ VERIFIED | Simple TTL cache implementation, 27 lines                                                                                                             |
| `src/wrapper/middleware.ts`                   | Updated createRouterMiddleware with providerRef and modelIdRef for fallback tracking                                                      | ✓ VERIFIED | Signature changed from static strings to refs (lines 13, 15), used in tracker.record calls (lines 36, 68)                                             |
| `src/config/index.ts`                         | Updated createRouter().wrapModel() with FallbackProxy wrapping retry proxy                                                                | ✓ VERIFIED | FallbackResolver, BudgetTracker, AffinityCache created (lines 156-158), FallbackProxy wired in wrapModel (line 312), Router.budget exposed (line 355) |
| `src/fallback/index.ts`                       | Barrel exports for fallback module                                                                                                        | ✓ VERIFIED | Exports FallbackResolver, AffinityCache, createFallbackProxy, and all types                                                                           |
| `src/budget/index.ts`                         | Barrel exports for budget module                                                                                                          | ✓ VERIFIED | Exports BudgetTracker and event types                                                                                                                 |
| `src/constants/index.ts`                      | BUDGET_ALERT, BUDGET_EXCEEDED RouterEvent constants                                                                                       | ✓ VERIFIED | Constants defined in RouterEvent object (lines 43-44)                                                                                                 |
| `src/types/events.ts`                         | Updated event map with budget:alert, budget:exceeded events                                                                               | ✓ VERIFIED | BudgetAlertEvent and BudgetExceededEvent imported and re-exported, added to RouterEventMap (lines 196-197) and RouterEvents union (lines 221-222)     |
| `src/index.ts`                                | AllProvidersExhaustedError, BudgetTracker, FallbackResolver, AffinityCache, createFallbackProxy exported from package root                | ✓ VERIFIED | All exports present (lines 33, 36, 135)                                                                                                               |

### Key Link Verification

| From                                          | To                                   | Via                                                                | Status  | Details                                                                                      |
| --------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------ | ------- | -------------------------------------------------------------------------------------------- |
| `src/config/schema.ts`                        | `src/fallback/types.ts`              | Zod schema output maps to FallbackConfig interface                 | ✓ WIRED | fallbackConfigSchema output type matches FallbackConfig interface fields                     |
| `src/errors/all-providers-exhausted-error.ts` | `src/fallback/types.ts`              | Uses ProviderAttempt interface                                     | ✓ WIRED | Import on line 1, used in constructor parameter and class property                           |
| `src/fallback/FallbackResolver.ts`            | `src/catalog/DefaultModelCatalog.ts` | catalog.listModels() with capability and qualityTier filters       | ✓ WIRED | Calls catalog.listModels on lines 148 and 169 with ModelListFilter                           |
| `src/budget/BudgetTracker.ts`                 | `src/storage/MemoryStorage.ts`       | storage.increment() and storage.getUsage() with budget key pattern | ✓ WIRED | Calls storage.increment (line 83) and storage.getUsage (line 105) with 'budget' provider     |
| `src/budget/BudgetTracker.ts`                 | `src/types/events.ts`                | emitter.emit() for budget:alert and budget:exceeded events         | ✓ WIRED | emitter.emit calls with RouterEvent.BUDGET_ALERT (line 180) and BUDGET_EXCEEDED (line 197)   |
| `src/fallback/FallbackProxy.ts`               | `src/wrapper/retry-proxy.ts`         | createRetryProxy() for each fallback provider                      | ✓ WIRED | Import on line 14, call on line 382 with full RetryProxyOptions                              |
| `src/fallback/FallbackProxy.ts`               | `src/fallback/FallbackResolver.ts`   | resolver.resolve() for finding alternative models                  | ✓ WIRED | Call on line 247 with originalModelId and ResolveOptions                                     |
| `src/fallback/FallbackProxy.ts`               | `src/budget/BudgetTracker.ts`        | budgetTracker.isExceeded() for paid model gating                   | ✓ WIRED | Calls isExceeded (line 257) and getRemainingBudget (line 239)                                |
| `src/config/index.ts`                         | `src/fallback/FallbackProxy.ts`      | createFallbackProxy() wraps retry proxy in wrapModel()             | ✓ WIRED | Import on line 26, call on line 312 with FallbackProxyDeps                                   |
| `src/wrapper/middleware.ts`                   | `src/config/index.ts`                | providerRef.current used instead of static provider string         | ✓ WIRED | Middleware signature changed (lines 13, 15), config passes refs (lines 321-323 in full file) |

### Requirements Coverage

| Requirement | Source Plan  | Description                                                                                                      | Status      | Evidence                                                                                                                                                             |
| ----------- | ------------ | ---------------------------------------------------------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CORE-04     | 09-01, 09-03 | Router enforces hard-stop when all keys for a provider are exhausted                                             | ✓ SATISFIED | AllProvidersExhaustedError thrown when all fallback attempts exhausted (FallbackProxy line 304)                                                                      |
| CORE-05     | 09-01, 09-03 | User can configure fallback behavior per provider (hard stop, cheapest paid model, or alternative free provider) | ✓ SATISFIED | Per-provider fallback override in schema.ts lines 33-37, getProviderBehavior() checks override (FallbackProxy lines 76-80)                                           |
| CORE-06     | 09-01, 09-03 | User can set monthly budget cap including $0 (never spend money)                                                 | ✓ SATISFIED | budgetConfigSchema with monthlyLimit (schema.ts line 70), BudgetTracker.isExceeded() returns true when limit is 0 (BudgetTracker.ts lines 114-118)                   |
| DX-05       | 09-01, 09-02 | Budget alerts notify via hooks when usage reaches configurable thresholds (e.g., 80%, 95%)                       | ✓ SATISFIED | BudgetTracker.checkThresholds() emits budget:alert at configured thresholds with deduplicated Set tracking (BudgetTracker.ts lines 174-185)                          |
| CAT-06      | 09-02, 09-03 | Fallback routing respects model capabilities (reasoning model falls back to reasoning, not generic)              | ✓ SATISFIED | FallbackResolver.inferCapabilities() extracts capabilities from params (FallbackResolver.ts lines 60-86), resolve() filters catalog by requiredCaps (lines 148, 169) |
| CAT-07      | 09-02, 09-03 | Fallback routing prefers cheapest matching model when budget allows paid usage                                   | ✓ SATISFIED | Candidate ranking in FallbackResolver sorts free first, then cheapest paid by promptPer1MTokens (FallbackResolver.ts lines 186-201)                                  |

### Anti-Patterns Found

None detected. All modified files have:

- No TODO/FIXME/PLACEHOLDER comments
- No empty implementations or stub functions
- No console.log-only handlers
- All key logic implemented with proper error handling

### Human Verification Required

#### 1. Cross-Provider Fallback End-to-End Flow

**Test:** Configure router with 2 providers (e.g., Google with exhausted quota, Groq with available quota). Make a request for a reasoning-capable model. Verify router automatically falls back to Groq when Google is exhausted.

**Expected:**

- Request succeeds using Groq provider
- `fallback:triggered` event emitted with `fromProvider: 'google'`, `toProvider: 'groq'`, `fromModel`, `toModel` fields
- Response metadata includes `pennyllm.fallbackUsed: true`, `pennyllm.originalModel`, `pennyllm.actualModel`

**Why human:** Requires live API keys, actual quota exhaustion scenario, and verification of event emission timing

#### 2. Budget Alert Threshold Behavior

**Test:** Configure router with $10 monthly budget and thresholds [0.8, 0.95]. Make paid requests until budget reaches 80%, then 95%, then 100%. Listen for `budget:alert` and `budget:exceeded` events.

**Expected:**

- `budget:alert` fires once at 80% with threshold=0.8, spent=$8, remaining=$2
- `budget:alert` fires once at 95% with threshold=0.95, spent=$9.50, remaining=$0.50
- `budget:exceeded` fires when spent >= $10 with lastRequestCost
- Subsequent paid fallback candidates are skipped (budget gate blocks them)

**Why human:** Requires actual paid API calls, cost accumulation over time, and event listener setup

#### 3. Capability-Aware Fallback Matching

**Test:** Make a request with `tools` parameter (requires toolCall capability). Primary provider exhausted. Verify fallback only considers models with `toolCall: true` capability.

**Expected:**

- FallbackResolver returns only candidates with matching capabilities
- Non-matching models are filtered out
- Request succeeds with a tool-capable model or throws AllProvidersExhaustedError if none available

**Why human:** Requires setting up providers with different model capability profiles, verifying catalog filtering logic in production

#### 4. Affinity Cache Burst Traffic Optimization

**Test:** Configure router with fallback enabled. Make 10 rapid requests (within 60s) that all trigger fallback to the same alternative provider. Verify FallbackResolver.resolve() is called only once (first request), subsequent requests use cached affinity.

**Expected:**

- First request: resolver.resolve() called, candidate selected, affinity cached
- Requests 2-10: affinity cache hit, resolver.resolve() NOT called
- After 60s TTL: affinity expires, next request re-resolves

**Why human:** Requires timing-sensitive burst traffic simulation, debug logging inspection to verify cache hits

#### 5. Cross-Field Validation: cheapest-paid + $0 budget

**Test:** Create router config with `budget.monthlyLimit: 0` and a provider with `fallback.behavior: 'cheapest-paid'`. Attempt to validate config.

**Expected:**

- Config validation throws Zod error with message: "Cannot use 'cheapest-paid' fallback behavior with $0 budget. Set budget.monthlyLimit > 0 or change fallback behavior."

**Why human:** Config validation behavior check, error message verification

---

## Verification Summary

**Status:** All automated checks passed. Phase 09 goal fully achieved.

**Key Achievements:**

- Complete fallback orchestration layer with capability-aware matching, budget gating, and affinity caching
- Budget tracking with micro-dollar storage repurposing, threshold alerts, and $0 enforcement
- Comprehensive type contracts with cross-field validation
- Full integration into createRouter with provider-ref middleware tracking
- All 6 requirements (CORE-04, CORE-05, CORE-06, DX-05, CAT-06, CAT-07) satisfied

**Test Coverage:** npm run build succeeds, all 83 existing tests pass (per SUMMARY.md)

**Phase Goal Status:** ✓ ACHIEVED

The router now:

1. **Enforces budget caps:** BudgetTracker records all paid costs, emits alerts at thresholds, blocks paid calls when budget exceeded
2. **Handles exhaustion with capability-aware fallback:** FallbackResolver matches capabilities (reasoning -> reasoning), filters to configured providers, tries same quality tier first
3. **Routes to cheapest paid options when budget allows:** Candidate ranking prefers free models, then cheapest paid by price

All must-haves verified. No gaps found. Ready for Phase 10 (Storage Adapters).

---

_Verified: 2026-03-14T20:45:00Z_
_Verifier: Claude (gsd-verifier)_
