# Phase 11: Developer Experience Polish - Research

**Researched:** 2026-03-15
**Domain:** Documentation, debug mode, config validation UX, TypeScript types
**Confidence:** HIGH

## Summary

Phase 11 is a DX-focused phase that requires no new runtime dependencies and builds on top of a fully-featured codebase (Phases 1-10 complete). The work divides into four distinct areas: (1) debug mode implementation that listens to Phase 10's typed observability hooks and pretty-prints structured routing summaries to stdout, (2) config validation improvements with actionable error messages and provider name typo suggestions, (3) comprehensive documentation (README + docs/ flat files), and (4) TypeScript type polish including typed provider names in `defineConfig()`.

The codebase already has 86 `debug()` calls across 17 files using the `debug` npm package (stderr). The new debug mode is a separate concern -- it uses `console.log` (stdout) and subscribes to the existing typed hook system (`router.onKeySelected()`, etc.) to produce human-readable, one-line summaries per routing decision. No new dependencies are needed. Levenshtein distance for typo detection is a ~20-line function that should be hand-rolled (zero dependencies is a project value). The `(string & {})` TypeScript pattern for open-ended union autocomplete is well-established and works in all supported TS versions.

**Primary recommendation:** Implement in three waves: (1) code changes (debug mode + config validation), (2) documentation (README + docs/), (3) CONTRIBUTING refresh and final audit.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Documentation location:** README.md + docs/ folder (flat files). README is the npm landing page with quickstart. docs/ has reference material.
- **docs/ layout:** Flat files -- docs/configuration.md, docs/troubleshooting.md, docs/events.md. No subfolder hierarchy. docs/providers/ already has 12 guides from Phase 8.
- **Config reference:** Hand-written markdown with examples per section. Not auto-generated from Zod. Covers full config including dryRun, storage adapter options (SQLite, Redis).
- **Events reference:** Dedicated section documenting both raw `router.on()` API and typed hook convenience methods with payload types and usage examples.
- **Troubleshooting:** Covers config mistakes (invalid provider names, missing keys, contradictory fallback+budget) and runtime issues (all keys exhausted, 429 handling, budget exceeded, missing peer deps, Redis connection failures).
- **Style:** Drizzle-style -- concise, code-first, no fluff. Config examples front and center.
- **Code examples:** Illustrative TypeScript snippets in docs. No runnable examples/ directory.
- **No CHANGELOG** -- rely on git history and GitHub releases.
- **No migration guide** for v1.
- **Debug mode activation:** `createRouter({ debug: true })` config flag OR `DEBUG=llm-router:*` env var. Config flag is the primary path.
- **Debug output format:** Structured per-request summary. One clean line per routing decision: `[llm-router] google/gemini-2.0-flash -> key#0 (priority, 847/1500 RPM used, 3 limits checked)`
- **Debug scope:** Full routing pipeline -- key selection + fallback triggers + budget checks + retry attempts.
- **Debug destination:** `console.log` to stdout. Separate from debug package's stderr.
- **Debug implementation:** Listens to Phase 10's typed observability hooks and pretty-prints structured summaries.
- **Minimal config:** Current `{ providers: { google: { keys: ['KEY'] } } }` is sufficient. No helper function needed.
- **Key validation:** Non-empty strings only at config time. No format validation.
- **Actionable error messages:** Config errors include what went wrong + how to fix. Typo suggestions for provider names. Missing field hints.
- **Typed provider names:** `defineConfig()` uses `Record<'google' | 'groq' | ... | (string & {}), ProviderConfig>`.
- **README lead:** Problem statement + 5-line working code example.
- **README tone:** Technical-casual, like Drizzle/tRPC/Hono.
- **README badges:** npm version, TypeScript, license (MIT), bundle size.
- **README TOC:** Manual markdown table of contents.
- **README examples:** 3 code examples -- minimal, multi-provider+budget, storage adapter.
- **README how it works:** Flow diagram (ASCII/mermaid).
- **README providers:** All 12 in clean grid/list with link to docs/providers/.
- **README comparison:** Brief table -- llm-router vs manual vs LiteLLM.
- **CONTRIBUTING:** Light refresh of existing file.

