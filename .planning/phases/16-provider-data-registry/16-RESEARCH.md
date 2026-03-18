# Phase 16: Provider Data Registry - Research

**Researched:** 2026-03-19
**Domain:** Standalone community data repository (JSON + Node.js scripts + Markdown generation)
**Confidence:** HIGH

## Summary

Phase 16 creates a standalone GitHub repository (`awesome-free-llm-apis`) that documents free tier limits, models, signup URLs, and SDK info for LLM API providers. This is NOT part of PennyLLM code -- it is a separate community resource that PennyLLM links to. The data lives in per-provider JSON files validated against a JSON Schema, with a zero-dependency Node.js script that generates both a README.md and a combined `registry.json`.

All 7 initial provider data sets already exist in PennyLLM's codebase across two sources: TypeScript provider modules (`src/providers/*.ts`) containing model IDs, capabilities, quality tiers, SDK packages, and env vars; and Markdown intelligence notes (`docs/providers/notes/*.md`) containing free tier limits, rate limit headers, gotchas, and verification dates. The implementation is primarily a data reformatting exercise -- extracting structured data from these two sources into the decided JSON schema.

**Primary recommendation:** Structure the repo creation into three waves: (1) schema + validation script + template, (2) populate all 7 provider JSON files from existing data, (3) README generation script + combined registry.json + community contribution scaffolding.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- Standalone GitHub repo named `awesome-free-llm-apis`, same GitHub account as PennyLLM
- CC0 / Public Domain license
- JSON is source of truth -- contributors edit `providers/*.json` files only
- README auto-generated from JSON via zero-dependency Node script (`node scripts/generate.js`)
- Combined `registry.json` auto-generated alongside README
- Date-based snapshot tags (e.g., `2026-03`, `2026-04`)
- GitHub raw URL for fetching `registry.json`
- No GitHub Actions / CI -- fully manual
- Zero dependencies -- validate.js and generate.js use only Node.js built-ins
- PennyLLM docs link only -- no data duplication
- Dev-reference only -- not consumed by PennyLLM at runtime
- Per-provider JSON files in `providers/` directory
- JSON Schema (`schema.json`) validates all provider files
- registry.json includes metadata: `$schema`, `version`, `generatedAt`, `providerCount`, `providers` object
- Schema fields as specified in CONTEXT.md (core, auth, freeTier, sdk, rateLimitHeaders, models, notes, freshness)
- Initial release: 7 PennyLLM target providers (Cerebras, Google AI Studio, Groq, GitHub Models, SambaNova, NVIDIA NIM, Mistral)
- Text LLMs only
- PR-based contribution flow with `_template.json`, CONTRIBUTING.md, two issue templates
- Staleness tracking: green <=30d, yellow >30d, red >90d (threshold: 30 days)
- Minimal governance -- just CONTRIBUTING.md
- README usage examples (2-3 code snippets)

### Claude's Discretion

- Exact JSON Schema structure and validation rules
- generate.js script implementation (README template, table formatting, staleness badge logic)
- validate.js script implementation (schema loading, error reporting format)
- \_template.json comment style (JSON5 comments vs stripped before validation)
- Exact README layout and section ordering
- registry.json provider key format (object keys vs array with id field)
- Issue template content and form fields
- Whether to include a .editorconfig or .gitattributes

### Deferred Ideas (OUT OF SCOPE)

None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>

## Phase Requirements

| ID            | Description                                      | Research Support                                                                                                                         |
| ------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| CORE-05 (ext) | Fallback behavior per provider                   | Registry documents provider capabilities and limits enabling informed fallback configuration                                             |
| CAT-06 (ext)  | Fallback routing respects model capabilities     | Registry's per-model capabilities array (reasoning, vision, tools, structuredOutput) and quality tiers enable capability-aware decisions |
| CAT-07 (ext)  | Fallback routing prefers cheapest matching model | Registry's free tier documentation and per-model free flags help users configure cost-aware fallback chains                              |

</phase_requirements>

## Standard Stack

### Core

