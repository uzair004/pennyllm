import type { QualityTierType } from '../constants/index.js';
import type { LanguageModelV3 } from '@ai-sdk/provider';

export interface ProviderModelDef {
  readonly id: string;
  readonly apiId: string;
  readonly qualityTier: QualityTierType;
  readonly free: boolean;
  readonly capabilities: {
    readonly toolCall: boolean;
    readonly reasoning: boolean;
    readonly vision: boolean;
    readonly structuredOutput: boolean;
  };
}

export type ProviderTier = 'free' | 'trial' | 'paid';

export interface ProviderModule {
  readonly id: string;
  readonly name: string;
  readonly sdkPackage: string;
  readonly envVar: string;
  readonly lastVerified: string;
  readonly updateUrl: string;
  readonly tier: ProviderTier;
  readonly credits?: number;
  readonly models: readonly ProviderModelDef[];
  createFactory(apiKey: string): Promise<(modelId: string) => LanguageModelV3>;
}
