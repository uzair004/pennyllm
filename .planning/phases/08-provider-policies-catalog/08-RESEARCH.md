# Phase 8: Provider Policies Catalog - Research

**Researched:** 2026-03-14
**Domain:** Provider free tier policies, AI SDK integration, limit builder patterns
**Confidence:** MEDIUM (provider limits verified via official docs where possible; some providers lack public documentation)

## Summary

Phase 8 has pivoted from shipping researched default policies as active routing data to making them reference-only documentation. The core code changes involve: (1) removing existing static policy defaults (3 files + index), (2) adding an `applyRegistryDefaults` config toggle, (3) creating generic limit builder helpers, (4) creating typed provider configs with JSDoc, and (5) writing key acquisition documentation for all 12 providers.

The research confirms that all 12 providers have some form of free tier access, though they vary significantly in structure: some offer recurring rate-limited free tiers (Google, Groq, Cerebras, Mistral, Cohere, GitHub, OpenRouter), some offer trial credits (DeepSeek, NVIDIA), some offer monthly credits (HuggingFace), and some offer daily neuron-based allocations (Cloudflare). Qwen/Alibaba offers a free token quota for new users in the Singapore region.

**Primary recommendation:** Ship empty provider skeletons with no limit values, comprehensive docs/providers/ markdown files for all 12 providers, and generic limit builder helpers. The retry proxy (Phase 7) serves as the runtime safety net when users configure no limits.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- Registry/shipped defaults are NOT used for routing unless user explicitly opts in
- Config toggle: `applyRegistryDefaults: boolean` (default: false)
- When false (default): if user doesn't configure limits, no limits are applied -- key is always "available"
- Retry proxy (Phase 7) handles actual 429 errors at runtime
- Delete `src/policy/defaults/google.ts`, `groq.ts`, `openrouter.ts`, `index.ts`
- Bundle a JSON with all 12 provider names and structure but no actual limit values
- Export helper functions: `createTokenLimit`, `createRateLimit`, `createCallLimit`
- Export specific TypeScript types per provider with JSDoc
- Key acquisition docs in `docs/providers/` with one markdown file per provider
- No registry-based suggestions in errors (registry is deferred)
- Schema validation at startup (existing Zod validation -- no new work)
- Trust user config values -- no sanity bounds checking

### Claude's Discretion

- Exact builder helper API signatures and return types
- Empty skeleton JSON structure
- How to handle the shippedDefaults Map removal across the codebase
- Comparison table generation approach
- Exact provider type JSDoc content
- Debug warning message format for no-configured-limits providers

### Deferred Ideas (OUT OF SCOPE)

- Remote Registry Infrastructure (dedicated phase)
- Credit-Based Limit Handling (dedicated phase)
- Per-Limit Provenance Metadata (registry phase)
- Provider Volatility Rating (registry phase)
- Research Pipeline (registry phase)
- CLI validator command, config wizard (Phase 11)
  </user_constraints>

<phase_requirements>

## Phase Requirements

| ID      | Description                                                            | Research Support                                                                 |
| ------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| PROV-01 | Google AI Studio (Gemini) -- default policy with free tier limits      | Provider research section: recurring free tier, 5-15 RPM, 100-1000 RPD, 250K TPM |
| PROV-02 | Groq -- default policy with free tier limits                           | Provider research section: recurring free tier, per-model limits, 30-60 RPM      |
| PROV-03 | OpenRouter (free models) -- default policy with free tier limits       | Provider research section: meta-provider, 20 RPM, 50-200 RPD, 28 free models     |
| PROV-04 | Mistral (La Plateforme) -- default policy with free tier limits        | Provider research section: Experiment plan, 2 RPM, 500K TPM, 1B tokens/month     |
| PROV-05 | HuggingFace Inference API -- default policy with free tier limits      | Provider research section: $0.10/month credits, request-based billing            |
| PROV-06 | Cerebras -- default policy with free tier limits                       | Provider research section: 1M TPD, 30 RPM, 8192 context on free tier             |
| PROV-07 | DeepSeek -- default policy with free tier limits                       | Provider research section: trial credits (5M tokens), no rate limits enforced    |
| PROV-08 | Qwen (Alibaba) -- default policy with free tier limits                 | Provider research section: 1M token free quota (Singapore), 90-day expiry        |
| PROV-09 | Cloudflare Workers AI -- default policy with free tier limits          | Provider research section: 10K neurons/day, REST API + OpenAI-compatible         |
| PROV-10 | NVIDIA NIM -- default policy with free tier limits                     | Provider research section: 1000 credits, 40 RPM trial                            |
| PROV-11 | Cohere -- default policy with free tier limits                         | Provider research section: trial key, 1000 calls/month, 20 RPM chat              |
| PROV-12 | GitHub Models -- default policy with free tier limits                  | Provider research section: 10-15 RPM, 50-150 RPD, model category tiers           |
| DX-02   | Documentation includes step-by-step guide for obtaining free tier keys | All 12 provider docs with sign-up URL, API key page, env vars, config snippets   |

</phase_requirements>

## Standard Stack

### Core

| Library    | Version | Purpose                               | Why Standard                                                       |
| ---------- | ------- | ------------------------------------- | ------------------------------------------------------------------ |
| zod        | ^3.23.0 | Config schema validation              | Already used in project, `applyRegistryDefaults` toggle added here |
| typescript | ^5.7.2  | Type definitions for provider configs | Already used, JSDoc + `satisfies` pattern                          |

### Supporting

| Library | Version | Purpose                              | When to Use             |
| ------- | ------- | ------------------------------------ | ----------------------- |
| debug   | ^4.3.0  | Debug logging for no-limits warnings | Already used in project |

### No New Dependencies

This phase requires NO new npm packages. All work uses existing project dependencies. The limit builder helpers are pure TypeScript utility functions. Provider documentation is markdown files.

## Architecture Patterns

### Recommended Project Structure Changes

```
src/
  policy/
    defaults/          # DELETE entire directory (google.ts, groq.ts, openrouter.ts, index.ts)
    builders.ts        # NEW: createTokenLimit, createRateLimit, createCallLimit
    PolicyEngine.ts    # UNCHANGED
    resolver.ts        # MODIFY: accept empty Map when toggle off
    staleness.ts       # UNCHANGED (still works, just no shipped metadata)
    types.ts           # UNCHANGED
    index.ts           # MODIFY: remove defaults re-exports, add builder exports
  config/
    schema.ts          # MODIFY: add applyRegistryDefaults toggle
    index.ts           # MODIFY: pass empty Map when toggle off
  types/
    providers.ts       # NEW: typed provider configs with JSDoc
  constants/
    index.ts           # UNCHANGED (Provider enum already has all 12)
data/
  provider-skeleton.json  # NEW: empty skeleton with 12 provider shapes
docs/
  providers/
    google.md           # NEW: key acquisition + config reference
    groq.md             # NEW
    openrouter.md       # NEW (includes meta-provider explainer)
    mistral.md          # NEW
    huggingface.md      # NEW
    cerebras.md         # NEW
    deepseek.md         # NEW
    qwen.md             # NEW
    cloudflare.md       # NEW
    nvidia.md           # NEW
    cohere.md           # NEW
    github.md           # NEW
    comparison.md       # NEW: side-by-side comparison table
    README.md           # NEW: overview + recommended starter set
```

