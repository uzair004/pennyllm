import type { SelectionStrategy } from '../../types/interfaces.js';
import type { SelectionContext, SelectionResult } from '../types.js';

/**
 * RoundRobinStrategy distributes requests evenly across eligible keys
 * Maintains per-provider cycling state against the full candidate list
 * so that index is stable when keys enter/exit cooldown
 */
export class RoundRobinStrategy implements SelectionStrategy {
  readonly name = 'round-robin';
  private indices = new Map<string, number>();

  selectKey(context: SelectionContext): Promise<SelectionResult> {
    const all = context.candidates;
    const startIndex = this.indices.get(context.provider) ?? 0;

    for (let i = 0; i < all.length; i++) {
      const idx = (startIndex + i) % all.length;
      const candidate = all[idx]!;
      if (candidate.eligible && !candidate.cooldown) {
        this.indices.set(context.provider, (idx + 1) % all.length);
        return Promise.resolve({
          keyIndex: candidate.keyIndex,
          reason: `round-robin position ${idx}`,
        });
      }
    }

    throw new Error('No eligible keys');
  }
}