| Tool                      | Version                  | Purpose                         | Why Standard                                     |
| ------------------------- | ------------------------ | ------------------------------- | ------------------------------------------------ |
| Node.js built-ins         | v18+ (fs, path, process) | File I/O, path manipulation     | Zero-dependency constraint; available everywhere |
| JSON Schema Draft 2020-12 | N/A                      | Provider file validation schema | Industry standard for JSON validation            |
| CommonJS scripts          | N/A                      | validate.js, generate.js        | Maximum Node.js compatibility without build step |

### Supporting

| Tool             | Version | Purpose                              | When to Use                               |
| ---------------- | ------- | ------------------------------------ | ----------------------------------------- |
| `.editorconfig`  | N/A     | Consistent formatting across editors | Include for contributor experience        |
| `.gitattributes` | N/A     | Enforce LF line endings for JSON     | Include to prevent CRLF issues on Windows |

### Alternatives Considered

| Instead of            | Could Use        | Tradeoff                                                         |
| --------------------- | ---------------- | ---------------------------------------------------------------- |
| Hand-rolled validator | Ajv (npm)        | Ajv is industry standard but violates zero-dependency constraint |
| JSON Schema           | TypeScript types | JSON Schema is language-agnostic, shareable, self-documenting    |
| CommonJS              | ESM              | CJS avoids need for package.json type:module or .mjs extension   |

## Architecture Patterns

### Recommended Repo Structure

```
awesome-free-llm-apis/
├── providers/
│   ├── cerebras.json
│   ├── google.json
│   ├── groq.json
│   ├── github-models.json
│   ├── sambanova.json
│   ├── nvidia-nim.json
│   ├── mistral.json
│   └── _template.json
├── scripts/
│   ├── validate.js
│   └── generate.js
├── .github/
│   └── ISSUE_TEMPLATE/
│       ├── add-provider.yml
│       └── update-provider.yml
├── schema.json
├── registry.json          (auto-generated)
├── README.md              (auto-generated)
├── CONTRIBUTING.md
├── LICENSE
├── .editorconfig
└── .gitattributes
```

### Pattern 1: Per-Provider JSON Files

**What:** Each provider has a single JSON file in `providers/` containing all data.
**When to use:** Always -- this is the source of truth.
**Key design:** File names are kebab-case slugs matching the provider `id` field (e.g., `nvidia-nim.json` has `"id": "nvidia-nim"`).

```json
{
  "id": "cerebras",
  "name": "Cerebras",
  "status": "active",
  "signupUrl": "https://cloud.cerebras.ai",
  "docsUrl": "https://inference-docs.cerebras.ai/api-reference/chat-completions",
  "auth": {
    "envVar": "CEREBRAS_API_KEY",
    "header": "Authorization: Bearer"
  },
  "freeTier": {
    "type": "perpetual",
    "limits": { "rpm": 30, "tpm": 60000, "tpd": 1000000 },
    "notes": "Account-level limits. Key rotation provides no benefit."
  },
  "sdk": {
    "package": "@ai-sdk/cerebras",
    "type": "official"
  },
  "rateLimitHeaders": {
    "remaining": "x-ratelimit-remaining-requests",
    "reset": "x-ratelimit-reset-requests",
    "limit": "x-ratelimit-limit-requests",
    "format": "seconds"
  },
  "models": [
    {
      "id": "gpt-oss-120b",
      "free": true,
      "capabilities": ["tools", "structuredOutput"],
      "tier": "frontier",
      "contextWindow": 8192,
      "maxOutputTokens": 8192
    }
  ],
  "notes": [
    "Account-level limits -- all API keys share the same quota",
    "Fastest inference available (2000-3000 tok/s on WSE hardware)"
  ],
  "lastVerified": "2026-03-17",
  "verifiedBy": "manual"
}
```

### Pattern 2: JSON Schema for Validation

**What:** A `schema.json` file defining the structure, types, required fields, and enum values for provider files.
**When to use:** Validated by `scripts/validate.js` before PRs.

The schema should be JSON Schema Draft 2020-12 (latest stable). Key validation rules:

