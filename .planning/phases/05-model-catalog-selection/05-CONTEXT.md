# Phase 5: Model Catalog & Selection - Context

**Gathered:** 2026-03-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Router has access to model metadata (capabilities, pricing, quality tiers) from live sources and selects optimal keys using configurable strategies. Selection is per-provider (which key for this provider). Cross-provider routing is Phase 9 (fallback). Vercel AI SDK integration is Phase 6. Error classification is Phase 7.

</domain>

<decisions>
## Implementation Decisions

### Model Catalog - Data Sources & Fetching

- **Direct API fetch** from models.dev (primary) using native fetch(). No @tokenlens/models dependency
- **OpenRouter fills gaps** only — models not in models.dev get supplemented from OpenRouter. models.dev wins on conflicts
- **Zod validation on API response** — validate each model entry individually. Skip bad entries, keep good ones. Debug-log skipped models
- **5s timeout, no retry** on API fetches. Fall back to stale cache or static snapshot on any failure (including 429)
- **One entry per provider+model combo** — 'groq/llama-3.3-70b' and 'openrouter/llama-3.3-70b' are separate entries

### Model Catalog - Caching & Refresh

- **Lazy on first use** — fetch from APIs on first access, then cache in memory. No background timers
- **24-hour cache TTL** — after expiry, next access triggers re-fetch
- **Memory-only cache** — no disk persistence. Small data (~50-100 models, few KB)
- **Serve stale cache on failure** — if APIs unreachable, keep using expired cache. Debug-warn. Try again on next TTL expiry
- **Auto-heal on TTL expiry** — stale cache/snapshot also has a TTL. Once expired, next access tries live API. If API is back, catalog updates transparently
- **Single in-flight fetch** deduplication — if refresh already in progress, return same Promise to all callers
- **Eager init at createRouter()** — catalog fetched during router initialization. Static snapshot used if API fails at startup

### Model Catalog - Static Snapshot

- **Bundled JSON in npm package** — static-catalog.json shipped with the package
- **12 supported providers only** — Google, Groq, OpenRouter, Mistral, HuggingFace, Cerebras, DeepSeek, Qwen, Cloudflare, NVIDIA, Cohere, GitHub
- **Combined snapshot generation:** CI weekly auto-update PR + manual `npm run update-catalog` + prepublishOnly hook. Maximum freshness

### Model Catalog - Metadata

- **Pricing normalized to per-1M tokens** — USD per 1 million tokens (prompt + completion separately). ModelMetadata.pricing updates from per1kTokens to per1MTokens
- **Free models get zero pricing** — { promptPer1MTokens: 0, completionPer1MTokens: 0 }. Sorts naturally as cheapest
- **Quality tiers from static snapshot** — manually assigned (frontier/high/mid/small) based on known benchmark rankings. Updated each release. No live benchmark API
- **4 fixed capability flags** — reasoning, toolCall, structuredOutput, vision. No extensibility for v1. New capabilities via minor version bump
- **Active/deprecated status** — simple status field. Selection skips deprecated models
- **Context window kept** — contextWindow: number populated from models.dev
- **Include dates if available** — optional createdAt/updatedAt from API. Zero cost if data is there
- **Exact model ID match only** — no alias resolution. 'gpt-4' and 'gpt-4-0613' are separate entries
- **Unknown models: warn and pass through** — debug warning 'Model X not in catalog', but allow routing. Catalog is informational, not gating

### Model Catalog - Interface & Events

- **Expose via router.catalog** — ModelCatalog accessible as router property. Consistent with router.storage, router.policy, router.usage
- **Filter in listModels()** — extend to accept filter options: listModels({ provider?, capabilities?, qualityTier?, maxPrice? })
- **Keep getCapabilities()** — convenience shortcut alongside getModel()
- **Add close() to ModelCatalog** — cancels in-flight fetches, clears cache. Called by router.close()
- **Custom catalog via createRouter() options** — createRouter(config, { catalog?: ModelCatalog }). Default catalog used if not provided
- **catalog:refreshed event always emitted** — on every load (live, cache, or static snapshot). Includes { source: 'live' | 'cache' | 'static', modelsAdded, modelsRemoved, unchanged, timestamp }
- **No catalog config in Zod schema** — catalog is runtime-configured. Default behavior (24h TTL, models.dev + OpenRouter) hardcoded. Custom behavior via custom ModelCatalog

### Selection Strategy - Built-in Strategies

- **3 built-in strategies:** priority (default), round-robin, least-used
- **Priority (default):** first eligible key in config order wins. Auto-promotes recovered keys. Config order = user intent (free-first or paid-first)
- **Least-used:** compare by most-constraining-window remaining percentage. Key with highest worst-case remaining wins. Keys with no limits treated as 100% remaining
- **Round-robin:** stateful cycling. Track index per provider. Key 0 → Key 1 → Key 2 → Key 0. In-memory state, resets on restart
- **Single-key short-circuit** — if only 1 key for provider: check eligibility + cooldown, skip strategy logic, still emit event
- **Strategy.PRIORITY constant added** — Strategy = { PRIORITY: 'priority', ROUND_ROBIN: 'round-robin', LEAST_USED: 'least-used' }

