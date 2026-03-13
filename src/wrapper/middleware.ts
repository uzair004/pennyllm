import type { LanguageModelV1Middleware, LanguageModelV1StreamPart } from 'ai';
import type { UsageTracker } from '../usage/UsageTracker.js';
import debugFactory from 'debug';

const debug = debugFactory('llm-router:middleware');

/**
 * Create middleware that tracks usage for both generate and stream calls
 */
export function createRouterMiddleware(options: {
  provider: string;
  keyIndex: number;
  model: string;
  tracker: UsageTracker;
  requestId: string;
}): LanguageModelV1Middleware {
  const { provider, keyIndex, tracker, requestId } = options;

  return {
    wrapGenerate: async ({ doGenerate }) => {
      // Call the original generate function
      const result = await doGenerate();

      // Extract usage from result (guard against undefined/NaN from providers)
      const usage = result.usage;
      const promptTokens = Number(usage?.promptTokens) || 0;
      const completionTokens = Number(usage?.completionTokens) || 0;

      // Fire-and-forget record
      tracker
        .record(
          provider,
          keyIndex,
          {
            promptTokens,
            completionTokens,
          },
          requestId,
          null,
        )
        .catch((err) =>
          debug('Usage recording failed: %s', err instanceof Error ? err.message : String(err)),
        );

      return result;
    },

    wrapStream: async ({ doStream }) => {
      // Call the original stream function
      const result = await doStream();

      // Create a transform stream that intercepts the finish chunk
      const transform = new TransformStream<LanguageModelV1StreamPart, LanguageModelV1StreamPart>({
        transform(chunk, controller) {
          // Pass every chunk through unmodified
          controller.enqueue(chunk);

          // When we see the 'finish' chunk, extract usage and record it
          if (chunk.type === 'finish') {
            const usage = chunk.usage;

            tracker
              .record(
                provider,
                keyIndex,
                {
                  promptTokens: Number(usage?.promptTokens) || 0,
                  completionTokens: Number(usage?.completionTokens) || 0,
                },
                requestId,
                null,
              )
              .catch((err) =>
                debug(
                  'Stream usage recording failed: %s',
                  err instanceof Error ? err.message : String(err),
                ),
              );
          }
        },
      });

      // Pipe the original stream through the transform
      const transformedStream = result.stream.pipeThrough(transform);

      // Return the result with the transformed stream
      return { ...result, stream: transformedStream };
    },
  };
}
