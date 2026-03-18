# Roadmap: PennyLLM

**Project:** PennyLLM - Cost-avoidance layer for LLM API calls
**Core Value:** Never get charged for LLM API calls — rotate through free tier keys intelligently
**Base Package:** Vercel AI SDK (decided after evaluating LiteLLM fork, LangChain.js, OpenAI SDK, and 7 others)
**Granularity:** Fine (12 v1 phases + Phase 12.1 gap analysis + 4 v2 phases)
**Created:** 2026-03-11
**Updated:** 2026-03-15
**Coverage:** 55/55 v1 requirements mapped. v2 trimmed from 10 to 4 focused phases after provider audit (2026-03-15).

## Phases

- [x] **Phase 1: Foundation Setup** - Project scaffolding, TypeScript config, build tooling, core interfaces, domain types
- [x] **Phase 2: State Storage & Persistence** - Memory storage default, StorageBackend contract tests, config schema update
- [x] **Phase 3: Policy Engine** - Declarative config loader, policy evaluation, versioning
- [x] **Phase 4: Usage Tracking Core** - Multi-window tracking, atomic operations, reset logic, scenrios, reconciliation, accuracy, edge cases, how liteLLM handles this
- [x] **Phase 5: Model Catalog & Selection** - Live model catalog (models.dev, OpenRouter), capability flags, quality tiers, selection algorithms, updates
- [x] **Phase 6: Base Router Integration** - Vercel AI SDK `wrapLanguageModel()` middleware, key injection via `create*({ apiKey })`
- [x] **Phase 7: Integration & Error Handling** - Error classification, streaming support, tool calling, structured output passthrough, observability hooks for routing decisions and errors, detailed error messages with context, other llm features (e.g., tool calling, structured output) we need to handle or don't need to worry about (completed 2026-03-13)
- [x] **Phase 8: Provider Policies Catalog** - Default free tier policies for 12 providers with researched limits, reset behavior, and documentation for key acquisition, metadata for staleness warnings, source URLs, confidence levels, updates etc.
- [x] **Phase 9: Fallback & Budget Management** - Capability-aware fallback chains, cheap paid model routing, budget caps, threshold alerts, persistence, user-configurable fallback behavior, other fallback strategies (e.g., round-robin fallback across providers, weighted random based on remaining quota), how to handle requests that exceed any single provider's limits (e.g., 10k tokens when max is 8k), how to handle different reset window types in fallback logic (e.g., if primary key is blocked due to per-minute limit, do we consider it exhausted for fallback purposes until the minute resets?), (completed 2026-03-14)
- [x] **Phase 10: SQLite, Redis & Advanced Features** - SQLite + Redis adapters, observability hooks, dry-run mode, (completed 2026-03-14)
- [x] **Phase 11: Developer Experience Polish** - Debug logging, TypeScript types, comprehensive docs, minimal config example, multiple keys per provider config, troubleshooting guide, how to test your config, how to monitor usage and costs, best practices for key management, etc. how it can fit with other tools in the ecosystem (e.g., LangChain.js, custom implementations) (completed 2026-03-14)
- [x] **Phase 12: Provider Overhaul & Validation** - Wire up 7 target providers, user-configured model priority chain, typed model IDs (free+paid), runtime validation, refresh docs, E2E testing with real APIs (completed 2026-03-17)
- [x] **Phase 12.1: Provider Nuance Gap Analysis** (INSERTED) - Audit PennyLLM abstractions against real provider behavior, categorize gaps (per-model limits, per-account limits, credit billing, per-second rates, per-request token caps), prioritize fixes vs deferrals (completed 2026-03-17)

### v2.0 Milestone

- [x] **Phase 13: Credit-Based Limits** - Handle providers with finite credits (NVIDIA NIM 1K credits, SambaNova $5 signup credit). Track credit depletion, createCreditLimit builder, detect exhaustion and stop routing. (completed 2026-03-18)
- [ ] **Phase 14: Health Scoring & Circuit Breakers** - Live health checks before routing, per-provider health scores (success rate, latency, availability), circuit breakers with escalating cooldowns, provider recovery detection. Reference: free-coding-models P2C algorithm.
- [ ] **Phase 15: CLI Validator** - `npx pennyllm validate` makes a test call to each configured provider+model, confirms API key works, model exists, reports limits. Prevents user assumptions. CI-friendly exit codes.
- [ ] **Phase 16: Provider Data Registry** - Separate published resource (e.g., `awesome-free-llm-keys` or standalone JSON/repo) documenting free tier limits, models, signup URLs for all providers. NOT part of PennyLLM code — a community reference that PennyLLM docs link to. May be imported later.

