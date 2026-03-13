# Phase 4: Usage Tracking Core - Research

**Researched:** 2026-03-13
**Domain:** Token usage tracking, time window calculation, API response reconciliation
**Confidence:** HIGH

## Summary

Phase 4 implements the usage tracking subsystem that records token consumption and API call counts across multiple time windows (per-minute, hourly, daily, monthly, rolling-30d) with correct reset behavior. The core challenges are: (1) pre-call token estimation for headroom checks without blocking requests, (2) multi-window recording with calendar-aware period calculation, (3) post-call reconciliation between estimates and provider-reported actuals, and (4) 429 rate limit cooldown management.

The existing infrastructure provides solid foundations: `StorageBackend.increment()` handles atomic writes, `PolicyEngine.evaluate()` accepts `estimatedTokens` for pre-selection checks, and `UsageRecord` type supports prompt/completion/estimated fields. The phase extends this with period calculation logic, cooldown state management, estimation utilities, and a developer-facing `getUsage()` API.

**Primary recommendation:** Use character-ratio estimation (~4 chars/token) as default with pluggable `tokenEstimator` config option for exact counts via js-tiktoken. Implement calendar-aware period keys for monthly/daily windows (not duration division). Track cooldown state in-memory only (not persisted). Record usage asynchronously fire-and-forget with requestId deduplication.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Pre-Call Estimation Strategy

- **Always-on with graceful fallback** — estimation runs automatically on every request. If it can't estimate (streaming input, estimator crash, etc.), it silently skips and proceeds without estimation. Never blocks a request.
- **Prompt estimation:** Character ratio (~4 chars/token) as default heuristic. Single universal ratio, not model-specific.
- **Completion estimation:** Use request's `maxTokens` if set, otherwise configurable default (1024 tokens). Conservative ceiling approach.
- **Pluggable estimator:** Config option `{ estimation: { tokenEstimator?: (text: string) => number } }` — users can plug in tiktoken or any tokenizer for exact counts.
- **Estimation scope:** Estimate total input — full messages array (multi-turn history), system prompt, and tool definitions/schemas. Not just the latest user message.
- **Non-text inputs:** Skip image/file inputs in estimation, estimate text portions only (v1 is text LLMs only).
- **Streaming inputs:** Skip estimation entirely for streaming inputs — track actuals post-call only.
- **Select-only, not recorded:** Estimation is used for key selection headroom checks only. Never written to storage. Storage always contains real data.
- **When no key has enough headroom:** Try anyway with the key that has the most remaining quota. Estimation is advisory, not blocking. Provider enforces the real limit.
- **Concurrency:** Accept the race — concurrent requests may all estimate against the same snapshot. Provider's 429 handles contention. No in-flight request counting.
- **Estimation feeds into selection, not vice versa** — usage tracker provides headroom numbers, selection strategy (Phase 5) uses them to pick the best key. Estimation doesn't pre-filter or rank keys.
- **Estimator failures:** Catch errors from custom estimator functions, debug-log the error, skip estimation, and proceed. Never fatal.
- **Estimation accuracy:** Debug-logged only (llm-router:usage namespace). No events for estimation accuracy. Actuals always overwrite — if estimate was wildly off, no special handling.

#### Estimation Config Shape

- **Top-level `estimation` section** in config object:
  ```typescript
  {
    estimation: {
      defaultMaxTokens: 1024,       // completion ceiling when maxTokens not set
      tokenEstimator?: (text: string) => number  // custom prompt estimator
    }
  }
  ```
- Global defaults only — no per-provider estimation overrides. Custom estimator function handles per-provider precision if needed.

#### Post-Call Recording & Reconciliation

- **Record to ALL applicable windows simultaneously** — when a response arrives, increment every window defined in the key's policy (per-minute tokens, per-minute calls, daily tokens, monthly tokens, etc.) in one pass.
- **Track call count alongside tokens** — every successful API call increments both token counters and call count in the same operation. Call-count limits use the same window/period/storage infrastructure, incrementing by 1 per request.
- **Prompt + completion tracked separately** — each recording stores promptTokens and completionTokens independently (UsageRecord already supports this).
- **Missing usage data from provider:** Fall back to pre-call estimation as the recorded value. Mark the record as `estimated: true`. Better than recording zero.
- **`usage:recorded` event fires every time** — after every successful API call. Event payload: provider, keyIndex, promptTokens, completionTokens, estimated (boolean), windows recorded to.
- **Streaming:** Record after stream completes — wait for final usage metadata from Vercel AI SDK's `onFinish`/`stream.usage`. Single recording operation.
- **Failed calls (network error, 500, timeout):** Don't count tokens. Don't increment call count. No recording for requests that didn't process.
- **Partial streams (stream errors mid-way):** Don't count — treat as failed call.
- **429 rate limit response:** Count as a call (increment call count). DO NOT record tokens. Also trigger key cooldown.
- **Asynchronous fire-and-forget recording** — return the API response immediately, record usage in the background. Recording failure does not affect the response.
- **Storage errors during recording:** Swallow the error, debug-log it, continue. Usage data is lost for this request. Provider enforces real limits.
- **Request ID deduplication** — each request gets a unique requestId. If a record with that requestId was already written for a window, skip it. Prevents double-counting from retries or middleware re-entry.
- **Response-time period recording** — usage is recorded using the timestamp when the response arrives, not when the request was initiated. If a minute boundary crossed during the call, usage goes in the new period.

