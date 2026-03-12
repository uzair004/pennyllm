---
phase: 03-policy-engine
plan: 02
subsystem: policy
tags: [policy-engine, evaluation, events, staleness]
dependencies:
  requires: [03-01]
  provides: [policy-evaluation, limit-events, staleness-detection]
  affects: [config, router]
tech_stack:
  added: [PolicyEngine, EventEmitter]
  patterns: [async-evaluation, event-emission, deduplication]
key_files:
  created:
    - src/policy/PolicyEngine.ts
    - src/policy/staleness.ts
  modified:
    - src/config/index.ts
    - src/types/events.ts
    - src/types/index.ts
    - src/policy/index.ts
    - src/index.ts
decisions:
  - decision: Warning deduplication via Set
    rationale: Prevents event spam when limit stays above threshold
    impact: Each limit fires warning once until resetWarnings() called
  - decision: Exceeded events with no deduplication
    rationale: Ensures visibility every time limit is checked at 100%
    impact: Downstream can see repeated attempts against exhausted keys
  - decision: Conditional closestLimit inclusion
    rationale: exactOptionalPropertyTypes requires explicit undefined handling
    impact: Result object only includes closestLimit field when it exists
  - decision: estimatedTokens pre-check
    rationale: Prevents selecting keys that would immediately 429
    impact: Phase 5 selection can do pre-flight eligibility checks
metrics:
  duration: 4m 3s
  tasks_completed: 2/2
  files_created: 2
  files_modified: 5
  commits: 2
  tests_added: 0
  completed_at: 2026-03-12T21:01:58Z
---

# Phase 3 Plan 2: PolicyEngine Implementation Summary

**One-liner:** Async policy evaluation engine with limit checking, event emission, and staleness detection wired into createRouter

## What Was Built

Implemented the PolicyEngine class that evaluates API keys against resolved policies. The engine performs async read-only evaluation by querying storage for current usage across all limit types, calculates detailed limit status, emits warning/exceeded events with deduplication, and integrates with createRouter for automatic instantiation at startup.

### Task 1: PolicyEngine Class and Staleness Detection

Created `src/policy/PolicyEngine.ts`:

- Constructor accepts resolved policies, storage, emitter, and optional warningThreshold
- Builds O(1) lookup map keyed by `provider:keyIndex`
- `evaluate()` method queries all limits concurrently via `Promise.all()`
- Builds `LimitStatus` for each limit with current/max/remaining/percentUsed/resetAt
- Supports `estimatedTokens` parameter for pre-call token limit checking
- Warning event emission at threshold (default 80%) with Set-based deduplication
- Exceeded event emission at 100% usage (no deduplication)
- Helper methods: `getPolicy()`, `getAllPolicies()`, `resetWarnings()`
- Handles custom providers with no limits (always eligible)
- Handles empty limits arrays (always eligible)

Created `src/policy/staleness.ts`:

- `checkStaleness()` scans resolved policies for metadata.researchedDate
- Calculates days since research
- Emits `policy:stale` event for policies >30 days old
- Provider-level deduplication (fires once per provider)
- Suggests npm update or sourceUrl verification

### Task 2: Router Integration and Exports

Updated `src/config/index.ts`:

- Import PolicyEngine, resolvePolicies, shippedDefaults, checkStaleness
- Import EventEmitter from node:events
- createRouter now: creates EventEmitter, resolves policies, instantiates PolicyEngine
- Runs staleness check at startup
- Router interface extended with `policy: PolicyEngine` field
- `getConfig()` returns config with `resolvedPolicies` array
- `on()`/`off()` wired to real EventEmitter (not stubs)

Updated `src/types/events.ts`:

- Added `PolicyStaleEvent` to `RouterEventMap` under `policy:stale` key
- Re-exported PolicyStaleEvent type from policy/types.ts
- Added PolicyStaleEvent to RouterEvents union type

Updated exports:

- `src/policy/index.ts`: exports PolicyEngine and checkStaleness
- `src/index.ts`: exports PolicyEngine from policy module
- `src/types/index.ts`: exports PolicyStaleEvent type

## Verification

- ✅ `npx tsc --noEmit` compiles cleanly
- ✅ `npm test` passes all 74 tests (4 test files)
- ✅ PolicyEngine can be imported from `llm-router/policy` subpath
- ✅ createRouter returns Router with `.policy` field containing PolicyEngine
- ✅ Router `.on('limit:warning', handler)` registers on real EventEmitter
- ✅ PolicyEngine.evaluate() returns EvaluationResult with correct shape

## Deviations from Plan

None. Plan executed exactly as written.

## Outcomes

### Success Criteria Met

1. ✅ PolicyEngine.evaluate() returns rich EvaluationResult for any provider/key combination
2. ✅ Evaluation queries storage asynchronously, handles all limit types
3. ✅ limit:warning fires once at threshold crossing (deduplication works)
4. ✅ limit:exceeded fires when any limit hits 100%
5. ✅ estimatedTokens pre-check prevents selecting keys that would immediately 429
6. ✅ Staleness detection warns on policies >30 days old at startup
7. ✅ createRouter creates PolicyEngine automatically, exposes on Router
8. ✅ Events wired to real EventEmitter (not stubs)

### Key Capabilities Unlocked

- **Runtime policy evaluation**: Phase 4 usage tracking can check eligibility via `router.policy.evaluate()`
- **Pre-call optimization**: Phase 5 selection can use estimated tokens to avoid selecting exhausted keys
- **Event monitoring**: Users can listen to `limit:warning` and `limit:exceeded` for observability
- **Policy introspection**: `router.policy.getPolicy()` and `router.getConfig().resolvedPolicies` expose resolved state
- **Staleness alerts**: Automatic detection of outdated shipped policies at startup

## Technical Notes

### exactOptionalPropertyTypes Handling

With TypeScript's `exactOptionalPropertyTypes: true`, optional fields cannot be explicitly set to `undefined`. The `closestLimit?: LimitStatus` field in `EvaluationResult` required conditional inclusion:

```typescript
const result: EvaluationResult = { eligible, limits, enforcement };
if (closestLimit) {
  result.closestLimit = closestLimit;
}
```

This pattern appears in PolicyEngine.evaluate() to satisfy strict TypeScript mode.

### Event Deduplication Strategy

Warning events use a `Set<string>` keyed by `${provider}:${keyIndex}:${limitType}` to fire once per limit crossing. Exceeded events have no deduplication — they fire every time to ensure visibility of repeated attempts against exhausted keys.

### Concurrent Usage Queries

All limits for a policy are queried concurrently using `Promise.all()` to minimize evaluation latency. This scales well even with multiple limit types per key.

## Next Steps

Phase 3 complete. Next up: **Phase 4 - Usage Tracking & Recording** (Plans 04-01 and 04-02).

Plan 04-01 will implement the usage recording system that calls `storage.increment()` after LLM responses. Plan 04-02 will build the usage query/reporting API for `router.getUsage()`.

## Self-Check: PASSED

Verified created files exist:

- ✅ FOUND: src/policy/PolicyEngine.ts
- ✅ FOUND: src/policy/staleness.ts

Verified commits exist:

- ✅ FOUND: 9e358a1 (PolicyEngine implementation)
- ✅ FOUND: 4b255fb (Router integration)
