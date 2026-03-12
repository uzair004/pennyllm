/**
 * Selection strategy types
 */
export const Strategy = {
  ROUND_ROBIN: 'round-robin',
  LEAST_USED: 'least-used',
} as const;

export type StrategyType = (typeof Strategy)[keyof typeof Strategy];

/**
 * LLM Provider identifiers
 */
export const Provider = {
  GOOGLE: 'google',
  GROQ: 'groq',
  OPENROUTER: 'openrouter',
  MISTRAL: 'mistral',
  HUGGINGFACE: 'huggingface',
  CEREBRAS: 'cerebras',
  DEEPSEEK: 'deepseek',
  QWEN: 'qwen',
  CLOUDFLARE: 'cloudflare',
  NVIDIA: 'nvidia',
  COHERE: 'cohere',
  GITHUB: 'github',
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
  ERROR: 'error',
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
