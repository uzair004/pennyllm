---
phase: 08-provider-policies-catalog
verified: 2026-03-14T05:20:00Z
status: passed
score: 8/8 must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: 'Verify provider doc sign-up URLs are reachable and lead to correct pages'
    expected: 'Each URL opens the correct sign-up or API key page for the provider'
    why_human: 'Requires opening browser and checking live URLs'
  - test: 'Verify config snippets compile when used in a real project'
    expected: 'Import paths (llm-router/policy, llm-router/types) resolve and typed configs work with IDE autocompletion'
    why_human: 'Requires IDE integration test with actual npm package resolution'
---

# Phase 8: Provider Policies Catalog Verification Report

**Phase Goal:** User-configured limits are the primary mechanism for all 12 providers, with builder helpers for easy configuration, typed provider configs with JSDoc, skeleton JSON for structural reference, and comprehensive key acquisition documentation
**Verified:** 2026-03-14T05:20:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                    | Status   | Evidence                                                                                                                                                                                                                                       |
| --- | -------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Static default policies removed (google.ts, groq.ts, openrouter.ts, index.ts deleted)                    | VERIFIED | `src/policy/defaults/` directory does not exist. grep for `defaults/google` in src/ returns 0 matches.                                                                                                                                         |
| 2   | Config has `applyRegistryDefaults` toggle (default: false) for future registry integration               | VERIFIED | `src/config/schema.ts` line 90: `applyRegistryDefaults: z.boolean().default(false)`. `src/types/config.ts` line 48: `applyRegistryDefaults: boolean` (non-optional).                                                                           |
| 3   | Builder helpers (createTokenLimit, createRateLimit, createCallLimit) produce correct PolicyLimit objects | VERIFIED | `src/policy/builders.ts` exports all 3 functions. Each returns `{ type, value, window: { type, durationMs } }` using `LimitType` constants and correct durations. No stubs.                                                                    |
| 4   | Each of the 12 providers has a typed config with JSDoc documentation                                     | VERIFIED | `src/types/providers.ts` has 12 type aliases (172 lines), each with JSDoc containing sign-up URL, env var, AI SDK package, tier info. All 12 exported via `src/types/index.ts` and `src/index.ts`.                                             |
| 5   | Empty provider skeleton JSON bundles all 12 providers with structural reference                          | VERIFIED | `data/provider-skeleton.json` has `schemaVersion: "1.0"`, 12 providers with empty `limits: []`, correct metadata (tierType, aiSdkPackage, envVar). `package.json` includes `"data"` in files array.                                            |
| 6   | Documentation includes step-by-step guide for obtaining free tier API key from each provider             | VERIFIED | 12 files in `docs/providers/` (google.md through github.md), each with "Getting Your API Key" section (grep confirms all 12 have it), config snippets using builder helpers (48 total occurrences across 13 files), and "Last verified" dates. |
| 7   | Comparison table shows all 12 providers side-by-side                                                     | VERIFIED | `docs/providers/comparison.md` (77 lines) has "At a Glance" table with all 12 providers, Tier Categories section, Env Variables Reference table, and "Best For" recommendations table.                                                         |
| 8   | README recommends 2-3 easiest providers as starter set                                                   | VERIFIED | `docs/providers/README.md` (94 lines) has "Recommended Starter Set" section listing Google, Groq, OpenRouter. Includes quick start code example with 3-provider config using builder helpers.                                                  |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact                        | Expected                                           | Status   | Details                                                                                                                                                                            |
| ------------------------------- | -------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/policy/builders.ts`        | Limit builder helper functions                     | VERIFIED | 58 lines, exports createTokenLimit, createRateLimit, createCallLimit. Substantive implementations with correct LimitType usage. Re-exported from policy/index.ts and src/index.ts. |
| `src/types/providers.ts`        | Typed provider configs with JSDoc for 12 providers | VERIFIED | 172 lines (exceeds min_lines: 50). 12 type aliases, each with multi-line JSDoc. Exported from types/index.ts and src/index.ts.                                                     |
| `data/provider-skeleton.json`   | Empty skeleton with 12 provider shapes             | VERIFIED | 114 lines, contains `schemaVersion`. 12 providers with empty limits arrays, correct enforcement types, tierType, aiSdkPackage, envVar fields.                                      |
| `docs/providers/google.md`      | Google key acquisition and config reference        | VERIFIED | 74 lines (exceeds min_lines: 40). Has Quick Reference, Getting Your API Key, Free Tier Summary, Configuration, Gotchas & Tips.                                                     |
| `docs/providers/groq.md`        | Groq key acquisition and config reference          | VERIFIED | 75 lines (exceeds min_lines: 40).                                                                                                                                                  |
| `docs/providers/openrouter.md`  | OpenRouter meta-provider explainer and config      | VERIFIED | 106 lines (exceeds min_lines: 50). Has "How OpenRouter Works" section.                                                                                                             |
| `docs/providers/mistral.md`     | Mistral key acquisition and config reference       | VERIFIED | 74 lines (exceeds min_lines: 40).                                                                                                                                                  |
| `docs/providers/huggingface.md` | HuggingFace key acquisition and config reference   | VERIFIED | 78 lines (exceeds min_lines: 40).                                                                                                                                                  |
| `docs/providers/cerebras.md`    | Cerebras key acquisition and config reference      | VERIFIED | 72 lines (exceeds min_lines: 40).                                                                                                                                                  |
| `docs/providers/deepseek.md`    | DeepSeek key acquisition and config reference      | VERIFIED | 67 lines (exceeds min_lines: 40).                                                                                                                                                  |
| `docs/providers/qwen.md`        | Qwen/Alibaba key acquisition and config reference  | VERIFIED | 81 lines (exceeds min_lines: 40).                                                                                                                                                  |
| `docs/providers/cloudflare.md`  | Cloudflare key acquisition and config reference    | VERIFIED | 87 lines (exceeds min_lines: 40).                                                                                                                                                  |
| `docs/providers/nvidia.md`      | NVIDIA NIM key acquisition and config reference    | VERIFIED | 79 lines (exceeds min_lines: 40).                                                                                                                                                  |
| `docs/providers/cohere.md`      | Cohere key acquisition and config reference        | VERIFIED | 69 lines (exceeds min_lines: 40).                                                                                                                                                  |
| `docs/providers/github.md`      | GitHub Models key acquisition and config reference | VERIFIED | 93 lines (exceeds min_lines: 40).                                                                                                                                                  |
| `docs/providers/comparison.md`  | Side-by-side comparison of all 12 providers        | VERIFIED | 77 lines (exceeds min_lines: 30). All 12 providers in tables.                                                                                                                      |
| `docs/providers/README.md`      | Overview with starter set recommendation           | VERIFIED | 94 lines (exceeds min_lines: 30). Starter set, aggregate capacity estimate, quick start example.                                                                                   |

### Key Link Verification

| From                   | To                       | Via                                                              | Status | Details                                                                                                                                             |
| ---------------------- | ------------------------ | ---------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/config/index.ts`  | `src/policy/resolver.ts` | resolvePolicies called with empty Map instead of shippedDefaults | WIRED  | Line 98: `const emptyDefaults = new Map<string, Policy>()`. Line 99: `resolvePolicies(config, emptyDefaults)`. No import of shippedDefaults.        |
| `src/policy/index.ts`  | `src/policy/builders.ts` | re-exports builder functions                                     | WIRED  | Line 21: `export { createTokenLimit, createRateLimit, createCallLimit } from './builders.js'`                                                       |
| `src/config/schema.ts` | `src/types/config.ts`    | applyRegistryDefaults field in both schema and interface         | WIRED  | Schema line 90: `applyRegistryDefaults: z.boolean().default(false)`. Interface line 48: `applyRegistryDefaults: boolean`. Both present and aligned. |
| `src/index.ts`         | `src/policy/index.ts`    | top-level export of builder functions                            | WIRED  | Lines 21-23: `export { PolicyEngine, createTokenLimit, createRateLimit, createCallLimit } from './policy/index.js'`                                 |
| `src/types/index.ts`   | `src/types/providers.ts` | re-exports 12 provider config types                              | WIRED  | Lines 62-75: All 12 provider config types exported from `'./providers.js'`                                                                          |
| `src/index.ts`         | `src/types/index.ts`     | top-level export of provider config types                        | WIRED  | Lines 74, 93, 99, 105 etc: All 12 provider config types in the type export block                                                                    |

