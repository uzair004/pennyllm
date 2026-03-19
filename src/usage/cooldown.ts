import type { CooldownClass } from '../wrapper/error-classifier.js';
import type { StorageBackend } from '../types/interfaces.js';

const MAX_COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes (user decision)

/**
 * Manages rate limit cooldowns for API keys after 429 responses.
 * Includes exponential backoff for consecutive failures.
 * Supports provider-level cooldowns (all keys exhausted) with storage persistence.
 */
export class CooldownManager {
  private cooldowns: Map<string, { until: number; reason: string }>;
  private consecutiveFailures: Map<string, number>;
  private providerCooldowns: Map<
    string,
    { until: number; reason: string; cooldownClass: CooldownClass }
  >;
  private providerFailures: Map<string, number>;
  private storage: StorageBackend | undefined;

  constructor(storage?: StorageBackend) {
    this.cooldowns = new Map();
    this.consecutiveFailures = new Map();
    this.providerCooldowns = new Map();
    this.providerFailures = new Map();
    this.storage = storage;
  }

  // ── Per-key cooldown methods (existing) ───────────────────────────

  /**
   * Set a cooldown for a specific provider key
   * Parses Retry-After header if provided
   * Applies exponential backoff for consecutive failures (only when no Retry-After header)
   */
  setCooldown(
    provider: string,
    keyIndex: number,
    retryAfterHeader?: string,
    defaultCooldownMs: number = 60_000,
  ): void {
    const key = `${provider}:${keyIndex}`;
    let cooldownMs = defaultCooldownMs;

    if (retryAfterHeader) {
      // Try parsing as seconds first
      const seconds = parseInt(retryAfterHeader, 10);
      if (!isNaN(seconds)) {
        cooldownMs = seconds * 1000;
      } else {
        // Try parsing as HTTP date
        const date = new Date(retryAfterHeader);
        if (!isNaN(date.getTime())) {
          cooldownMs = Math.max(0, date.getTime() - Date.now());
        }
        // If both fail, use default
      }
    } else {
      // Apply exponential backoff to default cooldown when no Retry-After header
      const failures = this.consecutiveFailures.get(key) ?? 0;
      const multiplier = Math.pow(2, failures);
      cooldownMs = Math.min(defaultCooldownMs * multiplier, MAX_COOLDOWN_MS);
    }

    this.cooldowns.set(key, {
      until: Date.now() + cooldownMs,
      reason: '429 rate limit',
    });

    if (retryAfterHeader) {
      // Provider gave authoritative timing -- hold counter at 1
      this.consecutiveFailures.set(key, 1);
    } else {
      // No header -- escalate backoff
      const currentFailures = this.consecutiveFailures.get(key) ?? 0;
      this.consecutiveFailures.set(key, currentFailures + 1);
    }
  }

