import debug from 'debug';
import { EventEmitter } from 'node:events';
import type { ResolvedPolicy } from './types.js';

const log = debug('pennyllm:policy:staleness');

/**
 * Check if shipped policies are stale (>30 days old)
 * Emits policy:stale events for policies requiring updates
 */
export function checkStaleness(resolvedPolicies: ResolvedPolicy[], emitter: EventEmitter): void {
  const seenProviders = new Set<string>();

  for (const policy of resolvedPolicies) {
    // Skip policies without metadata (user-configured limits have no staleness concept)
    if (!policy.metadata?.researchedDate) {
      continue;
    }

    // Deduplicate by provider (only fire once per provider)
    if (seenProviders.has(policy.provider)) {
      continue;
    }
    seenProviders.add(policy.provider);

    // Calculate days since research
    const researchedDate = new Date(policy.metadata.researchedDate);
    const now = new Date();
    const daysOld = Math.floor((now.getTime() - researchedDate.getTime()) / (1000 * 60 * 60 * 24));

    // Emit stale event if >30 days old
    if (daysOld > 30) {
      const suggestion = policy.metadata.sourceUrl
        ? `Run 'npm update pennyllm' or verify limits at ${policy.metadata.sourceUrl}`
        : `Run 'npm update pennyllm' to get latest policy updates`;

      log(
        'Stale policy detected: %s (researched %s, %d days old)',
        policy.provider,
        policy.metadata.researchedDate,
        daysOld,
      );

      emitter.emit('policy:stale', {
        provider: policy.provider,
        researchedDate: policy.metadata.researchedDate,
        daysOld,
        suggestion,
      });
    }
  }
}
