# Phase 16: Provider Data Registry - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Separate published community resource (`awesome-free-llm-apis` GitHub repo) documenting free tier limits, models, signup URLs, and SDK info for LLM API providers. NOT part of PennyLLM code — a standalone reference that PennyLLM docs link to. Machine-readable JSON with auto-generated awesome-list README.

Requirements: extends CORE-05, CAT-06, CAT-07 (Fallback). Success criteria 1-4 from roadmap.

</domain>

<decisions>
## Implementation Decisions

### Publication Format

- **Standalone GitHub repo** named `awesome-free-llm-apis`, same GitHub account as PennyLLM
- **CC0 / Public Domain** license — no restrictions on reuse
- **JSON is source of truth** — contributors edit `providers/*.json` files only
- **README auto-generated from JSON** via zero-dependency Node script (`node scripts/generate.js`). README includes comparison table at top + per-provider sections
- **Combined `registry.json`** auto-generated alongside README — all providers in one file for easy programmatic consumption
- **Date-based snapshot tags** (e.g., `2026-03`, `2026-04`) — no semver, natural cadence for data updates
- **GitHub raw URL** for fetching `registry.json` — no CDN, no npm package
- **No GitHub Actions / CI** — fully manual. Contributors run scripts locally before submitting PRs
- **Zero dependencies** — validate.js and generate.js use only Node.js built-ins
- **PennyLLM docs link only** — no data duplication. PennyLLM README links to the registry repo
- **Dev-reference only** — this resource is for developers during setup, not consumed by PennyLLM at runtime

### Data Structure: Provider Schema

- **Per-provider JSON files** in `providers/` directory (e.g., `cerebras.json`, `google.json`)
- **JSON Schema** (`schema.json`) validates all provider files — contributors validate locally with `node scripts/validate.js`
- **registry.json includes metadata**: `$schema`, `version` (date-based), `generatedAt`, `providerCount`, `providers` object

**Core fields per provider:**

- `id` — slug identifier (e.g., `cerebras`)
- `name` — display name (e.g., `Cerebras`)
- `status` — `'active'` | `'degraded'` | `'discontinued'`
- `signupUrl` — where to create an account
- `docsUrl` — API documentation URL

**Auth section:**

- `auth.envVar` — environment variable name (e.g., `CEREBRAS_API_KEY`)
- `auth.keyPrefix` — key format pattern (e.g., `csk-`) for validation tooling
- `auth.header` — auth header format (e.g., `Authorization: Bearer`)

**Free tier section:**

- `freeTier.type` — `'perpetual'` | `'trial'` | `'rate-limited'`
- `freeTier.limits` — flat key-value object: `{ rpm, rpd, tpd }` (missing keys = not applicable)
- `freeTier.notes` — free-text clarification (e.g., "Per-key limits")
- Trial-specific: `freeTier.credits` (string, e.g., "$5"), `freeTier.expiresAfterDays` (number)

**SDK section:**

- `sdk.package` — npm package name (e.g., `@ai-sdk/cerebras`)
- `sdk.type` — `'official'` | `'openai-compat'` | `'community'`
- `sdk.baseUrl` — only for openai-compat providers (e.g., `https://api.sambanova.ai/v1`)

**Rate limit headers:**

- `rateLimitHeaders.remaining` — header name for remaining requests
- `rateLimitHeaders.reset` — header name for reset time
- `rateLimitHeaders.limit` — header name for rate limit cap
- `rateLimitHeaders.format` — `'seconds'` | `'epoch'` | `'iso'`

**Models array:** per model entry:

- `id` — API model ID
- `free` — boolean flag (free tier or paid)
- `capabilities` — array of strings: `['reasoning', 'vision', 'tools', 'structuredOutput']`
- `tier` — `'frontier'` | `'high'` | `'mid'` | `'small'`
- `contextWindow` — max input tokens (number)
- `maxOutputTokens` — max output tokens (number)
- `limits` — optional per-model limit overrides (same shape as `freeTier.limits`). Falls back to provider-level limits when not specified

**Notes array:** free-text strings capturing provider quirks (geo-restrictions, data training opt-in, shared token pools)

**Freshness tracking:**

- `lastVerified` — ISO date string
- `verifiedBy` — `'manual'` | `'automated'`

### Provider Scope

- **Initial release: 7 PennyLLM target providers** — Cerebras, Google AI Studio, Groq, GitHub Models, SambaNova, NVIDIA NIM, Mistral
- **All 7 verified** via real API calls (PennyLLM E2E tests). Community additions can have `verifiedBy: 'manual'` from docs only
- **Structured for growth** — schema, template, and CONTRIBUTING.md designed to make adding providers trivial
- **Dropped providers NOT included** initially — can be added later by community contributors
- **Text LLMs only** — no image, audio, or embedding providers
- **GitHub Issues for provider requests** — community votes with reactions. Two issue templates: 'Add Provider' and 'Update Provider'

### Community Contribution Model

