# Phase 10: SQLite, Redis & Advanced Features - Context

**Gathered:** 2026-03-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver persistent storage adapters (Redis primary, SQLite secondary), observability hooks, and dry-run mode. Redis is the priority — it works in serverless, multi-process, and shared-state environments. SQLite is secondary but ships in the same phase. Both are optional peer dependencies. Neither should block development or disrupt existing UX.

Requirements: USAGE-02 (SQLite + Redis persistence), DX-03 (observability hooks), DX-04 (dry-run mode).

</domain>

<decisions>
## Implementation Decisions

### Redis (Primary Focus)

- **Driver:** `ioredis` as optional peer dependency
- **Connection config:** Accept either a connection URL string (`redis://...`) or an ioredis options object. Both are industry standard. The user provides their own Redis — local Docker, cloud-hosted (Upstash, Redis Cloud, ElastiCache), or any Redis-compatible server. The package is agnostic to where Redis runs.
- **Key prefix:** All keys prefixed with `pennyllm:` to avoid collisions in shared Redis instances. Configurable prefix for multi-tenant scenarios.
- **Atomicity:** Use Redis INCRBY/HINCRBY for atomic counter increments. No Lua scripts needed for simple counter operations. Multi-process safe by design (Redis is the concurrency layer).
- **Expiration:** Use Redis TTL on keys matching time window durations. Redis handles expiration natively — no manual cleanup needed.
- **Connection failures:** Fail loudly with clear error. Never silently fall back to memory storage — that would give users false confidence their data persists.
- **Reconnection:** Rely on ioredis built-in reconnection strategy (exponential backoff). No custom retry logic.
- **Close:** Disconnect the ioredis client on `close()`.
- **Export path:** `RedisStorage` from `pennyllm/redis`
- **Environment agnostic:** This is a library — Redis hosting is the user's concern. Works with local Docker, cloud Redis (Upstash, AWS ElastiCache, Redis Cloud), or any Redis-protocol-compatible server. Serverless-friendly since ioredis handles connection pooling.

### SQLite (Secondary)

- **Driver:** `better-sqlite3` as optional peer dependency. No sql.js fallback — keeps it simple, avoids WASM complexity.
- **DB file location:** XDG data directory by default (`~/.local/share/pennyllm/usage.db` on Linux, `~/Library/Application Support/pennyllm/usage.db` on macOS). User can override with explicit path.
- **Data sharing:** Single shared DB across all projects by default. If two apps use the same Google key, both see the same quota usage — accurate free-tier tracking.
- **Schema:** Single key-value counter table with composite key (provider, keyIndex, windowType, periodKey). Columns: prompt_tokens, completion_tokens, call_count.
- **WAL mode:** Enabled for concurrent read performance.
- **Migrations:** Forward-only with schema_info table tracking version. Auto-migrate on open.
- **Auto-cleanup:** Delete expired rows on write operations (same lazy cleanup pattern as MemoryStorage).
- **Driver detection:** Silent. Log at debug level which driver was loaded. No stderr warnings.
- **Export path:** `SqliteStorage` from `pennyllm/sqlite`
- **Dependency is fully optional:** SQLite binary compilation issues in some environments must never block users who don't need it.

### Observability Hooks (DX-03)

- **The existing EventEmitter already covers all required scenarios:** key:selected, usage:recorded, limit:warning, limit:exceeded, fallback:triggered, budget:alert, budget:exceeded, error events, etc.
- **DX-03 is largely satisfied.** Phase 10 adds structured hook registration with typed callbacks — a thin convenience layer over EventEmitter, not a replacement.
- **Hook API:** `router.onKeySelected(cb)`, `router.onUsageRecorded(cb)`, etc. — typed wrappers that return unsubscribe functions. Avoids string-based event names.
- **No separate hook system.** EventEmitter remains the backbone. Typed helpers are sugar.
- **No breaking changes** to existing `router.on('event', cb)` pattern.

### Dry-Run Mode (DX-04)

- **Invocation:** `createRouter({ ..., dryRun: true })` config option.
- **Behavior:** Validates config, resolves policies, selects keys, logs routing decisions — but the middleware intercepts before the actual API call and returns a mock response.
- **Mock response:** Returns a structured object indicating what WOULD have happened: selected provider, key index, model, estimated cost. Not a real LLM response.
- **Use case:** Config validation, integration testing, CI pipelines where you want to verify routing logic without burning API calls.
- **Events still fire** in dry-run mode (key:selected, etc.) so users can test their event handlers.
- **No separate function.** Single config flag keeps it simple.

### Claude's Discretion

- Redis key schema design (hash vs string keys, field naming)
- SQLite table DDL and migration SQL
- Exact mock response shape for dry-run mode
- Typed hook helper implementation details
- Contract test adaptations for async Redis operations
- Error message wording for missing peer dependencies

</decisions>

<specifics>
## Specific Ideas

- "Make sure SQLite is not a blocker for dev, in any environment, keep its dependency optional"
- "Redis could be our main focus as it could work in serverless env as well"
- User gave full ownership: "Take care of it fully" — pragmatic decisions, no bloat, no disruption

</specifics>

<code_context>

## Existing Code Insights

### Reusable Assets

- `StorageBackend` interface (src/types/interfaces.ts): get, put, increment, getUsage, reset, resetAll, close — both adapters implement this exactly
- `MemoryStorage` (src/storage/MemoryStorage.ts): Reference implementation with composite key pattern, lazy cleanup, call count tracking
- `createStorageContractTests()` (tests/contracts/storage.contract.ts): 8 contract tests that SQLite and Redis must pass
- `getPeriodKey()` (src/usage/periods.ts): Calendar-aware period key generation — reuse for storage key construction
- `RouterEvent` constants (src/constants/index.ts): All event names already defined
- Event interfaces (src/types/events.ts): Typed payloads for all events
- `PennyLLMError` (src/errors/base.ts): Base error class for storage-specific errors
- Package exports (package.json): 8 subpath exports already configured — add `./sqlite` and `./redis`

### Established Patterns

- Optional peer deps with clear error on missing driver (@ai-sdk/google pattern)
- `debug` package for namespaced logging (pennyllm:storage, pennyllm:sqlite, pennyllm:redis)
- Async interface methods with `eslint-disable-next-line @typescript-eslint/require-await` for sync implementations
- `exactOptionalPropertyTypes` — conditional object construction required
- Fire-and-forget pattern for non-critical operations

### Integration Points

- `createRouter()` in src/index.ts — already accepts `storage?: StorageBackend`
- `package.json` exports — needs `./sqlite` and `./redis` subpath entries
- `tsup.config.ts` — needs new entry points for sqlite and redis bundles
- Contract tests — import `createStorageContractTests` and pass adapter factory

</code_context>

<deferred>
## Deferred Ideas

- Hybrid pattern (memory cache + external store sync, like LiteLLM's 0.01s Redis sync) — v2 optimization
- sql.js fallback for environments without native compilation — future if demand exists
- Platform-aware DB path with env var override chain (LLM_ROUTER_DB_PATH) — could add later if XDG defaults aren't sufficient
- Per-project namespace isolation for SQLite — future config option
- Redis Cluster support — v2 if needed
- Dry-run fallback preview (`router.previewFallback()`) — v2 DX enhancement

</deferred>

---

_Phase: 10-sqlite-redis-advanced-features_
_Context gathered: 2026-03-14_
