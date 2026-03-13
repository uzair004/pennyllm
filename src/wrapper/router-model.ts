import { wrapLanguageModel } from 'ai';
import type { LanguageModelV3 } from '@ai-sdk/provider';
import type { Router } from '../config/index.js';
import { ProviderRegistry, createProviderInstance } from './provider-registry.js';
import { createRouterMiddleware } from './middleware.js';
import { randomUUID } from 'node:crypto';

/**
 * Create a wrapped LanguageModelV3 with router-managed key selection and usage tracking
 * This is the user-facing integration between the router and Vercel AI SDK
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
  const baseModel = createProviderInstance(registry, provider, modelName, selection.key);

  // Generate requestId if not provided
  const requestId = options?.requestId ?? randomUUID();

  // Create middleware for usage tracking
  const middleware = createRouterMiddleware({
    provider,
    keyIndex: selection.keyIndex,
    model: modelName,
    tracker: router.usage,
    requestId,
  });

  // Wrap model with middleware and return
  const wrappedModel = wrapLanguageModel({
    model: baseModel,
    middleware,
    modelId,
    providerId: 'llm-router',
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