### Pattern 1: Limit Builder Helpers

**What:** Generic factory functions that create well-typed PolicyLimit objects
**When to use:** Users configuring provider limits in their config

```typescript
import type { PolicyLimit, TimeWindow } from '../types/domain.js';
import { LimitType } from '../constants/index.js';

// Duration constants (milliseconds)
const DURATIONS = {
  'per-minute': 60_000,
  hourly: 3_600_000,
  daily: 86_400_000,
  monthly: 2_592_000_000, // 30 days
  'rolling-30d': 2_592_000_000,
} as const;

type WindowType = keyof typeof DURATIONS;

function createWindow(type: WindowType): TimeWindow {
  return { type, durationMs: DURATIONS[type] };
}

/**
 * Create a token-based limit (tracks prompt + completion tokens)
 */
export function createTokenLimit(value: number, window: WindowType): PolicyLimit {
  return { type: LimitType.TOKENS, value, window: createWindow(window) };
}

/**
 * Create a rate limit (tracks requests per time window)
 */
export function createRateLimit(value: number, window: WindowType): PolicyLimit {
  return { type: LimitType.RATE, value, window: createWindow(window) };
}

/**
 * Create a call count limit (tracks total API calls)
 */
export function createCallLimit(value: number, window: WindowType): PolicyLimit {
  return { type: LimitType.CALLS, value, window: createWindow(window) };
}
```

### Pattern 2: Typed Provider Configs with JSDoc

**What:** Provider-specific TypeScript types that extend ProviderConfig with JSDoc links
**When to use:** Users get autocomplete and inline docs when configuring providers

```typescript
import type { ProviderConfig } from '../types/config.js';

/**
 * Google AI Studio (Gemini) provider configuration.
 *
 * Free tier: 5-15 RPM, 100-1000 RPD, 250K TPM (varies by model).
 * Sign up: https://aistudio.google.com
 * Limits: https://ai.google.dev/gemini-api/docs/rate-limits
 * Env var: GOOGLE_GENERATIVE_AI_API_KEY
 * AI SDK: @ai-sdk/google
 *
 * @see docs/providers/google.md for full setup guide
 */
export type GoogleProviderConfig = ProviderConfig;

// ... similar for each provider
```

### Pattern 3: shippedDefaults Removal

**What:** Remove the defaults directory and update all references
**Where affected:**

1. `src/policy/defaults/` -- DELETE entire directory (4 files)
2. `src/policy/index.ts` -- Remove re-export line: `export { googlePolicy, groqPolicy, openrouterPolicy, shippedDefaults } from './defaults/index.js';`
3. `src/config/index.ts` -- Remove import of `shippedDefaults`, pass empty Map or conditionally pass based on toggle
4. `src/policy/resolver.ts` -- No changes needed (already accepts Map parameter, empty Map = no defaults)

**Implementation approach:**

```typescript
// src/config/index.ts - Updated createRouter
// BEFORE:
// import { shippedDefaults } from '../policy/defaults/index.js';
// const resolvedPolicies = resolvePolicies(config, shippedDefaults);

// AFTER:
const emptyDefaults = new Map<string, Policy>();
const resolvedPolicies = resolvePolicies(config, emptyDefaults);
// Note: When applyRegistryDefaults toggle is implemented in registry phase,
// this will conditionally use registry data instead of empty map
```

### Pattern 4: Config Toggle

**What:** Add `applyRegistryDefaults` to the config schema
**Implementation:**

```typescript
// In configSchema:
applyRegistryDefaults: z.boolean().default(false),
```

Also needs to be added to the `RouterConfig` interface in `src/types/config.ts`.

### Anti-Patterns to Avoid

- **Hard-coding limit values in TypeScript:** Limit values go stale. The decision is to NOT ship active limit data.
- **Auto-applying defaults without user consent:** Toggle defaults to false, user must opt in.
- **Assuming provider limits are stable:** Every provider doc should include a "last verified" date and link to official source.

## Don't Hand-Roll

| Problem                   | Don't Build                           | Use Instead                  | Why                                              |
| ------------------------- | ------------------------------------- | ---------------------------- | ------------------------------------------------ |
| Duration constants        | Manual millisecond math               | Centralized DURATIONS const  | Prevents copy-paste errors (86400000 vs 8640000) |
| Window creation           | Inline `{ type, durationMs }`         | `createWindow(type)` helper  | Single source of truth for durations             |
| Provider config templates | Full policy objects with stale values | Empty skeleton + JSDoc types | Values go stale, structure stays stable          |

## Common Pitfalls

### Pitfall 1: Breaking Existing Tests When Removing Defaults

**What goes wrong:** Removing shippedDefaults may break resolver tests or config tests that implicitly depend on shipped policies.
**Why it happens:** The resolver was built to merge shipped defaults as the base layer.
**How to avoid:** Pass an empty `Map<string, Policy>()` to `resolvePolicies()` -- the function already handles this case gracefully. Run `vitest run` after removal to catch any regressions.
**Warning signs:** No tests in `/tests/` directory reference `shippedDefaults` directly (verified by grep), but config.test.ts and build.test.ts should be checked.

### Pitfall 2: Policy Index Re-exports

**What goes wrong:** `src/policy/index.ts` exports `shippedDefaults` and individual policy objects. Removing the defaults directory breaks these exports.
**Why it happens:** Consumers may import from `llm-router/policy`.
**How to avoid:** Update `src/policy/index.ts` to remove the defaults re-export line. Add new exports for builders. The `./policy` subpath export in package.json stays, just with different contents.

### Pitfall 3: Stale Documentation

**What goes wrong:** Provider limits documented today may change tomorrow.
**Why it happens:** Providers change limits without notice.
**How to avoid:** Every provider doc includes `lastVerified` date and link to official source. Config snippets use placeholder values (`YOUR_RPM_LIMIT`), not hard-coded numbers. A note at the top of each doc says "Verify against official docs before using."

### Pitfall 4: Cloudflare Workers AI Is Not a Standard REST API

