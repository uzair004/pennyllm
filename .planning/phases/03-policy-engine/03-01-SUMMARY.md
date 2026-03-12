---
phase: 03-policy-engine
plan: 01
subsystem: policy
tags: [policy-types, default-policies, config-schema, resolver, merge-logic]
dependency_graph:
  requires: [02-01]
  provides: [policy-types, default-policies, policy-resolver]
  affects: [config-validation, policy-engine]
tech_stack:
  added: [debug-logger]
  patterns: [three-layer-merge, composite-key-matching, validation-on-resolve]
key_files:
  created:
    - src/policy/types.ts
    - src/policy/defaults/google.ts
    - src/policy/defaults/groq.ts
    - src/policy/defaults/openrouter.ts
    - src/policy/defaults/index.ts
    - src/policy/resolver.ts
  modified:
    - src/policy/index.ts
    - src/config/schema.ts
    - src/types/config.ts
decisions:
  - 'Empty array per-key limits treated as no override (not clearing inherited limits)'
  - 'Metadata conditionally added to ResolvedPolicy only when shipped policy exists'
  - 'Debug warning for custom providers without defaults or configured limits'
  - 'Validation runs after merge to catch contradictory limits early (startup-time failure)'
metrics:
  tasks_completed: 2
  commits: 2
  files_created: 6
  files_modified: 3
  duration: 3m 35s
  completed_at: '2026-03-12T20:54:38Z'
---

# Phase 03 Plan 01: Policy Foundation Summary

Policy types, default policies, config schema updates, and three-layer policy resolver with validation.

## What Was Built

Created policy data types (ResolvedPolicy, EvaluationResult, LimitStatus), shipped default policies for 3 providers (Google, Groq, OpenRouter) with placeholder limits, updated config schema to support mixed key arrays (string | { key, limits? }), and implemented three-layer policy resolution with duplicate key detection and contradictory limit validation.

## Tasks Completed

### Task 1: Define policy types, default policies, and update config schema

**Commit:** 222b4fa
**Files:** src/policy/types.ts, src/policy/defaults/google.ts, src/policy/defaults/groq.ts, src/policy/defaults/openrouter.ts, src/policy/defaults/index.ts, src/config/schema.ts, src/types/config.ts

- Created ResolvedPolicy, EvaluationResult, LimitStatus, KeyConfig, PolicyStaleEvent types
- Added 3 default policies (google, groq, openrouter) with versioned metadata and placeholder limits
- Google: 1M tokens/month, 15 RPM, 1500 RPD, hard-block
- Groq: 500K tokens/day, 30 RPM, 14400 RPD, hard-block
- OpenRouter: 1M tokens/month, 20 RPM, throttle enforcement
- Updated config schema to accept mixed key arrays via keyConfigSchema union type
- Exported timeWindowSchema, policyLimitSchema, keyConfigSchema from schema.ts
- Updated ProviderConfig.keys type from string[] to KeyConfig[]
- Added optional warningThreshold field to RouterConfig

### Task 2: Implement three-layer policy resolver

**Commit:** aecccda
**Files:** src/policy/resolver.ts, src/policy/index.ts

- Created mergeLimits function using composite key matching (type:window.type)
- Implemented resolvePolicies with three-layer merge: shipped defaults < provider-level < per-key
- Duplicate key detection throws ConfigError with clear message
- Contradictory limits validation (daily > monthly for same type) throws ConfigError at startup
- Custom providers without defaults log debug warning and create empty-limits ResolvedPolicy
- Empty array per-key limits treated as "no override" (not clearing)
- Metadata conditionally added to ResolvedPolicy only when shipped policy exists (exactOptionalPropertyTypes compliance)
- Updated policy/index.ts to re-export all types, resolver functions, and default policies

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- `npm test`: All 74 tests pass (13 MemoryStorage, 14 exports, 23 config, 24 build)
- `npm run build`: Clean build with no TypeScript errors
- Config schema validates both `keys: ['key1']` and `keys: [{ key: 'key2', limits: [...] }]`
- Default policies satisfy Policy type with `satisfies` keyword
- Three-layer merge correctly prioritizes per-key > provider > shipped
- Contradictory limits detected at resolve time (not evaluation time)

## Dependencies Satisfied

**Requirements completed:** POLICY-01, POLICY-02, POLICY-03, POLICY-04, POLICY-05, POLICY-06, POLICY-07

**Provides to downstream plans:**

- Policy types for PolicyEngine (Plan 03-02)
- Default policies for shipped providers
- Policy resolver for config processing
- Mixed key array support for per-key overrides

**Relies on:**

- Phase 02-01: Config schema foundation
- Phase 01: Type system and error classes

## Key Decisions

1. **Empty array per-key limits treated as no override** - Empty array `[]` in `{ key: 'foo', limits: [] }` is treated the same as omitting the limits field. This prevents accidental limit clearing.

2. **Metadata conditionally added to ResolvedPolicy** - TypeScript's `exactOptionalPropertyTypes: true` mode requires that optional fields not be set to undefined. Metadata is only added when shipped policy exists.

3. **Debug warning for custom providers** - Providers without shipped defaults and no configured limits log a debug message rather than throwing an error. They resolve to always-available with empty limits array.

4. **Validation runs after merge** - Contradictory limit validation happens at resolve time (startup) not evaluation time. Fail-fast design catches config errors early.

## Technical Notes

- Composite key matching in mergeLimits uses `${type}:${window.type}` format
- Later layers completely replace earlier for matching keys (not additive)
- Unmatched limits from any layer are included in final result
- Validation only compares same limit type across different windows (tokens:daily vs tokens:monthly)
- Does NOT compare across different limit types (tokens vs calls)
- shippedDefaults Map keyed by provider string for O(1) lookup

## Next Steps

Plan 03-02 will implement the PolicyEngine that evaluates resolved policies against current usage to determine key eligibility.

## Self-Check

PASSED

**Files created:**

- ✓ src/policy/types.ts
- ✓ src/policy/defaults/google.ts
- ✓ src/policy/defaults/groq.ts
- ✓ src/policy/defaults/openrouter.ts
- ✓ src/policy/defaults/index.ts
- ✓ src/policy/resolver.ts

**Commits verified:**

- ✓ 222b4fa (Task 1)
- ✓ aecccda (Task 2)

**Exports verified:**

- ✓ googlePolicy, groqPolicy, openrouterPolicy exported from policy/defaults/index.ts
- ✓ resolvePolicies, mergeLimits exported from policy/resolver.ts
- ✓ All types re-exported from policy/index.ts