  /**
   * Check if a key is currently in cooldown
   * Performs lazy cleanup of expired cooldowns
   */
  isInCooldown(provider: string, keyIndex: number): boolean {
    const key = `${provider}:${keyIndex}`;
    const cooldown = this.cooldowns.get(key);

    if (!cooldown) {
      return false;
    }

    // Check if expired
    const now = Date.now();
    if (now >= cooldown.until) {
      // Lazy cleanup
      this.cooldowns.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Get cooldown details for a key
   * Returns null if no active cooldown
   */
  getCooldown(provider: string, keyIndex: number): { until: string; reason: string } | null {
    const key = `${provider}:${keyIndex}`;
    const cooldown = this.cooldowns.get(key);

    if (!cooldown) {
      return null;
    }

    // Check if expired
    const now = Date.now();
    if (now >= cooldown.until) {
      this.cooldowns.delete(key);
      return null;
    }

    return {
      until: new Date(cooldown.until).toISOString(),
      reason: cooldown.reason,
    };
  }

  /**
   * Clear cooldown for a specific key
   */
  clear(provider: string, keyIndex: number): void {
    const key = `${provider}:${keyIndex}`;
    this.cooldowns.delete(key);
    this.consecutiveFailures.delete(key);
  }

  /**
   * Mark a successful call to reset consecutive failure count
   * Also clears any existing cooldown for the key
   */
  onSuccess(provider: string, keyIndex: number): void {
    const key = `${provider}:${keyIndex}`;
    this.consecutiveFailures.set(key, 0);
    this.cooldowns.delete(key);
  }

  // ── Provider-level cooldown methods (new) ─────────────────────────

  /**
   * Set a provider-level cooldown.
   * Permanent cooldowns (402 credit exhaustion) set until to Infinity.
   * Others apply escalating backoff with 15-minute cap.
   */
  setProviderCooldown(
    provider: string,
    cooldownMs: number,
    cooldownClass: CooldownClass,
    reason?: string,
  ): void {
    const cooldownReason = reason ?? `Provider cooldown (${cooldownClass})`;

    if (cooldownClass === 'permanent') {
      this.providerCooldowns.set(provider, {
        until: Infinity,
        reason: cooldownReason,
        cooldownClass,
      });
    } else {
      const failures = this.providerFailures.get(provider) ?? 0;
      const effectiveCooldown = Math.min(cooldownMs * Math.pow(2, failures), MAX_COOLDOWN_MS);
      this.providerCooldowns.set(provider, {
        until: Date.now() + effectiveCooldown,
        reason: cooldownReason,
        cooldownClass,
      });
    }

    // Increment failure count
    const currentFailures = this.providerFailures.get(provider) ?? 0;
    this.providerFailures.set(provider, currentFailures + 1);

    // Fire-and-forget persist to storage
    void this.persistProviderCooldown(provider).catch(() => {
      /* fire-and-forget */
    });
  }

  /**
   * Check if a provider is currently in cooldown.
   * Performs lazy cleanup of expired cooldowns.
   */
  isProviderInCooldown(provider: string): boolean {
    const cooldown = this.providerCooldowns.get(provider);
    if (!cooldown) return false;

    // Permanent cooldowns never expire
    if (cooldown.until === Infinity) return true;

    if (Date.now() >= cooldown.until) {
      // Lazy cleanup
      this.providerCooldowns.delete(provider);
      return false;
    }

    return true;
  }

  /**
   * Get provider cooldown details.
   * Returns null if no active cooldown.
   */
  getProviderCooldown(
    provider: string,
  ): { until: string; reason: string; cooldownClass: CooldownClass } | null {
    const cooldown = this.providerCooldowns.get(provider);
    if (!cooldown) return null;

    // Check expiry (permanent never expires)
    if (cooldown.until !== Infinity && Date.now() >= cooldown.until) {
      this.providerCooldowns.delete(provider);
      return null;
    }

    return {
      until: cooldown.until === Infinity ? 'Infinity' : new Date(cooldown.until).toISOString(),
      reason: cooldown.reason,
      cooldownClass: cooldown.cooldownClass,
    };
  }

  /**
   * Mark a successful provider call to reset failure count and clear cooldown.
   */
  onProviderSuccess(provider: string): void {
    this.providerFailures.set(provider, 0);
    this.providerCooldowns.delete(provider);

    // Fire-and-forget clear persisted cooldown
    void this.clearPersistedProviderCooldown(provider).catch(() => {
      /* fire-and-forget */
    });
  }

  /**
   * Check if a provider is permanently depleted (402 credit exhaustion).
   */
  isProviderDepleted(provider: string): boolean {
    const cooldown = this.providerCooldowns.get(provider);
    return cooldown !== undefined && cooldown.cooldownClass === 'permanent';
  }

  /**
   * Clear all cooldowns (per-key and provider-level).
   */
  clearAll(): void {
    this.cooldowns.clear();
    this.consecutiveFailures.clear();
    this.providerCooldowns.clear();
    this.providerFailures.clear();

    // Fire-and-forget clear all persisted cooldowns
    void this.clearAllPersistedCooldowns().catch(() => {
      /* fire-and-forget */
    });
  }

  // ── Storage persistence ───────────────────────────────────────────

  /**
   * Load persisted cooldowns from storage.
   * Called once at startup to restore cooldown state across restarts.
   * Skips expired non-permanent cooldowns.
   */
  async loadPersistedCooldowns(): Promise<void> {
    if (!this.storage) return;

    try {
      const records = await this.storage.get('cooldown:provider');
      for (const record of records) {
        const provider = record.provider.replace('cooldown:provider:', '');
        try {
          const data = JSON.parse(record.id) as {
            until: number;
            reason: string;
            cooldownClass: CooldownClass;
            failures: number;
          };

          // Skip expired non-permanent cooldowns
          if (data.until !== Infinity && data.until < Date.now()) continue;

          this.providerCooldowns.set(provider, {
            until: data.until,
            reason: data.reason,
            cooldownClass: data.cooldownClass,
          });
          this.providerFailures.set(provider, data.failures);
        } catch {
          /* skip malformed records */
        }
      }
    } catch {
      /* storage read failure is non-fatal */
    }
  }

  /**
   * Persist a single provider cooldown to storage.
   */
  private async persistProviderCooldown(provider: string): Promise<void> {
    if (!this.storage) return;

    const cooldown = this.providerCooldowns.get(provider);
    if (!cooldown) return;

    const data = {
      until: cooldown.until,
      reason: cooldown.reason,
      cooldownClass: cooldown.cooldownClass,
      failures: this.providerFailures.get(provider) ?? 0,
    };

    await this.storage.put({
      id: JSON.stringify(data),
      provider: `cooldown:provider:${provider}`,
      keyIndex: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      timestamp: Date.now(),
      window: { type: 'daily', durationMs: 0 },
      estimated: false,
    });
  }

  /**
   * Clear a persisted provider cooldown from storage.
   */
  private async clearPersistedProviderCooldown(provider: string): Promise<void> {
    if (!this.storage) return;
    await this.storage.reset(`cooldown:provider:${provider}`, 0, {
      type: 'daily',
      durationMs: 0,
    });
  }

  /**
   * Clear all persisted cooldowns from storage.
   */
  private async clearAllPersistedCooldowns(): Promise<void> {
    if (!this.storage) return;
    await this.storage.resetAll('cooldown:provider');
  }
}
