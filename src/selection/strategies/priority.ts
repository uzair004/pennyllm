import type { SelectionStrategy } from '../../types/interfaces.js';
import type { SelectionContext, SelectionResult } from '../types.js';

/**
 * PriorityStrategy selects the first eligible key in configuration order
 * Auto-promotion is implicit: recovered keys naturally get selected first again
 */
export class PriorityStrategy implements SelectionStrategy {
  readonly name = 'priority';

  selectKey(context: SelectionContext): Promise<SelectionResult> {
    // Filter to eligible, non-cooldown candidates
    const available = context.candidates.filter((c) => c.eligible && !c.cooldown);

    if (available.length === 0) {
      throw new Error('No eligible keys');
    }

    // Pre-flight headroom check if estimatedTokens provided
    if (context.estimatedTokens !== undefined) {
      const withHeadroom = available.filter((c) => {
        // Check if any token limit has enough remaining
        const tokenLimits = c.evaluation.limits.filter((l) => l.type === 'tokens');
        if (tokenLimits.length === 0) return true; // No token limits = always OK
        return tokenLimits.every((l) => l.remaining >= context.estimatedTokens!);
      });
      if (withHeadroom.length > 0) {
        // Use first with headroom (config order)
        const selected = withHeadroom[0]!;
        return Promise.resolve({
          keyIndex: selected.keyIndex,
          reason: 'first eligible with headroom in config order',
        });
      }
      // No key has enough headroom — pick first eligible anyway (advisory, not blocking)
    }

    // First eligible key in config order (candidates are already in config order)
    const selected = available[0]!;
    return Promise.resolve({
      keyIndex: selected.keyIndex,
      reason: 'first eligible in config order',
    });
  }
}
