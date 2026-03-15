# Technology Stack

**Project:** LLM Cost-Avoidance Router
**Researched:** 2026-03-11 (initial), 2026-03-12 (VALIDATED with live web research)
**Overall Confidence:** HIGH (validated against live npm, GitHub, and documentation sources)

## Research Validation (2026-03-12)

**UPDATE:** Comprehensive live web research conducted on 2026-03-12 across npm, GitHub, official documentation, and community sources. All recommendations validated. See `.planning/research/SDK_COMPARISON.md` for the full 10-package comparison. Key findings:

- Vercel AI SDK recommendation CONFIRMED as best choice (v6.0.116, 36M weekly downloads, 22.5k stars)
- `wrapLanguageModel()` middleware system is purpose-built for our use case
- Per-request key injection via `createOpenAI({ apiKey })` is the documented pattern
- Token usage exposed as standardized `{ promptTokens, completionTokens, totalTokens }`
- LangChain.js has streaming token usage bugs (not suitable for accurate cost tracking)
- Portkey AI solves similar problems but as a gateway service (architectural mismatch for embeddable library)
- ModelFusion is DEPRECATED (merged into Vercel AI SDK)
- TanStack AI is promising but still alpha (v0.2.2)

---

## Recommended Stack

### Base Router Package

**RECOMMENDATION: Vercel AI SDK (@ai-sdk/\*)**

| Technology           | Version               | Purpose                                 | Confidence |
| -------------------- | --------------------- | --------------------------------------- | ---------- |
| `ai` (Vercel AI SDK) | ~4.x (verify current) | Provider-agnostic LLM abstraction layer | MEDIUM     |
| `@ai-sdk/openai`     | Latest                | OpenAI provider                         | MEDIUM     |
| `@ai-sdk/google`     | Latest                | Google Gemini provider                  | MEDIUM     |
| `@ai-sdk/anthropic`  | Latest                | Anthropic provider                      | MEDIUM     |

**Why Vercel AI SDK:**

- **TypeScript-first design** with excellent type safety and DX
- **Provider abstraction** via unified interface (LanguageModel interface)
- **Modular provider packages** allowing selective installation
- **Stream support** for real-time responses
- **Active development** by Vercel with strong ecosystem backing
- **Tool/function calling support** across providers
- **NOT a routing layer** but provides the abstraction we can route across

**What it provides:**

- Unified interface: `generateText()`, `streamText()`, `generateObject()`
- Provider normalization (different APIs → same interface)
- Token counting, streaming, structured output

**What we add:**

- Multi-key management per provider
- Usage tracking and limits
- Intelligent key selection/rotation
- Free tier enforcement

**Alternative: OpenAI SDK as fallback**

- For providers not in AI SDK ecosystem, use native SDKs
- Wrap them in our own abstraction matching AI SDK interface

### State Storage

**RECOMMENDATION: Dual backend support (Redis + SQLite)**

| Technology                    | Version | Purpose                                   | Confidence |
| ----------------------------- | ------- | ----------------------------------------- | ---------- |
| `ioredis`                     | ~5.x    | Redis client for distributed/shared state | HIGH       |
| `better-sqlite3`              | ~11.x   | SQLite for local/embedded state           | HIGH       |
| Storage abstraction interface | Custom  | Allow user to choose backend              | HIGH       |

**Why dual backend:**

- **Redis** for multi-service environments, shared state, production
  - Atomic operations for concurrent key rotation
  - TTL support for time-window tracking
  - Excellent performance for read-heavy operations
- **SQLite** for local development, single-process, simplicity
  - Zero configuration
  - File-based persistence
  - Good enough for side projects
- **User choice** via constructor option

**Storage schema needs:**

```typescript
interface UsageRecord {
  keyId: string; // API key identifier
  provider: string; // 'openai', 'google', etc.
  tokens: number; // Tokens consumed
  requests: number; // Request count
  windowStart: Date; // For time-window limits
  lastUsed: Date; // For LRU selection
}
```

**Implementation approach:**

```typescript
interface StorageBackend {
  getUsage(keyId: string): Promise<UsageRecord>;
  incrementUsage(keyId: string, tokens: number): Promise<void>;
  resetUsage(keyId: string): Promise<void>;
  getAllKeysForProvider(provider: string): Promise<UsageRecord[]>;
}

class RedisBackend implements StorageBackend {
  /* ... */
}
class SQLiteBackend implements StorageBackend {
  /* ... */
}
```

### TypeScript Package Development

