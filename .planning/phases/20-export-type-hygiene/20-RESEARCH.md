# Phase 20: Export & Type Hygiene - Research

**Researched:** 2026-03-19
**Domain:** TypeScript module exports, type re-export patterns
**Confidence:** HIGH

## Summary

Phase 20 addresses five export/type hygiene issues in PennyLLM's public API surface. All five issues have been verified through direct code inspection with HIGH confidence. The problems are straightforward: duplicate type definitions, missing re-exports at various barrel layers, a missing provider config type alias, and a dead event hook.

The codebase uses a three-layer export pattern: source modules define types, `src/types/index.ts` acts as a type barrel, and `src/index.ts` is the root barrel. Several types fall through the cracks at one or both barrel layers. The `onFallbackTriggered` hook is wired up via `createHook` but the `fallback:triggered` event is never emitted anywhere in the codebase -- it is dead code.

**Primary recommendation:** Fix each issue surgically -- consolidate the duplicate `StructuredUsage` definition, add missing re-exports at both barrel layers, add the `SambaNovaProviderConfig` type alias, and either wire up `FALLBACK_TRIGGERED` emission in ChainExecutor or remove the hook and documentation.

<phase_requirements>

## Phase Requirements

| ID      | Description                                                       | Research Support                                                                                                                                                                                                                                                                                                              |
| ------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TYPE-01 | `StructuredUsage` exported from `pennyllm` and `pennyllm/types`   | Gap analysis shows it is missing from both `src/index.ts` and `src/types/index.ts`. Defined in `src/types/interfaces.ts` and `src/usage/types.ts` (duplicate).                                                                                                                                                                |
| TYPE-02 | All event types exported from root                                | 8 event types missing from `src/index.ts`: `ErrorAuthEvent`, `ErrorNetworkEvent`, `ErrorRateLimitEvent`, `ErrorServerEvent`, `KeyDisabledEvent`, `KeyRetriedEvent`, `RequestCompleteEvent`, `ProviderRecoveredEvent`. The first 7 are in `types/index.ts` but not root; `ProviderRecoveredEvent` is missing from both layers. |
| TYPE-03 | Duplicate `StructuredUsage` consolidated to single source         | Two identical definitions: `src/types/interfaces.ts:8` and `src/usage/types.ts:90`. Keep canonical in `src/types/interfaces.ts` (where `StorageBackend` references it), delete from `src/usage/types.ts`, update imports.                                                                                                     |
| TYPE-04 | `SambaNovaProviderConfig` type alias added                        | `src/types/providers.ts` has aliases for all 5 other providers but not SambaNova. Need to add `SambaNovaProviderConfig = ProviderConfig` plus re-export through both barrel layers.                                                                                                                                           |
| TYPE-05 | `onFallbackTriggered` either emits events or is removed from docs | Hook exists in Router interface (config/index.ts:98) and `createHook` wiring (config/index.ts:494). But `FALLBACK_TRIGGERED` event is never emitted -- zero `emit` calls for it anywhere in src/. The ChainExecutor emits `chain:resolved` but not `fallback:triggered`.                                                      |

</phase_requirements>

## Architecture Patterns

### Export Layer Structure (Current)

```
src/
├── types/
│   ├── interfaces.ts    # StructuredUsage (def 1), StorageBackend, ModelCatalog, SelectionStrategy
│   ├── domain.ts        # ModelMetadata, Policy, PolicyLimit, etc.
│   ├── config.ts        # RouterConfig, ProviderConfig, etc.
│   ├── events.ts        # All event interfaces (28+ types)
│   ├── providers.ts     # Provider config type aliases (5 of 6)
│   └── index.ts         # Barrel: re-exports from above + cross-module types
├── usage/
│   └── types.ts         # StructuredUsage (def 2, duplicate), KeyUsage, etc.
├── index.ts             # Root barrel: re-exports from types/index.ts + value exports
└── ...
```

### Pattern: Three-Layer Re-Export

Every public type must appear at all three layers:

1. **Source definition** (single canonical location)
2. **`src/types/index.ts`** barrel (for `pennyllm/types` subpath)
3. **`src/index.ts`** root barrel (for `pennyllm` main entry)

The `package.json` exports map confirms both subpaths:

- `"."` -> `dist/index.d.ts` (root)
- `"./types"` -> `dist/types/index.d.ts` (types subpath)

### Anti-Patterns to Avoid

- **Duplicate definitions:** Never define the same interface in two files. Use `import type` + re-export.
- **Partial re-export:** When adding a type to `types/index.ts`, also add to `src/index.ts`. Check both layers.

## Detailed Gap Analysis

