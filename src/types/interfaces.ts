import type { ModelMetadata, TimeWindow, UsageRecord } from './domain.js';
import type { ModelListFilter } from '../catalog/types.js';
import type { SelectionContext, SelectionResult } from '../selection/types.js';

/**
 * Structured usage data returned by StorageBackend.getUsage()
 */
export interface StructuredUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  callCount: number;
}

/**
 * Storage backend interface for persistence layer
 */
export interface StorageBackend {
  /**
   * Retrieve usage records for a specific key
   */
  get(key: string): Promise<UsageRecord[]>;

  /**
   * Store a usage record
   */
  put(record: UsageRecord): Promise<void>;

  /**
   * Increment usage for a key and return the updated record
   * @param callCount Optional call count to increment (defaults to 0)
   */
  increment(
    provider: string,
    keyIndex: number,
    tokens: { prompt: number; completion: number },
    window: TimeWindow,
    callCount?: number,
  ): Promise<UsageRecord>;

  /**
   * Get current usage for a key within a time window
   * Returns structured usage data with token counts and call count
   */
  getUsage(provider: string, keyIndex: number, window: TimeWindow): Promise<StructuredUsage>;

  /**
   * Reset usage for a key within a time window
   */
  reset(provider: string, keyIndex: number, window: TimeWindow): Promise<void>;

  /**
   * Reset all usage data, optionally filtered by provider and/or key
   */
  resetAll(provider?: string, keyIndex?: number): Promise<void>;

  /**
   * Close the storage backend and cleanup resources
   */
  close(): Promise<void>;
}

/**
 * Model catalog interface for model metadata
 */
export interface ModelCatalog {
  /**
   * Get metadata for a specific model
   */
  getModel(modelId: string): Promise<ModelMetadata | null>;

  /**
   * List all models with optional filtering
   */
  listModels(filter?: ModelListFilter): Promise<ModelMetadata[]>;

  /**
   * Get capabilities for a specific model
   */
  getCapabilities(modelId: string): Promise<ModelMetadata['capabilities'] | null>;

  /**
   * Refresh the model catalog from upstream sources
   */
  refresh(): Promise<void>;

  /**
   * Close the catalog and cleanup resources
   */
  close(): Promise<void>;
}

/**
 * Selection strategy interface for key selection
 */
export interface SelectionStrategy {
  /**
   * Strategy name
   */
  name: string;

  /**
   * Select a key from available candidates
   */
  selectKey(context: SelectionContext): Promise<SelectionResult>;
}
