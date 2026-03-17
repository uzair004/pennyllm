import { ConfigError } from '../errors/config-error.js';
import type { ProviderModelDef, ProviderModule } from './types.js';

const models = [
  {
    id: 'cerebras/gpt-oss-120b',
    apiId: 'gpt-oss-120b',
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
    id: 'cerebras/qwen-3-235b-a22b-instruct-2507',
    apiId: 'qwen-3-235b-a22b-instruct-2507',
    qualityTier: 'frontier',
    free: true,
    capabilities: {
      toolCall: true,
      reasoning: true,
      vision: false,
      structuredOutput: true,
    },
  },
  {
    id: 'cerebras/llama3.1-8b',
    apiId: 'llama3.1-8b',
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
    id: 'cerebras/zai-glm-4.7',
    apiId: 'zai-glm-4.7',
    qualityTier: 'high',
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
  lastVerified: '2026-03-17',
  updateUrl: 'https://inference-docs.cerebras.ai/api-reference/chat-completions',
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