- **PR-based flow** — contributors edit/add `providers/*.json`, run validate + generate scripts, submit PR
- **`_template.json`** — template file with all fields, placeholder values, and comments. Copy, fill, validate, PR
- **Manual review only** — maintainer checks JSON validity and data accuracy. No automated CI gates
- **JSON schema validation** (`node scripts/validate.js`) — validates structure, required fields, types, enum values. Offline, zero-cost. No API calls needed
- **Staleness tracking** — lastVerified field + README freshness indicator. Green <=30d, yellow >30d, red >90d. Threshold: 30 days
- **Minimal governance** — just CONTRIBUTING.md. No formal code of conduct or governance docs
- **README usage examples** — 2-3 code snippets showing how to fetch and parse registry.json

### Claude's Discretion

- Exact JSON Schema structure and validation rules
- generate.js script implementation (README template, table formatting, staleness badge logic)
- validate.js script implementation (schema loading, error reporting format)
- \_template.json comment style (JSON5 comments vs stripped before validation)
- Exact README layout and section ordering
- registry.json provider key format (object keys vs array with id field)
- Issue template content and form fields
- Whether to include a .editorconfig or .gitattributes

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Source data (Phase 12 intelligence)

- `docs/providers/notes/cerebras.md` — Verified rate limits, models, headers, token bucketing
- `docs/providers/notes/google.md` — Google AI Studio free tier, RPM/RPD, multi-project key rotation
- `docs/providers/notes/groq.md` — Per-model RPM/RPD, LPU inference details
- `docs/providers/notes/github-models.md` — Rate limits, per-request token caps, model tiers
- `docs/providers/notes/sambanova.md` — $5 trial credit, 30-day expiry, free vs developer tier, rate limit headers
- `docs/providers/notes/nvidia-nim.md` — Credit legacy (discontinued), 402 handling, geo-restrictions, unpublished limits
- `docs/providers/notes/mistral.md` — 1 RPS, 1B tok/month, training opt-in requirement

### Existing provider modules (structured data reference)

- `src/providers/cerebras.ts` — Curated model registry pattern, model IDs, capabilities, adapter factory
- `src/providers/google.ts` — Same pattern for Google
- `src/providers/groq.ts` — Same pattern for Groq
- `src/providers/github-models.ts` — Same pattern for GitHub Models
- `src/providers/sambanova.ts` — Same pattern for SambaNova
- `src/providers/nvidia-nim.ts` — Same pattern for NVIDIA NIM
- `src/providers/mistral.ts` — Same pattern for Mistral
- `src/providers/types.ts` — ProviderModule type definition (model shape, metadata fields)

### Prior phase context

- `.planning/phases/12-provider-overhaul-validation/12-CONTEXT.md` — Provider tier system, curated model registry design, per-provider module pattern, staleness warnings
- `.planning/phases/12.1-provider-nuance-gap-analysis/12.1-01-PLAN.md` — Gap report with per-provider analysis
- `docs/providers/GAP-REPORT.md` — Provider nuance gaps (per-model limits, per-account limits, credit-based billing)

### Community reference

- Memory file `reference_free_coding_models.md` — CLI tool with 159 free coding LLMs, 20 providers (schema reference for broader coverage)
- Memory file `reference_free_llm_api_resources.md` — Community list of free LLM APIs (github.com/cheahjs), gotchas

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- Provider modules (`src/providers/*.ts`): Each already has structured data — model IDs, capabilities, quality tiers, SDK packages, base URLs, auth config. Primary source for populating the 7 initial provider JSON files
- Provider intelligence notes (`docs/providers/notes/*.md`): Detailed free tier limits, rate limit headers, gotchas, verification dates. Secondary source for populating JSON files
- `src/providers/types.ts`: ProviderModule type with model shape — reference for designing the JSON schema
- `docs/providers/comparison.md`: Existing comparison table format — reference for README generation

### Established Patterns

- Per-provider TypeScript modules with `lastVerified`, `verifiedBy`, `updateUrl` fields — same freshness pattern for JSON files
- Quality tiers: `'frontier'` | `'high'` | `'mid'` | `'small'` — reuse in JSON schema
- Capability flags: `'reasoning'` | `'vision'` | `'tools'` | `'structuredOutput'` — reuse in JSON schema
- Provider tier: `'free'` | `'trial'` | `'paid'` — maps to freeTier.type in JSON

### Integration Points

- PennyLLM README: Add link to `awesome-free-llm-apis` repo in provider reference section
- PennyLLM docs (`docs/configuration.md`, `docs/troubleshooting.md`): Link to registry for provider details and signup URLs
- This is a NEW repo — no existing code to modify in PennyLLM except documentation links

</code_context>

<specifics>
## Specific Ideas

- "keep it frictionless and less bloated plus easy to update and reference in development only" — drove zero-dep, no CI, manual review, dev-reference-only decisions
- "the prod users / npm users / package users don't need to care about list probably" — drove link-only from PennyLLM, no runtime dependency, no npm data package
- README comparison table with freshness badges (green/yellow/red) generated from lastVerified dates
- Provider intel notes and existing TypeScript provider modules are the primary data sources — no new research needed, just reformatting into JSON

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

_Phase: 16-provider-data-registry_
_Context gathered: 2026-03-19_