## Phase Details

### Phase 1: Foundation Setup

**Goal:** Project is configured with TypeScript, build tooling, project structure, core interfaces, and domain types for npm package development

**Depends on:** Nothing (first phase)

**Requirements:** CORE-01 (initialization), DX-07 (TypeScript types foundation)

**Success Criteria** (what must be TRUE):

1. Developer can clone repo and run `npm install` without errors
2. TypeScript compiles cleanly with strict mode enabled
3. Build produces distributable npm package structure (dist/ folder with .js and .d.ts files)
4. Project structure follows standard npm package conventions with clean module boundaries
5. Core interfaces defined: `StorageBackend`, `ModelCatalog`, `SelectionStrategy`
6. Domain types defined: `ModelMetadata`, `Policy`, `UsageRecord`, `TimeWindow`, config schema (Zod)
7. Basic configuration object type is defined and exported

**Plans:** 2/2 plans executed ✅ **Complete**

Plans:

- [x] 01-01-PLAN.md — Project scaffolding, tooling, core types, interfaces, constants, error classes
- [x] 01-02-PLAN.md — Zod config schema, JSON/YAML loader, main exports, test suite

---

### Phase 2: State Storage & Persistence

**Goal:** Default in-memory StorageBackend works with atomic increments, lazy expiration, and contract test suite that future adapters must pass

**Depends on:** Phase 1 (TypeScript setup, StorageBackend interface)

**Requirements:** USAGE-02 (storage backend contract), USAGE-05 (atomic concurrent access)

**Success Criteria** (what must be TRUE):

1. MemoryStorage implements all StorageBackend interface methods and passes contract tests
2. Concurrent writes to same key do not corrupt data or lose updates (atomic synchronous increment)
3. Schema supports storing multiple time windows per key (per-minute, hourly, daily, monthly)
4. Expired time windows are auto-evicted (no unbounded memory growth)
5. createRouter() accepts optional StorageBackend instance and defaults to MemoryStorage
6. Contract test suite exists and can be reused by SQLite/Redis adapters in Phase 10

**Plans:** 1/1 plans executed ✅ **Complete**

Plans:

- [x] 02-01-PLAN.md — MemoryStorage implementation, config schema update, contract test suite

---

### Phase 3: Policy Engine

**Goal:** Provider policies load from configuration and evaluate key eligibility based on declarative rules

**Depends on:** Phase 2 (storage for policy metadata)

**Requirements:** POLICY-01 (default policies ship), POLICY-02 (user override), POLICY-03 (custom providers), POLICY-04 (diverse limit types), POLICY-05 (enforcement metadata), POLICY-06 (staleness warnings), POLICY-07 (versioning)

**Success Criteria** (what must be TRUE):

1. User can load policies from config without code changes
2. Policy engine evaluates token-based, call-based, rate-limit, and hybrid limit types
3. User can override shipped policy for any provider via configuration
4. User can define policy for provider not in default catalog
5. Package warns when shipped policy data is older than 30 days

**Plans:** 2/2 plans executed ✅ **Complete**

Plans:

- [x] 03-01-PLAN.md — Policy types, default policies (3 providers), config schema update, three-layer resolver
- [x] 03-02-PLAN.md — PolicyEngine class with evaluation, events, staleness detection, createRouter() integration

---

### Phase 4: Usage Tracking Core

**Goal:** Usage tracking accurately records consumption across multiple time windows with correct reset behavior

**Depends on:** Phase 2 (storage), Phase 3 (policy definitions)

**Requirements:** USAGE-01 (token tracking), USAGE-03 (multi-window tracking), USAGE-04 (reset logic), USAGE-06 (reconciliation)

**Success Criteria** (what must be TRUE):

1. Usage increments correctly for prompt tokens and completion tokens separately
2. Per-minute sliding windows reset properly (e.g., 10:30-10:31, not fixed boundaries)
3. Calendar month resets happen at correct boundary (e.g., 00:00 UTC on 1st of month)
4. Rolling 30-day windows calculate correctly (sum of last 30 days, drops day 31)
5. Estimated vs actual token usage reconciles after provider response

**Plans:** 2/2 plans executed ✅ **Complete**

Plans:

- [x] 04-01-PLAN.md — Usage types, period calculator, estimation, cooldown, StorageBackend/MemoryStorage updates, config schema
- [x] 04-02-PLAN.md — UsageTracker class, Router integration, getUsage()/resetUsage() API, exports

---

### Phase 5: Model Catalog & Selection

**Goal:** Router has access to model metadata (capabilities, pricing, quality tiers) from live sources and selects optimal keys using configurable strategies

