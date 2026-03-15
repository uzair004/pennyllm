# Phase 1: Foundation Setup - Research

**Researched:** 2026-03-12
**Domain:** TypeScript npm package development with build tooling
**Confidence:** HIGH

## Summary

Phase 1 establishes the foundation for a TypeScript npm package with dual ESM+CJS output, strict type checking, comprehensive development tooling, and testing infrastructure. The modern TypeScript package ecosystem in 2026 prioritizes minimal configuration with strict defaults, using purpose-built tools like tsup for bundling, Vitest for testing, and Zod for configuration validation.

The primary challenges are: (1) correctly configuring dual module format output with proper package.json exports, (2) setting up TypeScript with strict mode for library development, and (3) establishing a complete development workflow with linting, formatting, commit conventions, and versioning automation.

**Primary recommendation:** Use tsup for zero-config bundling with dual ESM+CJS output, Vitest for testing (native TypeScript support), Zod for config validation, and standard tooling (ESLint, Prettier, Husky, lint-staged, commitlint, Changesets) for development workflow automation.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Module Format & Build

- Dual ESM+CJS output via tsup (format: ['esm', 'cjs'])
- Subpath exports for modular imports (e.g., `pennyllm/storage`, `pennyllm/providers`)
- Minimum Node.js 18+
- No path aliases — relative imports only (flat src/ keeps paths short)
- Single package (not monorepo) — interface-based plugin extensibility without monorepo overhead

#### Project Structure

- Flat by domain: `src/storage/`, `src/policy/`, `src/selection/`, `src/catalog/`, `src/types/`, `src/config/`
- Standard npm package conventions

#### Tooling

- Vitest for testing
- ESLint + Prettier for linting/formatting
- lint-staged + husky for pre-commit hooks (lint + format staged files)
- commitlint + husky for conventional commits enforcement
- Changesets (@changesets/cli) for versioning
- GitHub Actions CI: lint + typecheck + tests on every push
- Basic CONTRIBUTING.md with setup/test/lint commands

#### Config Ergonomics

- Single config object validated by Zod (not builder pattern, not config file auto-detection)
- File-based config loading: JSON + YAML with `${VAR}` environment variable interpolation
- YAML parser as optional peer dependency (consumer installs only if using YAML)
- Deep merge with sensible safe defaults (strategy: round-robin, storage: sqlite, budget: $0)
- Eager validation at `createRouter()` — fail fast on invalid config
- Schema versioned with `version` field for future migration
- Zod schema exported for consumer use (validation, tooling, future Admin UI)
- Config introspection via `router.getConfig()` — read-only, API keys redacted by default
- No profiles/environments, no config extends/composition, no hot-reload (deferred)
- Timeouts deferred to Vercel AI SDK — no custom timeout layer
- Provider groups/pools deferred to Phase 9
- Config warnings for common mistakes via debug logger (not stderr)
- `defineConfig()` helper exported for type-safe config files (zero runtime cost)

#### Constants & Enums

- Const objects with string values (`as const`) for all config enums — not TypeScript enums, not raw strings
- Examples: `Strategy.ROUND_ROBIN = 'round-robin'`, `Provider.GOOGLE = 'google'`
- Provider IDs match Vercel AI SDK provider names (e.g., `'google'`, `'groq'`) for familiarity
- All config values JSON-serializable (important: future Admin UI will read/write config)

#### Provider Config Shape

- Object with provider names as keys: `{ providers: { google: {...}, groq: {...} } }`
- API keys in provider config: `{ keys: [process.env.KEY1, process.env.KEY2] }` — consumer manages key loading
- Multiple router instances supported — each `createRouter()` returns independent instance

#### Dependencies

- Vercel AI SDK (`ai`) as peer dependency — standard for SDK wrappers, npm 7+ auto-installs
- Zod as regular dependency (~13KB gzipped)
- `debug` package as regular dependency
- YAML parser as optional peer dependency

#### Package API Surface

- `createRouter(config)` factory function — async (returns Promise), initializes SQLite/validation during creation
- `router.model('provider/model-name')` returns wrapped AI SDK model — combined 'provider/model' format
- Per-request overrides: `router.model('google/gemini', { strategy: Strategy.ROUND_ROBIN })`
- `router.getUsage(provider)` — current token consumption, remaining quota
- `router.health()` — per-provider status (active, rate-limited, exhausted)
- `router.getConfig()` — read-only resolved config with redacted keys
- `router.close()` — explicit cleanup (SQLite connections, timers)
- Export all public TypeScript types: RouterConfig, ProviderStatus, UsageStats, event types, etc.
- No AI SDK re-exports — consumer imports `generateText`/`streamText` from `'ai'` directly
- Explicit model only — no auto-selection mode (Phase 9 handles capability-aware routing)
- Interface shapes defined for future features: `addKey()`, `removeKey()`, `models()` — implementation deferred

#### Minimal Usage Example (3 lines)

```typescript
const router = await createRouter({ providers: { google: { keys: [env.KEY] } } });
const model = router.model('google/gemini-2.0-flash');
const { text } = await generateText({ model, prompt: 'Hello' });
```

#### Events & Hooks

