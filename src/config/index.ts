import debugFactory from 'debug';
import type { RouterConfig } from '../types/config.js';
import type { StorageBackend } from '../types/interfaces.js';
import { MemoryStorage } from '../storage/index.js';
import { ConfigError } from '../errors/config-error.js';
import { configSchema, type ConfigInput } from './schema.js';
import { loadConfigFile } from './loader.js';

const debug = debugFactory('llm-router:config');

/**
 * Router instance stub interface
 * Full implementation deferred to Phase 6+
 */
export interface Router {
  model: (modelId: string) => unknown;
  getUsage: () => Promise<unknown>;
  health: () => Promise<unknown>;
  getConfig: () => RouterConfig;
  storage: StorageBackend;
  close: () => Promise<void>;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  off: (event: string, handler: (...args: unknown[]) => void) => void;
}

/**
 * Create a router instance from configuration
 * Currently a stub that validates config and returns placeholder
 * Full implementation in Phase 6+
 * @param configOrPath - Configuration object or path to config file
 * @param options - Optional configuration options
 * @param options.storage - Custom storage backend (defaults to MemoryStorage)
 * @returns Router instance (stub)
 * @throws {ConfigError} If configuration is invalid
 */
// eslint-disable-next-line @typescript-eslint/require-await
export async function createRouter(
  configOrPath: ConfigInput | string,
  options?: { storage?: StorageBackend },
): Promise<Router> {
  let config: RouterConfig;

  try {
    if (typeof configOrPath === 'string') {
      // Load from file
      config = loadConfigFile(configOrPath);
    } else {
      // Validate object
      config = configSchema.parse(configOrPath) as RouterConfig;
    }

    // Resolve storage backend
    const storage = options?.storage ?? new MemoryStorage();

    debug('Router created with config (keys redacted)');

    // Return stub implementation
    return {
      model: (modelId: string) => {
        debug('model() stub called with: %s', modelId);
        return {};
      },
      // eslint-disable-next-line @typescript-eslint/require-await
      getUsage: async () => {
        debug('getUsage() stub called');
        return {};
      },
      // eslint-disable-next-line @typescript-eslint/require-await
      health: async () => {
        debug('health() stub called');
        return { status: 'ok' };
      },
      getConfig: () => config,
      storage,

      close: async () => {
        debug('close() stub called');
        await storage.close();
      },
      on: (event: string) => {
        debug('on() stub called for event: %s', event);
      },
      off: (event: string) => {
        debug('off() stub called for event: %s', event);
      },
    };
  } catch (error) {
    if (error instanceof ConfigError) {
      throw error;
    }
    const options: { field?: string; cause?: Error } = {};
    if (error instanceof Error) {
      options.cause = error;
    }
    throw new ConfigError('Failed to create router', options);
  }
}

// Re-exports
export { configSchema } from './schema.js';
export { loadConfigFile } from './loader.js';
export { defineConfig } from './define-config.js';
export { DEFAULT_CONFIG } from './defaults.js';
export type { ConfigInput, ConfigOutput } from './schema.js';
