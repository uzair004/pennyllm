---
phase: 17-core-routing-fixes
verified: 2026-03-19T05:00:00Z
status: passed
score: 5/5 must-haves verified
re_verification: false
---

# Phase 17: Core Routing Fixes — Verification Report

**Phase Goal:** Routing engine correctly rotates keys, handles exhaustion gracefully, and isolates router instances
**Verified:** 2026-03-19
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                        | Status   | Evidence                                                                                                                                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | A 402 credit-exhaustion error is never retried — shouldRetry returns false for it                            | VERIFIED | `error-classifier.ts` line 206-207: `case 'rate_limit': return classified.retryable;`. classifyError sets `retryable: false` for 402 (line 126), `retryable: true` for 429 (line 105).                                                                         |
| 2   | When all circuits are open, executeChain throws AllProvidersExhaustedError cleanly instead of stack overflow | VERIFIED | `ChainExecutor.ts` line 29: `const MAX_FORCE_HALFOPEN_DEPTH = 1;`. Line 375: guard `depth < MAX_FORCE_HALFOPEN_DEPTH`. Line 386: recursive call passes `depth + 1`. Max 1 recursive probe, then falls to clean throw at line 391.                              |
| 3   | Each retry attempt uses a different API key (factory receives and uses the new apiKey)                       | VERIFIED | `ChainExecutor.ts` line 435: `registry.registerAsync(providerId, (apiKey: string) => mod.createFactory(apiKey))` — each key gets its own factory via async path. `getOrCreateFactory` caches by `provider:apiKey.slice(0,8)` (line 64).                        |
| 4   | Two independently created router instances have separate factory caches and registries                       | VERIFIED | `_factoryCache` and `_registry` live on `ChainExecutorDeps` (lines 49-51), not at module level. No `const factoryCache = new Map` at module scope remains.                                                                                                     |
| 5   | getNextKey uses createProviderInstanceAsync so async-registered providers work                               | VERIFIED | `retry-proxy.ts` line 7: `import { createProviderInstanceAsync } from './provider-registry.js';`. Line 432: `const model = await createProviderInstanceAsync(registry, provider, modelName, apiKey);`. No bare `createProviderInstance` (sync) import present. |

**Score: 5/5 truths verified**

---

## Required Artifacts

| Artifact                           | Provides                                                                      | Status   | Details                                                                                                                                                            |
| ---------------------------------- | ----------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/wrapper/error-classifier.ts`  | shouldRetry respects retryable field for rate_limit type                      | VERIFIED | Line 207: `return classified.retryable;` inside `case 'rate_limit':`. Substantive implementation confirmed.                                                        |
| `src/chain/ChainExecutor.ts`       | Bounded recursion in executeChain; instance-scoped factory cache and registry | VERIFIED | `MAX_FORCE_HALFOPEN_DEPTH = 1` at line 29; depth guard at line 375; `_factoryCache`/`_registry` on deps interface (lines 49-51); `registerAsync` call at line 435. |
| `src/wrapper/retry-proxy.ts`       | Async provider instance creation in getNextKey                                | VERIFIED | Imports `createProviderInstanceAsync` (line 7), uses it at line 432. No sync `createProviderInstance` remains in this file.                                        |
| `src/wrapper/provider-registry.ts` | ProviderRegistry with async factory support                                   | VERIFIED | `registerAsync` at line 53, `getAsync` at line 61, `createProviderInstanceAsync` function at line 90. Both sync and async paths present.                           |

---

## Key Link Verification

| From                              | To                                 | Via                                          | Status | Details                                                                                                                                                                                              |
| --------------------------------- | ---------------------------------- | -------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/wrapper/error-classifier.ts` | `src/wrapper/retry-proxy.ts`       | shouldRetry called in retry loop             | WIRED  | `retry-proxy.ts` imports `shouldRetry` (line 8-13) and calls it at lines 199 and 327 inside `doGenerate` and `doStream` loops.                                                                       |
| `src/chain/ChainExecutor.ts`      | `src/health/HealthScorer.ts`       | forceNearestHalfOpen triggers bounded retry  | WIRED  | `ChainExecutor.ts` line 379: `deps.healthScorer.forceNearestHalfOpen(chainProviders)` inside the `depth < MAX_FORCE_HALFOPEN_DEPTH` guard.                                                           |
| `src/chain/ChainExecutor.ts`      | `src/providers/google.ts`          | mod.createFactory(apiKey) called per-key     | WIRED  | Line 435: `registry.registerAsync(providerId, (apiKey: string) => mod.createFactory(apiKey))` — createFactory called with actual apiKey at each registry lookup, not pre-baked at registration time. |
| `src/wrapper/retry-proxy.ts`      | `src/wrapper/provider-registry.ts` | createProviderInstanceAsync for key rotation | WIRED  | Line 7 import, line 432 call: `await createProviderInstanceAsync(registry, provider, modelName, apiKey)`.                                                                                            |
| `src/chain/ChainExecutor.ts`      | `src/wrapper/provider-registry.ts` | registerAsync for async factory support      | WIRED  | Line 435: `registry.registerAsync(...)`. Registry imported via dynamic import at line 417.                                                                                                           |

