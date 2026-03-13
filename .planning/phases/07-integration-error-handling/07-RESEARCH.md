# Phase 7: Integration & Error Handling - Research

**Researched:** 2026-03-13
**Domain:** Vercel AI SDK v6 integration (streaming, error handling, retry proxy, feature passthrough)
**Confidence:** HIGH

## Summary

Phase 7 builds the retry proxy wrapper, error classification system, and observability events on top of the existing Phase 6 integration. The core architecture is a `LanguageModelV3`-compatible proxy object that intercepts `doGenerate` and `doStream` calls, catches provider errors, classifies them, and retries with different API keys when appropriate. This proxy sits between the `wrapLanguageModel()` middleware layer and the real provider model instance.

The Vercel AI SDK's `APICallError` class (from `@ai-sdk/provider`) is the primary error type thrown by providers. It exposes `statusCode`, `responseHeaders` (including `retry-after`), `isRetryable`, and `responseBody`. Our error classifier maps these to router-specific error types. The AI SDK has its own retry logic at the `generateText`/`streamText` level that wraps `doGenerate`/`doStream` calls, but since our proxy IS the model, our retry happens transparently inside `doGenerate`/`doStream` before the AI SDK retry layer ever sees the error.

Feature passthrough (tool calling, structured output, multi-step agents) requires no special handling. The `wrapLanguageModel` architecture preserves all `LanguageModelV3CallOptions` -- tools, responseFormat, providerOptions, etc. -- passing them through to the underlying model's `doGenerate`/`doStream` unchanged. Our proxy preserves the same contract.

**Primary recommendation:** Build a `createRetryProxy()` function that returns a `LanguageModelV3`-compatible object. It wraps the real provider model, intercepts `doGenerate`/`doStream`, catches errors, classifies them via `classifyError()`, and retries with new keys from `ProviderRegistry`. The existing middleware layer stays unchanged (usage tracking only). Refactor `routerModel()`/`wrapModel()` to use the proxy as the base model passed to `wrapLanguageModel()`.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Error Retry Behavior:**

- Auto-retry on 429 (rate limit): Middleware catches 429, puts key in cooldown (respecting Retry-After), selects next key, retries immediately. User never sees 429 unless ALL keys exhausted
- Auto-retry on 401 (auth failure): Catch 401, permanently disable that key for session, try next key. Consistent with 429 behavior
- Retry once on network errors: ECONNREFUSED, ETIMEDOUT, DNS failures get one retry with different key. Network errors are usually infrastructure-wide, but one retry is cheap
- Don't retry on 500/503 (server errors): Server errors mean provider is down, not key-specific. Short cooldown on the key (Phase 5 decision), throw ProviderError to caller
- No mid-stream retry: Once streaming chunks have started flowing, a failure is final. Error propagated through the stream. Partial output already consumed
- Pre-stream retry works: If initial stream setup (doStream() call) returns 429 before any chunks flow, retry transparently with next key, same as generateText
- Retry timing: Immediate with next key. Failed key goes in cooldown (Retry-After respected), but next key is fresh
- Max retries: Claude's discretion -- likely try all available keys for the provider
- Retry architecture: Proxy wrapper at routerModel() level. Returns a LanguageModelV3-compatible object that intercepts doGenerate/doStream. On error, re-selects key, creates new base model, retries. Middleware stays simple (usage tracking only)
- Debug log + key:retried event on every successful retry. Silent to user, visible to observability
- Final error includes all attempts: When all retries fail, error has attempts array: [{ keyIndex, errorType, statusCode, providerMessage, retryAfter? }]. Key strings never exposed
- Multi-step flows (maxSteps): Same key for all steps. If key gets 429 mid-step, proxy intercepts, puts key in cooldown, retries that step with new key. Remaining steps continue with new key. Transparent to AI SDK agent loop

**Error Classification & Error Classes:**

- Centralized classifier function: classifyError(error) inspects HTTP status codes as primary signal. Status codes are universal across providers -- no per-provider error message parsing. Maps to: rate_limit (429), auth (401/403), server (500/502/503), network (ECONNREFUSED/ETIMEDOUT/DNS), unknown
- New error classes: AuthError (401/403 bad key), ProviderError (500/503 provider down), NetworkError (connection failures). All extend LLMRouterError
- Two error paths: (1) Selection-time (pre-request): RateLimitError / QuotaExhaustedError -- all keys known-bad before API call (fast fail from Phase 5), (2) Runtime (post-retry): ProviderError with type discriminator and attempts array -- tried keys, all failed
- Always wrap in LLMRouterError: Every provider error goes through classifier. Classifiable errors get specific classes. Unclassifiable get generic ProviderError with original as cause
- Error context includes: modelId, provider, keyIndex (never actual key), attempts array, original provider error message
- Actionable suggestion field: AuthError: "Verify your API key is valid". RateLimitError: "Wait until {time} or add more keys". ProviderError: "Provider {name} is experiencing issues"
- Attempts array per-attempt detail: { keyIndex, errorType, statusCode, providerMessage, retryAfter? }. Raw provider message included for debugging

