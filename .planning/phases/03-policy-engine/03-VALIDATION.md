---
phase: 3
slug: policy-engine
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-13
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                |
| ---------------------- | -------------------- |
| **Framework**          | Vitest 2.1.8         |
| **Config file**        | vitest.config.ts     |
| **Quick run command**  | `npm test -- policy` |
| **Full suite command** | `npm test`           |
| **Estimated runtime**  | ~30 seconds          |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- policy`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement | Test Type | Automated Command                  | File Exists | Status     |
| -------- | ---- | ---- | ----------- | --------- | ---------------------------------- | ----------- | ---------- |
| 03-01-01 | 01   | 1    | POLICY-01   | unit      | `npm test -- src/policy/defaults`  | ❌ W0       | ⬜ pending |
| 03-01-02 | 01   | 1    | POLICY-07   | unit      | `npm test -- src/policy/defaults`  | ❌ W0       | ⬜ pending |
| 03-02-01 | 02   | 1    | POLICY-02   | unit      | `npm test -- src/policy/resolver`  | ❌ W0       | ⬜ pending |
| 03-02-02 | 02   | 1    | POLICY-03   | unit      | `npm test -- src/policy/resolver`  | ❌ W0       | ⬜ pending |
| 03-02-03 | 02   | 1    | POLICY-05   | unit      | `npm test -- src/policy/resolver`  | ❌ W0       | ⬜ pending |
| 03-03-01 | 03   | 1    | POLICY-04   | unit      | `npm test -- src/policy/evaluator` | ❌ W0       | ⬜ pending |
| 03-04-01 | 04   | 2    | POLICY-06   | unit      | `npm test -- src/policy/staleness` | ❌ W0       | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `tests/policy/resolver.test.ts` — covers POLICY-02, POLICY-03, POLICY-05 (merge logic, custom providers, enforcement propagation)
- [ ] `tests/policy/evaluator.test.ts` — covers POLICY-04 (all limit types: tokens, calls, rate, daily, monthly)
- [ ] `tests/policy/staleness.test.ts` — covers POLICY-06 (>30 days detection, event emission)
- [ ] `tests/policy/defaults.test.ts` — covers POLICY-01, POLICY-07 (exported policies, version format validation)
- [ ] `tests/policy/PolicyEngine.test.ts` — integration tests for evaluate() method with mocked storage

---

## Manual-Only Verifications

| Behavior                  | Requirement | Why Manual                | Test Instructions                                                   |
| ------------------------- | ----------- | ------------------------- | ------------------------------------------------------------------- |
| Debug log output readable | POLICY-06   | Console output formatting | Run with `DEBUG=llm-router:*` and verify warning messages are clear |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
