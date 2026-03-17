# pennyllm

**Stop paying for LLM API calls during development.**

[![npm](https://img.shields.io/npm/v/pennyllm)](https://www.npmjs.com/package/pennyllm)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Zero runtime dependencies beyond peer deps. Works with [Vercel AI SDK](https://sdk.vercel.ai/).

```typescript
import { createRouter, defineConfig } from 'pennyllm';
import { generateText } from 'ai';

const router = await createRouter(
  defineConfig({
    providers: {
      cerebras: { keys: [process.env.CEREBRAS_API_KEY!], priority: 1 },
      google: { keys: [process.env.GOOGLE_GENERATIVE_AI_API_KEY!], priority: 2 },
    },
  }),
);

// Automatic routing through model chain
const { text } = await generateText({
  model: router.chat(),
  prompt: 'Explain quantum computing',
});
```

---

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [How It Works](#how-it-works)
- [Configuration](#configuration)
- [Providers](#providers)
- [Debug Mode](#debug-mode)
- [Storage Adapters](#storage-adapters)
- [Events & Hooks](#events--hooks)
- [Comparison](#comparison)
- [API Reference](#api-reference)
- [Contributing](#contributing)
- [License](#license)

## Installation

```bash
npm install pennyllm ai @ai-sdk/google
```

`ai` (Vercel AI SDK) is a peer dependency. Install provider SDKs for each provider you use:

```bash
# Using Cerebras?
npm install @ai-sdk/cerebras

# Using Groq?
npm install @ai-sdk/groq

# Using Mistral?
npm install @ai-sdk/mistral
```

> **Node.js >= 18.0.0 required.**

## Quick Start

### 1. Get a free API key

Sign up at [Google AI Studio](https://aistudio.google.com/apikey) -- it takes 30 seconds.

### 2. Create a router

```typescript
import { createRouter, defineConfig } from 'pennyllm';
import { generateText } from 'ai';

const router = await createRouter(
  defineConfig({
    providers: {
      google: { keys: [process.env.GOOGLE_GENERATIVE_AI_API_KEY!], priority: 1 },
    },
  }),
);

// Automatic model chain routing
const { text } = await generateText({
  model: router.chat(),
  prompt: 'Explain quicksort in 3 sentences.',
});

console.log(text);

// Clean up when done
await router.close();
```

That's it. The router manages key selection, model chain fallback, and rate limit handling transparently.

## How It Works

```
Request --> router.chat() --> Chain Executor --> Provider API
                 |                 |
           Model Chain        Key Selection
           (priority order)   (rotation + cooldown)
                 |                 |
           429/402 fallback   Usage Tracking
           (next in chain)    (observability)
```

pennyllm wraps the Vercel AI SDK's `wrapLanguageModel()` to transparently manage API keys and model routing. When you call `router.chat()`, the chain executor walks through your model priority chain, trying each model in order. If a provider returns 429 (rate limit) or 402 (quota exhausted), it automatically falls back to the next model in the chain.

**Key concepts:**

- **Model chain** -- Define a priority-ordered list of models. The router tries each in order, falling back on errors.
- **Key rotation** -- Distribute requests across multiple API keys per provider to stay within free tier limits.
- **Reactive rate limiting** -- No internal usage tracking for routing decisions. Provider 429/402 responses drive cooldown and fallback.
- **Budget caps** -- Set a monthly spending limit. Free models are tried first; paid models only when budget allows.

## Configuration

### Minimal (single provider)

```typescript
import { createRouter, defineConfig } from 'pennyllm';

const router = await createRouter(
  defineConfig({
    providers: {
      google: { keys: [process.env.GOOGLE_GENERATIVE_AI_API_KEY!], priority: 1 },
    },
  }),
);
```

### Multi-provider with model chain

```typescript
import { createRouter, defineConfig } from 'pennyllm';

const router = await createRouter(
  defineConfig({
    providers: {
      cerebras: { keys: [process.env.CEREBRAS_API_KEY!], priority: 1 },
      google: { keys: [process.env.GOOGLE_GENERATIVE_AI_API_KEY!], priority: 2 },
      groq: { keys: [process.env.GROQ_API_KEY!], priority: 3 },
    },
    // Explicit model chain (optional -- auto-generated from provider priorities if omitted)
    models: [
      'cerebras/gpt-oss-120b',
      'google/gemini-2.5-flash',
      'groq/meta-llama/llama-4-scout-17b-16e-instruct',
    ],
    budget: { monthlyLimit: 5.0 },
    debug: true,
  }),
);
```

`defineConfig()` provides IDE autocomplete for all 6 known provider names. Multiple keys per provider lets the router rotate through them when free tier limits are hit.

### Using router.chat()

`router.chat()` is the primary API. It returns a Vercel AI SDK model that automatically routes through the model chain:

```typescript
import { generateText } from 'ai';

// Basic usage -- routes through model chain automatically
const { text } = await generateText({
  model: router.chat(),
  prompt: 'Explain quantum computing',
});

// Filter by capability
const { text: reasoning } = await generateText({
  model: router.chat({ capabilities: ['reasoning'] }),
  prompt: 'Solve this logic puzzle...',
});

// Filter by provider
const { text: googleOnly } = await generateText({
  model: router.chat({ provider: 'google' }),
  prompt: 'Hello',
});
```

### Direct model access

Bypass the chain and use a specific model:

```typescript
const model = await router.wrapModel('google/gemini-2.5-flash');
const { text } = await generateText({ model, prompt: 'Hello' });
```

### Check chain status

```typescript
const status = router.getStatus();
console.log(`${status.availableModels}/${status.totalModels} models available`);
console.log('Depleted:', status.depletedProviders);
```

### Storage adapter (persistent tracking)

By default, usage data lives in memory and resets when your process restarts. For persistence across restarts, use a storage adapter:

```typescript
import { createRouter } from 'pennyllm';
import { SqliteStorage } from 'pennyllm/sqlite';

const router = await createRouter(
  defineConfig({
    providers: {
      google: { keys: [process.env.GOOGLE_GENERATIVE_AI_API_KEY!], priority: 1 },
    },
  }),
  {
    storage: new SqliteStorage({ path: './usage.db' }),
  },
);
```

### Config file (YAML/JSON)

```typescript
import { createRouter } from 'pennyllm';

const router = await createRouter('./router.config.yaml');
```

## Providers

pennyllm supports 6 providers optimized for free-tier usage:

| Provider         | Tier | Package                     | Env Var                        | Sign Up                                                   |
| ---------------- | ---- | --------------------------- | ------------------------------ | --------------------------------------------------------- |
| Cerebras         | Free | `@ai-sdk/cerebras`          | `CEREBRAS_API_KEY`             | [cloud.cerebras.ai](https://cloud.cerebras.ai)            |
| Google AI Studio | Free | `@ai-sdk/google`            | `GOOGLE_GENERATIVE_AI_API_KEY` | [aistudio.google.com](https://aistudio.google.com/apikey) |
| Groq             | Free | `@ai-sdk/groq`              | `GROQ_API_KEY`                 | [console.groq.com](https://console.groq.com)              |
| SambaNova        | Free | `sambanova-ai-provider`     | `SAMBANOVA_API_KEY`            | [cloud.sambanova.ai](https://cloud.sambanova.ai)          |
| NVIDIA NIM       | Free | `@ai-sdk/openai-compatible` | `NVIDIA_API_KEY`               | [build.nvidia.com](https://build.nvidia.com)              |
| Mistral          | Free | `@ai-sdk/mistral`           | `MISTRAL_API_KEY`              | [console.mistral.ai](https://console.mistral.ai)          |

Start with **Cerebras + Google + Groq** -- they have the most generous perpetual free tiers and the fastest inference.

> **Dropped providers:** GitHub Models, HuggingFace, Cohere, Cloudflare, Qwen/DashScope, OpenRouter, Together AI, DeepSeek direct, and Fireworks are no longer supported.

## Debug Mode

Debug mode shows every routing decision as a structured one-line summary.

### Enable via config

```typescript
const router = await createRouter(
  defineConfig({
    providers: { google: { keys: [process.env.GOOGLE_GENERATIVE_AI_API_KEY!], priority: 1 } },
    debug: true,
  }),
);
```

### Enable via environment variable

```bash
DEBUG=pennyllm:* node app.js
```

### Example output

```
[pennyllm:key-selected]     cerebras/gpt-oss-120b -> key#0 (priority)
[pennyllm:usage-recorded]   cerebras key#0: +1247 tokens
[pennyllm:chain-resolved]   cerebras/gpt-oss-120b (position 0, no fallback, 312ms)
[pennyllm:budget-alert]     $3.47 / $5.00 monthly (69%)
```

## Storage Adapters

### MemoryStorage (default)

In-memory storage. Usage data resets when the process exits. Good for development and short-lived scripts.

```typescript
import { createRouter, defineConfig } from 'pennyllm';

// MemoryStorage is the default -- no configuration needed
const router = await createRouter(
  defineConfig({
    providers: { google: { keys: [process.env.GOOGLE_GENERATIVE_AI_API_KEY!], priority: 1 } },
  }),
);
```

### SqliteStorage

Persistent storage using SQLite. Usage data survives restarts.

```bash
npm install better-sqlite3
```

```typescript
import { createRouter, defineConfig } from 'pennyllm';
import { SqliteStorage } from 'pennyllm/sqlite';

const router = await createRouter(
  defineConfig({
    providers: { google: { keys: [process.env.GOOGLE_GENERATIVE_AI_API_KEY!], priority: 1 } },
  }),
  { storage: new SqliteStorage({ path: './usage.db' }) },
);
```

### RedisStorage

Shared storage for multi-process or distributed deployments.

```bash
npm install ioredis
```

```typescript
import { createRouter, defineConfig } from 'pennyllm';
import { RedisStorage } from 'pennyllm/redis';

const router = await createRouter(
  defineConfig({
    providers: { google: { keys: [process.env.GOOGLE_GENERATIVE_AI_API_KEY!], priority: 1 } },
  }),
  { storage: new RedisStorage({ url: 'redis://localhost:6379' }) },
);
```

## Events & Hooks

The router emits typed events for every routing decision. Use convenience hooks for type-safe subscriptions:

```typescript
const router = await createRouter(config);

// Subscribe to chain resolution events
const unsubscribe = router.onChainResolved((event) => {
  console.log(
    `Resolved: ${event.resolvedModel} (position ${event.chainPosition}, ${event.latencyMs}ms)`,
  );
});

// Subscribe to key selection events
router.onKeySelected((event) => {
  console.log(`${event.provider}/${event.model} -> key#${event.keyIndex} (${event.reason})`);
});

// Subscribe to budget alerts
router.onBudgetAlert((event) => {
  console.log(`Budget: $${event.currentSpend} / $${event.limit} (${event.percentage}%)`);
});

// Subscribe to provider depletion
router.onProviderDepleted((event) => {
  console.log(`Provider ${event.provider} depleted: ${event.reason}`);
});

// Unsubscribe when done
unsubscribe();
```

### Available hooks

| Hook                           | Fires when                                  |
| ------------------------------ | ------------------------------------------- |
| `router.onChainResolved()`     | Chain resolves a model for a request        |
| `router.onKeySelected()`       | A key is selected for a request             |
| `router.onUsageRecorded()`     | Token usage is recorded after a response    |
| `router.onLimitWarning()`      | Usage approaches a configured threshold     |
| `router.onLimitExceeded()`     | A key's quota limit is exceeded             |
| `router.onFallbackTriggered()` | Request falls back to another provider      |
| `router.onProviderDepleted()`  | A provider is permanently exhausted (402)   |
| `router.onProviderStale()`     | Provider data hasn't been verified recently |
| `router.onBudgetAlert()`       | Spending approaches the monthly limit       |
| `router.onBudgetExceeded()`    | Monthly budget limit is reached             |
| `router.onError()`             | A provider returns an error                 |

You can also use the raw `router.on(event, handler)` / `router.off(event, handler)` API for untyped event access.

## Comparison

| Feature              | pennyllm                         | Manual Key Management | LiteLLM           |
| -------------------- | -------------------------------- | --------------------- | ----------------- |
| Language             | TypeScript                       | Any                   | Python            |
| Setup                | `npm install`                    | DIY                   | Docker + Postgres |
| Free tier tracking   | Built-in                         | Manual                | No                |
| Key rotation         | Automatic                        | Manual                | Manual            |
| Budget caps          | Yes                              | No                    | Yes               |
| Model chain fallback | Automatic                        | Manual                | Manual            |
| AI SDK integration   | Native                           | None                  | Proxy             |
| Runtime dependencies | 3 (zod, debug, @ai-sdk/provider) | 0                     | 100+              |

**pennyllm** is purpose-built for TypeScript developers using the Vercel AI SDK who want to maximize free tier usage across multiple providers. If you're building in Python or need a universal proxy, LiteLLM is the better choice.

## API Reference

### Core

| Export                           | Description                                              |
| -------------------------------- | -------------------------------------------------------- |
| `createRouter(config, options?)` | Create a router instance from config object or file path |
| `defineConfig(config)`           | Type-safe config helper with IDE autocomplete            |
| `configSchema`                   | Zod schema for config validation                         |
| `loadConfigFile(path)`           | Load config from YAML or JSON file                       |

### Router Instance

| Method                                    | Description                                    |
| ----------------------------------------- | ---------------------------------------------- |
| `router.chat(filter?)`                    | Get a model that routes through the chain      |
| `router.getStatus()`                      | Get chain status (available/depleted models)   |
| `router.wrapModel(modelId, options?)`     | Wrap a specific model with routing and retry   |
| `router.model(modelId, options?)`         | Select a key without wrapping (for manual use) |
| `router.getUsage()`                       | Get usage snapshot across all providers        |
| `router.getUsage(provider)`               | Get usage for a specific provider              |
| `router.resetUsage(provider?, keyIndex?)` | Reset usage counters                           |
| `router.close()`                          | Clean up resources (catalog, storage)          |

### Chain Filter Options

| Field          | Type       | Description                                                                                      |
| -------------- | ---------- | ------------------------------------------------------------------------------------------------ |
| `capabilities` | `string[]` | Filter to models with these capabilities (`reasoning`, `toolCall`, `vision`, `structuredOutput`) |
| `provider`     | `string`   | Filter to a specific provider                                                                    |
| `tier`         | `string`   | Filter by quality tier (`frontier`, `high`, `mid`)                                               |

### Storage Adapters

| Export          | Import Path         |
| --------------- | ------------------- |
| `MemoryStorage` | `'pennyllm'`        |
| `SqliteStorage` | `'pennyllm/sqlite'` |
| `RedisStorage`  | `'pennyllm/redis'`  |

### Policy Helpers

| Export                          | Description                           |
| ------------------------------- | ------------------------------------- |
| `createTokenLimit(max, window)` | Create a token usage limit            |
| `createRateLimit(max, window)`  | Create a rate limit (requests/window) |
| `createCallLimit(max, window)`  | Create a call count limit             |

All types are exported from `pennyllm` and `pennyllm/types`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, build commands, and guidelines.

## License

[MIT](LICENSE)
