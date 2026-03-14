import type { AffinityEntry } from './types.js';

/**
 * Short-term affinity cache that avoids repeated fallback resolution
 * during burst traffic. Entries expire after a configurable TTL.
 */
export class AffinityCache {
  private cache: Map<string, AffinityEntry> = new Map();
  private readonly ttlMs: number;

  constructor(ttlMs: number = 60_000) {
    this.ttlMs = ttlMs;
  }

  get(key: string): AffinityEntry | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }
    return entry;
  }

  set(key: string, provider: string, modelId: string): void {
    this.cache.set(key, { provider, modelId, timestamp: Date.now() });
  }

  clear(): void {
    this.cache.clear();
  }
}
