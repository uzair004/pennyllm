---
phase: 11
slug: developer-experience-polish
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-15
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                       |
| ---------------------- | --------------------------- |
| **Framework**          | vitest 2.1.8                |
| **Config file**        | vitest.config.ts            |
| **Quick run command**  | `npx vitest run`            |
| **Full suite command** | `npx vitest run --coverage` |
| **Estimated runtime**  | ~15 seconds                 |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run && npx tsc --noEmit`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green + `npm run build` clean
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement | Test Type | Automated Command                                         | File Exists | Status     |
| -------- | ---- | ---- | ----------- | --------- | --------------------------------------------------------- | ----------- | ---------- |
| 11-01-01 | 01   | 1    | CORE-02     | unit      | `npx vitest run tests/config.test.ts -t "multiple keys"`  | Partial     | ⬜ pending |
| 11-01-02 | 01   | 1    | DX-01       | unit      | `npx vitest run tests/config.test.ts -t "minimal config"` | Partial     | ⬜ pending |
| 11-02-01 | 02   | 1    | DX-06       | unit      | `npx vitest run tests/debug.test.ts`                      | No — Wave 0 | ⬜ pending |
| 11-03-01 | 03   | 1    | DX-07       | unit      | `npx vitest run tests/exports.test.ts`                    | Yes         | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `tests/debug.test.ts` — stubs for DX-06 (debug mode output verification)
- [ ] `tests/config.test.ts` additions — covers CORE-02 multi-key and DX-01 minimal config assertions

_Per project CLAUDE.md: "Build first, test later" — tests should be minimal validation, not exhaustive suites._

---

## Manual-Only Verifications

| Behavior                   | Requirement | Why Manual               | Test Instructions                                                    |
| -------------------------- | ----------- | ------------------------ | -------------------------------------------------------------------- |
| Documentation completeness | SC-5        | Subjective quality check | Review README quickstart, config reference, troubleshooting sections |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
