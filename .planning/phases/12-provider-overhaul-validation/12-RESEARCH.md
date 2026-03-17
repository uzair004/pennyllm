# Phase 12: Provider Overhaul & Validation - Research

**Researched:** 2026-03-17
**Domain:** AI SDK provider integration, reactive rate-limit handling, model chain routing
**Confidence:** MEDIUM-HIGH

## Summary

Phase 12 is a major refactor of PennyLLM's routing architecture: replacing the catalog-based FallbackResolver with a user-configured model priority chain, wiring up 7 target providers (4 official AI SDK, 3 via adapters), and implementing reactive 429/402-driven cooldowns. The codebase has solid foundations -- LanguageModelV3 proxy pattern, error classification, cooldown management, and retry proxy all exist and need extension rather than rewrite.

The primary technical risks are: (1) 429 response format inconsistencies across providers -- Groq, Google, and SambaNova have well-documented rate limit headers while Cerebras and NVIDIA NIM have sparse documentation, (2) the OpenAI-compatible adapter approach for GitHub Models, SambaNova, and NVIDIA NIM needs real-world validation, and (3) the chain executor is a significant new component that replaces ~790 lines of FallbackProxy + FallbackResolver code.

**Primary recommendation:** Build the chain executor as a new component rather than refactoring FallbackProxy in-place. The routing logic is fundamentally different (deterministic chain walk vs. catalog query + affinity cache), so a clean implementation will be cleaner than incremental mutation.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Two config paths**: auto-generated chain (zero-config) OR explicit top-level `models` array (full control)
- **Auto chain**: package ships curated model registry per provider (top 3-5 models each, quality-tiered). When `models` array is omitted, auto-generates chain ranked by quality tier, interleaved by provider priority
- **Explicit chain**: top-level `models: [...]` defines exact routing order, overrides auto-generation completely
- **Provider priority**: `priority` number on each provider config (lower = tried first)
- **Per-provider model list**: optional `models` array on provider config (allowlist when explicit chain present)
- **Chain interleaving**: round-robin by provider priority, then by model order within each provider
- **Free-only unless budget > $0**: auto chain includes only free-tier models by default
- **Unknown models allowed**: warn at startup, runtime 404 -> skip + warn
- **Always log chain at startup**: full chain with model names, tiers, free/paid status
- **Start from top every request**: walk chain from position 1, check cooldown/availability BEFORE attempting API call
- **Per-key cooldown**: each key = independent account/project with independent limits
- **Retry proxy rotates keys first**: on 429, try all keys for provider before advancing chain
- **Per-provider escalating backoff**: exponential backoff with 15-minute cap, reset on success
- **Same-account key detection**: best-effort warning if two keys get 429'd simultaneously
- **Stale model handling**: 404 -> skip for session + warn (not persisted)
- **Chain is immutable for session**: built at createRouter(), can't be modified at runtime
- **router.chat()**: returns LanguageModelV3 proxy walking chain. Optional `{ capabilities, provider, tier }` filters
- **router.model('provider/model')**: bypasses chain, throws on exhaustion (no fallback)
- **router.getStatus()**: current state of all chain entries
- **Response metadata**: `result.providerMetadata.pennyllm` with resolvedModel, chainPosition, fallbackUsed, attempts[]
- **`chain:resolved` event**: fires on every request
- **Streaming**: doStream() call retryable, mid-stream errors NOT retryable
- **DELETE FallbackResolver, AffinityCache**: replaced by chain
- **REFACTOR FallbackProxy -> ChainExecutor**: keep error-catching pattern, rewrite to walk chain
- **DROP strictModel, modelMappings, fallback config section**: chain covers all
- **KEEP ModelCatalog for enrichment only**: pricing, context window, capabilities for debug
- **Budget gating inline in chain executor**: skip paid models when budget exhausted
- **Provider tier field**: 'free' | 'trial' | 'paid' on provider config
- **Credits field for trial providers**: e.g., nvidia: { tier: 'trial', credits: 1000 }
- **Reactive cooldown**: extend ClassifiedError with cooldownMs + cooldownClass. SHORT (<2min), LONG (>2min), PERMANENT (402)
- **Extend CooldownManager**: provider-level tracking alongside per-key
- **Cooldown persists to storage**: survives restarts via StorageBackend
- **Default cooldown when no retry-after**: use existing cooldown.defaultDurationMs
- **UsageTracker records 429 events**: rateLimitHits, lastRateLimited, cooldownsTriggered, totalCooldownMs
- **Per-provider TypeScript modules**: same pattern for all 7 providers
- **Staleness warning at 30 days**: emit provider:stale if lastVerified > 30 days
- **All optional peer dependencies**: lazy load configured providers only
- **Clear error on missing SDK**: ConfigError with install instructions
- **OpenAI-compat adapters**: research-first approach for GitHub, SambaNova, NVIDIA
- **E2E test**: manual script with real keys, NOT in CI, target 4+ providers
- **AllProvidersExhaustedError**: rich error with models tried, reasons, cooldown times, suggestions