**Depends on:** Phase 3 (policy evaluation), Phase 4 (usage data)

**Requirements:** ALGO-01 (round-robin), ALGO-02 (least-used), ALGO-03 (configurable strategy), ALGO-04 (skip exhausted), ALGO-05 (pluggable interface), CAT-01 (live catalog), CAT-02 (capability flags), CAT-03 (quality tiers), CAT-04 (cheap paid models), CAT-05 (offline fallback)

**Success Criteria** (what must be TRUE):

1. `ModelCatalog` implementation fetches from models.dev API with OpenRouter as supplementary source
2. Models have capability flags: reasoning, toolCall, structuredOutput, vision
3. Models have quality tiers: frontier, high, mid, small (derived from benchmark data)
4. Catalog includes pricing for paid models (for fallback cost comparison)
5. Catalog works offline with bundled static snapshot when APIs unreachable
6. Round-robin distributes requests evenly across 3+ keys over 100 requests
7. Least-used selection prefers key with most remaining quota
8. User can switch selection strategy via config without code changes
9. Selection automatically skips keys that exceeded any limit
10. User can provide custom selection function via TypeScript plugin interface

**Plans:** 5/5 plans executed ✅ **Complete**

Plans:

- [x] 05-00-PLAN.md — Wave 0: test scaffolds for catalog and selection behaviors
- [x] 05-01-PLAN.md — Type contracts, interfaces, config schema, error classes, events
- [x] 05-02-PLAN.md — DefaultModelCatalog with live API fetch, caching, static fallback
- [x] 05-03-PLAN.md — Selection strategies (priority, round-robin, least-used) and KeySelector coordinator
- [x] 05-04-PLAN.md — Router integration: wire catalog + selection into createRouter()

---

### Phase 6: Base Router Integration

**Goal:** Router wraps Vercel AI SDK via `wrapLanguageModel()` middleware and makes real LLM API calls

**Depends on:** Phase 5 (selection logic complete)

**Requirements:** INTG-01 (decorator pattern), INTG-04 (key injection)

**Success Criteria** (what must be TRUE):

1. User can call wrapped `generateText()` with same API as Vercel AI SDK
2. Router injects selected API key transparently via `create*({ apiKey: selectedKey })` per request
3. Real API call to Google Gemini succeeds with cost-avoidance logic active
4. Usage tracking updates after successful API call with actual token counts from `result.usage`

**Plans:** 3/3 plans executed ✅ **Complete**

Plans:

- [x] 06-01-PLAN.md — Provider registry, middleware factory, routerModel wrapper, Router.wrapModel() integration
- [x] 06-02-PLAN.md — Real Gemini API POC validation (end-to-end key injection + usage tracking)
- [x] 06-03-PLAN.md — Gap closure: lazy ProviderRegistry initialization to fix createRouter test timeouts

---

### Phase 7: Integration & Error Handling

**Goal:** Router handles streaming, errors, and preserves all Vercel AI SDK features

**Depends on:** Phase 6 (basic integration working)

**Requirements:** INTG-02 (preserve AI SDK features), INTG-03 (error classification), INTG-05 (streaming support)

**Success Criteria** (what must be TRUE):

1. Streaming responses work via `streamText()` with usage tracking post-stream (via `onFinish` or `await stream.usage`)
2. Tool calling feature from AI SDK works through router wrapper
3. Structured output feature from AI SDK works through router wrapper
4. Router classifies errors: 429 rate limit, 401 auth, quota exhausted, network failures
5. Error messages include actionable context (which key, which limit, when resets)

**Plans:** 2/2 plans complete

Plans:

- [x] 07-01-PLAN.md — Error classes (AuthError, ProviderError, NetworkError), error classifier, event types, RouterEvent constants
- [x] 07-02-PLAN.md — Retry proxy with key rotation, wrapModel integration, middleware keyIndex tracking fix

---

### Phase 8: Provider Policies Catalog

**Goal:** User-configured limits are the primary mechanism for all 12 providers, with builder helpers for easy configuration, typed provider configs with JSDoc, skeleton JSON for structural reference, and comprehensive key acquisition documentation

**Depends on:** Phase 3 (policy engine), Phase 7 (retry proxy as safety net)

**Requirements:** PROV-01 through PROV-12 (all 12 providers), DX-02 (key acquisition docs)

**Success Criteria** (what must be TRUE):

