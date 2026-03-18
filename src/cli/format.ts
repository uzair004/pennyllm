import pc from 'picocolors';
import { createSpinner } from 'nanospinner';
import type { Spinner } from 'nanospinner';
import type { TestStatus, ValidationResult, ModelTestResult } from './types.js';

// ── Color helpers ───────────────────────────────────────────────────

function statusColor(status: TestStatus): (text: string) => string {
  switch (status) {
    case 'pass':
      return pc.green;
    case 'fail':
      return pc.red;
    case 'warning':
      return pc.yellow;
    case 'skipped':
      return pc.dim;
  }
}

function statusIcon(status: TestStatus): string {
  switch (status) {
    case 'pass':
      return pc.green('PASS');
    case 'fail':
      return pc.red('FAIL');
    case 'warning':
      return pc.yellow('WARN');
    case 'skipped':
      return pc.dim('SKIP');
  }
}

// ── Column widths ───────────────────────────────────────────────────

const COL = {
  provider: 14,
  keys: 16,
  model: 32,
  tier: 8,
  status: 8,
  latency: 10,
} as const;

function pad(text: string, width: number): string {
  // Strip ANSI for length calculation
  // eslint-disable-next-line no-control-regex
  const stripped = text.replace(/\x1b\[[0-9;]*m/g, '');
  const padding = Math.max(0, width - stripped.length);
  return text + ' '.repeat(padding);
}

// ── Table formatter ─────────────────────────────────────────────────

export function formatTable(result: ValidationResult, verbose: boolean): string {
  const lines: string[] = [];

  // Header
  const header = [
    pad(pc.bold('Provider'), COL.provider),
    pad(pc.bold('Keys'), COL.keys),
    pad(pc.bold('Model'), COL.model),
    pad(pc.bold('Tier'), COL.tier),
    pad(pc.bold('Status'), COL.status),
    pad(pc.bold('Latency'), COL.latency),
    pc.bold('Message'),
  ].join('');
  lines.push(header);

  const totalWidth = COL.provider + COL.keys + COL.model + COL.tier + COL.status + COL.latency + 20;
  lines.push(pc.dim('\u2500'.repeat(totalWidth)));

  // Sort results by provider name
  const sorted = [...result.results].sort((a, b) => a.providerName.localeCompare(b.providerName));

  for (const model of sorted) {
    if (!verbose) {
      // Single row per model
      const keysText = formatKeysColumn(model);
      const latencyText = formatLatency(model);
      const messageText = formatMessage(model);
      const status = model.tested ? statusIcon(model.overallStatus) : pc.dim('--');

      lines.push(
        [
          pad(model.providerName, COL.provider),
          pad(keysText, COL.keys),
          pad(model.apiModelId || pc.dim('(none)'), COL.model),
          pad(model.free ? pc.green('free') : pc.yellow('paid'), COL.tier),
          pad(status, COL.status),
          pad(latencyText, COL.latency),
          messageText,
        ].join(''),
      );
    } else {
      // Verbose: one row per key
      if (!model.tested || model.keys.length === 0) {
        // Untested model -- single row
        const status = model.tested ? statusIcon(model.overallStatus) : pc.dim('--');
        lines.push(
          [
            pad(model.providerName, COL.provider),
            pad('', COL.keys),
            pad(model.apiModelId || pc.dim('(none)'), COL.model),
            pad(model.free ? pc.green('free') : pc.yellow('paid'), COL.tier),
            pad(status, COL.status),
            pad('', COL.latency),
            model.message ?? '',
          ].join(''),
        );
      } else {
        // First key row includes provider/model/tier
        for (let i = 0; i < model.keys.length; i++) {
          const key = model.keys[i]!;
          const isFirst = i === 0;

          // generateText row
          const genStatus = statusIcon(key.generateText.status);
          const genLatency =
            key.generateText.latencyMs !== undefined
              ? `${(key.generateText.latencyMs / 1000).toFixed(1)}s`
              : '';
          const genMsg = key.generateText.message ?? '';

          lines.push(
            [
              pad(isFirst ? model.providerName : '', COL.provider),
              pad(`Key ${i + 1} generate`, COL.keys),
              pad(isFirst ? model.apiModelId : '', COL.model),
              pad(isFirst ? (model.free ? pc.green('free') : pc.yellow('paid')) : '', COL.tier),
              pad(genStatus, COL.status),
              pad(genLatency, COL.latency),
              genMsg,
            ].join(''),
          );

          // streamText row
          const strStatus = statusIcon(key.streamText.status);
          const strLatency =
            key.streamText.latencyMs !== undefined
              ? `${(key.streamText.latencyMs / 1000).toFixed(1)}s`
              : '';
          const strMsg = key.streamText.message ?? '';

          lines.push(
            [
              pad('', COL.provider),
              pad(`Key ${i + 1} stream`, COL.keys),
              pad('', COL.model),
              pad('', COL.tier),
              pad(strStatus, COL.status),
              pad(strLatency, COL.latency),
              strMsg,
            ].join(''),
          );
        }
      }
    }
  }

  return lines.join('\n');
}

// ── Helper formatters ───────────────────────────────────────────────

function formatKeysColumn(model: ModelTestResult): string {
  if (!model.tested || model.keys.length === 0) return pc.dim('--');

  const total = model.keys.length;
  const passed = model.keys.filter(
    (k) => k.generateText.status === 'pass' && k.streamText.status === 'pass',
  ).length;

  if (passed === total) {
    return pc.green(`${passed}/${total} keys ok`);
  }
  return pc.red(`${passed}/${total} keys fail`);
}

function formatLatency(model: ModelTestResult): string {
  if (!model.tested || model.keys.length === 0) return '';

  const latencies: number[] = [];
  for (const key of model.keys) {
    if (key.generateText.latencyMs !== undefined) {
      latencies.push(key.generateText.latencyMs);
    }
  }
  if (latencies.length === 0) return '';

  const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  return `${(avg / 1000).toFixed(1)}s`;
}

function formatMessage(model: ModelTestResult): string {
  if (model.message) return statusColor(model.overallStatus)(model.message);

  // Find first error/warning message from keys
  for (const key of model.keys) {
    if (key.generateText.message) {
      return statusColor(key.generateText.status)(key.generateText.message);
    }
    if (key.streamText.message) {
      return statusColor(key.streamText.status)(key.streamText.message);
    }
  }
  return '';
}

// ── Summary formatter ───────────────────────────────────────────────

export function formatSummary(result: ValidationResult): string {
  const { totalProviders, totalKeys, passed, failed, warnings } = result.summary;

  const parts = [
    `${totalProviders} providers (${totalKeys} keys)`,
    pc.green(`${passed} passed`),
    failed > 0 ? pc.red(`${failed} failed`) : `${failed} failed`,
    warnings > 0 ? pc.yellow(`${warnings} warnings`) : `${warnings} warnings`,
  ];

  return parts.join(', ');
}

// ── JSON formatter ──────────────────────────────────────────────────

export function formatJson(result: ValidationResult): string {
  return JSON.stringify(result, null, 2);
}

// ── Spinner management ──────────────────────────────────────────────

export interface SpinnerManager {
  start(providerId: string, providerName: string): void;
  success(providerId: string, message: string): void;
  error(providerId: string, message: string): void;
  warn(providerId: string, message: string): void;
  clear(): void;
}

const noop: SpinnerManager = {
  start() {},
  success() {},
  error() {},
  warn() {},
  clear() {},
};

export function createSpinnerManager(enabled: boolean): SpinnerManager {
  if (!enabled) return noop;

  const spinners = new Map<string, Spinner>();

  return {
    start(providerId: string, providerName: string) {
      const spinner = createSpinner(`Testing ${providerName}...`);
      spinner.start();
      spinners.set(providerId, spinner);
    },

    success(providerId: string, message: string) {
      const spinner = spinners.get(providerId);
      if (spinner) {
        spinner.success({ text: message });
        spinners.delete(providerId);
      }
    },

    error(providerId: string, message: string) {
      const spinner = spinners.get(providerId);
      if (spinner) {
        spinner.error({ text: message });
        spinners.delete(providerId);
      }
    },

    warn(providerId: string, message: string) {
      const spinner = spinners.get(providerId);
      if (spinner) {
        spinner.warn({ text: message });
        spinners.delete(providerId);
      }
    },

    clear() {
      for (const [id, spinner] of spinners) {
        spinner.stop();
        spinners.delete(id);
      }
    },
  };
}
