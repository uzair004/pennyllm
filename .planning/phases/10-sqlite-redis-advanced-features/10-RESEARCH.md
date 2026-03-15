# Phase 10: SQLite, Redis & Advanced Features - Research

**Researched:** 2026-03-14
**Domain:** Persistent storage adapters (Redis, SQLite), observability hooks, dry-run mode
**Confidence:** HIGH

## Summary

Phase 10 delivers three distinct capabilities: Redis and SQLite storage adapters implementing the existing `StorageBackend` interface, typed observability hooks over the existing EventEmitter, and a dry-run mode config flag. The foundation is solid -- the `StorageBackend` interface, contract tests, composite key pattern, and event system are all established from Phase 2 and Phase 9.

Redis (via `ioredis` v5.x) is the primary focus. It provides atomic counter operations natively (`INCRBY`), TTL-based key expiration matching time windows, and multi-process safety by design. SQLite (via `better-sqlite3` v12.x) is secondary, providing local persistence for single-process use cases. Both are optional peer dependencies following the existing `@ai-sdk/google` pattern of dynamic import with clear error on missing driver.

**Primary recommendation:** Implement Redis first using Redis hash keys with `HINCRBY` for atomic counter increments and `EXPIRE` for TTL-based cleanup. SQLite second using a single counter table with composite primary key and WAL mode. Observability hooks are thin typed wrappers over EventEmitter. Dry-run mode is a middleware intercept that returns a mock response before the API call.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Redis driver:** `ioredis` as optional peer dependency
- **Redis connection config:** Accept either a connection URL string (`redis://...`) or an ioredis options object
- **Redis key prefix:** All keys prefixed with `pennyllm:` (configurable for multi-tenant)
- **Redis atomicity:** Use Redis INCRBY/HINCRBY for atomic counter increments. No Lua scripts needed
- **Redis expiration:** Use Redis TTL on keys matching time window durations
- **Redis connection failures:** Fail loudly with clear error. Never silently fall back to memory storage
- **Redis reconnection:** Rely on ioredis built-in reconnection strategy (exponential backoff)
- **Redis close:** Disconnect the ioredis client on `close()`
- **Redis export path:** `RedisStorage` from `pennyllm/redis`
- **SQLite driver:** `better-sqlite3` as optional peer dependency. No sql.js fallback
- **SQLite DB location:** XDG data directory by default. User can override with explicit path
- **SQLite data sharing:** Single shared DB across all projects by default
- **SQLite schema:** Single key-value counter table with composite key (provider, keyIndex, windowType, periodKey). Columns: prompt_tokens, completion_tokens, call_count
- **SQLite WAL mode:** Enabled for concurrent read performance
- **SQLite migrations:** Forward-only with schema_info table tracking version. Auto-migrate on open
- **SQLite auto-cleanup:** Delete expired rows on write operations (lazy cleanup)
- **SQLite driver detection:** Silent. Log at debug level
- **SQLite export path:** `SqliteStorage` from `pennyllm/sqlite`
- **Observability hooks:** Existing EventEmitter already covers all scenarios. Phase 10 adds typed hook registration with typed callbacks as convenience layer, not replacement
- **Hook API:** `router.onKeySelected(cb)`, `router.onUsageRecorded(cb)`, etc. -- typed wrappers that return unsubscribe functions
- **No separate hook system.** EventEmitter remains the backbone
- **No breaking changes** to existing `router.on('event', cb)` pattern
- **Dry-run invocation:** `createRouter({ ..., dryRun: true })` config option
- **Dry-run behavior:** Validates config, resolves policies, selects keys, logs routing decisions, but intercepts before actual API call and returns a mock response
- **Dry-run events still fire** so users can test their event handlers

### Claude's Discretion

- Redis key schema design (hash vs string keys, field naming)
- SQLite table DDL and migration SQL
- Exact mock response shape for dry-run mode
- Typed hook helper implementation details
- Contract test adaptations for async Redis operations
- Error message wording for missing peer dependencies

### Deferred Ideas (OUT OF SCOPE)

