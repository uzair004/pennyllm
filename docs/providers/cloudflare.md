# Cloudflare Workers AI

> Last verified: 2026-03-14 | [Official pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)
> Verify current limits against official docs before configuring.

## Quick Reference

| Property             | Value                                                                                                      |
| -------------------- | ---------------------------------------------------------------------------------------------------------- |
| Tier type            | Recurring (10,000 neurons/day)                                                                             |
| Credit card required | No                                                                                                         |
| Sign-up URL          | https://dash.cloudflare.com/sign-up                                                                        |
| API key page         | Cloudflare dashboard > API Tokens                                                                          |
| Env variables        | `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`                                                           |
| AI SDK package       | `@ai-sdk/openai-compatible` (base URL: `https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/ai/v1`) |

## Getting Your API Key

1. Go to [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up) and create a Cloudflare account (free).
2. After signing in, note your **Account ID** from the dashboard URL or the right sidebar on any zone page.
3. Go to **My Profile > API Tokens** (or visit `dash.cloudflare.com/profile/api-tokens`).
4. Click **Create Token**.
5. Use the **Custom token** template. Add these permissions:
   - **Workers AI - Read**
   - **Workers AI - Edit**
6. Create the token and copy it.
7. Set both environment variables:
   ```bash
   export CLOUDFLARE_API_TOKEN="your-api-token"
   export CLOUDFLARE_ACCOUNT_ID="your-account-id"
   ```

## Free Tier Summary

| Metric           | Value                               |
| ---------------- | ----------------------------------- |
| Free neurons/day | 10,000                              |
| Token equivalent | Varies by model (neurons != tokens) |
| Reset            | Daily at 00:00 UTC                  |

**Important:** Cloudflare prices in "neurons," not tokens. The neuron-to-token conversion varies by model. For example, a text generation request may consume a different number of neurons than the equivalent token count suggests. Check [Cloudflare's pricing page](https://developers.cloudflare.com/workers-ai/platform/pricing/) for model-specific neuron costs.

**Available models:** All Workers AI models are accessible on the free tier (Llama 3.1/3.3/4, Mistral, Gemma 3, Qwen, DeepSeek-R1-Distill, and more). The limit is neurons consumed, not model access.

## Configuration

```typescript
import { createRateLimit } from 'llm-router/policy';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { CloudflareProviderConfig } from 'llm-router/types';

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID!;

// Set up the OpenAI-compatible provider for Cloudflare Workers AI REST API
const cloudflareProvider = createOpenAICompatible({
  name: 'cloudflare',
  baseURL: `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1`,
  headers: {
    Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
  },
});

const cloudflare: CloudflareProviderConfig = {
  keys: [process.env.CLOUDFLARE_API_TOKEN!],
  // Cloudflare uses neurons, not tokens. Set limits based on your
  // observed neuron consumption per request.
  // Check https://developers.cloudflare.com/workers-ai/platform/pricing/
  limits: [
    // No standard token/rate limits -- neuron-based.
    // Set a conservative daily call limit to stay within 10K neurons.
    createRateLimit(100, 'daily'), // adjust based on your model's neuron cost
  ],
};
```

## Gotchas & Tips

- **Neurons are not tokens.** The neuron-to-token conversion ratio varies by model. Monitor your neuron usage in the Cloudflare dashboard.
- **Two env vars required.** Unlike most providers, Cloudflare needs both an API token and an Account ID.
- **REST API, not Workers binding.** For use with llm-router, use the REST API endpoint (not the Cloudflare Workers `AI` binding). The REST API works from any server.
- **API token permissions matter.** Your token must have both `Workers AI - Read` and `Workers AI - Edit` permissions. A default "Edit Cloudflare Workers" token may not include AI permissions.
- **The `workers-ai-provider` community package** is designed for Cloudflare Workers only and is not suitable for general server use. Use `@ai-sdk/openai-compatible` instead.
- **Daily reset at 00:00 UTC.** Neuron allocation resets at midnight UTC.

## Paid Tier

Beyond the 10,000 free neurons/day, Cloudflare charges per-neuron for Workers AI usage. Pricing varies by model category. See [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/) for current rates. No credit card is required to use the free tier.
