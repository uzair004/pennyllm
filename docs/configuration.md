# Configuration Reference

LLM Router uses a typed configuration object validated by Zod at startup. Pass it to `createRouter()` directly or load from a JSON/YAML file.

For a minimal quickstart config, see the [README](../README.md).

## Full Config Shape

```typescript
import { defineConfig } from 'llm-router';

export default defineConfig({
  version: '1.0', // Schema version (literal '1.0')
  providers: {
    // REQUIRED - at least one provider
    google: {
      keys: ['key1', 'key2'], // At least one key per provider
      strategy: 'priority', // Per-provider override (optional)
      limits: [], // Per-provider limits (optional)
      enabled: true, // Default: true
      fallback: {
        // Per-provider fallback override (optional)
        behavior: 'auto',
      },
    },
  },
  strategy: 'priority', // Global strategy. Default: 'priority'
  budget: {
    monthlyLimit: 0, // Dollars. 0 = never spend. Default: 0
    alertThresholds: [0.8, 0.95], // Fire budget:alert at these %. Default: [0.8, 0.95]
  },
  fallback: {
    enabled: true, // Default: true
    maxDepth: 3, // Max fallback chain depth. Default: 3
    strictModel: false, // Only fallback to same model. Default: false
    behavior: 'auto', // 'auto' | 'hard-stop'. Default: 'auto'
    modelMappings: {}, // Explicit model-to-model map (optional)
    reasoning: false, // Reasoning-aware fallback. Default: false
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
    keys: [process.env.GOOGLE_KEY_1!, process.env.GOOGLE_KEY_2!],
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
  },
}
```

Per-key limits override provider-level and global defaults. An empty `limits: []` is treated the same as omitting the field.

### Per-provider strategy

Override the global strategy for a specific provider:

```typescript
providers: {
  google: {
    keys: ['key1', 'key2', 'key3'],
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
    limits: [
      { type: 'calls', value: 1000, window: { type: 'daily', durationMs: 86_400_000 } },
    ],
  },
}
```

### Per-provider fallback override

Override the global fallback behavior for a specific provider:

```typescript
providers: {
  google: {
    keys: ['key1'],
    fallback: { behavior: 'hard-stop' }, // Never fall back away from Google
  },
}
```

Valid behaviors: `'auto'`, `'hard-stop'`, `'cheapest-paid'`.

### Disabling a provider

```typescript
providers: {
  google: {
    keys: ['key1'],
    enabled: false, // Excluded from routing, keys preserved
  },
}
```

## strategy

Global key selection strategy. Each provider can override this.

| Strategy        | Description                                                |
| --------------- | ---------------------------------------------------------- |
| `'priority'`    | Use keys in order. First available key wins. **(default)** |
| `'round-robin'` | Rotate evenly across keys.                                 |
| `'least-used'`  | Pick the key with the lowest usage.                        |

```typescript
{
  strategy: 'least-used',
}
```

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

- `monthlyLimit: 0` (default) means "never spend money". All `cheapest-paid` fallback attempts will be blocked.
- `alertThresholds` fire `budget:alert` events when cumulative spending crosses each threshold.

## fallback

Controls behavior when a provider's keys are exhausted.

```typescript
{
  fallback: {
    enabled: true,
    maxDepth: 3,          // Try up to 3 fallback providers
    strictModel: false,   // Allow model substitution
    behavior: 'auto',     // 'auto' picks free providers first, then cheapest-paid
    reasoning: false,     // When true, reasoning models only fall back to reasoning models
    modelMappings: {
      'google/gemini-2.0-flash': 'groq/llama-3.3-70b-versatile',
    },
  },
}
```

| Behavior      | Description                                                                        |
| ------------- | ---------------------------------------------------------------------------------- |
| `'auto'`      | Try other free providers first, then cheapest paid if budget allows. **(default)** |
| `'hard-stop'` | Fail immediately. No fallback.                                                     |

`modelMappings` lets you define explicit model substitutions. When the source model is exhausted, the router will use the mapped model instead of auto-selecting.

## estimation

Pre-request token estimation for quota tracking.

```typescript
{
  estimation: {
    defaultMaxTokens: 2048, // Estimated max output tokens per request
  },
}
```

The router estimates request cost before sending it (prompt + estimated completion tokens). This enables proactive limit checking. A custom estimator can be passed to `createRouter()` options.

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

In dry-run mode, `router.wrapModel()` returns a model that returns empty responses. All events (`key:selected`, `usage:recorded`, etc.) still fire normally.

## debug

Enable structured debug logging to stdout.

Two ways to enable:

```typescript
// 1. Config flag
{
  debug: true;
}

// 2. Environment variable
// DEBUG=llm-router:* node app.js
```

Debug output uses the `debug` package with the `llm-router:*` namespace. Example output:

```
llm-router:router key:selected provider=google keyIndex=0 strategy=priority
llm-router:router fallback:triggered from=google to=groq reason=all_keys_exhausted
llm-router:config Config loaded successfully (keys redacted)
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
import { defineConfig } from 'llm-router';

const config = defineConfig({
  providers: {
    google: { keys: ['...'] }, // Autocompletes: google, groq, openrouter, mistral, etc.
  },
});
```

Known providers: `google`, `groq`, `openrouter`, `mistral`, `huggingface`, `cerebras`, `deepseek`, `qwen`, `cloudflare`, `nvidia`, `cohere`, `github`. Custom provider strings are also accepted.

## Storage Adapters

Storage is a **runtime option**, not a config field. Pass it to `createRouter()`:

```typescript
import { createRouter } from 'llm-router';
import { SqliteStorage } from 'llm-router/sqlite';
import { RedisStorage } from 'llm-router/redis';

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

| Adapter         | Import Path          | Peer Dependency  |
| --------------- | -------------------- | ---------------- |
| `MemoryStorage` | `llm-router/storage` | None             |
| `SqliteStorage` | `llm-router/sqlite`  | `better-sqlite3` |
| `RedisStorage`  | `llm-router/redis`   | `ioredis`        |

## Config File Loading

Load configuration from JSON or YAML files with environment variable interpolation:

```typescript
import { loadConfigFile } from 'llm-router';

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
      "keys": ["${GOOGLE_API_KEY_1}", "${GOOGLE_API_KEY_2}"]
    }
  }
}
```
