---
phase: 12-provider-overhaul-validation
plan: 02
subsystem: error-handling
tags: [429, 402, cooldown, backoff, rate-limit, persistence]

requires:
  - phase: 04-usage-tracking
    provides: CooldownManager and UsageTracker foundation
  - phase: 07-error-handling
    provides: error-classifier and retry-proxy
provides:
  - Extended ClassifiedError with cooldownMs and cooldownClass fields
  - Provider-level cooldown tracking in CooldownManager
  - Escalating backoff with 15-minute cap
  - Permanent depletion detection (402 credit exhaustion)
  - StorageBackend persistence for cooldown state across restarts
affects: [12-03, 12-04, chain-executor, reactive-routing]

tech-stack:
  added: []
  patterns: [reactive-cooldown-classification, provider-level-tracking, fire-and-forget-persistence]

key-files:
  created: []
  modified:
    - src/wrapper/error-classifier.ts
    - src/usage/cooldown.ts
    - src/usage/UsageTracker.ts

key-decisions:
  - "MAX_COOLDOWN_MS raised from 5 to 15 minutes per CONTEXT.md user decision"
  - "Storage persistence uses synthetic UsageRecord with JSON-encoded cooldown data in id field"
  - "Provider cooldown persistence is fire-and-forget — never blocks the hot path"

patterns-established:
  - "Cooldown classification: short (<2min), long (>=2min), permanent (Infinity)"
  - "Provider-level vs per-key cooldown separation — ChainExecutor sets provider, RetryProxy sets per-key"
  - "loadPersistedCooldowns() called once at startup to restore cooldown state"

requirements-completed: [CORE-03]

duration: 5min
completed: 2026-03-17
---

# Phase 12 Plan 02: Reactive Cooldown Primitives Summary

**Error classifier extended with cooldown classification (429/402 parsing) and CooldownManager extended with provider-level tracking, escalating backoff, and StorageBackend persistence**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-17T07:38:05Z
- **Completed:** 2026-03-17T07:43:17Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Extended ClassifiedError with cooldownMs and cooldownClass fields for reactive routing decisions
- Added retry-after header parsing and x-ratelimit-reset-* header fallback for cooldown duration
- 402 responses now classify as permanent cooldown (credits exhausted, cooldownMs: Infinity)
- CooldownManager tracks provider-level cooldowns alongside existing per-key cooldowns
- Escalating backoff applies per-provider with 15-minute cap and resets on success
- Provider cooldown state persists to StorageBackend and survives restarts

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend error classifier with cooldown classification** - `891dd10` (feat)
2. **Task 2: Extend CooldownManager with provider-level tracking and persistence** - `f9d1b1f` (feat)

## Files Created/Modified
- `src/wrapper/error-classifier.ts` - Added CooldownClass type, cooldownMs/cooldownClass fields, parseRetryAfter/parseRateLimitReset helpers, 402 handling
- `src/usage/cooldown.ts` - Added provider-level cooldown tracking, escalating backoff, permanent depletion, StorageBackend persistence
- `src/usage/UsageTracker.ts` - Passes storage to CooldownManager constructor, exposes loadPersistedCooldowns

## Decisions Made
- MAX_COOLDOWN_MS raised from 5 to 15 minutes per CONTEXT.md user decision
- Cooldown persistence uses synthetic UsageRecord with JSON-encoded data in the id field to avoid changing StorageBackend interface
- Fire-and-forget pattern for persistence writes — cooldown hot path is synchronous, storage writes are async and non-blocking
- Provider-level cooldown is separate from per-key cooldown — ChainExecutor will call setProviderCooldown, RetryProxy continues using per-key setCooldown

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing lint errors in src/providers/*.ts files caused lint-staged to fail on commit. These are unrelated to the changes in this plan (provider files are from a parallel plan). Resolved by staging only the intended files.
- exactOptionalPropertyTypes required `storage: StorageBackend | undefined` instead of `storage?: StorageBackend` for the private field declaration.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Error classifier now produces cooldownMs and cooldownClass that ChainExecutor (Plan 03/04) will consume for reactive routing
- CooldownManager provider-level methods ready for ChainExecutor integration
- loadPersistedCooldowns() ready to be called from createRouter at startup

---
*Phase: 12-provider-overhaul-validation*
*Completed: 2026-03-17*
