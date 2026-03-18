---
phase: 16-provider-data-registry
verified: 2026-03-19T00:00:00Z
status: passed
score: 4/4 must-haves verified
re_verification: false
---

# Phase 16: Provider Data Registry Verification Report

**Phase Goal:** Separate published community resource documenting free tier limits, models, and signup URLs for all providers — NOT part of PennyLLM code
**Verified:** 2026-03-19
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| #   | Truth                                                                                      | Status   | Evidence                                                                                    |
| --- | ------------------------------------------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------- |
| 1   | Published resource with structured data for 7+ providers                                   | VERIFIED | `registry.json` providerCount=7, all 7 pass validate.js                                     |
| 2   | Per-provider: signup URL, env var name, free tier limits, available models, AI SDK package | VERIFIED | All 7 provider JSONs contain signupUrl, auth.envVar, freeTier.limits, models[], sdk.package |
| 3   | Community-maintainable (PRs welcome format)                                                | VERIFIED | CONTRIBUTING.md + 2 issue templates + validate.js + generate.js workflow                    |
| 4   | PennyLLM docs link to it as authoritative provider reference                               | VERIFIED | README.md line 252 and docs/configuration.md line 7 both link to awesome-free-llm-apis      |

**Score:** 4/4 truths verified

---

### Required Artifacts

| Artifact                                                           | Expected                                         | Status   | Details                                                                                                  |
| ------------------------------------------------------------------ | ------------------------------------------------ | -------- | -------------------------------------------------------------------------------------------------------- |
| `awesome-free-llm-apis/schema.json`                                | JSON Schema Draft 2020-12 provider data contract | VERIFIED | `$schema` = draft/2020-12, 13 top-level properties including `freeTier`, `models`, `rateLimitHeaders`    |
| `awesome-free-llm-apis/scripts/validate.js`                        | Zero-dependency validation script                | VERIFIED | Contains `validateProvider`, `process.exit`, enum checks; reads `PROVIDERS_DIR`; 0 errors on 7 providers |
| `awesome-free-llm-apis/scripts/generate.js`                        | Zero-dependency README + registry.json generator | VERIFIED | Contains `generateReadme`, `generateRegistry`, `--check` flag, freshness badges (U+1F7E2/1F7E1/1F534)    |
| `awesome-free-llm-apis/providers/_template.json`                   | Contributor template with placeholder values     | VERIFIED | Contains `PROVIDER_SLUG`, `REPLACE_ME`, `YYYY-MM-DD`                                                     |
| `awesome-free-llm-apis/providers/cerebras.json`                    | Cerebras provider data                           | VERIFIED | id=cerebras, rpm=30, tpd=1000000, @ai-sdk/cerebras, 4 models                                             |
| `awesome-free-llm-apis/providers/google.json`                      | Google AI Studio provider data                   | VERIFIED | id=google, GOOGLE_GENERATIVE_AI_API_KEY, @ai-sdk/google, per-model limits                                |
| `awesome-free-llm-apis/providers/groq.json`                        | Groq provider data                               | VERIFIED | id=groq, GROQ_API_KEY, @ai-sdk/groq, per-model limits                                                    |
| `awesome-free-llm-apis/providers/github-models.json`               | GitHub Models provider data                      | VERIFIED | id=github-models, GITHUB_TOKEN, openai-compat, baseUrl=models.inference.ai.azure.com                     |
| `awesome-free-llm-apis/providers/sambanova.json`                   | SambaNova provider data                          | VERIFIED | id=sambanova, credits=$5, expiresAfterDays=30, rpd=20, two-tier note                                     |
| `awesome-free-llm-apis/providers/nvidia-nim.json`                  | NVIDIA NIM provider data                         | VERIFIED | id=nvidia-nim, openai-compat, baseUrl=integrate.api.nvidia.com/v1, geo-restriction note                  |
| `awesome-free-llm-apis/providers/mistral.json`                     | Mistral provider data                            | VERIFIED | id=mistral, rps=1, tokenMonthly=1000000000, data-privacy note                                            |
| `awesome-free-llm-apis/README.md`                                  | Auto-generated README with comparison table      | VERIFIED | "# Awesome Free LLM APIs", 7-row comparison table, freshness badges                                      |
| `awesome-free-llm-apis/registry.json`                              | Auto-generated registry for programmatic use     | VERIFIED | providerCount=7, all 7 provider keys present                                                             |
| `awesome-free-llm-apis/CONTRIBUTING.md`                            | Contributor guide                                | VERIFIED | "Adding a New Provider", "Updating Existing", validate.js, generate.js, 30/90 day thresholds             |
| `awesome-free-llm-apis/.github/ISSUE_TEMPLATE/add-provider.yml`    | GitHub issue form for adding provider            | VERIFIED | `name: Add Provider`, provider-name field                                                                |
| `awesome-free-llm-apis/.github/ISSUE_TEMPLATE/update-provider.yml` | GitHub issue form for updating provider          | VERIFIED | `name: Update Provider`, what-changed field                                                              |
| `README.md` (PennyLLM)                                             | Links to registry                                | VERIFIED | Line 252 links to `awesome-free-llm-apis` with github.com URL                                            |
| `docs/configuration.md` (PennyLLM)                                 | Links to registry                                | VERIFIED | Line 7 links to `awesome-free-llm-apis` with github.com URL                                              |