**AI SDK Feature Passthrough:**

- Tool calling: Verify passthrough only. No special handling
- Structured output: Verify passthrough only. generateObject/streamObject use same doGenerate/doStream
- Accept pre-created baseModel: routerModel(router, modelId, { baseModel }) -- lets users configure provider-specific options before passing to router
- baseModel + retry interaction: baseModel used for first attempt only. On retry, router creates new model via ProviderRegistry with next key. Provider-specific options from baseModel NOT preserved. JSDoc warning documents this
- Text generation scope only: generateText, streamText, generateObject, streamObject
- Multi-step agent flows: Same key for all steps. Mid-step 429 triggers retry with new key via proxy interceptor
- V3 interface proxy: Only implement doGenerate and doStream with retry logic. Other V3 methods pass through as-is
- Key-switch documentation: Document that mid-flow key switches send full conversation history to new key

**Observability Events:**

- Event delivery: Existing Node EventEmitter pattern via router.on(). Proxy wrapper receives reference to router emitter
- Granular error events: Separate events per error type: 'error:rate_limit', 'error:auth', 'error:server', 'error:network'. Each with { provider, keyIndex, modelId, statusCode, message, requestId, timestamp }
- Fire on each failed attempt: error events fire per attempt, not just on final failure
- key:retried event: { provider, modelId, failedKeyIndex, newKeyIndex, reason, attempt, maxAttempts, requestId, timestamp }
- request:complete event: { provider, modelId, keyIndex, requestId, promptTokens, completionTokens, latencyMs, retries: 0, timestamp }
- key:disabled event: { provider, keyIndex, reason: 'auth_failed', statusCode: 401, timestamp }
- Full TypeScript typed payloads in src/types/events.ts
- JSON-serializable payloads
- Latency tracking: Total wall clock time (latencyMs) + retry count

### Claude's Discretion

- Exact proxy wrapper implementation (how it delegates to underlying model, state management)
- Max retry count logic (try all keys vs capped)
- Error classifier implementation details (regex patterns, status code mapping)
- Internal state tracking for disabled keys (Map, Set, etc.)
- How proxy wrapper receives router emitter reference
- Event constant naming in RouterEvent enum
- Exact latency measurement approach (Date.now() vs performance.now())

### Deferred Ideas (OUT OF SCOPE)

- Embeddings support (embed/embedMany) through router -- separate phase or v2
- Image generation through router -- out of scope (text LLMs only per PROJECT.md)
- Time-to-first-token tracking -- Phase 10 observability
- OpenTelemetry spans/traces -- Phase 10 (DX-03)
- Per-request callbacks ({ onRetry, onError }) -- evaluate for Phase 10 or v2
- Detailed latency breakdown (firstAttemptLatencyMs, retryLatencyMs) -- Phase 10
- Provider-specific error classifiers -- not needed; status codes are universal
- Cached input token tracking -- Phase 10+ if providers report it separately
  </user_constraints>

<phase_requirements>

## Phase Requirements

| ID      | Description                                                                                            | Research Support                                                                                                                                                                                         |
| ------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| INTG-02 | Wrapper preserves all AI SDK features (streaming, tool calling, structured output)                     | LanguageModelV3 proxy passes all CallOptions through unchanged; wrapLanguageModel architecture guarantees tool/responseFormat/providerOptions passthrough; baseModel option for provider-specific config |
| INTG-03 | Router classifies errors (rate limit 429, auth 401, network, quota exhausted) with actionable messages | APICallError.statusCode + responseHeaders provides all classification data; new AuthError/ProviderError/NetworkError classes; classifyError() centralized function; attempts array in final error        |
| INTG-05 | Wrapper works with both streaming and non-streaming requests                                           | Proxy intercepts both doGenerate (non-streaming) and doStream (streaming); pre-stream retry on doStream() setup errors; no mid-stream retry per decision                                                 |

</phase_requirements>

## Standard Stack

### Core

| Library          | Version    | Purpose                                         | Why Standard                                                                             |
| ---------------- | ---------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------- |
| @ai-sdk/provider | ^3.0.0     | LanguageModelV3 types, APICallError, AISDKError | Already a dependency; provides the exact error types and model interfaces we need        |
| ai               | ^6.0.0     | wrapLanguageModel, generateText, streamText     | Already a peer dependency; the middleware wrapping system is central to our architecture |
| debug            | ^4.3.0     | Debug logging with namespaces                   | Already used throughout; add `llm-router:retry` namespace                                |
| node:events      | (built-in) | EventEmitter for router events                  | Already used in createRouter(); proxy receives emitter reference                         |
| node:crypto      | (built-in) | randomUUID for requestId                        | Already used in router-model.ts                                                          |

### Supporting

| Library | Version | Purpose | When to Use                            |
| ------- | ------- | ------- | -------------------------------------- |
| (none)  | -       | -       | No new dependencies needed for Phase 7 |

### Alternatives Considered