1. Static default policies removed (google.ts, groq.ts, openrouter.ts, index.ts deleted)
2. Config has `applyRegistryDefaults` toggle (default: false) for future registry integration
3. Builder helpers (createTokenLimit, createRateLimit, createCallLimit) produce correct PolicyLimit objects
4. Each of the 12 providers has a typed config with JSDoc documentation
5. Empty provider skeleton JSON bundles all 12 providers with structural reference
6. Documentation includes step-by-step guide for obtaining free tier API key from each provider
7. Comparison table shows all 12 providers side-by-side
8. README recommends 2-3 easiest providers as starter set

**Plans:** 3/3 plans executed ✅ **Complete**

Plans:

- [x] 08-01-PLAN.md — Remove static defaults, config toggle, builder helpers, typed provider configs, skeleton JSON
- [x] 08-02-PLAN.md — Provider docs for Google, Groq, OpenRouter, Mistral, HuggingFace, Cerebras
- [x] 08-03-PLAN.md — Provider docs for DeepSeek, Qwen, Cloudflare, NVIDIA, Cohere, GitHub + comparison + README

---

### Phase 9: Fallback & Budget Management

**Goal:** Router enforces budget caps, handles exhaustion with capability-aware fallback to matching models (reasoning -> reasoning), and routes to cheapest paid options when budget allows

**Depends on:** Phase 5 (selection + model catalog), Phase 7 (error handling)

**Requirements:** CORE-04 (hard-stop enforcement), CORE-05 (fallback config), CORE-06 (budget cap), DX-05 (budget alerts), CAT-06 (capability-aware fallback), CAT-07 (cheapest matching fallback)

**Success Criteria** (what must be TRUE):

1. When all keys exhausted, router throws descriptive error (no API call made)
2. Fallback respects model capabilities: reasoning request only falls back to models with `reasoning: true`
3. When budget > $0, fallback routes to cheapest paid model with matching capabilities
4. User can configure per-provider fallback: hard-stop, cheapest paid model, alternative provider
5. Monthly budget cap enforces across all providers ($0 budget prevents any paid calls)
6. Budget alert fires hook when usage reaches 80% and 95% thresholds
7. Budget tracking persists across restarts

**Plans:** 3/3 plans complete

Plans:

- [x] 09-01-PLAN.md — Type contracts, config schema (fallback section), AllProvidersExhaustedError, budget/fallback event types
- [x] 09-02-PLAN.md — FallbackResolver (capability matching + ranking) and BudgetTracker (cost recording + events)
- [x] 09-03-PLAN.md — FallbackProxy orchestration, AffinityCache, middleware provider-ref update, createRouter integration

---

### Phase 10: SQLite, Redis & Advanced Features

**Goal:** SQLite and Redis storage adapters work for persistent and multi-process deployments with observability hooks and dry-run mode

**Depends on:** Phase 2 (StorageBackend interface + contract tests), Phase 9 (core features complete)

**Requirements:** USAGE-02 (SQLite + Redis persistence), DX-03 (observability hooks), DX-04 (dry-run mode)

**Success Criteria** (what must be TRUE):

1. SQLite implementation of `StorageBackend` interface passes same contract tests as MemoryStorage
2. Redis implementation of `StorageBackend` interface passes same contract tests as MemoryStorage
3. Concurrent requests from multiple Node.js processes update Redis atomically
4. Observability hook fires for: key selection, usage recording, limit warning, fallback trigger
5. Dry-run mode validates config and logs routing decisions without making API calls
6. Redis connection failures fall back to error (does not silently use memory)

**Plans:** 3/3 plans executed ✅ **Complete**

Plans:

- [x] 10-01-PLAN.md — SQLite storage adapter (SqliteStorage with better-sqlite3, XDG paths, WAL mode, migrations, contract tests)
- [x] 10-02-PLAN.md — Redis storage adapter (RedisStorage with ioredis, HINCRBY pipeline, TTL expiration, contract tests)
- [x] 10-03-PLAN.md — Build wiring (package.json exports, tsup entries, peer deps), typed observability hooks, dry-run mode

---

### Phase 11: Developer Experience Polish

**Goal:** Package is easy to debug and well-documented with full TypeScript support

**Depends on:** Phase 10 (all features complete)

**Requirements:** CORE-02 (multiple keys config), DX-01 (minimal config), DX-06 (debug mode), DX-07 (TypeScript types)

**Success Criteria** (what must be TRUE):

1. Minimal config example works with just API keys and provider names (sensible defaults for limits)
2. User can configure multiple API keys per provider (3 Google keys, 2 Groq keys) in config object
3. Debug mode logs routing decisions: which key selected, why (quota remaining), which limits checked
4. All public API exports have TypeScript types (config, events, error classes)
5. Documentation includes quickstart, configuration reference, and troubleshooting guide

