# OpenRouter

> Last verified: 2026-03-14 | [Official limits page](https://openrouter.ai/docs/api/reference/limits)
> Verify current limits against official docs before configuring.

## Quick Reference

| Property             | Value                                                                  |
| -------------------- | ---------------------------------------------------------------------- |
| Tier type            | Recurring free tier + optional credit system                           |
| Credit card required | No (for free models)                                                   |
| Sign-up URL          | https://openrouter.ai                                                  |
| API key page         | https://openrouter.ai/settings/keys                                    |
| Env variable         | `OPENROUTER_API_KEY`                                                   |
| AI SDK package       | `@ai-sdk/openai-compatible` (base URL: `https://openrouter.ai/api/v1`) |

## How OpenRouter Works

OpenRouter is a **meta-provider** that proxies requests to multiple underlying AI providers through a single API key. Instead of managing separate accounts with Google, Meta, NVIDIA, Mistral, and others, you get one key that routes to any of 28+ free models.

**Key concepts:**

- **Free models** have a `:free` suffix in their model ID (e.g., `meta-llama/llama-3.3-70b-instruct:free`).
- **Credit system:** OpenRouter gives new users a small test credit. Purchasing $10+ in credits permanently unlocks 1,000 RPD for free models (up from 50 RPD), even after your credit balance depletes.
- **Single API endpoint:** All models are accessed through the same OpenAI-compatible endpoint at `https://openrouter.ai/api/v1`.

## Getting Your API Key

1. Go to [OpenRouter](https://openrouter.ai) and sign up (email or OAuth).
2. Navigate to [Settings > Keys](https://openrouter.ai/settings/keys).
3. Click **Create Key**, give it a name, and copy the key.
4. Set it as an environment variable:
   ```bash
   export OPENROUTER_API_KEY="your-api-key-here"
   ```
5. _(Optional)_ Purchase $10 in credits to permanently unlock 1,000 RPD for free models.

## Free Tier Summary

| Metric         | No Credits Purchased | $10+ Credits Purchased |
| -------------- | -------------------- | ---------------------- |
| Free model RPM | 20                   | 20                     |
| Free model RPD | 50                   | 1,000                  |

### Top 5 Recommended Free Models

Below are reference picks based on capabilities and context window. The free model list changes over time -- check [openrouter.ai/models](https://openrouter.ai/models?q=:free) for the latest.

| Model                                  | Context | Capabilities             |
| -------------------------------------- | ------- | ------------------------ |
| openrouter/hunter-alpha                | 1.0M    | Tools, Reasoning         |
| openrouter/healer-alpha                | 262K    | Vision, Tools, Reasoning |
| nvidia/nemotron-3-super-120b-a12b:free | 262K    | Tools, Reasoning         |
| qwen/qwen3-coder:free                  | 262K    | Tools (coding)           |
| meta-llama/llama-3.3-70b-instruct:free | 128K    | Tools                    |

## Configuration

```typescript
import { createRouter } from 'llm-router';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { createRateLimit } from 'llm-router/policy';
import type { OpenRouterProviderConfig } from 'llm-router/types';

const openrouter: OpenRouterProviderConfig = {
  keys: [process.env.OPENROUTER_API_KEY!],
  limits: [
    // Adjust these values based on your account's current limits.
    // Check https://openrouter.ai/docs/api/reference/limits for the latest.
    createRateLimit(20, 'per-minute'), // RPM for free models
    createRateLimit(50, 'daily'), // RPD without credits (1000 with $10+ purchased)
  ],
};

const router = await createRouter({
  providers: { openrouter },
});
```

When using the AI SDK directly with OpenRouter, configure the provider like this:

```typescript
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

const openrouter = createOpenAICompatible({
  name: 'openrouter',
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
});

// Use with :free suffix for free models
const model = openrouter.chatModel('meta-llama/llama-3.3-70b-instruct:free');
```

## Gotchas & Tips

- **Creating additional API keys does NOT increase rate limits.** Limits are global per-account, not per-key.
- **Failed attempts count toward daily quota.** Even requests that error out consume your RPD.
- **Negative credit balance blocks ALL requests** -- including free models. You will receive HTTP 402 errors until the balance is positive. Be careful with paid model usage.
- **Provider-level rate limiting:** During peak times, the underlying provider (e.g., Google, Meta) may rate-limit requests even if your OpenRouter quota is available.
- **The $10 RPD unlock is permanent.** Once you purchase $10 in credits, you keep 1,000 RPD for free models forever, even after spending the credits.
- **Enforcement:** OpenRouter returns HTTP 429 for rate limits and HTTP 402 for negative balance. The llm-router retry proxy handles 429s automatically but cannot recover from 402 (payment required).

## Paid Tier

OpenRouter uses a credit-based pay-per-use system for paid models. Add credits to your account to access premium models (GPT-4o, Claude, Gemini Pro, etc.) with higher rate limits. Pricing varies by model and is listed on each model's page at [openrouter.ai/models](https://openrouter.ai/models).
