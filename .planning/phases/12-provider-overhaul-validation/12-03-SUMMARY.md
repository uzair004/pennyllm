---
phase: 12-provider-overhaul-validation
plan: 03
subsystem: config
tags: [config, schema, types, chain-architecture]
dependency_graph:
  requires: [12-01]
  provides: [config-schema-chain-fields, provider-tier-type, models-array]
  affects: [12-04, 12-05]
tech_stack:
  added: []
  patterns: [legacy-type-cast-for-dead-code]
key_files:
  created: []
  modified:
    - src/config/schema.ts
    - src/types/config.ts
    - src/types/index.ts
    - src/index.ts
    - src/config/index.ts
    - src/fallback/FallbackProxy.ts
    - src/fallback/FallbackResolver.ts
    - src/selection/KeySelector.test.ts
decisions:
  - Remove fallback config entirely from schema and types (chain architecture replaces it)
  - Use legacy type casts in fallback files for compilation (files deleted in Plan 06)
  - wrapModel uses retryProxy directly without fallback proxy (ChainExecutor wired in Plan 05)
metrics:
  duration: 5m 5s
  completed: 2026-03-17
---

# Phase 12 Plan 03: Config Schema Overhaul Summary

Config schema updated with chain-related fields (priority, tier, credits, models) and fallback config section fully removed from schema, types, and createRouter.

## Tasks Completed

### Task 1: Update config schema with chain fields, remove fallback section

- **Commit:** 429ea64
- Removed `fallbackConfigSchema` and `providerFallbackOverrideSchema` from schema.ts
- Added `priority` (int, default 100), `tier` (free/trial/paid, default free), `credits` (positive, optional), `models` (string array, optional) to providerConfigSchema
- Added top-level `models` array to configSchema
- Replaced cheapest-paid validation with trial tier credits validation

### Task 2: Update TypeScript types and fix all compilation errors

- **Commit:** 18f8040
- Added `ProviderTier` type and chain fields to ProviderConfig interface
- Added `models?: string[]` to RouterConfig, removed `fallback: FallbackConfig`
- Removed FallbackConfig/ProviderFallbackOverride from type re-exports
- Removed FallbackResolver, AffinityCache, createFallbackProxy imports from createRouter
- wrapModel now wraps retryProxy directly (no fallback proxy)
- Added legacy type casts to FallbackProxy.ts and FallbackResolver.ts for compilation
- Updated KeySelector.test.ts with required priority/tier fields

## Verification

- `npx tsc --noEmit`: Clean (only pre-existing rootDir test error)
- `npx vitest run`: 93 passed, 1 skipped, 38 todo
- No `config.fallback` references remain in active code paths
- New config fields available: models, priority, tier, credits

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Legacy fallback files need compilation fixes**

- **Found during:** Task 2
- **Issue:** FallbackProxy.ts and FallbackResolver.ts reference `config.fallback` which no longer exists on RouterConfig
- **Fix:** Added legacy type interfaces (`LegacyRouterConfig`) with type casts to keep dead code compiling until Plan 06 cleanup
- **Files modified:** src/fallback/FallbackProxy.ts, src/fallback/FallbackResolver.ts
- **Commit:** 18f8040

## Self-Check: PASSED

- All modified files exist on disk
- Commits 429ea64 and 18f8040 verified in git log
- SUMMARY.md created at correct path
