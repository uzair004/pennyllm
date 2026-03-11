# LLM Router

## What This Is

A TypeScript npm package that acts as a cost-avoidance layer for LLM API calls. It manages multiple API keys across many providers (Google Gemini, Groq, OpenRouter, Chinese models, Hugging Face, etc.), tracks free tier usage, and intelligently routes requests to avoid charges. Built on top of an existing LLM routing package that handles model categorization (reasoning, coding, thinking, embedding) — this package only handles the key rotation and cost optimization layer.

## Core Value

Never get charged for LLM API calls during side project experimentation — rotate through free tier keys intelligently so developers can build and iterate without burning cash.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Smart key rotation across multiple API keys per provider
- [ ] Free tier usage tracking (tokens, API calls, time windows)
- [ ] Configurable provider policies (rate limits, token limits, reset windows, enforcement behavior)
- [ ] Configurable fallback behavior (hard stop vs cheapest paid option)
- [ ] Monthly budget cap (including $0)
- [ ] Built on top of existing LLM router package for model categorization
- [ ] Comprehensive free tier provider support (Google, Groq, OpenRouter, Chinese models, Hugging Face)
- [ ] Text LLM models only (no video, image, audio)
- [ ] Persistent usage tracking across projects (state storage approach TBD after research)
- [ ] Ships with default provider policies, user can override/add via config
- [ ] Documentation for how to obtain free tier keys from each provider

### Out of Scope

- Video, image, audio model support — text LLMs only for v1
- API key provisioning/automation — BYOK with documentation guides
- Model categorization/selection logic — delegated to base routing package
- Hosted proxy service — library/SDK only for v1

## Context

- Target users: developers building side projects who want to experiment with LLMs without cost
- Multiple API keys per provider (e.g., several OpenAI accounts) to multiply free tier limits
- The base LLM routing package (TBD after research) handles: "I need a reasoning model" → picks best model
- This package handles: "Use THIS specific API key for that model's provider because the others are exhausted"
- Provider policies vary significantly — some are token-based, some API-call-based, some time-windowed
- Providers differ in enforcement: hard block, throttle, or silent charging
- Research needed: base routing package selection, comprehensive free tier catalog, routing algorithm design

## Constraints

- **Runtime**: Node.js / TypeScript — npm package
- **Cost**: Preferably $0 operation, configurable budget cap for near-zero tolerance
- **Dependency**: Must build on existing LLM routing package (not reinvent model categorization)
- **Scope**: Text LLM models only initially

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Library/SDK (not proxy service) | Simpler integration, runs in-process | — Pending |
| Build on existing router package | Avoid reinventing model categorization | — Pending (package TBD) |
| Configurable policies (not hardcoded) | Providers change limits frequently, users shouldn't wait for releases | — Pending |
| Multiple keys per provider | Multiply free tier limits across accounts | — Pending |
| Interface design | TBD after research into base package and LLM API patterns | — Pending |
| State storage approach | TBD after research — needs to track usage across projects | — Pending |

---
*Last updated: 2026-03-11 after initialization*
