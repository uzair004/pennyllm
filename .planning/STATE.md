---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: Phase 4 (Usage Tracking Core)
status: executing
last_updated: '2026-03-13T03:15:13.714Z'
progress:
  total_phases: 12
  completed_phases: 3
  total_plans: 7
  completed_plans: 6
  percent: 86
---

# Project State: LLM Router

**Last updated:** 2026-03-13
**Current phase:** Phase 4 (Usage Tracking Core)
**Status:** In Progress

## Project Reference

**Core value:** Never get charged for LLM API calls — rotate through free tier keys intelligently so developers can experiment without burning cash.

**Current focus:** Phase 4 in progress. Building usage tracking foundation with calendar-aware periods, token estimation, and cooldown management.

## Current Position

**Phase:** 4 - Usage Tracking Core
**Plan:** 04-01 complete (1/2 plans done)
**Status:** In Progress
**Progress:** [█████████░] 86%

## Performance Metrics

### Velocity

- **Phases completed:** 3/12
- **Plans completed:** 6/7 (Phase 1: 2/2, Phase 2: 1/1, Phase 3: 2/2, Phase 4: 1/2)
- **Average plan duration:** 6m 53s (6 plans: 9m 39s, 8m 6s, 10m 26s, 3m 35s, 4m 3s, 6m 47s)
- **Estimated completion:** Phase 4 in progress (1/2 plans complete)

### Quality

- **Requirements coverage:** 55/55 (100%)
- **Success criteria defined:** 4-10 per phase (all phases)
- **Validation gates:** 2 research milestones identified (Phase 6, Phase 8)

### Efficiency

- **Blocked tasks:** 0
- **Rework incidents:** 0
- **Research depth:** Complete (architecture designed, base package decided, phase structure validated)

## Accumulated Context

### Key Decisions

| Date       | Decision                                    | Rationale                                                                                                                         | Impact                                                                           |
| ---------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 2026-03-11 | 12-phase fine-grained structure             | Requirements naturally cluster into focused deliverables                                                                          | Phases 1-5 are independent testable units, Phases 6-12 build integration         |
| 2026-03-11 | Core Engine first (Phases 1-5)              | Zero external dependencies, highest-risk logic                                                                                    | Can prove architecture before integrating Vercel AI SDK                          |
| 2026-03-11 | Research gates at Phase 6 & 8               | Base router requires POC, free tier limits require empirical validation                                                           | Prevents premature commitment                                                    |
| 2026-03-12 | Vercel AI SDK as base (decided)             | Only TS SDK with native `wrapLanguageModel()` middleware, 36M/wk downloads, per-request key injection. Evaluated 10 alternatives. | Core integration point for Phase 6+                                              |
| 2026-03-12 | Rejected LiteLLM fork                       | Python (1M LOC), requires Postgres+Redis infrastructure, 2500 commits/month impossible to sync, no free-tier tracking             | Use as design reference only                                                     |
| 2026-03-12 | Model catalog from live APIs                | models.dev (primary), OpenRouter (categories), Artificial Analysis (quality tiers). Not static files.                             | Phase 5 implements ModelCatalog interface                                        |
| 2026-03-12 | Capability-aware fallback                   | Reasoning → reasoning, not generic. Quality tiers from benchmarks. Cheap paid fallback when budget > $0.                          | Phase 9 implements fallback chains                                               |
| 2026-03-12 | Three abstractions only                     | StorageBackend, ModelCatalog, SelectionStrategy. No LLM SDK abstraction. Everything else concrete.                                | Prevents over-abstraction, keeps codebase navigable                              |
| 2026-03-12 | Use Zod v3.23.0 instead of v4               | AI SDK peer dependency requires Zod v3, v4 causes npm install conflict                                                            | Stable Zod v3 API, compatible with AI SDK ecosystem                              |
| 2026-03-12 | Use exactOptionalPropertyTypes in tsconfig  | Strictest TypeScript mode for catching undefined assignment bugs                                                                  | Required explicit undefined checks in error class constructors                   |
| 2026-03-12 | 8 separate entry points via subpath exports | Tree-shakeable exports per PLAN.md spec, allows selective imports                                                                 | Users can import only what they need: 'llm-router/storage', 'llm-router/types'   |
| 2026-03-12 | Use Zod .default() correctly                | Per RESEARCH.md pitfall 4: .default() alone makes field optional in input, guaranteed in output. Not .optional().default()        | Config schema accepts minimal input, returns complete config                     |
| 2026-03-12 | Cast schema output to RouterConfig          | Zod output type incompatible with interface types under exactOptionalPropertyTypes (enabled: boolean vs enabled?: boolean)        | Safe cast maintains type safety while satisfying strict TypeScript mode          |
| 2026-03-12 | Runtime storage injection via options       | createRouter accepts optional storage parameter, defaults to MemoryStorage. Config no longer has storage section.                 | Users can provide custom adapters, storage is runtime-injected not config-driven |
| 2026-03-12 | Lazy expiration cleanup on access           | Prevents unbounded Map growth without background timers. Cleanup runs before increment/getUsage.                                  | No timer overhead, expiration happens naturally during normal operations         |
| 2026-03-12 | Synchronous increment for atomicity         | MemoryStorage uses synchronous Map.get/Map.set with no await between. Ensures atomic read-modify-write.                           | Atomicity guaranteed in MemoryStorage, future adapters use DB transactions       |
| 2026-03-12 | Empty array per-key limits as no override   | Empty array in { key, limits: [] } treated same as omitting limits field                                                          | Prevents accidental limit clearing, users must explicitly set limits to override |
| 2026-03-12 | Validation runs after merge at startup      | Contradictory limit validation happens at resolve time not evaluation time                                                        | Fail-fast design catches config errors early before runtime                      |
| 2026-03-12 | Debug warning for custom providers          | Providers without shipped defaults and no configured limits log debug message                                                     | Custom providers resolve to always-available with empty limits array             |
| 2026-03-12 | Warning event deduplication via Set         | Prevents event spam when limit stays above threshold. Exceeded events fire every time for visibility.                             | Warning fires once per limit crossing, resetWarnings() clears deduplication      |
| 2026-03-12 | Conditional closestLimit inclusion          | exactOptionalPropertyTypes requires explicit undefined handling for optional fields                                               | EvaluationResult only includes closestLimit field when it exists                 |
| 2026-03-12 | Real EventEmitter in createRouter           | Router.on/off wired to node:events EventEmitter instead of stubs                                                                  | Users can subscribe to limit:warning, limit:exceeded, policy:stale events        |
| 2026-03-13 | Calendar-aware period keys                  | Monthly/daily periods use YYYY-MM/YYYY-MM-DD format, not duration division. Aligns with calendar boundaries.                      | Period calculation handles month boundaries correctly (Feb 28 → Mar 1)           |
| 2026-03-13 | Token estimation graceful degradation       | estimateTokens() returns null on any error instead of throwing                                                                    | Usage tracking continues even if estimation fails                                |
| 2026-03-13 | Structured usage API breaking change        | StorageBackend.getUsage() returns { promptTokens, completionTokens, totalTokens, callCount } instead of number                    | All storage adapters must implement new interface, PolicyEngine updated          |

