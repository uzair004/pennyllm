---
phase: 12
slug: provider-overhaul-validation
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-17
---

# Phase 12 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                |
| ---------------------- | ------------------------------------ |
| **Framework**          | vitest (existing)                    |
| **Config file**        | vitest.config.ts                     |
| **Quick run command**  | `npx vitest run --reporter=verbose`  |
| **Full suite command** | `npx vitest run && npx tsc --noEmit` |
| **Estimated runtime**  | ~15 seconds                          |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run && npx tsc --noEmit`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement | Test Type | Automated Command                                 | File Exists | Status  |
| -------- | ---- | ---- | ----------- | --------- | ------------------------------------------------- | ----------- | ------- |
| 12-01-01 | 01   | 1    | CORE-03     | build     | `npx tsc --noEmit`                                | n/a         | pending |
| 12-01-02 | 01   | 1    | CORE-03     | build     | `npx tsc --noEmit`                                | n/a         | pending |
| 12-02-01 | 02   | 1    | CORE-03     | build     | `npx tsc --noEmit`                                | n/a         | pending |
| 12-02-02 | 02   | 1    | CORE-03     | build+run | `npx tsc --noEmit && npx vitest run`              | n/a         | pending |
| 12-03-01 | 03   | 2    | CORE-03     | build     | `npx tsc --noEmit`                                | n/a         | pending |
| 12-03-02 | 03   | 2    | CORE-03     | build+run | `npx tsc --noEmit && npx vitest run`              | n/a         | pending |
| 12-04-01 | 04   | 3    | CORE-03     | build     | `npx tsc --noEmit`                                | n/a         | pending |
| 12-04-02 | 04   | 3    | CORE-03     | build     | `npx tsc --noEmit`                                | n/a         | pending |
| 12-05-01 | 05   | 4    | CORE-03     | build     | `npx tsc --noEmit`                                | n/a         | pending |
| 12-05-02 | 05   | 4    | CORE-03     | build+run | `npx tsc --noEmit && npx vitest run`              | n/a         | pending |
| 12-05-03 | 05   | 4    | CORE-03     | build+run | `npx tsc --noEmit && npx vitest run`              | n/a         | pending |
| 12-06-01 | 06   | 5    | CORE-03     | build+run | `npx tsc --noEmit && npx vitest run`              | n/a         | pending |
| 12-06-02 | 06   | 5    | CORE-03     | build     | `npx tsc --noEmit && test -f scripts/e2e-test.ts` | n/a         | pending |

---

## Wave 0 Requirements

_Existing infrastructure covers all phase requirements -- vitest + tsc already configured._

---

## Manual-Only Verifications

| Behavior                 | Requirement | Why Manual                           | Test Instructions                                   |
| ------------------------ | ----------- | ------------------------------------ | --------------------------------------------------- |
| E2E real API calls       | CORE-03     | Requires real API keys               | Run `npx tsx scripts/e2e-test.ts` with keys in .env |
| Provider 429/402 parsing | CORE-03     | Requires triggering real rate limits | Verify via E2E script or manual curl                |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
