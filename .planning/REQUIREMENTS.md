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

- [ ] **USAGE-01**: Rolling-30d `getUsage()` reports accurate data (not 30x inflated)
- [ ] **USAGE-02**: Credit tracking survives month-boundary process restarts (fix CREDIT_WINDOW bucketing)
- [ ] **USAGE-03**: PolicyEngine handles `limit.value === 0` without producing `Infinity`
- [ ] **USAGE-04**: Cooldown backoff counter only increments when no Retry-After header provided
- [ ] **USAGE-05**: Round-robin strategy distributes evenly when keys enter/exit cooldown
- [ ] **USAGE-06**: Dedup set uses LRU-style eviction (not bulk clear losing all history)

### Provider Cleanup

- [ ] **PROV-01**: `github-models.ts` deleted, export removed from `src/providers/index.ts`
- [ ] **PROV-02**: 7 dropped provider config types removed from public exports
- [ ] **PROV-03**: 7 legacy Provider enum values removed from `ProviderType` union
- [ ] **PROV-04**: NVIDIA env var consistent (`NVIDIA_API_KEY`) across module and type docs
- [ ] **PROV-05**: `ProviderRegistry.createDefault()` loads all 6 active providers (not just Google)

### Export & Type Hygiene

- [ ] **TYPE-01**: `StructuredUsage` exported from `pennyllm` and `pennyllm/types`
- [ ] **TYPE-02**: All event types (`ProviderRecoveredEvent`, credit events, error sub-events) exported from root
- [ ] **TYPE-03**: Duplicate `StructuredUsage` definition consolidated to single source
- [ ] **TYPE-04**: `SambaNovaProviderConfig` type alias added for consistency
- [ ] **TYPE-05**: `onFallbackTriggered` hook either emits events or is removed from docs

### Build & Docs

- [ ] **BUILD-01**: `tsc --noEmit` passes (fix rootDir import from test files)
- [ ] **BUILD-02**: `router.close()` cleans up EventEmitter listeners and DebugLogger
- [ ] **BUILD-03**: README dependency count corrected (5 deps, not 3)
- [ ] **BUILD-04**: SQLite migrations wrapped in transactions for crash safety

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
| USAGE-01    | 18    | Pending  |
| USAGE-02    | 18    | Pending  |
| USAGE-03    | 18    | Pending  |
| USAGE-04    | 18    | Pending  |
| USAGE-05    | 18    | Pending  |
| USAGE-06    | 18    | Pending  |
| PROV-01     | 19    | Pending  |
| PROV-02     | 19    | Pending  |
| PROV-03     | 19    | Pending  |
| PROV-04     | 19    | Pending  |
| PROV-05     | 19    | Pending  |
| TYPE-01     | 20    | Pending  |
| TYPE-02     | 20    | Pending  |
| TYPE-03     | 20    | Pending  |
| TYPE-04     | 20    | Pending  |
| TYPE-05     | 20    | Pending  |
| BUILD-01    | 21    | Pending  |
| BUILD-02    | 21    | Pending  |
| BUILD-03    | 21    | Pending  |
| BUILD-04    | 21    | Pending  |

**Coverage:**

- v2.1 requirements: 25 total
- Mapped to phases: 25
- Unmapped: 0

---

_Requirements defined: 2026-03-19_
_Last updated: 2026-03-19 after roadmap creation_
