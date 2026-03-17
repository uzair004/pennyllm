import { ConfigError } from '../errors/config-error.js';
import type { ProviderModelDef, ProviderModule } from './types.js';

const models = [
  {
    id: 'sambanova/DeepSeek-R1-0528',
    apiId: 'DeepSeek-R1-0528',
    qualityTier: 'frontier',
    free: true,
    capabilities: {
      toolCall: false,
      reasoning: true,
      vision: false,
      structuredOutput: false,
    },
  },
  {
    id: 'sambanova/Meta-Llama-3.3-70B-Instruct',
    apiId: 'Meta-Llama-3.3-70B-Instruct',
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
    id: 'sambanova/DeepSeek-V3-0324',
    apiId: 'DeepSeek-V3-0324',
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
    id: 'sambanova/Qwen3-235B-A22B-Instruct-2507',
    apiId: 'Qwen3-235B-A22B-Instruct-2507',
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

export const sambanovaProvider: ProviderModule = {
  id: 'sambanova',
  name: 'SambaNova',
  sdkPackage: 'sambanova-ai-provider',
  envVar: 'SAMBANOVA_API_KEY',
  lastVerified: '2026-03-15',
  updateUrl: 'https://cloud.sambanova.ai',
  tier: 'free',
  models,
  async createFactory(apiKey: string) {
    try {
      const { createSambaNova } = await import('sambanova-ai-provider');
      const p = createSambaNova({ apiKey });
      // sambanova-ai-provider returns V2 models; cast to V3 for runtime compatibility
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any
      return (modelId: string) => p(modelId) as any;
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
