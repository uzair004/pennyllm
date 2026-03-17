# Phase 12: Provider Overhaul & Validation - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire up 7 target providers (Cerebras, Google AI Studio, Groq, GitHub Models, SambaNova, NVIDIA NIM, Mistral), replace broken catalog-based fallback with user-configured model priority chain, add reactive 429/402-driven cooldowns with escalating backoff, typed model IDs per provider, and validate everything with real API calls.

Requirements: CORE-03 (automatic selection), POLICY-06 (staleness warnings)

</domain>

<decisions>
## Implementation Decisions

### Model Chain: Config Shape

- **Two config paths**: auto-generated chain (zero-config) OR explicit top-level `models` array (full control)
- **Auto chain**: package ships curated model registry per provider (top 3-5 models each, quality-tiered). When `models` array is omitted, package auto-generates the chain ranked by quality tier, interleaved by provider priority
- **Explicit chain**: top-level `models: ['cerebras/llama-4-maverick', 'google/gemini-2.5-flash', ...]` defines exact routing order. Overrides auto-generation completely
- **Provider priority**: `priority` number on each provider config (lower = tried first). Among same-priority providers, auto-chain interleaves by model quality tier
- **Per-provider model list**: optional `models` array on provider config. When present with auto-chain: controls which models and their order for that provider. When present with explicit top-level `models`: acts as allowlist (validation — reject models not in the list at startup with ConfigError)
- **Chain interleaving**: round-robin by provider priority, then by model order within each provider. E.g., priority 1 first model, priority 2 first model, priority 3 first model, priority 1 second model, etc.
- **Free-only unless budget > $0**: auto chain includes only free-tier models by default. Paid models appended at end only when `budget.monthlyLimit > 0`
- **Unknown models allowed**: if user puts a model ID not in curated registry, allow + warn at startup ("model X not in known registry for provider Y, will attempt anyway"). Runtime 404 → skip + warn
- **Always log chain at startup**: at createRouter(), log the full chain with model names, tiers, free/paid status. Always visible, not just debug mode

### Model Chain: Runtime Behavior

- **Start from top every request**: every new request walks the chain from position 1. Check cooldown/availability BEFORE attempting API call. Skip cooling/depleted entries. Never sticky — always re-evaluate from top
- **Per-key cooldown**: each key = independent account/project with independent limits (documented assumption). Key1 getting 429'd says nothing about key2
- **Retry proxy rotates keys first**: on 429, retry proxy tries all keys for that provider. Only when ALL keys for a provider are exhausted does the chain advance to next provider
- **Per-provider escalating backoff**: when all keys for a provider fail, provider-level cooldown with exponential backoff: base → 2x → 4x → ... cap at 15 minutes. Reset counter on first success. Always use max(retry-after header, calculated backoff)
- **Same-account key detection**: best-effort runtime warning if two keys for same provider get 429'd simultaneously with similar retry-after values
- **Stale model handling**: model returns 404 → skip for session + warn. Not persisted — fresh start on router restart
- **Chain is immutable for session**: built at createRouter(), can't be modified at runtime. To change: create new router instance. Defer runtime modification to v2

### Model Chain: API Surface

- **`router.chat()`**: returns LanguageModelV3 proxy that walks the chain on each doGenerate/doStream call. Transparent to AI SDK — user code unchanged
- **`router.chat({ capabilities, provider, tier })`**: optional per-request filters. Filter chain to models matching capabilities (e.g., `['reasoning']`), specific provider, or quality tier. Default: full chain
- **`router.model('provider/model')`**: existing API, requests specific model. Bypasses chain. On 429 with all keys exhausted, throws ProviderError (no chain fallback). Error message suggests using router.chat() for automatic fallback
- **`router.getStatus()`**: returns current state of all chain entries — available, cooling (with recovery time), or depleted. Useful for dashboards and debugging
- **Response metadata**: `result.providerMetadata.pennyllm` includes `resolvedModel`, `resolvedProvider`, `chainPosition`, `fallbackUsed`, `attempts[]`
- **`chain:resolved` event**: fires on every request with resolvedModel, chainPosition, fallbackUsed, latencyMs

### Model Chain: Streaming

- **Setup-phase retryable**: doStream() call itself is retryable — 429 at setup triggers chain advance to next model
- **Mid-stream NOT retryable**: once streaming starts, mid-stream errors surface to user. No silent model switch after partial response delivered

### Existing Fallback System Fate

