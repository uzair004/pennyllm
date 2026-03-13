# Phase 6: Base Router Integration - Research

**Researched:** 2026-03-13
**Domain:** Vercel AI SDK middleware pattern, wrapLanguageModel decorator, per-request API key injection, usage tracking integration
**Confidence:** HIGH

## Summary

Phase 6 integrates the llm-router with Vercel AI SDK using the `wrapLanguageModel()` middleware pattern to intercept LLM calls, inject selected API keys transparently, and track actual token usage from provider responses. The research confirms that the AI SDK's middleware system provides exactly the hooks needed for decorator-based key rotation without modifying user code.

**Key findings:**

1. `wrapLanguageModel()` provides `wrapGenerate` and `wrapStream` hooks that execute before and after model calls
2. Provider instances (`createGoogle`, `createOpenAI`, etc.) accept `apiKey` parameter for per-request key injection
3. Token usage is available via `result.usage` (promptTokens, completionTokens, totalTokens) for both streaming and non-streaming
4. Middleware factory pattern enables closure-based context (selected key, provider, model) without polluting user API
5. The decorator pattern preserves all AI SDK features (streaming, tool calling, structured output)

**Primary recommendation:** Wrap router.model() selection result in a middleware factory that creates provider instances with selected API keys, calls the underlying model, and records usage via UsageTracker.record().

## Phase Requirements

<phase_requirements>

## Phase Requirements

| ID      | Description                                                                                      | Research Support                                                                                                                                |
| ------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| INTG-01 | Package wraps Vercel AI SDK via decorator pattern (user continues using generateText/streamText) | wrapLanguageModel() provides transparent interception without modifying user code                                                               |
| INTG-04 | Router injects selected API key per request without user managing key selection                  | Provider factory functions (createGoogle, createOpenAI) accept apiKey parameter; middleware factory pattern enables closure-based key injection |

</phase_requirements>

## Standard Stack

### Core

| Library        | Version | Purpose                        | Why Standard                                                                                         |
| -------------- | ------- | ------------------------------ | ---------------------------------------------------------------------------------------------------- |
| ai             | ^4.0.0  | Vercel AI SDK peer dependency  | 36M weekly downloads, battle-tested middleware system, standardized token usage across 20+ providers |
| @ai-sdk/google | Latest  | Google Gemini provider adapter | Official AI SDK provider, used for Phase 6 POC with free tier Gemini                                 |

### Supporting

| Library           | Version | Purpose                    | When to Use                                      |
| ----------------- | ------- | -------------------------- | ------------------------------------------------ |
| @ai-sdk/openai    | Latest  | OpenAI provider adapter    | When testing with OpenAI models in future phases |
| @ai-sdk/anthropic | Latest  | Anthropic provider adapter | When adding Claude provider support              |

### Alternatives Considered

| Instead of                    | Could Use                             | Tradeoff                                                                                                          |
| ----------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| wrapLanguageModel             | LangChain.js callbacks                | LangChain is heavier (full framework), has streaming token usage bug, callback-based middleware is more complex   |
| Vercel AI SDK                 | Build provider abstraction layer      | Would require reinventing unified API, token usage normalization, streaming abstractions already solved by AI SDK |
| Per-request provider creation | Single provider with header injection | AI SDK providers don't expose header modification; factory pattern is documented approach                         |

**Installation:**

```bash
npm install ai @ai-sdk/google
```

## Architecture Patterns

### Recommended Integration Pattern

Router provides a wrapped model factory that creates providers with selected keys:

```
User Code                Router Layer                 AI SDK
---------               -------------                --------
generateText()   -->    wrapLanguageModel()   -->   Provider
  with model            with middleware              (with selected key)
                              |
                              v
                        1. router.model() selects key
                        2. createGoogle({ apiKey: selectedKey })
                        3. doGenerate() / doStream()
                        4. result.usage → UsageTracker.record()
```

### Pattern 1: Middleware Factory with Key Injection

**What:** Factory function that creates middleware with closure over selected key and provider config