### Claude's Discretion

- Exact mermaid/ASCII diagram design for "How it works"
- Badge arrangement and styling
- Troubleshooting guide organization (by error type vs by symptom)
- Debug mode output formatting details (colors, prefixes, alignment)
- Provider grid/list layout in README
- Order of sections within docs/configuration.md
- Exact wording of error message suggestions (Levenshtein distance threshold for typo detection)

### Deferred Ideas (OUT OF SCOPE)

- Auto-generated API reference from TypeScript types (typedoc) -- v2
- Docs site with search/sidebar (Docusaurus/VitePress) -- v2
- Runnable examples/ directory -- v2
- Interactive playground/REPL -- v2
- Auto-generated CHANGELOG from conventional commits -- v2
  </user_constraints>

<phase_requirements>

## Phase Requirements

| ID      | Description                                                                           | Research Support                                                                                                                                                                     |
| ------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| CORE-02 | User can configure multiple API keys per provider (e.g., 3 Google keys, 2 Groq keys)  | Already supported by schema (`keys: z.array(keyConfigSchema).min(1)`). Phase 11 documents this in README examples and config reference.                                              |
| DX-01   | Package works with minimal config (just API keys + provider names, sensible defaults) | Already works via Zod `.default()` on all fields except `providers`. Phase 11 documents the minimal config path and ensures error messages guide users to the simplest valid config. |
| DX-06   | Debug mode logs routing decisions (which key selected, why, remaining quota)          | New `debug: z.boolean().default(false)` config option. Implementation subscribes to typed hooks and formats structured stdout output.                                                |
| DX-07   | TypeScript types exported for all configuration, events, and public API               | Types already exported (src/index.ts exports 50+ types). Phase 11 adds typed provider union to `defineConfig()` and audits for any missing exports.                                  |

</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose                     | Why Standard                                    |
| ------- | ------- | --------------------------- | ----------------------------------------------- |
| debug   | ^4.3.0  | Namespaced logging (stderr) | Already in use, 86 calls across 17 files        |
| zod     | ^3.23.0 | Config schema + validation  | Already in use, peer dep constraint from AI SDK |

### Supporting

| Library    | Version | Purpose | When to Use                           |
| ---------- | ------- | ------- | ------------------------------------- |
| (none new) | -       | -       | This phase adds zero new dependencies |

### Alternatives Considered

| Instead of              | Could Use                         | Tradeoff                                                                          |
| ----------------------- | --------------------------------- | --------------------------------------------------------------------------------- |
| Hand-rolled Levenshtein | `fastest-levenshtein` npm package | 20 lines of code vs. adding a dependency. Zero-dep is a project value. Hand-roll. |
| Hand-written docs       | typedoc/API Extractor             | Auto-generated docs deferred to v2. Hand-written gives Drizzle-style control.     |

**Installation:**

```bash
# No new packages needed
```

## Architecture Patterns

### Recommended Project Structure (additions for Phase 11)

```
src/
  config/
    schema.ts          # Add debug: z.boolean().default(false)
    define-config.ts   # Update type to use ProviderNameUnion
    validation.ts      # NEW: Levenshtein + typo suggestions + actionable errors
  debug/
    DebugLogger.ts     # NEW: Debug mode that subscribes to hooks
    index.ts           # NEW: Export DebugLogger
docs/
  configuration.md     # NEW: Full config reference
  troubleshooting.md   # NEW: Common issues and solutions
  events.md            # NEW: Events and hooks reference
  providers/           # EXISTING: 12 provider guides (Phase 8)
README.md              # REWRITE: Full npm landing page
CONTRIBUTING.md        # UPDATE: Refresh for current project
```

### Pattern 1: Debug Mode via Hook Subscription

