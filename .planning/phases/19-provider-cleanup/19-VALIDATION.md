---
phase: 19
slug: provider-cleanup
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 19 — Validation Strategy

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

| Task ID  | Plan | Wave | Requirement | Test Type | Automated Command | File Exists       | Status     |
| -------- | ---- | ---- | ----------- | --------- | ----------------- | ----------------- | ---------- |
| 19-01-01 | 01   | 1    | PROV-01     | smoke     | `tsc --noEmit`    | N/A (compilation) | ⬜ pending |
| 19-01-02 | 01   | 1    | PROV-02     | smoke     | `tsc --noEmit`    | N/A (compilation) | ⬜ pending |
| 19-01-03 | 01   | 1    | PROV-03     | smoke     | `tsc --noEmit`    | N/A (compilation) | ⬜ pending |
| 19-01-04 | 01   | 2    | PROV-04     | manual    | Visual inspection | N/A               | ⬜ pending |
| 19-01-05 | 01   | 2    | PROV-05     | smoke     | `tsc --noEmit`    | N/A (compilation) | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. Primary validation is TypeScript compilation (`tsc --noEmit`), which requires no additional test infrastructure.

---

## Manual-Only Verifications

| Behavior                                 | Requirement | Why Manual            | Test Instructions                                                              |
| ---------------------------------------- | ----------- | --------------------- | ------------------------------------------------------------------------------ |
| NVIDIA env var doc says `NVIDIA_API_KEY` | PROV-04     | JSDoc comment content | Grep `src/types/providers.ts` for `NVIDIA_API_KEY` in NvidiaProviderConfig doc |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