- Node.js EventEmitter pattern: `router.on('key:selected', handler)`
- Fully typed events — each event name maps to specific TypeScript event type
- Namespaced event names with colon: `'key:selected'`, `'usage:recorded'`, `'limit:warning'`
- Event names also as const objects: `RouterEvent.KEY_SELECTED`
- Wildcard listener: `router.on('*', handler)` captures all events
- Standard metadata on every event: `{ timestamp, requestId, ...payload }`
- Fire-and-forget — async handlers are not awaited

#### Error Handling

- Base `PennyLLMError` class defined in Phase 1
- Typed error subclasses with metadata: `ConfigError`, `RateLimitError`, `QuotaExhaustedError`
- Actionable suggestions: `error.suggestion` with human-readable advice + machine-readable data (e.g., `retryAfter`)
- JSON serializable: `error.toJSON()` for logging pipelines and future Admin UI

#### Logging

- `debug` package with component-based namespaces: `pennyllm:config`, `pennyllm:selection`, `pennyllm:usage`, `pennyllm:storage`
- Consumer enables: `DEBUG=pennyllm:*` for all, `DEBUG=pennyllm:selection` for specific
- Human-readable messages with inline data
- API keys always redacted in debug output

#### Plugin DX

- Minimal interfaces with few required methods
- Abstract base classes / helper functions provided so consumers don't start from scratch
- e.g., `AbstractStorageBackend` with common logic

#### License & Naming

- MIT license
- Package name deferred — placeholder during development, branding decided post-implementation
- README content deferred to Phase 11 (DX Polish)

### Claude's Discretion

- Exact domain type field shapes (ModelMetadata, Policy, UsageRecord, TimeWindow)
- Internal code organization within each domain folder
- Test file organization and naming conventions
- Exact Zod schema nesting structure
- Abstract base class method signatures
- GitHub Actions workflow configuration details

### Deferred Ideas (OUT OF SCOPE)

