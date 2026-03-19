# Phase 19: Provider Cleanup - Research

**Researched:** 2026-03-19
**Domain:** TypeScript module cleanup, dead code removal, type hygiene
**Confidence:** HIGH

## Summary

Phase 19 is a surgical cleanup phase -- removing dead provider code, trimming the `ProviderType` union, fixing an env var mismatch in NVIDIA docs, and expanding `createDefault()` to register all 6 active providers. The codebase is well-structured with clear boundaries, making this a low-risk, high-confidence operation.

The work touches 6 files primarily: `src/providers/github-models.ts` (delete), `src/providers/index.ts` (remove export), `src/constants/index.ts` (trim Provider enum), `src/types/providers.ts` (remove 7 dropped types + fix NVIDIA env var), `src/types/index.ts` (remove re-exports), `src/index.ts` (remove public exports), and `src/wrapper/provider-registry.ts` (expand `createDefault()`).

**Primary recommendation:** Execute as a single plan with two waves: Wave 1 removes dead code, Wave 2 fixes `createDefault()` and the NVIDIA env var. Verify with `tsc --noEmit` after each wave.

<phase_requirements>

## Phase Requirements

| ID      | Description                                                              | Research Support                                                                                                                                                                                                                                                                            |
| ------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PROV-01 | `github-models.ts` deleted, export removed from `src/providers/index.ts` | File identified at `src/providers/github-models.ts`, export on line 10 of index.ts. Also referenced in `src/catalog/static-catalog.json` line 6246 (catalog entry -- out of scope, optional cleanup).                                                                                       |
| PROV-02 | 7 dropped provider config types removed from public exports              | Types in `src/types/providers.ts`: OpenRouterProviderConfig, HuggingFaceProviderConfig, DeepSeekProviderConfig, QwenProviderConfig, CloudflareProviderConfig, CohereProviderConfig, GitHubProviderConfig. Re-exported in `src/types/index.ts` lines 85-94 and `src/index.ts` lines 114-138. |
| PROV-03 | 7 legacy Provider enum values removed from `ProviderType` union          | In `src/constants/index.ts` lines 23-29: GITHUB, OPENROUTER, HUGGINGFACE, DEEPSEEK, QWEN, CLOUDFLARE, COHERE.                                                                                                                                                                               |
| PROV-04 | NVIDIA env var consistent (`NVIDIA_API_KEY`) across module and type docs | Module (`src/providers/nvidia-nim.ts` line 71) uses `NVIDIA_API_KEY`. Type doc (`src/types/providers.ts` line 137) says `NIM_API_KEY`. Fix type doc to match module.                                                                                                                        |
| PROV-05 | `ProviderRegistry.createDefault()` loads all 6 active providers          | Currently only loads `@ai-sdk/google` (lines 69-82 of `src/wrapper/provider-registry.ts`). Must add cerebras, groq, sambanova, nvidia-nim, mistral using async factory pattern from provider modules.                                                                                       |

</phase_requirements>

## Standard Stack

No new libraries needed. This phase only modifies existing TypeScript source files.

### Core

| Library    | Version           | Purpose       | Why Standard                            |
| ---------- | ----------------- | ------------- | --------------------------------------- |
| TypeScript | (project version) | Type checking | `tsc --noEmit` is the verification tool |

## Architecture Patterns

### Current Provider Architecture

```
src/providers/
  types.ts          # ProviderModule interface
  registry.ts       # ALL_PROVIDERS array, getProviderModule()
  index.ts          # Public re-exports
  cerebras.ts       # Active
  google.ts         # Active
  groq.ts           # Active
  sambanova.ts      # Active
  nvidia-nim.ts     # Active
  mistral.ts        # Active
  github-models.ts  # DEAD -- delete

src/constants/index.ts   # Provider enum with 7 legacy values
src/types/providers.ts   # Provider config types (7 dead)
src/types/index.ts       # Re-exports dead types
src/index.ts             # Public API exports dead types

src/wrapper/provider-registry.ts  # createDefault() only loads google
```

### Pattern: Provider Module Registration

The codebase has TWO registration paths:

1. **`createRouter()` path** (config/index.ts line 248-255): Iterates configured provider IDs, calls `getProviderModule()`, registers via `registerAsync()`. This already works correctly for all 6 providers.
2. **`createDefault()` path** (wrapper/provider-registry.ts line 69): Static method for standalone use (e.g., `routerModel()`). Currently only loads Google. This is what PROV-05 targets.

### Pattern: createDefault() Should Mirror Provider Modules

