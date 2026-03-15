# Phase 5: Model Catalog & Selection - Research

**Researched:** 2026-03-13
**Domain:** Model metadata catalog with live API fetching, in-memory caching, and pluggable key selection strategies
**Confidence:** HIGH

## Summary

Phase 5 implements two core subsystems: (1) ModelCatalog for fetching and caching model metadata from live APIs (models.dev primary, OpenRouter supplementary) with offline fallback, and (2) KeySelector for choosing optimal keys using built-in strategies (priority, round-robin, least-used) or custom plugins. The catalog provides capability flags (reasoning, toolCall, structuredOutput, vision), quality tiers (frontier, high, mid, small), and pricing per 1M tokens. Selection integrates with PolicyEngine and CooldownManager to skip ineligible keys, supports exponential backoff for 429s, and emits events for observability.

**Primary recommendation:** Use native fetch() with AbortSignal.timeout(5000) for API calls, implement inflight request deduplication with Promise caching, validate responses with Zod's safeParse() and skip invalid entries, and structure selection as a coordinator pattern (KeySelector) that orchestrates strategy resolution, evaluation, and event emission.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Model Catalog - Data Sources & Fetching:**

- Direct API fetch from models.dev (primary) using native fetch(). No @tokenlens/models dependency
- OpenRouter fills gaps only — models not in models.dev get supplemented from OpenRouter
- Zod validation on API response — validate each model entry individually, skip bad entries, keep good ones
- 5s timeout, no retry on API fetches. Fall back to stale cache or static snapshot on any failure
- One entry per provider+model combo — 'groq/llama-3.3-70b' and 'openrouter/llama-3.3-70b' are separate

**Model Catalog - Caching & Refresh:**

- Lazy on first use — fetch from APIs on first access, then cache in memory
- 24-hour cache TTL — after expiry, next access triggers re-fetch
- Memory-only cache — no disk persistence
- Serve stale cache on failure — if APIs unreachable, keep using expired cache
- Auto-heal on TTL expiry — once expired, next access tries live API
- Single in-flight fetch deduplication — if refresh already in progress, return same Promise
- Eager init at createRouter() — catalog fetched during router initialization

**Model Catalog - Static Snapshot:**

- Bundled JSON in npm package — static-catalog.json shipped with the package
- 12 supported providers only — Google, Groq, OpenRouter, Mistral, HuggingFace, Cerebras, DeepSeek, Qwen, Cloudflare, NVIDIA, Cohere, GitHub
- Combined snapshot generation: CI weekly auto-update PR + manual `npm run update-catalog` + prepublishOnly hook

**Model Catalog - Metadata:**

- Pricing normalized to per-1M tokens — USD per 1 million tokens (prompt + completion separately)
- Free models get zero pricing — { promptPer1MTokens: 0, completionPer1MTokens: 0 }
- Quality tiers from static snapshot — manually assigned (frontier/high/mid/small) based on benchmarks
- 4 fixed capability flags — reasoning, toolCall, structuredOutput, vision
- Active/deprecated status — simple status field, selection skips deprecated
- Context window kept — contextWindow: number populated from models.dev
- Include dates if available — optional createdAt/updatedAt from API
- Exact model ID match only — no alias resolution
- Unknown models: warn and pass through — debug warning, but allow routing

**Model Catalog - Interface & Events:**

- Expose via router.catalog — accessible as router property
- Filter in listModels() — extend to accept filter options: listModels({ provider?, capabilities?, qualityTier?, maxPrice? })
- Keep getCapabilities() — convenience shortcut alongside getModel()
- Add close() to ModelCatalog — cancels in-flight fetches, clears cache
- Custom catalog via createRouter() options — createRouter(config, { catalog?: ModelCatalog })
- catalog:refreshed event always emitted — on every load (live, cache, static). Includes { source, modelsAdded, modelsRemoved, unchanged, timestamp }
- No catalog config in Zod schema — catalog is runtime-configured

**Selection Strategy - Built-in Strategies:**

- 3 built-in strategies: priority (default), round-robin, least-used
- Priority (default): first eligible key in config order wins. Auto-promotes recovered keys
- Least-used: compare by most-constraining-window remaining percentage
- Round-robin: stateful cycling. Track index per provider. In-memory state, resets on restart
- Single-key short-circuit — if only 1 key: check eligibility + cooldown, skip strategy logic
- Strategy.PRIORITY constant added — Strategy = { PRIORITY: 'priority', ROUND_ROBIN: 'round-robin', LEAST_USED: 'least-used' }

**Selection Strategy - Configuration:**

- Priority as default — changed from Phase 1's round-robin
- Per provider with global default — top-level strategy field, per-provider override supported
- Per-request override supported — router.model('google/gemini', { strategy: 'round-robin' })
- Built-in strings only in config — schema validates against known names
- Tiebreaker: first in config order — when remaining percentage is equal

**Selection Strategy - Interface & Plugin:**

