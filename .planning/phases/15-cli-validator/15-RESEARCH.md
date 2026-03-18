# Phase 15: CLI Validator - Research

**Researched:** 2026-03-18
**Domain:** CLI tooling, config discovery, provider validation
**Confidence:** HIGH

## Summary

Phase 15 builds `npx pennyllm validate` -- a CLI command that reads config, makes real test calls to each provider+model, and reports results in a colored table. The implementation is straightforward: Node.js built-in `parseArgs` for arg parsing, `jiti` for TypeScript config loading, `nanospinner` for progress indicators, and direct use of existing provider modules for test calls.

The codebase already has all the building blocks: provider modules with `createFactory()` for instantiating SDK clients, `classifyError()` for categorizing API errors, `buildChain()` for constructing the model chain, and the config schema with Zod validation. The CLI is a thin orchestration layer that wires these together with a reporting UI.

**Primary recommendation:** Build the CLI as a separate tsup entry point (`src/cli/index.ts` -> `dist/cli.mjs`) with three files: entry/arg parsing, validation orchestration, and table/JSON formatters. Use `jiti` for TypeScript config file loading, `nanospinner` for spinners, and manual ANSI string formatting for the results table (no table library needed for this fixed-column layout).

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Output Format & Reporting:**

- Default format: colored table with Provider, Keys, Model, Tier, Status, Latency, Message columns
- Key count column: default "2/2 keys ok", verbose expands to per-key rows
- Tier column shows free/trial/paid
- All chain entries shown: tested model gets pass/fail, untested models show "-- key ok"
- Summary line: "3 providers (7 keys), 3 passed, 1 failed, 1 warning"
- --json flag for CI, --verbose flag for detail
- Spinner per provider during parallel execution
- Parallel providers, sequential keys within provider

**Test Call Design:**

- Minimal ping: "Respond with the word ok." maxTokens: 5
- Both generateText AND streamText tested per key
- One model per provider, all keys tested with real API calls
- 10-second timeout, configurable via --timeout
- Reuse createRouter() for setup, then test directly through provider adapters
- Exclude from usage tracking
- --dry-run mode validates everything except real API calls

**CLI Interface & Flags:**

- `npx pennyllm validate` with 'pennyllm' as bin entry
- No subcommand shows help
- Per-subcommand --help
- No CLI framework -- use Node.js built-in parseArgs from node:util
- Config discovery: --config flag > PENNYLLM_CONFIG env > auto-discover pennyllm.config.{ts,js,json,yaml,yml}
- TypeScript config via jiti
- --provider flag (multiple allowed), --timeout flag, --version flag
- Exit codes: 0/1/2
- Separate build entry: src/cli/index.ts -> dist/cli.mjs with shebang
- src/cli/ directory: index.ts, validate.ts, format.ts

**Error Handling:**

- 429 = warning (key valid, rate limited)
- Timeout = warning
- 401/403 = failure with provider-specific guidance URL
- Missing SDK = failure with install command
- No config = helpful error listing searched locations
- Config validation errors surface createRouter() ConfigError as-is

### Claude's Discretion

- Table rendering: manual string formatting vs lightweight lib like cli-table3
- Spinner library: ora, nanospinner, or manual
- jiti vs tsx for TypeScript config loading
- How to create provider instances directly for test calls (bypassing chain proxy)
- Exact JSON output schema shape
- How to detect and report "same account" key issues during validation
- Config auto-discovery implementation details
- Whether to add a --no-stream flag to skip streaming tests

### Deferred Ideas (OUT OF SCOPE)

None -- discussion stayed within phase scope
</user_constraints>

## Standard Stack

### Core

