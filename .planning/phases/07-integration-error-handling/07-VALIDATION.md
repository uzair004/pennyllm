---
phase: 7
slug: integration-error-handling
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-13
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                               |
| ---------------------- | ----------------------------------- |
| **Framework**          | vitest 2.1.8                        |
| **Config file**        | vitest.config.ts                    |
| **Quick run command**  | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run`                    |
| **Estimated runtime**  | ~10 seconds                         |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit && npx vitest run`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement | Test Type | Automated Command                                                   | File Exists  | Status  |
| -------- | ---- | ---- | ----------- | --------- | ------------------------------------------------------------------- | ------------ | ------- |
| 07-01-01 | 01   | 1    | INTG-03     | unit      | `npx vitest run tests/error-classifier.test.ts -t "429" -x`         | No -- Wave 0 | pending |
| 07-01-02 | 01   | 1    | INTG-03     | unit      | `npx vitest run tests/error-classifier.test.ts -t "401" -x`         | No -- Wave 0 | pending |
| 07-01-03 | 01   | 1    | INTG-03     | unit      | `npx vitest run tests/error-classifier.test.ts -t "network" -x`     | No -- Wave 0 | pending |
| 07-01-04 | 01   | 1    | INTG-03     | unit      | `npx vitest run tests/error-classifier.test.ts -t "suggestion" -x`  | No -- Wave 0 | pending |
| 07-02-01 | 02   | 1    | INTG-05     | unit      | `npx vitest run tests/retry-proxy.test.ts -t "doGenerate retry" -x` | No -- Wave 0 | pending |
| 07-02-02 | 02   | 1    | INTG-05     | unit      | `npx vitest run tests/retry-proxy.test.ts -t "doStream retry" -x`   | No -- Wave 0 | pending |
| 07-02-03 | 02   | 1    | INTG-05     | unit      | `npx vitest run tests/retry-proxy.test.ts -t "no mid-stream" -x`    | No -- Wave 0 | pending |
| 07-03-01 | 03   | 2    | INTG-02     | smoke     | `npx tsc --noEmit`                                                  | Yes          | pending |
| 07-03-02 | 03   | 2    | INTG-02     | smoke     | `npx tsc --noEmit`                                                  | Yes          | pending |

_Status: pending / green / red / flaky_

---

## Wave 0 Requirements

- [ ] `tests/error-classifier.test.ts` -- stubs for INTG-03 (error classification)
- [ ] `tests/retry-proxy.test.ts` -- stubs for INTG-05 (retry with mock models)
- Note: Per CLAUDE.md, "Build first, test later" -- tests only if plan requires them or to catch real bugs. Wave 0 test files are optional during implementation; `tsc --noEmit` is the primary verification.

_If none: "Existing infrastructure covers all phase requirements."_

---

## Manual-Only Verifications

| Behavior                      | Requirement | Why Manual                              | Test Instructions                                              |
| ----------------------------- | ----------- | --------------------------------------- | -------------------------------------------------------------- |
| Streaming with real provider  | INTG-05     | Requires live API key + real latency    | Run example script with `streamText()`, observe chunks flowing |
| Tool calling passthrough      | INTG-02     | Requires real model that supports tools | Use generateText with tools param, verify tool calls returned  |
| Structured output passthrough | INTG-02     | Requires real model + schema validation | Use generateObject with zod schema, verify typed response      |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
