# llm-router

**Stop paying for LLM API calls during development.**

[![npm](https://img.shields.io/npm/v/llm-router)](https://www.npmjs.com/package/llm-router)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Zero runtime dependencies beyond peer deps. Works with [Vercel AI SDK](https://sdk.vercel.ai/).

```typescript
import { createRouter } from 'llm-router';
import { generateText } from 'ai';

const router = await createRouter({
  providers: { google: { keys: [process.env.GOOGLE_API_KEY!] } },
});

const model = await router.wrapModel('google/gemini-2.0-flash');
const { text } = await generateText({ model, prompt: 'Hello!' });
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
npm install llm-router ai @ai-sdk/google
```

`ai` (Vercel AI SDK) is a peer dependency. Install provider SDKs for each provider you use:

```bash
# Using Groq? Add its SDK:
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
import { createRouter } from 'llm-router';
import { generateText } from 'ai';

const router = await createRouter({
  providers: {
    google: { keys: [process.env.GOOGLE_API_KEY!] },
  },
});

const model = await router.wrapModel('google/gemini-2.0-flash');
const { text } = await generateText({ model, prompt: 'Explain quicksort in 3 sentences.' });

console.log(text);

// Clean up when done
await router.close();
```

That's it. The router manages key selection, quota tracking, and rate limit handling transparently.

## How It Works

```
Request ──> Router ──> Key Selection ──> [Fallback Chain] ──> Provider API
               |            |                  |
               |      Policy Engine       Budget Check
               |      (quota check)       (cost guard)
               |            |                  |
               +── Usage Tracking ──+── Retry Proxy ──+
```

llm-router wraps the Vercel AI SDK's `wrapLanguageModel()` to transparently manage API keys. It checks quotas, selects the best available key, handles rate limits with automatic retry and key rotation, and falls back to alternative providers when all keys are exhausted.

**Key concepts:**

- **Key rotation** -- Distribute requests across multiple API keys per provider to stay within free tier limits.
- **Policy engine** -- Track token usage, request counts, and rate limits per key with configurable thresholds.
- **Fallback chains** -- When one provider's keys are exhausted, automatically fall back to another provider with equivalent model capabilities.
- **Budget caps** -- Set a monthly spending limit. Free models are tried first; paid models only when budget allows.

## Configuration

### Minimal (single provider)

```typescript
import { createRouter } from 'llm-router';

const router = await createRouter({
  providers: {
    google: { keys: [process.env.GOOGLE_API_KEY!] },
  },
});
```

All configuration fields besides `providers` have sensible defaults. That's all you need to get started.

### Multi-provider with budget

```typescript
import { createRouter, defineConfig } from 'llm-router';

const config = defineConfig({
  providers: {
    google: {
      keys: [process.env.GOOGLE_KEY_1!, process.env.GOOGLE_KEY_2!, process.env.GOOGLE_KEY_3!],
    },
    groq: { keys: [process.env.GROQ_KEY_1!, process.env.GROQ_KEY_2!] },
    openrouter: { keys: [process.env.OPENROUTER_KEY!] },
  },
  budget: { monthlyLimit: 5.0 },
  fallback: { behavior: 'auto' },
  debug: true,
});

const router = await createRouter(config);
```

`defineConfig()` provides IDE autocomplete for all 12 known provider names. Multiple keys per provider lets the router rotate through them when free tier limits are hit.

### Storage adapter (persistent tracking)

By default, usage data lives in memory and resets when your process restarts. For persistence across restarts, use a storage adapter:

```typescript
import { createRouter } from 'llm-router';
import { SqliteStorage } from 'llm-router/sqlite';

const router = await createRouter(
  {
    providers: {
      google: { keys: [process.env.GOOGLE_API_KEY!] },
      groq: { keys: [process.env.GROQ_API_KEY!] },
    },
  },
  {
    storage: new SqliteStorage({ path: './usage.db' }),
  },
);
```

Usage data persists in `usage.db` -- key rotation decisions survive process restarts, server deployments, and dev-server reloads.

### Config file (YAML/JSON)

```typescript
import { createRouter } from 'llm-router';

const router = await createRouter('./router.config.yaml');
```

## Providers

llm-router supports 12 providers out of the box. Each provider has a detailed setup guide with free tier limits, key acquisition steps, and configuration examples.

| Provider              | Package               | Guide                                                          |
| --------------------- | --------------------- | -------------------------------------------------------------- |
| Google AI Studio      | `@ai-sdk/google`      | [docs/providers/google.md](docs/providers/google.md)           |
| Groq                  | `@ai-sdk/groq`        | [docs/providers/groq.md](docs/providers/groq.md)               |
| OpenRouter            | `@ai-sdk/openrouter`  | [docs/providers/openrouter.md](docs/providers/openrouter.md)   |
| Mistral               | `@ai-sdk/mistral`     | [docs/providers/mistral.md](docs/providers/mistral.md)         |
| HuggingFace           | `@ai-sdk/huggingface` | [docs/providers/huggingface.md](docs/providers/huggingface.md) |
| Cerebras              | `@ai-sdk/cerebras`    | [docs/providers/cerebras.md](docs/providers/cerebras.md)       |
| DeepSeek              | `@ai-sdk/deepseek`    | [docs/providers/deepseek.md](docs/providers/deepseek.md)       |
| Qwen                  | `@ai-sdk/qwen`        | [docs/providers/qwen.md](docs/providers/qwen.md)               |
| Cloudflare Workers AI | `@ai-sdk/cloudflare`  | [docs/providers/cloudflare.md](docs/providers/cloudflare.md)   |
| NVIDIA NIM            | `@ai-sdk/nvidia`      | [docs/providers/nvidia.md](docs/providers/nvidia.md)           |
| Cohere                | `@ai-sdk/cohere`      | [docs/providers/cohere.md](docs/providers/cohere.md)           |
| GitHub Models         | `@ai-sdk/github`      | [docs/providers/github.md](docs/providers/github.md)           |

Start with **Google + Groq + OpenRouter** -- they're the easiest to set up and have the most generous free tiers.

## Debug Mode

Debug mode shows every routing decision as a structured one-line summary.

### Enable via config

```typescript
const router = await createRouter({
  providers: { google: { keys: [process.env.GOOGLE_API_KEY!] } },
  debug: true,
});
```

### Enable via environment variable

```bash
DEBUG=llm-router:* node app.js
```

### Example output

```
[llm-router:key-selected]     google/gemini-2.0-flash -> key#0 (priority)
[llm-router:usage-recorded]   google key#0: +1247 tokens (847/1500 RPM)
[llm-router:fallback]         google exhausted -> groq/llama-3.3-70b (quality-match)
[llm-router:budget-alert]     $3.47 / $5.00 monthly (69%)
```

Debug mode subscribes to the router's typed observability hooks and prints structured summaries to stdout. The `debug` npm package's low-level output (stderr) remains available separately.

## Storage Adapters

### MemoryStorage (default)

In-memory storage. Usage data resets when the process exits. Good for development and short-lived scripts.

```typescript
import { createRouter } from 'llm-router';

// MemoryStorage is the default -- no configuration needed
const router = await createRouter({
  providers: { google: { keys: [process.env.GOOGLE_API_KEY!] } },
});
```

### SqliteStorage

Persistent storage using SQLite. Usage data survives restarts.

```bash
npm install better-sqlite3
```

```typescript
import { createRouter } from 'llm-router';
import { SqliteStorage } from 'llm-router/sqlite';

const router = await createRouter(config, {
  storage: new SqliteStorage({ path: './usage.db' }),
});
```

### RedisStorage

Shared storage for multi-process or distributed deployments.

```bash
npm install ioredis
```

```typescript
import { createRouter } from 'llm-router';
import { RedisStorage } from 'llm-router/redis';

const router = await createRouter(config, {
  storage: new RedisStorage({ url: 'redis://localhost:6379' }),
});
```

## Events & Hooks

The router emits typed events for every routing decision. Use convenience hooks for type-safe subscriptions:

```typescript
const router = await createRouter(config);

// Subscribe to key selection events
const unsubscribe = router.onKeySelected((event) => {
  console.log(`${event.provider}/${event.model} -> key#${event.keyIndex} (${event.reason})`);
});