### Claude's Discretion

- Exact ChainExecutor implementation architecture (how it composes with retry proxy)
- Auto-chain generation algorithm details (exact interleaving logic)
- CooldownManager storage key patterns for persistence
- router.getStatus() response shape details
- E2E test script structure and output format
- Exact TypeScript types for the curated model registry
- How to handle ProviderRegistry refactoring (existing class vs replacement)

### Deferred Ideas (OUT OF SCOPE)

- Credit depletion tracking (Phase 13)
- Circuit breaker pattern (Phase 14)
- CLI validator (Phase 15)
- Runtime chain modification (v2)
- Per-request model preferences beyond filters (v2)
- Configurable cooldown scope per provider (v2)
  </user_constraints>

<phase_requirements>

## Phase Requirements

| ID        | Description                                                                                    | Research Support                                                                                                                                                                                                    |
| --------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CORE-03   | Router automatically selects the best available key for each request based on usage and limits | Chain executor walks model priority chain, retry proxy rotates keys per provider, cooldown checks before attempting -- all research findings on provider rate limit headers support correct cooldown classification |
| POLICY-06 | Package warns when shipped policy data is older than 30 days (staleness detection)             | Per-provider module `lastVerified` date + staleness check at startup emitting `provider:stale` event. Already implemented in policy engine, extends to provider registry modules                                    |

</phase_requirements>

## Standard Stack

### Core

| Library                     | Version | Purpose                            | Why Standard                                     |
| --------------------------- | ------- | ---------------------------------- | ------------------------------------------------ |
| `@ai-sdk/cerebras`          | ^2.0.x  | Cerebras provider                  | Official first-party AI SDK provider             |
| `@ai-sdk/groq`              | ^3.0.x  | Groq provider                      | Official first-party AI SDK provider             |
| `@ai-sdk/mistral`           | ^2.0.x  | Mistral provider                   | Official first-party AI SDK provider             |
| `@ai-sdk/google`            | ^3.0.x  | Google AI Studio provider          | Already installed, official first-party          |
| `@ai-sdk/openai-compatible` | latest  | GitHub Models, NVIDIA NIM adapters | Official AI SDK package for OpenAI-compat APIs   |
| `sambanova-ai-provider`     | latest  | SambaNova provider                 | Official community provider listed on ai-sdk.dev |
| `ai`                        | ^6.0.0  | Vercel AI SDK core                 | Already a peer dependency                        |
| `@ai-sdk/provider`          | ^3.0.0  | LanguageModelV3 types              | Already a dependency                             |

### Supporting

| Library | Version | Purpose                  | When to Use                                     |
| ------- | ------- | ------------------------ | ----------------------------------------------- |
| `debug` | ^4.3.0  | Debug logging            | Already installed, use for chain/provider debug |
| `zod`   | ^3.23.0 | Config schema validation | Already installed, extend for new config fields |

### Alternatives Considered

| Instead of                             | Could Use                     | Tradeoff                                                                                                           |
| -------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `sambanova-ai-provider`                | `@ai-sdk/openai-compatible`   | Community provider has SambaNova-specific features (vision, tool calling); generic compat adapter may miss nuances |
| `@ai-sdk/openai-compatible` for NVIDIA | `@ai-sdk/openai` with baseURL | `openai-compatible` is lighter-weight and purpose-built for this use case                                          |

**Installation:**

```bash
# New peer dependencies (all optional)
npm install @ai-sdk/cerebras @ai-sdk/groq @ai-sdk/mistral @ai-sdk/openai-compatible sambanova-ai-provider
```

**package.json peerDependencies additions:**

