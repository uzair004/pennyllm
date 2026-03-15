# Contributing to PennyLLM

Thank you for your interest in contributing to PennyLLM!

## Prerequisites

- Node.js 18.0.0 or higher
- npm (comes with Node.js)

## Getting Started

1. Clone the repository:

   ```bash
   git clone https://github.com/muhammaduzair/pennyllm.git
   cd pennyllm
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Build the project:
   ```bash
   npm run build
   ```

## Project Structure

```
src/
  config/       Config schema (Zod), validation, defineConfig, file loader
  storage/      StorageBackend interface, MemoryStorage adapter
  sqlite/       SqliteStorage adapter (optional peer dep: better-sqlite3)
  redis/        RedisStorage adapter (optional peer dep: ioredis)
  policy/       Policy types, resolver, PolicyEngine (limit evaluation + events)
  usage/        UsageTracker, token estimation, cooldown management
  catalog/      ModelCatalog interface, DefaultModelCatalog, static snapshot
  selection/    KeySelector, built-in strategies (priority, round-robin, least-used)
  wrapper/      Vercel AI SDK middleware, wrapModel, routerModel
  fallback/     FallbackResolver, FallbackProxy, fallback chain logic
  budget/       BudgetTracker, cost estimation, spending limits
  debug/        DebugLogger (structured debug output via typed hooks)
  errors/       Error hierarchy (PennyLLMError base + 7 specific classes)
  constants/    Strategy, Provider, RouterEvent, LimitType enums
  types/        TypeScript interfaces (config, domain, events)
  index.ts      Main entry point, createRouter, public API exports
```

The package ships 11 subpath exports: `.`, `./storage`, `./catalog`, `./selection`, `./policy`, `./types`, `./errors`, `./constants`, `./wrapper`, `./sqlite`, `./redis`.

## Development Workflow

### Available Commands

- `npm run build` -- Build the package with tsup (ESM + CJS)
- `npm run dev` -- Build in watch mode
- `npm test` -- Run tests with Vitest
- `npm run test:watch` -- Run tests in watch mode
- `npm run test:coverage` -- Run tests with coverage report
- `npm run lint` -- Lint source code with ESLint
- `npm run format` -- Format code with Prettier
- `npm run typecheck` -- Type-check TypeScript without emitting
- `npm run catalog:update` -- Regenerate static model catalog snapshot

### Making Changes

1. Create a new branch for your feature or fix:

   ```bash
   git checkout -b feature/my-feature
   ```

2. Make your changes and ensure:
   - Types are valid: `npm run typecheck`
   - Code is linted: `npm run lint`
   - Code is formatted: `npm run format`
   - Tests pass: `npm test`

3. Commit your changes using conventional commits:
   ```bash
   git commit -m "feat: add new feature"
   ```

## Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/) enforced by commitlint:

- `feat:` -- New features
- `fix:` -- Bug fixes
- `docs:` -- Documentation changes
- `test:` -- Test changes
- `refactor:` -- Code refactoring
- `chore:` -- Tooling and configuration changes

Commits are validated automatically via git hooks (Husky + lint-staged).

## Changesets Workflow

When making changes that should be released:

1. Create a changeset:

   ```bash
   npm run changeset
   ```

2. Follow the prompts to describe your changes
3. Commit the generated changeset file with your changes

## Pull Requests

1. Push your branch to GitHub
2. Open a Pull Request against the `main` branch
3. Ensure CI passes
4. Wait for review

## Questions?

Open an issue for questions or discussions!