---

## Requirements Coverage

| Requirement | Source Plan   | Description                                                                | Status    | Evidence                                                                                                                                               |
| ----------- | ------------- | -------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ROUTE-01    | 17-02-PLAN.md | Key rotation uses distinct API keys per retry attempt                      | SATISFIED | `registerAsync` + `createProviderInstanceAsync` path ensures each retry key triggers a fresh `mod.createFactory(apiKey)` call with the actual new key. |
| ROUTE-02    | 17-01-PLAN.md | All-circuits-open produces AllProvidersExhaustedError (not stack overflow) | SATISFIED | `MAX_FORCE_HALFOPEN_DEPTH = 1` bounds recursion; clean throw at line 391 after depth guard.                                                            |
| ROUTE-03    | 17-02-PLAN.md | Multiple router instances maintain independent state                       | SATISFIED | `_factoryCache` and `_registry` are fields on `ChainExecutorDeps` — each router instance that creates its own `deps` object gets isolated state.       |
| ROUTE-04    | 17-01-PLAN.md | 402 credit exhaustion errors are not retried                               | SATISFIED | `shouldRetry` returns `classified.retryable` for `rate_limit` type; `classifyError` sets `retryable: false` for statusCode 402.                        |
| ROUTE-05    | 17-02-PLAN.md | getNextKey works for async-registered providers                            | SATISFIED | `getNextKey` calls `createProviderInstanceAsync` which tries async factories first (line 96-99 in provider-registry.ts), then falls back to sync.      |

All 5 requirements from REQUIREMENTS.md Phase 17 traceability table are covered. No orphaned requirements.

---

## TypeScript Compilation

The `tsc --noEmit` run returned 1 pre-existing error in `src/redis/RedisStorage.test.ts` — a rootDir import from `tests/contracts/storage.contract.js`. This error pre-dates phase 17, is documented in both plan summaries as out-of-scope, and does not affect any phase 17 artifacts. All phase 17 source files compile cleanly.

---

## Anti-Patterns Found

No anti-patterns found in any of the four modified files:

- No TODO/FIXME/placeholder comments
- No empty implementations (`return null`, `return {}`)
- No stub handlers
- All key functions have substantive implementations with real logic

---

## Human Verification Required

None. All verifiable behavior is testable through static analysis:

- The 402 non-retry path is deterministic and fully traceable through classifyError + shouldRetry.
- The recursion bound is a compile-time constant with clear guard logic.
- The per-key factory pattern is fully wired from registration to invocation.

---

## Summary

Phase 17 achieved its goal. All five routing correctness bugs are fixed:

1. **ROUTE-04 (402 not retried):** `shouldRetry` now delegates to `classified.retryable`, which is `false` for 402 and `true` for 429. The single-line change at `error-classifier.ts:207` correctly separates credit exhaustion from rate limiting.

2. **ROUTE-02 (no stack overflow):** `executeChain` accepts a `depth` parameter (default 0) and guards the `forceNearestHalfOpen` recursive call with `depth < MAX_FORCE_HALFOPEN_DEPTH` (= 1). The chain can probe exactly once before throwing `AllProvidersExhaustedError` cleanly.

3. **ROUTE-01 (per-key factories):** `getProviderRegistry` now calls `registry.registerAsync(id, (apiKey) => mod.createFactory(apiKey))` instead of pre-building a factory with the first key. Each `createProviderInstanceAsync` call invokes the async factory with the actual API key for that retry attempt.

4. **ROUTE-03 (instance isolation):** Module-level `factoryCache` and `cachedRegistry` singletons are removed. Both caches now live on `ChainExecutorDeps` as `_factoryCache` and `_registry`, scoped to the deps object per router instance.

5. **ROUTE-05 (async key path):** `getNextKey` in `retry-proxy.ts` imports and uses `createProviderInstanceAsync` (not the sync `createProviderInstance`), enabling providers registered via `registerAsync` to be resolved during key rotation.

All 4 commits are present in git history (d7583cf, 84ceea3, 4b0d960, bc6621b).

---

_Verified: 2026-03-19_
_Verifier: Claude (gsd-verifier)_
