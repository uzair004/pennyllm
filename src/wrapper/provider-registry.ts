import type { LanguageModelV3 } from '@ai-sdk/provider';
import debugFactory from 'debug';
import { ConfigError } from '../errors/config-error.js';

const debug = debugFactory('llm-router:registry');

/**
 * Provider factory function type
 * Matches the shape of AI SDK provider factories (createGoogleGenerativeAI, createOpenAI, etc.)
 */
export type ProviderFactory = (options: { apiKey: string }) => (modelId: string) => LanguageModelV3;

/**
 * Registry for AI SDK provider factories
 * Maps provider names (e.g., "google", "openai") to their factory functions
 */
export class ProviderRegistry {
  private factories: Map<string, ProviderFactory> = new Map();

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
   * Check if a provider is registered
   */
  has(providerName: string): boolean {
    return this.factories.has(providerName);
  }

  /**
   * Create a default registry with dynamically loaded providers
   * Providers are optional peer dependencies, so we try to load them
   */
  static async createDefault(): Promise<ProviderRegistry> {
    const registry = new ProviderRegistry();

    // Try to load @ai-sdk/google
    try {
      const googleModule = await import('@ai-sdk/google');
      registry.register('google', googleModule.createGoogleGenerativeAI);
      debug('Loaded @ai-sdk/google');
    } catch (err) {
      debug('Failed to load @ai-sdk/google: %s', err instanceof Error ? err.message : String(err));
    }

    return registry;
  }
}

/**
 * Create a provider instance from the registry
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
