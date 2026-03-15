---
phase: 01-foundation-setup
plan: 02
subsystem: Config Validation & Public API
tags: [config, validation, zod, testing, exports]
dependency_graph:
  requires:
    - '01-01 (type system, error classes, constants)'
  provides:
    - 'Zod config schema with validation and defaults'
    - 'JSON/YAML config file loading with env var interpolation'
    - 'createRouter stub function for config validation'
    - 'Complete public API exports from main entry point'
    - 'Test suite for CORE-01 and DX-07'
  affects:
    - 'Phase 6+ (router implementation will use validated config)'
tech_stack:
  added:
    - 'Zod v3.23.0 for schema validation'
    - 'debug for config logging'
    - 'js-yaml (optional peer dependency) for YAML support'
  patterns:
    - 'Zod .default() for optional fields with sensible defaults'
    - 'configSchema.parse() for runtime validation'
    - 'Environment variable interpolation for YAML configs'
    - 'Identity function (defineConfig) for type-safe authoring'
    - 'Router stub with placeholder methods'
key_files:
  created:
    - src/config/defaults.ts
    - src/config/schema.ts
    - src/config/loader.ts
    - src/config/define-config.ts
    - src/config/index.ts
    - tests/config.test.ts
    - tests/exports.test.ts
    - tests/build.test.ts
    - tsconfig.test.json
  modified:
    - src/index.ts
    - eslint.config.js
decisions:
  - 'Used Zod .default() correctly (not .optional().default()) per RESEARCH.md pitfall'
  - 'Cast schema output to RouterConfig type to handle exactOptionalPropertyTypes strictness'
  - 'Made createRouter async (stub returns Promise for future compatibility)'
  - 'Added off() method to Router interface (missing from initial spec)'
  - 'Used conditional options pattern for ConfigError cause to satisfy exactOptionalPropertyTypes'
  - 'Created tsconfig.test.json to allow ESLint to parse test files correctly'
metrics:
  duration: 8m 6s
  tasks_completed: 2
  tests_added: 61
  files_created: 12
  commits: 2
  completed_date: '2026-03-12'
---

# Phase 01 Plan 02: Config Validation & Public API Summary

**One-liner:** Zod config schema with sensible defaults, JSON/YAML loading with environment variable interpolation, createRouter stub, and comprehensive test coverage.

## What Was Built

Added the complete configuration validation layer for the PennyLLM package:

1. **Zod Config Schema** — `configSchema` validates router configuration with sensible defaults (strategy: round-robin, storage: sqlite, budget: 0). Strict mode rejects unknown keys.

2. **Config File Loaders** — `loadConfigFile()` supports JSON and YAML formats with `${VAR}` environment variable interpolation. Throws helpful ConfigError on missing env vars or validation failures.

3. **Type-Safe Config Helper** — `defineConfig()` identity function provides IDE autocomplete with zero runtime cost.

4. **Router Stub** — `createRouter()` accepts config object or file path, validates through schema, returns placeholder router with all expected methods (model, getUsage, health, getConfig, close, on, off). Real implementation deferred to Phase 6+.

5. **Public API Exports** — Main `src/index.ts` exports all public functions, types, constants, and error classes. Users can import everything needed from the main entry point.

6. **Comprehensive Test Suite** — 61 tests across three files:
   - `config.test.ts` (23 tests) — Schema validation, defaults, rejection cases, env var interpolation, file loading
   - `exports.test.ts` (14 tests) — All public API exports verified (functions, constants, error classes)
   - `build.test.ts` (24 tests) — All 8 entry points have ESM, CJS, and .d.ts files

## Requirements Satisfied

**CORE-01 (partial)**: "Package initializes with API keys and provider configuration via TypeScript config object or JSON/YAML file"

- ✅ Config object validation through Zod schema
- ✅ JSON file loading
- ✅ YAML file loading with env var interpolation
- ✅ createRouter accepts config and returns router stub
- ⏳ Full runtime initialization deferred to Phase 6

**DX-07**: "TypeScript types exported for all configuration, events, and public API"

- ✅ All types exported from main entry point
- ✅ ConfigInput/ConfigOutput inferred from Zod schema
- ✅ Router interface exported
- ✅ All constants exported (Strategy, Provider, RouterEvent, etc.)
- ✅ All error classes exported

## Deviations from Plan

**Auto-fixed Issues (Deviation Rule 2: Missing critical functionality)**

**1. Added off() method to Router interface**

- **Found during:** Task 1 (code review)
- **Issue:** Router interface only had on() method for event listeners, but no way to unsubscribe
- **Fix:** Added off() method to Router interface and stub implementation
- **Rationale:** Event emitters need both on() and off() for proper memory management
- **Files modified:** src/config/index.ts
- **Commit:** bb65324

**2. Created tsconfig.test.json for ESLint**

- **Found during:** Task 2 (pre-commit hook failure)
- **Issue:** ESLint couldn't parse test files because tsconfig.json excludes tests/
- **Fix:** Created tsconfig.test.json extending main config, updated eslint.config.js to use project-specific parser options for test files
- **Rationale:** ESLint requires TypeScript project service to run type-aware rules
- **Files modified:** tsconfig.test.json (new), eslint.config.js
- **Commit:** 0bafe7c

## Technical Notes

**Zod Default Handling**: Used `.default()` directly on fields (not `.optional().default()`) per RESEARCH.md pitfall guidance. This makes fields optional in input type but guaranteed in output type.

**exactOptionalPropertyTypes Strictness**: Used conditional options pattern for ConfigError cause parameter:

```typescript
const options: { field?: string; cause?: Error } = {};
if (error instanceof Error) {
  options.cause = error;
}
throw new ConfigError('message', options);
```

This avoids TypeScript error when cause might be undefined.

**Type Casting**: Cast `configSchema.parse()` output to `RouterConfig` type. Zod output includes `enabled: boolean` (always present due to default), but `ProviderConfig` type has `enabled?: boolean` (optional). With exactOptionalPropertyTypes, these are incompatible. Casting is safe because schema enforces correct structure.

**Router Stub**: createRouter is async even though stub doesn't await anything. This maintains API compatibility for Phase 6+ when real async initialization is added (storage connection, model catalog loading, etc.).

## Self-Check: PASSED

**Created files verified:**

```
✓ src/config/defaults.ts
✓ src/config/schema.ts
✓ src/config/loader.ts
✓ src/config/define-config.ts
✓ src/config/index.ts
✓ tests/config.test.ts
✓ tests/exports.test.ts
✓ tests/build.test.ts
✓ tsconfig.test.json
```

**Commits verified:**

```
✓ bb65324 - feat(01-02): add config validation, loaders, and main exports
✓ 0bafe7c - test(01-02): add comprehensive test suite for config and exports
```

**Test results:**

```
✓ 61 tests pass (config: 23, exports: 14, build: 24)
✓ npm run lint passes
✓ npm run typecheck passes
✓ npm run build succeeds
```

## Next Steps

Plan 01-02 completes Phase 1 (Foundation Setup). Next:

1. **Phase 2 (Storage Layer)** — Implement StorageBackend interface with SQLite, Redis, and in-memory adapters
2. **Verify config loading** — Manually test JSON/YAML file loading with environment variables
3. **Document config schema** — Add examples to README showing minimal and full configs

---

**Plan 01-02 complete.** Config validation layer functional, all tests passing, Phase 1 complete.
