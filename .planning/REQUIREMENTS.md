# Requirements: PennyLLM

**Defined:** 2026-03-19
**Core Value:** Never get charged for LLM API calls — rotate through free tier keys intelligently

## v2.1 Requirements

Requirements for production hardening. Each maps to roadmap phases.

### Core Routing

- [ ] **ROUTE-01**: Key rotation uses distinct API keys per retry attempt (not silently reusing first key)
- [ ] **ROUTE-02**: All-circuits-open produces `AllProvidersExhaustedError` (not stack overflow from infinite recursion)
- [ ] **ROUTE-03**: Multiple router instances maintain independent state (no module-level singleton pollution)
- [ ] **ROUTE-04**: 402 credit exhaustion errors are not retried (respects `retryable: false`)
- [ ] **ROUTE-05**: `getNextKey` works for async-registered providers (uses async factory path)

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

| Requirement | Phase | Status  |
| ----------- | ----- | ------- |
| ROUTE-01    | TBD   | Pending |
| ROUTE-02    | TBD   | Pending |
| ROUTE-03    | TBD   | Pending |
| ROUTE-04    | TBD   | Pending |
| ROUTE-05    | TBD   | Pending |
| USAGE-01    | TBD   | Pending |
| USAGE-02    | TBD   | Pending |
| USAGE-03    | TBD   | Pending |
| USAGE-04    | TBD   | Pending |
| USAGE-05    | TBD   | Pending |
| USAGE-06    | TBD   | Pending |
| PROV-01     | TBD   | Pending |
| PROV-02     | TBD   | Pending |
| PROV-03     | TBD   | Pending |
| PROV-04     | TBD   | Pending |
| PROV-05     | TBD   | Pending |
| TYPE-01     | TBD   | Pending |
| TYPE-02     | TBD   | Pending |
| TYPE-03     | TBD   | Pending |
| TYPE-04     | TBD   | Pending |
| TYPE-05     | TBD   | Pending |
| BUILD-01    | TBD   | Pending |
| BUILD-02    | TBD   | Pending |
| BUILD-03    | TBD   | Pending |
| BUILD-04    | TBD   | Pending |

**Coverage:**

- v2.1 requirements: 25 total
- Mapped to phases: 0
- Unmapped: 25 (pending roadmap)

---

_Requirements defined: 2026-03-19_
_Last updated: 2026-03-19 after initial definition_
