# PennyLLM Provider Gap Report

**Date:** 2026-03-17
**Covers:** 6 active providers (Cerebras, Google AI Studio, Groq, SambaNova, NVIDIA NIM, Mistral)
**Context:** PennyLLM v1.0 uses reactive 429-driven routing (Phase 12). This report audits each provider against the implemented abstractions.

## Executive Summary

- PennyLLM's reactive design (try -> 429 -> cooldown -> next in chain) handles most provider nuances correctly without pre-configured limits
- 6 providers analyzed, 0 have blocking gaps for v1 functionality
- 5 P0 documentation gaps must be addressed before v1 release
- 2 P1 code patches are low-effort improvements
- 4 P2 items deferred to Phase 13+ (credit tracking, per-model cooldown, pool quotas, per-second windows)

## Methodology

Three-category severity framework:

- **(a) Works but suboptimal** -- reactive handling produces correct behavior, but configuration is wasteful or a request is wasted discovering a limit
- **(b) Documentation/DX gaps** -- system works, but missing docs could lead to user confusion or misconfiguration
- **(c) Deferred to v2** -- genuine capability gaps requiring code changes beyond v1 scope

**Source material:** Provider intelligence notes (`docs/providers/notes/*.md`), PennyLLM source code (`src/config/schema.ts`, `src/wrapper/error-classifier.ts`, `src/usage/cooldown.ts`, `src/providers/registry.ts`), and Phase 12.1 research (`12.1-RESEARCH.md`).

**Why reactive mitigates most gaps:** PennyLLM's chain executor walks the user's model priority chain. On 429, `classifyError()` identifies the rate limit, `CooldownManager.setCooldown()` applies exponential backoff (parsing `Retry-After` or `x-ratelimit-reset-*` headers when available, defaulting to 60s otherwise), and the chain advances to the next model. On 402, `CooldownManager.setProviderCooldown()` applies permanent session cooldown. This means inaccurate pre-configured limits don't break routing -- they just waste a single request discovering the real limit.

## Provider-by-Provider Analysis

### 1. Cerebras

**Limit Model Match:**

- Reality: Account-level limits -- 30 RPM, 60,000 TPM, 1,000,000 TPD. NOT per-key.
- PennyLLM: Per-key tracking via `providerConfigSchema` in `schema.ts`. Mismatch but harmless -- reactive 429 catches the real account-level limit regardless of how many keys are configured.
- All keys share the same account quota. Configuring multiple keys from the same account provides zero additional capacity.

**Key Rotation Value:** NONE. Cerebras enforces limits at the account level. Multiple API keys from the same account all draw from the same 30 RPM / 60K TPM / 1M TPD pool. Key rotation is completely ineffective.

**Error Response Handling:** Standard 429 with seconds-based rate limit headers. PennyLLM's `parseRetryAfter()` handles the `Retry-After` header (delta-seconds format), and `parseRateLimitReset()` handles `x-ratelimit-reset-requests` as fallback. Both implemented correctly in `error-classifier.ts`.

**Missing Capabilities:** None significant. Cerebras's three-dimension limits (RPM, TPM, TPD) map cleanly to PennyLLM's `policyLimitSchema` types (`rate`, `tokens`, `daily`).

**Available Models (free tier):**

- Llama 4 Maverick (~400B MoE) -- flagship, ~2,522 tok/s
- Llama 4 Scout (17Bx16E MoE) -- 10M context window
- Qwen3 235B (22B active MoE) -- competitive with GPT-4o
- Qwen3 32B, Llama 3.3 70B, DeepSeek-R1 70B Distilled, GPT-OSS 120B

**DX Recommendations:**

- Document: "Only one Cerebras key needed per account -- multiple keys share the same 30 RPM / 60K TPM / 1M TPD limits"
- Consider config validation warning if >1 Cerebras key detected (P1 candidate)
- Highlight that Cerebras has the most generous perpetual free tier (1M tokens/day, no credit card, no expiry) and fastest inference (2,000-3,000 tok/s)

**Severity:** (a) works-but-suboptimal for multi-key config, (b) docs gap for key rotation guidance

**Confidence:** HIGH -- well-documented limits, verified rate limit header format

---

### 2. Google AI Studio

**Limit Model Match:**

