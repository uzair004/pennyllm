# Phase 9: Fallback & Budget Management - Context

**Gathered:** 2026-03-14
**Status:** Ready for planning

<domain>
## Phase Boundary

When all keys for a requested provider are exhausted (quota or cooldown), route to alternative configured providers that match the request's capabilities. Enforce a monthly budget cap to prevent unexpected charges. Emit events for fallback triggers and budget alerts.

Requirements: CORE-04 (hard-stop enforcement), CORE-05 (fallback config), CORE-06 (budget cap), DX-05 (budget alerts), CAT-06 (capability-aware fallback), CAT-07 (cheapest matching fallback).

</domain>

<decisions>
## Implementation Decisions

### Fallback Chain Configuration

- Default behavior: try alternatives (NOT hard-stop). Hard-stop is opt-in. Rationale: avoid crashing production applications.
- Scope: only configured providers with keys. No discovery of unconfigured providers from catalog.
- Max fallback depth: configurable, default 3 providers.
- Same-provider keys preferred first (same model = consistent UX), then cross-provider.
- Auto-select fallback (router picks based on capability match + remaining quota). No explicit chain ordering in v1.
- Round-robin and weighted-random fallback strategies deferred to v2. Phase 9 ships simple auto-select only.
- Config validation error at startup if `cheapest-paid` behavior is configured with $0 budget.
- Server errors (500) on primary provider also trigger cross-provider fallback (try another provider rather than failing).

### Cross-Provider Model Matching

- Tiered matching: first try capability match + same quality tier, then relax to capability-only (any quality tier).
- Capabilities inferred from request params: `tools` present -> needs `toolCall`, image content -> needs `vision`. Reasoning must be explicitly requested (config or per-request option).
- Ranking: free providers first, then cheapest paid. Within free, prefer most remaining quota.
- Context window pre-check: skip fallback models that can't fit estimated prompt size. Catalog already has `contextWindow` field.
- Short-term affinity (~60s): cache last successful fallback to avoid repeated evaluation during burst traffic.
- Optional user-configured model equivalency mappings (e.g., GPT-4 -> Claude). Otherwise capability+tier matching.
- Configured providers only for paid fallback (consistent with fallback scope decision).

### Budget Enforcement

- Cost calculation: `(promptTokens x promptPrice + completionTokens x completionPrice) / 1,000,000` using actual token counts from provider response.
- Missing pricing guard: if model has no pricing in catalog, request goes through, cost NOT tracked, warning event fires. Free models already have `pricing: { prompt: 0, completion: 0 }`.
- Period: calendar month, resets on 1st at 00:00 UTC.
- Enforcement: post-check only (make the call, record actual cost, then check). No pre-estimation.
- Storage: existing StorageBackend (budget-specific key pattern). With MemoryStorage resets on restart; Phase 10 SQLite/Redis delivers persistence.
- In-flight requests: let finish when budget cap reached. Only new paid requests rejected.
- Free calls NOT tracked in budget (only paid calls recorded for budget purposes).

### Budget Events

- Separate events: `budget:alert` at configurable thresholds (default 80%, 95%) and `budget:exceeded` when cap hit.
- Alert payload includes rate info: `{ threshold, spent, limit, remaining, avgCostPerRequest }`.
- `fallback:triggered` event emitted on every cross-provider fallback (type already exists, never wired).

### Exhaustion Triggers

- Both quota exhaustion AND cooldown trigger cross-provider fallback, always. No configurable per-limit-type triggers in v1.
- Immediately try fallback (no wait period for cooldown expiry).
- `provider:exhausted` event enhanced with `exhaustionType: 'cooldown' | 'quota' | 'mixed'`.
- Auto-recover on next request when provider comes back online (no manual intervention, no recovery event).

### Explicit Model Requests

- Configurable `strictModel` option (default: false = fall back to equivalent model).
- When `strictModel: true` and provider exhausted, throw error with suggestion rather than silently switching.

### Fallback Transparency

- Response metadata includes fallback info: `fallbackUsed`, `originalModel`, `actualModel`. Must NOT break AI SDK response structure — augment, don't change.
- `fallback:triggered` event fires with `fromProvider`, `toProvider`, `reason`.

### Retry Proxy Integration