```json
{
  "@ai-sdk/cerebras": "^2.0.0",
  "@ai-sdk/groq": "^3.0.0",
  "@ai-sdk/mistral": "^2.0.0",
  "@ai-sdk/openai-compatible": "^1.0.0",
  "sambanova-ai-provider": "^0.1.0"
}
```

All marked optional in `peerDependenciesMeta`.

## Architecture Patterns

### Recommended Project Structure

```
src/
├── providers/                   # NEW: per-provider modules
│   ├── types.ts                 # Shared types for provider modules
│   ├── cerebras.ts              # Cerebras models, adapter factory
│   ├── google.ts                # Google AI Studio models, adapter factory
│   ├── groq.ts                  # Groq models, adapter factory
│   ├── github-models.ts         # GitHub Models, OpenAI-compat adapter
│   ├── sambanova.ts             # SambaNova, community provider
│   ├── nvidia-nim.ts            # NVIDIA NIM, OpenAI-compat adapter
│   ├── mistral.ts               # Mistral, adapter factory
│   └── registry.ts              # NEW: curated model registry + auto-chain builder
├── chain/                       # NEW: replaces fallback/
│   ├── ChainExecutor.ts         # Replaces FallbackProxy — walks model chain
│   ├── chain-builder.ts         # Builds chain from config (auto or explicit)
│   ├── types.ts                 # ChainEntry, ChainStatus, etc.
│   └── index.ts
├── wrapper/
│   ├── error-classifier.ts      # EXTEND: add cooldownMs, cooldownClass
│   ├── retry-proxy.ts           # KEEP: key rotation per provider
│   ├── provider-registry.ts     # REFACTOR: use per-provider module factories
│   ├── middleware.ts             # KEEP: usage tracking
│   └── index.ts
├── usage/
│   ├── cooldown.ts              # EXTEND: provider-level tracking + persistence
│   └── ...
├── config/
│   ├── schema.ts                # EXTEND: models[], provider priority/tier/credits
│   ├── index.ts                 # REFACTOR: chain building, new provider loading
│   └── ...
├── fallback/                    # DELETE: FallbackResolver.ts, AffinityCache.ts
│   └── (removed)
└── ...
```

### Pattern 1: Per-Provider Module

**What:** Each provider gets a self-contained module exporting models, factory, and metadata
**When to use:** For all 7 providers — uniform pattern regardless of SDK type

```typescript
// src/providers/cerebras.ts
import type { ProviderModule } from './types.js';

export const cerebrasProvider: ProviderModule = {
  id: 'cerebras',
  name: 'Cerebras',
  sdkPackage: '@ai-sdk/cerebras',
  envVar: 'CEREBRAS_API_KEY',
  lastVerified: '2026-03-15',
  updateUrl: 'https://inference-docs.cerebras.ai/support/rate-limits',
  tier: 'free',

  models: [
    {
      id: 'cerebras/llama-4-maverick',
      apiId: 'llama-4-maverick',
      qualityTier: 'frontier',
      free: true,
      capabilities: { toolCall: true, reasoning: false, vision: false, structuredOutput: true },
    },
    // ...more models
  ] as const,

  async createFactory(apiKey: string) {
    const { createCerebras } = await import('@ai-sdk/cerebras');
    const provider = createCerebras({ apiKey });
    return (modelId: string) => provider(modelId);
  },
};
```

### Pattern 2: ChainExecutor (replaces FallbackProxy)

**What:** Walks the model chain sequentially, checking cooldowns before calling, delegating key rotation to existing RetryProxy
**When to use:** On every `router.chat()` call

```typescript
// Simplified pattern
async function executeChain(
  chain: ChainEntry[],
  callFn: (model: LanguageModelV3) => PromiseLike<unknown>,
  cooldownManager: CooldownManager,
  budgetTracker: BudgetTracker,
): Promise<ChainResult> {
  const attempts: ChainAttempt[] = [];

  for (let i = 0; i < chain.length; i++) {
    const entry = chain[i];

    // Skip if provider is in cooldown (all keys exhausted)
    if (cooldownManager.isProviderInCooldown(entry.provider)) continue;

    // Skip paid models if budget exhausted
    if (!entry.free && (await budgetTracker.isExceeded())) continue;

    // Skip stale models (404'd this session)
    if (entry.stale) continue;

    try {
      // RetryProxy handles key rotation within this provider
      const result = await callFn(entry.retryProxy);
      return { result, chainPosition: i, entry, attempts };
    } catch (error) {
      // Classify and record
      const classified = classifyError(error);
      attempts.push({ entry, error: classified, position: i });

      // If all keys exhausted for this provider, set provider-level cooldown
      if (isAllKeysExhausted(error)) {
        cooldownManager.setProviderCooldown(entry.provider, classified);
      }

      // 404 -> mark model as stale for session
      if (classified.statusCode === 404) {
        entry.stale = true;
      }
    }
  }

  throw new AllProvidersExhaustedError(/* rich error with all attempts */);
}
```

