# Phase 3: Policy Engine - Research

**Researched:** 2026-03-13
**Domain:** Declarative policy evaluation, quota tracking, rate limit enforcement
**Confidence:** HIGH

## Summary

Policy engines evaluate declarative rules against runtime state to determine eligibility. For Phase 3, this translates to answering "Is key X available or exhausted?" by comparing current usage (from storage) against configured limits. The phase implements three core capabilities: policy resolution (merging shipped defaults with user overrides), evaluation (async storage queries with rich result metadata), and staleness detection (warning when shipped data is outdated).

TypeScript ecosystem provides established patterns for rules engines, but this phase requires custom implementation tailored to quota tracking. The policy engine is **read-only** — it evaluates but doesn't modify state. Usage tracking (incrementing counters) is Phase 4. Selection (choosing which key to use) is Phase 5. This separation of concerns keeps the engine focused solely on eligibility determination.

**Primary recommendation:** Implement PolicyEngine as a class holding resolved policies, storage reference, and EventEmitter. Use Zod discriminated unions for mixed array config (string | object keys), deep merge for policy resolution with type+window matching, and date-based versioning (YYYY-MM-DD) for shipped policies.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Engine Role & Separation of Concerns:**

- Policy engine answers ONE question: "Is this key available or exhausted?" — binary eligible/not-eligible
- Engine does NOT decide what to do about exhaustion — that's selection (Phase 5) and fallback (Phase 9)
- Policies are a **routing prediction layer**, not billing protection. Provider limits (429 errors) are the real guardrail
- The `enforcement` field describes HOW THE PROVIDER behaves (hard-block, throttle, silent-charge) — not how we behave
- For silent-charge providers, documentation should recommend users set spend caps in provider dashboards

**Policy Merging & Resolution:**

- **Config = activation, shipped = passive data.** Only providers with keys in user config are active. Shipped defaults are reference data applied automatically
- `enabled: false` in provider config temporarily disables without removing config
- **Partial override by limit type + window type.** User specifies only what changes. Limits matched by `type + window.type` combination
- **Three-layer merge priority:** per-key limits > provider-level user limits > shipped defaults (most specific wins)
- Per-model limits: default is key-level (80% of providers). Optional model-specific limits for OpenRouter/HuggingFace
- Both provider-level AND model-level limits apply (AND logic) — key must satisfy all applicable limits
- Custom providers without configured limits: allow (always "available") with debug warning — covers self-hosted/internal LLMs
- Resolved/merged policies visible via `router.getConfig()` so users can inspect what's actually applied
- Shipped default policies exported for inspection: `import { googlePolicy } from 'llm-router/policies'`
- Duplicate key detection: error at startup (ConfigError) — fail-fast matches Phase 1 pattern
- Validate contradictory limits at startup (e.g., daily > monthly throws ConfigError)

**Per-Key Limits (Mixed Array Config):**

- Keys can be strings (use provider/shipped defaults) or objects (custom per-key limits): `keys: ['FREE_KEY', { key: 'PAID_KEY', limits: [...] }]`
- Enables mixing free + paid keys for same provider — core use case for cost avoidance
- Key priority/ordering is Phase 5's concern, not the policy engine's
- `limits: []` (empty array) vs omitting `limits` — Claude's discretion on semantics

**Token Tracking Granularity:**

- Limits can target `prompt_tokens`, `completion_tokens`, or `total_tokens` separately
- Matches reality — some providers charge differently for input vs output
- UsageRecord already tracks prompt and completion separately (Phase 2)

**Evaluation Result:**

