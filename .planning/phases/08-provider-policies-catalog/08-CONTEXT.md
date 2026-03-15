# Phase 8: Provider Policies Catalog - Context

**Gathered:** 2026-03-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 8 delivers key acquisition documentation for 12 providers, removes auto-apply of shipped default policies (behind config toggle), removes existing static TypeScript policy files, adds generic limit builder helpers, adds typed provider configs with JSDoc, and provides DX improvements for user-configured limits. Registry fetch infrastructure and credit-based limit handling are deferred to dedicated phases.

**Key pivot from original plan:** Static limit data goes stale fast and no provider has a "what are my limits?" API. Instead of shipping researched defaults as routing truth, Phase 8 makes user-configured limits the primary mechanism, with the retry proxy as the safety net. Shipped defaults become reference-only documentation, not active routing data.

</domain>

<decisions>
## Implementation Decisions

### Default Policies: Reference Only, Not Active Routing

- Registry/shipped defaults are NOT used for routing unless user explicitly opts in
- Config toggle: `applyRegistryDefaults: boolean` (default: false)
- When false (default): if user doesn't configure limits, no limits are applied — key is always "available"
- Retry proxy (Phase 7) handles actual 429 errors at runtime
- If user configures limits, PolicyEngine evaluates as normal (Phase 3 behavior unchanged)
- Rationale: static data goes stale, provider limits change without notice, wrong defaults cause wrong routing decisions

### Remove Existing Static Policy Files

- Delete `src/policy/defaults/google.ts`, `groq.ts`, `openrouter.ts`
- Delete `src/policy/defaults/index.ts` (the shippedDefaults Map)
- Pre-v1 so no backward compatibility needed
- These had `confidence: 'low'` placeholder data anyway

### Empty Provider Skeleton Bundle

- Bundle a JSON with all 12 provider names and structure but no actual limit values
- Provides the "shape" for reference without stale numbers
- Same pattern as static-catalog.json but for policies

### Config Toggle for Registry Defaults

- `applyRegistryDefaults: boolean` in config (default: false)
- When false: no shipped/registry defaults auto-apply in the three-layer merge
- When true: defaults from registry/skeleton apply (Phase 3 three-layer merge behavior)
- Fully configurable: registryUrl (custom URL or false to disable), registryCacheTtl (cache duration)
- Registry fetch itself is deferred — the toggle and config shape are defined now

### No Limits = Key Always Available

- If user configures `{ providers: { google: { keys: ['KEY'] } } }` with no limits
- PolicyEngine treats the key as always eligible (no limits to check against)
- Debug-level warning logged: "google: no limits configured — key will be used until provider rejects"
- Retry proxy handles actual 429 errors — this is the safety net

### Key Acquisition Documentation

- Location: `docs/providers/` directory with one markdown file per provider
- Format: quick reference cards (compact: sign-up URL, API key page URL, free tier summary, gotchas/tips)
- Each doc includes:
  - Sign-up URL and API key page URL
  - Free tier summary (limits, access requirements)
  - Per-provider config snippet showing how to use with pennyllm
  - Gotchas & Tips section (practical knowledge)
  - Env variable name matching Vercel AI SDK conventions (e.g., GOOGLE_GENERATIVE_AI_API_KEY)
  - Which @ai-sdk/\* package to use (e.g., @ai-sdk/google, @ai-sdk/openai-compatible)
  - Brief paid tier mention for comparison
  - Interface language note (especially for Chinese providers)
  - Config template with placeholder values (not hard-coded values)
- Recommended starter set: 2-3 providers easiest to set up (no credit card, generous limits)
- Aggregate capacity estimate: approximate total monthly free tokens across all 12 providers
- Comparison table: auto-generated from research data showing all providers side by side
- Self-contained: no links to external AI SDK docs (they go stale)
- Provider status: covered implicitly by lastVerified dates, no explicit status field

### OpenRouter Special Handling

- OpenRouter doc gets a "How OpenRouter Works" explainer section (meta-provider concept)
- Single aggregate policy for OpenRouter (one key, one set of limits)
- Highlight top 3-5 recommended free models with capability notes
- OpenRouter credit system: flagged for researcher to investigate conversion approach

### Tier Categories

