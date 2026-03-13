import { describe, it, expect } from 'vitest';
import { RoundRobinStrategy } from './round-robin.js';
import type { CandidateKey, SelectionContext } from '../types.js';

const mockCandidate = (keyIndex: number, eligible = true): CandidateKey => ({
  keyIndex,
  eligible,
  cooldown: null,
  evaluation: {
    eligible,
    limits: [],
    enforcement: 'hard-block',
  },
});

describe('RoundRobinStrategy', () => {
  it('distributes requests evenly across 3 keys over 100 requests', async () => {
    const strategy = new RoundRobinStrategy();
    const candidates = [mockCandidate(0), mockCandidate(1), mockCandidate(2)];
    const counts = new Map<number, number>();

    for (let i = 0; i < 100; i++) {
      const context: SelectionContext = { provider: 'test', candidates };
      const result = await strategy.selectKey(context);
      counts.set(result.keyIndex, (counts.get(result.keyIndex) ?? 0) + 1);
    }

    // Each key should be selected ~33 times (tolerance: +/- 5)
    expect(counts.get(0)).toBeGreaterThanOrEqual(28);
    expect(counts.get(0)).toBeLessThanOrEqual(38);
    expect(counts.get(1)).toBeGreaterThanOrEqual(28);
    expect(counts.get(1)).toBeLessThanOrEqual(38);
    expect(counts.get(2)).toBeGreaterThanOrEqual(28);
    expect(counts.get(2)).toBeLessThanOrEqual(38);
  });

  it.todo('tracks per-provider cycling state independently');
  it.todo('skips ineligible candidates');
  it.todo('resets cycling when available key set changes');
});