The fix for PROV-05 should use the same provider module pattern as `createRouter()`:

```typescript
static async createDefault(): Promise<ProviderRegistry> {
  const registry = new ProviderRegistry();
  const { getAllProviders } = await import('../providers/registry.js');
  for (const mod of getAllProviders()) {
    registry.registerAsync(mod.id, mod.createFactory.bind(mod));
  }
  return registry;
}
```

This avoids duplicating provider-specific import logic and stays DRY with registry.ts.

### Anti-Patterns to Avoid

- **Leaving dead imports**: After deleting `github-models.ts`, ensure no file still imports from it. Grep confirmed only `src/providers/index.ts` line 10 imports it.
- **Partial removal**: All 7 dropped types must be removed from ALL three export layers (`types/providers.ts` definitions, `types/index.ts` re-exports, `index.ts` public exports).
- **Breaking the catalog**: `static-catalog.json` references `github-models` as a provider entry (line 6246). This is catalog data, NOT code. The catalog is an optional enrichment source and references many providers PennyLLM does not support. Leave it alone.
- **Breaking OpenRouter catalog fetcher**: `src/catalog/fetchers.ts` has `fetchOpenRouter()` used by `DefaultModelCatalog.refresh()`. This is catalog infrastructure, NOT a provider module. It should NOT be removed in this phase -- it fetches model metadata from OpenRouter's public API regardless of whether OpenRouter is an active provider.

## Don't Hand-Roll

| Problem                                  | Don't Build                          | Use Instead                                                           | Why                                          |
| ---------------------------------------- | ------------------------------------ | --------------------------------------------------------------------- | -------------------------------------------- |
| Provider registration in createDefault() | Manual try/catch for each SDK import | Import from `providers/registry.ts` and loop over `getAllProviders()` | DRY, auto-picks up future provider additions |

## Common Pitfalls

### Pitfall 1: Removing OpenRouter catalog fetcher by mistake

**What goes wrong:** The catalog fetcher (`fetchOpenRouter()` in `src/catalog/fetchers.ts`) uses OpenRouter as a DATA SOURCE for model metadata, not as a provider. Removing it breaks catalog refresh.
**How to avoid:** Only remove: provider enum values, config types, exports, and the github-models module file. Do NOT touch `src/catalog/`.

### Pitfall 2: createDefault() importing SDK packages directly

**What goes wrong:** Each provider SDK is an optional peer dependency. Importing `@ai-sdk/cerebras` directly in `createDefault()` would fail if it's not installed.
**How to avoid:** Use provider modules from `src/providers/registry.ts` which already handle missing SDK packages gracefully (try/catch with ConfigError).

### Pitfall 3: Forgetting define-config.ts JSDoc

**What goes wrong:** `src/config/define-config.ts` line 13 references `openrouter` in a JSDoc comment. Not a breaking issue but stale documentation.
**How to avoid:** Update the comment to list only active providers.

### Pitfall 4: Static catalog has dropped provider entries

**What goes wrong:** `static-catalog.json` has entries for github-models, cohere, deepseek, cloudflare, openrouter, etc. Removing them would break catalog functionality.
**How to avoid:** The static catalog is a data snapshot from models.dev/OpenRouter. It contains ALL known models, not just supported providers. Leave it alone.

## Code Examples

### Removing github-models export from providers/index.ts

```typescript
// REMOVE these two lines:
// GitHub Models available but not in active registry -- import directly if needed
export { githubModelsProvider } from './github-models.js';
```

### Trimming Provider enum in constants/index.ts

```typescript
export const Provider = {
  CEREBRAS: 'cerebras',
  GOOGLE: 'google',
  GROQ: 'groq',
  SAMBANOVA: 'sambanova',
  NVIDIA: 'nvidia',
  MISTRAL: 'mistral',
} as const;
```

### Fixing createDefault() in provider-registry.ts

```typescript
static async createDefault(): Promise<ProviderRegistry> {
  const registry = new ProviderRegistry();

  // Register all active provider modules (handles missing SDKs gracefully)
  const { getAllProviders } = await import('../providers/registry.js');
  for (const mod of getAllProviders()) {
    registry.registerAsync(mod.id, mod.createFactory.bind(mod));
  }

  return registry;
}
```

### Fixing NVIDIA env var in types/providers.ts

```typescript
/**
 * NVIDIA NIM provider configuration.
 * ...
 * Env var: NVIDIA_API_KEY        // was: NIM_API_KEY
 * ...
 */
export type NvidiaProviderConfig = ProviderConfig;
```

