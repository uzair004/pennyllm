---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Milestone
current_phase: Phase 12 (Provider Overhaul & Validation)
status: planning
last_updated: '2026-03-17T07:50:52.838Z'
progress:
  total_phases: 17
  completed_phases: 11
  total_plans: 35
  completed_plans: 31
  percent: 89
---

# Project State: PennyLLM

**Last updated:** 2026-03-15
**Current phase:** Phase 12 (Provider Overhaul & Validation)
**Status:** Ready to plan

## Project Reference

**Core value:** Never get charged for LLM API calls — rotate through free tier keys intelligently so developers can experiment without burning cash.

**Current focus:** Phase 12 next (Provider Overhaul & Validation). Phase 11 complete. 11/12 v1 phases done. Provider audit (2026-03-15) revealed need to overhaul provider targets (12→7), fix broken fallback, add user-configured model chains. See `docs/providers/notes/` for intelligence and `memory/project_phase12_direction.md` for design decisions.

## Current Position

**Phase:** 12 - Provider Overhaul & Validation
**Plan:** 3/6 plans
**Status:** In progress
**Progress:** [█████████░] 89%

## Performance Metrics

### Velocity

- **Phases completed:** 11/12
- **Plans completed:** 32/35 (Phase 1: 2/2, Phase 2: 1/1, Phase 3: 2/2, Phase 4: 2/2, Phase 5: 5/5, Phase 6: 3/3, Phase 7: 2/2, Phase 8: 3/3, Phase 9: 3/3, Phase 10: 3/3, Phase 11: 3/3, Phase 12: 3/6)
- **Estimated completion:** Phase 12 is the final phase (E2E tests, limit validation, npm publishing)

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
| 2026-03-12   | 8 separate entry points via subpath exports | Tree-shakeable exports per PLAN.md spec, allows selective imports                                                                  | Users can import only what they need: 'pennyllm/storage', 'pennyllm/types'         |
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
| 2026-03-13   | Switch-based ErrorType suggestion lookup    | noUncheckedIndexedAccess makes Record index potentially undefined even when exhaustive                                             | ProviderError uses switch instead of Record for type-safe suggestion mapping       |
| 2026-03-13   | Error classification via isInstance()       | APICallError.isInstance() is required (never instanceof) per AI SDK cross-boundary pattern                                         | classifyError() correctly identifies errors across package boundaries              |
| 2026-03-13   | Mutable keyIndexRef pattern                 | Shared { current: number } between retry proxy and middleware for post-retry key tracking                                          | Middleware records usage against key that actually succeeded, not initial key      |
| 2026-03-13   | disabledKeys Set in createRouter scope      | Auth-failed keys persist across wrapModel() calls within same router instance                                                      | Prevents repeated attempts with known-bad keys for session lifetime                |
| 2026-03-13   | routerModel() without retry proxy           | Standalone convenience function stays simple; retry available via router.wrapModel()                                               | Users who need retry use router.wrapModel(), simple path remains clean             |
| 2026-03-13   | ErrorEventPayload typed interface           | Record<string, unknown> causes TS4111 under exactOptionalPropertyTypes for statusCode access                                       | Typed interface avoids index signature access issue                                |
| 2026-03-14   | Deterministic free model ordering           | FallbackResolver lacks direct quota access; sort free models by provider name                                                      | FallbackProxy handles actual quota-based selection among same-provider candidates  |
| 2026-03-14   | Micro-dollar budget storage repurposing     | Store cost as microDollars in promptTokens field to avoid StorageBackend interface changes                                         | Keeps interface stable for Phase 10 adapters                                       |
| 2026-03-14   | $0 budget = always exceeded                 | monthlyLimit 0 means isExceeded() returns true, blocking all paid calls per CONTEXT.md                                             | Consistent with "never spend money" specification                                  |
| 2026-03-14   | Pass empty Map to resolvePolicies           | Retry proxy handles runtime 429s as safety net; no stale shipped defaults                                                          | createRouter no longer ships active routing data                                   |
| 2026-03-14   | applyRegistryDefaults defaults to false     | Wired for future registry phase; not optional, guaranteed by Zod .default()                                                        | Users must opt in to registry defaults when implemented                            |
| 2026-03-14   | Provider config types as JSDoc aliases      | IDE discoverability without type divergence; each provider gets JSDoc with sign-up URLs, env vars, tier info                       | Users get autocomplete and inline docs when configuring providers                  |
| 2026-03-14   | Exhaustion type categorization              | ProviderExhaustedEvent needs cooldown/quota/mixed for downstream decisions                                                         | Fallback resolver can distinguish rate limits from quota exhaustion                |
| 2026-03-14   | Cross-field Zod .strict().refine() chain    | cheapest-paid behavior requires non-zero budget to be meaningful                                                                   | Config validation catches contradictory fallback+budget settings early             |
| 2026-03-14   | PromiseLike callFn in FallbackProxy         | LanguageModelV3 doGenerate/doStream return PromiseLike not Promise                                                                 | Shared attemptWithFallback uses PromiseLike for type correctness                   |
| 2026-03-14   | Stream results skip providerMetadata        | LanguageModelV3StreamResult has no providerMetadata field, only generate results do                                                | Fallback info only on generate, not stream responses                               |
| 2026-03-14   | Dry-run intercept after key selection       | Events should still fire in dry-run mode for observability testing                                                                 | Middleware intercepts after router.model() and key:selected event emission         |
| 2026-03-14   | createHook factory for typed hooks          | DRY pattern wrapping EventEmitter.on with typed callback and unsubscribe return                                                    | 8 typed hooks without duplicating emitter wiring code                              |
| 2026-03-14   | Conditional property for exactOptional      | estimatedTokens/originalQualityTier need conditional inclusion under strict TS mode                                                | Build objects conditionally instead of spreading undefined values                  |
| 2026-03-14   | ProviderType union for autocomplete         | `ProviderType \| (string & {})` prevents TypeScript from widening to plain string                                                  | defineConfig() autocompletes 12 known providers while accepting custom strings     |
| 2026-03-14   | Levenshtein threshold of 2 for typos        | Edit distance 2 catches common typos (googel, grooq) without false positives                                                       | suggestProvider() returns closest match or null                                    |
| 2026-03-14   | Redis key as deterministic id               | Same composite key returns same id across increment calls, satisfying contract test record2.id === record1.id                      | No UUID generation needed, Redis key string is the natural identifier              |
| 2026-03-14   | Cursor-based SCAN instead of scanStream     | Simpler async/await control flow, no stream event handling needed                                                                  | scanKeys() helper with manual cursor iteration for get() and resetAll()            |
| Phase 05 P03 | 7m 14s                                      | 2 tasks                                                                                                                            | 9 files                                                                            |
| Phase 05 P04 | 2m 18s                                      | 1 task                                                                                                                             | 2 files                                                                            |
| Phase 06 P01 | 8m 26s                                      | 3 tasks                                                                                                                            | 8 files                                                                            |
| Phase 06 P02 | ~25m                                        | 2 tasks                                                                                                                            | 13 files                                                                           |
| Phase 06 P03 | 1m 45s                                      | 2 tasks                                                                                                                            | 1 files                                                                            |
| Phase 07 P01 | 6m                                          | 2 tasks                                                                                                                            | 9 files                                                                            |
| Phase 07 P02 | 5m 17s                                      | 2 tasks                                                                                                                            | 5 files                                                                            |
| Phase 08 P01 | 5m 51s                                      | 3 tasks                                                                                                                            | 14 files                                                                           |
| Phase 08 P02 | 3m 14s                                      | 2 tasks                                                                                                                            | 6 files                                                                            |
| Phase 08 P03 | 5m                                          | 2 tasks                                                                                                                            | 8 files                                                                            |
| Phase 09 P01 | 4m 14s                                      | 1 tasks                                                                                                                            | 12 files                                                                           |
| Phase 09 P02 | 3m 39s                                      | 2 tasks                                                                                                                            | 4 files                                                                            |
| Phase 09 P03 | 8m 54s                                      | 2 tasks                                                                                                                            | 7 files                                                                            |
| Phase 10 P03 | 7m 4s                                       | 2 tasks                                                                                                                            | 9 files                                                                            |
| Phase 11 P01 | 5m 55s                                      | 2 tasks                                                                                                                            | 8 files                                                                            |
| Phase 11 P02 | 3m 2s                                       | 1 task                                                                                                                             | 1 file                                                                             |
| Phase 11 P03 | 5m 32s                                      | 2 tasks                                                                                                                            | 4 files                                                                            |
| Phase 12 P02 | 5m 12s                                      | 2 tasks                                                                                                                            | 3 files                                                                            |
| Phase 12 P01 | 11m                                         | 2 tasks                                                                                                                            | 13 files                                                                           |
| Phase 12 P03 | 5m 5s                                       | 2 tasks                                                                                                                            | 8 files                                                                            |

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

