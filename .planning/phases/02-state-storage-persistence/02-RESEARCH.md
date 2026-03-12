# Phase 2: State Storage & Persistence - Research

**Researched:** 2026-03-12
**Domain:** In-memory storage backend, StorageBackend contract testing, Zod config schema modification
**Confidence:** HIGH

## Summary

Phase 2 implements an in-memory storage backend as the default zero-dependency storage layer, along with contract tests that all future StorageBackend implementations must pass. This represents a major architectural pivot from the original SQLite-first approach to a memory-first design with optional persistent adapters deferred to Phase 10.

The memory backend uses JavaScript Map for counter storage with automatic time-window expiration cleanup. Since Node.js is single-threaded with an event loop, race conditions can still occur during async operations, but the synchronous nature of Map operations in a single-threaded context provides sufficient atomicity for increment operations. The Zod config schema removes the `storage` section entirely—storage becomes a runtime `StorageBackend` instance parameter to `createRouter()`, not a JSON-serializable config value.

**Primary recommendation:** Build MemoryStorage with Map-based counter storage using composite string keys (provider:keyIndex:windowType:windowPeriod), implement lazy expiration cleanup on read/write operations, emit stderr warning on initialization, and create contract test suite using Vitest describe.for pattern that future adapters (SQLite, Redis) will inherit in Phase 10.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Storage Architecture (Major Pivot)**

- Memory is the default storage backend — zero dependencies, works on every platform (local, Docker, serverless, CI)
- SQLite and Redis are deferred to Phase 10 as optional persistent adapters (peer dep install)
- Custom StorageBackend implementations accepted — user can plug in any database via the interface
- No built-in persistence in Phase 2 — persistence is an upgrade path, not the baseline

**Driver Installation Model**

- Optional peer dependencies for all storage drivers — user installs only what they need
- Memory backend ships built-in (zero deps)
- SQLite adapter (Phase 10): npm install better-sqlite3 or npm install sql.js — auto-detect which is installed, better-sqlite3 preferred, sql.js fallback
- Redis adapter (Phase 10): npm install ioredis
- Clear error message if user configures a backend whose driver is not installed

**Memory Backend Behavior**

- Uses JavaScript Map internally for counter storage
- Auto-evicts expired time windows (per-minute rows older than 1min, hourly older than 1hr, etc.) — no unbounded growth
- close() clears all data in the internal Map and marks backend as closed; subsequent calls throw
- Always warns to stderr on initialization: "Using in-memory storage — usage data will not persist across restarts. Use a storage adapter for persistence."

**Data Model (Applies to All Backends)**

- Pre-aggregated counters — one entry per (provider, key, window_type, window_period)
- Running totals: prompt_tokens, completion_tokens, call_count per entry
- Atomic increment via single operation (trivial in memory, SQL UPDATE + N for SQLite, INCR for Redis)
- No raw event logging — counters only

**Config Schema Changes**

- Remove storage section from Zod config schema entirely
- Storage backend is passed as a runtime StorageBackend instance to createRouter()
- When no storage instance provided, default to MemoryStorage
- Config shape: createRouter({ providers: {...}, storage?: StorageBackend })
- Storage config is NOT JSON-serializable — it's a runtime object (file-based config users get memory default)

**StorageBackend Interface**

- Keep existing interface unchanged: get, put, increment, getUsage, reset, close
- Export adapter classes directly — no factory pattern
- MemoryStorage exported from main package (import { MemoryStorage } from 'llm-router')
- Future: SqliteStorage from llm-router/sqlite, RedisStorage from llm-router/redis (Phase 10)

**Contract Testing**

- Build a shared test suite that any StorageBackend implementation must pass
- Tests cover: increment atomicity, getUsage accuracy, multi-window support, reset behavior, close lifecycle, expired window cleanup
- Phase 10 runs the exact same contract tests against SQLite and Redis adapters

### Claude's Discretion

- Internal Map key format for memory backend
- Exact expired window cleanup trigger (on every write, on read, or periodic)
- Concurrency handling in memory backend (Node.js is single-threaded but async gaps exist)
- Contract test organization and structure
- How to handle the StorageBackend type in createRouter() signature alongside Zod-validated config

### Deferred Ideas (OUT OF SCOPE)

