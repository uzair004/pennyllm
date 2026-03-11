# Project State: LLM Router

**Last updated:** 2026-03-12
**Current phase:** Phase 1 (Foundation Setup)
**Status:** Roadmap approved — ready to plan Phase 1

## Project Reference

**Core value:** Never get charged for LLM API calls — rotate through free tier keys intelligently so developers can experiment without burning cash.

**Current focus:** Roadmap approved with 12 phases, 55 v1 requirements mapped. Base package decided (Vercel AI SDK). Ready to plan Phase 1.

## Current Position

**Phase:** 1 - Foundation Setup
**Plan:** None (awaiting `/gsd:plan-phase 1`)
**Status:** Not started
**Progress:** `[----------] 0%` (0/12 phases complete)

## Performance Metrics

### Velocity
- **Phases completed:** 0/12
- **Plans completed:** 0/?
- **Average phase duration:** N/A (no phases complete)
- **Estimated completion:** TBD (depends on plan decomposition)

### Quality
- **Requirements coverage:** 55/55 (100%)
- **Success criteria defined:** 4-10 per phase (all phases)
- **Validation gates:** 2 research milestones identified (Phase 6, Phase 8)

### Efficiency
- **Blocked tasks:** 0
- **Rework incidents:** 0
- **Research depth:** Complete (architecture designed, base package decided, phase structure validated)

## Accumulated Context

### Key Decisions

| Date | Decision | Rationale | Impact |
|------|----------|-----------|---------|
| 2026-03-11 | 12-phase fine-grained structure | Requirements naturally cluster into focused deliverables | Phases 1-5 are independent testable units, Phases 6-12 build integration |
| 2026-03-11 | Core Engine first (Phases 1-5) | Zero external dependencies, highest-risk logic | Can prove architecture before integrating Vercel AI SDK |
| 2026-03-11 | Research gates at Phase 6 & 8 | Base router requires POC, free tier limits require empirical validation | Prevents premature commitment |
| 2026-03-12 | Vercel AI SDK as base (decided) | Only TS SDK with native `wrapLanguageModel()` middleware, 36M/wk downloads, per-request key injection. Evaluated 10 alternatives. | Core integration point for Phase 6+ |
| 2026-03-12 | Rejected LiteLLM fork | Python (1M LOC), requires Postgres+Redis infrastructure, 2500 commits/month impossible to sync, no free-tier tracking | Use as design reference only |
| 2026-03-12 | Model catalog from live APIs | models.dev (primary), OpenRouter (categories), Artificial Analysis (quality tiers). Not static files. | Phase 5 implements ModelCatalog interface |
| 2026-03-12 | Capability-aware fallback | Reasoning → reasoning, not generic. Quality tiers from benchmarks. Cheap paid fallback when budget > $0. | Phase 9 implements fallback chains |
| 2026-03-12 | Three abstractions only | StorageBackend, ModelCatalog, SelectionStrategy. No LLM SDK abstraction. Everything else concrete. | Prevents over-abstraction, keeps codebase navigable |

### Active TODOs

**Immediate:**
- [ ] Run `/gsd:plan-phase 1` to decompose Foundation Setup into executable plans

**Phase 6 prerequisite (before starting Phase 6):**
- [ ] Test `wrapLanguageModel()` middleware with key injection
- [ ] Validate `result.usage` token metadata extraction
- [ ] Confirm streaming `onFinish` callback for usage tracking
- [ ] Test `create*({ apiKey })` provider instance creation overhead

**Phase 8 prerequisite (before starting Phase 8):**
- [ ] Create test accounts for 12 providers
- [ ] Empirically validate free tier limits
- [ ] Document enforcement behaviors and reset timing

### Known Blockers

**None currently.** Phase 1 has no external dependencies.

### Open Questions

1. **Storage schema design** — Single table with JSON columns or normalized schema? (Phase 2)
2. **Time window implementation** — Store raw events or pre-aggregated counters? (Phase 4)
3. **Selection algorithm default** — Round-robin or least-used? (Phase 5)
4. **Model catalog refresh interval** — How often to re-fetch from live APIs? (Phase 5)

### Technical Debt

**None yet** (project not started).

## Session Continuity

### What Just Happened
- Deep-dived Vercel AI SDK vs LiteLLM fork vs building fresh — decided Vercel AI SDK
- Evaluated 10 TypeScript LLM SDKs — AI SDK is the only one with native middleware
- Researched model categorization — live APIs (models.dev, OpenRouter, Artificial Analysis) provide capabilities, categories, quality tiers
- Added 7 new requirements (CAT-01 through CAT-07) for model catalog and capability-aware fallback
- Updated roadmap: Phase 5 expanded (catalog + selection), Phase 9 expanded (capability-aware fallback)
- All planning docs updated and committed (55 requirements, 12 phases, 100% coverage)
- **Roadmap approved by user**

### What's Next
- Run `/gsd:plan-phase 1` to decompose Foundation Setup into executable plans
- Phase 1: TypeScript scaffolding, build tooling, core interfaces, domain types, Zod config schema
- Success when: npm install works, TypeScript compiles, build produces dist/ folder, interfaces defined

### Context for Next Session
- TypeScript npm package (not web app or CLI tool)
- Standard npm package conventions — flat src/, debug for logging, EventEmitter for events
- Three interfaces only: StorageBackend, ModelCatalog, SelectionStrategy
- Vercel AI SDK is a peer dependency, not wrapped behind our own abstraction
- LiteLLM Router patterns are design reference (deployment groups, cooldown, weighted routing)
- Phases 1-5 are testable without external APIs

---

*State tracking started: 2026-03-11*
*Last updated: 2026-03-12 — Roadmap approved, ready for Phase 1 planning*