### Roadmap Evolution

- Phase 12 rescoped: Provider Overhaul & Validation (was Testing & Validation)
- Phase 12.1 inserted: Provider Nuance Gap Analysis
- v2 trimmed from 10 to 4 phases: Credit Limits, Health Scoring, CLI Validator, Provider Data Registry
- Removed: Advanced Routing, Extended Providers (Scaleway/Venice), Docs Site, Storage Opts, Admin UI, Enterprise

### Key Design Decisions (2026-03-15)

- **Target providers (7):** Cerebras, Google, Groq, GitHub Models, SambaNova, NVIDIA NIM, Mistral
- **Dropped (8):** HuggingFace, Cohere, Cloudflare, Qwen, OpenRouter, Together AI, DeepSeek, Fireworks
- **User-configured model priority chain:** replaces broken catalog-based FallbackResolver
- **Reactive limit handling:** NO internal usage tracking for routing. Provider 429/402 drives cooldown and fallback. UsageTracker kept for observability only.
- **Typed model IDs:** per-provider TypeScript union types for IDE autocomplete (free + paid models)
- **Free + paid models:** user controls priority order, free first, paid as fallback with budget cap

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

**Phase 11 complete (Developer Experience Polish):**

- **Plan 11-01:** Debug mode (DebugLogger + 8 hooks), config validation (Levenshtein typo detection, ZodError→ConfigError), typed defineConfig with IDE autocomplete
- **Plan 11-02:** README.md rewrite — 379-line npm landing page (Drizzle-style, 3 examples, ASCII flow diagram, 12-provider table)
- **Plan 11-03:** Reference docs (configuration.md 354 lines, events.md 406 lines, troubleshooting.md 300 lines) + CONTRIBUTING refresh (122 lines)
- Verification: 17/17 must-haves passed, all 4 requirements (CORE-02, DX-01, DX-06, DX-07) satisfied
- 8 commits, 13 files created/modified, all 93 tests passing

