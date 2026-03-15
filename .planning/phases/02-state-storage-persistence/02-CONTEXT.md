# Phase 2: State Storage & Persistence - Context

**Gathered:** 2026-03-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement the default in-memory storage backend and establish the StorageBackend contract. Memory is the built-in default (zero deps, works everywhere). Persistent storage adapters (SQLite, Redis) are deferred to Phase 10 as optional peer-dep installs.

This phase also updates the config schema to remove the storage Zod config (storage is now a runtime instance, not a JSON-serializable config value) and builds a shared contract test suite that any StorageBackend adapter must pass.

</domain>

<decisions>
## Implementation Decisions

### Storage Architecture (Major Pivot)

- **Memory is the default storage backend** — zero dependencies, works on every platform (local, Docker, serverless, CI)
- Industry pattern confirmed: LiteLLM, rate-limiter-flexible, express-rate-limit all default to in-memory for counters
- SQLite and Redis are deferred to Phase 10 as optional persistent adapters (peer dep install)
- Custom `StorageBackend` implementations accepted — user can plug in any database via the interface
- No built-in persistence in Phase 2 — persistence is an upgrade path, not the baseline

### Driver Installation Model

- Optional peer dependencies for all storage drivers — user installs only what they need
- Memory backend ships built-in (zero deps)
- SQLite adapter (Phase 10): `npm install better-sqlite3` or `npm install sql.js` — auto-detect which is installed, better-sqlite3 preferred, sql.js fallback. Config can force a specific driver.
- Redis adapter (Phase 10): `npm install ioredis`
- Clear error message if user configures a backend whose driver is not installed

### Memory Backend Behavior

- Uses JavaScript Map internally for counter storage
- Auto-evicts expired time windows (per-minute rows older than 1min, hourly older than 1hr, etc.) — no unbounded growth
- `close()` clears all data in the internal Map and marks backend as closed; subsequent calls throw
- **Always warns to stderr on initialization**: "Using in-memory storage — usage data will not persist across restarts. Use a storage adapter for persistence."

### Data Model (Applies to All Backends)

- Pre-aggregated counters — one entry per (provider, key, window_type, window_period)
- Running totals: `prompt_tokens`, `completion_tokens`, `call_count` per entry
- Atomic increment via single operation (trivial in memory, SQL UPDATE + N for SQLite, INCR for Redis)
- No raw event logging — counters only

### Config Schema Changes

- Remove `storage` section from Zod config schema entirely
- Storage backend is passed as a runtime `StorageBackend` instance to `createRouter()`
- When no storage instance provided, default to `MemoryStorage`
- Config shape: `createRouter({ providers: {...}, storage?: StorageBackend })`
- This means storage config is NOT JSON-serializable — it's a runtime object (file-based config users get memory default)

### StorageBackend Interface

- Keep existing interface unchanged: `get`, `put`, `increment`, `getUsage`, `reset`, `close`
- Export adapter classes directly — no factory pattern
- `MemoryStorage` exported from main package (`import { MemoryStorage } from 'pennyllm'`)
- Future: `SqliteStorage` from `pennyllm/sqlite`, `RedisStorage` from `pennyllm/redis` (Phase 10)

### Contract Testing

- Build a shared test suite that any `StorageBackend` implementation must pass
- Tests cover: increment atomicity, getUsage accuracy, multi-window support, reset behavior, close lifecycle, expired window cleanup
- Phase 10 runs the exact same contract tests against SQLite and Redis adapters

### Roadmap Update Required

- Phase 2 description needs updating: "Memory storage default, StorageBackend contract tests, config schema update" (was: "SQLite implementation, StorageBackend interface, migration system")
- Phase 10 description needs updating: "SQLite + Redis adapters, observability hooks, dry-run mode" (was: "Redis storage, observability hooks, dry-run mode")
- Phase 2 success criteria need rewriting to reflect memory-first approach
- Phase 10 inherits the SQLite-specific decisions: key-value counter table, auto-detect driver, WAL mode, schema_info table, auto-cleanup on write, forward-only migrations

### Claude's Discretion

- Internal Map key format for memory backend
- Exact expired window cleanup trigger (on every write, on read, or periodic)
- Concurrency handling in memory backend (Node.js is single-threaded but async gaps exist)
- Contract test organization and structure
- How to handle the StorageBackend type in createRouter() signature alongside Zod-validated config

</decisions>

<specifics>
## Specific Ideas

- "The installation of storage services during user installation needs to be defined — shipping unnecessary stuff is not useful"
- "SQLite brings in so much dependency and trouble for what could be a simple package"
- Industry research showed every comparable project (LiteLLM, rate-limiter-flexible, express-rate-limit) defaults to in-memory with optional external stores
- User explicitly wants stderr warning when memory backend is active (not just debug log)

</specifics>

<code_context>

## Existing Code Insights

### Reusable Assets

- `StorageBackend` interface (src/types/interfaces.ts): already defines get, put, increment, getUsage, reset, close — no changes needed
- `UsageRecord` type (src/types/domain.ts): id, provider, keyIndex, promptTokens, completionTokens, totalTokens, timestamp, window, estimated
- `TimeWindow` type (src/types/domain.ts): type ('per-minute' | 'hourly' | 'daily' | 'monthly' | 'rolling-30d'), durationMs
- `PennyLLMError` base class (src/errors/base.ts): for storage-specific errors
- `src/storage/index.ts`: currently just re-exports StorageBackend type — will house MemoryStorage

### Established Patterns

- Const objects with `as const` for enums (src/constants/index.ts)
- Zod validation with `.default()` for sensible defaults (src/config/schema.ts)
- Subpath exports for modular imports (package.json)
- `debug` package for component-based logging (pennyllm:storage namespace)

### Integration Points

- `configSchema` in src/config/schema.ts — needs `storage` section removed
- `storageConfigSchema` export — needs to be removed or deprecated
- `createRouter()` in src/index.ts — needs to accept optional StorageBackend parameter
- `src/storage/index.ts` — will export MemoryStorage class

</code_context>

<deferred>
## Deferred Ideas

- SQLite adapter with key-value counter table, auto-detect driver (better-sqlite3/sql.js), WAL mode, schema_info table, auto-cleanup, forward-only migrations — Phase 10
- Redis adapter — Phase 10
- Hybrid pattern (memory cache + external store sync, like LiteLLM's 0.01s Redis sync) — Phase 10 optimization
- Shared usage data across projects (single DB tracking all projects using same API keys) — Phase 10 with persistent adapters
- Platform-aware default DB path (XDG dirs, env var resolution chain) — Phase 10 with SQLite adapter

</deferred>

---

_Phase: 02-state-storage-persistence_
_Context gathered: 2026-03-12_
