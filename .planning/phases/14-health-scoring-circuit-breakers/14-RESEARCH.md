# Phase 14: Health Scoring & Circuit Breakers - Research

**Researched:** 2026-03-18
**Domain:** Circuit breaker pattern, health scoring, reactive fault tolerance
**Confidence:** HIGH

## Summary

Phase 14 adds live health awareness to PennyLLM's chain routing. The core implementation involves two new concerns: (1) a per-provider health score based on a rolling success rate window, and (2) a three-state circuit breaker (closed/open/half-open) with escalating cooldown timers. These integrate into the existing `executeChain()` loop as skip-only gates -- they never reorder the user's chain.

The implementation follows established project patterns exactly. `HealthScorer` is a standalone class parallel to `CooldownManager` and `CreditTracker`, injected into `ChainExecutorDeps`. The project already has three prior examples of this pattern, making architectural decisions straightforward. No external libraries are needed -- circuit breakers and circular buffers are simple enough to implement directly, especially since JavaScript's single-threaded event loop eliminates concurrency concerns.

**Primary recommendation:** Implement HealthScorer as a single class owning both the rolling window (circular buffer) and circuit breaker state machine. Integrate at two points in ChainExecutor: (1) skip check before attempt, (2) outcome recording after success/failure.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Health score: success rate only** -- no latency or error type weighting. Rolling window of last 10 requests per provider. In-memory only. Cold start at 100%
- **Circuit breaker: three-state classic** -- closed -> open -> half-open. Trip at health score below 30%. Fixed threshold, not configurable
- **Escalating cooldowns: 30s -> 1m -> 2m -> 5m -> 15m cap** -- each re-open doubles. Reset to 30s after successful probe
- **Skip-only, no reordering** -- health scores do NOT reorder chain. Circuit open = skip. User priority always respected
- **Chain only (router.chat())** -- circuit breaker applies to chain traversal only. router.model() always attempts, even if circuit is open
- **Half-open probe: real user request** -- first actual request tests the provider. Single probe, others skip. No synthetic probes
- **Recovery: full reset** -- health to 100%, circuit to closed, escalation to 0 on successful probe
- **`provider:recovered` event on successful probe only** -- payload: `{ provider, downtimeMs, previousState, recoveredAt, timestamp }`
- **Circuit overrides cooldown** -- check order: stale -> depleted -> circuit -> cooldown -> credit -> budget
- **All circuits open: try closest to half-open** -- force soonest-expiring provider to half-open. If that fails too, throw AllProvidersExhaustedError
- **Always-on, zero config** -- no toggle, no tuning knobs. HealthScorer class not exported
- **Debug logging: state transitions only** -- namespace `pennyllm:health`
- **Independent timers** -- reactive cooldowns (CooldownManager) and circuit breaker cooldowns (HealthScorer) are independent
- **Every request outcome counts** -- concurrent requests all recorded. Non-probe half-open requests skip
- **No locking** -- rely on JavaScript single-threaded event loop
- **Record at chain executor level** -- one outcome per chain entry attempt (after retry proxy exhaustion)
- **getStatus() includes healthScore + circuitState** -- extend ChainEntryStatus

### Claude's Discretion

- Exact HealthScorer class internals (circular buffer implementation, method signatures)
- How HealthScorer integrates with ChainExecutor executeChain() loop
- Exact circuit state machine implementation (enum vs union type)
- How the "try closest to half-open" all-open fallback finds the right provider
- Whether to use a separate debug namespace (`pennyllm:health`) or piggyback on `pennyllm:chain`
- How provider:recovered event is wired (via HealthScorer emitter or ChainExecutor emitter)
- AllProvidersExhaustedError extension approach (new fields vs subclass)

### Deferred Ideas (OUT OF SCOPE)

