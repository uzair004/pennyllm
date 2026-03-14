import { EventEmitter } from 'node:events';
import debugFactory from 'debug';
import type { ModelCatalog } from '../types/interfaces.js';
import type { ModelMetadata } from '../types/domain.js';
import type { RouterConfig } from '../types/config.js';
import type { QualityTierType } from '../constants/index.js';
import type { FallbackCandidate } from './types.js';

const debug = debugFactory('llm-router:fallback');

const MAX_CANDIDATES = 20;

/**
 * Options for resolving fallback candidates
 */
export interface ResolveOptions {
  configuredProviders: string[];
  excludeProviders: string[];
  budgetRemaining: number | null;
  estimatedTokens?: number;
  originalQualityTier?: QualityTierType;
}

/**
 * Determines if a model is free based on its pricing
 */
function isFreeModel(model: ModelMetadata): boolean {
  return (
    model.pricing !== null &&
    model.pricing.promptPer1MTokens === 0 &&
    model.pricing.completionPer1MTokens === 0
  );
}

/**
 * FallbackResolver finds capability-matching models from the catalog
 * filtered to configured providers only, ranked by cost.
 *
 * Tiered matching: same quality tier first, then any tier.
 * Ranking: free providers first, then cheapest paid.
 * Context window pre-check skips models that cannot fit estimated prompt size.
 */
export class FallbackResolver {
  private readonly catalog: ModelCatalog;
  readonly config: RouterConfig;
  readonly emitter: EventEmitter;

  constructor(catalog: ModelCatalog, config: RouterConfig, emitter: EventEmitter) {
    this.catalog = catalog;
    this.config = config;
    this.emitter = emitter;
  }

  /**
   * Infer required capabilities from request parameters.
   *
   * Uses defensive access since the shape of params varies by AI SDK version.
   * Never throws on unexpected shapes.
   */
  inferCapabilities(params: unknown, reasoning: boolean): Partial<ModelMetadata['capabilities']> {
    const caps: Partial<ModelMetadata['capabilities']> = {};

    try {
      const p = params as Record<string, unknown>;

      // Check for tools property (non-empty array means toolCall required)
      if (Array.isArray(p['tools']) && p['tools'].length > 0) {
        caps.toolCall = true;
      }

      // Check for image content in messages/prompt
      if (this.hasImageContent(p)) {
        caps.vision = true;
      }
    } catch {
      // Defensive: never throw on unexpected shapes
      debug('Failed to infer capabilities from params, using empty caps');
    }

    // Reasoning comes from explicit flag, not inferred from params
    if (reasoning) {
      caps.reasoning = true;
    }

    return caps;
  }