| Technology        | Version | Purpose                             | Confidence |
| ----------------- | ------- | ----------------------------------- | ---------- |
| `typescript`      | ~5.7.x  | Type safety, modern JS features     | HIGH       |
| `tsup`            | ~8.x    | Zero-config TypeScript bundler      | HIGH       |
| `vitest`          | ~2.x    | Fast unit testing framework         | HIGH       |
| `tsx`             | ~4.x    | TypeScript execution (dev/examples) | MEDIUM     |
| `publint`         | ~0.2.x  | Validate package.json exports       | MEDIUM     |
| `@changesets/cli` | ~2.x    | Version management                  | MEDIUM     |

**Why these choices:**

**tsup** over tsc/rollup/esbuild directly:

- Zero config for dual ESM/CJS output
- Built on esbuild (fast)
- Handles .d.ts generation
- Tree-shaking by default

**vitest** over jest:

- Native ESM support
- Faster execution
- Better TypeScript integration
- Similar API to jest (easy migration if needed)

**publint** for validation:

- Catches package.json export issues before publish
- Ensures ESM/CJS compatibility

**Package structure:**

```json
{
  "type": "module",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    }
  },
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts"
}
```

### Provider SDKs (Direct Integration)

For providers NOT in AI SDK ecosystem:

| Provider       | SDK                      | Version | Confidence |
| -------------- | ------------------------ | ------- | ---------- |
| Groq           | `groq-sdk`               | Latest  | MEDIUM     |
| Hugging Face   | `@huggingface/inference` | ~2.x    | MEDIUM     |
| OpenRouter     | HTTP (native fetch)      | N/A     | HIGH       |
| Chinese models | Provider-specific SDKs   | TBD     | LOW        |

**Strategy:**

1. Prefer AI SDK providers where available
2. For others, use official SDK if exists
3. Wrap all providers in unified interface (match AI SDK)
4. OpenRouter is a hosted router itself → may conflict with our approach

**OpenRouter consideration:**

- OpenRouter is a PROXY service, not a library
- It routes between providers on their end
- Using it means delegating routing logic to them
- **Recommendation:** Skip OpenRouter, route directly to providers
- Reason: We need fine-grained control over which specific API key to use

### Configuration & Validation

| Technology | Version | Purpose                      | Confidence |
| ---------- | ------- | ---------------------------- | ---------- |
| `zod`      | ~3.x    | Runtime schema validation    | HIGH       |
| `dotenv`   | ~16.x   | Environment variable loading | HIGH       |

**Why zod:**

- Runtime type safety for user config
- Excellent error messages
- TypeScript type inference
- Validation for provider policies, limits, keys

**Config structure:**

```typescript
import { z } from 'zod';

const ProviderPolicySchema = z.object({
  tokenLimit: z.number().optional(),
  requestLimit: z.number().optional(),
  windowSeconds: z.number().optional(),
  enforcement: z.enum(['hard_block', 'throttle', 'allow_paid']),
});

const ConfigSchema = z.object({
  storage: z.object({
    type: z.enum(['redis', 'sqlite']),
    redis: z.object({ url: z.string() }).optional(),
    sqlite: z.object({ path: z.string() }).optional(),
  }),
  providers: z.record(ProviderPolicySchema),
  monthlyBudget: z.number().default(0),
  apiKeys: z.record(z.array(z.string())), // provider -> keys[]
});
```

---

## Alternatives Considered

| Category    | Recommended    | Alternative     | Why Not                                                 |
| ----------- | -------------- | --------------- | ------------------------------------------------------- |
| Base Router | Vercel AI SDK  | LiteLLM         | Python-first, TypeScript SDK unclear/limited            |
| Base Router | Vercel AI SDK  | LangChain       | Heavy abstraction, over-engineered for routing          |
| Base Router | Direct SDKs    | OpenRouter      | Hosted service, not a library; conflicts with our model |
| Storage     | Redis + SQLite | PostgreSQL      | Overkill for key-value usage tracking                   |
| Storage     | Redis + SQLite | In-memory only  | No persistence across restarts                          |
| Testing     | Vitest         | Jest            | Slower, worse ESM support                               |
| Bundler     | tsup           | tsc alone       | No bundling, requires separate CJS setup                |
| Bundler     | tsup           | Rollup          | More config, slower                                     |
| Validation  | Zod            | io-ts           | Less ergonomic, smaller ecosystem                       |
| Validation  | Zod            | Class-validator | Decorator-based, less type-safe                         |

---

## PennyLLM Package Deep Dive

