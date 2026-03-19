---
phase: 17-core-routing-fixes
plan: 02
subsystem: routing
tags: [key-rotation, singleton, async-factory, provider-registry, chain-executor]

requires:
  - phase: 17-core-routing-fixes
    provides: Plan 01 infinite recursion guard (depth parameter on executeChain)
provides:
  - Instance-scoped factory cache and provider registry on ChainExecutorDeps
  - Per-key async factory creation via registerAsync
  - Async provider instance creation in retry proxy getNextKey
affects: [retry-proxy, chain-executor, provider-registry]

tech-stack:
  added: []
  patterns:
    - 'Instance-scoped caching on deps object instead of module-level singletons'
    - 'registerAsync for lazy per-key provider factory creation'

key-files:
  created: []
  modified:
    - src/chain/ChainExecutor.ts
    - src/wrapper/retry-proxy.ts

key-decisions:
  - 'Factory cache and registry moved to ChainExecutorDeps fields (_factoryCache, _registry) to eliminate cross-instance pollution'
  - 'Provider registration switched from pre-built sync factory to registerAsync with per-key createFactory calls'
  - 'getNextKey switched to createProviderInstanceAsync to support async-registered providers'

patterns-established:
  - 'Instance-scoped state: mutable caches live on deps, not at module level'

requirements-completed: [ROUTE-01, ROUTE-03, ROUTE-05]

duration: 2min
completed: 2026-03-19
---

# Phase 17 Plan 02: Key Rotation, Singleton Pollution, and Async Key Fixes Summary

**Per-key factory creation via registerAsync, instance-scoped caches on deps, and async provider resolution in retry proxy**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-19T04:40:21Z
- **Completed:** 2026-03-19T04:42:21Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Factory cache and provider registry moved from module-level singletons to per-instance fields on ChainExecutorDeps, fixing cross-instance state pollution (ROUTE-03)
- Provider registration switched to registerAsync so each key rotation creates a fresh provider instance bound to the actual API key (ROUTE-01)
- getNextKey in retry-proxy now uses createProviderInstanceAsync, enabling key rotation for async-registered providers (ROUTE-05)

## Task Commits

Each task was committed atomically:

1. **Task 1: Make factory cache and provider registry instance-scoped** - `4b0d960` (fix)
2. **Task 2: Fix getNextKey to use createProviderInstanceAsync** - `bc6621b` (fix)

## Files Created/Modified

- `src/chain/ChainExecutor.ts` - Instance-scoped \_factoryCache and \_registry on deps, registerAsync for provider registration, getOrCreateFactory takes deps parameter
- `src/wrapper/retry-proxy.ts` - Import and use createProviderInstanceAsync instead of sync createProviderInstance

## Decisions Made

- Used deps object fields (\_factoryCache, \_registry) rather than WeakMap or separate class to keep changes minimal and localized
- registerAsync with arrow function `(apiKey) => mod.createFactory(apiKey)` rather than `.bind(mod)` for clarity

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Pre-existing TypeScript error in test files (storage contract import) unrelated to changes -- ignored per scope boundary rules

## Next Phase Readiness

- Key rotation, singleton isolation, and async provider support are fixed
- Phase 17 core routing fixes complete
- Ready for Phase 18 (tracking and accounting fixes)

---

_Phase: 17-core-routing-fixes_
_Completed: 2026-03-19_
