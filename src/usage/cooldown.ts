/**
 * Manages rate limit cooldowns for API keys after 429 responses
 * Includes exponential backoff for consecutive failures
 */
export class CooldownManager {
  private cooldowns: Map<string, { until: number; reason: string }>;
  private consecutiveFailures: Map<string, number>;

  constructor() {
    this.cooldowns = new Map();
    this.consecutiveFailures = new Map();
  }

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
      cooldownMs = defaultCooldownMs * multiplier;
    }

    this.cooldowns.set(key, {
      until: Date.now() + cooldownMs,
      reason: '429 rate limit',
    });

    // Increment consecutive failure count
    const currentFailures = this.consecutiveFailures.get(key) ?? 0;
    this.consecutiveFailures.set(key, currentFailures + 1);
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
   * Clear all cooldowns (for resetUsage)
   */
  clearAll(): void {
    this.cooldowns.clear();
    this.consecutiveFailures.clear();
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
}
