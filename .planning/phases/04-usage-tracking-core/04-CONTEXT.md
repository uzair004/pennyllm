# Phase 4: Usage Tracking Core - Context

**Gathered:** 2026-03-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Accurately record token consumption and API call counts across multiple time windows (per-minute, hourly, daily, monthly, rolling-30d) with correct reset behavior. Includes pre-call estimation for key selection headroom checks, post-call recording with reconciliation, and a developer-facing getUsage() API. Selection algorithms are Phase 5. Fallback behavior is Phase 9. Provider-specific limit data is Phase 8.

</domain>

<decisions>
## Implementation Decisions

### Pre-Call Estimation Strategy

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
- **Estimation accuracy:** Debug-logged only (pennyllm:usage namespace). No events for estimation accuracy. Actuals always overwrite — if estimate was wildly off, no special handling.

### Estimation Config Shape

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

### Post-Call Recording & Reconciliation

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

### Key Cooldown (429 Handling)

- **429 triggers cooldown** — when a key receives a 429, mark it as temporarily unavailable.
- **Duration:** Use `Retry-After` header if present, otherwise fall back to a configurable default (e.g., 60 seconds).
- **In-memory only** — cooldown state is not persisted to storage backend. Cooldowns are short-lived and reset on process restart. Provider will 429 again if still over limit.
- **Cooldown visible in getUsage()** — each key's usage response includes cooldown status.

### getUsage() API Shape

- **Both overloads:** `router.getUsage()` returns all providers. `router.getUsage('google')` returns single provider. TypeScript overloads for type safety.
- **Per-provider summary with per-key breakdown** — each provider shows total + per-key detail:
  - Per key per window: promptTokens, completionTokens, totalTokens, callCount, remaining quota, percentUsed (0-100 scale), resetAt (ISO date string)
  - Per key: cooldown status (cooldown boolean, cooldownUntil ISO string, reason)
  - Per key: estimatedRecords count (how many recordings were estimation-based vs provider-confirmed)
- **Derived fields included** — remaining, percentUsed, resetAt computed from policy limits. Developer doesn't need to cross-reference policies manually.
- **JSON-serializable** — all dates as ISO strings, all values as primitives. Consistent with Phase 1 decision for future Admin UI compatibility.
- **Keys identified by index only** — no API key strings in output. Safe to log.
- **Current windows only** — no historical time-series data. History is a Phase 10/v2 concern.

### resetUsage() Method

- `router.resetUsage(provider?, keyIndex?)` — manually clear usage counters. Optional args: reset all providers, per-provider, or per-key. Useful for testing, debugging, and limit changes.

### Window Period Calculation

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

</decisions>

<specifics>
## Specific Ideas

- "Make sure our pre-estimation doesn't become a blocker or headache for user" — drove all estimation decisions toward graceful fallback, never-blocking behavior
- Estimation should be invisible to users by default — zero config, just works
- LiteLLM comparison: they don't pre-estimate, relying on 429 + cooldown instead. We add lightweight estimation as an improvement while keeping their cooldown pattern as a safety net
- Phase 3 established that our policies are a "routing prediction layer, not billing protection" — this principle carries through to estimation (advisory, not enforcing)

</specifics>

<code_context>

## Existing Code Insights

### Reusable Assets

- `StorageBackend.increment()` (src/types/interfaces.ts): accepts provider, keyIndex, tokens, window — needs extension for call counts
- `StorageBackend.getUsage()` (src/types/interfaces.ts): returns total tokens — needs extension for granular data (prompt/completion/calls)
- `MemoryStorage` (src/storage/MemoryStorage.ts): working implementation with composite keys, lazy cleanup, atomic synchronous increment
- `PolicyEngine.evaluate()` (src/policy/PolicyEngine.ts): already accepts `estimatedTokens` parameter — wiring point for pre-call estimation
- `UsageRecord` type (src/types/domain.ts): has promptTokens, completionTokens, totalTokens, estimated flag
- `UsageRecordedEvent` type (src/types/events.ts): already defined — wire up after recording
- `TimeWindow` type (src/types/domain.ts): defines window types — centralized period calculator will use this

### Established Patterns

- Const objects with `as const` for enums (src/constants/index.ts) — new constants for estimation config
- Zod validation with `.default()` for config schema (src/config/schema.ts) — add estimation section
- `debug` package with namespaces (pennyllm:usage for tracker, pennyllm:storage for storage)
- EventEmitter pattern with typed events (src/types/events.ts)
- Async fire-and-forget for events (Phase 1 decision)
- Eager validation at createRouter() (Phase 1 decision)

### Integration Points

- `createRouter()` in src/config/index.ts — needs to instantiate UsageTracker, wire estimation
- `router.getUsage()` stub in createRouter — needs real implementation
- `configSchema` in src/config/schema.ts — add estimation section
- `Router` interface in src/config/index.ts — update getUsage() return type, add resetUsage()
- `MemoryStorage.makeKey()` — needs update for calendar-based period calculation (monthly, rolling-30d)
- `MemoryStorage.increment()` — needs call count support
- `MemoryStorage.getUsage()` — needs to return granular data (prompt/completion/calls), not just totalTokens

</code_context>

<deferred>
## Deferred Ideas

- Historical time-series data in getUsage() — Phase 10 (observability) or v2 (Admin UI)
- Per-provider estimation overrides — not needed, custom estimator function covers this
- Rolling average completion estimation (learning from past completions) — future enhancement if char ratio proves insufficient
- Persistent cooldown state for multi-process deployments — Phase 10 with Redis adapter
- In-flight request counting for concurrency coordination — deferred, accept race conditions

</deferred>

---

_Phase: 04-usage-tracking-core_
_Context gathered: 2026-03-13_
