import { resolveConfig } from './config-discovery.js';
import { buildChain } from '../chain/chain-builder.js';
import { getProviderModule } from '../providers/registry.js';
import { classifyError } from '../wrapper/error-classifier.js';
import type {
  ValidateOptions,
  ValidationResult,
  ModelTestResult,
  KeyTestResult,
  TestStatus,
} from './types.js';
import type { ChainEntry } from '../chain/types.js';
import type { RouterConfig } from '../types/config.js';

// ── Error classification helper ────────────────────────────────────

function classifyTestError(
  err: unknown,
  providerId: string,
  timeoutMs: number,
): { status: TestStatus; latencyMs?: number; message?: string } {
  // Abort = timeout
  if (err instanceof Error && err.name === 'AbortError') {
    return {
      status: 'warning',
      message: `Timeout (${timeoutMs / 1000}s) -- provider may be unreachable`,
    };
  }

  const classified = classifyError(err);

  switch (classified.type) {
    case 'rate_limit':
      return {
        status: 'warning',
        message: `Rate limited (${classified.statusCode ?? 429}) -- key valid, try again later`,
      };
    case 'auth': {
      const mod = getProviderModule(providerId);
      return {
        status: 'fail',
        message: `${classified.statusCode ?? 401} ${classified.message} -- Check: ${mod?.updateUrl ?? 'provider dashboard'}`,
      };
    }
    case 'network':
      return {
        status: 'warning',
        message: 'Network error -- provider may be unreachable',
      };
    default:
      return {
        status: 'fail',
        message: classified.message,
      };
  }
}

// ── Worst status helper ────────────────────────────────────────────

const STATUS_SEVERITY: Record<TestStatus, number> = {
  pass: 0,
  skipped: 1,
  warning: 2,
  fail: 3,
};

function worstStatus(statuses: TestStatus[]): TestStatus {
  let worst: TestStatus = 'pass';
  for (const s of statuses) {
    if (STATUS_SEVERITY[s] > STATUS_SEVERITY[worst]) {
      worst = s;
    }
  }
  return worst;
}

// ── Single key test ────────────────────────────────────────────────

async function testKey(
  providerId: string,
  apiModelId: string,
  apiKey: string,
  keyIndex: number,
  timeoutMs: number,
): Promise<KeyTestResult> {
  const mod = getProviderModule(providerId);
  if (!mod) {
    return {
      keyIndex,
      generateText: { status: 'fail', message: `Unknown provider: ${providerId}` },
      streamText: { status: 'fail', message: `Unknown provider: ${providerId}` },
    };
  }

  let factory: (modelId: string) => unknown;
  try {
    factory = await mod.createFactory(apiKey);
  } catch (err) {
    const message =
      err instanceof Error &&
      (err.message.includes('MODULE_NOT_FOUND') ||
        ('code' in err && err.code === 'MODULE_NOT_FOUND'))
        ? `Missing ${mod.sdkPackage} -- run: npm install ${mod.sdkPackage}`
        : err instanceof Error
          ? err.message
          : String(err);
    return {
      keyIndex,
      generateText: { status: 'fail', message },
      streamText: { status: 'fail', message },
    };
  }

  const model = factory(apiModelId);

  // Test generateText
  let generateResult: { status: TestStatus; latencyMs?: number; message?: string };
  {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const { generateText } = await import('ai');
      const start = Date.now();
      await generateText({
        model: model as Parameters<typeof generateText>[0]['model'],
        prompt: 'Respond with the word ok.',
        maxOutputTokens: 5,
        abortSignal: controller.signal,
      });
      clearTimeout(timer);
      const latencyMs = Date.now() - start;
      generateResult = { status: 'pass', latencyMs };
    } catch (err) {
      clearTimeout(timer);
      generateResult = classifyTestError(err, providerId, timeoutMs);
    }
  }

  // Test streamText
  let streamResult: { status: TestStatus; latencyMs?: number; message?: string };
  {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const { streamText } = await import('ai');
      const start = Date.now();
      const result = streamText({
        model: model as Parameters<typeof streamText>[0]['model'],
        prompt: 'Respond with the word ok.',
        maxOutputTokens: 5,
        abortSignal: controller.signal,
      });
      let text = '';
      for await (const chunk of result.textStream) {
        text += chunk;
      }
      clearTimeout(timer);
      const latencyMs = Date.now() - start;
      streamResult = { status: 'pass', latencyMs };
      // Suppress unused variable warning
      void text;
    } catch (err) {
      clearTimeout(timer);
      streamResult = classifyTestError(err, providerId, timeoutMs);
    }
  }

  return { keyIndex, generateText: generateResult, streamText: streamResult };
}

