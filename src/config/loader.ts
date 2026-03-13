import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import debugFactory from 'debug';
import type { RouterConfig } from '../types/config.js';
import { ConfigError } from '../errors/config-error.js';
import { configSchema } from './schema.js';

const debug = debugFactory('llm-router:config');

/**
 * Interpolate environment variables in a string
 * Replaces ${VAR} patterns with process.env values
 * @throws {ConfigError} If environment variable is not defined
 */
export function interpolateEnvVars(str: string): string {
  return str.replace(/\$\{([^}]+)\}/g, (_match, varName: string) => {
    const value = process.env[varName];
    if (value === undefined) {
      throw new ConfigError(`Environment variable "${varName}" is not defined`, {
        field: 'environment',
      });
    }
    return value;
  });
}

/**
 * Load and validate configuration from a file
 * Supports JSON and YAML formats with environment variable interpolation
 * @param filePath - Path to configuration file (.json, .yml, or .yaml)
 * @returns Validated router configuration
 * @throws {ConfigError} If file cannot be read, parsed, or validated
 */
export async function loadConfigFile(filePath: string): Promise<RouterConfig> {
  debug('Loading config from file: %s', filePath);

  let rawContent: string;
  try {
    rawContent = readFileSync(filePath, 'utf-8');
  } catch (error) {
    const options: { field?: string; cause?: Error } = {};
    if (error instanceof Error) {
      options.cause = error;
    }
    throw new ConfigError(`Failed to read config file: ${filePath}`, options);
  }

  // Apply environment variable interpolation
  const interpolated = interpolateEnvVars(rawContent);

  // Parse based on file extension
  const ext = extname(filePath);
  let parsed: unknown;

  try {
    if (ext === '.json') {
      parsed = JSON.parse(interpolated);
    } else if (ext === '.yml' || ext === '.yaml') {
      // Dynamic import for optional peer dependency
      let yaml: typeof import('js-yaml');
      try {
        yaml = await import('js-yaml');
      } catch {
        throw new ConfigError(
          'YAML support requires the "js-yaml" package to be installed. Install it with: npm install js-yaml',
          { field: 'dependencies' },
        );
      }
      parsed = yaml.load(interpolated);
    } else {
      throw new ConfigError(`Unsupported file extension: ${ext}. Use .json, .yml, or .yaml`, {
        field: 'filePath',
      });
    }
  } catch (error) {
    if (error instanceof ConfigError) throw error;
    const options: { field?: string; cause?: Error } = {};
    if (error instanceof Error) {
      options.cause = error;
    }
    throw new ConfigError(`Failed to parse config file: ${filePath}`, options);
  }

  // Validate through schema
  try {
    const validated = configSchema.parse(parsed) as RouterConfig;
    debug('Config loaded successfully (keys redacted)');
    return validated;
  } catch (error) {
    const options: { field?: string; cause?: Error } = {};
    if (error instanceof Error) {
      options.cause = error;
    }
    throw new ConfigError('Config validation failed', options);
  }
}
