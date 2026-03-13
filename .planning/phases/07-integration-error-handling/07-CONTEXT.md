# Phase 7: Integration & Error Handling - Context

**Gathered:** 2026-03-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Router handles streaming, errors, and preserves all Vercel AI SDK features (generateText, streamText, generateObject, streamObject). Implements transparent auto-retry across keys on errors, classifies provider errors with actionable context, and emits observability events. Fallback across providers is Phase 9. Full observability hooks (DX-03) are Phase 10. Embeddings are out of scope for Phase 7.

</domain>

<decisions>
## Implementation Decisions

### Error Retry Behavior

- **Auto-retry on 429 (rate limit):** Middleware catches 429, puts key in cooldown (respecting Retry-After), selects next key, retries immediately. User never sees 429 unless ALL keys exhausted
- **Auto-retry on 401 (auth failure):** Catch 401, permanently disable that key for session, try next key. Consistent with 429 behavior
- **Retry once on network errors:** ECONNREFUSED, ETIMEDOUT, DNS failures get one retry with different key. Network errors are usually infrastructure-wide, but one retry is cheap
- **Don't retry on 500/503 (server errors):** Server errors mean provider is down, not key-specific. Short cooldown on the key (Phase 5 decision), throw ProviderError to caller
- **No mid-stream retry:** Once streaming chunks have started flowing, a failure is final. Error propagated through the stream. Partial output already consumed
- **Pre-stream retry works:** If initial stream setup (doStream() call) returns 429 before any chunks flow, retry transparently with next key, same as generateText
- **Retry timing:** Immediate with next key. Failed key goes in cooldown (Retry-After respected), but next key is fresh
- **Max retries:** Claude's discretion — likely try all available keys for the provider
- **Retry architecture:** Proxy wrapper at routerModel() level. Returns a LanguageModelV3-compatible object that intercepts doGenerate/doStream. On error, re-selects key, creates new base model, retries. Middleware stays simple (usage tracking only)
- **Debug log + key:retried event** on every successful retry. Silent to user, visible to observability
- **Final error includes all attempts:** When all retries fail, error has attempts array: [{ keyIndex, errorType, statusCode, providerMessage, retryAfter? }]. Key strings never exposed
- **Multi-step flows (maxSteps):** Same key for all steps. If key gets 429 mid-step, proxy intercepts, puts key in cooldown, retries that step with new key. Remaining steps continue with new key. Transparent to AI SDK agent loop

### Error Classification & Error Classes

- **Centralized classifier function:** classifyError(error) inspects HTTP status codes as primary signal. Status codes are universal across providers — no per-provider error message parsing. Maps to: rate_limit (429), auth (401/403), server (500/502/503), network (ECONNREFUSED/ETIMEDOUT/DNS), unknown
- **New error classes:** AuthError (401/403 bad key), ProviderError (500/503 provider down), NetworkError (connection failures). All extend LLMRouterError
- **Two error paths:**
  1. **Selection-time (pre-request):** RateLimitError / QuotaExhaustedError — all keys known-bad before API call (fast fail from Phase 5)
  2. **Runtime (post-retry):** ProviderError with `type` discriminator ('rate_limit' | 'auth' | 'server' | 'network' | 'unknown') and attempts array — tried keys, all failed
- **Always wrap in LLMRouterError:** Every provider error goes through classifier. Classifiable errors get specific classes. Unclassifiable get generic ProviderError with original as `cause`
- **Error context includes:** modelId, provider, keyIndex (never actual key), attempts array, original provider error message
- **Actionable suggestion field:** AuthError: "Verify your API key is valid". RateLimitError: "Wait until {time} or add more keys". ProviderError: "Provider {name} is experiencing issues"
- **Attempts array per-attempt detail:** { keyIndex, errorType, statusCode, providerMessage, retryAfter? }. Raw provider message included for debugging

### AI SDK Feature Passthrough

- **Tool calling:** Verify passthrough only. No special handling — wrapLanguageModel handles natively. Our middleware only wraps response, not request parameters
- **Structured output:** Verify passthrough only. generateObject/streamObject use same doGenerate/doStream underneath
- **Other features (temperature, system prompt, multi-turn, attachments):** Trust passthrough — architecture guarantees it. Request parameters flow to base model untouched
- **Accept pre-created baseModel:** routerModel(router, modelId, { baseModel }) — lets users configure provider-specific options (grounding, safety settings) before passing to router. ModelId still required alongside baseModel for provider/key tracking
- **baseModel + retry interaction:** baseModel used for first attempt only. On retry, router creates new model via ProviderRegistry with next key. Provider-specific options from baseModel NOT preserved. JSDoc warning documents this behavior
- **Text generation scope only:** generateText, streamText, generateObject, streamObject. Embeddings (embed/embedMany) deferred to later phase
- **Multi-step agent flows:** Same key for all steps (key locked per model creation). Mid-step 429 triggers retry with new key via proxy interceptor
- **Provider-specific features:** Pass through naturally. Document that provider-specific options work through the router
- **Context caching:** Transparent — cached content tokens passed to provider as-is, usage tracking records whatever provider returns
- **Callback verification:** Quick manual verification during development that onFinish etc. fire correctly through TransformStream wrapper
- **V3 interface proxy:** Only implement doGenerate and doStream with retry logic. Other V3 methods pass through as-is
- **Key-switch documentation:** Document that mid-flow key switches send full conversation history to new key (same provider, same API endpoint, different account)

### Observability Events

