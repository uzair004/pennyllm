# Awesome Free LLM APIs

> A community-maintained registry of free tier LLM API providers.
> 7 providers | Machine-readable JSON | Auto-generated

**Freshness:** 🟢 Verified <=30 days | 🟡 Verified >30 days | 🔴 Verified >90 days

| Provider                                               | Free Tier Type | RPM   | Daily Limit   | SDK Package             | Freshness |
| ------------------------------------------------------ | -------------- | ----- | ------------- | ----------------------- | --------- |
| [Cerebras](https://cloud.cerebras.ai)                  | perpetual      | 30    | 1,000,000 TPD | `@ai-sdk/cerebras`      | 🟢        |
| [GitHub Models](https://github.com/marketplace/models) | perpetual      | -     | -             | `@ai-sdk/openai`        | 🟢        |
| [Google AI Studio](https://aistudio.google.com)        | perpetual      | -     | -             | `@ai-sdk/google`        | 🟢        |
| [Groq](https://console.groq.com)                       | perpetual      | -     | -             | `@ai-sdk/groq`          | 🟢        |
| [Mistral](https://console.mistral.ai)                  | perpetual      | 1 RPS | -             | `@ai-sdk/mistral`       | 🟢        |
| [NVIDIA NIM](https://build.nvidia.com)                 | rate-limited   | 40    | -             | `@ai-sdk/openai`        | 🟢        |
| [SambaNova](https://cloud.sambanova.ai)                | perpetual      | 20    | 20 RPD        | `sambanova-ai-provider` | 🟢        |

## Cerebras

**Status:** active | **Last verified:** 2026-03-17 🟢

### Authentication

- **Env var:** `CEREBRAS_API_KEY`
- **Key prefix:** `csk-`
- **Header:** `Authorization: Bearer`

### Free Tier

- **Type:** perpetual
- **Limits:**
  - rpm: 30
  - tpm: 60K
  - tpd: 1M
- **Notes:** Account-level limits. Key rotation provides no benefit. Daily token reset.

### SDK

- **Package:** `@ai-sdk/cerebras`
- **Type:** official

### Models

| Model ID                         | Free | Tier     | Capabilities                       | Context Window | Max Output |
| -------------------------------- | ---- | -------- | ---------------------------------- | -------------- | ---------- |
| `gpt-oss-120b`                   | Yes  | frontier | tools, structuredOutput            | 131.1K         | 8.2K       |
| `qwen-3-235b-a22b-instruct-2507` | Yes  | frontier | tools, reasoning, structuredOutput | 131.1K         | 8.2K       |
| `llama3.1-8b`                    | Yes  | mid      | tools, structuredOutput            | 131.1K         | 8.2K       |
| `zai-glm-4.7`                    | Yes  | high     | tools, reasoning, structuredOutput | 131.1K         | 8.2K       |

### Rate Limit Headers

- **Remaining:** `x-ratelimit-remaining-requests`
- **Reset:** `x-ratelimit-reset-requests`
- **Limit:** `x-ratelimit-limit-requests`
- **Format:** seconds

### Notes

- Account-level limits -- all API keys share the same quota
- Fastest inference available (2000-3000 tok/s on WSE hardware)
- No credit card required

## GitHub Models

**Status:** active | **Last verified:** 2026-03-15 🟢

### Authentication

- **Env var:** `GITHUB_TOKEN`
- **Header:** `Authorization: Bearer`

### Free Tier

- **Type:** perpetual
- **Notes:** Tier-based limits: High tier (10 RPM, 50 RPD), Low tier (15 RPM, 150 RPD). Uses existing GitHub account -- no separate signup needed.

### SDK

- **Package:** `@ai-sdk/openai`
- **Type:** openai-compat
- **Base URL:** `https://models.inference.ai.azure.com`

### Models

| Model ID      | Free | Tier     | Capabilities                               | Context Window | Max Output |
| ------------- | ---- | -------- | ------------------------------------------ | -------------- | ---------- |
| `gpt-4o`      | Yes  | frontier | tools, vision, structuredOutput            | 128K           | 4.1K       |
| `gpt-4o-mini` | Yes  | high     | tools, vision, structuredOutput            | 128K           | 4.1K       |
| `o3-mini`     | Yes  | frontier | reasoning, structuredOutput                | 128K           | 4.1K       |
| `o4-mini`     | Yes  | frontier | tools, reasoning, vision, structuredOutput | 128K           | 4.1K       |

### Notes

- Per-request token limits: 8K input / 4K output for high-tier models
- Uses GitHub personal access token -- no separate API key needed
- Model availability may change without notice

## Google AI Studio

**Status:** active | **Last verified:** 2026-03-15 🟢

### Authentication

- **Env var:** `GOOGLE_GENERATIVE_AI_API_KEY`
- **Header:** `Authorization: Bearer`

### Free Tier

- **Type:** perpetual
- **Limits:**
  - tpm: 250K
- **Notes:** Per-project enforcement. Keys from different GCP projects get independent quota. Per-model RPM/RPD limits vary significantly.

### SDK

- **Package:** `@ai-sdk/google`
- **Type:** official

### Models

| Model ID                 | Free | Tier     | Capabilities                               | Context Window | Max Output |
| ------------------------ | ---- | -------- | ------------------------------------------ | -------------- | ---------- |
| `gemini-2.5-flash`       | Yes  | frontier | tools, reasoning, vision, structuredOutput | 1.0M           | 65.5K      |
| `gemini-2.5-pro`         | Yes  | frontier | tools, reasoning, vision, structuredOutput | 1.0M           | 65.5K      |
| `gemini-2.5-flash-lite`  | Yes  | high     | tools, vision, structuredOutput            | 1.0M           | 65.5K      |
| `gemini-3-flash-preview` | Yes  | frontier | tools, reasoning, vision, structuredOutput | 1.0M           | 65.5K      |

### Notes

- Per-project enforcement -- create multiple GCP projects for independent quotas
- Some models have 0/0/0 limits on free tier (unavailable)
- Free tier may use data for model improvement outside EU

## Groq

**Status:** active | **Last verified:** 2026-03-15 🟢

### Authentication

- **Env var:** `GROQ_API_KEY`
- **Key prefix:** `gsk_`
- **Header:** `Authorization: Bearer`

### Free Tier

- **Type:** perpetual
- **Notes:** Per-model limits vary widely. No single provider-level limit. Per-organization enforcement -- key rotation provides no benefit.

### SDK

- **Package:** `@ai-sdk/groq`
- **Type:** official

### Models

| Model ID                                    | Free | Tier     | Capabilities                       | Context Window | Max Output |
| ------------------------------------------- | ---- | -------- | ---------------------------------- | -------------- | ---------- |
| `meta-llama/llama-4-scout-17b-16e-instruct` | Yes  | high     | tools, vision, structuredOutput    | 131.1K         | 8.2K       |
| `llama-3.3-70b-versatile`                   | Yes  | high     | tools, structuredOutput            | 131.1K         | 32.8K      |
| `qwen/qwen3-32b`                            | Yes  | mid      | tools, reasoning, structuredOutput | 131.1K         | 8.2K       |
| `moonshotai/kimi-k2-instruct`               | Yes  | frontier | tools, structuredOutput            | 131.1K         | 8.2K       |

### Rate Limit Headers

- **Remaining:** `x-ratelimit-remaining-requests`
- **Reset:** `x-ratelimit-reset-requests`
- **Limit:** `x-ratelimit-limit-requests`
- **Format:** seconds

### Notes

- Per-organization limits -- key rotation provides no benefit
- LPU inference engine provides ultra-fast token generation
- Per-model limits vary significantly (check individual model entries)

## Mistral

**Status:** active | **Last verified:** 2026-03-15 🟢

### Authentication

- **Env var:** `MISTRAL_API_KEY`
- **Header:** `Authorization: Bearer`

### Free Tier

- **Type:** perpetual
- **Limits:**
  - rps: 1
  - tpm: 50K
  - tokenMonthly: 1000M
- **Notes:** 1 request per second rate limit. 1 billion tokens per month. Per-organization limits -- key rotation provides no benefit. Models share token pool.

### SDK

- **Package:** `@ai-sdk/mistral`
- **Type:** official

### Models

| Model ID               | Free | Tier     | Capabilities                    | Context Window | Max Output |
| ---------------------- | ---- | -------- | ------------------------------- | -------------- | ---------- |
| `mistral-large-latest` | Yes  | frontier | tools, structuredOutput         | 131.1K         | 8.2K       |
| `mistral-small-latest` | Yes  | mid      | tools, structuredOutput         | 131.1K         | 8.2K       |
| `codestral-latest`     | Yes  | high     | -                               | 262.1K         | 8.2K       |
| `pixtral-large-latest` | Yes  | high     | tools, vision, structuredOutput | 131.1K         | 8.2K       |

### Notes

- Per-organization limits -- key rotation provides no benefit
- Free tier may use data for training -- opt-out required via settings
- 1 request per second (not per minute) -- unique among providers
- Models share a monthly token pool of 1B tokens

## NVIDIA NIM

**Status:** active | **Last verified:** 2026-03-17 🟢

### Authentication

- **Env var:** `NVIDIA_API_KEY`
- **Key prefix:** `nvapi-`
- **Header:** `Authorization: Bearer`

### Free Tier

- **Type:** rate-limited
- **Limits:**
  - rpm: 40
- **Notes:** NVIDIA does not publish per-model limits. ~40 RPM is community-reported. Originally credit-based (1000 credits), now perpetual rate-limited access.

### SDK

- **Package:** `@ai-sdk/openai`
- **Type:** openai-compat
- **Base URL:** `https://integrate.api.nvidia.com/v1`

### Models

| Model ID                                  | Free | Tier     | Capabilities                       | Context Window | Max Output |
| ----------------------------------------- | ---- | -------- | ---------------------------------- | -------------- | ---------- |
| `deepseek-ai/deepseek-v3.2`               | Yes  | frontier | tools, reasoning, structuredOutput | 131.1K         | 16.4K      |
| `moonshotai/kimi-k2.5`                    | Yes  | frontier | tools, reasoning, structuredOutput | 131.1K         | 32.8K      |
| `nvidia/llama-3.1-nemotron-ultra-253b-v1` | Yes  | frontier | tools, reasoning, structuredOutput | 131.1K         | 16.4K      |
| `meta/llama-4-maverick-17b-128e-instruct` | Yes  | high     | tools, vision, structuredOutput    | 131.1K         | 8.2K       |
| `qwen/qwen3-coder-480b-a35b-instruct`     | Yes  | frontier | tools, structuredOutput            | 262.1K         | 16.4K      |

### Notes

- NVIDIA does not publish official rate limits -- values are community-reported
- May be geo-restricted in some regions (403 errors)
- Model IDs use org/model format (e.g., deepseek-ai/deepseek-v3.2)
- Originally credit-based; transitioned to rate-limited perpetual free tier

## SambaNova

**Status:** active | **Last verified:** 2026-03-17 🟢

### Authentication

- **Env var:** `SAMBANOVA_API_KEY`
- **Header:** `Authorization: Bearer`

### Free Tier

- **Type:** perpetual
- **Credits:** $5
- **Expires:** 30 days
- **Limits:**
  - rpm: 20
  - rpd: 20
  - tpd: 200K
- **Notes:** Free tier (no card): 20 RPD. Developer tier (card linked, $0 balance): up to 12,000 RPD per model. 600x difference. Linking a card is strongly recommended -- you pay nothing.

### SDK

- **Package:** `sambanova-ai-provider`
- **Type:** community

### Models

| Model ID                             | Free | Tier     | Capabilities                       | Context Window | Max Output |
| ------------------------------------ | ---- | -------- | ---------------------------------- | -------------- | ---------- |
| `DeepSeek-R1-0528`                   | Yes  | frontier | reasoning                          | 131.1K         | 16.4K      |
| `Deepseek-V3.1`                      | Yes  | frontier | tools, structuredOutput            | 131.1K         | 16.4K      |
| `DeepSeek-V3-0324`                   | Yes  | frontier | tools, structuredOutput            | 131.1K         | 16.4K      |
| `Meta-Llama-3.3-70B-Instruct`        | Yes  | high     | tools, structuredOutput            | 131.1K         | 8.2K       |
| `Qwen3-235B-A22B-Instruct-2507`      | Yes  | high     | tools, reasoning, structuredOutput | 131.1K         | 8.2K       |
| `Llama-4-Maverick-17B-128E-Instruct` | Yes  | high     | tools, vision, structuredOutput    | 131.1K         | 8.2K       |

### Rate Limit Headers

- **Remaining:** `x-ratelimit-remaining-requests`
- **Reset:** `x-ratelimit-reset-requests`
- **Limit:** `x-ratelimit-limit-requests`
- **Format:** epoch

### Notes

- Two-tier system: Free (no card, 20 RPD) vs Developer (card linked, up to 12K RPD) -- 600x difference
- $5 signup credit with 30-day expiry
- ONLY provider offering free access to full DeepSeek-R1 671B model
- Developer tier is free -- linking a card unlocks higher limits at $0 balance

## Usage

### Fetch the registry

```js
const response = await fetch(
  'https://raw.githubusercontent.com/user/awesome-free-llm-apis/main/registry.json',
);
const registry = await response.json();
console.log(`${registry.providerCount} providers available`);
```

### Filter free models from a provider

```js
const provider = registry.providers['cerebras'];
const freeModels = provider.models.filter((m) => m.free);
console.log(freeModels.map((m) => m.id));
```

### Find providers with reasoning models

```js
const reasoningProviders = Object.values(registry.providers).filter((p) =>
  p.models.some((m) => m.capabilities.includes('reasoning')),
);
console.log(reasoningProviders.map((p) => p.name));
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to add or update a provider.

---

Generated by [generate.js](scripts/generate.js) on 2026-03-18. Do not edit manually.
