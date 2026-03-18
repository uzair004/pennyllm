---
phase: 14
slug: health-scoring-circuit-breakers
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-18
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                               |
| ---------------------- | ----------------------------------- |
| **Framework**          | vitest                              |
| **Config file**        | vitest.config.ts                    |
| **Quick run command**  | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime**  | ~5 seconds                          |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status     |
| -------- | ---- | ---- | ----------- | --------- | ----------------- | ----------- | ---------- |
| 14-01-01 | 01   | 1    | CORE-03 ext | unit      | `npx vitest run`  | ❌ W0       | ⬜ pending |
| 14-01-02 | 01   | 1    | CORE-03 ext | unit      | `npx vitest run`  | ❌ W0       | ⬜ pending |
| 14-02-01 | 02   | 2    | CORE-03 ext | unit      | `npx vitest run`  | ❌ W0       | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- Existing test infrastructure covers all phase requirements — vitest already configured with full project coverage.

_If none: "Existing infrastructure covers all phase requirements."_

---

## Manual-Only Verifications

| Behavior                                 | Requirement | Why Manual                               | Test Instructions                               |
| ---------------------------------------- | ----------- | ---------------------------------------- | ----------------------------------------------- |
| Circuit breaker under real provider load | CORE-03 ext | Requires real API keys + provider outage | Use E2E test script with intentionally bad keys |

_If none: "All phase behaviors have automated verification."_

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
