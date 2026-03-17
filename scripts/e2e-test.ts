/**
 * PennyLLM E2E Test Script
 *
 * Tests real API calls against all 6 target providers.
 * Run: npx tsx scripts/e2e-test.ts
 * Requires: .env file with API keys for target providers
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { generateText } from 'ai';
import { createRouter, defineConfig } from '../src/index.js';
import { getAllProviders } from '../src/providers/registry.js';

// Load .env manually (no dotenv dependency)
function loadEnv(): void {
  try {
    const envPath = resolve(import.meta.dirname ?? '.', '..', '.env');
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;
      const key = trimmed.substring(0, eqIndex).trim();
      const value = trimmed
        .substring(eqIndex + 1)
        .trim()
        .replace(/^["']|["']$/g, '');
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch {
    // .env file not found, rely on existing environment
  }
}

interface TestResult {
  provider: string;
  status: 'OK' | 'SKIP' | 'FAIL';
  model?: string;
  tokens?: number;
  durationMs?: number;
  error?: string;
}

const PROMPT = 'Say hello in one word.';

async function testProvider(
  providerId: string,
  envVar: string,
  defaultModel: string,
): Promise<TestResult> {
  const apiKey = process.env[envVar];
  if (!apiKey) {
    return { provider: providerId, status: 'SKIP' };
  }

  const start = Date.now();
  try {
    const router = await createRouter(
      defineConfig({
        providers: {
          [providerId]: { keys: [apiKey], priority: 1 },
        },
      }),
    );

    const { text, usage } = await generateText({
      model: router.chat(),
      prompt: PROMPT,
    });

    const durationMs = Date.now() - start;
    const tokens = usage?.totalTokens ?? 0;

    if (!text || text.trim().length === 0) {
      return {
        provider: providerId,
        status: 'FAIL',
        model: defaultModel,
        durationMs,
        error: 'Empty response',
      };
    }

    await router.close();

    return {
      provider: providerId,
      status: 'OK',
      model: defaultModel,
      tokens,
      durationMs,
    };
  } catch (err) {
    const durationMs = Date.now() - start;
    return {
      provider: providerId,
      status: 'FAIL',
      model: defaultModel,
      durationMs,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function testChainFallback(): Promise<void> {
  // Find providers with available keys
  const providers = getAllProviders();
  const available: Array<{ id: string; envVar: string; model: string }> = [];

  for (const p of providers) {
    if (process.env[p.envVar] && p.models.length > 0) {
      available.push({
        id: p.id,
        envVar: p.envVar,
        model: p.models[0]!.id,
      });
    }
    if (available.length >= 2) break;
  }

  if (available.length < 2) {
    console.log('[E2E]');
    console.log('[E2E] Chain fallback test: SKIP (need 2+ providers with keys)');
    return;
  }

  const providerConfig: Record<string, { keys: string[]; priority: number }> = {};
  const modelChain: string[] = [];

  for (let i = 0; i < available.length; i++) {
    const p = available[i]!;
    providerConfig[p.id] = {
      keys: [process.env[p.envVar]!],
      priority: i + 1,
    };
    modelChain.push(p.model);
  }

  try {
    const router = await createRouter(
      defineConfig({
        providers: providerConfig,
        models: modelChain,
      }),
    );

    const status = router.getStatus();

    const { text } = await generateText({
      model: router.chat(),
      prompt: PROMPT,
    });

    console.log('[E2E]');
    console.log('[E2E] Chain fallback test:');
    console.log(`[E2E]   Chain: ${modelChain.join(' -> ')}`);
    console.log(`[E2E]   Status: ${status.availableModels}/${status.totalModels} models available`);
    console.log(`[E2E]   Response: ${text ? 'OK' : 'EMPTY'}`);

    await router.close();
  } catch (err) {
    console.log('[E2E]');
    console.log('[E2E] Chain fallback test: FAIL');
    console.log(`[E2E]   Error: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function main(): Promise<void> {
  loadEnv();

  const providers = getAllProviders();
  const defaultModels: Record<string, string> = {};
  for (const p of providers) {
    if (p.models.length > 0) {
      defaultModels[p.id] = p.models[0]!.apiId;
    }
  }

  console.log(`[E2E] Testing ${providers.length} providers...\n`);

  const results: TestResult[] = [];
  for (const p of providers) {
    const result = await testProvider(p.id, p.envVar, defaultModels[p.id] ?? 'unknown');
    results.push(result);

    const pad = (s: string, n: number) => s.padEnd(n);
    if (result.status === 'OK') {
      console.log(
        `[E2E] ${pad(p.id, 12)} OK (${result.model}, ${result.tokens} tokens, ${(result.durationMs! / 1000).toFixed(1)}s)`,
      );
    } else if (result.status === 'SKIP') {
      console.log(`[E2E] ${pad(p.id, 12)} SKIP (no ${p.envVar})`);
    } else {
      console.log(`[E2E] ${pad(p.id, 12)} FAIL: ${result.error}`);
    }
  }

  await testChainFallback();

  const passed = results.filter((r) => r.status === 'OK').length;
  const skipped = results.filter((r) => r.status === 'SKIP').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  const tested = passed + failed;

  console.log('[E2E]');
  console.log(
    `[E2E] Results: ${passed}/${tested} providers passed${skipped > 0 ? `, ${skipped} skipped` : ''}${failed > 0 ? `, ${failed} failed` : ''}`,
  );

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[E2E] Fatal:', err);
  process.exit(1);
});
