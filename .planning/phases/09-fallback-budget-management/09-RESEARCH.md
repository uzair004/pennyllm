# Phase 9: Fallback & Budget Management - Research

**Researched:** 2026-03-14
**Domain:** Cross-provider fallback routing, budget enforcement, capability-aware model matching
**Confidence:** HIGH

## Summary

Phase 9 introduces cross-provider fallback routing and monthly budget enforcement into the existing PennyLLM. The codebase already has all necessary building blocks: `QuotaExhaustedError` and `RateLimitError` thrown by `KeySelector`, `FallbackTriggeredEvent` type defined but never emitted, `BudgetConfig` with `monthlyLimit` and `alertThresholds` in the config schema, `DefaultModelCatalog.listModels()` with capability/quality/price filters, and `ModelMetadata` with `capabilities`, `qualityTier`, `contextWindow`, and `pricing` fields.

The primary implementation challenge is architectural: the fallback layer must sit **above** the per-provider retry proxy but **below** the AI SDK middleware wrapper. Currently, `createRouter().wrapModel()` creates a single retry proxy for one provider. Phase 9 must intercept `QuotaExhaustedError`, `RateLimitError`, and server errors from the retry proxy, find alternative providers via catalog queries, create new retry proxies for fallback providers, and chain the attempts -- all while preserving the Vercel AI SDK response contract. Budget tracking is a simpler post-call accumulator using the existing `StorageBackend` with a dedicated monthly key pattern.

**Primary recommendation:** Implement as three focused modules: `FallbackResolver` (capability matching + provider ranking), `BudgetTracker` (cost recording + threshold checking + event emission), and `FallbackProxy` (orchestration wrapper that catches errors, queries resolver, creates per-provider retry proxies, and enforces budget). Wire into `createRouter().wrapModel()` as a layer between retry-proxy and middleware.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- Default behavior: try alternatives (NOT hard-stop). Hard-stop is opt-in.
- Scope: only configured providers with keys. No discovery of unconfigured providers from catalog.
- Max fallback depth: configurable, default 3 providers.
- Same-provider keys preferred first (same model = consistent UX), then cross-provider.
- Auto-select fallback (router picks based on capability match + remaining quota). No explicit chain ordering in v1.
- Round-robin and weighted-random fallback strategies deferred to v2.
- Config validation error at startup if `cheapest-paid` behavior is configured with $0 budget.
- Server errors (500) on primary provider also trigger cross-provider fallback.
- Tiered matching: first try capability match + same quality tier, then relax to capability-only (any quality tier).
- Capabilities inferred from request params: `tools` present -> needs `toolCall`, image content -> needs `vision`. Reasoning must be explicitly requested.
- Ranking: free providers first, then cheapest paid. Within free, prefer most remaining quota.
- Context window pre-check: skip fallback models that can't fit estimated prompt size.
- Short-term affinity (~60s): cache last successful fallback to avoid repeated evaluation during burst traffic.
- Optional user-configured model equivalency mappings. Otherwise capability+tier matching.
- Configured providers only for paid fallback.
- Cost calculation: `(promptTokens x promptPrice + completionTokens x completionPrice) / 1,000,000`.
- Missing pricing guard: request goes through, cost NOT tracked, warning event fires.
- Period: calendar month, resets on 1st at 00:00 UTC.
- Enforcement: post-check only (make the call, record actual cost, then check). No pre-estimation.
- Storage: existing StorageBackend with budget-specific key pattern. MemoryStorage resets on restart; Phase 10 adds persistence.
- In-flight requests: let finish when budget cap reached. Only new paid requests rejected.
- Free calls NOT tracked in budget.
- Separate events: `budget:alert` at configurable thresholds and `budget:exceeded` when cap hit.
- Alert payload includes rate info: `{ threshold, spent, limit, remaining, avgCostPerRequest }`.
- `fallback:triggered` event emitted on every cross-provider fallback.
- Both quota exhaustion AND cooldown trigger cross-provider fallback, always.
- Immediately try fallback (no wait period for cooldown expiry).
- `provider:exhausted` event enhanced with `exhaustionType: 'cooldown' | 'quota' | 'mixed'`.
- Configurable `strictModel` option (default: false = fall back to equivalent model).
- Response metadata includes fallback info: `fallbackUsed`, `originalModel`, `actualModel`. Must NOT break AI SDK response structure.
- Fallback wraps retry: cross-provider fallback sits above the retry proxy layer.
- Rich error with recovery info when all providers exhausted.
- Retry proxy <-> fallback integration: on QuotaExhaustedError/RateLimitError from retry proxy, fallback catches and tries next provider. Each fallback provider gets its own retry proxy for its keys.