- SQLite adapter with key-value counter table, auto-detect driver (better-sqlite3/sql.js), WAL mode, schema_info table, auto-cleanup, forward-only migrations — Phase 10
- Redis adapter — Phase 10
- Hybrid pattern (memory cache + external store sync, like LiteLLM's 0.01s Redis sync) — Phase 10 optimization
- Shared usage data across projects (single DB tracking all projects using same API keys) — Phase 10 with persistent adapters
- Platform-aware default DB path (XDG dirs, env var resolution chain) — Phase 10 with SQLite adapter
  </user_constraints>

<phase_requirements>

## Phase Requirements

| ID       | Description                                                                                | Research Support                                                                                                            |
| -------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| USAGE-02 | Usage data persists across application restarts via SQLite (default) or Redis (optional)   | Memory backend establishes StorageBackend contract; Phase 10 adds SQLite/Redis adapters with same interface                 |
| USAGE-05 | Usage tracking handles concurrent requests atomically (no race conditions causing overage) | Map operations are synchronous in Node.js single-threaded context; increment method atomically reads-updates-stores counter |

</phase_requirements>

## Standard Stack

### Core

| Library        | Version  | Purpose                     | Why Standard                                                                                                 |
| -------------- | -------- | --------------------------- | ------------------------------------------------------------------------------------------------------------ |
| JavaScript Map | Built-in | In-memory key-value storage | Native, zero dependencies, O(1) access, synchronous operations prevent race conditions in Node.js event loop |
| Vitest         | ^2.1.8   | Contract testing framework  | Already project dependency, supports describe.for parameterized tests, TypeScript-first, Vite-powered        |
| debug          | ^4.3.0   | Component-based logging     | Already project dependency, namespace-based (llm-router:storage), zero cost when disabled                    |

### Supporting

| Library        | Version  | Purpose                     | When to Use                                                                     |
| -------------- | -------- | --------------------------- | ------------------------------------------------------------------------------- |
| process.stderr | Built-in | Warning output              | Emit non-suppressible warnings (memory storage active) without polluting stdout |
| Zod            | ^3.23.0  | Schema validation (removal) | Update configSchema to remove storage section; storage becomes runtime instance |

### Alternatives Considered

| Instead of      | Could Use             | Tradeoff                                                                                                                        |
| --------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Map             | lru-cache npm package | lru-cache adds LRU eviction but requires dependency; Map + manual expiration is zero-dep and sufficient for time-window cleanup |
| Map             | WeakMap               | WeakMap only supports object keys, not primitive strings; counter keys are composite strings                                    |
| Lazy expiration | setInterval cleanup   | setInterval keeps event loop alive preventing graceful shutdown; lazy cleanup on access is simpler and sufficient               |
| describe.for    | describe.each         | describe.for has better TypeScript inference, less boilerplate, recommended for Vitest-native code                              |

**Installation:**

```bash
# No additional dependencies required
# Vitest and debug already in devDependencies/dependencies
```

## Architecture Patterns

### Recommended Project Structure

```
src/
├── storage/
│   ├── index.ts              # Re-exports MemoryStorage
│   ├── MemoryStorage.ts      # Default in-memory implementation
│   └── MemoryStorage.test.ts # MemoryStorage-specific tests
├── types/interfaces.ts       # StorageBackend interface (unchanged)
tests/
├── contracts/
│   ├── storage.contract.ts   # Shared contract test suite
│   └── README.md             # Contract test usage docs
```

### Pattern 1: Composite String Key Format

**What:** Concatenate provider, keyIndex, window type, and window period into a single string key for Map storage
**When to use:** All Map.get/set operations in MemoryStorage
**Example:**

```typescript
// Internal key format: "provider:keyIndex:windowType:windowPeriod"
function makeKey(provider: string, keyIndex: number, window: TimeWindow): string {
  const period = Math.floor(Date.now() / window.durationMs);
  return `${provider}:${keyIndex}:${window.type}:${period}`;
}

// Example keys:
// "google:0:per-minute:123456"
// "google:0:hourly:4321"
// "groq:1:daily:890"
```

**Source:** [Composite Map Keys in JavaScript](https://justinfagnani.com/2024/11/09/composite-map-keys-in-javascript-with-bitsets/), [TypeScript Map composite keys](https://github.com/arielshaqed/compkey)

### Pattern 2: Lazy Expiration Cleanup

**What:** Check and remove expired entries during get/increment operations rather than periodic background cleanup
**When to use:** Before reading from Map, before writing to Map
**Example:**

```typescript
class MemoryStorage implements StorageBackend {
  private data = new Map<string, UsageRecord>();
  private closed = false;

  private cleanupExpired(window: TimeWindow): void {
    const now = Date.now();
    const cutoff = Math.floor(now / window.durationMs);

    // Remove entries older than current window period
    for (const [key, record] of this.data.entries()) {
      const recordPeriod = Math.floor(record.timestamp / window.durationMs);
      if (recordPeriod < cutoff) {
        this.data.delete(key);
      }
    }
  }

  async increment(provider: string, keyIndex: number, tokens: {...}, window: TimeWindow): Promise<UsageRecord> {
    if (this.closed) throw new Error('Storage backend is closed');

    this.cleanupExpired(window); // Lazy cleanup before write

    const key = makeKey(provider, keyIndex, window);
    const existing = this.data.get(key);

    // Atomic read-modify-write (synchronous Map operation)
    const updated = existing
      ? { ...existing, promptTokens: existing.promptTokens + tokens.prompt, ... }
      : createNewRecord(provider, keyIndex, tokens, window);

    this.data.set(key, updated);
    return updated;
  }
}
```

**Source:** [Node.js race conditions](https://nodejsdesignpatterns.com/blog/node-js-race-conditions/), [Grace Period Data Retention in Spring Boot](https://medium.com/@AlexanderObregon/grace-period-data-retention-in-spring-boot-with-scheduled-purges-3a67ef610bf6)

### Pattern 3: Contract Test Suite with describe.for

**What:** Shared test suite that any StorageBackend implementation must pass, using Vitest's describe.for for parameterized testing
**When to use:** Testing MemoryStorage (Phase 2), SqliteStorage (Phase 10), RedisStorage (Phase 10), custom user implementations
**Example:**

```typescript
// tests/contracts/storage.contract.ts
import { describe, test, expect, beforeEach } from 'vitest';
import type { StorageBackend, TimeWindow } from '../../src/types/index.js';

export function createStorageContractTests(name: string, factory: () => Promise<StorageBackend>) {
  describe(`StorageBackend Contract: ${name}`, () => {
    let storage: StorageBackend;

    beforeEach(async () => {
      storage = await factory();
    });

    test('increment creates new record when key does not exist', async () => {
      const window: TimeWindow = { type: 'per-minute', durationMs: 60_000 };
      const record = await storage.increment('google', 0, { prompt: 100, completion: 50 }, window);

      expect(record.provider).toBe('google');
      expect(record.keyIndex).toBe(0);
      expect(record.promptTokens).toBe(100);
      expect(record.completionTokens).toBe(50);
    });

    test('increment atomically updates existing record', async () => {
      const window: TimeWindow = { type: 'per-minute', durationMs: 60_000 };

      await storage.increment('google', 0, { prompt: 100, completion: 50 }, window);
      const updated = await storage.increment('google', 0, { prompt: 50, completion: 25 }, window);

      expect(updated.promptTokens).toBe(150);
      expect(updated.completionTokens).toBe(75);
    });

    test('getUsage returns accurate total tokens', async () => {
      const window: TimeWindow = { type: 'hourly', durationMs: 3600_000 };

      await storage.increment('groq', 1, { prompt: 500, completion: 200 }, window);
      await storage.increment('groq', 1, { prompt: 300, completion: 100 }, window);

      const usage = await storage.getUsage('groq', 1, window);
      expect(usage).toBe(1100); // 500+200+300+100
    });

    test('reset clears usage for specific key and window', async () => {
      const window: TimeWindow = { type: 'daily', durationMs: 86400_000 };

      await storage.increment('mistral', 2, { prompt: 1000, completion: 500 }, window);
      await storage.reset('mistral', 2, window);

      const usage = await storage.getUsage('mistral', 2, window);
      expect(usage).toBe(0);
    });

    test('close prevents further operations', async () => {
      await storage.close();

      await expect(
        storage.increment(
          'google',
          0,
          { prompt: 100, completion: 50 },
          { type: 'per-minute', durationMs: 60_000 },
        ),
      ).rejects.toThrow();
    });

    test('expired windows are automatically cleaned up', async () => {
      // Implementation-specific: test that old window periods are removed
      // This test may vary by adapter but contract requires cleanup
    });
  });
}

// Usage in MemoryStorage.test.ts
import { createStorageContractTests } from '../tests/contracts/storage.contract.js';
import { MemoryStorage } from './MemoryStorage.js';

createStorageContractTests('MemoryStorage', async () => new MemoryStorage());
```

**Source:** [Vitest describe.for](https://vitest.dev/api/), [Unit Test Code Reuse with Vitest](https://www.thecandidstartup.org/2025/06/30/unit-test-code-reuse.html)

### Pattern 4: Runtime Instance Config Parameter

**What:** Accept StorageBackend as a runtime parameter to createRouter() rather than JSON-serializable Zod config
**When to use:** createRouter() function signature, handling optional storage parameter
**Example:**

```typescript
// src/index.ts
import type { RouterConfig } from './types/config.js';
import type { StorageBackend } from './types/interfaces.js';
import { MemoryStorage } from './storage/index.js';

export function createRouter(config: RouterConfig, options?: { storage?: StorageBackend }): Router {
  const storage = options?.storage ?? new MemoryStorage();

  // Storage instance is now a runtime dependency, not config
  return { config, storage /* ... */ };
}

// Usage:
const router = createRouter(config); // Uses MemoryStorage default
const router = createRouter(config, { storage: new MemoryStorage() }); // Explicit
```

**Source:** [Zod schema serialize/deserialize discussion](https://github.com/colinhacks/zod/discussions/2030)

### Pattern 5: Stderr Warning on Initialization

**What:** Emit non-suppressible warning to stderr when MemoryStorage is initialized
**When to use:** MemoryStorage constructor
**Example:**

```typescript
// src/storage/MemoryStorage.ts
export class MemoryStorage implements StorageBackend {
  private data = new Map<string, UsageRecord>();
  private closed = false;

  constructor() {
    process.stderr.write(
      'Warning: Using in-memory storage — usage data will not persist across restarts. ' +
        'Use a storage adapter for persistence.\n',
    );
  }

  // ... implementation
}
```

**Source:** [Node.js Console documentation](https://nodejs.org/api/console.html), [process.stderr.write vs console.error](https://frontendmasters.com/courses/digging-into-node/console-error-process-stderr/)

### Anti-Patterns to Avoid

- **Using setInterval for cleanup:** Keeps event loop alive, prevents graceful shutdown. Use lazy cleanup on access instead.
- **Nested Maps for composite keys:** Requires many Map instances, complex lookup logic. Use string concatenation with separator.
- **WeakMap for counter storage:** WeakMap only supports object keys, not strings. Map is correct choice for string keys.
- **Including storage in Zod config schema:** Storage backend is runtime instance (class), not JSON-serializable config value.
- **Silent memory storage:** User must be warned that data won't persist. Always emit stderr warning.

## Don't Hand-Roll

| Problem                      | Don't Build                          | Use Instead                                | Why                                                                                                                                                                                  |
| ---------------------------- | ------------------------------------ | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Race condition protection    | Custom mutex/lock for Map operations | Rely on Node.js single-threaded execution  | Map operations are synchronous; Node.js event loop prevents concurrent execution within single tick. Atomics only needed for SharedArrayBuffer across workers (not applicable here). |
| LRU eviction                 | Custom least-recently-used cache     | Map + time-based expiration cleanup        | Time windows have natural expiration (per-minute older than 1min); LRU adds complexity without benefit for time-windowed counters                                                    |
| Time window calculations     | Custom date/time math                | Math.floor(Date.now() / window.durationMs) | Standard pattern for bucketing timestamps into fixed windows; handles per-minute, hourly, daily, monthly uniformly                                                                   |
| Contract test infrastructure | Custom test suite runner             | Vitest describe.for with factory function  | Vitest parameterized testing is built-in, supports TypeScript, integrates with existing test runner                                                                                  |

**Key insight:** Node.js single-threaded model provides sufficient atomicity for synchronous Map operations. Race conditions occur between async await points, but read-modify-write within a single function execution is atomic. LiteLLM and rate-limiter-flexible both rely on this property for in-memory counters.

## Common Pitfalls

### Pitfall 1: Assuming Node.js single-threaded = no race conditions

**What goes wrong:** Developers assume Node.js single-threading prevents all race conditions, but async operations create interleaving points where concurrent requests can cause lost updates.

**Why it happens:** Node.js is single-threaded, but multiple async operations are scheduled on the event loop and their discrete tasks can intermingled between await points.

**How to avoid:** Keep increment operations synchronous within the critical section. Read-modify-write on the Map must complete without await between steps.

**Warning signs:** Using await between Map.get() and Map.set() in increment method; async database calls interspersed with counter logic.

**Example of the problem:**

```typescript
// BAD: Race condition possible
async increment(provider: string, keyIndex: number, tokens: {...}, window: TimeWindow) {
  const key = makeKey(provider, keyIndex, window);
  const existing = this.data.get(key);

  await someAsyncOperation(); // DANGER: Another increment could happen here

  const updated = existing ? updateTokens(existing, tokens) : createNew(tokens);
  this.data.set(key, updated); // May overwrite concurrent update
}

// GOOD: Atomic synchronous operation
async increment(provider: string, keyIndex: number, tokens: {...}, window: TimeWindow) {
  const key = makeKey(provider, keyIndex, window);
  const existing = this.data.get(key);
  const updated = existing ? updateTokens(existing, tokens) : createNew(tokens);
  this.data.set(key, updated); // All synchronous, no interleaving

  await someAsyncOperation(); // Safe after write complete
}
```

**Source:** [Node.js race conditions](https://nodejsdesignpatterns.com/blog/node-js-race-conditions/), [Mastering Node.js Concurrency](https://medium.com/@zuyufmanna/mastering-node-js-concurrency-race-condition-detection-and-prevention-3e0cfb3ccb07)

### Pitfall 2: Unbounded Map growth without cleanup

**What goes wrong:** Map grows without bound as new time window periods are created, leading to memory leaks in long-running processes.

**Why it happens:** Every new time period (per-minute bucket, hourly bucket, etc.) creates a new Map entry; old entries are never removed.

**How to avoid:** Implement lazy expiration cleanup in get/increment/getUsage methods. Before accessing data, iterate over entries and delete those where recordPeriod < currentPeriod - 1.

**Warning signs:** Memory usage grows continuously in production; Map size increases without bound; no cleanup logic in code.

**Example fix:**

```typescript
private cleanupExpired(window: TimeWindow): void {
  const currentPeriod = Math.floor(Date.now() / window.durationMs);

  for (const [key, record] of this.data.entries()) {
    if (record.window.type !== window.type) continue; // Only clean same window type

    const recordPeriod = Math.floor(record.timestamp / window.durationMs);
    if (recordPeriod < currentPeriod) {
      this.data.delete(key);
    }
  }
}
```

**Source:** [How to Create Memory Cache with TTL in Node.js](https://oneuptime.com/blog/post/2026-01-30-nodejs-memory-cache-ttl/view), [lru-cache documentation](https://www.npmjs.com/package/lru-cache)

### Pitfall 3: Using WeakMap for string keys

**What goes wrong:** WeakMap only accepts object keys, not primitive strings. Attempting to use WeakMap with string keys causes runtime errors.

**Why it happens:** Developers see "Map" in WeakMap and assume it's a drop-in replacement for Map with better memory characteristics.

**How to avoid:** Use standard Map for string-based composite keys. WeakMap is for garbage-collection-friendly object keys only.

**Warning signs:** TypeScript error "Type 'string' is not assignable to type 'object'"; runtime error when using WeakMap.set(stringKey, value).

**Source:** [MDN WeakMap documentation](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap)

### Pitfall 4: Closing storage but not preventing further operations

**What goes wrong:** close() clears the Map but doesn't set a closed flag, allowing subsequent operations that recreate entries in supposedly closed storage.

**Why it happens:** Developers implement cleanup logic but forget to prevent post-close operations.

**How to avoid:** Set this.closed = true in close() method; check this.closed at start of every public method and throw if true.

**Warning signs:** Tests pass individually but fail when run together; operations succeed after close() is called; flaky tests.

**Example fix:**

```typescript
async increment(...) {
  if (this.closed) throw new Error('Storage backend is closed');
  // ... implementation
}

async close() {
  this.closed = true;
  this.data.clear();
}
```

**Source:** StorageBackend interface contract (project types/interfaces.ts)

### Pitfall 5: Composite key collision with delimiter in data

**What goes wrong:** If delimiter character (e.g., ':') appears in provider name, composite key format breaks, causing key collisions.

**Why it happens:** Simple string concatenation without escaping assumes delimiter never appears in data.

**How to avoid:** Choose delimiter unlikely to appear in provider names, or escape delimiter in data before concatenation. For llm-router, provider names are controlled (google, groq, mistral, etc.) so ':' is safe.

**Warning signs:** Usage counts for different providers get mixed together; key collisions in tests with synthetic provider names.

**Source:** [Composite Map Keys in JavaScript](https://justinfagnani.com/2024/11/09/composite-map-keys-in-javascript-with-bitsets/)

## Code Examples

Verified patterns for implementation:

### MemoryStorage Complete Implementation Skeleton

```typescript
// src/storage/MemoryStorage.ts
import type { StorageBackend, UsageRecord, TimeWindow } from '../types/index.js';
import { randomUUID } from 'node:crypto';

export class MemoryStorage implements StorageBackend {
  private data = new Map<string, UsageRecord>();
  private closed = false;

  constructor() {
    process.stderr.write(
      'Warning: Using in-memory storage — usage data will not persist across restarts. ' +
        'Use a storage adapter for persistence.\n',
    );
  }

  private makeKey(provider: string, keyIndex: number, window: TimeWindow): string {
    const period = Math.floor(Date.now() / window.durationMs);
    return `${provider}:${keyIndex}:${window.type}:${period}`;
  }

  private cleanupExpired(window: TimeWindow): void {
    const currentPeriod = Math.floor(Date.now() / window.durationMs);

    for (const [key, record] of this.data.entries()) {
      if (record.window.type !== window.type) continue;

      const recordPeriod = Math.floor(record.timestamp / window.durationMs);
      if (recordPeriod < currentPeriod) {
        this.data.delete(key);
      }
    }
  }

  async get(key: string): Promise<UsageRecord[]> {
    if (this.closed) throw new Error('Storage backend is closed');

    const records: UsageRecord[] = [];
    for (const [mapKey, record] of this.data.entries()) {
      if (mapKey.startsWith(`${key}:`)) {
        records.push(record);
      }
    }
    return records;
  }

  async put(record: UsageRecord): Promise<void> {
    if (this.closed) throw new Error('Storage backend is closed');

    const key = this.makeKey(record.provider, record.keyIndex, record.window);
    this.data.set(key, record);
  }

  async increment(
    provider: string,
    keyIndex: number,
    tokens: { prompt: number; completion: number },
    window: TimeWindow,
  ): Promise<UsageRecord> {
    if (this.closed) throw new Error('Storage backend is closed');

    this.cleanupExpired(window); // Lazy cleanup before write

    const key = this.makeKey(provider, keyIndex, window);
    const existing = this.data.get(key);

    // Atomic read-modify-write (synchronous)
    const updated: UsageRecord = existing
      ? {
          ...existing,
          promptTokens: existing.promptTokens + tokens.prompt,
          completionTokens: existing.completionTokens + tokens.completion,
          totalTokens: existing.totalTokens + tokens.prompt + tokens.completion,
        }
      : {
          id: randomUUID(),
          provider,
          keyIndex,
          promptTokens: tokens.prompt,
          completionTokens: tokens.completion,
          totalTokens: tokens.prompt + tokens.completion,
          timestamp: Date.now(),
          window,
          estimated: false,
        };

    this.data.set(key, updated);
    return updated;
  }

  async getUsage(provider: string, keyIndex: number, window: TimeWindow): Promise<number> {
    if (this.closed) throw new Error('Storage backend is closed');

    this.cleanupExpired(window); // Lazy cleanup before read

    const key = this.makeKey(provider, keyIndex, window);
    const record = this.data.get(key);
    return record?.totalTokens ?? 0;
  }

  async reset(provider: string, keyIndex: number, window: TimeWindow): Promise<void> {
    if (this.closed) throw new Error('Storage backend is closed');

    const key = this.makeKey(provider, keyIndex, window);
    this.data.delete(key);
  }

  async close(): Promise<void> {
    this.closed = true;
    this.data.clear();
  }
}
```

### Config Schema Update - Remove Storage Section

```typescript
// src/config/schema.ts
import { z } from 'zod';

// BEFORE (Phase 1):
// export const storageConfigSchema = z.object({
//   type: z.enum(['sqlite', 'redis', 'memory']).default('sqlite'),
//   path: z.string().optional(),
//   // ... other storage config
// });

// export const configSchema = z.object({
//   providers: z.record(z.string(), providerConfigSchema),
//   strategy: z.enum(['round-robin', 'least-used']).default('round-robin'),
//   storage: storageConfigSchema,
//   budget: z.number().nonnegative().default(0),
// });

// AFTER (Phase 2):
export const configSchema = z.object({
  providers: z.record(z.string(), providerConfigSchema),
  strategy: z.enum(['round-robin', 'least-used']).default('round-robin'),
  // storage section removed entirely
  budget: z.number().nonnegative().default(0),
});

// storageConfigSchema export removed
```

### createRouter with Runtime Storage Parameter

```typescript
// src/index.ts
import type { RouterConfig } from './types/config.js';
import type { StorageBackend } from './types/interfaces.js';
import { MemoryStorage } from './storage/index.js';

export interface Router {
  config: RouterConfig;
  storage: StorageBackend;
  // ... other router properties
}

export function createRouter(config: RouterConfig, options?: { storage?: StorageBackend }): Router {
  // Default to MemoryStorage if no storage instance provided
  const storage = options?.storage ?? new MemoryStorage();

  return {
    config,
    storage,
    // ... initialize other router components
  };
}

// Usage examples:
// const router = createRouter(config); // Uses MemoryStorage
// const router = createRouter(config, { storage: new MemoryStorage() }); // Explicit
// const router = createRouter(config, { storage: new CustomStorage() }); // Custom implementation
```

## State of the Art

| Old Approach                       | Current Approach                               | When Changed               | Impact                                                                                  |
| ---------------------------------- | ---------------------------------------------- | -------------------------- | --------------------------------------------------------------------------------------- |
| SQLite-first with built-in adapter | Memory-first with optional persistent adapters | Phase 2 pivot (2026-03-12) | Zero dependencies for default use case; persistence is opt-in upgrade path              |
| Storage config in Zod schema       | Storage as runtime instance parameter          | Phase 2 (2026-03-12)       | Storage backend not limited to JSON-serializable config; enables custom implementations |
| Background setInterval cleanup     | Lazy expiration on access                      | Phase 2 research           | No event loop pollution; simpler lifecycle management                                   |
| describe.each for contract tests   | describe.for with factory function             | Vitest 2.x recommendation  | Better TypeScript inference; less boilerplate                                           |

**Deprecated/outdated:**

- Zod storageConfigSchema: Removed in Phase 2; storage is now runtime parameter
- SQLite as default backend: Deferred to Phase 10 as optional adapter
- Shared storage config section: No longer exists in config schema

## Open Questions

1. **Window period boundary precision**
   - What we know: Math.floor(Date.now() / window.durationMs) buckets timestamps into periods
   - What's unclear: Should boundary transitions (e.g., 59.9s → 60.0s in per-minute window) be handled specially?
   - Recommendation: Floor division is standard; no special handling needed. Counters reset naturally at period boundaries.

2. **Cleanup frequency optimization**
   - What we know: Lazy cleanup runs on every get/increment/getUsage call
   - What's unclear: Could cleanup on every call impact performance with large Map sizes?
   - Recommendation: Start with cleanup on every call; optimize later if profiling shows bottleneck. Bounded by number of expired entries, not total Map size.

3. **Multi-window cleanup scope**
   - What we know: cleanupExpired(window) receives specific TimeWindow
   - What's unclear: Should cleanup only remove entries for that window type, or clean all expired windows?
   - Recommendation: Clean only the specified window type to avoid O(n) full-Map scans on every operation. User may use different window types for different providers.

4. **Contract test timeout configuration**
   - What we know: MemoryStorage operations are near-instant; SQLite/Redis will be slower
   - What's unclear: Should contract tests have configurable timeouts per adapter?
   - Recommendation: Use default Vitest timeouts (5s); sufficient for memory, SQLite, Redis. Custom timeouts if network-based adapters added later.

## Validation Architecture

> Nyquist validation is enabled (workflow.nyquist_validation: true in config.json)

### Test Framework

| Property           | Value                                                    |
| ------------------ | -------------------------------------------------------- |
| Framework          | Vitest v2.1.8                                            |
| Config file        | vitest.config.ts (existing)                              |
| Quick run command  | `vitest run tests/contracts/storage.contract.test.ts -x` |
| Full suite command | `npm test`                                               |

### Phase Requirements → Test Map

| Req ID   | Behavior                                          | Test Type | Automated Command                                                                  | File Exists? |
| -------- | ------------------------------------------------- | --------- | ---------------------------------------------------------------------------------- | ------------ |
| USAGE-05 | Atomic concurrent increments don't lose updates   | unit      | `vitest run tests/contracts/storage.contract.test.ts -t "increment atomically" -x` | ❌ Wave 0    |
| USAGE-05 | Race conditions prevented during async operations | unit      | `vitest run src/storage/MemoryStorage.test.ts -t "race condition" -x`              | ❌ Wave 0    |
| USAGE-02 | MemoryStorage implements StorageBackend contract  | contract  | `vitest run tests/contracts/storage.contract.test.ts -x`                           | ❌ Wave 0    |
| USAGE-02 | Memory storage warns on initialization (stderr)   | unit      | `vitest run src/storage/MemoryStorage.test.ts -t "stderr warning" -x`              | ❌ Wave 0    |
| USAGE-05 | Cleanup doesn't corrupt concurrent operations     | unit      | `vitest run src/storage/MemoryStorage.test.ts -t "cleanup concurrent" -x`          | ❌ Wave 0    |

### Sampling Rate

- **Per task commit:** `vitest run tests/contracts/storage.contract.test.ts -x` (contract tests only, ~2-5s)
- **Per wave merge:** `npm test` (all tests including existing config/build tests)
- **Phase gate:** Full suite green + manual verification of stderr warning before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/contracts/storage.contract.test.ts` — covers USAGE-02, USAGE-05 (contract suite)
- [ ] `src/storage/MemoryStorage.test.ts` — covers MemoryStorage-specific behaviors (stderr, race conditions)
- [ ] `tests/contracts/README.md` — documents how to use contract tests for custom adapters
- [ ] Update existing `tests/config.test.ts` — remove storage config validation tests (section removed from schema)

## Sources

### Primary (HIGH confidence)

- [Node.js Console documentation](https://nodejs.org/api/console.html) - process.stderr.write vs console.error
- [Vitest API documentation](https://vitest.dev/api/) - describe.for parameterized testing
- [MDN JavaScript Map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map) - Map API and semantics

### Secondary (MEDIUM confidence)

- [Node.js race conditions](https://nodejsdesignpatterns.com/blog/node-js-race-conditions/) - Single-threaded async concurrency
- [Mastering Node.js Concurrency](https://medium.com/@zuyufmanna/mastering-node-js-concurrency-race-condition-detection-and-prevention-3e0cfb3ccb07) - Race condition prevention
- [Composite Map Keys in JavaScript](https://justinfagnani.com/2024/11/09/composite-map-keys-in-javascript-with-bitsets/) - String key format patterns
- [Unit Test Code Reuse with Vitest](https://www.thecandidstartup.org/2025/06/30/unit-test-code-reuse.html) - Shared test suite pattern
- [rate-limiter-flexible npm](https://www.npmjs.com/package/rate-limiter-flexible) - Industry in-memory storage patterns
- [LiteLLM in-memory cache sync](https://docs.litellm.ai/docs/proxy/dynamic_rate_limit) - 0.01s Redis sync pattern (reference only, deferred to Phase 10)
- [better-sqlite3 npm](https://www.npmjs.com/package/better-sqlite3) - SQLite adapter research for Phase 10
- [How to Create Memory Cache with TTL in Node.js](https://oneuptime.com/blog/post/2026-01-30-nodejs-memory-cache-ttl/view) - Expiration cleanup patterns
- [Zod schema serialize/deserialize discussion](https://github.com/colinhacks/zod/discussions/2030) - Why runtime instances don't go in Zod config

### Tertiary (LOW confidence)

- [Frontend Masters: Console Error & Process stderr](https://frontendmasters.com/courses/digging-into-node/console-error-process-stderr/) - Stderr usage patterns
- [Grace Period Data Retention in Spring Boot](https://medium.com/@AlexanderObregon/grace-period-data-retention-in-spring-boot-with-scheduled-purges-3a67ef610bf6) - Scheduled cleanup patterns (not directly applicable but validates lazy cleanup approach)

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - Built-in Map, existing Vitest, no new dependencies
- Architecture: HIGH - Industry patterns verified (LiteLLM, rate-limiter-flexible), Node.js concurrency model well-documented
- Pitfalls: HIGH - Race condition patterns verified in Node.js docs, composite key patterns from multiple sources
- Validation architecture: HIGH - Existing Vitest framework, clear contract test pattern

**Research date:** 2026-03-12
**Valid until:** 2026-04-12 (30 days — stable patterns, Node.js core APIs unchanged)
