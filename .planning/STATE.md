---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: Phase 2 (State Storage & Persistence)
status: planning
last_updated: '2026-03-12T14:09:02.158Z'
progress:
  total_phases: 12
  completed_phases: 2
  total_plans: 3
  completed_plans: 3
  percent: 100
---

# Project State: LLM Router

**Last updated:** 2026-03-12
**Current phase:** Phase 2 (State Storage & Persistence)
**Status:** Ready to plan

## Project Reference

**Core value:** Never get charged for LLM API calls — rotate through free tier keys intelligently so developers can experiment without burning cash.

**Current focus:** Phase 2 complete. Storage layer foundation established (02-01 MemoryStorage + contract tests). Phase 2 has only 1 plan - complete.

## Current Position

**Phase:** 2 - State Storage & Persistence
**Plan:** 02-01 complete (1/1 plans done)
**Status:** Complete
**Progress:** [██████████] 100%

## Performance Metrics

### Velocity

- **Phases completed:** 2/12
- **Plans completed:** 3/3 (Phase 1: 2/2, Phase 2: 1/1)
- **Average plan duration:** 9m 21s (3 plans: 9m 39s, 8m 6s, 10m 26s)
- **Estimated completion:** Phase 2 complete, Phase 3 next

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

### Active TODOs

**Immediate:**

- [x] Execute Plan 01-01 (complete: TypeScript scaffolding + type system)
- [x] Execute Plan 01-02 (complete: Zod config schema + validation)
- [x] Execute Plan 02-01 (complete: MemoryStorage + contract tests)

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

**Plan 02-01 complete:**

- Created MemoryStorage class implementing StorageBackend interface
- Atomic increment with synchronous read-modify-write (no await between Map.get/set)
- Lazy expiration cleanup on access to prevent unbounded Map growth
- Stderr warning emitted on MemoryStorage construction
- close() lifecycle with closed flag and exception throwing after close
- Removed storage section from config schema (no longer in Zod schema)
- createRouter accepts optional storage parameter, defaults to MemoryStorage
- Router interface includes storage field
- Created reusable contract test helper (tests/contracts/storage.contract.ts) with 10 test cases
- MemoryStorage-specific tests for stderr warning and expiration cleanup
- Fixed config tests to remove storage schema references
- 2 tasks completed, 2 commits made (c6ffc44, 22502da), 3 files created, 8 files modified, 10m 26s duration

**Phase 2 complete.** Storage layer foundation established: StorageBackend contract, MemoryStorage default, contract test suite.

### What's Next

- **Phase 3: Policy Engine** — Implement limit tracking and enforcement
- Success when: Can track usage against time windows and enforce limits

### Context for Next Session

- TypeScript npm package (not web app or CLI tool)
- Standard npm package conventions — flat src/, debug for logging, EventEmitter for events
- Three interfaces only: StorageBackend, ModelCatalog, SelectionStrategy
- Vercel AI SDK is a peer dependency, not wrapped behind our own abstraction
- LiteLLM Router patterns are design reference (deployment groups, cooldown, weighted routing)
- Phases 1-5 are testable without external APIs

---

_State tracking started: 2026-03-11_
_Last updated: 2026-03-12T01:10:49Z — Phase 1 complete (2/2 plans)_