### Claude's Discretion

- Config shape for fallback section (top-level + per-provider override structure)
- Exact affinity cache implementation (TTL, data structure)
- Budget storage key pattern design
- Retry proxy <-> fallback integration architecture details
- Error class design for AllProvidersExhaustedError
- How reasoning capability is explicitly requested (config flag vs per-request option)

### Deferred Ideas (OUT OF SCOPE)

- Round-robin fallback across providers
- Weighted random fallback based on remaining quota
- Health score per provider to influence fallback ordering
- Provider recovery event (`provider:recovered`)
- Dry-run fallback preview (`router.previewFallback()`)
- Configurable per-limit-type fallback triggers
  </user_constraints>

<phase_requirements>

## Phase Requirements

| ID      | Description                                                                                                      | Research Support                                                                                                                                                                                                                                                                                             |
| ------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| CORE-04 | Router enforces hard-stop when all keys for a provider are exhausted (no request made, error thrown)             | Already partially implemented via QuotaExhaustedError/RateLimitError in KeySelector. Phase 9 adds the cross-provider fallback layer that catches these errors and either falls back or re-throws with rich AllProvidersExhaustedError when all providers exhausted. Hard-stop is opt-in per-provider config. |
| CORE-05 | User can configure fallback behavior per provider (hard stop, cheapest paid model, or alternative free provider) | New fallback config section in schema with per-provider override. FallbackResolver uses this config to determine behavior.                                                                                                                                                                                   |
| CORE-06 | User can set monthly budget cap including $0 (never spend money)                                                 | BudgetConfig already exists with `monthlyLimit: 0` default. BudgetTracker enforces post-call, stores spend via StorageBackend with monthly key pattern. $0 budget blocks all paid fallback.                                                                                                                  |
| DX-05   | Budget alerts notify via hooks when usage reaches configurable thresholds                                        | BudgetTracker emits `budget:alert` at configured thresholds (default 80%, 95%) and `budget:exceeded` on cap hit, via existing EventEmitter pattern.                                                                                                                                                          |
| CAT-06  | Fallback routing respects model capabilities (reasoning model falls back to reasoning, not generic)              | FallbackResolver queries DefaultModelCatalog.listModels() with capability filter derived from request params + explicit reasoning flag. Tiered matching ensures capability preservation.                                                                                                                     |
| CAT-07  | Fallback routing prefers cheapest matching model when budget allows paid usage                                   | FallbackResolver ranks: free providers first (most remaining quota), then cheapest paid (sorted by pricing.promptPer1MTokens). Only considers configured providers.                                                                                                                                          |

</phase_requirements>

## Standard Stack

### Core

| Library                  | Version       | Purpose                                                     | Why Standard                                               |
| ------------------------ | ------------- | ----------------------------------------------------------- | ---------------------------------------------------------- |
| zod                      | ^3.23.0       | Config schema validation for fallback section               | Already used throughout codebase for all config validation |
| debug                    | ^4.3.0        | Namespaced logging (`pennyllm:fallback`, `pennyllm:budget`) | Already used in every module                               |
| node:events EventEmitter | Node built-in | Budget and fallback event emission                          | Already the event system for the router                    |
| node:crypto randomUUID   | Node built-in | Request ID generation for fallback chains                   | Already used in createRouter                               |

### Supporting

| Library          | Version | Purpose                                        | When to Use                                                  |
| ---------------- | ------- | ---------------------------------------------- | ------------------------------------------------------------ |
| @ai-sdk/provider | ^3.0.0  | LanguageModelV3 type for fallback proxy        | Already a dependency, needed for proxy types                 |
| ai               | ^6.0.0  | wrapLanguageModel for wrapping fallback models | Already a peer dependency, needed for middleware integration |

### Alternatives Considered

| Instead of                    | Could Use          | Tradeoff                                                                                                         |
| ----------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Simple Map for affinity cache | lru-cache          | Map with manual TTL is sufficient for single-entry affinity; no new dependency needed                            |
| Custom budget storage         | Separate budget DB | StorageBackend already supports arbitrary key patterns; dedicated DB would add complexity for Phase 10 to manage |

**Installation:**
No new dependencies needed. All required libraries are already in the project.

## Architecture Patterns

### Recommended Project Structure

