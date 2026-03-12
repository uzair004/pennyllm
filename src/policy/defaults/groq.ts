import { EnforcementBehavior, Provider } from '../../constants/index.js';
import type { Policy } from '../../types/domain.js';

/**
 * Groq default policy
 * Source: https://console.groq.com/docs/rate-limits
 *
 * Placeholder values - will be researched in Phase 8
 */
export const groqPolicy = {
  id: 'groq-default',
  provider: Provider.GROQ,
  version: '2026-03-13',
  limits: [
    {
      type: 'tokens',
      value: 500_000,
      window: {
        type: 'daily',
        durationMs: 86_400_000,
      },
    },
    {
      type: 'rate',
      value: 30,
      window: {
        type: 'per-minute',
        durationMs: 60_000,
      },
    },
    {
      type: 'rate',
      value: 14_400,
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
  ],
  metadata: {
    researchedDate: '2026-03-13',
    confidence: 'low',
    sourceUrl: 'https://console.groq.com/docs/rate-limits',
  },
} satisfies Policy;
