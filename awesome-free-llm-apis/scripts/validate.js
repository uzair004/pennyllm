'use strict';

const fs = require('node:fs');
const path = require('node:path');

const PROVIDERS_DIR = path.join(__dirname, '..', 'providers');

const VALID_STATUS = ['active', 'degraded', 'discontinued'];
const VALID_FREE_TIER_TYPE = ['perpetual', 'trial', 'rate-limited'];
const VALID_SDK_TYPE = ['official', 'openai-compat', 'community'];
const VALID_CAPABILITIES = ['reasoning', 'vision', 'tools', 'structuredOutput'];
const VALID_TIERS = ['frontier', 'high', 'mid', 'small'];
const VALID_HEADER_FORMAT = ['seconds', 'epoch', 'iso'];
const VALID_VERIFIED_BY = ['manual', 'automated'];
const VALID_LIMIT_KEYS = ['rpm', 'rpd', 'tpd', 'tpm', 'rps', 'tokenMonthly'];

function validateProvider(filePath) {
  const errors = [];
  const warnings = [];
  const fileName = path.basename(filePath, '.json');
  let data;

  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return { errors: [{ field: '(file)', error: `Invalid JSON: ${e.message}` }], warnings: [] };
  }

  // Required string fields
  for (const field of ['id', 'name', 'status', 'signupUrl', 'docsUrl', 'lastVerified']) {
    if (typeof data[field] !== 'string' || data[field].length === 0) {
      errors.push({ field, error: 'Required string field missing or empty' });
    }
  }

  // id must match filename
  if (typeof data.id === 'string' && data.id !== fileName) {
    errors.push({
      field: 'id',
      error: `Must match filename: expected "${fileName}", got "${data.id}"`,
    });
  }

  // status enum
  if (typeof data.status === 'string' && !VALID_STATUS.includes(data.status)) {
    errors.push({ field: 'status', error: `Must be one of: ${VALID_STATUS.join(', ')}` });
  }

  // URL fields
  for (const field of ['signupUrl', 'docsUrl']) {
    if (typeof data[field] === 'string' && !data[field].startsWith('https://')) {
      errors.push({ field, error: 'Must start with https://' });
    }
  }

  // lastVerified date pattern
  if (typeof data.lastVerified === 'string' && !/^\d{4}-\d{2}-\d{2}$/.test(data.lastVerified)) {
    errors.push({ field: 'lastVerified', error: 'Must match pattern YYYY-MM-DD' });
  }

  // verifiedBy enum
  if (data.verifiedBy === undefined || data.verifiedBy === null) {
    errors.push({ field: 'verifiedBy', error: 'Required field missing' });
  } else if (!VALID_VERIFIED_BY.includes(data.verifiedBy)) {
    errors.push({ field: 'verifiedBy', error: `Must be one of: ${VALID_VERIFIED_BY.join(', ')}` });
  }

  // auth object
  if (data.auth === undefined || data.auth === null || typeof data.auth !== 'object') {
    errors.push({ field: 'auth', error: 'Required object missing' });
  } else {
    if (typeof data.auth.envVar !== 'string' || data.auth.envVar.length === 0) {
      errors.push({ field: 'auth.envVar', error: 'Required non-empty string' });
    }
  }

  // freeTier object
  if (data.freeTier === undefined || data.freeTier === null || typeof data.freeTier !== 'object') {
    errors.push({ field: 'freeTier', error: 'Required object missing' });
  } else {
    if (!VALID_FREE_TIER_TYPE.includes(data.freeTier.type)) {
      errors.push({
        field: 'freeTier.type',
        error: `Must be one of: ${VALID_FREE_TIER_TYPE.join(', ')}`,
      });
    }
    if (
      data.freeTier.limits === undefined ||
      data.freeTier.limits === null ||
      typeof data.freeTier.limits !== 'object'
    ) {
      errors.push({ field: 'freeTier.limits', error: 'Required object missing' });
    } else {
      for (const [key, value] of Object.entries(data.freeTier.limits)) {
        if (!VALID_LIMIT_KEYS.includes(key)) {
          errors.push({
            field: `freeTier.limits.${key}`,
            error: `Unknown limit key. Allowed: ${VALID_LIMIT_KEYS.join(', ')}`,
          });
        } else if (typeof value !== 'number') {
          errors.push({ field: `freeTier.limits.${key}`, error: 'Must be a number' });
        }
      }
    }

    // Conditional: trial fields
    if (data.freeTier.type === 'trial') {
      if (typeof data.freeTier.credits !== 'string') {
        warnings.push({
          field: 'freeTier.credits',
          warning: 'Recommended for trial tier (string, e.g., "$5")',
        });
      }
      if (typeof data.freeTier.expiresAfterDays !== 'number') {
        warnings.push({
          field: 'freeTier.expiresAfterDays',
          warning: 'Recommended for trial tier (number of days)',
        });
      }
    }
  }

  // sdk object
  if (data.sdk === undefined || data.sdk === null || typeof data.sdk !== 'object') {
    errors.push({ field: 'sdk', error: 'Required object missing' });
  } else {
    if (typeof data.sdk.package !== 'string' || data.sdk.package.length === 0) {
      errors.push({ field: 'sdk.package', error: 'Required non-empty string' });
    }
    if (!VALID_SDK_TYPE.includes(data.sdk.type)) {
      errors.push({ field: 'sdk.type', error: `Must be one of: ${VALID_SDK_TYPE.join(', ')}` });
    }
    // Conditional: openai-compat must have baseUrl
    if (data.sdk.type === 'openai-compat') {
      if (typeof data.sdk.baseUrl !== 'string' || !data.sdk.baseUrl.startsWith('https://')) {
        errors.push({
          field: 'sdk.baseUrl',
          error: 'Required for openai-compat SDK type, must start with https://',
        });
      }
    }
  }

  // models array
  if (!Array.isArray(data.models)) {
    errors.push({ field: 'models', error: 'Required array missing' });
  } else if (data.models.length === 0) {
    errors.push({ field: 'models', error: 'Must contain at least one model' });
  } else {
    for (let i = 0; i < data.models.length; i++) {
      const model = data.models[i];
      const prefix = `models[${i}]`;

      if (typeof model.id !== 'string' || model.id.length === 0) {
        errors.push({ field: `${prefix}.id`, error: 'Required non-empty string' });
      }
      if (typeof model.free !== 'boolean') {
        errors.push({ field: `${prefix}.free`, error: 'Required boolean' });
      }
      if (!Array.isArray(model.capabilities)) {
        errors.push({ field: `${prefix}.capabilities`, error: 'Required array' });
      } else {
        for (const cap of model.capabilities) {
          if (!VALID_CAPABILITIES.includes(cap)) {
            errors.push({
              field: `${prefix}.capabilities`,
              error: `Invalid capability "${cap}". Must be one of: ${VALID_CAPABILITIES.join(', ')}`,
            });
          }
        }
      }
      if (!VALID_TIERS.includes(model.tier)) {
        errors.push({
          field: `${prefix}.tier`,
          error: `Must be one of: ${VALID_TIERS.join(', ')}`,
        });
      }
      if (typeof model.contextWindow !== 'number' || model.contextWindow < 0) {
        errors.push({ field: `${prefix}.contextWindow`, error: 'Required positive number' });
      }
      if (typeof model.maxOutputTokens !== 'number' || model.maxOutputTokens < 0) {
        errors.push({ field: `${prefix}.maxOutputTokens`, error: 'Required positive number' });
      }

      // Optional per-model limits
      if (model.limits !== undefined) {
        if (typeof model.limits !== 'object' || model.limits === null) {
          errors.push({ field: `${prefix}.limits`, error: 'Must be an object when present' });
        } else {
          for (const [key, value] of Object.entries(model.limits)) {
            if (!VALID_LIMIT_KEYS.includes(key)) {
              errors.push({
                field: `${prefix}.limits.${key}`,
                error: `Unknown limit key. Allowed: ${VALID_LIMIT_KEYS.join(', ')}`,
              });
            } else if (typeof value !== 'number') {
              errors.push({ field: `${prefix}.limits.${key}`, error: 'Must be a number' });
            }
          }
        }
      }
    }
  }

  // notes array (optional)
  if (data.notes !== undefined) {
    if (!Array.isArray(data.notes)) {
      errors.push({ field: 'notes', error: 'Must be an array of strings when present' });
    } else {
      for (let i = 0; i < data.notes.length; i++) {
        if (typeof data.notes[i] !== 'string') {
          errors.push({ field: `notes[${i}]`, error: 'Must be a string' });
        }
      }
    }
  }

  // rateLimitHeaders (optional)
  if (data.rateLimitHeaders !== undefined) {
    if (typeof data.rateLimitHeaders !== 'object' || data.rateLimitHeaders === null) {
      errors.push({ field: 'rateLimitHeaders', error: 'Must be an object when present' });
    } else {
      for (const field of ['remaining', 'reset', 'limit']) {
        if (
          data.rateLimitHeaders[field] !== undefined &&
          typeof data.rateLimitHeaders[field] !== 'string'
        ) {
          errors.push({
            field: `rateLimitHeaders.${field}`,
            error: 'Must be a string when present',
          });
        }
      }
      if (
        data.rateLimitHeaders.format !== undefined &&
        !VALID_HEADER_FORMAT.includes(data.rateLimitHeaders.format)
      ) {
        errors.push({
          field: 'rateLimitHeaders.format',
          error: `Must be one of: ${VALID_HEADER_FORMAT.join(', ')}`,
        });
      }
    }
  }

  return { errors, warnings };
}

