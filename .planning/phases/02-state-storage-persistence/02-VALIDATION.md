---
phase: 2
slug: state-storage-persistence
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-12
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                    |
| ---------------------- | -------------------------------------------------------- |
| **Framework**          | Vitest v2.1.8                                            |
| **Config file**        | vitest.config.ts                                         |
| **Quick run command**  | `vitest run tests/contracts/storage.contract.test.ts -x` |
| **Full suite command** | `npm test`                                               |
| **Estimated runtime**  | ~5 seconds                                               |

---

## Sampling Rate

- **After every task commit:** Run `vitest run tests/contracts/storage.contract.test.ts -x`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command                                                     | File Exists | Status     |
| ------- | ---- | ---- | ----------- | --------- | --------------------------------------------------------------------- | ----------- | ---------- |
| TBD     | 01   | 1    | USAGE-02    | contract  | `vitest run tests/contracts/storage.contract.test.ts -x`              | ❌ W0       | ⬜ pending |
| TBD     | 01   | 1    | USAGE-05    | unit      | `vitest run src/storage/MemoryStorage.test.ts -t "atomic" -x`         | ❌ W0       | ⬜ pending |
| TBD     | 01   | 1    | USAGE-05    | unit      | `vitest run src/storage/MemoryStorage.test.ts -t "race condition" -x` | ❌ W0       | ⬜ pending |
| TBD     | 01   | 1    | USAGE-02    | unit      | `vitest run src/storage/MemoryStorage.test.ts -t "stderr warning" -x` | ❌ W0       | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `tests/contracts/storage.contract.test.ts` — contract test suite for StorageBackend (USAGE-02, USAGE-05)
- [ ] `src/storage/MemoryStorage.test.ts` — MemoryStorage-specific behaviors (stderr, race conditions)

_Existing Vitest infrastructure covers framework needs. No new installs required._

---

## Manual-Only Verifications

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