**What:** Debug mode subscribes to the existing typed observability hooks from Phase 10 and formats structured log lines to stdout.
**When to use:** When `debug: true` is set in config or `DEBUG=llm-router:*` env var is detected.
**Example:**

```typescript
// Source: Project architecture (Phase 10 hooks + new debug consumer)
export class DebugLogger {
  private unsubscribers: Array<() => void> = [];

  constructor(private router: Router) {}

  enable(): void {
    this.unsubscribers.push(
      this.router.onKeySelected((event) => {
        const label = event.label ? ` (${event.label})` : '';
        console.log(
          `[llm-router] ${event.provider}/${event.model ?? '?'} -> key#${event.keyIndex}${label} (${event.strategy}, ${event.reason})`,
        );
      }),
    );
    this.unsubscribers.push(
      this.router.onFallbackTriggered((event) => {
        console.log(
          `[llm-router] fallback: ${event.fromProvider} -> ${event.toProvider} (${event.reason})`,
        );
      }),
    );
    // ... subscribe to all relevant hooks
  }

  disable(): void {
    for (const unsub of this.unsubscribers) unsub();
    this.unsubscribers = [];
  }
}
```

### Pattern 2: Actionable Config Errors with Typo Suggestions

**What:** Enhance config validation to detect provider name typos using Levenshtein distance, and produce error messages that tell users exactly how to fix the problem.
**When to use:** At `createRouter()` time, after Zod validation passes (Zod validates structure, then custom validation adds semantic checks).
**Example:**

```typescript
// Source: Standard Levenshtein pattern
function levenshtein(a: string, b: string): number {
  const m = a.length,
    n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) => {
    const row = new Array<number>(n + 1);
    row[0] = i;
    return row;
  });
  for (let j = 1; j <= n; j++) dp[0]![j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(dp[i - 1]![j]! + 1, dp[i]![j - 1]! + 1, dp[i - 1]![j - 1]! + cost);
    }
  }
  return dp[m]![n]!;
}

function suggestProvider(input: string, knownProviders: string[]): string | null {
  let best: string | null = null;
  let bestDist = Infinity;
  for (const name of knownProviders) {
    const dist = levenshtein(input.toLowerCase(), name.toLowerCase());
    if (dist < bestDist && dist <= 2) {
      // threshold of 2 edits
      bestDist = dist;
      best = name;
    }
  }
  return best;
}
```

### Pattern 3: Typed Provider Union for IDE Autocomplete

**What:** The `(string & {})` pattern gives IDE autocomplete for known provider names while still accepting arbitrary strings for custom providers.
**When to use:** In the `defineConfig()` input type for the providers record key.
**Example:**

```typescript
// Source: TypeScript open-ended union pattern (well-established)
import type { ProviderType } from '../constants/index.js';
import type { ProviderConfig } from '../types/config.js';

type ProviderName = ProviderType | (string & {});

export interface TypedConfigInput {
  providers: Record<ProviderName, ProviderConfig>;
  // ... rest of config fields
}

