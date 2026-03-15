# GitHub Models

> Last verified: 2026-03-14 | [Official docs](https://docs.github.com/github-models/prototyping-with-ai-models)
> Verify current limits against official docs before configuring.

## Quick Reference

| Property             | Value                                                             |
| -------------------- | ----------------------------------------------------------------- |
| Tier type            | Recurring (rate-limited by model category)                        |
| Credit card required | No (GitHub account required)                                      |
| Sign-up URL          | https://github.com/signup                                         |
| API key page         | https://github.com/settings/tokens (PAT with `models:read` scope) |
| Env variable         | `GITHUB_TOKEN`                                                    |
| AI SDK package       | `@github/models` (dedicated) or `@ai-sdk/openai-compatible`       |
| Base URL             | `https://models.github.ai/inference`                              |

## Getting Your API Key

1. If you don't have one already, create a GitHub account at [github.com/signup](https://github.com/signup) (free).
2. Go to [github.com/settings/tokens](https://github.com/settings/tokens).
3. Click **Generate new token** (fine-grained tokens work).
4. Under **Permissions**, enable the `models:read` scope.
5. Generate the token and copy it.
6. Set the environment variable:
   ```bash
   export GITHUB_TOKEN="github_pat_..."
   ```

> **Deprecated endpoint:** The old endpoint `models.inference.ai.azure.com` was deprecated in July 2025. Use `models.github.ai/inference` instead.

## Free Tier Summary

| Category    | RPM | RPD | Tokens/Request       | Concurrent |
| ----------- | --- | --- | -------------------- | ---------- |
| Low models  | 15  | 150 | 8K input / 4K output | 5          |
| High models | 10  | 50  | 8K input / 4K output | 2          |
| Embedding   | 15  | 150 | 64K input            | 5          |

**Low models (more generous limits):** Llama 3.1 8B, Gemini 2.5 Flash, Mistral Small, GPT-4o mini.

**High models (stricter limits):** Claude, GPT-4o, Gemini Pro.

**Premium models (require paid Copilot):** o1, o3, GPT-5, DeepSeek-R1.

**Note:** Token limits are **per-request**, not per-day. Each request is capped at 8K input / 4K output tokens.

## Configuration

Using the dedicated `@github/models` package:

```typescript
import { createRateLimit } from 'pennyllm/policy';
import type { GitHubProviderConfig } from 'pennyllm/types';

const github: GitHubProviderConfig = {
  keys: [process.env.GITHUB_TOKEN!],
  // Limits vary by model category (Low vs High).
  // Check https://docs.github.com/github-models for current limits.
  limits: [
    createRateLimit(15, 'per-minute'), // Low model RPM
    createRateLimit(150, 'daily'), // Low model RPD
  ],
};
```

Using `@ai-sdk/openai-compatible`:

```typescript
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

const githubProvider = createOpenAICompatible({
  name: 'github',
  baseURL: 'https://models.github.ai/inference',
  headers: {
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
  },
});
```

## Gotchas & Tips

- **Deprecated Azure endpoint.** The old endpoint `models.inference.ai.azure.com` was deprecated in July 2025. Always use `models.github.ai/inference`.
- **Per-request token limits.** Each request is capped at 8K input / 4K output tokens regardless of the model's native context window.
- **Model categories matter.** Low models get 3x the daily quota (150 RPD) compared to High models (50 RPD). Choose models accordingly.
- **Designed for prototyping.** GitHub Models is intended for experimentation and prototyping, not production workloads.
- **Copilot tier affects limits.** Limits vary by your Copilot subscription (Free, Pro, Business, Enterprise). The limits above are for the free tier.
- **Two package options.** The dedicated `@github/models` package provides native AI SDK integration. Alternatively, use `@ai-sdk/openai-compatible` with the base URL.
- **Fine-grained tokens work.** You can use GitHub's fine-grained personal access tokens with just the `models:read` permission.

## Paid Tier

GitHub Models limits scale with your Copilot subscription tier. Copilot Pro, Business, and Enterprise plans provide higher RPM, RPD, and concurrent request limits. See [GitHub Models documentation](https://docs.github.com/github-models) for tier-specific limits.
