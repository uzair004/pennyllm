import { z } from 'zod';
import { Strategy } from '../constants/index.js';

/**
 * Policy limit schema
 */
const timeWindowSchema = z.object({
  type: z.enum(['per-minute', 'hourly', 'daily', 'monthly', 'rolling-30d']),
  durationMs: z.number().positive(),
});

const policyLimitSchema = z.object({
  type: z.enum(['tokens', 'calls', 'rate', 'daily', 'monthly']),
  value: z.number().positive(),
  window: timeWindowSchema,
});

/**
 * Provider configuration schema
 */
export const providerConfigSchema = z.object({
  keys: z.array(z.string()).min(1, 'At least one key is required'),
  strategy: z.enum([Strategy.ROUND_ROBIN, Strategy.LEAST_USED] as const).optional(),
  limits: z.array(policyLimitSchema).optional(),
  enabled: z.boolean().default(true),
});

/**
 * Storage configuration schema
 */
export const storageConfigSchema = z.object({
  type: z.enum(['sqlite', 'redis', 'memory']).default('sqlite'),
  path: z.string().optional(),
  url: z.string().optional(),
});

/**
 * Budget configuration schema
 */
export const budgetConfigSchema = z.object({
  monthlyLimit: z.number().nonnegative().default(0),
  alertThresholds: z.array(z.number().min(0).max(1)).default([0.8, 0.95]),
});

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
    storage: storageConfigSchema.default({ type: 'sqlite' }),
    budget: budgetConfigSchema.default({
      monthlyLimit: 0,
      alertThresholds: [0.8, 0.95],
    }),
  })
  .strict();

/**
 * Type inference
 */
export type ConfigInput = z.input<typeof configSchema>;
export type ConfigOutput = z.output<typeof configSchema>;
