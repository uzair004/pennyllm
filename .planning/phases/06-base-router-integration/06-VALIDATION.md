---
phase: 6
slug: base-router-integration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-13
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                    |
| ---------------------- | ------------------------ |
| **Framework**          | vitest 2.1.8             |
| **Config file**        | vitest.config.ts         |
| **Quick run command**  | `npm test`               |
| **Full suite command** | `npm test -- --coverage` |
| **Estimated runtime**  | ~15 seconds              |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --changed`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type   | Automated Command                                  | File Exists | Status     |
| ------- | ---- | ---- | ----------- | ----------- | -------------------------------------------------- | ----------- | ---------- |
| 6-01-01 | 01   | 1    | INTG-01     | unit        | `npm test -- src/wrapper/middleware.test.ts -x`    | ❌ W0       | ⬜ pending |
| 6-01-02 | 01   | 1    | INTG-04     | unit        | `npm test -- src/wrapper/key-injection.test.ts -x` | ❌ W0       | ⬜ pending |
| 6-02-01 | 02   | 1    | INTG-01     | integration | `npm test -- src/integration/wrapper.test.ts -x`   | ❌ W0       | ⬜ pending |
| 6-02-02 | 02   | 1    | INTG-04     | integration | `npm test -- src/integration/real-api.test.ts -x`  | ❌ W0       | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `src/wrapper/middleware.test.ts` — stubs for INTG-01 (middleware preserves interface)
- [ ] `src/wrapper/key-injection.test.ts` — stubs for INTG-04 (key injection pattern)
- [ ] `src/integration/wrapper.test.ts` — stubs for INTG-01 (user-facing API unchanged)
- [ ] `src/integration/real-api.test.ts` — stubs for INTG-04 (real API with rotated keys)

---

## Manual-Only Verifications

| Behavior                                                | Requirement | Why Manual                               | Test Instructions                                                                                                            |
| ------------------------------------------------------- | ----------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Real Gemini API call succeeds with cost-avoidance logic | INTG-04     | Requires real API key and network access | 1. Set GOOGLE_GENERATIVE_AI_API_KEY env var 2. Run integration test with real provider 3. Verify response and usage tracking |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
