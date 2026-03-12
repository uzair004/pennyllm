import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { configSchema } from '../src/config/schema.js';
import { interpolateEnvVars, loadConfigFile } from '../src/config/loader.js';
import { createRouter, defineConfig } from '../src/config/index.js';
import { ConfigError } from '../src/errors/config-error.js';

describe('configSchema validation', () => {
  it('parses valid minimal config with defaults applied', () => {
    const input = {
      providers: {
        google: {
          keys: ['key1'],
        },
      },
    };

    const result = configSchema.parse(input);

    expect(result.version).toBe('1.0');
    expect(result.strategy).toBe('round-robin');
    expect(result.budget.monthlyLimit).toBe(0);
    expect(result.budget.alertThresholds).toEqual([0.8, 0.95]);
    expect(result.providers.google.enabled).toBe(true);
  });

  it('parses config with all fields explicitly set', () => {
    const input = {
      version: '1.0' as const,
      providers: {
        google: {
          keys: ['key1', 'key2'],
          strategy: 'least-used' as const,
          enabled: false,
        },
      },
      strategy: 'least-used' as const,
      budget: {
        monthlyLimit: 100,
        alertThresholds: [0.5, 0.75, 0.9],
      },
    };

    const result = configSchema.parse(input);

    expect(result.version).toBe('1.0');
    expect(result.strategy).toBe('least-used');
    expect(result.budget.monthlyLimit).toBe(100);
    expect(result.budget.alertThresholds).toEqual([0.5, 0.75, 0.9]);
    expect(result.providers.google.strategy).toBe('least-used');
    expect(result.providers.google.enabled).toBe(false);
  });

  it('rejects empty providers object', () => {
    const input = {
      providers: {},
    };

    const result = configSchema.safeParse(input);

    expect(result.success).toBe(false);
  });

  it('rejects provider with empty keys array', () => {
    const input = {
      providers: {
        google: {
          keys: [],
        },
      },
    };

    const result = configSchema.safeParse(input);

    expect(result.success).toBe(false);
  });

  it('rejects invalid strategy value', () => {
    const input = {
      providers: {
        google: {
          keys: ['key1'],
          strategy: 'invalid-strategy',
        },
      },
    };

    const result = configSchema.safeParse(input);

    expect(result.success).toBe(false);
  });

  it('rejects unknown top-level keys (strict mode)', () => {
    const input = {
      providers: {
        google: {
          keys: ['key1'],
        },
      },
      unknownField: 'value',
    };

    const result = configSchema.safeParse(input);

    expect(result.success).toBe(false);
  });

  it('accepts config with budget.monthlyLimit = 0', () => {
    const input = {
      providers: {
        google: {
          keys: ['key1'],
        },
      },
      budget: {
        monthlyLimit: 0,
      },
    };

    const result = configSchema.parse(input);

    expect(result.budget.monthlyLimit).toBe(0);
  });
});

describe('interpolateEnvVars', () => {
  beforeEach(() => {
    process.env.TEST_VAR = 'test-value';
    process.env.ANOTHER_VAR = 'another-value';
  });

  afterEach(() => {
    delete process.env.TEST_VAR;
    delete process.env.ANOTHER_VAR;
  });

  it('replaces ${VAR} with env value', () => {
    const input = 'Config with ${TEST_VAR} and ${ANOTHER_VAR}';
    const result = interpolateEnvVars(input);

    expect(result).toBe('Config with test-value and another-value');
  });

  it('throws ConfigError for undefined env var', () => {
    const input = 'Config with ${UNDEFINED_VAR}';

    expect(() => interpolateEnvVars(input)).toThrow(ConfigError);
    expect(() => interpolateEnvVars(input)).toThrow(
      'Environment variable "UNDEFINED_VAR" is not defined',
    );
  });

  it('handles multiple occurrences of same variable', () => {
    const input = '${TEST_VAR} and ${TEST_VAR} again';
    const result = interpolateEnvVars(input);

    expect(result).toBe('test-value and test-value again');
  });

  it('returns unchanged string if no variables', () => {
    const input = 'No variables here';
    const result = interpolateEnvVars(input);

    expect(result).toBe('No variables here');
  });
});

