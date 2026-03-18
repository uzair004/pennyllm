import { parseArgs } from 'node:util';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ValidateOptions } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgPath = resolve(__dirname, '..', 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version: string };

const HELP_TEXT = `Usage: pennyllm <command> [options]

Commands:
  validate    Test configured providers and models with real API calls

Global Options:
  -h, --help     Show help
  -v, --version  Show version

Examples:
  npx pennyllm validate
  npx pennyllm validate --json
  npx pennyllm validate --provider cerebras --provider google
  npx pennyllm validate --dry-run

Run "pennyllm <command> --help" for command-specific options.`;

const VALIDATE_HELP = `Usage: pennyllm validate [options]

Test each configured provider+model with a real API call.

Options:
  -c, --config <path>     Path to config file (default: auto-discover)
  --provider <name>       Filter to specific provider(s) (repeatable)
  -t, --timeout <ms>      Per-provider timeout in ms (default: 10000)
  --json                  Output structured JSON (for CI)
  --verbose               Show per-key details and extra info
  --dry-run               Validate config without making API calls
  -h, --help              Show this help

Exit Codes:
  0  All tests passed
  1  At least one failure
  2  No failures but has warnings`;

async function runValidate(opts: ValidateOptions): Promise<void> {
  // Plan 02 implements this — for now just confirm arg parsing works
  await Promise.resolve();
  console.log('validate called with:', JSON.stringify(opts, null, 2));
  process.exitCode = 0;
}

void (async () => {
  try {
    const { positionals, values: globalValues } = parseArgs({
      options: {
        help: { type: 'boolean', short: 'h', default: false },
        version: { type: 'boolean', short: 'v', default: false },
      },
      allowPositionals: true,
      strict: false,
    });

    if (globalValues['version']) {
      console.log(`pennyllm v${pkg.version}`);
      process.exitCode = 0;
      return;
    }

    const subcommand = positionals[0];

    if (!subcommand) {
      console.log(HELP_TEXT);
      process.exitCode = 0;
      return;
    }

    if (subcommand === 'validate') {
      const { values } = parseArgs({
        args: process.argv.slice(3),
        options: {
          config: { type: 'string', short: 'c' },
          provider: { type: 'string', multiple: true },
          timeout: { type: 'string', short: 't' },
          json: { type: 'boolean', default: false },
          verbose: { type: 'boolean', default: false },
          'dry-run': { type: 'boolean', default: false },
          help: { type: 'boolean', short: 'h', default: false },
        },
      });

      if (values.help) {
        console.log(VALIDATE_HELP);
        process.exitCode = 0;
        return;
      }

      const opts: ValidateOptions = {
        timeout: values.timeout ? parseInt(values.timeout, 10) : 10_000,
        json: values.json ?? false,
        verbose: values.verbose ?? false,
        dryRun: values['dry-run'] ?? false,
      };
      if (values.config !== undefined) opts.config = values.config;
      if (values.provider !== undefined) opts.provider = values.provider;

      await runValidate(opts);
      return;
    }

    console.error(`Unknown command: ${subcommand}\n`);
    console.log(HELP_TEXT);
    process.exitCode = 1;
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  }
})();
