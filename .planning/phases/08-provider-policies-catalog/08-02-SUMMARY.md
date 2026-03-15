---
phase: 08-provider-policies-catalog
plan: 02
subsystem: documentation
tags:
  [
    provider-docs,
    key-acquisition,
    free-tier,
    google,
    groq,
    openrouter,
    mistral,
    huggingface,
    cerebras,
  ]

# Dependency graph
requires:
  - phase: 08-provider-policies-catalog
    plan: 01
    provides: createTokenLimit, createRateLimit, createCallLimit builder helpers, typed provider configs
provides:
  - docs/providers/google.md with per-model limits, key acquisition, config snippet
  - docs/providers/groq.md with per-model limits, TPM warnings, ultra-fast inference note
  - docs/providers/openrouter.md with meta-provider explainer, top 5 free models, credit system
  - docs/providers/mistral.md with Experiment plan details, phone verification, RPM limitation
  - docs/providers/huggingface.md with credit-based billing, compute-time explainer
  - docs/providers/cerebras.md with per-model limits, 8K context window, token bucket algorithm
affects: [08-03, 09-fallback-chains, 11-cli-tooling, registry-phase]

# Tech tracking
tech-stack:
  added: []
  patterns: [provider-doc-template, placeholder-config-snippets]

key-files:
  created:
    - docs/providers/google.md
    - docs/providers/groq.md
    - docs/providers/openrouter.md
    - docs/providers/mistral.md
    - docs/providers/huggingface.md
    - docs/providers/cerebras.md
  modified: []

key-decisions:
  - 'Config snippets use illustrative values with comments directing users to official docs for current limits'
  - 'HuggingFace config uses createCallLimit instead of createTokenLimit since billing is compute-time-based'
  - 'OpenRouter config snippet includes separate AI SDK provider setup example for direct usage'

patterns-established:
  - 'Provider doc template: Quick Reference table, Getting Your API Key steps, Free Tier Summary, Configuration snippet, Gotchas & Tips, Paid Tier'
  - 'All config snippets import from pennyllm/policy and pennyllm/types, using typed provider configs'

requirements-completed: [PROV-01, PROV-02, PROV-03, PROV-04, PROV-05, PROV-06, DX-02]

# Metrics
duration: 3min
completed: 2026-03-14
---

# Phase 8 Plan 2: Provider Key Acquisition Documentation Summary

**6 self-contained provider docs with sign-up instructions, per-model limit tables, pennyllm config snippets using builder helpers, and provider-specific gotchas**

## Performance

- **Duration:** 3m 14s
- **Started:** 2026-03-14T00:08:36Z
- **Completed:** 2026-03-14T00:11:50Z
- **Tasks:** 2
- **Files modified:** 6 (6 created)

## Accomplishments

- Wrote 6 provider documentation files in docs/providers/ covering Google AI Studio, Groq, OpenRouter, Mistral, HuggingFace, and Cerebras
- Each doc includes Quick Reference table, step-by-step API key acquisition, free tier limits table, working config snippet with builder helpers, and gotchas section
- OpenRouter doc includes dedicated "How OpenRouter Works" meta-provider explainer with top 5 recommended free models
- HuggingFace doc uses createCallLimit instead of createTokenLimit to match compute-time-based billing model
- All config snippets use placeholder-style comments directing users to verify current limits against official docs

## Task Commits

Each task was committed atomically:

1. **Task 1: Write provider docs for Google, Groq, and OpenRouter** - `802a3fa` (docs)
2. **Task 2: Write provider docs for Mistral, HuggingFace, and Cerebras** - `a12b0ba` (docs)

## Files Created/Modified

- `docs/providers/google.md` - Google AI Studio: per-model limit table (2.5 Pro/Flash/Flash-Lite, 2.0 Flash), Dec 2025 quota reduction note, thinking mode gotcha
- `docs/providers/groq.md` - Groq: 6 popular model limits table, per-organization limit note, ultra-fast inference TPM warning
- `docs/providers/openrouter.md` - OpenRouter: meta-provider explainer, :free suffix concept, top 5 free models, $10 RPD unlock, negative balance warning
- `docs/providers/mistral.md` - Mistral: Experiment plan, phone verification requirement, ~2 RPM bottleneck, 1B monthly tokens
- `docs/providers/huggingface.md` - HuggingFace: $0.10/month credit system, compute-time billing, HF_TOKEN vs HUGGINGFACE_API_KEY mismatch
- `docs/providers/cerebras.md` - Cerebras: 3-model limit table, 8192 token context window, token bucket algorithm, ~2600 tok/sec speed

## Decisions Made

- Config snippets use illustrative values with comments like "Adjust these values based on your account's current limits" rather than asserting values ARE the current limits
- HuggingFace config uses createCallLimit instead of createTokenLimit since billing is compute-time-based, not token-based
- OpenRouter doc includes a separate AI SDK provider setup example showing createOpenAICompatible with base URL for direct usage outside pennyllm

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all tasks executed smoothly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 6 of 12 provider docs complete (Google, Groq, OpenRouter, Mistral, HuggingFace, Cerebras)
- Remaining 6 providers (DeepSeek, Qwen, Cloudflare, NVIDIA, Cohere, GitHub) covered in Plan 08-03
- Doc template pattern established and reusable for remaining providers
- All docs cross-reference builder helpers and typed provider configs from Plan 08-01

---

## Self-Check: PASSED

All 6 created files verified present in docs/providers/. Both commit hashes (802a3fa, a12b0ba) found in git log. SUMMARY.md exists in phase directory.

---

_Phase: 08-provider-policies-catalog_
_Completed: 2026-03-14_
