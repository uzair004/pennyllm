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

  return files.map((f) => JSON.parse(fs.readFileSync(path.join(PROVIDERS_DIR, f), 'utf8')));
}

function freshnessBadge(lastVerified) {
  const days = Math.floor((Date.now() - new Date(lastVerified).getTime()) / 86400000);
  if (days <= 30) return '\u{1F7E2}'; // green circle
  if (days <= 90) return '\u{1F7E1}'; // yellow circle
  return '\u{1F534}'; // red circle
}

function formatDailyLimit(limits) {
  if (!limits) return '-';
  if (limits.rpd) return `${limits.rpd.toLocaleString()} RPD`;
  if (limits.tpd) return `${limits.tpd.toLocaleString()} TPD`;
  return '-';
}

function formatNumber(n) {
  if (n === undefined || n === null) return '-';
  if (n >= 1000000) return `${(n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`;
  return String(n);
}

function generateComparisonTable(providers) {
  const lines = [];
  lines.push('| Provider | Free Tier Type | RPM | Daily Limit | SDK Package | Freshness |');
  lines.push('| --- | --- | --- | --- | --- | --- |');

  for (const p of providers) {
    const name = `[${p.name}](${p.signupUrl})`;
    const type = p.freeTier.type;
    const rpm =
      p.freeTier.limits.rpm || p.freeTier.limits.rps
        ? `${p.freeTier.limits.rps || ''} RPS`.trim()
        : '-';
    const rpmDisplay = p.freeTier.limits.rpm
      ? String(p.freeTier.limits.rpm)
      : rpm !== '-'
        ? rpm
        : '-';
    const daily = formatDailyLimit(p.freeTier.limits);
    const sdk = `\`${p.sdk.package}\``;
    const badge = freshnessBadge(p.lastVerified);

    lines.push(`| ${name} | ${type} | ${rpmDisplay} | ${daily} | ${sdk} | ${badge} |`);
  }

  return lines.join('\n');
}