- New SelectionContext type — replaces old interface. selectKey(context: SelectionContext)
- CandidateKey includes EvaluationResult — { keyIndex, label?, eligible, cooldown, evaluation }
- Async (keep Promise) — built-in strategies resolve immediately
- Both function and interface accepted — plain function OR full SelectionStrategy object
- Human-readable reason string for v1
- Custom strategy error: fall back to default — catch error, debug-log, fall back to configured strategy

**Selection Strategy - Pre-flight & Metrics:**

- Pre-flight headroom check — evaluate estimated tokens against remaining quota before selecting
- In-memory selection metrics for v1 — track selection counts per key, resets on restart
- key:selected event always emitted — on every selection

**Key Priority & Labels:**

- Config order = priority — keys listed first are preferred
- Optional key label — { key: 'API_KEY', label: 'personal-free' }
- Auto-promote recovered keys — priority re-evaluated per request
- Skip cooldown keys immediately — in priority strategy, don't wait

**Cooldown & Exhaustion in Selection:**

- Both PolicyEngine + CooldownManager checked separately
- Cooldown keys are unavailable — both exhausted and cooldown keys skipped
- Auto re-enable on cooldown expiry — once timer expires, key immediately eligible
- Exponential backoff on consecutive 429s — cooldown doubles per consecutive failure
- Respect Retry-After exactly — no cap on cooldown duration
- Configurable default cooldown — { cooldown: { defaultDurationMs: 60000 } }
- Different errors for different states: RateLimitError (all cooldown), QuotaExhaustedError (all exhausted)
- provider:exhausted event — emitted before throwing error
- Debug log per skipped key — each skipped key logged with reason

**Router Integration:**

- Selection in router.model() — triggers immediately when user requests a model
- router.model() becomes async — returns Promise
- Provider/model format required — always 'google/gemini-2.0-flash'
- Warn but allow unknown models — debug warning if not in catalog
- Router fields: add selection + catalog — router.selection, router.catalog
- KeySelector coordinator class — orchestrates strategy, evaluation, cooldown, events
- Init order in createRouter() — storage → policy engine → usage tracker → catalog (fetch) → key selector
- Expanded createRouter() options — { storage?, tokenEstimator?, catalog?, strategy? }
- Error feedback loop — 401 disables key, 500 triggers short cooldown

**Config Schema Changes:**

- Top-level strategy field — { strategy: 'priority', providers: { ... } }
- Top-level cooldown section — { cooldown: { defaultDurationMs: 60000 } }
- Key label in object form — { key: 'KEY', label: 'name', limits: [...] }
- Update DEFAULT_CONFIG — strategy changes to 'priority', add cooldown defaults
- Not breaking — pre-v1, no existing users

**Testing:**

- Minimal smoke tests only — per CLAUDE.md: tsc --noEmit + basic smoke tests

### Claude's Discretion

- Weighted strategy (third-party, not built-in — custom strategy covers this)
- Exact KeySelector class constructor and internal orchestration
- Exact SelectionContext and CandidateKey TypeScript interfaces
- Static snapshot file format and generation script details
- models.dev API endpoint URLs and response parsing
- OpenRouter API endpoint and authentication
- Exact Zod schema nesting for new config sections
- In-memory metrics API shape (router.getSelectionStats() or similar)
- Error feedback integration details (how Phase 7 error handler notifies KeySelector)
  </user_constraints>

<phase_requirements>

## Phase Requirements

This phase addresses the following requirements from REQUIREMENTS.md:

| ID      | Description                                                             | Research Support                                                                                                                                                 |
| ------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ALGO-01 | Round-robin selection distributes requests evenly across available keys | Round-robin pattern with stateful cycling per provider (in-memory index tracking). Standard algorithm with TypeScript implementations available.                 |
| ALGO-02 | Least-used selection prefers keys with most remaining quota             | Least-used compares by most-constraining-window remaining percentage. Integrates with PolicyEngine.evaluate() and UsageTracker.getUsage() to calculate headroom. |
| ALGO-03 | User can configure selection strategy per provider                      | Per-provider strategy override in config schema. Top-level default + provider-specific override. Per-request override via router.model() options.                |
| ALGO-04 | Selection skips keys that have exceeded any limit                       | KeySelector checks both PolicyEngine (usage-based prediction) and CooldownManager (runtime 429s). Keys must pass BOTH to be eligible.                            |
| ALGO-05 | Selection algorithm is pluggable                                        | SelectionStrategy interface accepts both function and object. Custom strategies via createRouter() options. Built-in strategies as reference implementations.    |
| CAT-01  | Router fetches model metadata from live APIs with periodic refresh      | models.dev primary, OpenRouter supplementary. Native fetch() with 5s timeout. 24h TTL with lazy refresh. Inflight deduplication prevents parallel fetches.       |
| CAT-02  | Models have capability flags                                            | Fixed set: reasoning, toolCall, structuredOutput, vision. Derived from API responses with Zod validation. Missing flags default to false.                        |
| CAT-03  | Models have quality tiers derived from benchmark data                   | Manually assigned tiers: frontier, high, mid, small. Stored in static snapshot, updated per release. Based on benchmark rankings (MMLU, HumanEval, MATH).        |
| CAT-04  | Catalog includes cheap paid models with pricing                         | Pricing normalized to per-1M tokens (USD). Stored as promptPer1MTokens and completionPer1MTokens. Free models have zero pricing.                                 |
| CAT-05  | Catalog works offline with bundled static snapshot                      | Static JSON shipped in npm package. Used when APIs unreachable. Combined generation: CI weekly + manual command + prepublishOnly hook.                           |