- `id`: string, required, matches filename (enforced by validate.js, not schema)
- `status`: enum `["active", "degraded", "discontinued"]`
- `freeTier.type`: enum `["perpetual", "trial", "rate-limited"]`
- `freeTier.limits`: object with optional numeric keys `rpm`, `rpd`, `tpd`, `tpm`, `rps`
- `freeTier.credits`: string, only when type is `"trial"`
- `freeTier.expiresAfterDays`: number, only when type is `"trial"`
- `sdk.type`: enum `["official", "openai-compat", "community"]`
- `sdk.baseUrl`: required only when sdk.type is `"openai-compat"`
- `rateLimitHeaders.format`: enum `["seconds", "epoch", "iso"]`
- `models[].capabilities`: array of enum `["reasoning", "vision", "tools", "structuredOutput"]`
- `models[].tier`: enum `["frontier", "high", "mid", "small"]`
- `lastVerified`: date string (ISO format YYYY-MM-DD)
- `verifiedBy`: enum `["manual", "automated"]`

### Pattern 3: Zero-Dependency Validation Script

**What:** `scripts/validate.js` loads schema.json and validates all provider files using hand-rolled checks.
**When to use:** Contributors run `node scripts/validate.js` before submitting PRs.

Since Node.js has no built-in JSON Schema validator, the validate.js script should:

1. Load `schema.json` for reference (documents the contract)
2. Implement type checking, required field validation, enum validation, and conditional requirements programmatically
3. Report errors with file path, field path, and expected vs actual values
4. Exit with code 0 on success, 1 on failure
5. Validate all `providers/*.json` files (excluding `_template.json`)
6. Cross-validate that filename matches `id` field

The validation does NOT need to be a full JSON Schema spec implementation. It validates against the known schema shape with direct property checks. The `schema.json` file serves as documentation for the data contract.

### Pattern 4: README + registry.json Generation

**What:** `scripts/generate.js` reads all provider JSON files and produces both README.md and registry.json.
**When to use:** Contributors run `node scripts/generate.js` after modifying provider data.

README generation should produce:

1. Header with repo description and badge count
2. Comparison table (all providers, sorted by name) with key columns: Provider, Free Tier Type, RPM, Daily Limit, Monthly Limit, AI SDK Package, Freshness
3. Freshness badges using emoji: green circle (<=30d), yellow circle (>30d), red circle (>90d)
4. Per-provider sections with full details (auth, limits, models table, notes, SDK setup)
5. Usage examples section (fetching + parsing registry.json)
6. Contributing link

registry.json generation should produce:

```json
{
  "$schema": "./schema.json",
  "version": "2026-03",
  "generatedAt": "2026-03-19T12:00:00Z",
  "providerCount": 7,
  "providers": {
    "cerebras": { ... },
    "google": { ... }
  }
}
```

**Recommendation on providers key format:** Use an object keyed by provider `id` (not an array). Object keys enable O(1) lookup by consumers: `registry.providers.cerebras`. The `id` field inside each provider object provides redundancy for array-based iteration via `Object.values()`.

### Pattern 5: Template File for Contributors

**What:** `_template.json` with placeholder values showing all fields.
**When to use:** Contributors copy this file, rename it, and fill in real data.

Since JSON does not support comments, use obviously-placeholder values that the validator will reject:

- `"id": "PROVIDER_SLUG"` (validator checks it matches filename)
- `"signupUrl": "https://REPLACE_ME"` (validator checks URL format)
- `"lastVerified": "YYYY-MM-DD"` (validator checks date format)

This is cleaner than JSON5 comments and requires no preprocessing. The validator naturally catches unfilled templates.

### Anti-Patterns to Avoid

- **Implementing full JSON Schema spec in validate.js:** Unnecessary complexity. Validate the specific known shape, not arbitrary schemas.
- **Using \_template.json with JSON5 comments:** Requires stripping comments before validation. Use placeholder values instead.
- **Putting all providers in one file:** Loses per-file git blame, makes merge conflicts likely, harder for contributors.
- **Making registry.json the source of truth:** Contributors should never edit registry.json directly. It is always generated.
- **ESM scripts with import syntax:** CJS with `require()` is simpler for utility scripts, avoids package.json type configuration.

## Don't Hand-Roll