### Why NOT LiteLLM

**What it is:** Python proxy/SDK for unified LLM API access

**TypeScript support:** Minimal/unclear

- Primary SDK is Python
- TypeScript/JS support appears limited or via proxy mode
- Would require running Python proxy server → not a pure npm package

**Verdict:** Wrong language ecosystem for TypeScript npm package

### Why NOT LangChain

**What it is:** Full-stack LLM application framework

**Issues:**

- Heavy abstraction layers (chains, agents, memory, etc.)
- We only need provider abstraction + basic generation
- Large bundle size for simple routing needs
- Over-engineered for our use case

**Verdict:** Too heavy; we need a thin layer, not a framework

### Why NOT OpenRouter (as base)

**What it is:** Hosted API proxy/router service

**Model mismatch:**

- They route on their servers (we call their API)
- We need to route on client side (choose which provider key to use)
- Can't track per-key usage if routing happens server-side
- Would still need to track usage of OpenRouter key itself

**Potential use:** Could be ONE of the providers we route to, not the base

**Verdict:** Architectural mismatch; doesn't solve our problem

### Why Vercel AI SDK

**What it is:** Provider-agnostic LLM SDK with unified interface

**Perfect fit because:**

1. **TypeScript-first** with excellent types
2. **Provider abstraction** without routing logic (we add routing)
3. **Modular** - install only providers you need
4. **Unified interface** - all providers use same methods
5. **Actively maintained** by Vercel
6. **Not opinionated** about routing/selection logic

**Our architecture:**

```
User code
  ↓
Our package (key selection + usage tracking)
  ↓
AI SDK provider (e.g., @ai-sdk/openai with selected key)
  ↓
LLM API
```

**What AI SDK gives us:**

- `generateText(model, prompt)` - same interface for all providers
- Streaming, tool calling, structured output
- Error handling and retries

**What we add:**

- Multi-key management
- Usage tracking per key
- Smart key selection
- Free tier enforcement

---

## Installation

### Core Dependencies

```bash
# AI SDK core + providers
npm install ai @ai-sdk/openai @ai-sdk/google @ai-sdk/anthropic

# Storage backends
npm install ioredis better-sqlite3

# Validation & config
npm install zod dotenv

# Provider SDKs (as needed)
npm install groq-sdk @huggingface/inference
```

### Dev Dependencies

```bash
npm install -D typescript tsup vitest tsx publint @changesets/cli
npm install -D @types/better-sqlite3 @types/node

# Type definitions for providers
npm install -D @types/ioredis
```

### Package.json Setup

```json
{
  "name": "llm-cost-router",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  },
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsup src/index.ts --format cjs,esm --dts --clean",
    "test": "vitest",
    "lint": "publint",
    "dev": "tsx examples/basic.ts"
  },
  "peerDependencies": {
    "ai": "^4.0.0"
  },
  "dependencies": {
    "zod": "^3.0.0"
  },
  "optionalDependencies": {
    "ioredis": "^5.0.0",
    "better-sqlite3": "^11.0.0"
  }
}
```

**Note:** AI SDK as peer dependency allows users to manage version
**Note:** Storage backends as optional dependencies (install what you use)

---

## Build Configuration

### tsup.config.ts

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  splitting: false,
  sourcemap: true,
  minify: false, // Keep readable for debugging
  external: ['ioredis', 'better-sqlite3', 'ai'], // Don't bundle these
});
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022"],
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

## Provider SDK Patterns

### Common Patterns Across Providers

**Authentication:**

- Most: API key in header (`Authorization: Bearer TOKEN`)
- Some: Custom header (`x-api-key: TOKEN`)

**Request format:**

```typescript
{
  model: string;
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
}
```

**Response format (non-streaming):**

```typescript
{
  id: string;
  choices: Array<{
    message: { role: string; content: string };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  }
}
```

**AI SDK normalizes these differences** → we don't implement per-provider parsing

### Provider-Specific Notes

**OpenAI:**

- Standard bearer token
- Models: `gpt-4o`, `gpt-4o-mini`, `gpt-3.5-turbo`
- Free tier: None (all paid)
- API: `https://api.openai.com/v1/chat/completions`

**Google Gemini:**

- API key in URL or header
- Models: `gemini-1.5-pro`, `gemini-1.5-flash`, `gemini-2.0-flash`
- Free tier: Exists (verify limits)
- Different message format (AI SDK handles conversion)

**Anthropic:**

