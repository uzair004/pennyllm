---
phase: 13
slug: credit-based-limits
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-18
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                   |
| ---------------------- | ------------------------------------------------------- |
| **Framework**          | vitest                                                  |
| **Config file**        | vitest.config.ts                                        |
| **Quick run command**  | `npx vitest run --reporter=verbose`                     |
| **Full suite command** | `npx vitest run --reporter=verbose && npx tsc --noEmit` |
| **Estimated runtime**  | ~15 seconds                                             |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose && npx tsc --noEmit`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement   | Test Type | Automated Command | File Exists | Status     |
| -------- | ---- | ---- | ------------- | --------- | ----------------- | ----------- | ---------- |
| 13-01-01 | 01   | 1    | POLICY-04 ext | unit      | `npx vitest run`  | ❌ W0       | ⬜ pending |
| 13-01-02 | 01   | 1    | POLICY-04 ext | unit      | `npx vitest run`  | ❌ W0       | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] Test stubs created as part of implementation plans (per CLAUDE.md build-first strategy)

_Existing vitest infrastructure covers framework requirements. Tests added during implementation per project convention._

---

## Manual-Only Verifications

| Behavior                       | Requirement | Why Manual                          | Test Instructions                                                      |
| ------------------------------ | ----------- | ----------------------------------- | ---------------------------------------------------------------------- |
| Credit depletion stops routing | SC-4        | Requires real provider 402 response | Configure trial provider, exhaust credits, verify chain skips provider |

_Most behaviors have automated verification via unit tests._

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
