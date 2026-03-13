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
 * Key configuration schema - supports string or object with limits
 */
export const keyConfigSchema = z.union([
  z.string(),
  z.object({
    key: z.string(),
    limits: z.array(policyLimitSchema).optional(),
  }),
]);

/**
 * Provider configuration schema
 */
export const providerConfigSchema = z.object({
  keys: z.array(keyConfigSchema).min(1, 'At least one key is required'),
  strategy: z.enum([Strategy.ROUND_ROBIN, Strategy.LEAST_USED] as const).optional(),
  limits: z.array(policyLimitSchema).optional(),
  enabled: z.boolean().default(true),
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
      .enum([Strategy.ROUND_ROBIN, Strategy.LEAST_USED] as const)
      .default(Strategy.ROUND_ROBIN),
    budget: budgetConfigSchema.default({
      monthlyLimit: 0,
      alertThresholds: [0.8, 0.95],
    }),
    estimation: estimationSchema,
    warningThreshold: z.number().min(0).max(1).optional(),
  })
  .strict();

/**
 * Type inference
 */
export type ConfigInput = z.input<typeof configSchema>;
export type ConfigOutput = z.output<typeof configSchema>;
