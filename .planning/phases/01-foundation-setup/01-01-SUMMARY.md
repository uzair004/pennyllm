---
phase: 01-foundation-setup
plan: 01
subsystem: build-system, type-system
tags: [scaffolding, tooling, types, interfaces]
dependency_graph:
  requires: []
  provides:
    - typescript-build-system
    - core-type-definitions
    - plugin-interfaces
  affects:
    - all-future-phases
tech_stack:
  added:
    - typescript: '5.7.2 with strict mode + exactOptionalPropertyTypes'
    - tsup: '8.3.5 for dual ESM+CJS build'
    - vitest: '2.1.8 with v8 coverage'
    - eslint: '9.17.0 with flat config + typescript-eslint'
    - husky: '9.1.7 for git hooks'
    - changesets: '2.27.10 for version management'
  patterns:
    - const-objects-with-as-const: 'Used instead of TypeScript enums for all constants'
    - json-serializable-types: 'All domain types use primitives only (no Date, no functions)'
    - exact-optional-properties: 'Strict handling of optional properties in TypeScript'
key_files:
  created:
    - package.json: 'Package manifest with dual ESM+CJS exports, 8 subpath exports'
    - tsconfig.json: 'Strict TypeScript config (ES2022 target, all strict flags enabled)'
    - tsup.config.ts: 'Build config for 8 entry points (main + 7 subpath exports)'
    - vitest.config.ts: 'Test config with 80% coverage thresholds'
    - eslint.config.js: 'Flat ESLint config with TypeScript support'
    - .github/workflows/ci.yml: 'CI workflow for Node 18.x, 20.x, 22.x'
    - src/constants/index.ts: '6 const objects (Strategy, Provider, RouterEvent, etc.)'
    - src/types/domain.ts: '5 domain types (ModelMetadata, Policy, UsageRecord, etc.)'
    - src/types/config.ts: '4 config types (RouterConfig, ProviderConfig, etc.)'
    - src/types/interfaces.ts: '3 core interfaces (StorageBackend, ModelCatalog, SelectionStrategy)'
    - src/types/events.ts: 'Typed event map with 7 event types'
    - src/errors/base.ts: 'PennyLLMError base class with toJSON()'
    - src/errors/config-error.ts: 'ConfigError subclass'
  modified: []
decisions:
  - decision: 'Use Zod v3.23.0 instead of v4'
    rationale: 'AI SDK peer dependency requires Zod v3, v4 causes npm install conflict'
    alternatives: ['Upgrade AI SDK (not available)', 'Use --legacy-peer-deps (breaks install)']
    impact: 'Stable Zod v3 API, compatible with AI SDK ecosystem'
  - decision: 'Use exactOptionalPropertyTypes in tsconfig'
    rationale: 'Strictest TypeScript mode for catching undefined assignment bugs'
    alternatives: ['Disable flag (less safe)', 'Use ! assertions (verbose)']
    impact: 'Required explicit undefined checks in error class constructors'
  - decision: '8 separate entry points via subpath exports'
    rationale: 'Tree-shakeable exports per PLAN.md spec, allows selective imports'
    alternatives: ['Single entry point (larger bundles)', 'Peer imports (brittle)']
    impact: "Users can import only what they need: 'pennyllm/storage', 'pennyllm/types'"
metrics:
  duration: '9m 39s'
  completed_date: '2026-03-12T00:57:54Z'
  tasks: 2
  commits: 2
  files_created: 28
  lines_added: 1512
---

# Phase 1 Plan 1: Project Scaffolding and Type System

**One-liner:** TypeScript package with strict compilation, dual ESM+CJS output, and plugin-ready interfaces for StorageBackend, ModelCatalog, and SelectionStrategy.

## Summary

Successfully scaffolded the PennyLLM TypeScript npm package with complete build tooling, development workflow automation, and all core type definitions. The project now has:

- **Build System:** Dual ESM+CJS output via tsup with 8 subpath exports (main + storage + catalog + selection + policy + types + errors + constants)
- **Type System:** 3 core interfaces, 9 domain types, 4 config types, 7 event types, 6 const objects
- **Developer Experience:** Pre-commit hooks, commitlint, changesets, 80% coverage thresholds, CI for Node 18/20/22
- **Quality Assurance:** TypeScript strict mode with `exactOptionalPropertyTypes`, ESLint flat config, Prettier

All verification criteria passed:

