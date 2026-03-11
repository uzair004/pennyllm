# Architecture Patterns

**Domain:** LLM Cost-Avoidance Router
**Researched:** 2026-03-11
**Confidence:** MEDIUM (based on established architectural patterns, not verified against current LLM router implementations)

## Recommended Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      User Application                           │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                v
┌─────────────────────────────────────────────────────────────────┐
│                   Cost-Avoidance Router                         │
│  ┌──────────────┐  ┌─────────────┐  ┌──────────────────────┐  │
│  │   Request    │  │   Policy    │  │   Key Selection      │  │
│  │  Interceptor │─>│   Engine    │─>│   Strategy           │  │
│  └──────────────┘  └─────────────┘  └──────────────────────┘  │
│                                              │                   │
│  ┌──────────────────────────────────────────┘                   │
│  │                                                               │
│  v                                                               │
│  ┌──────────────┐  ┌─────────────┐  ┌──────────────────────┐  │
│  │   Usage      │  │   State     │  │   Fallback           │  │
│  │   Tracker    │<>│   Storage   │  │   Handler            │  │
│  └──────────────┘  └─────────────┘  └──────────────────────┘  │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                v
┌─────────────────────────────────────────────────────────────────┐
│                    Base LLM Router                              │
│  (handles model selection: reasoning, coding, embedding, etc.)  │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                v
┌─────────────────────────────────────────────────────────────────┐
│              Provider APIs (OpenAI, Groq, etc.)                 │
└─────────────────────────────────────────────────────────────────┘
```

### Component Boundaries

| Component | Responsibility | Dependencies | Interface |
|-----------|---------------|--------------|-----------|
| **Request Interceptor** | Capture incoming LLM requests, extract provider/model info | None | Public API (receives user requests) |
| **Policy Engine** | Evaluate which keys are eligible based on usage limits | Usage Tracker, State Storage | Internal (used by Key Selection) |
| **Key Selection Strategy** | Choose optimal key from eligible set | Policy Engine | Internal (returns selected key) |
| **Usage Tracker** | Record usage per key, update quotas | State Storage | Internal (tracks tokens/calls) |
| **State Storage** | Persist usage data across restarts | Redis/SQLite adapter | Internal (CRUD for usage state) |
| **Fallback Handler** | Decide what to do when all free keys exhausted | Policy Engine, Config | Internal (returns fallback action) |
| **Base LLM Router** | Model selection and API calling | Provider SDKs | External dependency |

## Layered Architecture

### Layer 1: Public Interface (Adapter Pattern)

**Purpose:** Wrap the base LLM router with cost-avoidance logic without modifying it.

**Pattern:** Decorator/Proxy pattern

```typescript
// User-facing interface
interface CostAvoidanceRouter {
  chat(request: ChatRequest): Promise<ChatResponse>;
  embed(request: EmbedRequest): Promise<EmbedResponse>;
  // ... other LLM operations
}

// Implementation wraps base router
class CostAvoidanceRouterImpl implements CostAvoidanceRouter {
  constructor(
    private baseRouter: BaseLLMRouter,
    private keySelector: KeySelectionStrategy,
    private usageTracker: UsageTracker,
    private config: RouterConfig
  ) {}

  async chat(request: ChatRequest): Promise<ChatResponse> {
    // 1. Determine provider from request or base router
    const provider = await this.baseRouter.selectProvider(request);

    // 2. Select key for that provider
    const key = await this.keySelector.selectKey(provider, request);

    // 3. Inject key into request
    const authenticatedRequest = { ...request, apiKey: key.value };

    // 4. Make call via base router
    const response = await this.baseRouter.chat(authenticatedRequest);

    // 5. Track usage
    await this.usageTracker.recordUsage(key.id, response.usage);

    return response;
  }
}
```

**Why this pattern:**
- Minimal changes to base router (just pass through API key)
- Can swap base routers easily
- Cost-avoidance logic is isolated and testable
- Follows Open/Closed Principle (extended, not modified)

### Layer 2: Policy Engine

**Purpose:** Encode provider-specific rules about free tier limits.

**Pattern:** Strategy pattern with declarative policies

```typescript
interface ProviderPolicy {
  provider: string;
  limits: Limit[];
  resetStrategy: ResetStrategy;
  enforcementBehavior: 'hard_block' | 'throttle' | 'charge';
}

