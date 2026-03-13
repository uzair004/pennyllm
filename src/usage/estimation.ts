import debug from 'debug';
import type { EstimationConfig, EstimationResult } from './types.js';

const log = debug('llm-router:usage');

/**
 * Default character-to-token ratio estimator (~4 chars per token)
 */
export function defaultCharRatioEstimator(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Estimate token usage for an LLM request
 * Returns null on any error (graceful degradation)
 */
export function estimateTokens(
  messages: Array<{ role: string; content: unknown }>,
  options: { system?: string; tools?: unknown[]; maxTokens?: number },
  config: EstimationConfig,
): EstimationResult | null {
  try {
    // Use custom estimator or default
    const estimator = config.tokenEstimator ?? defaultCharRatioEstimator;

    // Concatenate all text content from messages
    let promptText = '';

    for (const message of messages) {
      if (typeof message.content === 'string') {
        promptText += message.content;
      }
      // Skip non-string content (images, files, etc.)
    }

    // Add system prompt if present
    if (options.system) {
      promptText += options.system;
    }

    // Add tools if present
    if (options.tools && Array.isArray(options.tools)) {
      promptText += JSON.stringify(options.tools);
    }

    // Estimate prompt tokens
    const promptTokens = estimator(promptText);

    // Estimate completion tokens
    const completionTokens = options.maxTokens ?? config.defaultMaxTokens;

    return {
      prompt: promptTokens,
      completion: completionTokens,
    };
  } catch (error) {
    // Silently return null on any error
    log('Token estimation failed: %s', error instanceof Error ? error.message : String(error));
    return null;
  }
}