| Library                 | Version                      | Purpose                        | Why Standard                                                                                                                                                        |
| ----------------------- | ---------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `node:util` (parseArgs) | Built-in (Node 18.3+)        | CLI argument parsing           | Zero dependencies, sufficient for ~6 flags, project requires Node >= 18                                                                                             |
| `jiti`                  | ^2.6.1                       | TypeScript config file loading | 23M weekly downloads, used by Vitest/Tailwind/ESLint/Docusaurus for .ts config loading. Lighter than tsx (full runner). Single purpose: transform + execute TS/ESM. |
| `nanospinner`           | ^1.2.2                       | Terminal spinner/progress      | 354K weekly downloads, 20KB total (15x smaller than ora), single dep (picocolors), CJS+ESM+TypeScript types                                                         |
| `picocolors`            | (transitive via nanospinner) | Terminal colors                | Zero-dep, 3.5KB, faster than chalk, already transitive                                                                                                              |

### Supporting

| Library           | Version | Purpose | When to Use                                                           |
| ----------------- | ------- | ------- | --------------------------------------------------------------------- |
| (none additional) |         |         | All other needs met by Node built-ins and existing pennyllm internals |

### Alternatives Considered

| Instead of    | Could Use           | Tradeoff                                                                                                                |
| ------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `jiti`        | `tsx`               | tsx is a full TS runner (heavier). jiti is purpose-built for loading single files. jiti is what Vitest/Tailwind use.    |
| `nanospinner` | `ora`               | ora is 280KB vs nanospinner's 20KB. nanospinner API is simpler. Both work.                                              |
| Manual ANSI   | `cli-table3`        | cli-table3 adds ~50KB dep for a fixed 7-column table. Manual padding with `String.padEnd()` is trivial for this layout. |
| `parseArgs`   | `commander`/`yargs` | Overkill for one command with ~6 flags. parseArgs is zero-dep and built-in.                                             |

### Discretion Recommendations

**Table rendering: Manual string formatting.** The table has fixed columns (Provider, Keys, Model, Tier, Status, Latency, Message). `String.padEnd()` with ANSI color wrapping is trivial. No library needed.

**Spinner: nanospinner.** 15x smaller than ora, TypeScript types included, simple API (`createSpinner().start()/.success()/.error()`). Picocolors (its only dep) handles NO_COLOR and TTY detection.

**Config loading: jiti.** Purpose-built for loading TypeScript config files at runtime. Same pattern used by Vitest, Tailwind CSS, Docusaurus. Lighter than tsx which is a full runner. jiti 2.x supports Node >= 20 for global hooks but falls back gracefully for Node 18 (uses esbuild-based transform).

**Installation:**

```bash
npm install jiti nanospinner
```

These are runtime dependencies (not devDependencies) since the CLI ships as part of the package.

## Architecture Patterns

### Project Structure

```
src/cli/
  index.ts       # Entry point: shebang, parseArgs, subcommand dispatch
  validate.ts    # Validation orchestration: config loading, provider testing, result collection
  format.ts      # Output formatters: table renderer, JSON serializer, summary line
```

### Pattern 1: Subcommand Dispatch via parseArgs

**What:** Parse first positional as subcommand, then re-parse remaining args with subcommand-specific options.
**When to use:** Entry point (`src/cli/index.ts`).
**Example:**

```typescript
#!/usr/bin/env node
import { parseArgs } from 'node:util';

// First pass: extract subcommand
const { positionals, values: globalValues } = parseArgs({
  options: {
    help: { type: 'boolean', short: 'h', default: false },
    version: { type: 'boolean', short: 'v', default: false },
  },
  allowPositionals: true,
  strict: false, // Allow subcommand-specific flags to pass through
});

const subcommand = positionals[0];

if (globalValues.version) {
  // Read version from package.json (bundled or import)
  console.log(version);
  process.exit(0);
}

if (!subcommand || globalValues.help) {
  printHelp();
  process.exit(0);
}

if (subcommand === 'validate') {
  // Re-parse with validate-specific options
  const { values } = parseArgs({
    args: process.argv.slice(3), // Skip node, script, 'validate'
    options: {
      config: { type: 'string', short: 'c' },
      provider: { type: 'string', multiple: true },
      timeout: { type: 'string', short: 't' },
      json: { type: 'boolean', default: false },
      verbose: { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  await runValidate(values);
}
```

