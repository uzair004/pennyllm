# Cerebras

> Last verified: 2026-03-14 | [Official limits page](https://inference-docs.cerebras.ai/support/rate-limits)
> Verify current limits against official docs before configuring.

## Quick Reference

| Property             | Value                       |
| -------------------- | --------------------------- |
| Tier type            | Recurring free tier (daily) |
| Credit card required | No                          |
| Sign-up URL          | https://cloud.cerebras.ai   |
| API key page         | https://cloud.cerebras.ai   |
| Env variable         | `CEREBRAS_API_KEY`          |
| AI SDK package       | `@ai-sdk/cerebras`          |

## Getting Your API Key

1. Go to [Cerebras Cloud](https://cloud.cerebras.ai) and create an account.
2. Once logged in, navigate to the API Keys section in the dashboard.
3. Create a new API key and copy it.
4. Set it as an environment variable:
   ```bash
   export CEREBRAS_API_KEY="your-api-key-here"
   ```

## Free Tier Summary

Limits vary by model. Below are reference values for the main available models. Always check the [official limits page](https://inference-docs.cerebras.ai/support/rate-limits) for the latest numbers.

| Model                     | RPM | RPD    | TPM | TPD |
| ------------------------- | --- | ------ | --- | --- |
| llama3.1-8b               | 30  | 14,400 | 60K | 1M  |
| gpt-oss-120b              | 30  | 14,400 | 64K | 1M  |
| qwen-3-235b-a22b-instruct | 30  | 14,400 | 60K | 1M  |

**Free tier context window:** Limited to **8,192 tokens** on the free tier. This is significantly less than other providers (which typically offer 128K+). Plan your prompts accordingly.

## Configuration

```typescript
import { createRouter } from 'llm-router';
import { createRateLimit, createTokenLimit } from 'llm-router/policy';
import type { CerebrasProviderConfig } from 'llm-router/types';

const cerebras: CerebrasProviderConfig = {
  keys: [process.env.CEREBRAS_API_KEY!],
  limits: [
    // Adjust these values based on your account's current limits.
    // Check https://inference-docs.cerebras.ai/support/rate-limits for the latest.
    createRateLimit(30, 'per-minute'), // RPM
    createTokenLimit(60_000, 'per-minute'), // TPM (varies by model: 60K-64K)
    createTokenLimit(1_000_000, 'daily'), // TPD (1M tokens/day)
  ],
};

const router = await createRouter({
  providers: { cerebras },
});
```

## Gotchas & Tips

- **8,192 token context window on free tier.** This is the most significant limitation. Paid tiers unlock larger context windows. If your prompts regularly exceed 8K tokens, Cerebras free tier is not suitable.
- **Ultra-fast inference (~2,600 tokens/sec).** Cerebras uses custom Wafer-Scale Engine (WSE) hardware, delivering some of the fastest inference speeds available. Excellent for latency-sensitive applications.
- **Token bucket algorithm.** Unlike providers that reset at fixed intervals (e.g., midnight), Cerebras uses continuous token replenishment. Capacity fills back up gradually rather than resetting all at once. This means you can sustain a steady request rate rather than bursting and waiting.
- **1M TPD is generous.** Combined with 14,400 RPD, Cerebras provides substantial daily capacity for free -- the main constraint is the per-request context window.
- **Enforcement:** Rate limiting uses a token bucket model. The llm-router retry proxy handles rate limit responses automatically.

## Paid Tier

Cerebras offers paid tiers with larger context windows (up to 128K tokens), higher rate limits, and priority access. Check [cloud.cerebras.ai](https://cloud.cerebras.ai) for current pricing and plan details.