| Problem                    | Don't Build                       | Use Instead                                                                          | Why                                                                  |
| -------------------------- | --------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| Full JSON Schema validator | Complete spec-compliant validator | Targeted property checks against known shape                                         | Full spec is thousands of lines; the schema shape is fixed and known |
| Markdown table formatter   | Custom column alignment           | Simple string padding with `String.padEnd()`                                         | Markdown tables don't need precise alignment; GitHub renders them    |
| Date parsing               | Custom ISO date parser            | `new Date(str)` + `isNaN` check                                                      | Built-in Date handles ISO 8601 correctly                             |
| File globbing              | Custom glob matcher               | `fs.readdirSync('providers').filter(f => f.endsWith('.json') && !f.startsWith('_'))` | Directory is flat, pattern is trivial                                |

## Common Pitfalls

### Pitfall 1: Stale Data from Source Files

**What goes wrong:** Provider data in `src/providers/*.ts` and `docs/providers/notes/*.md` may have become outdated since Phase 12.
**Why it happens:** Model catalogs and rate limits change frequently (Google, Groq, NVIDIA are HIGH volatility).
**How to avoid:** Use `lastVerified` dates from source files as-is. Do NOT update/re-research during this phase. The `lastVerified` field will naturally trigger freshness warnings in the generated README.
**Warning signs:** Models listed in TypeScript files that no longer exist at the provider.

### Pitfall 2: JSON Schema Conditional Validation Complexity

**What goes wrong:** Trial-specific fields (`credits`, `expiresAfterDays`) should only be required when `freeTier.type` is `"trial"`. JSON Schema `if/then/else` is complex.
**Why it happens:** JSON Schema conditional validation is verbose and error-prone to write by hand.
**How to avoid:** Implement conditional validation in validate.js code, not in schema.json. Keep the schema documenting the shape and types. Let the script handle cross-field rules.
**Warning signs:** Schema file growing beyond 200 lines with nested conditionals.

### Pitfall 3: Template File Breaking Validation

**What goes wrong:** `_template.json` has placeholder values that fail validation, causing `validate.js` to report errors.
**Why it happens:** Template is in the same `providers/` directory as real data files.
**How to avoid:** Exclude files starting with `_` from validation. Document this convention in CONTRIBUTING.md.
**Warning signs:** Validation script reporting errors on `_template.json`.

### Pitfall 4: GitHub Models Was Dropped but Is in Scope

**What goes wrong:** GitHub Models was dropped from PennyLLM's active provider list (Phase 12 execution) but is included in the 7 initial providers for the registry.
**Why it happens:** CONTEXT.md explicitly lists it as one of the 7 providers. The registry is a community resource covering providers beyond PennyLLM's active set.
**How to avoid:** Include GitHub Models in the registry. Source data exists in `src/providers/github-models.ts` and `docs/providers/notes/github-models.md`. Note its `status` could be `"active"` since it still works -- it was just dropped from PennyLLM's focus.
**Warning signs:** Skipping GitHub Models thinking it was dropped.

### Pitfall 5: NVIDIA NIM Model IDs Contain Slashes

**What goes wrong:** NVIDIA model IDs like `deepseek-ai/deepseek-v3.2` contain slashes, which could cause issues if used as keys or in file paths.
**Why it happens:** NVIDIA uses `org/model-name` format for API model IDs.
**How to avoid:** Model IDs are stored as string values in JSON arrays, not as object keys or file paths. No special handling needed -- just store the full ID string.

### Pitfall 6: SambaNova Two-Tier System

**What goes wrong:** Incorrectly documenting SambaNova as having a single free tier.
**Why it happens:** SambaNova has both a "Free" tier (20 RPD, no card) and a "Developer" tier (12K RPD, card required at $0). The difference is 600x.
**How to avoid:** Document both tiers in the `freeTier` section. Use `notes` to explain the tier upgrade path. The `freeTier.type` should be `"perpetual"` (the developer tier is perpetual at $0 balance), with notes explaining the free-vs-developer distinction.
**Warning signs:** Registry showing 20 RPD for SambaNova without mentioning the developer tier upgrade.

## Code Examples

### validate.js Core Pattern