// ── Provider test (sequential keys) ────────────────────────────────

async function testProvider(
  providerId: string,
  config: RouterConfig,
  testedEntry: ChainEntry,
  timeoutMs: number,
): Promise<KeyTestResult[]> {
  const mod = getProviderModule(providerId);
  if (!mod) {
    return [
      {
        keyIndex: 0,
        generateText: { status: 'fail', message: `Unknown provider: ${providerId}` },
        streamText: { status: 'fail', message: `Unknown provider: ${providerId}` },
      },
    ];
  }

  const providerConfig = config.providers[providerId];
  if (!providerConfig) {
    return [
      {
        keyIndex: 0,
        generateText: { status: 'fail', message: `Provider '${providerId}' not configured` },
        streamText: { status: 'fail', message: `Provider '${providerId}' not configured` },
      },
    ];
  }

  const keys = providerConfig.keys;
  const results: KeyTestResult[] = [];

  // Sequential key testing
  for (let i = 0; i < keys.length; i++) {
    const keyConfig = keys[i]!;
    const apiKey = typeof keyConfig === 'string' ? keyConfig : keyConfig.key;
    const result = await testKey(providerId, testedEntry.apiModelId, apiKey, i, timeoutMs);
    results.push(result);
  }

  return results;
}

// ── Dry-run mode ───────────────────────────────────────────────────

async function dryRunProvider(
  providerId: string,
): Promise<{ status: TestStatus; message: string }> {
  const mod = getProviderModule(providerId);
  if (!mod) {
    return { status: 'fail', message: `Unknown provider module: ${providerId}` };
  }

  try {
    await mod.createFactory('dry-run-test-key');
    return { status: 'pass', message: 'Config valid (dry-run)' };
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message.includes('MODULE_NOT_FOUND') ||
        ('code' in err && err.code === 'MODULE_NOT_FOUND'))
    ) {
      return {
        status: 'fail',
        message: `Missing ${mod.sdkPackage} -- run: npm install ${mod.sdkPackage}`,
      };
    }
    // SDK loaded but factory creation failed (expected with fake key in dry-run)
    return { status: 'pass', message: 'Config valid (dry-run)' };
  }
}

// ── Exit code helper ───────────────────────────────────────────────

export function getExitCode(result: ValidationResult): number {
  if (result.summary.failed > 0) return 1;
  if (result.summary.warnings > 0) return 2;
  return 0;
}

// ── Main orchestration ─────────────────────────────────────────────