</phase_requirements>

## Standard Stack

### Core Dependencies (Already in package.json)

| Library        | Version  | Purpose            | Why Standard                                                                                  |
| -------------- | -------- | ------------------ | --------------------------------------------------------------------------------------------- |
| zod            | ^3.23.0  | Runtime validation | Already used for config validation. Handles safeParse() for skipping invalid array entries.   |
| debug          | ^4.3.0   | Structured logging | Already used. Add namespaces: pennyllm:catalog, pennyllm:selection                            |
| native fetch() | Node 18+ | HTTP requests      | Built-in since Node 18. No need for axios/node-fetch. Use AbortSignal.timeout() for timeouts. |

### No New Dependencies Required

Phase 5 builds on existing infrastructure:

- EventEmitter (node:events) — already in use for router events
- Map/Set — native data structures for in-memory cache and deduplication
- Promise caching — standard pattern for inflight request deduplication

**Installation:** No new packages needed.

## Architecture Patterns

### Recommended Project Structure

```
src/
├── catalog/
│   ├── index.ts                    # Re-export ModelCatalog interface + DefaultModelCatalog
│   ├── DefaultModelCatalog.ts      # Implementation with fetch, cache, events
│   ├── fetchers.ts                 # fetchModelsDev(), fetchOpenRouter()
│   ├── static-catalog.json         # Bundled snapshot (12 providers)
│   └── types.ts                    # CatalogRefreshEvent, FilterOptions
├── selection/
│   ├── index.ts                    # Re-export all strategies + KeySelector
│   ├── KeySelector.ts              # Coordinator: strategy resolution, evaluation, events
│   ├── strategies/
│   │   ├── priority.ts             # PriorityStrategy implementation
│   │   ├── round-robin.ts          # RoundRobinStrategy implementation
│   │   └── least-used.ts           # LeastUsedStrategy implementation
│   └── types.ts                    # SelectionContext, CandidateKey
├── errors/
│   ├── RateLimitError.ts           # All keys in cooldown (temporary)
│   └── QuotaExhaustedError.ts      # All keys exhausted (usage-based)
└── config/
    ├── schema.ts                   # Add strategy, cooldown sections
    └── defaults.ts                 # Update DEFAULT_CONFIG (priority default)
```

### Pattern 1: Inflight Request Deduplication

**What:** Cache the Promise itself (not the result) to ensure only one fetch happens for concurrent requests.

**When to use:** API catalog refresh when multiple callers trigger refresh simultaneously.

**Example:**

```typescript
// Source: async-cache-dedupe pattern (https://github.com/mcollina/async-cache-dedupe)
class DefaultModelCatalog implements ModelCatalog {
  private cache: ModelMetadata[] | null = null;
  private cacheTimestamp: number = 0;
  private inflightFetch: Promise<ModelMetadata[]> | null = null;

  async refresh(): Promise<void> {
    // If fetch already in progress, return same Promise
    if (this.inflightFetch) {
      await this.inflightFetch;
      return;
    }

    // Start new fetch, cache the Promise
    this.inflightFetch = this.doFetch();

    try {
      this.cache = await this.inflightFetch;
      this.cacheTimestamp = Date.now();
    } finally {
      this.inflightFetch = null;
    }
  }

  private async doFetch(): Promise<ModelMetadata[]> {
    // Actual fetch logic
  }
}
```

### Pattern 2: Fetch with Timeout and No Retry

**What:** Use AbortSignal.timeout() to enforce 5s timeout. Single attempt, fail immediately on error.

**When to use:** All external API calls (models.dev, OpenRouter).

**Example:**

```typescript
// Source: AbortSignal.timeout() (https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal)
async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response;
  } catch (err) {
    if (err.name === 'TimeoutError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    throw err;
  }
}
```

### Pattern 3: Zod Array Validation with Skip Invalid

**What:** Use safeParse() to validate each array element individually. Skip bad entries, keep good ones.

**When to use:** Validating model arrays from API responses.

**Example:**

```typescript
// Source: Zod discussion #1824 (https://github.com/colinhacks/zod/discussions/1824)
import { z } from 'zod';

const modelSchema = z.object({
  id: z.string(),
  provider: z.string(),
  // ... other fields
});

function parseModelsArray(data: unknown[]): ModelMetadata[] {
  const validModels: ModelMetadata[] = [];

  for (const item of data) {
    const result = modelSchema.safeParse(item);
    if (result.success) {
      validModels.push(result.data);
    } else {
      debug('Skipping invalid model: %O', result.error.issues);
    }
  }

  return validModels;
}
```