- Latency-based health scoring
- P2C (Power-of-2-Choices) selection
- Configurable health thresholds
- Health score persistence
- Per-model health tracking
- Synthetic probes

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID            | Description                                                             | Research Support                                                                  |
| ------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| CORE-03 (ext) | Automatic selection with health awareness                               | HealthScorer skip-only gates in executeChain() loop; circuit state in getStatus() |
| SC-1          | Per-provider health score (success rate, latency, availability)         | Rolling 10-request circular buffer per provider; success rate only per CONTEXT.md |
| SC-2          | Circuit breaker: open after N consecutive failures, half-open probe     | Three-state machine; trip at <30% health in window; real user request probes      |
| SC-3          | Escalating cooldowns (15m -> 30m -> 60m, capped)                        | CONTEXT.md revised: 30s -> 1m -> 2m -> 5m -> 15m cap; 2x multiplier per re-open   |
| SC-4          | `provider:recovered` event when provider becomes available              | Event on successful half-open probe only; payload includes downtime duration      |
| SC-5          | Health scores influence model chain ordering (skip unhealthy providers) | Skip-only (no reorder); circuit open = skip entry in chain walk                   |

</phase_requirements>

## Standard Stack

### Core

| Library | Version  | Purpose                       | Why Standard                                                               |
| ------- | -------- | ----------------------------- | -------------------------------------------------------------------------- |
| (none)  | --       | Circuit breaker is pure logic | No external deps needed; JS single-threaded event loop handles concurrency |
| debug   | existing | Debug logging                 | Already used throughout project (`pennyllm:*` namespace)                   |

### Supporting

| Library     | Version  | Purpose                               | When to Use                            |
| ----------- | -------- | ------------------------------------- | -------------------------------------- |
| node:events | built-in | EventEmitter for `provider:recovered` | Already injected via ChainExecutorDeps |

### Alternatives Considered

| Instead of             | Could Use                  | Tradeoff                                                                                                                                                              |
| ---------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Custom circuit breaker | opossum, cockatiel         | Overkill for this use case; our requirements are simpler than generic circuit breaker libs (no async semaphores, no bulkheading). Custom implementation is ~100 lines |
| Custom circular buffer | Array with modulo indexing | Array with modulo is the standard approach; no library needed                                                                                                         |

**Installation:**

```bash
# No new dependencies needed
```

## Architecture Patterns

### Recommended Project Structure

```
src/
├── health/
│   ├── HealthScorer.ts      # Main class: circular buffer + circuit breaker state machine
│   └── types.ts              # CircuitState, HealthStatus, ProviderRecoveredEvent types
├── chain/
│   ├── ChainExecutor.ts      # Modified: add circuit check + outcome recording
│   └── types.ts              # Extended: healthScore + circuitState on ChainEntryStatus
├── types/
│   └── events.ts             # Extended: ProviderRecoveredEvent + RouterEventMap entry
├── constants/
│   └── index.ts              # Extended: PROVIDER_RECOVERED constant
└── config/
    └── index.ts              # Modified: instantiate HealthScorer, pass to deps, add hook
```

### Pattern 1: Standalone Class per Concern (Established)

**What:** Each cross-cutting concern gets its own class, injected into ChainExecutorDeps.
**When to use:** Always -- this is the established project pattern.
**Example (from existing CreditTracker):**

```typescript
// src/health/HealthScorer.ts
export class HealthScorer {
  // Per-provider rolling window (circular buffer)
  private readonly windows: Map<string, { buffer: boolean[]; index: number; size: number }>;
  // Per-provider circuit state
  private readonly circuits: Map<
    string,
    {
      state: 'closed' | 'open' | 'half-open';
      cooldownUntil: number;
      escalationLevel: number;
      openedAt: number;
      probeInFlight: boolean;
    }
  >;
  private readonly emitter: EventEmitter;

  constructor(emitter: EventEmitter) {
    /* ... */
  }

  // Called by ChainExecutor before attempting a chain entry
  shouldSkip(provider: string): boolean {
    /* ... */
  }

  // Called by ChainExecutor after success/failure
  recordSuccess(provider: string): void {
    /* ... */
  }
  recordFailure(provider: string): void {
    /* ... */
  }

  // For getStatus()
  getHealthScore(provider: string): number {
    /* ... */
  }
  getCircuitState(provider: string): 'closed' | 'open' | 'half-open' {
    /* ... */
  }
}
```

