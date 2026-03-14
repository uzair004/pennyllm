---
phase: 08-provider-policies-catalog
plan: 01
subsystem: policy
tags: [provider-config, limit-builders, config-toggle, skeleton-json]

# Dependency graph
requires:
  - phase: 03-policy-engine
    provides: PolicyEngine, resolvePolicies, shippedDefaults (removed here)
  - phase: 07-error-handling-retry
    provides: Retry proxy as runtime safety net for no-limits providers
provides:
  - createTokenLimit, createRateLimit, createCallLimit builder helpers
  - 12 typed provider configs with JSDoc documentation
  - applyRegistryDefaults config toggle (default false)
  - data/provider-skeleton.json with 12 provider shapes
  - Clean codebase with no stale shipped defaults
affects: [09-fallback-chains, 10-storage-adapters, 11-cli-tooling, registry-phase]

# Tech tracking
tech-stack:
  added: []
  patterns: [limit-builder-factory, typed-provider-configs-with-jsdoc, empty-defaults-map]

key-files:
  created:
    - src/policy/builders.ts
    - src/types/providers.ts
    - data/provider-skeleton.json
  modified:
    - src/config/schema.ts
    - src/types/config.ts
    - src/config/index.ts
    - src/policy/index.ts
    - src/types/index.ts
    - src/index.ts
    - package.json

key-decisions:
  - 'Pass empty Map to resolvePolicies instead of shippedDefaults -- retry proxy handles runtime 429s'
  - 'applyRegistryDefaults defaults to false, wired for future registry phase'
  - 'Provider config types are JSDoc-annotated aliases of ProviderConfig for IDE discoverability'

patterns-established:
  - 'Limit builder pattern: createTokenLimit/createRateLimit/createCallLimit with WindowType'
  - 'Provider skeleton JSON: structural reference with no limit values'

requirements-completed:
  [
    PROV-01,
    PROV-02,
    PROV-03,
    PROV-04,
    PROV-05,
    PROV-06,
    PROV-07,
    PROV-08,
    PROV-09,
    PROV-10,
    PROV-11,
    PROV-12,
  ]

# Metrics
duration: 6min
completed: 2026-03-14
---

# Phase 8 Plan 1: Remove Stale Defaults and Add Limit Builders Summary

**Removed shipped static defaults, added applyRegistryDefaults toggle, created createTokenLimit/createRateLimit/createCallLimit builder helpers, 12 typed provider configs with JSDoc, and provider skeleton JSON**

## Performance

- **Duration:** 5m 51s
- **Started:** 2026-03-13T23:58:54Z
- **Completed:** 2026-03-14T00:04:45Z
- **Tasks:** 3
- **Files modified:** 14 (4 deleted, 3 created, 7 modified)

## Accomplishments

- Deleted all 4 static default policy files and the defaults/ directory (google.ts, groq.ts, openrouter.ts, index.ts)
- Added `applyRegistryDefaults: boolean` to config schema and RouterConfig interface (defaults to false)
- Created 3 limit builder functions that produce well-typed PolicyLimit objects with correct durations
- Created typed provider configs with JSDoc for all 12 providers (sign-up URLs, env vars, AI SDK packages, tier info)
- Created data/provider-skeleton.json with all 12 provider shapes bundled for npm distribution
- All 83 existing tests pass with zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove static defaults, add config toggle** - `e23bfdc` (feat)
2. **Task 2: Create limit builders and typed provider configs** - `e82773c` (feat)
3. **Task 3: Create provider skeleton JSON and update package.json** - `c02f32e` (feat)

## Files Created/Modified

- `src/policy/defaults/google.ts` - DELETED (stale shipped default)
- `src/policy/defaults/groq.ts` - DELETED (stale shipped default)
- `src/policy/defaults/openrouter.ts` - DELETED (stale shipped default)
- `src/policy/defaults/index.ts` - DELETED (shippedDefaults Map)
- `src/config/schema.ts` - Added applyRegistryDefaults: z.boolean().default(false)
- `src/types/config.ts` - Added applyRegistryDefaults: boolean to RouterConfig
- `src/config/index.ts` - Replaced shippedDefaults import with empty Map
- `src/policy/index.ts` - Removed defaults re-exports, added builder exports
- `src/policy/builders.ts` - NEW: createTokenLimit, createRateLimit, createCallLimit
- `src/types/providers.ts` - NEW: 12 typed provider configs with JSDoc
- `src/types/index.ts` - Added provider config type exports
- `src/index.ts` - Added builder and provider config type exports
- `data/provider-skeleton.json` - NEW: empty skeleton with 12 providers
- `package.json` - Added data/ to files array
- `src/selection/KeySelector.test.ts` - Added applyRegistryDefaults field (auto-fix)

## Decisions Made

- Pass empty Map to resolvePolicies instead of shippedDefaults: retry proxy handles runtime 429s as safety net
- applyRegistryDefaults defaults to false and is wired for future registry phase (not optional, guaranteed by Zod .default())
- Provider config types are JSDoc-annotated aliases of ProviderConfig: provides IDE discoverability without type divergence

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added applyRegistryDefaults to KeySelector test mock config**

- **Found during:** Task 1 (TypeScript compile check)
- **Issue:** KeySelector.test.ts constructs a RouterConfig object directly, missing the new required field
- **Fix:** Added `applyRegistryDefaults: false` to the mock config factory
- **Files modified:** src/selection/KeySelector.test.ts
- **Verification:** tsc --noEmit passes, vitest run passes
- **Committed in:** e23bfdc (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Necessary for correctness -- test needed new required field. No scope creep.

## Issues Encountered

None - all tasks executed smoothly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Limit builders exported and ready for user configuration
- Provider skeleton JSON bundled in npm package
- createRouter uses empty Map -- no stale defaults shipped
- Ready for Plan 08-02 (provider key acquisition docs) and Plan 08-03

---

## Self-Check: PASSED

All created files verified, all deleted files confirmed gone, all 3 commit hashes found in git log.

---

_Phase: 08-provider-policies-catalog_
_Completed: 2026-03-14_
