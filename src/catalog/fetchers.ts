import { z } from 'zod';
import type { ModelMetadata } from '../types/domain.js';
import { ModelStatus } from '../constants/index.js';
import debugFactory from 'debug';

const debug = debugFactory('llm-router:catalog');

/**
 * Zod schema for models.dev API entry
 */
const modelsDevEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  tool_call: z.boolean().optional(),
  structured_output: z.boolean().optional(),
  reasoning: z.boolean().optional(),
  cost: z
    .object({
      input: z.number().optional(),
      output: z.number().optional(),
    })
    .optional(),
  limit: z
    .object({
      context: z.number().optional(),
      output: z.number().optional(),
    })
    .optional(),
});

/**
 * Zod schema for OpenRouter API entry
 */
const openRouterEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  context_length: z.number().optional(),
  pricing: z
    .object({
      prompt: z.string().optional(),
      completion: z.string().optional(),
    })
    .optional(),
  architecture: z
    .object({
      modality: z.string().optional(),
      tokenizer: z.string().optional(),
    })
    .optional(),
});

/**
 * Fetch model metadata from models.dev API
 */
export async function fetchModelsDev(fetchFn: typeof fetch = fetch): Promise<ModelMetadata[]> {
  try {
    const response = await fetchFn('https://models.dev/api.json', {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`models.dev API returned ${response.status}`);
    }

    const data = await response.json();

    // Handle response format - nested provider→models structure or flat array
    let entries: unknown[] = [];
    if (Array.isArray(data)) {
      entries = data;
    } else if (data && typeof data === 'object') {
      for (const providerObj of Object.values(data as Record<string, unknown>)) {
        if (
          providerObj &&
          typeof providerObj === 'object' &&
          'models' in providerObj &&
          providerObj.models &&
          typeof providerObj.models === 'object'
        ) {
          for (const model of Object.values(providerObj.models as Record<string, unknown>)) {
            entries.push(model);
          }
        }
      }
    }

    const models: ModelMetadata[] = [];
    let skipped = 0;

    for (const entry of entries) {
      const parsed = modelsDevEntrySchema.safeParse(entry);
      if (!parsed.success) {
        skipped++;
        continue;
      }

      const model = parsed.data;
      const provider = extractProviderFromId(model.id);

      // Normalize pricing to per-1M-tokens (cost fields are per-token)
      let pricing: ModelMetadata['pricing'] = null;
      if (model.cost) {
        const promptPrice = model.cost.input ?? 0;
        const completionPrice = model.cost.output ?? 0;
        pricing = {
          promptPer1MTokens: promptPrice * 1_000_000,
          completionPer1MTokens: completionPrice * 1_000_000,
        };
      }

      models.push({
        id: model.id,
        provider,
        name: model.name,
        capabilities: {
          reasoning: model.reasoning ?? false,
          toolCall: model.tool_call ?? false,
          structuredOutput: model.structured_output ?? false,
          vision: false,
        },
        qualityTier: 'mid', // Default, overridden by static snapshot
        contextWindow: model.limit?.context ?? 0,
        pricing,
        status: ModelStatus.ACTIVE,
      });
    }

    if (skipped > 0) {
      debug(`models.dev: skipped ${skipped} invalid entries`);
    }
    debug(`models.dev: fetched ${models.length} models`);

    return models;
  } catch (error) {
    debug('models.dev fetch failed:', error);
    throw error;
  }
}

/**
 * Fetch model metadata from OpenRouter API
 */
export async function fetchOpenRouter(fetchFn: typeof fetch = fetch): Promise<ModelMetadata[]> {
  try {
    const response = await fetchFn('https://openrouter.ai/api/v1/models', {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API returned ${response.status}`);
    }

    const json: unknown = await response.json();
    const data = (json && typeof json === 'object' && 'data' in json ? json.data : []) as unknown[];

    const models: ModelMetadata[] = [];
    let skipped = 0;

    for (const entry of data) {
      const parsed = openRouterEntrySchema.safeParse(entry);
      if (!parsed.success) {
        skipped++;
        continue;
      }

      const model = parsed.data;
      const provider = extractProviderFromId(model.id);

      // Convert pricing from per-token strings to per-1M-tokens numbers
      let pricing: ModelMetadata['pricing'] = null;
      if (model.pricing?.prompt || model.pricing?.completion) {
        const promptPrice = parseFloat(model.pricing.prompt || '0');
        const completionPrice = parseFloat(model.pricing.completion || '0');
        pricing = {
          promptPer1MTokens: promptPrice * 1_000_000,
          completionPer1MTokens: completionPrice * 1_000_000,
        };
      }

      // Infer vision from modality if available
      const vision = model.architecture?.modality?.toLowerCase().includes('vision') ?? false;

      models.push({
        id: model.id,
        provider,
        name: model.name,
        capabilities: {
          reasoning: false,
          toolCall: false,
          structuredOutput: false,
          vision,
        },
        qualityTier: 'mid', // Default, overridden by static snapshot
        contextWindow: model.context_length ?? 0,
        pricing,
        status: ModelStatus.ACTIVE,
      });
    }

    if (skipped > 0) {
      debug(`OpenRouter: skipped ${skipped} invalid entries`);
    }
    debug(`OpenRouter: fetched ${models.length} models`);

    return models;
  } catch (error) {
    debug('OpenRouter fetch failed:', error);
    throw error;
  }
}

/**
 * Extract provider from model ID (e.g., 'google/gemini-2.0-flash' -> 'google')
 */
function extractProviderFromId(id: string): string {
  const parts = id.split('/');
  return parts.length > 1 ? parts[0]! : 'unknown';
}
