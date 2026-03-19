---
phase: 21-build-docs
plan: 01
subsystem: infra
tags: [typescript, tsconfig, resource-cleanup, event-emitter]

requires:
  - phase: 19-provider-cleanup
    provides: cleaned provider enum and config types
provides:
  - tsconfig.build.json excluding test files from build compilation
  - router.close() with full resource cleanup (listeners + debugLogger)
affects: [build, testing, resource-management]

tech-stack:
  added: []
  patterns: [separate build tsconfig extending base, hoisted debugLogger for cleanup access]

key-files:
  created: [tsconfig.build.json]
  modified: [package.json, src/config/index.ts]

key-decisions:
  - 'Extend base tsconfig.json rather than duplicate compiler options'
  - 'Hoist debugLogger to closure scope so close() can detach it'
  - 'Detach debugLogger before removeAllListeners to preserve ordered cleanup'

patterns-established:
  - 'Build config: tsconfig.build.json for tsc --noEmit, base tsconfig.json for editor/vitest'

requirements-completed: [BUILD-01, BUILD-02]

duration: 2min
completed: 2026-03-19
---

# Phase 21 Plan 01: Build Fix & Close Cleanup Summary

**tsconfig.build.json excludes test files for clean tsc --noEmit; router.close() detaches DebugLogger and removes all EventEmitter listeners**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-19T11:57:28Z
- **Completed:** 2026-03-19T11:59:01Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Created tsconfig.build.json that extends base config and excludes test files from build compilation
- Updated package.json typecheck script to use tsconfig.build.json
- Fixed router.close() to detach DebugLogger and remove all EventEmitter listeners before closing storage backends

## Task Commits

Each task was committed atomically:

1. **Task 1: Create tsconfig.build.json and update typecheck script** - `f0d9393` (fix)
2. **Task 2: Fix router.close() to clean up EventEmitter and DebugLogger** - `28f0487` (fix)

## Files Created/Modified

- `tsconfig.build.json` - Build-only TypeScript config extending base, excludes test files
- `package.json` - Updated typecheck script to use tsconfig.build.json
- `src/config/index.ts` - Hoisted debugLogger, added detach + removeAllListeners to close()

## Decisions Made

- Extended base tsconfig.json rather than duplicating compiler options -- keeps a single source of truth for compiler settings
- Hoisted debugLogger to closure scope so close() can access it -- minimal change, avoids adding it to the Router interface
- Ordered cleanup: detach debugLogger first (uses individual off() calls), then removeAllListeners (bulk), then close backends

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- tsc --noEmit passes cleanly with tsconfig.build.json
- Router resource cleanup is complete, ready for Phase 21 Plan 02 (README/migration docs)

---

_Phase: 21-build-docs_
_Completed: 2026-03-19_
