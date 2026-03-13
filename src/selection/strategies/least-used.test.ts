import { describe, it, expect } from 'vitest';
import { LeastUsedStrategy } from './least-used.js';
import type { CandidateKey, SelectionContext } from '../types.js';

const mockCandidateWithUsage = (
  keyIndex: number,
  remaining: number,
  max: number,
): CandidateKey => ({
  keyIndex,
  eligible: true,
  cooldown: null,
  evaluation: {
    eligible: true,
    limits: [
      {
        type: 'tokens',
        current: max - remaining,
        max,
        remaining,
        percentUsed: ((max - remaining) / max) * 100,
        resetAt: new Date(),
      },
    ],
    enforcement: 'hard-block',
  },
});

describe('LeastUsedStrategy', () => {
  it('selects key with highest worst-case remaining percentage', async () => {
    const strategy = new LeastUsedStrategy();
    // Key 0: 20% remaining, Key 1: 80% remaining
    const candidates = [
      mockCandidateWithUsage(0, 2000, 10000),
      mockCandidateWithUsage(1, 8000, 10000),
    ];

    const context: SelectionContext = { provider: 'test', candidates };
    const result = await strategy.selectKey(context);

    // Should select key 1 (80% remaining > 20% remaining)
    expect(result.keyIndex).toBe(1);
    expect(result.reason).toContain('most remaining quota');
  });

  it.todo('treats keys with no limits as 100% remaining');
  it.todo('uses config order as tiebreaker when remaining is equal');
  it.todo('skips ineligible candidates');
});
