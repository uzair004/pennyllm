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

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change                                                      |
| --------- | ------ | ----- | --------------------------------------------------------------- |
| v1.0      | 13     | 37    | Established core engine, provider overhaul at Phase 12          |
| v2.0      | 4      | 10    | Advanced features, first standalone repo, discuss-phase refined |

### Top Lessons (Verified Across Milestones)

1. **Reactive rate limit handling works**: Confirmed across both milestones. Internal usage tracking for observability, not routing decisions
2. **Fine-grained phases enable parallelism**: Small focused phases (2-3 plans each) execute cleanly with minimal cross-plan conflicts
3. **Provider intelligence needs constant updates**: Provider limits, models, and pricing change frequently. Staleness detection (30-day threshold) is essential
