# Phase 22: Async Model Wrapping - Research

**Researched:** 2026-03-19
**Domain:** Internal async/sync provider registry mismatch
**Confidence:** HIGH

## Summary

Phase 19-02 converted all provider registrations in `createDefault()` from sync `register()` to async `registerAsync()`. This means the sync `factories` map is always empty. Two call sites still use the sync `createProviderInstance` function: `router.wrapModel()` in `src/config/index.ts:365` and `routerModel()` in `src/wrapper/router-model.ts:34`. Both throw `ConfigError` at runtime because `registry.get()` returns `undefined`.

The fix pattern already exists in the codebase: `retry-proxy.ts` (Phase 17-02) calls `createProviderInstanceAsync` which tries the async factory first, then falls back to sync. Both broken call sites need the same change: replace `createProviderInstance` with `createProviderInstanceAsync` and `await` the result.

**Primary recommendation:** Replace `createProviderInstance` with `createProviderInstanceAsync` at both call sites. Both functions are already async, so adding `await` is trivial.

<phase_requirements>

## Phase Requirements

| ID      | Description                                                                                      | Research Support                                                                                                        |
| ------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| WRAP-01 | `router.wrapModel()` resolves models via async provider registry (no ConfigError)                | Line 365 of `src/config/index.ts` calls sync `createProviderInstance` -- change to `createProviderInstanceAsync`        |
| WRAP-02 | `routerModel()` standalone function resolves models via async provider registry (no ConfigError) | Line 34 of `src/wrapper/router-model.ts` calls sync `createProviderInstance` -- change to `createProviderInstanceAsync` |

</phase_requirements>

## Standard Stack

No new libraries needed. This is a two-line fix within existing code.

### Core

| Library | Version | Purpose                | Why Standard        |
| ------- | ------- | ---------------------- | ------------------- |
| (none)  | -       | Internal refactor only | No new dependencies |

## Architecture Patterns

### Pattern 1: Async Provider Instance Creation

**What:** `createProviderInstanceAsync` checks async factories first, falls back to sync.
**When to use:** Any time a provider instance needs to be created from the registry.
**Already used in:** `retry-proxy.ts:432` (Phase 17-02 fix)

```typescript
// Source: src/wrapper/provider-registry.ts:87-100
export async function createProviderInstanceAsync(
  registry: ProviderRegistry,
  provider: string,
  modelName: string,
  apiKey: string,
): Promise<LanguageModelV3> {
  const asyncFactory = registry.getAsync(provider);
  if (asyncFactory) {
    const factory = await asyncFactory(apiKey);
    return factory(modelName);
  }
  // Fall back to sync factory
  return createProviderInstance(registry, provider, modelName, apiKey);
}
```

### Anti-Patterns to Avoid

- **Calling sync `createProviderInstance` when async factories are the only registration path:** This is the exact bug being fixed. After Phase 19-02, `createDefault()` only populates async factories.

## Don't Hand-Roll

| Problem                | Don't Build                       | Use Instead                   | Why                                |
| ---------------------- | --------------------------------- | ----------------------------- | ---------------------------------- |
| Async-to-sync bridging | Sync wrapper around async factory | `createProviderInstanceAsync` | Already exists, handles both paths |

## Common Pitfalls

### Pitfall 1: Forgetting to Update the Import

**What goes wrong:** Changing the function call but not updating the import statement
**Why it happens:** Both functions are exported from the same module
**How to avoid:** Update the import line in both files to import `createProviderInstanceAsync` instead of (or in addition to) `createProviderInstance`
**Warning signs:** TypeScript will catch this at compile time

### Pitfall 2: Not Awaiting the Async Call

**What goes wrong:** Passing a `Promise<LanguageModelV3>` where `LanguageModelV3` is expected
**Why it happens:** The old sync call didn't need `await`
**How to avoid:** Both `wrapModel` and `routerModel` are already `async` functions, so just add `await`
**Warning signs:** TypeScript will catch the type mismatch

### Pitfall 3: Leaving Dead Import of Sync Function

**What goes wrong:** `createProviderInstance` import remains unused in `src/config/index.ts` and `src/wrapper/router-model.ts`
**Why it happens:** Only the call site is changed, not the import
**How to avoid:** Check if `createProviderInstance` is still used elsewhere in each file. In `config/index.ts` it is NOT used anywhere else. In `router-model.ts` it is NOT used anywhere else. Remove from both imports.