### Pattern 4: Exponential Backoff for Consecutive 429s

**What:** Double cooldown duration on consecutive 429s, reset to base on successful request.

**When to use:** CooldownManager tracking per-key 429 responses.

**Example:**

```typescript
// Source: Better Stack exponential backoff (https://betterstack.com/community/guides/monitoring/exponential-backoff/)
class CooldownManager {
  private consecutiveFailures = new Map<string, number>();

  setCooldown(provider: string, keyIndex: number, retryAfter?: number): void {
    const keyId = `${provider}:${keyIndex}`;
    const failures = (this.consecutiveFailures.get(keyId) || 0) + 1;
    this.consecutiveFailures.set(keyId, failures);

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 32s (cap at 30s default)
    const baseDuration = retryAfter || this.config.cooldown.defaultDurationMs;
    const backoffDuration = Math.min(baseDuration * Math.pow(2, failures - 1), 30000);

    this.cooldowns.set(keyId, Date.now() + backoffDuration);
  }

  onSuccess(provider: string, keyIndex: number): void {
    const keyId = `${provider}:${keyIndex}`;
    this.consecutiveFailures.delete(keyId); // Reset on success
  }
}
```

### Pattern 5: Coordinator Pattern for Selection

**What:** KeySelector orchestrates multiple concerns (strategy resolution, evaluation, cooldown checks, event emission) without embedding complex logic.

**When to use:** Coordinating selection across PolicyEngine, CooldownManager, UsageTracker, and SelectionStrategy.

**Example:**

```typescript
class KeySelector {
  async selectKey(
    provider: string,
    model?: string,
    estimatedTokens?: number,
  ): Promise<{ keyIndex: number; reason: string }> {
    // 1. Resolve strategy (per-request > per-provider > global default)
    const strategy = this.resolveStrategy(provider, options?.strategy);

    // 2. Build candidate list with evaluation
    const candidates: CandidateKey[] = [];
    for (let i = 0; i < keys.length; i++) {
      const cooldown = this.cooldownManager.getCooldown(provider, i);
      const evaluation = await this.policyEngine.evaluate(provider, i, estimatedTokens);
      candidates.push({ keyIndex: i, eligible: evaluation.eligible, cooldown, evaluation });
    }

    // 3. Execute strategy
    const result = await strategy.selectKey({ provider, model, candidates, estimatedTokens });

    // 4. Emit event
    this.eventEmitter.emit('key:selected', {
      provider,
      model,
      keyIndex: result.keyIndex,
      strategy: strategy.name,
      reason: result.reason,
    });

    // 5. Return result
    return result;
  }
}
```

### Pattern 6: Static JSON Bundling with prepublishOnly

**What:** Include static-catalog.json in npm package. Update via CI + manual command + prepublishOnly hook.

**When to use:** Shipping fallback data with npm package.

**Example:**

```json
// package.json
{
  "scripts": {
    "update-catalog": "tsx scripts/generate-catalog.ts",
    "prepublishOnly": "npm run build && npm run update-catalog"
  },
  "files": ["dist", "src/catalog/static-catalog.json"]
}
```

### Anti-Patterns to Avoid

- **Caching results instead of Promises:** Leads to thundering herd when multiple requests arrive before first fetch completes. Cache the Promise itself.
- **Retrying failed API fetches:** CONTEXT.md explicitly requires no retry. Fall back to stale cache or static snapshot immediately.
- **Disk-based caching:** Memory-only cache per requirements. Disk persistence deferred to future phase.
- **Validating entire array with .parse():** Throws on first invalid entry. Use safeParse() per element and skip invalid entries.
- **Hard-coded timeout with setTimeout:** Use AbortSignal.timeout() for built-in fetch cancellation.

## Don't Hand-Roll

| Problem                               | Don't Build                                 | Use Instead                                 | Why                                                                                                   |
| ------------------------------------- | ------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| HTTP timeouts                         | Manual setTimeout + AbortController cleanup | AbortSignal.timeout(5000)                   | Built-in since Node 18, handles cleanup automatically, throws TimeoutError                            |
| Promise deduplication                 | Custom locking with flags                   | Promise caching in Map                      | Standard pattern, no race conditions, simpler code                                                    |
| Array validation with partial success | Custom loop with try-catch per element      | Zod safeParse() + filter                    | Type-safe, handles nested validation, clear error messages                                            |
| Exponential backoff calculation       | Custom doubling logic with edge cases       | Math.min(base \* Math.pow(2, attempt), cap) | Standard formula, no off-by-one errors, easy to test                                                  |
| Model quality tier inference          | Custom scoring based on heuristics          | Manual classification updated per release   | Benchmark rankings change frequently, heuristics become stale quickly, manual review ensures accuracy |

**Key insight:** Phase 5 operates at the coordination layer, not the algorithm layer. Use standard library features (fetch, AbortSignal, Promise caching) rather than reinventing primitives. The complexity is in orchestration (KeySelector coordinating 4 subsystems), not in individual operations.

## Common Pitfalls

