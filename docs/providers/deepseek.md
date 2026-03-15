# DeepSeek

> Last verified: 2026-03-14 | [Official pricing/limits](https://api-docs.deepseek.com/quick_start/pricing)
> Verify current limits against official docs before configuring.

## Quick Reference

| Property             | Value                                    |
| -------------------- | ---------------------------------------- |
| Tier type            | Trial credits (5M tokens, 30-day expiry) |
| Credit card required | No                                       |
| Sign-up URL          | https://platform.deepseek.com            |
| API key page         | https://platform.deepseek.com/api_keys   |
| Env variable         | `DEEPSEEK_API_KEY`                       |
| AI SDK package       | `@ai-sdk/deepseek`                       |

## Getting Your API Key

1. Go to [platform.deepseek.com](https://platform.deepseek.com) and create an account (English and Chinese interfaces available).
2. Verify your email address.
3. Navigate to **API Keys** at [platform.deepseek.com/api_keys](https://platform.deepseek.com/api_keys).
4. Click **Create new API key**, give it a name, and copy the key.
5. Set the environment variable:
   ```bash
   export DEEPSEEK_API_KEY="sk-..."
   ```

## Free Tier Summary

| Metric          | Value                               |
| --------------- | ----------------------------------- |
| Initial credits | 5M tokens (some sources report 10M) |
| Credit validity | 30 days from registration           |
| Rate limits     | None enforced (best-effort serving) |

DeepSeek does not enforce rate limits. Under heavy load, requests may experience delays rather than receiving 429 errors. For streaming requests, the server sends `: keep-alive` comments during delays. Non-streaming requests may receive empty lines. The server closes connections after a 10-minute inference timeout.

**Available models:** DeepSeek-V3 (`deepseek-chat`), DeepSeek-R1 (`deepseek-reasoner`).

## Configuration

```typescript
import { createTokenLimit } from 'pennyllm/policy';
import type { DeepSeekProviderConfig } from 'pennyllm/types';

const deepseek: DeepSeekProviderConfig = {
  keys: [process.env.DEEPSEEK_API_KEY!],
  // DeepSeek uses trial credits, not rate limits.
  // Use createTokenLimit to budget your credit allocation.
  // Check https://platform.deepseek.com for your remaining balance.
  limits: [
    createTokenLimit(5_000_000, 'monthly'), // budget your 5M credit pool
  ],
};
```

## Gotchas & Tips

- **Credits expire after 30 days.** This is a trial allocation, not a recurring free tier. Plan your usage accordingly.
- **No 429 errors.** DeepSeek does not enforce rate limits, so the retry proxy will not trigger on rate limits. Delays occur instead.
- **10-minute timeout.** Under heavy load, the server may close your connection if inference hasn't started within 10 minutes.
- **English and Chinese interface.** The platform supports both languages; some documentation may be Chinese-only.
- **Very cheap pay-as-you-go.** After credits expire, pricing starts at $0.28/M input tokens and $0.42/M output tokens -- among the cheapest providers.

## Paid Tier

After trial credits expire, DeepSeek automatically switches to pay-as-you-go billing. Pricing is very competitive: $0.28/M input tokens, $0.42/M output tokens for DeepSeek-V3. No rate limits are enforced on paid usage either. Top up your balance at [platform.deepseek.com](https://platform.deepseek.com).