- Hybrid pattern (memory cache + external store sync)
- sql.js fallback for environments without native compilation
- Platform-aware DB path with env var override chain (LLM_ROUTER_DB_PATH)
- Per-project namespace isolation for SQLite
- Redis Cluster support
- Dry-run fallback preview (`router.previewFallback()`)
  </user_constraints>

<phase_requirements>

## Phase Requirements

| ID       | Description                                                                                           | Research Support                                                                                                                                                |
| -------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| USAGE-02 | SQLite + Redis persistence adapters for StorageBackend                                                | Redis via ioredis HINCRBY + TTL; SQLite via better-sqlite3 with WAL mode and single counter table. Both implement StorageBackend interface, pass contract tests |
| DX-03    | Observability hooks fire events for key selection, usage recording, limit warnings, fallback triggers | EventEmitter already emits all events. Phase 10 adds typed helper methods (`onKeySelected`, `onUsageRecorded`, etc.) returning unsubscribe functions            |
| DX-04    | Dry-run mode validates config and simulates routing without making API calls                          | New `dryRun: boolean` config option. Middleware intercept returns mock response. Events still fire normally                                                     |

</phase_requirements>

## Standard Stack

### Core

| Library               | Version | Purpose                             | Why Standard                                                                                                |
| --------------------- | ------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| ioredis               | ^5.10.0 | Redis client for RedisStorage       | 100% TypeScript, built-in types, 14M+ weekly downloads, built-in reconnection, MULTI/EXEC, pipeline support |
| better-sqlite3        | ^12.7.0 | SQLite driver for SqliteStorage     | Synchronous API (simpler transactions), fastest SQLite library for Node.js, WAL mode support                |
| @types/better-sqlite3 | ^7.6.0  | TypeScript types for better-sqlite3 | better-sqlite3 does NOT ship built-in types (unlike ioredis)                                                |

### Supporting

| Library | Version | Purpose            | When to Use                                                               |
| ------- | ------- | ------------------ | ------------------------------------------------------------------------- |
| debug   | ^4.3.0  | Namespaced logging | Already in project. Use `pennyllm:redis` and `pennyllm:sqlite` namespaces |

### Alternatives Considered

| Instead of     | Could Use                 | Tradeoff                                                                                                           |
| -------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| ioredis        | redis (node-redis)        | ioredis has better TypeScript support, more mature reconnection. CONTEXT.md locks ioredis                          |
| better-sqlite3 | sql.js (WASM)             | sql.js works everywhere but slower. CONTEXT.md explicitly rejects sql.js fallback                                  |
| env-paths      | Manual platform detection | env-paths v4 is ESM-only, incompatible with CJS build output. Manual path logic is ~15 lines and avoids dependency |

**Installation (users install these as peer deps):**

```bash
# For Redis support
npm install ioredis

# For SQLite support
npm install better-sqlite3
npm install -D @types/better-sqlite3
```

**Dev dependencies (for building/testing):**

```bash
npm install -D ioredis @types/better-sqlite3 better-sqlite3
```

## Architecture Patterns

### Recommended Project Structure

```
src/
  storage/
    MemoryStorage.ts          # Existing
    MemoryStorage.test.ts     # Existing
    index.ts                  # Existing (re-exports MemoryStorage)
  redis/
    RedisStorage.ts           # NEW: implements StorageBackend
    index.ts                  # NEW: exports RedisStorage
  sqlite/
    SqliteStorage.ts          # NEW: implements StorageBackend
    migrations.ts             # NEW: schema DDL and migration logic
    paths.ts                  # NEW: XDG data directory resolution
    index.ts                  # NEW: exports SqliteStorage
```

### Pattern 1: Redis Key Schema (Hash-Based)

**What:** Use Redis hash keys to group all counters for a provider+key+window under one hash, with fields for each metric.

**When to use:** Always for RedisStorage -- hashes group related counters and allow atomic field increments.

**Design:**

```
Key:    pennyllm:{provider}:{keyIndex}:{windowType}:{periodKey}
Fields: prompt_tokens, completion_tokens, call_count
```

**Example:**