```javascript
// scripts/validate.js
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const PROVIDERS_DIR = path.join(__dirname, '..', 'providers');
const SCHEMA_PATH = path.join(__dirname, '..', 'schema.json');

const VALID_STATUS = ['active', 'degraded', 'discontinued'];
const VALID_FREE_TIER_TYPE = ['perpetual', 'trial', 'rate-limited'];
const VALID_SDK_TYPE = ['official', 'openai-compat', 'community'];
const VALID_CAPABILITIES = ['reasoning', 'vision', 'tools', 'structuredOutput'];
const VALID_TIERS = ['frontier', 'high', 'mid', 'small'];
const VALID_HEADER_FORMAT = ['seconds', 'epoch', 'iso'];
const VALID_VERIFIED_BY = ['manual', 'automated'];

function validateProvider(filePath) {
  const errors = [];
  const fileName = path.basename(filePath, '.json');
  let data;

  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return [{ file: filePath, error: `Invalid JSON: ${e.message}` }];
  }

  // Required string fields
  for (const field of ['id', 'name', 'status', 'signupUrl', 'docsUrl', 'lastVerified']) {
    if (typeof data[field] !== 'string' || data[field].length === 0) {
      errors.push({ field, error: `Required string field missing or empty` });
    }
  }

  // id must match filename
  if (data.id !== fileName) {
    errors.push({
      field: 'id',
      error: `Must match filename: expected "${fileName}", got "${data.id}"`,
    });
  }

  // Enum checks
  if (!VALID_STATUS.includes(data.status)) {
    errors.push({ field: 'status', error: `Must be one of: ${VALID_STATUS.join(', ')}` });
  }

  // ... additional validation per section ...
  return errors;
}

// Main
const files = fs
  .readdirSync(PROVIDERS_DIR)
  .filter((f) => f.endsWith('.json') && !f.startsWith('_'));

let hasErrors = false;
for (const file of files) {
  const errors = validateProvider(path.join(PROVIDERS_DIR, file));
  if (errors.length > 0) {
    hasErrors = true;
    console.error(`\n${file}:`);
    for (const err of errors) {
      console.error(`  - ${err.field || ''}: ${err.error}`);
    }
  } else {
    console.log(`  ${file}: OK`);
  }
}

process.exit(hasErrors ? 1 : 0);
```

### generate.js Core Pattern

```javascript
// scripts/generate.js
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const PROVIDERS_DIR = path.join(__dirname, '..', 'providers');
const README_PATH = path.join(__dirname, '..', 'README.md');
const REGISTRY_PATH = path.join(__dirname, '..', 'registry.json');

function loadProviders() {
  const files = fs
    .readdirSync(PROVIDERS_DIR)
    .filter((f) => f.endsWith('.json') && !f.startsWith('_'))
    .sort();

  return files.map((f) => {
    const data = JSON.parse(fs.readFileSync(path.join(PROVIDERS_DIR, f), 'utf8'));
    return data;
  });
}

function freshnessBadge(lastVerified) {
  const days = Math.floor((Date.now() - new Date(lastVerified).getTime()) / 86400000);
  if (days <= 30) return '\u{1F7E2}'; // green circle
  if (days <= 90) return '\u{1F7E1}'; // yellow circle
  return '\u{1F534}'; // red circle
}

function generateReadme(providers) {
  const lines = [];
  // Header
  lines.push('# Awesome Free LLM APIs');
  lines.push('');
  lines.push('> A community-maintained registry of free tier LLM API providers.');
  lines.push(`> ${providers.length} providers | Machine-readable JSON | Auto-generated`);
  // ... comparison table, per-provider sections, usage examples ...
  return lines.join('\n');
}

function generateRegistry(providers) {
  const providersObj = {};
  for (const p of providers) {
    providersObj[p.id] = p;
  }
  return {
    $schema: './schema.json',
    version: new Date().toISOString().slice(0, 7), // "2026-03"
    generatedAt: new Date().toISOString(),
    providerCount: providers.length,
    providers: providersObj,
  };
}

// Main
const providers = loadProviders();
fs.writeFileSync(README_PATH, generateReadme(providers), 'utf8');
fs.writeFileSync(
  REGISTRY_PATH,
  JSON.stringify(generateRegistry(providers), null, 2) + '\n',
  'utf8',
);
console.log(`Generated README.md and registry.json (${providers.length} providers)`);
```

