# Phase 15: CLI Validator - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

`npx pennyllm validate` — a CLI command that reads config, makes real test calls to each configured provider+model, and reports whether keys work, models exist, and responses are received. CI-friendly exit codes. One model tested per provider, all keys tested with real API calls. Does NOT count against usage tracking.

Requirements: extends DX-01 (minimal config), DX-04 (dry-run mode). Success criteria 1-5 from roadmap.

</domain>

<decisions>
## Implementation Decisions

### Output Format & Reporting

- **Default format: colored table** — Provider, Keys, Model, Tier, Status, Latency, Message columns. Green/red/yellow coloring for pass/fail/warn. Auto-detect TTY for colors, respect NO_COLOR env var
- **Key count column** — Default shows summary: "2/2 keys ok". With --verbose: expand to per-key rows showing Key 1, Key 2 individually
- **Tier column** — Show free/trial/paid per chain entry. Quick sanity check for cost profile
- **All chain entries shown** — Tested model gets pass/fail, untested models from same provider show "– key ok". Full picture of configured chain
- **Summary line** — "3 providers (7 keys), 3 passed, 1 failed, 1 warning"
- **--json flag** — Structured JSON output for CI pipelines. Suppresses progress indicators when active
- **--verbose flag** — Shows extra detail: per-key rows, response token count, model version from response, rate limit headers remaining
- **Spinner per provider** — Show progress indicators while tests run. Replace with final table on completion
- **Parallel execution** — All providers tested concurrently (keys within same provider tested sequentially to avoid rate limits). Results rendered as sorted table after all complete

### Test Call Design

- **Minimal ping prompt** — "Respond with the word ok." with maxTokens: 5. Cheapest possible call. Any non-empty response = pass
- **Both generateText AND streamText** — Test both paths per provider/key. Streaming failure = full failure (not warning). Both must pass for a model to pass
- **One model per provider** — Test first model per provider to validate key + connectivity. Avoids excessive rate limit usage
- **All keys tested with real API calls** — Each key gets its own generateText + streamText call. Catches revoked/expired keys. Per-key rows visible in --verbose
- **10-second timeout** — Per-provider default. Configurable via --timeout flag
- **Reuse createRouter() for setup** — Load config, validate, build chain, load provider SDKs via createRouter(). Then make test calls directly through provider adapters, bypassing chain/retry proxy
- **Exclude from usage tracking** — Validation calls are diagnostic. Don't pollute usage stats or trigger limit warnings
- **Sequential keys within provider** — Avoid triggering rate limits by testing keys one at a time per provider. Different providers run in parallel
- **--dry-run mode** — Validates config parsing, provider SDK availability, key format, chain building — everything except real API calls. Instant, free, no rate limit impact

### CLI Interface & Flags

- **Invocation: `npx pennyllm validate`** — 'pennyllm' as bin entry, 'validate' as subcommand. Room for future subcommands
- **`npx pennyllm` with no subcommand shows help** — Usage, available commands, global options
- **Per-subcommand --help** — `npx pennyllm validate --help` shows validate-specific flags and examples
- **No CLI framework** — Use Node.js built-in `parseArgs` from `node:util` (available since Node 18.3). One command with ~6 flags doesn't need commander/yargs
- **Config discovery** — Priority: --config flag > PENNYLLM_CONFIG env var > auto-discover pennyllm.config.{ts,js,json,yaml,yml} in cwd/parent dirs
- **TypeScript config support** — Load .ts config files via jiti for runtime TS loading. Same pattern as vitest.config.ts
- **--provider flag** — Filter to specific providers: `--provider cerebras --provider google`. Multiple allowed
- **--timeout flag** — Per-provider timeout in ms. Default 10000 (10s)
- **Exit codes: 0/1/2** — 0 = all pass, 1 = at least one failure, 2 = no failures but has warnings
- **Separate build entry point** — src/cli/index.ts built as dist/cli.mjs with shebang. package.json bin points to it
- **src/cli/ directory structure** — index.ts (entry + arg parsing), validate.ts (validation orchestration), format.ts (table/json formatters)
- **--version flag** — Shows package version from package.json

### Error Handling & Edge Cases

- **429 = warning** — Rate limited means key IS valid, provider IS reachable. Mark as warning. "Rate limited (429) — key valid, try again later"
- **Timeout = warning** — Provider may be slow or geo-restricted. "Timeout (10s) — provider may be unreachable". NVIDIA known geo-restricted
- **401/403 = failure with guidance** — Include provider-specific sign-up/docs URL from provider module metadata. E.g., "403 Access Denied — Check: build.nvidia.com/settings — Note: NVIDIA may be geo-restricted"
- **Missing SDK = failure with install command** — "Missing @ai-sdk/cerebras — run: npm install @ai-sdk/cerebras". Don't crash whole validation, skip that provider
- **No config found = helpful error** — List searched locations, suggest creating config or using --config. Include docs link
- **Config validation errors** — Surface createRouter() ConfigError messages as-is. They already have Levenshtein typo suggestions

