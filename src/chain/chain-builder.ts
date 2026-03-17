import debugFactory from 'debug';
import type { RouterConfig } from '../types/config.js';
import type { ChainEntry } from './types.js';
import { getProviderModule } from '../providers/registry.js';
import type { ProviderModelDef } from '../providers/types.js';
import type { QualityTierType } from '../constants/index.js';
import { ConfigError } from '../errors/config-error.js';

const debug = debugFactory('pennyllm:chain');

/** Quality tier sort order (frontier first) */
const TIER_ORDER: Record<QualityTierType, number> = {
  frontier: 0,
  high: 1,
  mid: 2,
  small: 3,
};

/**
 * Default capabilities for unknown models.
 */
const UNKNOWN_CAPABILITIES: ProviderModelDef['capabilities'] = {
  toolCall: false,
  reasoning: false,
  vision: false,
  structuredOutput: false,
};

/**
 * Build the model priority chain from user configuration.
 *
 * Two modes:
 * - Explicit: config.models is defined and non-empty -- preserves user order exactly
 * - Auto-generated: config.models is undefined/empty -- interleaves providers by priority
 */
export function buildChain(config: RouterConfig): ChainEntry[] {
  const chain =
    config.models && config.models.length > 0 ? buildExplicitChain(config) : buildAutoChain(config);

  if (chain.length === 0) {
    debug('Warning: chain is empty after building');
  }

  logChain(chain);
  return chain;
}

/**
 * Mode 1: Explicit chain from config.models array.
 * Preserves exact user-specified order.
 */
function buildExplicitChain(config: RouterConfig): ChainEntry[] {
  const chain: ChainEntry[] = [];

  for (const id of config.models!) {
    const slashIndex = id.indexOf('/');
    if (slashIndex === -1) {
      debug(`Model "${id}" missing provider/ prefix, skipping`);
      continue;
    }

    const provider = id.slice(0, slashIndex);
    const modelPart = id.slice(slashIndex + 1);

    // Verify provider is configured
    if (!(provider in config.providers)) {
      debug(`Model ${id} references unconfigured provider '${provider}', skipping`);
      continue;
    }

    const providerConfig = config.providers[provider]!;

    // Check provider allowlist
    if (providerConfig.models && providerConfig.models.length > 0) {
      if (!providerConfig.models.includes(id) && !providerConfig.models.includes(modelPart)) {
        throw new ConfigError(
          `Model '${modelPart}' is not in the allowlist for provider '${provider}'. Allowed: [${providerConfig.models.join(', ')}]`,
          { field: `providers.${provider}.models` },
        );
      }
    }

    // Look up module for metadata
    const mod = getProviderModule(provider);
    const curatedModel = mod?.models.find((m) => m.id === id);

    if (curatedModel) {
      chain.push({
        provider,
        modelId: curatedModel.id,
        apiModelId: curatedModel.apiId,
        qualityTier: curatedModel.qualityTier,
        free: curatedModel.free,
        capabilities: curatedModel.capabilities,
        stale: false,
      });
    } else {
      // Unknown model -- allow with warning
      debug(`Model ${id} not in known registry for provider '${provider}', will attempt anyway`);
      chain.push({
        provider,
        modelId: id,
        apiModelId: modelPart,
        qualityTier: 'mid',
        free: true,
        capabilities: UNKNOWN_CAPABILITIES,
        stale: false,
      });
    }
  }

  return chain;
}

/**
 * Mode 2: Auto-generated chain by interleaving providers.
 * Sorts providers by priority, models by quality tier, then round-robins.
 */
function buildAutoChain(config: RouterConfig): ChainEntry[] {
  const freeOnly = config.budget.monthlyLimit === 0;

  // Collect and sort providers by priority (lower first), then alphabetically for ties
  const sortedProviders = Object.entries(config.providers)
    .filter(([, prov]) => prov.enabled !== false)
    .sort(([aId, a], [bId, b]) => {
      const priorityDiff = a.priority - b.priority;
      if (priorityDiff !== 0) return priorityDiff;
      return aId.localeCompare(bId);
    });

  // Collect models per provider
  const providerModels: ChainEntry[][] = [];

  for (const [providerId, providerConfig] of sortedProviders) {
    const mod = getProviderModule(providerId);
    if (!mod) {
      debug(`No provider module found for '${providerId}', skipping in auto chain`);
      continue;
    }

    let models: ProviderModelDef[];

    if (providerConfig.models && providerConfig.models.length > 0) {
      // Use provider's allowlist, looking up metadata from curated registry
      models = [];
      for (const modelRef of providerConfig.models) {
        // modelRef could be full id (provider/model) or just model name
        const curated = mod.models.find((m) => m.id === modelRef || m.apiId === modelRef);
        if (curated) {
          models.push(curated);
        } else {
          debug(
            `Model '${modelRef}' in allowlist for '${providerId}' not found in registry, skipping`,
          );
        }
      }
    } else {
      // Use all curated models
      models = [...mod.models];
    }

    // Filter: free-only when budget is $0
    if (freeOnly) {
      models = models.filter((m) => m.free);
    }

    // Sort by quality tier (frontier first)
    models.sort((a, b) => TIER_ORDER[a.qualityTier] - TIER_ORDER[b.qualityTier]);

    // Convert to ChainEntry[]
    const entries: ChainEntry[] = models.map((m) => ({
      provider: providerId,
      modelId: m.id,
      apiModelId: m.apiId,
      qualityTier: m.qualityTier,
      free: m.free,
      capabilities: m.capabilities,
      stale: false,
    }));

    if (entries.length > 0) {
      providerModels.push(entries);
    }
  }

  // Interleave: round-robin by provider order, then by model position
  const chain: ChainEntry[] = [];
  const maxModels = Math.max(0, ...providerModels.map((pm) => pm.length));

  for (let modelIndex = 0; modelIndex < maxModels; modelIndex++) {
    for (const entries of providerModels) {
      if (modelIndex < entries.length) {
        chain.push(entries[modelIndex]!);
      }
    }
  }

  return chain;
}

/**
 * Log the chain at startup. Uses console.info for always-visible output
 * plus debug for full details.
 */
function logChain(chain: ChainEntry[]): void {
  if (chain.length === 0) {
    console.info('[PennyLLM] Model chain is empty');
    return;
  }

  const lines = chain.map((entry, i) => {
    const pos = String(i + 1).padStart(2, ' ');
    const tier = `[${entry.qualityTier}]`.padEnd(10);
    const cost = entry.free ? '[free]' : '[paid]';
    return `  ${pos}. ${entry.modelId.padEnd(35)} ${tier} ${cost}`;
  });

  console.info(`[PennyLLM] Model chain (${chain.length} models):\n${lines.join('\n')}`);

  debug('Chain entries: %O', chain);
}