### Pattern 3: OpenAI-Compatible Adapter

**What:** Use `@ai-sdk/openai-compatible` for providers without official AI SDK packages
**When to use:** GitHub Models, NVIDIA NIM

```typescript
// src/providers/github-models.ts
async createFactory(apiKey: string) {
  const { createOpenAICompatible } = await import('@ai-sdk/openai-compatible');
  const provider = createOpenAICompatible({
    name: 'github-models',
    baseURL: 'https://models.inference.ai.azure.com',
    apiKey,
  });
  return (modelId: string) => provider.chatModel(modelId);
}

// src/providers/nvidia-nim.ts
async createFactory(apiKey: string) {
  const { createOpenAICompatible } = await import('@ai-sdk/openai-compatible');
  const provider = createOpenAICompatible({
    name: 'nvidia-nim',
    baseURL: 'https://integrate.api.nvidia.com/v1',
    apiKey,
  });
  return (modelId: string) => provider.chatModel(modelId);
}
```

### Pattern 4: SambaNova Community Provider

**What:** Use the official community provider `sambanova-ai-provider`
**When to use:** SambaNova only

```typescript
// src/providers/sambanova.ts
async createFactory(apiKey: string) {
  const { createSambaNova } = await import('sambanova-ai-provider');
  const provider = createSambaNova({ apiKey });
  return (modelId: string) => provider(modelId);
}
```

### Anti-Patterns to Avoid

- **DO NOT use `@ai-sdk/openai` with baseURL for compat adapters** -- `@ai-sdk/openai-compatible` is purpose-built and lighter weight
- **DO NOT query ModelCatalog for routing decisions** -- chain is the sole routing authority. Catalog is for enrichment (pricing, context window) only
- **DO NOT persist stale model state** -- 404 marks are session-only, fresh start on restart
- **DO NOT track per-model limits internally** -- reactive only. Provider says 429, we back off. No pre-emptive limit checking for routing.

## Don't Hand-Roll

| Problem                        | Don't Build                   | Use Instead                                                  | Why                                                        |
| ------------------------------ | ----------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------- |
| OpenAI-compatible API adapters | Custom fetch wrapper          | `@ai-sdk/openai-compatible`                                  | Handles streaming, SSE parsing, error mapping correctly    |
| SambaNova integration          | Generic OpenAI compat wrapper | `sambanova-ai-provider`                                      | Community provider handles SambaNova-specific quirks       |
| Retry-After header parsing     | Custom parser                 | Extend existing `CooldownManager.setCooldown()`              | Already handles seconds and HTTP-date formats              |
| LanguageModelV3 proxy          | Raw Proxy object              | Object literal with specificationVersion/doGenerate/doStream | Established pattern in codebase, AI SDK expects this shape |
| Config validation              | Manual checks                 | Extend existing Zod schema                                   | Already handles complex validation with .strict().refine() |

**Key insight:** The codebase already has robust infrastructure for proxying, error classification, cooldowns, and config validation. Phase 12 is about extending these, not building from scratch.

## Common Pitfalls

### Pitfall 1: Assuming retry-after is always present

**What goes wrong:** Code assumes 429 always includes retry-after header, crashes on null access
**Why it happens:** Groq documents retry-after but Cerebras and NVIDIA NIM documentation does not confirm it
**How to avoid:** Always fall back to `cooldown.defaultDurationMs` when header is missing. The existing `CooldownManager.setCooldown()` already handles this correctly.
**Warning signs:** NullPointerException on header access in error classifier

### Pitfall 2: Provider-level vs key-level cooldown confusion

