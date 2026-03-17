---
phase: 12-provider-overhaul-validation
plan: 04
subsystem: chain
tags: [chain, builder, types, interleaving, priority]
dependency_graph:
  requires: [12-01, 12-03]
  provides: [chain-types, chain-builder]
  affects: [chain-executor, router-integration]
tech_stack:
  added: []
  patterns: [round-robin-interleaving, explicit-vs-auto-chain, unknown-model-allowance]
key_files:
  created:
    - src/chain/types.ts
    - src/chain/chain-builder.ts
    - src/chain/index.ts
decisions:
  - Unknown models allowed with debug warning and default metadata
  - Provider allowlist mismatch throws ConfigError (fail-fast)
  - Auto chain interleaves round-robin across providers sorted by priority
  - Free-only filtering when budget.monthlyLimit === 0
metrics:
  duration: 2m 46s
  completed: 2026-03-17
---

# Phase 12 Plan 04: Chain Types & Builder Summary

Chain type system and builder that constructs ordered ChainEntry[] from user config, supporting both explicit model arrays and auto-generated interleaved chains with free-only filtering.

## What Was Built

### Task 1: Chain types (`4044075`)

Created `src/chain/types.ts` with the full chain type system:

- **ChainEntry** -- single entry in model priority chain (provider, modelId, apiModelId, qualityTier, free, capabilities, stale)
- **ChainAttempt** -- record of a single chain attempt for error reporting
- **ChainResult** -- result from successful chain execution
- **ChainFilter** -- per-request filter options (capabilities, provider, tier)
- **ChainEntryStatus** -- status of a single chain entry (available/cooling/depleted/stale)
- **ChainStatus** -- full chain status for router.getStatus()

### Task 2: Chain builder (`8591765`)

Created `src/chain/chain-builder.ts` with two chain construction modes:

**Explicit mode** (config.models defined):

- Preserves exact user-specified order
- Validates provider is configured, checks provider allowlist
- Looks up curated model metadata from registry
- Unknown models allowed with debug warning (qualityTier: 'mid', free: true, all capabilities false)

**Auto mode** (config.models undefined/empty):

- Sorts providers by priority (lower first), then alphabetically for ties
- Filters to free-only models when budget is $0
- Sorts each provider's models by quality tier (frontier first)
- Interleaves round-robin: position 0 from each provider, then position 1, etc.

**Startup logging**: `logChain()` uses `console.info` for always-visible output plus debug for full details.

Created `src/chain/index.ts` barrel re-exporting all types and buildChain.

## Verification

- `npx tsc --noEmit` passes (only pre-existing rootDir test error)
- All acceptance criteria met for both tasks

## Deviations from Plan

None -- plan executed exactly as written.

## Commits

| Task | Commit    | Description                                |
| ---- | --------- | ------------------------------------------ |
| 1    | `4044075` | Chain type definitions                     |
| 2    | `8591765` | Chain builder with auto and explicit modes |

## Self-Check: PASSED

- All 3 files created: types.ts, chain-builder.ts, index.ts
- Commit 4044075: verified in git log
- Commit 8591765: verified in git log