- Package naming and branding — decide after implementation
- Hot-reloadable config (`router.updateConfig()`) — decide when Admin UI needs it
- Provider groups/pools in config — Phase 9
- Auto-model selection (`router.auto('reasoning')`) — Phase 9
- Router-level middleware/interceptors — Phase 6+ (AI SDK's wrapLanguageModel handles this)
- Dynamic key rotation (addKey/removeKey) — Phase 10+
- Model listing API — Phase 5 (ModelCatalog implementation)
- README content — Phase 11 (DX Polish)
  </user_constraints>

<phase_requirements>

## Phase Requirements

| ID      | Description                                                                                                 | Research Support                                                                                                 |
| ------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| CORE-01 | Package initializes with API keys and provider configuration via TypeScript config object or JSON/YAML file | Zod schema validation with YAML interpolation patterns, tsconfig compilation, package.json exports configuration |
| DX-07   | TypeScript types exported for all configuration, events, and public API                                     | TypeScript declaration file generation (.d.ts), type inference from Zod schemas, tsconfig declaration settings   |

</phase_requirements>

## Standard Stack

### Core

| Library    | Version      | Purpose                     | Why Standard                                                                                     |
| ---------- | ------------ | --------------------------- | ------------------------------------------------------------------------------------------------ |
| TypeScript | 5.5+         | Type system and compilation | Required by Zod, industry standard for npm packages, strict mode enforcement                     |
| tsup       | Latest       | Build bundler               | Zero-config dual ESM+CJS bundling with automatic .d.ts generation, built on esbuild for speed    |
| Zod        | 4.x (stable) | Schema validation           | Type-safe validation with automatic TypeScript inference, 2KB gzipped, JSON-serializable schemas |
| Vitest     | 4.0.17+      | Testing framework           | Native TypeScript support, Jest-compatible API, faster than Jest, reuses Vite config             |
| debug      | Latest       | Structured logging          | Standard for library logging, namespace-based filtering, zero runtime cost when disabled         |

### Supporting

| Library                         | Version                | Purpose                   | When to Use                                                             |
| ------------------------------- | ---------------------- | ------------------------- | ----------------------------------------------------------------------- |
| ESLint                          | Latest                 | Linting                   | Enforces code quality standards                                         |
| Prettier                        | Latest                 | Code formatting           | Consistent code style across contributors                               |
| husky                           | v9+                    | Git hooks                 | Pre-commit and commit-msg automation                                    |
| lint-staged                     | Latest                 | Staged file processing    | Runs linters only on files being committed                              |
| commitlint                      | Latest                 | Commit message validation | Enforces conventional commit format                                     |
| @commitlint/config-conventional | Latest                 | Commitlint rules          | Standard conventional commit rules                                      |
| @changesets/cli                 | Latest                 | Versioning & changelogs   | Automates version bumps and CHANGELOG generation                        |
| better-sqlite3                  | Latest                 | SQLite driver             | Default storage backend — fastest synchronous SQLite driver for Node.js |
| js-yaml                         | Latest (optional peer) | YAML parsing              | Config file loading when user provides YAML config                      |

### Alternatives Considered

| Instead of     | Could Use                          | Tradeoff                                                                        |
| -------------- | ---------------------------------- | ------------------------------------------------------------------------------- |
| tsup           | tsc + rollup                       | More control but requires extensive configuration, no zero-config DX            |
| Vitest         | Jest                               | Jest requires more TypeScript configuration, slower, doesn't reuse build config |
| Zod            | Joi / Yup                          | No TypeScript type inference, larger bundle size                                |
| better-sqlite3 | node-sqlite3                       | Async API (slower), less TypeScript-friendly                                    |
| better-sqlite3 | Node.js built-in sqlite (Node 22+) | Less control over SQLite config, Node 22+ only (we target Node 18+)             |
| debug          | winston / pino                     | Overkill for library logging, adds weight, user's app handles transport         |

**Installation:**

```bash
# Core dependencies
npm install zod debug better-sqlite3

# Peer dependencies (user installs)
npm install ai  # Vercel AI SDK
npm install js-yaml  # Optional, only if using YAML config

# Dev dependencies
npm install --save-dev typescript tsup vitest \
  eslint prettier \
  husky lint-staged \
  @commitlint/cli @commitlint/config-conventional \
  @changesets/cli \
  @types/node @types/better-sqlite3 @types/debug
```

## Architecture Patterns

### Recommended Project Structure

```
pennyllm/
├── src/
│   ├── index.ts                # Main exports: createRouter, types, constants
│   ├── types/                  # Domain types & interfaces
│   │   ├── index.ts            # Export all types
│   │   ├── config.ts           # RouterConfig, ProviderConfig types
│   │   ├── domain.ts           # ModelMetadata, Policy, UsageRecord, TimeWindow
│   │   ├── interfaces.ts       # StorageBackend, ModelCatalog, SelectionStrategy
│   │   └── events.ts           # Event type definitions
│   ├── config/                 # Configuration handling
│   │   ├── index.ts            # createRouter factory, config loading
│   │   ├── schema.ts           # Zod schemas
│   │   ├── loader.ts           # JSON/YAML loading with env interpolation
│   │   ├── defaults.ts         # Safe default values
│   │   └── define-config.ts    # defineConfig() helper
│   ├── errors/                 # Error classes
│   │   ├── index.ts            # Export all errors
│   │   ├── base.ts             # PennyLLMError base class
│   │   └── config-error.ts     # ConfigError (Phase 1), others deferred
│   ├── constants/              # Const objects (Strategy, Provider, etc.)
│   │   └── index.ts
│   ├── storage/                # StorageBackend interface (impl in Phase 2)
│   │   ├── index.ts
│   │   └── interface.ts
│   ├── catalog/                # ModelCatalog interface (impl in Phase 5)
│   │   ├── index.ts
│   │   └── interface.ts
│   ├── selection/              # SelectionStrategy interface (impl in Phase 5)
│   │   ├── index.ts
│   │   └── interface.ts
│   └── policy/                 # Policy types only (impl in Phase 3)
│       ├── index.ts
│       └── types.ts
├── tests/                      # Vitest test files
│   ├── config.test.ts
│   ├── schema.test.ts
│   └── errors.test.ts
├── dist/                       # tsup output (gitignored)
├── .husky/                     # Git hooks
│   ├── pre-commit              # Runs lint-staged
│   └── commit-msg              # Runs commitlint
├── tsconfig.json               # TypeScript configuration
├── tsup.config.ts              # Build configuration
├── vitest.config.ts            # Test configuration
├── eslint.config.js            # ESLint flat config
├── .prettierrc                 # Prettier config
├── .lintstagedrc               # lint-staged config
├── commitlint.config.js        # Commitlint config
├── package.json                # Package manifest with exports
├── LICENSE                     # MIT license
├── CONTRIBUTING.md             # Development setup guide
└── README.md                   # Placeholder (content in Phase 11)
```

### Pattern 1: tsup Dual ESM+CJS Build

**What:** Single build command produces both ESM and CJS outputs with TypeScript declarations
**When to use:** All library builds
**Example:**

```typescript
// tsup.config.ts
// Source: https://johnnyreilly.com/dual-publishing-esm-cjs-modules-with-tsup-and-are-the-types-wrong
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  minify: false,
  target: 'es2022',
  outDir: 'dist',
  outExtension: ({ format }) => ({
    js: format === 'cjs' ? '.cjs' : '.mjs',
  }),
});
```

**package.json configuration:**

```json
{
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs"
    },
    "./storage": {
      "types": "./dist/storage/index.d.ts",
      "import": "./dist/storage/index.mjs",
      "require": "./dist/storage/index.cjs"
    }
  },
  "files": ["dist", "LICENSE", "README.md"]
}
```

### Pattern 2: Zod Schema with Type Inference

**What:** Define validation schema, TypeScript types inferred automatically
**When to use:** All configuration validation
**Example:**

```typescript
// Source: https://zod.dev/
import { z } from 'zod';

// Define schema
const configSchema = z
  .object({
    version: z.literal('1.0').default('1.0'),
    providers: z.record(
      z.string(),
      z.object({
        keys: z.array(z.string()).min(1),
        budget: z.number().nonnegative().default(0),
      }),
    ),
    strategy: z.enum(['round-robin', 'least-used']).default('round-robin'),
  })
  .strict();

// TypeScript type inferred automatically
export type RouterConfig = z.infer<typeof configSchema>;

// Validation with safe defaults
export function validateConfig(input: unknown): RouterConfig {
  return configSchema.parse(input);
}

// Export schema for consumer use
export { configSchema };
```

### Pattern 3: defineConfig Helper (Zero Runtime)

**What:** Type-safe config helper that compiles away to nothing
**When to use:** Public API for user-facing config files
**Example:**

```typescript
// Source: https://vite.dev/config/ pattern
// src/config/define-config.ts
import type { RouterConfig } from './schema';

/**
 * Helper for defining type-safe configuration.
 * This is a pass-through function that provides IDE autocomplete.
 */
export function defineConfig(config: RouterConfig): RouterConfig {
  return config;
}
```

User's config file:

```typescript
// user-project/router.config.ts
import { defineConfig } from 'pennyllm';

export default defineConfig({
  providers: {
    google: { keys: [process.env.GOOGLE_KEY!] },
  },
  strategy: 'round-robin', // Autocomplete works!
});
```

### Pattern 4: TypeScript Strict Mode Configuration

**What:** Comprehensive strict settings for library development
**When to use:** All TypeScript libraries
**Example:**

```typescript
// tsconfig.json
// Source: https://www.typescriptlang.org/tsconfig
{
  "compilerOptions": {
    // Strict type checking
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,

    // Module resolution for Node.js 18+
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "node",

    // Declaration files
    "declaration": true,
    "declarationMap": true,

    // Output
    "outDir": "./dist",
    "rootDir": "./src",

    // Interop
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

### Pattern 5: Type-Safe EventEmitter

**What:** Node.js EventEmitter with TypeScript event map
**When to use:** Router event system
**Example:**

```typescript
// Source: https://github.com/DefinitelyTyped/DefinitelyTyped/discussions/55298
import { EventEmitter } from 'events';

// Define event map
interface RouterEvents {
  'key:selected': [{ provider: string; keyIndex: number; timestamp: number }];
  'usage:recorded': [{ provider: string; tokens: number; timestamp: number }];
  'limit:warning': [{ provider: string; threshold: number; timestamp: number }];
}

// Type-safe emitter
export class RouterEventEmitter extends EventEmitter {
  on<K extends keyof RouterEvents>(event: K, listener: (...args: RouterEvents[K]) => void): this {
    return super.on(event, listener);
  }

  emit<K extends keyof RouterEvents>(event: K, ...args: RouterEvents[K]): boolean {
    return super.emit(event, ...args);
  }
}
```

### Pattern 6: JSON-Serializable Error Classes

**What:** Error classes with toJSON() method for logging and Admin UI
**When to use:** All custom error classes
**Example:**

```typescript
// src/errors/base.ts
export class PennyLLMError extends Error {
  public readonly code: string;
  public readonly suggestion?: string;
  public readonly metadata?: Record<string, unknown>;

  constructor(
    message: string,
    options?: {
      code?: string;
      suggestion?: string;
      metadata?: Record<string, unknown>;
      cause?: Error;
    },
  ) {
    super(message, { cause: options?.cause });
    this.name = this.constructor.name;
    this.code = options?.code ?? 'UNKNOWN_ERROR';
    this.suggestion = options?.suggestion;
    this.metadata = options?.metadata;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      suggestion: this.suggestion,
      metadata: this.metadata,
      stack: this.stack,
    };
  }
}