interface Limit {
  type: 'tokens' | 'api_calls' | 'requests_per_minute';
  value: number;
  window: 'minute' | 'hour' | 'day' | 'month' | 'forever';
}

type ResetStrategy =
  | { type: 'rolling'; windowMs: number }
  | { type: 'fixed'; resetTime: string } // e.g., "00:00 UTC"
  | { type: 'calendar'; period: 'day' | 'month' };

class PolicyEngine {
  constructor(private policies: Map<string, ProviderPolicy>) {}

  async evaluateKey(
    keyId: string,
    provider: string,
    currentUsage: Usage
  ): Promise<{ eligible: boolean; reason?: string }> {
    const policy = this.policies.get(provider);
    if (!policy) return { eligible: true }; // No policy = no limits

    for (const limit of policy.limits) {
      const used = this.getUsageForWindow(currentUsage, limit.window);
      if (used >= limit.value) {
        return {
          eligible: false,
          reason: `${limit.type} limit reached (${used}/${limit.value})`
        };
      }
    }

    return { eligible: true };
  }
}
```

**Configuration format (YAML/JSON):**

```yaml
providers:
  openai:
    limits:
      - type: tokens
        value: 100000
        window: month
      - type: requests_per_minute
        value: 20
        window: minute
    resetStrategy:
      type: calendar
      period: month
    enforcementBehavior: charge

  groq:
    limits:
      - type: tokens
        value: 14400
        window: minute
      - type: api_calls
        value: 30
        window: minute
    resetStrategy:
      type: rolling
      windowMs: 60000
    enforcementBehavior: hard_block
```

**Why this pattern:**
- Policies are data, not code (user can override without recompiling)
- Easy to update when providers change limits
- Testable in isolation
- Self-documenting (config shows what limits exist)

### Layer 3: Key Selection Strategy

**Purpose:** Choose which key to use from eligible keys.

**Pattern:** Strategy pattern with swappable algorithms

```typescript
interface KeySelectionStrategy {
  selectKey(
    provider: string,
    request: LLMRequest
  ): Promise<{ key: APIKey; reason: string } | { error: string }>;
}

// Algorithm 1: Round-robin (fair distribution)
class RoundRobinSelector implements KeySelectionStrategy {
  async selectKey(provider: string): Promise<...> {
    const eligibleKeys = await this.getEligibleKeys(provider);
    if (eligibleKeys.length === 0) return { error: 'No eligible keys' };

    const nextIndex = (this.lastUsedIndex.get(provider) || 0) + 1;
    const selected = eligibleKeys[nextIndex % eligibleKeys.length];
    this.lastUsedIndex.set(provider, nextIndex);

    return { key: selected, reason: 'round-robin' };
  }
}

// Algorithm 2: Least-used (maximize runway)
class LeastUsedSelector implements KeySelectionStrategy {
  async selectKey(provider: string): Promise<...> {
    const eligibleKeys = await this.getEligibleKeys(provider);
    if (eligibleKeys.length === 0) return { error: 'No eligible keys' };

    const withUsage = await Promise.all(
      eligibleKeys.map(async key => ({
        key,
        usage: await this.usageTracker.getUsage(key.id)
      }))
    );

    const sorted = withUsage.sort((a, b) =>
      this.calculateRemainingQuota(a) - this.calculateRemainingQuota(b)
    );

    return { key: sorted[0].key, reason: 'least-used' };
  }
}

// Algorithm 3: Policy-aware (considers reset times)
class PolicyAwareSelector implements KeySelectionStrategy {
  async selectKey(provider: string): Promise<...> {
    const eligibleKeys = await this.getEligibleKeys(provider);
    if (eligibleKeys.length === 0) return { error: 'No eligible keys' };

    const policy = this.policyEngine.getPolicy(provider);
    const now = Date.now();

    // Prefer keys that will reset soonest if usage is high
    const scored = eligibleKeys.map(key => {
      const usage = this.usageTracker.getUsage(key.id);
      const remainingQuota = this.calculateRemaining(usage, policy);
      const resetMs = this.timeUntilReset(policy.resetStrategy, now);

      // Score = remaining quota / time until reset
      // (prefer keys with lots of quota OR keys about to reset)
      return {
        key,
        score: resetMs > 0 ? remainingQuota / resetMs : remainingQuota
      };
    });

    const best = scored.sort((a, b) => b.score - a.score)[0];
    return { key: best.key, reason: 'policy-aware' };
  }
}
```

**Recommendation:** Start with **round-robin** (simplest), add **least-used** in Phase 2, **policy-aware** in Phase 3 if needed.

### Layer 4: Usage Tracking

**Purpose:** Maintain accurate usage counts per key across time windows.

**Schema Design:**

```typescript
interface UsageRecord {
  keyId: string;
  provider: string;
  timestamp: number; // Unix timestamp
  tokensUsed: number;
  apiCalls: number;
  // Separate tracking for different windows
  minute: { tokens: number; calls: number; windowStart: number };
  hour: { tokens: number; calls: number; windowStart: number };
  day: { tokens: number; calls: number; windowStart: number };
  month: { tokens: number; calls: number; windowStart: number };
}

