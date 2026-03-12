# Contributing to LLM Router

Thank you for your interest in contributing to LLM Router!

## Prerequisites

- Node.js 18.0.0 or higher
- npm (comes with Node.js)

## Getting Started

1. Clone the repository:

   ```bash
   git clone https://github.com/muhammaduzair/llm-router.git
   cd llm-router
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Build the project:
   ```bash
   npm run build
   ```

## Development Workflow

### Available Commands

- `npm run build` - Build the package (ESM + CJS)
- `npm run dev` - Build in watch mode
- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report
- `npm run lint` - Lint source code
- `npm run format` - Format code with Prettier
- `npm run typecheck` - Type-check TypeScript without emitting

### Making Changes

1. Create a new branch for your feature or fix:

   ```bash
   git checkout -b feature/my-feature
   ```

2. Make your changes and ensure:
   - Tests pass: `npm test`
   - Types are valid: `npm run typecheck`
   - Code is linted: `npm run lint`
   - Code is formatted: `npm run format`

3. Commit your changes using conventional commits:
   ```bash
   git commit -m "feat: add new feature"
   ```

## Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/) enforced by commitlint:

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `test:` - Test changes
- `refactor:` - Code refactoring
- `chore:` - Tooling and configuration changes

Commits are validated automatically via git hooks.

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
