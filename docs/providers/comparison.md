# Provider Comparison

> Last verified: 2026-03-14
> All limits are approximate and subject to change. Verify against official docs.

## At a Glance

| Provider         | Tier Type       | Credit Card | RPM   | Daily Limit       | Monthly Limit   | AI SDK Package              |
| ---------------- | --------------- | ----------- | ----- | ----------------- | --------------- | --------------------------- |
| Google AI Studio | Recurring       | No          | 5-15  | 100-1,000 RPD     | -               | `@ai-sdk/google`            |
| Groq             | Recurring       | No          | 30-60 | 1K-14.4K RPD      | -               | `@ai-sdk/groq`              |
| OpenRouter       | Recurring       | No          | 20    | 50-1,000 RPD      | -               | `@ai-sdk/openai-compatible` |
| Mistral          | Recurring       | No          | ~2    | -                 | 1B tokens       | `@ai-sdk/mistral`           |
| HuggingFace      | Monthly Credits | No          | -     | -                 | $0.10 credits   | `@ai-sdk/huggingface`       |
| Cerebras         | Recurring       | No          | 30    | 14.4K RPD, 1M TPD | -               | `@ai-sdk/cerebras`          |
| DeepSeek         | Trial Credits   | No          | None  | -                 | 5M tokens (30d) | `@ai-sdk/deepseek`          |
| Qwen             | Trial Credits   | No          | 600+  | -                 | 1M tokens (90d) | `@ai-sdk/openai-compatible` |
| Cloudflare       | Recurring       | No          | -     | 10K neurons       | -               | `@ai-sdk/openai-compatible` |
| NVIDIA           | Trial Credits   | No          | 40    | -                 | 1,000 credits   | `@ai-sdk/openai-compatible` |
| Cohere           | Trial Key       | No          | 20    | -                 | 1,000 calls     | `@ai-sdk/cohere`            |
| GitHub           | Recurring       | No          | 10-15 | 50-150 RPD        | -               | `@github/models`            |

## Tier Categories

### Recurring Free Tier (resets daily/monthly)

These providers offer ongoing free access with rate limits that reset automatically:

- **Google AI Studio** -- 5-15 RPM, 100-1,000 RPD, 250K TPM (varies by model). Best model variety.
- **Groq** -- 30-60 RPM, 1K-14.4K RPD. Ultra-fast inference (~1,000 tok/sec).
- **OpenRouter** -- 20 RPM, 50-1,000 RPD. Meta-provider with 28+ free models via single key.
- **Mistral** -- ~2 RPM, 500K TPM, 1B tokens/month. Very low RPM but huge token allowance.
- **Cerebras** -- 30 RPM, 14.4K RPD, 1M TPD. Ultra-fast inference (~2,600 tok/sec), 8K context limit.
- **Cohere** -- 20 RPM, 1,000 calls/month shared. Non-commercial use only on trial key.
- **GitHub** -- 10-15 RPM, 50-150 RPD. Per-request token limits (8K in / 4K out).
- **Cloudflare** -- 10,000 neurons/day. Neuron-based pricing (not tokens).

### Trial Credits (one-time allocation, expires)

These providers give a one-time credit that does not renew:

- **DeepSeek** -- 5M tokens, expires 30 days after registration. No rate limits enforced.
- **NVIDIA NIM** -- 1,000 credits (can request 4,000 more). 40 RPM. Opaque credit-to-token conversion.
- **Qwen** -- 1M tokens, expires 90 days after activation. Singapore region only.

### Monthly Credits

- **HuggingFace** -- $0.10/month free credits. Compute-time-based billing, supports 200+ models.

## Env Variables Reference

| Provider         | Primary Env Variable           | Additional Vars         |
| ---------------- | ------------------------------ | ----------------------- |
| Google AI Studio | `GOOGLE_GENERATIVE_AI_API_KEY` | -                       |
| Groq             | `GROQ_API_KEY`                 | -                       |
| OpenRouter       | `OPENROUTER_API_KEY`           | -                       |
| Mistral          | `MISTRAL_API_KEY`              | -                       |
| HuggingFace      | `HUGGINGFACE_API_KEY`          | -                       |
| Cerebras         | `CEREBRAS_API_KEY`             | -                       |
| DeepSeek         | `DEEPSEEK_API_KEY`             | -                       |
| Qwen             | `DASHSCOPE_API_KEY`            | -                       |
| Cloudflare       | `CLOUDFLARE_API_TOKEN`         | `CLOUDFLARE_ACCOUNT_ID` |
| NVIDIA           | `NIM_API_KEY`                  | -                       |
| Cohere           | `COHERE_API_KEY`               | -                       |
| GitHub           | `GITHUB_TOKEN`                 | -                       |

## Best For

| Use Case                 | Recommended Provider(s)  | Why                                            |
| ------------------------ | ------------------------ | ---------------------------------------------- |
| Getting started quickly  | Google, Groq, OpenRouter | No credit card, instant keys, generous limits  |
| Maximum daily throughput | Cerebras, Groq, Google   | High RPD and TPD limits                        |
| Fastest inference speed  | Groq, Cerebras           | Hardware-optimized inference (1K-2.6K tok/sec) |
| Most models from one key | OpenRouter               | 28+ free models from multiple providers        |
| Largest token allowance  | Mistral                  | 1B tokens/month (but 2 RPM bottleneck)         |
| Reasoning models         | DeepSeek, GitHub, NVIDIA | DeepSeek-R1, various reasoning models          |
| Embedding + Rerank       | Cohere                   | Dedicated embed/rerank endpoints on free tier  |
