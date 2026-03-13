import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import debugFactory from 'debug';
import type { ModelCatalog } from '../types/interfaces.js';
import type { ModelMetadata } from '../types/domain.js';
import type { ModelListFilter, CatalogRefreshedEvent } from './types.js';
import { fetchModelsDev, fetchOpenRouter } from './fetchers.js';
import { RouterEvent, ModelStatus } from '../constants/index.js';

const debug = debugFactory('llm-router:catalog');

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Default implementation of ModelCatalog that fetches from live APIs
 * with in-memory caching and static fallback
 */
export class DefaultModelCatalog implements ModelCatalog {
  private cache: Map<string, ModelMetadata> | null = null;
  private cacheTimestamp = 0;
  private inflightFetch: Promise<void> | null = null;
  private abortController: AbortController | null = null;
  private closed = false;

  constructor(
    private emitter: EventEmitter,
    private options: { fetchFn?: typeof fetch } = {},
  ) {}

  /**
   * Get metadata for a specific model
   */
  async getModel(modelId: string): Promise<ModelMetadata | null> {
    await this.ensureLoaded();
    return this.cache?.get(modelId) ?? null;
  }

  /**
   * List all models with optional filtering
   */
  async listModels(filter?: ModelListFilter): Promise<ModelMetadata[]> {
    await this.ensureLoaded();

    if (!this.cache) {
      return [];
    }

    let models = Array.from(this.cache.values());

    // Filter out deprecated models by default
    models = models.filter((m) => m.status !== ModelStatus.DEPRECATED);

    if (!filter) {
      return models;
    }

    // Apply filters
    if (filter.provider) {
      models = models.filter((m) => m.provider === filter.provider);
    }

    if (filter.capabilities) {
      models = models.filter((m) => {
        for (const [cap, required] of Object.entries(filter.capabilities!)) {
          if (required && !m.capabilities[cap as keyof typeof m.capabilities]) {
            return false;
          }
        }
        return true;
      });
    }

    if (filter.qualityTier) {
      models = models.filter((m) => m.qualityTier === filter.qualityTier);
    }

    if (filter.maxPrice !== undefined) {
      models = models.filter((m) => {
        if (!m.pricing) {
          return false;
        }
        // Include free models
        if (m.pricing.promptPer1MTokens === 0) {
          return true;
        }
        return m.pricing.promptPer1MTokens <= filter.maxPrice!;
      });
    }

    return models;
  }

  /**
   * Get capabilities for a specific model
   */
  async getCapabilities(
    modelId: string,
  ): Promise<ModelMetadata['capabilities'] | null> {
    await this.ensureLoaded();
    const model = this.cache?.get(modelId);
    return model?.capabilities ?? null;
  }

  /**
   * Refresh the model catalog from upstream sources
   */
  async refresh(): Promise<void> {
    if (this.inflightFetch) {
      debug('Refresh already in progress, awaiting existing fetch');
      await this.inflightFetch;
      return;
    }

    await this.doRefresh();
  }

  /**
   * Close the catalog and cleanup resources
   */
  async close(): Promise<void> {
    this.closed = true;

    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    this.cache = null;
    this.inflightFetch = null;
    this.cacheTimestamp = 0;
  }

  /**
   * Ensure catalog is loaded before operations
   */
  private async ensureLoaded(): Promise<void> {
    if (this.closed) {
      throw new Error('Catalog has been closed');
    }

    // Check if cache exists and is not expired
    if (this.cache && Date.now() - this.cacheTimestamp < CACHE_TTL_MS) {
      debug('Using cached catalog');
      return;
    }

    // If cache expired, refresh
    if (this.cache) {
      debug('Cache expired, refreshing');
    }

    // If refresh is already in progress, await it
    if (this.inflightFetch) {
      debug('Refresh in progress, awaiting');
      await this.inflightFetch;
      return;
    }

    // Otherwise trigger refresh
    await this.doRefresh();
  }

