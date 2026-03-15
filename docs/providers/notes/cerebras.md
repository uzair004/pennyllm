# Cerebras — Provider Intelligence

> Gathered: 2026-03-15 | Source: Research from cerebras.ai docs, community reports

## Key Acquisition

- No credit card required, no waitlist
- Console: https://cloud.cerebras.ai
- Env var: `CEREBRAS_API_KEY`

## Free Tier — BEST perpetual free tier available

| Metric         | Value                        |
| -------------- | ---------------------------- |
| Tokens per day | **1,000,000 (1M)**           |
| RPM            | 30                           |
| TPM            | 60,000                       |
| Perpetual      | Yes — daily reset, no expiry |
| Credit card    | Not required                 |

This is the most generous perpetual free tier of any provider.

## Available Models (as of 2026-03-15)

| Model                     | Params                | Notes                                     |
| ------------------------- | --------------------- | ----------------------------------------- |
| Llama 4 Maverick          | ~400B MoE             | Flagship, SWE-bench 70.3%, MMLU-Pro 80.5% |
| Llama 4 Scout             | 17B×16E MoE           | 10M context window                        |
| Qwen3 235B                | 235B MoE (22B active) | Strong reasoning, competitive with GPT-4o |
| Qwen3 32B                 | 32B                   |                                           |
| Llama 3.3 70B             | 70B                   | Production stable                         |
| DeepSeek-R1 70B Distilled | 70B                   | Reasoning                                 |
| GPT-OSS 120B              | 120B                  | OpenAI open-weights                       |

## Speed

Cerebras Wafer-Scale Engine (WSE) is **20-75x faster than GPU providers**:

- Llama 4 Maverick: ~2,522 tok/s
- Qwen3 235B: ~1,400 tok/s

This is the fastest inference available anywhere.

## Rate Limit Structure

- Limits are account-level, not per-key
- Three dimensions: RPM, TPM, TPD
- Daily token reset (1M tokens/day)
- Multiple API keys don't increase quota

## AI SDK Integration

- Package: `@ai-sdk/cerebras` (**first-party official**)
- Listed at ai-sdk.dev/providers/ai-sdk-providers/cerebras

## Phase 12.1 Gap Analysis Notes

- Account-level limits — key rotation won't help (same as OpenRouter pattern)
- Per-day token budget (1M TPD) is a different window than PennyLLM's per-minute/daily/monthly
- Need to verify: does PennyLLM's `createTokenLimit(1_000_000, 'daily')` correctly model this?

## Phase 13 Registry Notes

- Volatility: LOW (stable provider, consistent free tier)
- Confidence: HIGH (well-documented limits)
- Unique value: fastest inference + most generous perpetual free tier