export function defineConfig(config: TypedConfigInput): ConfigInput {
  return config as ConfigInput;
}
```

### Anti-Patterns to Avoid

- **Auto-generating docs from Zod schema:** Produces unreadable output. Hand-written is the locked decision.
- **Adding debug mode as middleware:** Debug mode observes events, it does not intercept the request pipeline. Keep it read-only.
- **Blocking on debug output:** Debug logging must never slow down routing. Use synchronous `console.log` (already synchronous in Node.js) after event emission.
- **Color libraries for debug output:** Avoid adding `chalk` or `picocolors`. The `debug` package already handles colors on stderr. For stdout debug lines, plain text with `[llm-router]` prefix is sufficient and works in all environments (CI, piped output, etc.).
- **Validating API key format:** Keys differ across providers. Only validate non-empty strings. Bad keys fail at runtime with clear errors from the provider.

## Don't Hand-Roll

| Problem                   | Don't Build      | Use Instead                           | Why                                               |
| ------------------------- | ---------------- | ------------------------------------- | ------------------------------------------------- |
| Config schema validation  | Custom validator | Zod (already in use)                  | Handles types, defaults, refinements, error paths |
| Namespaced stderr logging | Custom logger    | `debug` package (already in use)      | Standard npm pattern, 86 calls already wired      |
| Event system              | Custom pub/sub   | Node.js EventEmitter (already in use) | Native, typed hooks already built in Phase 10     |

**Key insight:** Phase 11 builds ON TOP of existing infrastructure. The debug mode is a consumer of Phase 10's hooks. Config validation enhances Zod's output. Documentation describes what already exists.

**DO hand-roll:**
| Problem | Why Hand-Roll | Complexity |
|---------|---------------|------------|
| Levenshtein distance | ~20 lines, avoids dependency for trivial function | LOW |
| Debug output formatting | Specific to our event shapes, no library fits | LOW |
| README/docs content | Hand-written is the locked decision | N/A (content) |

## Common Pitfalls

### Pitfall 1: Debug Mode Leaking into Production

**What goes wrong:** Users forget to disable debug mode and it pollutes production stdout.
**Why it happens:** `debug: true` in config is persistent.
**How to avoid:** Default is `false` in Zod schema. The `DEBUG=llm-router:*` env var path is better for dev environments (not committed to config). Document both paths clearly with guidance on when to use which.
**Warning signs:** Users reporting unexpected stdout output.

### Pitfall 2: Config Schema `.strict()` Rejecting Unknown Provider Names

**What goes wrong:** The config schema uses `.strict()` on the top-level object. Provider names are in a `z.record()` which does NOT restrict keys. This is correct -- unknown provider names should be allowed (custom providers). Do NOT add key validation to the Zod schema itself.
**Why it happens:** Temptation to validate provider names at schema level.
**How to avoid:** Provider name suggestions happen AFTER schema validation passes, as a post-validation enhancement in `createRouter()`. Unknown providers are valid -- they just get a debug warning about missing shipped defaults (already implemented).
**Warning signs:** Custom provider configs being rejected.

### Pitfall 3: exactOptionalPropertyTypes Breaking New Code

**What goes wrong:** Adding optional fields to interfaces or conditionally building objects fails with TS2412/TS2775 errors.
**Why it happens:** `exactOptionalPropertyTypes` is enabled. `obj.field = value` where value might be `undefined` is not allowed for `field?: T`.
**How to avoid:** Use conditional property construction: `if (value !== undefined) { obj.field = value; }`. This is a well-documented project pattern (see STATE.md decisions).
**Warning signs:** TypeScript errors mentioning `undefined is not assignable to type T`.

### Pitfall 4: README Code Examples That Don't Match Actual API

**What goes wrong:** Documentation shows API shapes that differ from the actual implementation.
**Why it happens:** Copy-paste errors, assumptions about API, not verifying against actual types.
**How to avoid:** Every code example in README/docs should be type-checkable against actual exports. Use the real import paths (`llm-router`, `llm-router/types`, etc.). Cross-reference with `src/index.ts` exports.
**Warning signs:** Users reporting "X is not exported from llm-router".

### Pitfall 5: Mermaid Diagrams Not Rendering on npm

**What goes wrong:** npm registry does not render mermaid blocks in README. GitHub does.
**Why it happens:** npm's markdown renderer is more limited than GitHub's.
**How to avoid:** Use ASCII diagrams for critical flow diagrams in README (guaranteed to render everywhere). Mermaid is fine in docs/ files (viewed on GitHub). Alternatively, render mermaid to SVG/PNG and embed as image.
**Warning signs:** npm package page showing raw mermaid syntax.

### Pitfall 6: Zod Error Messages Being Unhelpful

**What goes wrong:** Default Zod validation errors show technical paths like `providers.google.keys: Array must contain at least 1 element(s)`.
**Why it happens:** Zod's default error formatting is developer-focused, not user-focused.
**How to avoid:** Catch `ZodError` in `createRouter()` and transform it into a `ConfigError` with actionable suggestions. Map common Zod error paths to human-readable messages. The `zod-validation-error` library can help, but adding a dependency for this is overkill -- wrap the ZodError.issues array with custom formatting.
**Warning signs:** Users confused by Zod error paths.

## Code Examples

### Debug Mode Integration in createRouter

```typescript
// In src/config/index.ts - after router creation, before return
// Source: Project pattern (hook subscription)