describe('loadConfigFile', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'llm-router-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('parses a JSON file', () => {
    const configPath = join(tempDir, 'config.json');
    const configContent = JSON.stringify({
      providers: {
        google: {
          keys: ['key1', 'key2'],
        },
      },
    });
    writeFileSync(configPath, configContent, 'utf-8');

    const result = loadConfigFile(configPath);

    expect(result.providers.google.keys).toEqual(['key1', 'key2']);
    expect(result.version).toBe('1.0');
    expect(result.strategy).toBe('round-robin');
  });

  it('parses a YAML file with env var interpolation', () => {
    process.env.GOOGLE_API_KEY = 'test-api-key';

    const configPath = join(tempDir, 'config.yml');
    const configContent = `
providers:
  google:
    keys:
      - \${GOOGLE_API_KEY}
`;
    writeFileSync(configPath, configContent, 'utf-8');

    const result = loadConfigFile(configPath);

    expect(result.providers.google.keys).toEqual(['test-api-key']);

    delete process.env.GOOGLE_API_KEY;
  });

  it('throws ConfigError for invalid file path', () => {
    const invalidPath = join(tempDir, 'nonexistent.json');

    expect(() => loadConfigFile(invalidPath)).toThrow(ConfigError);
  });

  it('throws ConfigError for invalid JSON', () => {
    const configPath = join(tempDir, 'invalid.json');
    writeFileSync(configPath, '{ invalid json }', 'utf-8');

    expect(() => loadConfigFile(configPath)).toThrow(ConfigError);
  });

  it('throws ConfigError for invalid config schema', () => {
    const configPath = join(tempDir, 'invalid-schema.json');
    const configContent = JSON.stringify({
      providers: {},
    });
    writeFileSync(configPath, configContent, 'utf-8');

    expect(() => loadConfigFile(configPath)).toThrow(ConfigError);
  });

  it('throws ConfigError for unsupported file extension', () => {
    const configPath = join(tempDir, 'config.txt');
    writeFileSync(configPath, 'some content', 'utf-8');

    expect(() => loadConfigFile(configPath)).toThrow(ConfigError);
    expect(() => loadConfigFile(configPath)).toThrow('Unsupported file extension');
  });
});

describe('createRouter', () => {
  it('accepts valid config object and returns router stub', async () => {
    const config = {
      providers: {
        google: {
          keys: ['key1'],
        },
      },
    };

    const router = await createRouter(config);

    expect(router).toBeDefined();
    expect(typeof router.model).toBe('function');
    expect(typeof router.getUsage).toBe('function');
    expect(typeof router.health).toBe('function');
    expect(typeof router.getConfig).toBe('function');
    expect(typeof router.close).toBe('function');
    expect(typeof router.on).toBe('function');
    expect(typeof router.off).toBe('function');
  });

  it('getConfig returns validated config', async () => {
    const config = {
      providers: {
        google: {
          keys: ['key1'],
        },
      },
    };

    const router = await createRouter(config);
    const retrievedConfig = router.getConfig();

    expect(retrievedConfig.providers.google.keys).toEqual(['key1']);
    expect(retrievedConfig.version).toBe('1.0');
  });

  it('rejects invalid config and throws ConfigError', async () => {
    const invalidConfig = {
      providers: {},
    };

    await expect(createRouter(invalidConfig)).rejects.toThrow(ConfigError);
  });

  it('loads config from file path', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'llm-router-test-'));
    const configPath = join(tempDir, 'config.json');
    const configContent = JSON.stringify({
      providers: {
        google: {
          keys: ['file-key'],
        },
      },
    });
    writeFileSync(configPath, configContent, 'utf-8');

    const router = await createRouter(configPath);
    const config = router.getConfig();

    expect(config.providers.google.keys).toEqual(['file-key']);

    rmSync(tempDir, { recursive: true, force: true });
  });
});

describe('defineConfig', () => {
  it('returns input unchanged', () => {
    const config = {
      providers: {
        google: {
          keys: ['key1'],
        },
      },
    };

    const result = defineConfig(config);

    expect(result).toBe(config);
  });

  it('provides type safety without runtime overhead', () => {
    const config = defineConfig({
      providers: {
        google: {
          keys: ['key1'],
        },
      },
      strategy: 'round-robin' as const,
    });

    expect(config.strategy).toBe('round-robin');
  });
});
