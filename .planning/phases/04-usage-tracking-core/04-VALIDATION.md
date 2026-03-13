---
phase: 4
slug: usage-tracking-core
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-13
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                   |
| ---------------------- | --------------------------------------- |
| **Framework**          | Vitest ^2.1.8 (already in package.json) |
| **Config file**        | vitest.config.ts (existing)             |
| **Quick run command**  | `npm test -- --run usage`               |
| **Full suite command** | `npm test`                              |
| **Estimated runtime**  | ~5 seconds                              |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --run usage`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement | Test Type | Automated Command                              | File Exists | Status     |
| -------- | ---- | ---- | ----------- | --------- | ---------------------------------------------- | ----------- | ---------- |
| 04-01-01 | 01   | 1    | USAGE-03    | unit      | `npm test -- --run usage/periods.test.ts`      | ❌ W0       | ⬜ pending |
| 04-01-02 | 01   | 1    | USAGE-04    | unit      | `npm test -- --run usage/periods.test.ts`      | ❌ W0       | ⬜ pending |
| 04-02-01 | 02   | 1    | USAGE-01    | unit      | `npm test -- --run usage/UsageTracker.test.ts` | ❌ W0       | ⬜ pending |
| 04-02-02 | 02   | 1    | USAGE-06    | unit      | `npm test -- --run usage/UsageTracker.test.ts` | ❌ W0       | ⬜ pending |
| 04-03-01 | 03   | 1    | USAGE-03    | unit      | `npm test -- --run usage/UsageTracker.test.ts` | ❌ W0       | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `src/usage/UsageTracker.test.ts` — covers USAGE-01, USAGE-06
- [ ] `src/usage/periods.test.ts` — covers USAGE-03, USAGE-04 (calendar + rolling windows)
- [ ] `src/usage/estimation.test.ts` — character ratio accuracy, pluggable estimator
- [ ] `src/usage/cooldown.test.ts` — 429 handling, Retry-After parsing
- [ ] Update `src/storage/MemoryStorage.test.ts` — call count support, calendar period keys

_If none: "Existing infrastructure covers all phase requirements."_

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
| -------- | ----------- | ---------- | ----------------- |
| _None_   | —           | —          | —                 |

_All phase behaviors have automated verification._

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