**When to use:** Every router-wrapped model call

**Example:**

```typescript
// Source: https://github.com/vercel/ai/discussions/4590
import { wrapLanguageModel, generateText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

function createRouterMiddleware(
  provider: string,
  model: string,
  apiKey: string,
  usageTracker: UsageTracker,
) {
  return {
    wrapGenerate: async ({ doGenerate, params }) => {
      // Execute with dynamically created provider
      const result = await doGenerate();

      // Record actual usage from provider response
      await usageTracker.record(provider, {
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
        model,
      });

      return result;
    },
    wrapStream: async ({ doStream, params }) => {
      const result = await doStream();

      // Usage available in onFinish or await result.usage
      return result;
    },
  };
}

// Router creates provider with selected key
const selection = await router.model('google/gemini-2.0-flash');
const google = createGoogleGenerativeAI({ apiKey: selection.key });
const baseModel = google('gemini-2.0-flash');

const wrappedModel = wrapLanguageModel({
  model: baseModel,
  middleware: createRouterMiddleware('google', 'gemini-2.0-flash', selection.key, router.usage),
});

const result = await generateText({
  model: wrappedModel,
  prompt: 'Hello',
});
```

### Pattern 2: Provider Instance Creation Per Request

**What:** Create new provider instances with selected API keys on-demand

**When to use:** Every model() call when key selection may change

**Example:**

```typescript
// Source: https://ai-sdk.dev/providers/ai-sdk-providers/google-generative-ai
import { createGoogleGenerativeAI } from '@ai-sdk/google';

// Each request gets a fresh provider with the selected key
const google = createGoogleGenerativeAI({
  apiKey: selectedKey, // From router.model() selection
  baseURL: 'https://generativelanguage.googleapis.com/v1beta', // Optional custom endpoint
});

const model = google('gemini-2.0-flash');
```

**Why this works:** Provider creation is lightweight (no connection pooling). The AI SDK provider factories return objects that lazily create HTTP clients on first use.

### Pattern 3: Token Usage Extraction

**What:** Access usage metadata from both streaming and non-streaming responses

**When to use:** After every successful LLM call to update usage tracking

**Example:**

```typescript
// Source: https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text

// Non-streaming (generateText)
const result = await generateText({ model, prompt });
const usage = result.usage; // { promptTokens, completionTokens, totalTokens }

// Streaming (streamText)
const stream = await streamText({ model, prompt });

// Option 1: onFinish callback
streamText({
  model,
  prompt,
  onFinish: async (event) => {
    await usageTracker.record({
      promptTokens: event.usage.promptTokens,
      completionTokens: event.usage.completionTokens,
    });
  },
});

// Option 2: await stream.usage
const finalUsage = await stream.usage; // Promise that resolves after stream completes
```

### Anti-Patterns to Avoid

- **Wrapping provider instances globally:** Don't create a single wrapped provider at startup. Keys must be selected per-request based on current quotas.
- **Modifying params.apiKey in transformParams:** The AI SDK doesn't expose apiKey as a mutable param. Use provider factory pattern instead.
- **Blocking on usage recording:** Usage tracking should be fire-and-forget. Never throw errors from middleware that would break user's LLM call.
- **Caching provider instances:** Provider instances are tied to specific API keys. Don't cache them across requests when key rotation is active.

## Don't Hand-Roll

| Problem                    | Don't Build                                       | Use Instead                                         | Why                                                                                                                                                  |
| -------------------------- | ------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Provider abstraction layer | Custom SDK wrappers for each provider             | Vercel AI SDK's unified generateText/streamText API | AI SDK already normalizes 20+ providers; building custom wrappers means maintaining provider-specific quirks, auth patterns, error codes             |
| Token usage normalization  | Custom parsing of each provider's response format | AI SDK's standardized result.usage                  | Providers return usage in different formats (OpenAI: `usage.prompt_tokens`, Anthropic: `usage.input_tokens`); AI SDK normalizes to consistent schema |
| Streaming abstraction      | Custom stream handling for each provider          | AI SDK's streamText() with onFinish                 | Streaming protocols differ wildly (SSE, WebSocket, chunked transfer); AI SDK provides unified async iterator interface                               |
| Middleware interception    | Monkey-patching or proxying provider methods      | wrapLanguageModel() with wrapGenerate/wrapStream    | Monkey-patching breaks with SDK updates; wrapLanguageModel is stable API with proper lifecycle hooks                                                 |

