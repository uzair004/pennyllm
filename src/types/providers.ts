import type { ProviderConfig } from './config.js';

/**
 * Google AI Studio (Gemini) provider configuration.
 *
 * Free tier: Recurring, resets daily/per-minute. Varies by model (5-15 RPM, 100-1000 RPD, 250K TPM).
 * Sign up: https://aistudio.google.com
 * API keys: https://aistudio.google.com/app/apikey
 * Env var: GOOGLE_GENERATIVE_AI_API_KEY
 * AI SDK package: @ai-sdk/google
 *
 * @see docs/providers/google.md for full setup guide
 */
export type GoogleProviderConfig = ProviderConfig;

/**
 * Groq provider configuration.
 *
 * Free tier: Recurring, resets daily/per-minute. Per-model limits (30-60 RPM, 1K-14.4K RPD, 6K-30K TPM).
 * Sign up: https://console.groq.com
 * API keys: https://console.groq.com/keys
 * Env var: GROQ_API_KEY
 * AI SDK package: @ai-sdk/groq
 *
 * @see docs/providers/groq.md for full setup guide
 */
export type GroqProviderConfig = ProviderConfig;

/**
 * Mistral (La Plateforme) provider configuration.
 *
 * Free tier: Recurring "Experiment" plan. ~2 RPM, 500K TPM, 1B tokens/month.
 * Phone verification required for signup.
 * Sign up: https://console.mistral.ai
 * API keys: https://console.mistral.ai/api-keys
 * Env var: MISTRAL_API_KEY
 * AI SDK package: @ai-sdk/mistral
 *
 * @see docs/providers/mistral.md for full setup guide
 */
export type MistralProviderConfig = ProviderConfig;

/**
 * Cerebras provider configuration.
 *
 * Free tier: Recurring daily limits. 30 RPM, 14.4K RPD, 60K TPM, 1M TPD.
 * Ultra-fast inference (~2,600 tokens/sec). Free tier context limited to 8,192 tokens.
 * Sign up: https://cloud.cerebras.ai
 * API keys: https://cloud.cerebras.ai (dashboard)
 * Env var: CEREBRAS_API_KEY
 * AI SDK package: @ai-sdk/cerebras
 *
 * @see docs/providers/cerebras.md for full setup guide
 */
export type CerebrasProviderConfig = ProviderConfig;

/**
 * NVIDIA NIM provider configuration.
 *
 * Trial credits: 1,000 credits (can request 4,000 more). 40 RPM trial limit.
 * Credit-to-token conversion rate varies by model and is not publicly documented.
 * Sign up: https://build.nvidia.com
 * API keys: NVIDIA Developer dashboard
 * Env var: NVIDIA_API_KEY
 * AI SDK package: @ai-sdk/openai-compatible (base URL: https://integrate.api.nvidia.com/v1)
 *
 * @see docs/providers/nvidia.md for full setup guide
 */
export type NvidiaProviderConfig = ProviderConfig;