// src/errors/config-error.ts
export class ConfigError extends PennyLLMError {
  constructor(message: string, options?: { field?: string; cause?: Error }) {
    super(message, {
      code: 'CONFIG_ERROR',
      suggestion: 'Check your configuration against the schema',
      metadata: { field: options?.field },
      cause: options?.cause,
    });
  }
}
```

### Pattern 7: debug Package Namespacing

**What:** Component-based debug namespaces for selective logging
**When to use:** All logging in library code
**Example:**

```typescript
// Source: https://github.com/debug-js/debug
// src/config/loader.ts
import Debug from 'debug';

const debug = Debug('pennyllm:config');

export function loadConfig(path: string) {
  debug('Loading config from %s', path);
  // ... load logic
  debug('Config loaded with %d providers', config.providers.length);
  return config;
}

// Usage by consumers:
// DEBUG=pennyllm:* npm start          (all namespaces)
// DEBUG=pennyllm:config npm start     (only config)
// DEBUG=pennyllm:config,pennyllm:selection npm start  (multiple)
```

### Pattern 8: Const Objects for Enums (Not TypeScript Enums)

**What:** Const objects with `as const` assertion instead of TypeScript enums
**When to use:** All enumeration values in config
**Example:**

```typescript
// src/constants/index.ts
export const Strategy = {
  ROUND_ROBIN: 'round-robin',
  LEAST_USED: 'least-used',
} as const;

export type StrategyType = (typeof Strategy)[keyof typeof Strategy];

export const Provider = {
  GOOGLE: 'google',
  GROQ: 'groq',
  OPENROUTER: 'openrouter',
} as const;

export type ProviderType = (typeof Provider)[keyof typeof Provider];