| Instead of          | Could Use                | Tradeoff                                                                                               |
| ------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------ |
| Custom proxy object | Middleware-only approach | Middleware can't swap the underlying model on retry; proxy is required for key rotation                |
| Custom retry lib    | p-retry or similar       | Unnecessary dependency; retry logic is simple (try all keys) with no backoff (immediate with next key) |

**Installation:**

```bash
# No new packages needed - all dependencies already installed
```

## Architecture Patterns

### Recommended Project Structure

```
src/
  errors/
    base.ts                    # LLMRouterError (existing)
    config-error.ts            # ConfigError (existing)
    rate-limit-error.ts        # RateLimitError (existing, selection-time)
    quota-exhausted-error.ts   # QuotaExhaustedError (existing, selection-time)
    auth-error.ts              # NEW: AuthError (401/403, runtime)
    provider-error.ts          # NEW: ProviderError (500/502/503, runtime, also generic wrapper)
    network-error.ts           # NEW: NetworkError (ECONNREFUSED/ETIMEDOUT, runtime)
    index.ts                   # Updated: export new classes
  wrapper/
    router-model.ts            # MODIFIED: use retry proxy
    middleware.ts               # UNCHANGED: usage tracking only
    provider-registry.ts       # UNCHANGED
    error-classifier.ts        # NEW: classifyError() function
    retry-proxy.ts             # NEW: createRetryProxy() function
    index.ts                   # Updated: export new modules
  constants/
    index.ts                   # MODIFIED: add new RouterEvent constants
  types/
    events.ts                  # MODIFIED: add new event payload interfaces
    index.ts                   # Updated: export new types
```

### Pattern 1: Retry Proxy (LanguageModelV3-compatible)

**What:** A plain object implementing the `LanguageModelV3` interface that wraps `doGenerate` and `doStream` with error handling and key rotation retry logic.
**When to use:** Always -- this is THE integration pattern for Phase 7.
**Key insight:** The proxy is NOT the middleware. Middleware handles usage tracking. The proxy handles error recovery. They compose: `wrapLanguageModel({ model: retryProxy, middleware: usageMiddleware })`.

```typescript
// Source: Verified from @ai-sdk/provider LanguageModelV3 type definition (node_modules)
import type {
  LanguageModelV3,
  LanguageModelV3CallOptions,
  LanguageModelV3GenerateResult,
  LanguageModelV3StreamResult,
} from '@ai-sdk/provider';

interface RetryProxyOptions {
  provider: string;
  modelName: string;
  modelId: string; // full "provider/model" format
  initialModel: LanguageModelV3;
  initialKeyIndex: number;
  getNextKey: (
    provider: string,
    excludeKeys: number[],
  ) => Promise<{
    keyIndex: number;
    key: string;
    model: LanguageModelV3;
  } | null>;
  onError: (attempt: AttemptRecord) => void;
  onRetry: (info: RetryInfo) => void;
  onKeyDisabled: (info: KeyDisabledInfo) => void;
  cooldownManager: CooldownManager;
  disabledKeys: Set<string>; // "provider:keyIndex" format
}

function createRetryProxy(options: RetryProxyOptions): LanguageModelV3 {
  let currentModel = options.initialModel;
  let currentKeyIndex = options.initialKeyIndex;

  return {
    specificationVersion: 'v3',
    provider: 'llm-router',
    modelId: options.modelId,
    supportedUrls: currentModel.supportedUrls,

    async doGenerate(params: LanguageModelV3CallOptions): Promise<LanguageModelV3GenerateResult> {
      const attempts: AttemptRecord[] = [];
      const triedKeys = new Set<number>();

      while (true) {
        triedKeys.add(currentKeyIndex);
        try {
          const result = await currentModel.doGenerate(params);
          // Success -- emit request:complete
          return result;
        } catch (error) {
          const classified = classifyError(error);
          attempts.push(makeAttempt(currentKeyIndex, classified));
          options.onError(attempts[attempts.length - 1]!);

          if (!shouldRetry(classified, triedKeys, options)) {
            throw buildFinalError(options, classified, attempts);
          }

          // Handle key state (cooldown, disable)
          handleKeyState(options, currentKeyIndex, classified);

          // Get next key
          const next = await options.getNextKey(options.provider, [...triedKeys]);
          if (!next) {
            throw buildFinalError(options, classified, attempts);
          }

          options.onRetry({
            /* ... */
          });
          currentModel = next.model;
          currentKeyIndex = next.keyIndex;
        }
      }
    },

    async doStream(params: LanguageModelV3CallOptions): Promise<LanguageModelV3StreamResult> {
      // Same retry logic as doGenerate for the setup phase
      // Once doStream() returns successfully, the stream is live
      // No mid-stream retry (per decision)
      // ... identical try/catch pattern around doStream()
    },
  };
}
```

### Pattern 2: Error Classification

**What:** A pure function that inspects any error and returns a classification with all relevant metadata extracted.
**When to use:** Called in the retry proxy's catch blocks.