### Pitfall 1: Cache Invalidation Without Stale Serving

**What goes wrong:** TTL expires, new fetch fails, cache cleared → catalog unavailable even though stale data would work.

**Why it happens:** Common caching pattern: if (expired) { clear(); fetch(); }. Fails when fetch throws.

**How to avoid:** Keep stale cache on fetch failure. Only clear cache on successful refresh.

**Warning signs:** "Catalog unavailable" errors when API is temporarily down despite previous successful fetch.

**Example:**

```typescript
// BAD: Clears cache before fetch
async refresh(): Promise<void> {
  if (Date.now() - this.cacheTimestamp > TTL) {
    this.cache = null; // ❌ Lost stale data
    this.cache = await this.doFetch(); // Throws → no cache at all
  }
}

// GOOD: Keep stale cache on failure
async refresh(): Promise<void> {
  if (Date.now() - this.cacheTimestamp > TTL) {
    try {
      const fresh = await this.doFetch();
      this.cache = fresh; // Only update on success
      this.cacheTimestamp = Date.now();
    } catch (err) {
      debug('Refresh failed, serving stale cache: %s', err.message);
      // Keep existing this.cache
    }
  }
}
```

### Pitfall 2: Thundering Herd on Cache Miss

**What goes wrong:** 100 concurrent requests trigger 100 parallel API fetches when cache is cold.

**Why it happens:** Not deduplicating inflight requests. Each request checks cache, sees null, starts fetch.

**How to avoid:** Cache the Promise, not the result. Return same Promise to all concurrent callers.

**Warning signs:** API rate limit errors immediately after restart. Logs show many parallel fetches.

**Example:**

```typescript
// BAD: Each request fetches independently
async refresh(): Promise<void> {
  if (!this.cache) {
    this.cache = await this.doFetch(); // ❌ All concurrent calls run this
  }
}

// GOOD: Deduplicate with Promise cache
async refresh(): Promise<void> {
  if (this.inflightFetch) {
    await this.inflightFetch; // ✓ Wait for existing fetch
    return;
  }

  if (!this.cache) {
    this.inflightFetch = this.doFetch();
    try {
      this.cache = await this.inflightFetch;
    } finally {
      this.inflightFetch = null;
    }
  }
}
```

### Pitfall 3: Priority Strategy Without Auto-Promotion

**What goes wrong:** Key 0 fails, all requests go to Key 1. Key 0 recovers, but requests keep going to Key 1.

**Why it happens:** Static priority list, no re-evaluation per request.

**How to avoid:** Re-evaluate eligibility on every request. Don't cache selection result.

**Warning signs:** Key 0 recovered hours ago but still has zero traffic. Unbalanced key usage despite all keys available.

**Example:**

```typescript
// BAD: Cache selected key
class PriorityStrategy {
  private selectedKey: number | null = null;

  async selectKey(context: SelectionContext) {
    if (this.selectedKey !== null) {
      return { keyIndex: this.selectedKey, reason: 'cached' }; // ❌ Never re-evaluates
    }
    // ...
  }
}

// GOOD: Evaluate every time
class PriorityStrategy {
  async selectKey(context: SelectionContext) {
    // Find first eligible key in config order
    for (const candidate of context.candidates) {
      if (candidate.eligible && !candidate.cooldown) {
        return { keyIndex: candidate.keyIndex, reason: 'first eligible in config order' }; // ✓ Re-evaluates each request
      }
    }
    throw new Error('No eligible keys');
  }
}
```

### Pitfall 4: Least-Used Without Window-Aware Comparison

**What goes wrong:** Key has 90% daily quota remaining but 0% per-minute quota. Gets selected, immediately fails.

**Why it happens:** Only looking at one limit type (e.g., total monthly tokens) instead of most constraining window.

**How to avoid:** Compare by worst-case remaining percentage across ALL windows.

**Warning signs:** Key selected by least-used strategy but immediately triggers limit:exceeded event.

**Example:**

```typescript
// BAD: Only checks one limit type
function getRemainingQuota(evaluation: EvaluationResult): number {
  // Looks at first limit only
  return evaluation.limits[0]?.remaining || Infinity; // ❌ Ignores other windows
}

// GOOD: Most constraining window
function getRemainingPercentage(evaluation: EvaluationResult): number {
  let worstPercentage = 100;

  for (const limit of evaluation.limits) {
    const percentage = (limit.remaining / limit.limit) * 100;
    worstPercentage = Math.min(worstPercentage, percentage);
  }

  return worstPercentage; // ✓ Returns worst-case scenario
}
```

### Pitfall 5: Exponential Backoff Without Reset

**What goes wrong:** Key has one 429, gets 1s cooldown. Hour later, another 429, gets 2s cooldown as if consecutive.

**Why it happens:** Never clearing consecutive failure counter after successful requests.

**How to avoid:** Reset counter on successful request. Track last request status per key.

**Warning signs:** Cooldown durations increasing over time even with hours between 429s.

### Pitfall 6: Static Snapshot Missing from npm Package

