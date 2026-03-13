# Project Instructions

## Core Principles

- **No assumptions, no guessing** — Use pure logic, verified context, and research. If something is unclear, look it up or ask. Never assume API shapes, model names, default behaviors, or library internals.
- **Verify before using** — Check that model names, API endpoints, library versions, and type signatures are current before writing code that depends on them. Stale data causes runtime failures.
- **Prefer Opus 4.6** — Use the highest-quality model for all code generation and reasoning tasks. Accuracy matters more than speed for this project.

## Commits

- **No co-author lines** — Do not add `Co-Authored-By` or any AI/Claude attribution to commit messages
- Keep commit messages clean and conventional (type(scope): description)

## Code

- No AI attribution in code comments, file headers, or descriptions

## Testing Strategy

- **Build first, test later** — Focus on building functionality. Tests can be added as a separate phase.
- Keep tests minimal during implementation phases — only add tests when a plan explicitly requires them or when they catch real bugs (config validation, boundary cases).
- Skip exhaustive test suites, deep edge-case coverage, and mock-heavy provider tests during build phases.
- Do NOT create test files unless the plan specifically calls for them.
- A quick smoke test or compile check (`tsc --noEmit`, `npm run build`) is sufficient verification for most tasks.