// Check for debug mode: config flag or DEBUG env var
const shouldDebug = config.debug || /llm-router/.test(process.env.DEBUG ?? '');

if (shouldDebug) {
  const debugLogger = new DebugLogger();
  debugLogger.attach(routerImpl);
}
```

### Actionable Config Error Wrapper

```typescript
// In src/config/index.ts - enhance the catch block
// Source: Project pattern (ConfigError with suggestions)

import { ZodError } from 'zod';
import { formatConfigErrors } from './validation.js';

try {
  config = configSchema.parse(configOrPath) as RouterConfig;
} catch (error) {
  if (error instanceof ZodError) {
    const formatted = formatConfigErrors(error, configOrPath);
    throw new ConfigError(formatted.message, {
      field: formatted.field,
      cause: error,
    });
  }
  throw error;
}
```

### Minimal Config (DX-01 verification)

```typescript
// Source: Actual schema defaults from src/config/schema.ts
// This ALREADY works today. Phase 11 documents it.
import { createRouter } from 'llm-router';

const router = await createRouter({
  providers: {
    google: {
      keys: [process.env.GOOGLE_API_KEY!],
    },
  },
});

const model = await router.wrapModel('google/gemini-2.0-flash');
```

### Multiple Keys Per Provider (CORE-02)

```typescript
// Source: Actual schema from src/config/schema.ts - keys accepts array
import { createRouter } from 'llm-router';

const router = await createRouter({
  providers: {
    google: {
      keys: [process.env.GOOGLE_KEY_1!, process.env.GOOGLE_KEY_2!, process.env.GOOGLE_KEY_3!],
    },
    groq: {
      keys: [process.env.GROQ_KEY_1!, process.env.GROQ_KEY_2!],
    },
  },
});
```

### defineConfig with Typed Provider Names

```typescript
// Source: TypeScript open-ended union pattern
import { defineConfig } from 'llm-router';

