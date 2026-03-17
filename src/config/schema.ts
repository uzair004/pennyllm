import { z } from 'zod';
import { Strategy } from '../constants/index.js';

/**
 * Policy limit schema
 */
export const timeWindowSchema = z.object({
  type: z.enum(['per-minute', 'hourly', 'daily', 'monthly', 'rolling-30d']),
  durationMs: z.number().positive(),
});

export const policyLimitSchema = z.object({
  type: z.enum(['tokens', 'calls', 'rate', 'daily', 'monthly']),
  value: z.number().positive(),
  window: timeWindowSchema,
});

/**
 * Key configuration schema - supports string or object with limits and label
 */
export const keyConfigSchema = z.union([
  z.string(),
  z.object({
    key: z.string(),
    label: z.string().optional(),
    limits: z.array(policyLimitSchema).optional(),
  }),
]);

/**
 * Provider configuration schema
 */
export const providerConfigSchema = z.object({
  keys: z.array(keyConfigSchema).min(1, 'At least one key is required'),
  strategy: z
    .enum([Strategy.PRIORITY, Strategy.ROUND_ROBIN, Strategy.LEAST_USED] as const)
    .optional(),
  limits: z.array(policyLimitSchema).optional(),
  enabled: z.boolean().default(true),
  priority: z.number().int().min(0).default(100),
  tier: z.enum(['free', 'trial', 'paid']).default('free'),
  credits: z.number().positive().optional(),
  models: z.array(z.string()).optional(),
});

/**
 * Budget configuration schema
 */
export const budgetConfigSchema = z.object({
  monthlyLimit: z.number().nonnegative().default(0),
  alertThresholds: z.array(z.number().min(0).max(1)).default([0.8, 0.95]),
});

/**
 * Estimation configuration schema
 * Note: tokenEstimator function is NOT validated by Zod (it's a runtime option, not JSON config)
 */
export const estimationSchema = z
  .object({
    defaultMaxTokens: z.number().int().positive().default(1024),
  })
  .default({ defaultMaxTokens: 1024 });

/**
 * Cooldown configuration schema
 */
export const cooldownSchema = z
  .object({
    defaultDurationMs: z.number().int().positive().default(60000),
  })
  .default({ defaultDurationMs: 60000 });

/**
 * Main router configuration schema
 */
export const configSchema = z
  .object({
    version: z.literal('1.0').default('1.0'),
    providers: z
      .record(z.string(), providerConfigSchema)
      .refine((obj) => Object.keys(obj).length > 0, {
        message: 'At least one provider is required',
      }),
    strategy: z
      .enum([Strategy.PRIORITY, Strategy.ROUND_ROBIN, Strategy.LEAST_USED] as const)
      .default(Strategy.PRIORITY),
    budget: budgetConfigSchema.default({
      monthlyLimit: 0,
      alertThresholds: [0.8, 0.95],
    }),
    models: z.array(z.string()).optional(),
    estimation: estimationSchema,
    cooldown: cooldownSchema,
    warningThreshold: z.number().min(0).max(1).optional(),
    applyRegistryDefaults: z.boolean().default(false),
    dryRun: z.boolean().default(false),
    debug: z.boolean().default(false),
  })
  .strict()
  .refine(
    (config) => {
      for (const [, prov] of Object.entries(config.providers)) {
        if (prov.tier === 'trial' && prov.credits === undefined) {
          return false;
        }
      }
      return true;
    },
    {
      message: "Providers with tier 'trial' must specify a 'credits' value.",
    },
  );

/**
 * Type inference
 */
export type ConfigInput = z.input<typeof configSchema>;
export type ConfigOutput = z.output<typeof configSchema>;
