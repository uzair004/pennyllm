import { type ZodError, type ZodIssue } from 'zod';
import { Provider } from '../constants/index.js';

/**
 * Known provider names derived from the Provider constant.
 */
export const KNOWN_PROVIDERS: string[] = Object.values(Provider);

/**
 * Levenshtein distance between two strings.
 * Standard DP algorithm, no dependencies.
 */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  // Create matrix (m+1) x (n+1)
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array.from({ length: n + 1 }, () => 0),
  );

  for (let i = 0; i <= m; i++) {
    dp[i]![0] = i;
  }
  for (let j = 0; j <= n; j++) {
    dp[0]![j] = j;
  }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(
        dp[i - 1]![j]! + 1, // deletion
        dp[i]![j - 1]! + 1, // insertion
        dp[i - 1]![j - 1]! + cost, // substitution
      );
    }
  }

  return dp[m]![n]!;
}

/**
 * Suggest the closest known provider name if within edit distance 2.
 * Returns null if no close match found.
 */
export function suggestProvider(input: string, knownProviders: string[]): string | null {
  let bestMatch: string | null = null;
  let bestDistance = 3; // threshold: must be <= 2

  for (const known of knownProviders) {
    const dist = levenshtein(input.toLowerCase(), known.toLowerCase());
    if (dist < bestDistance) {
      bestDistance = dist;
      bestMatch = known;
    }
  }

  return bestMatch;
}

/**
 * Format a Zod issue path as a dotted string.
 */
function formatPath(issue: ZodIssue): string {
  if (issue.path.length === 0) return '(root)';
  return issue.path.join('.');
}

/**
 * Map a Zod issue to a human-readable message with actionable hints.
 */
function formatIssue(issue: ZodIssue): string {
  const path = formatPath(issue);

  switch (issue.code) {
    case 'too_small':
      if (path.endsWith('.keys') || path.endsWith('keys')) {
        return `${path}: At least one API key is required for each provider`;
      }
      return `${path}: ${issue.message}`;

    case 'invalid_type':
      return `${path}: Expected ${issue.expected}, received ${issue.received}`;

    case 'unrecognized_keys':
      return `${path}: Unknown config field '${issue.keys.join("', '")}'. Check spelling.`;

    default:
      return `${path}: ${issue.message}`;
  }
}

/**
 * Transform ZodError into an actionable error message with typo suggestions.
 *
 * @param error - The ZodError from schema validation
 * @param rawConfig - The raw config object for provider name typo detection
 * @returns Object with formatted message and optional field path
 */
export function formatConfigErrors(
  error: ZodError,
  rawConfig: unknown,
): { message: string; field?: string } {
  // Format each Zod issue
  const messages: string[] = error.issues.map(formatIssue);

  // Scan provider keys for typos against known providers
  if (
    rawConfig !== null &&
    typeof rawConfig === 'object' &&
    'providers' in rawConfig &&
    rawConfig.providers !== null &&
    typeof rawConfig.providers === 'object'
  ) {
    const providerKeys = Object.keys(rawConfig.providers as Record<string, unknown>);
    for (const key of providerKeys) {
      if (!KNOWN_PROVIDERS.includes(key)) {
        const suggestion = suggestProvider(key, KNOWN_PROVIDERS);
        if (suggestion) {
          messages.push(`Unknown provider '${key}'. Did you mean '${suggestion}'?`);
        }
      }
    }
  }

  // Determine field from first issue
  const firstIssue = error.issues[0];
  const result: { message: string; field?: string } = {
    message: `Invalid configuration:\n${messages.map((m) => `  - ${m}`).join('\n')}`,
  };
  if (firstIssue && firstIssue.path.length > 0) {
    result.field = formatPath(firstIssue);
  }

  return result;
}

/**
 * Validate provider names and return warning messages for unknown providers.
 * These are warnings (not errors) -- used for debug output.
 */
export function validateProviderNames(providers: Record<string, unknown>): string[] {
  const warnings: string[] = [];
  for (const key of Object.keys(providers)) {
    if (!KNOWN_PROVIDERS.includes(key)) {
      const suggestion = suggestProvider(key, KNOWN_PROVIDERS);
      if (suggestion) {
        warnings.push(`Unknown provider '${key}'. Did you mean '${suggestion}'?`);
      } else {
        warnings.push(
          `Unknown provider '${key}'. Custom providers are supported but may lack default limits.`,
        );
      }
    }
  }
  return warnings;
}
