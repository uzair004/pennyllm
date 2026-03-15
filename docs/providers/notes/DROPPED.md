# Dropped Providers

> Decision date: 2026-03-15
> Reason: Provider audit during Phase 12 data gathering revealed these providers
> offer insufficient free tiers or don't align with PennyLLM's target use case.

## Dropped from target list

| Provider                  | Reason                                                                                                                                                      | Notes file                       |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| **HuggingFace**           | $0.10/month credit is essentially nothing. Meta-provider adds complexity.                                                                                   | [huggingface.md](huggingface.md) |
| **Cohere**                | 1,000 API calls/month total — too restrictive                                                                                                               | —                                |
| **Cloudflare Workers AI** | 10K Neurons/day ≈ 10-30K tokens — too small                                                                                                                 | —                                |
| **Qwen/DashScope**        | Region-locked to Singapore, account friction                                                                                                                | —                                |
| **OpenRouter**            | Per-account limits make key rotation useless. All :free models available directly from other providers with better limits. 50 RPD shared across all models. | [openrouter.md](openrouter.md)   |
| **Together AI**           | $1 one-time credit only. No confirmed perpetual free tier.                                                                                                  | —                                |
| **DeepSeek (direct)**     | 5M token trial with 30-day expiry. No perpetual free tier.                                                                                                  | —                                |
| **Fireworks AI**          | $1 one-time credit only.                                                                                                                                    | —                                |

## Notes on dropped providers

The intelligence notes for HuggingFace, OpenRouter, and Mistral (kept) contain detailed
research that's still valuable for:

- Phase 12.1 gap analysis (architectural issues discovered)
- Phase 13+ registry design (different billing models to consider)
- Future re-evaluation if free tiers change

## Criteria for keeping a provider

1. **Recurring/perpetual free tier** — resets daily/monthly, doesn't expire
2. **Hosts top-tier models** — frontier or near-frontier quality
3. **Meaningful limits** — enough for real development use, not just a taste
4. **Clear unique value** — offers something no other provider does