### TYPE-01 + TYPE-03: StructuredUsage

**Current state:**

- Defined in `src/types/interfaces.ts:8-13` (used by `StorageBackend.getUsage()` return type)
- Defined again in `src/usage/types.ts:90-95` (identical fields)
- Exported from `src/usage/index.ts` (re-exports from `./types.js`)
- NOT exported from `src/types/index.ts`
- NOT exported from `src/index.ts`

**Consumers:**

- `src/sqlite/SqliteStorage.ts` imports from `../types/interfaces.js`
- `src/redis/RedisStorage.ts` imports from `../types/interfaces.js`
- `src/usage/index.ts` re-exports from `./types.js`

**Fix strategy:**

1. Keep canonical definition in `src/types/interfaces.ts` (co-located with `StorageBackend` that uses it)
2. Delete definition from `src/usage/types.ts`
3. In `src/usage/types.ts`, add `export type { StructuredUsage } from '../types/interfaces.js'` (preserves `src/usage/index.ts` re-export without breaking)
4. Add `StructuredUsage` to `src/types/index.ts` exports from `./interfaces.js`
5. Add `StructuredUsage` to `src/index.ts` types export block

### TYPE-02: Missing Event Type Exports

**Event types defined in `types/events.ts` but missing from `src/index.ts`:**

| Type                     | In `types/index.ts`? | In `src/index.ts`? |
| ------------------------ | -------------------- | ------------------ |
| `ErrorRateLimitEvent`    | YES                  | NO                 |
| `ErrorAuthEvent`         | YES                  | NO                 |
| `ErrorServerEvent`       | YES                  | NO                 |
| `ErrorNetworkEvent`      | YES                  | NO                 |
| `KeyRetriedEvent`        | YES                  | NO                 |
| `KeyDisabledEvent`       | YES                  | NO                 |
| `RequestCompleteEvent`   | YES                  | NO                 |
| `ProviderRecoveredEvent` | NO                   | NO                 |

**Fix strategy:**

1. Add `ProviderRecoveredEvent` to `src/types/index.ts` events export block
2. Add all 8 missing types to `src/index.ts` types export block from `'./types/index.js'`

### TYPE-04: SambaNovaProviderConfig

**Current state:** `src/types/providers.ts` defines 5 type aliases:

- `GoogleProviderConfig`
- `GroqProviderConfig`
- `MistralProviderConfig`
- `CerebrasProviderConfig`
- `NvidiaProviderConfig`

All are `= ProviderConfig` with JSDoc documenting the provider.

**Missing:** `SambaNovaProviderConfig` -- no alias exists anywhere.

**Fix strategy:**

1. Add `SambaNovaProviderConfig` to `src/types/providers.ts` with same pattern
2. Add to `src/types/index.ts` provider config exports
3. Add to `src/index.ts` types export block

### TYPE-05: onFallbackTriggered Dead Hook

**Current state:**

- Hook declared on `Router` interface: `config/index.ts:98`
- Hook wired via `createHook<FallbackTriggeredEvent>(RouterEvent.FALLBACK_TRIGGERED)`: `config/index.ts:494`
- `RouterEvent.FALLBACK_TRIGGERED = 'fallback:triggered'`: `constants/index.ts:34`
- `FallbackTriggeredEvent` interface defined: `types/events.ts:87-93`
- **ZERO emit calls** for `FALLBACK_TRIGGERED` or `fallback:triggered` in the entire `src/` tree

**Where it SHOULD be emitted:**

- `ChainExecutor.ts` -- when execution falls from one chain entry to the next. Currently emits `chain:resolved` on success but nothing on individual fallback steps.
- The retry-proxy handles key-level retries (same provider, different key) which is NOT a fallback. Cross-provider fallback happens in ChainExecutor.

**Who consumes it:**

- `DebugLogger.ts:29` -- listens via `router.onFallbackTriggered((e) => {...})`
- `docs/events.md:18` -- documented as a hook
- `README.md:304` -- documented in hooks table

**Fix options:**

1. **Wire it up** (recommended): Emit `FALLBACK_TRIGGERED` in ChainExecutor when moving from one chain entry to the next due to failure. The payload shape already matches (`fromProvider`, `toProvider`, `fromModel`, `toModel`, `reason`).
2. **Remove it**: Delete hook from Router interface, remove from createHook wiring, remove from DebugLogger, remove from docs. More disruptive.

**Recommendation:** Wire it up. The ChainExecutor already has the information needed (previous provider/model that failed, next provider/model to try). A single `safeEmit` call in the catch-and-continue path of the chain execution loop is all that's needed.

## Common Pitfalls

### Pitfall 1: Forgetting One Export Layer

