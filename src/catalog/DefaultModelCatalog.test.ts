import { describe, it } from 'vitest';

describe('DefaultModelCatalog', () => {
  describe('refresh', () => {
    it.todo('fetches from models.dev API on first access');
    it.todo('supplements with OpenRouter for missing models');
    it.todo('validates API entries with Zod safeParse and skips invalid');
    it.todo('uses 5s timeout with no retry');
    it.todo('deduplicates concurrent refresh calls (single inflight)');
    it.todo('emits catalog:refreshed event with source and diff counts');
  });

  describe('capabilities', () => {
    it.todo('returns capability flags for known model');
    it.todo('returns null for unknown model');
    it.todo('supports 4 capability flags: reasoning, toolCall, structuredOutput, vision');
  });

  describe('quality-tiers', () => {
    it.todo('assigns quality tiers from static snapshot data');
    it.todo('supports frontier, high, mid, small tiers');
  });

  describe('pricing', () => {
    it.todo('normalizes pricing to per-1M-tokens format');
    it.todo('free models have zero pricing');
    it.todo('pricing has separate promptPer1MTokens and completionPer1MTokens');
  });

  describe('offline-fallback', () => {
    it.todo('falls back to static snapshot when APIs unreachable');
    it.todo('serves stale cache on refresh failure');
    it.todo('uses 24h TTL for cache expiration');
  });

  describe('listModels', () => {
    it.todo('filters by provider');
    it.todo('filters by capabilities');
    it.todo('filters by qualityTier');
    it.todo('filters by maxPrice');
    it.todo('excludes deprecated models');
  });

  describe('close', () => {
    it.todo('cancels inflight fetches');
    it.todo('clears cache');
  });
});