### Selection Strategy - Configuration

- **Priority as default** — changed from Phase 1's round-robin. Users express intent through key ordering. Free-first for savings, paid-first for reliability
- **Per provider with global default** — top-level strategy field in config. Per-provider override: { providers: { google: { strategy: 'least-used' } } }
- **Per-request override supported** — router.model('google/gemini', { strategy: 'round-robin' })
- **Built-in strings only in config** — schema validates against known strategy names. Custom strategies via runtime options only
- **Tiebreaker: first in config order** — when remaining percentage is equal, prefer key listed first in config

### Selection Strategy - Interface & Plugin

- **New SelectionContext type** — replaces old interface. selectKey(context: SelectionContext) where context = { provider, model?, candidates: CandidateKey[], estimatedTokens? }
- **CandidateKey includes EvaluationResult** — { keyIndex, label?, eligible, cooldown, evaluation: EvaluationResult }. Custom strategies get full limit details
- **Async (keep Promise)** — built-in strategies resolve immediately. Custom strategies can await external calls
- **Both function and interface accepted** — plain function (context) => { keyIndex, reason } OR full SelectionStrategy object { name, selectKey }. Router wraps function internally
- **Human-readable reason string** for v1 — structured selection data available via key:selected event payload
- **Custom strategy error: fall back to default** — catch error, debug-log, fall back to provider's configured strategy. Request still served

### Selection Strategy - Pre-flight & Metrics

- **Pre-flight headroom check** — before selecting, evaluate estimated tokens against remaining quota. Skip keys where estimation exceeds remaining. If no key has enough, pick most remaining (advisory, not blocking)
- **In-memory selection metrics** for v1 — track selection counts per key. Exposed via API. Resets on restart. Persistent metrics deferred to Phase 10
- **key:selected event always emitted** — on every selection. Payload: { provider, model, keyIndex, label?, strategy, reason, timestamp, requestId }

### Key Priority & Labels

- **Config order = priority** — keys listed first are preferred. Implicit priority, no new config field
- **Optional key label** — { key: 'API_KEY', label: 'personal-free' } in object form. Falls back to 'key {index}' if no label. Shows in debug logs and events
- **Auto-promote recovered keys** — priority re-evaluated per request. If Key 0 recovers from cooldown, next request goes back to Key 0
- **Skip cooldown keys immediately** — in priority strategy, don't wait for cooldown. Try next key

### Cooldown & Exhaustion in Selection

- **Both PolicyEngine + CooldownManager checked separately** — cooldown = runtime state (429s), policy = usage-based prediction. Key must pass BOTH
- **Cooldown keys are unavailable** — both exhausted and cooldown keys skipped. Don't wait for cooldown to expire
- **Auto re-enable on cooldown expiry** — once timer expires, key immediately eligible. If still rate-limited, provider 429s again
- **Exponential backoff on consecutive 429s** — cooldown doubles per consecutive failure. Resets to base after successful request. Protects keys from escalated blocking
- **Respect Retry-After exactly** — no cap on cooldown duration. Trust provider timing
- **Configurable default cooldown** — { cooldown: { defaultDurationMs: 60000 } }. Used when no Retry-After header
- **Different errors for different states:**
  - RateLimitError — all keys in cooldown (temporary, includes cooldownUntil)
  - QuotaExhaustedError — all keys exhausted (includes next reset time)
- **No distinction between soft/hard exhaustion** — exhausted is exhausted. Policy is advisory
- **provider:exhausted event** — emitted before throwing error. Payload: { provider, totalKeys, exhaustedCount, cooldownCount, earliestRecovery }
- **Debug log per skipped key** — each skipped key logged with reason via debug namespace

### Router Integration

- **Selection in router.model()** — triggers immediately when user requests a model. Key locked per model instance
- **router.model() becomes async** — returns Promise. PolicyEngine.evaluate() requires async storage reads
- **Provider/model format required** — always 'google/gemini-2.0-flash', no bare model names
- **Warn but allow unknown models** — debug warning if model not in catalog, proceed with selection
- **Router fields: add selection + catalog** — router.selection (KeySelector instance), router.catalog (ModelCatalog instance)
- **KeySelector coordinator class** — orchestrates strategy resolution, evaluation, cooldown check, strategy execution, event emission
- **Init order in createRouter()** — storage → policy engine → usage tracker → catalog (fetch) → key selector
- **Expanded createRouter() options** — { storage?, tokenEstimator?, catalog?, strategy? }
- **Error feedback loop** — after non-429 errors: 401 auth errors disable key permanently until restart, 500 server errors trigger short cooldown. Selection adapts to runtime failures