#### Key Cooldown (429 Handling)

- **429 triggers cooldown** — when a key receives a 429, mark it as temporarily unavailable.
- **Duration:** Use `Retry-After` header if present, otherwise fall back to a configurable default (e.g., 60 seconds).
- **In-memory only** — cooldown state is not persisted to storage backend. Cooldowns are short-lived and reset on process restart. Provider will 429 again if still over limit.
- **Cooldown visible in getUsage()** — each key's usage response includes cooldown status.

#### getUsage() API Shape

- **Both overloads:** `router.getUsage()` returns all providers. `router.getUsage('google')` returns single provider. TypeScript overloads for type safety.
- **Per-provider summary with per-key breakdown** — each provider shows total + per-key detail:
  - Per key per window: promptTokens, completionTokens, totalTokens, callCount, remaining quota, percentUsed (0-100 scale), resetAt (ISO date string)
  - Per key: cooldown status (cooldown boolean, cooldownUntil ISO string, reason)
  - Per key: estimatedRecords count (how many recordings were estimation-based vs provider-confirmed)
- **Derived fields included** — remaining, percentUsed, resetAt computed from policy limits. Developer doesn't need to cross-reference policies manually.
- **JSON-serializable** — all dates as ISO strings, all values as primitives. Consistent with Phase 1 decision for future Admin UI compatibility.
- **Keys identified by index only** — no API key strings in output. Safe to log.
- **Current windows only** — no historical time-series data. History is a Phase 10/v2 concern.

#### resetUsage() Method

- `router.resetUsage(provider?, keyIndex?)` — manually clear usage counters. Optional args: reset all providers, per-provider, or per-key. Useful for testing, debugging, and limit changes.

#### Window Period Calculation

- **Centralized period calculator** — one function `getPeriodKey(window, timestamp)` that handles all window types. Single source of truth.
- **Per-minute:** Fixed 60-second boundaries (10:30:00-10:30:59). Not true sliding window. Current MemoryStorage pattern preserved.
- **Hourly:** Fixed UTC calendar hour boundaries (10:00-10:59 UTC).
- **Daily:** Fixed UTC calendar day boundaries (00:00-23:59 UTC).
- **Monthly:** Calendar month at UTC midnight. Period key derived from year+month, not duration division (accounts for variable month lengths).
- **Rolling 30-day:** Daily bucket summation. Store one counter per day. Rolling total = sum of last 30 daily buckets. Day 31 drops off automatically. Requires 30 storage entries per key per limit.
- **Lazy cleanup on access** — carried forward from Phase 2. Cleanup runs before increment/getUsage. No background timers.
- **Trust system clock** — use `Date.now()`, no special handling for clock drift or NTP jumps.
- **Window type mismatches:** Allow user-configured window types that differ from provider reality. Our policies are a routing prediction layer (Phase 3 decision), not billing protection. No warnings on mismatch.
- **Multi-window recording:** Every request increments ALL applicable windows for that key's policy in one pass.

### Claude's Discretion

- UsageTracker class internal architecture and constructor signature
- StorageBackend interface updates needed to support call counts and rolling 30-day daily buckets
- Internal Map key format changes for calendar-based periods
- How to wire the tracker into the existing Router/PolicyEngine lifecycle
- Cooldown data structure and expiration mechanism
- Exact getUsage() TypeScript return type interfaces (ProviderUsage, KeyUsage, etc.)
- requestId generation and propagation through the middleware stack
- How estimation accesses the request payload through Vercel AI SDK middleware layer

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID       | Description                                                                                                         | Research Support                                                                                                                                                                                                             |
| -------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| USAGE-01 | Router tracks token usage (prompt + completion) per API key after each request                                      | StorageBackend.increment() handles atomic recording. UsageRecord type separates promptTokens/completionTokens. Vercel AI SDK provides usage metadata in onFinish callback.                                                   |
| USAGE-03 | Router tracks multiple time windows per provider (per-minute rate limits, daily request caps, monthly token quotas) | Period calculation functions handle per-minute (fixed 60s), hourly (UTC hour), daily (UTC day), monthly (calendar month), rolling-30d (daily buckets). Multi-window recording increments all applicable windows in one pass. |
| USAGE-04 | Time windows reset correctly based on provider policy (calendar month, rolling 30 days, per-minute sliding window)  | Calendar-based period keys for monthly (year+month), daily (year+month+day). Rolling 30-day uses daily buckets with sum-of-last-30 calculation. Lazy cleanup removes expired periods.                                        |
| USAGE-06 | Router reconciles estimated vs actual token usage from provider response                                            | Pre-call estimation (char ratio or pluggable estimator) used for selection. Post-call recording uses provider-reported usage. Missing usage data falls back to estimation with `estimated: true` flag.                       |

