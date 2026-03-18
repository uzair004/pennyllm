import { EventEmitter } from 'node:events';
import debugFactory from 'debug';
import type {
  CircuitState,
  RollingWindow,
  CircuitInfo,
  SkipResult,
  ProviderRecoveredEvent,
} from './types.js';
import { RouterEvent } from '../constants/index.js';

const debug = debugFactory('pennyllm:health');

const WINDOW_SIZE = 10;
const HEALTH_THRESHOLD = 30; // circuit trips below 30%
const COOLDOWN_SCHEDULE_MS = [30_000, 60_000, 120_000, 300_000, 900_000];

/**
 * HealthScorer tracks per-provider success rate in a rolling window
 * and manages circuit breaker state transitions with escalating cooldowns.
 *
 * Circuit breaker FSM: closed -> open -> half-open -> closed (on success)
 *                                                  -> open  (on failure, escalated)
 */
export class HealthScorer {
  private readonly emitter: EventEmitter;
  private readonly windows: Map<string, RollingWindow> = new Map();
  private readonly circuits: Map<string, CircuitInfo> = new Map();

  constructor(emitter: EventEmitter) {
    this.emitter = emitter;
  }

  // ── Private helpers ────────────────────────────────────────────────

  private getOrCreateWindow(provider: string): RollingWindow {
    let window = this.windows.get(provider);
    if (!window) {
      window = { buffer: new Array<boolean>(WINDOW_SIZE), index: 0, count: 0 };
      this.windows.set(provider, window);
    }
    return window;
  }

  private getOrCreateCircuit(provider: string): CircuitInfo {
    let circuit = this.circuits.get(provider);
    if (!circuit) {
      circuit = {
        state: 'closed',
        cooldownUntil: 0,
        escalationLevel: 0,
        openedAt: 0,
        probeInFlight: false,
      };
      this.circuits.set(provider, circuit);
    }
    return circuit;
  }

  private calculateSuccessRate(window: RollingWindow): number {
    if (window.count === 0) return 100;

    const relevantLength = Math.min(window.count, WINDOW_SIZE);
    let successes = 0;
    for (let i = 0; i < relevantLength; i++) {
      if (window.buffer[i]) successes++;
    }
    return (successes / relevantLength) * 100;
  }

  private getCooldownMs(escalationLevel: number): number {
    return COOLDOWN_SCHEDULE_MS[Math.min(escalationLevel, COOLDOWN_SCHEDULE_MS.length - 1)]!;
  }

  private openCircuit(provider: string, circuit: CircuitInfo): void {
    circuit.state = 'open';
    circuit.cooldownUntil = Date.now() + this.getCooldownMs(circuit.escalationLevel);
    if (circuit.openedAt === 0) {
      circuit.openedAt = Date.now();
    }
    circuit.probeInFlight = false;
    debug(
      '%s: circuit OPEN (health %d%%, threshold %d%%)',
      provider,
      this.getHealthScore(provider),
      HEALTH_THRESHOLD,
    );
  }

  private resetCircuit(provider: string, circuit: CircuitInfo): void {
    circuit.state = 'closed';
    circuit.escalationLevel = 0;
    circuit.cooldownUntil = 0;
    circuit.probeInFlight = false;

    // Reset rolling window to fresh state
    const freshWindow: RollingWindow = {
      buffer: new Array<boolean>(WINDOW_SIZE),
      index: 0,
      count: 0,
    };
    this.windows.set(provider, freshWindow);

    debug('%s: circuit CLOSED (recovered)', provider);
  }

  private recordOutcome(provider: string, success: boolean): void {
    const window = this.getOrCreateWindow(provider);
    window.buffer[window.index] = success;
    window.index = (window.index + 1) % WINDOW_SIZE;
    if (window.count < WINDOW_SIZE) {
      window.count++;
    }
  }

  private safeEmit(event: string, payload: unknown): void {
    try {
      this.emitter.emit(event, payload);
    } catch {
      // fire-and-forget
    }
  }

  // ── Public methods ─────────────────────────────────────────────────