// Main
function main() {
  const args = process.argv.slice(2);
  let filesToValidate;

  if (args.length > 0) {
    // Single file mode
    const filePath = path.resolve(args[0]);
    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      process.exit(1);
    }
    filesToValidate = [filePath];
  } else {
    // All providers mode
    const allFiles = fs
      .readdirSync(PROVIDERS_DIR)
      .filter((f) => f.endsWith('.json') && !f.startsWith('_'));

    filesToValidate = allFiles.map((f) => path.join(PROVIDERS_DIR, f));
  }

  if (filesToValidate.length === 0) {
    console.log('No provider files to validate.');
    console.log('\n0 files validated, 0 errors');
    process.exit(0);
  }

  let totalErrors = 0;

  for (const filePath of filesToValidate) {
    const fileName = path.basename(filePath);
    const { errors, warnings } = validateProvider(filePath);

    if (errors.length > 0) {
      totalErrors += errors.length;
      console.log(`  ${fileName}: FAILED`);
      for (const err of errors) {
        console.log(`    - ${err.field}: ${err.error}`);
      }
    } else {
      console.log(`  ${fileName}: OK`);
    }

    for (const warn of warnings) {
      console.log(`    [warn] ${warn.field}: ${warn.warning}`);
    }
  }

  console.log(`\n${filesToValidate.length} files validated, ${totalErrors} errors`);
  process.exit(totalErrors > 0 ? 1 : 0);
}

main();
