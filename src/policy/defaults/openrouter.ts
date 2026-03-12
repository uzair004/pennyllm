import { EnforcementBehavior, Provider } from '../../constants/index.js';
import type { Policy } from '../../types/domain.js';

/**
 * OpenRouter default policy (free models)
 * Source: https://openrouter.ai/docs
 *
 * OpenRouter throttles rather than hard-blocks
 * Placeholder values - will be researched in Phase 8
 */
export const openrouterPolicy = {
  id: 'openrouter-default',
  provider: Provider.OPENROUTER,
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
      value: 20,
      window: {
        type: 'per-minute',
        durationMs: 60_000,
      },
    },
  ],
  enforcement: EnforcementBehavior.THROTTLE,
  resetWindows: [
    {
      type: 'per-minute',
      resetAt: 'rolling',
    },
    {
      type: 'monthly',
      resetAt: 'calendar',
    },
  ],
  metadata: {
    researchedDate: '2026-03-13',
    confidence: 'low',
    sourceUrl: 'https://openrouter.ai/docs',
  },
} satisfies Policy;