## Code Examples

### Fix for WRAP-01: `router.wrapModel()` in `src/config/index.ts`

**Current (broken):**

```typescript
// Line 23: import
import { ProviderRegistry, createProviderInstance } from '../wrapper/provider-registry.js';
// Line 365: call
const baseModel = createProviderInstance(registry, provider, modelName, selection.key);
```

**Fixed:**

```typescript
// Line 23: import -- replace createProviderInstance with createProviderInstanceAsync
import { ProviderRegistry, createProviderInstanceAsync } from '../wrapper/provider-registry.js';
// Line 365: call -- add await
const baseModel = await createProviderInstanceAsync(registry, provider, modelName, selection.key);
```

### Fix for WRAP-02: `routerModel()` in `src/wrapper/router-model.ts`

**Current (broken):**

```typescript
// Line 4: import
import { ProviderRegistry, createProviderInstance } from './provider-registry.js';
// Line 34: call
const baseModel = createProviderInstance(registry, provider, modelName, selection.key);
```

**Fixed:**

```typescript
// Line 4: import -- replace createProviderInstance with createProviderInstanceAsync
import { ProviderRegistry, createProviderInstanceAsync } from './provider-registry.js';
// Line 34: call -- add await
const baseModel = await createProviderInstanceAsync(registry, provider, modelName, selection.key);
```

### Verify: Check if `createProviderInstance` Export Can Be Removed

After fixing both call sites, the only remaining caller of sync `createProviderInstance` is inside `createProviderInstanceAsync` itself (as a fallback). The export in `src/wrapper/index.ts:8` still re-exports it. Since this is a public API, the export should remain (consumers may register sync factories). No change needed to the barrel export.

## State of the Art

| Old Approach                                 | Current Approach                                        | When Changed | Impact                                           |
| -------------------------------------------- | ------------------------------------------------------- | ------------ | ------------------------------------------------ |
| Sync `register()` + `createProviderInstance` | Async `registerAsync()` + `createProviderInstanceAsync` | Phase 19-02  | All provider creation must go through async path |

## Open Questions

None. This is a straightforward two-site fix with a proven pattern already in the codebase.

## Validation Architecture

### Test Framework

| Property           | Value                                                         |
| ------------------ | ------------------------------------------------------------- |
| Framework          | vitest (project has vitest config)                            |
| Config file        | vitest.config.ts                                              |
| Quick run command  | `npx tsc --noEmit` (per CLAUDE.md: build check is sufficient) |
| Full suite command | `npx vitest run`                                              |

### Phase Requirements to Test Map

| Req ID  | Behavior                                          | Test Type      | Automated Command               | File Exists?                                             |
| ------- | ------------------------------------------------- | -------------- | ------------------------------- | -------------------------------------------------------- |
| WRAP-01 | `router.wrapModel()` resolves without ConfigError | smoke / manual | `npx tsc --noEmit` (type check) | N/A -- CLAUDE.md says no test files unless plan requires |
| WRAP-02 | `routerModel()` resolves without ConfigError      | smoke / manual | `npx tsc --noEmit` (type check) | N/A -- CLAUDE.md says no test files unless plan requires |

### Sampling Rate

- **Per task commit:** `npx tsc --noEmit`
- **Per wave merge:** `npx tsc --noEmit`
- **Phase gate:** `tsc --noEmit` passes, both call sites use `createProviderInstanceAsync`

### Wave 0 Gaps

None -- existing build infrastructure covers all phase requirements. Per CLAUDE.md, no test files are needed for this fix phase.

## Sources

### Primary (HIGH confidence)

- Direct code inspection of `src/wrapper/provider-registry.ts` -- both sync and async paths verified
- Direct code inspection of `src/config/index.ts:365` -- confirmed sync call is the bug
- Direct code inspection of `src/wrapper/router-model.ts:34` -- confirmed sync call is the bug
- Direct code inspection of `src/wrapper/retry-proxy.ts:7,432` -- confirmed working async pattern
- `.planning/v2.1-MILESTONE-AUDIT.md` -- audit identified this exact gap

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - no new libraries, internal change only
- Architecture: HIGH - proven pattern exists in retry-proxy.ts
- Pitfalls: HIGH - straightforward import/await changes, TypeScript catches mistakes

**Research date:** 2026-03-19
**Valid until:** N/A (internal codebase fix, not dependent on external library versions)
