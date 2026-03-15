# Groq — Provider Intelligence

> Gathered: 2026-03-15 | Source: User observation + Groq console + research

## Key Acquisition

- No credit card required
- Console: https://console.groq.com
- Keys page: https://console.groq.com/keys
- Keys are project-scoped
- Env var: `GROQ_API_KEY`

## Available Models (as of 2026-03-15)

### Chat/Completion

| Model ID                                    | RPM | RPD    | TPM | TPD      | Notes                            |
| ------------------------------------------- | --- | ------ | --- | -------- | -------------------------------- |
| `allam-2-7b`                                | 30  | 7,000  | 6K  | 500K     |                                  |
| `groq/compound`                             | 30  | 250    | 70K | No limit | Agentic (web search + code exec) |
| `groq/compound-mini`                        | 30  | 250    | 70K | No limit | Agentic (web search + code exec) |
| `llama-3.1-8b-instant`                      | 30  | 14,400 | 6K  | 500K     | Production                       |
| `llama-3.3-70b-versatile`                   | 30  | 1,000  | 12K | 100K     | Production                       |
| `meta-llama/llama-4-scout-17b-16e-instruct` | 30  | 1,000  | 30K | 500K     | Preview — may be discontinued    |
| `meta-llama/llama-prompt-guard-2-22m`       | 30  | 14,400 | 15K | 500K     | Safety classifier                |
| `meta-llama/llama-prompt-guard-2-86m`       | 30  | 14,400 | 15K | 500K     | Safety classifier                |
| `moonshotai/kimi-k2-instruct`               | 60  | 1,000  | 10K | 300K     | Preview                          |
| `moonshotai/kimi-k2-instruct-0905`          | 60  | 1,000  | 10K | 300K     | Preview                          |
| `openai/gpt-oss-120b`                       | 30  | 1,000  | 8K  | 200K     |                                  |
| `openai/gpt-oss-20b`                        | 30  | 1,000  | 8K  | 200K     |                                  |
| `openai/gpt-oss-safeguard-20b`              | 30  | 1,000  | 8K  | 200K     |                                  |
| `qwen/qwen3-32b`                            | 60  | 1,000  | 6K  | 500K     | Preview                          |

### Audio (Whisper)

| Model ID                 | RPM | RPD   | ASH   | ASD    |
| ------------------------ | --- | ----- | ----- | ------ |
| `whisper-large-v3`       | 20  | 2,000 | 7,200 | 28,800 |
| `whisper-large-v3-turbo` | 20  | 2,000 | 7,200 | 28,800 |

### Speech (TTS)

| Model ID                          | RPM | RPD | TPM   | TPD   |
| --------------------------------- | --- | --- | ----- | ----- |
| `canopylabs/orpheus-arabic-saudi` | 10  | 100 | 1,200 | 3,600 |
| `canopylabs/orpheus-v1-english`   | 10  | 100 | 1,200 | 3,600 |

## Rate Limit Structure

### Two layers of limits

1. **Per-model limits** (primary) — each model has independent RPM, RPD, TPM, TPD quotas
2. **Organization-level ceiling** (per-model scoped) — acts as the cap that all projects/keys within the org share for a given model. NOT a cross-model aggregate.

- No documented cross-model global limit (unlike OpenAI's account-wide spend cap)
- Four dimensions: RPM, RPD, TPM, TPD (audio models use ASH, ASD instead)
- Hard caps (no burst allowance)
- Rate limit headers returned per request for client-side throttling
- Cached tokens do NOT count toward limits
- Limits are **per-organization**, not per-key (multiple keys don't increase quota)

### Tiers

| Tier       | Description                                          |
| ---------- | ---------------------------------------------------- |
| Free       | Default. Public rate limits shown in docs.           |
| Developer  | Self-service upgrade. ~10x higher token consumption. |
| Enterprise | Custom limits. Contact sales.                        |

### Router implications

- Our policy engine models limits at the provider level, but Groq's per-model limits mean a single key could be exhausted for one model but still usable for another
- Current PennyLLM design: limits are set per-provider-key, not per-model — this is a simplification that works for most providers but **may under-utilize Groq's free tier**
- Phase 13 consideration: per-model limit granularity in the registry

## Observations & Quirks

- **TPM is the binding constraint** — 6K-30K TPM is very tight, a single large prompt can exhaust per-minute budget
- **Preview models can disappear without notice** — llama-4-scout, kimi-k2, qwen3-32b are all preview
- **Model churn is high** — Groq frequently adds/retires models
- **compound models have no TPD limit** but very low RPD (250/day)
- **Model IDs use org-prefixed format for newer models** — `meta-llama/...`, `qwen/...`, `openai/...`
- **Ultra-fast inference** — ~1,000 tokens/sec on LPU hardware, excellent for latency-sensitive workloads
- **OpenAI-compatible API** — base URL: `https://api.groq.com/openai/v1`

## AI SDK Integration

- Package: `@ai-sdk/groq` (official first-party)
- Factory: `createGroq({ apiKey })`
- Do NOT use `@ai-sdk/openai` with custom baseURL — use the official package

## Phase 13 Registry Notes

- Per-model limits make Groq uniquely granular — registry should store limits at model level, not just provider level
- Volatility: HIGH (frequent model additions/removals, preview status changes)
- Confidence: HIGH for production models, LOW for preview models
- Source URL: https://console.groq.com/docs/rate-limits
