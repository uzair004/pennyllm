---
phase: 22
slug: async-model-wrapping
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 22 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                     |
| ---------------------- | ----------------------------------------- |
| **Framework**          | vitest                                    |
| **Config file**        | vitest.config.ts                          |
| **Quick run command**  | `npx tsc -p tsconfig.build.json --noEmit` |
| **Full suite command** | `npx vitest run`                          |
| **Estimated runtime**  | ~10 seconds                               |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc -p tsconfig.build.json --noEmit`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement | Test Type    | Automated Command                                                                                              | File Exists | Status     |
| -------- | ---- | ---- | ----------- | ------------ | -------------------------------------------------------------------------------------------------------------- | ----------- | ---------- |
| 22-01-01 | 01   | 1    | WRAP-01     | grep + build | `grep -q 'createProviderInstanceAsync' src/config/index.ts && npx tsc -p tsconfig.build.json --noEmit`         | ✅          | ⬜ pending |
| 22-01-02 | 01   | 1    | WRAP-02     | grep + build | `grep -q 'createProviderInstanceAsync' src/wrapper/router-model.ts && npx tsc -p tsconfig.build.json --noEmit` | ✅          | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
