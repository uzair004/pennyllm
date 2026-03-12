---
phase: 1
slug: foundation-setup
status: active
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-12
updated: 2026-03-12
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm run test:coverage` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test` (if test files exist at that point)
- **After every plan wave:** Run `npm test && npm run lint && npm run typecheck`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

### Plan 01-01 (Wave 1) — Scaffolding and types

| Task ID | Task | Requirement | Test Type | Automated Command | Notes | Status |
|---------|------|-------------|-----------|-------------------|-------|--------|
| 01-01-T1 | Project scaffolding | CORE-01, DX-07 | build | `npm install && npx tsc --noEmit` | No test files yet — verifies install and compile | pending |
| 01-01-T2 | Core types, interfaces, constants, errors | CORE-01, DX-07 | build | `npx tsc --noEmit && npm run build && ls dist/index.mjs dist/index.cjs dist/index.d.ts` | Verifies types compile and build produces artifacts | pending |

### Plan 01-02 (Wave 2) — Config schema, loaders, tests

| Task ID | Task | Requirement | Test Type | Automated Command | Notes | Status |
|---------|------|-------------|-----------|-------------------|-------|--------|
| 01-02-T1 | Config schema, loader, main exports | CORE-01, DX-07 | build | `npx tsc --noEmit && npm run build` | Implementation — tests created in T2 | pending |
| 01-02-T2 | Test suite | CORE-01, DX-07 | unit | `npx vitest run tests/config.test.ts tests/exports.test.ts tests/build.test.ts` | Creates AND runs all test files | pending |

**Note:** Test files (`tests/config.test.ts`, `tests/exports.test.ts`, `tests/build.test.ts`) are created in Plan 01-02 Task 2. Plans 01-01 use build/compile verification only (no test files exist during Wave 1). This is acceptable because Wave 1 is pure scaffolding — the Nyquist requirement is satisfied by compile and build checks for type-only work, with full unit tests covering all behaviors once created in Wave 2.

*Status: pending | green | red | flaky*

---

## Wave 0 Requirements

**Not applicable.** No Wave 0 plan is needed for this phase because:

1. Plan 01-01 creates only types, interfaces, and tooling configuration — verified by `tsc --noEmit` and `npm run build` (no runtime behavior to test).
2. Plan 01-02 Task 1 creates config validation implementation — verified by `tsc --noEmit` and `npm run build`.
3. Plan 01-02 Task 2 creates all test files AND runs them — tests and implementation are in the same plan, so test scaffolding is created inline rather than requiring a separate Wave 0 plan.

The vitest framework and config file are created in Plan 01-01 Task 1 (as part of tooling setup), so the test infrastructure is available when Plan 01-02 needs it.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| npm install succeeds from clean clone | CORE-01 | Requires fresh clone context | `rm -rf node_modules && npm install` |
| Build output produces .js and .d.ts | DX-07 | Build artifact verification | `npm run build && ls dist/` |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify commands
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] No Wave 0 needed — test files created inline in Plan 01-02 Task 2
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved (revised 2026-03-12)
