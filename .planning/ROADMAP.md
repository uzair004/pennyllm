# Roadmap: LLM Router

**Project:** LLM Router - Cost-avoidance layer for LLM API calls
**Core Value:** Never get charged for LLM API calls — rotate through free tier keys intelligently
**Base Package:** Vercel AI SDK (decided after evaluating LiteLLM fork, LangChain.js, OpenAI SDK, and 7 others)
**Granularity:** Fine (12 phases)
**Created:** 2026-03-11
**Updated:** 2026-03-12
**Coverage:** 55/55 v1 requirements mapped

## Phases

- [ ] **Phase 1: Foundation Setup** - Project scaffolding, TypeScript config, build tooling, core interfaces, domain types
- [ ] **Phase 2: State Storage & Persistence** - SQLite implementation, StorageBackend interface, migration system
- [ ] **Phase 3: Policy Engine** - Declarative config loader, policy evaluation, versioning
- [ ] **Phase 4: Usage Tracking Core** - Multi-window tracking, atomic operations, reset logic
- [ ] **Phase 5: Model Catalog & Selection** - Live model catalog (models.dev, OpenRouter), capability flags, quality tiers, selection algorithms
- [ ] **Phase 6: Base Router Integration** - Vercel AI SDK `wrapLanguageModel()` middleware, key injection via `create*({ apiKey })`
- [ ] **Phase 7: Integration & Error Handling** - Error classification, streaming support, tool calling, structured output passthrough
- [ ] **Phase 8: Provider Policies Catalog** - Default free tier policies for 12 providers with researched limits
- [ ] **Phase 9: Fallback & Budget Management** - Capability-aware fallback chains, cheap paid model routing, budget caps, threshold alerts
- [ ] **Phase 10: Redis & Advanced Features** - Redis storage, observability hooks, dry-run mode
- [ ] **Phase 11: Developer Experience Polish** - Debug logging, TypeScript types, comprehensive docs
- [ ] **Phase 12: Testing & Validation** - E2E tests, empirical limit validation, npm publishing

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

**Plans:** TBD

---

### Phase 2: State Storage & Persistence
**Goal:** Usage data persists across restarts via SQLite with schema supporting multi-window tracking

**Depends on:** Phase 1 (TypeScript setup, StorageBackend interface)

**Requirements:** USAGE-02 (SQLite persistence), USAGE-05 (atomic concurrent access)

**Success Criteria** (what must be TRUE):
1. SQLite implementation of `StorageBackend` interface passes all interface contract tests
2. Usage data written to SQLite survives application restart
3. Concurrent writes to same key do not corrupt data or lose updates (atomic increment)
4. Schema supports storing multiple time windows per key (per-minute, hourly, daily, monthly)

**Plans:** TBD

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

**Plans:** TBD

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

**Plans:** TBD

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

**Plans:** TBD

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

**Plans:** TBD

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

**Plans:** TBD

---

### Phase 8: Provider Policies Catalog
**Goal:** Package ships with researched default policies for 12 free tier providers

**Depends on:** Phase 3 (policy engine), Phase 7 (can test with real APIs)

**Requirements:** PROV-01 through PROV-12 (all 12 providers), DX-02 (key acquisition docs)

**Success Criteria** (what must be TRUE):
1. Default policies exist for all 12 providers: Google, Groq, OpenRouter, Mistral, HuggingFace, Cerebras, DeepSeek, Qwen, Cloudflare, NVIDIA, Cohere, GitHub
2. Each policy includes limits (tokens, calls, rate), reset windows, enforcement behavior
3. Documentation includes step-by-step guide for obtaining free tier API key from each provider
4. Policies include metadata: researched date, confidence level, source URL

**Plans:** TBD

---

### Phase 9: Fallback & Budget Management
**Goal:** Router enforces budget caps, handles exhaustion with capability-aware fallback to matching models (reasoning → reasoning), and routes to cheapest paid options when budget allows

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

**Plans:** TBD

---

### Phase 10: Redis & Advanced Features
**Goal:** Redis storage option works for multi-process deployments with observability hooks

**Depends on:** Phase 2 (StorageBackend interface), Phase 9 (core features complete)

**Requirements:** USAGE-02 (Redis option), DX-03 (observability hooks), DX-04 (dry-run mode)

**Success Criteria** (what must be TRUE):
1. Redis implementation of `StorageBackend` interface passes same contract tests as SQLite
2. Concurrent requests from multiple Node.js processes update Redis atomically
3. Observability hook fires for: key selection, usage recording, limit warning, fallback trigger
4. Dry-run mode validates config and logs routing decisions without making API calls
5. Redis connection failures fall back to error (does not silently use SQLite)

**Plans:** TBD

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

**Plans:** TBD

---

### Phase 12: Testing & Validation
**Goal:** Package is validated with real APIs, tested end-to-end, and published to npm

**Depends on:** Phase 11 (all features and docs complete)

**Requirements:** CORE-03 (automatic selection), POLICY-06 (staleness warnings work)

**Success Criteria** (what must be TRUE):
1. E2E test suite passes with real API keys for 3+ providers
2. Empirical testing validates at least 5 provider free tier limits (match documentation)
3. Package published to npm registry with semantic version 1.0.0
4. Installation from npm works: `npm install llm-router` succeeds in blank project
5. Limit staleness warning triggers correctly for policies older than 30 days

**Plans:** TBD

---

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation Setup | 0/? | Not started | - |
| 2. State Storage & Persistence | 0/? | Not started | - |
| 3. Policy Engine | 0/? | Not started | - |
| 4. Usage Tracking Core | 0/? | Not started | - |
| 5. Model Catalog & Selection | 0/? | Not started | - |
| 6. Base Router Integration | 0/? | Not started | - |
| 7. Integration & Error Handling | 0/? | Not started | - |
| 8. Provider Policies Catalog | 0/? | Not started | - |
| 9. Fallback & Budget Management | 0/? | Not started | - |
| 10. Redis & Advanced Features | 0/? | Not started | - |
| 11. Developer Experience Polish | 0/? | Not started | - |
| 12. Testing & Validation | 0/? | Not started | - |

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

**Model catalog sources:**
- models.dev — capabilities, pricing, context windows (primary, open source)
- OpenRouter API — 12 use-case categories, live pricing (supplementary)
- Artificial Analysis API — benchmark scores for quality tiers (supplementary)
- `@tokenlens/models` — TypeScript bridge to models.dev (optional dependency)
- Static bundled snapshot — offline fallback

**Abstractions (3 interfaces, everything else concrete):**
- `StorageBackend` — SQLite/Redis swap
- `ModelCatalog` — data source swap (models.dev/OpenRouter/static)
- `SelectionStrategy` — algorithm swap (round-robin/least-used/custom)

## Notes

- **Granularity:** Fine decomposition (12 phases) enables focused implementation and testing
- **Dependencies:** Linear dependency chain with two research gates
- **Research gates:** Phase 6 requires AI SDK POC, Phase 8 requires empirical testing
- **Coverage:** All 55 v1 requirements mapped to phases (verified complete)
- **Architecture:** Three abstraction boundaries at real swap points, concrete everywhere else
- **Standard npm practices:** flat src/, debug for logging, Node EventEmitter for events, Zod for validation
- **LiteLLM as reference:** Router patterns (deployment groups, cooldown, weighted routing, fallback chains) re-implemented in TypeScript

---

*Roadmap created: 2026-03-11*
*Updated: 2026-03-12 (base package decided, model catalog added, capability-aware fallback added)*
*Next step: `/gsd:plan-phase 1` to decompose Phase 1 into executable plans*
