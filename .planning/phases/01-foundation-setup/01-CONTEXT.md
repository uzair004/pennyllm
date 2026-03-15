# Phase 1: Foundation Setup - Context

**Gathered:** 2026-03-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Set up TypeScript npm package with build tooling, project structure, core interfaces (`StorageBackend`, `ModelCatalog`, `SelectionStrategy`), domain types (`ModelMetadata`, `Policy`, `UsageRecord`, `TimeWindow`), Zod config schema, and base error handling. This is scaffolding — no runtime logic beyond config validation.

</domain>

<decisions>
## Implementation Decisions

### Module Format & Build

- Dual ESM+CJS output via tsup (format: ['esm', 'cjs'])
- Subpath exports for modular imports (e.g., `pennyllm/storage`, `pennyllm/providers`)
- Minimum Node.js 18+
- No path aliases — relative imports only (flat src/ keeps paths short)
- Single package (not monorepo) — interface-based plugin extensibility without monorepo overhead

### Project Structure

- Flat by domain: `src/storage/`, `src/policy/`, `src/selection/`, `src/catalog/`, `src/types/`, `src/config/`
- Standard npm package conventions

### Tooling

- Vitest for testing
- ESLint + Prettier for linting/formatting
- lint-staged + husky for pre-commit hooks (lint + format staged files)
- commitlint + husky for conventional commits enforcement
- Changesets (@changesets/cli) for versioning
- GitHub Actions CI: lint + typecheck + tests on every push
- Basic CONTRIBUTING.md with setup/test/lint commands

### Config Ergonomics

- Single config object validated by Zod (not builder pattern, not config file auto-detection)
- File-based config loading: JSON + YAML with `${VAR}` environment variable interpolation
- YAML parser as optional peer dependency (consumer installs only if using YAML)
- Deep merge with sensible safe defaults (strategy: round-robin, storage: sqlite, budget: $0)
- Eager validation at `createRouter()` — fail fast on invalid config
- Schema versioned with `version` field for future migration
- Zod schema exported for consumer use (validation, tooling, future Admin UI)
- Config introspection via `router.getConfig()` — read-only, API keys redacted by default
- No profiles/environments, no config extends/composition, no hot-reload (deferred)
- Timeouts deferred to Vercel AI SDK — no custom timeout layer
- Provider groups/pools deferred to Phase 9
- Config warnings for common mistakes via debug logger (not stderr)
- `defineConfig()` helper exported for type-safe config files (zero runtime cost)

### Constants & Enums

- Const objects with string values (`as const`) for all config enums — not TypeScript enums, not raw strings
- Examples: `Strategy.ROUND_ROBIN = 'round-robin'`, `Provider.GOOGLE = 'google'`
- Provider IDs match Vercel AI SDK provider names (e.g., `'google'`, `'groq'`) for familiarity
- All config values JSON-serializable (important: future Admin UI will read/write config)

### Provider Config Shape

- Object with provider names as keys: `{ providers: { google: {...}, groq: {...} } }`
- API keys in provider config: `{ keys: [process.env.KEY1, process.env.KEY2] }` — consumer manages key loading
- Multiple router instances supported — each `createRouter()` returns independent instance

### Dependencies

- Vercel AI SDK (`ai`) as peer dependency — standard for SDK wrappers, npm 7+ auto-installs
- Zod as regular dependency (~13KB gzipped)
- `debug` package as regular dependency
- YAML parser as optional peer dependency

### Package API Surface

- `createRouter(config)` factory function — async (returns Promise), initializes SQLite/validation during creation
- `router.model('provider/model-name')` returns wrapped AI SDK model — combined 'provider/model' format
- Per-request overrides: `router.model('google/gemini', { strategy: Strategy.ROUND_ROBIN })`
- `router.getUsage(provider)` — current token consumption, remaining quota
- `router.health()` — per-provider status (active, rate-limited, exhausted)
- `router.getConfig()` — read-only resolved config with redacted keys
- `router.close()` — explicit cleanup (SQLite connections, timers)
- Export all public TypeScript types: RouterConfig, ProviderStatus, UsageStats, event types, etc.
- No AI SDK re-exports — consumer imports `generateText`/`streamText` from `'ai'` directly
- Explicit model only — no auto-selection mode (Phase 9 handles capability-aware routing)
- Interface shapes defined for future features: `addKey()`, `removeKey()`, `models()` — implementation deferred