```typescript
// Source: Verified from @ai-sdk/provider APICallError class (node_modules)
import { APICallError } from '@ai-sdk/provider';

type ErrorType = 'rate_limit' | 'auth' | 'server' | 'network' | 'unknown';

interface ClassifiedError {
  type: ErrorType;
  statusCode?: number;
  retryAfter?: string; // From Retry-After header
  message: string;
  original: unknown;
  retryable: boolean; // Whether OUR proxy should retry with a different key
}

function classifyError(error: unknown): ClassifiedError {
  // 1. Check for APICallError (AI SDK provider errors with HTTP status)
  if (error instanceof Error && APICallError.isInstance(error)) {
    const statusCode = error.statusCode;
    const retryAfter = error.responseHeaders?.['retry-after'];

    if (statusCode === 429) {
      return {
        type: 'rate_limit',
        statusCode,
        retryAfter,
        message: error.message,
        original: error,
        retryable: true,
      };
    }
    if (statusCode === 401 || statusCode === 403) {
      return { type: 'auth', statusCode, message: error.message, original: error, retryable: true };
    }
    if (statusCode !== undefined && statusCode >= 500) {
      return {
        type: 'server',
        statusCode,
        message: error.message,
        original: error,
        retryable: false,
      };
    }
  }

  // 2. Check for network errors (Node.js system errors)
  if (error instanceof Error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (
      code === 'ECONNREFUSED' ||
      code === 'ETIMEDOUT' ||
      code === 'ENOTFOUND' ||
      code === 'ECONNRESET' ||
      code === 'EAI_AGAIN'
    ) {
      return { type: 'network', message: error.message, original: error, retryable: true };
    }
  }

  // 3. Unknown
  return {
    type: 'unknown',
    message: error instanceof Error ? error.message : String(error),
    original: error,
    retryable: false,
  };
}
```

### Pattern 3: Retry Decision Logic

**What:** Determines whether to retry based on error type, number of attempts, and available keys.
**When to use:** Inside the retry proxy catch block.

```typescript
function shouldRetry(
  classified: ClassifiedError,
  triedKeys: Set<number>,
  options: RetryProxyOptions,
): boolean {
  // Never retry server errors (per decision)
  if (classified.type === 'server') return false;

  // Never retry unknown errors
  if (classified.type === 'unknown') return false;

  // Network errors: retry once only (per decision)
  if (classified.type === 'network') {
    return triedKeys.size <= 1; // Only retry if this was the first attempt
  }

  // Rate limit (429) and auth (401/403): try all available keys
  // The getNextKey() function handles finding available keys
  return classified.retryable;
}
```

### Pattern 4: Key State Management on Error

**What:** Updates cooldown and disabled-keys state based on error type.
**When to use:** After classifying an error, before retrying.

```typescript
function handleKeyState(
  options: RetryProxyOptions,
  keyIndex: number,
  classified: ClassifiedError,
): void {
  if (classified.type === 'rate_limit') {
    // Put key in cooldown (respecting Retry-After)
    options.cooldownManager.setCooldown(options.provider, keyIndex, classified.retryAfter);
  } else if (classified.type === 'auth') {
    // Permanently disable key for session
    options.disabledKeys.add(`${options.provider}:${keyIndex}`);
    options.onKeyDisabled({
      provider: options.provider,
      keyIndex,
      reason: 'auth_failed',
      statusCode: classified.statusCode,
    });
  }
  // Server and network errors: no persistent key state change
  // (Server errors already handled by Phase 5 cooldown)
}
```

### Pattern 5: LanguageModelV3 Proxy Property Delegation

**What:** The proxy must implement the full LanguageModelV3 interface. Read-only properties are forwarded from the initial model.
**When to use:** When constructing the proxy object.

```typescript
// Source: Verified from @ai-sdk/provider LanguageModelV3 type definition
// LanguageModelV3 has exactly these properties:
// - specificationVersion: 'v3'       (readonly, literal)
// - provider: string                 (readonly)
// - modelId: string                  (readonly)
// - supportedUrls: Promise<...> | Record<...>  (read from initial model)
// - doGenerate(options): Promise<GenerateResult>  (intercepted by proxy)
// - doStream(options): Promise<StreamResult>      (intercepted by proxy)
```

### Anti-Patterns to Avoid

- **Middleware-based retry:** The middleware `wrapGenerate`/`wrapStream` hooks receive a `doGenerate` function bound to the current model. You CANNOT swap the model from within middleware. Retry with a different key requires a proxy that creates new model instances.
- **Double retry with AI SDK:** If our proxy throws an `APICallError` with `isRetryable: true`, the AI SDK's own retry mechanism will also retry. Our proxy must throw `LLMRouterError` subclasses (not `APICallError`) so the AI SDK does not double-retry.
- **Catching errors after stream starts:** Once `doStream()` returns a `ReadableStream` and chunks start flowing, catching errors in the stream transform is too late for retry. The consumer already has partial data. Only retry if `doStream()` itself throws (before any chunks).
- **Mutating provider or modelId on retry:** The proxy's `provider` and `modelId` properties are read by the AI SDK for telemetry. They should stay constant (`'llm-router'` and the original modelId) even after key switches. The underlying provider model changes, but the proxy identity does not.

## Don't Hand-Roll

