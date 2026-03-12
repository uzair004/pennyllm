import type { ModelMetadata, TimeWindow, UsageRecord } from './domain.js';

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
   */
  increment(
    provider: string,
    keyIndex: number,
    tokens: { prompt: number; completion: number },
    window: TimeWindow,
  ): Promise<UsageRecord>;

  /**
   * Get current usage for a key within a time window
   */
  getUsage(provider: string, keyIndex: number, window: TimeWindow): Promise<number>;

  /**
   * Reset usage for a key within a time window
   */
  reset(provider: string, keyIndex: number, window: TimeWindow): Promise<void>;

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
   * List all models, optionally filtered by provider
   */
  listModels(provider?: string): Promise<ModelMetadata[]>;

  /**
   * Get capabilities for a specific model
   */
  getCapabilities(modelId: string): Promise<ModelMetadata['capabilities'] | null>;

  /**
   * Refresh the model catalog from upstream sources
   */
  refresh(): Promise<void>;
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
   * Select a key from available keys based on usage
   */
  selectKey(
    provider: string,
    availableKeys: string[],
    usage: Map<number, UsageRecord[]>,
  ): Promise<{ keyIndex: number; reason: string }>;
}
