---
phase: 15-cli-validator
plan: 02
subsystem: cli
tags: [validation, api-testing, generateText, streamText, error-classification]

requires:
  - phase: 15-cli-validator
    provides: CLI types (ValidateOptions, ValidationResult), config discovery, arg parsing
provides:
  - runValidate() orchestration with real generateText+streamText API calls
  - Error classification (429=warning, 401/403=fail, timeout=warning, missing SDK=fail)
  - Dry-run mode for config validation without API calls
  - getExitCode() for CLI exit code mapping
affects: [15-cli-validator]

tech-stack:
  added: []
  patterns:
    [
      parallel-provider-sequential-key testing,
      abort-controller timeout,
      error-to-status classification,
    ]

key-files:
  created: [src/cli/validate.ts]
  modified: [src/cli/index.ts]

key-decisions:
  - 'maxOutputTokens instead of maxTokens -- AI SDK v6 renamed the parameter'
  - 'KeyConfig union handling -- typeof check for string | {key} union type'
  - 'exactOptionalPropertyTypes workaround for resolveConfig options object'

patterns-established:
  - "Validation ping pattern: maxOutputTokens: 5 with 'Respond with the word ok.' prompt"
  - 'Provider test parallelization: Promise.allSettled for providers, sequential loop for keys'

requirements-completed: [DX-01, DX-04]

duration: 3min
completed: 2026-03-18
---

# Phase 15 Plan 02: Validation Orchestration Summary

**runValidate() with real generateText+streamText API calls per provider/key, error classification, dry-run mode, and exit code mapping**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-18T18:34:08Z
- **Completed:** 2026-03-18T18:37:35Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Validation orchestration that loads config, builds chain, and tests each provider with real API calls
- Error classification maps 429 to warnings, 401/403 to failures with provider dashboard URLs, timeouts to warnings
- Dry-run mode validates config and SDK availability without making API calls
- CLI entry point wired to real runValidate with JSON output and exit code mapping

## Task Commits

Each task was committed atomically:

1. **Task 1: Validation orchestration (runValidate)** - `9c2e4b9` (feat)
2. **Task 2: Wire runValidate into CLI entry point** - `7cdda6c` (feat)

## Files Created/Modified

- `src/cli/validate.ts` - Validation orchestration: config loading, provider testing, result collection
- `src/cli/index.ts` - Updated entry point calling real runValidate with error handling

## Decisions Made

- Used `maxOutputTokens` instead of `maxTokens` -- AI SDK v6 renamed the parameter
- Handle `KeyConfig` as `string | { key: string }` union with typeof check
- Build resolveConfig options object conditionally to satisfy exactOptionalPropertyTypes

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] maxTokens renamed to maxOutputTokens in AI SDK v6**

- **Found during:** Task 1 (Validation orchestration)
- **Issue:** Plan specified `maxTokens: 5` but AI SDK v6 uses `maxOutputTokens`
- **Fix:** Changed to `maxOutputTokens: 5` in both generateText and streamText calls
- **Files modified:** src/cli/validate.ts
- **Verification:** tsc --noEmit passes
- **Committed in:** 9c2e4b9

**2. [Rule 1 - Bug] KeyConfig is a union type, not always an object**

- **Found during:** Task 1 (Validation orchestration)
- **Issue:** Plan accessed `keyConfig.key` but KeyConfig is `string | { key: string; ... }`
- **Fix:** Added `typeof keyConfig === 'string' ? keyConfig : keyConfig.key`
- **Files modified:** src/cli/validate.ts
- **Verification:** tsc --noEmit passes
- **Committed in:** 9c2e4b9

**3. [Rule 1 - Bug] exactOptionalPropertyTypes rejects `string | undefined` for `string?`**

- **Found during:** Task 1 (Validation orchestration)
- **Issue:** Passing `{ config: options.config }` where options.config may be undefined fails under exactOptionalPropertyTypes
- **Fix:** Build options object conditionally, only set config when defined
- **Files modified:** src/cli/validate.ts
- **Verification:** tsc --noEmit passes
- **Committed in:** 9c2e4b9

---

**Total deviations:** 3 auto-fixed (3 bugs)
**Impact on plan:** All auto-fixes necessary for type correctness under strict TypeScript. No scope creep.

## Issues Encountered

None beyond the type errors documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Validation orchestration complete, outputs structured JSON
- Ready for Plan 03 (pretty table formatting, colored output, verbose mode)
- `npx pennyllm validate` now makes real API calls and returns structured ValidationResult

---

_Phase: 15-cli-validator_
_Completed: 2026-03-18_
