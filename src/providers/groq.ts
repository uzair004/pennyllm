import { ConfigError } from '../errors/config-error.js';
import type { ProviderModelDef, ProviderModule } from './types.js';

const models = [
  {
    id: 'groq/meta-llama/llama-4-scout-17b-16e-instruct',
    apiId: 'meta-llama/llama-4-scout-17b-16e-instruct',
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
    id: 'groq/llama-3.3-70b-versatile',
    apiId: 'llama-3.3-70b-versatile',
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
    id: 'groq/qwen/qwen3-32b',
    apiId: 'qwen/qwen3-32b',
    qualityTier: 'mid',
    free: true,
    capabilities: {
      toolCall: true,
      reasoning: true,
      vision: false,
      structuredOutput: true,
    },
  },
  {
    id: 'groq/moonshotai/kimi-k2-instruct',
    apiId: 'moonshotai/kimi-k2-instruct',
    qualityTier: 'frontier',
    free: true,
    capabilities: {
      toolCall: true,
      reasoning: false,
      vision: false,
      structuredOutput: true,
    },
  },
] as const satisfies readonly ProviderModelDef[];

export const groqProvider: ProviderModule = {
  id: 'groq',
  name: 'Groq',
  sdkPackage: '@ai-sdk/groq',
  envVar: 'GROQ_API_KEY',
  lastVerified: '2026-03-15',
  updateUrl: 'https://console.groq.com/docs/models',
  tier: 'free',
  models,
  async createFactory(apiKey: string) {
    try {
      const { createGroq } = await import('@ai-sdk/groq');
      const p = createGroq({ apiKey });
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