```typescript
// Key: "pennyllm:google:0:per-minute:28761234"
// Fields: { prompt_tokens: "1500", completion_tokens: "750", call_count: "5" }

// Atomic increment of multiple fields:
const pipeline = redis.pipeline();
pipeline.hincrby(key, 'prompt_tokens', tokens.prompt);
pipeline.hincrby(key, 'completion_tokens', tokens.completion);
pipeline.hincrby(key, 'call_count', callCount);
pipeline.expire(key, ttlSeconds); // Set/refresh TTL
const results = await pipeline.exec();
```

**Why hash over string:** A single hash key stores all three counters (prompt, completion, calls). String keys would need 3 separate keys per window. Hash `HINCRBY` is atomic per field. `EXPIRE` on the hash key automatically cleans up all fields when the window expires.

**TTL Mapping:**

```
per-minute  -> 120 seconds (2x window for safety margin)
hourly      -> 7200 seconds (2 hours)
daily       -> 172800 seconds (2 days)
monthly     -> 5184000 seconds (60 days)
rolling-30d -> 172800 seconds (2 days, per daily bucket)
```

The 2x margin ensures keys survive slightly past their window boundary, preventing premature expiration during reads. Redis handles cleanup automatically via TTL -- no manual garbage collection needed.

### Pattern 2: SQLite Schema Design

**What:** Single counter table with composite primary key matching the MemoryStorage composite key pattern.

**Schema:**

```sql
CREATE TABLE IF NOT EXISTS usage_counters (
  provider TEXT NOT NULL,
  key_index INTEGER NOT NULL,
  window_type TEXT NOT NULL,
  period_key TEXT NOT NULL,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  call_count INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (provider, key_index, window_type, period_key)
);

CREATE TABLE IF NOT EXISTS schema_info (
  version INTEGER NOT NULL,
  migrated_at INTEGER NOT NULL
);
```

**Increment pattern (UPSERT):**

```sql
INSERT INTO usage_counters (provider, key_index, window_type, period_key, prompt_tokens, completion_tokens, call_count, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT (provider, key_index, window_type, period_key)
DO UPDATE SET
  prompt_tokens = prompt_tokens + excluded.prompt_tokens,
  completion_tokens = completion_tokens + excluded.completion_tokens,
  call_count = call_count + excluded.call_count,
  updated_at = excluded.updated_at;
```

**Why UPSERT:** SQLite's `INSERT ... ON CONFLICT ... DO UPDATE` is atomic within a single statement. No need for explicit transactions for counter increments. This mirrors Redis `HINCRBY` behavior.

### Pattern 3: Optional Peer Dependency Loading

**What:** Dynamic `import()` in a try/catch, following the existing `@ai-sdk/google` pattern from `ProviderRegistry.createDefault()`.

**Example (Redis):**

```typescript
// src/redis/RedisStorage.ts
import type { StorageBackend, StructuredUsage } from '../types/interfaces.js';
import type { TimeWindow, UsageRecord } from '../types/domain.js';
import { PennyLLMError } from '../errors/base.js';
import { getPeriodKey } from '../usage/periods.js';
import debugFactory from 'debug';

const debug = debugFactory('pennyllm:redis');

// ioredis is loaded at class construction, not at module level
// This allows the module to be imported even if ioredis is not installed
// (TypeScript type-only imports are erased at compile time)
import type Redis from 'ioredis';

export interface RedisStorageOptions {
  /** Redis connection URL (redis://...) or ioredis options object */
  connection: string | Record<string, unknown>;
  /** Key prefix for all Redis keys (default: 'pennyllm:') */
  prefix?: string;
}

export class RedisStorage implements StorageBackend {
  private client: Redis;
  private prefix: string;
  private closed: boolean = false;

  private constructor(client: Redis, prefix: string) {
    this.client = client;
    this.prefix = prefix;
  }

  static async create(options: RedisStorageOptions): Promise<RedisStorage> {
    let IoRedis: typeof import('ioredis').default;
    try {
      const mod = await import('ioredis');
      IoRedis = mod.default;
    } catch {
      throw new PennyLLMError(
        'ioredis is required for RedisStorage. Install it: npm install ioredis',
        { code: 'MISSING_PEER_DEPENDENCY' },
      );
    }

    const prefix = options.prefix ?? 'pennyllm:';
    const client =
      typeof options.connection === 'string'
        ? new IoRedis(options.connection)
        : new IoRedis(options.connection as ConstructorParameters<typeof IoRedis>[0]);

    debug('RedisStorage created with prefix: %s', prefix);
    return new RedisStorage(client, prefix);
  }

  // ... implement StorageBackend methods
}
```