- **Event delivery:** Existing Node EventEmitter pattern via router.on(). All events go through router's single emitter. Proxy wrapper receives reference to router emitter
- **Granular error events:** Separate events per error type: 'error:rate_limit', 'error:auth', 'error:server', 'error:network'. Each with { provider, keyIndex, modelId, statusCode, message, requestId, timestamp }
- **Fire on each failed attempt:** error events fire per attempt, not just on final failure. Real-time visibility into retry chain
- **key:retried event:** { provider, modelId, failedKeyIndex, newKeyIndex, reason: 'rate_limit' | 'auth' | 'network', attempt, maxAttempts, requestId, timestamp }
- **request:complete event:** { provider, modelId, keyIndex, requestId, promptTokens, completionTokens, latencyMs, retries: 0, timestamp }. Fires after successful request (including after retries)
- **key:disabled event:** { provider, keyIndex, reason: 'auth_failed', statusCode: 401, timestamp }. Fires once per permanently disabled key
- **Full TypeScript typed payloads:** Define interfaces for each event: ErrorRateLimitEvent, ErrorAuthEvent, ErrorServerEvent, ErrorNetworkEvent, KeyRetriedEvent, RequestCompleteEvent, KeyDisabledEvent. Added to src/types/events.ts
- **JSON-serializable payloads:** All primitives/dates/arrays. Users can JSON.stringify() for any logging tool. Full OpenTelemetry integration is Phase 10
- **Latency tracking:** Total wall clock time (latencyMs) + retry count. Time-to-first-token deferred to Phase 10

### Claude's Discretion

- Exact proxy wrapper implementation (how it delegates to underlying model, state management)
- Max retry count logic (try all keys vs capped)
- Error classifier implementation details (regex patterns, status code mapping)
- Internal state tracking for disabled keys (Map, Set, etc.)
- How proxy wrapper receives router emitter reference
- Event constant naming in RouterEvent enum
- Exact latency measurement approach (Date.now() vs performance.now())

</decisions>

<specifics>
## Specific Ideas

- "We want to avoid integration friction" — drove the two-error-path design (selection-time vs runtime). Callers check `instanceof ProviderError` for runtime errors, not 5 different classes
- "Centralized classifier shouldn't become a maintenance burden" — status codes as primary signal, not provider-specific message parsing. Scales to any provider without per-provider code
- "Document that mid-flow key switches send conversation to different account" — transparency for users managing keys across trust levels
- "Document that provider-specific options are lost on retry with baseModel" — clear JSDoc warning
- LiteLLM reference: deployment groups with auto-retry, cooldown mechanism, key disabling on auth failures

</specifics>

<code_context>

## Existing Code Insights

### Reusable Assets

- `createRouterMiddleware` (src/wrapper/middleware.ts): Already handles generate + stream usage tracking via TransformStream. Stays simple — retry logic goes in proxy wrapper
- `RateLimitError` (src/errors/rate-limit-error.ts): Existing selection-time error with cooldownUntil per key. Preserved for pre-request failures
- `QuotaExhaustedError` (src/errors/quota-exhausted-error.ts): Existing selection-time error with nextReset per key. Preserved for pre-request failures
- `LLMRouterError` (src/errors/base.ts): Base class with code, suggestion, metadata, cause, toJSON(). All new errors extend this
- `ProviderRegistry` (src/wrapper/provider-registry.ts): Dynamic provider loading. Used by proxy wrapper to create new model instances on retry
- `routerModel()` (src/wrapper/router-model.ts): Current entry point. Will be refactored to return proxy wrapper instead of pre-bound model
- `CooldownManager` (src/usage/cooldown.ts): Manages 429-based cooldowns with exponential backoff. Proxy wrapper calls this on rate limit errors
- `Router.on/off` (src/config/index.ts): Node EventEmitter. All new events flow through this

### Established Patterns

- `debug` package with namespaces (llm-router:middleware, llm-router:registry). Add llm-router:retry for retry logic
- Fire-and-forget for events and recording (never throws to caller)
- Const objects with `as const` for event name constants (src/constants/index.ts)
- Typed event payloads in src/types/events.ts
- exactOptionalPropertyTypes — explicit undefined handling required

### Integration Points

- `routerModel()` in src/wrapper/router-model.ts — refactor to return proxy wrapper
- `createModelWrapper()` in src/wrapper/router-model.ts — update to use proxy wrapper
- `RouterEvent` constants in src/constants/index.ts — add error/retry/complete/disabled events
- `src/types/events.ts` — add new event payload interfaces
- `src/errors/` — add AuthError, ProviderError, NetworkError classes
- `src/wrapper/` — add error-classifier.ts and retry-proxy.ts (or similar)
- `Router` interface in src/config/index.ts — no changes needed (events already wired)

</code_context>

<deferred>
## Deferred Ideas

- Embeddings support (embed/embedMany) through router — separate phase or v2
- Image generation through router — out of scope (text LLMs only per PROJECT.md)
- Time-to-first-token tracking — Phase 10 observability
- OpenTelemetry spans/traces — Phase 10 (DX-03)
- Per-request callbacks ({ onRetry, onError }) — evaluate for Phase 10 or v2
- Detailed latency breakdown (firstAttemptLatencyMs, retryLatencyMs) — Phase 10
- Provider-specific error classifiers — not needed; status codes are universal
- Cached input token tracking — Phase 10+ if providers report it separately

</deferred>

---

_Phase: 07-integration-error-handling_
_Context gathered: 2026-03-13_
