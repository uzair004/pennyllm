import type { SelectionStrategy } from '../../types/interfaces.js';
import type { CandidateKey, SelectionContext, SelectionResult } from '../types.js';

/**
 * LeastUsedStrategy selects the key with the highest worst-case remaining percentage
 * across all time windows. Tiebreaker uses config order.
 */
export class LeastUsedStrategy implements SelectionStrategy {
  readonly name = 'least-used';

  selectKey(context: SelectionContext): Promise<SelectionResult> {
    const available = context.candidates.filter((c) => c.eligible && !c.cooldown);

    if (available.length === 0) {
      throw new Error('No eligible keys');
    }

    // Sort by worst-case remaining percentage (descending — most remaining first)
    // Tiebreaker: first in config order (lower keyIndex wins)
    const sorted = [...available].sort((a, b) => {
      const aRemaining = this.getWorstCaseRemainingPct(a);
      const bRemaining = this.getWorstCaseRemainingPct(b);
      if (bRemaining !== aRemaining) {
        return bRemaining - aRemaining; // Higher remaining first
      }
      return a.keyIndex - b.keyIndex; // Tiebreaker: config order
    });

    const selected = sorted[0]!;
    const pct = this.getWorstCaseRemainingPct(selected);

    return Promise.resolve({
      keyIndex: selected.keyIndex,
      reason: `most remaining quota (${pct.toFixed(1)}% worst-case)`,
    });
  }

  private getWorstCaseRemainingPct(candidate: CandidateKey): number {
    const limits = candidate.evaluation.limits;
    if (limits.length === 0) return 100; // No limits = 100% remaining

    let worstPct = 100;
    for (const limit of limits) {
      if (limit.max > 0) {
        const pct = (limit.remaining / limit.max) * 100;
        worstPct = Math.min(worstPct, pct);
      }
    }
    return worstPct;
  }
}
