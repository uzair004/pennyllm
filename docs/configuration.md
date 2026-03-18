# Configuration Reference

PennyLLM uses a typed configuration object validated by Zod at startup. Pass it to `createRouter()` directly or load from a JSON/YAML file.

For a minimal quickstart config, see the [README](../README.md).

> For detailed provider data (free tier limits, available models, rate limit headers), see the [awesome-free-llm-apis registry](https://github.com/YOUR_USERNAME/awesome-free-llm-apis).

## Full Config Shape

```typescript
import { defineConfig } from 'pennyllm';

export default defineConfig({
  version: '1.0', // Schema version (literal '1.0')
  providers: {
    // REQUIRED - at least one provider
    cerebras: {
      keys: ['key1', 'key2'], // At least one key per provider
      strategy: 'priority', // Per-provider override (optional)
      limits: [], // Per-provider limits (optional)
      enabled: true, // Default: true
      priority: 1, // Provider priority for chain ordering
      tier: 'free', // 'free' | 'trial' | 'paid'
      credits: undefined, // One-time credit amount (for trial providers)
      models: ['cerebras/gpt-oss-120b'], // Allowlisted models (optional)
    },
  },
  // Explicit model chain (optional -- auto-generated from provider priorities if omitted)
  models: ['cerebras/gpt-oss-120b', 'google/gemini-2.5-flash'],
  strategy: 'priority', // Global strategy. Default: 'priority'
  budget: {
    monthlyLimit: 0, // Dollars. 0 = never spend. Default: 0
    alertThresholds: [0.8, 0.95], // Fire budget:alert at these %. Default: [0.8, 0.95]
  },
  estimation: {
    defaultMaxTokens: 1024, // Pre-request token estimate. Default: 1024
  },
  cooldown: {
    defaultDurationMs: 60000, // Cooldown after 429s (ms). Default: 60000
  },
  warningThreshold: 0.8, // 0-1 limit proximity warnings (optional)
  applyRegistryDefaults: false, // Future registry integration. Default: false
  dryRun: false, // Dry-run mode. Default: false
  debug: false, // Debug logging. Default: false
});
```

## providers (required)

A `Record<string, ProviderConfig>` mapping provider names to their configuration. At least one provider is required.

### Keys

Keys can be plain strings or objects with metadata:

```typescript
providers: {
  google: {
    // Simple string keys
    keys: [process.env.GOOGLE_GENERATIVE_AI_API_KEY!],
    priority: 1,
  },
  groq: {
    // Object keys with labels and per-key limits
    keys: [
      {
        key: process.env.GROQ_KEY_1!,
        label: 'personal-account',
        limits: [
          { type: 'calls', value: 30, window: { type: 'per-minute', durationMs: 60_000 } },
          { type: 'daily', value: 14400, window: { type: 'daily', durationMs: 86_400_000 } },
        ],
      },
      {
        key: process.env.GROQ_KEY_2!,
        label: 'team-account',
      },
    ],
    priority: 2,
  },
}
```

Per-key limits override provider-level and global defaults. An empty `limits: []` is treated the same as omitting the field.

### priority

Determines the order in which providers are considered in the model chain. Lower numbers are tried first.

```typescript
providers: {
  cerebras: { keys: ['key1'], priority: 1 },  // Tried first
  google: { keys: ['key1'], priority: 2 },     // Tried second
  groq: { keys: ['key1'], priority: 3 },       // Tried third
}
```

### tier

Classifies the provider's pricing model:

| Tier      | Description                             |
| --------- | --------------------------------------- |
| `'free'`  | Perpetual free tier (default)           |
| `'trial'` | One-time credits that deplete over time |
| `'paid'`  | Pay-per-use (requires budget > 0)       |

### credits

For `trial` tier providers (e.g., NVIDIA NIM), specify the one-time credit amount:

```typescript
providers: {
  nvidia: {
    keys: [process.env.NVIDIA_API_KEY!],
    priority: 5,
    tier: 'trial',
    credits: 1000, // 1000 one-time credits
  },
}
```

### models (per-provider allowlist)

Restrict which models from a provider are included in the chain:

```typescript
providers: {
  google: {
    keys: [process.env.GOOGLE_GENERATIVE_AI_API_KEY!],
    priority: 1,
    models: ['google/gemini-2.5-flash', 'google/gemini-2.5-pro'],
  },
}
```

If omitted, all models from the provider's module are included.

### Per-provider strategy

Override the global strategy for a specific provider:

```typescript
providers: {
  google: {
    keys: ['key1', 'key2', 'key3'],
    priority: 1,
    strategy: 'round-robin', // Rotates keys evenly for this provider only
  },
}
```

### Per-provider limits

Set limits at the provider level (applies to all keys that don't override):

```typescript
providers: {
  mistral: {
    keys: ['key1'],
    priority: 4,
    limits: [
      { type: 'calls', value: 1000, window: { type: 'daily', durationMs: 86_400_000 } },
    ],
  },
}
```

### Disabling a provider

```typescript
providers: {
  google: {
    keys: ['key1'],
    priority: 1,
    enabled: false, // Excluded from routing, keys preserved
  },
}
```

## models (top-level)

Explicit model priority chain. If provided, models are tried in this exact order. If omitted, the chain is auto-generated from provider priorities and their registered models.

```typescript
{
  models: [
    'cerebras/llama-4-maverick',    // Position 0 -- tried first
    'google/gemini-2.5-flash',       // Position 1 -- fallback
    'groq/meta-llama/llama-4-scout-17b-16e-instruct', // Position 2
  ],
}
```

**Auto-generated chain:** When `models` is omitted, the router builds a chain by sorting providers by `priority`, then including all models from each provider in their defined order.

## router.chat()

The primary API for making LLM calls through the model chain.

```typescript
// Basic -- routes through entire chain
const model = router.chat();

// Filter by capability
const model = router.chat({ capabilities: ['reasoning'] });

// Filter by provider
const model = router.chat({ provider: 'google' });

// Filter by quality tier
const model = router.chat({ tier: 'frontier' });
```

Returns a Vercel AI SDK `LanguageModelV3` that can be passed to `generateText()`, `streamText()`, etc.

**Behavior:** On each call, the chain executor walks the filtered chain from position 0. If a provider returns 429 or 402, the executor cooldowns that model and tries the next one. The `chain:resolved` event fires with details about which model was ultimately used.

## router.getStatus()

Returns the current state of the model chain:

```typescript
const status = router.getStatus();
// {
//   entries: [
//     { provider: 'cerebras', modelId: 'cerebras/llama-4-maverick', status: 'available', ... },
//     { provider: 'google', modelId: 'google/gemini-2.5-flash', status: 'cooling', cooldownUntil: '...', ... },
//   ],
//   totalModels: 6,
//   availableModels: 4,
//   depletedProviders: [],
// }
```

Entry statuses:

| Status      | Meaning                                      |
| ----------- | -------------------------------------------- |
| `available` | Ready to accept requests                     |
| `cooling`   | In cooldown after 429, will recover          |
| `depleted`  | Permanently exhausted (402) for this session |
| `stale`     | Model returned 404, possibly removed         |

## strategy

Global key selection strategy. Each provider can override this.

| Strategy        | Description                                                |
| --------------- | ---------------------------------------------------------- |
| `'priority'`    | Use keys in order. First available key wins. **(default)** |
| `'round-robin'` | Rotate evenly across keys.                                 |
| `'least-used'`  | Pick the key with the lowest usage.                        |

## budget

Monthly spending budget for paid fallback.

```typescript
{
  budget: {
    monthlyLimit: 5.00,           // $5/month cap
    alertThresholds: [0.5, 0.8, 0.95], // Alert at 50%, 80%, 95%
  },
}
```

- `monthlyLimit: 0` (default) means "never spend money". All paid model attempts will be blocked.
- `alertThresholds` fire `budget:alert` events when cumulative spending crosses each threshold.

## estimation

Pre-request token estimation for quota tracking.

```typescript
{
  estimation: {
    defaultMaxTokens: 2048, // Estimated max output tokens per request
  },
}
```

## cooldown

Duration to cool down a key after hitting a 429 rate limit.

```typescript
{
  cooldown: {
    defaultDurationMs: 120_000, // 2 minutes
  },
}
```

During cooldown, the key is skipped by the selection strategy. After the duration, the key becomes available again.

## warningThreshold

Optional 0-1 number. When a key's usage reaches this fraction of any limit, a `limit:warning` event fires.

```typescript
{
  warningThreshold: 0.8, // Warn at 80% of any limit
}
```

## dryRun

When `true`, the router performs key selection and fires all events but does **not** make actual API calls. Useful for testing configuration and event wiring.

```typescript
{
  dryRun: true,
}
```

In dry-run mode, `router.chat()` and `router.wrapModel()` return models that return empty responses. All events still fire normally.

## debug

Enable structured debug logging to stdout.

Two ways to enable:

```typescript
// 1. Config flag
{
  debug: true;
}

// 2. Environment variable
// DEBUG=pennyllm:* node app.js
```

## applyRegistryDefaults

Reserved for future registry integration. When `true`, provider defaults from an external registry will be applied at startup.

```typescript
{
  applyRegistryDefaults: false, // Default: false
}
```

## defineConfig() Helper

Zero-cost identity function that provides IDE autocomplete for provider names:

```typescript
import { defineConfig } from 'pennyllm';

const config = defineConfig({
  providers: {
    cerebras: { keys: ['...'], priority: 1 }, // Autocompletes: cerebras, google, groq, github, etc.
  },
});
```

Known providers: `cerebras`, `google`, `groq`, `github`, `sambanova`, `nvidia`, `mistral`. Custom provider strings are also accepted.

## Storage Adapters

Storage is a **runtime option**, not a config field. Pass it to `createRouter()`:

```typescript
import { createRouter, defineConfig } from 'pennyllm';
import { SqliteStorage } from 'pennyllm/sqlite';
import { RedisStorage } from 'pennyllm/redis';

const config = defineConfig({
  providers: { google: { keys: ['...'], priority: 1 } },
});

// Default: in-memory (zero dependencies)
const router = await createRouter(config);

// SQLite (requires: npm install better-sqlite3)
const router = await createRouter(config, {
  storage: new SqliteStorage('./usage.db'),
});

// Redis (requires: npm install ioredis)
const router = await createRouter(config, {
  storage: new RedisStorage({ host: 'localhost', port: 6379 }),
});
```

| Adapter         | Import Path        | Peer Dependency  |
| --------------- | ------------------ | ---------------- |
| `MemoryStorage` | `pennyllm/storage` | None             |
| `SqliteStorage` | `pennyllm/sqlite`  | `better-sqlite3` |
| `RedisStorage`  | `pennyllm/redis`   | `ioredis`        |

## Config File Loading

Load configuration from JSON or YAML files with environment variable interpolation:

```typescript
import { loadConfigFile } from 'pennyllm';

// JSON
const config = await loadConfigFile('./router-config.json');

// YAML (requires: npm install js-yaml)
const config = await loadConfigFile('./router-config.yaml');
```

Environment variables are interpolated using `${VAR}` syntax:

```json
{
  "providers": {
    "google": {
      "keys": ["${GOOGLE_GENERATIVE_AI_API_KEY}"],
      "priority": 1
    }
  }
}
```