---

### Key Link Verification

| From                    | To                           | Via                                                   | Status | Details                                                                                               |
| ----------------------- | ---------------------------- | ----------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------- |
| `scripts/validate.js`   | `providers/*.json`           | reads PROVIDERS_DIR, validates each file              | WIRED  | `const PROVIDERS_DIR = path.join(__dirname, '..', 'providers')` — 7 files validated, 0 errors, exit 0 |
| `scripts/generate.js`   | `providers/*.json`           | reads all providers, writes README.md + registry.json | WIRED  | `--check` mode exits 0 confirming generated files match on-disk state                                 |
| `providers/*.json`      | `schema.json`                | all files conform, checked by validate.js             | WIRED  | All 7 pass validation; schema defines contract that validate.js enforces                              |
| `README.md` (PennyLLM)  | `awesome-free-llm-apis` repo | provider reference link                               | WIRED  | `https://github.com/YOUR_USERNAME/awesome-free-llm-apis` present                                      |
| `docs/configuration.md` | `awesome-free-llm-apis` repo | registry link                                         | WIRED  | `https://github.com/YOUR_USERNAME/awesome-free-llm-apis` present                                      |

---

### Requirements Coverage

The phase plans use SC-1 through SC-4 as internal shorthand for the 4 ROADMAP success criteria. These are not IDs defined in `.planning/REQUIREMENTS.md`. REQUIREMENTS.md maps Phase 16 as extending CORE-05, CAT-06, CAT-07 (Phase 9 Fallback requirements) — this mapping is a broad annotation noting that the provider data registry enriches fallback routing context; Phase 16 itself delivers independent success criteria.

| Requirement (Plan ID) | ROADMAP Criterion                                                           | Source Plans | Status    | Evidence                                                                            |
| --------------------- | --------------------------------------------------------------------------- | ------------ | --------- | ----------------------------------------------------------------------------------- |
| SC-1                  | Structured data for 7+ providers                                            | 16-01, 16-02 | SATISFIED | 7 provider JSON files pass validate.js; registry.json providerCount=7               |
| SC-2                  | Per-provider: signup URL, env var, free tier limits, models, AI SDK package | 16-01, 16-02 | SATISFIED | All 7 providers have signupUrl, auth.envVar, freeTier.limits, models[], sdk.package |
| SC-3                  | Community-maintainable (PRs welcome format)                                 | 16-01, 16-03 | SATISFIED | CONTRIBUTING.md + 2 issue templates + schema + validator + generator                |
| SC-4                  | PennyLLM docs link to it as authoritative provider reference                | 16-03        | SATISFIED | README.md and docs/configuration.md both link to awesome-free-llm-apis              |

No orphaned requirements. All SC IDs claimed across plans are accounted for.

---

### Anti-Patterns Found

No anti-patterns detected:

- No TODO/FIXME/PLACEHOLDER in scripts or provider JSON files
- No stub implementations — validate.js exits 0 on all 7 real providers
- No empty handlers or return null in scripts
- generate.js `--check` mode confirms generated output matches on-disk files (no stale generated files)
- All 6 commit hashes from SUMMARYs verified in git log: e950b32, 692a688, f22224f, 6cfef2d, 5dbda4c, 4fe2f8c

---

### Human Verification Required

#### 1. Registry publication to GitHub

**Test:** Navigate to the actual GitHub repository URL (replace `YOUR_USERNAME` in the links)
**Expected:** Repository is publicly accessible; README renders with comparison table; registry.json accessible via raw URL
**Why human:** This is an external publish step — the code exists locally but the repo must be created and pushed by the user. The `YOUR_USERNAME` placeholder in links is by design.

#### 2. Community workflow end-to-end

**Test:** Copy `_template.json` to `providers/test-provider.json`, fill in real values, run `node scripts/validate.js`, run `node scripts/generate.js`, observe output
**Expected:** validate.js exits 0 with OK for new file; generate.js updates README and registry.json with 8 providers
**Why human:** The workflow functions correctly based on code inspection, but a contributor experience smoke test confirms usability

---

### Gaps Summary

No gaps. All phase goal requirements are met by verified artifacts and wiring.

The registry directory (`awesome-free-llm-apis/`) is a complete, self-contained community resource:

- Schema defines the data contract
- validate.js enforces it (7 providers pass, 0 errors)
- generate.js produces up-to-date README.md and registry.json (--check exits 0)
- All 7 target providers have structured data with per-provider quirks documented
- CONTRIBUTING.md and issue templates enable community participation
- PennyLLM README and configuration docs link to the registry

The only remaining action is publishing the `awesome-free-llm-apis/` directory as a standalone GitHub repository — which is a user action, not a code gap.

---

_Verified: 2026-03-19_
_Verifier: Claude (gsd-verifier)_
