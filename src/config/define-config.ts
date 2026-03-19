import type { ProviderType } from '../constants/index.js';
import type { ConfigInput } from './schema.js';

/**
 * Provider name type that autocompletes known providers while accepting custom strings.
 * The `string & {}` intersection prevents TypeScript from widening to plain `string`,
 * preserving IDE autocomplete suggestions for known provider names.
 */
type ProviderName = ProviderType | (string & {});

/**
 * Config input with typed provider names for IDE autocomplete.
 * Known providers (google, groq, openrouter, etc.) appear as suggestions,
 * while custom provider strings are still accepted.
 */
type TypedConfigInput = Omit<ConfigInput, 'providers'> & {
  providers: Partial<Record<ProviderName, ConfigInput['providers'][string]>>;
};

/**
 * Type-safe config helper for IDE autocomplete.
 * Identity function with zero runtime cost.
 *
 * Provides autocomplete for the 6 known provider names while
 * accepting any custom provider string.
 *
 * @param config - Router configuration with typed provider names
 * @returns The same configuration object
 */
export function defineConfig(config: TypedConfigInput): ConfigInput {
  return config as ConfigInput;
}
