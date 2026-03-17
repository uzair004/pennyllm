# NVIDIA NIM — Provider Intelligence

> Updated: 2026-03-17 | Source: build.nvidia.com, docs.api.nvidia.com, developer forums, Vercel AI SDK docs

## Key Acquisition

- Console: https://build.nvidia.com
- Developer program: https://developer.nvidia.com
- Phone verification required
- Env var: `NVIDIA_API_KEY` (format: `nvapi-xxxxx`)
- No credit card required for developer tier

## Free Tier — Rate-Limited Trial (No Time Limit)

**IMPORTANT UPDATE (as of late 2025):** NVIDIA has **discontinued the credit-based system** and replaced it with **rate limits for trial usage**. The old 1,000 / 5,000 credit system and the "+4,000 Request More" button are gone. Trial access is now **perpetual** (not time-limited) but **rate-limited**.

| Metric           | Value                                                       |
| ---------------- | ----------------------------------------------------------- |
| Trial type       | Rate-limited, no time limit                                 |
| RPM              | ~40 (confirmed by multiple sources, varies by model)        |
| Credit card      | Not required                                                |
| Perpetual        | **Yes** — trial is not time-limited, subject to rate limits |
| Per-model limits | Yes, but NVIDIA does NOT publish per-model limits           |

Quote from NVIDIA staff (forums): _"We no longer use a credit-based system for build.nvidia.com. This has been replaced by rate limits for trial usage."_ and _"The trial period is not limited by a time period."_

**Caveat:** NVIDIA explicitly stated: _"We do not plan to publish specific model limits, since the limits only apply to the APIs which are for trial experiences."_ Rate limits vary by model and may vary based on concurrent user load.

## Available Models — Free Endpoints (Verified March 2026)

Base URL for all: `https://integrate.api.nvidia.com/v1/chat/completions`

### Frontier / Flagship Models (Free Endpoints)

| Model ID (exact API string)                | Params         | Context | Max Output | Notes                                                 |
| ------------------------------------------ | -------------- | ------- | ---------- | ----------------------------------------------------- |
| `deepseek-ai/deepseek-v3.2`                | 685B MoE       | —       | 16,384     | Latest DeepSeek, sparse attention, IMO gold-medal     |
| `deepseek-ai/deepseek-v3.1-terminus`       | 671B (37B act) | 128K    | —          | Hybrid think/non-think, strict function calling       |
| `deepseek-ai/deepseek-v3.1`                | 671B (37B act) | 128K    | —          | Hybrid reasoning, tool use                            |
| `moonshotai/kimi-k2.5`                     | ~1T MoE        | —       | 32,768     | Largest model available, multimodal MoE               |
| `nvidia/llama-3.1-nemotron-ultra-253b-v1`  | 253B           | 128K    | 16,384     | NVIDIA's top model, scientific/math reasoning         |
| `nvidia/nemotron-3-super-120b-a12b`        | 120B (12B act) | 1M      | 32,768     | Hybrid Mamba-Transformer MoE, 1M context              |
| `nvidia/llama-3.3-nemotron-super-49b-v1.5` | 49B            | —       | 16,384     | High efficiency, reasoning + tool calling             |
| `nvidia/llama-3.3-nemotron-super-49b-v1`   | 49B            | —       | 16,384     | Reasoning, tool calling, chat                         |
| `meta/llama-4-maverick-17b-128e-instruct`  | 17B x 128 MoE  | —       | 8,192      | Llama 4 MoE, multimodal                               |
| `meta/llama-4-scout-17b-16e-instruct`      | 17B x 16 MoE   | —       | —          | Llama 4 MoE, multimodal                               |
| `mistralai/mistral-nemotron`               | —              | 128K    | 4,096      | Mistral x NVIDIA collab, strong coding + tool calling |
| `qwen/qwen3-coder-480b-a35b-instruct`      | 480B (35B act) | 256K    | —          | Agentic coding, browser use                           |
| `qwen/qwen3.5-122b-a10b`                   | 122B (10B act) | —       | —          | Coding, reasoning, multimodal chat                    |
| `qwen/qwq-32b`                             | 32B            | —       | —          | Reasoning/thinking model                              |

### Smaller / Utility Models (Free Endpoints)

