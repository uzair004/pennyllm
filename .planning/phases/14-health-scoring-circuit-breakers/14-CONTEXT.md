# Phase 14: Health Scoring & Circuit Breakers - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Live health awareness before routing — per-provider health scores based on success rate, circuit breakers with three-state pattern (closed/open/half-open), escalating cooldowns on circuit open, and recovery detection via real user request probes. Health scores influence chain traversal as skip-only gates (no reordering). Always-on, zero config.

Requirements: extends CORE-03 (automatic selection), success criteria 1-5 from roadmap.

</domain>

<decisions>
## Implementation Decisions

### Health Score Composition

- **Metric: success rate only** — no latency or error type weighting. Simple, reliable signal. All errors count equally (429s, 5xx, timeouts, network errors)
- **Rolling window: last 10 requests** — circular buffer in memory. Fast reaction to degradation. Matches free-coding-models approach
- **Granularity: per-provider** — one health score per provider (e.g., 'google' at 85%). Matches existing per-provider cooldown tracking in CooldownManager
- **Persistence: in-memory only** — fresh scores each session. Health is a live signal; stale scores from hours ago are misleading. No storage overhead
- **Cold start: 100% (fully trusted)** — assume healthy until proven otherwise. Consistent with reactive philosophy
- **Observability: getStatus() only** — add healthScore (0-100) and circuitState to ChainEntryStatus. Debug logs via `debug('pennyllm:health')` for state transitions. No event emission for routine score changes
- **Architecture: standalone HealthScorer class** — new class parallel to CooldownManager and CreditTracker. Clean separation. Injected into ChainExecutor deps

### Circuit Breaker States

- **Three-state classic pattern**: closed (normal) -> open (skip provider) -> half-open (probe with one real request)
- **Trip condition: health score below 30%** — when success rate drops below 30% in the 10-request window, circuit opens. Single signal from health score
- **Fixed threshold, not configurable** — hardcoded at 30%. No config surface. Can be made configurable later if needed
- **Escalating cooldowns: 30s -> 1m -> 2m -> 5m -> 15m cap** — each re-open doubles. Reset to 30s after successful half-open probe
- **Half-open probe: real user request** — first actual request tests the provider. No synthetic probes. No wasted API calls
- **Single probe in half-open** — only one request goes through. Others skip and continue down chain. Simple boolean flag per provider
- **Circuit overrides cooldown** — if circuit is open, skip regardless of reactive cooldown state. Check order: stale -> depleted -> circuit -> cooldown -> credit -> budget

### Chain Ordering Influence

- **Skip-only, no reordering** — health scores do NOT reorder the chain. Circuit open = skip. User's priority order always respected. Chain is the user's intent; health is just a gate
- **Chain only (router.chat())** — circuit breaker applies to router.chat() chain traversal only. router.model() always attempts the specific model, even if circuit is open
- **Skipped entries visible in chain:resolved** — circuit-open skips appear in the attempts array with errorType 'circuit_open'. Full visibility for debugging
- **getStatus() includes healthScore + circuitState** — extend ChainEntryStatus with `healthScore: number` (0-100) and `circuitState: 'closed' | 'open' | 'half-open'`

### Recovery Detection

- **Health reset to 100% on successful probe** — full trust restored. Rolling window cleared. Provider proved it works
- **Full reset on recovery** — health score to 100%, circuit to closed, escalation counter to 0. Next failure starts fresh at 30s cooldown
- **`provider:recovered` event on successful probe only** — NOT on cooldown expiry. Proven recovery only
- **Event payload: provider + downtime duration** — `{ provider, downtimeMs, previousState, recoveredAt, timestamp }`

### Concurrency Handling

- **Every request outcome counts** — 5 concurrent failures = 5 entries in rolling window. Fast detection, simple implementation
- **Non-probe half-open requests skip** — skip and continue down chain. No queueing, no waiting
- **No locking** — rely on JavaScript's single-threaded event loop. Circular buffer modified synchronously. Same pattern as CooldownManager
- **In-flight requests complete** — circuit state change only affects future requests. Can't cleanly cancel in-flight HTTP
- **Record at chain executor level** — one outcome per chain entry attempt (after retry proxy exhaustion). Health reflects provider-level availability

### Permanent Cooldown Relationship

- **Ignore depleted providers** — permanently depleted (402/credit exhaustion) handled by CooldownManager.isProviderDepleted(). HealthScorer skips them entirely
- **Independent timers** — reactive cooldowns (CooldownManager) and circuit breaker cooldowns (HealthScorer) are independent. No coupling. Circuit check happens first per check order

### Edge Cases

- **All circuits open: try closest to half-open** — pick provider whose cooldown expires soonest, force it to half-open. If that fails too, throw AllProvidersExhaustedError
- **Single-provider chain: circuit still applies** — fail fast with clear error rather than hammering a broken provider. 'All open' fallback handles gracefully
- **AllProvidersExhaustedError enriched** — include per-provider circuit state and estimated recovery time when circuits are the reason

### Config Surface

- **Always-on, zero config** — no toggle, no tuning knobs. Sensible hardcoded defaults. Zero config surface increase
- **Not exposed via public API** — only via getStatus(). HealthScorer class not exported. Internal only

### Debug Logging

- **State transitions only** — log circuit state changes, probe outcomes, recovery events. NOT every score update. Namespace: `debug('pennyllm:health')`
- Example: `'google: circuit OPEN (health 20%, threshold 30%)'`, `'google: half-open probe SUCCESS, circuit CLOSED'`

### Claude's Discretion