### Pattern 2: Circular Buffer for Rolling Window

**What:** Fixed-size array with modulo-wrapped write index. No shifting, no splicing, O(1) per operation.
**When to use:** For the 10-request rolling health window.
**Example:**

```typescript
// Circular buffer implementation inside HealthScorer
interface RollingWindow {
  buffer: boolean[]; // true = success, false = failure
  index: number; // next write position
  count: number; // total outcomes recorded (capped at WINDOW_SIZE)
}

const WINDOW_SIZE = 10;

function createWindow(): RollingWindow {
  return { buffer: new Array<boolean>(WINDOW_SIZE).fill(true), index: 0, count: 0 };
}

function recordOutcome(window: RollingWindow, success: boolean): void {
  window.buffer[window.index % WINDOW_SIZE] = success;
  window.index = (window.index + 1) % WINDOW_SIZE;
  if (window.count < WINDOW_SIZE) window.count++;
}

function getSuccessRate(window: RollingWindow): number {
  if (window.count === 0) return 100;
  const slice = window.count < WINDOW_SIZE ? window.buffer.slice(0, window.count) : window.buffer;
  const successes = slice.filter(Boolean).length;
  return (successes / slice.length) * 100;
}
```

### Pattern 3: Three-State Circuit Breaker FSM

**What:** Finite state machine: closed -> open -> half-open -> closed (on success) or open (on failure).
**When to use:** The core circuit breaker logic.
**State transitions:**

```
CLOSED --[health < 30%]--> OPEN
OPEN --[cooldown expires]--> HALF_OPEN
HALF_OPEN --[probe succeeds]--> CLOSED (full reset, emit provider:recovered)
HALF_OPEN --[probe fails]--> OPEN (escalate cooldown)
```

### Pattern 4: Escalating Cooldown Schedule

**What:** Doubling cooldown on each re-open, capped at 15 minutes.
**Schedule:** 30s -> 60s -> 120s -> 300s -> 900s (cap)
**Implementation:**

```typescript
const COOLDOWN_SCHEDULE_MS = [30_000, 60_000, 120_000, 300_000, 900_000];

function getCooldownMs(escalationLevel: number): number {
  return COOLDOWN_SCHEDULE_MS[Math.min(escalationLevel, COOLDOWN_SCHEDULE_MS.length - 1)]!;
}
```

### Pattern 5: Check Order in executeChain()

**What:** The order of skip checks before attempting an API call.
**Current order:** stale -> providerCooldown -> creditTracker -> budget
**New order:** stale -> depleted -> **circuitBreaker** -> providerCooldown -> creditTracker -> budget

The circuit check goes after depleted (permanently gone providers should be caught first) but before reactive cooldown (circuit is a higher-level gate based on observed health, not a single 429).

### Anti-Patterns to Avoid

- **Reordering the chain based on health:** User's priority order is their intent. Health is a gate (skip/allow), never a reorder signal
- **Synthetic probes:** Wasting free-tier API calls on health checks. Use real user requests as probes
- **Persisting health state:** Health is a live signal. Stale scores from hours ago are misleading
- **Coupling circuit breaker to CooldownManager:** They are independent mechanisms with independent timers
- **Blocking on half-open:** Only one probe per provider. Other requests skip and continue down chain

## Don't Hand-Roll

| Problem                                                       | Don't Build | Use Instead | Why                                                                                                                   |
| ------------------------------------------------------------- | ----------- | ----------- | --------------------------------------------------------------------------------------------------------------------- |
| N/A -- all components are simple enough to implement directly | --          | --          | Circuit breakers in this context are ~100 lines of pure synchronous logic. No async, no concurrency primitives needed |

