# Mistral (La Plateforme)

> Last verified: 2026-03-14 | [Official limits page](https://admin.mistral.ai/plateforme/limits)
> Verify current limits against official docs before configuring.

## Quick Reference

| Property             | Value                                   |
| -------------------- | --------------------------------------- |
| Tier type            | Recurring free tier ("Experiment" plan) |
| Credit card required | No                                      |
| Sign-up URL          | https://console.mistral.ai              |
| API key page         | https://console.mistral.ai/api-keys     |
| Env variable         | `MISTRAL_API_KEY`                       |
| AI SDK package       | `@ai-sdk/mistral`                       |

## Getting Your API Key

1. Go to [Mistral Console](https://console.mistral.ai) and create an account.
2. **Complete phone verification** -- Mistral requires a valid phone number during signup.
3. Your account will be on the **Experiment** plan (free tier) by default.
4. Navigate to [API Keys](https://console.mistral.ai/api-keys) in the console.
5. Click **Create API Key**, give it a name, and copy the key.
6. Set it as an environment variable:
   ```bash
   export MISTRAL_API_KEY="your-api-key-here"
   ```

## Free Tier Summary

The Experiment plan has global limits that apply across all models. Specific per-model limits are only viewable in the [admin dashboard](https://admin.mistral.ai/plateforme/limits).

| Metric         | Value              | Notes                                       |
| -------------- | ------------------ | ------------------------------------------- |
| RPM            | ~2                 | Very low -- limits throughput significantly |
| TPM            | 500,000            | Generous per-minute token allowance         |
| Monthly tokens | 1,000,000,000 (1B) | Very generous monthly cap                   |

**Free models:** All models are accessible on the Experiment plan, including Mistral Small, Pixtral (vision), Devstral (coding), and Codestral. The exact model list may vary.

## Configuration

```typescript
import { createRouter } from 'llm-router';
import { createRateLimit, createTokenLimit } from 'llm-router/policy';
import type { MistralProviderConfig } from 'llm-router/types';

const mistral: MistralProviderConfig = {
  keys: [process.env.MISTRAL_API_KEY!],
  limits: [
    // Adjust these values based on your account's current limits.
    // Check https://admin.mistral.ai/plateforme/limits for the latest.
    createRateLimit(2, 'per-minute'), // RPM (very low on Experiment plan)
    createTokenLimit(500_000, 'per-minute'), // TPM
    createTokenLimit(1_000_000_000, 'monthly'), // 1B tokens/month
  ],
};

const router = await createRouter({
  providers: { mistral },
});
```

## Gotchas & Tips

- **Phone verification required.** You cannot create an API key without completing phone verification during signup.
- **Very low RPM (~2/min).** This is the primary bottleneck on the Experiment plan. The 1B monthly token allowance is generous, but you can only send about 2 requests per minute. Plan your usage accordingly.
- **Per-model limits are not publicly documented.** The global limits above apply across all models, but individual models may have lower limits. Check the [admin dashboard](https://admin.mistral.ai/plateforme/limits) after creating your account.
- **Enforcement:** Mistral returns HTTP 429 when limits are exceeded. The llm-router retry proxy handles this automatically.
- **Best use case:** Mistral works well as a low-frequency provider in a rotation -- send a request or two per minute while other providers handle burst traffic.

## Paid Tier

Mistral offers paid plans with significantly higher RPM (up to 100+) and no monthly token cap. See [docs.mistral.ai](https://docs.mistral.ai/deployment/ai-studio/tier) for plan comparison and pricing.