interface UsageTracker {
  recordUsage(keyId: string, usage: Usage): Promise<void>;
  getUsage(keyId: string): Promise<UsageRecord>;
  resetIfNeeded(keyId: string, policy: ProviderPolicy): Promise<void>;
}
```

**Storage Options:**

| Storage | Pros | Cons | When to Use |
|---------|------|------|-------------|
| **Redis** | Fast, atomic increments, TTL for auto-reset, multi-process safe | External dependency, persistence config needed | Multi-service deployment, high throughput |
| **SQLite** | File-based, no external service, simple backup | Locking for writes, slower than Redis | Single-process, local development, simple deployment |
| **In-Memory (Map)** | Fastest, zero setup | Lost on restart, not multi-process safe | Testing, ephemeral usage |

**Recommended approach:** Abstract storage behind interface, default to SQLite, allow Redis via config.

```typescript
interface StateStorage {
  get(key: string): Promise<UsageRecord | null>;
  set(key: string, value: UsageRecord): Promise<void>;
  increment(key: string, field: string, amount: number): Promise<number>;
  delete(key: string): Promise<void>;
}

// SQLite implementation
class SQLiteStorage implements StateStorage {
  // Use better-sqlite3 for synchronous API, simple transactions
  // Schema: CREATE TABLE usage (key_id TEXT PRIMARY KEY, data JSON)
}

// Redis implementation
class RedisStorage implements StateStorage {
  // Use ioredis, leverage HINCRBY for atomic increments
  // Use EXPIRE for auto-cleanup
}
```

### Layer 5: Fallback Handler

**Purpose:** Decide what to do when all free tier keys are exhausted.

**Pattern:** Chain of Responsibility

```typescript
type FallbackAction =
  | { type: 'error'; message: string }
  | { type: 'use_paid'; provider: string; key: APIKey }
  | { type: 'wait'; retryAfter: number };

interface FallbackStrategy {
  handle(
    provider: string,
    request: LLMRequest
  ): Promise<FallbackAction>;
}

class ConfigurableFallbackHandler implements FallbackStrategy {
  constructor(private config: FallbackConfig) {}

  async handle(provider: string, request: LLMRequest): Promise<FallbackAction> {
    switch (this.config.mode) {
      case 'hard_stop':
        return {
          type: 'error',
          message: 'All free tier keys exhausted, hard stop enabled'
        };

      case 'cheapest_paid':
        if (this.config.monthlyBudget === 0) {
          return { type: 'error', message: 'Budget is $0, cannot use paid' };
        }
        const paidKey = await this.findCheapestPaidKey(provider);
        return { type: 'use_paid', provider, key: paidKey };

      case 'wait_for_reset':
        const resetTime = await this.getNextResetTime(provider);
        return { type: 'wait', retryAfter: resetTime - Date.now() };

      default:
        return { type: 'error', message: 'Unknown fallback mode' };
    }
  }
}
```

## Data Flow

### Happy Path: Request with Available Free Key

```
1. User calls router.chat(request)
   ↓
2. Request Interceptor extracts provider from request
   ↓
3. Policy Engine queries State Storage for usage of all keys for provider
   ↓
4. Policy Engine evaluates each key against provider policy
   ↓
5. Key Selection Strategy chooses from eligible keys (e.g., round-robin)
   ↓
6. Request Interceptor injects API key into request
   ↓
7. Base LLM Router makes API call to provider
   ↓
8. Response returns with usage metadata (tokens used, etc.)
   ↓
9. Usage Tracker updates State Storage with new usage
   ↓