- Reality: Per-project limits (not per-key, not per-account). Three dimensions: RPM, TPM, RPD. Each model within a project has its own independent sub-limits.
- PennyLLM: Per-key tracking. Keys from DIFFERENT Google Cloud projects get independent quota (strong use case for key rotation). Keys from the SAME project share quota (zero benefit).
- Per-model limits within a project vary significantly:

| Model                    | RPM | TPM  | RPD    |
| ------------------------ | --- | ---- | ------ |
| Gemini 2.5 Flash         | 10  | 250K | 250    |
| Gemini 2.5 Flash Lite    | 15  | 250K | 1,000  |
| Gemini 2.5 Pro           | 5   | 250K | 100    |
| Gemini 3 Flash (preview) | 5   | 250K | 20     |
| Gemma 3 (1B-27B)         | 30  | 15K  | 14,400 |

**Key Rotation Value:** HIGH -- but ONLY with keys from separate Google Cloud projects. Users can create up to 10 projects per account, each with independent quota. This is PennyLLM's strongest key rotation scenario. 10 projects = 10x effective limits.

**Per-Model Limits:** Models within a project have different RPM/TPM/RPD. PennyLLM cannot distinguish -- a key exhausted for Gemini 2.5 Pro (5 RPM) might still have quota for Gemini 2.5 Flash Lite (15 RPM). Reactive 429 handles it (cools down key, chain advances), but wastes a request.

**0/0/0 Models:** Several models listed in the dashboard have zero free-tier allocation: Gemini 3.1 Pro, Gemini 2 Flash, Gemini 2 Flash Lite, Gemini 2 Flash Exp, Computer Use Preview, Deep Research Pro Preview. PennyLLM tries, gets 429, cools down. Works but wastes a request.

**Error Response Handling:** 429 with `x-ratelimit-reset` header. Parsed correctly by `parseRateLimitReset()` in `error-classifier.ts` (second fallback after `x-ratelimit-reset-requests`).

**Additional Notes:**

- RPD resets at midnight Pacific Time
- Dec 2025 quota reduction: Google cut free tier quotas by 50-80%. Old documentation shows higher numbers.
- Model deprecation cycle: 2.5 series deprecated by mid-2026, replaced by 3.x series
- Gemini 2.5 Flash thinking mode returns empty `result.text` and undefined usage fields (PennyLLM already guards with `Number(x) || 0`)

**DX Recommendations:**

- Document: "Create separate Google Cloud projects for each key to multiply quota. Up to 10 projects per account = 10x effective limits."
- Document: "Keys from the same project share limits -- adding multiple same-project keys provides no benefit"
- Document which models have 0/0/0 allocation to help users avoid wasted requests
- Note: Google cut free tier quotas in Dec 2025; exact numbers may change again

**Severity:** (a) per-model limits suboptimal (wasted requests), (b) CRITICAL docs gap for multi-project setup and 0/0/0 model avoidance

**Confidence:** HIGH for limit structure. MEDIUM for exact per-model numbers (Google changed quotas in Dec 2025).

---

### 3. Groq

**Limit Model Match:**

- Reality: Per-organization, per-model. Four dimensions: RPM, RPD, TPM, TPD per model. Organization-level ceiling acts as cap that all projects/keys within the org share for a given model. NOT a cross-model aggregate.
- PennyLLM: Per-key tracking. Same gap as Google -- exhausted for one model, still valid for others.
- Per-model limits vary wildly:

| Model                                     | RPM | RPD    | TPM | TPD      |
| ----------------------------------------- | --- | ------ | --- | -------- |
| llama-3.1-8b-instant                      | 30  | 14,400 | 6K  | 500K     |
| llama-3.3-70b-versatile                   | 30  | 1,000  | 12K | 100K     |
| meta-llama/llama-4-scout-17b-16e-instruct | 30  | 1,000  | 30K | 500K     |
| moonshotai/kimi-k2-instruct               | 60  | 1,000  | 10K | 300K     |
| qwen/qwen3-32b                            | 60  | 1,000  | 6K  | 500K     |
| groq/compound                             | 30  | 250    | 70K | No limit |

**Key Rotation Value:** NONE for same organization. All keys within one org share the same per-model quotas. Multiple keys don't increase quota. Limits are per-organization, not per-key.

**TPM Constraint:** 6K-30K TPM is very tight. A single large prompt can exhaust the per-minute token budget. This is frequently the binding constraint. Reactive 429 handles this well (cooldown, chain advances to different provider).

