---
phase: 05-model-catalog-selection
plan: 03
subsystem: selection
tags: [strategies, coordinator, cooldown, events]
dependency_graph:
  requires: [05-00, 05-01]
  provides: [selection-strategies, key-selector, exponential-backoff]
  affects: [phase-06-ai-sdk-integration]
tech_stack:
  added: []
  patterns: [strategy-pattern, event-emission, exponential-backoff]
key_files:
  created:
    - src/selection/strategies/priority.ts
    - src/selection/strategies/round-robin.ts
    - src/selection/strategies/least-used.ts
    - src/selection/KeySelector.ts
  modified:
    - src/usage/cooldown.ts
    - src/selection/index.ts
    - src/selection/strategies/round-robin.test.ts
    - src/selection/strategies/least-used.test.ts
    - src/selection/KeySelector.test.ts
decisions:
  - Synchronous strategies return Promise.resolve() to satisfy SelectionStrategy interface without async/await
  - exactOptionalPropertyTypes requires explicit undefined handling for optional fields (nextReset, model, estimatedTokens)
  - Custom strategy functions wrapped in async adapter to normalize return type
  - Single-key short-circuit skips strategy logic for performance
  - provider:exhausted event emitted before throwing error for observability
metrics:
  duration: 434s
  tasks_completed: 2
  commits: 2
  files_created: 4
  files_modified: 5
  tests_added: 4
  tests_passing: 83
  completed_date: '2026-03-13'
---

# Phase 5 Plan 03: Selection Strategies & KeySelector Summary

**One-liner:** Built-in selection strategies (priority, round-robin, least-used) with KeySelector coordinator orchestrating policy evaluation, cooldown checking, exponential backoff, and event emission.

## What Was Built

**Task 1: Three built-in strategies + exponential backoff**

- PriorityStrategy: Selects first eligible key in config order with pre-flight headroom check for estimated tokens
- RoundRobinStrategy: Stateful cycling per provider with modulo indexing
- LeastUsedStrategy: Worst-case remaining percentage comparison across all time windows
- CooldownManager enhancements:
  - Exponential backoff (2^failures multiplier) applied to default cooldown only
  - Retry-After header respected without cap (no exponential backoff when header present)
  - onSuccess() method resets consecutive failure count to 0 and clears cooldown
  - clearAll() and clear() also clear consecutiveFailures map

**Task 2: KeySelector coordinator + smoke tests**

- KeySelector class orchestrates:
  - Strategy resolution: per-request override → per-provider config → global default
  - Candidate list building: evaluates all keys via PolicyEngine + CooldownManager
  - Single-key short-circuit: skips strategy logic for 1-key providers
  - Custom strategy support: accepts function or object, falls back to default on error
  - Event emission: key:selected (every selection), provider:exhausted (before error)
  - Error handling: throws RateLimitError (all cooldown) or QuotaExhaustedError (all exhausted)
  - Selection metrics: in-memory tracking via getSelectionStats()/resetStats()
- Smoke tests:
  - round-robin.test.ts: Verifies even distribution across 100 requests (~33 per key)
  - least-used.test.ts: Verifies highest remaining percentage selected
  - KeySelector.test.ts: Verifies cooldown skipping and RateLimitError on all-cooldown

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

**TypeScript compilation:** Passed (exactOptionalPropertyTypes handled correctly)
**Tests:** 83 passing (4 new smoke tests, 38 todos for future coverage)
**Lint:** Passed (Promise.resolve() used instead of async without await)

**Success criteria checklist:**

- [x] PriorityStrategy returns first eligible key in config order
- [x] RoundRobinStrategy cycles evenly across eligible keys per provider
- [x] LeastUsedStrategy selects by highest worst-case remaining percentage
- [x] KeySelector builds candidate list from PolicyEngine + CooldownManager
- [x] Single-key short-circuit works (skips strategy for 1-key providers)
- [x] Custom strategy accepted as function or object, errors fall back to default
- [x] key:selected event emitted with strategy name and reason
- [x] RateLimitError thrown when all keys in cooldown
- [x] QuotaExhaustedError thrown when all keys exhausted quota
- [x] Exponential backoff doubles cooldown on consecutive 429s

## Technical Notes

**exactOptionalPropertyTypes strictness:**

- Optional fields (nextReset, model, estimatedTokens) require explicit undefined checks
- Cannot pass `{ nextReset: string | undefined }` to `{ nextReset?: string }`
- Solution: Build objects conditionally with `if (value !== undefined) { obj.field = value; }`

**Strategy interface design:**

- Interface requires `selectKey(): Promise<SelectionResult>`
- Built-in strategies are synchronous (no I/O)
- ESLint rule `@typescript-eslint/require-await` prevents async without await
- Solution: Remove async keyword, return `Promise.resolve()` explicitly

**Custom strategy normalization:**

- Custom function can return `SelectionResult | Promise<SelectionResult>`
- Wrapped in async adapter: `result instanceof Promise ? result : Promise.resolve(result)`
- Ensures consistent Promise return type for KeySelector

## Integration Points

**Downstream (Phase 6):**

- KeySelector will be injected into Router class
- Router.selectKey() will call KeySelector.selectKey()
- Usage tracking will call CooldownManager.onSuccess() after successful LLM calls

**Events emitted:**

- `key:selected`: { provider, model, keyIndex, label, strategy, reason, timestamp, requestId }
- `provider:exhausted`: { provider, totalKeys, exhaustedCount, cooldownCount, earliestRecovery, timestamp }

## What's Next

**Plan 05-04 (Wave 2):** Router shell integration - wire KeySelector + UsageTracker into createRouter(), implement selectKey() public API, add getUsage() and resetUsage() methods.

## Self-Check

Verifying claims from summary:

**Created files exist:**

```bash
[ -f "src/selection/strategies/priority.ts" ] && echo "FOUND: src/selection/strategies/priority.ts"
[ -f "src/selection/strategies/round-robin.ts" ] && echo "FOUND: src/selection/strategies/round-robin.ts"
[ -f "src/selection/strategies/least-used.ts" ] && echo "FOUND: src/selection/strategies/least-used.ts"
[ -f "src/selection/KeySelector.ts" ] && echo "FOUND: src/selection/KeySelector.ts"
```

**Commits exist:**

```bash
git log --oneline --all | grep -q "a8604cc" && echo "FOUND: a8604cc"
git log --oneline --all | grep -q "fd17d02" && echo "FOUND: fd17d02"
```

**Self-Check: PASSED**

All created files exist:

- ✓ src/selection/strategies/priority.ts
- ✓ src/selection/strategies/round-robin.ts
- ✓ src/selection/strategies/least-used.ts
- ✓ src/selection/KeySelector.ts

All commits exist:

- ✓ a8604cc (Task 1: strategies + exponential backoff)
- ✓ fd17d02 (Task 2: KeySelector + test scaffolds)
