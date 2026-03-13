import type { QualityTierType } from '../constants/index.js';
import type { ModelMetadata } from '../types/domain.js';

/**
 * Filter options for listing models
 */
export interface ModelListFilter {
  provider?: string;
  capabilities?: Partial<ModelMetadata['capabilities']>;
  qualityTier?: QualityTierType;
  maxPrice?: number; // max promptPer1MTokens
}

/**
 * Catalog refresh event payload
 */
export interface CatalogRefreshedEvent {
  source: 'live' | 'cache' | 'static';
  modelsAdded: number;
  modelsRemoved: number;
  unchanged: number;
  timestamp: number;
}