// Subscribe to fallback events
router.onFallbackTriggered((event) => {
  console.log(`Fallback: ${event.fromProvider} -> ${event.toProvider} (${event.reason})`);
});

// Subscribe to budget alerts
router.onBudgetAlert((event) => {
  console.log(`Budget: $${event.currentSpend} / $${event.limit} (${event.percentage}%)`);
});

// Unsubscribe when done
unsubscribe();
```

### Available hooks

| Hook                           | Fires when                               |
| ------------------------------ | ---------------------------------------- |
| `router.onKeySelected()`       | A key is selected for a request          |
| `router.onUsageRecorded()`     | Token usage is recorded after a response |
| `router.onLimitWarning()`      | Usage approaches a configured threshold  |
| `router.onLimitExceeded()`     | A key's quota limit is exceeded          |
| `router.onFallbackTriggered()` | Request falls back to another provider   |
| `router.onBudgetAlert()`       | Spending approaches the monthly limit    |
| `router.onBudgetExceeded()`    | Monthly budget limit is reached          |
| `router.onError()`             | A provider returns an error              |

You can also use the raw `router.on(event, handler)` / `router.off(event, handler)` API for untyped event access.

## Comparison

| Feature              | llm-router                       | Manual Key Management | LiteLLM           |
| -------------------- | -------------------------------- | --------------------- | ----------------- |
| Language             | TypeScript                       | Any                   | Python            |
| Setup                | `npm install`                    | DIY                   | Docker + Postgres |
| Free tier tracking   | Built-in                         | Manual                | No                |
| Key rotation         | Automatic                        | Manual                | Manual            |
| Budget caps          | Yes                              | No                    | Yes               |
| Fallback chains      | Automatic                        | Manual                | Manual            |
| AI SDK integration   | Native                           | None                  | Proxy             |
| Runtime dependencies | 3 (zod, debug, @ai-sdk/provider) | 0                     | 100+              |

**llm-router** is purpose-built for TypeScript developers using the Vercel AI SDK who want to maximize free tier usage across multiple providers. If you're building in Python or need a universal proxy, LiteLLM is the better choice.

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
| `router.wrapModel(modelId, options?)`     | Wrap a model with routing, retry, and fallback |
| `router.model(modelId, options?)`         | Select a key without wrapping (for manual use) |
| `router.getUsage()`                       | Get usage snapshot across all providers        |
| `router.getUsage(provider)`               | Get usage for a specific provider              |
| `router.resetUsage(provider?, keyIndex?)` | Reset usage counters                           |
| `router.close()`                          | Clean up resources (catalog, storage)          |

### Storage Adapters

| Export          | Import Path           |
| --------------- | --------------------- |
| `MemoryStorage` | `'llm-router'`        |
| `SqliteStorage` | `'llm-router/sqlite'` |
| `RedisStorage`  | `'llm-router/redis'`  |

### Policy Helpers

| Export                          | Description                           |
| ------------------------------- | ------------------------------------- |
| `createTokenLimit(max, window)` | Create a token usage limit            |
| `createRateLimit(max, window)`  | Create a rate limit (requests/window) |
| `createCallLimit(max, window)`  | Create a call count limit             |

All types are exported from `llm-router` and `llm-router/types`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, build commands, and guidelines.

## License

[MIT](LICENSE)