function generateProviderSection(p) {
  const lines = [];
  lines.push(`## ${p.name}`);
  lines.push('');
  lines.push(
    `**Status:** ${p.status} | **Last verified:** ${p.lastVerified} ${freshnessBadge(p.lastVerified)}`,
  );
  lines.push('');

  // Auth
  lines.push('### Authentication');
  lines.push('');
  lines.push(`- **Env var:** \`${p.auth.envVar}\``);
  if (p.auth.keyPrefix) lines.push(`- **Key prefix:** \`${p.auth.keyPrefix}\``);
  if (p.auth.header) lines.push(`- **Header:** \`${p.auth.header}\``);
  lines.push('');

  // Free tier
  lines.push('### Free Tier');
  lines.push('');
  lines.push(`- **Type:** ${p.freeTier.type}`);
  if (p.freeTier.credits) lines.push(`- **Credits:** ${p.freeTier.credits}`);
  if (p.freeTier.expiresAfterDays) lines.push(`- **Expires:** ${p.freeTier.expiresAfterDays} days`);
  const limitEntries = Object.entries(p.freeTier.limits);
  if (limitEntries.length > 0) {
    lines.push('- **Limits:**');
    for (const [key, value] of limitEntries) {
      lines.push(`  - ${key}: ${formatNumber(value)}`);
    }
  }
  if (p.freeTier.notes) lines.push(`- **Notes:** ${p.freeTier.notes}`);
  lines.push('');

  // SDK
  lines.push('### SDK');
  lines.push('');
  lines.push(`- **Package:** \`${p.sdk.package}\``);
  lines.push(`- **Type:** ${p.sdk.type}`);
  if (p.sdk.baseUrl) lines.push(`- **Base URL:** \`${p.sdk.baseUrl}\``);
  lines.push('');

  // Models table
  lines.push('### Models');
  lines.push('');
  lines.push('| Model ID | Free | Tier | Capabilities | Context Window | Max Output |');
  lines.push('| --- | --- | --- | --- | --- | --- |');
  for (const m of p.models) {
    const caps = m.capabilities.length > 0 ? m.capabilities.join(', ') : '-';
    lines.push(
      `| \`${m.id}\` | ${m.free ? 'Yes' : 'No'} | ${m.tier} | ${caps} | ${formatNumber(m.contextWindow)} | ${formatNumber(m.maxOutputTokens)} |`,
    );
  }
  lines.push('');

  // Rate limit headers
  if (p.rateLimitHeaders) {
    lines.push('### Rate Limit Headers');
    lines.push('');
    if (p.rateLimitHeaders.remaining)
      lines.push(`- **Remaining:** \`${p.rateLimitHeaders.remaining}\``);
    if (p.rateLimitHeaders.reset) lines.push(`- **Reset:** \`${p.rateLimitHeaders.reset}\``);
    if (p.rateLimitHeaders.limit) lines.push(`- **Limit:** \`${p.rateLimitHeaders.limit}\``);
    if (p.rateLimitHeaders.format) lines.push(`- **Format:** ${p.rateLimitHeaders.format}`);
    lines.push('');
  }

  // Notes
  if (p.notes && p.notes.length > 0) {
    lines.push('### Notes');
    lines.push('');
    for (const note of p.notes) {
      lines.push(`- ${note}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function generateReadme(providers) {
  const lines = [];

  // Header
  lines.push('# Awesome Free LLM APIs');
  lines.push('');
  lines.push('> A community-maintained registry of free tier LLM API providers.');
  lines.push(`> ${providers.length} providers | Machine-readable JSON | Auto-generated`);
  lines.push('');

  // Freshness legend
  lines.push(
    '**Freshness:** \u{1F7E2} Verified <=30 days | \u{1F7E1} Verified >30 days | \u{1F534} Verified >90 days',
  );
  lines.push('');

  // Comparison table
  if (providers.length > 0) {
    lines.push(generateComparisonTable(providers));
    lines.push('');
  }

  // Per-provider sections
  for (const p of providers) {
    lines.push(generateProviderSection(p));
  }

  // Usage examples
  lines.push('## Usage');
  lines.push('');
  lines.push('### Fetch the registry');
  lines.push('');
  lines.push('```js');
  lines.push(
    "const response = await fetch('https://raw.githubusercontent.com/user/awesome-free-llm-apis/main/registry.json');",
  );
  lines.push('const registry = await response.json();');
  lines.push('console.log(`${registry.providerCount} providers available`);');
  lines.push('```');
  lines.push('');

  lines.push('### Filter free models from a provider');
  lines.push('');
  lines.push('```js');
  lines.push("const provider = registry.providers['cerebras'];");
  lines.push('const freeModels = provider.models.filter(m => m.free);');
  lines.push('console.log(freeModels.map(m => m.id));');
  lines.push('```');
  lines.push('');

  lines.push('### Find providers with reasoning models');
  lines.push('');
  lines.push('```js');
  lines.push('const reasoningProviders = Object.values(registry.providers)');
  lines.push("  .filter(p => p.models.some(m => m.capabilities.includes('reasoning')));");
  lines.push('console.log(reasoningProviders.map(p => p.name));');
  lines.push('```');
  lines.push('');

  // Contributing
  lines.push('## Contributing');
  lines.push('');
  lines.push('See [CONTRIBUTING.md](CONTRIBUTING.md) for how to add or update a provider.');
  lines.push('');

  // Footer
  lines.push('---');
  lines.push('');
  lines.push(
    `Generated by [generate.js](scripts/generate.js) on ${new Date().toISOString().split('T')[0]}. Do not edit manually.`,
  );
  lines.push('');

  return lines.join('\n');
}

function generateRegistry(providers) {
  const providersObj = {};
  for (const p of providers) {
    providersObj[p.id] = p;
  }
  return {
    $schema: './schema.json',
    version: new Date().toISOString().slice(0, 7),
    generatedAt: new Date().toISOString(),
    providerCount: providers.length,
    providers: providersObj,
  };
}

// Main
function main() {
  const args = process.argv.slice(2);
  const checkMode = args.includes('--check');

  const providers = loadProviders();

  const readmeContent = generateReadme(providers);
  const registryContent = JSON.stringify(generateRegistry(providers), null, 2) + '\n';

  if (checkMode) {
    let mismatch = false;

    if (fs.existsSync(README_PATH)) {
      const existing = fs.readFileSync(README_PATH, 'utf8');
      if (existing !== readmeContent) {
        console.error('README.md is out of date. Run `node scripts/generate.js` to regenerate.');
        mismatch = true;
      }
    } else {
      console.error('README.md does not exist. Run `node scripts/generate.js` to generate.');
      mismatch = true;
    }

    if (fs.existsSync(REGISTRY_PATH)) {
      const existing = fs.readFileSync(REGISTRY_PATH, 'utf8');
      // Compare without generatedAt (timestamp changes each run)
      const existingParsed = JSON.parse(existing);
      const generatedParsed = JSON.parse(registryContent);
      existingParsed.generatedAt = '';
      generatedParsed.generatedAt = '';
      if (JSON.stringify(existingParsed) !== JSON.stringify(generatedParsed)) {
        console.error(
          'registry.json is out of date. Run `node scripts/generate.js` to regenerate.',
        );
        mismatch = true;
      }
    } else {
      console.error('registry.json does not exist. Run `node scripts/generate.js` to generate.');
      mismatch = true;
    }

    if (mismatch) {
      process.exit(1);
    } else {
      console.log('README.md and registry.json are up to date.');
      process.exit(0);
    }
  }

  fs.writeFileSync(README_PATH, readmeContent, 'utf8');
  fs.writeFileSync(REGISTRY_PATH, registryContent, 'utf8');
  console.log(`Generated README.md and registry.json (${providers.length} providers)`);
}

main();
