import type { LanguageModelV3Middleware, LanguageModelV3StreamPart } from '@ai-sdk/provider';
import type { UsageTracker } from '../usage/UsageTracker.js';
import debugFactory from 'debug';

const debug = debugFactory('llm-router:middleware');

/**
 * Create middleware that tracks usage for both generate and stream calls.
 * Uses mutable refs so the retry proxy and fallback proxy can update which
 * provider/key actually succeeded, ensuring usage is recorded correctly.
 */
export function createRouterMiddleware(options: {
  providerRef: { current: string };
  keyIndexRef: { current: number };
  modelIdRef: { current: string };
  tracker: UsageTracker;
  requestId: string;
  dryRun: boolean;
}): LanguageModelV3Middleware {
  const { providerRef, keyIndexRef, tracker, requestId } = options;

  return {
    specificationVersion: 'v3',

    wrapGenerate: async ({ doGenerate }) => {
      // Dry-run mode: return mock result without calling the provider
      if (options.dryRun) {
        debug('Dry-run mode: returning mock generate result');
        return {
          content: [
            {
              type: 'text' as const,
              text: `[DRY RUN] Request would route to ${providerRef.current} key ${keyIndexRef.current}`,
            },
          ],
          finishReason: { unified: 'stop' as const, raw: 'dry-run' },
          usage: {
            inputTokens: {
              total: 0,
              noCache: undefined,
              cacheRead: undefined,
              cacheWrite: undefined,
            },
            outputTokens: { total: 0, text: undefined, reasoning: undefined },
          },
          response: {
            id: `dry-run-${requestId}`,
            modelId: options.modelIdRef.current,
            timestamp: new Date(),
          },
          warnings: [],
        };
      }

      // Call the original generate function
      const result = await doGenerate();

      // Extract usage from result (guard against undefined/NaN from providers)
      const usage = result.usage;
      const promptTokens = Number(usage?.inputTokens?.total) || 0;
      const completionTokens = Number(usage?.outputTokens?.total) || 0;

      // Fire-and-forget record (refs reflect the provider/key that actually succeeded after fallback)
      tracker
        .record(
          providerRef.current,
          keyIndexRef.current,
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
      // Dry-run mode: return mock stream that immediately completes
      if (options.dryRun) {
        debug('Dry-run mode: returning mock stream result');
        const mockStream = new ReadableStream<LanguageModelV3StreamPart>({
          start(controller) {
            controller.enqueue({
              type: 'stream-start',
              warnings: [],
            });
            controller.enqueue({
              type: 'text-start',
              id: 'dry-run-text',
            });
            controller.enqueue({
              type: 'text-delta',
              id: 'dry-run-text',
              delta: `[DRY RUN] Request would route to ${providerRef.current}`,
            });
            controller.enqueue({
              type: 'text-end',
              id: 'dry-run-text',
            });
            controller.enqueue({
              type: 'finish',
              finishReason: { unified: 'stop' as const, raw: 'dry-run' },
              usage: {
                inputTokens: {
                  total: 0,
                  noCache: undefined,
                  cacheRead: undefined,
                  cacheWrite: undefined,
                },
                outputTokens: { total: 0, text: undefined, reasoning: undefined },
              },
            });
            controller.close();
          },
        });
        return { stream: mockStream };
      }

      // Call the original stream function
      const result = await doStream();

      // Create a transform stream that intercepts the finish chunk
      const transform = new TransformStream<LanguageModelV3StreamPart, LanguageModelV3StreamPart>({
        transform(chunk, controller) {
          // Pass every chunk through unmodified
          controller.enqueue(chunk);

          // When we see the 'finish' chunk, extract usage and record it
          if (chunk.type === 'finish') {
            const usage = chunk.usage;

            tracker
              .record(
                providerRef.current,
                keyIndexRef.current,
                {
                  promptTokens: Number(usage?.inputTokens?.total) || 0,
                  completionTokens: Number(usage?.outputTokens?.total) || 0,
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