  /**
   * Resolve fallback candidates from the model catalog.
   *
   * Steps:
   * 1. Check if fallback is enabled and not strict mode
   * 2. Check model mappings for explicit override
   * 3. Tier 1: capability match + same quality tier
   * 4. Tier 2: capability match only (any quality tier)
   * 5. Filter to configured providers, exclude already-tried providers
   * 6. Context window check
   * 7. Rank: free first, then cheapest paid
   * 8. Budget gate: if budget <= 0, filter out paid models
   * 9. Convert to FallbackCandidate format
   * 10. Limit to MAX_CANDIDATES
   */
  async resolve(
    originalModelId: string,
    requiredCaps: Partial<ModelMetadata['capabilities']>,
    options: ResolveOptions,
  ): Promise<FallbackCandidate[]> {
    const { fallback } = this.config;

    // Step 1: Check if fallback is enabled
    if (!fallback.enabled) {
      debug('Fallback disabled, returning empty candidates');
      return [];
    }

    // Step 2: Check strictModel
    if (fallback.strictModel) {
      debug('Strict model mode, no fallback allowed');
      return [];
    }

    // Step 3: Check modelMappings for explicit override
    if (fallback.modelMappings) {
      const mappedModelId = fallback.modelMappings[originalModelId];
      if (mappedModelId) {
        const mappedModel = await this.catalog.getModel(mappedModelId);
        if (mappedModel) {
          const mappedProvider = mappedModel.provider;
          if (
            options.configuredProviders.includes(mappedProvider) &&
            !options.excludeProviders.includes(mappedProvider)
          ) {
            debug('Model mapping found: %s -> %s', originalModelId, mappedModelId);
            return [this.toCandidate(mappedModel)];
          }
        }
        debug(
          'Model mapping %s -> %s not usable (provider not configured or excluded)',
          originalModelId,
          mappedModelId,
        );
      }
    }

    // Step 4: Tier 1 query - capability match + same quality tier
    let models: ModelMetadata[] = [];
    if (options.originalQualityTier) {
      models = await this.catalog.listModels({
        capabilities: requiredCaps,
        qualityTier: options.originalQualityTier,
      });
      debug(
        'Tier 1 query (caps + tier %s): %d results',
        options.originalQualityTier,
        models.length,
      );
    }

    // Step 5: Filter to configured providers only
    let filtered = this.filterToConfigured(
      models,
      originalModelId,
      options.configuredProviders,
      options.excludeProviders,
    );

    // Step 6: Tier 2 fallback - capability match only (any quality tier)
    if (filtered.length === 0) {
      models = await this.catalog.listModels({
        capabilities: requiredCaps,
      });
      debug('Tier 2 query (caps only): %d results', models.length);

      filtered = this.filterToConfigured(
        models,
        originalModelId,
        options.configuredProviders,
        options.excludeProviders,
      );
    }

    debug('After configured provider filter: %d candidates', filtered.length);

    // Step 7: Context window check
    if (options.estimatedTokens !== undefined && options.estimatedTokens > 0) {
      filtered = filtered.filter((m) => m.contextWindow >= options.estimatedTokens!);
      debug(
        'After context window check (%d tokens): %d candidates',
        options.estimatedTokens,
        filtered.length,
      );
    }

    // Step 8: Rank candidates
    filtered.sort((a, b) => {
      const aFree = isFreeModel(a);
      const bFree = isFreeModel(b);
      const aUnknown = a.pricing === null;
      const bUnknown = b.pricing === null;

      // Free models first
      if (aFree && !bFree) return -1;
      if (!aFree && bFree) return 1;

      // Both free: sort by provider name for deterministic ordering
      if (aFree && bFree) {
        return a.provider.localeCompare(b.provider);
      }

      // Unknown pricing between free and paid
      if (aUnknown && !bUnknown) return -1;
      if (!aUnknown && bUnknown) return 1;

      // Both unknown: sort by provider name
      if (aUnknown && bUnknown) {
        return a.provider.localeCompare(b.provider);
      }

      // Both paid: cheapest first (by promptPer1MTokens)
      const aPrice = a.pricing?.promptPer1MTokens ?? Infinity;
      const bPrice = b.pricing?.promptPer1MTokens ?? Infinity;
      return aPrice - bPrice;
    });

    // Step 9: Budget gate - if budget remaining <= 0, filter out paid models
    if (options.budgetRemaining !== null && options.budgetRemaining <= 0) {
      filtered = filtered.filter((m) => isFreeModel(m));
      debug('Budget exhausted, filtered to free-only: %d candidates', filtered.length);
    }

    // Step 10: Convert to FallbackCandidate format and limit
    const candidates = filtered.slice(0, MAX_CANDIDATES).map((m) => this.toCandidate(m));

    debug('Final candidates: %d', candidates.length);
    return candidates;
  }

  /**
   * Filter models to configured providers only, excluding already-tried providers
   * and the original model itself.
   */
  private filterToConfigured(
    models: ModelMetadata[],
    originalModelId: string,
    configuredProviders: string[],
    excludeProviders: string[],
  ): ModelMetadata[] {
    return models.filter(
      (m) =>
        configuredProviders.includes(m.provider) &&
        !excludeProviders.includes(m.provider) &&
        m.id !== originalModelId,
    );
  }

  /**
   * Convert ModelMetadata to FallbackCandidate
   */
  private toCandidate(model: ModelMetadata): FallbackCandidate {
    return {
      provider: model.provider,
      modelId: model.id,
      modelName: model.id.substring(model.id.indexOf('/') + 1),
      qualityTier: model.qualityTier,
      capabilities: model.capabilities,
      pricing: model.pricing,
      contextWindow: model.contextWindow,
      isFree: isFreeModel(model),
    };
  }

  /**
   * Check if request params contain image content
   */
  private hasImageContent(params: Record<string, unknown>): boolean {
    try {
      // Check prompt messages for image_url type content
      const prompt = params['prompt'];
      if (!prompt) return false;

      // AI SDK v3+ prompt structure: array of messages
      if (!Array.isArray(prompt)) return false;

      for (const message of prompt) {
        if (!message || typeof message !== 'object') continue;
        const msg = message as Record<string, unknown>;

        // Check content parts for image type
        const content = msg['content'];
        if (Array.isArray(content)) {
          for (const part of content) {
            if (!part || typeof part !== 'object') continue;
            const p = part as Record<string, unknown>;
            if (p['type'] === 'image') return true;
          }
        }
      }
    } catch {
      // Defensive: never throw on unexpected shapes
    }
    return false;
  }
}