| Problem                      | Don't Build               | Use Instead                                                                                 | Why                                                                                     |
| ---------------------------- | ------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| HTTP status code extraction  | Custom HTTP error parsing | `APICallError.isInstance()` + `.statusCode` + `.responseHeaders`                            | AI SDK's error type is the standard; all providers throw `APICallError` for HTTP errors |
| Retry-After header parsing   | Custom header parser      | `CooldownManager.setCooldown()` (already parses Retry-After)                                | Already built in Phase 4; supports both seconds and HTTP date formats                   |
| Error wrapping/serialization | Custom error base class   | Extend `LLMRouterError` (already has `toJSON()`, `code`, `suggestion`, `metadata`, `cause`) | Phase 1 built a robust error hierarchy                                                  |
| Event emission               | Custom pub/sub            | `EventEmitter` via `router.on()` (already wired)                                            | Phase 1 established the pattern; just emit new event names                              |
| Key selection                | Custom selection in proxy | Reuse `KeySelector.selectKey()` or `router.model()`                                         | Phase 5 built the full selection pipeline with strategy/cooldown/policy integration     |

**Key insight:** Phase 7 is primarily a composition phase. The retry proxy composes existing components (CooldownManager, ProviderRegistry, KeySelector, EventEmitter) with new error classification logic. Minimal new infrastructure is needed.

## Common Pitfalls

### Pitfall 1: Double Retry with AI SDK

**What goes wrong:** The proxy throws a retryable `APICallError`, then the AI SDK's `generateText`/`streamText` also retries the same call, causing up to `maxRetries * ourRetries` total attempts.
**Why it happens:** The AI SDK checks `APICallError.isInstance(error) && error.isRetryable` to decide whether to retry.
**How to avoid:** Always throw `LLMRouterError` subclasses (AuthError, ProviderError, NetworkError) from the proxy. These are NOT `APICallError` instances, so `APICallError.isInstance()` returns false and the AI SDK will not retry.
**Warning signs:** Seeing more API calls than expected in provider dashboards; retry events firing more than the number of configured keys.

### Pitfall 2: Stream Error vs Setup Error

**What goes wrong:** Attempting to retry after streaming has begun, corrupting the output.
**Why it happens:** `doStream()` can fail in two ways: (1) the initial HTTP request fails (throws from `doStream()` itself), or (2) the HTTP request succeeds but the stream later errors (error chunk in `ReadableStream`).
**How to avoid:** Only retry if `doStream()` throws synchronously/rejects its promise. Once `doStream()` returns a `LanguageModelV3StreamResult`, do NOT attempt retry. Stream errors propagate naturally.
**Warning signs:** Garbled output, duplicate content, missing content, or TypeError on stream operations.

### Pitfall 3: exactOptionalPropertyTypes in Error Classes

**What goes wrong:** TypeScript compilation fails when constructing error objects with optional fields.
**Why it happens:** The project uses `exactOptionalPropertyTypes: true`, which means you cannot assign `undefined` to an optional property. You must conditionally include the property.
**How to avoid:** Use the established pattern: `if (value !== undefined) { obj.field = value; }` or spread syntax `...(value !== undefined ? { field: value } : {})`.
**Warning signs:** TypeScript error "Type 'X | undefined' is not assignable to type 'X'".

### Pitfall 4: APICallError.isInstance() vs instanceof

**What goes wrong:** Using `error instanceof APICallError` fails across package boundaries because of Symbol-based marker checking.
**Why it happens:** The AI SDK uses `Symbol.for()` markers instead of `instanceof` for cross-package compatibility. Multiple copies of `@ai-sdk/provider` in node_modules would break `instanceof`.
**How to avoid:** Always use `APICallError.isInstance(error)` to check error types, never `error instanceof APICallError`.
**Warning signs:** Error classification always returning 'unknown'; retry never triggering on 429s.

### Pitfall 5: Proxy supportedUrls Staleness

**What goes wrong:** The proxy caches `supportedUrls` from the initial model, but after a key switch, the new model might have different URLs (unlikely but possible with different API key tiers).
**Why it happens:** `supportedUrls` is read once from the initial model and set as a property on the proxy.
**How to avoid:** This is acceptable for v1 since all keys are for the same provider/model. `supportedUrls` is provider-determined, not key-determined. Document this assumption.
**Warning signs:** None expected in practice.

### Pitfall 6: Fire-and-Forget Event Emission in Proxy

**What goes wrong:** Event emission throws, crashing the retry loop.
**Why it happens:** EventEmitter throws if a listener throws, and the error propagates synchronously.
**How to avoid:** Wrap all `emitter.emit()` calls in try-catch within the proxy, matching the existing fire-and-forget pattern throughout the codebase.
**Warning signs:** Unhandled exceptions from event listeners crashing LLM calls.

### Pitfall 7: Network Error Detection

