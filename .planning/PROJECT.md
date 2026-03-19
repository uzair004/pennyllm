# PennyLLM

## What This Is

A TypeScript npm package that acts as a cost-avoidance layer for LLM API calls. Manages multiple API keys across 7 providers (Cerebras, Google AI Studio, Groq, GitHub Models, SambaNova, NVIDIA NIM, Mistral), tracks free tier usage, and intelligently routes requests through user-configured model priority chains to avoid charges. Built on Vercel AI SDK with reactive 429/402-driven cooldowns, health scoring with circuit breakers, credit tracking for trial providers, and a CLI validator.

## Core Value

Never get charged for LLM API calls during side project experimentation — rotate through free tier keys intelligently so developers can build and iterate without burning cash.

## Current State

**Shipped:** v1.0 (core engine, 12 phases) + v2.0 (advanced features, 4 phases)
**Codebase:** 11,617 lines TypeScript, 47 plans executed across 17 phases
**npm package:** `pennyllm`

### What's Built

- User-configured model priority chains with reactive 429/402 cooldowns
- 7 provider modules with curated model registries and typed model IDs
- Credit-based limit tracking for trial providers (SambaNova, NVIDIA NIM)
- Health scoring with 3-state circuit breakers (closed/open/half-open)
- CLI validator (`npx pennyllm validate`) with config auto-discovery
- SQLite + Redis storage adapters, observability hooks, debug mode
- Standalone provider data registry (`awesome-free-llm-apis` repo)

## Requirements

### Validated

- ✓ Smart key rotation across multiple API keys per provider — v1.0
- ✓ Free tier usage tracking (tokens, API calls, time windows) — v1.0
- ✓ Configurable provider policies (rate limits, token limits, reset windows) — v1.0
- ✓ Configurable fallback behavior (hard stop vs cheapest paid vs alternative) — v1.0
- ✓ Monthly budget cap (including $0) — v1.0
- ✓ Built on Vercel AI SDK with wrapLanguageModel middleware — v1.0
- ✓ 7 provider support (Cerebras, Google, Groq, GitHub Models, SambaNova, NVIDIA NIM, Mistral) — v1.0
- ✓ Text LLM models only — v1.0
- ✓ Persistent usage tracking via SQLite/Redis — v1.0
- ✓ Ships with default provider policies, user can override — v1.0
- ✓ Policy engine with multi-window time tracking — v1.0
- ✓ Credit-based limits for trial providers — v2.0
- ✓ Health scoring with circuit breakers — v2.0
- ✓ CLI validator with config auto-discovery — v2.0
- ✓ Provider data registry as community resource — v2.0

### Active

(None — next milestone requirements TBD)

### Out of Scope

- Video, image, audio model support — text LLMs only
- API key provisioning/automation — BYOK with documentation guides
- Hosted proxy service — library/SDK only
- Prompt caching/optimization — different problem domain
- Full paid tier cost optimization — focus is free tier maximization
- Admin UI / dashboard — deferred (architecture is UI-agnostic)
- Advanced routing (forecasting, prediction) — deferred
- Extended providers (Together AI, Fireworks, Scaleway, Venice) — deferred
- Enterprise features (multi-tenant, centralized policy) — deferred

## Context

- Target users: developers building side projects who want to experiment with LLMs without cost
- Multiple API keys per provider to multiply free tier limits
- Vercel AI SDK handles model abstraction; PennyLLM handles key rotation, usage tracking, cost optimization
- User-configured model priority chains replaced catalog-based fallback in v1.0 Phase 12
- Reactive limit handling: provider 429/402 drives cooldown and fallback, not internal usage estimation
- 7 target providers verified with real API calls; 8 providers dropped during Phase 12 overhaul
- Provider data registry (`awesome-free-llm-apis`) is standalone, not part of PennyLLM runtime

## Constraints

- **Runtime**: Node.js / TypeScript — npm package
- **Cost**: Preferably $0 operation, configurable budget cap for near-zero tolerance
- **Base package**: Vercel AI SDK (free, open source, 36M/wk downloads)
- **Scope**: Text LLM models only
- **Storage**: Configurable — SQLite for simple/local, Redis for multi-service/shared
- **TypeScript**: `exactOptionalPropertyTypes` enabled, Zod v3.23.0 (AI SDK compat)

## Key Decisions

| Decision                                 | Rationale                                                                   | Outcome |
| ---------------------------------------- | --------------------------------------------------------------------------- | ------- |
| Library/SDK (not proxy service)          | Simpler integration, runs in-process                                        | ✓ Good  |
| Vercel AI SDK as base                    | Only TS SDK with native middleware, 36M/wk downloads                        | ✓ Good  |
| Three core abstractions only             | StorageBackend, ModelCatalog, SelectionStrategy. No over-abstraction        | ✓ Good  |
| User-configured model chains             | Replaced broken catalog-based fallback. Users control priority order        | ✓ Good  |
| Reactive 429/402 cooldowns               | No internal usage estimation for routing. Provider response drives fallback | ✓ Good  |
| Per-key cooldowns (independent accounts) | Each key = independent pool. Escalating backoff with 15min cap              | ✓ Good  |
| Credit tracking via usage estimation     | Config has ceiling, storage tracks consumed, 402 confirms exhaustion        | ✓ Good  |
| Health scoring always-on                 | HealthScorer with rolling window, circuit breaker FSM. No opt-out needed    | ✓ Good  |
| CLI via Node.js parseArgs                | Zero dependencies. One subcommand doesn't need commander/yargs              | ✓ Good  |
| Provider data as standalone repo         | Community resource, not runtime dependency. CC0 license                     | ✓ Good  |
| 7 providers (dropped 8)                  | Focus on verified, actively maintained free tiers                           | ✓ Good  |
| Post-call usage tracking                 | Accurate (actual tokens from provider)                                      | ✓ Good  |

## Architecture Notes

**Core request flow:** `wrapModel()` → middleware → ChainExecutor → RetryProxy → provider API

**Abstraction boundaries:**

- Storage — repository pattern (Memory/SQLite/Redis)
- Model Catalog — provider pattern with fallback chain (demoted from routing to enrichment)
- Selection Strategy — strategy pattern (round-robin/least-used/priority/custom)
- LLM SDK — NOT abstracted, isolated in provider modules

**v2.0 additions:**

- CreditTracker — parallel to BudgetTracker, handles trial-tier providers
- HealthScorer — rolling window with circuit breaker FSM (closed/open/half-open)
- CLI entry point — `src/cli/` with validate subcommand, config auto-discovery via jiti

---

_Last updated: 2026-03-19 after v2.0 milestone_