### Config Schema Changes

- **Top-level strategy field** — { strategy: 'priority', providers: { ... } }. Default: 'priority'
- **Top-level cooldown section** — { cooldown: { defaultDurationMs: 60000 } }
- **Key label in object form** — { key: 'KEY', label: 'name', limits: [...] }
- **Update DEFAULT_CONFIG** — strategy changes from 'round-robin' to 'priority'. Add cooldown defaults
- **Not breaking** — pre-v1, no existing users affected

### Testing

- **Minimal smoke tests only** — per CLAUDE.md: tsc --noEmit + basic smoke tests. Full suites deferred to Phase 12

### Claude's Discretion

- Weighted strategy (third-party, not built-in — custom strategy covers this)
- Exact KeySelector class constructor and internal orchestration
- Exact SelectionContext and CandidateKey TypeScript interfaces
- Static snapshot file format and generation script details
- models.dev API endpoint URLs and response parsing
- OpenRouter API endpoint and authentication
- Exact Zod schema nesting for new config sections
- In-memory metrics API shape (router.getSelectionStats() or similar)
- Error feedback integration details (how Phase 7 error handler notifies KeySelector)

</decisions>

<specifics>
## Specific Ideas

- "In production, client would like to use free as much as possible but use paid when free is not enough" — drove priority-as-default decision
- "Relying on free is not production use case" — priority strategy lets users express paid-first intent too via config ordering
- Selection is per-provider. Cross-provider intelligence is Phase 9's domain
- "Exponential backoff could be safer — otherwise key cooldown will increase or get disabled by provider"
- LiteLLM reference patterns: deployment groups, cooldown mechanism, routing strategies (shuffle, usage-based, least-busy)

</specifics>

<code_context>

## Existing Code Insights

### Reusable Assets

- `ModelCatalog` interface (src/types/interfaces.ts): getModel, listModels, getCapabilities, refresh — needs close() added, listModels() filter extension
- `SelectionStrategy` interface (src/types/interfaces.ts): needs complete replacement with SelectionContext-based signature
- `ModelMetadata` type (src/types/domain.ts): needs pricing format update (per1k → per1M), optional dates, status field
- `Strategy` constants (src/constants/index.ts): needs PRIORITY added, default changed
- `QualityTier` constants (src/constants/index.ts): frontier, high, mid, small — ready to use
- `PolicyEngine.evaluate()` (src/policy/PolicyEngine.ts): async eligibility check with estimatedTokens support — called by KeySelector per key
- `CooldownManager` (src/usage/cooldown.ts): manages 429-based cooldowns — needs exponential backoff added
- `UsageTracker` (src/usage/UsageTracker.ts): getUsage() provides per-key usage data for strategy decisions
- `configSchema` (src/config/schema.ts): needs strategy, cooldown sections added
- `src/catalog/index.ts`: currently just re-exports type — will house DefaultModelCatalog class
- `src/selection/index.ts`: currently just re-exports type — will house KeySelector, built-in strategies

### Established Patterns

- Const objects with `as const` for enums (src/constants/index.ts)
- Zod validation with `.default()` for config defaults (src/config/schema.ts)
- Runtime instance injection via createRouter() options (StorageBackend pattern)
- `debug` package with component namespaces (llm-router:catalog, llm-router:selection)
- EventEmitter with typed, namespaced events
- Eager validation at createRouter()
- Fire-and-forget for events and recording

### Integration Points

- `createRouter()` in src/config/index.ts — add catalog init, KeySelector init, expanded options
- `Router` interface in src/config/index.ts — add catalog, selection fields, make model() async
- `configSchema` in src/config/schema.ts — add strategy, cooldown, key label fields
- `DEFAULT_CONFIG` in src/config/defaults.ts — update strategy default to 'priority'
- `RouterEvent` in src/constants/index.ts — add PROVIDER_EXHAUSTED, CATALOG_REFRESHED
- `src/types/events.ts` — add KeySelectedEvent, ProviderExhaustedEvent, CatalogRefreshedEvent types
- `src/errors/` — add RateLimitError (all cooldown), QuotaExhaustedError (all exhausted)
- Package.json subpath exports — ensure llm-router/catalog and llm-router/selection export correctly

</code_context>

<deferred>
## Deferred Ideas

- Cross-provider capability-aware routing ("give me any reasoning model") — Phase 9
- Weighted strategy as built-in — custom strategy plugin covers this. Evaluate for v2
- Persistent selection metrics (write to StorageBackend) — Phase 10 observability
- Benchmark API integration for dynamic quality tiers — future enhancement
- Catalog disk persistence — not needed for v1, memory-only sufficient
- @tokenlens/models as alternative data source — direct API preferred
- Model alias resolution — users use exact model IDs

</deferred>

---

_Phase: 05-model-catalog-selection_
_Context gathered: 2026-03-13_
