export type CircuitState = 'closed' | 'open' | 'half-open';

export interface RollingWindow {
  buffer: boolean[]; // true = success, false = failure
  index: number; // next write position (modulo WINDOW_SIZE)
  count: number; // total outcomes recorded (capped at WINDOW_SIZE)
}

export interface CircuitInfo {
  state: CircuitState;
  cooldownUntil: number; // Date.now() + cooldown ms
  escalationLevel: number; // index into COOLDOWN_SCHEDULE_MS
  openedAt: number; // Date.now() when circuit opened
  probeInFlight: boolean; // true when a half-open probe is in progress
}

export interface SkipResult {
  skip: boolean;
  reason?: string; // e.g. 'circuit_open', 'circuit_open_cooldown'
}

export interface ProviderRecoveredEvent {
  provider: string;
  downtimeMs: number;
  previousState: 'half-open';
  recoveredAt: string; // ISO string
  timestamp: number;
}
