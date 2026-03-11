# TypeScript/JavaScript LLM SDK Comparison for Key Rotation / Cost Management Layer

**Researched:** 2026-03-12
**Purpose:** Evaluate all viable TS/JS LLM SDK packages as a base for building a key rotation and cost management layer.
**Method:** Web research across npm, GitHub, official docs, community discussions, and comparison articles.

---

## Quick Summary Table

| Package | npm Weekly DL | GitHub Stars | License | Providers | Unified API | Key Swap/Request | Token Usage | Middleware | TS-First | Active |
|---------|-------------|-------------|---------|-----------|-------------|-----------------|-------------|------------|----------|--------|
| **Vercel AI SDK** (`ai`) | ~36M | 22.5k | Apache-2.0 | 20+ (gateway) | YES | YES | YES | YES | YES | YES (v6, Mar 2026) |
| **LangChain.js** (`@langchain/core`) | ~1.4M | 17.2k | MIT | 23+ chat models | YES | Partial | YES (with caveats) | YES | YES | YES (v1.2, Mar 2026) |
| **OpenAI Node SDK** (`openai`) | ~9.5M | 10.7k | Apache-2.0 | 1 (OpenAI only) | NO | YES | YES | NO | YES | YES (v6.27, Mar 2026) |
| **Portkey AI** (`portkey-ai`) | ~19 dependents* | 41 (SDK) / 10.8k (gateway) | MIT (gateway) | 200+ (via gateway) | YES | YES (virtual keys) | YES | YES (gateway) | YES | YES (v3.0, Feb 2026) |
| **Instructor.js** (`@instructor-ai/instructor`) | ~15k | 777 | MIT | Multi (via llm-polyglot) | Partial | YES | NO (focused on structured output) | NO | YES | STALE (v1.7, ~1yr ago) |
| **Mastra** (`@mastra/core`) | ~300k | ~19.8k | Apache-2.0 | 40+ | YES | YES (middleware) | YES | YES | YES | YES (v1.10, Mar 2026) |
| **TanStack AI** (`@tanstack/ai`) | ~8k | 2.4k | MIT | 6+ (growing) | YES | YES | Pending (alpha) | NO (alpha) | YES | Alpha (v0.2, Mar 2026) |
| **Ax (DSPy for TS)** (`@ax-llm/ax`) | ~10k | 2.4k | Apache-2.0 | 15+ | YES | YES | YES (OTel) | NO (AxFlow) | YES | YES (v16.0, Mar 2026) |
| **LlamaIndex.TS** (`llamaindex`) | ~22k | 3.1k | MIT | Modular (packages) | YES | YES | YES | NO | YES | YES (active) |
| **ModelFusion** (`modelfusion`) | Deprecated | 828 | MIT | N/A | N/A | N/A | N/A | N/A | N/A | DEPRECATED (merged into Vercel AI SDK) |

\* Portkey npm weekly downloads not directly available from search; 19 dependent packages on npm registry.

---

## Detailed Package Analysis

---

### 1. Vercel AI SDK (`ai`)