// Usage:
import { Strategy } from 'pennyllm';
const config = { strategy: Strategy.ROUND_ROBIN }; // ✅ JSON-serializable
```

Why not TypeScript enums:

- Not JSON-serializable by default
- Reverse mapping adds runtime overhead
- Harder to work with in Admin UI (v2 requirement)

### Pattern 9: YAML with Environment Variable Interpolation

**What:** Parse YAML and replace `${VAR}` with environment values
**When to use:** Config file loading
**Example:**

```typescript
// src/config/loader.ts
import yaml from 'js-yaml';
import fs from 'fs';

function interpolateEnvVars(str: string): string {
  return str.replace(/\$\{(\w+)\}/g, (_, varName) => {
    const value = process.env[varName];
    if (value === undefined) {
      throw new Error(`Environment variable ${varName} is not defined`);
    }
    return value;
  });
}

export function loadYamlConfig(path: string): unknown {
  const raw = fs.readFileSync(path, 'utf-8');
  const interpolated = interpolateEnvVars(raw);
  return yaml.load(interpolated);
}
```

User's YAML config:

```yaml
# router.config.yaml
version: '1.0'
providers:
  google:
    keys:
      - ${GOOGLE_KEY_1}
      - ${GOOGLE_KEY_2}
strategy: round-robin
```

### Pattern 10: Husky + lint-staged + commitlint Setup

**What:** Automated pre-commit linting and commit message validation
**When to use:** All projects with multiple contributors
**Example:**

```bash
# Installation
npm install --save-dev husky lint-staged @commitlint/cli @commitlint/config-conventional
npx husky init
```

```javascript
// .lintstagedrc
{
  "*.{js,ts,tsx}": ["eslint --fix", "prettier --write"],
  "*.{json,md,yml}": ["prettier --write"]
}
```

```javascript
// commitlint.config.js
module.exports = {
  extends: ['@commitlint/config-conventional'],
};
```

```bash
# .husky/pre-commit
npx lint-staged

# .husky/commit-msg
npx --no -- commitlint --edit $1
```

### Anti-Patterns to Avoid

- **Using TypeScript enums for config values:** Not JSON-serializable, breaks Admin UI (v2) requirement. Use const objects instead.
- **Mixing dependencies and devDependencies incorrectly:** TypeScript declarations must be in `dependencies` if they're exposed to consumers. Source: [TypeScript Publishing Docs](https://www.typescriptlang.org/docs/handbook/declaration-files/publishing.html)
- **Using `/// <reference path="..." />`:** Use ES6 imports instead. Triple-slash references are legacy syntax.
- **Not listing `!*.d.ts` in .npmignore:** This prevents generated type declarations from being published.
- **Using yarn link for local testing:** Causes TypeScript type deduplication issues. Use `npm link` or `npm pack` instead.
- **Forgetting `skipLibCheck: true`:** Without this, consumer's TypeScript will type-check all dependencies, causing slowdowns.

## Don't Hand-Roll

| Problem                  | Don't Build                     | Use Instead          | Why                                                                      |
| ------------------------ | ------------------------------- | -------------------- | ------------------------------------------------------------------------ |
| Dual ESM+CJS bundling    | Custom tsc + rollup scripts     | tsup                 | Zero-config, handles .d.ts generation, outExtension logic, tree-shaking  |
| Configuration validation | Manual type guards and checks   | Zod                  | Type inference, runtime validation, schema versioning, 2KB gzipped       |
| Git hooks                | Manual .git/hooks scripts       | husky                | Cross-platform, version controlled, team-wide consistency                |
| YAML parsing             | Custom parser                   | js-yaml              | Battle-tested, handles edge cases, standard format support               |
| Event system             | Custom observer pattern         | Node.js EventEmitter | Standard API, well-understood, wildcard support can be added via library |
| Logging                  | console.log with prefixes       | debug package        | Zero runtime cost when disabled, namespace filtering, production-safe    |
| Version management       | Manual version bumps            | Changesets           | Automates semantic versioning, CHANGELOG generation, monorepo-ready      |
| Commit linting           | Git commit-msg hooks with regex | commitlint           | Standard conventional commit rules, extensible, well-documented          |

**Key insight:** Modern TypeScript package development has converged on these tools. Fighting the ecosystem creates maintenance burden and poor contributor experience. The "zero-config" movement (tsup, Vitest) eliminates configuration drift between projects.

## Common Pitfalls

### Pitfall 1: Incorrect package.json exports for Dual ESM+CJS

