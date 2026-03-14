# Phase 11: Developer Experience Polish - Context

**Gathered:** 2026-03-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the package easy to use, debug, and understand through documentation, debug mode, and configuration polish. Covers README, docs/, debug mode implementation, config validation improvements, and CONTRIBUTING refresh. All core features are complete (Phases 1-10) — this phase is purely user-facing DX.

Requirements: CORE-02 (multiple keys config), DX-01 (minimal config), DX-06 (debug mode), DX-07 (TypeScript types).

</domain>

<decisions>
## Implementation Decisions

### Documentation Structure

- **Location:** README.md + docs/ folder (flat files). README is the npm landing page with quickstart. docs/ has reference material.
- **docs/ layout:** Flat files — docs/configuration.md, docs/troubleshooting.md, docs/events.md. No subfolder hierarchy. docs/providers/ already has 12 guides from Phase 8.
- **Config reference:** Hand-written markdown with examples per section. Not auto-generated from Zod. Covers full config including dryRun, storage adapter options (SQLite, Redis).
- **Events reference:** Dedicated section documenting both raw `router.on()` API and typed hook convenience methods (`router.onKeySelected()`, etc.) with payload types and usage examples.
- **Troubleshooting:** Covers both config mistakes (invalid provider names, missing keys, contradictory fallback+budget) and runtime issues (all keys exhausted, 429 handling, budget exceeded, missing peer deps for storage adapters, Redis connection failures).
- **Style:** Drizzle-style — concise, code-first, no fluff. Config examples front and center.
- **Code examples:** Illustrative TypeScript snippets in docs. No runnable examples/ directory.
- **No CHANGELOG** — rely on git history and GitHub releases.
- **No migration guide** for v1 — add when v2 ships.

### Debug Mode Design

- **Activation:** Two ways — `createRouter({ debug: true })` config flag OR `DEBUG=llm-router:*` env var. Config flag is the primary, discoverable path.
- **Output format:** Structured per-request summary. One clean line per routing decision: `[llm-router] google/gemini-2.0-flash → key#0 (priority, 847/1500 RPM used, 3 limits checked)`
- **Scope:** Full routing pipeline — key selection + fallback triggers + budget checks + retry attempts. Shows the complete decision chain.
- **Destination:** `console.log` to stdout. Separate from debug package's stderr output.
- **Implementation:** Debug mode listens to Phase 10's typed observability hooks (onKeySelected, onFallbackTriggered, onBudgetAlert, etc.) and pretty-prints structured summaries. The debug package's raw output (stderr) remains available for low-level debugging.

### Minimal Config Experience

- **Current minimal config is sufficient:** `{ providers: { google: { keys: ['KEY'] } } }` — all other fields have sensible Zod defaults. No helper function needed.
- **Key validation:** Validate non-empty strings only at config time. Don't validate key format (providers differ). Bad keys fail at runtime with clear errors.
- **Actionable error messages:** Config errors include what went wrong + how to fix it. Typo suggestions for provider names ("Provider 'googel' not recognized. Did you mean 'google'?"). Missing field hints. Similar to Zod/Next.js error UX.
- **Typed provider names:** `defineConfig()` providers key uses union type `Record<'google' | 'groq' | 'openrouter' | ... | (string & {}), ProviderConfig>`. Known providers autocomplete in IDE, custom providers still allowed.

### README Content & Tone

- **Lead:** Problem statement ("Stop paying for LLM API calls during development") + immediate 5-line working code example.
- **Tone:** Technical-casual. Professional but approachable. Like Drizzle, tRPC, Hono docs.
- **Badges:** npm version, TypeScript, license (MIT), bundle size (bundlephobia). Brief note about zero runtime deps beyond peer deps.
- **TOC:** Manual markdown table of contents near the top.
- **Examples:** 3 code examples — 1) Minimal setup (one provider), 2) Multi-provider with budget, 3) Storage adapter (SQLite or Redis).
- **How it works:** Detailed flow diagram (ASCII/mermaid) showing request → key selection → fallback → retry → provider pipeline.
- **Providers:** All 12 provider names in a clean grid/list with logos/icons. Link to docs/providers/ for details.
- **Comparison:** Brief table/bullets — llm-router vs manual management vs LiteLLM. Not adversarial.
- **Roadmap:** Link to GitHub milestones. No inline roadmap.
- **License:** Badge only + LICENSE file. No separate section.
- **CONTRIBUTING:** Light refresh of existing CONTRIBUTING.md to reflect current project structure and build commands.

### Claude's Discretion

- Exact mermaid/ASCII diagram design for "How it works"
- Badge arrangement and styling
- Troubleshooting guide organization (by error type vs by symptom)
- Debug mode output formatting details (colors, prefixes, alignment)
- Provider grid/list layout in README
- Order of sections within docs/configuration.md
- Exact wording of error message suggestions (Levenshtein distance threshold for typo detection)

</decisions>

<specifics>
## Specific Ideas

- "Deliver solid UX in organized fashion per standards" — user wants professional, polished output
- Drizzle-style docs: concise, code-first, no fluff
- Phase 10 is complete — all features (SQLite, Redis, hooks, dry-run) are documentable now. No "coming soon" placeholders needed.
- Debug mode can use Phase 10's typed observability hooks for structured output

</specifics>

<code_context>

## Existing Code Insights

### Reusable Assets

- `debug` package: 86 debug() calls across 17 files already wired with namespaced logging (llm-router:config, llm-router:storage, etc.)
- EventEmitter: Already wired in createRouter with typed event payloads for all router events
- 8 typed observability hooks: `router.onKeySelected()`, `router.onUsageRecorded()`, etc. — return unsubscribe functions (Phase 10)
- Zod schema with `.default()`: All config fields except `providers` have sensible defaults
- Provider-specific JSDoc aliases: Phase 8 added typed configs with sign-up URLs, env vars, tier info per provider
- 12 provider key acquisition guides: Already in docs/providers/ (Phase 8)
- CONTRIBUTING.md: Exists, needs refresh

### Established Patterns

- `exactOptionalPropertyTypes` enabled — conditional object construction required
- `debug` package for namespaced logging (stderr) — complement with console.log for debug mode (stdout)
- Subpath exports: 11 total (., ./storage, ./catalog, ./selection, ./policy, ./types, ./errors, ./constants, ./wrapper, ./sqlite, ./redis)
- Optional peer deps: @ai-sdk/google, better-sqlite3, ioredis — pattern for error messages on missing deps
- `createHook<T>()` factory for typed event wrappers over EventEmitter

### Integration Points

- `createRouter()` in src/config/index.ts — needs `debug` config option
- `configSchema` in src/config/schema.ts — needs `debug: z.boolean().default(false)`
- `Router` interface in src/config/index.ts — debug mode listener setup
- README.md — currently empty (just `# llm-router`)
- package.json — exports field has all 11 subpath entries
- CONTRIBUTING.md — exists, needs light refresh

</code_context>

<deferred>
## Deferred Ideas

- Auto-generated API reference from TypeScript types (e.g., typedoc) — v2 enhancement
- Docs site with search/sidebar (Docusaurus/VitePress) — v2 when docs grow
- Runnable examples/ directory with clone-and-run scripts — v2
- Interactive playground/REPL — v2
- Auto-generated CHANGELOG from conventional commits — v2

</deferred>

---

_Phase: 11-developer-experience-polish_
_Context gathered: 2026-03-14_
