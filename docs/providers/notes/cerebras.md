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

## Gap Analysis (Phase 12.1)

**Date:** 2026-03-17

### PennyLLM Abstraction Match

| Aspect             | Provider Reality                             | PennyLLM Model       | Match? |
| ------------------ | -------------------------------------------- | -------------------- | ------ |
| Limit scope        | Account-level (30 RPM, 60K TPM, 1M TPD)      | Per-key              | NO     |
| Key rotation value | NONE — all keys share account quota          | Assumes beneficial   | NO     |
| Error format       | Standard 429 with seconds-based headers      | 429 + header parsing | YES    |
| Per-model limits   | NO — all models share the same account quota | Per-key only         | N/A    |

### Key Rotation Value

**NONE.** All API keys under the same Cerebras account share the same rate limit quota. Creating multiple keys provides no additional capacity.

### DX Recommendations

- Only one API key is needed per Cerebras account — multiple keys provide no additional quota
- Do not configure multiple Cerebras keys expecting increased throughput; it will not help
- Cerebras is best used as a high-speed, single-key provider in the priority chain
- The 1M TPD daily token budget is the most generous perpetual free tier available

### Gap Severity

| Gap                                    | Category | Priority |
| -------------------------------------- | -------- | -------- |
| Multi-key config wasteful (no benefit) | (a)      | P1       |
| Docs gap for key rotation guidance     | (b)      | P0       |