**What goes wrong:** TypeScript can't find types, or ESM/CJS resolution fails in consumer projects
**Why it happens:** The `exports` field has strict ordering requirements — `types` must come first, and conditional exports must be nested correctly
**How to avoid:**

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts", // ✅ MUST be first
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs"
    }
  }
}
```

**Warning signs:** Consumer gets "Cannot find module" errors, or TypeScript complains about missing types despite .d.ts files existing

### Pitfall 2: Peer Dependencies Not Installed (npm 7+ auto-install assumption)

**What goes wrong:** Package works in dev but fails for consumers who don't have peer dependencies
**Why it happens:** npm 7+ auto-installs peer dependencies, but consumers might use older npm, yarn, or pnpm with different behavior
**How to avoid:**

- Mark AI SDK as peer dependency (standard for SDK wrappers)
- Mark js-yaml as optional peer dependency using `peerDependenciesMeta`:

```json
{
  "peerDependencies": {
    "ai": "^4.0.0",
    "js-yaml": "^4.0.0"
  },
  "peerDependenciesMeta": {
    "js-yaml": {
      "optional": true
    }
  }
}
```

- Add peer dependencies to devDependencies for local testing
  **Warning signs:** Consumer reports "Cannot find module 'ai'" errors

### Pitfall 3: TypeScript Strict Mode Violations in Published Types

**What goes wrong:** Consumers with strict mode enabled get type errors from your published .d.ts files
**Why it happens:** Library built without strict mode, types are too loose
**How to avoid:** Enable all strict checks in tsconfig.json from day one:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

**Warning signs:** Issues opened by users about type errors that don't reproduce in your environment

### Pitfall 4: Zod Schema Doesn't Match Default Values

**What goes wrong:** Runtime errors when using defaults, or TypeScript types don't reflect actual runtime behavior
**Why it happens:** Adding `.default()` to optional fields requires understanding the difference between `z.infer` (output type) and `z.input` (input type)
**How to avoid:**

```typescript
// ❌ Wrong - type requires field even though default exists
const schema = z.object({
  strategy: z.string().optional().default('round-robin'),
});

// ✅ Correct - field is optional in input, guaranteed in output
const schema = z.object({
  strategy: z.string().default('round-robin'), // No .optional() before .default()
});

type Config = z.infer<typeof schema>; // { strategy: string }
type ConfigInput = z.input<typeof schema>; // { strategy?: string }
```

**Warning signs:** TypeScript requires fields in input that have defaults

### Pitfall 5: Node.js Version Targeting Mismatch

**What goes wrong:** Package uses features not available in Node.js 18 (minimum version), or conservative targeting limits performance
**Why it happens:** In 2026, Node.js 18 is EOL (ended April 2025), but projects still target it for compatibility. Node.js 22 has native TypeScript support.
**How to avoid:**

- Set `engines.node: ">=18"` in package.json (even though 18 is EOL, it's a common baseline)
- Use ES2022 target (supported by Node.js 18+)
- Document that Node.js 20+ is recommended (20 LTS until April 2026, then 22 LTS)

```json
{
  "engines": {
    "node": ">=18.0.0"
  }
}
```

**Warning signs:** Consumer reports "SyntaxError: Unexpected token" or feature unavailable errors

### Pitfall 6: Forgetting to Export Types for Consumer Use

**What goes wrong:** Consumers can't properly type their code when using your library
**Why it happens:** Only exporting runtime values, forgetting to export types from Zod schemas and interfaces
**How to avoid:**

```typescript
// src/index.ts
export { createRouter } from './config';
export { Strategy, Provider } from './constants';

// ✅ Export all types
export type { RouterConfig, ProviderConfig } from './types/config';
export type { ModelMetadata, Policy, UsageRecord, TimeWindow } from './types/domain';
export type { StorageBackend, ModelCatalog, SelectionStrategy } from './types/interfaces';
export type { RouterEventMap } from './types/events';

// ✅ Export Zod schema for consumer validation
export { configSchema } from './config/schema';
```

**Warning signs:** GitHub issues asking "how do I type my config?" or "can you export type X?"

### Pitfall 7: Not Committing package-lock.json

**What goes wrong:** CI/CD gets different dependency versions, "works on my machine" problems
**Why it happens:** Old advice said "libraries shouldn't commit lockfiles" but this is outdated
**How to avoid:** Always commit package-lock.json (per 2026 best practices). It ensures deterministic installs across all environments
**Warning signs:** CI failures that don't reproduce locally, peer dependency resolution differs between machines

### Pitfall 8: debug Package Overhead in Production

**What goes wrong:** Concern that debug logging adds runtime cost even when disabled
**Why it happens:** Misunderstanding of how debug package works
**How to avoid:** Understand that disabled debug instances return no-op functions with near-zero overhead. For expensive operations, check `.enabled`:

```typescript
const debug = Debug('pennyllm:selection');

// ❌ Expensive computation always runs
debug('Selected key', expensiveComputation());

// ✅ Computation skipped when debug disabled
if (debug.enabled) {
  debug('Selected key', expensiveComputation());
}
```

**Warning signs:** Performance profiling shows debug calls in hot paths

## Code Examples

Verified patterns from official sources:

### TypeScript Configuration for Library Development

```typescript
// tsconfig.json
// Source: https://www.typescriptlang.org/tsconfig
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "node",

    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,

    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,

    "outDir": "./dist",
    "rootDir": "./src",

    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

### Vitest Configuration for TypeScript Library

```typescript
// vitest.config.ts
// Source: https://vitest.dev/config/
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
      reporter: ['text', 'json', 'html'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
```

### Changesets Workflow

