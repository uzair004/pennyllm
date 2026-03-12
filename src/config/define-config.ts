import type { ConfigInput } from './schema.js';

/**
 * Type-safe config helper for IDE autocomplete
 * Identity function with zero runtime cost
 * @param config - Router configuration
 * @returns The same configuration object
 */
export function defineConfig(config: ConfigInput): ConfigInput {
  return config;
}