```
src/
  fallback/
    FallbackResolver.ts     # Capability matching + provider ranking
    FallbackProxy.ts        # Orchestration proxy wrapping retry proxies
    types.ts                # Fallback-specific types
    index.ts                # Barrel exports
  budget/
    BudgetTracker.ts        # Cost recording + threshold checking
    types.ts                # Budget event types
    index.ts                # Barrel exports
```

### Pattern 1: Layered Proxy Architecture

**What:** FallbackProxy wraps the per-provider retry proxy pattern. Each provider attempt creates its own retry proxy (reusing `createRetryProxy` from Phase 7). The fallback proxy catches terminal errors from each retry proxy and tries the next provider.

**When to use:** Every `wrapModel()` call when fallback is enabled (default).

**Architecture:**

```
User calls wrapModel("google/gemini-2.0-flash")
  -> Middleware (usage tracking via wrapLanguageModel)
    -> FallbackProxy (catches errors, tries alternatives)
      -> RetryProxy[google] (key rotation within google)
        -> google/gemini-2.0-flash API call
      [on QuotaExhaustedError/RateLimitError/ServerError]
      -> RetryProxy[groq] (key rotation within groq)
        -> groq/llama-3.3-70b API call
      [on all providers exhausted]
      -> AllProvidersExhaustedError
```

**Key insight:** The middleware layer sits OUTSIDE the fallback proxy. This means:

1. Middleware records usage for whichever provider actually succeeds
2. The `keyIndexRef` pattern must be extended to also track `providerRef` and `modelIdRef`
3. FallbackProxy updates these refs when switching providers, so middleware records against the correct provider/key

**Example:**

```typescript
// In createRouter().wrapModel():
const providerRef = { current: provider };
const modelIdRef = { current: modelId };
const keyIndexRef = { current: selection.keyIndex };

// FallbackProxy updates all three refs when switching providers
const fallbackProxy = createFallbackProxy({
  primaryProvider: provider,
  primaryModelName: modelName,
  primaryModelId: modelId,
  primaryRetryProxy: retryProxy,
  config,
  catalog,
  keySelector,
  registry,
  cooldownManager,
  disabledKeys,
  emitter,
  requestId,
  providerRef,
  modelIdRef,
  keyIndexRef,
  budgetTracker,
});

// Middleware wraps fallback proxy (sits above both retry + fallback)
const middleware = createRouterMiddleware({
  providerRef, // Extended to use ref instead of static string
  keyIndexRef,
  modelIdRef,
  tracker: usageTracker,
  requestId,
});
```

### Pattern 2: Capability-Aware Model Matching

**What:** FallbackResolver queries the catalog to find matching models across configured providers.

**When to use:** When primary provider exhausted and fallback triggered.

**Matching algorithm:**

```typescript
// Step 1: Infer required capabilities from request
function inferCapabilities(params: DoGenerateParams): Partial<ModelMetadata['capabilities']> {
  const caps: Partial<ModelMetadata['capabilities']> = {};
  if (params.tools && params.tools.length > 0) caps.toolCall = true;
  // Check for image content in messages
  if (hasImageContent(params.prompt)) caps.vision = true;
  // Reasoning must be explicitly requested (not inferred)
  return caps;
}

// Step 2: Query catalog with tiered matching
// Tier 1: capability match + same quality tier
let candidates = await catalog.listModels({
  capabilities: requiredCaps,
  qualityTier: originalModel.qualityTier,
});

// Tier 2: capability match only (any quality tier)
if (candidates.length === 0) {
  candidates = await catalog.listModels({
    capabilities: requiredCaps,
  });
}

// Step 3: Filter to configured providers only
candidates = candidates.filter(
  (m) => config.providers[m.provider] !== undefined && m.id !== originalModelId,
);

// Step 4: Context window check
if (estimatedPromptTokens) {
  candidates = candidates.filter((m) => m.contextWindow >= estimatedPromptTokens);
}

// Step 5: Rank — free first (most remaining quota), then cheapest paid
candidates.sort((a, b) => {
  const aFree = isFreeModel(a);
  const bFree = isFreeModel(b);
  if (aFree && !bFree) return -1;
  if (!aFree && bFree) return 1;
  if (aFree && bFree) return compareRemainingQuota(b, a); // more quota first
  // Both paid: cheapest first
  return (a.pricing?.promptPer1MTokens ?? Infinity) - (b.pricing?.promptPer1MTokens ?? Infinity);
});
```

### Pattern 3: Post-Call Budget Tracking

**What:** BudgetTracker records cost after each successful paid call, checks thresholds, and fires events.