- Exact HealthScorer class internals (circular buffer implementation, method signatures)
- How HealthScorer integrates with ChainExecutor executeChain() loop
- Exact circuit state machine implementation (enum vs union type)
- How the "try closest to half-open" all-open fallback finds the right provider
- Whether to use a separate debug namespace (`pennyllm:health`) or piggyback on `pennyllm:chain`
- How provider:recovered event is wired (via HealthScorer emitter or ChainExecutor emitter)
- AllProvidersExhaustedError extension approach (new fields vs subclass)

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 12 context (chain architecture)

- `.planning/phases/12-provider-overhaul-validation/12-CONTEXT.md` -- Chain executor design, reactive cooldown design, provider tier system, chain immutability decision, per-provider escalating backoff, check order before API calls

### Phase 13 context (credit tracking pattern)

- `.planning/phases/13-credit-based-limits/13-CONTEXT.md` -- CreditTracker as parallel class pattern, ChainExecutor integration point, getStatus() extension pattern

### Existing code (integration points)

- `src/chain/ChainExecutor.ts` -- Core chain walking loop where circuit breaker check integrates (line 151-332). executeChain() function, getChainStatus() function
- `src/chain/types.ts` -- ChainEntry, ChainEntryStatus, ChainStatus types to extend with health/circuit fields
- `src/usage/cooldown.ts` -- CooldownManager class. HealthScorer is parallel to this. Reference for escalating backoff pattern, provider-level tracking, persistence patterns
- `src/types/events.ts` -- RouterEventMap for adding provider:recovered event type
- `src/constants/index.ts` -- RouterEvent constants for PROVIDER_RECOVERED
- `src/credit/CreditTracker.ts` -- Parallel class template for HealthScorer (standalone class injected into ChainExecutor deps)
- `src/errors/all-providers-exhausted-error.ts` -- Error class to extend with circuit breaker details

### Design reference

- free-coding-models P2C algorithm (`src/account-manager.js` in github.com/vava-nessa/free-coding-models) -- health-based selection inspiration

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `CooldownManager` (src/usage/cooldown.ts): Reference for escalating backoff (2x multiplier, MAX_COOLDOWN_MS), provider-level tracking, storage persistence, onProviderSuccess() reset pattern. HealthScorer follows same structural patterns but uses in-memory circular buffer instead of storage
- `CreditTracker` (src/credit/CreditTracker.ts): Template for standalone class injected into ChainExecutor deps. Same integration pattern: added to ChainExecutorDeps interface, checked in executeChain() loop, extended in getChainStatus()
- `ChainExecutor.executeChain()` (src/chain/ChainExecutor.ts line 151-332): Integration point. Current check order: stale -> providerCooldown -> creditTracker -> budget -> attempt. Circuit breaker check inserts between stale/depleted and providerCooldown
- `getChainStatus()` (src/chain/ChainExecutor.ts line 452-502): Extend ChainEntryStatus with healthScore and circuitState fields. Same pattern as creditStatus extension
- `RouterEvent` constants (src/constants/index.ts): Add PROVIDER_RECOVERED constant
- `RouterEventMap` (src/types/events.ts): Add provider:recovered event type

### Established Patterns

- Standalone class per concern: BudgetTracker, CreditTracker, CooldownManager — HealthScorer follows same pattern
- Fire-and-forget for non-critical ops (events, usage recording)
- ChainExecutorDeps interface for dependency injection — add `healthScorer?: HealthScorer`
- `safeEmit()` helper for event emission (line 88-94 in ChainExecutor.ts)
- `debug()` with component namespaces (`pennyllm:chain`, `pennyllm:credit`)
- Conditional property inclusion for `exactOptionalPropertyTypes`

### Integration Points

- `ChainExecutorDeps` (src/chain/ChainExecutor.ts line 31-45): Add `healthScorer?: HealthScorer`
- `executeChain()` loop (line 151-332): Add circuit check after stale/depleted, record outcomes after success/failure
- `getChainStatus()` (line 452-502): Add healthScore and circuitState to ChainEntryStatus
- `createRouter()` (src/config/index.ts): Initialize HealthScorer, pass to ChainExecutor deps
- `src/constants/index.ts`: Add PROVIDER_RECOVERED event constant
- `src/types/events.ts`: Add ProviderRecoveredEvent type and RouterEventMap entry
- `src/errors/all-providers-exhausted-error.ts`: Extend with circuit state details

</code_context>

<specifics>
## Specific Ideas

- Free-coding-models P2C (Power-of-2-Choices) algorithm referenced in roadmap as design inspiration — user opted for simpler skip-only approach rather than P2C randomized selection
- CooldownManager's existing escalating backoff pattern (2x multiplier, 15min cap) served as reference for circuit breaker cooldown schedule, though different values chosen (30s start vs 60s)
- "All circuits open" edge case resolved with "try closest to half-open" rather than immediate failure — more resilient for single-provider chains

</specifics>

<deferred>
## Deferred Ideas

- **Latency-based health scoring** — Track response time alongside success rate. Free tier latency too variable now, but paid tier routing could benefit
- **P2C (Power-of-2-Choices) selection** — Randomized health-aware selection from roadmap reference. Skip-only chosen for simplicity. Could add as alternative strategy later
- **Configurable health thresholds** — Per-provider or global threshold tuning. Fixed at 30% for now. Add config if users request it
- **Health score persistence** — Persist health window across restarts for long-running servers. In-memory chosen for freshness
- **Per-model health tracking** — Separate health per model ID instead of per provider. Would catch model-specific flakiness
- **Synthetic probes** — Lightweight test calls to check provider health without using real user requests. Saves user requests but wastes rate-limited free tier calls

</deferred>

---

_Phase: 14-health-scoring-circuit-breakers_
_Context gathered: 2026-03-18_
