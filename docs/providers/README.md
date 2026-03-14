# Provider Setup Guide

This directory contains key acquisition guides and configuration references for all 12 providers supported by llm-router.

## Recommended Starter Set

The easiest providers to set up (no credit card, generous limits, instant key):

1. **Google AI Studio** -- [Setup guide](./google.md)
   - No credit card, 2 minutes to get key
   - Best model variety (Gemini 2.5 Pro, Flash, Flash-Lite)
   - 5-15 RPM, 100-1,000 RPD, 250K TPM

2. **Groq** -- [Setup guide](./groq.md)
   - No credit card, instant API key
   - Ultra-fast inference (~1,000 tok/sec)
   - 30-60 RPM, 1K-14.4K RPD

3. **OpenRouter** -- [Setup guide](./openrouter.md)
   - No credit card, 28+ free models with single key
   - Meta-provider: one key routes to many providers
   - 20 RPM, 50-1,000 RPD

## Aggregate Capacity Estimate

Using all 12 providers in rotation with llm-router:

- **~30-50M tokens/month** combined free tier capacity
- **~5,000-15,000 requests/day** across all providers
- **Best value providers:** Google (high RPD), Groq (fast inference), Cerebras (1M TPD), Mistral (1B monthly)

These estimates assume moderate usage patterns. Actual capacity depends on which models you use, request sizes, and how aggressively you rotate across providers.

## All Providers

| Provider         | Guide                              | Tier Type       | Credit Card |
| ---------------- | ---------------------------------- | --------------- | ----------- |
| Google AI Studio | [google.md](./google.md)           | Recurring       | No          |
| Groq             | [groq.md](./groq.md)               | Recurring       | No          |
| OpenRouter       | [openrouter.md](./openrouter.md)   | Recurring       | No          |
| Mistral          | [mistral.md](./mistral.md)         | Recurring       | No          |
| HuggingFace      | [huggingface.md](./huggingface.md) | Monthly Credits | No          |
| Cerebras         | [cerebras.md](./cerebras.md)       | Recurring       | No          |
| DeepSeek         | [deepseek.md](./deepseek.md)       | Trial Credits   | No          |
| Qwen             | [qwen.md](./qwen.md)               | Trial Credits   | No          |
| Cloudflare       | [cloudflare.md](./cloudflare.md)   | Recurring       | No          |
| NVIDIA           | [nvidia.md](./nvidia.md)           | Trial Credits   | No          |
| Cohere           | [cohere.md](./cohere.md)           | Trial Key       | No          |
| GitHub           | [github.md](./github.md)           | Recurring       | No          |

## Quick Start Example

A minimal config using the recommended starter set (Google + Groq + OpenRouter) with builder helpers:

```typescript
import { createRouter, createRateLimit, createTokenLimit } from 'llm-router';

const router = await createRouter({
  providers: {
    google: {
      keys: [process.env.GOOGLE_GENERATIVE_AI_API_KEY!],
      limits: [
        createRateLimit(15, 'per-minute'),
        createRateLimit(1000, 'daily'),
        createTokenLimit(250_000, 'per-minute'),
      ],
    },
    groq: {
      keys: [process.env.GROQ_API_KEY!],
      limits: [
        createRateLimit(30, 'per-minute'),
        createRateLimit(1000, 'daily'),
        createTokenLimit(100_000, 'daily'),
      ],
    },
    openrouter: {
      keys: [process.env.OPENROUTER_API_KEY!],
      limits: [createRateLimit(20, 'per-minute'), createRateLimit(200, 'daily')],
    },
  },
});

// Use any model -- router picks the best available key
const model = router.model('google/gemini-2.5-flash');
```

## How Limits Work in llm-router

- **User-configured limits are primary.** You set limits in your config based on your provider's current quotas.
- **No limits = key always available.** If you configure no limits, the key is used until the provider rejects it.
- **Retry proxy is the safety net.** When a provider returns 429 (rate limit), the retry proxy rotates to the next available key.
- **Shipped defaults are OFF by default.** The `applyRegistryDefaults` config toggle (default: false) means no stale data affects routing.

See [comparison.md](./comparison.md) for a side-by-side view of all providers.
