import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryStorage } from './MemoryStorage.js';
import { createStorageContractTests } from '../../tests/contracts/storage.contract.js';
import type { TimeWindow } from '../types/index.js';

// Run shared contract tests
// eslint-disable-next-line @typescript-eslint/require-await
createStorageContractTests('MemoryStorage', async () => new MemoryStorage());

describe('MemoryStorage - specific behavior', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  afterEach(async () => {
    try {
      await storage.close();
    } catch {
      // Ignore errors during cleanup
    }
  });

  it('emits stderr warning on construction', () => {
    const writeSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    new MemoryStorage();

    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('in-memory storage'));

    writeSpy.mockRestore();
  });

  it('expired windows are cleaned up on increment', async () => {
    vi.useFakeTimers();

    const window: TimeWindow = {
      type: 'per-minute',
      durationMs: 60_000,
    };

    // First increment at T=0
    await storage.increment('google', 0, { prompt: 100, completion: 50 }, window);

    // Advance time by 2 minutes (past the window)
    vi.advanceTimersByTime(120_000);

    // Second increment at T=120000 (triggers cleanup)
    await storage.increment('google', 0, { prompt: 50, completion: 25 }, window);

    // Should only have the second increment's tokens
    const usage = await storage.getUsage('google', 0, window);

    expect(usage.totalTokens).toBe(75); // Only the second increment

    vi.useRealTimers();
  });

  it('expired windows are cleaned up on getUsage', async () => {
    vi.useFakeTimers();

    const window: TimeWindow = {
      type: 'per-minute',
      durationMs: 60_000,
    };

    // Increment at T=0
    await storage.increment('google', 0, { prompt: 100, completion: 50 }, window);

    // Advance time by 2 minutes
    vi.advanceTimersByTime(120_000);

    // getUsage should trigger cleanup and return 0
    const usage = await storage.getUsage('google', 0, window);

    expect(usage.totalTokens).toBe(0);
    expect(usage.callCount).toBe(0);

    vi.useRealTimers();
  });
});
