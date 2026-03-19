# Project Retrospective

_A living document updated after each milestone. Lessons feed forward into future planning._

## Milestone: v2.0 — Advanced Features

**Shipped:** 2026-03-19
**Phases:** 4 | **Plans:** 10 | **Tasks:** 21

### What Was Built

- Credit-based limit tracking for trial providers (CreditTracker class, topUp API, expiry handling)
- Health scoring with 3-state circuit breakers (HealthScorer, rolling window, automatic recovery)
- CLI validator (`npx pennyllm validate`) with config auto-discovery, real test calls, colored output
- Standalone provider data registry (`awesome-free-llm-apis`) with 7 providers, JSON Schema, auto-generated README

### What Worked

- **Discuss-then-plan flow**: Context capture before planning produced focused, well-scoped plans with minimal rework
- **Parallel plan execution**: Wave 2 plans (16-02, 16-03) ran in parallel without conflicts
- **Existing code as template**: CreditTracker closely followed BudgetTracker patterns — fast implementation
- **Zero-dep tooling**: Phase 16 scripts using only Node.js built-ins kept the registry repo minimal

### What Was Inefficient

- **Provider data extraction**: Manual reformatting from TypeScript modules + markdown notes into JSON — could have been scripted
- **VALIDATION.md formal sign-off**: All 4 phases have VALIDATION.md files but none were formally signed off (nyquist_compliant: false)

### Patterns Established

- **CreditTracker pattern**: Parallel to BudgetTracker — config ceiling + stored consumed = remaining. Reusable for future cost-tracking features
- **Circuit breaker FSM**: closed → open (on failures) → half-open (probe) → closed (on success). Standard pattern now in codebase
- **CLI via parseArgs**: No framework needed for simple subcommands. Config auto-discovery via jiti for TypeScript config support
- **Standalone data repos**: Community resources as separate repos with JSON source of truth + auto-generated README

### Key Lessons

1. **Reactive > predictive for rate limits**: v2.0 confirmed that 429/402-driven cooldowns work well. Health scoring adds a layer on top for persistent issues, but the reactive foundation is sound
2. **Standalone data repos work**: Provider data as a separate CC0 repo is cleaner than bundling in the package. Easy to maintain, community can contribute
3. **Credit tracking needs persistence**: The "config has ceiling, storage tracks consumed" model handles restarts correctly — learned from discuss-phase that credits aren't a simple decrement

### Cost Observations

- Model mix: ~90% opus (quality profile enforced), ~10% sonnet (plan checker, verifier)
- v2.0 completed in 2 days (2026-03-18 → 2026-03-19)
- 41 commits across 4 phases
- Notable: Phase 16 (non-code, data registry) was the fastest to execute despite most discussion questions

---

## Milestone: v2.1 — Production Hardening

**Shipped:** 2026-03-20
**Phases:** 6 | **Plans:** 11 | **Requirements:** 27

### What Was Built

- Fixed 5 critical routing bugs: key rotation, 402 retry, infinite recursion, singleton pollution, async factory path
- Fixed 6 usage/tracking bugs: rolling-30d inflation, credit month-boundary, div-by-zero, cooldown backoff, round-robin drift, dedup bulk-clear
- Removed dead provider code: deleted github-models module, trimmed Provider enum from 13 to 6, removed 7 legacy config types
- Aligned public API: exported 10 missing types, consolidated StructuredUsage, added SambaNovaProviderConfig, wired FALLBACK_TRIGGERED event
- Fixed build: tsconfig.build.json for clean compilation, router.close() resource cleanup, README accuracy, SQLite migration transactions
- Closed integration gap: wrapModel/routerModel converted to async provider resolution

### What Worked

- **6-agent parallel audit**: The production readiness audit that generated v2.1's requirements was thorough — found 25 real issues across 5 dimensions
- **Bug-fix milestone scoping**: Constraining to "fix only, no features" kept scope clear and velocity high (6 phases in 2 days)
- **Cross-phase integration checker**: Caught the wrapModel/routerModel async gap that per-phase verification missed — justified the extra agent cost
- **Gap closure workflow**: `/gsd:plan-milestone-gaps` → Phase 22 → re-audit pipeline worked cleanly to close the integration gap

### What Was Inefficient

- **PROV-01/02/03 checkbox drift**: Phase 19 executor didn't update REQUIREMENTS.md checkboxes, causing audit to flag stale tracking. Should be auto-fixed by executor
- **wrapModel sync path missed in Phase 19**: The createDefault() rewrite to async-only broke wrapModel/routerModel — caught by milestone audit but could have been caught by Phase 19 verifier if it checked all callers
- **Nyquist validation never signed off**: All phases have VALIDATION.md but none marked `nyquist_compliant: true` — the workflow gate exists but isn't enforced

### Patterns Established

- **Async-only provider registry**: createDefault() uses registerAsync for all providers. Sync createProviderInstance still available for manual use but not for internal routing
- **tsconfig.build.json**: Separate build config excluding test files. IDE uses tsconfig.json, CI uses tsconfig.build.json
- **Lifetime window for credits**: Fixed bucket key that never rotates — survives month boundaries without storage migration

### Key Lessons

1. **Cross-phase integration checking is essential**: Per-phase verification catches per-phase bugs. Only a milestone-level integration checker caught the wrapModel/routerModel break
2. **Async migration is all-or-nothing per call chain**: When `createDefault()` switched to registerAsync, ALL downstream callers needed to switch too. Partial migration = runtime failures
3. **Bug-fix milestones are fast**: 27 requirements across 6 phases in 2 days. The scope constraint (no new features) is the accelerator

### Cost Observations

- Model mix: ~85% opus (quality profile), ~15% sonnet (plan checker, verifier, integration checker)
- v2.1 completed in 2 days (2026-03-19 → 2026-03-20)
- ~30 commits across 6 phases
- Notable: Phase 22 (gap closure) was 1 plan with 2 tasks — fastest phase ever

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change                                                      |
| --------- | ------ | ----- | --------------------------------------------------------------- |
| v1.0      | 13     | 37    | Established core engine, provider overhaul at Phase 12          |
| v2.0      | 4      | 10    | Advanced features, first standalone repo, discuss-phase refined |
| v2.1      | 6      | 11    | Bug-fix milestone, cross-phase integration checker proved value |

### Top Lessons (Verified Across Milestones)

1. **Reactive rate limit handling works**: Confirmed across all milestones. Internal usage tracking for observability, not routing decisions
2. **Fine-grained phases enable parallelism**: Small focused phases (2-3 plans each) execute cleanly with minimal cross-plan conflicts
3. **Provider intelligence needs constant updates**: Provider limits, models, and pricing change frequently. Staleness detection (30-day threshold) is essential
4. **Cross-phase integration auditing catches what per-phase verification misses**: v2.1 proved this — the wrapModel async break was invisible to Phase 19 verifier but caught by milestone audit
