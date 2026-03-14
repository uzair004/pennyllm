import type { Router } from '../config/index.js';

const PREFIX = '[llm-router]';

/**
 * Structured debug logger that subscribes to router observability hooks
 * and prints one-line summaries to stdout.
 *
 * Enabled via `debug: true` in config or `DEBUG=llm-router:*` env var.
 * Plain text output -- no colors, no dependencies.
 */
export class DebugLogger {
  private unsubscribers: Array<() => void> = [];

  /**
   * Subscribe to all router hooks and log structured summaries to stdout.
   */
  attach(router: Router): void {
    this.unsubscribers.push(
      router.onKeySelected((e) => {
        const model = e.model ? `/${e.model}` : '';
        console.log(
          `${PREFIX} ${e.provider}${model} -> key#${e.keyIndex} (${e.strategy}, ${e.reason})`,
        );
      }),
    );

    this.unsubscribers.push(
      router.onFallbackTriggered((e) => {
        const from = e.fromModel ? `${e.fromProvider}/${e.fromModel}` : e.fromProvider;
        const to = e.toModel ? `${e.toProvider}/${e.toModel}` : e.toProvider;
        console.log(`${PREFIX} fallback: ${from} -> ${to} (${e.reason})`);
      }),
    );

    this.unsubscribers.push(
      router.onLimitWarning((e) => {
        console.log(
          `${PREFIX} warning: ${e.provider} key#${e.keyIndex} ${e.limitType} at ${e.currentUsage}/${e.limit} (${e.threshold * 100}% threshold)`,
        );
      }),
    );

    this.unsubscribers.push(
      router.onLimitExceeded((e) => {
        console.log(`${PREFIX} exceeded: ${e.provider} key#${e.keyIndex} ${e.limitType}`);
      }),
    );

    this.unsubscribers.push(
      router.onUsageRecorded((e) => {
        console.log(
          `${PREFIX} usage: ${e.provider} key#${e.keyIndex} +${e.promptTokens}p/${e.completionTokens}c tokens (${e.estimated ? 'estimated' : 'actual'})`,
        );
      }),
    );

    this.unsubscribers.push(
      router.onBudgetAlert((e) => {
        console.log(
          `${PREFIX} budget alert: $${e.spent}/$${e.limit} (${e.threshold * 100}% threshold)`,
        );
      }),
    );

    this.unsubscribers.push(
      router.onBudgetExceeded((e) => {
        console.log(`${PREFIX} budget exceeded: $${e.spent}/$${e.limit}`);
      }),
    );

    this.unsubscribers.push(
      router.onError((e) => {
        console.log(`${PREFIX} error: ${e.error.message}`);
      }),
    );
  }

  /**
   * Unsubscribe from all hooks and clean up.
   */
  detach(): void {
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];
  }
}
