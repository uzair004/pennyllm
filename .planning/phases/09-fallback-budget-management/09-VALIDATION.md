---
phase: 9
slug: fallback-budget-management
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-14
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                               |
| ---------------------- | ----------------------------------- |
| **Framework**          | vitest 2.1.8                        |
| **Config file**        | vitest.config.ts                    |
| **Quick run command**  | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --coverage`         |
| **Estimated runtime**  | ~15 seconds                         |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose` + `npx tsc --noEmit`
- **After every plan wave:** Run `npx vitest run --coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement | Test Type | Automated Command                                                                                | File Exists | Status     |
| -------- | ---- | ---- | ----------- | --------- | ------------------------------------------------------------------------------------------------ | ----------- | ---------- |
| 09-01-01 | 01   | 1    | CORE-04     | unit      | `npx vitest run src/fallback/FallbackProxy.test.ts -t "throws AllProvidersExhaustedError" -x`    | ❌ W0       | ⬜ pending |
| 09-01-02 | 01   | 1    | CORE-05     | unit      | `npx vitest run src/fallback/FallbackResolver.test.ts -t "respects per-provider behavior" -x`    | ❌ W0       | ⬜ pending |
| 09-01-03 | 01   | 1    | CAT-06      | unit      | `npx vitest run src/fallback/FallbackResolver.test.ts -t "matches capabilities" -x`              | ❌ W0       | ⬜ pending |
| 09-01-04 | 01   | 1    | CAT-07      | unit      | `npx vitest run src/fallback/FallbackResolver.test.ts -t "prefers cheapest paid" -x`             | ❌ W0       | ⬜ pending |
| 09-02-01 | 02   | 1    | CORE-06     | unit      | `npx vitest run src/budget/BudgetTracker.test.ts -t "blocks paid calls when budget exceeded" -x` | ❌ W0       | ⬜ pending |
| 09-02-02 | 02   | 1    | DX-05       | unit      | `npx vitest run src/budget/BudgetTracker.test.ts -t "emits budget:alert" -x`                     | ❌ W0       | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

Note: Per CLAUDE.md testing strategy, tests should be minimal during build phases. Wave 0 gaps are documented but test files should only be created if the plan explicitly requires them or to catch real bugs.

- [ ] `src/fallback/FallbackResolver.test.ts` — stubs for CAT-06, CAT-07, CORE-05
- [ ] `src/fallback/FallbackProxy.test.ts` — stubs for CORE-04
- [ ] `src/budget/BudgetTracker.test.ts` — stubs for CORE-06, DX-05
- Framework install: Not needed (vitest already configured)

---

## Manual-Only Verifications

| Behavior                                 | Requirement | Why Manual                     | Test Instructions                                                                                       |
| ---------------------------------------- | ----------- | ------------------------------ | ------------------------------------------------------------------------------------------------------- |
| Budget tracking persists across restarts | SC-7        | Requires process restart cycle | 1. Record usage, 2. Restart process, 3. Verify budget state restored (depends on Phase 10 SQLite/Redis) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