  /**
   * Check if a provider should be skipped based on circuit breaker state.
   * Returns { skip: false } for closed circuits (healthy).
   * For open circuits, transitions to half-open when cooldown expires.
   */
  shouldSkip(provider: string): SkipResult {
    const circuit = this.getOrCreateCircuit(provider);

    if (circuit.state === 'closed') {
      return { skip: false };
    }

    if (circuit.state === 'open') {
      if (Date.now() >= circuit.cooldownUntil) {
        // Cooldown expired, transition to half-open for probe
        circuit.state = 'half-open';
        circuit.probeInFlight = true;
        debug('%s: circuit HALF-OPEN (cooldown expired, probing)', provider);
        return { skip: false };
      }
      return { skip: true, reason: 'circuit_open_cooldown' };
    }

    // half-open
    if (circuit.probeInFlight) {
      return { skip: true, reason: 'circuit_half_open_probe_in_flight' };
    }
    return { skip: true, reason: 'circuit_half_open' };
  }

  /**
   * Record a successful request for a provider.
   * If circuit is half-open, resets circuit and emits provider:recovered.
   */
  recordSuccess(provider: string): void {
    this.recordOutcome(provider, true);
    const circuit = this.getOrCreateCircuit(provider);

    if (circuit.state === 'half-open') {
      const payload: ProviderRecoveredEvent = {
        provider,
        downtimeMs: Date.now() - circuit.openedAt,
        previousState: 'half-open',
        recoveredAt: new Date().toISOString(),
        timestamp: Date.now(),
      };
      this.safeEmit(RouterEvent.PROVIDER_RECOVERED, payload);
      debug('%s: half-open probe SUCCESS, circuit CLOSED', provider);
      this.resetCircuit(provider, circuit);
    }
    // closed state: no-op beyond recording the outcome
  }

  /**
   * Record a failed request for a provider.
   * If circuit is half-open, escalates and re-opens.
   * If circuit is closed, checks if health dropped below threshold.
   */
  recordFailure(provider: string): void {
    this.recordOutcome(provider, false);
    const circuit = this.getOrCreateCircuit(provider);

    if (circuit.state === 'half-open') {
      circuit.escalationLevel++;
      debug(
        '%s: half-open probe FAILED, circuit OPEN (escalation %d)',
        provider,
        circuit.escalationLevel,
      );
      this.openCircuit(provider, circuit);
      return;
    }

    if (circuit.state === 'closed') {
      const successRate = this.calculateSuccessRate(this.getOrCreateWindow(provider));
      if (successRate < HEALTH_THRESHOLD) {
        debug('%s: health degraded to %d%%, circuit OPEN', provider, successRate);
        this.openCircuit(provider, circuit);
      }
    }
  }

  /**
   * Get the current health score for a provider (0-100).
   * Returns 100 for providers with no recorded outcomes (cold start).
   */
  getHealthScore(provider: string): number {
    const window = this.windows.get(provider);
    if (!window) return 100;
    return this.calculateSuccessRate(window);
  }

  /**
   * Get the current circuit breaker state for a provider.
   * Returns 'closed' for unknown providers (cold start).
   */
  getCircuitState(provider: string): CircuitState {
    const circuit = this.circuits.get(provider);
    if (!circuit) return 'closed';
    return circuit.state;
  }

  /**
   * Force the provider with the nearest cooldown expiry to half-open.
   * Used as "all circuits open" fallback -- picks the least-broken provider.
   * Returns the provider name, or null if none found.
   */
  forceNearestHalfOpen(providers: string[]): string | null {
    let nearest: string | null = null;
    let nearestCooldown = Infinity;

    for (const provider of providers) {
      const circuit = this.circuits.get(provider);
      if (
        circuit &&
        circuit.state === 'open' &&
        circuit.cooldownUntil > 0 &&
        circuit.cooldownUntil < nearestCooldown
      ) {
        nearest = provider;
        nearestCooldown = circuit.cooldownUntil;
      }
    }

    if (nearest) {
      const circuit = this.circuits.get(nearest)!;
      circuit.state = 'half-open';
      circuit.probeInFlight = true;
      debug('%s: forced to HALF-OPEN (all circuits open fallback)', nearest);
    }

    return nearest;
  }
}