### Active TODOs

**Immediate:**

- [x] Execute Plan 01-01 (complete: TypeScript scaffolding + type system)
- [x] Execute Plan 01-02 (complete: Zod config schema + validation)
- [x] Execute Plan 02-01 (complete: MemoryStorage + contract tests)
- [x] Execute Plan 03-01 (complete: Policy types, resolver, default policies)
- [x] Execute Plan 03-02 (complete: PolicyEngine with evaluation and events)
- [x] Execute Plan 04-01 (complete: Usage tracking foundation - types, periods, estimation, cooldown)
- [ ] Execute Plan 04-02 (next: UsageTracker class and integration)

**Phase 6 prerequisite (before starting Phase 6):**

- [ ] Test `wrapLanguageModel()` middleware with key injection
- [ ] Validate `result.usage` token metadata extraction
- [ ] Confirm streaming `onFinish` callback for usage tracking
- [ ] Test `create*({ apiKey })` provider instance creation overhead

**Phase 8 prerequisite (before starting Phase 8):**

- [ ] Create test accounts for 12 providers
- [ ] Empirically validate free tier limits
- [ ] Document enforcement behaviors and reset timing

### Known Blockers

**None currently.** Phase 1 has no external dependencies.

### Open Questions

1. ~~**Storage schema design** — Single table with JSON columns or normalized schema? (Phase 2)~~ RESOLVED: Phase 2 uses Map with composite keys. SQLite/Redis adapters deferred to Phase 10.
2. ~~**Time window implementation** — Store raw events or pre-aggregated counters? (Phase 4)~~ RESOLVED: Phase 2 uses pre-aggregated counters with lazy expiration.
3. **Selection algorithm default** — Round-robin or least-used? (Phase 5)
4. **Model catalog refresh interval** — How often to re-fetch from live APIs? (Phase 5)

### Technical Debt

**None yet.** All code follows strict TypeScript best practices with exactOptionalPropertyTypes enabled.

## Session Continuity

### What Just Happened

**Plan 04-01 complete:**

- Created src/usage/ module with 5 files: types, periods, estimation, cooldown, index
- getPeriodKey() handles all 5 window types with calendar-aware keys (monthly: YYYY-MM, hourly: YYYY-MM-DDTHH)
- getResetAt() calculates next boundary using Date.UTC() for calendar-based windows
- estimateTokens() concatenates messages/system/tools, uses custom estimator or default (~4 chars/token), returns null on error
- CooldownManager tracks 429 state, parses Retry-After (int seconds or HTTP date), lazy cleanup on access
- Updated StorageBackend interface: increment() accepts optional callCount, getUsage() returns StructuredUsage (breaking change)
- Updated MemoryStorage: uses calendar-aware period keys, tracks call counts in parallel Map, cleans up both Maps on expiration
- Fixed PolicyEngine to use structured getUsage return type (destructure totalTokens)
- Added estimation config schema (defaultMaxTokens: 1024), tokenEstimator is runtime-only
- Updated all contract tests to expect structured usage data
- 2 tasks completed, 2 commits made (a3181e1, 88e3dff), 5 files created, 7 files modified, 6m 47s duration

**Phase 4 Plan 01 complete.** Usage tracking foundation ready with calendar-aware periods, token estimation, cooldown management, and structured usage API.

### What's Next

- **Phase 4 Plan 02: UsageTracker class** — Assemble utilities into UsageTracker, integrate with createRouter
- Success when: recordUsage() increments storage, getUsage() queries across windows, cooldown manager integrated

### Context for Next Session

- TypeScript npm package (not web app or CLI tool)
- Standard npm package conventions — flat src/, debug for logging, EventEmitter for events
- Three interfaces only: StorageBackend, ModelCatalog, SelectionStrategy
- Vercel AI SDK is a peer dependency, not wrapped behind our own abstraction
- LiteLLM Router patterns are design reference (deployment groups, cooldown, weighted routing)
- Phases 1-5 are testable without external APIs

---

_State tracking started: 2026-03-11_
_Last updated: 2026-03-13T03:13:19Z — Phase 4 in progress (6/7 plans, 04-01 complete)_
