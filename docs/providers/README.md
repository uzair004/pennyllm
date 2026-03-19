# Provider Setup Guide

pennyllm supports 6 providers optimized for free-tier usage. Install only the SDKs you need.

## Recommended Starter Set

The easiest providers to set up (no credit card, generous limits, instant key):

1. **Cerebras** — [Setup guide](./cerebras.md)
   - No credit card, instant API key
   - Fastest inference (2200-3000 tok/sec)
   - 30 RPM, 14.4K RPD, 1M TPD

2. **Google AI Studio** — [Setup guide](./google.md)
   - No credit card, 2 minutes to get key
   - Best model variety (Gemini 2.5 Pro, Flash, Flash-Lite)
   - 5-15 RPM, 100-1K RPD, 250K TPM

3. **Groq** — [Setup guide](./groq.md)
   - No credit card, instant API key
   - Ultra-fast LPU inference (~1000 tok/sec)
   - 30-60 RPM, 1K-14.4K RPD

## All Supported Providers

| Provider         | Guide                          | Free Tier Type    | Credit Card | SDK Package                 |
| ---------------- | ------------------------------ | ----------------- | ----------- | --------------------------- |
| Cerebras         | [cerebras.md](./cerebras.md)   | Perpetual         | No          | `@ai-sdk/cerebras`          |
| Google AI Studio | [google.md](./google.md)       | Perpetual         | No          | `@ai-sdk/google`            |
| Groq             | [groq.md](./groq.md)           | Perpetual         | No          | `@ai-sdk/groq`              |
| SambaNova        | [sambanova.md](./sambanova.md) | Trial ($5 credit) | No          | `sambanova-ai-provider`     |
| NVIDIA NIM       | [nvidia.md](./nvidia.md)       | Rate-limited      | No          | `@ai-sdk/openai-compatible` |
| Mistral          | [mistral.md](./mistral.md)     | Perpetual (1 RPS) | No          | `@ai-sdk/mistral`           |

> **Full provider data:** See [awesome-free-llm-apis](https://github.com/uzair004/awesome-free-llm-apis) for detailed limits, models, rate limit headers, and SDK info.

## Aggregate Capacity Estimate

Using all 6 providers with pennyllm key rotation:

- **~30-50M tokens/month** combined free tier capacity
- **~5,000-15,000 requests/day** across all providers
- **Best value:** Cerebras (1M TPD), Mistral (1B tok/month), Google (high RPD variety)

These estimates assume moderate usage patterns. Actual capacity depends on which models you use, request sizes, and rotation patterns.

## Quick Start Example

```typescript
import { createRouter, defineConfig } from 'pennyllm';

const router = await createRouter(
  defineConfig({
    providers: {
      cerebras: { keys: [process.env.CEREBRAS_API_KEY!], priority: 1 },
      google: { keys: [process.env.GOOGLE_GENERATIVE_AI_API_KEY!], priority: 2 },
      groq: { keys: [process.env.GROQ_API_KEY!], priority: 3 },
    },
  }),
);
```

## How Limits Work

- **Reactive rate limiting** — pennyllm doesn't predict limits. When a provider returns 429 (rate limit) or 402 (quota exhausted), the router automatically cools down that key/provider and falls back.
- **Health scoring** — Circuit breakers track provider reliability. Unhealthy providers are temporarily bypassed.
- **Credit tracking** — Trial providers (SambaNova, NVIDIA NIM) have finite credits tracked per-call.
- **No limits = key always available** — If you configure no limits, the key is used until the provider rejects it.

## Dropped Providers

The following providers are no longer actively supported. See [notes/DROPPED.md](./notes/DROPPED.md) for reasons.

GitHub Models, HuggingFace, Cohere, Cloudflare, Qwen/DashScope, OpenRouter, Together AI, DeepSeek, Fireworks.