```bash
# Source: https://github.com/changesets/changesets

# 1. Developer creates changeset after making changes
npx changeset add
# CLI prompts: which packages changed? major/minor/patch? summary?

# 2. CI/Maintainer runs version command (updates package.json + CHANGELOG.md)
npx changeset version

# 3. Commit version changes
git add .
git commit -m "chore: version packages"

# 4. Publish to npm
npx changeset publish

# 5. Push tags
git push --follow-tags
```

### GitHub Actions CI Workflow

```yaml
# .github/workflows/ci.yml
# Source: https://github.com/actions/typescript-action pattern
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18.x, 20.x, 22.x]

    steps:
      - uses: actions/checkout@v4

      - name: Use Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Type check
        run: npm run typecheck

      - name: Test
        run: npm run test

      - name: Build
        run: npm run build
```

## State of the Art

| Old Approach                 | Current Approach               | When Changed | Impact                                                                                   |
| ---------------------------- | ------------------------------ | ------------ | ---------------------------------------------------------------------------------------- |
| TypeScript enums             | Const objects with `as const`  | 2020+        | Better JSON serialization, no reverse mapping overhead, more flexible                    |
| Manual rollup + tsc          | tsup (zero-config)             | 2021+        | Eliminates 100+ lines of build config, automatic dual ESM+CJS                            |
| Jest for TypeScript          | Vitest                         | 2022+        | Native TypeScript support, 10x faster, reuses Vite config                                |
| Node.js 14-16 target         | Node.js 18+ minimum            | 2023+        | Top-level await, native fetch, ES2022 features available                                 |
| Joi/Yup validation           | Zod                            | 2021+        | TypeScript type inference, smaller bundle, better DX                                     |
| npm 6 (no peer auto-install) | npm 7+ auto-installs peers     | 2020         | Peer dependencies "just work" for most users, but need peerDependenciesMeta for optional |
| Node.js 18 LTS               | Node.js 18 EOL, 20 LTS current | April 2025   | Node.js 18 unsupported but still common baseline, recommend 20+                          |
| TSDX (archived)              | tsup                           | 2022         | TSDX no longer maintained, tsup is spiritual successor                                   |

**Deprecated/outdated:**

- **TSDX**: Zero-config CLI archived, use tsup instead
- **TypeScript namespaces**: Use ES6 modules exclusively
- **Triple-slash references (`/// <reference path="..." />`)**: Use ES6 imports
- **DefinitelyTyped `@types/*` packages for own package**: Ship types in package, don't publish to DefinitelyTyped separately
- **Separate CJS and ESM builds with different entry points**: Use conditional exports with single build command

## Open Questions

1. **Better-sqlite3 vs Node.js built-in SQLite**
   - What we know: better-sqlite3 is fastest, synchronous, most control. Node.js 22+ has built-in sqlite module.
   - What's unclear: Should we detect Node.js version and use built-in when available?
   - Recommendation: Start with better-sqlite3 (works Node 18+). Built-in sqlite is Node 22+ only, our minimum is 18. Revisit in Phase 2 when implementing SQLiteStorage.

2. **Environment variable interpolation security**
   - What we know: `${VAR}` pattern works for YAML/JSON config files
   - What's unclear: Should we validate that env vars exist before interpolation, or fail at parse time?
   - Recommendation: Fail fast with clear error message if env var is undefined. Security concern: don't log actual env var values in error messages.

3. **Abstract base class vs helper functions for plugin DX**
   - What we know: User wants "abstract base classes / helper functions provided so consumers don't start from scratch"
   - What's unclear: When to use abstract class vs standalone helper?
   - Recommendation: Use abstract classes when enforcing contracts (StorageBackend requires specific methods). Use helper functions for utilities (e.g., `redactApiKey()`). Decide per interface in Phases 2/5.

## Validation Architecture

### Test Framework

| Property           | Value                                             |
| ------------------ | ------------------------------------------------- |
| Framework          | Vitest 4.0.17+                                    |
| Config file        | vitest.config.ts                                  |
| Quick run command  | `npm test` (runs all tests, ~seconds for Phase 1) |
| Full suite command | `npm run test:coverage` (with coverage report)    |

### Phase Requirements → Test Map

| Req ID  | Behavior                                                   | Test Type | Automated Command                                       | File Exists? |
| ------- | ---------------------------------------------------------- | --------- | ------------------------------------------------------- | ------------ |
| CORE-01 | Config validation accepts valid TypeScript config object   | unit      | `vitest tests/config.test.ts -t "validates config" -x`  | ❌ Wave 0    |
| CORE-01 | Config loader parses JSON file                             | unit      | `vitest tests/config.test.ts -t "JSON loader" -x`       | ❌ Wave 0    |
| CORE-01 | Config loader parses YAML file with env interpolation      | unit      | `vitest tests/config.test.ts -t "YAML loader" -x`       | ❌ Wave 0    |
| CORE-01 | Config validation fails on invalid config with clear error | unit      | `vitest tests/config.test.ts -t "validation errors" -x` | ❌ Wave 0    |
| DX-07   | All public types are exported from main entry              | unit      | `vitest tests/exports.test.ts -t "type exports" -x`     | ❌ Wave 0    |
| DX-07   | TypeScript declaration files generated in dist/            | unit      | `vitest tests/build.test.ts -t "declaration files" -x`  | ❌ Wave 0    |

