# Troubleshooting

Common issues, error messages, and how to fix them.

## Config Errors

These errors occur at `createRouter()` time when the configuration is invalid.

### "At least one provider is required"

Empty `providers` object.

```typescript
// Bad
{
  providers: {
  }
}

// Fix: add at least one provider
{
  providers: {
    google: {
      keys: ['...'];
    }
  }
}
```

### "At least one key is required"

Provider with no keys or empty keys array.

```typescript
// Bad
{
  providers: {
    google: {
      keys: [];
    }
  }
}

// Fix: add at least one key
{
  providers: {
    google: {
      keys: [process.env.GOOGLE_KEY!];
    }
  }
}
```

### "Cannot use 'cheapest-paid' fallback behavior with $0 budget"

A provider has `fallback: { behavior: 'cheapest-paid' }` but `budget.monthlyLimit` is 0.

```typescript
// Fix option 1: increase budget
{ budget: { monthlyLimit: 5.00 } }

// Fix option 2: change fallback behavior
{ providers: { google: { keys: ['...'], fallback: { behavior: 'auto' } } } }
```

### "Unknown provider 'X'. Did you mean 'Y'?"

Typo in provider name. The router uses Levenshtein distance to suggest the closest known provider.

```typescript
// Bad
{
  providers: {
    googel: {
      keys: ['...'];
    }
  }
}
//              ^^^^^^ Did you mean 'google'?

// Fix: correct the provider name
{
  providers: {
    google: {
      keys: ['...'];
    }
  }
}
```

### Unrecognized keys in config

The config schema uses `.strict()` mode. Extra fields are rejected.

```typescript
// Bad
{ providers: { google: { keys: ['...'] } }, timeout: 5000 }
//                                           ^^^^^^^ not a config field

// Fix: remove the unknown field. See docs/configuration.md for valid fields.
```

### "Model ID must be in provider/model format"

Missing slash in model ID when calling `router.wrapModel()`.

```typescript
// Bad
router.wrapModel('gemini-2.0-flash');

// Fix: use provider/model format
router.wrapModel('google/gemini-2.0-flash');
```

## Runtime Errors

These errors occur during request routing.

### `AllProvidersExhaustedError`

All keys across all providers are exhausted. No fallback available.

**Causes:**

- All keys hit rate limits simultaneously
- All keys exceeded quota limits
- All keys disabled (auth failures)
- Fallback disabled or max depth reached

**Solutions:**

1. Add more API keys to existing providers
2. Add additional providers for fallback
3. Enable fallback if disabled: `fallback: { enabled: true }`
4. Increase fallback depth: `fallback: { maxDepth: 5 }`
5. Check current usage: `await router.getUsage()`
6. Wait for quota reset or cooldown expiry

### `AuthError` (401/403)

API key is invalid, expired, or lacks permissions.

**Solutions:**

1. Verify the key is valid on the provider's dashboard
2. Check the environment variable is set: `echo $GOOGLE_API_KEY`
3. Ensure the key has the required API permissions enabled
4. Check the provider hasn't revoked the key

### `RateLimitError` (429)

A key hit the provider's rate limit. The router automatically retries with key rotation -- if this error surfaces, all available keys hit limits simultaneously.

**Solutions:**

1. Add more keys to spread load
2. Reduce request rate
3. Increase cooldown duration: `cooldown: { defaultDurationMs: 120000 }`
4. The router will automatically recover after cooldown expires

### `QuotaExhaustedError`

Monthly or daily quota used up for a key.

**Solutions:**

1. Wait for the quota reset period
2. Add more keys from different accounts
3. Enable paid fallback: `fallback: { behavior: 'auto' }` with `budget: { monthlyLimit: 5.00 }`

### `ProviderError` (500+)

Provider returned a server error. Usually transient.

**Solutions:**

1. The router retries automatically with key rotation
2. Check the provider's status page
3. If persistent, the provider may be experiencing an outage

### `NetworkError`

Connection failure -- DNS resolution, timeout, or connection refused.

**Solutions:**

1. Check network connectivity
2. Verify the provider's API endpoint is reachable
3. Check for firewall or proxy issues
4. Check the provider's status page

## Storage Adapter Issues

### "Cannot find module 'better-sqlite3'"

SQLite storage requires the `better-sqlite3` peer dependency.

```bash
npm install better-sqlite3
```

### "Cannot find module 'ioredis'"

Redis storage requires the `ioredis` peer dependency.

```bash
npm install ioredis
```

### Redis connection refused

Redis is not running or the connection config is wrong.

```typescript
import { RedisStorage } from 'pennyllm/redis';

// Check host and port match your Redis instance
const storage = new RedisStorage({
  host: '127.0.0.1', // default: localhost
  port: 6379, // default: 6379
});
```

Verify Redis is running: `redis-cli ping` should return `PONG`.

### SQLite permission error

The directory for the database file must exist and be writable.

```typescript
import { SqliteStorage } from 'pennyllm/sqlite';

// Ensure the directory exists
const storage = new SqliteStorage('./data/usage.db');
```

```bash
mkdir -p ./data
```

## Debug Tips

### Enable debug mode

Two ways:

```typescript
// Config flag
const router = await createRouter({ ...config, debug: true });

// Environment variable
// DEBUG=pennyllm:* node app.js
```

Debug mode subscribes to all 8 typed hooks and logs structured output to stdout.

### Check resolved config

```typescript
const resolved = router.getConfig();
console.log(resolved);
// Includes resolvedPolicies showing the merged limit configuration per key
```

### Check current usage

```typescript
// All providers
const usage = await router.getUsage();
console.log(usage);

// Single provider
const googleUsage = await router.getUsage('google');
console.log(googleUsage);
```

### Reset usage counters

```typescript
// Reset everything
await router.resetUsage();

// Reset a specific provider
await router.resetUsage('google');

// Reset a specific key
await router.resetUsage('google', 0);
```

### Listen for specific events

```typescript
router.onError((e) => {
  console.error('Router error:', e.error.message, e.error.code);
});

router.on('error:rate_limit', (e) => {
  console.warn(`Rate limited: ${e.provider} key #${e.keyIndex} (${e.statusCode})`);
});
```