</phase_requirements>

## Standard Stack

### Core Libraries

| Library     | Version                 | Purpose                                      | Why Standard                                                                          |
| ----------- | ----------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------- |
| node:crypto | Built-in                | UUID generation for requestId                | Crypto-secure UUIDs for deduplication. Standard Node.js API, no dependencies.         |
| node:events | Built-in                | EventEmitter for usage:recorded events       | Already used in Phase 3 for PolicyEngine. Consistent event pattern.                   |
| debug       | ^4.3.0                  | Logging for estimation and recording         | Project standard (llm-router:usage namespace). Already in dependencies.               |
| js-tiktoken | ^1.0.21 (optional peer) | Exact token counting for pluggable estimator | Pure JS port of OpenAI tiktoken. 2.8M weekly downloads. User opt-in for exact counts. |

### Supporting

| Library      | Version  | Purpose                                         | When to Use                                                            |
| ------------ | -------- | ----------------------------------------------- | ---------------------------------------------------------------------- |
| Date         | Built-in | Calendar calculations for monthly/daily windows | Standard JavaScript Date API sufficient for UTC boundary calculations. |
| Math.floor() | Built-in | Period division for fixed windows               | Per-minute and hourly use duration division. Fast integer math.        |

### Alternatives Considered

| Instead of                 | Could Use                   | Tradeoff                                                                                                  |
| -------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------- |
| Character ratio estimation | Always require js-tiktoken  | Adds 2MB+ bundle size mandatory dependency. Character ratio is 90%+ accurate for selection purposes.      |
| In-memory cooldown         | Persist cooldown to storage | Cooldowns are 60s by default. Restart resets are acceptable. Provider will 429 again if still over limit. |
| Date.now()                 | dayjs/date-fns              | Adds dependency for simple UTC boundary calculations. Built-in Date handles year+month+day keys.          |
| Manual requestId           | nanoid/ulid                 | crypto.randomUUID() is cryptographically secure and built-in. No need for custom ID schemes.              |

**Installation:**

```bash
# Core dependencies (already installed)
# debug, node:crypto, node:events are built-in or existing

# Optional peer dependency for users who want exact token counts
npm install js-tiktoken  # User opt-in
```

## Architecture Patterns

### Recommended Project Structure

```
src/
├── usage/                  # NEW: Usage tracking subsystem
│   ├── UsageTracker.ts     # Core tracker class
│   ├── estimation.ts       # Token estimation utilities
│   ├── periods.ts          # Period calculation functions
│   ├── cooldown.ts         # Cooldown state management
│   ├── types.ts            # Usage API types (ProviderUsage, KeyUsage, etc.)
│   └── index.ts            # Barrel exports
├── storage/                # EXISTING: Updated for call counts
│   ├── MemoryStorage.ts    # Update increment() signature, makeKey() for calendar periods
│   └── index.ts
├── types/
│   ├── interfaces.ts       # EXTEND: StorageBackend interface for call counts
│   ├── events.ts           # EXTEND: UsageRecordedEvent
│   └── config.ts           # EXTEND: estimation config section
└── config/
    └── index.ts            # WIRE: createRouter instantiates UsageTracker
```

### Pattern 1: Period Key Calculation (Calendar-Aware)

**What:** Single function handles all time window types with calendar-aware boundaries for monthly/daily windows.

**When to use:** Before every storage increment or getUsage call to compute the correct period identifier.

**Example:**

