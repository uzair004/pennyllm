import type { SelectionStrategy } from '../../types/interfaces.js';
import type { SelectionContext, SelectionResult } from '../types.js';

/**
 * RoundRobinStrategy distributes requests evenly across eligible keys
 * Maintains per-provider cycling state
 */
export class RoundRobinStrategy implements SelectionStrategy {
  readonly name = 'round-robin';
  private indices = new Map<string, number>();

  selectKey(context: SelectionContext): Promise<SelectionResult> {
    const available = context.candidates.filter((c) => c.eligible && !c.cooldown);

    if (available.length === 0) {
      throw new Error('No eligible keys');
    }

    const currentIndex = this.indices.get(context.provider) ?? 0;
    const selected = available[currentIndex % available.length]!;

    // Advance for next call
    this.indices.set(context.provider, (currentIndex + 1) % available.length);

    return Promise.resolve({
      keyIndex: selected.keyIndex,
      reason: `round-robin position ${currentIndex % available.length}`,
    });
  }
}
