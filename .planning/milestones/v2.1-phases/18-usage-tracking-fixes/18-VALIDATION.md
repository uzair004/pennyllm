---
phase: 18
slug: usage-tracking-fixes
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                               |
| ---------------------- | --------------------------------------------------- |
| **Framework**          | vitest (not configured — CLAUDE.md says skip tests) |
| **Config file**        | none                                                |
| **Quick run command**  | `npx tsc --noEmit`                                  |
| **Full suite command** | `npx tsc --noEmit`                                  |
| **Estimated runtime**  | ~15 seconds                                         |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npx tsc --noEmit`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement | Test Type   | Automated Command  | File Exists | Status     |
| -------- | ---- | ---- | ----------- | ----------- | ------------------ | ----------- | ---------- |
| 18-01-01 | 01   | 1    | USAGE-01    | manual-only | `npx tsc --noEmit` | N/A         | ⬜ pending |
| 18-01-02 | 01   | 1    | USAGE-03    | manual-only | `npx tsc --noEmit` | N/A         | ⬜ pending |
| 18-01-03 | 01   | 1    | USAGE-06    | manual-only | `npx tsc --noEmit` | N/A         | ⬜ pending |
| 18-02-01 | 02   | 1    | USAGE-02    | manual-only | `npx tsc --noEmit` | N/A         | ⬜ pending |
| 18-02-02 | 02   | 1    | USAGE-04    | manual-only | `npx tsc --noEmit` | N/A         | ⬜ pending |
| 18-02-03 | 02   | 1    | USAGE-05    | manual-only | `npx tsc --noEmit` | N/A         | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. CLAUDE.md explicitly says "Build first, test later" and "Do NOT create test files unless the plan specifically calls for them." Compile check via `tsc --noEmit` is sufficient verification.

---

## Manual-Only Verifications

| Behavior                          | Requirement | Why Manual                          | Test Instructions                                           |
| --------------------------------- | ----------- | ----------------------------------- | ----------------------------------------------------------- |
| Rolling-30d returns accurate data | USAGE-01    | No test framework configured        | Inspect code: verify loop removed, direct window query used |
| Credit tracking survives restart  | USAGE-02    | Requires process restart simulation | Verify lifetime window type added, period key is fixed      |
| PolicyEngine handles zero limit   | USAGE-03    | No test framework configured        | Verify zero-guard ternary added before division             |
| Backoff counter with Retry-After  | USAGE-04    | No test framework configured        | Verify counter set to 1 when header present                 |
| Round-robin during cooldown       | USAGE-05    | No test framework configured        | Verify modulo uses full list length                         |
| Dedup LRU eviction                | USAGE-06    | No test framework configured        | Verify Map replacement with oldest-entry eviction           |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
