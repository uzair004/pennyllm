---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: Phase 7 (Integration & Error Handling)
status: planning
last_updated: '2026-03-13T16:08:43.301Z'
progress:
  total_phases: 12
  completed_phases: 6
  total_plans: 15
  completed_plans: 15
  percent: 100
---

# Project State: LLM Router

**Last updated:** 2026-03-13
**Current phase:** Phase 7 (Integration & Error Handling)
**Status:** Ready to plan

## Project Reference

**Core value:** Never get charged for LLM API calls — rotate through free tier keys intelligently so developers can experiment without burning cash.

**Current focus:** Phase 6 complete. Vercel AI SDK integration validated end-to-end with real Gemini API. Ready for Phase 7 (Integration & Error Handling).

## Current Position

**Phase:** 7 - Integration & Error Handling
**Plan:** Not started (0/? plans done)
**Status:** Ready
**Progress:** [██████████] 100%

## Performance Metrics

### Velocity

- **Phases completed:** 6/12
- **Plans completed:** 16/16 (Phase 1: 2/2, Phase 2: 1/1, Phase 3: 2/2, Phase 4: 2/2, Phase 5: 5/5, Phase 6: 3/3)
- **Average plan duration:** 12m 14s (15 plans: 9m 39s, 8m 6s, 10m 26s, 3m 35s, 4m 3s, 6m 47s, 5m 51s, 6m 44s, 31m 9s, 35m 15s, 7m 14s, 2m 18s, 8m 26s, ~25m)
- **Estimated completion:** Phase 6 complete, Phase 7 next

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

