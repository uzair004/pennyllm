# GitHub Models — Provider Intelligence

> Gathered: 2026-03-15 | Source: Research from docs.github.com, community discussions

## Key Acquisition

- Only requires a free GitHub account
- Models page: https://github.com/marketplace/models
- API uses GitHub personal access token (PAT) or GitHub token
- Env var: `GITHUB_MODELS_API_KEY` (or `GITHUB_TOKEN`)

## Free Tier — UNIQUE: only free access to closed frontier models

### Rate limits by model tier

| Tier          | Models                         | RPM | RPD     | Tokens/request (in/out) | Concurrent |
| ------------- | ------------------------------ | --- | ------- | ----------------------- | ---------- |
| **High**      | o3, o4-mini, GPT-4o            | 10  | **50**  | 8K in / 4K out          | 2          |
| **Low**       | Llama 4 Scout, DeepSeek, Phi-4 | 15  | **150** | 64K in / 8K out         | 5          |
| **Embedding** | Text embedding models          | 15  | 150     | —                       | 5          |

- Perpetual free tier (resets daily)
- Pay-as-you-go available beyond free limits
- No credit card required for free tier

## Available Models

### Closed frontier (UNIQUE — nowhere else free)

| Model       | Tier | Why it matters                                        |
| ----------- | ---- | ----------------------------------------------------- |
| **o3**      | High | OpenAI's frontier reasoning model — free nowhere else |
| **o4-mini** | High | OpenAI reasoning, smaller                             |
| **GPT-4o**  | High | OpenAI's flagship multimodal                          |

### Open models (also available on other providers)

| Model             | Tier |
| ----------------- | ---- |
| Llama 4 Scout     | Low  |
| DeepSeek models   | Low  |
| Phi-4 (Microsoft) | Low  |
| Mistral models    | Low  |

## Rate Limit Structure

- Per-account limits (single pool for all keys)
- Per-model-tier limits (not per-individual-model)
- Daily reset
- Tight token limits per request (8K in / 4K out for high-tier)

## API Format

- Uses Azure OpenAI API shape
- Endpoint: `https://models.inference.ai.azure.com`
- Auth: GitHub token as bearer
- No dedicated `@ai-sdk/github` package — use `@ai-sdk/openai` or OpenAI-compatible adapter pointing at the GitHub endpoint

## AI SDK Integration

- No official `@ai-sdk/github-models` package
- Use `@ai-sdk/openai` with custom baseURL: `https://models.inference.ai.azure.com`
- Or use OpenAI-compatible adapter

## Phase 12.1 Gap Analysis Notes

- 50 RPD for high-tier is tight — PennyLLM should treat this as a "premium fallback" not a primary provider
- Per-request token limits (8K in / 4K out) are unique — PennyLLM doesn't model per-request token caps
- The high/low tier distinction doesn't map to PennyLLM's per-key limits
- **New gap: per-request token limits** — PennyLLM has no concept of max tokens per individual request

## Phase 13 Registry Notes

- Volatility: LOW (GitHub/Microsoft backed, stable)
- Confidence: HIGH (well-documented)
- Unique value: ONLY free path to o3, o4-mini, GPT-4o
- Registry should flag these as "closed frontier" models unavailable elsewhere for free
