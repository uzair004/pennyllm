import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { DefaultModelCatalog } from './DefaultModelCatalog.js';
import { RouterEvent } from '../constants/index.js';

describe('DefaultModelCatalog', () => {
  describe('refresh', () => {
    it('fetches from models.dev API on first access', async () => {
      const emitter = new EventEmitter();
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      const catalog = new DefaultModelCatalog(emitter, { fetchFn: mockFetch });

      await catalog.refresh();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://models.dev/api.json',
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });

    it.todo('supplements with OpenRouter for missing models');
    it.todo('validates API entries with Zod safeParse and skips invalid');
    it.todo('uses 5s timeout with no retry');
    it.todo('deduplicates concurrent refresh calls (single inflight)');
    it.todo('emits catalog:refreshed event with source and diff counts');
  });

  describe('capabilities', () => {
    it('returns capability flags for known model', async () => {
      const emitter = new EventEmitter();
      const mockFetch = vi.fn().mockRejectedValue(new Error('API unavailable'));

      const catalog = new DefaultModelCatalog(emitter, { fetchFn: mockFetch });

      // This will fall back to static snapshot
      const capabilities = await catalog.getCapabilities('google/gemini-2.0-flash');

      expect(capabilities).toBeDefined();
      expect(capabilities?.toolCall).toBe(true);
      expect(capabilities?.structuredOutput).toBe(true);
      expect(capabilities?.vision).toBe(true);
    });

    it.todo('returns null for unknown model');
    it.todo('supports 4 capability flags: reasoning, toolCall, structuredOutput, vision');
  });

  describe('quality-tiers', () => {
    it('assigns quality tiers from static snapshot data', async () => {
      const emitter = new EventEmitter();
      const mockFetch = vi.fn().mockRejectedValue(new Error('API unavailable'));

      const catalog = new DefaultModelCatalog(emitter, { fetchFn: mockFetch });

      const model = await catalog.getModel('deepseek/deepseek-reasoner');

      expect(model?.qualityTier).toBe('frontier');
    });

    it.todo('supports frontier, high, mid, small tiers');
  });

  describe('pricing', () => {
    it('normalizes pricing to per-1M-tokens format', async () => {
      const emitter = new EventEmitter();
      const mockFetch = vi.fn().mockRejectedValue(new Error('API unavailable'));

      const catalog = new DefaultModelCatalog(emitter, { fetchFn: mockFetch });

      const model = await catalog.getModel('google/gemini-2.0-flash');

      expect(model?.pricing).toBeDefined();
      expect(model?.pricing).toHaveProperty('promptPer1MTokens');
      expect(model?.pricing).toHaveProperty('completionPer1MTokens');
    });

    it.todo('free models have zero pricing');
    it.todo('pricing has separate promptPer1MTokens and completionPer1MTokens');
  });

  describe('offline-fallback', () => {
    it('falls back to static snapshot when APIs unreachable', async () => {
      const emitter = new EventEmitter();
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const catalog = new DefaultModelCatalog(emitter, { fetchFn: mockFetch });

      let eventFired = false;
      emitter.on(RouterEvent.CATALOG_REFRESHED, (event) => {
        expect(event.source).toBe('static');
        eventFired = true;
      });

      const models = await catalog.listModels();

      expect(models.length).toBeGreaterThan(0);
      expect(eventFired).toBe(true);
    });

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
