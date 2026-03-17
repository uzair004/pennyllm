import { ConfigError } from '../errors/config-error.js';
import type { ProviderModelDef, ProviderModule } from './types.js';

const models = [
  {
    id: 'nvidia/deepseek-ai/deepseek-v3.2',
    apiId: 'deepseek-ai/deepseek-v3.2',
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
    id: 'nvidia/moonshotai/kimi-k2.5',
    apiId: 'moonshotai/kimi-k2.5',
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
    id: 'nvidia/nvidia/llama-3.1-nemotron-ultra-253b-v1',
    apiId: 'nvidia/llama-3.1-nemotron-ultra-253b-v1',
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
    id: 'nvidia/meta/llama-4-maverick-17b-128e-instruct',
    apiId: 'meta/llama-4-maverick-17b-128e-instruct',
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
    id: 'nvidia/qwen/qwen3-coder-480b-a35b-instruct',
    apiId: 'qwen/qwen3-coder-480b-a35b-instruct',
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

export const nvidiaNimProvider: ProviderModule = {
  id: 'nvidia',
  name: 'NVIDIA NIM',
  sdkPackage: '@ai-sdk/openai-compatible',
  envVar: 'NVIDIA_API_KEY',
  lastVerified: '2026-03-17',
  updateUrl: 'https://build.nvidia.com',
  tier: 'free',
  models,
  async createFactory(apiKey: string) {
    try {
      const { createOpenAICompatible } = await import('@ai-sdk/openai-compatible');
      const p = createOpenAICompatible({
        name: 'nvidia-nim',
        baseURL: 'https://integrate.api.nvidia.com/v1',
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