**Key insight:** The circuit breaker pattern is well-understood and our requirements are narrow (single-threaded, in-memory, provider-level granularity). External libraries like `opossum` or `cockatiel` add unnecessary abstraction for wrapping individual function calls, which is not our use case. We're gating chain traversal, not wrapping callables.

## Common Pitfalls

### Pitfall 1: Cold Start Window Behavior

**What goes wrong:** The 10-slot buffer is pre-filled with `true` (success), meaning 3 failures out of the first 3 requests give health = 70% (7/10), not 0%. Circuit never trips on a brand-new provider that immediately fails.
**Why it happens:** Pre-filling with successes assumes the provider is healthy.
**How to avoid:** Use `count` to track actual outcomes recorded. Calculate success rate as `successes / count` when `count < WINDOW_SIZE`, not `successes / WINDOW_SIZE`. This means 3 failures out of 3 total = 0% health = circuit trips immediately.
**Warning signs:** Provider fails 3 times but circuit stays closed.

### Pitfall 2: Half-Open Probe Race Condition

**What goes wrong:** Two concurrent requests both see `state === 'half-open'` and both attempt to probe simultaneously.
**Why it happens:** The `shouldSkip()` check and the `probeInFlight` flag update are not atomic... but they are in JavaScript because of the synchronous event loop.
**How to avoid:** Set `probeInFlight = true` synchronously in `shouldSkip()` when allowing the probe request through. All subsequent synchronous checks will see the flag. The flag is reset after the outcome is recorded.
**Warning signs:** Multiple probe requests going through in half-open state.

### Pitfall 3: Forgetting to Record Outcomes for Skipped Entries

**What goes wrong:** If a chain entry is skipped due to circuit breaker, someone might try to record a failure for it, skewing the health window.
**Why it happens:** Confusion about when to call `recordSuccess`/`recordFailure`.
**How to avoid:** Only record outcomes for entries that were actually attempted (the `callFn` was invoked). Skipped entries produce no outcome recording.
**Warning signs:** Health score drops for a provider that was being skipped.

### Pitfall 4: Circuit Breaker Cooldown vs CooldownManager Cooldown Confusion

**What goes wrong:** Circuit opens with a 30s cooldown, but CooldownManager also has a cooldown set. When circuit cooldown expires and transitions to half-open, CooldownManager still blocks the provider.
**Why it happens:** Both systems independently track provider availability.
**How to avoid:** Check order matters: circuit check runs first. If circuit says "skip" (open, cooldown not expired), provider is skipped regardless of CooldownManager state. If circuit says "allow" (closed, or half-open probe), CooldownManager is checked next. The two are independent -- CooldownManager may clear before circuit, or vice versa.
**Warning signs:** Provider stuck in cooldown even after circuit transitions to half-open.

### Pitfall 5: exactOptionalPropertyTypes with New Fields

**What goes wrong:** Adding `healthScore?: number` and `circuitState?: 'closed' | 'open' | 'half-open'` to ChainEntryStatus causes TS errors when assigning `undefined`.
**Why it happens:** Project uses `exactOptionalPropertyTypes: true` which prohibits `obj.field = undefined` for optional fields.
**How to avoid:** Use conditional property inclusion: `if (healthScore !== undefined) entryStatus.healthScore = healthScore;`. This is the established pattern used for `cooldownUntil`, `cooldownClass`, and `creditStatus` in the existing `getChainStatus()`.
**Warning signs:** TypeScript error TS2412 on assignment.

### Pitfall 6: All-Circuits-Open Fallback Logic