| Model ID (exact API string)              | Params | Notes                                 |
| ---------------------------------------- | ------ | ------------------------------------- |
| `nvidia/llama-3.1-nemotron-nano-4b-v1.1` | 4B     | Edge/device, reasoning + tool calling |
| `nvidia/nemotron-mini-4b-instruct`       | 4B     | Roleplay, RAG, function calling       |
| `nvidia/mistral-nemo-minitron-8b-base`   | 8B     | Small language model, chatbot/VA      |
| `qwen/qwen2.5-coder-7b-instruct`         | 7B     | Code generation, 32K context          |
| `qwen/qwen2-7b-instruct`                 | 7B     | Chinese + English general LLM         |

### Download-Only (No Free Hosted Endpoint)

These are available as NIM containers but NOT via the free hosted API:

- `deepseek-ai/deepseek-r1` (671B) — **marked deprecated on build.nvidia.com**
- `meta/llama-3.3-70b-instruct` (70B)
- `meta/llama-3.1-405b-instruct` (405B)
- `meta/llama-3.1-70b-instruct` (70B)
- `meta/llama-3.1-8b-instruct` (8B)
- `qwen/qwen3.5-397b-a17b` (397B MoE)
- `qwen/qwen2.5-coder-32b-instruct` (32B)
- Various distill models (deepseek-r1-distill-\*)

## API Format

- **OpenAI-compatible** REST API
- Base URL: `https://integrate.api.nvidia.com/v1`
- Endpoint: `POST /v1/chat/completions`
- Auth: `Authorization: Bearer $NVIDIA_API_KEY`
- Supports streaming (`"stream": true`)
- Also supports `/v1/models` to list available models

Example:

```bash
curl https://integrate.api.nvidia.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $NVIDIA_API_KEY" \
  -d '{
    "model": "deepseek-ai/deepseek-v3.2",
    "messages": [{"role": "user", "content": "Hello"}],
    "max_tokens": 1024,
    "stream": false
  }'
```

## AI SDK Integration

- **No official `@ai-sdk/nvidia` package**
- Use `@ai-sdk/openai-compatible` with custom baseURL
- Vercel AI SDK docs confirm this approach: https://ai-sdk.dev/providers/openai-compatible-providers/nim

```typescript
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
const nvidia = createOpenAICompatible({
  name: 'nvidia',
  baseURL: 'https://integrate.api.nvidia.com/v1',
  headers: { Authorization: `Bearer ${process.env.NVIDIA_API_KEY}` },
});
```

## Rate Limit Details

### Known Limits

- **~40 RPM** is the most commonly reported limit for trial accounts
- Per-model limits exist but are **not published** by NVIDIA
- Limits may vary based on concurrent user load
- Rate limit display: visible in top-right of build.nvidia.com navigation bar (when logged in)

### Rate Limit Headers

**NVIDIA does NOT document rate limit response headers.** Based on available evidence:

- No official documentation of `X-RateLimit-*` headers exists
- The LiteLLM integration suggests `x-ratelimit-limit-requests` and `x-ratelimit-limit-tokens` headers may be present (as LiteLLM maps them), but this is not confirmed by NVIDIA docs
- **Recommendation**: Test empirically with a `curl -v` request to discover actual headers

### 429 Response Format

```json
{ "status": 429, "title": "Too Many Requests" }
```

- Simple JSON body, no `detail` or `retry-after` information documented in the body
- Whether `Retry-After` header is present is **unconfirmed**

### 402 Response Format (Legacy Credit System)

```json
{
  "status": 402,
  "title": "Payment Required",
  "detail": "Account 'XXXXXX': Cloud credits expired - Please contact NVIDIA representatives"
}
```

- This was from the old credit system. It is unclear if 402 errors still occur under the new rate-limit-based system.
- **Recommendation**: Handle 402 defensively in case NVIDIA reintroduces credit depletion or for accounts that still have legacy credit tracking.

## Gotchas and Quirks

1. **No published per-model limits.** NVIDIA explicitly refuses to publish them. The ~40 RPM figure is community-reported and may not apply uniformly.

2. **Model catalog churn.** Models come and go. `deepseek-r1` was marked deprecated. Free endpoints may be removed or added without notice.

