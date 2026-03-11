# LLM Router

## What This Is

A TypeScript npm package that acts as a cost-avoidance layer for LLM API calls. It manages multiple API keys across many providers (Google Gemini, Groq, OpenRouter, Chinese models, Hugging Face, Mistral, Cerebras, Cloudflare, etc.), tracks free tier usage, and intelligently routes requests to avoid charges. Built on top of Vercel AI SDK (free, open source) which handles model categorization and provider abstraction — this package only handles the key rotation, usage tracking, and cost optimization layer.

## Core Value

Never get charged for LLM API calls during side project experimentation — rotate through free tier keys intelligently so developers can build and iterate without burning cash.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Smart key rotation across multiple API keys per provider
- [ ] Free tier usage tracking (tokens, API calls, time windows)
- [ ] Configurable provider policies (rate limits, token limits, reset windows, enforcement behavior)
- [ ] Configurable fallback behavior (hard stop vs cheapest paid option vs cheaper model)
- [ ] Monthly budget cap (including $0)
- [ ] Built on Vercel AI SDK for model categorization and provider abstraction
- [ ] Comprehensive free tier provider support (Google, Groq, OpenRouter, Mistral, HuggingFace, Cerebras, Cloudflare, Chinese models)
- [ ] Text LLM models only (no video, image, audio)
- [ ] Persistent usage tracking across projects via configurable storage (SQLite default, Redis optional)
- [ ] Ships with default provider policies (researched free tier limits), user can override/add via config
- [ ] Documentation for how to obtain free tier keys from each provider
- [ ] Policy engine that codifies provider-specific limit types and enforcement behavior
- [ ] Multi-window time tracking (per-minute, daily, monthly — varies by provider)

### Out of Scope

- Video, image, audio model support — text LLMs only for v1
- API key provisioning/automation — BYOK with documentation guides
- Model categorization/selection logic — capability flags from live catalogs (models.dev, OpenRouter), quality tiers from benchmarks
- Hosted proxy service — library/SDK only for v1
- Prompt caching/optimization — different problem domain
- Full paid tier cost optimization — focus is free tier maximization, cheap paid fallback is secondary
- Admin UI / dashboard — planned for v2 (v1 is config-driven library; architecture must keep core logic UI-agnostic)

## Context

- Target users: developers building side projects who want to experiment with LLMs without cost
- Multiple API keys per provider (e.g., several accounts) to multiply free tier limits
- Vercel AI SDK (free, open source, 20M+ npm downloads) handles: "I need a reasoning model" → picks best model
- This package handles: "Use THIS specific API key for that model's provider because the others are exhausted"
- Provider policies vary significantly — some are token-based, some API-call-based, some time-windowed
- Providers differ in enforcement: hard block, throttle, or silent charging
- 45+ free LLM API providers exist (see research/FEATURES.md for catalog)
- No existing TypeScript npm package does this — closest is LLM-API-Key-Proxy (Python, proxy-based)
- OpenRouter provides 27+ free models accessible via single API key
- The base package (Vercel AI SDK) MUST be free — the whole point is avoiding costs

## Constraints

- **Runtime**: Node.js / TypeScript — npm package
- **Cost**: Preferably $0 operation, configurable budget cap for near-zero tolerance
- **Base package**: Must be free and open source (Vercel AI SDK)
- **Dependency**: Build on existing LLM routing package (not reinvent model categorization)
- **Scope**: Text LLM models only initially
- **Storage**: Configurable — SQLite for simple/local, Redis for multi-service/shared

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Library/SDK (not proxy service) | Simpler integration, runs in-process, `npm install` and done | Decided |
| Vercel AI SDK as base | Only TS SDK with native `wrapLanguageModel()` middleware, 36M/wk downloads, per-request key injection via `create*({ apiKey })`, full token usage metadata. ModelFusion was acquired and merged into it. LangChain.js has broken streaming token counts. No other viable option. | Decided |
| Not LiteLLM fork | 1M LOC Python, 2500+ commits/month (impossible to sync fork), requires Postgres+Redis infrastructure, no free-tier-specific tracking — we'd build our core value-add anyway. Use as design reference only. | Decided |
| Wrapper/decorator pattern | AI SDK's `wrapLanguageModel()` provides native middleware for intercepting generate/stream calls. Key injection via `createOpenAI({ apiKey: selectedKey })` per request — verified in research. | Decided |
| Model catalog from live APIs | models.dev (capabilities, pricing), OpenRouter API (12 use-case categories), Artificial Analysis (quality/benchmark scores). Not static files — dynamic with periodic refresh. `@tokenlens/models` as TS bridge. | Decided |
| Capability-aware fallback | Fallback respects model capabilities — reasoning model falls back to reasoning, not generic. Uses capability flags (reasoning, toolCall, vision) + quality tiers from catalog. | Decided |
| Cheap paid model fallback | When free tier exhausted and budget > $0, fall back to cheapest model with matching capabilities. DeepSeek V3.2 ($0.14/M input) offers 79% frontier quality at 89x less cost. | Decided |
| Three core abstractions only | StorageBackend (SQLite/Redis), ModelCatalog (models.dev/OpenRouter/static), SelectionStrategy (round-robin/least-used/custom). Everything else concrete. No LLM SDK abstraction — isolate in one module instead. | Decided |
| Configurable policies (not hardcoded) | Providers change limits frequently, users shouldn't wait for releases | Decided |
| Multiple keys per provider | Multiply free tier limits across accounts | Decided |
| SQLite default, Redis optional | Lower barrier (no external service), Redis for production scale | Decided |
| Post-call usage tracking | Accurate (actual tokens from provider), pre-call estimation too inaccurate | Decided |

## Architecture Notes

**Abstraction boundaries (abstract only where change is likely AND interface is stable):**
- Storage — repository pattern (SQLite ↔ Redis swap is a stated requirement)
- Model Catalog — provider pattern with fallback chain (data sources may change)
- Selection Strategy — strategy pattern (pluggable is a stated requirement)
- LLM SDK — NOT abstracted, isolated in `src/integration/ai-sdk.ts` (surface too large, leaky abstraction guaranteed)
- Config — NOT abstracted, single canonical format (TypeScript object validated with Zod)

**Design references from LiteLLM (patterns to implement in TypeScript):**
- Deployment groups (multiple keys as separate deployments sharing a model_name)
- Cooldown mechanism (disable key after N failures, auto-recover after timeout)
- Routing strategies (shuffle, usage-based, least-busy)
- Fallback chain depth limiting (prevent infinite loops)
- Priority ordering (prefer certain keys/providers)

---
*Last updated: 2026-03-12 after base package decision finalized*
