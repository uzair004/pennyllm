---
phase: 10
slug: sqlite-redis-advanced-features
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-14
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                               |
| ---------------------- | ----------------------------------- |
| **Framework**          | vitest                              |
| **Config file**        | vitest.config.ts                    |
| **Quick run command**  | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime**  | ~15 seconds                         |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement | Test Type | Automated Command                                    | File Exists | Status     |
| -------- | ---- | ---- | ----------- | --------- | ---------------------------------------------------- | ----------- | ---------- |
| 10-01-01 | 01   | 1    | USAGE-02    | contract  | `npx vitest run tests/contracts/storage.contract.ts` | ❌ W0       | ⬜ pending |
| 10-01-02 | 01   | 1    | USAGE-02    | contract  | `npx vitest run tests/contracts/storage.contract.ts` | ❌ W0       | ⬜ pending |
| 10-02-01 | 02   | 1    | DX-03       | unit      | `npx vitest run`                                     | ❌ W0       | ⬜ pending |
| 10-03-01 | 03   | 1    | DX-04       | unit      | `npx vitest run`                                     | ❌ W0       | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] Contract test runner configured for async storage backends (Redis needs real/mock server)
- [ ] SQLite test DB path set to `:memory:` or temp directory for test isolation
- [ ] Redis test skipping when no Redis server available

_Existing `createStorageContractTests()` infrastructure covers base contract verification._

---

## Manual-Only Verifications

| Behavior                       | Requirement | Why Manual                          | Test Instructions                                                   |
| ------------------------------ | ----------- | ----------------------------------- | ------------------------------------------------------------------- |
| Redis multi-process atomicity  | USAGE-02    | Requires multiple Node.js processes | Spawn 2+ workers, concurrent increments, verify final count         |
| Redis connection failure error | USAGE-02    | Requires network simulation         | Start with bad Redis URL, verify error thrown (not silent fallback) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