**What goes wrong:** Package published without static-catalog.json. Offline fallback fails.

**Why it happens:** JSON file not in "files" array or prepublishOnly hook fails silently.

**How to avoid:** Include JSON in "files" array. Test npm pack locally. Add prepublishOnly hook.

**Warning signs:** "Static catalog not found" errors in production. npm pack tarball missing JSON file.

## Code Examples

Verified patterns from research:

### Catalog Fetch with Timeout and Fallback

```typescript
// Source: AbortSignal.timeout() pattern
async function fetchModelsDev(): Promise<ModelMetadata[]> {
  const debug = createDebug('pennyllm:catalog');

  try {
    const response = await fetch('https://models.dev/api.json', {
      signal: AbortSignal.timeout(5000),
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return parseModelsArray(data);
  } catch (err) {
    debug('models.dev fetch failed: %s', err.message);
    throw err; // Caller decides fallback strategy
  }
}
```

### Round-Robin with Per-Provider State

```typescript
// Source: Standard round-robin pattern with state
class RoundRobinStrategy implements SelectionStrategy {
  readonly name = 'round-robin';
  private indices = new Map<string, number>();

  async selectKey(context: SelectionContext): Promise<{ keyIndex: number; reason: string }> {
    const eligible = context.candidates.filter((c) => c.eligible && !c.cooldown);

    if (eligible.length === 0) {
      throw new Error('No eligible keys');
    }

    // Get or initialize index for this provider
    const currentIndex = this.indices.get(context.provider) || 0;
    const selected = eligible[currentIndex % eligible.length];

    // Advance index for next call
    this.indices.set(context.provider, (currentIndex + 1) % eligible.length);

    return {
      keyIndex: selected.keyIndex,
      reason: `round-robin position ${currentIndex % eligible.length}`,
    };
  }
}
```

### Least-Used with Window-Aware Comparison

```typescript
// Source: Most-constraining-window pattern
class LeastUsedStrategy implements SelectionStrategy {
  readonly name = 'least-used';

  async selectKey(context: SelectionContext): Promise<{ keyIndex: number; reason: string }> {
    const eligible = context.candidates.filter((c) => c.eligible && !c.cooldown);

    if (eligible.length === 0) {
      throw new Error('No eligible keys');
    }

    // Find key with highest worst-case remaining percentage
    const sorted = eligible.sort((a, b) => {
      const aRemaining = this.getWorstCaseRemaining(a.evaluation);
      const bRemaining = this.getWorstCaseRemaining(b.evaluation);
      return bRemaining - aRemaining; // Descending
    });

    const selected = sorted[0];
    const percentage = this.getWorstCaseRemaining(selected.evaluation);

    return {
      keyIndex: selected.keyIndex,
      reason: `most remaining quota (${percentage.toFixed(1)}% worst-case)`,
    };
  }

  private getWorstCaseRemaining(evaluation: EvaluationResult): number {
    if (!evaluation.eligible) return 0;

    let worstPercentage = 100;
    for (const limit of evaluation.limits) {
      const percentage = (limit.remaining / limit.limit) * 100;
      worstPercentage = Math.min(worstPercentage, percentage);
    }

    return worstPercentage;
  }
}
```

### KeySelector Coordinator Pattern

```typescript
// Source: Orchestration pattern
export class KeySelector {
  constructor(
    private config: RouterConfig,
    private policyEngine: PolicyEngine,
    private cooldownManager: CooldownManager,
    private usageTracker: UsageTracker,
    private eventEmitter: EventEmitter,
  ) {}

  async selectKey(
    provider: string,
    model?: string,
    estimatedTokens?: number,
    options?: { strategy?: string },
  ): Promise<{ keyIndex: number; reason: string }> {
    const providerConfig = this.config.providers[provider];
    if (!providerConfig) {
      throw new Error(`Provider ${provider} not configured`);
    }

    const keys = providerConfig.keys;

    // Single key short-circuit
    if (keys.length === 1) {
      const cooldown = this.cooldownManager.getCooldown(provider, 0);
      if (cooldown) {
        throw new RateLimitError(provider, [{ keyIndex: 0, cooldownUntil: cooldown }]);
      }

      const evaluation = await this.policyEngine.evaluate(provider, 0, estimatedTokens);
      if (!evaluation.eligible) {
        throw new QuotaExhaustedError(provider, [
          { keyIndex: 0, nextReset: evaluation.closestLimit?.resetAt },
        ]);
      }

      return { keyIndex: 0, reason: 'only key available' };
    }

    // Build candidate list
    const candidates: CandidateKey[] = [];
    for (let i = 0; i < keys.length; i++) {
      const cooldown = this.cooldownManager.getCooldown(provider, i);
      const evaluation = await this.policyEngine.evaluate(provider, i, estimatedTokens);
      const label = typeof keys[i] === 'object' ? keys[i].label : undefined;

      candidates.push({ keyIndex: i, label, eligible: evaluation.eligible, cooldown, evaluation });
    }

    // Resolve strategy
    const strategy = this.resolveStrategy(provider, options?.strategy);

    // Execute strategy
    const result = await strategy.selectKey({ provider, model, candidates, estimatedTokens });

    // Emit event
    this.eventEmitter.emit('key:selected', {
      provider,
      model,
      keyIndex: result.keyIndex,
      label: candidates[result.keyIndex].label,
      strategy: strategy.name,
      reason: result.reason,
      timestamp: Date.now(),
    });

    return result;
  }

  private resolveStrategy(provider: string, override?: string): SelectionStrategy {
    // Per-request > per-provider > global default
    const strategyName =
      override || this.config.providers[provider].strategy || this.config.strategy;

    // Return built-in or custom strategy
    // ...
  }
}
```

