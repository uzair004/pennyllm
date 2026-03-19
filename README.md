# pennyllm

**Stop paying for LLM API calls during development.**

[![npm](https://img.shields.io/npm/v/pennyllm)](https://www.npmjs.com/package/pennyllm)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

pennyllm is a TypeScript package that sits between your code and LLM providers. It rotates API keys, tracks free tier usage, and automatically falls back to the next provider when one hits its limit — so you never get an unexpected bill.

```typescript
import { createRouter, defineConfig } from 'pennyllm';
import { generateText } from 'ai';

const router = await createRouter(
  defineConfig({
    providers: {
      cerebras: { keys: [process.env.CEREBRAS_API_KEY!], priority: 1 },
      google: { keys: [process.env.GOOGLE_GENERATIVE_AI_API_KEY!], priority: 2 },
      groq: { keys: [process.env.GROQ_API_KEY!], priority: 3 },
    },
  }),
);

const { text } = await generateText({
  model: router.chat(),
  prompt: 'Explain quantum computing',
});
```

Works with [Vercel AI SDK](https://sdk.vercel.ai/). 5 runtime dependencies — `@ai-sdk/provider`, `debug`, `jiti`, `nanospinner`, `zod`.

---

## Why pennyllm?

Most free LLM tiers give you 30-1000 requests per day. That's plenty for development — until you burn through a single provider in an afternoon. pennyllm spreads your requests across multiple providers automatically:

```
Your code  →  pennyllm  →  Cerebras (fastest, tried first)
                       →  Google (generous limits, fallback)
                       →  Groq (fast inference, fallback)
                       →  SambaNova (DeepSeek models, fallback)
```

When Cerebras hits its rate limit, the next request goes to Google. When Google is exhausted, it tries Groq. All automatic, no code changes needed.

---

## Quick Start

### 1. Install

```bash
npm install pennyllm ai @ai-sdk/google
```

### 2. Get a free API key

[Google AI Studio](https://aistudio.google.com/apikey) — takes 30 seconds, no credit card.

### 3. Create a router

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

const { text } = await generateText({
  model: router.chat(),
  prompt: 'Explain quicksort in 3 sentences.',
});

console.log(text);
await router.close();
```

That's it. The router manages key selection, model chain fallback, and rate limit handling.

---

## How It Works

```
Request  →  router.chat()  →  Chain Executor  →  Provider API
                |                    |
          Model Chain          Key Selection
          (priority order)     (rotation + cooldown)
                |                    |
          429/402 fallback     Health Scoring
          (next in chain)      (circuit breakers)
```

**Model chain** — You define a priority-ordered list of models. The router tries each in order, falling back on errors.

**Key rotation** — Multiple API keys per provider. When one hits its limit, the router tries the next key before moving to the next provider.

**Reactive rate limiting** — No guessing or estimation. Provider 429/402 responses trigger cooldowns and fallback automatically.

**Health scoring** — Circuit breakers track provider reliability. Unhealthy providers are temporarily bypassed, then probed for recovery.

**Budget caps** — Set `monthlyLimit: 0` to never spend money. Free models are always tried first.

---

## Providers

pennyllm supports 6 providers optimized for free-tier usage:

| Provider             | Free Tier                 | Package                     | Env Var                        | Sign Up                                                   |
| -------------------- | ------------------------- | --------------------------- | ------------------------------ | --------------------------------------------------------- |
| **Cerebras**         | 30 RPM, 14.4K RPD, 1M TPD | `@ai-sdk/cerebras`          | `CEREBRAS_API_KEY`             | [cloud.cerebras.ai](https://cloud.cerebras.ai)            |
| **Google AI Studio** | 5-15 RPM, 100-1K RPD      | `@ai-sdk/google`            | `GOOGLE_GENERATIVE_AI_API_KEY` | [aistudio.google.com](https://aistudio.google.com/apikey) |
| **Groq**             | 30-60 RPM, 1K-14.4K RPD   | `@ai-sdk/groq`              | `GROQ_API_KEY`                 | [console.groq.com](https://console.groq.com)              |
| **SambaNova**        | 20 RPM, 200K TPD/model    | `sambanova-ai-provider`     | `SAMBANOVA_API_KEY`            | [cloud.sambanova.ai](https://cloud.sambanova.ai)          |
| **NVIDIA NIM**       | ~40 RPM                   | `@ai-sdk/openai-compatible` | `NVIDIA_API_KEY`               | [build.nvidia.com](https://build.nvidia.com)              |
| **Mistral**          | 1 RPS, 1B tok/month       | `@ai-sdk/mistral`           | `MISTRAL_API_KEY`              | [console.mistral.ai](https://console.mistral.ai)          |

**Start with Cerebras + Google + Groq** — they have the most generous perpetual free tiers and the fastest inference.

Install only the SDKs you need:

```bash
npm install @ai-sdk/cerebras @ai-sdk/google @ai-sdk/groq
```

> **Full provider data:** See [awesome-free-llm-apis](https://github.com/uzair004/awesome-free-llm-apis) for detailed limits, models, rate limit headers, and SDK info.

---

## Configuration

### Multi-provider with explicit model chain

```typescript
const router = await createRouter(
  defineConfig({
    providers: {
      cerebras: { keys: [process.env.CEREBRAS_API_KEY!], priority: 1 },
      google: { keys: [process.env.GOOGLE_GENERATIVE_AI_API_KEY!], priority: 2 },
      groq: { keys: [process.env.GROQ_API_KEY!], priority: 3 },
    },
    models: [
      'cerebras/llama-4-maverick',
      'google/gemini-2.5-flash',
      'groq/meta-llama/llama-4-scout-17b-16e-instruct',
    ],
    budget: { monthlyLimit: 0 }, // Never spend money
    debug: true,
  }),
);
```

If you omit `models`, the router auto-generates a chain from provider priorities and their registered models.

### Multiple keys per provider

```typescript
providers: {
  google: {
    keys: [
      process.env.GOOGLE_KEY_1!,  // Personal account
      process.env.GOOGLE_KEY_2!,  // Team project
    ],
    priority: 1,
  },
}
```

Each key is treated as an independent quota pool. When key #1 hits its limit, key #2 is used before falling back to the next provider.

### Trial providers with credit tracking

```typescript
providers: {
  sambanova: {
    keys: [process.env.SAMBANOVA_API_KEY!],
    priority: 4,
    tier: 'trial',
    credits: {
      balance: 5.00,
      expiresAt: '2026-04-15',
      costRates: { inputPer1MTokens: 0.20, outputPer1MTokens: 0.60 },
    },
  },
}
```

The router tracks credit consumption and stops routing to depleted providers. Use `creditTracker.topUp(provider, amount)` when you add more credits.

### Budget cap

```typescript
budget: {
  monthlyLimit: 5.00,              // $5/month cap
  alertThresholds: [0.8, 0.95],    // Alert at 80% and 95%
}
```

`monthlyLimit: 0` (default) means "never spend money" — all paid model attempts are blocked.

### Config file (JSON/YAML)

```typescript
const router = await createRouter('./pennyllm.config.yaml');
```

### Storage (persistent tracking)

By default, usage data lives in memory. For persistence across restarts:

```typescript
import { SqliteStorage } from 'pennyllm/sqlite';

const router = await createRouter(config, {
  storage: new SqliteStorage({ path: './usage.db' }),
});
```

| Adapter         | Import            | Peer Dependency  |
| --------------- | ----------------- | ---------------- |
| `MemoryStorage` | `pennyllm`        | None             |
| `SqliteStorage` | `pennyllm/sqlite` | `better-sqlite3` |
| `RedisStorage`  | `pennyllm/redis`  | `ioredis`        |

---

## CLI Validator

Validate your config and test provider connectivity before deploying:

```bash
npx pennyllm validate
```

The validator makes real API calls to each configured provider and reports results:

```
Provider         Keys    Model                    Tier   Status   Latency
Cerebras         2/2 ok  llama-4-maverick         free   PASS     142ms
Google AI Studio 1/1 ok  gemini-2.5-flash         free   PASS     387ms
Groq             1/1 ok  llama-4-scout-17b        free   PASS     201ms

3 providers (4 keys), 3 passed, 0 failed
```

### Flags

| Flag                | Description                                                      |
| ------------------- | ---------------------------------------------------------------- |
| `--config <path>`   | Config file path (auto-discovers `pennyllm.config.*` by default) |
| `--provider <name>` | Test specific provider(s) only                                   |
| `--json`            | JSON output for CI pipelines                                     |
| `--verbose`         | Per-key detail, response info, rate limit headers                |
| `--dry-run`         | Validate config without making API calls                         |
| `--timeout <ms>`    | Per-provider timeout (default: 10000)                            |

**Exit codes:** 0 = all pass, 1 = failure, 2 = warnings only (e.g., rate limited but key valid)

---

## Events & Hooks

Subscribe to routing decisions with typed hooks:

```typescript
router.onChainResolved((event) => {
  console.log(`${event.resolvedModel} (position ${event.chainPosition}, ${event.latencyMs}ms)`);
});

router.onProviderDepleted((event) => {
  console.log(`${event.provider} depleted: ${event.reason}`);
});

router.onBudgetAlert((event) => {
  console.log(`Budget: $${event.currentSpend} / $${event.limit} (${event.percentage}%)`);
});

router.onCreditLow((event) => {
  console.log(`${event.provider} credits low: ${event.remaining} remaining`);
});

router.onProviderRecovered((event) => {
  console.log(`${event.provider} recovered (circuit closed)`);
});
```

### All hooks

| Hook                    | Fires when                                     |
| ----------------------- | ---------------------------------------------- |
| `onChainResolved()`     | Model selected for a request                   |
| `onKeySelected()`       | Key selected for a request                     |
| `onUsageRecorded()`     | Token usage recorded                           |
| `onLimitWarning()`      | Usage approaches a threshold                   |
| `onLimitExceeded()`     | Key quota exceeded                             |
| `onFallbackTriggered()` | Request falls back to next provider            |
| `onProviderDepleted()`  | Provider permanently exhausted (402)           |
| `onProviderStale()`     | Provider data not recently verified            |
| `onProviderRecovered()` | Circuit breaker recovered (half-open → closed) |
| `onBudgetAlert()`       | Spending approaches monthly limit              |
| `onBudgetExceeded()`    | Monthly budget reached                         |
| `onCreditLow()`         | Trial provider credits running low             |
| `onCreditExhausted()`   | Trial provider credits depleted                |
| `onCreditExpiring()`    | Trial credits approaching expiry date          |
| `onError()`             | Provider returns an error                      |

---

## Debug Mode

See every routing decision:

```bash
DEBUG=pennyllm:* node app.js
```

Or in config:

```typescript
defineConfig({ debug: true, ... })
```

```
[pennyllm:key-selected]     cerebras/llama-4-maverick -> key#0 (priority)
[pennyllm:usage-recorded]   cerebras key#0: +1247 tokens
[pennyllm:chain-resolved]   cerebras/llama-4-maverick (position 0, no fallback, 312ms)
[pennyllm:health]           cerebras: score 0.95, circuit closed
```

---

## API Reference

### Core exports

| Export                           | Description                                     |
| -------------------------------- | ----------------------------------------------- |
| `createRouter(config, options?)` | Create a router from config object or file path |
| `defineConfig(config)`           | Type-safe config helper with IDE autocomplete   |
| `configSchema`                   | Zod schema for config validation                |
| `loadConfigFile(path)`           | Load config from YAML or JSON file              |

### Router methods

| Method                                    | Description                                                     |
| ----------------------------------------- | --------------------------------------------------------------- |
| `router.chat(filter?)`                    | Get a model that routes through the chain                       |
| `router.wrapModel(modelId)`               | Wrap a specific model with routing and retry                    |
| `router.model(modelId)`                   | Select a key without wrapping                                   |
| `router.getStatus()`                      | Chain status (available/cooling/depleted models, health scores) |
| `router.getUsage(provider?)`              | Usage snapshot across all or specific provider                  |
| `router.resetUsage(provider?, keyIndex?)` | Reset usage counters                                            |
| `router.close()`                          | Clean up resources                                              |

### Chain filter options

| Field          | Type       | Description                                                                 |
| -------------- | ---------- | --------------------------------------------------------------------------- |
| `capabilities` | `string[]` | Filter to models with `reasoning`, `toolCall`, `vision`, `structuredOutput` |
| `provider`     | `string`   | Filter to a specific provider                                               |
| `tier`         | `string`   | Filter by quality tier: `frontier`, `high`, `mid`                           |

### Policy helpers

| Export                          | Description                            |
| ------------------------------- | -------------------------------------- |
| `createTokenLimit(max, window)` | Token usage limit                      |
| `createRateLimit(max, window)`  | Request rate limit                     |
| `createCallLimit(max, window)`  | Call count limit                       |
| `createCreditLimit(config)`     | Credit-based limit for trial providers |

All types exported from `pennyllm` and `pennyllm/types`.

---

## Comparison

| Feature            | pennyllm                                            | Manual Key Management | LiteLLM           |
| ------------------ | --------------------------------------------------- | --------------------- | ----------------- |
| Language           | TypeScript                                          | Any                   | Python            |
| Setup              | `npm install`                                       | DIY                   | Docker + Postgres |
| Free tier tracking | Built-in                                            | Manual                | No                |
| Key rotation       | Automatic                                           | Manual                | Manual            |
| Budget caps        | Yes                                                 | No                    | Yes               |
| Health scoring     | Circuit breakers                                    | No                    | Basic             |
| Credit tracking    | Trial providers                                     | No                    | No                |
| CLI validator      | `npx pennyllm validate`                             | No                    | No                |
| AI SDK integration | Native middleware                                   | None                  | Proxy             |
| Runtime deps       | 5 (zod, debug, jiti, nanospinner, @ai-sdk/provider) | 0                     | 100+              |

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, build commands, and guidelines.

## License

[MIT](LICENSE)
