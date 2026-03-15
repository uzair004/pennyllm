---
phase: 3
slug: policy-engine
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-13
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value            |
| ---------------------- | ---------------- |
| **Framework**          | Vitest 2.1.8     |
| **Config file**        | vitest.config.ts |
| **Quick run command**  | `npm test`       |
| **Full suite command** | `npm test`       |
| **Estimated runtime**  | ~30 seconds      |

---

## Project Testing Policy (CLAUDE.md)

Per project instructions in CLAUDE.md:

- **Build first, test later** — Focus on building functionality. Tests can be added as a separate phase.
- A quick smoke test or compile check (`tsc --noEmit`, `npm run build`) is sufficient verification for most tasks.
- Do NOT create test files unless the plan specifically calls for them.

**Nyquist compliance** is satisfied by existing infrastructure:

- `npx tsc --noEmit` — Catches type errors, interface mismatches, missing exports
- `npm test` — Runs existing test suite to verify no regressions from schema changes
- These automated commands are present in every task's `<verify>` block

**Wave 0 is not required** because:

- No plan tasks call for dedicated test files (per CLAUDE.md: "Do NOT create test files unless the plan specifically calls for them")
- TypeScript strict mode with `exactOptionalPropertyTypes` provides compile-time verification of contracts
- Existing config and storage contract tests catch regressions from schema updates
- Phase 12 (Testing & Validation) is the designated phase for comprehensive test suites

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green (`npm test`)
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement                                | Verify Type  | Automated Command              | Status  |
| -------- | ---- | ---- | ------------------------------------------ | ------------ | ------------------------------ | ------- |
| 03-01-01 | 01   | 1    | POLICY-01, POLICY-06, POLICY-07            | compile      | `npx tsc --noEmit`             | pending |
| 03-01-02 | 01   | 1    | POLICY-02, POLICY-03, POLICY-04, POLICY-05 | compile+test | `npx tsc --noEmit && npm test` | pending |
| 03-02-01 | 02   | 2    | POLICY-04, POLICY-06                       | compile      | `npx tsc --noEmit`             | pending |
| 03-02-02 | 02   | 2    | POLICY-01 thru POLICY-07                   | compile+test | `npx tsc --noEmit && npm test` | pending |

_Status: pending / green / red / flaky_

---

## Manual-Only Verifications

| Behavior                  | Requirement | Why Manual                | Test Instructions                                                 |
| ------------------------- | ----------- | ------------------------- | ----------------------------------------------------------------- |
| Debug log output readable | POLICY-06   | Console output formatting | Run with `DEBUG=pennyllm:*` and verify warning messages are clear |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify commands (tsc --noEmit and/or npm test)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 not required per CLAUDE.md testing policy (build first, test later)
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved (per CLAUDE.md testing policy)