**Error Response Handling:** 429 with `x-ratelimit-reset-requests` header (epoch seconds). Parsed correctly by `parseRateLimitReset()` in `error-classifier.ts` as the primary fallback header. Epoch detection works via the `> 1_000_000_000` check.

**Additional Notes:**

- Cached tokens do NOT count toward limits
- Preview models (llama-4-scout, kimi-k2, qwen3-32b) can disappear without notice
- Model IDs use org-prefixed format for newer models: `meta-llama/...`, `qwen/...`, `openai/...`
- Ultra-fast LPU inference (~1,000 tok/s)

**DX Recommendations:**

- Document: "Only one Groq key needed per organization -- multiple keys share the same per-model limits"
- Document: "Keep prompts small for Groq -- TPM limits are tight (6K-30K depending on model). A single large prompt can exhaust the per-minute budget."
- Document: "Different Groq models have very different limits -- smaller models (llama-3.1-8b: 14,400 RPD) have much higher quotas than larger ones (llama-3.3-70b: 1,000 RPD)"

**Severity:** (a) per-model limits suboptimal (key exhausted for one model may still work for another), (b) docs gap for TPM constraints and single-key guidance

**Confidence:** HIGH for production models. LOW for preview models (may be discontinued without notice).

---

### 4. SambaNova

**Limit Model Match:**

- Reality: Per-model limits, two drastically different tiers:
  - **Free tier** (no card linked): 20 RPM, 20 RPD, 200K TPD per model -- almost unusable
  - **Developer tier** (card linked, $0 balance): up to 1,440 RPM, 288K RPD per model -- **600x more**
- PennyLLM: Per-key tracking. No tier awareness. Cannot distinguish between free and developer tier keys.

| Model (Developer Tier)        | RPM   | RPD     |
| ----------------------------- | ----- | ------- |
| DeepSeek-R1-0528 (671B full)  | 60    | 12,000  |
| DeepSeek-R1-Distill-Llama-70B | 240   | 48,000  |
| DeepSeek-V3-0324 / V3.1       | 60    | 12,000  |
| Meta-Llama-3.3-70B-Instruct   | 240   | 48,000  |
| Meta-Llama-3.1-8B-Instruct    | 1,440 | 288,000 |

**Key Rotation Value:** UNKNOWN (likely per-account, no documented benefit from multiple keys). Conservative assumption: no benefit.

**The Critical Gap:** The 600x difference between free and developer tier is unprecedented across all providers. 20 RPD on free tier means a SambaNova provider with a free-tier key is exhausted within minutes of light usage. Users who don't link a payment card (even with $0 balance) will have a terrible experience.

**$5 Signup Credit:** 30-day expiry. PennyLLM handles 402 as permanent session cooldown via `classifyError()` in `error-classifier.ts` (returns `cooldownMs: Infinity, cooldownClass: 'permanent'`). This is correct for v1. Credit balance tracking deferred to Phase 13.

**Community SDK:** Uses `sambanova-ai-provider` (community provider, not first-party `@ai-sdk/*`). May have stability/maintenance concerns.

**Error Response Handling:** 429 with epoch-based `x-ratelimit-reset-requests` header. Parsed correctly by `parseRateLimitReset()` -- the epoch detection (`> 1_000_000_000`) correctly interprets SambaNova's epoch-seconds reset times.

**Unique Value:** Only free access to the full DeepSeek-R1 671B model (other providers only offer the 70B distill). Running at 198-250 tok/s on SambaNova's custom RDU hardware.

**DX Recommendations:**

- Document: "STRONGLY recommend linking a payment card (Developer tier at $0 balance). Free tier has only 20 requests per day per model -- practically unusable. Developer tier gives up to 288,000 RPD. You will NOT be charged."
- Document: "$5 signup credit expires in 30 days"
- Document: "SambaNova is the only provider offering the full DeepSeek-R1 671B for free"
- Flag SambaNova as reactive-only for limit pre-configuration (tier cannot be detected from API key)

**Severity:** (b) CRITICAL docs gap for tier recommendation, (a) per-model limits same gap as Groq/Google, (c) credit tracking deferred to Phase 13

**Confidence:** HIGH for developer tier limits (documented per-model tables). MEDIUM for free tier (20 RPD is community-reported).

---

### 5. NVIDIA NIM