### Minimal Usage Example (3 lines)

```typescript
const router = await createRouter({ providers: { google: { keys: [env.KEY] } } });
const model = router.model('google/gemini-2.0-flash');
const { text } = await generateText({ model, prompt: 'Hello' });
```

### Events & Hooks

- Node.js EventEmitter pattern: `router.on('key:selected', handler)`
- Fully typed events — each event name maps to specific TypeScript event type
- Namespaced event names with colon: `'key:selected'`, `'usage:recorded'`, `'limit:warning'`
- Event names also as const objects: `RouterEvent.KEY_SELECTED`
- Wildcard listener: `router.on('*', handler)` captures all events
- Standard metadata on every event: `{ timestamp, requestId, ...payload }`
- Fire-and-forget — async handlers are not awaited

### Error Handling

- Base `PennyLLMError` class defined in Phase 1
- Typed error subclasses with metadata: `ConfigError`, `RateLimitError`, `QuotaExhaustedError`
- Actionable suggestions: `error.suggestion` with human-readable advice + machine-readable data (e.g., `retryAfter`)
- JSON serializable: `error.toJSON()` for logging pipelines and future Admin UI

### Logging

- `debug` package with component-based namespaces: `pennyllm:config`, `pennyllm:selection`, `pennyllm:usage`, `pennyllm:storage`
- Consumer enables: `DEBUG=pennyllm:*` for all, `DEBUG=pennyllm:selection` for specific
- Human-readable messages with inline data
- API keys always redacted in debug output

### Plugin DX

- Minimal interfaces with few required methods
- Abstract base classes / helper functions provided so consumers don't start from scratch
- e.g., `AbstractStorageBackend` with common logic

### License & Naming

- MIT license
- Package name deferred — placeholder during development, branding decided post-implementation
- README content deferred to Phase 11 (DX Polish)

### Claude's Discretion

- Exact domain type field shapes (ModelMetadata, Policy, UsageRecord, TimeWindow)
- Internal code organization within each domain folder
- Test file organization and naming conventions
- Exact Zod schema nesting structure
- Abstract base class method signatures
- GitHub Actions workflow configuration details

</decisions>

<specifics>
## Specific Ideas

- "The package shouldn't be bulky — modular imports or whatever keeps it lean"
- Config must be JSON-serializable because "configuration could later be moved to setting it from UI" (v2 Admin Dashboard)
- "Strategies etc should be standardized as enums etc, not random free floating text"
- Keys in config because "we are not setting stuff within package but exposing stuff and letting consumer insert keys"
- Plugin extensibility via interfaces without monorepo — "should we expect community plugins? strategies, new LLM integration, extending something"

</specifics>

<code_context>

## Existing Code Insights

### Reusable Assets

- None — greenfield project (only README.md exists)

### Established Patterns

- None — all patterns will be established in this phase

### Integration Points

- None — this is the foundation phase

</code_context>

<deferred>
## Deferred Ideas

- Package naming and branding — decide after implementation
- Hot-reloadable config (`router.updateConfig()`) — decide when Admin UI needs it
- Provider groups/pools in config — Phase 9
- Auto-model selection (`router.auto('reasoning')`) — Phase 9
- Router-level middleware/interceptors — Phase 6+ (AI SDK's wrapLanguageModel handles this)
- Dynamic key rotation (addKey/removeKey) — Phase 10+
- Model listing API — Phase 5 (ModelCatalog implementation)
- README content — Phase 11 (DX Polish)

</deferred>

---

_Phase: 01-foundation-setup_
_Context gathered: 2026-03-12_