### Freshness Badge in Comparison Table

```markdown
| Provider                                        | Type      | RPM  | Daily      | SDK                | Freshness     |
| ----------------------------------------------- | --------- | ---- | ---------- | ------------------ | ------------- |
| [Cerebras](https://cloud.cerebras.ai)           | perpetual | 30   | 1M TPD     | `@ai-sdk/cerebras` | green_circle  |
| [Google AI Studio](https://aistudio.google.com) | perpetual | 5-15 | 100-1K RPD | `@ai-sdk/google`   | yellow_circle |
```

## Data Mapping: Source -> JSON Schema

This table maps where each JSON field's data comes from in the existing PennyLLM codebase.

### From TypeScript Provider Modules (`src/providers/*.ts`)

| JSON Field              | TypeScript Source                                                  |
| ----------------------- | ------------------------------------------------------------------ |
| `id`                    | `ProviderModule.id`                                                |
| `name`                  | `ProviderModule.name`                                              |
| `auth.envVar`           | `ProviderModule.envVar`                                            |
| `sdk.package`           | `ProviderModule.sdkPackage`                                        |
| `models[].id`           | `ProviderModelDef.apiId`                                           |
| `models[].free`         | `ProviderModelDef.free`                                            |
| `models[].capabilities` | `ProviderModelDef.capabilities` (convert booleans to string array) |
| `models[].tier`         | `ProviderModelDef.qualityTier`                                     |
| `lastVerified`          | `ProviderModule.lastVerified`                                      |

### From Intelligence Notes (`docs/providers/notes/*.md`)

| JSON Field                 | Notes Source                                                    |
| -------------------------- | --------------------------------------------------------------- |
| `signupUrl`                | "Key Acquisition" / "Console" section                           |
| `docsUrl`                  | "AI SDK Integration" / API docs references                      |
| `freeTier.type`            | Tier categorization (perpetual/trial)                           |
| `freeTier.limits`          | Rate limit tables (RPM, RPD, TPM, TPD)                          |
| `freeTier.notes`           | "Rate Limit Structure" notes                                    |
| `freeTier.credits`         | Trial credit info (SambaNova: $5)                               |
| `sdk.type`                 | "AI SDK Integration" section (official/community/openai-compat) |
| `sdk.baseUrl`              | OpenAI-compat base URLs (NVIDIA, GitHub Models)                 |
| `rateLimitHeaders`         | "Rate Limit Headers" sections                                   |
| `notes`                    | "Observations & Quirks", "Gotchas", gap analysis notes          |
| `models[].contextWindow`   | Model tables in notes                                           |
| `models[].maxOutputTokens` | Model tables in notes                                           |
| `models[].limits`          | Per-model limit tables (Groq, Google, SambaNova)                |

### Fields Requiring Judgment

| JSON Field       | Decision                                                                   |
| ---------------- | -------------------------------------------------------------------------- |
| `status`         | All 7 are `"active"` as of 2026-03                                         |
| `auth.keyPrefix` | Only known for Cerebras (`csk-`) and NVIDIA (`nvapi-`). Omit when unknown. |
| `verifiedBy`     | `"manual"` for all initial providers (verified via PennyLLM E2E tests)     |

## Provider-Specific Data Notes

### Cerebras

- `freeTier.type`: `"perpetual"`
- `freeTier.limits`: `{ "rpm": 30, "tpm": 60000, "tpd": 1000000 }`
- `sdk.type`: `"official"`
- Account-level limits; key rotation provides no benefit
- 4 models in TypeScript module

### Google AI Studio

- `freeTier.type`: `"perpetual"`
- `freeTier.limits`: Per-model, varies. Provider-level: `{ "tpm": 250000 }`. Per-model RPM/RPD in model entries.
- `sdk.type`: `"official"`
- Per-project enforcement; keys from different projects get independent quota
- 4 models in TypeScript module; notes document many more including Gemma series

