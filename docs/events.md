# Events & Hooks Reference

PennyLLM emits typed events for every routing decision, usage change, limit breach, and error. Two ways to listen:

1. **Typed hooks** (recommended) -- autocomplete, type-safe callbacks, returns unsubscribe function.
2. **Raw `router.on()`** -- string-based event names, manual `.off()` to unsubscribe.

## Typed Hooks

Eight typed hooks are available on every router instance:

| Hook                  | Event Type               | Fires when                             |
| --------------------- | ------------------------ | -------------------------------------- |
| `onKeySelected`       | `KeySelectedEvent`       | A key is chosen for a request          |
| `onUsageRecorded`     | `UsageRecordedEvent`     | Token usage is recorded                |
| `onLimitWarning`      | `LimitWarningEvent`      | Key approaches a usage limit           |
| `onLimitExceeded`     | `LimitExceededEvent`     | Key exceeds a usage limit              |
| `onFallbackTriggered` | `FallbackTriggeredEvent` | Request falls back to another provider |
| `onBudgetAlert`       | `BudgetAlertEvent`       | Spending hits an alert threshold       |
| `onBudgetExceeded`    | `BudgetExceededEvent`    | Monthly budget cap is hit              |
| `onError`             | `ErrorEvent`             | An error occurs during routing         |

```typescript
const unsub = router.onKeySelected((event) => {
  console.log(`Selected key #${event.keyIndex} for ${event.provider}`);
});

// Later: stop listening
unsub();
```

Each hook returns an unsubscribe function. Call it to remove the listener.

## Raw Events

For event names not covered by typed hooks (system events, error subtypes), use the raw API:

```typescript
import { RouterEvent } from 'pennyllm/constants';

router.on(RouterEvent.KEY_DISABLED, (event) => {
  console.log(`Key #${event.keyIndex} disabled: ${event.reason}`);
});