| Date         | Decision                                    | Rationale                                                                                                                          | Impact                                                                             |
| ------------ | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 2026-03-11   | 12-phase fine-grained structure             | Requirements naturally cluster into focused deliverables                                                                           | Phases 1-5 are independent testable units, Phases 6-12 build integration           |
| 2026-03-11   | Core Engine first (Phases 1-5)              | Zero external dependencies, highest-risk logic                                                                                     | Can prove architecture before integrating Vercel AI SDK                            |
| 2026-03-11   | Research gates at Phase 6 & 8               | Base router requires POC, free tier limits require empirical validation                                                            | Prevents premature commitment                                                      |
| 2026-03-12   | Vercel AI SDK as base (decided)             | Only TS SDK with native `wrapLanguageModel()` middleware, 36M/wk downloads, per-request key injection. Evaluated 10 alternatives.  | Core integration point for Phase 6+                                                |
| 2026-03-12   | Rejected LiteLLM fork                       | Python (1M LOC), requires Postgres+Redis infrastructure, 2500 commits/month impossible to sync, no free-tier tracking              | Use as design reference only                                                       |
| 2026-03-12   | Model catalog from live APIs                | models.dev (primary), OpenRouter (categories), Artificial Analysis (quality tiers). Not static files.                              | Phase 5 implements ModelCatalog interface                                          |
| 2026-03-12   | Capability-aware fallback                   | Reasoning → reasoning, not generic. Quality tiers from benchmarks. Cheap paid fallback when budget > $0.                           | Phase 9 implements fallback chains                                                 |
| 2026-03-12   | Three abstractions only                     | StorageBackend, ModelCatalog, SelectionStrategy. No LLM SDK abstraction. Everything else concrete.                                 | Prevents over-abstraction, keeps codebase navigable                                |
| 2026-03-12   | Use Zod v3.23.0 instead of v4               | AI SDK peer dependency requires Zod v3, v4 causes npm install conflict                                                             | Stable Zod v3 API, compatible with AI SDK ecosystem                                |
| 2026-03-12   | Use exactOptionalPropertyTypes in tsconfig  | Strictest TypeScript mode for catching undefined assignment bugs                                                                   | Required explicit undefined checks in error class constructors                     |
| 2026-03-12   | 8 separate entry points via subpath exports | Tree-shakeable exports per PLAN.md spec, allows selective imports                                                                  | Users can import only what they need: 'llm-router/storage', 'llm-router/types'     |
| 2026-03-12   | Use Zod .default() correctly                | Per RESEARCH.md pitfall 4: .default() alone makes field optional in input, guaranteed in output. Not .optional().default()         | Config schema accepts minimal input, returns complete config                       |
| 2026-03-12   | Cast schema output to RouterConfig          | Zod output type incompatible with interface types under exactOptionalPropertyTypes (enabled: boolean vs enabled?: boolean)         | Safe cast maintains type safety while satisfying strict TypeScript mode            |
| 2026-03-12   | Runtime storage injection via options       | createRouter accepts optional storage parameter, defaults to MemoryStorage. Config no longer has storage section.                  | Users can provide custom adapters, storage is runtime-injected not config-driven   |
| 2026-03-12   | Lazy expiration cleanup on access           | Prevents unbounded Map growth without background timers. Cleanup runs before increment/getUsage.                                   | No timer overhead, expiration happens naturally during normal operations           |
| 2026-03-12   | Synchronous increment for atomicity         | MemoryStorage uses synchronous Map.get/Map.set with no await between. Ensures atomic read-modify-write.                            | Atomicity guaranteed in MemoryStorage, future adapters use DB transactions         |
| 2026-03-12   | Empty array per-key limits as no override   | Empty array in { key, limits: [] } treated same as omitting limits field                                                           | Prevents accidental limit clearing, users must explicitly set limits to override   |
| 2026-03-12   | Validation runs after merge at startup      | Contradictory limit validation happens at resolve time not evaluation time                                                         | Fail-fast design catches config errors early before runtime                        |
| 2026-03-12   | Debug warning for custom providers          | Providers without shipped defaults and no configured limits log debug message                                                      | Custom providers resolve to always-available with empty limits array               |
| 2026-03-12   | Warning event deduplication via Set         | Prevents event spam when limit stays above threshold. Exceeded events fire every time for visibility.                              | Warning fires once per limit crossing, resetWarnings() clears deduplication        |
| 2026-03-12   | Conditional closestLimit inclusion          | exactOptionalPropertyTypes requires explicit undefined handling for optional fields                                                | EvaluationResult only includes closestLimit field when it exists                   |
| 2026-03-12   | Real EventEmitter in createRouter           | Router.on/off wired to node:events EventEmitter instead of stubs                                                                   | Users can subscribe to limit:warning, limit:exceeded, policy:stale events          |
| 2026-03-13   | Calendar-aware period keys                  | Monthly/daily periods use YYYY-MM/YYYY-MM-DD format, not duration division. Aligns with calendar boundaries.                       | Period calculation handles month boundaries correctly (Feb 28 → Mar 1)             |
| 2026-03-13   | Token estimation graceful degradation       | estimateTokens() returns null on any error instead of throwing                                                                     | Usage tracking continues even if estimation fails                                  |
| 2026-03-13   | Structured usage API breaking change        | StorageBackend.getUsage() returns { promptTokens, completionTokens, totalTokens, callCount } instead of number                     | All storage adapters must implement new interface, PolicyEngine updated            |
| 2026-03-13   | Fire-and-forget record() pattern            | Usage tracking is observability, not correctness. Recording failures should not break LLM calls.                                   | record() method wraps in try-catch and logs errors but never throws                |
| 2026-03-13   | Lazy deduplication cleanup at 10k           | Unbounded Set growth is a memory leak. Clear at 10k to prevent while keeping dedup window large enough.                            | RequestId Set cleared when size exceeds 10k entries                                |
| 2026-03-13   | Rolling 30-day storage limitation           | Current storage doesn't support querying historical buckets by timestamp                                                           | getUsage() queries same daily bucket 30 times, fix deferred to Phase 10            |
| 2026-03-13   | Strategy.PRIORITY as default                | Matches plan requirement for priority-based selection by default                                                                   | Breaking change - updated 3 tests to reflect new default                           |
| 2026-03-13   | Per-1M-tokens pricing format                | Industry standard for model pricing (OpenAI, Anthropic, etc.)                                                                      | Breaking change - existing ModelMetadata consumers must update                     |
| 2026-03-13   | Array length guard with non-null assertion  | TypeScript strict mode requires explicit undefined handling                                                                        | Early validation prevents runtime errors in error class constructors               |
| 2026-03-13   | Ignore scripts/ in ESLint type checking     | Scripts import from src/, creating circular tsconfig dependency. Scripts are utilities, not shipped code.                          | Pre-commit hooks pass, scripts excluded from type-checked linting                  |
| 2026-03-13   | Static snapshot embedded via readFileSync   | ESM-compatible file loading with import.meta.url, bundled by tsup automatically                                                    | No manual package.json files entry needed, snapshot embedded in dist/              |
| 2026-03-13   | Synchronous strategies with Promise.resolve | SelectionStrategy interface requires async method, but strategies have no I/O. ESLint requires-await prevents async without await. | Built-in strategies return Promise.resolve() explicitly, no async keyword          |
| 2026-03-13   | Explicit undefined handling for optionals   | exactOptionalPropertyTypes disallows passing `T \| undefined` to `T?` type                                                         | Build objects conditionally: `if (value !== undefined) obj.field = value`          |
| 2026-03-13   | Eager catalog fetch at startup              | createRouter() awaits catalog.refresh() at startup with fallback to static snapshot on failure                                     | Balances freshness with startup reliability                                        |
| 2026-03-13   | Permissive model validation                 | Unknown models logged but allowed to proceed with selection                                                                        | Avoids blocking legitimate requests when catalog is stale or model is new          |
| 2026-03-13   | provider/model format required              | router.model() throws ConfigError if modelId lacks a slash                                                                         | Enforces consistent format and prevents ambiguous inputs                           |
| 2026-03-13   | V3 to any cast for wrapLanguageModel        | wrapLanguageModel accepts both V1 and V3 models at runtime but TypeScript signature only shows V1                                  | Runtime compatibility maintained, type safety preserved with eslint-disable        |
| 2026-03-13   | TransformStream for streaming usage         | Use Web Streams API to intercept finish chunk without modifying stream behavior                                                    | Standard API, all chunks pass through unmodified, usage recorded on completion     |
| 2026-03-13   | Fire-and-forget usage recording             | Usage tracking never throws to user, all errors caught and logged                                                                  | LLM calls succeed even if usage recording fails                                    |
| 2026-03-13   | AI SDK v4 to v6 upgrade                     | v4 LanguageModelV1 types incompatible with current @ai-sdk/google returning V3 models                                              | All wrapper code updated for V3 types and new usage API (inputTokens/outputTokens) |
| 2026-03-13   | Defensive usage field access                | Gemini 2.5 Flash thinking mode returns empty text and undefined usage fields                                                       | Middleware and UsageTracker guard with Number(x) \|\| 0                            |
| 2026-03-13   | Lazy-init ProviderRegistry in createRouter  | Dynamic import of @ai-sdk/google at init time caused 5s test timeouts. Registry only needed on first wrapModel() call.             | Deferred to first use via null-check async getter, tests complete in ~1s           |
| Phase 05 P03 | 7m 14s                                      | 2 tasks                                                                                                                            | 9 files                                                                            |
| Phase 05 P04 | 2m 18s                                      | 1 task                                                                                                                             | 2 files                                                                            |
| Phase 06 P01 | 8m 26s                                      | 3 tasks                                                                                                                            | 8 files                                                                            |
| Phase 06 P02 | ~25m                                        | 2 tasks                                                                                                                            | 13 files                                                                           |
| Phase 06 P03 | 1m 45s                                      | 2 tasks                                                                                                                            | 1 files                                                                            |