- `npm install` completes without errors
- `npx tsc --noEmit` reports zero errors
- `npm run build` produces dist/ with .mjs, .cjs, and .d.ts files for all entry points
- No TypeScript enums used (verified with grep)
- All constants use `as const` objects (verified with grep)

## Tasks Completed

### Task 1: Project scaffolding and tooling setup

**Files created:**

- package.json (dual ESM+CJS exports, 8 subpath exports)
- tsconfig.json (strict mode with ES2022 target)
- tsup.config.ts (8 entry points for subpath exports)
- vitest.config.ts (80% coverage thresholds)
- eslint.config.js (flat config with typescript-eslint)
- .prettierrc, .lintstagedrc, commitlint.config.js
- .changeset/config.json
- .github/workflows/ci.yml (Node 18.x, 20.x, 22.x matrix)
- .husky/pre-commit, .husky/commit-msg
- LICENSE (MIT), CONTRIBUTING.md

**Verification:** `npm install && npx tsc --noEmit` passed (after Zod version fix)

**Commit:** 9f99279

### Task 2: Core types, interfaces, constants, and error classes

**Files created:**

- src/constants/index.ts (6 const objects with `as const`)
- src/types/domain.ts (5 domain types)
- src/types/config.ts (4 config types)
- src/types/interfaces.ts (3 core interfaces)
- src/types/events.ts (7 event types + typed event map)
- src/types/index.ts (barrel file)
- src/errors/base.ts (PennyLLMError with toJSON())
- src/errors/config-error.ts (ConfigError subclass)
- src/errors/index.ts (barrel file)
- src/storage/index.ts, src/catalog/index.ts, src/selection/index.ts, src/policy/index.ts (domain barrel files)
- src/index.ts (main entry point)

**Verification:** `npx tsc --noEmit && npm run build && ls dist/` passed

**Commit:** 2a8a546

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Zod v4 peer dependency conflict with AI SDK**

- **Found during:** Task 1 (npm install)
- **Issue:** AI SDK requires Zod v3.23.8, but package.json specified v4.3.0. npm install failed with ERESOLVE error.
- **Fix:** Downgraded Zod to v3.23.0 per PLAN.md fallback ("If Zod v4 is available and stable on npm, use it. Otherwise stick with v3").
- **Files modified:** package.json (line 83)
- **Commit:** 9f99279

**2. [Rule 3 - Blocking] TypeScript exactOptionalPropertyTypes incompatibility**

- **Found during:** Task 2 (tsc --noEmit)
- **Issue:** Direct assignment of possibly-undefined values to optional properties fails with `exactOptionalPropertyTypes: true`. Error in base.ts and config-error.ts constructors.
- **Fix:** Added explicit `!== undefined` guards before assigning optional properties in error class constructors.
- **Files modified:**
  - src/errors/base.ts (lines 22-28)
  - src/errors/config-error.ts (lines 14-25)
- **Commit:** 2a8a546

## Verification Results

All plan verification criteria passed:

1. ✅ `npm install` completes without errors
2. ✅ `npx tsc --noEmit` reports zero errors (strict mode)
3. ✅ `npm run build` produces dist/ folder with .mjs, .cjs, and .d.ts files for all 8 entry points
4. ✅ Three core interfaces (StorageBackend, ModelCatalog, SelectionStrategy) are importable from src/types/interfaces.ts
5. ✅ All domain types (ModelMetadata, Policy, UsageRecord, TimeWindow) are importable from src/types/domain.ts
6. ✅ Constants use `as const` objects (grep verified 6 occurrences in src/constants/)
7. ✅ No TypeScript enums used (grep returns zero results in src/)

## Package Exports Structure

The package provides 8 subpath exports:

```javascript
import {} from /* ... */ 'pennyllm'; // Main entry point
import { StorageBackend } from 'pennyllm/storage'; // Storage interface
import { ModelCatalog } from 'pennyllm/catalog'; // Catalog interface
import { SelectionStrategy } from 'pennyllm/selection'; // Selection interface
import { Policy } from 'pennyllm/policy'; // Policy types
import {} from /* ... */ 'pennyllm/types'; // All types
import { PennyLLMError } from 'pennyllm/errors'; // Error classes
import { Strategy, Provider } from 'pennyllm/constants'; // Constants
```

Each subpath export has:

- `types` condition pointing to .d.ts (MUST be first)
- `import` condition pointing to .mjs (ESM)
- `require` condition pointing to .cjs (CommonJS)