### Pattern 2: Provider Test via createFactory() Directly

**What:** Use provider module's `createFactory()` to get a model instance, then call AI SDK's `generateText`/`streamText` directly -- bypassing createRouter() chain/retry/middleware.
**When to use:** Validation test calls.
**Why:** createRouter() does full chain setup, catalog refresh, cooldown loading -- heavy for a validation ping. Instead, use createRouter() only for config validation (or do schema-level validation manually), then test providers individually via their modules.

**Revised approach (per CONTEXT.md "Reuse createRouter() for setup"):** Actually, the user decision says to use createRouter() for setup (config validation, chain building, provider SDK loading), then make test calls directly through provider adapters. This means:

1. Call createRouter() to validate config and build chain
2. Extract chain entries and provider configs from the router
3. For each provider, call `getProviderModule(providerId).createFactory(apiKey)` to get a model factory
4. Use `generateText()` and `streamText()` from the `ai` SDK with the created model instance

```typescript
import { generateText, streamText } from 'ai';
import { getProviderModule } from '../providers/registry.js';

async function testProviderKey(
  providerId: string,
  apiModelId: string,
  apiKey: string,
  timeoutMs: number,
): Promise<TestResult> {
  const mod = getProviderModule(providerId);
  if (!mod) {
    return { status: 'fail', message: `No provider module for '${providerId}'` };
  }

  // Create model instance directly
  const factory = await mod.createFactory(apiKey);
  const model = factory(apiModelId);

  // Test generateText
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const start = Date.now();
    const { text } = await generateText({
      model,
      prompt: 'Respond with the word ok.',
      maxTokens: 5,
      abortSignal: controller.signal,
    });
    const latency = Date.now() - start;
    clearTimeout(timer);
    if (!text || text.trim().length === 0) {
      return { status: 'fail', message: 'Empty response', latencyMs: latency };
    }
    return { status: 'pass', latencyMs: latency };
  } catch (err) {
    clearTimeout(timer);
    // classifyError for categorization
    return classifyTestError(err);
  }
}
```

### Pattern 3: Config Auto-Discovery

**What:** Search for config files in cwd and parent directories.
**When to use:** When no --config flag or PENNYLLM_CONFIG env is provided.

```typescript
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const CONFIG_NAMES = [
  'pennyllm.config.ts',
  'pennyllm.config.js',
  'pennyllm.config.json',
  'pennyllm.config.yaml',
  'pennyllm.config.yml',
];

function discoverConfig(startDir: string = process.cwd()): string | null {
  let dir = startDir;
  const root = dirname(dir) === dir; // filesystem root check
  const maxDepth = 5; // Don't traverse too far
  let depth = 0;

  while (depth < maxDepth) {
    for (const name of CONFIG_NAMES) {
      const candidate = resolve(dir, name);
      if (existsSync(candidate)) return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir) break; // reached filesystem root
    dir = parent;
    depth++;
  }
  return null;
}
```

### Pattern 4: TypeScript Config Loading with jiti

**What:** Load .ts config files using jiti for runtime TypeScript execution.

```typescript
import { createJiti } from 'jiti';

async function loadTsConfig(filePath: string): Promise<unknown> {
  const jiti = createJiti(import.meta.url);
  const mod = await jiti.import(filePath);
  // Handle both default export and named defineConfig export
  return (mod as { default?: unknown }).default ?? mod;
}
```

### Pattern 5: Parallel Providers, Sequential Keys

**What:** Run all providers concurrently via Promise.allSettled, but test keys within each provider sequentially.

```typescript
// All providers in parallel
const results = await Promise.allSettled(
  providers.map(async (provider) => {
    const keyResults: KeyResult[] = [];
    // Keys sequential within provider
    for (const [keyIndex, keyConfig] of provider.keys.entries()) {
      const result = await testKey(provider.id, keyConfig, keyIndex);
      keyResults.push(result);
    }
    return { provider: provider.id, keyResults };
  }),
);
```