```typescript
// Source: Research findings + Phase 2 MemoryStorage pattern
export function getPeriodKey(window: TimeWindow, timestamp: number): string {
  const date = new Date(timestamp);

  switch (window.type) {
    case 'per-minute':
      // Fixed 60-second boundaries (10:30:00-10:30:59)
      return Math.floor(timestamp / window.durationMs).toString();

    case 'hourly':
      // UTC hour boundaries (e.g., "2026-03-13T10")
      const hour = date.toISOString().slice(0, 13); // YYYY-MM-DDTHH
      return hour;

    case 'daily':
      // UTC day boundaries (e.g., "2026-03-13")
      const day = date.toISOString().slice(0, 10); // YYYY-MM-DD
      return day;

    case 'monthly':
      // Calendar month (e.g., "2026-03")
      const month = date.toISOString().slice(0, 7); // YYYY-MM
      return month;

    case 'rolling-30d':
      // Daily buckets for summation (same as daily)
      const rollingDay = date.toISOString().slice(0, 10);
      return rollingDay;
  }
}
```

### Pattern 2: Pre-Call Estimation (Graceful Fallback)

**What:** Estimate token usage from request payload without blocking. Falls back silently on any error.

**When to use:** Before key selection in Phase 5. PolicyEngine.evaluate() already accepts estimatedTokens parameter.

**Example:**

```typescript
// Source: CONTEXT.md decisions + character ratio research
export function estimateTokens(
  request: {
    messages: Array<{ content: string }>;
    system?: string;
    maxTokens?: number;
  },
  config: {
    defaultMaxTokens: number;
    tokenEstimator?: (text: string) => number;
  },
): { prompt: number; completion: number } | null {
  try {
    // Estimate prompt tokens from messages + system
    let totalText = '';
    for (const msg of request.messages) {
      totalText += msg.content;
    }
    if (request.system) {
      totalText += request.system;
    }

    // Use custom estimator if provided, otherwise char ratio
    const estimator = config.tokenEstimator ?? defaultCharRatioEstimator;
    const promptTokens = estimator(totalText);

    // Conservative completion ceiling
    const completionTokens = request.maxTokens ?? config.defaultMaxTokens;

    return { prompt: promptTokens, completion: completionTokens };
  } catch (error) {
    // Graceful fallback — log and skip estimation
    debug('llm-router:usage')('Estimation failed: %O', error);
    return null;
  }
}

function defaultCharRatioEstimator(text: string): number {
  // ~4 characters per token (research-validated ratio)
  return Math.ceil(text.length / 4);
}
```

### Pattern 3: Post-Call Recording (Multi-Window Fire-and-Forget)

**What:** Record actual usage to all applicable windows after response arrives. Async, non-blocking.

**When to use:** After Vercel AI SDK onFinish callback fires with usage metadata.

**Example:**

```typescript
// Source: CONTEXT.md decisions + Vercel AI SDK usage tracking
export async function recordUsage(
  tracker: UsageTracker,
  requestId: string,
  provider: string,
  keyIndex: number,
  usage: { promptTokens: number; completionTokens: number } | null,
  estimation: { prompt: number; completion: number } | null,
): Promise<void> {
  // Fire-and-forget pattern — errors are debug-logged, not thrown
  try {
    // Fall back to estimation if provider didn't return usage
    const tokens = usage ?? estimation ?? { promptTokens: 0, completionTokens: 0 };
    const estimated = !usage;

    await tracker.record(provider, keyIndex, tokens, requestId, estimated);

    // Event fires regardless of storage success
    tracker.emit('usage:recorded', {
      timestamp: Date.now(),
      requestId,
      provider,
      keyIndex,
      promptTokens: tokens.promptTokens,
      completionTokens: tokens.completionTokens,
      estimated,
    });
  } catch (error) {
    // Swallow storage errors — provider enforces real limits
    debug('llm-router:usage')('Recording failed (non-fatal): %O', error);
  }
}
```

### Pattern 4: Cooldown State Management

**What:** In-memory cooldown tracking with Retry-After header parsing.

**When to use:** When 429 response received. Selection algorithm (Phase 5) checks cooldown before choosing key.

**Example:**

```typescript
// Source: 429 handling best practices research
export class CooldownManager {
  private cooldowns = new Map<string, { until: number; reason: string }>();

  setCooldown(provider: string, keyIndex: number, retryAfterHeader?: string): void {
    const key = `${provider}:${keyIndex}`;
    const defaultCooldownMs = 60_000; // 60 seconds fallback

    let cooldownMs = defaultCooldownMs;
    if (retryAfterHeader) {
      // Parse Retry-After header (seconds or HTTP date)
      const seconds = parseInt(retryAfterHeader, 10);
      if (!isNaN(seconds)) {
        cooldownMs = seconds * 1000;
      } else {
        // HTTP date format
        const retryDate = new Date(retryAfterHeader);
        if (!isNaN(retryDate.getTime())) {
          cooldownMs = retryDate.getTime() - Date.now();
        }
      }
    }

    this.cooldowns.set(key, {
      until: Date.now() + cooldownMs,
      reason: '429 rate limit',
    });
  }

  isInCooldown(provider: string, keyIndex: number): boolean {
    const key = `${provider}:${keyIndex}`;
    const cooldown = this.cooldowns.get(key);
    if (!cooldown) return false;

    if (Date.now() >= cooldown.until) {
      // Expired — clean up
      this.cooldowns.delete(key);
      return false;
    }

    return true;
  }

  getCooldown(provider: string, keyIndex: number): { until: Date; reason: string } | null {
    const key = `${provider}:${keyIndex}`;
    const cooldown = this.cooldowns.get(key);
    if (!cooldown || Date.now() >= cooldown.until) return null;

    return {
      until: new Date(cooldown.until),
      reason: cooldown.reason,
    };
  }
}
```