### Sampling Rate

- **Per task commit:** `npm test` (all tests, fast for Phase 1)
- **Per wave merge:** `npm test && npm run lint && npm run typecheck` (full validation)
- **Phase gate:** `npm run test:coverage` — minimum 80% coverage before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/config.test.ts` — covers CORE-01 (config validation, JSON/YAML loading, error handling)
- [ ] `tests/exports.test.ts` — covers DX-07 (verifies all public types exported)
- [ ] `tests/build.test.ts` — covers DX-07 (checks declaration files exist after build)
- [ ] `vitest.config.ts` — test framework configuration with coverage thresholds
- [ ] Framework install: `npm install --save-dev vitest @vitest/coverage-v8`

## Sources

### Primary (HIGH confidence)

- [Node.js Package Exports Documentation](https://nodejs.org/api/packages.html) - Subpath exports, conditional exports, best practices
- [Zod Official Documentation](https://zod.dev/) - Schema definition, type inference, validation (v4 stable, 2KB gzipped)
- [TypeScript TSConfig Reference](https://www.typescriptlang.org/tsconfig/) - Strict mode, declaration files, module resolution
- [TypeScript Publishing Documentation](https://www.typescriptlang.org/docs/handbook/declaration-files/publishing.html) - Common mistakes, dependency management
- [Vitest Official Documentation](https://vitest.dev/) - Configuration, coverage, TypeScript setup (v4.0.17)
- [Vitest Coverage Guide](https://vitest.dev/guide/coverage.html) - Coverage providers, TypeScript-specific configuration
- [GitHub debug-js/debug Repository](https://github.com/debug-js/debug) - Namespace patterns, environment variables, performance
- [GitHub changesets/changesets Repository](https://github.com/changesets/changesets) - Workflow, commands, versioning
- [Changesets Command Line Options](https://github.com/changesets/changesets/blob/main/docs/command-line-options.md) - CLI reference

### Secondary (MEDIUM confidence)

- [Dual Publishing ESM and CJS Modules with tsup](https://johnnyreilly.com/dual-publishing-esm-cjs-modules-with-tsup-and-are-the-types-wrong) - tsup configuration examples, outExtension pattern
- [How I Build an npm Package in 2026](https://medium.com/@pyyupsk/how-i-build-an-npm-package-in-2026-4bb1a4b88e11) - Modern 2026 best practices, minimal configuration
- [Improve Your Developer Lifecycle with Husky, lint-staged, and commitlint](https://dev.to/saiful7778/improve-your-developer-lifecycle-with-husky-lint-staged-and-commitlint-3mj7) - Setup steps, configuration examples
- [commitlint Local Setup Guide](https://commitlint.js.org/guides/local-setup.html) - Official commitlint setup
- [Husky Official Documentation](https://typicode.github.io/husky/) - v9 init command, hook setup
- [Node.js EventEmitter TypeScript Patterns](https://github.com/DefinitelyTyped/DefinitelyTyped/discussions/55298) - Type-safe EventEmitter with event maps
- [Understanding Better-SQLite3](https://dev.to/lovestaco/understanding-better-sqlite3-the-fastest-sqlite-library-for-nodejs-4n8) - Performance comparison, synchronous API benefits
- [better-sqlite3 vs sqlite3 Comparison](https://npm-compare.com/better-sqlite3,sqlite,sqlite3) - Feature and performance comparison
- [Should I use better-sqlite3 over Node 22 core sqlite module?](https://github.com/WiseLibs/better-sqlite3/discussions/1245) - Discussion of Node.js built-in vs better-sqlite3
- [Zod Configuration Schema Patterns](https://zod.dev/api) - Default values, optional fields, nested objects
- [How to Install and Manage Peer Dependencies in npm](https://copyprogramming.com/howto/how-to-remove-optional-peer-dependency-from-npm-project) - peerDependenciesMeta, optional peer deps
- [Node.js Peer Dependencies Blog](https://nodejs.org/en/blog/npm/peer-dependencies) - Peer dependency concepts
- [Node.js 18 EOL Support Announcement](https://nodejs.org/en/blog/announcements/node-18-eol-support) - Node.js 18 EOL April 2025
- [When to Use TypeScript Abstract Classes](https://khalilstemmler.com/blogs/typescript/abstract-class/) - Plugin architecture patterns
- [GitHub js-yaml Repository](https://github.com/nodeca/js-yaml) - YAML parser documentation
- [Evolving flat config with extends - ESLint](https://eslint.org/blog/2025/03/flat-config-extends-define-config-global-ignores/) - defineConfig helper pattern explanation

### Tertiary (LOW confidence)

None - all critical claims verified with official documentation or multiple secondary sources.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - All tools have official documentation, active maintenance, and are industry standard in 2026
- Architecture: HIGH - Patterns verified from official docs (Node.js, TypeScript, Zod) and established community practices
- Pitfalls: MEDIUM - Based on official documentation warnings and 2026 blog posts, but some are experience-based wisdom

**Research date:** 2026-03-12
**Valid until:** 2026-06-12 (90 days - TypeScript tooling is mature and stable, but npm ecosystem evolves continuously)
