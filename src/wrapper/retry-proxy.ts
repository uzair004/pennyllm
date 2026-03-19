import type { LanguageModelV3 } from '@ai-sdk/provider';
import type { EventEmitter } from 'node:events';
import type { RouterConfig } from '../types/config.js';
import type { CooldownManager } from '../usage/cooldown.js';
import type { KeySelector } from '../selection/KeySelector.js';
import type { ProviderRegistry } from './provider-registry.js';
import { createProviderInstanceAsync } from './provider-registry.js';
import {
  classifyError,
  shouldRetry,
  buildFinalError,
  makeAttemptRecord,
} from './error-classifier.js';
import type { AttemptRecord } from './error-classifier.js';
import { RouterEvent } from '../constants/index.js';
import debugFactory from 'debug';

const debug = debugFactory('pennyllm:retry');

// ── Types ──────────────────────────────────────────────────────────

export interface RetryProxyOptions {
  provider: string;
  modelName: string;
  modelId: string; // "provider/model" format
  initialModel: LanguageModelV3;
  initialKeyIndex: number;
  initialKey: string;
  config: RouterConfig;
  registry: ProviderRegistry;
  cooldownManager: CooldownManager;
  disabledKeys: Set<string>; // Shared across router instance, format "provider:keyIndex"
  emitter: EventEmitter;
  requestId: string;
  keyIndexRef: { current: number }; // Mutable ref shared with middleware
  keySelector: KeySelector;
}

// ── Helpers ────────────────────────────────────────────────────────

function safeEmit(emitter: EventEmitter, event: string, payload: unknown): void {
  try {
    emitter.emit(event, payload);
  } catch {
    // Fire-and-forget: never let event emission break the retry loop
  }
}

function resolveEventName(errorType: string): string {
  switch (errorType) {
    case 'rate_limit':
      return RouterEvent.ERROR_RATE_LIMIT;
    case 'auth':
      return RouterEvent.ERROR_AUTH;
    case 'server':
      return RouterEvent.ERROR_SERVER;
    case 'network':
      return RouterEvent.ERROR_NETWORK;
    default:
      return RouterEvent.ERROR;
  }
}

interface ErrorEventPayload {
  provider: string;
  keyIndex: number;
  modelId: string;
  message: string;
  requestId: string;
  timestamp: number;
  statusCode?: number;
}

function buildErrorPayload(
  provider: string,
  keyIndex: number,
  modelId: string,
  classified: { message: string; statusCode?: number },
  requestId: string,
): ErrorEventPayload {
  const payload: ErrorEventPayload = {
    provider,
    keyIndex,
    modelId,
    message: classified.message,
    requestId,
    timestamp: Date.now(),
  };
  if (classified.statusCode !== undefined) {
    payload.statusCode = classified.statusCode;
  }
  return payload;
}

// ── createRetryProxy ───────────────────────────────────────────────

/**
 * Create a LanguageModelV3-compatible proxy that intercepts doGenerate/doStream,
 * catches provider errors, classifies them, and retries with different API keys.
 *
 * All params pass through unchanged to the underlying model, preserving
 * tool calling, structured output, and all AI SDK features.
 *
 * Only throws PennyLLMError subclasses (never APICallError) to prevent
 * AI SDK double-retry.
 */