## State of the Art

| Old Approach                                     | Current Approach             | When Changed                       | Impact                                                                                                           |
| ------------------------------------------------ | ---------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Static JSON files for model metadata             | Live API fetch with caching  | 2025-2026                          | Models change frequently (pricing, deprecation). Static files stale within weeks. Live APIs ensure current data. |
| node-fetch package                               | Native fetch() in Node.js    | Node 18 (2022)                     | No external dependency. Built-in AbortSignal support. Simpler code.                                              |
| Manual timeout with setTimeout + AbortController | AbortSignal.timeout()        | Node 18 (2022)                     | One-liner timeout. No manual cleanup. Automatic cancellation.                                                    |
| Zod .parse() with try-catch                      | Zod .safeParse() + filter    | Zod 3.x                            | Graceful handling of partial array validation. Skip invalid entries instead of failing entire array.             |
| Disk-based cache with LRU eviction               | Memory-only cache with TTL   | Current pattern for small datasets | Model catalog is small (~50-100 models, few KB). Memory cache sufficient. No disk I/O overhead.                  |
| Round-robin as universal default                 | Priority strategy as default | 2025-2026 (LiteLLM pattern)        | Config order expresses user intent (free-first or paid-first). Priority respects user preference.                |

**Deprecated/outdated:**

- @tokenlens/models package: CONTEXT.md explicitly requires direct API fetch instead
- axios/node-fetch for HTTP: Node 18+ has native fetch()
- Custom Promise deduplication libraries: async-cache-dedupe adds dependency, Promise caching pattern is 10 lines

## Open Questions

1. **models.dev API endpoint stability**
   - What we know: models.dev exists, has GitHub repo, provides TOML data
   - What's unclear: Exact API endpoint URL, response schema, rate limits
   - Recommendation: Implement fetcher with debug logging. Test against actual endpoint. Document schema in code comments.

2. **OpenRouter authentication requirements**
   - What we know: OpenRouter has /api/v1/models endpoint
   - What's unclear: Whether endpoint requires API key or is public
   - Recommendation: Try without auth first. Add optional auth header if needed. Document in code comments.

3. **Model capability detection from API responses**
   - What we know: APIs may not provide capability flags directly
   - What's unclear: Whether to infer from model name/description or require manual mapping
   - Recommendation: Start with manual mapping in static snapshot. Defer automated inference to Phase 8 when testing with real APIs.

4. **Exact pricing field format from APIs**
   - What we know: OpenRouter pricing is strings (avoid float precision issues), per-token
   - What's unclear: Whether models.dev uses same format, how to handle per-request vs per-token pricing
   - Recommendation: Normalize all pricing to per-1M-tokens as required. Convert from per-1k if needed. Store as number in ModelMetadata (precision sufficient for display, not financial calculations).

5. **Quality tier benchmark thresholds**
   - What we know: Frontier/high/mid/small classification exists
   - What's unclear: Exact score thresholds, which benchmarks to prioritize
   - Recommendation: Start with manual classification for known models (GPT-4 = frontier, GPT-3.5 = high, Llama-3-8B = mid, Phi-3 = small). Update per release based on leaderboard changes.

## Validation Architecture

### Test Framework

| Property           | Value                                                    |
| ------------------ | -------------------------------------------------------- |
| Framework          | Vitest 2.1.8                                             |
| Config file        | vitest.config.ts                                         |
| Quick run command  | `npm test -- src/catalog/ src/selection/ --reporter=dot` |
| Full suite command | `npm test`                                               |

### Phase Requirements → Test Map