### Pattern 5: Rolling 30-Day Aggregation

**What:** Store daily buckets, sum last 30 to get rolling total.

**When to use:** When recording or querying usage for rolling-30d window type.

**Example:**

```typescript
// Source: Time window research + rolling period patterns
export async function getRolling30DayUsage(
  storage: StorageBackend,
  provider: string,
  keyIndex: number,
): Promise<number> {
  const now = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;

  let total = 0;

  // Sum last 30 daily buckets
  for (let i = 0; i < 30; i++) {
    const timestamp = now - i * oneDayMs;
    const dayWindow: TimeWindow = { type: 'daily', durationMs: oneDayMs };
    const dayUsage = await storage.getUsage(provider, keyIndex, dayWindow);
    total += dayUsage;
  }

  return total;
}
```

### Anti-Patterns to Avoid

- **Storing estimation results:** Never write estimated tokens to storage. Only actual provider-reported usage or fallback estimates marked with `estimated: true`.
- **Blocking on recording:** Don't await storage writes before returning API response. Fire-and-forget pattern prevents recording failures from breaking user requests.
- **Duration division for monthly windows:** Don't use `Math.floor(timestamp / monthDurationMs)` — months have variable lengths. Use calendar year+month keys.
- **Persisting cooldown state:** Don't write cooldowns to StorageBackend. In-memory is sufficient for 60s durations. Process restart resets are acceptable.
- **Pre-filtering keys by estimation:** Estimation informs selection algorithm, but doesn't block keys. Selection strategy (Phase 5) uses headroom data to pick best key, but always tries if none have enough quota.

## Don't Hand-Roll

| Problem                   | Don't Build                            | Use Instead                               | Why                                                                                                                                            |
| ------------------------- | -------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| UUID generation           | Custom ID generators, timestamp+random | `node:crypto.randomUUID()`                | Cryptographically secure, collision-resistant, built-in. Standard UUID v4 format.                                                              |
| Token counting            | Custom BPE tokenizer implementation    | js-tiktoken (user opt-in) or char ratio   | Tokenizers are complex (BPE encoding, vocab files, model-specific rules). Character ratio is 90%+ accurate for headroom checks.                |
| Retry-After parsing       | Manual header parsing with regex       | Standard parseInt() + Date constructor    | Retry-After has two formats (seconds or HTTP date). Both handled by built-in APIs. Edge cases like negative values need validation.            |
| Calendar month boundaries | Duration division or day-count math    | Date.toISOString().slice(0, 7)            | Months have 28-31 days. Year+month string key is unambiguous and handles DST/leap years correctly.                                             |
| Request deduplication     | Custom token buckets or bloom filters  | Map<requestId, boolean> with lazy cleanup | Deduplication needs exact matching (not probabilistic). Map with requestId is simple and correct. Cleanup on access prevents unbounded growth. |

**Key insight:** Time-based calculations and idempotency are deceptively complex. Month boundaries, Retry-After formats, and UUID collision resistance have edge cases that built-in APIs handle correctly. Custom implementations introduce bugs (leap years, negative cooldowns, duplicate UUIDs under load).

## Common Pitfalls

### Pitfall 1: Duration Division for Calendar Months

**What goes wrong:** Using `Math.floor(timestamp / monthDurationMs)` treats all months as 30 days, causing boundary misalignment.

**Why it happens:** Assumption that months are fixed-length periods like hours or minutes.

**How to avoid:** Use calendar-based period keys. Extract year+month from Date.toISOString() (e.g., "2026-03"). Period key changes at UTC midnight on the 1st.

**Warning signs:** Usage resets happen mid-month or span two calendar months. Tests fail on month boundaries (Jan 31 → Feb 1).

### Pitfall 2: Estimation Blocking Requests

**What goes wrong:** Estimation failure or slow estimator function delays/crashes request processing.

**Why it happens:** Treating estimation as required validation step instead of advisory hint.

**How to avoid:** Wrap estimation in try-catch. Return null on any error. Selection proceeds without estimation data. Never await external estimator calls without timeout.