export function createRetryProxy(options: RetryProxyOptions): LanguageModelV3 {
  const {
    provider,
    modelName,
    modelId,
    initialModel,
    initialKeyIndex,
    config,
    registry,
    cooldownManager,
    disabledKeys,
    emitter,
    requestId,
    keyIndexRef,
    keySelector,
  } = options;

  const proxy: LanguageModelV3 = {
    specificationVersion: 'v3' as const,
    provider: 'pennyllm',
    modelId,
    supportedUrls: initialModel.supportedUrls,

    async doGenerate(params) {
      const startTime = Date.now();
      const attempts: AttemptRecord[] = [];
      const triedKeys = new Set<number>();
      let currentModel = initialModel;
      let currentKeyIndex = initialKeyIndex;

      while (true) {
        triedKeys.add(currentKeyIndex);

        try {
          const result = await currentModel.doGenerate(params);

          // Success path
          cooldownManager.onSuccess(provider, currentKeyIndex);
          keyIndexRef.current = currentKeyIndex;

          // Emit request:complete (fire-and-forget)
          safeEmit(emitter, RouterEvent.REQUEST_COMPLETE, {
            provider,
            modelId,
            keyIndex: currentKeyIndex,
            requestId,
            promptTokens: Number(result.usage?.inputTokens?.total) || 0,
            completionTokens: Number(result.usage?.outputTokens?.total) || 0,
            latencyMs: Date.now() - startTime,
            retries: attempts.length,
            timestamp: Date.now(),
          });

          return result;
        } catch (error) {
          const classified = classifyError(error);
          const attempt = makeAttemptRecord(currentKeyIndex, classified);
          attempts.push(attempt);

          debug(
            'doGenerate attempt failed for %s key:%d — %s (status: %s)',
            provider,
            currentKeyIndex,
            classified.type,
            classified.statusCode ?? 'none',
          );

          // Emit per-attempt error event
          const eventName = resolveEventName(classified.type);
          safeEmit(
            emitter,
            eventName,
            buildErrorPayload(provider, currentKeyIndex, modelId, classified, requestId),
          );

          // Handle key state
          if (classified.type === 'rate_limit') {
            cooldownManager.setCooldown(provider, currentKeyIndex, classified.retryAfter);
          }
          if (classified.type === 'auth') {
            disabledKeys.add(`${provider}:${currentKeyIndex}`);
            safeEmit(emitter, RouterEvent.KEY_DISABLED, {
              provider,
              keyIndex: currentKeyIndex,
              reason: 'auth_failed',
              statusCode: classified.statusCode,
              timestamp: Date.now(),
            });
            debug('Key %s:%d disabled (auth failure)', provider, currentKeyIndex);
          }

          // Check retry eligibility
          if (!shouldRetry(classified, triedKeys)) {
            debug(
              'No retry for %s key:%d — type=%s, tried=%d keys',
              provider,
              currentKeyIndex,
              classified.type,
              triedKeys.size,
            );
            throw buildFinalError(provider, modelId, classified, attempts, error);
          }

          // Get next key via re-selection
          const nextKey = await getNextKey(
            keySelector,
            provider,
            modelName,
            requestId,
            triedKeys,
            disabledKeys,
            config,
            registry,
          );

          if (nextKey === null) {
            debug('No more keys available for %s after %d attempts', provider, attempts.length);
            throw buildFinalError(provider, modelId, classified, attempts, error);
          }

          // Emit key:retried event
          const maxAttempts = config.providers[provider]?.keys.length ?? 0;
          safeEmit(emitter, RouterEvent.KEY_RETRIED, {
            provider,
            modelId,
            failedKeyIndex: currentKeyIndex,
            newKeyIndex: nextKey.keyIndex,
            reason: classified.type,
            attempt: attempts.length,
            maxAttempts,
            requestId,
            timestamp: Date.now(),
          });

          debug(
            'Retrying %s with key:%d (was key:%d, attempt %d/%d)',
            provider,
            nextKey.keyIndex,
            currentKeyIndex,
            attempts.length,
            maxAttempts,
          );

          // Update for next iteration
          currentModel = nextKey.model;
          currentKeyIndex = nextKey.keyIndex;
        }
      }
    },

    async doStream(params) {
      const startTime = Date.now();
      const attempts: AttemptRecord[] = [];
      const triedKeys = new Set<number>();
      let currentModel = initialModel;
      let currentKeyIndex = initialKeyIndex;

      while (true) {
        triedKeys.add(currentKeyIndex);

        try {
          // Retry only on setup phase (the doStream() call itself)
          const result = await currentModel.doStream(params);

          // Setup succeeded — return immediately, no mid-stream retry
          cooldownManager.onSuccess(provider, currentKeyIndex);
          keyIndexRef.current = currentKeyIndex;

          // Emit request:complete for setup only (actual usage tracked by middleware)
          safeEmit(emitter, RouterEvent.REQUEST_COMPLETE, {
            provider,
            modelId,
            keyIndex: currentKeyIndex,
            requestId,
            promptTokens: 0,
            completionTokens: 0,
            latencyMs: Date.now() - startTime,
            retries: attempts.length,
            timestamp: Date.now(),
          });

          return result;
        } catch (error) {
          const classified = classifyError(error);
          const attempt = makeAttemptRecord(currentKeyIndex, classified);
          attempts.push(attempt);

          debug(
            'doStream setup failed for %s key:%d — %s (status: %s)',
            provider,
            currentKeyIndex,
            classified.type,
            classified.statusCode ?? 'none',
          );

          // Emit per-attempt error event
          const eventName = resolveEventName(classified.type);
          safeEmit(
            emitter,
            eventName,
            buildErrorPayload(provider, currentKeyIndex, modelId, classified, requestId),
          );

          // Handle key state
          if (classified.type === 'rate_limit') {
            cooldownManager.setCooldown(provider, currentKeyIndex, classified.retryAfter);
          }
          if (classified.type === 'auth') {
            disabledKeys.add(`${provider}:${currentKeyIndex}`);
            safeEmit(emitter, RouterEvent.KEY_DISABLED, {
              provider,
              keyIndex: currentKeyIndex,
              reason: 'auth_failed',
              statusCode: classified.statusCode,
              timestamp: Date.now(),
            });
            debug('Key %s:%d disabled (auth failure)', provider, currentKeyIndex);
          }

          // Check retry eligibility
          if (!shouldRetry(classified, triedKeys)) {
            debug(
              'No retry for %s key:%d — type=%s, tried=%d keys',
              provider,
              currentKeyIndex,
              classified.type,
              triedKeys.size,
            );
            throw buildFinalError(provider, modelId, classified, attempts, error);
          }

          // Get next key via re-selection
          const nextKey = await getNextKey(
            keySelector,
            provider,
            modelName,
            requestId,
            triedKeys,
            disabledKeys,
            config,
            registry,
          );

          if (nextKey === null) {
            debug('No more keys available for %s after %d attempts', provider, attempts.length);
            throw buildFinalError(provider, modelId, classified, attempts, error);
          }

          // Emit key:retried event
          const maxAttempts = config.providers[provider]?.keys.length ?? 0;
          safeEmit(emitter, RouterEvent.KEY_RETRIED, {
            provider,
            modelId,
            failedKeyIndex: currentKeyIndex,
            newKeyIndex: nextKey.keyIndex,
            reason: classified.type,
            attempt: attempts.length,
            maxAttempts,
            requestId,
            timestamp: Date.now(),
          });

          debug(
            'Retrying stream %s with key:%d (was key:%d, attempt %d/%d)',
            provider,
            nextKey.keyIndex,
            currentKeyIndex,
            attempts.length,
            maxAttempts,
          );

          // Update for next iteration
          currentModel = nextKey.model;
          currentKeyIndex = nextKey.keyIndex;
        }
      }
    },
  };

  return proxy;
}

