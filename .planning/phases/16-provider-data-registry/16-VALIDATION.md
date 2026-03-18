---
phase: 16
slug: provider-data-registry
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                          |
| ---------------------- | -------------------------------------------------------------- |
| **Framework**          | Node.js built-in assert + scripts                              |
| **Config file**        | none — scripts are self-contained                              |
| **Quick run command**  | `node scripts/validate.js`                                     |
| **Full suite command** | `node scripts/validate.js && node scripts/generate.js --check` |
| **Estimated runtime**  | ~2 seconds                                                     |

---

## Sampling Rate

- **After every task commit:** Run `node scripts/validate.js`
- **After every plan wave:** Run `node scripts/validate.js && node scripts/generate.js --check`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 2 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement | Test Type | Automated Command          | File Exists | Status     |
| -------- | ---- | ---- | ----------- | --------- | -------------------------- | ----------- | ---------- |
| 16-01-01 | 01   | 1    | SC-1        | schema    | `node scripts/validate.js` | ❌ W0       | ⬜ pending |
| 16-01-02 | 01   | 1    | SC-2        | schema    | `node scripts/validate.js` | ❌ W0       | ⬜ pending |
| 16-02-01 | 02   | 1    | SC-1        | manual    | inspect JSON files         | ❌ W0       | ⬜ pending |
| 16-03-01 | 03   | 2    | SC-3        | manual    | inspect CONTRIBUTING.md    | ❌ W0       | ⬜ pending |
| 16-04-01 | 04   | 2    | SC-4        | manual    | inspect PennyLLM docs      | ❌ W0       | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `scripts/validate.js` — JSON schema validation script
- [ ] `schema.json` — JSON Schema definition for provider files

_If none: "Existing infrastructure covers all phase requirements."_

---

## Manual-Only Verifications

| Behavior               | Requirement | Why Manual                             | Test Instructions                                                  |
| ---------------------- | ----------- | -------------------------------------- | ------------------------------------------------------------------ |
| Provider data accuracy | SC-2        | Data correctness requires human review | Cross-reference each provider JSON with docs/providers/notes/\*.md |
| README readability     | SC-3        | Layout quality is subjective           | Visual review of generated README.md                               |
| PennyLLM docs linking  | SC-4        | Cross-repo link validity               | Navigate from PennyLLM README to registry repo                     |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 2s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