- Fallback wraps retry: cross-provider fallback sits above the retry proxy layer. On QuotaExhaustedError/RateLimitError from retry proxy (all keys within provider exhausted), fallback catches and tries next provider. Each fallback provider gets its own retry proxy for its keys.

### Final Error (All Providers Exhausted)

- Rich error with recovery info: which providers tried, why each failed, earliest recovery time across all providers, suggestion to add more providers or increase budget.

### Claude's Discretion

- Config shape for fallback section (top-level + per-provider override structure)
- Exact affinity cache implementation (TTL, data structure)
- Budget storage key pattern design
- Retry proxy <-> fallback integration architecture details
- Error class design for AllProvidersExhaustedError
- How reasoning capability is explicitly requested (config flag vs per-request option)

</decisions>

<code_context>

## Existing Code Insights

### Reusable Assets

- `QuotaExhaustedError` (src/errors/quota-exhausted-error.ts): Already thrown when all keys exhausted. Fallback layer catches this to trigger cross-provider routing.
- `RateLimitError` (src/errors/rate-limit-error.ts): Thrown on cooldown. Fallback layer catches this too (both trigger fallback).
- `FallbackTriggeredEvent` (src/types/events.ts): Type already defined with `fromProvider`, `toProvider`, `reason`. Never emitted yet — Phase 9 wires it.
- `ProviderExhaustedEvent` (src/types/events.ts): Already emitted by KeySelector. Needs `exhaustionType` field added.
- `DefaultModelCatalog.listModels()` (src/catalog/DefaultModelCatalog.ts): Already filters by `capabilities`, `qualityTier`, `maxPrice`. Ready for fallback model queries.
- `ModelMetadata` (src/types/domain.ts): Has `capabilities`, `qualityTier`, `contextWindow`, `pricing` — all fields needed for matching.
- `BudgetConfig` (src/types/config.ts): Already has `monthlyLimit` and `alertThresholds` fields. Budget schema exists with defaults.
- `RouterEvent` constants (src/constants/index.ts): Has `FALLBACK_TRIGGERED`, needs new budget events.
- `KeySelector` (src/selection/KeySelector.ts): Orchestrates key selection per provider. Fallback layer sits above this.
- `createRetryProxy` (src/wrapper/retry-proxy.ts): Handles key rotation within provider. Fallback catches its errors for cross-provider routing.

### Established Patterns

- EventEmitter for all router events (node:events). Budget events follow same pattern.
- Fire-and-forget for non-critical operations (usage recording, event emission). Budget tracking should follow same pattern.
- `debug` logger namespaced per module (e.g., `pennyllm:fallback`, `pennyllm:budget`).
- Zod schemas for config validation. Fallback config needs new Zod schema.
- `exactOptionalPropertyTypes` enabled — conditional object field construction required.
- StorageBackend for all persistent data. Budget spend tracked via same interface.

### Integration Points

- `createRouter()` — Fallback logic wires in here, wrapping the existing wrapModel() flow.
- `retry-proxy.ts` — Fallback catches QuotaExhaustedError/RateLimitError thrown by retry proxy.
- `config/schema.ts` — New fallback config section added to configSchema.
- `constants/index.ts` — New RouterEvent entries for budget events.
- `types/events.ts` — New event interfaces for budget alerts/exceeded.

</code_context>

<specifics>
## Specific Ideas

- User emphasized "keep production apps running" — default must try alternatives, not hard-stop
- Same-provider keys preferred during fallback because "same LLM will be called and it would lead to similar user experience, another model could handle or respond the query differently"
- Fallback transparency must NOT break AI SDK response structure — users expect standard response shape
- Design budget storage for persistence even though MemoryStorage won't persist. Phase 10 adds real persistence.

</specifics>

<deferred>
## Deferred Ideas

- Round-robin fallback across providers — v2 fallback strategy
- Weighted random fallback based on remaining quota — v2 fallback strategy
- Health score per provider to influence fallback ordering — v2 optimization
- Provider recovery event (`provider:recovered`) — v2 observability
- Dry-run fallback preview (`router.previewFallback()`) — Phase 10 (DX-04 dry-run mode)
- Configurable per-limit-type fallback triggers (e.g., suppress cooldown-triggered fallback) — v2

</deferred>

---

_Phase: 09-fallback-budget-management_
_Context gathered: 2026-03-14_
