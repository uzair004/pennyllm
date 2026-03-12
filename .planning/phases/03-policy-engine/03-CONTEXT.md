# Phase 3: Policy Engine - Context

**Gathered:** 2026-03-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Declarative policy definitions load from config + shipped defaults. A PolicyEngine class resolves policies (merge shipped defaults with user overrides), evaluates key eligibility based on usage vs limits, and fires events at configurable thresholds. Actual provider limit research (all 12 providers with validated data) is Phase 8. Usage tracking logic (incrementing counters after API calls) is Phase 4. Fallback behavior (what happens when all keys exhausted) is Phase 9.

</domain>

<decisions>
## Implementation Decisions

### Engine Role & Separation of Concerns

- Policy engine answers ONE question: "Is this key available or exhausted?" — binary eligible/not-eligible
- Engine does NOT decide what to do about exhaustion — that's selection (Phase 5) and fallback (Phase 9)
- Our policies are a **routing prediction layer**, not billing protection. Provider limits (429 errors) are the real guardrail
- The `enforcement` field on policies describes HOW THE PROVIDER behaves (hard-block, throttle, silent-charge) — not how we behave
- For silent-charge providers, documentation should recommend users set spend caps in provider dashboards

### Policy Merging & Resolution

- **Config = activation, shipped = passive data.** Only providers with keys in user config are active. Shipped defaults are reference data applied automatically when a matching provider is configured
- `enabled: false` in provider config temporarily disables without removing config
- **Partial override by limit type + window type.** User specifies only what changes. E.g., override monthly tokens without losing the shipped rate limit. Limits matched by `type + window.type` combination
- **Three-layer merge priority (most specific wins):** per-key limits > provider-level user limits > shipped defaults
- Per-model limits: default is key-level (covers 80% of providers). Optional model-specific limits for providers like OpenRouter/HuggingFace where limits differ per model
- Both provider-level AND model-level limits apply (AND logic) — key must satisfy all applicable limits
- Custom providers without configured limits: allow (always "available") with debug warning — covers self-hosted/internal LLMs
- Resolved/merged policies visible via `router.getConfig()` so users can inspect what's actually applied
- Shipped default policies exported for import/inspection: `import { googlePolicy } from 'llm-router/policies'`
- Duplicate key detection: error at startup (ConfigError) — fail-fast matches Phase 1 pattern
- Validate contradictory limits at startup (e.g., daily > monthly throws ConfigError)

### Per-Key Limits (Mixed Array Config)

- Keys can be strings (use provider/shipped defaults) or objects (custom per-key limits): `keys: ['FREE_KEY', { key: 'PAID_KEY', limits: [...] }]`
- Enables mixing free + paid keys for the same provider — core use case for cost avoidance
- Key priority/ordering is Phase 5's concern, not the policy engine's
- `limits: []` (empty array) vs omitting `limits` — Claude's discretion on semantics

### Token Tracking Granularity

- Limits can target `prompt_tokens`, `completion_tokens`, or `total_tokens` separately
- Matches reality — some providers charge differently for input vs output
- UsageRecord already tracks prompt and completion separately (Phase 2)

### Evaluation Result

