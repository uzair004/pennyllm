# Mistral (La Plateforme) — Provider Intelligence

> Gathered: 2026-03-15 | Source: User research + community reports + AI SDK docs
> CAUTION: Mistral does not publish rate limits publicly — numbers below are from user dashboard and community reports

## Key Acquisition

- Phone verification required
- Console: https://console.mistral.ai
- Keys: https://console.mistral.ai/api-keys
- Admin/limits dashboard: https://admin.mistral.ai/plateforme/limits
- Env var: `MISTRAL_API_KEY`
- Up to 10 API keys per account — all share same limits
- **Limits are per-organization, not per-key**

## Free Tier Plan: "Experiment"

### Rate Limits (community-reported, not officially documented publicly)

| Metric                    | Value              | Notes                                       |
| ------------------------- | ------------------ | ------------------------------------------- |
| Requests per Second (RPS) | 1                  | Global across all models — very restrictive |
| Tokens per Minute (TPM)   | 50,000             | "Standard pool"                             |
| Tokens per Month          | 1,000,000,000 (1B) | Very generous monthly cap                   |
| Tier upgrade threshold    | $20 spent → Tier 1 |                                             |

**IMPORTANT**: These numbers are widely reported but NOT confirmed from official public documentation. Mistral's rate limit page is behind authentication. Verify at https://admin.mistral.ai/plateforme/limits

**Note**: Our existing docs say ~2 RPM and 500K TPM — the user's research says 1 RPS and 50K TPM. These may have changed, or there may be per-model variation. Need to verify from the actual console.

### Pool System (unconfirmed structure)

Community reports suggest models are grouped into "pools" sharing token quotas:

- General purpose pool: Mistral Large 3, Mistral Small 3.2, Ministral series
- Coding pool: Codestral, Devstral
- Multimodal pool: Pixtral Large, Pixtral 12B

**WARNING**: Pool system details are NOT in any official public docs. This is community-reported only. May not be accurate.

### 5-minute Sliding Window

Some larger models (e.g., Mistral Large) reportedly use a 5-minute sliding window for token tracking instead of 1-minute. Not officially documented.

## Available Models (as of 2026-03-15)

### Current models (non-deprecated)

| Model                | `-latest` alias           | Versioned ID                 | Type      |
| -------------------- | ------------------------- | ---------------------------- | --------- |
| Mistral Large 3      | `mistral-large-latest`    | `mistral-large-3-25-12`      | Open      |
| Mistral Medium 3.1   | `mistral-medium-latest`   | `mistral-medium-3-1-25-08`   | Premier   |
| Mistral Small 3.2    | `mistral-small-latest`    | `mistral-small-3-2-25-06`    | Open      |
| Ministral 3 14B      | —                         | `ministral-3-14b-25-12`      | Open      |
| Ministral 3 8B       | `ministral-8b-latest`     | `ministral-3-8b-25-12`       | Open      |
| Ministral 3 3B       | `ministral-3b-latest`     | `ministral-3-3b-25-12`       | Open      |
| Magistral Medium 1.2 | `magistral-medium-latest` | `magistral-medium-1-2-25-09` | Premier   |
| Magistral Small 1.2  | `magistral-small-latest`  | `magistral-small-1-2-25-09`  | Open      |
| Codestral            | `codestral-latest`        | `codestral-25-08`            | Premier   |
| Devstral 2           | —                         | `devstral-2-25-12`           | Open      |
| Mistral Embed        | `mistral-embed`           | —                            | Embedding |

### Retired models (DO NOT USE)

- `pixtral-12b-2409` — retired Dec 2025
- `open-mistral-7b`, `open-mixtral-8x7b`, `open-mixtral-8x22b` — retired Mar 2025
- `mistral-large-2407` — retired Mar 2025
- `ministral-8b-2410`, `ministral-3b-2410` — retired Dec 2025
- `magistral-medium-2506/2507`, `magistral-small-2506/2507` — retired Nov 2025

## Codestral Special Endpoint

Codestral has TWO access paths:

| Endpoint         | URL                                | Key                   | Notes                                            |
| ---------------- | ---------------------------------- | --------------------- | ------------------------------------------------ |
| Dedicated (free) | `https://codestral.mistral.ai/v1/` | Separate personal key | IDE plugins, FIM, not subject to org rate limits |
| Standard         | `https://api.mistral.ai/v1/`       | Standard API key      | Subject to Experiment plan limits                |

- The dedicated endpoint requires phone verification + separate key generation
- Supports FIM completions: `POST /v1/fim/completions`
- For PennyLLM: use the standard endpoint via `api.mistral.ai`

## Data Privacy

**CRITICAL for docs:**

- **Free tier (Experiment)**: Mistral MAY use your data for training by default
- **Opt out**: Admin Console → Privacy Settings → toggle off "Anonymized Improvement Data"
- **Paid tier (Scale)**: Data NOT used for training (automatic)
- **Zero Data Retention (ZDR)**: Not self-service — contact Mistral support

## AI SDK Integration

- Package: `@ai-sdk/mistral`
- Factory: `createMistral({ apiKey })` or import `mistral` directly
- Base URL: `https://api.mistral.ai/v1` (default)

```typescript
import { createMistral } from '@ai-sdk/mistral';
const provider = createMistral({ apiKey: process.env.MISTRAL_API_KEY });
const model = provider('mistral-small-latest');
```

## Phase 12.1 Gap Analysis Notes

### Gap: RPS vs RPM

- Mistral uses **requests per second (RPS)** not per minute — 1 RPS = max 60 RPM theoretical
- PennyLLM's `createRateLimit()` supports `per-minute` and `daily` windows but NOT `per-second`
- **Impact**: Can't accurately model Mistral's 1 RPS constraint
- **Severity**: (c) missing capability — need per-second rate limit support or at minimum document the workaround (set RPM to ~2 as conservative)

### Gap: Pool-based shared quotas

- If models share token pools, hitting TPM on one model affects another
- PennyLLM has no concept of shared pools across models
- **Severity**: (a) works but suboptimal — user just configures conservatively

### Gap: 5-minute sliding window

- PennyLLM supports `per-minute` windows but not configurable window sizes
- 5-minute sliding windows for large models can't be modeled
- **Severity**: (a) works but suboptimal — use per-minute as approximation

### What works well

- Single key per provider is the norm — no key rotation benefit here (same as OpenRouter)
- 1B monthly tokens is extremely generous — unlikely to hit this
- Best use as low-frequency provider in rotation (matches PennyLLM's fallback design)

## Phase 13 Registry Notes

- Volatility: MEDIUM (model lineup stable-ish, rate limits poorly documented)
- Confidence: LOW (rate limits not publicly documented, community-reported only)
- Source URL: https://admin.mistral.ai/plateforme/limits (requires auth)
- Registry should flag Mistral's limits as "unverified" / low confidence
- Pool system needs empirical validation before modeling