// Remove a specific listener
router.off(RouterEvent.KEY_DISABLED, handler);
```

All event name constants:

```typescript
RouterEvent.KEY_SELECTED; // 'key:selected'
RouterEvent.USAGE_RECORDED; // 'usage:recorded'
RouterEvent.LIMIT_WARNING; // 'limit:warning'
RouterEvent.LIMIT_EXCEEDED; // 'limit:exceeded'
RouterEvent.FALLBACK_TRIGGERED; // 'fallback:triggered'
RouterEvent.BUDGET_ALERT; // 'budget:alert'
RouterEvent.BUDGET_EXCEEDED; // 'budget:exceeded'
RouterEvent.ERROR; // 'error'
RouterEvent.ERROR_RATE_LIMIT; // 'error:rate_limit'
RouterEvent.ERROR_AUTH; // 'error:auth'
RouterEvent.ERROR_SERVER; // 'error:server'
RouterEvent.ERROR_NETWORK; // 'error:network'
RouterEvent.KEY_RETRIED; // 'key:retried'
RouterEvent.KEY_DISABLED; // 'key:disabled'
RouterEvent.REQUEST_COMPLETE; // 'request:complete'
RouterEvent.CONFIG_LOADED; // 'config:loaded'
RouterEvent.PROVIDER_EXHAUSTED; // 'provider:exhausted'
RouterEvent.CATALOG_REFRESHED; // 'catalog:refreshed'
```

All event payloads extend the base payload:

```typescript
interface RouterEventPayload {
  timestamp: number;
  requestId?: string;
}
```

## Event Reference

### Routing Events

#### `key:selected`

Fires when the router selects a key for an incoming request.

```typescript
interface KeySelectedEvent extends RouterEventPayload {
  provider: string;
  keyIndex: number;
  model?: string;
  label?: string;
  strategy: string; // 'priority' | 'round-robin' | 'least-used'
  reason: string;
  remainingQuota?: number;
}
```

#### `fallback:triggered`

Fires when a request falls back from one provider to another.

```typescript
interface FallbackTriggeredEvent extends RouterEventPayload {
  fromProvider: string;
  toProvider: string;
  reason: string;
  fromModel?: string;
  toModel?: string;
}
```

#### `request:complete`

Fires after a successful LLM API call completes (generate or stream).

```typescript
interface RequestCompleteEvent extends RouterEventPayload {
  provider: string;
  modelId: string;
  keyIndex: number;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  retries: number;
}
```

### Usage Events

#### `usage:recorded`

Fires when token usage is recorded after a request.

```typescript
interface UsageRecordedEvent extends RouterEventPayload {
  provider: string;
  keyIndex: number;
  promptTokens: number;
  completionTokens: number;
  estimated: boolean; // true if tokens were estimated (not from provider)
  windows: string[]; // Time windows updated (e.g., ['2026-03', '2026-03-14'])
}
```

#### `limit:warning`

Fires when a key's usage approaches a configured limit (crosses `warningThreshold`). Deduplicated -- fires once per limit crossing.

```typescript
interface LimitWarningEvent extends RouterEventPayload {
  provider: string;
  keyIndex: number;
  limitType: 'tokens' | 'calls' | 'rate' | 'daily' | 'monthly';
  currentUsage: number;
  limit: number;
  threshold: number;
}
```

#### `limit:exceeded`

Fires every time a key exceeds a configured limit.

```typescript
interface LimitExceededEvent extends RouterEventPayload {
  provider: string;
  keyIndex: number;
  limitType: 'tokens' | 'calls' | 'rate' | 'daily' | 'monthly';
}
```

### Budget Events

#### `budget:alert`

Fires when cumulative spending crosses an alert threshold.

```typescript
interface BudgetAlertEvent extends RouterEventPayload {
  threshold: number; // The threshold crossed (e.g., 0.8)
  spent: number; // Total spent so far (dollars)
  limit: number; // Monthly budget limit (dollars)
  remaining: number; // Dollars remaining
  avgCostPerRequest: number;
}
```

#### `budget:exceeded`

Fires when spending hits the monthly budget cap.

```typescript
interface BudgetExceededEvent extends RouterEventPayload {
  spent: number;
  limit: number;
  lastRequestCost: number;
}
```

### Error Events

#### `error`

Fires on any routing error. Wraps the error in an `PennyLLMError` instance.

```typescript
interface ErrorEvent extends RouterEventPayload {
  error: PennyLLMError;
}
```

#### `error:rate_limit`

Fires when a key hits a 429 rate limit from the provider.

```typescript
interface ErrorRateLimitEvent extends RouterEventPayload {
  provider: string;
  keyIndex: number;
  modelId: string;
  statusCode: number; // 429
  message: string;
}
```

#### `error:auth`

Fires when a key receives a 401 or 403 from the provider.

```typescript
interface ErrorAuthEvent extends RouterEventPayload {
  provider: string;
  keyIndex: number;
  modelId: string;
  statusCode: number; // 401 or 403
  message: string;
}
```

#### `error:server`

Fires when a provider returns a 500+ server error.

```typescript
interface ErrorServerEvent extends RouterEventPayload {
  provider: string;
  keyIndex: number;
  modelId: string;
  statusCode: number;
  message: string;
}
```

#### `error:network`

Fires on a connection failure (DNS, timeout, refused).

```typescript
interface ErrorNetworkEvent extends RouterEventPayload {
  provider: string;
  keyIndex: number;
  modelId: string;
  message: string;
}
```

### Key Lifecycle Events

#### `key:retried`

Fires when the retry proxy rotates to a different key after a failure.

```typescript
interface KeyRetriedEvent extends RouterEventPayload {
  provider: string;
  modelId: string;
  failedKeyIndex: number;
  newKeyIndex: number;
  reason: string;
  attempt: number;
  maxAttempts: number;
}
```

#### `key:disabled`

Fires when a key enters cooldown (after 429 or auth failure).

```typescript
interface KeyDisabledEvent extends RouterEventPayload {
  provider: string;
  keyIndex: number;
  reason: string;
  statusCode: number;
}
```

### System Events

#### `config:loaded`

Fires once after `createRouter()` finishes initializing.

```typescript
interface ConfigLoadedEvent extends RouterEventPayload {
  providerCount: number;
  keyCount: number;
}
```

#### `provider:exhausted`

Fires when all keys for a provider are unavailable.

```typescript
interface ProviderExhaustedEvent extends RouterEventPayload {
  provider: string;
  totalKeys: number;
  exhaustedCount: number;
  cooldownCount: number;
  earliestRecovery: string | null;
  exhaustionType: 'cooldown' | 'quota' | 'mixed';
}
```

#### `catalog:refreshed`

Fires when the model catalog refreshes from its data source.

```typescript
interface CatalogRefreshedEvent {
  source: 'live' | 'cache' | 'static';
  modelsAdded: number;
  modelsRemoved: number;
  unchanged: number;
  timestamp: number;
}
```

#### `policy:stale`

Fires when a provider's policy metadata is older than expected.

```typescript
interface PolicyStaleEvent {
  provider: string;
  researchedDate: string;
  daysOld: number;
  suggestion: string;
}
```

## Common Patterns

### Monitoring -- log all key events

```typescript
router.onKeySelected((e) => {
  logger.info('key:selected', {
    provider: e.provider,
    keyIndex: e.keyIndex,
    strategy: e.strategy,
  });
});

router.onFallbackTriggered((e) => {
  logger.warn('fallback:triggered', {
    from: e.fromProvider,
    to: e.toProvider,
    reason: e.reason,
  });
});
```

### Alerting -- budget and limit warnings

```typescript
router.onBudgetAlert((e) => {
  slack.send(
    `Budget ${(e.threshold * 100).toFixed(0)}% used: $${e.spent.toFixed(2)}/$${e.limit.toFixed(2)}`,
  );
});

router.onLimitWarning((e) => {
  slack.send(
    `${e.provider} key #${e.keyIndex} at ${((e.currentUsage / e.limit) * 100).toFixed(0)}% of ${e.limitType} limit`,
  );
});
```

### Metrics -- usage recording

```typescript
router.onUsageRecorded((e) => {
  metrics.increment('llm.tokens.prompt', e.promptTokens, { provider: e.provider });
  metrics.increment('llm.tokens.completion', e.completionTokens, { provider: e.provider });
});

router.on('request:complete', (e) => {
  metrics.histogram('llm.latency', e.latencyMs, { provider: e.provider, model: e.modelId });
  metrics.increment('llm.retries', e.retries, { provider: e.provider });
});
```