### Requirements Coverage

| Requirement | Source Plan(s) | Description                                              | Status    | Evidence                                                                                                                                          |
| ----------- | -------------- | -------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| PROV-01     | 08-01, 08-02   | Google AI Studio -- default policy with free tier limits | SATISFIED | Typed config `GoogleProviderConfig` with JSDoc, provider skeleton entry, `docs/providers/google.md` with key acquisition guide and config snippet |
| PROV-02     | 08-01, 08-02   | Groq -- default policy with free tier limits             | SATISFIED | Typed config `GroqProviderConfig`, skeleton entry, `docs/providers/groq.md`                                                                       |
| PROV-03     | 08-01, 08-02   | OpenRouter -- default policy with free tier limits       | SATISFIED | Typed config `OpenRouterProviderConfig`, skeleton entry, `docs/providers/openrouter.md` with meta-provider explainer                              |
| PROV-04     | 08-01, 08-02   | Mistral -- default policy with free tier limits          | SATISFIED | Typed config `MistralProviderConfig`, skeleton entry, `docs/providers/mistral.md`                                                                 |
| PROV-05     | 08-01, 08-02   | HuggingFace -- default policy with free tier limits      | SATISFIED | Typed config `HuggingFaceProviderConfig`, skeleton entry, `docs/providers/huggingface.md`                                                         |
| PROV-06     | 08-01, 08-02   | Cerebras -- default policy with free tier limits         | SATISFIED | Typed config `CerebrasProviderConfig`, skeleton entry, `docs/providers/cerebras.md`                                                               |
| PROV-07     | 08-01, 08-03   | DeepSeek -- default policy with free tier limits         | SATISFIED | Typed config `DeepSeekProviderConfig`, skeleton entry, `docs/providers/deepseek.md`                                                               |
| PROV-08     | 08-01, 08-03   | Qwen -- default policy with free tier limits             | SATISFIED | Typed config `QwenProviderConfig`, skeleton entry, `docs/providers/qwen.md` with Singapore region note                                            |
| PROV-09     | 08-01, 08-03   | Cloudflare -- default policy with free tier limits       | SATISFIED | Typed config `CloudflareProviderConfig`, skeleton entry, `docs/providers/cloudflare.md` with dual env var note                                    |
| PROV-10     | 08-01, 08-03   | NVIDIA NIM -- default policy with free tier limits       | SATISFIED | Typed config `NvidiaProviderConfig`, skeleton entry, `docs/providers/nvidia.md`                                                                   |
| PROV-11     | 08-01, 08-03   | Cohere -- default policy with free tier limits           | SATISFIED | Typed config `CohereProviderConfig`, skeleton entry, `docs/providers/cohere.md` with non-commercial warning                                       |
| PROV-12     | 08-01, 08-03   | GitHub Models -- default policy with free tier limits    | SATISFIED | Typed config `GitHubProviderConfig`, skeleton entry, `docs/providers/github.md`                                                                   |
| DX-02       | 08-02, 08-03   | Step-by-step guide for obtaining free tier keys          | SATISFIED | 12 individual docs + comparison.md + README.md. All docs have "Getting Your API Key" steps, config snippets, and "Last verified" dates            |