**What goes wrong:** When all providers have open circuits, the "try closest to half-open" logic fails if no provider has a cooldown timer (e.g., all were depleted permanently).
**Why it happens:** Depleted providers have `Infinity` cooldown.
**How to avoid:** The "all circuits open" fallback should only consider providers with finite cooldown timers. Permanently depleted providers (via CooldownManager) are excluded. If NO provider has a finite circuit cooldown, throw AllProvidersExhaustedError immediately.
**Warning signs:** Infinite loop or NaN comparison when finding soonest expiry.

## Code Examples

### HealthScorer shouldSkip() Integration

```typescript
// In executeChain(), between stale/depleted check and cooldown check:

// Check provider depletion (permanent -- before circuit)
if (deps.cooldownManager.isProviderDepleted(entry.provider)) {
  debug('Skipping provider %s (depleted) at position %d', entry.provider, position);
  continue;
}

// Check circuit breaker
if (deps.healthScorer) {
  const skipResult = deps.healthScorer.shouldSkip(entry.provider);
  if (skipResult.skip) {
    debug('Skipping provider %s (circuit %s) at position %d',
      entry.provider, skipResult.reason, position);
    attempts.push({
      provider: entry.provider,
      modelId: entry.modelId,
      chainPosition: position,
      errorType: 'circuit_open',
      message: `Circuit breaker: ${skipResult.reason}`,
    });
    continue;
  }
}

// Existing: check reactive cooldown
if (deps.cooldownManager.isProviderInCooldown(entry.provider)) { ... }
```

### Recording Outcomes After Chain Entry Attempt

```typescript
// After successful call:
deps.cooldownManager.onProviderSuccess(entry.provider);
if (deps.healthScorer) {
  deps.healthScorer.recordSuccess(entry.provider);
}

// After failed call (in catch block):
if (deps.healthScorer) {
  deps.healthScorer.recordFailure(entry.provider);
}
```

### getChainStatus Extension

```typescript
// In getChainStatus(), extend ChainEntryStatus:
if (healthScorer) {
  const score = healthScorer.getHealthScore(entry.provider);
  if (score !== undefined) {
    entryStatus.healthScore = score;
  }
  const circuitState = healthScorer.getCircuitState(entry.provider);
  if (circuitState !== undefined) {
    entryStatus.circuitState = circuitState;
  }
}
```

### provider:recovered Event Wiring

```typescript
// Inside HealthScorer.recordSuccess(), when transitioning from half-open to closed:
if (circuit.state === 'half-open') {
  const downtimeMs = Date.now() - circuit.openedAt;
  this.emitter.emit(RouterEvent.PROVIDER_RECOVERED, {
    provider,
    downtimeMs,
    previousState: 'half-open',
    recoveredAt: new Date().toISOString(),
    timestamp: Date.now(),
  });
}
```

### AllProvidersExhaustedError Circuit Extension

```typescript
// Extend ProviderAttempt reason union:
export interface ProviderAttempt {
  reason:
    | 'quota_exhausted'
    | 'rate_limited'
    | 'server_error'
    | 'budget_exceeded'
    | 'no_match'
    | 'auth_failed'
    | 'circuit_open';
  circuitState?: 'open' | 'half-open';
  estimatedRecoveryMs?: number;
}
```

## State of the Art

| Old Approach                      | Current Approach                          | When Changed | Impact                                          |
| --------------------------------- | ----------------------------------------- | ------------ | ----------------------------------------------- |
| No health awareness               | Phase 14 adds health scoring              | This phase   | Chain walking becomes health-aware              |
| Reactive-only cooldown            | Cooldown + circuit breaker (dual system)  | This phase   | Faster degradation detection via rolling window |
| cooldown.onProviderSuccess() only | Also health window reset + recovery event | This phase   | Proven recovery signal for observability        |

**No deprecated/outdated patterns** -- this is greenfield implementation within the existing architecture.

## Open Questions

1. **Should `shouldSkip()` return a structured result or just boolean?**
   - What we know: The circuit breaker skip needs to populate `ChainAttempt` with errorType `'circuit_open'` and a message
   - Recommendation: Return `{ skip: boolean; reason?: string }` so executeChain() can build the attempt record. This avoids a second call to get the state.

