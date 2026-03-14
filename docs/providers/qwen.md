# Qwen (Alibaba Cloud Model Studio)

> Last verified: 2026-03-14 | [Official free quota docs](https://www.alibabacloud.com/help/en/model-studio/new-free-quota)
> Verify current limits against official docs before configuring.

## Quick Reference

| Property             | Value                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------ |
| Tier type            | Trial credits (1M tokens, 90-day expiry, Singapore region ONLY)                                  |
| Credit card required | No (Alibaba Cloud account required)                                                              |
| Sign-up URL          | https://www.alibabacloud.com                                                                     |
| API key page         | Model Studio Key Management page                                                                 |
| Env variable         | `DASHSCOPE_API_KEY`                                                                              |
| AI SDK package       | `@ai-sdk/openai-compatible` (base URL: `https://dashscope-intl.aliyuncs.com/compatible-mode/v1`) |

## Getting Your API Key

1. Go to [alibabacloud.com](https://www.alibabacloud.com) and create an Alibaba Cloud account (not just a Qwen account).
2. Navigate to **Model Studio** and activate the service.
3. **Important:** Select the **Singapore** deployment region. The free quota is only available in Singapore -- the Chinese Mainland region has no free quota.
4. Go to the **Key Management** page in Model Studio.
5. Create a new API key and copy it.
6. Set the environment variable:
   ```bash
   export DASHSCOPE_API_KEY="sk-..."
   ```

## Free Tier Summary

| Metric                | Value                   |
| --------------------- | ----------------------- |
| Free token quota      | 1,000,000 tokens        |
| Validity              | 90 days from activation |
| RPM (varies by model) | 600 - 30,000            |
| TPM (varies by model) | 1M - 10M                |

**Available models:** qwen-max, qwen-plus, qwen3.5-plus, qwen3.5-flash, qwen-turbo, and more.

**Dual-limit mechanism:** Qwen enforces both RPM (requests per minute) and RPS (requests per second) simultaneously. A burst in a single second can trigger throttling even if your minute-level quota is fine.

## Configuration

```typescript
import { createTokenLimit, createRateLimit } from 'llm-router/policy';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { QwenProviderConfig } from 'llm-router/types';

// Set up the OpenAI-compatible provider for Qwen
const qwenProvider = createOpenAICompatible({
  name: 'qwen',
  baseURL: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
  headers: {
    Authorization: `Bearer ${process.env.DASHSCOPE_API_KEY}`,
  },
});

const qwen: QwenProviderConfig = {
  keys: [process.env.DASHSCOPE_API_KEY!],
  // Check https://www.alibabacloud.com/help/en/model-studio/rate-limit
  // for current per-model RPM/TPM limits.
  limits: [
    createTokenLimit(1_000_000, 'monthly'), // budget your 1M free quota
    createRateLimit(600, 'per-minute'), // conservative RPM (model-dependent)
  ],
};
```

## Gotchas & Tips

- **Singapore region only.** The free quota is ONLY available in the Singapore deployment region. The Chinese Mainland deployment has no free quota.
- **Alibaba Cloud account required.** A standalone Qwen account is not sufficient -- you need a full Alibaba Cloud account.
- **Dual-limit enforcement.** RPM and RPS are enforced simultaneously. Even with remaining minute quota, a single-second burst can trigger throttling.
- **Enable "Free Quota Only" safety feature.** This prevents overage charges if your free quota is exhausted.
- **Console data updates hourly.** Usage statistics are not real-time -- they refresh approximately every hour.
- **Interface partially in Chinese.** Some configuration pages may only be available in Chinese.
- **Account and RAM users share quota.** Sub-accounts share the same free quota pool.

## Paid Tier

After the free quota expires, Qwen offers pay-as-you-go pricing. Rates vary by model (qwen-turbo is cheapest, qwen-max is most capable). Enable the "Free Quota Only" toggle to prevent automatic billing after credits are exhausted. See [Alibaba Cloud Model Studio pricing](https://www.alibabacloud.com/help/en/model-studio/billing-overview) for current rates.
