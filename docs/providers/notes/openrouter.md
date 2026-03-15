# OpenRouter — Provider Intelligence

> Gathered: 2026-03-15 | Source: User observation + OpenRouter API + research

## Key Acquisition

- No credit card required for free models
- Sign up: https://openrouter.ai
- Keys: https://openrouter.ai/settings/keys
- Env var: `OPENROUTER_API_KEY`
- **Limits are per-account, NOT per-API-key** — multiple keys don't help

## Understanding OpenRouter

OpenRouter is a **meta-provider** — it proxies requests to underlying providers (Google, Meta, NVIDIA, etc.) through one API. This creates unique dynamics with PennyLLM.

### Free models (`:free` suffix)

Models with `:free` suffix cost $0. Current list (changes frequently):

| Model ID                                        | Notes            |
| ----------------------------------------------- | ---------------- |
| `meta-llama/llama-3.3-70b-instruct:free`        | Strong 70B       |
| `meta-llama/llama-3.2-3b-instruct:free`         | Small/fast       |
| `mistralai/mistral-small-3.1-24b-instruct:free` | Multimodal       |
| `google/gemma-3-27b-it:free`                    | Google 27B       |
| `google/gemma-3-12b-it:free`                    | Google 12B       |
| `google/gemma-3-4b-it:free`                     | Google 4B        |
| `google/gemma-3n-e4b-it:free`                   | Gemma 3n         |
| `google/gemma-3n-e2b-it:free`                   | Gemma 3n small   |
| `qwen/qwen3-coder:free`                         | Coding-focused   |
| `qwen/qwen3-4b:free`                            | Small            |
| `qwen/qwen3-next-80b-a3b-instruct:free`         | Large MoE        |
| `openai/gpt-oss-120b:free`                      | OpenAI OSS       |
| `openai/gpt-oss-20b:free`                       | OpenAI OSS small |
| `nvidia/nemotron-3-super-120b-a12b:free`        | NVIDIA 120B      |
| `nvidia/nemotron-3-nano-30b-a3b:free`           | NVIDIA 30B       |
| `nvidia/nemotron-nano-12b-v2-vl:free`           | Vision+language  |
| `nvidia/nemotron-nano-9b-v2:free`               | 9B               |
| `nousresearch/hermes-3-llama-3.1-405b:free`     | 405B Hermes      |
| `stepfun/step-3.5-flash:free`                   | StepFun          |

Special routers (also $0):

- `openrouter/free` — random free model matching request capabilities
- `openrouter/healer-alpha` — vision + tools + reasoning
- `openrouter/hunter-alpha` — tools + reasoning

### "Eligible models" from user's dashboard

The models user listed (GPT-3.5, GPT-4, Mixtral, Goliath, MythoMax, etc.) are **paid models** that appear in the dashboard as available to route to — they are NOT free. They require credits.

## Rate Limits

### Account-wide limits (NOT per-model, NOT per-key)

| Tier                   | RPM | RPD (free models) | RPD (paid models) |
| ---------------------- | --- | ----------------- | ----------------- |
| Free (no credits)      | 20  | 50                | N/A               |
| $10+ credits purchased | 20  | 1,000             | Unlimited         |

**Critical details:**

- All free model calls share ONE pool — 50 (or 1,000) RPD total across all `:free` models
- Failed requests still count toward RPD
- Negative credit balance blocks ALL requests, including free models (HTTP 402)
- The $10 RPD unlock is permanent even after spending credits
- No TPM or TPD limits documented — RPM and RPD are the only constraints

## OpenRouter's Own Routing (Architectural Tension with PennyLLM)

### What OpenRouter offers

1. **Model fallbacks**: `models: ["model-a", "model-b"]` — tries in order
2. **Provider selection**: `provider: { order: ["together", "deepinfra"], sort: "latency" }` — pick underlying host
3. **`openrouter/auto`**: AI-powered model selection (paid models only)
4. **`openrouter/free`**: Random free model matching request features
5. **Advanced filtering**: quantizations, data collection policies

### How PennyLLM should interact

**Use OpenRouter as a dumb transport, NOT as a router:**

- Enumerate specific `:free` model IDs and let PennyLLM select among them
- Do NOT use `openrouter/free` (opaque — PennyLLM can't track which model ran)
- Do NOT use `models: [...]` fallback (conflicts with PennyLLM's own fallback)
- Do NOT use `openrouter/auto` (paid, opaque)

**The clean integration:**

```
PennyLLM selects → openrouter/meta-llama/llama-3.3-70b-instruct:free → OpenRouter proxies → Meta's API
```

PennyLLM has full visibility into model, usage, and limits.

## AI SDK Integration

**Official package**: `@openrouter/ai-sdk-provider`

```typescript
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
const openrouter = createOpenRouter({ apiKey });
const model = openrouter.chat('meta-llama/llama-3.3-70b-instruct:free');
```

**Alternative**: `@ai-sdk/openai-compatible` with baseURL `https://openrouter.ai/api/v1`

Our docs currently recommend `@ai-sdk/openai-compatible` — should consider switching to the official package.

## Phase 12.1 Gap Analysis Notes

### Gap: Account-wide limits vs PennyLLM's per-key model

- OpenRouter limits are per-account, and multiple keys don't help
- PennyLLM's key rotation is useless here — 3 OpenRouter keys still share the same 50 RPD pool
- **Impact**: User configures 3 keys expecting 3x throughput but gets 1x
- **Severity**: Incorrect behavior — PennyLLM would rotate to key 2 thinking it has fresh quota

### Gap: Cross-model shared RPD pool

- All `:free` models share one daily pool (50 or 1,000 RPD)
- PennyLLM tracks usage per-key, but OpenRouter's limit is per-account across all models
- If PennyLLM calls `llama-3.3-70b:free` 30 times and `gemma-3-27b:free` 20 times, the account hits 50 RPD — but PennyLLM thinks each model only used part of its quota

### Gap: No concept of "meta-provider"

- OpenRouter is a provider that gives access to models from OTHER providers
- `google/gemma-3-27b-it:free` via OpenRouter vs `gemma-3-27b-it` via Google direct — same model, different quota pools
- PennyLLM has no concept of this relationship

### What works well

- Using specific `:free` model IDs works fine as a transport
- PennyLLM's fallback from OpenRouter → direct provider is a valid strategy
- Single key is fine since multiple keys don't help anyway

## Phase 13 Registry Notes

- Volatility: HIGH (free model list changes frequently)
- Confidence: HIGH for rate limits (well-documented), LOW for model availability
- Source URL: https://openrouter.ai/docs/api/reference/limits
- Registry should mark OpenRouter as "meta-provider" with per-account (not per-key) limits
- Free model list should be fetchable from OpenRouter API: GET /api/v1/models filtered by pricing=$0