**What goes wrong:** Cloudflare Workers AI was designed for Workers bindings, not external REST API consumption.
**Why it happens:** The primary integration is via the `AI` binding in Wrangler, not an API key.
**How to avoid:** Document the REST API alternative (`https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/ai/...`) which works with an API token from the dashboard. The OpenAI-compatible endpoint is `https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1/chat/completions`. Use `@ai-sdk/openai-compatible` with this base URL.

### Pitfall 5: exactOptionalPropertyTypes with New Config Fields

**What goes wrong:** Adding `applyRegistryDefaults?: boolean` to RouterConfig may cause type errors.
**Why it happens:** The project uses `exactOptionalPropertyTypes` which disallows `undefined` assignment to optional fields.
**How to avoid:** Use Zod `.default(false)` to make the field always present in output. The RouterConfig interface should have `applyRegistryDefaults: boolean` (not optional), matching the Zod output type.

## Provider Research

### Provider 1: Google AI Studio (Gemini)

| Property                    | Value                                                      | Confidence |
| --------------------------- | ---------------------------------------------------------- | ---------- |
| **Tier Type**               | Recurring free tier (resets daily/per-minute)              | HIGH       |
| **Credit Card**             | Not required                                               | HIGH       |
| **Sign-up URL**             | https://aistudio.google.com                                | HIGH       |
| **API Key Page**            | https://aistudio.google.com/app/apikey                     | HIGH       |
| **AI SDK Package**          | `@ai-sdk/google`                                           | HIGH       |
| **Env Variable**            | `GOOGLE_GENERATIVE_AI_API_KEY`                             | HIGH       |
| **Enforcement**             | HTTP 429 (RESOURCE_EXHAUSTED), includes retry-after header | HIGH       |
| **Daily Reset**             | Midnight Pacific Time                                      | HIGH       |
| **Geographic Restrictions** | None known                                                 | MEDIUM     |
| **Interface Language**      | English                                                    | HIGH       |

**Free Tier Limits (per model):**

| Model                 | RPM | RPD    | TPM     |
| --------------------- | --- | ------ | ------- |
| Gemini 2.5 Pro        | 5   | 100    | 250,000 |
| Gemini 2.5 Flash      | 10  | 250    | 250,000 |
| Gemini 2.5 Flash-Lite | 15  | 1,000  | 250,000 |
| Gemini 2.0 Flash      | 5   | ~1,500 | 250,000 |

**Free Models:** Gemini 2.5 Pro, Gemini 2.5 Flash, Gemini 2.5 Flash-Lite, Gemini 2.0 Flash. All share 1M token context window.

**Gotchas:**

- Limits are per Google Cloud project, not per API key
- Dec 2025 reduction: quotas cut 50-80% from previous levels
- Rate limiting uses token bucket model (RPM, TPM, RPD tracked independently)
- Gemini 2.5 Flash thinking mode may return empty `result.text` and undefined usage (known project issue)