**Key insight:** The AI SDK already solved the "unified LLM interface" problem. Building a routing layer on top means using the SDK's abstractions (wrapLanguageModel, provider factories, usage objects) rather than reinventing them. The middleware pattern is designed for exactly this use case.

## Common Pitfalls

### Pitfall 1: Assuming API Key is Mutable in Params

**What goes wrong:** Developers try to modify `params.apiKey` in `transformParams()` to inject the selected key.

**Why it happens:** Expectation that all provider settings are in params. However, the AI SDK separates provider creation (where apiKey lives) from call parameters (prompt, settings).

**How to avoid:** Create the provider instance with the selected key BEFORE wrapping. The middleware operates on an already-configured provider.

**Warning signs:** TypeScript error "Property 'apiKey' does not exist on type 'LanguageModelV3CallOptions'". The apiKey is set at provider creation, not in call params.

### Pitfall 2: Provider Instance Creation Overhead Concern

**What goes wrong:** Developers assume creating a new provider instance per request is expensive (like opening a DB connection) and try to cache/reuse instances.

**Why it happens:** Traditional SDK patterns (DB clients, HTTP pools) require expensive connection setup. Caching seems like an optimization.

**How to avoid:** Measure before optimizing. AI SDK provider factories are lightweight object creators. The actual HTTP client is created lazily on first use. Per-request provider creation is the documented pattern.

**Warning signs:** Complex provider caching logic with key-to-instance maps. This breaks key rotation and adds unnecessary complexity.

### Pitfall 3: Synchronous Middleware with Async Usage Recording

**What goes wrong:** Middleware blocks the LLM response while waiting for usage recording to database/storage.

**Why it happens:** Natural instinct to await all operations before returning. However, usage recording is observability, not correctness.

**How to avoid:** Use fire-and-forget pattern for usage recording. Catch and log errors internally, never propagate them to user code.

**Warning signs:** Slow LLM response times when storage backend is slow. User's generateText() call should not wait for usage DB writes.

### Pitfall 4: Missing Usage in Streaming Responses

**What goes wrong:** Usage tracking misses token counts for streaming calls because middleware returns immediately without awaiting usage.

**Why it happens:** Streaming returns an async iterator that yields chunks. The usage is only known after the stream completes.

**How to avoid:** Use `onFinish` callback or await `stream.usage` Promise. Both provide access to final token counts after streaming completes.

**Warning signs:** Usage records show 0 tokens for streaming calls. Test with both generateText (non-streaming) and streamText to ensure both paths record usage.

### Pitfall 5: Middleware Factory Without Proper Typing

**What goes wrong:** TypeScript errors when passing factory-created middleware to wrapLanguageModel.

**Why it happens:** Middleware type is LanguageModelV3Middleware, which requires specific function signatures.

**How to avoid:** Type the factory function to return LanguageModelV3Middleware. Use the exported type from 'ai' package.

**Warning signs:** TypeScript errors about missing properties or incompatible types. Fix by importing and using the correct middleware type.

## Code Examples

Verified patterns from official sources:

### Creating Provider with API Key

```typescript
// Source: https://ai-sdk.dev/providers/ai-sdk-providers/google-generative-ai
import { createGoogleGenerativeAI } from '@ai-sdk/google';

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  // Optional: custom base URL for proxying
  baseURL: 'https://custom-proxy.example.com/v1beta',
});

const model = google('gemini-2.0-flash');
```

### Wrapping Model with Middleware

