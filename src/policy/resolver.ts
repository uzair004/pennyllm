import debug from 'debug';
import { EnforcementBehavior } from '../constants/index.js';
import { ConfigError } from '../errors/config-error.js';
import type { RouterConfig } from '../types/config.js';
import type { Policy, PolicyLimit } from '../types/domain.js';
import type { ResolvedPolicy } from './types.js';

const log = debug('pennyllm:policy:resolver');

/**
 * Merge limit arrays where later layers override earlier ones
 * Match by composite key: type:window.type
 * Later layer replaces earlier for same key
 * Unmatched limits from any layer are included
 */
export function mergeLimits(...layers: PolicyLimit[][]): PolicyLimit[] {
  const merged = new Map<string, PolicyLimit>();

  for (const layer of layers) {
    for (const limit of layer) {
      const key = `${limit.type}:${limit.window.type}`;
      merged.set(key, limit);
    }
  }

  return Array.from(merged.values());
}

/**
 * Validate that narrower windows have values <= wider windows for the same type
 */
function validateContradictoryLimits(provider: string, limits: PolicyLimit[]): void {
  // Group limits by type
  const byType = new Map<string, Map<string, number>>();

  for (const limit of limits) {
    if (!byType.has(limit.type)) {
      byType.set(limit.type, new Map());
    }
    byType.get(limit.type)!.set(limit.window.type, limit.value);
  }

  // Check for contradictions
  for (const [type, windows] of byType) {
    const perMinute = windows.get('per-minute');
    const hourly = windows.get('hourly');
    const daily = windows.get('daily');
    const monthly = windows.get('monthly');

    if (perMinute !== undefined && hourly !== undefined && perMinute > hourly) {
      throw new ConfigError(
        `Contradictory limits for provider "${provider}": per-minute ${type} limit (${perMinute}) exceeds hourly ${type} limit (${hourly})`,
      );
    }

    if (hourly !== undefined && daily !== undefined && hourly > daily) {
      throw new ConfigError(
        `Contradictory limits for provider "${provider}": hourly ${type} limit (${hourly}) exceeds daily ${type} limit (${daily})`,
      );
    }

    if (daily !== undefined && monthly !== undefined && daily > monthly) {
      throw new ConfigError(
        `Contradictory limits for provider "${provider}": daily ${type} limit (${daily}) exceeds monthly ${type} limit (${monthly})`,
      );
    }
  }
}

/**
 * Resolve policies by merging shipped defaults with user config
 * Three-layer merge: shipped defaults < provider-level limits < per-key limits
 */
export function resolvePolicies(
  config: RouterConfig,
  shippedDefaults: Map<string, Policy>,
): ResolvedPolicy[] {
  const resolved: ResolvedPolicy[] = [];

  for (const [provider, providerConfig] of Object.entries(config.providers)) {
    // Skip disabled providers
    if (providerConfig.enabled === false) {
      continue;
    }

    const shippedPolicy = shippedDefaults.get(provider);

    // Duplicate key detection
    const keyStrings = new Set<string>();
    for (const key of providerConfig.keys) {
      const keyStr = typeof key === 'string' ? key : key.key;
      if (keyStrings.has(keyStr)) {
        throw new ConfigError(
          `Duplicate key detected in provider "${provider}": keys must be unique`,
        );
      }
      keyStrings.add(keyStr);
    }

    // Resolve each key
    for (let keyIndex = 0; keyIndex < providerConfig.keys.length; keyIndex++) {
      const key = providerConfig.keys[keyIndex]!;
      const keyId = typeof key === 'string' ? key : key.key;
      const perKeyLimits = typeof key === 'string' ? undefined : (key.limits ?? undefined);

      // Three-layer merge
      const mergedLimits = mergeLimits(
        shippedPolicy?.limits ?? [],
        providerConfig.limits ?? [],
        perKeyLimits ?? [],
      );

      // Custom providers without defaults and no configured limits
      if (!shippedPolicy && !providerConfig.limits && !perKeyLimits && mergedLimits.length === 0) {
        log(
          `No shipped policy or configured limits for provider "${provider}" — keys will always be considered available`,
        );
      }

      // Validate contradictory limits
      if (mergedLimits.length > 0) {
        validateContradictoryLimits(provider, mergedLimits);
      }

      const resolvedPolicy: ResolvedPolicy = {
        provider,
        keyId,
        keyIndex,
        limits: mergedLimits,
        enforcement: shippedPolicy?.enforcement ?? EnforcementBehavior.HARD_BLOCK,
      };

      // Only add metadata if it exists
      if (shippedPolicy?.metadata) {
        resolvedPolicy.metadata = shippedPolicy.metadata;
      }

      resolved.push(resolvedPolicy);
    }
  }

  return resolved;
}