### Groq

- `freeTier.type`: `"perpetual"`
- `freeTier.limits`: Per-model, varies widely. No single provider-level limit.
- `sdk.type`: `"official"`
- Per-organization limits; key rotation provides no benefit
- 4 models in TypeScript module; notes document 14+ models

### GitHub Models

- `freeTier.type`: `"perpetual"`
- `freeTier.limits`: Tier-based: High tier `{ "rpm": 10, "rpd": 50 }`, Low tier `{ "rpm": 15, "rpd": 150 }`
- `sdk.type`: `"openai-compat"`, `baseUrl`: `"https://models.inference.ai.azure.com"`
- `auth.envVar`: `"GITHUB_TOKEN"`
- Per-request token limits (8K in / 4K out for high-tier) -- document in notes
- 4 models in TypeScript module
- Status `"active"` in registry even though dropped from PennyLLM

### SambaNova

- `freeTier.type`: `"perpetual"` (developer tier at $0 balance)
- `freeTier.limits`: Free tier `{ "rpm": 20, "rpd": 20, "tpd": 200000 }`. Developer tier limits are per-model.
- `freeTier.credits`: `"$5"`, `freeTier.expiresAfterDays`: 30 (for initial signup credit)
- `sdk.type`: `"community"`, package: `"sambanova-ai-provider"`
- Notes MUST explain free-vs-developer tier distinction (600x difference)
- 6 models in TypeScript module

### NVIDIA NIM

- `freeTier.type`: `"rate-limited"` (perpetual but rate-limited trial)
- `freeTier.limits`: `{ "rpm": 40 }` (approximate, unpublished)
- `freeTier.notes`: "NVIDIA does not publish per-model limits. ~40 RPM is community-reported."
- `sdk.type`: `"openai-compat"`, `baseUrl`: `"https://integrate.api.nvidia.com/v1"`
- `auth.keyPrefix`: `"nvapi-"`
- Rate limit headers: undocumented by NVIDIA
- 5 models in TypeScript module; notes document 14+ free endpoint models
- May be geo-restricted in some regions

### Mistral

- `freeTier.type`: `"perpetual"`
- `freeTier.limits`: `{ "rps": 1, "tpm": 50000 }` with `{ "tokenMonthly": 1000000000 }` (1B)
- `sdk.type`: `"official"`
- Per-organization limits; key rotation provides no benefit
- Data privacy concern: free tier may use data for training by default
- 4 models in TypeScript module; notes document 11+ current models

## State of the Art

| Old Approach                  | Current Approach                 | When Changed        | Impact                                                   |
| ----------------------------- | -------------------------------- | ------------------- | -------------------------------------------------------- |
| Static Markdown awesome-lists | JSON source + generated Markdown | 2024-2025           | Machine-readable + human-readable from same source       |
| Manual README updates         | Auto-generated from data         | Common in 2025+     | Eliminates data drift between README and underlying data |
| GitHub Actions for validation | Manual local scripts             | N/A (user decision) | Simpler setup, no CI configuration needed                |

**Existing community resources:**

