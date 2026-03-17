---
phase: 12
slug: provider-overhaul-validation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-17
---

# Phase 12 — Validation Strategy

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

| Task ID  | Plan | Wave | Requirement | Test Type | Automated Command  | File Exists | Status     |
| -------- | ---- | ---- | ----------- | --------- | ------------------ | ----------- | ---------- |
| 12-01-01 | 01   | 1    | CORE-03     | build     | `npx tsc --noEmit` | ✅          | ⬜ pending |
| 12-01-02 | 01   | 1    | CORE-03     | build     | `npx tsc --noEmit` | ✅          | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

_Existing infrastructure covers all phase requirements — vitest + tsc already configured._

---

## Manual-Only Verifications

| Behavior                 | Requirement | Why Manual                           | Test Instructions                                   |
| ------------------------ | ----------- | ------------------------------------ | --------------------------------------------------- |
| E2E real API calls       | CORE-03     | Requires real API keys               | Run `npx tsx scripts/e2e-test.ts` with keys in .env |
| Provider 429/402 parsing | CORE-03     | Requires triggering real rate limits | Verify via E2E script or manual curl                |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