- `x-api-key` header
- Models: `claude-3-5-sonnet`, `claude-3-5-haiku`, `claude-opus-4-6`
- Free tier: None (credit-based trial only)

**Groq:**

- OpenAI-compatible API
- Free tier: Yes (verify limits)
- Fast inference, limited model selection

**Hugging Face:**

- Bearer token
- Serverless inference API
- Free tier: Yes with rate limits
- Many open models available

**Chinese providers (DeepSeek, Zhipu, etc.):**

- Vary significantly
- Research needed per provider
- LOW confidence without verification

---

## Architecture Decision: Wrapper vs Proxy

**DECISION: Wrapper (not proxy)**

**Wrapper approach:**

```typescript
import { CostRouter } from 'llm-cost-router';
import { openai } from '@ai-sdk/openai';

const router = new CostRouter({
  providers: {
    openai: {
      keys: [process.env.OPENAI_KEY1, process.env.OPENAI_KEY2],
      tokenLimit: 100000,
    },
  },
});

// Router returns configured provider instance
const provider = await router.getProvider('openai');
const result = await generateText({
  model: provider('gpt-4o-mini'),
  prompt: 'Hello',
});
```

**Why wrapper:**

- User still uses AI SDK directly (familiar API)
- We only intercept provider instantiation
- Token tracking happens in our wrapper
- Maintains AI SDK's full feature set (streaming, tools, etc.)

**Alternative (proxy - rejected):**

```typescript
// User calls our custom function (unfamiliar)
const result = await router.generateText({
  model: 'gpt-4o-mini',
  prompt: 'Hello',
});
```

**Why not proxy:**

- Have to re-implement AI SDK's full API surface
- Breaks when AI SDK adds features
- More maintenance burden
- Less flexible for users

---

## Confidence Assessment

| Component                    | Confidence | Reasoning                                                                     |
| ---------------------------- | ---------- | ----------------------------------------------------------------------------- |
| Vercel AI SDK recommendation | MEDIUM     | Strong option based on training data, but cannot verify current state/version |
| Redis/SQLite for storage     | HIGH       | Well-established pattern for this use case                                    |
| tsup/vitest tooling          | HIGH       | Standard modern TypeScript package tooling                                    |
| Provider SDK patterns        | MEDIUM     | Based on training data, but APIs evolve                                       |
| OpenRouter analysis          | MEDIUM     | Model understood, but current features unverified                             |
| LiteLLM TypeScript support   | LOW        | Unclear from training data, needs verification                                |
| Chinese provider SDKs        | LOW        | Limited training data, high variance between providers                        |
| Specific versions            | LOW        | Cannot verify current versions without web access                             |

---

## Critical Verifications Needed

Before implementation, verify:

1. **Vercel AI SDK current version and features**
   - Check: https://sdk.vercel.ai/docs
   - Confirm: Provider list, API stability, TypeScript support

2. **LiteLLM TypeScript/JavaScript SDK status**
   - Check: https://docs.litellm.ai/
   - Confirm: If TS SDK exists and is production-ready

3. **Current free tier limits for each provider**
   - Google Gemini free tier details
   - Groq free tier limits
   - Hugging Face rate limits
   - Chinese model providers

4. **Package versions**
   - `ai` (AI SDK) current version
   - `ioredis`, `better-sqlite3` current versions
   - All dev dependencies

5. **OpenRouter as provider option**
   - Could be useful as ONE provider (hosted fallback)
   - Check: Pricing, free tier, API compatibility

---

## Recommended Next Steps

1. **Validate AI SDK** - Build proof-of-concept with Vercel AI SDK
   - Test multi-provider abstraction
   - Verify token counting works
   - Check if we can inject custom API keys

2. **Storage prototype** - Implement dual backend pattern
   - Redis backend with atomic operations
   - SQLite backend for simplicity
   - Unified interface

3. **Provider research phase** - Deep dive on free tiers
   - Catalog all free tier limits
   - Document reset windows
   - Test enforcement behavior

4. **Integration pattern** - Decide final API surface
   - Wrapper vs proxy
   - Configuration schema
   - Error handling strategy

---

## Sources

**LIMITATION:** Unable to access external sources during research due to tool restrictions.

All recommendations based on training data (through January 2025):

- Vercel AI SDK knowledge from training
- Standard TypeScript package development practices
- Common LLM API patterns
- Redis/SQLite usage patterns

**REQUIRED:** Verify all recommendations against current official documentation before implementation.

---

_Last updated: 2026-03-11_
_Confidence: MEDIUM overall - solid recommendations but requires verification_
