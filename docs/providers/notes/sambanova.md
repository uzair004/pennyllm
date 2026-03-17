# SambaNova Cloud — Provider Intelligence

> Gathered: 2026-03-15 | Source: Research from docs.sambanova.ai, community forums

## Key Acquisition

- Console: https://cloud.sambanova.ai
- Plans: https://cloud.sambanova.ai/plans
- Env var: `SAMBANOVA_API_KEY`

## Free Tier — Two tiers with MASSIVE difference

### Free Tier (no card linked)

| Metric           | Value                 |
| ---------------- | --------------------- |
| RPM              | 20                    |
| RPD              | **20** (brutally low) |
| TPD              | 200,000               |
| Credit card      | Not required          |
| $5 signup credit | Yes (30-day expiry)   |

### Developer Tier (card linked, $0 balance — RECOMMENDED)

| Model                         | RPM   | RPD         |
| ----------------------------- | ----- | ----------- |
| DeepSeek-R1-0528 (671B full)  | 60    | **12,000**  |
| DeepSeek-R1-Distill-Llama-70B | 240   | **48,000**  |
| DeepSeek-V3-0324 / V3.1       | 60    | **12,000**  |
| Meta-Llama-3.3-70B-Instruct   | 240   | **48,000**  |
| Meta-Llama-3.1-8B-Instruct    | 1,440 | **288,000** |

**600x difference** between free and developer tier. Linking a card (even with $0 balance) is essential. You don't pay anything — the card just unlocks higher rate limits.

## Available Models (persistent, both tiers)

### Production Models

| Model                         | Params    | Notes                                                            |
| ----------------------------- | --------- | ---------------------------------------------------------------- |
| **DeepSeek-R1-0528**          | 671B      | Full R1, latest version. ONLY free access to full 671B anywhere. |
| DeepSeek-R1-Distill-Llama-70B | 70B       | Distilled, still strong                                          |
| DeepSeek-V3-0324              | ~685B MoE | General frontier                                                 |
| DeepSeek-V3.1                 | ~685B MoE | Updated                                                          |
| Meta-Llama-3.3-70B-Instruct   | 70B       | Production stable                                                |
| Meta-Llama-3.1-8B-Instruct    | 8B        | Fast, small                                                      |

### Preview Models (no SLA)

| Model                              | Params    | Notes               |
| ---------------------------------- | --------- | ------------------- |
| Llama-4-Maverick-17B-128E-Instruct | ~400B MoE | Top open-weight     |
| gpt-oss-120b                       | 120B      | OpenAI open-weights |
| Qwen3-235B-A22B-Instruct-2507      | 235B MoE  | Strong reasoning    |
| Qwen3-32B                          | 32B       |                     |
| Whisper-Large-v3                   | —         | Audio transcription |

## DeepSeek-R1 671B vs Distilled — Quality Gap

| Benchmark     | R1 671B (full) | R1-Distill 70B | Gap               |
| ------------- | -------------- | -------------- | ----------------- |
| MATH-500      | 97.3%          | 94.5%          | Small (3%)        |
| GPQA Diamond  | 71.5%          | 65.2%          | Moderate (9%)     |
| AIME 2024     | 79.8%          | 70.0%          | Significant (14%) |
| LiveCodeBench | 65.9%          | 57.5%          | Significant (13%) |
| Codeforces    | 2029           | 1633           | Huge (24%)        |
| MMLU          | 90.8%          | —              | —                 |

The 70B distill is good (beats GPT-4o on most benchmarks), but on hard problems (competitive programming, difficult math, complex reasoning) the full 671B pulls away significantly.

## Speed

- DeepSeek-R1 671B: 198-250 tok/s (fastest full R1 deployment anywhere)
- SambaNova's custom RDU hardware optimized for large models

## AI SDK Integration

- Package: `sambanova-ai-provider` (**community provider**)
- Listed at ai-sdk.dev/providers/community-providers/sambanova
- Not a first-party @ai-sdk/\* package

## Phase 12.1 Gap Analysis Notes

- Free vs Developer tier distinction — PennyLLM should strongly recommend Developer tier in docs
- Per-model rate limits on Developer tier (R1 gets 12K RPD, Llama 70B gets 48K RPD)
- Same per-model limit gap as Groq and Google
- Community provider (not first-party) — may have stability/maintenance concerns

## Phase 13 Registry Notes

- Volatility: LOW (stable provider, backed by SambaNova hardware)
- Confidence: HIGH for Developer tier (well-documented per-model limits)
- Unique value: only free access to full DeepSeek-R1 671B
- Registry should distinguish free tier (20 RPD) vs developer tier (12K RPD) clearly

## Gap Analysis (Phase 12.1)

**Date:** 2026-03-17

### PennyLLM Abstraction Match

| Aspect             | Provider Reality                                               | PennyLLM Model       | Match?  |
| ------------------ | -------------------------------------------------------------- | -------------------- | ------- |
| Limit scope        | Per-model, two tiers (free vs developer)                       | Per-key              | NO      |
| Key rotation value | UNKNOWN — likely per-account, no benefit expected              | Assumes beneficial   | NO      |
| Error format       | 429 with epoch-based `x-ratelimit-reset-requests`              | 429 + header parsing | YES     |
| Per-model limits   | YES (R1 671B: 12K RPD developer, Llama 8B: 288K RPD developer) | Per-key only         | PARTIAL |

### Key Rotation Value

**UNKNOWN.** Likely per-account (no benefit from multiple keys). SambaNova's tier system is account-level, so key rotation would not bypass tier limits.

### DX Recommendations

- **STRONGLY recommend linking a payment card to unlock Developer tier** at $0 balance — this provides a 600x increase in rate limits (20 RPD free vs 12,000 RPD developer for DeepSeek-R1)
- The $5 signup credit expires in 30 days — link a card before it expires to lock in Developer tier access
- Free tier is limited to 20 RPD per model — barely usable for development
- Developer tier at $0 balance costs nothing but requires a card on file
- SambaNova is the ONLY provider offering free access to the full DeepSeek-R1 671B model
- Per-model limits vary significantly on Developer tier (R1: 60 RPM/12K RPD vs Llama 8B: 1,440 RPM/288K RPD)

### Gap Severity

| Gap                                                  | Category | Priority |
| ---------------------------------------------------- | -------- | -------- |
| Developer tier recommendation CRITICAL for usability | (b)      | P0       |
| Credit/balance tracking deferred                     | (c)      | P2       |