### Active TODOs

**Immediate:**

- [x] Execute Plan 01-01 (complete: TypeScript scaffolding + type system)
- [x] Execute Plan 01-02 (complete: Zod config schema + validation)
- [x] Execute Plan 02-01 (complete: MemoryStorage + contract tests)
- [x] Execute Plan 03-01 (complete: Policy types, resolver, default policies)
- [x] Execute Plan 03-02 (complete: PolicyEngine with evaluation and events)
- [x] Execute Plan 04-01 (complete: Usage tracking foundation - types, periods, estimation, cooldown)
- [x] Execute Plan 04-02 (complete: UsageTracker class and Router integration)

**Phase 6 prerequisite (before starting Phase 6):** VALIDATED via POC

- [x] Test `wrapLanguageModel()` middleware with key injection
- [x] Validate `result.usage` token metadata extraction
- [ ] Confirm streaming `onFinish` callback for usage tracking (deferred to Phase 7)
- [x] Test `create*({ apiKey })` provider instance creation overhead

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

**Phase 6 complete (all 3 plans):**

**Plan 06-01:** Built core AI SDK integration layer - provider registry, usage tracking middleware, routerModel wrapper, Router.wrapModel() method.

**Plan 06-02:** End-to-end validation with real Gemini API:

- Created POC script (scripts/poc-gemini.ts) that calls real Gemini API through router.wrapModel()
- Upgraded Vercel AI SDK from v4 to v6 (LanguageModelV3 types, inputTokens/outputTokens usage API)
- Fixed stale static catalog (refreshed from models.dev)
- Fixed undefined usage fields from Gemini thinking mode with Number(x) || 0 guards
- Human-verified: POC runs successfully with real API key, usage tracking records actual token counts
- 3 commits (dca47e5, 68615d1, 581d8b3), 13 files, ~25 min

**Plan 06-03:** Gap closure -- lazy ProviderRegistry initialization:

- Moved ProviderRegistry.createDefault() from createRouter() init to first wrapModel() call
- Fixed 5-second test timeouts caused by eager dynamic import of @ai-sdk/google
- Config tests now complete in ~1s, full suite (83 tests) passes with no regressions
- 1 commit (e169c68), 1 file, ~2 min

**Phase 6 research gate PASSED.** router.wrapModel() validated end-to-end with real provider API.

### What's Next

- **Phase 7: Integration & Error Handling** -- streaming support, error classification, tool calling passthrough, structured output
- Streaming usage tracking (onFinish callback) still needs validation (deferred prerequisite)
- Success when: streamText() works with router-wrapped models, errors classified with actionable messages

### Context for Next Session

- TypeScript npm package (not web app or CLI tool)
- Standard npm package conventions — flat src/, debug for logging, EventEmitter for events
- Three interfaces only: StorageBackend, ModelCatalog, SelectionStrategy
- Vercel AI SDK is a peer dependency, not wrapped behind our own abstraction
- LiteLLM Router patterns are design reference (deployment groups, cooldown, weighted routing)
- Phases 1-5 are testable without external APIs

---

_State tracking started: 2026-03-11_
_Last updated: 2026-03-13T16:03:12Z -- Phase 6 complete (16/16 plans, incl. gap closure 06-03), ready for Phase 7_
