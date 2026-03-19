---
phase: 20
slug: export-type-hygiene
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 20 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value              |
| ---------------------- | ------------------ |
| **Framework**          | vitest             |
| **Config file**        | vitest.config.ts   |
| **Quick run command**  | `npx tsc --noEmit` |
| **Full suite command** | `npx vitest run`   |
| **Estimated runtime**  | ~10 seconds        |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement | Test Type         | Automated Command                                                               | File Exists | Status     |
| -------- | ---- | ---- | ----------- | ----------------- | ------------------------------------------------------------------------------- | ----------- | ---------- |
| 20-01-01 | 01   | 1    | TYPE-01     | type-check        | `npx tsc --noEmit`                                                              | ✅          | ⬜ pending |
| 20-01-02 | 01   | 1    | TYPE-02     | type-check        | `npx tsc --noEmit`                                                              | ✅          | ⬜ pending |
| 20-01-03 | 01   | 1    | TYPE-03     | type-check        | `npx tsc --noEmit`                                                              | ✅          | ⬜ pending |
| 20-01-04 | 01   | 1    | TYPE-04     | type-check + grep | `npx tsc --noEmit && grep -q 'FALLBACK_TRIGGERED' src/router/chain-executor.ts` | ✅          | ⬜ pending |
| 20-01-05 | 01   | 1    | TYPE-05     | type-check        | `npx tsc --noEmit`                                                              | ✅          | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior                              | Requirement | Why Manual                        | Test Instructions                                                                                                     |
| ------------------------------------- | ----------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Import resolves from consumer project | TYPE-01     | Requires external package install | `npm pack && cd /tmp && npm init -y && npm i pennyllm.tgz && node -e "const {StructuredUsage} = require('pennyllm')"` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
