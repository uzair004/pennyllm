---
phase: 06-base-router-integration
plan: 01
subsystem: wrapper
tags: [vercel-ai-sdk, middleware, provider-registry, integration]
dependency_graph:
  requires: [phase-05-model-catalog-and-selection]
  provides: [router-model-wrapper, usage-tracking-middleware, provider-registry]
  affects: [router-interface, main-exports]
tech_stack:
  added: ['@ai-sdk/google (peer dep)', 'wrapLanguageModel', 'LanguageModelV1Middleware']
  patterns: [fire-and-forget-recording, transform-stream-interception, dynamic-provider-loading]
key_files:
  created:
    [
      src/wrapper/provider-registry.ts,
      src/wrapper/middleware.ts,
      src/wrapper/router-model.ts,
      src/wrapper/index.ts,
    ]
  modified: [src/config/index.ts, src/index.ts, package.json, tsup.config.ts]
decisions:
  - Cast V3 models to any for wrapLanguageModel (runtime accepts both V1/V3 but types show V1 only)
  - Use TransformStream for stream usage tracking (standard Web Streams API, passes all chunks unmodified)
  - Fire-and-forget pattern for usage recording (never throws to user, logs errors via debug)
  - Dynamic provider loading with try-catch (optional peer dependencies, graceful degradation)
  - Self-reference pattern in Router.wrapModel for calling router.model()
metrics:
  duration: 506s
  tasks_completed: 3
  commits: 3
  files_created: 4
  files_modified: 4
  completed_date: 2026-03-13
---

# Phase 06 Plan 01: Base Router Integration Summary

**One-liner:** Vercel AI SDK integration with provider registry, usage tracking middleware, and router.wrapModel() method

## What Was Built

Built the core Vercel AI SDK integration layer that enables users to call `generateText()` and `streamText()` with router-wrapped models. The wrapper automatically injects selected API keys per-request and tracks usage transparently.

### Component 1: Provider Registry (src/wrapper/provider-registry.ts)

**Purpose:** Map provider names to AI SDK factory functions with dynamic loading

**Implementation:**

- `ProviderRegistry` class with Map-based factory storage
- `register()`, `get()`, `has()` methods for factory management
- `createDefault()` static method with dynamic `@ai-sdk/google` import
- `createProviderInstance()` helper for model instantiation
- Support for both V1 and V3 LanguageModel types (wrapLanguageModel handles conversion)

**Key decision:** Dynamic imports with try-catch allow optional peer dependencies. If `@ai-sdk/google` isn't installed, the registry logs debug and continues without it.

### Component 2: Usage Tracking Middleware (src/wrapper/middleware.ts)

**Purpose:** LanguageModelV1Middleware factory for fire-and-forget usage recording

**Implementation:**

- `createRouterMiddleware()` factory returning middleware with closure over router context
- `wrapGenerate`: extracts `result.usage` after `doGenerate()`, fires record() asynchronously
- `wrapStream`: creates TransformStream that intercepts 'finish' chunk, extracts usage, fires record()
- All errors caught and logged via debug, never thrown to user

**Key decision:** TransformStream intercepts the finish chunk (which has `type: 'finish'` with `usage: { promptTokens, completionTokens }`) but passes ALL chunks through unmodified. This ensures streaming behavior is identical to unwrapped models.

### Component 3: Router Model Wrapper (src/wrapper/router-model.ts)

**Purpose:** User-facing integration function combining selection, provider creation, and middleware

**Implementation:**

- `routerModel()` async function takes router + modelId, returns wrapped LanguageModelV1
- Calls `router.model()` for key selection
- Parses provider/model from modelId format ('google/gemini-2.0-flash')
- Creates provider instance with selected key
- Wraps with middleware and returns
- `createModelWrapper()` curried convenience that reuses registry across calls

**Key decision:** Cast V3 models to `any` when passing to `wrapLanguageModel()`. The runtime accepts both V1 and V3 (converts V3 to V1 internally), but the TypeScript signature only shows V1. This is a known AI SDK limitation.

### Component 4: Router Interface Integration (src/config/index.ts)

**Purpose:** Add wrapModel() method to Router interface

**Implementation:**

- Added `wrapModel()` to Router interface signature
- Initialized shared `ProviderRegistry` at createRouter startup
- Implemented `wrapModel()` using self-reference pattern (calls `routerImpl.model()` internally)
- Returns wrapped model with key injection and usage tracking

**Key decision:** Self-reference pattern (Router object references itself in wrapModel closure) allows reusing existing `router.model()` logic without duplication.

## Deviations from Plan

None - plan executed exactly as written.

## Commits

1. `ffb1733` - feat(06-01): create provider registry and install @ai-sdk/google
2. `9048566` - feat(06-01): create middleware factory with streaming usage tracking
3. `537b7de` - feat(06-01): create routerModel wrapper and wire into Router interface

## Verification

**TypeScript compilation:** `npx tsc --noEmit` passes with no errors
**Build:** `npm run build` succeeds, dist/ includes wrapper module
**Package exports:** `./wrapper` subpath export added to package.json
**Main exports:** ProviderRegistry, createRouterMiddleware, routerModel, createModelWrapper exported from main index

## Integration Points

**Upstream dependencies:**

- Router.model() for key selection (Phase 5)
- UsageTracker.record() for usage tracking (Phase 4)
- AI SDK wrapLanguageModel() for model wrapping

**Downstream consumers:**

- Users calling `await router.wrapModel('google/gemini-2.0-flash')` (Phase 6 plans 02+)
- Users calling `generateText()` with wrapped model (Phase 6 plans 02+)

## Testing Notes

No tests added per project instructions (build-first strategy). Verification via:

- TypeScript compilation (type safety)
- Build output (dist/ structure)
- Manual smoke test (dynamic import succeeds)

## Self-Check: PASSED

**Created files exist:**

- FOUND: src/wrapper/provider-registry.ts
- FOUND: src/wrapper/middleware.ts
- FOUND: src/wrapper/router-model.ts
- FOUND: src/wrapper/index.ts

**Commits exist:**

- FOUND: ffb1733
- FOUND: 9048566
- FOUND: 537b7de

**Modified files updated:**

- FOUND: src/config/index.ts (Router.wrapModel added)
- FOUND: src/index.ts (wrapper exports added)
- FOUND: package.json (@ai-sdk/google peer dep, ./wrapper export)
- FOUND: tsup.config.ts (wrapper entry point)
