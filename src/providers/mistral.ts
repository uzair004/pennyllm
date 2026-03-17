import { ConfigError } from '../errors/config-error.js';
import type { ProviderModelDef, ProviderModule } from './types.js';

const models = [
  {
    id: 'mistral/mistral-large-latest',
    apiId: 'mistral-large-latest',
    qualityTier: 'frontier',
    free: true,
    capabilities: {
      toolCall: true,
      reasoning: false,
      vision: false,
      structuredOutput: true,
    },
  },
  {
    id: 'mistral/mistral-small-latest',
    apiId: 'mistral-small-latest',
    qualityTier: 'mid',
    free: true,
    capabilities: {
      toolCall: true,
      reasoning: false,
      vision: false,
      structuredOutput: true,
    },
  },
  {
    id: 'mistral/codestral-latest',
    apiId: 'codestral-latest',
    qualityTier: 'high',
    free: true,
    capabilities: {
      toolCall: false,
      reasoning: false,
      vision: false,
      structuredOutput: false,
    },
  },
  {
    id: 'mistral/pixtral-large-latest',
    apiId: 'pixtral-large-latest',
    qualityTier: 'high',
    free: true,
    capabilities: {
      toolCall: true,
      reasoning: false,
      vision: true,
      structuredOutput: true,
    },
  },
] as const satisfies readonly ProviderModelDef[];

export const mistralProvider: ProviderModule = {
  id: 'mistral',
  name: 'Mistral',
  sdkPackage: '@ai-sdk/mistral',
  envVar: 'MISTRAL_API_KEY',
  lastVerified: '2026-03-15',
  updateUrl: 'https://docs.mistral.ai/getting-started/models/models_overview/',
  tier: 'free',
  models,
  async createFactory(apiKey: string) {
    try {
      const { createMistral } = await import('@ai-sdk/mistral');
      const p = createMistral({ apiKey });
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