3. **Free endpoint vs download-only distinction.** Many models on build.nvidia.com are download-only (self-host via NIM containers). Only a subset has free hosted inference endpoints.

4. **Max tokens varies wildly by model.** Some models cap at 4,096 output tokens, others go up to 32,768. Always set `max_tokens` explicitly.

5. **Context length not always documented.** Some model cards omit context length entirely. Verified: Nemotron-3-Super has 1M context, Nemotron-Ultra has 128K, DeepSeek-V3.1 has 128K.

6. **Trial is for "experimentation, development, testing and research" only.** Not for production. Production requires NVIDIA AI Enterprise license.

7. **No credit balance API.** There is no API endpoint or response header to check remaining quota/credits.

8. **`deepseek-ai/deepseek-r1` is deprecated** on build.nvidia.com. Use `deepseek-ai/deepseek-v3.1` or `deepseek-ai/deepseek-v3.2` instead for frontier DeepSeek.

9. **Model ID format:** Always `org/model-name` (e.g., `deepseek-ai/deepseek-v3.2`, `nvidia/nemotron-3-super-120b-a12b`). Slashes are part of the ID.

## Phase 12.1 Gap Analysis (Updated)

- **Credit system is gone** -- this is now a rate-limited perpetual trial, similar to Groq/Cerebras
- **Per-model rate limits are unpublished** -- PennyLLM must rely on reactive 429 detection, cannot pre-configure limits
- **40 RPM is the only known limit** -- use as default, adapt reactively
- **No rate limit headers documented** -- may need to rely purely on 429 status code detection
- **402 may still fire** for legacy accounts or edge cases -- handle defensively
- **Model catalog volatility** -- registry should be soft-configured, not hardcoded
- **Unique value**: Broadest free catalog, Kimi K2.5 (~1T), Nemotron-3-Super (1M context), DeepSeek V3.2 frontier

## Recommended Models for PennyLLM

Priority chain for routing (quality-first):

1. `deepseek-ai/deepseek-v3.2` — frontier reasoning, 685B
2. `moonshotai/kimi-k2.5` — massive ~1T MoE
3. `nvidia/llama-3.1-nemotron-ultra-253b-v1` — 253B, strong math/science
4. `nvidia/nemotron-3-super-120b-a12b` — 120B, 1M context (unique)
5. `qwen/qwen3-coder-480b-a35b-instruct` — coding specialist, 256K context
6. `qwen/qwen3.5-122b-a10b` — general purpose MoE
7. `mistralai/mistral-nemotron` — 128K context, tool calling
8. `nvidia/llama-3.3-nemotron-super-49b-v1.5` — efficient 49B

## Gap Analysis (Phase 12.1)

**Date:** 2026-03-17

### PennyLLM Abstraction Match

| Aspect             | Provider Reality                                   | PennyLLM Model       | Match?  |
| ------------------ | -------------------------------------------------- | -------------------- | ------- |
| Limit scope        | Unknown, unpublished                               | Per-key              | N/A     |
| Key rotation value | UNKNOWN — likely per-account                       | Assumes beneficial   | N/A     |
| Error format       | 429, headers undocumented                          | 429 + header parsing | PARTIAL |
| Per-model limits   | Unpublished (exist but NVIDIA refuses to document) | Per-key only         | N/A     |

### Key Rotation Value

**UNKNOWN.** NVIDIA does not publish rate limit details. Limits are likely per-account, making key rotation ineffective. PennyLLM must rely entirely on reactive 429 detection for this provider.

### DX Recommendations

- Rate limits are unpublished — PennyLLM adapts via reactive 429 detection only
- The default cooldown period may be conservative (60s) since there is no `Retry-After` header to guide retry timing
- ~40 RPM is the only community-reported limit — actual limits vary by model and concurrent load
- NVIDIA NIM may be geo-restricted in some regions (confirmed 403 errors from certain countries)
- Trial tier is for "experimentation, development, testing and research" only — not for production use
- Model catalog changes frequently — free endpoints may be added or removed without notice

### Gap Severity

| Gap                                        | Category | Priority |
| ------------------------------------------ | -------- | -------- |
| Potentially conservative default cooldown  | (a)      | P1       |
| Reactive-only approach needs documentation | (b)      | P0       |