// IDE autocompletes 'google', 'groq', 'openrouter', etc.
// Custom providers like 'my-custom' also accepted
const config = defineConfig({
  providers: {
    google: {
      // <-- autocomplete works here
      keys: ['key1', 'key2'],
    },
    groq: {
      // <-- autocomplete works here
      keys: ['key1'],
    },
  },
});
```

## State of the Art

| Old Approach                     | Current Approach                                                      | When Changed | Impact                                                           |
| -------------------------------- | --------------------------------------------------------------------- | ------------ | ---------------------------------------------------------------- |
| `debug` package only (stderr)    | Dual output: `debug` for dev, `console.log` for structured debug mode | Phase 11     | Users get clean routing summaries without enabling verbose debug |
| Raw Zod errors                   | Actionable ConfigError with suggestions                               | Phase 11     | Better onboarding experience                                     |
| Untyped provider names in config | `ProviderType \| (string & {})` union                                 | Phase 11     | IDE autocomplete for known providers                             |

**No deprecated patterns to note** -- this phase only adds new capabilities.

## Open Questions

1. **Mermaid vs ASCII for README flow diagram**
   - What we know: npm does NOT render mermaid. GitHub does.
   - What's unclear: Whether to use ASCII (universal) or mermaid (prettier on GitHub) or both.
   - Recommendation: ASCII in README (works everywhere), mermaid in docs/ files. Or render mermaid to SVG image and embed in README.

2. **Debug output color support**
   - What we know: `console.log` to stdout is plain text. The `debug` package on stderr handles colors.
   - What's unclear: Whether to add color support to debug mode stdout output.
   - Recommendation: No colors in debug mode. Plain text with `[llm-router]` prefix. Works in all environments. Users who want colored output can use `DEBUG=llm-router:*` which already has colors via the `debug` package.

3. **Levenshtein threshold value**
   - What we know: A threshold of 2 catches most typos (googel->google, groc->groq).
   - What's unclear: Whether threshold should be relative to string length.
   - Recommendation: Fixed threshold of 2 edits. Provider names are short (4-12 chars), so 2 edits is appropriate. For very short names (3 chars), even 1 edit might be too permissive, but our shortest provider name is "qwen" (4 chars), so 2 works.

## Validation Architecture

### Test Framework

| Property           | Value                       |
| ------------------ | --------------------------- |
| Framework          | vitest 2.1.8                |
| Config file        | vitest.config.ts            |
| Quick run command  | `npx vitest run`            |
| Full suite command | `npx vitest run --coverage` |

### Phase Requirements -> Test Map

| Req ID  | Behavior                                       | Test Type | Automated Command                                         | File Exists?                                                  |
| ------- | ---------------------------------------------- | --------- | --------------------------------------------------------- | ------------------------------------------------------------- |
| CORE-02 | Multiple keys per provider in config           | unit      | `npx vitest run tests/config.test.ts -t "multiple keys"`  | Partial (config.test.ts exists, specific test needed)         |
| DX-01   | Minimal config works with just keys + provider | unit      | `npx vitest run tests/config.test.ts -t "minimal config"` | Partial (config acceptance tested, minimal path not explicit) |
| DX-06   | Debug mode logs routing decisions              | unit      | `npx vitest run tests/debug.test.ts`                      | No -- Wave 0                                                  |
| DX-07   | All public exports have TypeScript types       | unit      | `npx vitest run tests/exports.test.ts`                    | Yes (exports.test.ts exists)                                  |

### Sampling Rate

- **Per task commit:** `npx vitest run && npx tsc --noEmit`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green + `npm run build` clean before verify

### Wave 0 Gaps

- [ ] `tests/debug.test.ts` -- covers DX-06 (debug mode output verification)
- [ ] `tests/config.test.ts` additions -- covers CORE-02 multi-key and DX-01 minimal config assertions

Note: Per project CLAUDE.md, "Build first, test later" and "Do NOT create test files unless the plan specifically calls for them." Tests should be minimal validation, not exhaustive suites.

## Sources

### Primary (HIGH confidence)

- Project codebase: `src/config/schema.ts`, `src/config/index.ts`, `src/types/events.ts` -- directly inspected current implementation
- Project codebase: `src/index.ts` -- all 50+ public type exports verified
- Project codebase: `src/constants/index.ts` -- Provider union type verified (12 providers)
- Project config: `package.json` -- zero new dependencies needed confirmed

### Secondary (MEDIUM confidence)

- [TypeScript open-ended union pattern](https://github.com/microsoft/TypeScript/issues/29729) -- `(string & {})` trick for autocomplete
- [Total TypeScript autocomplete tip](https://www.totaltypescript.com/tips/create-autocomplete-helper-which-allows-for-arbitrary-values) -- same pattern confirmed
- [npm debug package](https://www.npmjs.com/package/debug) -- stderr output, namespace wildcards, `DEBUG=` env var
- [Zod error customization](https://zod.dev/error-customization) -- custom error maps and formatting

### Tertiary (LOW confidence)

- npm README rendering -- mermaid not supported is widely reported but not officially documented by npm. Verified through community reports. Recommendation to use ASCII is safe regardless.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH -- no new dependencies, all tools already in use
- Architecture: HIGH -- debug mode pattern is straightforward hook subscription, well-established in codebase
- Pitfalls: HIGH -- all identified from direct codebase inspection and known TypeScript strict mode issues
- Documentation content: HIGH -- all APIs inspected, all exports verified, all event types cataloged

**Research date:** 2026-03-15
**Valid until:** 2026-04-15 (stable -- no external API changes expected)