**Warning signs:** Requests fail with "estimation timeout" errors. Custom estimator exceptions propagate to user.

### Pitfall 3: Recording Before Response

**What goes wrong:** Recording usage to storage before returning API response introduces latency.

**Why it happens:** Assumption that usage must be recorded synchronously for accuracy.

**How to avoid:** Fire-and-forget pattern. Return response immediately, record usage in background Promise. Storage errors are debug-logged, not thrown.

**Warning signs:** Request latency increases with storage backend slowness. Redis timeouts cause user-facing errors.

### Pitfall 4: Retry-After Header Type Confusion

**What goes wrong:** Parsing Retry-After as integer when it's an HTTP date string, or vice versa.

**Why it happens:** Retry-After has two formats: seconds (integer) or HTTP date (string). Providers use different formats.

**How to avoid:** Try parseInt() first. If NaN, parse as Date. Validate parsed timestamp is in the future. Default to 60s if both fail.

**Warning signs:** Cooldown durations are nonsensical (millions of seconds or negative). 429 responses don't trigger cooldown.

### Pitfall 5: Double-Counting from Retries

**What goes wrong:** Middleware re-entry or retry logic causes same request to increment usage multiple times.

**Why it happens:** No deduplication. Storage accepts every increment call unconditionally.

**How to avoid:** Generate requestId at middleware entry. Check if requestId already recorded before incrementing. Skip increment if duplicate detected.

**Warning signs:** Usage spikes to 2x-3x actual consumption. Quota exhausted much faster than expected.

### Pitfall 6: Rolling Window as Single Counter

**What goes wrong:** Treating rolling-30d as a single counter that resets every 30 days instead of daily bucket summation.

**Why it happens:** Misunderstanding "rolling" as "periodic with 30-day duration."

**How to avoid:** Store one counter per day. Sum last 30 daily buckets to get rolling total. Day 31 automatically drops off when querying.

**Warning signs:** Rolling 30-day usage jumps to zero at month boundaries. Doesn't gradually decrease as old days expire.

### Pitfall 7: Missing Usage Data Treated as Zero

**What goes wrong:** When provider doesn't return usage metadata, recording zero tokens instead of falling back to estimation.

**Why it happens:** Treating missing data as "no usage" instead of "unknown usage."

**How to avoid:** Check if usage object exists. If null/undefined, use pre-call estimation as fallback. Mark record with `estimated: true`.

**Warning signs:** Keys never exhaust quota despite heavy use. getUsage() shows zero tokens for successful requests.

## Code Examples

Verified patterns from research and existing codebase:

### Storage Backend Extension (Call Count Support)

```typescript
// Source: CONTEXT.md + existing StorageBackend interface
export interface StorageBackend {
  // EXISTING methods (unchanged)
  get(key: string): Promise<UsageRecord[]>;
  put(record: UsageRecord): Promise<void>;
  reset(provider: string, keyIndex: number, window: TimeWindow): Promise<void>;
  close(): Promise<void>;

  // UPDATED: increment now accepts call count
  increment(
    provider: string,
    keyIndex: number,
    tokens: { prompt: number; completion: number },
    window: TimeWindow,
    callCount?: number, // NEW: defaults to 0 (token-only increments), 1 for call tracking
  ): Promise<UsageRecord>;

  // UPDATED: getUsage returns structured data (not just totalTokens)
  getUsage(
    provider: string,
    keyIndex: number,
    window: TimeWindow,
  ): Promise<{
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    callCount: number;
  }>;
}
```

### UsageTracker Class Skeleton

```typescript
// Source: Research findings + existing PolicyEngine pattern
export class UsageTracker {
  private readonly storage: StorageBackend;
  private readonly policyEngine: PolicyEngine;
  private readonly emitter: EventEmitter;
  private readonly cooldown: CooldownManager;
  private readonly recordedRequests: Set<string>; // Deduplication

  constructor(storage: StorageBackend, policyEngine: PolicyEngine, emitter: EventEmitter) {
    this.storage = storage;
    this.policyEngine = policyEngine;
    this.emitter = emitter;
    this.cooldown = new CooldownManager();
    this.recordedRequests = new Set();
  }

  // Pre-call estimation for selection
  estimate(request: AIRequest, config: EstimationConfig): EstimationResult | null {
    // Pattern 2 implementation
  }

  // Post-call recording (multi-window)
  async record(
    provider: string,
    keyIndex: number,
    tokens: { promptTokens: number; completionTokens: number },
    requestId: string,
    estimated: boolean,
  ): Promise<void> {
    // Pattern 3 implementation
  }

  // 429 handling
  handle429(provider: string, keyIndex: number, retryAfterHeader?: string): void {
    this.cooldown.setCooldown(provider, keyIndex, retryAfterHeader);
  }

  // Developer API
  async getUsage(provider?: string): Promise<UsageSnapshot> {
    // Return all providers or single provider
  }

  async resetUsage(provider?: string, keyIndex?: number): Promise<void> {
    // Reset all, per-provider, or per-key
  }
}
```