**What goes wrong:** Network errors from `fetch()` in Node.js may not have `.code` property. Modern `fetch()` throws `TypeError` for network failures.
**Why it happens:** Node.js `fetch()` (undici) throws `TypeError` for network errors, not `Error` with `.code`. The `.cause` may contain the system error with `.code`.
**How to avoid:** Check both the error's `.code` property AND the error's `.cause?.code` property for Node.js system error codes. Also check for `TypeError` with network-related messages.
**Warning signs:** Network errors classified as 'unknown' instead of 'network'.

## Code Examples

Verified patterns from the actual codebase and AI SDK source:

### Extracting Retry-After from APICallError

```typescript
// Source: Verified from @ai-sdk/provider APICallError class (node_modules/@ai-sdk/provider/dist/index.js:86-115)
import { APICallError } from '@ai-sdk/provider';

function extractRetryAfter(error: unknown): string | undefined {
  if (error instanceof Error && APICallError.isInstance(error)) {
    // responseHeaders is Record<string, string> | undefined
    return error.responseHeaders?.['retry-after'];
  }
  return undefined;
}
```

### Building Typed Event Payloads

```typescript
// Source: Existing pattern from src/types/events.ts
// New event type following established convention
interface ErrorRateLimitEvent extends RouterEventPayload {
  provider: string;
  keyIndex: number;
  modelId: string;
  statusCode: number;
  message: string;
}

// Emit with fire-and-forget pattern (existing convention from middleware.ts)
try {
  emitter.emit('error:rate_limit', {
    provider,
    keyIndex,
    modelId,
    statusCode: 429,
    message: classified.message,
    requestId,
    timestamp: Date.now(),
  });
} catch {
  // Fire-and-forget: never let event emission break the retry loop
}
```

### Error Class with exactOptionalPropertyTypes

```typescript
// Source: Pattern from src/errors/config-error.ts and rate-limit-error.ts
import { LLMRouterError } from './base.js';

interface AttemptRecord {
  keyIndex: number;
  errorType: string;
  statusCode?: number;
  providerMessage: string;
  retryAfter?: string;
}

export class ProviderError extends LLMRouterError {
  public readonly errorType: 'rate_limit' | 'auth' | 'server' | 'network' | 'unknown';
  public readonly attempts: AttemptRecord[];

  constructor(
    provider: string,
    errorType: 'rate_limit' | 'auth' | 'server' | 'network' | 'unknown',
    attempts: AttemptRecord[],
    options?: { cause?: Error },
  ) {
    const superOptions: {
      code: string;
      suggestion: string;
      metadata: Record<string, unknown>;
      cause?: Error;
    } = {
      code: `PROVIDER_${errorType.toUpperCase()}`,
      suggestion: getSuggestion(provider, errorType),
      metadata: { provider, errorType, attempts },
    };
    if (options?.cause !== undefined) {
      superOptions.cause = options.cause;
    }

    super(`Provider ${provider} error: ${errorType}`, superOptions);
    this.name = 'ProviderError';
    this.errorType = errorType;
    this.attempts = attempts;
  }
}
```

### Proxy with Key Rotation on doGenerate

```typescript
// Simplified example -- actual implementation will be more complete
// Source: LanguageModelV3 interface from @ai-sdk/provider/dist/index.d.ts:1987-2029

const proxy: LanguageModelV3 = {
  specificationVersion: 'v3' as const,
  provider: 'llm-router',
  modelId: 'google/gemini-2.0-flash',
  supportedUrls: initialModel.supportedUrls,

  async doGenerate(params) {
    const startTime = Date.now();
    const attempts: AttemptRecord[] = [];
    const triedKeys = new Set<number>([initialKeyIndex]);

    let model = initialModel;
    let keyIndex = initialKeyIndex;

    while (true) {
      try {
        const result = await model.doGenerate(params);
        // Emit request:complete with latency
        emitter.emit('request:complete', {
          provider,
          modelId,
          keyIndex,
          requestId,
          promptTokens: Number(result.usage?.inputTokens?.total) || 0,
          completionTokens: Number(result.usage?.outputTokens?.total) || 0,
          latencyMs: Date.now() - startTime,
          retries: attempts.length,
          timestamp: Date.now(),
        });
        return result;
      } catch (error) {
        const classified = classifyError(error);
        attempts.push({
          keyIndex,
          errorType: classified.type,
          statusCode: classified.statusCode,
          providerMessage: classified.message,
          ...(classified.retryAfter !== undefined ? { retryAfter: classified.retryAfter } : {}),
        });

        // Emit per-attempt error event
        emitErrorEvent(emitter, classified, { provider, keyIndex, modelId, requestId });

        // Handle key state
        if (classified.type === 'rate_limit') {
          cooldownManager.setCooldown(provider, keyIndex, classified.retryAfter);
        } else if (classified.type === 'auth') {
          disabledKeys.add(`${provider}:${keyIndex}`);
          emitter.emit('key:disabled', {
            provider,
            keyIndex,
            reason: 'auth_failed',
            statusCode: classified.statusCode,
            timestamp: Date.now(),
          });
        }

        // Check if should retry
        if (!shouldRetry(classified, triedKeys)) {
          throw buildFinalError(provider, modelId, classified, attempts, error);
        }

        // Get next key (excludes tried + disabled + cooldown keys)
        const next = await getNextKey(provider, triedKeys, disabledKeys);
        if (!next) {
          throw buildFinalError(provider, modelId, classified, attempts, error);
        }

        triedKeys.add(next.keyIndex);
        model = next.model;
        keyIndex = next.keyIndex;

        // Emit key:retried event
        emitter.emit('key:retried', {
          provider,
          modelId,
          failedKeyIndex: attempts[attempts.length - 1]!.keyIndex,
          newKeyIndex: next.keyIndex,
          reason: classified.type,
          attempt: attempts.length,
          maxAttempts: totalAvailableKeys,
          requestId,
          timestamp: Date.now(),
        });
      }
    }
  },

  async doStream(params) {
    // Same retry pattern as doGenerate
    // The doStream() call itself may throw (setup error) -- retry that
    // Once it returns a stream, no retry possible
  },
};
```