10. Response returned to user
```

### Unhappy Path: All Free Keys Exhausted

```
1. User calls router.chat(request)
   ↓
2-4. [same as happy path]
   ↓
5. Key Selection Strategy finds zero eligible keys
   ↓
6. Fallback Handler invoked with provider + request
   ↓
7a. If hard_stop: throw error "All free keys exhausted"
7b. If cheapest_paid: find paid key, continue to step 6 of happy path
7c. If wait_for_reset: calculate retry-after, throw retriable error
```

### Edge Case: Rate Limit Hit Mid-Request

```
1-7. [request in flight to provider]
   ↓
8. Provider returns 429 Rate Limit Exceeded
   ↓
9. Request Interceptor catches 429
   ↓
10. Mark key as exhausted in State Storage
   ↓
11. Key Selection Strategy picks different key
   ↓
12. Retry request with new key (max 3 retries)
   ↓
13a. Success: return response
13b. All retries fail: invoke Fallback Handler
```

## Component Build Order

Build in dependency order to enable incremental testing:

### Phase 1: Foundation (no external dependencies)

1. **State Storage Interface + SQLite Implementation**
   - Define `StateStorage` interface
   - Implement SQLite adapter
   - Test: persist and retrieve usage records

2. **Policy Engine**
   - Define `ProviderPolicy` schema
   - Implement policy evaluation logic
   - Test: various limit types and windows

3. **Usage Tracker**
   - Implement recording and retrieval
   - Test: window-based aggregation

### Phase 2: Selection Logic (depends on Phase 1)

4. **Key Selection Strategy - Round Robin**
   - Implement simplest algorithm
   - Test: fair distribution across keys

5. **Fallback Handler**
   - Implement hard_stop mode
   - Test: error cases

### Phase 3: Integration (depends on Phases 1-2)

6. **Request Interceptor**
   - Wire together Policy Engine, Key Selector, Usage Tracker
   - Test: end-to-end flow with mock base router

7. **Adapter for Base Router**
   - Wrap chosen base LLM router package
   - Test: real API calls with test keys

### Phase 4: Enhancements (optional)

8. **Redis Storage Implementation**
   - Implement `StateStorage` for Redis
   - Test: multi-process safety

9. **Advanced Selection Strategies**
   - Least-used, policy-aware algorithms
   - Test: optimize for runway vs reset times

## Routing Algorithm Comparison

| Algorithm | Complexity | Use Case | Pros | Cons |
|-----------|-----------|----------|------|------|
| **Round-robin** | O(1) | Default, fair distribution | Simple, predictable, no hotspots | Doesn't consider usage patterns |
| **Least-used** | O(n log n) | Maximize runway before exhaustion | Uses keys efficiently | Requires querying all usage |
| **Random** | O(1) | Simple load distribution | Very simple | Can create hotspots |
| **Policy-aware** | O(n log n) | Complex multi-window limits | Optimal for time-windowed resets | Complex to implement, test |
| **Weighted** | O(n) | Different key priorities | Can prefer certain keys | Requires manual weight config |

**Recommendation:** Ship with round-robin, add least-used if users hit exhaustion faster than expected.

## Critical Architectural Decisions

### 1. Stateful vs Stateless

**Decision:** Stateful (persistent usage tracking required)

**Rationale:**
- Free tier limits persist across restarts (e.g., monthly token quotas)
- Must track usage across multiple processes/instances
- Cannot rely on provider APIs to report usage (many don't, or have delays)

**Implication:** Requires State Storage layer, complicates deployment slightly.

### 2. Sync vs Async Key Selection

**Decision:** Async (Promise-based)

**Rationale:**
- Usage queries to storage are async (SQLite I/O, Redis network)
- Policy evaluation may need network calls (future: query provider for current usage)
- Allows parallel queries for optimization

**Implication:** All public APIs return Promises.

### 3. Pre-call vs Post-call Usage Tracking

**Decision:** Post-call (record actual usage from response)

**Rationale:**
- Providers return actual token usage in response metadata
- Pre-call estimation is inaccurate (tokenization varies)
- More accurate limit tracking

**Implication:** Must handle race condition where key is selected but becomes exhausted mid-request. Mitigation: retry with different key.

### 4. Policy Configuration Location

**Decision:** User-provided config file with shipped defaults

**Rationale:**
- Providers change limits frequently (can't wait for package updates)
- Users may have custom limits (e.g., negotiated enterprise free tier)
- Defaults make it work out-of-box

**Format:**
```typescript
const router = new CostAvoidanceRouter({
  baseRouter: baseLLMRouter,
  storage: { type: 'sqlite', path: './usage.db' },
  policies: './my-policies.yaml', // Optional override
  fallback: { mode: 'hard_stop', monthlyBudget: 0 },
  keys: [
    { provider: 'openai', value: process.env.OPENAI_KEY_1 },
    { provider: 'openai', value: process.env.OPENAI_KEY_2 },
    { provider: 'groq', value: process.env.GROQ_KEY }
  ]
});
```

### 5. Error Handling Strategy

**Decision:** Throw descriptive errors, user decides retry logic

**Rationale:**
- Different use cases need different retry behavior (user-facing vs batch)
- Clear errors enable debugging (which key, which limit, when resets)
- Follows principle of least surprise

**Error types:**
```typescript
class NoEligibleKeysError extends Error {
  constructor(
    public provider: string,
    public exhaustedKeys: { id: string; reason: string }[]
  ) {
    super(`No eligible keys for ${provider}`);
  }
}

