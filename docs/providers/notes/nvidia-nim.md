# NVIDIA NIM — Provider Intelligence

> Gathered: 2026-03-15 | Source: Research from build.nvidia.com, developer.nvidia.com

## Key Acquisition

- Console: https://build.nvidia.com
- Developer program: https://developer.nvidia.com
- Phone verification required
- Env var: `NVIDIA_API_KEY` (format: `nvapi-xxxxx`)
- No credit card required for developer tier

## Free Tier — Credit-based, broadest catalog

| Metric         | Value                                           |
| -------------- | ----------------------------------------------- |
| Signup credits | ~1,000 API credits (one-time)                   |
| RPM            | 40                                              |
| Credit card    | Not required                                    |
| Perpetual      | **No** — credits are finite, then pay-as-you-go |

Credits burn faster on larger models. The 1,000 credits go fast with 671B models but last longer on smaller ones.

## Available Models (MASSIVE catalog)

### Frontier / S+ tier

| Model                    | Params      | Notes                                       |
| ------------------------ | ----------- | ------------------------------------------- |
| **DeepSeek-R1**          | 671B        | Full reasoning model                        |
| **DeepSeek-V3.1 / V3.2** | ~685B MoE   | General frontier                            |
| **Kimi K2.5**            | ~1T MoE     | Moonshot AI, one of the largest free models |
| **Llama 4 Maverick**     | ~400B MoE   | Top open-weight                             |
| **NVIDIA Nemotron 120B** | 120B active | NVIDIA's own hybrid MoE                     |

### Strong / S tier

| Model         | Params   |
| ------------- | -------- |
| Qwen3 235B    | 235B MoE |
| Llama 3.3 70B | 70B      |
| Mistral Large | —        |
| GPT-OSS 120B  | 120B     |

Plus many more models across all sizes. NVIDIA NIM has the broadest single-provider catalog.

## API Format

- OpenAI-compatible API: `https://integrate.api.nvidia.com/v1`
- Standard chat completions endpoint
- Supports streaming

## AI SDK Integration

- **No official `@ai-sdk/nvidia` package**
- Use `@ai-sdk/openai-compatible` or `@ai-sdk/openai` with custom baseURL
- Base URL: `https://integrate.api.nvidia.com/v1`

```typescript
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
const nvidia = createOpenAICompatible({
  name: 'nvidia',
  baseURL: 'https://integrate.api.nvidia.com/v1',
  apiKey: process.env.NVIDIA_API_KEY,
});
```

## Rate Limit Structure

- 40 RPM hard limit
- Credit-based consumption (not RPD/TPD)
- Credits deducted per request based on model size and tokens
- When credits exhausted: pay-as-you-go required

## Phase 12.1 Gap Analysis Notes

- Credit-based billing (like HuggingFace) — PennyLLM has no concept of credit depletion
- Unlike HF's tiny $0.10, NVIDIA's 1,000 credits are substantial for evaluation
- No official AI SDK package — need OpenAI-compatible adapter wiring
- 40 RPM is generous but credits are the binding constraint
- **New consideration**: credits are one-time, so PennyLLM should detect when credits are exhausted and stop routing to NVIDIA

## Phase 13 Registry Notes

- Volatility: MEDIUM (model catalog changes, credit amounts may change)
- Confidence: HIGH for API compatibility, MEDIUM for credit longevity
- Unique value: broadest model catalog, Kimi K2.5 (~1T) is unique
- Registry should track credit-based vs rate-limit-based providers differently