```typescript
// Source: https://ai-sdk.dev/docs/reference/ai-sdk-core/wrap-language-model
import { wrapLanguageModel } from 'ai';

const wrappedModel = wrapLanguageModel({
  model: baseModel,
  middleware: {
    wrapGenerate: async ({ doGenerate, params }) => {
      console.log('Before generation:', params);
      const result = await doGenerate();
      console.log('After generation:', result.usage);
      return result;
    },
    wrapStream: async ({ doStream, params }) => {
      const result = await doStream();
      return result;
    },
  },
  // Optional: override model/provider ID
  modelId: 'custom-model-id',
  providerId: 'custom-provider',
});
```

### Accessing Token Usage

```typescript
// Source: https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text

// generateText usage
const result = await generateText({ model, prompt: 'Hello' });
console.log({
  promptTokens: result.usage.promptTokens,
  completionTokens: result.usage.completionTokens,
  totalTokens: result.usage.totalTokens,
});

// streamText with onFinish
const stream = await streamText({
  model,
  prompt: 'Hello',
  onFinish: async (event) => {
    console.log('Stream finished:', event.usage);
  },
});

// streamText with await
const { usage } = stream;
const finalUsage = await usage; // Resolves after stream completes
```

### Middleware Factory Pattern

```typescript
// Source: https://github.com/vercel/ai/discussions/4590
import type { LanguageModelV3Middleware } from 'ai';

function createUsageTrackingMiddleware(
  provider: string,
  keyIndex: number,
  tracker: UsageTracker,
): LanguageModelV3Middleware {
  return {
    wrapGenerate: async ({ doGenerate }) => {
      const result = await doGenerate();

      // Fire-and-forget usage recording
      tracker
        .record(provider, keyIndex, {
          promptTokens: result.usage.promptTokens,
          completionTokens: result.usage.completionTokens,
        })
        .catch((err) => {
          console.error('Usage recording failed:', err);
        });

      return result;
    },
    wrapStream: async ({ doStream }) => {
      const result = await doStream();

      // Usage tracking via onFinish or awaiting result.usage
      result.usage.then((usage) => {
        tracker
          .record(provider, keyIndex, {
            promptTokens: usage.promptTokens,
            completionTokens: usage.completionTokens,
          })
          .catch((err) => {
            console.error('Usage recording failed:', err);
          });
      });

      return result;
    },
  };
}
```

## State of the Art

| Old Approach                     | Current Approach                       | When Changed               | Impact                                                                                        |
| -------------------------------- | -------------------------------------- | -------------------------- | --------------------------------------------------------------------------------------------- |
| experimental_wrapLanguageModel   | wrapLanguageModel                      | v4.2 (stable in v5+)       | Middleware API is now stable, safe for production use                                         |
| Manual provider switching        | wrapLanguageModel with factory pattern | v3.4 introduced middleware | Clean separation: user code unchanged, routing logic in middleware                            |
| result.usage with limited fields | result.usage with detailed breakdowns  | v6.0 (2026-03)             | Now includes cachedInputTokens, reasoningTokens, raw provider data for advanced cost tracking |
| Environment variable only        | apiKey parameter in provider factories | Always supported           | Per-request key injection was always possible, now documented as standard pattern             |

**Deprecated/outdated:**

- ModelFusion SDK: Merged into Vercel AI SDK v3.1, no longer maintained as separate package
- experimental\_ prefix on middleware APIs: Stable since v4.2

## Open Questions

1. **Provider instance pooling**
   - What we know: Provider factories are lightweight, documented pattern is per-request creation
   - What's unclear: If high request volume (1000s/sec) would benefit from caching provider instances per key
   - Recommendation: Start with per-request creation (simplest, most flexible). Profile in production. Only add pooling if measurements show provider creation as bottleneck.

2. **Error propagation from usage recording**
   - What we know: Usage recording should be fire-and-forget to avoid breaking user's LLM calls
   - What's unclear: How to surface persistent recording failures to user (e.g., storage backend down)
   - Recommendation: Log errors internally. Emit 'error' event on router EventEmitter for monitoring. Never throw from middleware.