**When to use:** After every successful LLM call (in middleware or post-call hook).

**Example:**

```typescript
class BudgetTracker {
  private alertsFired: Set<number> = new Set(); // thresholds already alerted

  async recordCost(
    provider: string,
    modelId: string,
    usage: { promptTokens: number; completionTokens: number },
    pricing: ModelMetadata['pricing'],
  ): Promise<void> {
    if (!pricing || (pricing.promptPer1MTokens === 0 && pricing.completionPer1MTokens === 0)) {
      return; // Free calls not tracked
    }

    const cost =
      (usage.promptTokens * pricing.promptPer1MTokens +
        usage.completionTokens * pricing.completionPer1MTokens) /
      1_000_000;

    // Increment monthly spend in storage
    await this.storage.increment(
      'budget',
      0,
      { prompt: Math.round(cost * 1_000_000), completion: 0 }, // Store as micro-dollars
      { type: 'monthly', durationMs: 30 * 24 * 60 * 60 * 1000 },
      1,
    );

    // Check thresholds
    const currentSpend = await this.getMonthlySpend();
    this.checkThresholds(currentSpend);
  }
}
```

### Pattern 4: Short-Term Affinity Cache

**What:** Cache the last successful fallback provider/model for ~60s to avoid repeated resolution during burst traffic.

**When to use:** On fallback success, store the result. On next fallback trigger, check cache first.

**Example:**

```typescript
// Simple TTL cache — no need for lru-cache
interface AffinityEntry {
  provider: string;
  modelId: string;
  timestamp: number;
}

class AffinityCache {
  private cache: Map<string, AffinityEntry> = new Map();
  private readonly ttlMs = 60_000; // 60 seconds

  // Key is the original provider + required capabilities hash
  get(key: string): AffinityEntry | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }
    return entry;
  }

  set(key: string, provider: string, modelId: string): void {
    this.cache.set(key, { provider, modelId, timestamp: Date.now() });
  }
}
```

### Pattern 5: Budget Storage Key Design

**What:** Use the existing StorageBackend with a dedicated key pattern for budget tracking.

**Design:**

```
Key pattern: budget:monthly:YYYY-MM
Value: stored as token fields (repurposed for micro-dollars to avoid new StorageBackend methods)
  - promptTokens = total micro-dollars spent (cost * 1_000_000)
  - completionTokens = 0 (unused)
  - totalTokens = total micro-dollars spent
  - callCount = number of paid calls this month
```

**Rationale:** The StorageBackend interface uses `increment()` with prompt/completion token fields and a TimeWindow. Rather than adding new methods to the interface (breaking change for Phase 10 adapters), we repurpose the existing numeric fields. The "monthly" window type with YYYY-MM period key already exists and handles calendar month resets correctly.

**Alternative considered:** A new `StorageBackend.incrementBudget()` method. Rejected because it would require MemoryStorage changes, break the StorageBackend interface contract, and complicate Phase 10 adapter implementations. The repurpose approach is self-contained.

### Pattern 6: Config Shape for Fallback Section

**Recommended schema:**

```typescript
// Top-level fallback config
const fallbackConfigSchema = z
  .object({
    enabled: z.boolean().default(true), // Global kill switch
    maxDepth: z.number().int().min(1).max(10).default(3),
    strictModel: z.boolean().default(false), // false = allow equivalent model fallback
    behavior: z.enum(['auto', 'hard-stop']).default('auto'),
    modelMappings: z.record(z.string(), z.string()).optional(), // manual equivalency
    reasoning: z.boolean().default(false), // Whether to require reasoning capability
  })
  .default({});

// Per-provider override in providerConfigSchema
const providerFallbackOverride = z
  .object({
    behavior: z.enum(['auto', 'hard-stop', 'cheapest-paid']).optional(),
  })
  .optional();
```

**Config example:**

```typescript
const config = {
  providers: {
    google: {
      keys: ['key1'],
      fallback: { behavior: 'auto' }, // Override per provider
    },
    groq: {
      keys: ['key2'],
      fallback: { behavior: 'hard-stop' }, // Hard stop for groq
    },
  },
  fallback: {
    enabled: true,
    maxDepth: 3,
    strictModel: false,
    reasoning: false,
  },
  budget: {
    monthlyLimit: 5, // $5/month
    alertThresholds: [0.8, 0.95],
  },
};
```

### Anti-Patterns to Avoid

