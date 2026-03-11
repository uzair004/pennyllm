# Requirements: LLM Router

**Defined:** 2026-03-11
**Core Value:** Never get charged for LLM API calls — rotate through free tier keys intelligently so developers can experiment without burning cash.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Core Engine

- [ ] **CORE-01**: Package initializes with API keys and provider configuration via TypeScript config object or JSON/YAML file
- [ ] **CORE-02**: User can configure multiple API keys per provider (e.g., 3 Google keys, 2 Groq keys)
- [ ] **CORE-03**: Router automatically selects the best available key for each request based on usage and limits
- [ ] **CORE-04**: Router enforces hard-stop when all keys for a provider are exhausted (no request made, error thrown)
- [ ] **CORE-05**: User can configure fallback behavior per provider (hard stop, cheapest paid model, or alternative free provider)
- [ ] **CORE-06**: User can set monthly budget cap including $0 (never spend money)

### Usage Tracking

- [ ] **USAGE-01**: Router tracks token usage (prompt + completion) per API key after each request
- [ ] **USAGE-02**: Usage data persists across application restarts via SQLite (default) or Redis (optional)
- [ ] **USAGE-03**: Router tracks multiple time windows per provider (per-minute rate limits, daily request caps, monthly token quotas)
- [ ] **USAGE-04**: Time windows reset correctly based on provider policy (calendar month, rolling 30 days, per-minute sliding window)
- [ ] **USAGE-05**: Usage tracking handles concurrent requests atomically (no race conditions causing overage)
- [ ] **USAGE-06**: Router reconciles estimated vs actual token usage from provider response

### Policy Engine

- [ ] **POLICY-01**: Package ships with default policies for all supported providers (researched free tier limits)
- [ ] **POLICY-02**: User can override default policies via configuration (custom limits, custom reset windows)
- [ ] **POLICY-03**: User can add policies for providers not included in defaults
- [ ] **POLICY-04**: Policies support diverse limit types: token-based, API-call-based, request-per-minute, daily caps, monthly quotas
- [ ] **POLICY-05**: Policies include enforcement behavior metadata (hard block, throttle, silent charge) per provider
- [ ] **POLICY-06**: Package warns when shipped policy data is older than 30 days (staleness detection)
- [ ] **POLICY-07**: Policies are versioned with timestamps for audit trail

### Integration

- [ ] **INTG-01**: Package wraps Vercel AI SDK via decorator pattern (user continues using generateText/streamText)
- [ ] **INTG-02**: Wrapper preserves all AI SDK features (streaming, tool calling, structured output)
- [ ] **INTG-03**: Router classifies errors (rate limit 429, auth 401, network, quota exhausted) with actionable messages
- [ ] **INTG-04**: Router injects selected API key per request without user managing key selection
- [ ] **INTG-05**: Wrapper works with both streaming and non-streaming requests

### Provider Support

- [ ] **PROV-01**: Google AI Studio (Gemini) — default policy with free tier limits
- [ ] **PROV-02**: Groq — default policy with free tier limits
- [ ] **PROV-03**: OpenRouter (free models) — default policy with free tier limits
- [ ] **PROV-04**: Mistral (La Plateforme) — default policy with free tier limits
- [ ] **PROV-05**: HuggingFace Inference API — default policy with free tier limits
- [ ] **PROV-06**: Cerebras — default policy with free tier limits
- [ ] **PROV-07**: DeepSeek — default policy with free tier limits
- [ ] **PROV-08**: Qwen (Alibaba) — default policy with free tier limits
- [ ] **PROV-09**: Cloudflare Workers AI — default policy with free tier limits
- [ ] **PROV-10**: NVIDIA NIM — default policy with free tier limits
- [ ] **PROV-11**: Cohere — default policy with free tier limits
- [ ] **PROV-12**: GitHub Models — default policy with free tier limits

### Developer Experience

- [ ] **DX-01**: Package works with minimal config (just API keys + provider names, sensible defaults for everything else)
- [ ] **DX-02**: Documentation includes step-by-step guide for obtaining free tier keys from each supported provider
- [ ] **DX-03**: Observability hooks fire events for key selection, usage recording, limit warnings, and fallback triggers
- [ ] **DX-04**: Dry-run mode validates configuration and simulates routing without making API calls
- [ ] **DX-05**: Budget alerts notify via hooks when usage reaches configurable thresholds (e.g., 80%, 95%)
- [ ] **DX-06**: Debug mode logs routing decisions (which key selected, why, remaining quota)
- [ ] **DX-07**: TypeScript types exported for all configuration, events, and public API

### Selection Algorithm

- [ ] **ALGO-01**: Round-robin selection distributes requests evenly across available keys
- [ ] **ALGO-02**: Least-used selection prefers keys with most remaining quota
- [ ] **ALGO-03**: User can configure selection strategy per provider (round-robin or least-used)
- [ ] **ALGO-04**: Selection skips keys that have exceeded any limit (rate, token, call count)
- [ ] **ALGO-05**: Selection algorithm is pluggable (user can provide custom strategy)

### Model Catalog

- [ ] **CAT-01**: Router fetches model metadata from live APIs (models.dev primary, OpenRouter supplementary) with periodic refresh
- [ ] **CAT-02**: Models have capability flags: reasoning, tool calling, structured output, vision
- [ ] **CAT-03**: Models have quality tiers derived from benchmark data (frontier, high, mid, small)
- [ ] **CAT-04**: Catalog includes cheap paid models with pricing for fallback routing (not just free tier)
- [ ] **CAT-05**: Catalog works offline with bundled static snapshot as fallback when APIs unreachable
- [ ] **CAT-06**: Fallback routing respects model capabilities (reasoning model falls back to reasoning, not generic)
- [ ] **CAT-07**: Fallback routing prefers cheapest matching model when budget allows paid usage

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Advanced Routing

