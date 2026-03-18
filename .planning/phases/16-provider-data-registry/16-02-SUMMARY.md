---
phase: 16-provider-data-registry
plan: 02
subsystem: registry
tags: [json, provider-data, free-tier, rate-limits, ai-sdk]

requires:
  - phase: 16-01
    provides: schema.json, validate.js, generate.js, _template.json
provides:
  - 7 validated provider JSON files with accurate free tier data
  - Auto-generated README.md with comparison table
  - Auto-generated registry.json with all 7 providers
affects: [16-03, pennyllm-integration]

tech-stack:
  added: []
  patterns: [provider-json-per-file, per-model-limits, capability-mapping]

key-files:
  created:
    - awesome-free-llm-apis/providers/cerebras.json
    - awesome-free-llm-apis/providers/google.json
    - awesome-free-llm-apis/providers/groq.json
    - awesome-free-llm-apis/providers/github-models.json
    - awesome-free-llm-apis/providers/sambanova.json
    - awesome-free-llm-apis/providers/nvidia-nim.json
    - awesome-free-llm-apis/providers/mistral.json
  modified:
    - awesome-free-llm-apis/README.md
    - awesome-free-llm-apis/registry.json

key-decisions:
  - 'Used per-model limits for Groq, Google, SambaNova where provider enforces per-model granularity'
  - 'Mapped TypeScript ProviderModelDef capabilities to schema string array format'
  - 'Documented SambaNova two-tier system (free vs developer) in freeTier.notes'

patterns-established:
  - 'Capability mapping: toolCall->tools, reasoning->reasoning, vision->vision, structuredOutput->structuredOutput'
  - 'Per-model limits stored at model level for providers with model-granular enforcement'

requirements-completed: [SC-1, SC-2]

duration: 3min
completed: 2026-03-19
---

# Phase 16 Plan 02: Provider Data Population Summary

**7 provider JSON files populated from PennyLLM TypeScript modules and intelligence notes, validated against schema, with auto-generated README and registry**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-18T21:03:27Z
- **Completed:** 2026-03-18T21:06:28Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Created all 7 provider JSON files with accurate free tier limits, models, auth config, and SDK info
- Each provider has per-model limits where the provider enforces model-granular rate limits (Groq, Google, SambaNova)
- Provider-specific quirks documented: SambaNova two-tier system, NVIDIA geo-restrictions, Mistral data privacy concern
- Generated README.md with comparison table and per-provider sections for all 7 providers
- Generated registry.json with providerCount: 7 for programmatic consumption

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Cerebras, Google, Groq, and GitHub Models provider files** - `f22224f` (feat)
2. **Task 2: Create SambaNova, NVIDIA NIM, and Mistral provider files, then regenerate README + registry** - `6cfef2d` (feat)

## Files Created/Modified

- `awesome-free-llm-apis/providers/cerebras.json` - Cerebras provider: 30 RPM, 1M TPD, 4 models
- `awesome-free-llm-apis/providers/google.json` - Google AI Studio: per-project enforcement, 4 Gemini models with per-model RPM/RPD
- `awesome-free-llm-apis/providers/groq.json` - Groq: per-org limits, 4 models with per-model TPM/TPD
- `awesome-free-llm-apis/providers/github-models.json` - GitHub Models: tier-based limits, OpenAI-compat SDK, 4 models
- `awesome-free-llm-apis/providers/sambanova.json` - SambaNova: two-tier free/developer, $5 credit, 6 models
- `awesome-free-llm-apis/providers/nvidia-nim.json` - NVIDIA NIM: rate-limited perpetual, unpublished limits, 5 models
- `awesome-free-llm-apis/providers/mistral.json` - Mistral: 1 RPS, 1B tokens/month, 4 models
- `awesome-free-llm-apis/README.md` - Auto-generated with comparison table, per-provider sections, usage examples
- `awesome-free-llm-apis/registry.json` - Auto-generated with all 7 providers for programmatic access

## Decisions Made

- Used per-model limits for Groq, Google, and SambaNova where the provider enforces model-granular rate limits, leaving provider-level limits empty for Groq and GitHub Models where no single provider-wide limit exists
- Mapped TypeScript ProviderModelDef boolean capabilities to the schema's string array format (toolCall->tools, etc.)
- Context window and max output token values sourced from intelligence notes where available, with reasonable defaults (131072/8192) for models without documented values

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 7 provider JSON files validated and registered
- README.md and registry.json generated and ready for community use
- Registry data available for programmatic consumption via registry.json

---

_Phase: 16-provider-data-registry_
_Completed: 2026-03-19_
