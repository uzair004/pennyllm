import { parseArgs } from 'node:util';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ValidateOptions } from './types.js';
import { runValidate, getExitCode } from './validate.js';
import { formatTable, formatSummary, formatJson, createSpinnerManager } from './format.js';

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

      // Create spinner manager (disabled for --json or non-TTY)
      const spinners = createSpinnerManager(!opts.json && process.stdout.isTTY === true);

      try {
        const result = await runValidate(opts, {
          onProviderStart: (id, name) => spinners.start(id, name),
          onProviderDone: (id, status, msg) => {
            if (status === 'pass') spinners.success(id, msg);
            else if (status === 'warning') spinners.warn(id, msg);
            else spinners.error(id, msg);
          },
        });

        // Clear any remaining spinners
        spinners.clear();

        // Output results
        if (opts.json) {
          console.log(formatJson(result));
        } else {
          console.log(formatTable(result, opts.verbose));
          console.log();
          console.log(formatSummary(result));
        }

        process.exitCode = getExitCode(result);
      } catch (err) {
        spinners.clear();
        if (err instanceof Error) {
          console.error(`Error: ${err.message}`);
        } else {
          console.error(`Error: ${String(err)}`);
        }
        process.exitCode = 1;
      }
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
