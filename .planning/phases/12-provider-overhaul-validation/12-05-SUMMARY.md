---
phase: 12-provider-overhaul-validation
plan: 05
subsystem: chain-executor
tags: [chain, routing, proxy, observability, usage-tracking]
dependency_graph:
  requires: [12-02, 12-04]
  provides: [chain-executor, router-chat, router-get-status, rate-limit-observability]
  affects: [config, usage-tracker, provider-registry, events]
tech_stack:
  added: []
  patterns:
    [chain-walking-proxy, mutable-ref-sharing, factory-caching, fire-and-forget-observability]
key_files:
  created:
    - src/chain/ChainExecutor.ts
  modified:
    - src/chain/index.ts
    - src/config/index.ts
    - src/wrapper/provider-registry.ts
    - src/types/events.ts
    - src/debug/DebugLogger.ts
    - src/usage/types.ts
    - src/usage/UsageTracker.ts
decisions:
  - Chain proxy returns empty supportedUrls ({}) since LanguageModelV3 requires non-optional field
  - Provider factory cached by provider+key prefix to avoid repeated dynamic imports
  - ChainExecutor uses type-safe recordRateLimitEvent call (no runtime check needed)
  - ProviderRegistry extended with async factories rather than making sync factories async
  - Default registry kept for wrapModel legacy path, new async registry for chain path
metrics:
  duration: 9m 51s
  completed: 2026-03-17
---

# Phase 12 Plan 05: ChainExecutor & Router Integration Summary

ChainExecutor as deterministic chain-walking LanguageModelV3 proxy with cooldown-first gating, budget checks, and 429/402 observability fields in UsageTracker.

## What Was Built

### Task 1: ChainExecutor (src/chain/ChainExecutor.ts)

- `createChainProxy(deps, filter?)` returns LanguageModelV3 that walks the model chain on every doGenerate/doStream call
- `executeChain()` core loop: filter chain -> for each entry: check stale -> check cooldown -> check budget -> create retry proxy -> attempt call -> on success emit chain:resolved -> on failure classify error, record attempt, advance
- `getChainStatus(chain, cooldownManager)` reports per-entry status: available, cooling, depleted, stale
- Provider factory caching via module-level Map to avoid repeated dynamic imports
- Lazy ProviderRegistry initialization for retry proxy key rotation
- AllProvidersExhaustedError thrown when entire filtered chain exhausted

### Task 2: createRouter Refactoring (src/config/index.ts)

- `buildChain(config)` called at startup to create model priority chain
- `checkProviderStaleness()` runs at startup for all configured providers
- `loadPersistedCooldowns()` called at startup to restore cooldown state across restarts
- `router.chat(filter?)` returns LanguageModelV3 wrapped with usage-tracking middleware
- `router.getStatus()` returns ChainStatus with available/cooling/depleted/stale entries
- Router interface extended with `onChainResolved`, `onProviderDepleted`, `onProviderStale` hooks
- ProviderRegistry extended with `registerAsync()` and `getAsync()` for provider modules
- `createProviderInstanceAsync()` added for async provider creation
- DebugLogger wired to new chain/depleted/stale hooks

### Task 3: UsageTracker Rate Limit Observability

- `RateLimitStats` type: rateLimitHits, lastRateLimited, cooldownsTriggered, totalCooldownMs
- `KeyUsage.rateLimitStats` and `ProviderUsage.rateLimitStats` fields added
- `recordRateLimitEvent(provider, keyIndex, cooldownMs, cooldownTriggered)` method added
- `getUsage()` returns rate limit stats per key and per provider (defaults to zeros)
- `resetUsage()` clears rate limit stats along with other counters
- ChainExecutor calls `recordRateLimitEvent` on 429/402 errors for observability

## Event Types Added

- `ChainResolvedEvent`: resolvedModel, resolvedProvider, chainPosition, fallbackUsed, attempts, latencyMs
- `ProviderDepletedEvent`: provider, reason, cooldownClass
- `ProviderStaleEvent`: provider, lastVerified, daysSinceVerified, updateUrl

## Deviations from Plan

None -- plan executed exactly as written.

## Verification

- `npx tsc --noEmit` passes (only pre-existing rootDir test error)
- `npx vitest run` passes: 93 passed, 1 skipped, 38 todo
- router.chat() returns LanguageModelV3 proxy
- router.getStatus() returns ChainStatus
- chain:resolved event wired and emitted
- Provider staleness checked at startup
- Persisted cooldowns loaded at startup
- getUsage() includes rateLimitStats

## Commits

| Task | Commit  | Description                                             |
| ---- | ------- | ------------------------------------------------------- |
| 1    | e389f51 | ChainExecutor with chain-walking proxy                  |
| 2    | 24bd0dd | createRouter refactored with chain, chat(), getStatus() |
| 3    | 574e3bb | UsageTracker extended with rate limit observability     |