- **Modifying AI SDK response shape:** Fallback metadata must be added to response metadata or a side channel, NOT by changing the LanguageModelV3 return type. Users expect standard AI SDK response objects.
- **Pre-estimating cost for budget enforcement:** CONTEXT.md explicitly says post-check only. Pre-estimation is inaccurate and adds latency.
- **Blocking in-flight requests on budget exceeded:** Let them finish. Only reject new paid requests.
- **Discovering unconfigured providers:** Fallback must only use providers the user has configured with API keys. Never try providers without configured keys.
- **Synchronous catalog queries during model call:** Catalog queries are async. FallbackResolver must handle this. But the catalog is already loaded at startup, so `listModels()` reads from cache (near-instant).

## Don't Hand-Roll

| Problem                    | Don't Build          | Use Instead                                              | Why                                                                     |
| -------------------------- | -------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------- |
| Calendar month reset       | Custom date math     | Existing `getPeriodKey()` with `monthly` window type     | Already handles YYYY-MM key generation and month boundaries correctly   |
| Event emission pattern     | Custom pub/sub       | Existing `EventEmitter` + `RouterEvent` constants        | Consistent with all existing events in the codebase                     |
| Config validation          | Manual field checks  | Zod schema with `.refine()` for cross-field validation   | $0 budget + cheapest-paid check needs `.refine()`, not manual code      |
| Key selection per provider | Custom key picker    | Existing `KeySelector.selectKey()`                       | Already handles strategy resolution, cooldown checks, quota evaluation  |
| Provider model creation    | Custom factory calls | Existing `createProviderInstance()` + `ProviderRegistry` | Already handles provider registration and factory pattern               |
| Retry within provider      | Custom retry loop    | Existing `createRetryProxy()`                            | Already handles key rotation, error classification, cooldown management |

**Key insight:** Phase 9 is primarily an orchestration layer. Almost all the building blocks exist. The new code coordinates them across providers rather than within a single provider.

## Common Pitfalls

### Pitfall 1: Middleware Provider Tracking

**What goes wrong:** The existing middleware hardcodes `provider` as a static string from the initial wrapModel() call. When fallback switches to a different provider, usage gets recorded against the wrong provider.
**Why it happens:** The middleware closure captures `provider` at creation time. The `keyIndexRef` pattern handles key changes within a provider, but there's no equivalent for provider changes.
**How to avoid:** Extend the ref pattern to include `providerRef` and `modelIdRef`. Modify `createRouterMiddleware` to read from refs instead of static strings. FallbackProxy updates all refs when switching providers.
**Warning signs:** Usage data shows all fallback calls charged to the original provider.

### Pitfall 2: exactOptionalPropertyTypes Gotchas

**What goes wrong:** Adding optional fields to existing interfaces or building objects with conditional properties causes type errors.
**Why it happens:** TypeScript's `exactOptionalPropertyTypes` (enabled in this project) forbids `T | undefined` assignment to `T?` fields. You cannot write `obj.field = value` when `value` might be `undefined`.
**How to avoid:** Use conditional object construction: `if (value !== undefined) { obj.field = value; }`. This pattern is used throughout the codebase (see `makeAttemptRecord`, `KeySelector.selectKey`, etc.).
**Warning signs:** Type errors like "Type 'X | undefined' is not assignable to type 'X'".

### Pitfall 3: Budget Race Conditions

**What goes wrong:** Multiple concurrent requests all check budget before recording, allowing overspend.
**Why it happens:** Post-check budget enforcement means multiple requests can pass the "is budget available" check simultaneously, then all record costs that push over the limit.
**How to avoid:** Accept minor overshoot as a design decision (per CONTEXT.md: "In-flight requests: let finish when budget cap reached"). The post-check pattern is intentional. After each call completes, check and block future paid calls if over budget. The budget is a "soft cap" by design.
**Warning signs:** Spending slightly exceeds budget limit during burst traffic. This is expected and acceptable.

### Pitfall 4: Circular Dependency Between Fallback and Retry

**What goes wrong:** FallbackProxy needs to create retry proxies for fallback providers. Retry proxy throws errors that FallbackProxy catches. If the dependency graph gets confused, you get import cycles.
**Why it happens:** Both modules live in `src/wrapper/` and reference each other's types/functions.
**How to avoid:** Keep FallbackProxy in a separate `src/fallback/` directory. It imports from `src/wrapper/retry-proxy.ts` (one-way dependency). The retry proxy never imports from fallback.
**Warning signs:** Circular import warnings at build time.

### Pitfall 5: Streaming Fallback Complexity

