# NVIDIA NIM

> Last verified: 2026-03-14 | [NVIDIA NIM catalog](https://build.nvidia.com)
> Verify current limits against official docs before configuring.

## Quick Reference

| Property             | Value                                                                         |
| -------------------- | ----------------------------------------------------------------------------- |
| Tier type            | Trial credits (1,000 credits, can request 4,000 more)                         |
| Credit card required | No                                                                            |
| Sign-up URL          | https://build.nvidia.com                                                      |
| API key page         | NVIDIA Developer dashboard                                                    |
| Env variable         | `NIM_API_KEY`                                                                 |
| AI SDK package       | `@ai-sdk/openai-compatible` (base URL: `https://integrate.api.nvidia.com/v1`) |

## Getting Your API Key

1. Go to [build.nvidia.com](https://build.nvidia.com) and sign in with an NVIDIA Developer account (or create one for free).
2. Browse the model catalog and select any model (e.g., Llama 3.1, DeepSeek-R1, Nemotron).
3. Click **Get API Key** or navigate to your developer settings.
4. Generate a new API key and copy it.
5. Set the environment variable:
   ```bash
   export NIM_API_KEY="nvapi-..."
   ```
6. **Optional:** Click the **Request More** button to get an additional 4,000 credits.

## Free Tier Summary

| Metric                     | Value                          |
| -------------------------- | ------------------------------ |
| Initial credits            | 1,000 (can request 4,000 more) |
| RPM                        | 40                             |
| Token-to-credit conversion | Not publicly documented        |

**Important:** The credit system is opaque. NVIDIA does not publicly document how many tokens equal one credit, and the conversion rate varies by model. Monitor your credit balance in the NVIDIA developer dashboard.

**Available models:** DeepSeek-R1, Llama 3.1 (various sizes), Nemotron, and many others from the [build.nvidia.com](https://build.nvidia.com) catalog.

## Configuration

```typescript
import { createRateLimit } from 'llm-router/policy';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { NvidiaProviderConfig } from 'llm-router/types';

// Set up the OpenAI-compatible provider for NVIDIA NIM
const nvidiaProvider = createOpenAICompatible({
  name: 'nvidia',
  baseURL: 'https://integrate.api.nvidia.com/v1',
  headers: {
    Authorization: `Bearer ${process.env.NIM_API_KEY}`,
  },
});

const nvidia: NvidiaProviderConfig = {
  keys: [process.env.NIM_API_KEY!],
  // NVIDIA credits are tracked separately by the platform.
  // Set RPM limit based on trial tier restriction.
  // Check https://build.nvidia.com for your remaining credit balance.
  limits: [
    createRateLimit(40, 'per-minute'), // trial tier RPM limit
  ],
};
```

## Gotchas & Tips

- **Opaque credit system.** The token-to-credit conversion rate is not publicly documented and varies by model. Check your balance frequently.
- **Credits can run out quickly.** Large models or long prompts consume more credits per request.
- **40 RPM limit.** The trial tier enforces a 40 requests-per-minute limit, returning 429 errors when exceeded.
- **New models are often overloaded.** Newly added free API models may experience high latency or errors due to demand.
- **Request more credits.** Use the "Request More" button on build.nvidia.com to get an additional 4,000 credits on top of the initial 1,000.
- **NVIDIA Developer Program.** Membership in NVIDIA's developer program may provide additional free access or higher limits.

## Paid Tier

NVIDIA offers self-hosted NIM containers and paid API access for production use. Pricing depends on the deployment model (cloud API vs. self-hosted). See [NVIDIA NIM documentation](https://docs.nvidia.com/nim/) for enterprise options.