| Req ID  | Behavior                                         | Test Type | Automated Command                                                          | File Exists? |
| ------- | ------------------------------------------------ | --------- | -------------------------------------------------------------------------- | ------------ |
| ALGO-01 | Round-robin distributes evenly over 100 requests | unit      | `npm test -- src/selection/strategies/round-robin.test.ts -x`              | ❌ Wave 0    |
| ALGO-02 | Least-used selects by most remaining quota       | unit      | `npm test -- src/selection/strategies/least-used.test.ts -x`               | ❌ Wave 0    |
| ALGO-03 | Per-provider strategy override works             | unit      | `npm test -- src/selection/KeySelector.test.ts::per-provider-override -x`  | ❌ Wave 0    |
| ALGO-04 | Selection skips exhausted + cooldown keys        | unit      | `npm test -- src/selection/KeySelector.test.ts::skip-ineligible -x`        | ❌ Wave 0    |
| ALGO-05 | Custom strategy function accepted                | unit      | `npm test -- src/selection/KeySelector.test.ts::custom-strategy -x`        | ❌ Wave 0    |
| CAT-01  | Catalog fetches from API with 24h TTL            | unit      | `npm test -- src/catalog/DefaultModelCatalog.test.ts::refresh -x`          | ❌ Wave 0    |
| CAT-02  | Models have 4 capability flags                   | unit      | `npm test -- src/catalog/DefaultModelCatalog.test.ts::capabilities -x`     | ❌ Wave 0    |
| CAT-03  | Models have quality tiers                        | unit      | `npm test -- src/catalog/DefaultModelCatalog.test.ts::quality-tiers -x`    | ❌ Wave 0    |
| CAT-04  | Catalog includes paid model pricing              | unit      | `npm test -- src/catalog/DefaultModelCatalog.test.ts::pricing -x`          | ❌ Wave 0    |
| CAT-05  | Catalog uses static snapshot on API failure      | unit      | `npm test -- src/catalog/DefaultModelCatalog.test.ts::offline-fallback -x` | ❌ Wave 0    |

### Sampling Rate

- **Per task commit:** `npm test -- src/catalog/ src/selection/ --reporter=dot` (< 5 seconds)
- **Per wave merge:** `npm test` (full suite, ~15 seconds currently)
- **Phase gate:** Full suite green + `npm run typecheck` before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/catalog/DefaultModelCatalog.test.ts` — covers CAT-01 through CAT-05 (refresh, capabilities, quality tiers, pricing, offline fallback)
- [ ] `src/selection/strategies/round-robin.test.ts` — covers ALGO-01 (even distribution over 100 requests)
- [ ] `src/selection/strategies/least-used.test.ts` — covers ALGO-02 (most remaining quota selection)
- [ ] `src/selection/KeySelector.test.ts` — covers ALGO-03, ALGO-04, ALGO-05 (strategy override, skip ineligible, custom strategy)

**Test infrastructure:** Vitest already configured. Existing test pattern: contract tests + specific behavior tests (see MemoryStorage.test.ts). Follow same pattern for Phase 5.

## Sources

### Primary (HIGH confidence)

- AbortSignal.timeout() documentation — [MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal)
- Zod safeParse pattern for array validation — [Zod GitHub Discussion #1824](https://github.com/colinhacks/zod/discussions/1824)
- OpenRouter /api/v1/models endpoint — [OpenRouter API Reference](https://openrouter.ai/docs/api/api-reference/models/get-models)
- models.dev open-source database — [GitHub repository](https://github.com/sst/models.dev), [models.dev website](https://models.dev/)
- Exponential backoff pattern — [Better Stack Community Guide](https://betterstack.com/community/guides/monitoring/exponential-backoff/)

### Secondary (MEDIUM confidence)

- Promise deduplication pattern — [async-cache-dedupe GitHub](https://github.com/mcollina/async-cache-dedupe), [createSharedPromise pattern](https://dev.to/karbashevskyi/efficient-request-deduplication-with-createsharedpromise-in-jsts-fbf)
- Round-robin algorithm TypeScript — [GitHub implementations](https://github.com/lucas-242/Round-Robin), [npm: round-robin-js](https://www.npmjs.com/package/round-robin-js)
- LLM benchmarks and quality tiers — [Artificial Analysis Leaderboard](https://artificialanalysis.ai/leaderboards/models), [Evidently AI LLM Benchmarks](https://www.evidentlyai.com/llm-guide/llm-benchmarks), [DataCamp LLM Benchmarks Guide](https://www.datacamp.com/tutorial/llm-benchmarks)
- TypeScript prepublishOnly hook — [npm Scripts documentation](https://docs.npmjs.com/cli/v11/using-npm/scripts/), [LogRocket TypeScript Publishing Guide](https://blog.logrocket.com/publishing-node-modules-typescript-es-modules/)

### Tertiary (LOW confidence)

- Model capability classification — web search results indicate no standardized taxonomy, varies by provider
- models.dev API endpoint details — website exists, GitHub repo exists, but exact API schema needs verification
- OpenRouter authentication requirements — documentation unclear on whether /api/v1/models requires API key

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — No new dependencies needed, all built on Node 18+ features
- Architecture patterns: HIGH — Inflight deduplication, AbortSignal.timeout, Zod safeParse verified in official docs
- Selection algorithms: HIGH — Round-robin and priority are standard patterns, least-used is straightforward comparison
- Catalog fetching: MEDIUM — API endpoint details need verification, but fallback strategy (stale cache → static snapshot) is robust
- Quality tier classification: MEDIUM — Manual assignment per release is validated approach, but exact thresholds need definition
- Pitfalls: HIGH — All based on common caching/selection bugs documented in literature

**Research date:** 2026-03-13
**Valid until:** 2026-04-12 (30 days for stable patterns, APIs may change)
