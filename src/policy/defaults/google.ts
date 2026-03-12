import { EnforcementBehavior, Provider } from '../../constants/index.js';
import type { Policy } from '../../types/domain.js';

/**
 * Google AI Studio default policy
 * Source: https://ai.google.dev/pricing
 *
 * Placeholder values - will be researched in Phase 8
 */
export const googlePolicy = {
  id: 'google-default',
  provider: Provider.GOOGLE,
  version: '2026-03-13',
  limits: [
    {
      type: 'tokens',
      value: 1_000_000,
      window: {
        type: 'monthly',
        durationMs: 2_592_000_000, // 30 days
      },
    },
    {
      type: 'rate',
      value: 15,
      window: {
        type: 'per-minute',
        durationMs: 60_000,
      },
    },
    {
      type: 'rate',
      value: 1500,
      window: {
        type: 'daily',
        durationMs: 86_400_000,
      },
    },
  ],
  enforcement: EnforcementBehavior.HARD_BLOCK,
  resetWindows: [
    {
      type: 'per-minute',
      resetAt: 'rolling',
    },
    {
      type: 'daily',
      resetAt: 'calendar',
    },
    {
      type: 'monthly',
      resetAt: 'calendar',
    },
  ],
  metadata: {
    researchedDate: '2026-03-13',
    confidence: 'low',
    sourceUrl: 'https://ai.google.dev/pricing',
  },
} satisfies Policy;