### Anti-Patterns to Avoid

- **Using createRouter() for test calls:** createRouter() builds the full chain proxy with middleware, retry logic, usage tracking. Validation should bypass all of that and call provider SDKs directly.
- **Testing all models:** Only test one model per provider to minimize rate limit impact. The chain shows all entries but only the tested one gets a real call.
- **Synchronous provider testing:** Providers are independent -- always test in parallel. Only keys within a provider need sequential execution.
- **Crashing on missing SDK:** Missing optional peer deps should produce a clear failure row, not crash the entire validator.

## Don't Hand-Roll

| Problem                   | Don't Build                           | Use Instead                        | Why                                                                                                   |
| ------------------------- | ------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------- |
| TypeScript config loading | Custom esbuild/swc transform pipeline | `jiti`                             | TS config loading has many edge cases (paths, decorators, ESM/CJS interop). jiti handles all of them. |
| Terminal colors           | ANSI escape code strings              | `picocolors` (via nanospinner)     | NO_COLOR env var, TTY detection, Windows terminal compat -- all handled.                              |
| Spinner animation         | setInterval + cursor manipulation     | `nanospinner`                      | Handles terminal cleanup, SIGINT, non-TTY detection, spinner frame rendering.                         |
| Abort/timeout             | Manual Promise.race                   | `AbortController` + `abortSignal`  | AI SDK's generateText/streamText accept `abortSignal` natively. Use it with setTimeout.               |
| Config file parsing       | Custom YAML/JSON detection            | Extend existing `loadConfigFile()` | Already handles JSON/YAML with env var interpolation. Just add .ts support via jiti.                  |

## Common Pitfalls

### Pitfall 1: tsup Banner for Shebang

**What goes wrong:** CLI entry point needs `#!/usr/bin/env node` shebang but tsup strips it or doesn't add it.
**Why it happens:** tsup only auto-preserves shebangs from source files if they're at the top of the file.
**How to avoid:** Use tsup's `banner` option to prepend the shebang to the CLI entry point specifically. Or include shebang in source file -- tsup preserves it automatically.
**Warning signs:** `npx pennyllm` fails with "cannot execute" or shows raw JS instead of running.

### Pitfall 2: parseArgs strict Mode with Subcommands

**What goes wrong:** `strict: true` (default) throws on unknown flags, but subcommand-specific flags are "unknown" at the global parse level.
**Why it happens:** parseArgs validates all args in one pass.
**How to avoid:** Use `strict: false` for the initial global parse (to allow subcommand flags to pass through), then `strict: true` for the subcommand-specific parse with the correct slice of args.

### Pitfall 3: AbortController Cleanup

**What goes wrong:** Timeout timers fire after test completes, causing unhandled errors or process hanging.
**Why it happens:** setTimeout continues running even after the API call resolves.
**How to avoid:** Always `clearTimeout()` in both success and error paths. Use try/finally.

### Pitfall 4: Spinner + JSON Output Conflict

**What goes wrong:** Spinners write ANSI sequences to stdout, corrupting JSON output.
**Why it happens:** --json flag should suppress all non-JSON output.
**How to avoid:** Check for --json before creating spinners. When --json is active, skip all progress indicators and only output the final JSON blob.

### Pitfall 5: jiti Requires Node >= 20 for Hooks

**What goes wrong:** jiti 2.x uses Node.js module hooks (register()) which require Node >= 20.
**Why it happens:** The project targets Node >= 18.
**How to avoid:** jiti falls back to legacy CJS transform for Node < 20. This works but may have edge cases with pure ESM packages. Test on Node 18 to confirm. Alternatively, use `jiti.import()` (async) which works on all supported Node versions.

### Pitfall 6: Process Exit Before Async Cleanup

**What goes wrong:** `process.exit(1)` kills the process before router.close() or spinner cleanup runs.
**Why it happens:** Eager exit code setting.
**How to avoid:** Set exit code via `process.exitCode = 1` and let the event loop drain naturally, or ensure cleanup completes before calling `process.exit()`.

