import type { Policy } from '../../types/domain.js';
import { googlePolicy } from './google.js';
import { groqPolicy } from './groq.js';
import { openrouterPolicy } from './openrouter.js';

/**
 * Export individual default policies
 */
export { googlePolicy } from './google.js';
export { groqPolicy } from './groq.js';
export { openrouterPolicy } from './openrouter.js';

/**
 * Map of shipped default policies keyed by provider
 */
export const shippedDefaults = new Map<string, Policy>([
  ['google', googlePolicy],
  ['groq', groqPolicy],
  ['openrouter', openrouterPolicy],
]);