**What goes wrong:** Fallback during streaming is complex because the stream may have already started delivering chunks when a mid-stream error occurs.
**Why it happens:** The retry proxy only retries on setup failures (`doStream()` call), not mid-stream errors. Fallback inherits this limitation.
**How to avoid:** Fallback only applies to the initial `doGenerate()` / `doStream()` call errors, not mid-stream errors. This is consistent with the retry proxy pattern already established in Phase 7. Document this limitation.
**Warning signs:** Users expecting mid-stream provider switching. This is explicitly out of scope.

### Pitfall 6: Response Metadata Augmentation

**What goes wrong:** Attempting to modify the AI SDK response object directly breaks the response contract.
**Why it happens:** LanguageModelV3 response types are strict. Adding extra fields may cause downstream issues.
**How to avoid:** Use the `response.providerMetadata` field (or equivalent AI SDK mechanism) for fallback info. Alternatively, emit fallback metadata via events and let users correlate via `requestId`. The response object itself stays pristine.
**Warning signs:** TypeScript errors when adding fields to response objects, or downstream SDK code breaking.

## Code Examples

### Example 1: AllProvidersExhaustedError Design

```typescript
// Source: Pattern derived from existing ProviderError in src/errors/provider-error.ts
import { PennyLLMError } from './base.js';

interface ProviderAttempt {
  provider: string;
  modelId: string;
  reason: 'quota_exhausted' | 'rate_limited' | 'server_error' | 'budget_exceeded' | 'no_match';
  error?: Error;
  earliestRecovery?: string;
}

export class AllProvidersExhaustedError extends PennyLLMError {
  public readonly attempts: ProviderAttempt[];
  public readonly earliestRecovery: string | null;

  constructor(originalModelId: string, attempts: ProviderAttempt[], options?: { cause?: Error }) {
    // Find earliest recovery across all providers
    const recoveries = attempts
      .filter((a) => a.earliestRecovery !== undefined)
      .map((a) => a.earliestRecovery!);
    const earliestRecovery = recoveries.length > 0 ? recoveries.sort()[0]! : null;

    const providers = attempts.map((a) => a.provider).join(', ');
    const suggestion = earliestRecovery
      ? `All providers exhausted (${providers}). Earliest recovery: ${earliestRecovery}. Add more providers or increase budget.`
      : `All providers exhausted (${providers}). Add more providers or increase budget.`;

    super(`All providers exhausted for ${originalModelId}`, {
      code: 'ALL_PROVIDERS_EXHAUSTED',
      suggestion,
      metadata: { originalModelId, attempts, earliestRecovery },
      ...(options?.cause !== undefined ? { cause: options.cause } : {}),
    });

    this.name = 'AllProvidersExhaustedError';
    this.attempts = attempts;
    this.earliestRecovery = earliestRecovery;
  }
}
```

### Example 2: Budget Cost Calculation

```typescript
// Source: Derived from CONTEXT.md cost calculation formula
function calculateCost(
  usage: { promptTokens: number; completionTokens: number },
  pricing: { promptPer1MTokens: number; completionPer1MTokens: number },
): number {
  return (
    (usage.promptTokens * pricing.promptPer1MTokens +
      usage.completionTokens * pricing.completionPer1MTokens) /
    1_000_000
  );
}

// Example: GPT-4o-mini ($0.15 / 1M prompt, $0.60 / 1M completion)
// 1000 prompt tokens + 500 completion tokens
// Cost = (1000 * 0.15 + 500 * 0.60) / 1_000_000 = 0.00045 dollars
```

### Example 3: Reasoning Capability Request Pattern

```typescript
// Per-request option (recommended for explicit control)
const model = await router.wrapModel('google/gemini-2.5-pro', {
  reasoning: true, // Ensures fallback only to reasoning-capable models
});

// Global config option
const router = await createRouter({
  providers: {
    /* ... */
  },
  fallback: {
    reasoning: true, // All requests treated as needing reasoning
  },
});

// The resolver checks:
// 1. Per-request reasoning flag (highest priority)
// 2. Global fallback.reasoning config
// 3. Original model's capabilities.reasoning from catalog
```

### Example 4: New Event Types