### Refactored wrapModel() using Proxy

```typescript
// Source: Existing src/config/index.ts wrapModel implementation
wrapModel: async (modelId, opts) => {
  const selection = await routerImpl.model(modelId, opts);
  const provider = modelId.substring(0, modelId.indexOf('/'));
  const modelName = modelId.substring(modelId.indexOf('/') + 1);
  const requestId = opts?.requestId ?? randomUUID();

  const registry = await getProviderRegistry();
  const initialModel = createProviderInstance(registry, provider, modelName, selection.key);

  // NEW: Create retry proxy wrapping the initial model
  const retryProxy = createRetryProxy({
    provider,
    modelName,
    modelId,
    initialModel,
    initialKeyIndex: selection.keyIndex,
    getNextKey: async (prov, excludeKeys) => {
      // Re-select from available keys, excluding tried ones
      // Uses KeySelector logic, filtering out excluded keys
      // Returns null if no keys available
    },
    onError: (attempt) => { /* emit error event */ },
    onRetry: (info) => { /* emit key:retried event */ },
    onKeyDisabled: (info) => { /* emit key:disabled event */ },
    cooldownManager: usageTracker.getCooldownManager(),
    disabledKeys: sessionDisabledKeys,  // Shared Set across proxy instances
    emitter,
    requestId,
  });

  // Middleware wraps the retry proxy (not the raw model)
  const middleware = createRouterMiddleware({
    provider,
    keyIndex: selection.keyIndex,  // Initial key -- middleware tracks usage
    model: modelName,
    tracker: usageTracker,
    requestId,
  });

  const wrappedModel = wrapLanguageModel({
    model: retryProxy,   // <-- proxy, not raw baseModel
    middleware,
    modelId,
    providerId: 'llm-router',
  });
  return wrappedModel;
},
```

## State of the Art

| Old Approach                  | Current Approach                                                   | When Changed                            | Impact                                                            |
| ----------------------------- | ------------------------------------------------------------------ | --------------------------------------- | ----------------------------------------------------------------- |
| LanguageModelV1               | LanguageModelV3                                                    | AI SDK v6 (already migrated in Phase 6) | V3 types used throughout; doGenerate/doStream signatures match V3 |
| `result.usage.promptTokens`   | `result.usage.inputTokens.total`                                   | AI SDK v6                               | Already handled in middleware with Number() guards                |
| `instanceof` for error checks | `APICallError.isInstance()`                                        | AI SDK v4+                              | Symbol-based markers for cross-package compatibility              |
| Manual error wrapping         | `APICallError` with `statusCode`, `responseHeaders`, `isRetryable` | AI SDK v4+                              | Standard error shape from all AI SDK providers                    |

**Deprecated/outdated:**

- Nothing in current stack is deprecated. AI SDK v6 is the current stable release.

## Open Questions

1. **Middleware keyIndex tracking after retry**
   - What we know: The middleware is created with `keyIndex: selection.keyIndex` before the proxy exists. If the proxy retries with a different key, the middleware still tracks usage against the original keyIndex.
   - What's unclear: Should usage be tracked against the key that actually succeeded, or the initially selected key?
   - Recommendation: **Track against the successful key.** The retry proxy should update a mutable keyIndex reference that the middleware reads, OR the middleware should be refactored to receive keyIndex from the result metadata. Since the middleware's `wrapGenerate` runs AFTER `doGenerate` returns (from the proxy, which already retried), the middleware could check a shared state. Simplest approach: pass a mutable `{ keyIndex: number }` object to both proxy and middleware.

2. **Session-scoped disabled keys storage**
   - What we know: Auth-failed keys should be disabled for the session. The CONTEXT.md says "permanently disable that key for session."
   - What's unclear: Where does the disabled-keys `Set` live? Per-router instance? Per-proxy instance?
   - Recommendation: **Per-router instance.** Create a `Set<string>` in `createRouter()` scope (alongside `providerRegistry`). All proxy instances created by `wrapModel()` share the same Set. This ensures a key disabled during one call stays disabled for subsequent calls.