- Distinguish between 'recurring free tier' (Google, Groq — resets monthly) and 'trial credits' (DeepSeek, Mistral — one-time credits)
- Different treatment in routing since credits don't reset
- Exact credit handling deferred to dedicated phase (see Deferred section)

### Generic Limit Builder Helpers

- Export helper functions: `createTokenLimit(value, windowType)`, `createRateLimit(value, windowType)`, `createCallLimit(value, windowType)`
- Generic builders only — no provider-specific templates (they'd go stale)
- Returns well-typed PolicyLimit objects
- Reduces boilerplate and prevents config errors

### Typed Provider Configs

- Export specific TypeScript types per provider: `GoogleProviderConfig`, `GroqProviderConfig`, etc.
- JSDoc comments with links to provider's limits/pricing page
- Users get autocomplete and inline documentation when configuring
- Follows existing ProviderConfig structure but with provider-specific JSDoc

### Validation & Error Messages

- Schema validation at startup (existing Zod validation from Phase 3 — no new work)
- Trust user config values — no sanity bounds checking on unrealistic values
- Error messages for missing limits include link to our docs: "see docs/providers/google.md for recommended limits"
- No registry-based suggestions in errors (registry is deferred)

### Claude's Discretion

- Exact builder helper API signatures and return types
- Empty skeleton JSON structure
- How to handle the shippedDefaults Map removal across the codebase
- Comparison table generation approach (from what data source)
- Exact provider type JSDoc content
- Debug warning message format for no-configured-limits providers

</decisions>

<specifics>
## Specific Ideas

- "This is one of the most important phases — research deep, accurately with proof and solid evidence"
- "This manual stuff will quickly go stale or outdated, think of production deployed apps" — drove the pivot from static defaults to reference-only
- "User provided is fine in that case. I can think of better user experience when UI is involved" — user envisions v2 Admin UI (already in backlog) as the real UX solution for guided provider setup
- "Should be easy to disable this especially in initial versions as it leads to a lot of burden" — drove the decision to defer registry fetch and make defaults non-blocking
- "No assumptions, no guessing" — all limit data must come from user or verified sources, never from stale shipped defaults

</specifics>

<code_context>

## Existing Code Insights

### Reusable Assets

- `Policy` interface (`src/types/domain.ts`): id, provider, version, limits[], enforcement, resetWindows[], metadata — needs metadata.confidence removed (moving to per-limit)
- `PolicyLimit` type (`src/types/domain.ts`): type, value, window — will be extended with provenance fields in registry phase
- `PolicyEngine` (`src/policy/PolicyEngine.ts`): evaluate(), resolvePolicy() — needs update to skip auto-apply when toggle is off
- `Provider` constants (`src/constants/index.ts`): all 12 provider IDs already defined
- `configSchema` (`src/config/schema.ts`): Zod validation — needs `applyRegistryDefaults` toggle added
- `DefaultModelCatalog` (`src/catalog/DefaultModelCatalog.ts`): fetch + cache + static fallback pattern — reference for future registry fetch implementation
- Retry proxy (`src/integration/retry-proxy.ts`): handles 429s at runtime — safety net for no-limits scenario

### Established Patterns

- TypeScript const objects with `satisfies` type assertion for type-checked policy data
- Zod schema with `.default()` for sensible config defaults
- Subpath exports for modular imports (package.json)
- `debug` package with component namespaces
- Eager validation at createRouter() — fail-fast on invalid config
- Per-request key injection via `create*({ apiKey })` — no persistent connection

### Integration Points

- `src/policy/defaults/` — files to be deleted, `shippedDefaults` Map removed
- `src/policy/PolicyEngine.ts` — resolver needs update for `applyRegistryDefaults` toggle
- `src/config/schema.ts` — add `applyRegistryDefaults` to config schema
- `src/config/index.ts` — createRouter() needs to respect the toggle
- `package.json` subpath exports — may need update for new builder helpers export path
- `docs/providers/` — new directory for key acquisition documentation

</code_context>

<deferred>
## Deferred Ideas

### Remote Registry Infrastructure (Dedicated Phase)

**What:** Fetch provider policy defaults from a remote GitHub-hosted JSON file at startup.

**Decisions already made:**

- Host: GitHub raw JSON in a separate repository (decoupled from npm releases)
- Fetch pattern: Same as DefaultModelCatalog — fetch at createRouter() startup, cache in memory, fall back to bundled snapshot
- Config: Fully configurable — registryUrl (custom URL or false to disable), registryCacheTtl (cache duration)
- Schema: Mirror Policy type exactly (no richer fields — gotchas/metadata are docs-only)
- Schema versioning: Top-level `schemaVersion` field for future evolution
- Timestamps: Per-provider `lastUpdated` (not top-level)
- Non-blocking: Registry fetch failure is never a blocker — package works perfectly without it
- Reference only by default: Registry data available via `router.getRegistryDefaults()` API, not auto-applied

**Open questions:**

- Exact registry JSON schema structure
- Cache invalidation strategy
- Community contribution workflow for the separate repo
- CI validation for registry JSON in the separate repo

### Credit-Based Limit Handling (Dedicated Phase)

**What:** Support providers that use dollar credits instead of token/call limits (e.g., DeepSeek, Mistral).

**Decisions already made:**

- Add 'credits' to LimitType constants
- Credits may have time windows (expiry: "usable within 30 days") but don't reset like recurring limits
- Distinguish 'recurring free tier' from 'trial credits' — different routing treatment
- Builder helpers should eventually include `createCreditLimit()`
- Evaluation logic: Claude designs based on research into how credit-based providers report usage

**Open questions (need research):**

- How many of the 12 providers are actually credit-based vs token-based?
- Do credit-based providers report cost in API responses or just tokens?
- How to model credit expiry windows? New 'expiry' window type? Existing window + `reset: false` flag?
- Should credit usage be tracked in dollars or tokens internally?
- Reconciliation approach: same as tokens or different?
- Safety factors for low-confidence credit limits (same as token limits?)

**Research context (from Phase 3):**

- Per-model limits already supported via `modelLimits?: Map<string, PolicyLimit[]>` in ResolvedPolicy
- Three-layer merge (per-key > provider config > shipped defaults) already handles overrides
- PolicyEngine evaluation is async (calls storage.getUsage())

### Per-Limit Provenance Metadata (Registry Phase)

**What:** Full provenance tracking per limit when registry is implemented.

**Decisions already made:**

- Per-limit fields: sourceUrl, verified (boolean), sourceType ('official-docs' | 'api-headers' | 'community' | 'inferred'), notes (optional), lastVerified (ISO date), confidence ('high' | 'medium' | 'low')
- Verification criteria: 2+ independent sources agree = verified = high confidence
- Confidence levels: high = verified (2+ sources), medium = single official source, low = unverified (community/inferred/outdated)
- Per-limit enforcement behavior: each limit records what happens when exceeded (429 response, error patterns, retry-after header presence)
- Remove metadata.confidence from Policy type (replaced by per-limit confidence)
- Confidence-adjusted limits: high=100%, medium=90%, low=70% safety factor
- Safety factor visible to users: evaluation results show both raw and effective limits
- Debug warning at startup for any low-confidence limits

**Open questions:**

- Exact extension to PolicyLimit type for provenance fields
- How safety factors interact with user-configured limits (user limits = always 100%?)
- Per-limit enforcement typing

### Provider Volatility Rating (Registry Phase)

**Decisions already made:**

- Tag each provider with volatility: 'stable' | 'volatile' | 'unknown'
- Volatile providers get shorter staleness thresholds (e.g., 14 days vs 30 days)
- Access requirements field: 'no-card' | 'card-required' | 'card-with-free-credits' | 'waitlist'
- Geographic restrictions: optional geoRestrictions field on policy metadata
- Free models: reference-only freeModels field (current IDs + family names) — not used for routing
- Interface language: noted in docs for non-English providers

### Research Pipeline (Registry Phase)

**Decisions already made:**

- Research JSON → codegen → TypeScript policies + docs + comparison table (single pipeline)
- Research script fetches rate limit headers for providers with available keys
- Validation script checks shipped policies against reference data
- Version bump log: when limits change, bump policy version date + code comment
- Structured reference file (.planning/research/provider-limits.json) persists for future updates
- Sync check between reference file and shipped code

**Open questions:**

- Whether to use AI/LLM-assisted scraping for ongoing updates
- CI integration for drift detection

### Phase 11 Items (DX Polish)

- CLI validator command (`npx pennyllm validate-config`)
- Config wizard for guided setup

</deferred>

---

_Phase: 08-provider-policies-catalog_
_Context gathered: 2026-03-14_