**npm:** [ai](https://www.npmjs.com/package/ai)
**GitHub:** [vercel/ai](https://github.com/vercel/ai) -- 22,517 stars, 3,957 forks
**License:** Apache-2.0
**Weekly Downloads:** ~36M
**Latest Version:** 6.0.116 (published ~5 days ago as of 2026-03-12)
**Last Commit Activity:** Daily

#### Feature Assessment

| Criterion | Assessment |
|-----------|-----------|
| **Streaming** | YES -- full streaming via `streamText()`, `streamObject()` |
| **Tool Calling** | YES -- unified tool calling across all providers |
| **Structured Output** | YES -- `generateObject()` with Zod schemas |
| **Unified API** | YES -- `generateText()`, `streamText()`, `generateObject()` work identically across all providers |
| **Key Swap Per Request** | YES -- `createOpenAI({ apiKey: userKey })` creates new provider per request; same pattern for all providers |
| **Token Usage Metadata** | YES -- `result.usage` returns `{ promptTokens, completionTokens, totalTokens }` with detailed breakdowns (cached tokens, reasoning tokens, raw provider data) |
| **Middleware/Plugin System** | YES -- `wrapLanguageModel()` with `transformParams`, `wrapGenerate`, `wrapStream` hooks. Stable since v4.2. Built-in middleware: `extractReasoningMiddleware`, `simulateStreamingMiddleware`, `defaultSettingsMiddleware`, `devToolsMiddleware` |
| **TypeScript-first** | YES -- designed as "The AI Toolkit for TypeScript" |
| **Model Categorization** | Partial -- distinguishes "fast" vs "reasoning" models in docs/academy, `extractReasoningMiddleware` for reasoning models, but no formal built-in category enum |

#### Strengths for Key Rotation Layer
- Middleware system is PERFECT for wrapping calls with usage tracking
- `wrapLanguageModel()` lets you intercept every call without modifying user code
- Provider instances are cheap to create per-request (key injection is natural)
- Token usage is exposed in a standardized format across all providers
- DevTools middleware provides built-in introspection
- Massive adoption (36M weekly downloads) means stable, well-tested
- AI Gateway provides access to 20+ providers through a single interface

#### Weaknesses
- AI Gateway is a Vercel service (potential vendor concern, though direct providers work fine)
- No built-in cost tracking or budget management
- No built-in key rotation logic (but middleware makes it trivial to add)
- Some providers may not expose full usage data when streaming

#### Verdict: STRONG RECOMMENDATION for base layer
The middleware system (`wrapLanguageModel`) is purpose-built for exactly what a cost management layer needs. Combined with per-request key injection and standardized token usage, this is the strongest foundation.

---

### 2. LangChain.js (`@langchain/core`)

**npm:** [@langchain/core](https://www.npmjs.com/package/@langchain/core)
**GitHub:** [langchain-ai/langchainjs](https://github.com/langchain-ai/langchainjs) -- 17,173 stars, 3,056 forks
**License:** MIT
**Weekly Downloads:** ~1.4M (for `langchain` package)
**Latest Version:** langchain@1.2.30 (published 2026-03-05)
**Last Commit Activity:** Weekly

#### Feature Assessment

| Criterion | Assessment |
|-----------|-----------|
| **Streaming** | YES -- streaming supported across chat models |
| **Tool Calling** | YES -- tool/function calling with structured schemas |
| **Structured Output** | YES -- `.withStructuredOutput()` on chat models |
| **Unified API** | YES -- `ChatModel.invoke()` / `.stream()` across all providers |
| **Key Swap Per Request** | PARTIAL -- must create new `ChatOpenAI({ apiKey })` instance per request. No built-in `configurable_fields()` for JS (Python-only). Reliable but verbose. |
| **Token Usage Metadata** | YES WITH CAVEATS -- `UsageMetadata` type with `input_tokens`, `output_tokens`, `total_tokens`. Known bug with missing token usage in streaming responses for `ChatOpenAI` and `ChatAnthropicAI` (unresolved). |
| **Middleware/Plugin System** | YES -- Prebuilt middleware: retry, summarization, todo list, tool call limit, tool emulation, tool retry. Rich callback system via `CallbackManager`. |
| **TypeScript-first** | YES -- written in TypeScript, full type support |
| **Model Categorization** | NO -- no built-in model categorization system |

#### Strengths for Key Rotation Layer
- Rich middleware/callback ecosystem for intercepting calls
- Large community and extensive integrations (23+ chat model providers)
- MIT license is maximally permissive
- LangSmith integration for observability

#### Weaknesses
- Heavy framework -- carries significant abstractions (chains, agents, memory, retrievers) that are unnecessary for a thin routing layer
- Token usage in streaming is buggy (known unresolved issue)
- Key injection requires new instance creation (no per-call override)
- Large dependency tree, complex package structure (`@langchain/core`, `@langchain/openai`, `@langchain/community`, etc.)
- Callback-based middleware is more complex than Vercel AI SDK's `wrapLanguageModel`

#### Verdict: VIABLE BUT HEAVY
Good if you are already in the LangChain ecosystem. However, for building a lightweight key rotation/cost management layer, it carries too much unnecessary weight. The streaming token usage bug is concerning for accurate cost tracking.

---

### 3. OpenAI Node SDK (`openai`)

**npm:** [openai](https://www.npmjs.com/package/openai)
**GitHub:** [openai/openai-node](https://github.com/openai/openai-node) -- 10,700 stars, 1,400 forks
**License:** Apache-2.0
**Weekly Downloads:** ~9.5M
**Latest Version:** 6.27.0 (published ~6 days ago as of 2026-03-12)
**Last Commit Activity:** Daily/Weekly

#### Feature Assessment

| Criterion | Assessment |
|-----------|-----------|
| **Streaming** | YES -- full streaming support |
| **Tool Calling** | YES -- function calling / tool use |
| **Structured Output** | YES -- JSON mode, function calling with schemas |
| **Unified API** | NO -- OpenAI-only. Some providers offer OpenAI-compatible endpoints (Groq, Together, etc.) but no built-in multi-provider abstraction. |
| **Key Swap Per Request** | YES -- `new OpenAI({ apiKey })` per request is straightforward |
| **Token Usage Metadata** | YES -- `response.usage.prompt_tokens`, `completion_tokens`, `total_tokens` |
| **Middleware/Plugin System** | NO -- no middleware or plugin system |
| **TypeScript-first** | YES -- "The official TypeScript library for the OpenAI API", generated from OpenAPI spec with Stainless |
| **Model Categorization** | NO |

#### Can It Be Used With Other Providers?
YES, but with significant limitations:
- **OpenAI-compatible providers** (Groq, Together, Fireworks, Ollama, etc.) work by changing `baseURL`
- **Non-compatible providers** (Anthropic, Google Gemini) require their own SDKs
- You would need to write your own abstraction layer to unify different SDKs
- Portkey and LiteLLM use this approach (proxy that translates to OpenAI format)

#### Strengths for Key Rotation Layer
- Most mature and stable TypeScript LLM SDK
- Clean, predictable API surface
- Token usage is always reliably reported
- Lightweight (no framework overhead)

#### Weaknesses
- Single-provider only (OpenAI)
- No unified API for cross-provider usage
- No middleware system for intercepting calls
- Building multi-provider support means reinventing what Vercel AI SDK already provides

#### Verdict: NOT RECOMMENDED AS BASE
Unless you only need OpenAI, this requires too much custom work to become multi-provider. Better used as one provider behind Vercel AI SDK or as a reference for API patterns.

---

### 4. Portkey AI (`portkey-ai`)

**npm:** [portkey-ai](https://www.npmjs.com/package/portkey-ai)
**GitHub:** [Portkey-AI/portkey-node-sdk](https://github.com/Portkey-AI/portkey-node-sdk) -- 41 stars (SDK); [Portkey-AI/gateway](https://github.com/Portkey-AI/gateway) -- 10,823 stars
**License:** MIT (gateway is open-source)
**Weekly Downloads:** Not available from search (19 dependent packages on npm)
**Latest Version:** 3.0.3 (published ~13 days ago as of 2026-03-12)
**Last Commit Activity:** Regular

#### Feature Assessment

| Criterion | Assessment |
|-----------|-----------|
| **Streaming** | YES -- full streaming support |
| **Tool Calling** | YES -- via OpenAI-compatible interface |
| **Structured Output** | YES -- via OpenAI-compatible interface |
| **Unified API** | YES -- OpenAI-compatible interface for 200+ providers |
| **Key Swap Per Request** | YES -- "Virtual Keys" system with encrypted vault, per-request key override, load balancing across keys |
| **Token Usage Metadata** | YES -- tracks token usage, costs, latency across all providers with 40+ production metrics |
| **Middleware/Plugin System** | YES (gateway-level) -- guardrails, caching, fallbacks, retries, load balancing are built into the gateway |
| **TypeScript-first** | YES -- SDK built on top of OpenAI SDK |
| **Model Categorization** | NO -- no built-in model categorization |

#### CRITICAL DISTINCTION: SDK vs Gateway
- The **SDK** (`portkey-ai`) is thin -- it is the OpenAI SDK with Portkey headers
- The real functionality is in the **Gateway** (self-hosted or Portkey cloud)
- The gateway handles: routing, fallbacks, retries, caching, guardrails, observability
- You MUST run the gateway (either self-hosted or use Portkey's hosted service)

#### Strengths for Key Rotation Layer
- ALREADY SOLVES many of the same problems (key rotation, cost tracking, load balancing)
- Virtual Keys provide secure key storage with rotation support
- Built-in cost tracking, budget limits, rate limit policies
- SOC2, HIPAA, GDPR compliant
- OpenAI-compatible means minimal code changes

#### Weaknesses
- **Gateway dependency** -- requires running a separate service (self-hosted) or using Portkey's cloud
- SDK itself has very low adoption (41 GitHub stars on SDK repo)
- Architectural mismatch -- Portkey is a proxy/gateway, not a library you embed
- For your use case (npm package), Portkey would be a runtime dependency on an external service
- Pricing: free tier exists but paid tiers for production features
- You are building a library; Portkey is a service

#### Verdict: COMPETITOR, NOT A BASE
Portkey solves similar problems but as a hosted/self-hosted gateway service, not as an embeddable library. If users want Portkey's approach, they would use Portkey directly. Your library should be embeddable (no external service required). However, studying Portkey's feature set is valuable for understanding what features to build.

---

### 5. Instructor.js (`@instructor-ai/instructor`)

**npm:** [@instructor-ai/instructor](https://www.npmjs.com/package/@instructor-ai/instructor)
**GitHub:** [instructor-ai/instructor-js](https://github.com/instructor-ai/instructor-js) -- 777 stars, 72 forks
**License:** MIT
**Weekly Downloads:** ~15k
**Latest Version:** 1.7.0 (published ~1 year ago)
**Last Commit Activity:** STALE

#### Feature Assessment

| Criterion | Assessment |
|-----------|-----------|
| **Streaming** | YES -- partial JSON streaming via `zod-stream` and `schema-stream` |
| **Tool Calling** | NO -- focused on structured extraction, not tool calling |
| **Structured Output** | YES -- this is its core purpose. Zod schema validation with OpenAI function calling |
| **Unified API** | PARTIAL -- multi-provider via `llm-polyglot` library (OpenAI, Anthropic, Azure, Cohere) |
| **Key Swap Per Request** | YES -- wraps OpenAI client, key set at client creation |
| **Token Usage Metadata** | NO -- focused on structured output, not usage tracking |
| **Middleware/Plugin System** | NO |
| **TypeScript-first** | YES -- Zod-based, TypeScript-native |
| **Model Categorization** | NO |

#### Strengths for Key Rotation Layer
- Excellent structured output handling (could complement a routing layer)
- Clean Zod-based API design worth studying

#### Weaknesses
- **STALE** -- last published ~1 year ago, not actively maintained
- Narrow focus (structured extraction only, not general LLM interaction)
- No token usage tracking
- No middleware system
- Low adoption compared to alternatives

#### Verdict: NOT SUITABLE AS BASE
Too narrow in scope and appears unmaintained. The Vercel AI SDK's `generateObject()` now covers the same structured output use case. Not viable for building a routing/cost layer.

---

### 6. Mastra (`@mastra/core`)

**npm:** [@mastra/core](https://www.npmjs.com/package/@mastra/core)
**GitHub:** [mastra-ai/mastra](https://github.com/mastra-ai/mastra) -- ~19,800 stars
**License:** Apache-2.0 (enterprise code under `ee/` dirs has separate license)
**Weekly Downloads:** ~300k
**Latest Version:** 1.10.0 (published ~5 days ago as of 2026-03-12)
**Last Commit Activity:** Daily

#### Feature Assessment

| Criterion | Assessment |
|-----------|-----------|
| **Streaming** | YES -- full streaming support |
| **Tool Calling** | YES -- agent tools with MCP support |
| **Structured Output** | YES -- via Vercel AI SDK integration |
| **Unified API** | YES -- model routing to 40+ providers, specify as `provider/model-name` |
| **Key Swap Per Request** | YES -- middleware system injects per-request context; `RequestContext` with typed keys |
| **Token Usage Metadata** | YES -- traces agent calls and token usage with observability platform integration |
| **Middleware/Plugin System** | YES -- Hono-based HTTP middleware, global and per-route, `RequestContext` for dependency injection |
| **TypeScript-first** | YES -- "The TypeScript AI Framework" |
| **Model Categorization** | INFORMAL -- docs discuss using different models for reasoning vs general tasks, dynamic model selection via functions, but no formal category enum |

#### Strengths for Key Rotation Layer
- Rich middleware system with per-request context injection
- Model routing already built-in (40+ providers)
- Dynamic model selection (models are just strings, can be computed at runtime)
- Auth middleware pattern already documented
- Active development, large community (300+ contributors, 4800 Discord members)
- Production use at Replit, PayPal, Sanity

#### Weaknesses
- **FULL FRAMEWORK** -- includes agents, workflows, RAG, memory, eval, voice, storage, MCP servers
- Extremely heavy for a thin routing layer (you would use <5% of its features)
- Enterprise license for some features
- Server-oriented (Hono-based) -- designed for running as a service, not as an embeddable library
- Pulls in many dependencies
- Middleware is HTTP-level (Hono Context), not LLM-call-level like Vercel AI SDK's `wrapLanguageModel`

#### Verdict: TOO HEAVY, WRONG ABSTRACTION LEVEL
Mastra is a full AI application framework, not a lightweight SDK for building a routing layer on top of. Its middleware is HTTP-level (for its built-in server), not LLM-call-level. However, it is worth noting that Mastra uses Vercel AI SDK under the hood for model routing, which further validates the AI SDK choice.

---

### 7. TanStack AI (`@tanstack/ai`)

**npm:** [@tanstack/ai](https://www.npmjs.com/package/@tanstack/ai)
**GitHub:** [TanStack/ai](https://github.com/TanStack/ai) -- 2,400 stars, 144 forks
**License:** MIT
**Weekly Downloads:** ~8k
**Latest Version:** 0.2.2 (alpha, published ~8 days ago as of 2026-03-12)
**Last Commit Activity:** Regular (alpha development)

#### Feature Assessment

| Criterion | Assessment |
|-----------|-----------|
| **Streaming** | YES -- built-in streaming support |
| **Tool Calling** | YES -- isomorphic tools with Zod schemas |
| **Structured Output** | YES -- type-safe structured outputs |
| **Unified API** | YES -- provider-agnostic adapters for OpenAI, Anthropic, Gemini, Ollama, OpenRouter |
| **Key Swap Per Request** | YES (likely) -- provider adapters accept config including keys |
| **Token Usage Metadata** | UNKNOWN -- alpha, not documented for this specific feature |
| **Middleware/Plugin System** | NO -- not yet (alpha) |
| **TypeScript-first** | YES -- extreme TypeScript type safety with end-to-end inference |
| **Model Categorization** | YES -- supports thinking/reasoning model tokens, provider-specific capabilities typed |

#### Strengths for Key Rotation Layer
- Pure open source (no service layer, no platform fees)
- Excellent TypeScript type safety (provider-specific options typed at compile time)
- Clean architecture from TanStack team (proven track record with Query, Table, Router)
- OpenRouter as first-class adapter (300+ models from 60+ providers)
- Framework-agnostic (React, Solid, vanilla JS)

#### Weaknesses
- **ALPHA** -- v0.2.2, not production-ready
- API surface may change significantly before 1.0
- No middleware system yet
- Token usage metadata unclear
- Low adoption (~8k weekly downloads, 2.4k stars)
- Limited provider support compared to Vercel AI SDK

#### Verdict: PROMISING BUT TOO EARLY
Worth watching closely. If it reaches 1.0 with a middleware system and stable API, it could be a strong alternative to Vercel AI SDK. The type safety approach is excellent. Not suitable today for production use.

---

### 8. Ax - DSPy for TypeScript (`@ax-llm/ax`)

**npm:** [@ax-llm/ax](https://www.npmjs.com/package/@ax-llm/ax)
**GitHub:** [ax-llm/ax](https://github.com/ax-llm/ax) -- 2,387 stars, 154 forks
**License:** Apache-2.0
**Weekly Downloads:** ~10k
**Latest Version:** 16.0.4 (published ~10 days ago as of 2026-03-12)
**Last Commit Activity:** Regular

#### Feature Assessment

| Criterion | Assessment |
|-----------|-----------|
| **Streaming** | YES -- real-time streaming with validation |
| **Tool Calling** | YES -- agent tools and multi-agent collaboration |
| **Structured Output** | YES -- signature-based typed output contracts |
| **Unified API** | YES -- `AxAIService` interface across 15+ providers |
| **Key Swap Per Request** | YES -- provider instances accept API key config |
| **Token Usage Metadata** | YES -- OpenTelemetry tracing built-in |
| **Middleware/Plugin System** | NO (direct) -- AxFlow for workflow orchestration, but not middleware in the wrap-a-call sense |
| **TypeScript-first** | YES -- TypeScript 5.8+, zero dependencies |
| **Model Categorization** | NO -- signature-based approach (you define what you want, not which category of model) |

#### Strengths for Key Rotation Layer
- Zero dependencies (lightweight)
- Clean provider abstraction (AxAIService interface)
- OpenTelemetry for observability
- Automatic prompt optimization (MiPRO, ACE, GEPA)
- Active maintenance

#### Weaknesses
- DSPy paradigm (signature-based programming) is opinionated and different from standard LLM SDK patterns
- No middleware system for wrapping calls
- Smaller community (~10k weekly downloads)
- Learning curve for signature-based approach
- Would force users into DSPy paradigm

#### Verdict: NICHE, NOT IDEAL AS BASE
Interesting framework with unique DSPy approach, but the signature-based paradigm is too opinionated for a general-purpose routing layer. Users expect standard `generateText()` / `streamText()` patterns.

---

### 9. LlamaIndex.TS (`llamaindex`)

**npm:** [llamaindex](https://www.npmjs.com/package/llamaindex)
**GitHub:** [run-llama/LlamaIndexTS](https://github.com/run-llama/LlamaIndexTS) -- 3,067 stars, 509 forks
**License:** MIT
**Weekly Downloads:** ~22k
**Latest Version:** Active (healthy release cadence)
**Last Commit Activity:** Regular

#### Feature Assessment

| Criterion | Assessment |
|-----------|-----------|
| **Streaming** | YES |
| **Tool Calling** | YES -- agent tools |
| **Structured Output** | YES -- structured output parsing |
| **Unified API** | YES -- modular provider packages (`@llamaindex/openai`, etc.) |
| **Key Swap Per Request** | YES -- provider instances accept config |
| **Token Usage Metadata** | YES -- token counting available |
| **Middleware/Plugin System** | NO -- not in the middleware sense |
| **TypeScript-first** | YES -- idiomatic TypeScript, uses interfaces over classes |
| **Model Categorization** | NO |

#### Strengths for Key Rotation Layer
- Clean TypeScript design (interfaces, POJOs, no unnecessary classes)
- RAG-focused but general LLM capabilities
- Modular provider system

#### Weaknesses
- **RAG-focused** -- primary value proposition is data ingestion and retrieval, not LLM call management
- Smaller community than Vercel AI SDK or LangChain.js
- No middleware system for wrapping LLM calls
- Heavy for just LLM call routing (carries RAG, indexing, embedding infrastructure)

#### Verdict: WRONG FOCUS
LlamaIndex.TS is optimized for RAG pipelines, not LLM call routing/cost management. Using it as a base would carry unnecessary complexity.

---

### 10. ModelFusion (`modelfusion`)

**npm:** [modelfusion](https://www.npmjs.com/package/modelfusion)
**GitHub:** [vercel/modelfusion](https://github.com/vercel/modelfusion) -- 828 stars

#### Status: DEPRECATED

ModelFusion was acquired by Vercel and merged into the Vercel AI SDK (starting with v3.1). The `modelfusion` npm package and `@modelfusion/vercel-ai` are no longer maintained. All of ModelFusion's best features (text generation, structured object generation, tool calls, observability hooks) were brought into the AI SDK.

#### Verdict: SKIP -- use Vercel AI SDK instead (its successor)

---

### 11. Other Notable Packages (Briefly Evaluated)

#### multi-llm-ts
- **npm:** [multi-llm-ts](https://www.npmjs.com/package/multi-llm-ts) -- 211 weekly downloads, 63 GitHub stars
- Unified API for 12 providers, streaming, tool support
- Too small/niche, single maintainer, low adoption

#### @unified-llm/core
- Supports OpenAI, Anthropic, Gemini, DeepSeek, Azure, Ollama
- MCP integration
- Very small, limited documentation

#### @llmops/sdk
- Claims 68+ providers with built-in dashboard
- Appears to be a commercial product with SDK component

#### llm-polyglot (Island AI)
- Used internally by Instructor.js
- Provides unified interface for OpenAI, Anthropic, Azure, Cohere
- Small, focused utility -- could be useful as a sub-dependency but not as a base

---

## Head-to-Head: Critical Features for Key Rotation Layer

### Feature Matrix (Only Viable Candidates)

| Feature | Vercel AI SDK | LangChain.js | Portkey | Mastra |
|---------|:---:|:---:|:---:|:---:|
| **Embeddable library (no external service)** | YES | YES | NO (needs gateway) | Partial (server-oriented) |
| **LLM-call-level middleware** | YES (`wrapLanguageModel`) | Callbacks only | N/A (gateway) | HTTP-level only |
| **Per-request key injection** | YES (create provider) | YES (create instance) | YES (virtual keys) | YES (middleware context) |
| **Reliable token usage (streaming)** | YES | BUGGY | YES (gateway) | YES (via AI SDK) |
| **Lightweight / low dependency** | YES (modular) | NO (heavy) | YES (SDK thin) | NO (full framework) |
| **Provider count** | 20+ | 23+ | 200+ | 40+ |
| **Community / stability** | 36M DL, v6 stable | 1.4M DL, v1.2 stable | Low SDK adoption | 300k DL, v1.10 |
| **Cost tracking built-in** | NO (you build it) | NO | YES | NO |
| **Budget/limit management** | NO (you build it) | NO | YES | NO |

---

## Final Recommendation

### Primary: Vercel AI SDK (`ai`)

**Why it wins for this use case:**

1. **`wrapLanguageModel()` is the killer feature.** It allows you to intercept every LLM call with custom logic (tracking, key selection, usage recording) without modifying the user's code or the provider's behavior. No other package offers this level of clean call interception.

2. **Per-request key injection is natural.** Creating `createOpenAI({ apiKey })` per request is the documented pattern. Your routing layer can select the key and create the provider in the middleware.

3. **Token usage is standardized and reliable.** The `usage` object on both `generateText` and `streamText` results provides `promptTokens`, `completionTokens`, `totalTokens` with detailed breakdowns -- exactly what you need for cost tracking.

4. **Massive adoption = stability.** At 36M weekly downloads and v6, the API is battle-tested. Breaking changes are well-managed with migration tools.

5. **Modular provider packages.** Users install only the providers they need (`@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`). Your library can work with any of them.

6. **The AI SDK is what Mastra uses underneath.** The fact that Mastra (19.8k stars, backed by YC, used by Replit/PayPal) builds on top of the AI SDK validates it as the right abstraction level.

### Architecture Pattern with Vercel AI SDK

```typescript
import { wrapLanguageModel, generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

// Your cost management middleware
const costAwareMiddleware = {
  wrapGenerate: async ({ doGenerate, params }) => {
    // 1. Select best key based on usage/policy
    const key = await keySelector.selectKey('openai', params.model);

    // 2. Execute with selected key (key injection happens at provider creation)
    const result = await doGenerate();

    // 3. Track usage
    await usageTracker.record(key, result.usage);

    return result;
  },
  wrapStream: async ({ doStream, params }) => {
    // Same pattern for streaming
  }
};

// User code (clean, familiar)
const model = wrapLanguageModel({
  model: openai('gpt-4o'),
  middleware: costAwareMiddleware,
});

const result = await generateText({ model, prompt: 'Hello' });
```

### Secondary Consideration: Watch TanStack AI

TanStack AI is currently alpha (v0.2) but has strong potential. If it reaches stable with a middleware system, it could be a viable alternative given its MIT license, zero vendor lock-in philosophy, and excellent TypeScript type safety. Re-evaluate when it hits v1.0.

### Not Recommended

| Package | Reason |
|---------|--------|
| LangChain.js | Too heavy, streaming token usage bug, callback-based middleware |
| OpenAI SDK | Single provider, no middleware, no unified API |
| Portkey | Service/gateway model, not an embeddable library |
| Mastra | Full framework, HTTP-level middleware, overkill |
| Instructor.js | Stale, narrow scope (structured output only) |
| Ax | Opinionated DSPy paradigm, no middleware |
| LlamaIndex.TS | RAG-focused, no middleware |
| ModelFusion | Deprecated (merged into Vercel AI SDK) |

---

## Sources

- [Vercel AI SDK GitHub](https://github.com/vercel/ai)
- [AI SDK Documentation](https://ai-sdk.dev/docs/introduction)
- [AI SDK Middleware Docs](https://ai-sdk.dev/docs/ai-sdk-core/middleware)
- [AI SDK wrapLanguageModel Reference](https://ai-sdk.dev/docs/reference/ai-sdk-core/wrap-language-model)
- [AI SDK Provider Management](https://ai-sdk.dev/docs/ai-sdk-core/provider-management)
- [AI SDK 6 Release Blog](https://vercel.com/blog/ai-sdk-6)
- [LangChain.js GitHub](https://github.com/langchain-ai/langchainjs)
- [LangChain.js Chat Model Integrations](https://docs.langchain.com/oss/javascript/integrations/chat)
- [LangChain.js UsageMetadata](https://v02.api.js.langchain.com/types/_langchain_core.messages.UsageMetadata.html)
- [LangChain.js Streaming Token Bug](https://github.com/langchain-ai/langchainjs/issues/7876)
- [OpenAI Node SDK GitHub](https://github.com/openai/openai-node)
- [Portkey AI Gateway GitHub](https://github.com/Portkey-AI/gateway)
- [Portkey Node SDK GitHub](https://github.com/Portkey-AI/portkey-node-sdk)
- [Portkey Token Usage Tracking](https://portkey.ai/blog/tracking-llm-token-usage-across-providers-teams-and-workloads/)
- [Instructor.js GitHub](https://github.com/instructor-ai/instructor-js)
- [Instructor.js npm](https://www.npmjs.com/package/@instructor-ai/instructor)
- [Mastra GitHub](https://github.com/mastra-ai/mastra)
- [Mastra Middleware Docs](https://mastra.ai/docs/server/middleware)
- [TanStack AI GitHub](https://github.com/TanStack/ai)
- [TanStack AI npm](https://www.npmjs.com/package/@tanstack/ai)
- [TanStack AI Docs](https://tanstack.com/ai/latest/docs)
- [Ax (DSPy for TS) GitHub](https://github.com/ax-llm/ax)
- [Ax Documentation](https://axllm.dev/)
- [LlamaIndex.TS GitHub](https://github.com/run-llama/LlamaIndexTS)
- [ModelFusion + Vercel AI SDK Announcement](https://vercel.com/blog/vercel-ai-sdk-3-1-modelfusion-joins-the-team)
- [OpenAI SDK vs Vercel AI SDK Comparison](https://strapi.io/blog/openai-sdk-vs-vercel-ai-sdk-comparison)
- [Vercel AI SDK vs TanStack AI Comparison](https://www.better-stack.ai/p/blog/vercel-ai-sdk-vs-tanstack-ai-2026-best-ai-sdk-for-developers)
- [Top TypeScript AI Agent Frameworks 2026](https://medium.com/@wahyuikbal/top-7-typescript-frameworks-for-ai-agents-08710bc7d5ff)
- [JavaScript AI Tech Stack Dec 2025](https://www.tenxdeveloper.com/blog/ai-integration-tech-stack-javascript-2025)
- [Vercel AI SDK createOpenAI Key Discussion](https://github.com/vercel/ai/discussions/1545)
- [LangChain Runtime API Key Discussion](https://github.com/langchain-ai/langchain/discussions/16350)

---

*Last updated: 2026-03-12*
*Confidence: HIGH -- based on live web research across npm, GitHub, official docs, and community sources*