**Limit Model Match:**

- Reality: Rate-limited perpetual trial (no time limit). ~40 RPM (community-reported, varies by model). Per-model limits exist but NVIDIA explicitly refuses to publish them.
- PennyLLM: Cannot pre-configure limits with any confidence. 100% reactive via 429 detection -- this is the correct and only viable approach.

Quote from NVIDIA staff: _"We do not plan to publish specific model limits, since the limits only apply to the APIs which are for trial experiences."_

**Key Rotation Value:** UNKNOWN (likely per-developer-account, no documented benefit). Conservative assumption: no benefit.

**Unpublished Limits:** NVIDIA has explicitly stated they will not publish per-model rate limits. The ~40 RPM figure is community-reported and may not apply uniformly across models or over time. PennyLLM's reactive design is ideal for this scenario -- no stale pre-configured limits to maintain.

**Rate Limit Headers:** NOT documented by NVIDIA. LiteLLM integration suggests `x-ratelimit-limit-requests` and `x-ratelimit-limit-tokens` headers may be present, but this is unconfirmed. If absent, PennyLLM defaults to 60s cooldown (`cooldownSchema.defaultDurationMs` in `schema.ts`) with exponential backoff via `CooldownManager.setCooldown()`. This is correct but potentially conservative.

**402 Handling:** Legacy credit system produced 402 responses. NVIDIA says credits are discontinued (replaced by rate-limited trial), but 402 may still fire for legacy accounts or edge cases. PennyLLM handles 402 as permanent session cooldown (`cooldownMs: Infinity`, `cooldownClass: 'permanent'` in `error-classifier.ts`) -- correct defensive behavior.

**Geo-Restriction:** build.nvidia.com returns 403 from some countries. Cannot test locally from the developer's location. PennyLLM's `classifyError()` maps 403 to `type: 'auth'`, which is the correct classification for geo-blocked access.

**Free Endpoint Model Highlights:**

- `deepseek-ai/deepseek-v3.2` -- frontier 685B MoE
- `moonshotai/kimi-k2.5` -- ~1T MoE (largest model available anywhere for free)
- `nvidia/nemotron-3-super-120b-a12b` -- 1M context window
- `qwen/qwen3-coder-480b-a35b-instruct` -- 256K context, coding specialist
- 14+ free endpoints total, broadest free model catalog

**DX Recommendations:**

- Document: "NVIDIA limits are unpublished -- PennyLLM adapts automatically via 429 detection. No pre-configured limits needed."
- Document: "Default cooldown timing may be conservative (60s) if NVIDIA doesn't return Retry-After headers. This errs on the safe side."
- Document: "build.nvidia.com may be geo-restricted in some regions (403 response)"
- Document: "NVIDIA NIM has the broadest free model catalog -- 14+ models including frontier models from DeepSeek, NVIDIA, Qwen, Meta, and Moonshot"

**Severity:** (a) potentially conservative cooldown if no rate limit headers are returned, (b) docs gap for reactive-only explanation and geo-restriction

