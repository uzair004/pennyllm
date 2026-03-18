/**
 * Selection strategy types
 */
export const Strategy = {
  PRIORITY: 'priority',
  ROUND_ROBIN: 'round-robin',
  LEAST_USED: 'least-used',
} as const;

export type StrategyType = (typeof Strategy)[keyof typeof Strategy];

/**
 * LLM Provider identifiers
 */
export const Provider = {
  CEREBRAS: 'cerebras',
  GOOGLE: 'google',
  GROQ: 'groq',
  SAMBANOVA: 'sambanova',
  NVIDIA: 'nvidia',
  MISTRAL: 'mistral',
  // Legacy — unsupported, kept for backward compatibility
  GITHUB: 'github',
  OPENROUTER: 'openrouter',
  HUGGINGFACE: 'huggingface',
  DEEPSEEK: 'deepseek',
  QWEN: 'qwen',
  CLOUDFLARE: 'cloudflare',
  COHERE: 'cohere',
} as const;

export type ProviderType = (typeof Provider)[keyof typeof Provider];

/**
 * Router event types
 */
export const RouterEvent = {
  KEY_SELECTED: 'key:selected',
  USAGE_RECORDED: 'usage:recorded',
  LIMIT_WARNING: 'limit:warning',
  LIMIT_EXCEEDED: 'limit:exceeded',
  FALLBACK_TRIGGERED: 'fallback:triggered',
  CONFIG_LOADED: 'config:loaded',
  PROVIDER_EXHAUSTED: 'provider:exhausted',
  BUDGET_ALERT: 'budget:alert',
  BUDGET_EXCEEDED: 'budget:exceeded',
  CATALOG_REFRESHED: 'catalog:refreshed',
  ERROR: 'error',
  ERROR_RATE_LIMIT: 'error:rate_limit',
  ERROR_AUTH: 'error:auth',
  ERROR_SERVER: 'error:server',
  ERROR_NETWORK: 'error:network',
  KEY_RETRIED: 'key:retried',
  KEY_DISABLED: 'key:disabled',
  REQUEST_COMPLETE: 'request:complete',
  CHAIN_RESOLVED: 'chain:resolved',
  PROVIDER_DEPLETED: 'provider:depleted',
  PROVIDER_STALE: 'provider:stale',
  CREDIT_LOW: 'credit:low',
  CREDIT_EXHAUSTED: 'credit:exhausted',
  CREDIT_EXPIRING: 'credit:expiring',
} as const;

export type RouterEventType = (typeof RouterEvent)[keyof typeof RouterEvent];

/**
 * Limit types for quota enforcement
 */
export const LimitType = {
  TOKENS: 'tokens',
  CALLS: 'calls',
  RATE: 'rate',
  DAILY: 'daily',
  MONTHLY: 'monthly',
} as const;

export type LimitTypeValue = (typeof LimitType)[keyof typeof LimitType];

/**
 * Enforcement behaviors when limits are reached
 */
export const EnforcementBehavior = {
  HARD_BLOCK: 'hard-block',
  THROTTLE: 'throttle',
  SILENT_CHARGE: 'silent-charge',
} as const;

export type EnforcementBehaviorType =
  (typeof EnforcementBehavior)[keyof typeof EnforcementBehavior];

/**
 * Quality tiers for model capabilities
 */
export const QualityTier = {
  FRONTIER: 'frontier',
  HIGH: 'high',
  MID: 'mid',
  SMALL: 'small',
} as const;

export type QualityTierType = (typeof QualityTier)[keyof typeof QualityTier];

/**
 * Model status types
 */
export const ModelStatus = {
  ACTIVE: 'active',
  DEPRECATED: 'deprecated',
} as const;

export type ModelStatusType = (typeof ModelStatus)[keyof typeof ModelStatus];
