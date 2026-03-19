# Roadmap: PennyLLM

**Project:** PennyLLM - Cost-avoidance layer for LLM API calls
**Core Value:** Never get charged for LLM API calls — rotate through free tier keys intelligently

## Milestones

- ✅ **v1.0 MVP** — Phases 1-12.1 (shipped 2026-03-17)
- ✅ **v2.0 Advanced Features** — Phases 13-16 (shipped 2026-03-19)
- **v2.1 Production Hardening** — Phases 17-22 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-12.1) — SHIPPED 2026-03-17</summary>

- [x] Phase 1: Foundation Setup (2/2 plans)
- [x] Phase 2: State Storage & Persistence (1/1 plans)
- [x] Phase 3: Policy Engine (2/2 plans)
- [x] Phase 4: Usage Tracking Core (2/2 plans)
- [x] Phase 5: Model Catalog & Selection (5/5 plans)
- [x] Phase 6: Base Router Integration (3/3 plans)
- [x] Phase 7: Integration & Error Handling (2/2 plans)
- [x] Phase 8: Provider Policies Catalog (3/3 plans)
- [x] Phase 9: Fallback & Budget Management (3/3 plans)
- [x] Phase 10: SQLite, Redis & Advanced (3/3 plans)
- [x] Phase 11: Developer Experience Polish (3/3 plans)
- [x] Phase 12: Provider Overhaul & Validation (6/6 plans)
- [x] Phase 12.1: Provider Nuance Gap Analysis (2/2 plans)

</details>

<details>
<summary>✅ v2.0 Advanced Features (Phases 13-16) — SHIPPED 2026-03-19</summary>

- [x] Phase 13: Credit-Based Limits (2/2 plans) — completed 2026-03-18
- [x] Phase 14: Health Scoring & Circuit Breakers (2/2 plans) — completed 2026-03-18
- [x] Phase 15: CLI Validator (3/3 plans) — completed 2026-03-18
- [x] Phase 16: Provider Data Registry (3/3 plans) — completed 2026-03-18

</details>

### v2.1 Production Hardening (Phases 17-22)

**Milestone Goal:** Fix all bugs found in the 6-agent production readiness audit — correct broken core features, eliminate dead code, align public API with documentation.

- [x] **Phase 17: Core Routing Fixes** - Fix broken key rotation, infinite recursion, singleton pollution, and retry logic (completed 2026-03-19)
- [x] **Phase 18: Usage & Tracking Fixes** - Fix data accuracy in usage reporting, credit tracking, cooldowns, and dedup (completed 2026-03-19)
- [x] **Phase 19: Provider Cleanup** - Remove dead provider code and align active provider setup (completed 2026-03-19)
- [x] **Phase 20: Export & Type Hygiene** - Align public API exports and types with documented surface (completed 2026-03-19)
- [x] **Phase 21: Build & Docs** - Fix compilation, cleanup, README accuracy, and crash safety (completed 2026-03-19)
- [x] **Phase 22: Async Model Wrapping** - Fix wrapModel/routerModel to use async provider registry (gap closure) (completed 2026-03-19)

## Phase Details

### Phase 17: Core Routing Fixes

**Goal**: Routing engine correctly rotates keys, handles exhaustion gracefully, and isolates router instances
**Depends on**: Nothing (highest priority — these are crash and correctness bugs)
**Requirements**: ROUTE-01, ROUTE-02, ROUTE-03, ROUTE-04, ROUTE-05
**Plans:** 2/2 plans complete

Plans:

- [ ] 17-01-PLAN.md — Fix 402 retry logic and infinite recursion guard
- [ ] 17-02-PLAN.md — Instance-scoped factories, key rotation fix, async getNextKey

**Success Criteria** (what must be TRUE):

1. When a provider has multiple API keys, each retry attempt uses a different key (not the same key repeatedly)
2. When all providers and keys are exhausted, the router throws `AllProvidersExhaustedError` with a clean stack trace (no stack overflow)
3. Two independently created router instances do not share cooldown state, usage state, or key state
4. A 402 credit-exhaustion response is never retried — it immediately marks the key as exhausted and moves to the next
5. `getNextKey` returns valid keys for providers registered via async factory functions

### Phase 18: Usage & Tracking Fixes

**Goal**: Usage reporting and tracking subsystems produce accurate data across all time windows and edge cases
**Depends on**: Phase 17 (routing must work correctly before usage data can be trusted)
**Requirements**: USAGE-01, USAGE-02, USAGE-03, USAGE-04, USAGE-05, USAGE-06
**Plans:** 2/2 plans complete

Plans:

- [ ] 18-01-PLAN.md — Fix rolling-30d inflation, PolicyEngine div-by-zero, and dedup bulk-clear
- [ ] 18-02-PLAN.md — Fix credit window month-boundary, cooldown backoff, and round-robin drift

**Success Criteria** (what must be TRUE):

1. `getUsage()` for a rolling-30d window returns token/request counts that match actual provider calls (not inflated by window multiplication)
2. Credit tracking for trial providers (SambaNova, NVIDIA NIM) reports correct remaining credits after a process restart mid-month
3. PolicyEngine evaluates `limit.value === 0` as "fully consumed" (returns 100% utilization, not `Infinity`)
4. Cooldown backoff counter stays at 1 when the provider sends a `Retry-After` header (only escalates on consecutive failures without the header)
5. Dedup set evicts oldest entries individually when full (LRU-style), preserving recent history instead of bulk-clearing all entries

### Phase 19: Provider Cleanup