- Rich result object: `{ eligible: boolean, limits: [{ type, current, max, remaining, percentUsed, resetAt }], closestLimit, enforcement }`
- Async evaluation — calls `storage.getUsage()` which is Promise-based (consistent across MemoryStorage and future Redis/SQLite)
- Includes enforcement type metadata so downstream consumers (selection, error handling) know how the provider would react
- Includes `resetAt: Date` per limit — selection can prefer keys that reset sooner, error messages can say "try again in 45s"
- Optional `estimatedTokens` parameter for pre-call checks — avoids selecting a key that will immediately hit a 429
- Dry evaluation supported — evaluate() is read-only (reads from storage, doesn't write)

### Events

- Engine fires events directly: `limit:warning` at threshold, `limit:exceeded` at 100%
- Warning threshold: 80% by default, configurable via config (`warningThreshold`)
- Event deduplication — Claude's discretion (fire once per crossing vs every eval)

### Default Policy Bundling

- TypeScript const objects per provider in `src/policy/defaults/` (e.g., `google.ts`, `groq.ts`)
- Type-checked at compile time, tree-shakeable, importable by users
- Phase 3 ships 2-3 placeholder providers (Google, Groq, OpenRouter) with approximate values for proof-of-concept
- Phase 8 fills all 12 providers with researched, validated data

### Staleness Detection (POLICY-06)

- Check at createRouter() startup — if any shipped policy's `researchedDate` is >30 days old, emit debug warning + fire `policy:stale` event
- Actionable message: includes suggestion to `npm update llm-router` or verify at provider URL
- Only applies to shipped defaults — user-configured limits have no staleness concept

### Policy Versioning (POLICY-07)

- Timestamp-based: `version: '2026-03-15'` reflecting date of last research/update
- `researchedDate` in metadata used for staleness calculation
- No semver on policies — date is more meaningful for "is this data current?"

### Policy Lifecycle

- Eagerly resolved at createRouter() — all policies merged/validated during initialization
- Immutable after initialization — to change policies, create a new router
- PolicyEngine is a class holding resolved policies, storage reference, and event emitter
- Created internally by createRouter(), but also exported from `llm-router/policy` for advanced users

### Claude's Discretion

- Merge strategy details (deep merge implementation, additive vs replacement for unmatched limits)
- `limits: []` vs omitting `limits` semantics
- Event deduplication strategy (fire once per threshold crossing vs debounce)
- Evaluate-all-limits vs short-circuit-on-first-exceeded
- Enforcement metadata handling on user overrides (carry over from shipped or not)
- Override-exceeds-shipped warning behavior
- Internal PolicyEngine constructor signature and initialization flow

</decisions>

<specifics>
## Specific Ideas

- "Should we rely on provider's cost protection or add our own?" — Resolved: our policies are a routing prediction layer, provider limits are the real guardrail. For silent-charge providers, recommend dashboard spend caps.
- "Users will want to use paid keys but add free tier keys as add-ons to reduce cost" — Drove the per-key limits decision (mixed array config)
- "It could bill the user seriously if not solid" — Drove the clear separation: policy engine marks exhausted, fallback (Phase 9) controls what happens next
- CLI helper (`npx llm-router show-policy google`) for discovering shipped defaults — noted for Phase 11

</specifics>

<code_context>

## Existing Code Insights

### Reusable Assets

- `Policy`, `PolicyLimit`, `ResetWindow` types (src/types/domain.ts): already define limits, enforcement, metadata structure
- `EnforcementBehavior` constants (src/constants/index.ts): hard-block, throttle, silent-charge
- `LimitType` constants (src/constants/index.ts): tokens, calls, rate, daily, monthly
- `Provider` constants (src/constants/index.ts): all 12 provider IDs
- `StorageBackend` interface (src/types/interfaces.ts): get, put, increment, getUsage, reset, close
- `MemoryStorage` (src/storage/MemoryStorage.ts): working implementation for engine to query usage data
- Event types (src/types/events.ts): LimitWarningEvent, LimitExceededEvent already defined
- `LLMRouterError`, `ConfigError` (src/errors/): for validation errors
- `configSchema` with `policyLimitSchema` (src/config/schema.ts): Zod validation for limit objects already exists
- `providerConfigSchema` (src/config/schema.ts): has limits array and enabled boolean

### Established Patterns

- Const objects with `as const` for enums (src/constants/index.ts)
- Zod validation with `.default()` for sensible defaults (src/config/schema.ts)
- Subpath exports for modular imports (package.json)
- `debug` package with component namespaces (llm-router:policy namespace)
- Eager validation at createRouter() — fail-fast on invalid config
- EventEmitter pattern with typed, namespaced events

### Integration Points

- `createRouter()` in src/config/index.ts — needs to instantiate PolicyEngine with resolved policies + storage
- `src/policy/index.ts` — currently re-exports types, will house PolicyEngine class
- `providerConfigSchema` — needs update for mixed array keys (string | object) and per-model limits
- `router.getConfig()` — needs to include resolved policies in output
- Package.json subpath exports — add `llm-router/policy` for PolicyEngine export

</code_context>

<deferred>
## Deferred Ideas

- CLI helper for discovering shipped defaults (`npx llm-router show-policy google`) — Phase 11 (DX Polish)
- Key priority/ordering (free-first vs custom ordering) — Phase 5 (Selection)
- Fallback behavior when all keys exhausted — Phase 9 (Fallback & Budget)
- Full 12-provider researched default policies — Phase 8 (Provider Policies Catalog)
- Runtime policy updates (`router.updatePolicy()`) — deferred, create new router instead
- Hot-reloadable config — deferred from Phase 1

</deferred>

---

_Phase: 03-policy-engine_
_Context gathered: 2026-03-12_