```typescript
// Budget alert event
interface BudgetAlertEvent extends RouterEventPayload {
  threshold: number; // e.g., 0.8
  spent: number; // Current spend in dollars
  limit: number; // Monthly limit in dollars
  remaining: number; // Dollars remaining
  avgCostPerRequest: number;
}

// Budget exceeded event
interface BudgetExceededEvent extends RouterEventPayload {
  spent: number;
  limit: number;
  lastRequestCost: number;
}

// Enhanced provider exhausted event
interface ProviderExhaustedEvent extends RouterEventPayload {
  provider: string;
  totalKeys: number;
  exhaustedCount: number;
  cooldownCount: number;
  earliestRecovery: string | null;
  exhaustionType: 'cooldown' | 'quota' | 'mixed'; // NEW field
}
```

### Example 5: FallbackProxy doGenerate Flow

```typescript
// Simplified flow showing the key orchestration logic
async doGenerate(params) {
  const triedProviders: ProviderAttempt[] = [];

  // Check affinity cache first
  const affinityKey = buildAffinityKey(originalProvider, requiredCaps);
  const cached = affinityCache.get(affinityKey);

  // Try primary provider first (already has retry proxy)
  try {
    return await primaryRetryProxy.doGenerate(params);
  } catch (error) {
    if (!isFallbackTrigger(error)) throw error;

    triedProviders.push(buildAttempt(originalProvider, error));
    emitter.emit('provider:exhausted', { ... });
  }

  // Resolve fallback candidates
  const candidates = await fallbackResolver.resolve(originalModelId, requiredCaps, {
    configuredProviders: Object.keys(config.providers),
    excludeProviders: [originalProvider],
    budgetRemaining: await budgetTracker.getRemaining(),
    estimatedTokens,
  });

  // Try each fallback candidate up to maxDepth
  for (const candidate of candidates.slice(0, maxDepth - 1)) {
    // Budget gate: reject paid models if budget exhausted
    if (!isFreeModel(candidate) && await budgetTracker.isExceeded()) {
      triedProviders.push({ provider: candidate.provider, reason: 'budget_exceeded' });
      continue;
    }

    try {
      // Create fresh retry proxy for this fallback provider
      const fallbackRetryProxy = createRetryProxy({ /* ... */ });
      const result = await fallbackRetryProxy.doGenerate(params);

      // Success! Update refs for middleware, cache affinity, emit event
      providerRef.current = candidate.provider;
      modelIdRef.current = candidate.id;
      keyIndexRef.current = selectedKey.keyIndex;

      affinityCache.set(affinityKey, candidate.provider, candidate.id);
      emitter.emit('fallback:triggered', { fromProvider, toProvider, reason });

      return result;
    } catch (error) {
      triedProviders.push(buildAttempt(candidate.provider, error));
    }
  }

  // All providers exhausted
  throw new AllProvidersExhaustedError(originalModelId, triedProviders);
}
```

## State of the Art

| Old Approach                                  | Current Approach                       | When Changed   | Impact                                                                    |
| --------------------------------------------- | -------------------------------------- | -------------- | ------------------------------------------------------------------------- |
| Static fallback chains (provider A -> B -> C) | Capability-aware auto-selection        | Phase 9 design | Router picks the best match dynamically instead of following fixed chains |
| Hard-stop on provider exhaustion              | Default try-alternatives               | Phase 9 design | Production apps keep running by default                                   |
| Budget as config-only                         | Budget as runtime enforcement + events | Phase 9 design | Actual cost tracking and enforcement, not just configuration              |

**No deprecated patterns apply.** Phase 9 is introducing new functionality rather than replacing old approaches.

## Open Questions

1. **Middleware Provider Ref Pattern**
   - What we know: The current middleware takes a static `provider` string. We need to change it to use a ref pattern like `keyIndexRef`.
   - What's unclear: Whether this is a breaking change for users of `createRouterMiddleware` directly (unlikely, since it's typically internal to `createRouter`).
   - Recommendation: Change to ref pattern. It's an internal function. Only `createRouter` and `routerModel` use it, both within our codebase.

2. **Response Metadata for Fallback Info**
   - What we know: AI SDK LanguageModelV3 response includes `response.providerMetadata` as an optional field for provider-specific data.
   - What's unclear: The exact mechanism to inject custom metadata into the response without breaking the AI SDK contract.
   - Recommendation: Use a combination of: (a) `providerMetadata` field in the proxy response for programmatic access, and (b) `fallback:triggered` event for observability. The proxy can wrap the response to add `providerMetadata['pennyllm'] = { fallbackUsed: true, originalModel, actualModel }`.

