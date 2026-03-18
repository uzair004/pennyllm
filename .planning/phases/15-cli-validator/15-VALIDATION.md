---
phase: 15
slug: cli-validator
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-18
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                           |
| ---------------------- | ------------------------------- |
| **Framework**          | vitest 2.1.8                    |
| **Config file**        | vitest via package.json scripts |
| **Quick run command**  | `tsc --noEmit && npm run build` |
| **Full suite command** | `npx vitest run`                |
| **Estimated runtime**  | ~15 seconds                     |

---

## Sampling Rate

- **After every task commit:** Run `tsc --noEmit && npm run build`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement | Test Type   | Automated Command                                         | File Exists | Status     |
| -------- | ---- | ---- | ----------- | ----------- | --------------------------------------------------------- | ----------- | ---------- |
| 15-01-01 | 01   | 1    | SC-4        | unit        | `npx vitest run tests/cli/`                               | ❌ W0       | ⬜ pending |
| 15-01-02 | 01   | 1    | SC-1        | E2E         | `npx pennyllm validate --config test-fixtures/valid.json` | ❌ W0       | ⬜ pending |
| 15-02-01 | 02   | 1    | SC-2        | E2E/manual  | Manual verification of output format                      | N/A         | ⬜ pending |
| 15-03-01 | 03   | 2    | SC-3        | E2E/manual  | Test with invalid key                                     | N/A         | ⬜ pending |
| 15-04-01 | 04   | 2    | SC-5        | code review | Verify maxTokens: 5 in test prompt                        | N/A         | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `tsup.config.ts` — updated with CLI entry point and shebang banner
- [ ] `package.json` — bin entry added for `pennyllm`
- [ ] `jiti` and `nanospinner` installed as dependencies

_Existing infrastructure covers unit test framework (vitest already installed)._

---

## Manual-Only Verifications

| Behavior                                     | Requirement | Why Manual                                    | Test Instructions                                                   |
| -------------------------------------------- | ----------- | --------------------------------------------- | ------------------------------------------------------------------- |
| Colored table output renders correctly       | SC-2        | TTY color rendering can't be verified in CI   | Run `npx pennyllm validate` in real terminal, verify colored output |
| Spinner animation during parallel execution  | SC-2        | Terminal animation requires visual inspection | Run validate, observe per-provider spinner replaced by final table  |
| Actionable error messages with provider URLs | SC-3        | Error message quality is subjective           | Test with invalid key, verify provider-specific guidance shown      |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