**What goes wrong:** Setting provider-level cooldown when only one key is rate-limited, blocking other keys unnecessarily
**Why it happens:** Not distinguishing "this key hit 429" from "ALL keys for this provider are exhausted"
**How to avoid:** Provider-level cooldown ONLY triggers when RetryProxy exhausts all keys and still fails. Individual key cooldowns are per-key as today.
**Warning signs:** Provider marked as unavailable when some keys still have quota

### Pitfall 3: `exactOptionalPropertyTypes` bites on new types

**What goes wrong:** `Type 'X | undefined' is not assignable to type 'X'` when building objects with optional fields
**Why it happens:** TypeScript strict mode requires conditional property inclusion, not `field: value || undefined`
**How to avoid:** Use the established pattern: `const obj: Type = { required }; if (optional !== undefined) obj.field = optional;`
**Warning signs:** `tsc --noEmit` errors on new type definitions

### Pitfall 4: Dynamic import failure messaging

**What goes wrong:** Cryptic error when user configures a provider but hasn't installed its SDK
**Why it happens:** Dynamic `import()` throws generic MODULE_NOT_FOUND
**How to avoid:** Wrap in try/catch, throw `ConfigError("Install @ai-sdk/cerebras to use cerebras provider")` with explicit install command
**Warning signs:** Users see `ERR_MODULE_NOT_FOUND` instead of actionable guidance

### Pitfall 5: Chain position tracking across retries

**What goes wrong:** Chain position reports wrong value because retry proxy internally rotates keys
**Why it happens:** RetryProxy is opaque to ChainExecutor -- it handles its own retries
**How to avoid:** Chain position is the index in the chain array, NOT the total number of API calls. RetryProxy retries are transparent to the chain.
**Warning signs:** chainPosition jumps unexpectedly in metadata

### Pitfall 6: Google AI Studio model IDs vs provider model IDs

**What goes wrong:** Using wrong model ID format -- `models/gemini-2.5-flash` vs `gemini-2.5-flash`
**Why it happens:** Google documentation uses `models/` prefix but `@ai-sdk/google` expects bare names
**How to avoid:** Curated registry stores the correct `apiId` per model, adapter factory uses `apiId` not user-facing `id`
**Warning signs:** 404 errors from Google API

### Pitfall 7: NVIDIA NIM 402 vs 429 distinction

**What goes wrong:** Treating credit exhaustion (402) as temporary rate limit, retrying forever
**Why it happens:** NVIDIA returns 402 when credits are spent -- this is permanent, not a rate limit
**How to avoid:** `classifyError()` must distinguish 402 as `cooldownClass: 'permanent'`. Provider is removed from chain for session.
**Warning signs:** Infinite retry loop against NVIDIA after credits exhausted

### Pitfall 8: GitHub Models per-request token limits

**What goes wrong:** Sending large prompts (>8K tokens input) to high-tier GitHub Models, getting rejection
**Why it happens:** GitHub Models has unique per-request token caps (8K in / 4K out for o3/GPT-4o)
**How to avoid:** Document this limitation. Phase 12 scope does NOT include per-request token cap enforcement (too complex). The 429/error will be handled reactively.
**Warning signs:** Consistent failures on long prompts to GitHub Models

## 429/402 Response Format Research

### Provider Response Format Matrix

| Provider             | 429 Status               | retry-after Header                                                  | x-ratelimit-\* Headers                                                                                                | 402 for Credits                        | Confidence |
| -------------------- | ------------------------ | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ---------- |
| **Cerebras**         | Yes                      | NOT confirmed in docs                                               | `x-ratelimit-limit-requests-day`, `x-ratelimit-limit-tokens-minute`, `x-ratelimit-remaining-*`, `x-ratelimit-reset-*` | N/A (perpetual free)                   | MEDIUM     |
| **Google AI Studio** | Yes (RESOURCE_EXHAUSTED) | Not standard -- uses JSON body `error.status: "RESOURCE_EXHAUSTED"` | `x-ratelimit-limit`, `x-ratelimit-remaining`, `x-ratelimit-reset`                                                     | N/A (perpetual free)                   | MEDIUM     |
| **Groq**             | Yes                      | Yes (seconds) -- ONLY on 429                                        | `x-ratelimit-limit-requests`, `x-ratelimit-limit-tokens`, `x-ratelimit-remaining-*`, `x-ratelimit-reset-*`            | N/A (perpetual free)                   | HIGH       |
| **GitHub Models**    | Yes                      | Yes (seconds)                                                       | `x-ratelimit-type: UserByModelByDay`                                                                                  | Possible (pay-as-you-go)               | MEDIUM     |
| **SambaNova**        | Yes                      | NOT confirmed                                                       | `x-ratelimit-limit-requests`, `x-ratelimit-remaining-requests`, `x-ratelimit-reset-requests`, plus `-day` variants    | N/A (perpetual free/dev tier)          | MEDIUM     |
| **NVIDIA NIM**       | Yes                      | NOT confirmed                                                       | Sparse documentation                                                                                                  | **Yes -- 402 "Cloud credits expired"** | MEDIUM     |
| **Mistral**          | Yes                      | Yes (seconds) -- widely reported                                    | Poorly documented (behind auth wall)                                                                                  | N/A (1B monthly tokens)                | LOW        |

