import { ConfigError } from '../errors/config-error.js';
import type { ProviderModelDef, ProviderModule } from './types.js';

const models = [
  {
    id: 'google/gemini-2.5-flash',
    apiId: 'gemini-2.5-flash',
    qualityTier: 'frontier',
    free: true,
    capabilities: {
      toolCall: true,
      reasoning: true,
      vision: true,
      structuredOutput: true,
    },
  },
  {
    id: 'google/gemini-2.5-pro',
    apiId: 'gemini-2.5-pro',
    qualityTier: 'frontier',
    free: true,
    capabilities: {
      toolCall: true,
      reasoning: true,
      vision: true,
      structuredOutput: true,
    },
  },
  {
    id: 'google/gemini-2.5-flash-lite',
    apiId: 'gemini-2.5-flash-lite',
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
    id: 'google/gemini-3-flash-preview',
    apiId: 'gemini-3-flash-preview',
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

export const googleProvider: ProviderModule = {
  id: 'google',
  name: 'Google AI Studio',
  sdkPackage: '@ai-sdk/google',
  envVar: 'GOOGLE_GENERATIVE_AI_API_KEY',
  lastVerified: '2026-03-15',
  updateUrl: 'https://ai.google.dev/gemini-api/docs/models',
  tier: 'free',
  models,
  async createFactory(apiKey: string) {
    try {
      const { createGoogleGenerativeAI } = await import('@ai-sdk/google');
      const p = createGoogleGenerativeAI({ apiKey });
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