### getUsage() Return Type

```typescript
// Source: CONTEXT.md API shape requirements
export interface KeyUsageWindow {
  type: TimeWindow['type'];
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  callCount: number;
  limit: number; // From policy
  remaining: number;
  percentUsed: number; // 0-100 scale
  resetAt: string; // ISO date string
}

export interface KeyUsage {
  keyIndex: number;
  windows: KeyUsageWindow[];
  cooldown: {
    active: boolean;
    until: string | null; // ISO date string
    reason: string | null;
  };
  estimatedRecords: number; // Count of estimation-based recordings
}

export interface ProviderUsage {
  provider: string;
  keys: KeyUsage[];
  totals: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    callCount: number;
  };
}

export interface UsageSnapshot {
  providers: ProviderUsage[];
  timestamp: string; // ISO date string
}

// TypeScript overloads
export function getUsage(): Promise<UsageSnapshot>;
export function getUsage(provider: string): Promise<ProviderUsage>;
```

### MemoryStorage makeKey() Update

```typescript
// Source: Pattern 1 + existing MemoryStorage
private makeKey(provider: string, keyIndex: number, window: TimeWindow): string {
  const period = getPeriodKey(window, Date.now());
  return `${provider}:${keyIndex}:${window.type}:${period}`;
}
```

### Estimation Config Schema Extension

```typescript
// Source: CONTEXT.md config shape + existing schema pattern
import { z } from 'zod';

export const estimationSchema = z
  .object({
    defaultMaxTokens: z.number().int().positive().default(1024),
    tokenEstimator: z.function().args(z.string()).returns(z.number()).optional(),
  })
  .default({
    defaultMaxTokens: 1024,
  });

// Add to configSchema
export const configSchema = z.object({
  version: z.literal('1.0'),
  providers: z.record(providerConfigSchema),
  strategy: strategyTypeSchema,
  budget: budgetConfigSchema,
  warningThreshold: z.number().min(0).max(1).optional(),
  estimation: estimationSchema, // NEW
});
```

## State of the Art

| Old Approach                          | Current Approach                             | When Changed                             | Impact                                                                                                |
| ------------------------------------- | -------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Duration division for all windows     | Calendar-aware period keys for monthly/daily | 2026 best practices                      | Correctly handles variable month lengths (28-31 days). No boundary misalignment.                      |
| Synchronous recording before response | Fire-and-forget async recording              | Modern async patterns                    | Zero latency impact on user requests. Storage errors don't break API calls.                           |
| Hardcoded 4 char/token ratio          | Pluggable estimator with char ratio default  | Emerging pattern in LiteLLM alternatives | Users can opt into exact counting (js-tiktoken) for precision, or use fast default for 90%+ accuracy. |
| Persistent cooldown state             | In-memory expiration                         | Ephemeral rate limit handling            | Avoids storage backend dependency for 60s cooldowns. Process restart resets are acceptable.           |
| Global request deduplication          | Per-window requestId tracking                | Idempotency best practices (2026)        | Prevents double-counting from retries while allowing same request to record to multiple windows.      |

**Deprecated/outdated:**

- **Tiktoken as required dependency:** Character ratio is sufficient for most use cases. Make tiktoken opt-in (peer dependency) to avoid 2MB+ bundle bloat.
- **Background cleanup timers:** Lazy expiration on access is simpler and equally effective. No timer overhead or shutdown coordination.
- **Storing estimation in UsageRecord.totalTokens:** Estimation never touches storage. Only actual provider-reported usage recorded.

## Open Questions

1. **Should resetAt calculation account for provider-specific reset times?**
   - What we know: Policies specify "calendar month" vs "rolling" but not timezone or hour-of-day reset
   - What's unclear: Do providers reset at UTC midnight or regional time?
   - Recommendation: Assume UTC midnight for all calendar resets. Phase 8 (Provider Catalog) will validate empirically.

2. **How to handle concurrent requests exhausting quota simultaneously?**
   - What we know: CONTEXT.md explicitly accepts race conditions. Provider 429 handles contention.
   - What's unclear: Should we emit warning when multiple requests likely to fail?
   - Recommendation: No special handling. Selection algorithm (Phase 5) uses best available data. Provider is source of truth.

3. **What if provider returns partial usage (only prompt or only completion)?**
   - What we know: UsageRecord separates prompt/completion. Reconciliation uses provider data when available.
   - What's unclear: Schema for partial usage objects from Vercel AI SDK
   - Recommendation: Treat missing field as 0. If entire usage object missing, fall back to estimation.

