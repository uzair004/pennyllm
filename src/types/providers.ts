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
 * OpenRouter provider configuration.
 *
 * Meta-provider that proxies requests to multiple AI providers via a single API key.
 * Free tier: Recurring, 20 RPM, 50-200 RPD (50 without credits, 1000 with $10+ purchased).
 * 28+ free models available with `:free` suffix in model IDs.
 * Sign up: https://openrouter.ai
 * API keys: https://openrouter.ai/settings/keys
 * Env var: OPENROUTER_API_KEY
 * AI SDK package: @ai-sdk/openai-compatible (base URL: https://openrouter.ai/api/v1)
 *
 * @see docs/providers/openrouter.md for full setup guide
 */
export type OpenRouterProviderConfig = ProviderConfig;

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
 * HuggingFace Inference API provider configuration.
 *
 * Free tier: $0.10/month credits, compute-time-based billing (not token-based).
 * Access to 200+ models from leading inference providers.
 * Sign up: https://huggingface.co/join
 * API keys: https://huggingface.co/settings/tokens
 * Env var: HUGGINGFACE_API_KEY
 * AI SDK package: @ai-sdk/huggingface
 *
 * @see docs/providers/huggingface.md for full setup guide
 */
export type HuggingFaceProviderConfig = ProviderConfig;

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
 * DeepSeek provider configuration.
 *
 * Trial credits only (not recurring): 5M tokens with 30-day expiry from registration.
 * No rate limits enforced; delays under heavy load instead of 429 errors.
 * After credits expire, pay-as-you-go pricing applies.
 * Sign up: https://platform.deepseek.com
 * API keys: https://platform.deepseek.com/api_keys
 * Env var: DEEPSEEK_API_KEY
 * AI SDK package: @ai-sdk/deepseek
 *
 * @see docs/providers/deepseek.md for full setup guide
 */
export type DeepSeekProviderConfig = ProviderConfig;

/**
 * Qwen (Alibaba Cloud Model Studio) provider configuration.
 *
 * Trial free quota: 1M tokens, 90-day expiry, Singapore region only.
 * Dual-limit mechanism: RPM AND RPS enforced simultaneously.
 * Interface partially in Chinese. Free quota only in Singapore deployment region.
 * Sign up: https://www.alibabacloud.com (then activate Model Studio)
 * API keys: Model Studio Key Management page
 * Env var: DASHSCOPE_API_KEY
 * AI SDK package: @ai-sdk/openai-compatible (base URL: https://dashscope-intl.aliyuncs.com/compatible-mode/v1)
 *
 * @see docs/providers/qwen.md for full setup guide
 */
export type QwenProviderConfig = ProviderConfig;

/**
 * Cloudflare Workers AI provider configuration.
 *
 * Free tier: Recurring, 10,000 neurons/day (neurons != tokens, conversion varies by model).
 * Uses REST API with OpenAI-compatible endpoint. Requires two env vars: API token and Account ID.
 * Sign up: https://dash.cloudflare.com/sign-up
 * API keys: Cloudflare dashboard > API Tokens
 * Env vars: CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID
 * AI SDK package: @ai-sdk/openai-compatible (base URL: https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/ai/v1)
 *
 * @see docs/providers/cloudflare.md for full setup guide
 */
export type CloudflareProviderConfig = ProviderConfig;

/**
 * NVIDIA NIM provider configuration.
 *
 * Trial credits: 1,000 credits (can request 4,000 more). 40 RPM trial limit.
 * Credit-to-token conversion rate varies by model and is not publicly documented.
 * Sign up: https://build.nvidia.com
 * API keys: NVIDIA Developer dashboard
 * Env var: NIM_API_KEY
 * AI SDK package: @ai-sdk/openai-compatible (base URL: https://integrate.api.nvidia.com/v1)
 *
 * @see docs/providers/nvidia.md for full setup guide
 */
export type NvidiaProviderConfig = ProviderConfig;

/**
 * Cohere provider configuration.
 *
 * Trial key: 1,000 API calls/month shared across all endpoints, 20 RPM for chat.
 * Trial keys are NOT permitted for production or commercial use.
 * Sign up: https://dashboard.cohere.com/welcome/register
 * API keys: https://dashboard.cohere.com/api-keys
 * Env var: COHERE_API_KEY
 * AI SDK package: @ai-sdk/cohere
 *
 * @see docs/providers/cohere.md for full setup guide
 */
export type CohereProviderConfig = ProviderConfig;

/**
 * GitHub Models provider configuration.
 *
 * Free tier: Recurring, rate-limited by model category.
 * Low models: 15 RPM, 150 RPD. High models: 10 RPM, 50 RPD.
 * Requires GitHub PAT with models:read scope.
 * Sign up: https://github.com/signup (then enable GitHub Models)
 * API keys: https://github.com/settings/tokens (PAT with models:read scope)
 * Env var: GITHUB_TOKEN
 * AI SDK package: @github/models
 *
 * @see docs/providers/github.md for full setup guide
 */
export type GitHubProviderConfig = ProviderConfig;