### Pitfall 7: Streaming Test Timeout Handling

**What goes wrong:** `streamText()` returns a stream object immediately; the actual API call happens when you consume the stream. Timeout needs to cover consumption, not just the call.
**Why it happens:** Streaming is lazy -- the response object is returned before data arrives.
**How to avoid:** Use `abortSignal` with the streamText call. Then consume the stream (e.g., `for await (const chunk of result.textStream)`) and the abort will propagate correctly.

### Pitfall 8: exactOptionalPropertyTypes in CLI Code

**What goes wrong:** Building objects with optional fields fails TypeScript compilation.
**Why it happens:** Project uses `exactOptionalPropertyTypes` -- can't assign `undefined` to optional fields.
**How to avoid:** Use conditional property construction: `if (value !== undefined) obj.field = value`. Established pattern throughout the codebase.

## Code Examples

### generateText with AbortSignal (Verified from AI SDK docs)

```typescript
import { generateText } from 'ai';

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 10_000);

try {
  const { text, usage } = await generateText({
    model,
    prompt: 'Respond with the word ok.',
    maxTokens: 5,
    abortSignal: controller.signal,
  });
  clearTimeout(timeout);
  return { text, tokens: usage?.totalTokens };
} catch (err) {
  clearTimeout(timeout);
  if (err instanceof Error && err.name === 'AbortError') {
    return { status: 'warning', message: 'Timeout' };
  }
  throw err;
}
```

### streamText Consumption for Validation

```typescript
import { streamText } from 'ai';

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 10_000);

try {
  const result = streamText({
    model,
    prompt: 'Respond with the word ok.',
    maxTokens: 5,
    abortSignal: controller.signal,
  });
  // Must consume stream to verify it works
  let text = '';
  for await (const chunk of result.textStream) {
    text += chunk;
  }
  clearTimeout(timeout);
  return { text, status: text.trim().length > 0 ? 'pass' : 'fail' };
} catch (err) {
  clearTimeout(timeout);
  // Handle abort, classify error, etc.
}
```

### nanospinner Usage

```typescript
import { createSpinner } from 'nanospinner';

const spinner = createSpinner('Testing cerebras...').start();
// ... async work ...
spinner.success({ text: 'cerebras: OK (1.2s)' });
// or
spinner.error({ text: 'cerebras: FAIL (401 Unauthorized)' });
```

### tsup Config for CLI Entry Point

```typescript
// In tsup.config.ts, add CLI entry with shebang banner
import { defineConfig } from 'tsup';

export default defineConfig([
  {
    // Library entries (existing)
    entry: ['src/index.ts' /* ... other entries ... */],
    format: ['esm', 'cjs'],
    dts: true,
    // ... existing config
  },
  {
    // CLI entry (new)
    entry: { cli: 'src/cli/index.ts' },
    format: ['esm'],
    dts: false,
    banner: { js: '#!/usr/bin/env node' },
    outDir: 'dist',
    outExtension: () => ({ js: '.mjs' }),
    // No CJS needed for CLI, no DTS needed
  },
]);
```

Note: tsup supports array config for multiple build targets. The CLI needs only ESM output with shebang.

### Package.json bin Entry

```json
{
  "bin": {
    "pennyllm": "./dist/cli.mjs"
  }
}
```

## State of the Art

| Old Approach              | Current Approach      | When Changed     | Impact                                                    |
| ------------------------- | --------------------- | ---------------- | --------------------------------------------------------- |
| commander/yargs for CLI   | `node:util` parseArgs | Node 18.3 (2022) | Zero-dep CLI arg parsing for simple tools                 |
| chalk for colors          | picocolors            | 2022+            | 3.5KB vs 44KB, faster, NO_COLOR support                   |
| ora for spinners          | nanospinner           | 2022+            | 20KB vs 280KB, same API surface                           |
| tsx/ts-node for TS config | jiti                  | 2024+            | Purpose-built for config loading, used by Vitest/Tailwind |

