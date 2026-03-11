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
- Model categorization/selection logic — delegated to Vercel AI SDK
- Hosted proxy service — library/SDK only for v1
- Prompt caching/optimization — different problem domain
- Cost tracking for paid tiers — focus is free tier maximization

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
| Library/SDK (not proxy service) | Simpler integration, runs in-process | — Pending |
| Vercel AI SDK as base | Free, open source, 20M+ downloads, TypeScript-first, 20+ providers | — Pending (needs POC validation) |
| Wrapper/decorator pattern | Non-invasive, preserves AI SDK's full API, swappable | — Pending (needs key injection verification) |
| Configurable policies (not hardcoded) | Providers change limits frequently, users shouldn't wait for releases | — Pending |
| Multiple keys per provider | Multiply free tier limits across accounts | — Pending |
| SQLite default, Redis optional | Lower barrier (no external service), Redis for production scale | — Pending |
| Post-call usage tracking | Accurate (actual tokens from provider), pre-call estimation too inaccurate | — Pending |

---
*Last updated: 2026-03-11 after research complete*
