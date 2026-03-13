---
phase: 5
slug: model-catalog-selection
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-13
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                    |
| ---------------------- | -------------------------------------------------------- |
| **Framework**          | Vitest 2.1.8                                             |
| **Config file**        | vitest.config.ts                                         |
| **Quick run command**  | `npm test -- src/catalog/ src/selection/ --reporter=dot` |
| **Full suite command** | `npm test`                                               |
| **Estimated runtime**  | ~15 seconds                                              |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- src/catalog/ src/selection/ --reporter=dot`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement | Test Type | Automated Command                                                          | File Exists | Status     |
| -------- | ---- | ---- | ----------- | --------- | -------------------------------------------------------------------------- | ----------- | ---------- |
| 05-01-01 | 01   | 1    | CAT-01      | unit      | `npm test -- src/catalog/DefaultModelCatalog.test.ts::refresh -x`          | ❌ W0       | ⬜ pending |
| 05-01-02 | 01   | 1    | CAT-02      | unit      | `npm test -- src/catalog/DefaultModelCatalog.test.ts::capabilities -x`     | ❌ W0       | ⬜ pending |
| 05-01-03 | 01   | 1    | CAT-03      | unit      | `npm test -- src/catalog/DefaultModelCatalog.test.ts::quality-tiers -x`    | ❌ W0       | ⬜ pending |
| 05-01-04 | 01   | 1    | CAT-04      | unit      | `npm test -- src/catalog/DefaultModelCatalog.test.ts::pricing -x`          | ❌ W0       | ⬜ pending |
| 05-01-05 | 01   | 1    | CAT-05      | unit      | `npm test -- src/catalog/DefaultModelCatalog.test.ts::offline-fallback -x` | ❌ W0       | ⬜ pending |
| 05-02-01 | 02   | 1    | ALGO-01     | unit      | `npm test -- src/selection/strategies/round-robin.test.ts -x`              | ❌ W0       | ⬜ pending |
| 05-02-02 | 02   | 1    | ALGO-02     | unit      | `npm test -- src/selection/strategies/least-used.test.ts -x`               | ❌ W0       | ⬜ pending |
| 05-02-03 | 02   | 1    | ALGO-03     | unit      | `npm test -- src/selection/KeySelector.test.ts::per-provider-override -x`  | ❌ W0       | ⬜ pending |
| 05-02-04 | 02   | 1    | ALGO-04     | unit      | `npm test -- src/selection/KeySelector.test.ts::skip-ineligible -x`        | ❌ W0       | ⬜ pending |
| 05-02-05 | 02   | 1    | ALGO-05     | unit      | `npm test -- src/selection/KeySelector.test.ts::custom-strategy -x`        | ❌ W0       | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `src/catalog/DefaultModelCatalog.test.ts` — covers CAT-01 through CAT-05 (refresh, capabilities, quality tiers, pricing, offline fallback)
- [ ] `src/selection/strategies/round-robin.test.ts` — covers ALGO-01 (even distribution over 100 requests)
- [ ] `src/selection/strategies/least-used.test.ts` — covers ALGO-02 (most remaining quota selection)
- [ ] `src/selection/KeySelector.test.ts` — covers ALGO-03, ALGO-04, ALGO-05 (strategy override, skip ineligible, custom strategy)

_Test infrastructure: Vitest already configured. Follow existing pattern from MemoryStorage.test.ts._

---

## Manual-Only Verifications

| Behavior                       | Requirement | Why Manual              | Test Instructions                                          |
| ------------------------------ | ----------- | ----------------------- | ---------------------------------------------------------- |
| Live API fetch from models.dev | CAT-01      | External API dependency | Verify catalog loads with live data when network available |
| OpenRouter supplementary data  | CAT-01      | External API dependency | Verify OpenRouter fills gaps for models not in models.dev  |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
