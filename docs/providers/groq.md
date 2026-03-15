# Groq

> Last verified: 2026-03-14 | [Official limits page](https://console.groq.com/docs/rate-limits)
> Verify current limits against official docs before configuring.

## Quick Reference

| Property             | Value                                         |
| -------------------- | --------------------------------------------- |
| Tier type            | Recurring free tier (resets daily/per-minute) |
| Credit card required | No                                            |
| Sign-up URL          | https://console.groq.com                      |
| API key page         | https://console.groq.com/keys                 |
| Env variable         | `GROQ_API_KEY`                                |
| AI SDK package       | `@ai-sdk/groq`                                |

## Getting Your API Key

1. Go to [Groq Console](https://console.groq.com).
2. Sign up with your email or a Google/GitHub account.
3. Navigate to **API Keys** in the left sidebar, or go directly to https://console.groq.com/keys.
4. Click **Create API Key**, give it a name, and copy the key.
5. Set it as an environment variable:
   ```bash
   export GROQ_API_KEY="your-api-key-here"
   ```

## Free Tier Summary

Limits vary by model. Below are reference values for popular models. Always check the [official limits page](https://console.groq.com/docs/rate-limits) for the latest numbers.

| Model                                     | RPM | RPD    | TPM | TPD  |
| ----------------------------------------- | --- | ------ | --- | ---- |
| llama-3.3-70b-versatile                   | 30  | 1,000  | 12K | 100K |
| llama-3.1-8b-instant                      | 30  | 14,400 | 6K  | 500K |
| meta-llama/llama-4-scout-17b-16e-instruct | 30  | 1,000  | 30K | 500K |
| qwen/qwen3-32b                            | 60  | 1,000  | 6K  | 500K |
| moonshotai/kimi-k2-instruct               | 60  | 1,000  | 10K | 300K |
| openai/gpt-oss-120b                       | 30  | 1,000  | 8K  | 200K |

## Configuration

```typescript
import { createRouter } from 'pennyllm';
import { createRateLimit, createTokenLimit } from 'pennyllm/policy';
import type { GroqProviderConfig } from 'pennyllm/types';

const groq: GroqProviderConfig = {
  keys: [process.env.GROQ_API_KEY!],
  limits: [
    // Adjust these values based on your account's current limits.
    // Check https://console.groq.com/docs/rate-limits for the latest.
    createRateLimit(30, 'per-minute'), // RPM (varies by model: 20-60)
    createRateLimit(1000, 'daily'), // RPD (varies by model: 1K-14.4K)
    createTokenLimit(12_000, 'per-minute'), // TPM (varies by model: 6K-30K)
    createTokenLimit(100_000, 'daily'), // TPD (varies by model: 100K-500K)
  ],
};

const router = await createRouter({
  providers: { groq },
});
```

## Gotchas & Tips

- **Limits are per-organization**, not per-key. Creating multiple API keys does not increase your quota.
- **TPM limits are low** (6K-30K). A single large prompt can exhaust your per-minute token budget. Keep prompts concise or use smaller models (e.g., llama-3.1-8b-instant has only 6K TPM).
- **Ultra-fast inference:** Groq's LPU hardware delivers ~1,000 tokens/sec, making it excellent for latency-sensitive workloads -- but the daily token caps limit volume.
- **Model churn:** Groq frequently adds new models and retires old ones. Check the console for the latest model list.
- **Enforcement:** Groq returns HTTP 429 with rate limit headers. The pennyllm retry proxy handles this automatically.

## Paid Tier

Groq offers paid tiers with significantly higher limits. Contact Groq or check [console.groq.com](https://console.groq.com) for enterprise pricing. The main uplift is in RPD and TPD, removing the daily token caps that constrain free tier usage.