**Sources:** [ai.google.dev/gemini-api/docs/rate-limits](https://ai.google.dev/gemini-api/docs/rate-limits), [ai.google.dev/pricing](https://ai.google.dev/pricing)

---

### Provider 2: Groq

| Property                    | Value                                         | Confidence |
| --------------------------- | --------------------------------------------- | ---------- |
| **Tier Type**               | Recurring free tier (resets daily/per-minute) | HIGH       |
| **Credit Card**             | Not required                                  | HIGH       |
| **Sign-up URL**             | https://console.groq.com                      | HIGH       |
| **API Key Page**            | https://console.groq.com/keys                 | HIGH       |
| **AI SDK Package**          | `@ai-sdk/groq`                                | HIGH       |
| **Env Variable**            | `GROQ_API_KEY`                                | HIGH       |
| **Enforcement**             | HTTP 429 with rate limit headers              | HIGH       |
| **Reset**                   | Daily reset (specific time not documented)    | MEDIUM     |
| **Geographic Restrictions** | None known                                    | MEDIUM     |
| **Interface Language**      | English                                       | HIGH       |

**Free Tier Limits (selected models):**

| Model                                     | RPM | RPD   | TPM | TPD  |
| ----------------------------------------- | --- | ----- | --- | ---- |
| llama-3.3-70b-versatile                   | 30  | 1K    | 12K | 100K |
| llama-3.1-8b-instant                      | 30  | 14.4K | 6K  | 500K |
| meta-llama/llama-4-scout-17b-16e-instruct | 30  | 1K    | 30K | 500K |
| qwen/qwen3-32b                            | 60  | 1K    | 6K  | 500K |
| moonshotai/kimi-k2-instruct               | 60  | 1K    | 10K | 300K |
| openai/gpt-oss-120b                       | 30  | 1K    | 8K  | 200K |
| whisper-large-v3                          | 20  | 2K    | -   | -    |

**Free Models:** llama-3.3-70b-versatile, llama-3.1-8b-instant, llama-4-scout, qwen3-32b, kimi-k2, gpt-oss-120b/20b, allam-2-7b, whisper models, prompt guard models.

**Gotchas:**

- Limits are per-organization, not per-key
- TPM limits are relatively low (6K-30K) meaning large prompts hit limits fast
- Ultra-fast inference (~1000 tok/sec) but very constrained daily quotas on popular models
- Model availability changes frequently; new models added often

**Sources:** [console.groq.com/docs/rate-limits](https://console.groq.com/docs/rate-limits)

---

### Provider 3: OpenRouter

| Property                    | Value                                                   | Confidence |
| --------------------------- | ------------------------------------------------------- | ---------- |
| **Tier Type**               | Recurring free tier + credit system                     | HIGH       |
| **Credit Card**             | Not required for free models                            | HIGH       |
| **Sign-up URL**             | https://openrouter.ai                                   | HIGH       |
| **API Key Page**            | https://openrouter.ai/settings/keys                     | HIGH       |
| **AI SDK Package**          | `@ai-sdk/openai-compatible`                             | HIGH       |
| **Env Variable**            | `OPENROUTER_API_KEY`                                    | HIGH       |
| **Base URL**                | `https://openrouter.ai/api/v1`                          | HIGH       |
| **Enforcement**             | HTTP 429 for rate limits, HTTP 402 for negative balance | HIGH       |
| **Reset**                   | Daily (for RPD), rolling per-minute                     | MEDIUM     |
| **Geographic Restrictions** | None known                                              | MEDIUM     |
| **Interface Language**      | English                                                 | HIGH       |

**Free Tier Limits:**

| Metric         | No Credits Purchased | $10+ Credits Purchased |
| -------------- | -------------------- | ---------------------- |
| Free model RPM | 20                   | 20                     |
| Free model RPD | 50                   | 1,000                  |

**Top 5 Recommended Free Models:**

| Model                                  | Context | Capabilities             |
| -------------------------------------- | ------- | ------------------------ |
| openrouter/hunter-alpha                | 1.0M    | Tools, Reasoning         |
| openrouter/healer-alpha                | 262K    | Vision, Tools, Reasoning |
| nvidia/nemotron-3-super-120b-a12b:free | 262K    | Tools, Reasoning         |
| qwen/qwen3-coder:free                  | 262K    | Tools (coding)           |
| meta-llama/llama-3.3-70b-instruct:free | 128K    | Tools                    |

**How OpenRouter Works (meta-provider concept):**
OpenRouter is a meta-provider that proxies requests to multiple underlying AI providers. You get a single API key that routes to any of 28+ free models from Google, Meta, NVIDIA, Mistral, Qwen, and others. Free models have `:free` suffix in their model IDs. OpenRouter gives new users a small test credit; purchasing $10+ in credits permanently unlocks 1000 RPD for free models (even after balance depletes).

**Gotchas:**

- Making additional accounts/API keys does NOT increase rate limits (global per-account governance)
- Failed attempts still count toward daily quota
- Free models may be subject to provider-level rate limiting during peak times
- Negative credit balance blocks ALL requests including free models (402 error)

**Sources:** [openrouter.ai/docs/api/reference/limits](https://openrouter.ai/docs/api/reference/limits), [costgoat.com/pricing/openrouter-free-models](https://costgoat.com/pricing/openrouter-free-models)

---

### Provider 4: Mistral (La Plateforme)

| Property                    | Value                                      | Confidence |
| --------------------------- | ------------------------------------------ | ---------- |
| **Tier Type**               | Recurring free tier ("Experiment" plan)    | HIGH       |
| **Credit Card**             | Not required                               | HIGH       |
| **Sign-up URL**             | https://console.mistral.ai                 | HIGH       |
| **API Key Page**            | https://console.mistral.ai/api-keys        | MEDIUM     |
| **Limits Page**             | https://admin.mistral.ai/plateforme/limits | HIGH       |
| **AI SDK Package**          | `@ai-sdk/mistral`                          | HIGH       |
| **Env Variable**            | `MISTRAL_API_KEY`                          | HIGH       |
| **Enforcement**             | HTTP 429                                   | HIGH       |
| **Reset**                   | Per-minute and monthly                     | MEDIUM     |
| **Geographic Restrictions** | None known                                 | MEDIUM     |
| **Interface Language**      | English                                    | HIGH       |

**Free Tier Limits (Experiment plan):**

| Metric         | Value              | Confidence |
| -------------- | ------------------ | ---------- |
| RPM            | ~2                 | MEDIUM     |
| TPM            | 500,000            | MEDIUM     |
| Monthly tokens | 1,000,000,000 (1B) | MEDIUM     |

**Free Models:** All models accessible on Experiment plan including Mistral Small, Pixtral, Devstral (coding), Codestral. Exact list varies.

**Gotchas:**

- Phone verification required for signup
- Very low RPM (2/min) makes it impractical for high-throughput testing
- 1B monthly tokens is very generous but the RPM bottleneck limits actual usage
- Specific per-model limits viewable only in admin dashboard (not publicly documented)

**Sources:** [docs.mistral.ai/deployment/ai-studio/tier](https://docs.mistral.ai/deployment/ai-studio/tier), [help.mistral.ai](https://help.mistral.ai/en/articles/455206-how-can-i-try-the-api-for-free-with-the-experiment-plan)

---

### Provider 5: HuggingFace Inference API

| Property                    | Value                                     | Confidence |
| --------------------------- | ----------------------------------------- | ---------- |
| **Tier Type**               | Monthly credits ($0.10/month free)        | HIGH       |
| **Credit Card**             | Not required for free credits             | HIGH       |
| **Sign-up URL**             | https://huggingface.co/join               | HIGH       |
| **API Key Page**            | https://huggingface.co/settings/tokens    | HIGH       |
| **AI SDK Package**          | `@ai-sdk/huggingface`                     | HIGH       |
| **Env Variable**            | `HUGGINGFACE_API_KEY` (AI SDK convention) | HIGH       |
| **Base URL**                | `https://router.huggingface.co/v1`        | HIGH       |
| **Enforcement**             | Request failures when credits exhausted   | MEDIUM     |
| **Reset**                   | Monthly credit refresh                    | HIGH       |
| **Geographic Restrictions** | None known                                | MEDIUM     |
| **Interface Language**      | English                                   | HIGH       |

**Free Tier Limits:**

| Account Type | Monthly Credits | Pay-as-you-go       |
| ------------ | --------------- | ------------------- |
| Free         | $0.10           | Yes (after credits) |
| PRO ($9/mo)  | $2.00           | Yes                 |

**Free Models:** Access to 200+ models from leading inference providers. Credits apply to HF-routed requests. Billing is compute-time-based, not token-based for most models.

**Gotchas:**

- $0.10/month is very small -- may support only ~10-50 requests depending on model
- Billing is compute-time x hardware-cost, not straightforward token counting
- The `HF_TOKEN` env var is the native HF convention, but the AI SDK package uses `HUGGINGFACE_API_KEY`
- HuggingFace is more of an aggregator/proxy (routes to multiple inference providers)
- PRO plan at $9/month gives 20x more credits ($2.00)

**Sources:** [huggingface.co/docs/inference-providers/pricing](https://huggingface.co/docs/inference-providers/pricing)

---

### Provider 6: Cerebras

| Property                    | Value                                               | Confidence |
| --------------------------- | --------------------------------------------------- | ---------- |
| **Tier Type**               | Recurring free tier (daily limits)                  | HIGH       |
| **Credit Card**             | Not required                                        | HIGH       |
| **Sign-up URL**             | https://cloud.cerebras.ai                           | HIGH       |
| **API Key Page**            | https://cloud.cerebras.ai (dashboard)               | MEDIUM     |
| **AI SDK Package**          | `@ai-sdk/cerebras`                                  | HIGH       |
| **Env Variable**            | `CEREBRAS_API_KEY`                                  | HIGH       |
| **Enforcement**             | Rate limiting (token bucket algorithm)              | HIGH       |
| **Reset**                   | Continuous replenishment (token bucket), daily caps | HIGH       |
| **Geographic Restrictions** | None known                                          | MEDIUM     |
| **Interface Language**      | English                                             | HIGH       |

**Free Tier Limits (main models):**

| Model                     | RPM | RPD   | TPM | TPD |
| ------------------------- | --- | ----- | --- | --- |
| llama3.1-8b               | 30  | 14.4K | 60K | 1M  |
| gpt-oss-120b              | 30  | 14.4K | 64K | 1M  |
| qwen-3-235b-a22b-instruct | 30  | 14.4K | 60K | 1M  |

**Free Models:** llama3.1-8b, gpt-oss-120b, qwen-3-235b-a22b-instruct-2507, zai-glm-4.7.

**Gotchas:**

- Free tier context window limited to 8,192 tokens (significantly less than other providers)
- 1M TPD is generous but 60K TPM limits burst usage
- Ultra-fast inference speed (~2,600 tokens/sec) is a major selling point
- Token bucket algorithm means capacity replenishes continuously rather than resetting at fixed intervals

**Sources:** [inference-docs.cerebras.ai/support/rate-limits](https://inference-docs.cerebras.ai/support/rate-limits)

---

### Provider 7: DeepSeek

| Property                    | Value                                            | Confidence |
| --------------------------- | ------------------------------------------------ | ---------- |
| **Tier Type**               | Trial credits (5M tokens, 30-day expiry)         | HIGH       |
| **Credit Card**             | Not required                                     | HIGH       |
| **Sign-up URL**             | https://platform.deepseek.com                    | HIGH       |
| **API Key Page**            | https://platform.deepseek.com/api_keys           | MEDIUM     |
| **AI SDK Package**          | `@ai-sdk/deepseek`                               | HIGH       |
| **Env Variable**            | `DEEPSEEK_API_KEY`                               | HIGH       |
| **Enforcement**             | No rate limits enforced; delays under heavy load | HIGH       |
| **Reset**                   | N/A (credits-based, does not reset)              | HIGH       |
| **Geographic Restrictions** | Chinese company; some geolocation considerations | LOW        |
| **Interface Language**      | English and Chinese                              | MEDIUM     |

**Free Tier Limits:**

| Metric          | Value                               |
| --------------- | ----------------------------------- |
| Initial credits | 5M tokens (some sources say 10M)    |
| Credit validity | 30 days from registration           |
| Rate limits     | None enforced (best-effort serving) |

**Free Models:** DeepSeek-V3, DeepSeek-R1 (reasoning). Same API for both `deepseek-chat` and `deepseek-reasoner`.

**Gotchas:**

- Credits expire after 30 days -- this is trial credits, NOT a recurring free tier
- After credits expire, pay-as-you-go pricing applies (very cheap: $0.28/M input, $0.42/M output)
- No rate limits means no 429 errors, but heavy traffic causes delays
- Under load: empty lines for non-streaming, `: keep-alive` comments for streaming
- 10-minute timeout: server closes connection if inference hasn't started

**Sources:** [api-docs.deepseek.com/quick_start/rate_limit](https://api-docs.deepseek.com/quick_start/rate_limit), [api-docs.deepseek.com/quick_start/pricing](https://api-docs.deepseek.com/quick_start/pricing)

---

### Provider 8: Qwen (Alibaba Cloud Model Studio)

| Property                    | Value                                                              | Confidence |
| --------------------------- | ------------------------------------------------------------------ | ---------- |
| **Tier Type**               | Trial free quota (1M tokens, 90-day expiry, Singapore region only) | HIGH       |
| **Credit Card**             | Not required (Alibaba Cloud account needed)                        | MEDIUM     |
| **Sign-up URL**             | https://www.alibabacloud.com (then activate Model Studio)          | HIGH       |
| **API Key Page**            | Model Studio Key Management page                                   | MEDIUM     |
| **AI SDK Package**          | `@ai-sdk/openai-compatible`                                        | HIGH       |
| **Env Variable**            | `DASHSCOPE_API_KEY`                                                | HIGH       |
| **Base URL (intl)**         | `https://dashscope-intl.aliyuncs.com/compatible-mode/v1`           | HIGH       |
| **Enforcement**             | HTTP 429 (dual RPM + RPS limiting)                                 | HIGH       |
| **Reset**                   | Per-minute rolling                                                 | HIGH       |
| **Geographic Restrictions** | Free quota only in Singapore region                                | HIGH       |
| **Interface Language**      | Chinese and English (some pages Chinese-only)                      | HIGH       |

**Free Tier Limits:**

| Metric                      | Value                   | Confidence |
| --------------------------- | ----------------------- | ---------- |
| Free token quota (qwen-max) | 1,000,000 tokens        | HIGH       |
| Validity                    | 90 days from activation | HIGH       |
| RPM (varies by model)       | 600-30,000              | HIGH       |
| TPM (varies by model)       | 1M-10M                  | HIGH       |

**Free Models:** qwen-max, qwen-plus, qwen3.5-plus, qwen3.5-flash, qwen-turbo, and more.

**Gotchas:**

- Free quota is ONLY available in the Singapore deployment region
- Chinese Mainland deployment mode has NO free quota
- Account and RAM users share the free quota
- Dual-limit mechanism: RPM AND RPS enforced simultaneously
- Burst in a single second triggers throttling even if minute-level quota is fine
- "Free Quota Only" safety feature available to prevent overage charges
- Console data updates hourly (not real-time)
- Interface partially in Chinese

**Sources:** [alibabacloud.com/help/en/model-studio/new-free-quota](https://www.alibabacloud.com/help/en/model-studio/new-free-quota), [alibabacloud.com/help/en/model-studio/rate-limit](https://www.alibabacloud.com/help/en/model-studio/rate-limit)

---

### Provider 9: Cloudflare Workers AI

| Property                    | Value                                                                             | Confidence |
| --------------------------- | --------------------------------------------------------------------------------- | ---------- |
| **Tier Type**               | Recurring free tier (10K neurons/day)                                             | HIGH       |
| **Credit Card**             | Not required                                                                      | HIGH       |
| **Sign-up URL**             | https://dash.cloudflare.com/sign-up                                               | HIGH       |
| **API Key Page**            | Cloudflare dashboard > API Tokens                                                 | MEDIUM     |
| **AI SDK Package**          | `@ai-sdk/openai-compatible` (REST API) or `workers-ai-provider` (Workers binding) | HIGH       |
| **Env Variable**            | `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`                                  | HIGH       |
| **Base URL**                | `https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/ai/v1`                | HIGH       |
| **Enforcement**             | Operations fail with error when limits exceeded                                   | HIGH       |
| **Reset**                   | Daily at 00:00 UTC                                                                | HIGH       |
| **Geographic Restrictions** | None known                                                                        | MEDIUM     |
| **Interface Language**      | English                                                                           | HIGH       |

**Free Tier Limits:**

| Metric           | Value                               |
| ---------------- | ----------------------------------- |
| Free neurons/day | 10,000                              |
| Token equivalent | Varies by model (neurons != tokens) |

**Free Models:** All models on Workers AI are accessible (Llama 3.1/3.3/4, Mistral, Gemma 3, Qwen, DeepSeek-R1-Distill, and more). The limit is neurons consumed, not model access.

**Gotchas:**

- Pricing is in "neurons" not tokens -- conversion varies by model
- Two integration paths: REST API (works from any server) vs Workers binding (requires Cloudflare Worker)
- For llm-router, the REST API with OpenAI-compatible endpoint is the right approach
- API token needs `Workers AI - Read` and `Workers AI - Edit` permissions
- Requires both ACCOUNT_ID and API_TOKEN (two env vars)
- The `workers-ai-provider` community package is Workers-only, not suitable for general server use

**Sources:** [developers.cloudflare.com/workers-ai/platform/pricing/](https://developers.cloudflare.com/workers-ai/platform/pricing/), [developers.cloudflare.com/workers-ai/get-started/rest-api/](https://developers.cloudflare.com/workers-ai/get-started/rest-api/)

---

### Provider 10: NVIDIA NIM

| Property                    | Value                                 | Confidence |
| --------------------------- | ------------------------------------- | ---------- |
| **Tier Type**               | Trial credits (1000 credits)          | MEDIUM     |
| **Credit Card**             | Not required                          | MEDIUM     |
| **Sign-up URL**             | https://build.nvidia.com              | HIGH       |
| **API Key Page**            | NVIDIA Developer dashboard            | MEDIUM     |
| **AI SDK Package**          | `@ai-sdk/openai-compatible`           | HIGH       |
| **Env Variable**            | `NIM_API_KEY`                         | HIGH       |
| **Base URL**                | `https://integrate.api.nvidia.com/v1` | HIGH       |
| **Enforcement**             | HTTP 429                              | HIGH       |
| **Reset**                   | Credits-based (one-time allocation)   | MEDIUM     |
| **Geographic Restrictions** | None known                            | MEDIUM     |
| **Interface Language**      | English                               | HIGH       |

**Free Tier Limits:**

| Metric                     | Value                          | Confidence |
| -------------------------- | ------------------------------ | ---------- |
| Initial credits            | 1,000 (can request 4,000 more) | MEDIUM     |
| RPM                        | 40                             | MEDIUM     |
| Token-to-credit conversion | Not publicly documented        | LOW        |

**Free Models:** DeepSeek-R1, Llama 3.1, Nemotron, and many others available through build.nvidia.com catalog.

**Gotchas:**

- Credit system is opaque -- token-to-credit conversion rate not publicly documented
- 40 RPM limit for trial experience
- Credits can run out quickly depending on model and token usage
- New models on free API are frequently overloaded
- NVIDIA Developer Program membership may provide additional free access
- "Request More" button available for +4,000 additional credits

**Sources:** [build.nvidia.com](https://build.nvidia.com), [ai-sdk.dev/providers/openai-compatible-providers/nim](https://ai-sdk.dev/providers/openai-compatible-providers/nim)

---

### Provider 11: Cohere

| Property                    | Value                                         | Confidence |
| --------------------------- | --------------------------------------------- | ---------- |
| **Tier Type**               | Trial key (1000 calls/month, non-commercial)  | HIGH       |
| **Credit Card**             | Not required                                  | HIGH       |
| **Sign-up URL**             | https://dashboard.cohere.com/welcome/register | HIGH       |
| **API Key Page**            | https://dashboard.cohere.com/api-keys         | HIGH       |
| **AI SDK Package**          | `@ai-sdk/cohere`                              | HIGH       |
| **Env Variable**            | `COHERE_API_KEY`                              | HIGH       |
| **Enforcement**             | Rate limiting per endpoint                    | HIGH       |
| **Reset**                   | Monthly (1000 calls/month)                    | HIGH       |
| **Geographic Restrictions** | None known                                    | MEDIUM     |
| **Interface Language**      | English                                       | HIGH       |

**Free Tier Limits:**

| Endpoint          | RPM              | Monthly Cap        |
| ----------------- | ---------------- | ------------------ |
| Chat (all models) | 20               | 1,000 calls shared |
| Embed             | 2,000 inputs/min | 1,000 calls shared |
| Embed (Images)    | 5 inputs/min     | 1,000 calls shared |
| Rerank            | 10               | 1,000 calls shared |

**Free Models:** All models accessible on trial key: Command R+, Command R, Rerank 3.5, Embed 4.

**Gotchas:**

- Trial keys explicitly NOT permitted for production or commercial use
- 1000 calls/month is shared across ALL endpoints
- 20 RPM for Chat is reasonable but total monthly cap limits practical use
- Must upgrade to Production key for any production workload

**Sources:** [docs.cohere.com/docs/rate-limits](https://docs.cohere.com/docs/rate-limits)

---

### Provider 12: GitHub Models

| Property                    | Value                                                           | Confidence |
| --------------------------- | --------------------------------------------------------------- | ---------- |
| **Tier Type**               | Recurring free tier (rate-limited)                              | HIGH       |
| **Credit Card**             | Not required (GitHub account needed)                            | HIGH       |
| **Sign-up URL**             | https://github.com/signup (then enable GitHub Models)           | HIGH       |
| **API Key Page**            | https://github.com/settings/tokens (PAT with models:read scope) | HIGH       |
| **AI SDK Package**          | `@github/models` (dedicated) or `@ai-sdk/openai-compatible`     | HIGH       |
| **Env Variable**            | `GITHUB_TOKEN`                                                  | HIGH       |
| **Base URL**                | `https://models.github.ai/inference`                            | HIGH       |
| **Enforcement**             | Rate limiting per model category                                | HIGH       |
| **Reset**                   | Daily                                                           | MEDIUM     |
| **Geographic Restrictions** | None known                                                      | MEDIUM     |
| **Interface Language**      | English                                                         | HIGH       |

**Free Tier Limits (by model category):**

| Category    | RPM | RPD | Tokens/Request | Concurrent |
| ----------- | --- | --- | -------------- | ---------- |
| Low models  | 15  | 150 | 8K in / 4K out | 5          |
| High models | 10  | 50  | 8K in / 4K out | 2          |
| Embedding   | 15  | 150 | 64K            | 5          |

**Free Models:** Llama 3.1 8B (low), Gemini 2.5 Flash (low), Mistral Small (low), GPT-4o mini (low). High models (Claude, GPT-4o, Gemini Pro) have stricter limits. Some premium models (o1/o3, GPT-5, DeepSeek-R1) require paid Copilot subscription.

**Gotchas:**

- Old endpoint `models.inference.ai.azure.com` deprecated July 2025, use `models.github.ai` instead
- Need GitHub PAT with `models:read` scope (fine-grained tokens work)
- Token limits are per-request, not per-day (8K input / 4K output)
- Limits vary by Copilot subscription tier (Free, Pro, Business, Enterprise)
- Designed for prototyping, not production
- Dedicated `@github/models` package provides native AI SDK integration

**Sources:** [docs.github.com/en/github-models](https://docs.github.com/github-models/prototyping-with-ai-models), [github.com/github/models-ai-sdk](https://github.com/github/models-ai-sdk)

---

## AI SDK Provider Package Summary

| Provider    | AI SDK Package              | Type          | Env Variable                   |
| ----------- | --------------------------- | ------------- | ------------------------------ |
| Google      | `@ai-sdk/google`            | Official      | `GOOGLE_GENERATIVE_AI_API_KEY` |
| Groq        | `@ai-sdk/groq`              | Official      | `GROQ_API_KEY`                 |
| OpenRouter  | `@ai-sdk/openai-compatible` | OpenAI-compat | `OPENROUTER_API_KEY`           |
| Mistral     | `@ai-sdk/mistral`           | Official      | `MISTRAL_API_KEY`              |
| HuggingFace | `@ai-sdk/huggingface`       | Official      | `HUGGINGFACE_API_KEY`          |
| Cerebras    | `@ai-sdk/cerebras`          | Official      | `CEREBRAS_API_KEY`             |
| DeepSeek    | `@ai-sdk/deepseek`          | Official      | `DEEPSEEK_API_KEY`             |
| Qwen        | `@ai-sdk/openai-compatible` | OpenAI-compat | `DASHSCOPE_API_KEY`            |
| Cloudflare  | `@ai-sdk/openai-compatible` | OpenAI-compat | `CLOUDFLARE_API_TOKEN`         |
| NVIDIA      | `@ai-sdk/openai-compatible` | OpenAI-compat | `NIM_API_KEY`                  |
| Cohere      | `@ai-sdk/cohere`            | Official      | `COHERE_API_KEY`               |
| GitHub      | `@github/models`            | Dedicated     | `GITHUB_TOKEN`                 |

**7 providers have official/dedicated AI SDK packages.** 4 use `@ai-sdk/openai-compatible`. GitHub has a separate first-party package.

## Provider Tier Classification

| Category                | Providers                                                             | Characteristics                 |
| ----------------------- | --------------------------------------------------------------------- | ------------------------------- |
| **Recurring Free Tier** | Google, Groq, Cerebras, Mistral, Cohere, GitHub, OpenRouter           | Resets daily/monthly, no expiry |
| **Trial Credits**       | DeepSeek (5M tokens/30d), NVIDIA (1000 credits), Qwen (1M tokens/90d) | One-time allocation, expires    |
| **Monthly Credits**     | HuggingFace ($0.10/mo)                                                | Small monthly refresh           |
| **Usage-Based Free**    | Cloudflare (10K neurons/day)                                          | Daily allocation, unusual unit  |

## Recommended Starter Set (Easiest to Set Up)

1. **Google AI Studio** -- No credit card, generous limits, 2 minutes to get key, most models
2. **Groq** -- No credit card, instant API key, ultra-fast inference
3. **OpenRouter** -- No credit card, 28+ free models, single key for many providers

## Aggregate Capacity Estimate

Approximate total monthly free capacity across all 12 providers (very rough, varies by model and usage pattern):

- **Token throughput:** ~30-50M tokens/month using all providers in rotation
- **Request capacity:** ~5,000-15,000 requests/day across all providers
- **Best value:** Google (high RPD), Groq (fast inference, decent TPD), Cerebras (1M TPD), Mistral (1B monthly)

## Code Examples

### Limit Builder Usage

```typescript
import { createTokenLimit, createRateLimit, createCallLimit } from 'llm-router/policy';

const googleLimits = [
  createRateLimit(15, 'per-minute'), // 15 RPM
  createRateLimit(1000, 'daily'), // 1000 RPD
  createTokenLimit(250_000, 'per-minute'), // 250K TPM
];

const config = {
  providers: {
    google: {
      keys: [process.env.GOOGLE_GENERATIVE_AI_API_KEY!],
      limits: googleLimits,
    },
  },
};
```

### Provider Config with Types

```typescript
import type { GoogleProviderConfig, GroqProviderConfig } from 'llm-router/types';
import { createTokenLimit, createRateLimit } from 'llm-router/policy';

// Users get autocomplete and JSDoc hover docs
const google: GoogleProviderConfig = {
  keys: [process.env.GOOGLE_GENERATIVE_AI_API_KEY!],
  limits: [
    createRateLimit(15, 'per-minute'),
    createRateLimit(1000, 'daily'),
    createTokenLimit(250_000, 'per-minute'),
  ],
};

const groq: GroqProviderConfig = {
  keys: [process.env.GROQ_API_KEY!],
  limits: [
    createRateLimit(30, 'per-minute'),
    createRateLimit(1000, 'daily'),
    createTokenLimit(100_000, 'daily'),
  ],
};
```

### Empty Skeleton JSON Structure

```json
{
  "schemaVersion": "1.0",
  "providers": {
    "google": { "limits": [], "enforcement": "hard-block", "resetWindows": [] },
    "groq": { "limits": [], "enforcement": "hard-block", "resetWindows": [] },
    "openrouter": { "limits": [], "enforcement": "throttle", "resetWindows": [] },
    "mistral": { "limits": [], "enforcement": "hard-block", "resetWindows": [] },
    "huggingface": { "limits": [], "enforcement": "hard-block", "resetWindows": [] },
    "cerebras": { "limits": [], "enforcement": "hard-block", "resetWindows": [] },
    "deepseek": { "limits": [], "enforcement": "hard-block", "resetWindows": [] },
    "qwen": { "limits": [], "enforcement": "hard-block", "resetWindows": [] },
    "cloudflare": { "limits": [], "enforcement": "hard-block", "resetWindows": [] },
    "nvidia": { "limits": [], "enforcement": "hard-block", "resetWindows": [] },
    "cohere": { "limits": [], "enforcement": "hard-block", "resetWindows": [] },
    "github": { "limits": [], "enforcement": "hard-block", "resetWindows": [] }
  }
}
```

## State of the Art

| Old Approach (Phase 3)                             | New Approach (Phase 8)                                   | Impact                               |
| -------------------------------------------------- | -------------------------------------------------------- | ------------------------------------ |
| `shippedDefaults` Map with hard-coded limit values | Empty provider skeleton, user-configured limits          | No stale routing data                |
| Auto-apply shipped defaults in three-layer merge   | `applyRegistryDefaults: false` by default                | User must opt in to defaults         |
| 3 providers with placeholder data                  | 12 providers with docs, types, and builders              | Complete coverage without stale data |
| No builder helpers                                 | `createTokenLimit`, `createRateLimit`, `createCallLimit` | Less boilerplate in user config      |

**Deprecated/outdated:**

- `shippedDefaults` Map: Being removed in this phase
- Individual policy files (google.ts, groq.ts, openrouter.ts): Being deleted
- GitHub Models Azure endpoint (`models.inference.ai.azure.com`): Deprecated July 2025, replaced by `models.github.ai`

## Open Questions

1. **Cloudflare neuron-to-token conversion**
   - What we know: 10K neurons/day free, pricing is per-neuron not per-token
   - What's unclear: Exact neuron-to-token conversion ratio varies by model
   - Recommendation: Document that Cloudflare uses neurons and users should check model-specific conversion. For limit builders, users would need to set their own value based on their model usage patterns.

2. **NVIDIA credit-to-token conversion**
   - What we know: 1000 credits initial, 40 RPM
   - What's unclear: How many tokens = 1 credit
   - Recommendation: Document as credit-based with note that exact conversion is model-dependent. Defer to credit-based limit handling phase.

3. **HuggingFace compute-time billing**
   - What we know: $0.10/month credits, compute-time-based billing
   - What's unclear: How to translate to token-based limits for PolicyEngine
   - Recommendation: Document as credit-based, users can set approximate limits based on their observed usage.

4. **Qwen regional restrictions**
   - What we know: Free quota only in Singapore region
   - What's unclear: Whether international users outside Asia can access Singapore endpoint reliably
   - Recommendation: Document the restriction clearly, recommend using the international endpoint (`dashscope-intl.aliyuncs.com`).

## Validation Architecture

### Test Framework

| Property           | Value                       |
| ------------------ | --------------------------- |
| Framework          | Vitest 2.x                  |
| Config file        | `vitest.config.ts`          |
| Quick run command  | `npx vitest run`            |
| Full suite command | `npx vitest run --coverage` |

### Phase Requirements -> Test Map

| Req ID             | Behavior                                                                     | Test Type   | Automated Command                                                | File Exists?               |
| ------------------ | ---------------------------------------------------------------------------- | ----------- | ---------------------------------------------------------------- | -------------------------- |
| PROV-01 to PROV-12 | Provider docs exist with correct content                                     | manual-only | N/A -- doc files, not code logic                                 | Wave 0                     |
| DX-02              | Key acquisition docs for all 12 providers                                    | manual-only | N/A -- doc files                                                 | Wave 0                     |
| Config toggle      | `applyRegistryDefaults` defaults to false                                    | unit        | `npx vitest run tests/config.test.ts -t "applyRegistryDefaults"` | Wave 0                     |
| Defaults removal   | shippedDefaults no longer imported/used                                      | unit        | `npx vitest run tests/build.test.ts`                             | Existing (build test)      |
| Builder helpers    | createTokenLimit/createRateLimit/createCallLimit produce correct PolicyLimit | unit        | `npx vitest run tests/builders.test.ts`                          | Wave 0                     |
| No-limits behavior | Keys with no limits always eligible                                          | unit        | `npx vitest run tests/config.test.ts`                            | Existing (needs extension) |

### Sampling Rate

- **Per task commit:** `npx vitest run` + `npx tsc --noEmit`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green + `npm run build` passes

### Wave 0 Gaps

- [ ] `tests/builders.test.ts` -- covers builder helper functions (if plan requires tests)
- No framework gaps -- Vitest already configured and working

Note: Per CLAUDE.md testing strategy, tests are minimal during build phases. The build check (`tsc --noEmit`, `npm run build`) is the primary verification.

## Sources

### Primary (HIGH confidence)

- [ai.google.dev/gemini-api/docs/rate-limits](https://ai.google.dev/gemini-api/docs/rate-limits) -- Google free tier limits
- [console.groq.com/docs/rate-limits](https://console.groq.com/docs/rate-limits) -- Groq per-model limits table (fetched directly)
- [openrouter.ai/docs/api/reference/limits](https://openrouter.ai/docs/api/reference/limits) -- OpenRouter rate limits
- [api-docs.deepseek.com/quick_start/rate_limit](https://api-docs.deepseek.com/quick_start/rate_limit) -- DeepSeek no-rate-limit policy
- [inference-docs.cerebras.ai/support/rate-limits](https://inference-docs.cerebras.ai/support/rate-limits) -- Cerebras per-model limits
- [docs.cohere.com/docs/rate-limits](https://docs.cohere.com/docs/rate-limits) -- Cohere trial key limits
- [docs.github.com/en/github-models](https://docs.github.com/github-models/prototyping-with-ai-models) -- GitHub Models free tier
- [huggingface.co/docs/inference-providers/pricing](https://huggingface.co/docs/inference-providers/pricing) -- HuggingFace credits
- [alibabacloud.com/help/en/model-studio/new-free-quota](https://www.alibabacloud.com/help/en/model-studio/new-free-quota) -- Qwen free quota
- [developers.cloudflare.com/workers-ai/platform/pricing/](https://developers.cloudflare.com/workers-ai/platform/pricing/) -- Cloudflare neurons
- [ai-sdk.dev/providers/ai-sdk-providers](https://ai-sdk.dev/providers/ai-sdk-providers) -- AI SDK official providers
- [ai-sdk.dev/providers/openai-compatible-providers/nim](https://ai-sdk.dev/providers/openai-compatible-providers/nim) -- NVIDIA NIM AI SDK setup
- [github.com/github/models-ai-sdk](https://github.com/github/models-ai-sdk) -- GitHub Models AI SDK package
- [costgoat.com/pricing/openrouter-free-models](https://costgoat.com/pricing/openrouter-free-models) -- OpenRouter free model list (March 2026)

### Secondary (MEDIUM confidence)

- [docs.mistral.ai/deployment/ai-studio/tier](https://docs.mistral.ai/deployment/ai-studio/tier) -- Mistral tiers (specific limits behind dashboard login)
- [build.nvidia.com](https://build.nvidia.com) -- NVIDIA NIM credits (specific values vary)
- Multiple community sources cross-referenced for DeepSeek trial credit amount

### Tertiary (LOW confidence)

- NVIDIA credit-to-token conversion rate -- not publicly documented
- Cloudflare neuron-to-token equivalents -- varies by model, no public table found
- HuggingFace compute-time to token mapping -- not straightforward

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH -- no new dependencies, existing patterns
- Architecture: HIGH -- clear removal + addition pattern, well-understood codebase
- Provider limits: MEDIUM -- verified from official docs where possible, but limits change frequently
- AI SDK packages: HIGH -- verified from official AI SDK documentation
- Builder helpers: HIGH -- straightforward TypeScript pattern

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (30 days -- provider limits may change sooner)
