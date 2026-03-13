import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { fetchModelsDev, fetchOpenRouter } from '../src/catalog/fetchers.js';
import type { ModelMetadata } from '../src/types/domain.js';
import type { QualityTierType } from '../src/constants/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Hardcoded quality tier mapping for enrichment
 * Based on model benchmarks and provider positioning
 */
const QUALITY_TIER_MAP: Record<string, QualityTierType> = {
  // Frontier tier
  'deepseek/deepseek-reasoner': 'frontier',
  'github/meta-llama-3.1-405b-instruct': 'frontier',

  // High tier
  'google/gemini-2.0-flash': 'high',
  'groq/llama-3.3-70b-versatile': 'high',
  'groq/mixtral-8x7b-32768': 'high',
  'cerebras/llama-3.3-70b': 'high',
  'deepseek/deepseek-chat': 'high',
  'qwen/qwen-2.5-72b-instruct': 'high',
  'qwen/qwen-2.5-coder-32b-instruct': 'high',
  'nvidia/llama-3.1-nemotron-70b-instruct': 'high',
  'cohere/command-r-plus': 'high',
  'cohere/command-r': 'high',

  // Mid tier
  'google/gemini-2.0-flash-lite': 'mid',
  'google/gemini-1.5-flash': 'mid',
  'groq/llama-3.1-8b-instant': 'mid',
  'openrouter/google/gemini-flash-1.5': 'mid',
  'mistral/mistral-small-latest': 'mid',
  'mistral/codestral-mamba-latest': 'mid',
  'cerebras/llama-3.1-8b': 'mid',
  'cloudflare/@cf/meta/llama-3.1-8b-instruct': 'mid',
  'github/gpt-4o-mini': 'mid',

  // Small tier
  'openrouter/meta-llama/llama-3.2-3b-instruct:free': 'small',
  'huggingface/meta-llama/Llama-3.2-3B-Instruct': 'small',
  'huggingface/microsoft/Phi-4': 'small',
  'cloudflare/@cf/meta/llama-3.2-3b-instruct': 'small',
  'nvidia/llama-3.2-3b-instruct': 'small',
  'github/phi-4': 'small',
};

async function generateCatalog() {
  console.log('Fetching models from APIs...');

  let modelsDev: ModelMetadata[] = [];
  let openRouter: ModelMetadata[] = [];

  // Fetch from models.dev
  try {
    modelsDev = await fetchModelsDev();
    console.log(`✓ Fetched ${modelsDev.length} models from models.dev`);
  } catch (error) {
    console.warn('⚠ Failed to fetch from models.dev:', error);
  }

  // Fetch from OpenRouter
  try {
    openRouter = await fetchOpenRouter();
    console.log(`✓ Fetched ${openRouter.length} models from OpenRouter`);
  } catch (error) {
    console.warn('⚠ Failed to fetch from OpenRouter:', error);
  }

  // Merge: models.dev primary, OpenRouter fills gaps
  const mergedMap = new Map<string, ModelMetadata>();

  for (const model of modelsDev) {
    mergedMap.set(model.id, model);
  }

  for (const model of openRouter) {
    if (!mergedMap.has(model.id)) {
      mergedMap.set(model.id, model);
    }
  }

  // Enrich quality tiers from hardcoded map
  const enriched: ModelMetadata[] = [];
  for (const [id, model] of mergedMap) {
    if (QUALITY_TIER_MAP[id]) {
      model.qualityTier = QUALITY_TIER_MAP[id];
    }
    enriched.push(model);
  }

  // Sort by provider then name for consistent output
  enriched.sort((a, b) => {
    if (a.provider !== b.provider) {
      return a.provider.localeCompare(b.provider);
    }
    return a.name.localeCompare(b.name);
  });

  // Write to static-catalog.json
  const catalogPath = join(__dirname, '../src/catalog/static-catalog.json');
  writeFileSync(catalogPath, JSON.stringify(enriched, null, 2), 'utf-8');

  console.log(`\n✓ Updated static-catalog.json with ${enriched.length} models`);
  console.log(`  Path: ${catalogPath}`);
}

generateCatalog().catch((error) => {
  console.error('Failed to generate catalog:', error);
  process.exit(1);
});
