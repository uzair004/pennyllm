---
phase: 8
slug: provider-policies-catalog
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-14
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                       |
| ---------------------- | --------------------------- |
| **Framework**          | Vitest 2.x                  |
| **Config file**        | `vitest.config.ts`          |
| **Quick run command**  | `npx vitest run`            |
| **Full suite command** | `npx vitest run --coverage` |
| **Estimated runtime**  | ~3 seconds                  |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run` + `npx tsc --noEmit`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green + `npm run build`
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement        | Test Type   | Automated Command  | File Exists | Status     |
| -------- | ---- | ---- | ------------------ | ----------- | ------------------ | ----------- | ---------- |
| 08-01-01 | 01   | 1    | PROV-01 to PROV-12 | manual-only | N/A (doc files)    | N/A         | ⬜ pending |
| 08-01-02 | 01   | 1    | DX-02              | manual-only | N/A (doc files)    | N/A         | ⬜ pending |
| 08-02-01 | 02   | 1    | Config toggle      | unit        | `npx vitest run`   | ✅ existing | ⬜ pending |
| 08-02-02 | 02   | 1    | Defaults removal   | build       | `npx tsc --noEmit` | ✅ existing | ⬜ pending |
| 08-02-03 | 02   | 1    | Builder helpers    | unit        | `npx vitest run`   | ❌ W0       | ⬜ pending |
| 08-02-04 | 02   | 1    | No-limits behavior | unit        | `npx vitest run`   | ✅ existing | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] Builder helper tests — if plan specifically calls for tests (per CLAUDE.md: minimal testing during build)
- Existing infrastructure covers most phase requirements (config tests, build checks)

_Note: Per CLAUDE.md testing strategy, `tsc --noEmit` and `npm run build` are primary verification. Tests added only when plan explicitly requires them._

---

## Manual-Only Verifications

| Behavior                                 | Requirement        | Why Manual                                   | Test Instructions                                                |
| ---------------------------------------- | ------------------ | -------------------------------------------- | ---------------------------------------------------------------- |
| Provider docs exist with correct content | PROV-01 to PROV-12 | Documentation files, not code logic          | Verify `docs/providers/*.md` exist for all 12 providers          |
| Key acquisition guides are complete      | DX-02              | Documentation accuracy requires human review | Check sign-up URLs, API key page URLs, env var names in each doc |
| Empty skeleton JSON structure correct    | N/A                | Structure verification                       | Check `src/policy/provider-skeleton.json` has all 12 providers   |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
