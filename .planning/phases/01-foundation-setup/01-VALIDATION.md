---
phase: 1
slug: foundation-setup
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-12
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm run test:coverage` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test && npm run lint && npm run typecheck`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 0 | CORE-01 | unit | `npx vitest run tests/config.test.ts` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 0 | DX-07 | unit | `npx vitest run tests/exports.test.ts` | ❌ W0 | ⬜ pending |
| 01-01-03 | 01 | 0 | DX-07 | unit | `npx vitest run tests/build.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/config.test.ts` — stubs for CORE-01 (config validation, JSON/YAML loading, error handling)
- [ ] `tests/exports.test.ts` — stubs for DX-07 (verifies all public types exported)
- [ ] `tests/build.test.ts` — stubs for DX-07 (checks declaration files exist after build)
- [ ] `vitest.config.ts` — test framework configuration with coverage thresholds
- [ ] Framework install: `npm install --save-dev vitest @vitest/coverage-v8`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| npm install succeeds from clean clone | CORE-01 | Requires fresh clone context | `rm -rf node_modules && npm install` |
| Build output produces .js and .d.ts | DX-07 | Build artifact verification | `npm run build && ls dist/` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