- **DELETE FallbackResolver**: catalog-based model discovery replaced by chain
- **DELETE AffinityCache**: chain order is deterministic, no caching needed
- **REFACTOR FallbackProxy → ChainExecutor**: keep the error-catching orchestration pattern, but rewrite to walk the chain instead of querying the resolver
- **DROP strictModel config**: chain covers this — single-model chain = no fallback
- **DROP modelMappings config**: chain IS the explicit mapping
- **DROP fallback config section entirely**: chain length IS the max depth. No separate `fallback: { enabled, behavior, maxDepth }` needed
- **KEEP ModelCatalog for enrichment only**: not in routing path. Used for: pricing data (budget tracker), context window info, capability metadata for debug logs. Never for model discovery
- **Budget gating inline in chain executor**: when walking chain and hitting a paid model, check budget. If exhausted, skip paid models, continue to next free model in chain

### Provider Tier System

- **Provider-level `tier` field**: `'free'` (perpetual, resets), `'trial'` (finite credits, doesn't reset), `'paid'` (budget-gated)
- **`credits` field for trial providers**: e.g., `nvidia: { tier: 'trial', credits: 1000 }`
- **Phase 12 scope**: define config schema + reactive 402 handling. 402 → permanent session cooldown. No credit depletion tracking yet
- **Phase 13 scope**: proper credit tracking, balance estimation, proactive exhaustion detection

### Reactive Cooldown Design

- **Extend existing ClassifiedError**: add `cooldownMs` (parsed duration) and `cooldownClass` ('short' | 'long' | 'permanent') to the error classification
- **SHORT (<2min)**: typical rate limit, retry soon
- **LONG (>2min)**: extended rate limit, skip provider for a while
- **PERMANENT (402)**: provider depleted for session. All models from that provider skipped permanently. Event: `provider:depleted`
- **Extend CooldownManager**: add provider-level tracking alongside existing per-key tracking. Single source of truth for "is this key/provider available?"
- **Cooldown persists to storage**: survives restarts via StorageBackend (user chose persistence over in-memory)
- **Default cooldown when no retry-after**: use existing `cooldown.defaultDurationMs` config (default 60s). Escalating backoff applies on top
- **429/402 header parsing**: research agent MUST investigate exact response formats for all 7 providers during planning. Any discrepancy from our design assumptions (missing retry-after, non-standard headers, unexpected status codes) MUST be surfaced as a gap or blocker — no guessing or assumptions

### Cooldown: Observability

- **UsageTracker records 429 events**: getUsage() includes rateLimitHits, lastRateLimited, cooldownsTriggered, totalCooldownMs per provider/key
- **router.getStatus()**: query current cooldown/availability state for all chain entries

### Curated Model Registry

- **Per-provider TypeScript modules**: `src/providers/cerebras.ts`, `google.ts`, `groq.ts`, `github-models.ts`, `sambanova.ts`, `nvidia-nim.ts`, `mistral.ts`
- **Same pattern for all 7**: models, adapter factory, metadata, createProvider function. Whether official SDK or OpenAI-compat adapter, same module shape
- **Each module includes**: id, lastVerified date, verifiedBy, updateUrl (link to provider's model docs), SDK package name, base URL (for compat adapters), auth config, curated models array with (id, API ID, quality tier, free/paid, capabilities)
- **Staleness warning at 30 days**: if `lastVerified` > 30 days old, emit `provider:stale` event at startup with days since verified
- **CLAUDE.md update instructions**: documented process for updating provider models (check docs, update array, bump date, validate, commit)
- **TypeScript `as const` for autocomplete**: known model IDs available as suggestions in IDE

### Provider SDK Dependencies

- **All optional peer dependencies**: @ai-sdk/cerebras, @ai-sdk/google, @ai-sdk/groq, @ai-sdk/mistral, @ai-sdk/openai (for compat adapters). User installs only what they need
- **peerDependenciesMeta**: all marked optional
- **Lazy load configured providers only**: at createRouter(), only dynamic-import SDKs for providers in user's config. Unconfigured providers never loaded
- **Clear error on missing SDK**: ConfigError: "Install @ai-sdk/cerebras to use cerebras provider"

### OpenAI-Compat Adapters (GitHub, SambaNova, NVIDIA)

- **Research-first approach**: research agent investigates whether createOpenAI({ baseURL }) works for each. Verifies: auth quirks, streaming compatibility, response format. Any issues surfaced, not assumed
- **Co-located with model data**: adapter factory lives in same module as curated models for that provider
- **Community providers considered**: if a community provider (e.g., sambanova-ai-provider) is more reliable than createOpenAI wrapper, use it. Research agent evaluates

### E2E Testing

- **Manual test script**: `scripts/e2e-test.ts`, run with real keys from .env
- **NOT in CI**: CI shouldn't depend on external APIs
- **Tests per provider**: key works, generateText responds, usage tracked, streamText works, chain fallback works
- **Target**: 4+ providers passing

### All Providers Exhausted Error

- **Rich AllProvidersExhaustedError**: which models tried, why each failed (429/402/budget), cooldown times, earliest recovery time, suggestion to add more providers or keys

### Claude's Discretion

- Exact ChainExecutor implementation architecture (how it composes with retry proxy)
- Auto-chain generation algorithm details (exact interleaving logic)
- CooldownManager storage key patterns for persistence
- router.getStatus() response shape details
- E2E test script structure and output format
- Exact TypeScript types for the curated model registry
- How to handle ProviderRegistry refactoring (existing class vs replacement)

</decisions>

<specifics>
## Specific Ideas

- "use top models across providers then fallback to other models within provider" — drove the interleaving design
- "user should be able to set priority at every level" — drove provider priority + per-provider model list + top-level override
- "if the request went to paid one it'll probably never hit 429... how will the package stop hitting it" — drove start-from-top-each-request design with cooldown checks before calling
- "is it possible that it keeps hitting the same key which went in cooldown" — drove escalating backoff with cap
- "multiple accounts for same provider or multiple projects in google case... limits are different" — drove per-key cooldown (each key = independent pool) assumption
- "should be a constant way to update these lists" — drove CLAUDE.md update instructions + lastVerified + staleness warnings
- "if there is any discrepancy... not assumptions or guessing" — hard requirement for research agent to surface all provider-specific issues

</specifics>

<code_context>

## Existing Code Insights

### Reusable Assets

- `ProviderRegistry` (src/wrapper/provider-registry.ts): dynamic import + register pattern. Needs refactoring — currently only loads Google. Will be replaced by per-provider module factories
- `classifyError()` (src/wrapper/error-classifier.ts): already parses 429, retry-after, auth errors. Extend with cooldownMs and cooldownClass fields
- `CooldownManager` (src/usage/cooldown.ts): per-key cooldown tracking. Extend with provider-level escalating backoff
- `FallbackProxy` (src/fallback/FallbackProxy.ts): ~490 lines of error-catching orchestration. Refactor into ChainExecutor — keep the doGenerate/doStream proxy pattern, replace resolver with chain walking
- `BudgetTracker` (src/budget/BudgetTracker.ts): budget gating logic. Move inline into chain executor
- `RetryProxy` (src/wrapper/retry-proxy.ts): per-provider key rotation on 429. Stays as-is — chain executor wraps it
- `AllProvidersExhaustedError` (src/errors/): already exists with provider attempts. Extend with chain position info
- `createRouterMiddleware` (src/wrapper/middleware.ts): usage tracking middleware. Stays — wraps the chain proxy
- `UsageTracker` (src/usage/): kept for observability. Extend with 429 event recording
- Provider intelligence notes: `docs/providers/notes/` (9 files, 7 kept providers)

### Established Patterns

- LanguageModelV3 proxy pattern (doGenerate/doStream interception) — used by RetryProxy, FallbackProxy, will be used by ChainExecutor
- Fire-and-forget for non-critical ops (events, usage recording)
- Mutable ref pattern ({ current: value }) for sharing state between proxy and middleware
- Dynamic import with try/catch for optional dependencies
- `debug` package with component namespaces
- `exactOptionalPropertyTypes` — conditional object field construction

### Integration Points

- `createRouter()` (src/config/index.ts): needs new chain building logic, provider SDK loading, chain logging
- `src/fallback/` directory: FallbackResolver and AffinityCache deleted. FallbackProxy refactored to ChainExecutor
- `src/config/schema.ts`: new fields — `models` array, provider `priority`, provider `tier`, provider `credits`, provider `models`
- `src/types/config.ts`: RouterConfig updated — drop `fallback` section, add chain fields
- `src/constants/index.ts`: new provider IDs, event names (chain:resolved, provider:depleted, provider:stale)
- `package.json`: new optional peer dependencies for 6 additional AI SDK packages

</code_context>

<deferred>
## Deferred Ideas

- **Credit depletion tracking** — Phase 13: proper credit balance tracking, per-call cost deduction, proactive exhaustion detection, createCreditLimit() builder
- **Circuit breaker pattern** — Phase 14: health scoring, circuit breakers with half-open state
- **CLI validator** — Phase 15: `npx pennyllm validate` for real API call verification
- **Runtime chain modification** — v2: add/remove models from chain without restart
- **Per-request model preferences beyond filters** — v2: more sophisticated per-request chain customization
- **Configurable cooldown scope per provider** — v2: let user choose per-key vs per-account cooldown behavior per provider

</deferred>

---

_Phase: 12-provider-overhaul-validation_
_Context gathered: 2026-03-17_