### Critical Finding: Google uses JSON body, not headers

Google Gemini returns 429 with `error.status: "RESOURCE_EXHAUSTED"` in the JSON body. The AI SDK's `APICallError` should surface this as a 429 status code, but the retry-after duration is NOT in a standard header -- it may need to be inferred from `x-ratelimit-reset` headers.

### Critical Finding: NVIDIA NIM uses 402 for credit exhaustion

NVIDIA NIM returns **HTTP 402** with message "Cloud credits expired" when free credits are depleted. This is the primary 402 use case across all 7 providers. The error classifier MUST treat 402 as `cooldownClass: 'permanent'`.

### Recommendation: Defensive parsing strategy

```
1. Check retry-after header (seconds or HTTP-date) -- use if present
2. Check x-ratelimit-reset-* headers -- compute duration if present
3. Fall back to cooldown.defaultDurationMs (60s default)
4. Apply escalating backoff multiplier on top
5. Cap at 15 minutes
```

This handles all 7 providers regardless of which headers they send.

## Code Examples

### Extended ClassifiedError with cooldown info

```typescript
// Extending existing error-classifier.ts
export type CooldownClass = 'short' | 'long' | 'permanent';

export interface ClassifiedError {
  type: ErrorType;
  statusCode?: number;
  retryAfter?: string;
  message: string;
  original: unknown;
  retryable: boolean;
  // NEW fields
  cooldownMs?: number; // Parsed duration in ms
  cooldownClass?: CooldownClass;
}

// In classifyError():
if (statusCode === 429) {
  const retryAfter = error.responseHeaders?.['retry-after'];
  const cooldownMs = parseRetryAfter(retryAfter) ?? defaultCooldownMs;
  const cooldownClass: CooldownClass = cooldownMs < 120_000 ? 'short' : 'long';
  // ...
}

if (statusCode === 402) {
  return {
    type: 'rate_limit', // or new 'credits_exhausted' type
    statusCode: 402,
    cooldownMs: Infinity,
    cooldownClass: 'permanent',
    // ...
  };
}
```

### Provider Module Type

```typescript
// src/providers/types.ts
import type { QualityTierType } from '../constants/index.js';
import type { LanguageModelV3 } from '@ai-sdk/provider';

export interface ProviderModelDef {
  readonly id: string; // 'cerebras/llama-4-maverick'
  readonly apiId: string; // 'llama-4-maverick' (what the SDK expects)
  readonly qualityTier: QualityTierType;
  readonly free: boolean;
  readonly capabilities: {
    readonly toolCall: boolean;
    readonly reasoning: boolean;
    readonly vision: boolean;
    readonly structuredOutput: boolean;
  };
}

export interface ProviderModule {
  readonly id: string;
  readonly name: string;
  readonly sdkPackage: string;
  readonly envVar: string;
  readonly lastVerified: string; // ISO date
  readonly updateUrl: string;
  readonly tier: 'free' | 'trial' | 'paid';
  readonly credits?: number; // For trial tier
  readonly models: readonly ProviderModelDef[];
  createFactory(apiKey: string): Promise<(modelId: string) => LanguageModelV3>;
}
```

### Chain Entry Type