2. **Where should the "all circuits open" fallback live?**
   - What we know: It needs to scan all circuit states and force the soonest-expiring to half-open
   - Recommendation: Implement as a method on HealthScorer (`forceNearestHalfOpen(): string | null`) called by executeChain() just before throwing AllProvidersExhaustedError.

3. **Should HealthScorer ignore depleted providers entirely?**
   - What we know: CONTEXT.md says "ignore depleted providers". CooldownManager.isProviderDepleted() handles permanent depletion.
   - Recommendation: HealthScorer.recordSuccess/recordFailure should no-op for depleted providers. Don't maintain health windows for providers that can never recover within the session.

## Validation Architecture

### Test Framework

| Property           | Value                                        |
| ------------------ | -------------------------------------------- |
| Framework          | vitest 2.1.8                                 |
| Config file        | vitest.config.\* (implicit via package.json) |
| Quick run command  | `npx vitest run --reporter=verbose`          |
| Full suite command | `npx vitest run`                             |

### Phase Requirements -> Test Map

| Req ID | Behavior                                                     | Test Type   | Automated Command                                                     | File Exists? |
| ------ | ------------------------------------------------------------ | ----------- | --------------------------------------------------------------------- | ------------ |
| SC-1   | Health score tracks success rate in rolling window           | unit        | `npx vitest run src/health/HealthScorer.test.ts -t "health score" -x` | No -- Wave 0 |
| SC-2   | Circuit breaker transitions: closed->open->half-open->closed | unit        | `npx vitest run src/health/HealthScorer.test.ts -t "circuit" -x`      | No -- Wave 0 |
| SC-3   | Escalating cooldowns: 30s->1m->2m->5m->15m                   | unit        | `npx vitest run src/health/HealthScorer.test.ts -t "cooldown" -x`     | No -- Wave 0 |
| SC-4   | provider:recovered event on successful probe                 | unit        | `npx vitest run src/health/HealthScorer.test.ts -t "recovered" -x`    | No -- Wave 0 |
| SC-5   | Circuit open causes chain entry skip                         | integration | `npx vitest run src/chain/ChainExecutor.test.ts -t "circuit" -x`      | No -- Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

Note: Per project CLAUDE.md, testing is "build first, test later" -- tests are minimal during implementation. Wave 0 gaps listed for completeness but test creation is NOT required during this phase unless the plan explicitly calls for it.

- [ ] `src/health/HealthScorer.test.ts` -- covers SC-1 through SC-4
- [ ] `src/chain/ChainExecutor.test.ts` circuit breaker tests -- covers SC-5

## Sources

### Primary (HIGH confidence)

- **Codebase inspection** -- ChainExecutor.ts (503 lines), CooldownManager (349 lines), CreditTracker (355 lines), chain/types.ts (83 lines), events.ts (288 lines), constants/index.ts (112 lines), AllProvidersExhaustedError (58 lines), createRouter (538 lines)
- **14-CONTEXT.md** -- All implementation decisions locked by user

### Secondary (MEDIUM confidence)

- Circuit breaker pattern: Microsoft Azure architecture guidance, Martin Fowler's circuit breaker article -- well-established pattern with three-state FSM. Our implementation is a simplified subset (no async semaphores, no bulkheading)

### Tertiary (LOW confidence)

- None. All findings are based on direct codebase inspection and established patterns.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH -- no new dependencies, pure TypeScript logic
- Architecture: HIGH -- follows established CooldownManager/CreditTracker parallel class pattern exactly
- Pitfalls: HIGH -- identified from direct code inspection of existing integration points and TypeScript strictness settings
- Integration: HIGH -- all integration points identified from codebase, check order specified in CONTEXT.md

**Research date:** 2026-03-18
**Valid until:** 2026-04-18 (stable -- no external dependency changes)
