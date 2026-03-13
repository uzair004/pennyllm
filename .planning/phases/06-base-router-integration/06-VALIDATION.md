---
phase: 6
slug: base-router-integration
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-13
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Per CLAUDE.md: "Build first, test later" — verification uses tsc/build checks, not test suites.

---

## Test Infrastructure

| Property               | Value                               |
| ---------------------- | ----------------------------------- |
| **Framework**          | vitest 2.1.8                        |
| **Config file**        | vitest.config.ts                    |
| **Quick run command**  | `npx tsc --noEmit`                  |
| **Full suite command** | `npx tsc --noEmit && npm run build` |
| **Estimated runtime**  | ~10 seconds                         |

---

## Sampling Rate

- **After every task commit:** `npx tsc --noEmit` (type check modified files)
- **After every plan wave:** `npx tsc --noEmit && npm run build` (full compile + build)
- **Before `/gsd:verify-work`:** Full build green + manual POC with real Gemini API call
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Verification Type | Automated Command                                                | Status     |
| ------- | ---- | ---- | ----------- | ----------------- | ---------------------------------------------------------------- | ---------- |
| 6-01-01 | 01   | 1    | INTG-01     | compile           | `npx tsc --noEmit`                                               | ⬜ pending |
| 6-01-02 | 01   | 1    | INTG-01     | compile           | `npx tsc --noEmit`                                               | ⬜ pending |
| 6-01-03 | 01   | 1    | INTG-04     | compile + build   | `npx tsc --noEmit && npm run build`                              | ⬜ pending |
| 6-02-01 | 02   | 2    | INTG-04     | compile           | `npx tsc --noEmit`                                               | ⬜ pending |
| 6-02-02 | 02   | 2    | INTG-04     | manual POC        | `GOOGLE_GENERATIVE_AI_API_KEY=key npx tsx scripts/poc-gemini.ts` | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

None. Per CLAUDE.md testing strategy: "Build first, test later." Type checking and build verification are sufficient for this phase. Test files can be added in a separate testing phase.

---

## Manual-Only Verifications

| Behavior                                                | Requirement | Why Manual                               | Test Instructions                                                                                                                            |
| ------------------------------------------------------- | ----------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Real Gemini API call succeeds with cost-avoidance logic | INTG-04     | Requires real API key and network access | 1. Set GOOGLE_GENERATIVE_AI_API_KEY env var 2. Run `npx tsx scripts/poc-gemini.ts` 3. Verify response text, usage > 0, router usage recorded |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify commands (tsc/build checks)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] No Wave 0 test scaffolds needed (build-first approach per CLAUDE.md)
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