**Goal**: Provider module contains only the 6 active providers with consistent configuration
**Depends on**: Phase 17 (routing fixes may touch provider registration paths)
**Requirements**: PROV-01, PROV-02, PROV-03, PROV-04, PROV-05
**Plans:** 2/2 plans complete

Plans:

- [ ] 19-01-PLAN.md — Delete github-models, remove 7 legacy enum values and 7 dead provider types
- [ ] 19-02-PLAN.md — Fix NVIDIA env var doc, rewrite createDefault() for all 6 providers

**Success Criteria** (what must be TRUE):

1. `src/providers/github-models.ts` does not exist and no import references it
2. TypeScript compilation produces no types for dropped providers (Together AI, Fireworks, Scaleway, Venice, OpenRouter, Cloudflare, Cohere)
3. `ProviderType` union contains exactly 6 values matching the active providers
4. NVIDIA provider module and its config type both reference `NVIDIA_API_KEY` (no `NVIDIA_NIM_API_KEY` mismatch)
5. `ProviderRegistry.createDefault()` returns a registry with all 6 active providers loaded and ready

### Phase 20: Export & Type Hygiene

**Goal**: Public API surface exports every type and hook documented in README and provider guides
**Depends on**: Phase 19 (provider types must be cleaned up before export alignment)
**Requirements**: TYPE-01, TYPE-02, TYPE-03, TYPE-04, TYPE-05
**Plans:** 2/2 plans complete

Plans:

- [ ] 20-01-PLAN.md — Consolidate StructuredUsage, add missing type exports, add SambaNovaProviderConfig
- [ ] 20-02-PLAN.md — Wire up FALLBACK_TRIGGERED event emission in ChainExecutor

**Success Criteria** (what must be TRUE):

1. `import { StructuredUsage } from 'pennyllm'` and `import { StructuredUsage } from 'pennyllm/types'` both resolve to the same single type definition
2. All event types documented in README (`ProviderRecoveredEvent`, credit events, error sub-events) are importable from `pennyllm`
3. `SambaNovaProviderConfig` is a named export consistent with other provider config type aliases
4. `onFallbackTriggered` either emits events on the router's EventEmitter or is removed from documentation (no dead hooks)

### Phase 21: Build & Docs

**Goal**: Package compiles cleanly, shuts down without leaks, documents reality
**Depends on**: Phase 20 (exports must be finalized before build verification)
**Requirements**: BUILD-01, BUILD-02, BUILD-03, BUILD-04
**Plans:** 2/2 plans complete

Plans:

- [ ] 21-01-PLAN.md — Fix tsc compilation (tsconfig.build.json) and router.close() resource cleanup
- [ ] 21-02-PLAN.md — Correct README dependency claim and wrap SQLite migrations in transactions

**Success Criteria** (what must be TRUE):

1. `tsc --noEmit` exits with code 0 (no rootDir violations from test file imports)
2. Calling `router.close()` removes all EventEmitter listeners and stops DebugLogger intervals (no leaked timers)
3. README states the correct dependency count (5 production dependencies)
4. SQLite schema migrations are wrapped in transactions (a crash mid-migration does not leave the database in a partial state)

### Phase 22: Async Model Wrapping

**Goal**: `router.wrapModel()` and `routerModel()` work with async-only provider registry
**Depends on**: Phase 21 (build must be clean before further changes)
**Requirements**: WRAP-01, WRAP-02
**Gap Closure**: Closes integration gap from v2.1 audit (PROV-05 partial)
**Plans:** 1/1 plans complete

Plans:

- [ ] 22-01-PLAN.md — Replace sync createProviderInstance with async createProviderInstanceAsync at both call sites

**Success Criteria** (what must be TRUE):

1. `router.wrapModel("google/gemini-2.0-flash")` resolves a valid LanguageModelV1 (no ConfigError thrown)
2. `routerModel("google/gemini-2.0-flash")` resolves a valid LanguageModelV1 (no ConfigError thrown)

## Progress

| Phase                      | Milestone | Plans Complete | Status     | Completed  |
| -------------------------- | --------- | -------------- | ---------- | ---------- |
| 1-12.1                     | v1.0      | 37/37          | Complete   | 2026-03-17 |
| 13. Credit-Based Limits    | v2.0      | 2/2            | Complete   | 2026-03-18 |
| 14. Health Scoring         | v2.0      | 2/2            | Complete   | 2026-03-18 |
| 15. CLI Validator          | v2.0      | 3/3            | Complete   | 2026-03-18 |
| 16. Provider Data Registry | v2.0      | 3/3            | Complete   | 2026-03-18 |
| 17. Core Routing Fixes     | 2/2       | Complete       | 2026-03-19 | -          |
| 18. Usage & Tracking Fixes | 2/2       | Complete       | 2026-03-19 | -          |
| 19. Provider Cleanup       | 2/2       | Complete       | 2026-03-19 | -          |
| 20. Export & Type Hygiene  | 2/2       | Complete       | 2026-03-19 | -          |
| 21. Build & Docs           | 2/2       | Complete       | 2026-03-19 | -          |
| 22. Async Model Wrapping   | 1/1       | Complete       | 2026-03-19 | -          |

## Archives

- `milestones/v2.0-ROADMAP.md` — Full v2.0 roadmap with phase details
- `milestones/v2.0-REQUIREMENTS.md` — v1+v2 requirements with traceability
- `milestones/v2.0-MILESTONE-AUDIT.md` — v2.0 audit report

---

_Roadmap created: 2026-03-11_
_v1.0 shipped: 2026-03-17_
_v2.0 shipped: 2026-03-19_
_v2.1 roadmap added: 2026-03-19_
