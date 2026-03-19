import type { LanguageModelV3 } from '@ai-sdk/provider';
import debugFactory from 'debug';
import { ConfigError } from '../errors/config-error.js';

const debug = debugFactory('pennyllm:registry');

/**
 * Provider factory function type
 * Matches the shape of AI SDK provider factories (createGoogleGenerativeAI, createOpenAI, etc.)
 */
export type ProviderFactory = (options: { apiKey: string }) => (modelId: string) => LanguageModelV3;

/**
 * Async provider factory for provider modules with async createFactory.
 */
export type AsyncProviderFactory = (
  apiKey: string,
) => Promise<(modelId: string) => LanguageModelV3>;

/**
 * Registry for AI SDK provider factories
 * Maps provider names (e.g., "google", "openai") to their factory functions
 */
export class ProviderRegistry {
  private factories: Map<string, ProviderFactory> = new Map();
  private asyncFactories: Map<string, AsyncProviderFactory> = new Map();

  /**
   * Register a provider factory
   */
  register(providerName: string, factory: ProviderFactory): void {
    this.factories.set(providerName, factory);
    debug('Registered provider: %s', providerName);
  }

  /**
   * Get a registered provider factory
   */
  get(providerName: string): ProviderFactory | undefined {
    return this.factories.get(providerName);
  }

  /**
   * Check if a provider is registered (sync or async)
   */
  has(providerName: string): boolean {
    return this.factories.has(providerName) || this.asyncFactories.has(providerName);
  }

  /**
   * Register an async provider factory (from provider modules)
   */
  registerAsync(providerName: string, factory: AsyncProviderFactory): void {
    this.asyncFactories.set(providerName, factory);
    debug('Registered async provider: %s', providerName);
  }

  /**
   * Get a registered async provider factory
   */
  getAsync(providerName: string): AsyncProviderFactory | undefined {
    return this.asyncFactories.get(providerName);
  }

  /**
   * Create a default registry with dynamically loaded providers
   * Providers are optional peer dependencies, so we try to load them
   */
  static async createDefault(): Promise<ProviderRegistry> {
    const registry = new ProviderRegistry();

    // Register all active provider modules (handles missing SDKs gracefully via createFactory)
    const { getAllProviders } = await import('../providers/registry.js');
    for (const mod of getAllProviders()) {
      registry.registerAsync(mod.id, mod.createFactory.bind(mod));
    }

    return registry;
  }
}

/**
 * Create a provider instance from the registry, trying async factories first.
 * Used by ChainExecutor and other components that need async provider creation.
 * @throws ConfigError if provider is not registered
 */
export async function createProviderInstanceAsync(
  registry: ProviderRegistry,
  provider: string,
  modelName: string,
  apiKey: string,
): Promise<LanguageModelV3> {
  const asyncFactory = registry.getAsync(provider);
  if (asyncFactory) {
    const factory = await asyncFactory(apiKey);
    return factory(modelName);
  }
  // Fall back to sync factory
  return createProviderInstance(registry, provider, modelName, apiKey);
}

/**
 * Create a provider instance from the registry (sync)
 * @throws ConfigError if provider is not registered
 */
export function createProviderInstance(
  registry: ProviderRegistry,
  provider: string,
  modelName: string,
  apiKey: string,
): LanguageModelV3 {
  const factory = registry.get(provider);

  if (!factory) {
    throw new ConfigError(
      `Provider '${provider}' not registered. Install @ai-sdk/${provider} and register it.`,
      {
        field: 'provider',
      },
    );
  }

  const providerInstance = factory({ apiKey });
  return providerInstance(modelName);
}