- Rich result object: `{ eligible: boolean, limits: [{ type, current, max, remaining, percentUsed, resetAt }], closestLimit, enforcement }`
- Async evaluation — calls `storage.getUsage()` which is Promise-based (consistent across MemoryStorage and future Redis/SQLite)
- Includes enforcement type metadata so downstream consumers (selection, error handling) know how provider would react
- Includes `resetAt: Date` per limit — selection can prefer keys that reset sooner, error messages can say "try again in 45s"
- Optional `estimatedTokens` parameter for pre-call checks — avoids selecting key that will immediately hit 429
- Dry evaluation supported — evaluate() is read-only (reads from storage, doesn't write)

**Events:**

- Engine fires events directly: `limit:warning` at threshold, `limit:exceeded` at 100%
- Warning threshold: 80% by default, configurable via config (`warningThreshold`)
- Event deduplication — Claude's discretion (fire once per crossing vs every eval)

**Default Policy Bundling:**

- TypeScript const objects per provider in `src/policy/defaults/` (e.g., `google.ts`, `groq.ts`)
- Type-checked at compile time, tree-shakeable, importable by users
- Phase 3 ships 2-3 placeholder providers (Google, Groq, OpenRouter) with approximate values for proof-of-concept
- Phase 8 fills all 12 providers with researched, validated data

**Staleness Detection (POLICY-06):**

- Check at createRouter() startup — if any shipped policy's `researchedDate` is >30 days old, emit debug warning + fire `policy:stale` event
- Actionable message: includes suggestion to `npm update llm-router` or verify at provider URL
- Only applies to shipped defaults — user-configured limits have no staleness concept

**Policy Versioning (POLICY-07):**

- Timestamp-based: `version: '2026-03-15'` reflecting date of last research/update
- `researchedDate` in metadata used for staleness calculation
- No semver on policies — date is more meaningful for "is this data current?"

**Policy Lifecycle:**

- Eagerly resolved at createRouter() — all policies merged/validated during initialization
- Immutable after initialization — to change policies, create a new router
- PolicyEngine is a class holding resolved policies, storage reference, and event emitter
- Created internally by createRouter(), but also exported from `llm-router/policy` for advanced users

### Claude's Discretion

- Merge strategy details (deep merge implementation, additive vs replacement for unmatched limits)
- `limits: []` vs omitting `limits` semantics
- Event deduplication strategy (fire once per threshold crossing vs debounce)
- Evaluate-all-limits vs short-circuit-on-first-exceeded
- Enforcement metadata handling on user overrides (carry over from shipped or not)
- Override-exceeds-shipped warning behavior
- Internal PolicyEngine constructor signature and initialization flow

### Deferred Ideas (OUT OF SCOPE)

- CLI helper for discovering shipped defaults (`npx llm-router show-policy google`) — Phase 11 (DX Polish)
- Key priority/ordering (free-first vs custom ordering) — Phase 5 (Selection)
- Fallback behavior when all keys exhausted — Phase 9 (Fallback & Budget)
- Full 12-provider researched default policies — Phase 8 (Provider Policies Catalog)
- Runtime policy updates (`router.updatePolicy()`) — deferred, create new router instead
- Hot-reloadable config — deferred from Phase 1

## Phase Requirements

| ID        | Description                                                     | Research Support                                                                                           |
| --------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| POLICY-01 | Package ships with default policies for all supported providers | TypeScript const objects in src/policy/defaults/, exported as tree-shakeable modules                       |
| POLICY-02 | User can override default policies via configuration            | Deep merge with type+window matching, three-layer priority (per-key > provider > shipped)                  |
| POLICY-03 | User can add policies for providers not included in defaults    | Custom providers without shipped policies treated as "always available" with debug warning                 |
| POLICY-04 | Policies support diverse limit types                            | Zod schema already supports tokens/calls/rate/daily/monthly, evaluation handles all types                  |
| POLICY-05 | Policies include enforcement behavior metadata                  | Enforcement field carried through merge, included in evaluation result                                     |
| POLICY-06 | Package warns when shipped policy data is older than 30 days    | Staleness check at createRouter() compares researchedDate to current date, fires event + debug warning     |
| POLICY-07 | Policies are versioned with timestamps for audit trail          | Date-based versioning (YYYY-MM-DD), follows Shopify/LinkedIn pattern, more meaningful than semver for data |

## Standard Stack

### Core

| Library      | Version       | Purpose                                                | Why Standard                                                                                                  |
| ------------ | ------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Zod          | 3.23.0        | Schema validation for mixed keys, limit overrides      | Already project dependency, v3 required for AI SDK compatibility, discriminated unions for polymorphic config |
| debug        | 4.3.0         | Component-scoped logging (llm-router:policy namespace) | Already project dependency, established pattern from Phase 1/2                                                |
| EventEmitter | Node built-in | Event emission for limit warnings and exceeded events  | Native, zero-overhead, already used in Router stub                                                            |

### Supporting

| Library | Version | Purpose                        | When to Use                                                             |
| ------- | ------- | ------------------------------ | ----------------------------------------------------------------------- |
| N/A     | -       | No additional libraries needed | Policy evaluation logic is custom business logic, not a generic problem |

### Alternatives Considered

| Instead of            | Could Use                                                  | Tradeoff                                                                                                                   |
| --------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Custom policy engine  | Generic rules engines (type-rules-engine, rules-engine-ts) | Generic engines add abstraction overhead for quota tracking; our domain is simple enough for custom implementation         |
| Date-based versioning | Semantic versioning (semver)                               | Semver implies API compatibility semantics; policies are data, not APIs. Dates are more meaningful for staleness detection |
| Deep merge library    | Lodash merge or deepmerge                                  | Small merge surface (PolicyLimit[]), custom implementation avoids dependency; can use spread + filter for limit matching   |

**Installation:**

```bash
# No new dependencies required — Zod and debug already installed in Phase 1
```

## Architecture Patterns

### Recommended Project Structure

```
src/
├── policy/
│   ├── index.ts                 # PolicyEngine class, re-exports
│   ├── PolicyEngine.ts          # Main engine class
│   ├── resolver.ts              # Policy resolution (merge shipped + user config)
│   ├── evaluator.ts             # Evaluation logic (check usage vs limits)
│   ├── defaults/
│   │   ├── index.ts             # Export all default policies
│   │   ├── google.ts            # Google AI Studio policy
│   │   ├── groq.ts              # Groq policy
│   │   └── openrouter.ts        # OpenRouter policy
│   └── utils/
│       ├── merge.ts             # Policy merge utilities
│       └── staleness.ts         # Staleness detection logic
```

### Pattern 1: PolicyEngine Class with Resolved Policies

**What:** PolicyEngine holds resolved policies (after merging), storage backend, and EventEmitter. Provides `evaluate(provider, keyIndex, estimatedTokens?)` method.

**When to use:** Created at router initialization, reused for all evaluations during router lifetime.

**Example:**

```typescript
// Simplified structure - full implementation in PLAN.md
export class PolicyEngine {
  private policies: Map<string, ResolvedPolicy>;
  private storage: StorageBackend;
  private emitter: EventEmitter;
  private warningThreshold: number;
  private firedWarnings: Set<string>; // For deduplication

  constructor(
    resolvedPolicies: ResolvedPolicy[],
    storage: StorageBackend,
    emitter: EventEmitter,
    options?: { warningThreshold?: number },
  ) {
    // Initialize fields
  }

  async evaluate(
    provider: string,
    keyIndex: number,
    estimatedTokens?: { prompt: number; completion: number },
  ): Promise<EvaluationResult> {
    // Query storage.getUsage() for all limit windows
    // Compare current vs max
    // Fire events if threshold crossed
    // Return rich result object
  }
}
```

### Pattern 2: Policy Resolution with Three-Layer Merge

**What:** Merge shipped defaults, provider-level user config, and per-key user config in priority order. Match limits by `type + window.type` for partial overrides.

**When to use:** At createRouter() initialization, before PolicyEngine construction.

**Example:**

```typescript
function resolvePolicies(
  userConfig: RouterConfig,
  shippedDefaults: Map<string, Policy>
): ResolvedPolicy[] {
  const resolved: ResolvedPolicy[] = [];

  for (const [providerId, providerConfig] of Object.entries(userConfig.providers)) {
    if (providerConfig.enabled === false) continue;

    const shipped = shippedDefaults.get(providerId);

    for (const keyConfig of providerConfig.keys) {
      const keyLimits = typeof keyConfig === 'string'
        ? providerConfig.limits
        : keyConfig.limits;

      // Merge: shipped <- providerConfig.limits <- keyLimits
      const mergedLimits = mergeLimits(
        shipped?.limits ?? [],
        providerConfig.limits ?? [],
        keyLimits ?? []
      );

      resolved.push({
        provider: providerId,
        keyIndex: /* computed */,
        limits: mergedLimits,
        enforcement: shipped?.enforcement ?? 'hard-block',
      });
    }
  }

  return resolved;
}

function mergeLimits(...layers: PolicyLimit[][]): PolicyLimit[] {
  const merged = new Map<string, PolicyLimit>(); // key: `${type}:${window.type}`

  for (const layer of layers) {
    for (const limit of layer) {
      const key = `${limit.type}:${limit.window.type}`;
      merged.set(key, limit); // Later layers override earlier
    }
  }

  return Array.from(merged.values());
}
```

### Pattern 3: Staleness Detection at Startup

**What:** Check if any shipped policy's `researchedDate` is >30 days old. Fire event and debug warning if stale.

**When to use:** During createRouter() initialization, after policy resolution.

**Example:**

```typescript
function checkStaleness(resolvedPolicies: ResolvedPolicy[], emitter: EventEmitter): void {
  const now = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

  for (const policy of resolvedPolicies) {
    if (!policy.metadata?.researchedDate) continue;

    const researchedDate = new Date(policy.metadata.researchedDate).getTime();
    if (now - researchedDate > thirtyDaysMs) {
      debug(
        'Stale policy detected: %s (researched %s)',
        policy.provider,
        policy.metadata.researchedDate,
      );

      emitter.emit('policy:stale', {
        provider: policy.provider,
        researchedDate: policy.metadata.researchedDate,
        daysOld: Math.floor((now - researchedDate) / (24 * 60 * 60 * 1000)),
        suggestion: `Run 'npm update llm-router' or verify limits at ${policy.metadata.sourceUrl}`,
      });
    }
  }
}
```

### Pattern 4: Mixed Array Config with Zod Discriminated Union

**What:** Keys array accepts both strings and objects with discriminated union. String = use defaults, object = custom limits.

**When to use:** Config schema validation (update providerConfigSchema).

**Example:**

```typescript
// Update src/config/schema.ts
const keyConfigSchema = z.union([
  z.string(), // Simple key string
  z.object({
    // Per-key limits
    key: z.string(),
    limits: z.array(policyLimitSchema).optional(),
  }),
]);

export const providerConfigSchema = z.object({
  keys: z.array(keyConfigSchema).min(1, 'At least one key is required'),
  strategy: z.enum([Strategy.ROUND_ROBIN, Strategy.LEAST_USED] as const).optional(),
  limits: z.array(policyLimitSchema).optional(),
  enabled: z.boolean().default(true),
});
```

### Pattern 5: Rich Evaluation Result

**What:** Return detailed metadata about all limits, not just eligible/not-eligible boolean.

**When to use:** evaluate() method return value.

**Example:**

```typescript
interface LimitStatus {
  type: LimitTypeValue;
  current: number;
  max: number;
  remaining: number;
  percentUsed: number;
  resetAt: Date;
}

interface EvaluationResult {
  eligible: boolean;
  limits: LimitStatus[];
  closestLimit?: LimitStatus; // Limit closest to being exceeded
  enforcement: EnforcementBehaviorType;
}

// Usage by downstream phases:
// Phase 5 (Selection): prefer keys with most remaining quota (closestLimit.remaining)
// Phase 7 (Error Handling): show resetAt in error messages ("try again in 45s")
// Phase 9 (Fallback): trigger fallback when eligible === false
```

### Anti-Patterns to Avoid

- **Modifying usage in evaluate()**: Evaluation is read-only. Usage tracking (increment) happens in Phase 4, not here.
- **Caching evaluation results**: Usage changes with every API call. Always query storage.getUsage() — it's fast (in-memory for MemoryStorage, Redis GET for future adapters).
- **Complex rule DSLs**: Quota tracking is simple enough for direct TypeScript logic. Avoid over-engineering with generic rule engines.
- **Runtime policy mutation**: Policies resolved once at initialization. To change, create new router instance.

## Don't Hand-Roll

| Problem                         | Don't Build                                  | Use Instead                                                           | Why                                                                                                                                               |
| ------------------------------- | -------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Timestamp versioning validation | Custom date string parser                    | Native Date constructor + YYYY-MM-DD format                           | Date parsing is error-prone. ISO 8601 date strings (YYYY-MM-DD) work natively with `new Date()` and are human-readable                            |
| Event deduplication             | Complex state machine tracking fired events  | Simple `Set<string>` with composite key (provider:keyIndex:limitType) | Deduplication just needs "have we warned about this limit yet?" — Set is sufficient                                                               |
| Deep object merging             | Generic recursive merge for all object types | Custom mergeLimits for PolicyLimit arrays                             | Generic merge handles arbitrary nesting, but PolicyLimit[] merge is simple: match by type+window, override. Custom logic is clearer and type-safe |

**Key insight:** Policy evaluation for quota tracking is domain-specific business logic, not a generic pattern. Generic rules engines add abstraction overhead without benefit. Keep it simple and focused on the specific problem: "is usage < limit for all applicable limits?"

## Common Pitfalls

### Pitfall 1: Eager Validation of Limit Reasonableness

**What goes wrong:** Validating that daily limits are <= monthly limits, hourly <= daily, etc. Seems sensible but causes problems when providers have quirky limit structures (e.g., generous monthly quota but strict per-minute throttle).

**Why it happens:** Natural inclination to catch "obviously wrong" configurations early.

**How to avoid:** Validate only for contradictions within the same window type (e.g., `prompt_tokens` limit != `total_tokens` limit for same window). Don't compare across different window types.

**Warning signs:** User reports valid provider configuration rejected at startup. ConfigError thrown for legitimate limit combinations.

### Pitfall 2: Forgetting Per-Key vs Provider-Level Limit Interaction

**What goes wrong:** Evaluating only per-key limits OR only provider-level limits, not both. Results in keys being marked "available" when they should be exhausted (or vice versa).

**Why it happens:** Mixed array config makes it easy to forget a key might have limits from multiple sources.

**How to avoid:** Always collect limits from all layers (shipped, provider-level, per-key) during resolution. Evaluation checks ALL limits, not just the most specific.

**Warning signs:** Key marked available despite exceeding provider-level monthly quota. Custom per-key limit ignored when provider-level limit also exists.

### Pitfall 3: Staleness Check on User-Configured Limits

**What goes wrong:** Emitting staleness warnings for policies the user explicitly configured. Confuses users ("I just set this limit yesterday!").

**Why it happens:** Iterating over all resolved policies without distinguishing shipped vs user-configured.

**How to avoid:** Only check staleness for policies that originated from shipped defaults. User-configured limits have no `researchedDate` — skip them.

**Warning signs:** Staleness warnings fired for providers without shipped defaults. User overrides trigger stale policy events.

### Pitfall 4: Synchronous Evaluation

**What goes wrong:** Calling `storage.getUsage()` in a loop without awaiting, or expecting synchronous return. MemoryStorage is async (returns Promise) to match interface, even though implementation is synchronous.

**Why it happens:** MemoryStorage uses Maps, which are synchronous. Easy to forget async wrapper.

**How to avoid:** Always `await storage.getUsage()`. Use `Promise.all()` to query multiple windows concurrently.

**Warning signs:** Type errors ("Promise<number> is not assignable to number"). Runtime errors ("Cannot read property of undefined" on usage result).

### Pitfall 5: Event Spam Without Deduplication

**What goes wrong:** Firing `limit:warning` event on every evaluation after 80% threshold crossed. Results in thousands of duplicate events during normal operation.

**Why it happens:** Evaluation happens frequently (before every API call). Without deduplication, threshold crossing is detected repeatedly.

**How to avoid:** Track fired warnings in a Set with composite key (provider:keyIndex:limitType). Only fire event on first crossing. Optional: clear Set when usage drops below threshold (hysteresis).

**Warning signs:** Event listeners receive hundreds of duplicate limit:warning events. Log spam. Performance degradation from excessive event handling.

## Code Examples

Verified patterns from official sources and existing codebase:

### Zod Discriminated Union for Mixed Keys

```typescript
// Source: Zod docs (https://zod.dev/) + existing project pattern
import { z } from 'zod';

const policyLimitSchema = z.object({
  type: z.enum(['tokens', 'calls', 'rate', 'daily', 'monthly']),
  value: z.number().positive(),
  window: z.object({
    type: z.enum(['per-minute', 'hourly', 'daily', 'monthly', 'rolling-30d']),
    durationMs: z.number().positive(),
  }),
});

// Mixed array: strings or objects
const keyConfigSchema = z.union([
  z.string(),
  z.object({
    key: z.string(),
    limits: z.array(policyLimitSchema).optional(),
  }),
]);

export const providerConfigSchema = z.object({
  keys: z.array(keyConfigSchema).min(1),
  strategy: z.enum(['round-robin', 'least-used'] as const).optional(),
  limits: z.array(policyLimitSchema).optional(),
  enabled: z.boolean().default(true),
});

// Type inference works correctly:
type ProviderConfig = z.infer<typeof providerConfigSchema>;
// ProviderConfig.keys is (string | { key: string; limits?: PolicyLimit[] })[]
```

### Date-Based Version Validation

```typescript
// Source: Shopify API versioning pattern (https://shopify.dev/docs/api/usage/versioning)
interface Policy {
  version: string; // Format: YYYY-MM-DD
  researchedDate: string; // ISO 8601 date
  // ... other fields
}

function isStale(policy: Policy): boolean {
  const researchedDate = new Date(policy.researchedDate);
  const now = new Date();
  const daysDiff = (now.getTime() - researchedDate.getTime()) / (1000 * 60 * 60 * 24);

  return daysDiff > 30;
}

// Example usage:
const googlePolicy: Policy = {
  version: '2026-03-15',
  researchedDate: '2026-03-15',
  // ...
};

if (isStale(googlePolicy)) {
  console.warn(`Policy stale: researched ${googlePolicy.researchedDate}`);
}
```

### Async Storage Query with Promise.all

```typescript
// Source: Existing MemoryStorage implementation (src/storage/MemoryStorage.ts)
async function evaluateKey(
  provider: string,
  keyIndex: number,
  limits: PolicyLimit[],
  storage: StorageBackend,
): Promise<EvaluationResult> {
  // Query all limits concurrently
  const usagePromises = limits.map((limit) => storage.getUsage(provider, keyIndex, limit.window));

  const usages = await Promise.all(usagePromises);

  const limitStatuses: LimitStatus[] = limits.map((limit, i) => ({
    type: limit.type,
    current: usages[i],
    max: limit.value,
    remaining: Math.max(0, limit.value - usages[i]),
    percentUsed: (usages[i] / limit.value) * 100,
    resetAt: calculateResetTime(limit.window),
  }));

  const eligible = limitStatuses.every((status) => status.current < status.max);

  return {
    eligible,
    limits: limitStatuses,
    closestLimit: limitStatuses.sort((a, b) => b.percentUsed - a.percentUsed)[0],
    enforcement: 'hard-block', // From resolved policy
  };
}
```

### EventEmitter Pattern for Limit Events

```typescript
// Source: Existing project pattern (src/config/index.ts Router stub)
import { EventEmitter } from 'node:events';
import debugFactory from 'debug';

const debug = debugFactory('llm-router:policy');

function checkAndEmitWarnings(
  limitStatus: LimitStatus,
  provider: string,
  keyIndex: number,
  emitter: EventEmitter,
  warningThreshold: number,
  firedWarnings: Set<string>,
): void {
  const warningKey = `${provider}:${keyIndex}:${limitStatus.type}`;

  if (limitStatus.percentUsed >= warningThreshold && !firedWarnings.has(warningKey)) {
    debug('Limit warning: %s at %.1f%%', warningKey, limitStatus.percentUsed);

    emitter.emit('limit:warning', {
      provider,
      keyIndex,
      limitType: limitStatus.type,
      currentUsage: limitStatus.current,
      limit: limitStatus.max,
      threshold: warningThreshold,
      timestamp: Date.now(),
    });

    firedWarnings.add(warningKey);
  }

  if (limitStatus.percentUsed >= 100) {
    debug('Limit exceeded: %s', warningKey);

    emitter.emit('limit:exceeded', {
      provider,
      keyIndex,
      limitType: limitStatus.type,
      timestamp: Date.now(),
    });
  }
}
```

### Deep Merge for Policy Limits

```typescript
// Pattern: Custom merge for PolicyLimit arrays (not generic object merge)
function mergeLimits(...layers: PolicyLimit[][]): PolicyLimit[] {
  const merged = new Map<string, PolicyLimit>();

  // Layers in priority order: shipped, provider, per-key (later overrides earlier)
  for (const layer of layers) {
    for (const limit of layer) {
      const key = `${limit.type}:${limit.window.type}`;
      merged.set(key, limit);
    }
  }

  return Array.from(merged.values());
}

// Example:
const shippedLimits: PolicyLimit[] = [
  {
    type: 'tokens',
    value: 1000000,
    window: { type: 'monthly', durationMs: 30 * 24 * 60 * 60 * 1000 },
  },
  { type: 'rate', value: 60, window: { type: 'per-minute', durationMs: 60000 } },
];

const userLimits: PolicyLimit[] = [
  {
    type: 'tokens',
    value: 500000,
    window: { type: 'monthly', durationMs: 30 * 24 * 60 * 60 * 1000 },
  }, // Override
];

const merged = mergeLimits(shippedLimits, userLimits);
// Result: monthly tokens = 500000 (user override), rate limit = 60 (from shipped)
```

## State of the Art

| Old Approach               | Current Approach                   | When Changed                  | Impact                                                                                                                                              |
| -------------------------- | ---------------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Semver for data versioning | Date-based versioning (YYYY-MM-DD) | 2024-2026 trend               | Shopify, LinkedIn, Buttondown APIs adopted date-based versions. More meaningful for data freshness than API compatibility semver                    |
| Generic rules engines      | Domain-specific evaluation logic   | Ongoing                       | TypeScript rules engines (type-rules-engine, rules-engine-ts) exist but add abstraction overhead for simple quota tracking. Custom logic is clearer |
| Tumbling/fixed windows     | Sliding windows                    | 2025-2026                     | Sliding window rate limiting solves burst problem, provides fairness. Phase 4 concern, but evaluation must support multiple window types            |
| Zod v4                     | Zod v3.23.0                        | Project decision (2026-03-12) | AI SDK ecosystem requires Zod v3. Discriminated unions stable in v3, no v4 features needed                                                          |
| Lodash merge               | Native spread + custom logic       | 2024+ TypeScript evolution    | Shallow merge adequate for PolicyLimit arrays. Deep merge libraries add dependency for minimal benefit                                              |

**Deprecated/outdated:**

- **Generic rules engines for quota tracking**: TypeScript ecosystem has strong rules engines, but they're overkill for "usage < limit" checks. Custom implementation is more maintainable.
- **Semver for policy versions**: Data versioning differs from API versioning. Dates communicate freshness better than breaking.minor.patch semantics.

## Validation Architecture

### Test Framework

| Property           | Value                |
| ------------------ | -------------------- |
| Framework          | Vitest 2.1.8         |
| Config file        | vitest.config.ts     |
| Quick run command  | `npm test -- policy` |
| Full suite command | `npm test`           |

### Phase Requirements → Test Map

| Req ID    | Behavior                           | Test Type | Automated Command                  | File Exists? |
| --------- | ---------------------------------- | --------- | ---------------------------------- | ------------ |
| POLICY-01 | Shipped defaults export and load   | unit      | `npm test -- src/policy/defaults`  | ❌ Wave 0    |
| POLICY-02 | User overrides merge correctly     | unit      | `npm test -- src/policy/resolver`  | ❌ Wave 0    |
| POLICY-03 | Custom providers without defaults  | unit      | `npm test -- src/policy/resolver`  | ❌ Wave 0    |
| POLICY-04 | All limit types evaluate correctly | unit      | `npm test -- src/policy/evaluator` | ❌ Wave 0    |
| POLICY-05 | Enforcement metadata propagates    | unit      | `npm test -- src/policy/resolver`  | ❌ Wave 0    |
| POLICY-06 | Staleness detection fires events   | unit      | `npm test -- src/policy/staleness` | ❌ Wave 0    |
| POLICY-07 | Date-based versions validate       | unit      | `npm test -- src/policy/defaults`  | ❌ Wave 0    |

### Sampling Rate

- **Per task commit:** `npm test -- policy` (policy module tests only, <30s)
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** Full suite green + `npm run typecheck` before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/policy/resolver.test.ts` — covers POLICY-02, POLICY-03, POLICY-05 (merge logic, custom providers, enforcement propagation)
- [ ] `tests/policy/evaluator.test.ts` — covers POLICY-04 (all limit types: tokens, calls, rate, daily, monthly)
- [ ] `tests/policy/staleness.test.ts` — covers POLICY-06 (>30 days detection, event emission)
- [ ] `tests/policy/defaults.test.ts` — covers POLICY-01, POLICY-07 (exported policies, version format validation)
- [ ] `tests/policy/PolicyEngine.test.ts` — integration tests for evaluate() method with mocked storage

## Open Questions

1. **Event deduplication hysteresis**
   - What we know: Fire warning once when crossing 80%. Clear when usage drops below threshold.
   - What's unclear: Should we require drop to 70% (hysteresis) or any value below 80%? Hysteresis prevents oscillation if usage hovers near threshold.
   - Recommendation: Start simple (clear at <80%), add hysteresis only if oscillation becomes a problem. Can track in firedWarnings Set.

2. **Per-model limits storage representation**
   - What we know: Some providers (OpenRouter, HuggingFace) have per-model limits. Evaluation must check both key-level and model-level limits.
   - What's unclear: How to represent model-specific limits in Policy structure? Nested limits array? Separate field?
   - Recommendation: Add optional `modelLimits?: Map<string, PolicyLimit[]>` to Policy. Phase 3 implements structure, Phase 8 populates data.

3. **Limit contradictions across window types**
   - What we know: Should validate contradictory limits (daily > monthly).
   - What's unclear: How to compare limits with different types (tokens vs calls vs rate)? Only validate within same type?
   - Recommendation: Only validate same-type limits across different windows (e.g., daily tokens <= monthly tokens). Different types are incomparable.

## Sources

### Primary (HIGH confidence)

- Zod documentation (https://zod.dev/) - discriminated unions, schema validation, v3 API
- Existing project codebase (src/storage/MemoryStorage.ts, src/config/schema.ts) - async patterns, Zod usage, debug logging
- Node.js EventEmitter docs (https://nodejs.org/api/events.html) - event emission patterns

### Secondary (MEDIUM confidence)

- [Shopify API Versioning](https://shopify.dev/docs/api/usage/versioning) - date-based version scheme (YYYY-MM format)
- [Calendar Versioning (CalVer)](https://calver.org/) - timestamp versioning patterns
- [Sliding Window Rate Limiting](https://arpitbhayani.me/blogs/sliding-window-ratelimiter/) - window reset logic patterns
- [API Rate Limits & Quota Management Guide 2026](https://derrick-app.com/en/rate-limits-quotas-api-2/) - enforcement behavior patterns
- [Portkey Budget Limits in LLM Apps](https://portkey.ai/blog/budget-limits-and-alerts-in-llm-apps/) - threshold alerts, soft vs hard limits
- [LinkedIn LMS API Versioning](https://learn.microsoft.com/en-us/linkedin/marketing/versioning?view=li-lms-2026-02) - date-based versioning (202501, 202601 format)

### Tertiary (LOW confidence)

- [TypeScript Rules Engines](https://github.com/topics/rules-engine?l=typescript) - generic rules engine patterns (decided against for this use case)
- [Threshold-Based Event Detection](https://www.st-andrews.ac.uk/~wjh/dataview/tutorials/event-threhold.html) - academic pattern for threshold crossing
- [EventEmitter Deduplication](https://twilio-labs.github.io/socless/event-deduplication/) - SOCless pattern for event dedup (general concept, not specific implementation)

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - Zod and debug already in use, EventEmitter is native, patterns proven in Phase 1/2
- Architecture: HIGH - Policy resolution, evaluation, and staleness patterns align with CONTEXT.md decisions and existing codebase conventions
- Pitfalls: MEDIUM - Derived from general quota tracking experience and WebSearch findings, not specific to this codebase (yet)

**Research date:** 2026-03-13
**Valid until:** 2026-04-12 (30 days for stable patterns — Zod v3 stable, Node.js EventEmitter stable, date-based versioning proven pattern)