**Key insight:** The `import type` at module level gives TypeScript types without runtime dependency. The actual `import('ioredis')` happens in the static `create()` factory, so the module can be loaded even without ioredis installed (useful for tree-shaking).

### Pattern 4: XDG Data Directory Without External Dependencies

**What:** Manual platform-aware path resolution instead of `env-paths` (which is ESM-only and incompatible with CJS build output).

**Example:**

```typescript
import { join } from 'node:path';
import { homedir } from 'node:os';

export function getDefaultDbPath(): string {
  const appName = 'pennyllm';

  switch (process.platform) {
    case 'darwin':
      return join(homedir(), 'Library', 'Application Support', appName, 'usage.db');
    case 'win32': {
      const appData = process.env['APPDATA'] ?? join(homedir(), 'AppData', 'Roaming');
      return join(appData, appName, 'usage.db');
    }
    default: {
      // Linux and other Unix-like systems: XDG_DATA_HOME or ~/.local/share
      const xdgData = process.env['XDG_DATA_HOME'] ?? join(homedir(), '.local', 'share');
      return join(xdgData, appName, 'usage.db');
    }
  }
}
```

**Why not env-paths:** `env-paths` v3+ is pure ESM. This project builds both CJS (`.cjs`) and ESM (`.mjs`) via tsup. Since tsup externalizes dependencies (doesn't bundle them), a CJS consumer would fail to `require('env-paths')`. The 15 lines of manual platform detection are simpler and dependency-free.

### Pattern 5: Dry-Run Middleware Intercept

**What:** A middleware layer that intercepts before the actual API call and returns a structured mock response.

**Implementation approach:** Add a `dryRun` field to the config schema. In `createRouterMiddleware`, check the flag. If true, return a mock result from `wrapGenerate` without calling `doGenerate()`, and return a mock stream from `wrapStream` without calling `doStream()`.

```typescript
// In middleware wrapGenerate:
if (dryRun) {
  const mockResult: LanguageModelV3GenerateResult = {
    text: '[DRY RUN] Would have called provider with selected key',
    finishReason: 'stop',
    usage: { inputTokens: { total: 0 }, outputTokens: { total: 0 } },
    // ... providerMetadata with dry-run info
  };
  return mockResult;
}
// Normal path: const result = await doGenerate();
```

### Pattern 6: Typed Observability Hook Helpers

**What:** Convenience methods on the Router that wrap `emitter.on()` with typed callbacks and return unsubscribe functions.

```typescript
// On the Router interface:
onKeySelected(cb: (event: KeySelectedEvent) => void): () => void;
onUsageRecorded(cb: (event: UsageRecordedEvent) => void): () => void;
onLimitWarning(cb: (event: LimitWarningEvent) => void): () => void;
onLimitExceeded(cb: (event: LimitExceededEvent) => void): () => void;
onFallbackTriggered(cb: (event: FallbackTriggeredEvent) => void): () => void;
onBudgetAlert(cb: (event: BudgetAlertEvent) => void): () => void;

// Implementation:
onKeySelected: (cb) => {
  const handler = (...args: unknown[]) => cb(args[0] as KeySelectedEvent);
  emitter.on('key:selected', handler);
  return () => emitter.off('key:selected', handler);
}
```

### Anti-Patterns to Avoid

- **Silently falling back to MemoryStorage on Redis failure:** Users must explicitly choose their storage. Silent fallback gives false confidence about persistence. Throw on connection failure.
- **Bundling ioredis/better-sqlite3 as regular dependencies:** These are large native modules. They MUST be optional peer dependencies. Users who don't need Redis shouldn't be forced to install ioredis.
- **Using `SET` instead of `HINCRBY` for Redis counters:** `SET` overwrites the key, clearing any TTL. `HINCRBY` is atomic and TTL-safe.
- **Building a custom reconnection strategy for Redis:** ioredis has battle-tested exponential backoff reconnection built in. Don't reinvent it.
- **Using `env-paths` package:** ESM-only, breaks CJS build. Use manual platform detection (~15 lines).
- **Making SQLite operations async when they're synchronous:** `better-sqlite3` is synchronous by design. Wrapping in `async` is fine for interface compliance (use `eslint-disable-next-line @typescript-eslint/require-await` as MemoryStorage does), but don't add unnecessary Promise overhead.

## Don't Hand-Roll

| Problem                        | Don't Build                              | Use Instead                        | Why                                                                    |
| ------------------------------ | ---------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------- |
| Redis connection management    | Custom connection pooling/retry          | ioredis built-in                   | Exponential backoff, offline queue, auto-reconnect all built in        |
| Atomic Redis counters          | Read-then-write with locks               | `HINCRBY` command                  | Redis commands are atomic; HINCRBY eliminates race conditions          |
| Key expiration/cleanup (Redis) | Background timer to scan and delete      | Redis `EXPIRE`/TTL                 | Redis handles expiration natively, no application-level cleanup needed |
| SQLite atomic upsert           | SELECT + UPDATE/INSERT with transactions | `INSERT ... ON CONFLICT DO UPDATE` | Single atomic SQL statement, no transaction needed                     |
| SQLite WAL mode                | Manual journal management                | `PRAGMA journal_mode = WAL`        | One pragma call at connection time                                     |
| Platform-aware paths           | env-paths package                        | Manual `process.platform` check    | 15 lines, avoids ESM-only dependency issue                             |
| Redis TypeScript types         | @types/ioredis                           | Built-in (ioredis ships types)     | ioredis is 100% TypeScript, declarations included                      |

**Key insight:** Both Redis and SQLite provide atomic counter operations natively. The storage adapters are thin wrappers translating the `StorageBackend` interface to the native driver API -- there's no complex concurrency logic to build.

## Common Pitfalls

### Pitfall 1: Redis EXPIRE Race Condition

**What goes wrong:** Setting TTL with separate `EXPIRE` command after `HINCRBY` can miss if connection drops between the two commands.
**Why it happens:** Non-atomic two-command sequence.
**How to avoid:** Use `redis.pipeline()` to batch `HINCRBY` + `EXPIRE` in a single round-trip. Pipeline ensures both commands are sent together.
**Warning signs:** Keys that never expire, unbounded Redis memory growth.

### Pitfall 2: SQLite Directory Not Existing

**What goes wrong:** `better-sqlite3` throws `SQLITE_CANTOPEN` when the parent directory doesn't exist.
**Why it happens:** XDG data directory may not exist on first run.
**How to avoid:** `mkdirSync(dirname(dbPath), { recursive: true })` before opening the database.
**Warning signs:** `SQLITE_CANTOPEN` error on first run.

### Pitfall 3: better-sqlite3 Binary Compilation Failure

**What goes wrong:** `npm install better-sqlite3` fails on some systems (Alpine Linux, older glibc, ARM without prebuilt binaries).
**Why it happens:** `better-sqlite3` uses native C++ addon requiring compilation.
**How to avoid:** This is expected and acceptable -- SQLite is optional. The error message must clearly state that `better-sqlite3` is optional and suggest Redis as an alternative. Never let this block users who don't need SQLite.
**Warning signs:** `node-gyp` errors during install.

### Pitfall 4: exactOptionalPropertyTypes with Redis Hash Values

**What goes wrong:** Redis returns all values as strings. TypeScript strict mode complains about `string | undefined` from hash lookups.
**Why it happens:** `noUncheckedIndexedAccess` makes hash field access return `T | undefined`.
**How to avoid:** Use `Number(value) || 0` pattern (already established in the codebase for Gemini usage fields). Parse Redis hash values explicitly.
**Warning signs:** TypeScript errors about `string | undefined` not assignable to `number`.

### Pitfall 5: ioredis Connection Error Handling

**What goes wrong:** ioredis queues commands while disconnected (offline queue), then replays them on reconnect. This can mask connection failures.
**Why it happens:** ioredis `enableOfflineQueue` defaults to `true`.
**How to avoid:** Consider setting `enableOfflineQueue: false` for immediate failure feedback, or keep the default but add a `ready` event check before returning the storage as usable. The `RedisStorage.create()` factory should wait for the `ready` event or fail with a timeout.
**Warning signs:** Storage operations silently hang during Redis outage instead of throwing.

### Pitfall 6: SQLite prepared statement caching with closed DB

**What goes wrong:** Cached prepared statements become invalid after `db.close()`.
**Why it happens:** better-sqlite3 prepared statements are bound to the database instance.
**How to avoid:** Clear statement cache in `close()` method.
**Warning signs:** `TypeError: The database connection is not open` after close.

## Code Examples

### Redis increment (verified pattern)

```typescript
// Source: Redis HINCRBY docs + ioredis pipeline API
async increment(
  provider: string,
  keyIndex: number,
  tokens: { prompt: number; completion: number },
  window: TimeWindow,
  callCount?: number,
): Promise<UsageRecord> {
  this.ensureOpen();

  const periodKey = getPeriodKey(window, Date.now());
  const key = `${this.prefix}${provider}:${keyIndex}:${window.type}:${periodKey}`;
  const ttlSeconds = this.getTtlForWindow(window);

  const pipeline = this.client.pipeline();
  pipeline.hincrby(key, 'prompt_tokens', tokens.prompt);
  pipeline.hincrby(key, 'completion_tokens', tokens.completion);
  pipeline.hincrby(key, 'call_count', callCount ?? 0);
  pipeline.expire(key, ttlSeconds);

  const results = await pipeline.exec();
  if (!results) throw new PennyLLMError('Redis pipeline returned null', { code: 'REDIS_ERROR' });

  // Extract new values from pipeline results
  // results[i] = [error, value]
  const promptTokens = Number(results[0]?.[1]) || 0;
  const completionTokens = Number(results[1]?.[1]) || 0;

  // Return UsageRecord matching interface
  return {
    id: `${key}`, // Use Redis key as ID
    provider,
    keyIndex,
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    timestamp: Date.now(),
    window,
    estimated: false,
  };
}
```

### SQLite increment (verified pattern)

```typescript
// Source: better-sqlite3 API docs + SQLite UPSERT syntax
increment(
  provider: string,
  keyIndex: number,
  tokens: { prompt: number; completion: number },
  window: TimeWindow,
  callCount?: number,
): UsageRecord {
  this.ensureOpen();
  this.cleanupExpired(window);

  const periodKey = getPeriodKey(window, Date.now());
  const now = Date.now();

  this.upsertStmt.run(
    provider, keyIndex, window.type, periodKey,
    tokens.prompt, tokens.completion, callCount ?? 0, now,
  );

  // Read back the updated values
  const row = this.getStmt.get(provider, keyIndex, window.type, periodKey) as {
    prompt_tokens: number;
    completion_tokens: number;
    call_count: number;
  } | undefined;

  return {
    id: `${provider}:${keyIndex}:${window.type}:${periodKey}`,
    provider,
    keyIndex,
    promptTokens: row?.prompt_tokens ?? tokens.prompt,
    completionTokens: row?.completion_tokens ?? tokens.completion,
    totalTokens: (row?.prompt_tokens ?? tokens.prompt) + (row?.completion_tokens ?? tokens.completion),
    timestamp: now,
    window,
    estimated: false,
  };
}
```

### Redis getUsage (verified pattern)

```typescript
// Source: ioredis HGETALL + type parsing
async getUsage(
  provider: string,
  keyIndex: number,
  window: TimeWindow,
): Promise<StructuredUsage> {
  this.ensureOpen();

  const periodKey = getPeriodKey(window, Date.now());
  const key = `${this.prefix}${provider}:${keyIndex}:${window.type}:${periodKey}`;

  const fields = await this.client.hgetall(key);

  return {
    promptTokens: Number(fields['prompt_tokens']) || 0,
    completionTokens: Number(fields['completion_tokens']) || 0,
    totalTokens: (Number(fields['prompt_tokens']) || 0) + (Number(fields['completion_tokens']) || 0),
    callCount: Number(fields['call_count']) || 0,
  };
}
```

### Static factory with connection readiness

```typescript
// Source: ioredis connection events docs
static async create(options: RedisStorageOptions): Promise<RedisStorage> {
  let IoRedis: typeof import('ioredis').default;
  try {
    const mod = await import('ioredis');
    IoRedis = mod.default;
  } catch {
    throw new PennyLLMError(
      'ioredis is required for RedisStorage. Install it: npm install ioredis',
      { code: 'MISSING_PEER_DEPENDENCY' }
    );
  }

  const prefix = options.prefix ?? 'pennyllm:';
  const client = typeof options.connection === 'string'
    ? new IoRedis(options.connection)
    : new IoRedis(options.connection as ConstructorParameters<typeof IoRedis>[0]);

  // Wait for connection or fail
  await new Promise<void>((resolve, reject) => {
    client.once('ready', () => resolve());
    client.once('error', (err: Error) => reject(
      new PennyLLMError(`Redis connection failed: ${err.message}`, {
        code: 'REDIS_CONNECTION_ERROR',
        cause: err,
      })
    ));
  });

  debug('RedisStorage connected with prefix: %s', prefix);
  return new RedisStorage(client, prefix);
}
```

## State of the Art

| Old Approach                     | Current Approach                           | When Changed                             | Impact                                                   |
| -------------------------------- | ------------------------------------------ | ---------------------------------------- | -------------------------------------------------------- |
| `node-redis` v3 (callback-based) | `ioredis` v5 (Promise + TypeScript native) | ioredis has dominated since 2020         | ioredis is the standard for TypeScript Redis projects    |
| `sqlite3` (async, callback)      | `better-sqlite3` (synchronous)             | better-sqlite3 is now the default choice | 5-10x faster than async sqlite3 for most operations      |
| @types/ioredis                   | Built-in types                             | ioredis v5                               | No separate @types package needed                        |
| env-paths v2 (CJS)               | env-paths v4 (ESM-only)                    | v3.0.0                                   | Cannot be used in dual CJS/ESM packages without bundling |
| Manual Redis key cleanup         | Redis TTL/EXPIRE                           | Always available                         | Zero-maintenance key lifecycle                           |

**Deprecated/outdated:**

- `@types/ioredis`: Stub package now, ioredis ships its own TypeScript types since v5
- `redis` (node-redis): Functional but less TypeScript-friendly than ioredis for this use case
- `sqlite3` (async variant): Callback-based, slower, more complex than better-sqlite3

## Validation Architecture

### Test Framework

| Property           | Value                   |
| ------------------ | ----------------------- |
| Framework          | vitest 2.1.8            |
| Config file        | vitest.config.ts        |
| Quick run command  | `npx vitest run tests/` |
| Full suite command | `npx vitest run`        |

### Phase Requirements -> Test Map

| Req ID   | Behavior                                            | Test Type   | Automated Command                                    | File Exists? |
| -------- | --------------------------------------------------- | ----------- | ---------------------------------------------------- | ------------ |
| USAGE-02 | RedisStorage passes storage contract tests          | integration | `npx vitest run src/redis/RedisStorage.test.ts -x`   | No -- Wave 0 |
| USAGE-02 | SqliteStorage passes storage contract tests         | unit        | `npx vitest run src/sqlite/SqliteStorage.test.ts -x` | No -- Wave 0 |
| DX-03    | Typed hook helpers return unsubscribe functions     | unit        | `npx vitest run tests/hooks.test.ts -x`              | No -- Wave 0 |
| DX-04    | Dry-run mode returns mock response without API call | unit        | `npx vitest run tests/dry-run.test.ts -x`            | No -- Wave 0 |

**Note:** Per CLAUDE.md testing strategy, tests are minimal during build phases. The contract tests already exist (`tests/contracts/storage.contract.ts`) and can be reused for both adapters. Additional test files are created only if plans explicitly require them.

### Sampling Rate

- **Per task commit:** `npx tsc --noEmit && npx vitest run`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green + `tsc --noEmit` before verification

### Wave 0 Gaps

- None critical -- existing `createStorageContractTests()` provides 10 tests for any StorageBackend implementation
- Redis contract tests require a running Redis instance (integration test -- may need Docker or mock)
- SQLite contract tests are self-contained (no external service needed)

## Open Questions

1. **Redis contract test strategy**
   - What we know: Contract tests need a real StorageBackend. SQLite tests are self-contained. Redis needs a running server.
   - What's unclear: Should we use ioredis-mock for unit tests or require a real Redis? CI implications?
   - Recommendation: Per CLAUDE.md, tests are minimal during build. Wire up contract tests with a factory that creates RedisStorage, skip if Redis isn't available. Real integration testing deferred to Phase 12 or manual validation.

2. **Dry-run response shape for LanguageModelV3**
   - What we know: `wrapGenerate` must return a `LanguageModelV3GenerateResult`. The middleware can intercept and return a mock.
   - What's unclear: Exact required fields for LanguageModelV3GenerateResult/StreamResult. The AI SDK types define the shape.
   - Recommendation: Return minimal valid response: `{ text: '[DRY RUN]', finishReason: 'stop', usage: { inputTokens: { total: 0 }, outputTokens: { total: 0 } } }` with dry-run metadata.

3. **Contract test `id` field for Redis**
   - What we know: Contract test checks `record.id` is defined and same record ID persists across increments. MemoryStorage uses `randomUUID()`.
   - What's unclear: Redis doesn't have a natural UUID for records.
   - Recommendation: Use the Redis key as the `id` field (deterministic, unique). The contract test checks `record2.id === record1.id` for same-key increments -- using the Redis key satisfies this since the same composite key always maps to the same Redis hash.

## Sources

### Primary (HIGH confidence)

- [ioredis npm](https://www.npmjs.com/package/ioredis) - v5.10.0, TypeScript-native, 14M+ weekly downloads
- [ioredis GitHub](https://github.com/redis/ioredis) - Connection options, MULTI/EXEC, pipeline, TypeScript support verified
- [better-sqlite3 npm](https://www.npmjs.com/package/better-sqlite3) - v12.7.x, synchronous API
- [better-sqlite3 API docs](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md) - Database, Statement, Transaction API
- [Redis HINCRBY docs](https://redis.io/docs/latest/commands/hincrby/) - Atomic hash field increment
- [Redis EXPIRE docs](https://redis.io/docs/latest/commands/expire/) - Key TTL management
- [env-paths GitHub](https://github.com/sindresorhus/env-paths) - v4.0.0, ESM-only since v3

### Secondary (MEDIUM confidence)

- [ioredis readthedocs API](https://ioredis.readthedocs.io/en/latest/API/) - quit() vs disconnect() behavior
- [ioredis pipeline examples](https://deepwiki.com/redis/ioredis/3.1-pipelining-and-transactions) - MULTI/EXEC and pipeline patterns
- [@types/better-sqlite3 npm](https://www.npmjs.com/package/@types/better-sqlite3) - TypeScript type definitions

### Tertiary (LOW confidence)

- None -- all critical findings verified with primary or secondary sources

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH -- ioredis and better-sqlite3 are the dominant libraries in their categories, CONTEXT.md locks the choices
- Architecture: HIGH -- Redis hash + HINCRBY and SQLite UPSERT are well-documented standard patterns. Existing StorageBackend interface is clear
- Pitfalls: HIGH -- Common issues well-documented across Redis and SQLite ecosystem. Project-specific concerns (exactOptionalPropertyTypes, CJS/ESM dual build) verified against codebase
- Observability hooks: HIGH -- EventEmitter pattern already exists, typed wrappers are straightforward sugar
- Dry-run mode: MEDIUM -- LanguageModelV3 mock response shape needs verification against AI SDK types at implementation time

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (stable libraries, well-established patterns)