## Next Steps

Phase 1, Plan 2 will implement:

- Zod schema for config validation
- Config loader with YAML/JSON support
- Config validation with helpful error messages

Phase 2 will implement:

- StorageBackend implementations (memory, sqlite, redis)
- Usage tracking and quota enforcement

## Self-Check: PASSED

**Files created (verified):**

- ✅ /Users/muhammaduzair/Documents/github/experiments/pennyllm/pennyllm/package.json
- ✅ /Users/muhammaduzair/Documents/github/experiments/pennyllm/pennyllm/tsconfig.json
- ✅ /Users/muhammaduzair/Documents/github/experiments/pennyllm/pennyllm/tsup.config.ts
- ✅ /Users/muhammaduzair/Documents/github/experiments/pennyllm/pennyllm/vitest.config.ts
- ✅ /Users/muhammaduzair/Documents/github/experiments/pennyllm/pennyllm/eslint.config.js
- ✅ /Users/muhammaduzair/Documents/github/experiments/pennyllm/pennyllm/.prettierrc
- ✅ /Users/muhammaduzair/Documents/github/experiments/pennyllm/pennyllm/.lintstagedrc
- ✅ /Users/muhammaduzair/Documents/github/experiments/pennyllm/pennyllm/commitlint.config.js
- ✅ /Users/muhammaduzair/Documents/github/experiments/pennyllm/pennyllm/.changeset/config.json
- ✅ /Users/muhammaduzair/Documents/github/experiments/pennyllm/pennyllm/.github/workflows/ci.yml
- ✅ /Users/muhammaduzair/Documents/github/experiments/pennyllm/pennyllm/.husky/pre-commit
- ✅ /Users/muhammaduzair/Documents/github/experiments/pennyllm/pennyllm/.husky/commit-msg
- ✅ /Users/muhammaduzair/Documents/github/experiments/pennyllm/pennyllm/LICENSE
- ✅ /Users/muhammaduzair/Documents/github/experiments/pennyllm/pennyllm/CONTRIBUTING.md
- ✅ /Users/muhammaduzair/Documents/github/experiments/pennyllm/pennyllm/src/constants/index.ts
- ✅ /Users/muhammaduzair/Documents/github/experiments/pennyllm/pennyllm/src/types/domain.ts
- ✅ /Users/muhammaduzair/Documents/github/experiments/pennyllm/pennyllm/src/types/config.ts
- ✅ /Users/muhammaduzair/Documents/github/experiments/pennyllm/pennyllm/src/types/interfaces.ts
- ✅ /Users/muhammaduzair/Documents/github/experiments/pennyllm/pennyllm/src/types/events.ts
- ✅ /Users/muhammaduzair/Documents/github/experiments/pennyllm/pennyllm/src/types/index.ts
- ✅ /Users/muhammaduzair/Documents/github/experiments/pennyllm/pennyllm/src/errors/base.ts
- ✅ /Users/muhammaduzair/Documents/github/experiments/pennyllm/pennyllm/src/errors/config-error.ts
- ✅ /Users/muhammaduzair/Documents/github/experiments/pennyllm/pennyllm/src/errors/index.ts
- ✅ /Users/muhammaduzair/Documents/github/experiments/pennyllm/pennyllm/src/storage/index.ts
- ✅ /Users/muhammaduzair/Documents/github/experiments/pennyllm/pennyllm/src/catalog/index.ts
- ✅ /Users/muhammaduzair/Documents/github/experiments/pennyllm/pennyllm/src/selection/index.ts
- ✅ /Users/muhammaduzair/Documents/github/experiments/pennyllm/pennyllm/src/policy/index.ts
- ✅ /Users/muhammaduzair/Documents/github/experiments/pennyllm/pennyllm/src/index.ts

**Commits created (verified):**

- ✅ 9f99279: chore(01-01): configure build tooling and development workflow
- ✅ 2a8a546: feat(01-01): add core types, interfaces, constants, and error classes

**Build artifacts (verified):**

- ✅ /Users/muhammaduzair/Documents/github/experiments/pennyllm/pennyllm/dist/index.mjs
- ✅ /Users/muhammaduzair/Documents/github/experiments/pennyllm/pennyllm/dist/index.cjs
- ✅ /Users/muhammaduzair/Documents/github/experiments/pennyllm/pennyllm/dist/index.d.ts
