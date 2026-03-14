# HuggingFace Inference API

> Last verified: 2026-03-14 | [Official pricing page](https://huggingface.co/docs/inference-providers/pricing)
> Verify current limits against official docs before configuring.

## Quick Reference

| Property             | Value                                  |
| -------------------- | -------------------------------------- |
| Tier type            | Monthly credits ($0.10/month free)     |
| Credit card required | No (for free credits)                  |
| Sign-up URL          | https://huggingface.co/join            |
| API key page         | https://huggingface.co/settings/tokens |
| Env variable         | `HUGGINGFACE_API_KEY`                  |
| AI SDK package       | `@ai-sdk/huggingface`                  |

## Getting Your API Key

1. Go to [HuggingFace](https://huggingface.co/join) and create an account.
2. Navigate to [Settings > Access Tokens](https://huggingface.co/settings/tokens).
3. Click **New token**, give it a name, select the appropriate permissions (Read access is sufficient for inference), and create it.
4. Copy the token and set it as an environment variable:
   ```bash
   export HUGGINGFACE_API_KEY="your-token-here"
   ```

**Important:** The native HuggingFace convention is `HF_TOKEN`, but the AI SDK package uses `HUGGINGFACE_API_KEY`. Set whichever your code expects (or both).

## Free Tier Summary

HuggingFace uses a **credit-based billing system**, not token-based limits. Your free credits are consumed based on compute time, not token count.

| Account Type | Monthly Credits | Pay-as-you-go       |
| ------------ | --------------- | ------------------- |
| Free         | $0.10           | Yes (after credits) |
| PRO ($9/mo)  | $2.00           | Yes                 |

**How billing works:** Charges are based on compute-time multiplied by hardware cost, not on token count. A short request on a small model costs less than a long request on a large model. The $0.10 free credit may support roughly 10-50 requests depending on the model used.

**Free models:** Access to 200+ models from leading inference providers via the HuggingFace Inference Router at `https://router.huggingface.co/v1`.

## Configuration

Since HuggingFace billing is compute-time-based rather than token-based, use `createCallLimit` to cap the number of API calls rather than token limits.

```typescript
import { createRouter } from 'llm-router';
import { createCallLimit } from 'llm-router/policy';
import type { HuggingFaceProviderConfig } from 'llm-router/types';

const huggingface: HuggingFaceProviderConfig = {
  keys: [process.env.HUGGINGFACE_API_KEY!],
  limits: [
    // Adjust these values based on your observed credit consumption.
    // $0.10/month supports roughly 10-50 requests depending on model.
    // Check https://huggingface.co/docs/inference-providers/pricing for the latest.
    createCallLimit(30, 'daily'), // Conservative daily call budget
    createCallLimit(500, 'monthly'), // Conservative monthly call budget
  ],
};

const router = await createRouter({
  providers: { huggingface },
});
```

## Gotchas & Tips

- **$0.10/month is very small.** Depending on the model, you may exhaust your free credits in just 10-50 requests. Monitor your usage on the [HuggingFace billing page](https://huggingface.co/settings/billing).
- **Billing is compute-time-based**, not token-based. A 1-second inference on a small model costs much less than a 30-second inference on a large model. This makes it difficult to predict exact costs from token counts alone.
- **HuggingFace is an aggregator/proxy.** It routes your requests to multiple underlying inference providers, similar to OpenRouter but with a different billing model.
- **Env variable mismatch:** The native HF convention is `HF_TOKEN`, but `@ai-sdk/huggingface` expects `HUGGINGFACE_API_KEY`. If you use both HF tools and the AI SDK, set both variables.
- **PRO plan ($9/month)** gives 20x more credits ($2.00/month). If you use HuggingFace regularly, the PRO plan provides significantly better value.
- **Enforcement:** Requests fail when credits are exhausted. Top up credits or wait for the monthly refresh.

## Paid Tier

HuggingFace PRO costs $9/month and includes $2.00 in monthly inference credits (20x the free amount). Enterprise plans are available for higher-volume usage. All plans support pay-as-you-go billing after credits are consumed. See [huggingface.co/pricing](https://huggingface.co/pricing) for details.
