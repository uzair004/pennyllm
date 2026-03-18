import { existsSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import { createJiti } from 'jiti';
import { configSchema } from '../config/schema.js';
import { loadConfigFile } from '../config/loader.js';
import { ConfigError } from '../errors/config-error.js';
import type { RouterConfig } from '../types/config.js';

export const CONFIG_NAMES = [
  'pennyllm.config.ts',
  'pennyllm.config.js',
  'pennyllm.config.json',
  'pennyllm.config.yaml',
  'pennyllm.config.yml',
] as const;

/**
 * Discover a PennyLLM config file by traversing from startDir upward.
 * Checks up to 5 parent directories.
 * @returns Absolute path to the first config file found, or null.
 */
export function discoverConfig(startDir?: string): string | null {
  let dir = resolve(startDir ?? process.cwd());
  const maxDepth = 5;

  for (let i = 0; i <= maxDepth; i++) {
    for (const name of CONFIG_NAMES) {
      const candidate = resolve(dir, name);
      if (existsSync(candidate)) {
        return candidate;
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break; // reached filesystem root
    dir = parent;
  }

  return null;
}

/**
 * Load a PennyLLM config file. Handles .ts/.js via jiti, .json/.yaml/.yml via loadConfigFile.
 */
export async function loadConfig(filePath: string): Promise<RouterConfig> {
  const ext = extname(filePath);

  if (ext === '.ts' || ext === '.js') {
    const jiti = createJiti(import.meta.url);
    // jiti.import with { default: true } extracts .default automatically
    const raw: unknown = await jiti.import(filePath, { default: true });
    const validated = configSchema.parse(raw) as RouterConfig;
    return validated;
  }

  // .json, .yaml, .yml — delegate to existing loader
  return loadConfigFile(filePath);
}

/**
 * Resolve config path and load it.
 * Priority: explicit --config flag > PENNYLLM_CONFIG env var > auto-discovery.
 */
export async function resolveConfig(options: {
  config?: string;
}): Promise<{ config: RouterConfig; configPath: string }> {
  let configPath: string | null = null;

  if (options.config) {
    configPath = resolve(options.config);
  } else if (process.env['PENNYLLM_CONFIG']) {
    configPath = resolve(process.env['PENNYLLM_CONFIG']);
  } else {
    configPath = discoverConfig();
  }

  if (!configPath) {
    const searchedNames = CONFIG_NAMES.join(', ');
    throw new ConfigError(
      `No config file found. Searched for: ${searchedNames} (up to 5 parent directories). ` +
        `Create a pennyllm.config.ts in your project root or specify one with --config.`,
      { field: 'config' },
    );
  }

  if (!existsSync(configPath)) {
    throw new ConfigError(`Config file not found: ${configPath}`, { field: 'config' });
  }

  const config = await loadConfig(configPath);
  return { config, configPath };
}