// ── getNextKey ─────────────────────────────────────────────────────

/**
 * Attempt to select the next available key for retry.
 * Returns null if no untried, non-disabled key is available.
 */
async function getNextKey(
  keySelector: KeySelector,
  provider: string,
  modelName: string,
  requestId: string,
  triedKeys: Set<number>,
  disabledKeys: Set<string>,
  config: RouterConfig,
  registry: ProviderRegistry,
): Promise<{ keyIndex: number; model: LanguageModelV3 } | null> {
  try {
    const result = await keySelector.selectKey(provider, modelName, { requestId });

    // Check if the selected key has already been tried or is disabled
    if (triedKeys.has(result.keyIndex) || disabledKeys.has(`${provider}:${result.keyIndex}`)) {
      debug(
        'selectKey returned already-tried or disabled key %s:%d, no keys left',
        provider,
        result.keyIndex,
      );
      return null;
    }

    // Resolve the actual API key string
    const providerConfig = config.providers[provider];
    if (!providerConfig) {
      debug('Provider %s not found in config during retry', provider);
      return null;
    }

    const keyConfig = providerConfig.keys[result.keyIndex];
    if (keyConfig === undefined) {
      debug('Key index %d not found for provider %s during retry', result.keyIndex, provider);
      return null;
    }

    const apiKey = typeof keyConfig === 'string' ? keyConfig : keyConfig.key;
    const model = await createProviderInstanceAsync(registry, provider, modelName, apiKey);

    return { keyIndex: result.keyIndex, model };
  } catch (err) {
    // Key selection itself failed (all keys exhausted, etc.)
    debug(
      'Key re-selection failed for %s: %s',
      provider,
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}