### Claude's Discretion

- Exact table rendering implementation (manual string formatting vs lightweight lib like cli-table3)
- Spinner library choice (ora, nanospinner, or manual)
- jiti vs tsx for TypeScript config loading (research which is lighter/more compatible)
- How to create provider instances directly for test calls (bypassing chain proxy)
- Exact JSON output schema shape
- How to detect and report "same account" key issues during validation
- Config auto-discovery implementation details (glob pattern, parent dir traversal depth)
- Whether to add a --no-stream flag to skip streaming tests

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 12 context (chain architecture, provider modules)

- `.planning/phases/12-provider-overhaul-validation/12-CONTEXT.md` — Chain config shape, provider module pattern, createRouter() flow, provider SDK loading, curated model registry structure

### Phase 14 context (health scoring integration)

- `.planning/phases/14-health-scoring-circuit-breakers/14-CONTEXT.md` — HealthScorer class, getStatus() extension, relevant for understanding full Router interface

### Existing code (key integration points)

- `src/config/index.ts` — createRouter() function and Router interface. Validation will call createRouter() for setup
- `src/config/loader.ts` — Existing config file loading logic (loadConfigFile). CLI auto-discovery builds on this
- `src/config/define-config.ts` — defineConfig() helper for typed config
- `src/providers/registry.ts` — Provider module registry, getProviderModule(), provider metadata with URLs
- `src/providers/*.ts` — Individual provider modules (cerebras, google, groq, etc.) with model lists and adapter factories
- `src/chain/chain-builder.ts` — buildChain() function that constructs the model chain from config
- `src/chain/types.ts` — ChainEntry type (provider, model, tier info)
- `src/wrapper/error-classifier.ts` — classifyError() for categorizing API errors (429, 401, etc.)

### Build config

- `package.json` — Current exports, dependencies, build config. Needs bin entry added
- `tsup.config.ts` (if exists) — Build configuration. Needs CLI entry point added

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `createRouter()` (src/config/index.ts): Full config validation + provider SDK loading + chain building. CLI reuses this for setup
- `loadConfigFile()` (src/config/loader.ts): JSON/YAML config file loading. CLI extends with auto-discovery and .ts support
- `defineConfig()` (src/config/define-config.ts): Typed config helper users use in .ts config files
- Provider modules (src/providers/\*.ts): Each has metadata including provider URLs, model lists, adapter factories. CLI uses for actionable error messages
- `classifyError()` (src/wrapper/error-classifier.ts): Categorizes API errors into auth/rate-limit/network etc. CLI uses for error classification
- `formatConfigErrors()` (src/config/validation.ts): Config validation error formatting with Levenshtein suggestions
- `getProviderModule()` (src/providers/registry.ts): Access provider metadata including URLs for error guidance
- `buildChain()` (src/chain/chain-builder.ts): Constructs chain entries with provider/model/tier info for table display

### Established Patterns

- Dynamic import with try/catch for optional provider SDKs
- `debug` package with component namespaces (`pennyllm:cli` for CLI logging)
- Fire-and-forget for non-critical ops
- Zod schema validation with ConfigError for user-facing errors
- `exactOptionalPropertyTypes` — conditional object field construction

### Integration Points

- `package.json`: Add `"bin": { "pennyllm": "./dist/cli.mjs" }` entry
- `tsup.config.ts` or build script: Add src/cli/index.ts as additional entry point with shebang banner
- `src/cli/` directory: New — index.ts, validate.ts, format.ts
- Provider modules: Read metadata (URLs, model lists) for error messages and table display

</code_context>

<specifics>
## Specific Ideas

- Colored table with provider/keys/model/tier/status columns — user approved specific mockup layout
- Spinner per provider during parallel execution, replaced by final sorted table
- Per-key verbose expansion: default "2/2 keys ok", verbose shows individual Key 1/Key 2 rows
- Both generateText AND streamText tested per key — streaming failure is a full failure, not warning
- Auto-discovery searches pennyllm.config.{ts,js,json,yaml,yml} in cwd then parent dirs
- TypeScript config files loaded via jiti (same pattern as vitest/tailwind)
- Provider-specific error guidance with URLs from provider module metadata (e.g., "Check: build.nvidia.com/settings — Note: NVIDIA may be geo-restricted")
- No config found error lists all searched locations with setup guidance

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

_Phase: 15-cli-validator_
_Context gathered: 2026-03-18_