  /**
   * Perform the actual catalog refresh
   */
  private async doRefresh(): Promise<void> {
    const fetchFn = this.options.fetchFn ?? fetch;
    const previousCache = this.cache ? new Map(this.cache) : null;

    // Set up inflight tracking
    const refreshPromise = (async () => {
      this.abortController = new AbortController();

      try {
        debug('Fetching from live APIs');

        // Fetch from both APIs
        const [modelsDevData, openRouterData] = await Promise.allSettled([
          fetchModelsDev(fetchFn),
          fetchOpenRouter(fetchFn),
        ]);

        // Merge results: models.dev primary, OpenRouter fills gaps
        const merged = new Map<string, ModelMetadata>();

        if (modelsDevData.status === 'fulfilled') {
          for (const model of modelsDevData.value) {
            merged.set(model.id, model);
          }
          debug(`Merged ${modelsDevData.value.length} models from models.dev`);
        } else {
          debug('models.dev fetch failed:', modelsDevData.reason);
        }

        if (openRouterData.status === 'fulfilled') {
          let added = 0;
          for (const model of openRouterData.value) {
            if (!merged.has(model.id)) {
              merged.set(model.id, model);
              added++;
            }
          }
          debug(`Added ${added} models from OpenRouter`);
        } else {
          debug('OpenRouter fetch failed:', openRouterData.reason);
        }

        // If both failed and we have no existing cache, fall back to static
        if (merged.size === 0 && !previousCache) {
          debug('Both APIs failed and no cache, falling back to static snapshot');
          await this.loadStaticSnapshot();
          return;
        }

        // If we got some data, enrich quality tiers from static snapshot
        if (merged.size > 0) {
          const staticData = this.loadStaticData();
          const tierMap = new Map<string, ModelMetadata['qualityTier']>();

          for (const model of staticData) {
            tierMap.set(model.id, model.qualityTier);
          }

          for (const [id, model] of merged) {
            const tier = tierMap.get(id);
            if (tier) {
              model.qualityTier = tier;
            }
          }

          debug('Enriched quality tiers from static snapshot');
        }

        // Calculate diff
        const diff = this.calculateDiff(previousCache, merged);

        // Update cache
        this.cache = merged;
        this.cacheTimestamp = Date.now();

        // Emit refresh event
        const event: CatalogRefreshedEvent = {
          source: 'live',
          modelsAdded: diff.added,
          modelsRemoved: diff.removed,
          unchanged: diff.unchanged,
          timestamp: this.cacheTimestamp,
        };

        this.emitter.emit(RouterEvent.CATALOG_REFRESHED, event);
        debug(`Catalog refreshed: ${merged.size} models (source: live)`);
      } catch (error) {
        debug('Refresh failed:', error);

        // If we have a stale cache, keep using it
        if (previousCache) {
          debug('Keeping stale cache after refresh failure');
          this.cache = previousCache;

          const event: CatalogRefreshedEvent = {
            source: 'cache',
            modelsAdded: 0,
            modelsRemoved: 0,
            unchanged: previousCache.size,
            timestamp: this.cacheTimestamp,
          };

          this.emitter.emit(RouterEvent.CATALOG_REFRESHED, event);
        } else {
          // Fall back to static snapshot
          debug('No cache available, falling back to static snapshot');
          await this.loadStaticSnapshot();
        }
      } finally {
        this.abortController = null;
        this.inflightFetch = null;
      }
    })();

    this.inflightFetch = refreshPromise;
    await refreshPromise;
  }

  /**
   * Load static snapshot as fallback
   */
  private async loadStaticSnapshot(): Promise<void> {
    try {
      const staticData = this.loadStaticData();
      const staticMap = new Map<string, ModelMetadata>();

      for (const model of staticData) {
        staticMap.set(model.id, model);
      }

      this.cache = staticMap;
      this.cacheTimestamp = Date.now();

      const event: CatalogRefreshedEvent = {
        source: 'static',
        modelsAdded: staticMap.size,
        modelsRemoved: 0,
        unchanged: 0,
        timestamp: this.cacheTimestamp,
      };

      this.emitter.emit(RouterEvent.CATALOG_REFRESHED, event);
      debug(`Loaded static snapshot: ${staticMap.size} models`);
    } catch (error) {
      debug('Failed to load static snapshot:', error);
      throw new Error('Failed to load model catalog: all sources unavailable');
    }
  }

  /**
   * Load static catalog data from bundled JSON
   */
  private loadStaticData(): ModelMetadata[] {
    const staticPath = fileURLToPath(
      new URL('./static-catalog.json', import.meta.url),
    );
    const content = readFileSync(staticPath, 'utf-8');
    return JSON.parse(content) as ModelMetadata[];
  }

  /**
   * Calculate diff between old and new catalog
   */
  private calculateDiff(
    oldCache: Map<string, ModelMetadata> | null,
    newCache: Map<string, ModelMetadata>,
  ): { added: number; removed: number; unchanged: number } {
    if (!oldCache) {
      return {
        added: newCache.size,
        removed: 0,
        unchanged: 0,
      };
    }

    let added = 0;
    let removed = 0;
    let unchanged = 0;

    // Count new models
    for (const id of newCache.keys()) {
      if (!oldCache.has(id)) {
        added++;
      } else {
        unchanged++;
      }
    }

    // Count removed models
    for (const id of oldCache.keys()) {
      if (!newCache.has(id)) {
        removed++;
      }
    }

    return { added, removed, unchanged };
  }
}
