import { ConfigError } from '../errors/config-error.js';
import type { ProviderModelDef, ProviderModule } from './types.js';

const models = [
  {
    id: 'github/gpt-4o',
    apiId: 'gpt-4o',
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
    id: 'github/gpt-4o-mini',
    apiId: 'gpt-4o-mini',
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
    id: 'github/o3-mini',
    apiId: 'o3-mini',
    qualityTier: 'frontier',
    free: true,
    capabilities: {
      toolCall: false,
      reasoning: true,
      vision: false,
      structuredOutput: true,
    },
  },
  {
    id: 'github/o4-mini',
    apiId: 'o4-mini',
    qualityTier: 'frontier',
    free: true,
    capabilities: {
      toolCall: true,
      reasoning: true,
      vision: true,
      structuredOutput: true,
    },
  },
] as const satisfies readonly ProviderModelDef[];

export const githubModelsProvider: ProviderModule = {
  id: 'github',
  name: 'GitHub Models',
  sdkPackage: '@ai-sdk/openai-compatible',
  envVar: 'GITHUB_TOKEN',
  lastVerified: '2026-03-15',
  updateUrl: 'https://github.com/marketplace/models',
  tier: 'free',
  models,
  async createFactory(apiKey: string) {
    try {
      const { createOpenAICompatible } = await import('@ai-sdk/openai-compatible');
      const p = createOpenAICompatible({
        name: 'github-models',
        baseURL: 'https://models.inference.ai.azure.com',
        apiKey,
      });
      return (modelId: string) => p.chatModel(modelId);
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