3. **Streaming usage timing**
   - What we know: stream.usage resolves after stream completes; onFinish callback fires after last chunk
   - What's unclear: Whether onFinish fires before or after stream.usage resolves, and if usage is available mid-stream
   - Recommendation: Use onFinish for recording (simpler API). Document that streaming usage is recorded after response completes, not per-chunk.

## Validation Architecture

### Test Framework

| Property           | Value                    |
| ------------------ | ------------------------ |
| Framework          | vitest 2.1.8             |
| Config file        | vitest.config.ts         |
| Quick run command  | `npm test`               |
| Full suite command | `npm test -- --coverage` |

### Phase Requirements → Test Map

| Req ID  | Behavior                                                               | Test Type   | Automated Command                                  | File Exists? |
| ------- | ---------------------------------------------------------------------- | ----------- | -------------------------------------------------- | ------------ |
| INTG-01 | User calls generateText with wrapped model using same API as unwrapped | integration | `npm test -- src/integration/wrapper.test.ts -x`   | ❌ Wave 0    |
| INTG-01 | wrapLanguageModel preserves model interface                            | unit        | `npm test -- src/wrapper/middleware.test.ts -x`    | ❌ Wave 0    |
| INTG-04 | Router injects selected API key into provider factory                  | unit        | `npm test -- src/wrapper/key-injection.test.ts -x` | ❌ Wave 0    |
| INTG-04 | Provider created with selected key makes successful API call           | integration | `npm test -- src/integration/real-api.test.ts -x`  | ❌ Wave 0    |

### Sampling Rate

- **Per task commit:** `npm test -- --changed` (tests for modified files)
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** Full suite green + manual POC with real Gemini API call

### Wave 0 Gaps

- [ ] `src/wrapper/middleware.test.ts` — covers INTG-01 (middleware preserves interface)
- [ ] `src/wrapper/key-injection.test.ts` — covers INTG-04 (key injection pattern)
- [ ] `src/integration/wrapper.test.ts` — covers INTG-01 (user-facing API unchanged)
- [ ] `src/integration/real-api.test.ts` — covers INTG-04 (real API with rotated keys)

## Sources

### Primary (HIGH confidence)

- [AI SDK wrapLanguageModel Reference](https://ai-sdk.dev/docs/reference/ai-sdk-core/wrap-language-model) - Middleware API surface
- [AI SDK Language Model Middleware Guide](https://ai-sdk.dev/docs/ai-sdk-core/middleware) - transformParams, wrapGenerate, wrapStream patterns
- [AI SDK streamText Reference](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text) - Token usage access (onFinish, await usage)
- [AI SDK Google Provider](https://ai-sdk.dev/providers/ai-sdk-providers/google-generative-ai) - createGoogleGenerativeAI apiKey parameter
- [GitHub Discussion #4590](https://github.com/vercel/ai/discussions/4590) - Middleware factory pattern for passing custom metadata

### Secondary (MEDIUM confidence)

- [AI SDK 3.4 Release](https://vercel.com/blog/ai-sdk-3-4) - Middleware system announcement, stability timeline
- [AI SDK 6 Release](https://vercel.com/blog/ai-sdk-6) - Latest features (cached tokens, reasoning tokens)
- [Vercel AI SDK comparison research](https://github.com/vercel/ai/discussions/513) - Token usage tracking patterns across versions
- [OpenAI SDK vs Vercel AI SDK](https://strapi.io/blog/openai-sdk-vs-vercel-ai-sdk-comparison) - Why AI SDK for multi-provider

### Tertiary (LOW confidence)

- Web search results about middleware patterns - General concepts, not AI SDK specific

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - AI SDK middleware is documented, stable, battle-tested (36M weekly downloads)
- Architecture: HIGH - Middleware factory pattern verified in official GitHub discussions, code examples from docs
- Pitfalls: MEDIUM - Based on common patterns from web middleware (synchronous blocking, missing async completion) and TypeScript strict mode learnings from Phase 1-5

**Research date:** 2026-03-13
**Valid until:** 2026-04-13 (30 days - stable domain, AI SDK v6 is current major version)
