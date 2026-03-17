import { ConfigError } from '../errors/config-error.js';
import type { ProviderModelDef, ProviderModule } from './types.js';

const models = [
  {
    id: 'cerebras/llama-4-maverick',
    apiId: 'llama-4-maverick',
    qualityTier: 'frontier',
    free: true,
    capabilities: {
      toolCall: true,
      reasoning: false,
      vision: true,
      structuredOutput: true,
    },
  },
  {
    id: 'cerebras/llama-4-scout',
    apiId: 'llama-4-scout',
    qualityTier: 'high',
    free: true,
    capabilities: {
      toolCall: true,
      reasoning: false,
      vision: true,
      structuredOutput: true,
    },
  },
  {
    id: 'cerebras/llama3.3-70b',
    apiId: 'llama3.3-70b',
    qualityTier: 'high',
    free: true,
    capabilities: {
      toolCall: true,
      reasoning: false,
      vision: false,
      structuredOutput: true,
    },
  },
  {
    id: 'cerebras/qwen-3-32b',
    apiId: 'qwen-3-32b',
    qualityTier: 'mid',
    free: true,
    capabilities: {
      toolCall: true,
      reasoning: true,
      vision: false,
      structuredOutput: true,
    },
  },
] as const satisfies readonly ProviderModelDef[];

export const cerebrasProvider: ProviderModule = {
  id: 'cerebras',
  name: 'Cerebras',
  sdkPackage: '@ai-sdk/cerebras',
  envVar: 'CEREBRAS_API_KEY',
  lastVerified: '2026-03-15',
  updateUrl: 'https://cloud.cerebras.ai',
  tier: 'free',
  models,
  async createFactory(apiKey: string) {
    try {
      const { createCerebras } = await import('@ai-sdk/cerebras');

      const p = createCerebras({ apiKey });

      return (modelId: string) => p(modelId);
    } catch (err) {
      if (err instanceof Error && 'code' in err && err.code === 'MODULE_NOT_FOUND') {
        throw new ConfigError(
          `Install ${this.sdkPackage} to use ${this.id} provider: npm install ${this.sdkPackage}`,
          { field: 'provider' },
        );
      }
      throw err;
    }
  },
};
