# Cohere

> Last verified: 2026-03-14 | [Official rate limits](https://docs.cohere.com/docs/rate-limits)
> Verify current limits against official docs before configuring.

## Quick Reference

| Property             | Value                                                  |
| -------------------- | ------------------------------------------------------ |
| Tier type            | Trial key (1,000 calls/month, non-commercial use only) |
| Credit card required | No                                                     |
| Sign-up URL          | https://dashboard.cohere.com/welcome/register          |
| API key page         | https://dashboard.cohere.com/api-keys                  |
| Env variable         | `COHERE_API_KEY`                                       |
| AI SDK package       | `@ai-sdk/cohere`                                       |

## Getting Your API Key

1. Go to [dashboard.cohere.com/welcome/register](https://dashboard.cohere.com/welcome/register) and create an account.
2. Verify your email address.
3. Navigate to **API Keys** at [dashboard.cohere.com/api-keys](https://dashboard.cohere.com/api-keys).
4. Your trial API key is shown on the dashboard. Copy it.
5. Set the environment variable:
   ```bash
   export COHERE_API_KEY="..."
   ```

> **Non-commercial use only.** Trial API keys are explicitly NOT permitted for production or commercial use. You must upgrade to a Production key for any commercial workload.

## Free Tier Summary

| Endpoint       | RPM              | Monthly Cap          |
| -------------- | ---------------- | -------------------- |
| Chat           | 20               | 1,000 calls (shared) |
| Embed (text)   | 2,000 inputs/min | 1,000 calls (shared) |
| Embed (images) | 5 inputs/min     | 1,000 calls (shared) |
| Rerank         | 10               | 1,000 calls (shared) |

The 1,000 calls/month limit is **shared across all endpoints**. Using 500 chat calls leaves only 500 for embed, rerank, etc.

**Available models:** Command R+, Command R, Rerank 3.5, Embed 4 (all accessible on trial key).

## Configuration

```typescript
import { createRateLimit, createCallLimit } from 'pennyllm/policy';
import type { CohereProviderConfig } from 'pennyllm/types';

const cohere: CohereProviderConfig = {
  keys: [process.env.COHERE_API_KEY!],
  // Check https://docs.cohere.com/docs/rate-limits for current limits.
  limits: [
    createRateLimit(20, 'per-minute'), // Chat RPM limit
    createCallLimit(1000, 'monthly'), // shared monthly call cap
  ],
};
```

## Gotchas & Tips

- **Non-commercial restriction.** Trial keys are explicitly not permitted for production or commercial use. This is prominently stated in Cohere's terms of service.
- **Shared monthly cap.** The 1,000 calls/month limit is shared across ALL endpoints (Chat, Embed, Rerank). Budget accordingly.
- **20 RPM for Chat.** This is a reasonable per-minute limit, but the total monthly cap is the binding constraint.
- **Production key required for real use.** To use Cohere in any production capacity, you must apply for and upgrade to a Production API key.
- **Endpoint-specific RPM.** Different endpoints have different RPM limits (Chat: 20, Embed: 2000 inputs/min, Rerank: 10).

## Paid Tier

Cohere offers Production keys with higher limits for commercial use. Pricing is per-token for generation and per-input for embed/rerank. Apply for a Production key through the [Cohere dashboard](https://dashboard.cohere.com). Enterprise plans with custom limits are also available.