## Validation Architecture

### Test Framework

| Property           | Value                                   |
| ------------------ | --------------------------------------- |
| Framework          | Vitest ^2.1.8 (already in package.json) |
| Config file        | vitest.config.ts (existing)             |
| Quick run command  | `npm test -- --run usage`               |
| Full suite command | `npm test`                              |

### Phase Requirements → Test Map

| Req ID   | Behavior                                        | Test Type | Automated Command                              | File Exists? |
| -------- | ----------------------------------------------- | --------- | ---------------------------------------------- | ------------ |
| USAGE-01 | Token tracking separates prompt/completion      | unit      | `npm test -- --run usage/UsageTracker.test.ts` | ❌ Wave 0    |
| USAGE-03 | Multi-window recording increments all windows   | unit      | `npm test -- --run usage/periods.test.ts`      | ❌ Wave 0    |
| USAGE-04 | Calendar month resets at UTC midnight           | unit      | `npm test -- --run usage/periods.test.ts`      | ❌ Wave 0    |
| USAGE-04 | Rolling 30-day sums daily buckets               | unit      | `npm test -- --run usage/periods.test.ts`      | ❌ Wave 0    |
| USAGE-06 | Missing provider usage falls back to estimation | unit      | `npm test -- --run usage/UsageTracker.test.ts` | ❌ Wave 0    |

### Sampling Rate

- **Per task commit:** `npm test -- --run usage` (usage subsystem tests only)
- **Per wave merge:** `npm test` (full suite including storage integration)
- **Phase gate:** Full suite green + smoke test with MemoryStorage before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/usage/UsageTracker.test.ts` — covers USAGE-01, USAGE-06
- [ ] `src/usage/periods.test.ts` — covers USAGE-03, USAGE-04 (calendar + rolling windows)
- [ ] `src/usage/estimation.test.ts` — character ratio accuracy, pluggable estimator
- [ ] `src/usage/cooldown.test.ts` — 429 handling, Retry-After parsing
- [ ] Update `src/storage/MemoryStorage.test.ts` — call count support, calendar period keys

## Sources

### Primary (HIGH confidence)

- [Vercel AI SDK usage tracking discussion](https://github.com/vercel/ai/discussions/513) - onFinish callback pattern
- [Vercel AI SDK streaming token usage cookbook](https://ai-sdk.dev/cookbook/rsc/stream-ui-record-token-usage) - official pattern
- [js-tiktoken npm package](https://www.npmjs.com/package/js-tiktoken) - 2.8M weekly downloads, v1.0.21
- [Propel token counting guide](https://www.propelcode.ai/blog/token-counting-tiktoken-anthropic-gemini-guide-2025) - character ratio validation
- [MDN 429 Too Many Requests](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/429) - Retry-After header spec
- [Docebo API rate limit best practices](https://help.docebo.com/hc/en-us/articles/31803763436946-Best-practices-for-handling-API-rate-limits-and-429-errors) - exponential backoff
- [MDN Date reference](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date) - calendar calculations
- Existing codebase: `src/storage/MemoryStorage.ts`, `src/policy/PolicyEngine.ts`, `src/types/domain.ts`

### Secondary (MEDIUM confidence)

- [OneUpTime request deduplication](https://oneuptime.com/blog/post/2026-01-25-request-deduplication-nodejs/view) - requestId patterns
- [Shopify idempotency implementation](https://shopify.dev/docs/api/usage/implementing-idempotency) - UUID v4 + Map storage
- [Zuplo idempotency keys guide](https://zuplo.com/learning-center/implementing-idempotency-keys-in-rest-apis-a-complete-guide) - 24-48hr cache duration
- [Fundpeak time window analysis](https://www.fundpeak.com/factsheet-production-help/time-window-analysis/) - rolling period definition
- [GitHub tokenx](https://github.com/johannschopplich/tokenx) - 96% accuracy character estimation (2kB bundle)

### Tertiary (LOW confidence)

- WebSearch findings on Temporal API (future enhancement for complex calendar math)
- WebSearch findings on LLM token calculator tools (validation of 4 char/token ratio)

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - Built-in Node.js APIs, existing dependencies, verified npm packages
- Architecture: HIGH - Patterns validated in existing codebase (MemoryStorage, PolicyEngine), Vercel AI SDK official docs
- Pitfalls: HIGH - Common time-based calculation errors, verified through WebSearch + official HTTP specs
- Validation: HIGH - Existing test framework, clear requirement mapping

**Research date:** 2026-03-13
**Valid until:** 2026-04-12 (30 days for stable Node.js/TypeScript ecosystem)
