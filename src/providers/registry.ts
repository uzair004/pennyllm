import type { EventEmitter } from 'node:events';
import type { ProviderModule } from './types.js';
import { cerebrasProvider } from './cerebras.js';
import { googleProvider } from './google.js';
import { groqProvider } from './groq.js';
import { sambanovaProvider } from './sambanova.js';
import { nvidiaNimProvider } from './nvidia-nim.js';
import { mistralProvider } from './mistral.js';

// GitHub Models dropped — doesn't offer meaningful free-tier value
const ALL_PROVIDERS: readonly ProviderModule[] = [
  cerebrasProvider,
  googleProvider,
  groqProvider,
  sambanovaProvider,
  nvidiaNimProvider,
  mistralProvider,
];

const PROVIDER_MAP = new Map<string, ProviderModule>(ALL_PROVIDERS.map((p) => [p.id, p]));

export function getAllProviders(): readonly ProviderModule[] {
  return ALL_PROVIDERS;
}

export function getProviderModule(id: string): ProviderModule | undefined {
  return PROVIDER_MAP.get(id);
}

/**
 * Check staleness for all configured providers.
 * Emits 'provider:stale' if a provider's lastVerified date is older than 30 days.
 */
export function checkProviderStaleness(configuredProviders: string[], emitter: EventEmitter): void {
  const STALE_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  for (const id of configuredProviders) {
    const mod = PROVIDER_MAP.get(id);
    if (!mod) continue;
    const verifiedDate = new Date(mod.lastVerified).getTime();
    const ageMs = now - verifiedDate;
    if (ageMs > STALE_THRESHOLD_MS) {
      emitter.emit('provider:stale', {
        provider: id,
        lastVerified: mod.lastVerified,
        daysSinceVerified: Math.floor(ageMs / (24 * 60 * 60 * 1000)),
        updateUrl: mod.updateUrl,
      });
    }
  }
}