class BudgetExceededError extends Error {
  constructor(public spent: number, public limit: number) {
    super(`Budget exceeded: $${spent} / $${limit}`);
  }
}
```

## Interface Design Options

### Option 1: Transparent Proxy (Recommended)

User code unchanged, just swap router instance:

```typescript
// Before
const response = await baseLLMRouter.chat(request);

// After (same API)
const response = await costAvoidanceRouter.chat(request);
```

**Pros:** Zero migration cost, works with any base router
**Cons:** Limited to base router's interface

### Option 2: Explicit Cost-Aware Methods

New methods that expose cost logic:

```typescript
const result = await router.chatWithBudget(request, { maxCost: 0.01 });
if (result.type === 'success') {
  console.log(result.response, result.actualCost);
} else {
  console.error(result.reason); // "budget exceeded"
}
```

**Pros:** More control, explicit cost tracking
**Cons:** API surface grows, migration required

### Option 3: Middleware Pattern

Cost-avoidance as middleware in a chain:

```typescript
const router = createRouter()
  .use(costAvoidanceMiddleware(config))
  .use(loggingMiddleware())
  .use(baseLLMRouter);

await router.chat(request);
```

**Pros:** Composable, can add other concerns (logging, caching)
**Cons:** Requires middleware-aware base router

**Recommendation:** Start with Option 1 (transparent proxy), consider Option 3 if users request other middleware (caching, logging, retries).

## Scalability Considerations

| Concern | At 1 project | At 10 projects | At 100+ projects |
|---------|--------------|----------------|------------------|
| **State storage** | SQLite file | SQLite per project or shared Redis | Shared Redis cluster |
| **Key selection** | Round-robin | Least-used to balance | Policy-aware with reset optimization |
| **Usage sync** | Post-call update | Same | Consider background sync to reduce latency |
| **Policy updates** | File config | Same | Centralized policy server (future) |
| **Monitoring** | Logs | Usage dashboard (separate tool) | Metrics export (Prometheus, etc.) |

## Security Considerations

### API Key Storage

**Never store keys in State Storage.** User provides keys at runtime via:
- Environment variables (recommended)
- Config file (warn if not .gitignore'd)
- Key management service (future)

### Usage Data Sensitivity

Usage records contain:
- Key IDs (hashed, not actual keys)
- Provider names
- Token counts, timestamps

**Not sensitive** but should be:
- Excluded from version control (add `*.db` to `.gitignore`)
- Backed up if monthly limits matter
- Cleared periodically if disk space constrained

### Multi-tenant Isolation

If multiple projects share a Redis instance, use key prefixes:

```
usage:{projectId}:{keyId} -> UsageRecord
```

## Observability Hooks

Enable users to monitor without modifying code:

```typescript
interface ObservabilityHooks {
  onKeySelected?: (event: KeySelectedEvent) => void;
  onUsageRecorded?: (event: UsageRecordedEvent) => void;
  onLimitApproaching?: (event: LimitWarningEvent) => void;
  onFallbackTriggered?: (event: FallbackEvent) => void;
}

