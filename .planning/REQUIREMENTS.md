# Requirements: PennyLLM

**Defined:** 2026-03-19
**Core Value:** Never get charged for LLM API calls — rotate through free tier keys intelligently

## v2.1 Requirements

Requirements for production hardening. Each maps to roadmap phases.

### Core Routing

- [x] **ROUTE-01**: Key rotation uses distinct API keys per retry attempt (not silently reusing first key)
- [x] **ROUTE-02**: All-circuits-open produces `AllProvidersExhaustedError` (not stack overflow from infinite recursion)
- [x] **ROUTE-03**: Multiple router instances maintain independent state (no module-level singleton pollution)
- [x] **ROUTE-04**: 402 credit exhaustion errors are not retried (respects `retryable: false`)
- [x] **ROUTE-05**: `getNextKey` works for async-registered providers (uses async factory path)

### Usage & Tracking

- [x] **USAGE-01**: Rolling-30d `getUsage()` reports accurate data (not 30x inflated)
- [x] **USAGE-02**: Credit tracking survives month-boundary process restarts (fix CREDIT_WINDOW bucketing)
- [x] **USAGE-03**: PolicyEngine handles `limit.value === 0` without producing `Infinity`
- [x] **USAGE-04**: Cooldown backoff counter only increments when no Retry-After header provided
- [x] **USAGE-05**: Round-robin strategy distributes evenly when keys enter/exit cooldown
- [x] **USAGE-06**: Dedup set uses LRU-style eviction (not bulk clear losing all history)

### Provider Cleanup

- [x] **PROV-01**: `github-models.ts` deleted, export removed from `src/providers/index.ts`
- [x] **PROV-02**: 7 dropped provider config types removed from public exports
- [x] **PROV-03**: 7 legacy Provider enum values removed from `ProviderType` union
- [x] **PROV-04**: NVIDIA env var consistent (`NVIDIA_API_KEY`) across module and type docs
- [x] **PROV-05**: `ProviderRegistry.createDefault()` loads all 6 active providers (not just Google)

### Export & Type Hygiene

- [x] **TYPE-01**: `StructuredUsage` exported from `pennyllm` and `pennyllm/types`
- [x] **TYPE-02**: All event types (`ProviderRecoveredEvent`, credit events, error sub-events) exported from root
- [x] **TYPE-03**: Duplicate `StructuredUsage` definition consolidated to single source
- [x] **TYPE-04**: `SambaNovaProviderConfig` type alias added for consistency
- [x] **TYPE-05**: `onFallbackTriggered` hook either emits events or is removed from docs

### Build & Docs

- [x] **BUILD-01**: `tsc --noEmit` passes (fix rootDir import from test files)
- [x] **BUILD-02**: `router.close()` cleans up EventEmitter listeners and DebugLogger
- [x] **BUILD-03**: README dependency count corrected (5 deps, not 3)
- [x] **BUILD-04**: SQLite migrations wrapped in transactions for crash safety

### Async Model Wrapping (Gap Closure)

- [x] **WRAP-01**: `router.wrapModel()` resolves models via async provider registry (no ConfigError)
- [x] **WRAP-02**: `routerModel()` standalone function resolves models via async provider registry (no ConfigError)

## Out of Scope

| Feature                  | Reason                                          |
| ------------------------ | ----------------------------------------------- |
| New provider support     | Bug-fix milestone only                          |
| New features             | Hardening only — no new capabilities            |
| Comprehensive test suite | CLAUDE.md: tests deferred to separate phase     |
| Storage schema redesign  | Rolling-30d fix is minimal; full redesign is v3 |

## Traceability

| Requirement | Phase | Status   |
| ----------- | ----- | -------- |
| ROUTE-01    | 17    | Complete |
| ROUTE-02    | 17    | Complete |
| ROUTE-03    | 17    | Complete |
| ROUTE-04    | 17    | Complete |
| ROUTE-05    | 17    | Complete |
| USAGE-01    | 18    | Complete |
| USAGE-02    | 18    | Complete |
| USAGE-03    | 18    | Complete |
| USAGE-04    | 18    | Complete |
| USAGE-05    | 18    | Complete |
| USAGE-06    | 18    | Complete |
| PROV-01     | 19    | Complete |
| PROV-02     | 19    | Complete |
| PROV-03     | 19    | Complete |
| PROV-04     | 19    | Complete |
| PROV-05     | 19    | Complete |
| TYPE-01     | 20    | Complete |
| TYPE-02     | 20    | Complete |
| TYPE-03     | 20    | Complete |
| TYPE-04     | 20    | Complete |
| TYPE-05     | 20    | Complete |
| BUILD-01    | 21    | Complete |
| BUILD-02    | 21    | Complete |
| BUILD-03    | 21    | Complete |
| BUILD-04    | 21    | Complete |
| WRAP-01     | 22    | Complete |
| WRAP-02     | 22    | Complete |

**Coverage:**

- v2.1 requirements: 27 total
- Mapped to phases: 27
- Unmapped: 0

---

_Requirements defined: 2026-03-19_
_Last updated: 2026-03-19 after gap closure phase creation_