3. **getNextKey implementation approach**
   - What we know: The proxy needs to get another key when the current one fails. The KeySelector already handles selection with cooldown/policy awareness.
   - What's unclear: Should the proxy call `keySelector.selectKey()` directly (which evaluates all keys including tried ones), or should we add a method that excludes specific keys?
   - Recommendation: **Add an `excludeKeys` filter.** The simplest approach is to have the proxy call `router.model()` and check if the returned keyIndex is in the tried set. If it is, the provider is exhausted. Alternatively, provide a list of key indices to exclude during candidate building in KeySelector. The former is simpler and avoids modifying KeySelector.

## Validation Architecture

### Test Framework

| Property           | Value                               |
| ------------------ | ----------------------------------- |
| Framework          | vitest 2.1.8                        |
| Config file        | vitest.config.ts                    |
| Quick run command  | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run`                    |

### Phase Requirements -> Test Map

| Req ID  | Behavior                                          | Test Type | Automated Command                                                     | File Exists? |
| ------- | ------------------------------------------------- | --------- | --------------------------------------------------------------------- | ------------ |
| INTG-02 | Tool calling passes through proxy unchanged       | smoke     | `npx tsc --noEmit` (type check that proxy implements LanguageModelV3) | No -- Wave 0 |
| INTG-02 | Structured output (responseFormat) passes through | smoke     | `npx tsc --noEmit`                                                    | No -- Wave 0 |
| INTG-03 | classifyError maps 429 to rate_limit              | unit      | `npx vitest run tests/error-classifier.test.ts -t "429" -x`           | No -- Wave 0 |
| INTG-03 | classifyError maps 401 to auth                    | unit      | `npx vitest run tests/error-classifier.test.ts -t "401" -x`           | No -- Wave 0 |
| INTG-03 | classifyError maps ECONNREFUSED to network        | unit      | `npx vitest run tests/error-classifier.test.ts -t "network" -x`       | No -- Wave 0 |
| INTG-03 | Error classes have actionable suggestions         | unit      | `npx vitest run tests/error-classifier.test.ts -t "suggestion" -x`    | No -- Wave 0 |
| INTG-05 | doGenerate retries on 429 with next key           | unit      | `npx vitest run tests/retry-proxy.test.ts -t "doGenerate retry" -x`   | No -- Wave 0 |
| INTG-05 | doStream retries on setup error                   | unit      | `npx vitest run tests/retry-proxy.test.ts -t "doStream retry" -x`     | No -- Wave 0 |
| INTG-05 | doStream does NOT retry after chunks flow         | unit      | `npx vitest run tests/retry-proxy.test.ts -t "no mid-stream" -x`      | No -- Wave 0 |

### Sampling Rate

- **Per task commit:** `npx tsc --noEmit && npx vitest run`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/error-classifier.test.ts` -- covers INTG-03 (error classification)
- [ ] `tests/retry-proxy.test.ts` -- covers INTG-05 (retry with mock models)
- [ ] Note: Per CLAUDE.md, "Build first, test later" -- tests only if plan requires them or to catch real bugs. Wave 0 test files are optional during implementation; `tsc --noEmit` is the primary verification.

## Sources

### Primary (HIGH confidence)

- `@ai-sdk/provider` v3.0.0 types (node_modules/@ai-sdk/provider/dist/index.d.ts) -- LanguageModelV3, APICallError, LanguageModelV3CallOptions, LanguageModelV3StreamResult, LanguageModelV3GenerateResult
- `@ai-sdk/provider` v3.0.0 implementation (node_modules/@ai-sdk/provider/dist/index.js:86-115) -- APICallError constructor with isRetryable default logic (408, 409, 429, >=500)
- `ai` v6.0.0 implementation (node_modules/ai/dist/index.mjs:11904-11957) -- wrapLanguageModel() implementation showing how middleware wraps doGenerate/doStream
- `ai` v6.0.0 retry logic (node_modules/ai/dist/index.mjs:2555-2615) -- retryWithExponentialBackoffRespectingRetryHeaders showing AI SDK's own retry mechanism
- `ai` v6.0.0 generateText (node_modules/ai/dist/index.mjs:4278-4330) -- shows retry() wrapping stepModel.doGenerate()
- Existing codebase: src/wrapper/router-model.ts, src/wrapper/middleware.ts, src/wrapper/provider-registry.ts, src/errors/\*.ts, src/usage/cooldown.ts, src/usage/UsageTracker.ts, src/config/index.ts, src/constants/index.ts, src/types/events.ts, src/selection/KeySelector.ts

### Secondary (MEDIUM confidence)

- None needed -- all findings verified from source code

### Tertiary (LOW confidence)

- None

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH -- all libraries already in use, verified from node_modules
- Architecture: HIGH -- proxy pattern verified against LanguageModelV3 interface and wrapLanguageModel implementation
- Pitfalls: HIGH -- double-retry risk verified from AI SDK retry source code; APICallError.isInstance() pattern verified; exactOptionalPropertyTypes pattern established across codebase
- Error classification: HIGH -- APICallError shape verified from source; statusCode/responseHeaders/isRetryable confirmed

**Research date:** 2026-03-13
**Valid until:** 2026-04-13 (stable -- AI SDK v6 is current, project dependencies locked)
