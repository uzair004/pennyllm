import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { StorageBackend, TimeWindow } from '../../src/types/index.js';
import { randomUUID } from 'node:crypto';

/**
 * Shared contract tests for StorageBackend implementations
 * This is a test helper, not a standalone test file
 * Import and call this function from adapter-specific test files
 */
export function createStorageContractTests(
  name: string,
  factory: () => Promise<StorageBackend>,
): void {
  describe(`${name} - StorageBackend contract`, () => {
    let storage: StorageBackend;

    beforeEach(async () => {
      storage = await factory();
    });

    afterEach(async () => {
      try {
        await storage.close();
      } catch {
        // Ignore errors during cleanup
      }
    });

    it('increment creates new record when key does not exist', async () => {
      const window: TimeWindow = {
        type: 'per-minute',
        durationMs: 60_000,
      };

      const record = await storage.increment('google', 0, { prompt: 100, completion: 50 }, window);

      expect(record.provider).toBe('google');
      expect(record.keyIndex).toBe(0);
      expect(record.promptTokens).toBe(100);
      expect(record.completionTokens).toBe(50);
      expect(record.totalTokens).toBe(150);
      expect(record.window.type).toBe('per-minute');
      expect(record.id).toBeDefined();
    });

    it('increment atomically updates existing record', async () => {
      const window: TimeWindow = {
        type: 'per-minute',
        durationMs: 60_000,
      };

      // First increment
      const record1 = await storage.increment('google', 0, { prompt: 100, completion: 50 }, window);

      // Second increment to same key
      const record2 = await storage.increment('google', 0, { prompt: 50, completion: 25 }, window);

      expect(record2.promptTokens).toBe(150);
      expect(record2.completionTokens).toBe(75);
      expect(record2.totalTokens).toBe(225);
      expect(record2.id).toBe(record1.id); // Same record updated
    });

    it('getUsage returns total tokens for key+window', async () => {
      const window: TimeWindow = {
        type: 'per-minute',
        durationMs: 60_000,
      };

      await storage.increment('google', 0, { prompt: 100, completion: 50 }, window);
      await storage.increment('google', 0, { prompt: 50, completion: 25 }, window);

      const usage = await storage.getUsage('google', 0, window);

      expect(usage.totalTokens).toBe(225); // 150 + 75
      expect(usage.promptTokens).toBe(150);
      expect(usage.completionTokens).toBe(75);
      expect(usage.callCount).toBe(0); // No calls tracked yet
    });

    it('getUsage returns 0 for unknown key', async () => {
      const window: TimeWindow = {
        type: 'per-minute',
        durationMs: 60_000,
      };

      const usage = await storage.getUsage('unknown-provider', 99, window);

      expect(usage.totalTokens).toBe(0);
      expect(usage.promptTokens).toBe(0);
      expect(usage.completionTokens).toBe(0);
      expect(usage.callCount).toBe(0);
    });

    it('reset clears usage for specific key and window', async () => {
      const window: TimeWindow = {
        type: 'per-minute',
        durationMs: 60_000,
      };

      await storage.increment('google', 0, { prompt: 100, completion: 50 }, window);
      await storage.reset('google', 0, window);

      const usage = await storage.getUsage('google', 0, window);

      expect(usage.totalTokens).toBe(0);
      expect(usage.callCount).toBe(0);
    });

    it('reset does not affect other keys', async () => {
      const window: TimeWindow = {
        type: 'per-minute',
        durationMs: 60_000,
      };

      await storage.increment('google', 0, { prompt: 100, completion: 50 }, window);
      await storage.increment('google', 1, { prompt: 200, completion: 100 }, window);

      await storage.reset('google', 0, window);

      const usage0 = await storage.getUsage('google', 0, window);
      const usage1 = await storage.getUsage('google', 1, window);

      expect(usage0.totalTokens).toBe(0);
      expect(usage1.totalTokens).toBe(300); // Unaffected
    });

    it('different windows track independently', async () => {
      const perMinuteWindow: TimeWindow = {
        type: 'per-minute',
        durationMs: 60_000,
      };

      const hourlyWindow: TimeWindow = {
        type: 'hourly',
        durationMs: 3_600_000,
      };

      await storage.increment('google', 0, { prompt: 100, completion: 50 }, perMinuteWindow);
      await storage.increment('google', 0, { prompt: 200, completion: 100 }, hourlyWindow);

      const perMinuteUsage = await storage.getUsage('google', 0, perMinuteWindow);
      const hourlyUsage = await storage.getUsage('google', 0, hourlyWindow);

      expect(perMinuteUsage.totalTokens).toBe(150);
      expect(hourlyUsage.totalTokens).toBe(300);
    });

    it('close prevents further increment operations', async () => {
      const window: TimeWindow = {
        type: 'per-minute',
        durationMs: 60_000,
      };

      await storage.close();

      await expect(
        storage.increment('google', 0, { prompt: 100, completion: 50 }, window),
      ).rejects.toThrow();
    });

    it('close prevents getUsage', async () => {
      const window: TimeWindow = {
        type: 'per-minute',
        durationMs: 60_000,
      };

      await storage.close();

      await expect(storage.getUsage('google', 0, window)).rejects.toThrow();
    });

    it('put stores a record retrievable by get', async () => {
      const window: TimeWindow = {
        type: 'per-minute',
        durationMs: 60_000,
      };

      const record = {
        id: randomUUID(),
        provider: 'google',
        keyIndex: 0,
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        timestamp: Date.now(),
        window,
        estimated: false,
      };

      await storage.put(record);

      const records = await storage.get('google');

      expect(records.length).toBeGreaterThan(0);
      expect(records.some((r) => r.id === record.id)).toBe(true);
    });
  });
}