### Cleaned types/providers.ts (keep only active 6)

```typescript
// KEEP: GoogleProviderConfig, GroqProviderConfig, MistralProviderConfig,
//       CerebrasProviderConfig, NvidiaProviderConfig
// ADD:  SambaNovaProviderConfig (new alias, satisfies TYPE-04 from Phase 20 -- but note TYPE-04 is Phase 20 scope, not Phase 19)
// REMOVE: OpenRouterProviderConfig, HuggingFaceProviderConfig, DeepSeekProviderConfig,
//         QwenProviderConfig, CloudflareProviderConfig, CohereProviderConfig, GitHubProviderConfig
```

## Files Changed Summary

| File                               | Action                                             | Requirement      |
| ---------------------------------- | -------------------------------------------------- | ---------------- |
| `src/providers/github-models.ts`   | DELETE                                             | PROV-01          |
| `src/providers/index.ts`           | Remove github-models export (lines 9-10)           | PROV-01          |
| `src/constants/index.ts`           | Remove 7 legacy enum values (lines 23-29)          | PROV-03          |
| `src/types/providers.ts`           | Remove 7 dead type aliases, fix NVIDIA env var doc | PROV-02, PROV-04 |
| `src/types/index.ts`               | Remove 7 dead re-exports (lines 85-94)             | PROV-02          |
| `src/index.ts`                     | Remove 7 dead public exports (lines 114-138 area)  | PROV-02          |
| `src/wrapper/provider-registry.ts` | Rewrite `createDefault()` to load all 6 providers  | PROV-05          |
| `src/config/define-config.ts`      | Update JSDoc comment (line 13)                     | Cleanup          |

## Open Questions

1. **SambaNovaProviderConfig type alias**
   - What we know: TYPE-04 in Phase 20 calls for adding it
   - What's unclear: Should we add it now while cleaning providers.ts, or leave for Phase 20?
   - Recommendation: Leave for Phase 20. Phase 19 requirements are PROV-01 through PROV-05 only.

## Validation Architecture

### Test Framework

| Property           | Value                                                |
| ------------------ | ---------------------------------------------------- |
| Framework          | vitest                                               |
| Config file        | vitest.config.ts (assumed from package.json scripts) |
| Quick run command  | `npx vitest run`                                     |
| Full suite command | `npx vitest run`                                     |

### Phase Requirements to Test Map

| Req ID  | Behavior                                          | Test Type | Automated Command                       | File Exists?                   |
| ------- | ------------------------------------------------- | --------- | --------------------------------------- | ------------------------------ |
| PROV-01 | github-models.ts deleted, no imports reference it | smoke     | `tsc --noEmit` (compile check)          | N/A -- verified by compilation |
| PROV-02 | Dropped provider types not in public exports      | smoke     | `tsc --noEmit`                          | N/A -- verified by compilation |
| PROV-03 | ProviderType has exactly 6 values                 | smoke     | `tsc --noEmit`                          | N/A -- verified by compilation |
| PROV-04 | NVIDIA env var matches                            | manual    | Visual inspection of types/providers.ts | N/A                            |
| PROV-05 | createDefault() loads all 6 providers             | unit      | `npx vitest run` (if test added)        | No test exists                 |

### Sampling Rate

- **Per task commit:** `npx tsc --noEmit` (compile check)
- **Per wave merge:** `npx vitest run`
- **Phase gate:** `tsc --noEmit` green + manual verification of success criteria

### Wave 0 Gaps

None critical. The primary validation for this phase is TypeScript compilation (`tsc --noEmit`), which requires no test infrastructure. Per CLAUDE.md, tests are deferred unless the plan explicitly requires them.

## Sources

### Primary (HIGH confidence)

- Direct code inspection of all files listed above
- `src/providers/registry.ts` -- confirmed ALL_PROVIDERS has exactly 6 entries (no github)
- `src/providers/index.ts` -- confirmed github-models still exported (line 10)
- `src/constants/index.ts` -- confirmed 7 legacy enum values (lines 23-29)
- `src/types/providers.ts` -- confirmed 7 dead types + NVIDIA env var says NIM_API_KEY (line 137)
- `src/wrapper/provider-registry.ts` -- confirmed createDefault() only loads google (lines 69-82)
- `src/index.ts` -- confirmed all 7 dead types in public exports

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - no new dependencies, pure code cleanup
- Architecture: HIGH - direct code inspection, clear module boundaries
- Pitfalls: HIGH - all edge cases identified through grep analysis

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable -- dead code doesn't change)
