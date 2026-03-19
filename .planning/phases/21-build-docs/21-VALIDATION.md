---
phase: 21
slug: build-docs
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 21 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                     |
| ---------------------- | ----------------------------------------- |
| **Framework**          | vitest                                    |
| **Config file**        | vitest.config.ts                          |
| **Quick run command**  | `npx tsc -p tsconfig.build.json --noEmit` |
| **Full suite command** | `npx vitest run`                          |
| **Estimated runtime**  | ~15 seconds                               |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc -p tsconfig.build.json --noEmit`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement | Test Type    | Automated Command                                                                                      | File Exists | Status     |
| -------- | ---- | ---- | ----------- | ------------ | ------------------------------------------------------------------------------------------------------ | ----------- | ---------- |
| 21-01-01 | 01   | 1    | BUILD-01    | build        | `npx tsc -p tsconfig.build.json --noEmit`                                                              | ❌ W0       | ⬜ pending |
| 21-01-02 | 01   | 1    | BUILD-02    | grep + build | `grep -q 'removeAllListeners' src/router/createPennyLLM.ts && npx tsc -p tsconfig.build.json --noEmit` | ✅          | ⬜ pending |
| 21-02-01 | 02   | 1    | BUILD-03    | grep         | `grep -q '5 production dependencies' README.md`                                                        | ✅          | ⬜ pending |
| 21-02-02 | 02   | 1    | BUILD-04    | grep         | `grep -q 'transaction' src/sqlite/migrations.ts`                                                       | ✅          | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `tsconfig.build.json` — build-only config excluding test files (created by BUILD-01 task)

_If none: "Existing infrastructure covers all phase requirements."_

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
