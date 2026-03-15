# Google AI Studio (Gemini)

> Last verified: 2026-03-14 | [Official limits page](https://ai.google.dev/gemini-api/docs/rate-limits)
> Verify current limits against official docs before configuring.

## Quick Reference

| Property             | Value                                         |
| -------------------- | --------------------------------------------- |
| Tier type            | Recurring free tier (resets daily/per-minute) |
| Credit card required | No                                            |
| Sign-up URL          | https://aistudio.google.com                   |
| API key page         | https://aistudio.google.com/app/apikey        |
| Env variable         | `GOOGLE_GENERATIVE_AI_API_KEY`                |
| AI SDK package       | `@ai-sdk/google`                              |

## Getting Your API Key

1. Go to [Google AI Studio](https://aistudio.google.com).
2. Sign in with your Google account (any Google account works).
3. Click **Get API Key** in the left sidebar.
4. Click **Create API Key** and select an existing Google Cloud project, or let it create one for you.
5. Copy the API key and set it as an environment variable:
   ```bash
   export GOOGLE_GENERATIVE_AI_API_KEY="your-api-key-here"
   ```

## Free Tier Summary

Limits vary by model. Below are reference values from the official docs (as of the last verified date). Always check the [official limits page](https://ai.google.dev/gemini-api/docs/rate-limits) for the latest numbers.

| Model                 | RPM | RPD    | TPM     |
| --------------------- | --- | ------ | ------- |
| Gemini 2.5 Pro        | 5   | 100    | 250,000 |
| Gemini 2.5 Flash      | 10  | 250    | 250,000 |
| Gemini 2.5 Flash-Lite | 15  | 1,000  | 250,000 |
| Gemini 2.0 Flash      | 5   | ~1,500 | 250,000 |

**Daily reset time:** Midnight Pacific Time.

## Configuration

```typescript
import { createRouter } from 'pennyllm';
import { createRateLimit, createTokenLimit } from 'pennyllm/policy';
import type { GoogleProviderConfig } from 'pennyllm/types';

const google: GoogleProviderConfig = {
  keys: [process.env.GOOGLE_GENERATIVE_AI_API_KEY!],
  limits: [
    // Adjust these values based on your account's current limits.
    // Check https://ai.google.dev/gemini-api/docs/rate-limits for the latest.
    createRateLimit(10, 'per-minute'), // RPM (varies by model: 5-15)
    createRateLimit(250, 'daily'), // RPD (varies by model: 100-1500)
    createTokenLimit(250_000, 'per-minute'), // TPM
  ],
};

const router = await createRouter({
  providers: { google },
});
```

## Gotchas & Tips

- **Limits are per Google Cloud project**, not per API key. Creating multiple keys in the same project does not increase your quota.
- **Dec 2025 quota reduction:** Google cut free tier quotas by 50-80% from previous levels. Older blog posts and guides may show higher limits.
- **Per-model limits:** Each model has its own RPM, RPD, and TPM limits. The config snippet above uses Gemini 2.5 Flash values as an example -- adjust for the model you use most.
- **Gemini 2.5 Flash thinking mode:** May return empty `result.text` and undefined usage fields. The pennyllm middleware guards against this with `Number(x) || 0`.
- **Enforcement:** Google returns HTTP 429 (`RESOURCE_EXHAUSTED`) with a `retry-after` header. The pennyllm retry proxy handles this automatically.

## Paid Tier

Google offers pay-as-you-go pricing for higher limits. Paid tier significantly increases RPM (up to 2,000), RPD (unlimited), and TPM (up to 4M). Pricing is per-million tokens and varies by model. See [ai.google.dev/pricing](https://ai.google.dev/pricing) for current rates.
