# Contributing to Awesome Free LLM APIs

Thanks for helping keep this registry accurate and comprehensive! This guide explains how to add new providers or update existing data.

## Adding a New Provider

1. Copy `providers/_template.json` to `providers/{slug}.json`
   - The slug must be lowercase with hyphens (e.g., `together-ai`)
   - The filename must match the `id` field inside the JSON
2. Fill in all fields using the provider's official documentation
3. Run `node scripts/validate.js` to check your data against the schema
4. Run `node scripts/generate.js` to regenerate `README.md` and `registry.json`
5. Commit all changed files (your new JSON file + generated `README.md` + `registry.json`)
6. Open a pull request with a brief description of the provider

## Updating Existing Provider Data

1. Edit the relevant `providers/{slug}.json` file
2. Update `lastVerified` to today's date (format: `YYYY-MM-DD`)
3. Run `node scripts/validate.js` to verify your changes
4. Run `node scripts/generate.js` to regenerate `README.md` and `registry.json`
5. Commit all changed files and open a PR describing what changed and why

## Data Sources

Where to find accurate provider information:

- **Provider's official API documentation** -- the primary source of truth
- **Rate limit response headers** -- make a test API call and inspect the headers
- **Community reports and forums** -- useful for undocumented limits or quirks
- **Provider changelogs and blog posts** -- for recent changes to free tiers

Set `verifiedBy` to `"manual"` unless you have automated verification scripts. If you verified data by making real API calls and inspecting headers, mention that in your PR description.

## Schema Reference

Each provider JSON file follows the schema defined in `schema.json`. Key fields:

| Field                       | Required | Description                                                                                          |
| --------------------------- | -------- | ---------------------------------------------------------------------------------------------------- |
| `id`                        | Yes      | Slug identifier matching the filename                                                                |
| `name`                      | Yes      | Display name                                                                                         |
| `status`                    | Yes      | `active`, `degraded`, or `discontinued`                                                              |
| `signupUrl`                 | Yes      | Account creation URL                                                                                 |
| `docsUrl`                   | Yes      | API documentation URL                                                                                |
| `auth.envVar`               | Yes      | Environment variable name for the API key                                                            |
| `auth.keyPrefix`            | No       | Key format pattern (e.g., `csk-`)                                                                    |
| `freeTier.type`             | Yes      | `perpetual`, `trial`, or `rate-limited`                                                              |
| `freeTier.limits`           | Yes      | Rate limits object (`rpm`, `rpd`, `tpd`, `tpm`, `rps`, `tokenMonthly`)                               |
| `freeTier.notes`            | No       | Free-text clarification of free tier details                                                         |
| `freeTier.credits`          | No       | Trial credit amount (e.g., `"$5"`)                                                                   |
| `freeTier.expiresAfterDays` | No       | Trial expiration in days                                                                             |
| `sdk.package`               | Yes      | npm package name                                                                                     |
| `sdk.type`                  | Yes      | `official`, `openai-compat`, or `community`                                                          |
| `sdk.baseUrl`               | No       | Base URL for openai-compat providers                                                                 |
| `rateLimitHeaders`          | No       | Header names for rate limit info (`remaining`, `reset`, `limit`, `format`)                           |
| `models`                    | Yes      | Array of model objects with `id`, `free`, `capabilities`, `tier`, `contextWindow`, `maxOutputTokens` |
| `notes`                     | No       | Array of free-text strings about provider quirks                                                     |
| `lastVerified`              | Yes      | ISO date of last verification (`YYYY-MM-DD`)                                                         |
| `verifiedBy`                | Yes      | `manual` or `automated`                                                                              |

See `schema.json` for the full JSON Schema definition with types and enums.

## Guidelines

- **Text LLMs only** -- no image generation, audio, or embedding providers
- **Free tier data only** -- do not add paid-only providers with no free tier
- **Verify data accuracy** before submitting -- outdated data is worse than no data
- **One provider per JSON file** -- the filename must match the `id` field
- **Include all required fields** -- run `node scripts/validate.js` to catch missing fields

## Freshness

The registry tracks data freshness using the `lastVerified` date:

| Status | Condition                            | Meaning                            |
| ------ | ------------------------------------ | ---------------------------------- |
| Green  | 30 days or less since `lastVerified` | Recently verified, data is current |
| Yellow | More than 30 days                    | May need re-verification           |
| Red    | More than 90 days                    | Likely outdated, needs update      |

PRs that only update `lastVerified` (and nothing else) after re-verifying the data are welcome. This helps keep the registry fresh even when nothing has changed.