```typescript
// src/chain/types.ts
export interface ChainEntry {
  provider: string;
  modelId: string; // 'cerebras/llama-4-maverick'
  apiModelId: string; // 'llama-4-maverick'
  qualityTier: QualityTierType;
  free: boolean;
  capabilities: ProviderModelDef['capabilities'];
  retryProxy: LanguageModelV3; // Pre-built with all keys
  stale: boolean; // 404'd this session
}

export interface ChainResult {
  result: unknown;
  chainPosition: number;
  entry: ChainEntry;
  attempts: ChainAttempt[];
  fallbackUsed: boolean;
}

export type ChainStatus = {
  entries: Array<{
    provider: string;
    modelId: string;
    status: 'available' | 'cooling' | 'depleted' | 'stale';
    cooldownUntil?: string;
    cooldownClass?: CooldownClass;
  }>;
};
```

### Config Schema Extensions

```typescript
// New fields in config schema
export const providerConfigSchema = z.object({
  keys: z.array(keyConfigSchema).min(1),
  strategy: z.enum([...]).optional(),
  limits: z.array(policyLimitSchema).optional(),
  enabled: z.boolean().default(true),
  priority: z.number().int().min(0).default(100),   // NEW
  tier: z.enum(['free', 'trial', 'paid']).default('free'),  // NEW
  credits: z.number().positive().optional(),          // NEW (trial tier)
  models: z.array(z.string()).optional(),             // NEW (per-provider allowlist)
  // DROP: fallback override
});

export const configSchema = z.object({
  // ...existing fields
  models: z.array(z.string()).optional(),  // NEW: explicit model chain
  // DROP: fallback section entirely
});
```

## State of the Art

| Old Approach                            | Current Approach                | When Changed | Impact                                            |
| --------------------------------------- | ------------------------------- | ------------ | ------------------------------------------------- |
| FallbackResolver + ModelCatalog routing | User-configured model chain     | Phase 12     | Routing no longer depends on catalog freshness    |
| AffinityCache for recent successes      | Deterministic chain order       | Phase 12     | Simpler, more predictable routing                 |
| Per-key cooldown only                   | Per-key + per-provider cooldown | Phase 12     | Handles "all keys exhausted" scenarios            |
| Usage tracking gates routing            | Reactive 429-driven cooldowns   | Phase 12     | Eliminates stale tracking vs real limits mismatch |
| 12 providers (many broken)              | 7 verified providers            | Phase 12     | Focused, actually working provider set            |

**Deprecated/outdated in codebase:**

- `FallbackResolver`: replaced by chain builder
- `AffinityCache`: replaced by deterministic chain order
- `fallback` config section: replaced by `models` array + provider `priority`
- `strictModel`, `modelMappings`, `maxDepth` config: superseded by chain
- Provider IDs for dropped providers (openrouter, huggingface, cohere, cloudflare, qwen, deepseek): mark as unsupported

## Open Questions

1. **SambaNova community provider stability**
   - What we know: `sambanova-ai-provider` exists, listed on ai-sdk.dev, maintained by SambaNova org on GitHub
   - What's unclear: Version stability, API coverage, edge case handling compared to `@ai-sdk/openai-compatible`
   - Recommendation: Use `sambanova-ai-provider` as primary (official). Fall back to `@ai-sdk/openai-compatible` if E2E testing reveals issues

2. **Google RESOURCE_EXHAUSTED retry-after timing**
   - What we know: Google returns 429 with RESOURCE_EXHAUSTED status, has x-ratelimit-reset headers
   - What's unclear: Whether `APICallError.responseHeaders` from AI SDK captures Google's rate limit reset headers
   - Recommendation: Test empirically in E2E. Worst case, use default cooldown + backoff.

3. **Cerebras retry-after header presence**
   - What we know: Cerebras documents x-ratelimit-\* headers but NOT retry-after explicitly
   - What's unclear: Whether retry-after is present on 429 responses
   - Recommendation: Defensive parsing -- check retry-after first, fall back to computing from x-ratelimit-reset-\* headers, then default.

4. **GitHub Models model ID format via OpenAI-compat adapter**
   - What we know: Endpoint is `https://models.inference.ai.azure.com`, uses Azure OpenAI shape
   - What's unclear: Exact model IDs expected by the endpoint (e.g., `gpt-4o` vs `openai/gpt-4o`)
   - Recommendation: E2E testing will validate. Provider module stores `apiId` separately from display `id`.