### What's Next

- **Phase 12:** Provider Overhaul & Validation — E2E tests, empirical limit validation, npm publishing
- This is the final phase before v1.0 release
- **v2.0 milestone** defined in ROADMAP.md: 10 phases (13-22) covering registry, credits, CLI, advanced fallback, routing intelligence, extended providers, docs site, storage optimizations, admin UI, and enterprise features

### Context for Next Session

- TypeScript npm package (not web app or CLI tool)
- Standard npm package conventions -- flat src/, debug for logging, EventEmitter for events
- Three interfaces only: StorageBackend, ModelCatalog, SelectionStrategy
- Vercel AI SDK is a peer dependency, not wrapped behind our own abstraction
- Phases 1-11 complete: core engine + integration + error handling + provider validation + fallback + storage adapters + DX polish all done
- Phase 12 remaining: E2E tests, empirical limit validation, npm publish
- Full request flow: wrapModel() -> middleware -> FallbackProxy -> RetryProxy -> provider API
- Dry-run intercepts in middleware AFTER key selection (events still fire)
- All 93 tests pass + 1 skipped (Redis) + 38 todo, tsc --noEmit clean (pre-existing rootDir test error)

---

_State tracking started: 2026-03-11_
_Last updated: 2026-03-17 -- Phase 12 Plan 03 complete (config schema overhaul for chain architecture)_