const router = new CostAvoidanceRouter({
  // ... config
  hooks: {
    onLimitApproaching: (event) => {
      if (event.percentUsed > 80) {
        console.warn(`${event.provider} key ${event.keyId} at ${event.percentUsed}% usage`);
      }
    }
  }
});
```

## Testing Strategy

### Unit Tests (per component)

- Policy Engine: various limit types, windows, reset strategies
- Key Selection: round-robin fairness, least-used optimization
- Usage Tracker: window aggregation, reset logic
- State Storage: persist, retrieve, concurrent access

### Integration Tests (component interaction)

- Request flow: interceptor → policy → selector → tracker
- Fallback chain: exhaustion → fallback → error/retry
- Reset behavior: time-based, calendar-based

### End-to-End Tests (with real APIs)

- Make actual LLM calls with test keys
- Verify usage tracking matches provider reports
- Test rate limit handling (429 responses)

**Critical:** Do NOT use real free tier keys in CI (will exhaust). Use mocked providers or dedicated test keys with higher limits.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Hardcoded Provider Policies

**What goes wrong:** Package ships with OpenAI limit of 100k tokens/month, OpenAI changes to 50k, users keep hitting limits.

**Why it happens:** Treating policies as code instead of data.

**Prevention:** Ship policies as JSON/YAML config files, user can override without upgrading package.

### Anti-Pattern 2: Optimistic Usage Tracking

**What goes wrong:** Select key, make request, request fails before recording usage, key selected again, pattern repeats, actual usage not tracked.

**Why it happens:** Not handling failure between selection and tracking.

**Prevention:** Use state machine: `selecting → selected → calling → called → tracked`. Rollback if call fails.

### Anti-Pattern 3: Synchronous Storage I/O

**What goes wrong:** SQLite read blocks event loop, high latency under load.

**Why it happens:** Using synchronous APIs for simplicity.

**Prevention:** Use async APIs (`better-sqlite3` with worker threads or async wrappers), or switch to Redis for high throughput.

### Anti-Pattern 4: Ignoring Clock Skew

**What goes wrong:** "Monthly" limit resets at wrong time because server clock drifted.

**Why it happens:** Using `Date.now()` without NTP sync.

**Prevention:** Use provider's reset time if available, document NTP requirement, add clock skew detection.

### Anti-Pattern 5: Global State in Key Selector

**What goes wrong:** Multiple router instances share selection state, round-robin breaks, some keys never used.

**Why it happens:** Using class-level statics instead of instance state.

**Prevention:** All state in `StateStorage`, scoped by router instance ID if needed.

## Extension Points

Where users might want to customize:

1. **Custom Selection Algorithm** — implement `KeySelectionStrategy` interface
2. **Custom Storage Backend** — implement `StateStorage` interface (e.g., MongoDB, DynamoDB)
3. **Custom Policy Evaluator** — override policy logic for complex rules
4. **Custom Fallback Logic** — implement `FallbackStrategy` for custom behaviors (e.g., Slack notification when exhausted)
5. **Usage Estimators** — pre-call usage prediction for better selection

## Open Questions for Phase-Specific Research

These can't be answered until base router is chosen:

1. **Base router API shape** — Does it expose provider selection? Or just accept `{ provider, model, apiKey }`?
2. **Usage metadata format** — How does base router return token counts? Standardized or provider-specific?
3. **Error handling** — Does base router throw on rate limits or return error objects?
4. **Retry logic** — Does base router handle retries or expect caller to retry?

These require testing with real providers:

1. **Rate limit header formats** — Do all providers return standard headers? Or custom parsing needed?
2. **Usage reporting delays** — How long until provider dashboards reflect usage? (affects validation)
3. **Enforcement consistency** — Do providers always hard-block at limit or sometimes throttle?

## Recommended First Phase

Based on dependency graph, start with:

**Phase 1: Core Engine (no base router integration)**

Build and test in isolation:
1. State Storage (SQLite)
2. Policy Engine
3. Usage Tracker
4. Key Selection (round-robin)

**Acceptance criteria:** Can track usage for multiple keys, evaluate policies, select keys correctly. All unit tested.

**Why this order:** Establishes foundation without external dependencies, can be tested thoroughly, doesn't block on base router research.

---

**Sources:**
- Pattern descriptions based on established software architecture patterns (Gang of Four, Fowler's PoEAA)
- Storage options based on common Node.js state management approaches
- Routing algorithms based on load balancing and quota management systems
- Confidence: MEDIUM (patterns are well-established, but not verified against specific LLM router implementations)