**What goes wrong:** Type added to `types/index.ts` but not `src/index.ts`, so `import { X } from 'pennyllm'` fails while `import { X } from 'pennyllm/types'` works.
**How to avoid:** Always add to BOTH barrel files. Verify with: `grep 'TypeName' src/index.ts src/types/index.ts`

### Pitfall 2: Re-export vs Import for Type Aliases

**What goes wrong:** Using `import` + `export` instead of `export type { X } from './...'` can pull in runtime dependencies.
**How to avoid:** Always use `export type { X } from '...'` for pure type re-exports.

### Pitfall 3: Circular Imports from Consolidation

**What goes wrong:** Moving `StructuredUsage` canonical location can create circular import if `types/interfaces.ts` imports from `usage/types.ts` or vice versa.
**How to avoid:** Keep canonical definition in `types/interfaces.ts` (no circular risk). Have `usage/types.ts` re-export from there.

### Pitfall 4: tsup Bundle Mismatch

**What goes wrong:** TypeScript compiles fine but tsup tree-shaking drops a type-only re-export.
**How to avoid:** Use `export type` consistently. Verify with `npm run build` after changes.

## Verification Strategy

After all changes, verify with:

```bash
# 1. TypeScript compilation
npx tsc --noEmit

# 2. Build succeeds
npm run build

# 3. Spot-check: StructuredUsage accessible from both paths
# (manual: create a scratch .ts file importing from both)

# 4. Grep: no remaining duplicate StructuredUsage definitions
grep -rn 'interface StructuredUsage' src/
# Should show exactly ONE result (in types/interfaces.ts)

# 5. Grep: all event types in root barrel
grep 'ProviderRecoveredEvent\|ErrorRateLimitEvent\|ErrorAuthEvent' src/index.ts
```

## Validation Architecture

### Test Framework

| Property           | Value                                             |
| ------------------ | ------------------------------------------------- |
| Framework          | vitest 2.1.8                                      |
| Config file        | vitest config (implicit, in package.json scripts) |
| Quick run command  | `npx tsc --noEmit`                                |
| Full suite command | `npm run build && npx tsc --noEmit`               |

### Phase Requirements to Test Map

| Req ID  | Behavior                                   | Test Type   | Automated Command                                       | File Exists? |
| ------- | ------------------------------------------ | ----------- | ------------------------------------------------------- | ------------ |
| TYPE-01 | StructuredUsage importable from both paths | manual-only | `npx tsc --noEmit` (compile check)                      | N/A          |
| TYPE-02 | All event types importable from root       | manual-only | `npx tsc --noEmit` (compile check)                      | N/A          |
| TYPE-03 | Single StructuredUsage definition          | manual-only | `grep -c 'interface StructuredUsage' src/**/*.ts`       | N/A          |
| TYPE-04 | SambaNovaProviderConfig exists             | manual-only | `grep SambaNovaProviderConfig src/types/providers.ts`   | N/A          |
| TYPE-05 | FALLBACK_TRIGGERED emitted or hook removed | manual-only | `grep -r 'FALLBACK_TRIGGERED\|fallback:triggered' src/` | N/A          |

Manual-only justification: These are structural/export issues verified by compilation and grep, not behavioral tests. Per CLAUDE.md testing strategy, `tsc --noEmit` and `npm run build` are sufficient.

### Sampling Rate

- **Per task commit:** `npx tsc --noEmit`
- **Per wave merge:** `npm run build && npx tsc --noEmit`
- **Phase gate:** Full build green

### Wave 0 Gaps

None -- no test infrastructure needed. Verification is compilation-based.

## Sources

### Primary (HIGH confidence)

- Direct code inspection of `src/index.ts`, `src/types/index.ts`, `src/types/events.ts`, `src/types/interfaces.ts`, `src/types/providers.ts`, `src/usage/types.ts`
- Direct code inspection of `src/config/index.ts` (Router interface, createHook wiring)
- Direct code inspection of `src/chain/ChainExecutor.ts`, `src/wrapper/retry-proxy.ts` (emit calls)
- `grep` across full `src/` tree for `StructuredUsage`, `ProviderRecoveredEvent`, `SambaNovaProviderConfig`, `onFallbackTriggered`, `FALLBACK_TRIGGERED`, `.emit(`

### Secondary (MEDIUM confidence)

- `docs/events.md`, `README.md` for documentation claims about hooks/events

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - no new libraries needed, pure refactoring
- Architecture: HIGH - existing three-layer pattern well understood from code
- Pitfalls: HIGH - standard TypeScript barrel export concerns, verified by inspection

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable -- internal refactoring, no external dependencies)