- [cheahjs/free-llm-api-resources](https://github.com/cheahjs/free-llm-api-resources) -- Pure Markdown, no JSON source, no schema validation. 250+ stars.
- [Sandalu123/awesome-llm-apis](https://github.com/Sandalu123/awesome-llm-apis) -- Similar scope but less structured.

The `awesome-free-llm-apis` repo differentiates by providing machine-readable JSON with schema validation alongside the human-readable README.

## Open Questions

1. **SambaNova `freeTier.type` classification**
   - What we know: Has both free tier (20 RPD, no card) and developer tier ($0 card, 12K RPD). Also has $5 signup credit (30-day trial).
   - What's unclear: Should `freeTier.type` be `"perpetual"` (developer tier) or `"trial"` (signup credit)?
   - Recommendation: Use `"perpetual"` since the developer tier is the recommended path. Document the trial credit and tier distinction in `freeTier.notes`. Include `freeTier.credits` and `freeTier.expiresAfterDays` for the signup credit.

2. **Per-model limits representation**
   - What we know: Groq, Google, and SambaNova have per-model rate limits that differ significantly.
   - What's unclear: Should provider-level `freeTier.limits` represent the "typical" or "minimum" limits?
   - Recommendation: Use the most conservative (lowest) limits at provider level. Store per-model overrides in `models[].limits` for providers where this matters (Groq, Google, SambaNova developer tier).

3. **Mistral `rps` field in schema**
   - What we know: CONTEXT.md schema uses `{ rpm, rpd, tpd }`. Mistral uses requests-per-second (1 RPS).
   - What's unclear: The decided schema has `freeTier.limits` as flat key-value with `rpm`, `rpd`, `tpd`. No `rps` key.
   - Recommendation: Add `rps` and `tpm` to the allowed keys in `freeTier.limits`. This is within Claude's discretion for "exact JSON Schema structure."

## Validation Architecture

### Test Framework

| Property           | Value                                                            |
| ------------------ | ---------------------------------------------------------------- |
| Framework          | Node.js built-in `node:assert` (no framework -- utility scripts) |
| Config file        | None -- scripts are self-contained                               |
| Quick run command  | `node scripts/validate.js`                                       |
| Full suite command | `node scripts/validate.js && node scripts/generate.js`           |

### Phase Requirements -> Test Map

| Req ID      | Behavior                                       | Test Type | Automated Command                                    | File Exists? |
| ----------- | ---------------------------------------------- | --------- | ---------------------------------------------------- | ------------ |
| CORE-05 ext | Provider data documents fallback-relevant info | smoke     | `node scripts/validate.js`                           | Wave 0       |
| CAT-06 ext  | Per-model capabilities array present           | smoke     | `node scripts/validate.js` (checks required fields)  | Wave 0       |
| CAT-07 ext  | Free tier + pricing data present               | smoke     | `node scripts/validate.js` (checks freeTier section) | Wave 0       |

### Sampling Rate

- **Per task commit:** `node scripts/validate.js`
- **Per wave merge:** `node scripts/validate.js && node scripts/generate.js && diff <(cat README.md) <(node scripts/generate.js --dry-run)`
- **Phase gate:** All 7 provider files validate, README and registry.json generate without errors

### Wave 0 Gaps

- [ ] `schema.json` -- JSON Schema definition
- [ ] `scripts/validate.js` -- Validation script
- [ ] `scripts/generate.js` -- Generation script
- [ ] `providers/_template.json` -- Contributor template

(All files are new -- this is a greenfield repo)

## Sources

### Primary (HIGH confidence)

- PennyLLM provider TypeScript modules (`src/providers/*.ts`) -- model IDs, capabilities, tiers, SDK packages, env vars
- PennyLLM provider intelligence notes (`docs/providers/notes/*.md`) -- rate limits, headers, gotchas, verification dates
- PennyLLM provider types (`src/providers/types.ts`) -- ProviderModule and ProviderModelDef interfaces

### Secondary (MEDIUM confidence)

- [cheahjs/free-llm-api-resources](https://github.com/cheahjs/free-llm-api-resources) -- Community reference for scope/coverage
- [Ajv JSON schema validator docs](https://ajv.js.org/) -- JSON Schema Draft 2020-12 syntax reference
- [JSON Schema specification](https://json-schema.org/blog/posts/get-started-with-json-schema-in-node-js) -- JSON Schema best practices
- [Sandalu123/awesome-llm-apis](https://github.com/Sandalu123/awesome-llm-apis) -- Similar project reference

### Tertiary (LOW confidence)

- Mistral rate limits (1 RPS, 50K TPM) -- community-reported, not officially documented publicly

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH -- zero-dependency Node.js scripts are well-understood; all data sources exist in PennyLLM codebase
- Architecture: HIGH -- repo structure follows established patterns; JSON Schema is standard; all decisions are locked in CONTEXT.md
- Pitfalls: HIGH -- all identified from direct analysis of source data and CONTEXT.md constraints
- Data accuracy: MEDIUM -- some provider data (Mistral limits, NVIDIA limits) has LOW confidence markers in source notes

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (30 days -- provider data may shift but repo structure is stable)