export async function runValidate(options: ValidateOptions): Promise<ValidationResult> {
  // Step 1: Load config
  const resolveOpts: { config?: string } = {};
  if (options.config !== undefined) {
    resolveOpts.config = options.config;
  }
  const { config } = await resolveConfig(resolveOpts);

  // Step 2: Build chain and group by provider
  const chain = buildChain(config);
  const providerEntries = new Map<string, ChainEntry[]>();
  for (const entry of chain) {
    const existing = providerEntries.get(entry.provider);
    if (existing) {
      existing.push(entry);
    } else {
      providerEntries.set(entry.provider, [entry]);
    }
  }

  // Step 3: Filter providers if --provider flag used
  let providerIds = [...providerEntries.keys()];
  const notFoundResults: ModelTestResult[] = [];

  if (options.provider && options.provider.length > 0) {
    const requested = new Set(options.provider);
    // Check for providers not in chain
    for (const req of requested) {
      if (!providerEntries.has(req)) {
        notFoundResults.push({
          provider: req,
          providerName: req,
          modelId: '',
          apiModelId: '',
          tier: 'unknown',
          free: false,
          tested: false,
          overallStatus: 'fail',
          keys: [],
          message: 'Provider not configured',
        });
      }
    }
    providerIds = providerIds.filter((id) => requested.has(id));
  }

  // Step 4: Pick first model per provider for testing
  const testedEntries = new Map<string, ChainEntry>();
  for (const [providerId, entries] of providerEntries) {
    if (providerIds.includes(providerId) && entries.length > 0) {
      testedEntries.set(providerId, entries[0]!);
    }
  }

  // Step 5: Dry-run mode
  if (options.dryRun) {
    const results: ModelTestResult[] = [];

    for (const providerId of providerIds) {
      const entries = providerEntries.get(providerId) ?? [];
      const dryResult = await dryRunProvider(providerId);
      const mod = getProviderModule(providerId);

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i]!;
        results.push({
          provider: providerId,
          providerName: mod?.name ?? providerId,
          modelId: entry.modelId,
          apiModelId: entry.apiModelId,
          tier: mod?.tier ?? 'unknown',
          free: entry.free,
          tested: i === 0,
          overallStatus: dryResult.status,
          keys: [],
          message: dryResult.message,
        });
      }
    }

    results.push(...notFoundResults);

    const passed = results.filter((r) => r.overallStatus === 'pass').length;
    const failed = results.filter((r) => r.overallStatus === 'fail').length;
    const warnings = results.filter((r) => r.overallStatus === 'warning').length;

    return {
      results,
      summary: {
        totalProviders: new Set(results.map((r) => r.provider)).size,
        totalKeys: 0,
        passed,
        failed,
        warnings,
      },
    };
  }

  // Step 6: Real API calls -- parallel providers, sequential keys
  const providerResults = await Promise.allSettled(
    providerIds.map(async (providerId) => {
      const testedEntry = testedEntries.get(providerId);
      if (!testedEntry) {
        return { providerId, keyResults: [] as KeyTestResult[] };
      }
      const keyResults = await testProvider(providerId, config, testedEntry, options.timeout);
      return { providerId, keyResults };
    }),
  );

  // Step 8: Assemble results
  const results: ModelTestResult[] = [];

  for (const settled of providerResults) {
    if (settled.status === 'rejected') continue;

    const { providerId, keyResults } = settled.value;
    const entries = providerEntries.get(providerId) ?? [];
    const mod = getProviderModule(providerId);

    // Compute overall status from key results
    const allKeyStatuses: TestStatus[] = [];
    for (const kr of keyResults) {
      allKeyStatuses.push(kr.generateText.status, kr.streamText.status);
    }
    const overall =
      allKeyStatuses.length > 0 ? worstStatus(allKeyStatuses) : ('skipped' as TestStatus);

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]!;
      const isTested = i === 0;

      if (isTested) {
        results.push({
          provider: providerId,
          providerName: mod?.name ?? providerId,
          modelId: entry.modelId,
          apiModelId: entry.apiModelId,
          tier: mod?.tier ?? 'unknown',
          free: entry.free,
          tested: true,
          overallStatus: overall,
          keys: keyResults,
        });
      } else {
        // Untested models inherit key status
        const untestedStatus: TestStatus =
          overall === 'pass' ? 'pass' : overall === 'warning' ? 'warning' : 'skipped';
        const untestedResult: ModelTestResult = {
          provider: providerId,
          providerName: mod?.name ?? providerId,
          modelId: entry.modelId,
          apiModelId: entry.apiModelId,
          tier: mod?.tier ?? 'unknown',
          free: entry.free,
          tested: false,
          overallStatus: untestedStatus,
          keys: [],
        };
        if (overall === 'pass') {
          untestedResult.message = '-- key ok';
        }
        results.push(untestedResult);
      }
    }
  }

  results.push(...notFoundResults);

  // Compute summary
  let totalKeys = 0;
  let passed = 0;
  let failed = 0;
  let warnings = 0;

  for (const r of results) {
    if (r.tested) {
      totalKeys += r.keys.length;
    }
    switch (r.overallStatus) {
      case 'pass':
        passed++;
        break;
      case 'fail':
        failed++;
        break;
      case 'warning':
        warnings++;
        break;
    }
  }

  return {
    results,
    summary: {
      totalProviders: new Set(results.map((r) => r.provider)).size,
      totalKeys,
      passed,
      failed,
      warnings,
    },
  };
}