3. **Free Model Detection**
   - What we know: Free models have `pricing: { promptPer1MTokens: 0, completionPer1MTokens: 0 }`. Models without pricing have `pricing: null`.
   - What's unclear: Should `pricing: null` (unknown pricing) be treated as free or paid for budget purposes?
   - Recommendation: Per CONTEXT.md: "if model has no pricing in catalog, request goes through, cost NOT tracked, warning event fires". So `pricing: null` = not tracked for budget, but still allowed. Treat as "unknown" (neither free nor paid for sorting purposes -- place after free but before known-paid).

## Validation Architecture

### Test Framework

| Property           | Value                               |
| ------------------ | ----------------------------------- |
| Framework          | vitest 2.1.8                        |
| Config file        | vitest.config.ts                    |
| Quick run command  | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run --coverage`         |

### Phase Requirements to Test Map

| Req ID  | Behavior                               | Test Type | Automated Command                                                                                | File Exists? |
| ------- | -------------------------------------- | --------- | ------------------------------------------------------------------------------------------------ | ------------ |
| CORE-04 | Hard-stop when all providers exhausted | unit      | `npx vitest run src/fallback/FallbackProxy.test.ts -t "throws AllProvidersExhaustedError" -x`    | No - Wave 0  |
| CORE-05 | Per-provider fallback behavior config  | unit      | `npx vitest run src/fallback/FallbackResolver.test.ts -t "respects per-provider behavior" -x`    | No - Wave 0  |
| CORE-06 | Monthly budget cap enforcement         | unit      | `npx vitest run src/budget/BudgetTracker.test.ts -t "blocks paid calls when budget exceeded" -x` | No - Wave 0  |
| DX-05   | Budget alert events at thresholds      | unit      | `npx vitest run src/budget/BudgetTracker.test.ts -t "emits budget:alert" -x`                     | No - Wave 0  |
| CAT-06  | Capability-aware fallback matching     | unit      | `npx vitest run src/fallback/FallbackResolver.test.ts -t "matches capabilities" -x`              | No - Wave 0  |
| CAT-07  | Cheapest matching model preference     | unit      | `npx vitest run src/fallback/FallbackResolver.test.ts -t "prefers cheapest paid" -x`             | No - Wave 0  |

### Sampling Rate

- **Per task commit:** `npx vitest run --reporter=verbose` + `npx tsc --noEmit`
- **Per wave merge:** `npx vitest run --coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

Note: Per CLAUDE.md testing strategy, tests should be minimal during build phases. Wave 0 gaps are documented but test files should only be created if the plan explicitly requires them or to catch real bugs.

- [ ] `src/fallback/FallbackResolver.test.ts` -- covers CAT-06, CAT-07, CORE-05
- [ ] `src/fallback/FallbackProxy.test.ts` -- covers CORE-04
- [ ] `src/budget/BudgetTracker.test.ts` -- covers CORE-06, DX-05
- [ ] Framework install: Not needed (vitest already configured)

## Sources

### Primary (HIGH confidence)

- **Codebase analysis** -- Direct inspection of all files in `src/` directory. Every finding in this research is verified against actual code.
- `src/types/events.ts` -- FallbackTriggeredEvent already defined, ProviderExhaustedEvent exists
- `src/types/config.ts` -- BudgetConfig interface with monthlyLimit and alertThresholds
- `src/types/domain.ts` -- ModelMetadata with capabilities, qualityTier, contextWindow, pricing
- `src/config/schema.ts` -- budgetConfigSchema with monthlyLimit default 0
- `src/catalog/DefaultModelCatalog.ts` -- listModels() with capability, qualityTier, maxPrice filters
- `src/selection/KeySelector.ts` -- QuotaExhaustedError and RateLimitError throw patterns
- `src/wrapper/retry-proxy.ts` -- createRetryProxy architecture and error handling flow
- `src/wrapper/middleware.ts` -- createRouterMiddleware with keyIndexRef pattern
- `src/config/index.ts` -- createRouter() full implementation including wrapModel()
- `src/storage/MemoryStorage.ts` -- StorageBackend implementation with composite key pattern
- `src/usage/periods.ts` -- getPeriodKey() with monthly YYYY-MM support

### Secondary (MEDIUM confidence)

- CONTEXT.md decisions -- User-locked decisions that constrain implementation choices

### Tertiary (LOW confidence)

- None -- all findings verified against actual codebase

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH -- No new libraries needed, all building blocks verified in codebase
- Architecture: HIGH -- Layered proxy pattern follows established retry-proxy pattern, integration points clearly identified in createRouter()
- Pitfalls: HIGH -- Identified from direct code analysis (exactOptionalPropertyTypes, middleware ref pattern, streaming limitations)

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (stable -- internal architecture, no external API dependencies)
