---
phase: 16-provider-data-registry
plan: 01
subsystem: registry
tags: [json-schema, validation, codegen, nodejs, awesome-list]

requires:
  - phase: none
    provides: greenfield repo scaffolding
provides:
  - JSON Schema Draft 2020-12 provider data contract
  - Zero-dependency validate.js script
  - Zero-dependency generate.js script (README.md + registry.json)
  - Contributor template file
  - CC0 license and repo scaffolding
affects: [16-02 provider data population, 16-03 community scaffolding]

tech-stack:
  added: [json-schema-draft-2020-12]
  patterns: [per-provider-json-files, auto-generated-readme, zero-dependency-scripts]

key-files:
  created:
    - awesome-free-llm-apis/schema.json
    - awesome-free-llm-apis/scripts/validate.js
    - awesome-free-llm-apis/scripts/generate.js
    - awesome-free-llm-apis/providers/_template.json
    - awesome-free-llm-apis/LICENSE
    - awesome-free-llm-apis/.editorconfig
    - awesome-free-llm-apis/.gitattributes
    - awesome-free-llm-apis/package.json
    - awesome-free-llm-apis/README.md
    - awesome-free-llm-apis/registry.json
  modified:
    - eslint.config.js

key-decisions:
  - 'Added package.json with type:commonjs to awesome-free-llm-apis/ since parent project uses ESM'
  - 'Excluded awesome-free-llm-apis/ from parent ESLint config to avoid TS type-checking on plain JS scripts'

patterns-established:
  - 'Per-provider JSON files in providers/ directory, validated against schema.json'
  - 'Files starting with _ excluded from validation (convention for templates)'
  - 'generate.js --check mode for CI-like verification without overwriting'

requirements-completed: [SC-1, SC-2, SC-3]

duration: 4min
completed: 2026-03-19
---

# Phase 16 Plan 01: Schema & Tooling Foundation Summary

**JSON Schema provider contract with zero-dependency validate.js and generate.js scripts producing README.md and registry.json**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-18T20:57:12Z
- **Completed:** 2026-03-18T21:01:08Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments

- JSON Schema Draft 2020-12 defining full provider data contract (auth, freeTier, sdk, models, rateLimitHeaders, notes, freshness)
- validate.js with field-level error reporting, enum validation, conditional checks (trial fields, openai-compat baseUrl), and single-file mode
- generate.js producing README.md (comparison table, freshness badges, per-provider sections, usage examples) and registry.json (O(1) provider lookup)
- Template file with placeholder values that validator naturally rejects

## Task Commits

Each task was committed atomically:

1. **Task 1: Create repo scaffolding, JSON Schema, and template file** - `e950b32` (feat)
2. **Task 2: Create validate.js and generate.js scripts** - `692a688` (feat)

## Files Created/Modified

- `awesome-free-llm-apis/schema.json` - JSON Schema Draft 2020-12 provider data contract
- `awesome-free-llm-apis/scripts/validate.js` - Zero-dependency provider file validator
- `awesome-free-llm-apis/scripts/generate.js` - README.md and registry.json generator
- `awesome-free-llm-apis/providers/_template.json` - Contributor template with placeholder values
- `awesome-free-llm-apis/LICENSE` - CC0 1.0 Universal public domain dedication
- `awesome-free-llm-apis/.editorconfig` - Consistent formatting (2-space indent, LF)
- `awesome-free-llm-apis/.gitattributes` - LF line endings for JSON/JS/MD
- `awesome-free-llm-apis/package.json` - CJS module type override
- `awesome-free-llm-apis/README.md` - Auto-generated (0 providers)
- `awesome-free-llm-apis/registry.json` - Auto-generated (0 providers)
- `eslint.config.js` - Added awesome-free-llm-apis/ to ignores

## Decisions Made

- Added `package.json` with `"type": "commonjs"` to awesome-free-llm-apis/ because the parent PennyLLM project uses ESM (`"type": "module"`) which would force CJS scripts to use `.cjs` extension
- Added `awesome-free-llm-apis/` to parent ESLint ignores since TypeScript-typed linting rules are incompatible with plain JavaScript utility scripts

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added package.json for CJS compatibility**

- **Found during:** Task 2 (validate.js and generate.js)
- **Issue:** Parent package.json has `"type": "module"`, causing Node.js to treat .js files as ESM and reject `require()` calls
- **Fix:** Created `awesome-free-llm-apis/package.json` with `"type": "commonjs"`
- **Files modified:** awesome-free-llm-apis/package.json
- **Verification:** Both scripts run successfully
- **Committed in:** 692a688 (Task 2 commit)

**2. [Rule 3 - Blocking] Excluded awesome-free-llm-apis/ from ESLint**

- **Found during:** Task 2 (commit hook failure)
- **Issue:** Parent ESLint config with TypeScript type-checking rules failed on plain JS files
- **Fix:** Added `awesome-free-llm-apis/` to ignores array in eslint.config.js
- **Files modified:** eslint.config.js
- **Verification:** Commit hook passes
- **Committed in:** 692a688 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes necessary for scripts to run and commits to succeed. No scope creep.

## Issues Encountered

None beyond the auto-fixed blocking issues above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Schema and tooling ready for Plan 16-02 (populating 7 provider JSON files)
- validate.js and generate.js verified on empty provider set
- Template file ready for contributor workflow

## Self-Check: PASSED

All 10 created files verified present. Both task commits (e950b32, 692a688) verified in git log.

---

_Phase: 16-provider-data-registry_
_Completed: 2026-03-19_
