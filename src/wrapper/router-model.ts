import { wrapLanguageModel } from 'ai';
import type { LanguageModelV3 } from '@ai-sdk/provider';
import type { Router } from '../config/index.js';
import { ProviderRegistry, createProviderInstanceAsync } from './provider-registry.js';
import { createRouterMiddleware } from './middleware.js';
import { randomUUID } from 'node:crypto';

/**
 * Create a wrapped LanguageModelV3 with router-managed key selection and usage tracking.
 * This is the standalone convenience function. For retry support with key rotation,
 * use router.wrapModel() instead (which integrates the retry proxy).
 */
export async function routerModel(
  router: Router,
  modelId: string,
  options?: {
    strategy?: string;
    estimatedTokens?: number;
    requestId?: string;
    registry?: ProviderRegistry;
  },
): Promise<LanguageModelV3> {
  // Select key using router
  const selection = await router.model(modelId, options);

  // Parse provider and model name from modelId
  const provider = modelId.substring(0, modelId.indexOf('/'));
  const modelName = modelId.substring(modelId.indexOf('/') + 1);

  // Get or create provider registry
  const registry = options?.registry ?? (await ProviderRegistry.createDefault());

  // Create base model with selected API key
  const baseModel = await createProviderInstanceAsync(registry, provider, modelName, selection.key);

  // Generate requestId if not provided
  const requestId = options?.requestId ?? randomUUID();

  // Mutable refs for middleware tracking (consistent with retry/fallback proxy pattern)
  const keyIndexRef = { current: selection.keyIndex };
  const providerRef = { current: provider };
  const modelIdRef = { current: modelId };

  // Create middleware for usage tracking
  // routerModel() is a convenience function; dry-run is always false (use router.wrapModel for dry-run)
  const middleware = createRouterMiddleware({
    providerRef,
    keyIndexRef,
    modelIdRef,
    tracker: router.usage,
    requestId,
    dryRun: false,
  });

  // Wrap model with middleware and return
  const wrappedModel = wrapLanguageModel({
    model: baseModel,
    middleware,
    modelId,
    providerId: 'pennyllm',
  });
  return wrappedModel;
}

/**
 * Create a curried model wrapper function
 * Useful for avoiding passing router on every call
 */
export function createModelWrapper(
  router: Router,
  registry?: ProviderRegistry,
): (
  modelId: string,
  options?: { strategy?: string; estimatedTokens?: number; requestId?: string },
) => Promise<LanguageModelV3> {
  let resolvedRegistry: ProviderRegistry | undefined = registry;

  return async (
    modelId: string,
    options?: { strategy?: string; estimatedTokens?: number; requestId?: string },
  ): Promise<LanguageModelV3> => {
    if (!resolvedRegistry) {
      resolvedRegistry = await ProviderRegistry.createDefault();
    }
    return routerModel(router, modelId, { ...options, registry: resolvedRegistry });
  };
}