- **AROUTE-01**: Multi-provider fallback with model equivalency mapping (GPT-4 → Claude → Gemini)
- **AROUTE-02**: Quality-tier-aware fallback (only fall back to same quality tier)
- **AROUTE-03**: Usage forecasting ("at current rate, quota exhausted in X days")
- **AROUTE-04**: Rate limit prediction (pre-emptively avoid limits before hitting them)

### Extended Providers

- **EXPROV-01**: Together AI support
- **EXPROV-02**: Fireworks AI support
- **EXPROV-03**: SambaNova support
- **EXPROV-04**: Scaleway support
- **EXPROV-05**: Venice.ai support

### Enterprise

- **ENT-01**: Multi-tenant key isolation
- **ENT-02**: Centralized policy server
- **ENT-03**: Cost analytics dashboard

## Out of Scope

| Feature | Reason |
|---------|--------|
| Video/image/audio model support | Text LLMs only for v1 — different pricing models |
| Automatic API key provisioning | Security risk, potential ToS violations |
| Hosted proxy service | Library only — no infrastructure cost |
| Prompt caching/optimization | Different problem domain |
| Full paid tier cost optimization | Focus is free tier maximization; cheap paid fallback is secondary |
| Request queue management | Adds complexity, most users don't need |
| Built-in retry logic | Base router handles this |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CORE-01 | Phase 1 | Pending |
| CORE-02 | Phase 11 | Pending |
| CORE-03 | Phase 12 | Pending |
| CORE-04 | Phase 9 | Pending |
| CORE-05 | Phase 9 | Pending |
| CORE-06 | Phase 9 | Pending |
| USAGE-01 | Phase 4 | Pending |
| USAGE-02 | Phase 2, Phase 10 | Pending |
| USAGE-03 | Phase 4 | Pending |
| USAGE-04 | Phase 4 | Pending |
| USAGE-05 | Phase 2 | Pending |
| USAGE-06 | Phase 4 | Pending |
| POLICY-01 | Phase 3 | Pending |
| POLICY-02 | Phase 3 | Pending |
| POLICY-03 | Phase 3 | Pending |
| POLICY-04 | Phase 3 | Pending |
| POLICY-05 | Phase 3 | Pending |
| POLICY-06 | Phase 3, Phase 12 | Pending |
| POLICY-07 | Phase 3 | Pending |
| INTG-01 | Phase 6 | Pending |
| INTG-02 | Phase 7 | Pending |
| INTG-03 | Phase 7 | Pending |
| INTG-04 | Phase 6 | Pending |
| INTG-05 | Phase 7 | Pending |
| PROV-01 | Phase 8 | Pending |
| PROV-02 | Phase 8 | Pending |
| PROV-03 | Phase 8 | Pending |
| PROV-04 | Phase 8 | Pending |
| PROV-05 | Phase 8 | Pending |
| PROV-06 | Phase 8 | Pending |
| PROV-07 | Phase 8 | Pending |
| PROV-08 | Phase 8 | Pending |
| PROV-09 | Phase 8 | Pending |
| PROV-10 | Phase 8 | Pending |
| PROV-11 | Phase 8 | Pending |
| PROV-12 | Phase 8 | Pending |
| DX-01 | Phase 11 | Pending |
| DX-02 | Phase 8 | Pending |
| DX-03 | Phase 10 | Pending |
| DX-04 | Phase 10 | Pending |
| DX-05 | Phase 9 | Pending |
| DX-06 | Phase 11 | Pending |
| DX-07 | Phase 1, Phase 11 | Pending |
| ALGO-01 | Phase 5 | Pending |
| ALGO-02 | Phase 5 | Pending |
| ALGO-03 | Phase 5 | Pending |
| ALGO-04 | Phase 5 | Pending |
| ALGO-05 | Phase 5 | Pending |
| CAT-01 | Phase 5 | Pending |
| CAT-02 | Phase 5 | Pending |
| CAT-03 | Phase 5 | Pending |
| CAT-04 | Phase 5 | Pending |
| CAT-05 | Phase 5 | Pending |
| CAT-06 | Phase 9 | Pending |
| CAT-07 | Phase 9 | Pending |

**Coverage:**
- v1 requirements: 55 total
- Mapped to phases: 55/55 (100%)
- Unmapped: 0

**Phase Distribution:**
- Phase 1: 2 requirements (Foundation)
- Phase 2: 2 requirements (Storage)
- Phase 3: 7 requirements (Policy Engine)
- Phase 4: 4 requirements (Usage Tracking)
- Phase 5: 10 requirements (Selection + Model Catalog)
- Phase 6: 2 requirements (Base Integration)
- Phase 7: 3 requirements (Integration Features)
- Phase 8: 13 requirements (Provider Catalog)
- Phase 9: 6 requirements (Fallback & Budget + Capability-Aware Routing)
- Phase 10: 3 requirements (Redis & Advanced)
- Phase 11: 4 requirements (DX Polish)
- Phase 12: 2 requirements (Testing & Validation)

---
*Requirements defined: 2026-03-11*
*Last updated: 2026-03-12 after model catalog and capability-aware fallback requirements added (55 total)*