## Open Questions

1. **Same-account key detection**
   - What we know: Two keys from the same account may share rate limits, making key rotation useless
   - What's unclear: No standard way to detect this. Could compare rate limit header values after calls.
   - Recommendation: Defer to future enhancement. For now, note in verbose output if multiple keys hit rate limits simultaneously.

2. **--no-stream flag**
   - What we know: User mentioned as discretion item. Some providers may have streaming issues.
   - What's unclear: Whether this is worth the flag complexity.
   - Recommendation: Skip for now. Both generateText and streamText are tested. If streaming consistently fails for a provider, that's useful diagnostic info.

3. **jiti on Node 18**
   - What we know: jiti 2.x prefers Node >= 20 for hooks. Falls back to legacy transform on 18.
   - What's unclear: Whether all .ts config patterns work correctly on Node 18 with legacy transform.
   - Recommendation: Use `jiti.import()` (async API) which works on all Node versions. The CLI is inherently async anyway.

## Validation Architecture

### Test Framework

| Property           | Value                           |
| ------------------ | ------------------------------- |
| Framework          | vitest 2.1.8                    |
| Config file        | vitest via package.json scripts |
| Quick run command  | `npx vitest run`                |
| Full suite command | `npx vitest run`                |

### Phase Requirements -> Test Map

This phase has no explicit requirement IDs assigned (null in phase description). The success criteria are integration/E2E in nature -- they require real API calls and can't be meaningfully unit tested without extensive mocking, which goes against the project's "build first, test later" philosophy.

| Criterion | Behavior                                    | Test Type    | Automated Command                                         | File Exists? |
| --------- | ------------------------------------------- | ------------ | --------------------------------------------------------- | ------------ |
| SC-1      | CLI reads config, tests each provider+model | E2E / manual | `npx pennyllm validate --config test-fixtures/valid.json` | Wave 0       |
| SC-2      | Reports key valid, model exists, latency    | E2E / manual | Manual verification of output format                      | N/A          |
| SC-3      | Actionable error messages                   | E2E / manual | Test with invalid key                                     | N/A          |
| SC-4      | CI-friendly exit codes                      | unit         | `npx vitest run tests/cli/`                               | Wave 0       |
| SC-5      | Lightweight calls (1 per model)             | Code review  | Verify maxTokens: 5 in test prompt                        | N/A          |

### Sampling Rate

- **Per task commit:** `tsc --noEmit && npm run build`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Build succeeds + manual `npx pennyllm validate` test

### Wave 0 Gaps

- [ ] tsup config updated with CLI entry point
- [ ] package.json bin entry added
- [ ] Verify `jiti` and `nanospinner` installed as dependencies

## Sources

### Primary (HIGH confidence)

- Node.js v25 docs -- `util.parseArgs()` API reference
- Existing codebase: `src/providers/*.ts`, `src/config/loader.ts`, `src/wrapper/error-classifier.ts`
- Existing E2E test: `scripts/e2e-test.ts` -- established pattern for real API calls

### Secondary (MEDIUM confidence)

- [jiti npm](https://www.npmjs.com/package/jiti) -- v2.6.1, runtime TS/ESM support
- [nanospinner npm](https://www.npmjs.com/nanospinner) -- v1.2.2, 20KB terminal spinner
- [tsup shebang/banner handling](https://github.com/egoist/tsup/issues/684) -- tsup preserves source shebangs or use banner option
- [jiti GitHub](https://github.com/unjs/jiti) -- API docs for createJiti and import()

### Tertiary (LOW confidence)

- None -- all findings verified against official sources or codebase inspection

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH -- all libraries are well-established, verified via npm and docs
- Architecture: HIGH -- patterns derived from existing codebase (e2e-test.ts, provider modules, config loader)
- Pitfalls: HIGH -- identified from direct code inspection and known TypeScript strictness issues in this project

**Research date:** 2026-03-18
**Valid until:** 2026-04-18 (stable domain, no fast-moving dependencies)
