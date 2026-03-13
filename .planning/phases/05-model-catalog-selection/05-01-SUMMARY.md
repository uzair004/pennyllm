---
phase: 05-model-catalog-selection
plan: 01
subsystem: types
tags: [types, interfaces, contracts, schema, errors]
dependency_graph:
  requires: []
  provides:
    - ModelMetadata with per1MTokens pricing
    - ModelCatalog interface with close() and filtered listModels()
    - SelectionStrategy interface with SelectionContext
    - RateLimitError and QuotaExhaustedError classes
    - Strategy.PRIORITY constant
    - CooldownConfig in RouterConfig
    - CatalogRefreshedEvent and ProviderExhaustedEvent types
  affects:
    - src/catalog/** (uses ModelListFilter)
    - src/selection/** (uses SelectionContext, CandidateKey, SelectionResult)
    - src/config/** (uses PRIORITY strategy, cooldown schema)
    - src/errors/** (exports new error classes)
tech_stack:
  added: []
  patterns:
    - Selection strategy contract with context-based API
    - Catalog filtering interface
    - Structured cooldown configuration
    - Distinct error classes for rate-limit vs quota exhaustion
key_files:
  created:
    - src/catalog/types.ts
    - src/selection/types.ts
    - src/errors/rate-limit-error.ts
    - src/errors/quota-exhausted-error.ts
  modified:
    - src/constants/index.ts
    - src/types/domain.ts
    - src/types/interfaces.ts
    - src/types/events.ts
    - src/types/config.ts
    - src/policy/types.ts
    - src/config/schema.ts
    - src/config/defaults.ts
    - src/types/index.ts
    - src/catalog/index.ts
    - src/selection/index.ts
    - src/index.ts
    - tests/config.test.ts
    - tests/exports.test.ts
decisions:
  - title: Strategy.PRIORITY as default
    rationale: Matches plan requirement for priority-based selection by default
    alternatives: Round-robin (previous default)
    impact: Breaking change - updated 3 tests to reflect new default
  - title: Per-1M-tokens pricing format
    rationale: Industry standard for model pricing (OpenAI, Anthropic, etc.)
    alternatives: Per-1k-tokens (previous format)
    impact: Breaking change - existing ModelMetadata consumers must update
  - title: Array length guard with non-null assertion
    rationale: TypeScript strict mode requires explicit undefined handling
    alternatives: Optional chaining
    impact: Early validation prevents runtime errors
metrics:
  duration: 31m 9s
  tasks_completed: 2
  files_created: 4
  files_modified: 15
  tests_updated: 3
  commits: 2
  completed_date: '2026-03-13'
---

# Phase 05 Plan 01: Type Contracts and Schema Updates Summary

**One-liner:** Established foundational type contracts with per1MTokens pricing, priority strategy, cooldown config, and distinct rate-limit/quota error classes.

## Tasks Completed

| Task | Description                                     | Commit  | Status   |
| ---- | ----------------------------------------------- | ------- | -------- |
| 1    | Update type contracts, constants, error classes | 1da02ff | Complete |
| 2    | Update config schema, defaults, and exports     | 7ac7235 | Complete |

## Key Changes

### Type System Updates

**Constants (src/constants/index.ts):**

- Added `Strategy.PRIORITY` as first enum value
- Added `RouterEvent.PROVIDER_EXHAUSTED` and `RouterEvent.CATALOG_REFRESHED`
- Added `ModelStatus` enum (`ACTIVE`, `DEPRECATED`)

**Domain Types (src/types/domain.ts):**

- Changed `ModelMetadata.pricing` from per1kTokens to per1MTokens format
- Added `status: ModelStatusType` field (required)
- Added optional `createdAt?: string` and `updatedAt?: string` fields

**Interfaces (src/types/interfaces.ts):**

- Updated `ModelCatalog.listModels()` to accept `ModelListFilter` parameter
- Added `ModelCatalog.close()` method
- Replaced `SelectionStrategy.selectKey()` signature to use `SelectionContext` and `SelectionResult`

**Events (src/types/events.ts):**

- Updated `KeySelectedEvent` with `model?`, `label?`, `strategy` fields
- Added `ProviderExhaustedEvent` type with exhaustion details
- Re-exported `CatalogRefreshedEvent` from catalog/types

**Config (src/types/config.ts):**

- Added `CooldownConfig` interface with `defaultDurationMs` field
- Added `cooldown: CooldownConfig` to `RouterConfig`

**Policy (src/policy/types.ts):**

- Updated `KeyConfig` to support `label?: string` field in object form

### New Type Files

**src/catalog/types.ts:**

- `ModelListFilter` interface for catalog filtering (provider, capabilities, qualityTier, maxPrice)
- `CatalogRefreshedEvent` interface for catalog refresh events

**src/selection/types.ts:**

- `CandidateKey` interface with eligibility, cooldown, and evaluation status
- `SelectionContext` interface for key selection input
- `SelectionResult` interface for key selection output

### Error Classes

**src/errors/rate-limit-error.ts:**

- Extends `LLMRouterError` with code `RATE_LIMITED`
- Computes earliest recovery time from all rate-limited keys
- Stores all key cooldown details in metadata

**src/errors/quota-exhausted-error.ts:**

- Extends `LLMRouterError` with code `QUOTA_EXHAUSTED`
- Computes next reset time from all exhausted keys
- Stores all key quota details in metadata

### Config Schema Updates

**src/config/schema.ts:**

- Added `label: z.string().optional()` to `keyConfigSchema` object variant
- Added `Strategy.PRIORITY` to provider and router strategy enums
- Added `cooldownSchema` with 60s default
- Added `cooldown` field to `configSchema`
- Changed default strategy from `ROUND_ROBIN` to `PRIORITY`

**src/config/defaults.ts:**

- Changed `strategy` from `Strategy.ROUND_ROBIN` to `Strategy.PRIORITY`
- Added `cooldown: { defaultDurationMs: 60000 }`

### Export Updates

**src/types/index.ts:**

- Added `CooldownConfig`, `CatalogRefreshedEvent`, `ProviderExhaustedEvent`
- Added `ModelListFilter`, `SelectionContext`, `CandidateKey`, `SelectionResult`

**src/catalog/index.ts:**

- Exported `ModelListFilter` and `CatalogRefreshedEvent` types

**src/selection/index.ts:**

- Exported `SelectionContext`, `CandidateKey`, `SelectionResult` types

**src/index.ts (main package):**

- Added `ModelStatus` to constant exports
- Added `ModelStatusType` to type exports
- Added all new types: `CandidateKey`, `CatalogRefreshedEvent`, `CooldownConfig`, `ModelListFilter`, `ProviderExhaustedEvent`, `SelectionContext`, `SelectionResult`
- Added `RateLimitError` and `QuotaExhaustedError` to error exports

### Test Updates

**tests/config.test.ts:**

- Updated 2 assertions to expect `'priority'` instead of `'round-robin'`

**tests/exports.test.ts:**

- Updated 1 assertion to expect `'priority'` in `DEFAULT_CONFIG.strategy`

## Deviations from Plan

None - plan executed exactly as written. All must-have truths and artifacts verified:

**Truths verified:**
✓ ModelMetadata pricing uses per1MTokens format
✓ ModelCatalog includes close() and filtered listModels()
✓ SelectionStrategy uses SelectionContext with CandidateKey
✓ Strategy constants include PRIORITY with default 'priority'
✓ Config schema validates strategy/cooldown/key labels
✓ RateLimitError and QuotaExhaustedError exist as distinct classes
✓ New event types defined (KeySelectedEvent updated, ProviderExhaustedEvent, CatalogRefreshedEvent)

**Artifacts verified:**
✓ src/types/domain.ts contains 'per1MTokens'
✓ src/types/interfaces.ts contains 'close'
✓ src/selection/types.ts contains 'SelectionContext'
✓ src/catalog/types.ts contains 'FilterOptions' (as ModelListFilter)
✓ src/errors/rate-limit-error.ts contains 'RateLimitError'
✓ src/errors/quota-exhausted-error.ts contains 'QuotaExhaustedError'
✓ src/config/schema.ts contains 'cooldownSchema'

**Key links verified:**
✓ SelectionContext uses EvaluationResult from policy/types
✓ Config schema references Strategy.PRIORITY constant

## Implementation Notes

### TypeScript Strict Mode Handling

Used non-null assertion (`!`) for array access after length check to satisfy `exactOptionalPropertyTypes`:

```typescript
if (keys.length === 0) {
  throw new Error('RateLimitError requires at least one key');
}
const earliestRecovery = keys.reduce(..., keys[0]!.cooldownUntil);
```

This pattern ensures type safety while maintaining runtime correctness.

### Breaking Changes

1. **Pricing format change:** ModelMetadata.pricing uses per1MTokens (not per1kTokens)
2. **Default strategy change:** Router defaults to 'priority' (not 'round-robin')
3. **ModelCatalog interface:** listModels() signature changed from `(provider?: string)` to `(filter?: ModelListFilter)`
4. **SelectionStrategy interface:** selectKey() signature completely replaced

All downstream code must update to match these new contracts before implementing Plans 02-03.

## Verification Results

**TypeScript Compilation:** ✓ Pass (0 errors)
**Test Suite:** ✓ Pass (74 tests, 0 failures)
**Behavioral Checks:** ✓ Pass

- Strategy.PRIORITY === 'priority'
- Strategy.ROUND_ROBIN === 'round-robin'
- Strategy.LEAST_USED === 'least-used'
- ModelStatus.ACTIVE === 'active'
- RouterEvent.PROVIDER_EXHAUSTED === 'provider:exhausted'
- RouterEvent.CATALOG_REFRESHED === 'catalog:refreshed'
- typeof RateLimitError === 'function'
- typeof QuotaExhaustedError === 'function'

## Next Steps

- **Plan 05-02:** Implement ModelCatalog with static/live sources
- **Plan 05-03:** Implement SelectionStrategy (priority, round-robin, least-used)
- Catalog and selection implementations can now import these types without codebase exploration

## Self-Check: PASSED

**Created files exist:**
✓ src/catalog/types.ts
✓ src/selection/types.ts
✓ src/errors/rate-limit-error.ts
✓ src/errors/quota-exhausted-error.ts

**Commits exist:**
✓ 1da02ff (Task 1 commit)
✓ 7ac7235 (Task 2 commit)

All claimed files and commits verified on disk.