5. **NVIDIA NIM credit balance checking**
   - What we know: 402 indicates credits exhausted. No API to check remaining credits programmatically.
   - What's unclear: Can credits be refreshed? Is there a way to detect low credit balance before 402?
   - Recommendation: Phase 12 handles 402 reactively (permanent cooldown). Credit tracking deferred to Phase 13.

## Validation Architecture

### Test Framework

| Property           | Value                                 |
| ------------------ | ------------------------------------- |
| Framework          | Vitest 2.1.8                          |
| Config file        | vitest.config implicit (package.json) |
| Quick run command  | `npx vitest run`                      |
| Full suite command | `npx vitest run`                      |

### Phase Requirements -> Test Map

| Req ID    | Behavior                                | Test Type    | Automated Command                                    | File Exists? |
| --------- | --------------------------------------- | ------------ | ---------------------------------------------------- | ------------ |
| CORE-03   | Router selects best key via chain       | e2e (manual) | `npx tsx scripts/e2e-test.ts`                        | No - Wave 0  |
| CORE-03   | Chain executor walks chain correctly    | unit         | `npx vitest run tests/chain-executor.test.ts -x`     | No - Wave 0  |
| CORE-03   | 429 triggers cooldown and chain advance | unit         | `npx vitest run tests/cooldown-classify.test.ts -x`  | No - Wave 0  |
| POLICY-06 | Provider staleness warning at 30 days   | unit         | `npx vitest run tests/provider-staleness.test.ts -x` | No - Wave 0  |

### Sampling Rate

- **Per task commit:** `npx tsc --noEmit && npx vitest run`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green + E2E with 4+ providers passing

### Wave 0 Gaps

- [ ] `scripts/e2e-test.ts` -- E2E test script for real API calls
- [ ] `tests/chain-executor.test.ts` -- chain walking logic (mock providers)
- [ ] `tests/cooldown-classify.test.ts` -- 429/402 classification with cooldownMs/cooldownClass
- [ ] `tests/provider-staleness.test.ts` -- lastVerified > 30 days triggers event

Note: Per CLAUDE.md, tests are minimal during implementation. E2E script is the primary validation. Unit tests only where they catch real bugs (error classification boundaries, chain walking logic).

## Sources

### Primary (HIGH confidence)

- [Groq Rate Limits docs](https://console.groq.com/docs/rate-limits) -- verified rate limit headers, retry-after behavior
- [SambaNova Rate Limits docs](https://docs.sambanova.ai/docs/en/models/rate-limits) -- verified x-ratelimit-\* header names
- [AI SDK Cerebras provider](https://ai-sdk.dev/providers/ai-sdk-providers/cerebras) -- factory API, model names
- [AI SDK SambaNova community provider](https://ai-sdk.dev/providers/community-providers/sambanova) -- package name, factory API
- [AI SDK OpenAI-compatible docs](https://ai-sdk.dev/providers/openai-compatible-providers) -- createOpenAICompatible API

### Secondary (MEDIUM confidence)

- [GitHub Models rate limits article](https://dev.to/devactivity/mastering-github-models-api-rate-limits-quotas-and-software-engineering-quality-4fk1) -- retry-after header, x-ratelimit-type header
- [NVIDIA NIM forums](https://forums.developer.nvidia.com/t/nvidia-nim-api-openai-api-error-code-402-cloud-credits-expired-please-contact-nvidia-representatives/316930) -- 402 credit exhaustion behavior
- [Google Gemini error handling blog](https://cloud.google.com/blog/products/ai-machine-learning/learn-how-to-handle-429-resource-exhaustion-errors-in-your-llms) -- RESOURCE_EXHAUSTED pattern

### Tertiary (LOW confidence)

- Mistral rate limit headers -- community-reported, behind auth wall, not officially documented publicly
- Cerebras retry-after header -- not confirmed in official docs, only x-ratelimit-\* headers documented
- NVIDIA NIM rate limit headers -- sparse official documentation

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH -- all packages verified on npm, versions confirmed, AI SDK docs checked
- Architecture: HIGH -- building on established codebase patterns (proxy pattern, error classification, cooldowns)
- Provider 429/402 formats: MEDIUM -- Groq and SambaNova well-documented, others need E2E validation
- Pitfalls: HIGH -- derived from existing codebase patterns and real issues hit in phases 6-11

**Research date:** 2026-03-17
**Valid until:** 2026-04-01 (provider model lists change frequently, re-verify before Phase 13)
