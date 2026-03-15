# Google AI Studio (Gemini) — Provider Intelligence

> Gathered: 2026-03-15 | Source: User's AI Studio dashboard + research

## Key Acquisition

- No credit card required (AI Studio free tier)
- Console: https://aistudio.google.com
- Keys page: https://aistudio.google.com/app/apikey
- Env var: `GOOGLE_GENERATIVE_AI_API_KEY`
- **Keys are per-project, up to 10 projects per account** — each project gets independent quota

## Available Models (as of 2026-03-15)

### Text-out models (active on free tier)

| Model                 | AI SDK ID                       | RPM | TPM  | RPD   | Notes                                                              |
| --------------------- | ------------------------------- | --- | ---- | ----- | ------------------------------------------------------------------ |
| Gemini 2.5 Flash      | `gemini-2.5-flash`              | 10  | 250K | 250   | Stable. Deprecated June 17, 2026 → `gemini-3-flash-preview`        |
| Gemini 2.5 Flash Lite | `gemini-2.5-flash-lite`         | 15  | 250K | 1,000 | Stable. Deprecated July 22, 2026 → `gemini-3.1-flash-lite-preview` |
| Gemini 2.5 Pro        | `gemini-2.5-pro`                | 5   | 250K | 100   | Stable. Deprecated June 17, 2026 → `gemini-3.1-pro-preview`        |
| Gemini 3 Flash        | `gemini-3-flash-preview`        | 5   | 250K | 20    | Preview                                                            |
| Gemini 3.1 Flash Lite | `gemini-3.1-flash-lite-preview` | 15  | 250K | 500   | Preview                                                            |

### Models with 0/0/0 limits (listed but NOT on free tier currently)

- Gemini 3.1 Pro (`gemini-3.1-pro-preview`) — 0/0/0
- Gemini 2 Flash (`gemini-2.0-flash`) — 0/0/0 (deprecated June 1, 2026)
- Gemini 2 Flash Lite (`gemini-2.0-flash-lite`) — 0/0/0 (deprecated June 1, 2026)
- Gemini 2 Flash Exp — 0/0/0
- Computer Use Preview — 0/0/0
- Deep Research Pro Preview — 0/0/0

### Other models (Gemma, open-weight)

| Model       | AI SDK ID        | RPM | TPM | RPD    |
| ----------- | ---------------- | --- | --- | ------ |
| Gemma 3 1B  | `gemma-3-1b-it`  | 30  | 15K | 14,400 |
| Gemma 3 2B  | `gemma-3-2b-it`  | 30  | 15K | 14,400 |
| Gemma 3 4B  | `gemma-3-4b-it`  | 30  | 15K | 14,400 |
| Gemma 3 12B | `gemma-3-12b-it` | 30  | 15K | 14,400 |
| Gemma 3 27B | `gemma-3-27b-it` | 30  | 15K | 14,400 |

### Image/Video/Audio (not relevant for text routing)

- Gemini 2.5 Flash TTS: 3 RPM, 10K TPM, 10 RPD
- Imagen 4 (Generate/Ultra/Fast): 25 RPD only
- Veo 3: 0/0/0
- Gemini 2.5 Flash Native Audio Dialog (Live API): Unlimited RPM, 1M TPM, Unlimited RPD

## Rate Limit Structure

### Three dimensions only: RPM, TPM, RPD

- **No TPD (tokens per day)** — daily constraint is request count (RPD), not token volume
- RPD resets at **midnight Pacific Time**
- Exceeding ANY one dimension triggers rate limit error

### Per-project enforcement (CRITICAL for PennyLLM)

- **Limits are per Google Cloud project, NOT per API key**
- Multiple API keys in the same project share the same quota pool
- **You can create up to 10 projects** under one Google account
- Each project has its own independent quota allocation
- This means: 10 projects = 10 independent keys = 10x effective limits
- **This is PennyLLM's strongest use case** — key rotation across projects genuinely multiplies quota

### Per-model limits

- Like Groq, each model has its own limits (RPM/TPM/RPD vary by model)
- Same gap as Groq: PennyLLM tracks per-key, not per-model

## Observations & Quirks

- **0/0/0 models**: Many models listed in dashboard with zero limits — means they're registered but not available on free tier
- **Dec 2025 quota reduction**: Google cut free tier quotas by 50-80%. Old blog posts show higher limits.
- **Model churn**: 2.5 series all deprecated by mid-2026, being replaced by 3.x series
- **Gemini 2.5 Flash thinking mode**: Returns empty `result.text` and undefined usage fields. PennyLLM already guards with `Number(x) || 0`
- **Preview models** (`gemini-3-flash-preview`, `gemini-3.1-flash-lite-preview`): Could change behavior
- **Gemma models have much higher RPD** (14.4K) but lower TPM (15K) — good for many small requests
- **No `models/` prefix needed** in AI SDK — use bare names like `gemini-2.5-flash`

## Vertex AI / Google Cloud (DEFERRED)

- $300 free credits on signup (requires billing + credit card)
- 90-day expiry
- Separate from AI Studio free tier
- Different API endpoint and auth (service account vs API key)
- **Not handling now** — defer to later

## AI SDK Integration

- Package: `@ai-sdk/google` (already installed)
- Factory: `createGoogleGenerativeAI({ apiKey })`
- Already registered in `ProviderRegistry.createDefault()`
- Model IDs: bare names, no prefix (e.g., `gemini-2.5-flash`)

## Phase 12.1 Gap Analysis Notes

- **Per-model limits**: Same gap as Groq — PennyLLM per-key limits don't capture per-model granularity
- **Multi-project key rotation**: PennyLLM DOES handle this well — multiple keys per provider is a core feature, and Google's per-project enforcement means each key truly has independent quota
- **No TPD**: PennyLLM supports TPD limits (via `createTokenLimit(x, 'daily')`) but Google doesn't have one — no issue, just don't configure it
- **0/0/0 models**: PennyLLM has no concept of "model not available on this key's tier" — it would try and get a 429

## Phase 13 Registry Notes

- Volatility: HIGH (rapid model deprecation cycle, 2.5→3.x transition happening now)
- Confidence: MEDIUM (limits changed in Dec 2025, could change again)
- Source URL: https://ai.google.dev/gemini-api/docs/rate-limits (redirects to dashboard, no static page)
- Per-project enforcement is unique — registry should note this for key rotation guidance
- Model deprecation dates should be tracked for proactive warnings