**Confidence:** LOW for exact rate limits (unpublished). HIGH for reactive approach correctness (it's the only approach possible).

---

### 6. Mistral

**Limit Model Match:**

- Reality: Per-organization (not per-key). "Experiment" plan limits:
  - 1 RPS (requests per second) -- global across all models
  - 50,000 TPM ("Standard pool")
  - 1,000,000,000 (1B) tokens per month
- PennyLLM: `timeWindowSchema` in `schema.ts` supports `'per-minute'`, `'hourly'`, `'daily'`, `'monthly'`, `'rolling-30d'` -- but NOT `'per-second'`. Cannot model 1 RPS directly.

**Key Rotation Value:** NONE. Up to 10 API keys per account, all share the same organization-level limits. Multiple keys provide zero additional capacity.

**RPS Gap:** PennyLLM has no `per-second` time window type. Mistral's 1 RPS limit (= max 60 RPM theoretical) cannot be pre-modeled. Workaround: configure as ~2 RPM (conservative approximation). Reactive 429 catches the actual 1 RPS limit regardless of pre-configuration.

**Pool System:** Community reports suggest models share token quotas in pools:

- General purpose pool: Mistral Large 3, Mistral Small 3.2, Ministral series
- Coding pool: Codestral, Devstral
- Multimodal pool: Pixtral Large, Pixtral 12B

PennyLLM has no concept of shared token pools across models. If real, hitting TPM on one model in a pool would affect quota for other models in the same pool. Reactive handling works -- 429 triggers cooldown and chain advances to a different provider.

**WARNING:** Pool system details are NOT in any official public docs. This is community-reported only and may not be accurate.

**5-Minute Sliding Window:** Some larger models (e.g., Mistral Large) reportedly use a 5-minute sliding window for token tracking instead of the standard 1-minute window. PennyLLM's `per-minute` window can't model this. Reactive 429 handles it.

**Data Privacy:** **CRITICAL.** Free tier ("Experiment" plan) defaults to data sharing enabled -- Mistral may use your prompts for model training. Opt-out: Admin Console -> Privacy Settings -> toggle off "Anonymized Improvement Data." Paid tier ("Scale") does not train on data automatically. Zero Data Retention (ZDR) requires contacting Mistral support.

**Codestral Dedicated Endpoint:** Codestral has a separate free endpoint (`codestral.mistral.ai/v1/`) with its own rate limits, independent from the standard API. For PennyLLM, we use the standard endpoint (`api.mistral.ai/v1/`).

**Error Response Handling:** Standard 429 with `Retry-After` header (delta-seconds format). Parsed correctly by `parseRetryAfter()` in `error-classifier.ts`.

**Available Models (current, non-deprecated):**

- Mistral Large 3, Mistral Medium 3.1, Mistral Small 3.2
- Ministral 3 (14B, 8B, 3B)
- Magistral Medium/Small 1.2
- Codestral, Devstral 2

**DX Recommendations:**

- Document: "CRITICAL: Mistral free tier ('Experiment' plan) may use your data for model training by default. Opt out at Admin Console -> Privacy Settings BEFORE sending any prompts."
- Document: "Only one Mistral key needed per account -- up to 10 keys all share the same limits"
- Document: "Mistral uses per-second rate limiting (1 RPS) which PennyLLM handles reactively via 429 detection"
- Document: "1B tokens/month is extremely generous -- you are unlikely to hit this limit on free tier"
- Note that Mistral's rate limits are behind authentication and not publicly documented; numbers are community-reported

**Severity:** (b) CRITICAL docs for data privacy opt-out, (a) RPS gap but reactive handles it, (c) per-second window type deferred to v2, (c) pool system and 5-minute sliding window deferred to v2

**Confidence:** LOW for rate limit numbers (not publicly documented, community-reported). HIGH for data privacy concern (documented by Mistral).

---

### 7. GitHub Models (Dropped)

Dropped from PennyLLM registry during Phase 12 execution. Registry comment in `src/providers/registry.ts`: "GitHub Models dropped -- doesn't offer meaningful free-tier value." Despite providing free access to closed frontier models (o3, o4-mini, GPT-4o), the 50 RPD for high-tier models and 8K input / 4K output token-per-request caps were too restrictive for practical routing.

Notes preserved in `docs/providers/notes/github-models.md` for reference. No gap analysis performed -- provider is not in the active registry.

## Cross-Cutting Gaps

### Per-Model Limits (Google, Groq, SambaNova)

PennyLLM models limits at the per-key level via `providerConfigSchema.limits`, but three providers enforce per-model limits within each key/account.

**How it manifests:**

- A key exhausted for Model A (e.g., Groq's `llama-3.3-70b`: 1,000 RPD) might still have quota for Model B (e.g., Groq's `llama-3.1-8b`: 14,400 RPD)
- PennyLLM's `CooldownManager` cools down the key after 429, regardless of which model caused it
- The chain executor skips the entire provider after all keys are cooled down
- The chain would come back to the provider with a different model (if one exists later in the chain), but the cooldown timer must expire first

**Impact:** Suboptimal utilization. Reactive approach still produces correct routing (no errors reach the user), but quota is underutilized. The wasted capacity is proportional to the difference between per-model limits within a provider.

**Recommendation:** Document as known limitation. Phase 14 could add per-model cooldown tracking -- track which model caused the 429, not just which key/provider. Users can partially work around this by placing multiple models from the same provider at different positions in their chain.

### Account-Level Limits (Cerebras, Groq, Mistral)

Three providers have account/organization-level limits where multiple keys share the same quota pool:

- **Cerebras:** Account-level. 30 RPM / 60K TPM / 1M TPD shared across all keys.
- **Groq:** Organization-level, per-model. All keys within one org share per-model quotas.
- **Mistral:** Organization-level. 1 RPS / 50K TPM / 1B tokens/month shared across up to 10 keys.

Two more providers are likely account-level but not confirmed:

- **SambaNova:** Likely per-account (not documented).
- **NVIDIA NIM:** Likely per-developer-account (not documented).

**Impact:** Wasted configuration. Users might add multiple keys expecting quota multiplication (as works with Google's multi-project setup). They get zero benefit and more complex configuration.

**Recommendation:** Document clearly which providers benefit from key rotation vs don't:

- **YES (different projects):** Google AI Studio
- **NO (account-level):** Cerebras, Groq, Mistral
- **UNKNOWN (likely no):** SambaNova, NVIDIA NIM

### Per-Second Rate Limits (Mistral)

PennyLLM's `timeWindowSchema` in `schema.ts` supports: `'per-minute'`, `'hourly'`, `'daily'`, `'monthly'`, `'rolling-30d'` -- but NOT `'per-second'`.

Mistral enforces 1 RPS (request per second), which cannot be pre-modeled in PennyLLM's limit configuration.

**Impact:** LOW -- reactive 429 handling catches the actual 1 RPS limit. Users cannot pre-configure Mistral's per-second constraint, but the reactive design makes pre-configuration unnecessary. A conservative `per-minute` approximation (~2 RPM) can serve as a documentation workaround.

**Recommendation:** Add `'per-second'` to `timeWindowSchema` enum and a corresponding entry to the `DURATIONS` map in a v1 patch (low-effort change, likely < 10 lines). This enables accurate Mistral limit pre-configuration for users who want it.

### Unpublished/Unverified Limits (NVIDIA NIM, Mistral)

Two providers lack publicly documented rate limits:

- **NVIDIA NIM:** Explicitly refuses to publish per-model limits. ~40 RPM is community-reported.
- **Mistral:** Rate limits are behind authentication (`admin.mistral.ai/plateforme/limits`). Numbers are community-reported.

**Impact:** Cannot pre-configure limits with confidence for these providers. PennyLLM's reactive approach is the correct strategy -- no stale pre-configured defaults to maintain.

**Recommendation:** Flag as "reactive-only" in documentation. Do NOT ship default limit policies for NVIDIA or Mistral. Users who discover their actual limits can optionally configure them via `providerConfigSchema.limits`.

### Missing Rate Limit Headers (NVIDIA NIM potentially)

If a provider doesn't return `Retry-After` or `x-ratelimit-reset-*` headers, PennyLLM falls back to the default cooldown (`cooldownSchema.defaultDurationMs` = 60,000ms) with exponential backoff (doubling on each consecutive failure, capped at 15 minutes by `MAX_COOLDOWN_MS` in `cooldown.ts`).

NVIDIA does NOT document any rate limit response headers. LiteLLM maps `x-ratelimit-limit-requests` and `x-ratelimit-limit-tokens` but this is unconfirmed.

**Impact:** Potentially conservative cooldown (waiting 60s when the actual retry window might be 5s). Exponential backoff compounds: 60s -> 120s -> 240s -> ... up to 15 minutes.

**Recommendation:** Document this behavior. Suggest that users in non-geo-restricted regions test with `curl -v` to discover actual NVIDIA headers. If headers are confirmed absent, consider reducing the default cooldown for NVIDIA specifically (would require per-provider cooldown defaults, a small code change).

## Priority Matrix

### P0 -- Must document before release

| Item | Provider  | Description                                                                                                                                                         |
| ---- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0-1 | SambaNova | Document developer tier recommendation: link a payment card ($0 balance) for 600x more quota (20 RPD -> 12,000+ RPD). Free tier is practically unusable.            |
| P0-2 | Mistral   | Document data privacy opt-out: free tier may train on your data by default. Opt out in Admin Console -> Privacy Settings BEFORE sending prompts.                    |
| P0-3 | All       | Document key rotation value per provider: Google YES (via separate projects, up to 10x), all others NO (account/org-level limits).                                  |
| P0-4 | Google    | Document multi-project key setup: create separate Google Cloud projects, each generates a key with independent quota. Up to 10 projects per account.                |
| P0-5 | NVIDIA    | Document reactive-only behavior: NVIDIA limits are unpublished and vary by model. PennyLLM adapts automatically via 429 detection. No pre-configured limits needed. |

### P1 -- v1 patch candidates (low effort)

| Item | Provider                | Description                                                                                                                                                                                                                 | Estimated Effort |
| ---- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| P1-1 | Mistral                 | Add `'per-second'` to `timeWindowSchema` enum in `src/config/schema.ts` and corresponding duration entry (1000ms) in `DURATIONS` map                                                                                        | ~10 lines        |
| P1-2 | Cerebras, Groq, Mistral | Config validation warning if >1 key detected for a provider with account-level limits. Log via debug namespace: "Multiple keys configured for {provider} but limits are per-account -- additional keys provide no benefit." | ~20 lines        |

### P2 -- Phase 13+ deferred

| Item | Provider                | Description                                                                                                                                                  | Target Phase |
| ---- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------ |
| P2-1 | Google, Groq, SambaNova | Per-model cooldown tracking: 429 for specific model cools down that model, not the whole provider/key. Reduces wasted requests.                              | Phase 14     |
| P2-2 | NVIDIA, SambaNova       | Credit balance tracking and depletion detection. SambaNova $5 signup credit has 30-day expiry. NVIDIA 402 is handled but credit estimation would improve UX. | Phase 13     |
| P2-3 | Mistral                 | Pool-based shared quota modeling: models in the same pool share token quotas. Requires confirming pool groupings empirically.                                | Phase 14+    |
| P2-4 | Mistral                 | 5-minute sliding window support for large models. Requires configurable window duration beyond the fixed `per-minute` type.                                  | Phase 14+    |

## Phase 13+ Input

### Credit-Based Limits (Phase 13)

From this analysis, Phase 13 should address:

1. **SambaNova $5 signup credit** -- 30-day expiry. PennyLLM currently handles 402 as permanent session cooldown (correct safety net). Phase 13 could add credit balance estimation: track usage, estimate remaining credit, warn before exhaustion.

2. **NVIDIA NIM credit legacy** -- NVIDIA says credits are discontinued, but 402 may still fire for legacy accounts. PennyLLM's permanent cooldown on 402 is already correct. Phase 13 could add a `createCreditLimit()` builder for providers with credit-based billing if any new providers adopt this model.

3. **createCreditLimit() builder** -- A new limit type for credit-based providers, tracking consumption against a known credit balance rather than rate windows.

### Health Scoring (Phase 14)

From this analysis, Phase 14 should consider:

1. **Per-model cooldown tracking** -- Track which specific model caused each 429, not just which key/provider. This would allow Google, Groq, and SambaNova keys to remain available for models that haven't hit their per-model limit. Biggest impact for Groq where per-model limits vary 14x (1,000 RPD vs 14,400 RPD).

2. **Provider recovery detection** -- Detect when cooldown expires and proactively re-enable the provider, rather than waiting for the next chain traversal to discover availability.

3. **Suboptimal utilization metrics** -- Track wasted requests due to per-model vs per-key mismatch. Surface as observability data: "Provider X had Y wasted requests due to per-model limit mismatch this session." Helps users decide whether to restructure their chain.

## Appendix: Code References

| Component            | File                              | Relevant Function/Schema                                                                            |
| -------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------- |
| Time window types    | `src/config/schema.ts`            | `timeWindowSchema` -- per-minute, hourly, daily, monthly, rolling-30d (no per-second)               |
| Error classification | `src/wrapper/error-classifier.ts` | `classifyError()` -- 429 rate limit, 402 credit exhaustion, 401/403 auth                            |
| Retry-After parsing  | `src/wrapper/error-classifier.ts` | `parseRetryAfter()` -- delta-seconds and HTTP-date formats                                          |
| Rate limit reset     | `src/wrapper/error-classifier.ts` | `parseRateLimitReset()` -- x-ratelimit-reset-requests (Groq, SambaNova), x-ratelimit-reset (Google) |
| Cooldown management  | `src/usage/cooldown.ts`           | `CooldownManager` -- per-key and provider-level cooldowns with exponential backoff                  |
| Provider registry    | `src/providers/registry.ts`       | 6 active providers: cerebras, google, groq, sambanova, nvidia-nim, mistral                          |
| Provider config      | `src/config/schema.ts`            | `providerConfigSchema` -- keys, limits, tier, credits, models                                       |