No orphaned requirements found. All 13 requirement IDs (PROV-01 through PROV-12, DX-02) are claimed by plans and satisfied.

### Anti-Patterns Found

| File                  | Line | Pattern         | Severity | Impact                                                                      |
| --------------------- | ---- | --------------- | -------- | --------------------------------------------------------------------------- |
| `src/config/index.ts` | 292  | `health()` stub | Info     | Pre-existing health stub (returns `{ status: 'ok' }`). Not Phase 8 related. |

No blocker or warning-level anti-patterns found in Phase 8 artifacts. All builder functions have substantive implementations. No TODO/FIXME/PLACEHOLDER markers in any Phase 8 files.

**Note:** `npx tsc --noEmit` reports 1 error in `src/storage/MemoryStorage.test.ts` regarding a `rootDir` issue with `tests/contracts/storage.contract.ts`. This is a pre-existing issue (confirmed present before Phase 8 changes) and does not affect Phase 8 deliverables.

### Human Verification Required

### 1. Provider Sign-Up URLs Are Reachable

**Test:** Open each provider's sign-up URL and API key page URL from the docs
**Expected:** URLs load correctly and point to the right pages
**Why human:** Requires browser interaction with live external services

### 2. Config Snippets Work in Real Project

**Test:** Create a minimal TypeScript project, install llm-router, and use the config snippets from provider docs
**Expected:** Import paths resolve, typed configs provide IDE autocompletion, builder helpers produce valid PolicyLimit objects
**Why human:** Requires actual npm package resolution and IDE integration testing

### Gaps Summary

No gaps found. All 8 success criteria from ROADMAP.md are verified:

1. Static defaults removed -- directory gone, no import references remain in src/
2. applyRegistryDefaults toggle present in both schema (Zod) and interface (TypeScript)
3. Builder helpers are substantive, well-typed, and properly exported at all levels
4. All 12 providers have typed configs with comprehensive JSDoc
5. Provider skeleton JSON has all 12 providers with correct metadata
6. All 12 provider docs have step-by-step key acquisition guides
7. Comparison table covers all 12 providers with tier categories and env vars
8. README recommends Google, Groq, OpenRouter as starter set

Test suite: 83 passed, 0 failed. Build pipeline clean (pre-existing tsc rootDir issue unrelated).

---

_Verified: 2026-03-14T05:20:00Z_
_Verifier: Claude (gsd-verifier)_