**Plans:** 3/3 plans executed ✅ **Complete**

Plans:

- [x] 11-01-PLAN.md — Debug mode implementation, config validation improvements, typed defineConfig
- [x] 11-02-PLAN.md — README.md rewrite (npm landing page with quickstart, examples, architecture)
- [x] 11-03-PLAN.md — Reference docs (configuration.md, events.md, troubleshooting.md) + CONTRIBUTING refresh

---

### Phase 12: Provider Overhaul & Validation

**Goal:** Wire up 7 target providers, replace broken catalog-based fallback with user-configured model priority chain, add typed model IDs with validation, and validate everything with real API calls

**Depends on:** Phase 11 (all features and docs complete)

**Requirements:** CORE-03 (automatic selection), POLICY-06 (staleness warnings work)

**Context:** Provider audit (2026-03-15) revealed PennyLLM was targeting wrong providers and fallback is broken (static catalog doesn't match real provider model offerings). See `docs/providers/notes/` for detailed intelligence. No npm publish — private package for now.

**Target providers (7):** Cerebras, Google AI Studio, Groq, GitHub Models, SambaNova, NVIDIA NIM, Mistral
**Dropped (8):** HuggingFace, Cohere, Cloudflare, Qwen/DashScope, OpenRouter, Together AI, DeepSeek, Fireworks

**Scope:**

1. **Provider wiring** — Install AI SDK packages, register all 7 in ProviderRegistry (`@ai-sdk/cerebras`, `@ai-sdk/groq`, `@ai-sdk/mistral`, OpenAI-compat adapters for GitHub/SambaNova/NVIDIA)
2. **User-configured model priority chain** — Replace broken catalog-based FallbackResolver with explicit `models: [...]` config. User defines priority order, router tries in sequence. Free models first, paid as fallback.
3. **Reactive limit handling** — NO internal usage tracking for routing decisions. Provider 429/402 responses drive cooldown and fallback. Classify 429s by cooldown duration: SHORT (<2min, retry soon), LONG (>2min, skip provider), PERMANENT (402, remove from chain). Parse retry-after and x-ratelimit-\* headers per provider. UsageTracker kept for observability (getUsage API) only, decoupled from routing.
4. **Per-provider 429/402 error format research** — Must research exact response formats (headers, body, status codes) for all 7 providers to implement cooldown classifier correctly. This is a research prerequisite, not an assumption.
5. **Typed model IDs per provider** — TypeScript union types for each provider's available models (free + paid). IDE autocomplete for `'cerebras/llama-4-maverick'`, `'google/gemini-2.5-flash'`, etc. Models array validated at type level. Requires research on full model catalogs (free AND paid) per provider.
6. **Runtime validation** — `createRouter()` validates models have matching configured providers, warns on mismatches/typos, optional live probe on first call or dry-run
7. **Provider config refresh** — Update typed provider configs for new 7, add SambaNova (missing entirely), update user-facing docs from intelligence notes
8. **E2E testing** — Real API calls through the router for each provider. Verify: key injection, usage tracking, retry on 429, model chain fallback across providers
9. **Cleanup** — Mark dropped providers as unsupported, update README, comparison table, examples

**Success Criteria** (what must be TRUE):

1. All 7 providers registered in ProviderRegistry and can make real API calls
2. User-configured model chain works: router tries models in order, falls back on 429
3. Reactive cooldown classifier correctly parses 429/402 responses from all 7 providers
4. TypeScript autocomplete works for model IDs per provider (free + paid)
5. `createRouter()` validates model-provider consistency and warns on errors
6. E2E test passes with real API keys for 4+ providers
7. Provider docs updated for all 7 target providers
8. Dropped providers clearly marked as unsupported
9. UsageTracker records usage for observability but does NOT gate routing decisions

**Plans:** 6/6 plans complete

Plans:

- [ ] 12-01-PLAN.md — Provider modules (7 providers), types, registry, constants, peer deps
- [ ] 12-02-PLAN.md — Error classifier cooldown extension, CooldownManager provider-level tracking
- [ ] 12-03-PLAN.md — Config schema overhaul (chain fields, remove fallback section)
- [ ] 12-04-PLAN.md — Chain types and chain builder (auto + explicit modes)
- [ ] 12-05-PLAN.md — ChainExecutor, router.chat(), router.getStatus(), createRouter refactor
- [ ] 12-06-PLAN.md — Delete old fallback code, E2E test script, docs refresh

---

### Phase 12.1: Provider Nuance Gap Analysis (INSERTED)

**Goal:** Audit PennyLLM's abstractions against real provider behavior and identify gaps where the current design doesn't match reality

**Depends on:** Phase 12 (real API testing reveals the gaps)

**Input:** Provider intelligence notes in `docs/providers/notes/` (9 providers researched, 7 kept)

**Target providers (locked 2026-03-15):** Cerebras, Google AI Studio, Groq, GitHub Models, SambaNova, NVIDIA NIM, Mistral
**Dropped:** HuggingFace, Cohere, Cloudflare, Qwen/DashScope, OpenRouter, Together AI, DeepSeek, Fireworks (see `docs/providers/notes/DROPPED.md`)

**Scope:**

- Systematic comparison of each target provider's actual behavior vs PennyLLM's per-key limit model
- Categorize gaps: (a) works but suboptimal, (b) incorrect behavior, (c) missing capability
- Produce a prioritized gap report that feeds into Phase 13+ planning
- Recommend which gaps to fix in a patch release vs defer to v2.0

**Known gaps (categorized, updated for reactive approach):**

_Note: With reactive limit handling (429-driven), many gaps around limit modeling become less critical. The 429 handles routing regardless of limit type. Remaining gaps are about DX and documentation._

_(a) Works but suboptimal:_

- Per-account limits where key rotation is useless (Mistral, Cerebras): multiple keys waste config space but reactive 429 handling still works correctly (both keys get same 429)
- Google 0/0/0 models: no "model unavailable on tier" concept — would try, get 429, cooldown. Works but wastes a request.

_(b) Documentation/DX gaps:_

- SambaNova free vs developer tier (20 RPD vs 12,000 RPD): docs must strongly recommend linking a card
- Per-request token caps (GitHub Models: 8K in / 4K out): user should know to keep prompts small for o3/GPT-4o
- Mistral data privacy opt-out: docs must mention this

_(c) Deferred to v2 (Phase 13):_

- Credit-based billing (NVIDIA NIM): credit depletion detection → Phase 13
- Credit expiry modeling (SambaNova $5 / 30-day) → Phase 13

**Plans:** 2/2 plans complete

Plans:

- [ ] 12.1-01-PLAN.md — Gap report with provider-by-provider analysis, cross-cutting gaps, priority matrix
- [ ] 12.1-02-PLAN.md — Update provider notes with gap analysis sections and DX recommendations

### Phase 13: Credit-Based Limits

**Goal:** Handle providers with finite credits (NVIDIA NIM, SambaNova) — track credit depletion, detect exhaustion, stop routing to exhausted providers

**Depends on:** Phase 12

**Success Criteria** (what must be TRUE):

1. `createCreditLimit()` builder for credit-based providers
2. Credit depletion tracking (estimate remaining credits from usage)
3. Expiry date modeling for time-limited credits (SambaNova $5 / 30-day)
4. Router stops routing to a provider when credits are estimated exhausted
5. `credit:low` and `credit:exhausted` events fire

**Plans:** 2/2 plans complete

Plans:

- [ ] 13-01-PLAN.md — Credit types, config schema expansion (credits:number to credits:object), createCreditLimit builder, event constants
- [ ] 13-02-PLAN.md — CreditTracker class, ChainExecutor credit gate, createRouter wiring, getStatus extension

---

### Phase 14: Health Scoring & Circuit Breakers

**Goal:** Live health awareness before routing — per-provider health scores, circuit breakers with escalating cooldowns, recovery detection

**Depends on:** Phase 12

**Reference:** free-coding-models P2C algorithm (Power-of-2-Choices selection with health scoring)

**Success Criteria** (what must be TRUE):

1. Per-provider health score (success rate, latency, availability)
2. Circuit breaker: open after N consecutive failures, half-open probe for recovery
3. Escalating cooldowns (15m → 30m → 60m, capped)
4. `provider:recovered` event when exhausted/broken provider becomes available
5. Health scores influence model chain ordering (skip unhealthy providers)

**Plans:** 6 plans

Plans:

- [ ] 12-01-PLAN.md — Provider modules (7 providers), types, registry, constants, peer deps
- [ ] 12-02-PLAN.md — Error classifier cooldown extension, CooldownManager provider-level tracking
- [ ] 12-03-PLAN.md — Config schema overhaul (chain fields, remove fallback section)
- [ ] 12-04-PLAN.md — Chain types and chain builder (auto + explicit modes)
- [ ] 12-05-PLAN.md — ChainExecutor, router.chat(), router.getStatus(), createRouter refactor
- [ ] 12-06-PLAN.md — Delete old fallback code, E2E test script, docs refresh

---

### Phase 15: CLI Validator

**Goal:** `npx pennyllm validate` makes real test calls to verify provider+model configuration works

**Depends on:** Phase 12

**Success Criteria** (what must be TRUE):

1. `npx pennyllm validate` reads config and tests each provider+model with a real API call
2. Reports: key valid, model exists, response received, latency measured
3. Actionable error messages (wrong key format, model not found, rate limited)
4. CI-friendly exit codes (0 = all pass, 1 = failures, 2 = warnings)
5. Does NOT count against user's rate limits excessively (1 lightweight call per model)

**Plans:** 6 plans

Plans:

- [ ] 12-01-PLAN.md — Provider modules (7 providers), types, registry, constants, peer deps
- [ ] 12-02-PLAN.md — Error classifier cooldown extension, CooldownManager provider-level tracking
- [ ] 12-03-PLAN.md — Config schema overhaul (chain fields, remove fallback section)
- [ ] 12-04-PLAN.md — Chain types and chain builder (auto + explicit modes)
- [ ] 12-05-PLAN.md — ChainExecutor, router.chat(), router.getStatus(), createRouter refactor
- [ ] 12-06-PLAN.md — Delete old fallback code, E2E test script, docs refresh

---

### Phase 16: Provider Data Registry

**Goal:** Separate published community resource documenting free tier limits, models, and signup URLs for all providers — NOT part of PennyLLM code

**Depends on:** Phase 12 (intelligence notes as source material)

**Format:** Standalone repo or JSON file (e.g., `awesome-free-llm-keys`) that can be:

- Referenced from PennyLLM docs
- Consumed by other tools
- Eventually imported into PennyLLM as optional data source

**Success Criteria** (what must be TRUE):

1. Published resource with structured data for 7+ providers
2. Per-provider: signup URL, env var name, free tier limits, available models, AI SDK package
3. Community-maintainable (PRs welcome format)
4. PennyLLM docs link to it as authoritative provider reference

**Plans:** 6 plans

Plans:

- [ ] 12-01-PLAN.md — Provider modules (7 providers), types, registry, constants, peer deps
- [ ] 12-02-PLAN.md — Error classifier cooldown extension, CooldownManager provider-level tracking
- [ ] 12-03-PLAN.md — Config schema overhaul (chain fields, remove fallback section)
- [ ] 12-04-PLAN.md — Chain types and chain builder (auto + explicit modes)
- [ ] 12-05-PLAN.md — ChainExecutor, router.chat(), router.getStatus(), createRouter refactor
- [ ] 12-06-PLAN.md — Delete old fallback code, E2E test script, docs refresh

---

## v1.0 Progress Table

| Phase                              | Plans Complete | Status   | Completed  |
| ---------------------------------- | -------------- | -------- | ---------- |
| 1. Foundation Setup                | 2/2            | Complete | ✅         |
| 2. State Storage & Persistence     | 1/1            | Complete | ✅         |
| 3. Policy Engine                   | 2/2            | Complete | ✅         |
| 4. Usage Tracking Core             | 2/2            | Complete | ✅         |
| 5. Model Catalog & Selection       | 5/5            | Complete | ✅         |
| 6. Base Router Integration         | 3/3            | Complete | 2026-03-13 |
| 7. Integration & Error Handling    | 2/2            | Complete | 2026-03-13 |
| 8. Provider Policies Catalog       | 3/3            | Complete | 2026-03-14 |
| 9. Fallback & Budget Management    | 3/3            | Complete | 2026-03-14 |
| 10. SQLite, Redis & Advanced       | 3/3            | Complete | 2026-03-14 |
| 11. Developer Experience Polish    | 3/3            | Complete | 2026-03-14 |
| 12. Provider Overhaul & Validation | 6/6            | Complete | 2026-03-17 |
| 12.1 Provider Nuance Gap Analysis  | 2/2            | Complete | 2026-03-17 |

## v2.0 Progress Table

| Phase                                 | Plans Complete | Status      | Completed  |
| ------------------------------------- | -------------- | ----------- | ---------- |
| 13. Credit-Based Limits               | 2/2            | Complete    | 2026-03-18 |
| 14. Health Scoring & Circuit Breakers | 0/?            | Not started | -          |
| 15. CLI Validator                     | 0/?            | Not started | -          |
| 16. Provider Data Registry            | 0/?            | Not started | -          |

## v2.0 Dependency Graph

```
Phase 12 (v1.0 ships) → Phase 12.1 (gap analysis)
  ├── Phase 13 (Credit-Based Limits) — needed for NVIDIA NIM, SambaNova
  ├── Phase 14 (Health Scoring) — live health checks, circuit breakers
  ├── Phase 15 (CLI Validator) — test calls to validate config
  └── Phase 16 (Provider Data Registry) — separate published resource, not code
```

## Research Milestones

**Phase 6 prerequisite:** Vercel AI SDK POC validation

- Test `wrapLanguageModel()` middleware with key injection
- Validate `result.usage` token metadata extraction
- Confirm streaming `onFinish` callback works for usage tracking
- Test `create*({ apiKey })` provider instance creation overhead

**Phase 8 prerequisite:** Empirical free tier limit testing

- Create test accounts for all 12 providers
- Systematically probe limits (tokens, calls, rate windows)
- Observe enforcement behavior (hard block vs throttle)
- Document reset timing (calendar vs rolling windows)

## Technical Decisions

**Base package:** Vercel AI SDK (`ai` on npm)

- 36M weekly downloads, Apache-2.0 license, TypeScript-first
- Native `wrapLanguageModel()` middleware for transparent interception
- Per-request key injection via `create*({ apiKey })` — lightweight, no persistent connection
- Full token usage metadata on both `generateText` and `streamText`
- 30+ first-party providers covering all free tier targets
- Evaluated against: LiteLLM (Python, proxy, 1M LOC), LangChain.js (broken streaming usage), OpenAI SDK (single provider), Portkey (gateway service), Mastra (full framework), TanStack AI (alpha), Instructor.js (stale), ModelFusion (merged into AI SDK)

**Storage architecture (Phase 2 pivot):**

- Memory-first with zero dependencies as default
- StorageBackend is a runtime instance parameter, not JSON config
- SQLite + Redis are optional peer-dep adapters in Phase 10
- Contract test suite ensures all adapters satisfy the same interface

**Model catalog sources:**

- models.dev — capabilities, pricing, context windows (primary, open source)
- OpenRouter API — 12 use-case categories, live pricing (supplementary)
- Artificial Analysis API — benchmark scores for quality tiers (supplementary)
- `@tokenlens/models` — TypeScript bridge to models.dev (optional dependency)
- Static bundled snapshot — offline fallback

**Abstractions (3 interfaces, everything else concrete):**

- `StorageBackend` — Memory/SQLite/Redis swap
- `ModelCatalog` — data source swap (models.dev/OpenRouter/static)
- `SelectionStrategy` — algorithm swap (round-robin/least-used/custom)

## Notes

- **Granularity:** Fine decomposition — 12 v1 phases (linear), 10 v2 phases (DAG with parallel tracks)
- **Dependencies:** v1 is a linear chain with two research gates; v2 forms a DAG rooted at Phase 12
- **Research gates:** Phase 6 requires AI SDK POC, Phase 8 requires empirical testing
- **Coverage:** All 55 v1 requirements mapped to phases (verified complete); all 20 v2 requirements mapped to phases 13-22
- **Architecture:** Three abstraction boundaries at real swap points, concrete everywhere else
- **Standard npm practices:** flat src/, debug for logging, Node EventEmitter for events, Zod for validation
- **LiteLLM as reference:** Router patterns (deployment groups, cooldown, weighted routing, fallback chains) re-implemented in TypeScript

---

_Roadmap created: 2026-03-11_
_Updated: 2026-03-12 (base package decided, model catalog added, capability-aware fallback added)_
_Phase 1 complete: 2 plans in 2 waves_
_Phase 2 planned: 1 plan in 1 wave_
_Phase 3 planned: 2 plans in 2 waves_
_Phase 4 planned: 2 plans in 2 waves_
_Phase 5 revised: 5 plans in 4 waves (added Wave 0 test scaffolds)_
_Phase 6 revised: 2 plans in 2 waves (added real API POC, removed test scaffolds per build-first strategy)_
_Phase 6 gap closure: 1 plan added (lazy ProviderRegistry initialization to fix test timeouts)_
_Phase 7 planned: 2 plans in 2 waves (error classification + retry proxy with key rotation)_
_Phase 8 planned: 3 plans in 2 waves (code changes + provider documentation)_
_Phase 9 planned: 3 plans in 3 waves (type contracts + core logic modules + integration wiring)_
_Phase 10 planned: 3 plans in 2 waves (SQLite adapter + Redis adapter parallel, then wiring + DX features)_
_Phase 11 planned: 3 plans in 2 waves (code changes, then README + reference docs parallel)_
_Phase 11 complete: 3 plans in 2 waves (debug mode + config validation, then README + reference docs parallel)_
_v2.0 milestone added: 10 phases (13-22) with dependency graph, 20 requirements mapped_
_Phase 12.1 planned: 2 plans in 1 wave (gap report + provider note updates, parallel)_
