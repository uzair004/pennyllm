---
phase: 12-provider-overhaul-validation
plan: 01
subsystem: providers
tags: [providers, types, registry, constants, sdk]
dependency_graph:
  requires: []
  provides: [ProviderModule, ProviderModelDef, provider-registry, provider-staleness]
  affects: [constants, package.json]
tech_stack:
  added:
    [
      '@ai-sdk/cerebras',
      '@ai-sdk/groq',
      '@ai-sdk/mistral',
      '@ai-sdk/openai-compatible',
      'sambanova-ai-provider',
    ]
  patterns: [dynamic-import-factory, as-const-satisfies, provider-module-pattern]
key_files:
  created:
    - src/providers/types.ts
    - src/providers/cerebras.ts
    - src/providers/google.ts
    - src/providers/groq.ts
    - src/providers/github-models.ts
    - src/providers/sambanova.ts
    - src/providers/nvidia-nim.ts
    - src/providers/mistral.ts
    - src/providers/registry.ts
    - src/providers/index.ts
  modified:
    - src/constants/index.ts
    - package.json
    - package-lock.json
decisions:
  - SambaNova community provider returns LanguageModelV2; cast to any for V3 compatibility (same pattern as existing V3-to-any cast)
  - Updated model selections based on latest provider intelligence notes (Qwen3 for Cerebras, Kimi K2 for Groq, DeepSeek-R1-0528 for SambaNova)
  - Used eslint-disable for dynamic import unsafe-any warnings since SDK types resolve correctly at runtime
metrics:
  duration: ~11m
  completed: '2026-03-17T07:42:28Z'
  tasks_completed: 2
  tasks_total: 2
  files_created: 10
  files_modified: 3
---

# Phase 12 Plan 01: Provider Modules, Registry & Constants Summary

7 self-contained provider modules with curated free-tier models, async SDK factories, staleness checking, and 3 new chain/provider lifecycle events.

## What Was Built

### Task 1: Provider Types, 7 Provider Modules, and Registry

Created `src/providers/` directory with:

- **types.ts**: `ProviderModule` and `ProviderModelDef` interfaces, `ProviderTier` type
- **7 provider modules** (cerebras, google, groq, github-models, sambanova, nvidia-nim, mistral):
  - Each exports a `const xxxProvider: ProviderModule` with `as const satisfies` models
  - Dynamic import factory with try/catch for missing SDK packages
  - Curated 3-4 models per provider with quality tiers and capability flags
  - Metadata: lastVerified date, updateUrl, envVar, tier
- **registry.ts**: `getAllProviders()`, `getProviderModule()`, `checkProviderStaleness()`
- **index.ts**: Barrel re-exports

### Task 2: Constants, Events, Package.json

- **Constants**: Provider enum reordered (7 target first, 6 legacy marked), added SAMBANOVA
- **Events**: `CHAIN_RESOLVED`, `PROVIDER_DEPLETED`, `PROVIDER_STALE`
- **Package.json**: 5 new optional peer dependencies + dev dependencies installed

## Provider Model Summary

| Provider      | Models | Tier  | SDK Package               |
| ------------- | ------ | ----- | ------------------------- |
| Cerebras      | 4      | free  | @ai-sdk/cerebras          |
| Google        | 4      | free  | @ai-sdk/google            |
| Groq          | 4      | free  | @ai-sdk/groq              |
| GitHub Models | 4      | free  | @ai-sdk/openai-compatible |
| SambaNova     | 4      | free  | sambanova-ai-provider     |
| NVIDIA NIM    | 4      | trial | @ai-sdk/openai-compatible |
| Mistral       | 4      | free  | @ai-sdk/mistral           |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed SDK packages during Task 1 instead of Task 2**

- **Found during:** Task 1
- **Issue:** ESLint pre-commit hook fails on dynamic imports resolving to `any` without installed types
- **Fix:** Installed @ai-sdk/cerebras, @ai-sdk/groq, @ai-sdk/mistral, @ai-sdk/openai-compatible, sambanova-ai-provider before committing Task 1
- **Files modified:** package.json, package-lock.json (committed in Task 2)

**2. [Rule 1 - Bug] SambaNova V2/V3 type mismatch**

- **Found during:** Task 1
- **Issue:** sambanova-ai-provider returns LanguageModelV2, not V3
- **Fix:** Added `as any` cast with eslint-disable comment (matches existing project pattern for V3 compatibility)
- **Files modified:** src/providers/sambanova.ts
- **Commit:** 11c3aaf

**3. [Rule 2 - Missing] Updated model selections from provider intelligence**

- **Found during:** Task 1
- **Issue:** Plan specified some model IDs that don't match current provider catalogs (e.g., gemma2-9b-it for Groq no longer listed, QwQ-32B not in SambaNova current catalog)
- **Fix:** Used actual model IDs from provider intelligence notes: Kimi K2 for Groq, Qwen3-235B for SambaNova, gemini-3-flash-preview for Google
- **Files modified:** Provider modules

## Verification

- `npx tsc --noEmit` passes (only pre-existing rootDir warning)
- All 7 provider modules exist with curated models and factory functions
- Registry exports getAllProviders, getProviderModule, checkProviderStaleness
- Constants have 3 new event types and SAMBANOVA provider ID
- Package.json has 5 new optional peer dependencies

## Commits

| Hash    | Message                                                           |
| ------- | ----------------------------------------------------------------- |
| 11c3aaf | feat(12-01): add 7 provider modules with types and registry       |
| 1510372 | feat(12-01): update constants, events, and package.json peer deps |

## Self-Check: PASSED

- All 10 created files exist in src/providers/
- Both commits verified in git log (11c3aaf, 1510372)
- tsc --noEmit passes (pre-existing rootDir warning only)
