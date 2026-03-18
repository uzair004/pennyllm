# Phase 13: Credit-Based Limits - Research

**Researched:** 2026-03-18
**Domain:** Credit depletion tracking, usage-based cost estimation, provider exhaustion management
**Confidence:** HIGH

## Summary

Phase 13 adds proactive credit balance tracking for providers with finite credits (primarily SambaNova's $5 signup credit with 30-day expiry). The existing 402 permanent cooldown from Phase 12 serves as the reactive safety net; this phase adds estimation-based tracking on top so users get warnings before exhaustion and the router can proactively skip depleted providers.

The implementation follows the BudgetTracker pattern almost exactly: same StorageBackend persistence via micro-dollars in promptTokens field, same threshold-based event emission with Set deduplication, same fire-and-forget recording pattern. The key differences are: (1) credits are a finite balance that depletes rather than a monthly cap that resets, (2) credits can expire by date, and (3) the topUp() API allows balance increases without restart.

**Primary recommendation:** Model CreditTracker as a parallel class to BudgetTracker. Use dollars as the credit unit (matches config simplicity across providers). Integrate into ChainExecutor alongside the existing budget gate. Storage key pattern: `credit:{provider}` with keyIndex 0, consumed amount in micro-dollars via promptTokens field.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Usage-based estimation**: Track cost per call (token count \* user-configured cost rates), subtract from configured initial balance. No provider API queries needed
- **Per-provider granularity**: One credit balance per provider. All models from that provider draw from the same credit pool
- **Persistence via StorageBackend**: Consumed amount persisted (survives restarts). Pattern mirrors BudgetTracker (micro-dollars in promptTokens field). First boot: consumed = 0. Every restart: reads existing consumed from storage
- **Balance model**: `remaining = config.balance - storedConsumed`. Config has the ceiling (what provider gave you). Storage tracks how much used. Restarts resume from stored consumed amount
- **Cost estimation timing**: Use actual token count from provider response + user-configured cost rates. Same pattern as BudgetTracker.recordCost()
- **Config-only tracking**: Only track credits for providers where user explicitly configures `credits` in config. 402 without credit config still triggers permanent cooldown (existing behavior unchanged)
- **Missing cost rates = ConfigError**: If tier: 'trial' has credits but no costRates, throw ConfigError at startup. No silent bad estimates
- **Separate CreditTracker class**: New class parallel to BudgetTracker. Clean separation. CreditTracker marks provider depleted via CooldownManager when credits exhausted
- **topUp() API**: `creditTracker.topUp(provider, amount)` increases balance without resetting consumed history. Users who purchase more credits update without restarting
- **Extend existing provider credits field**: Phase 12 already defined `credits` on provider config. Expand to full object with balance, expiresAt, costRates, alertThresholds
- **createCreditLimit() standalone builder**: Consistent with existing createTokenLimit/createRateLimit/createCallLimit builders
- **Both input and output rates required**: costRates must have inputPer1MTokens AND outputPer1MTokens
- **expiresAt as ISO string only**: JSON-serializable, works in YAML/JSON config files. Zod validates as ISO date string
- **Single flat rate**: One cost rate per provider. No tiered pricing support
- **Cross-field Zod validation**: tier: 'trial' requires credits config at startup. ConfigError if missing
- **Try one more, then confirm**: When estimated remaining <= 0, try one more request. If 402, confirmed exhausted. If success, estimation was off
- **Permanent until topUp()**: Once confirmed exhausted (estimated <= 0 AND 402 received), provider marked depleted permanently. Only topUp() or new router instance clears it
- **Expiry checked at startup AND mid-session**: Date.now() > expiresAt check before each call
- **Expiry warning**: credit:expiring event emitted at startup when expiresAt is within configurable warning threshold (default: 7 days)
- **credit:low**: Fires at configured thresholds (array-based, deduped via Set)
- **credit:exhausted**: Fires when credits confirmed exhausted or expired past expiresAt
- **credit:expiring**: Fires at startup when expiresAt is within warning threshold
- **credit:recorded as debug log only**: debug('pennyllm:credit') for per-call deductions
- **Extend router.getStatus()**: Add creditStatus per provider entry

### Claude's Discretion

- Credit unit (dollars vs provider-native) -- pick what makes config simplest across providers
- StorageBackend key pattern for credit consumption records
- Exact CreditTracker internal architecture (how it composes with ChainExecutor)
- How topUp() interacts with persisted consumed amount
- credit:expiring warning threshold default and config field name
- Whether credit check happens before or after cooldown check in chain executor

### Deferred Ideas (OUT OF SCOPE)

- Provider balance API queries
- Tiered cost rates (multiple pricing tiers)
- Per-model credit tracking
- Auto-detect credit providers from 402
  </user_constraints>

<phase_requirements>

## Phase Requirements

| ID                | Description                              | Research Support                                                                                             |
| ----------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| extends POLICY-04 | Diverse limit types: credit-based limits | CreditTracker class, createCreditLimit() builder, credits config schema expansion, ChainExecutor integration |

</phase_requirements>

## Standard Stack

### Core

| Library     | Version  | Purpose                                                               | Why Standard                                                     |
| ----------- | -------- | --------------------------------------------------------------------- | ---------------------------------------------------------------- |
| zod         | v3.23.x  | Credits config schema validation, cross-field refinement              | Already used throughout; exact version pinned by AI SDK peer dep |
| debug       | latest   | `pennyllm:credit` namespace for per-call deduction logging            | Already used in BudgetTracker, CooldownManager, ChainExecutor    |
| node:events | built-in | EventEmitter for credit:low, credit:exhausted, credit:expiring events | Already used by BudgetTracker and all other event emitters       |

### Supporting

No new dependencies required. Phase 13 uses only existing project dependencies.

### Alternatives Considered

| Instead of                           | Could Use             | Tradeoff                                                                                             |
| ------------------------------------ | --------------------- | ---------------------------------------------------------------------------------------------------- |
| Dollars as credit unit               | Provider-native units | Dollars are universal, match BudgetTracker pricing format, simpler cross-provider config             |
| Micro-dollar storage in promptTokens | New storage field     | Reusing promptTokens avoids StorageBackend interface changes; established pattern from BudgetTracker |

## Architecture Patterns

### Recommended Project Structure

```
src/
├── credit/
│   ├── CreditTracker.ts     # Main class (parallel to BudgetTracker)
│   ├── types.ts              # CreditConfig, event payload types
│   └── index.ts              # Barrel export
├── config/
│   └── schema.ts             # Expanded credits schema (object instead of number)
├── chain/
│   └── ChainExecutor.ts      # Credit check integration point
├── constants/
│   └── index.ts              # New RouterEvent entries for credit events
└── types/
    └── events.ts             # New credit event types in RouterEventMap
```

### Pattern 1: CreditTracker Class (Parallel to BudgetTracker)

**What:** A standalone class that tracks credit consumption per provider, persists via StorageBackend, emits threshold events, and marks providers as depleted via CooldownManager.
**When to use:** Any provider with `credits` config (tier: 'trial' with credit balance).
**Key design:**

```typescript
// CreditTracker follows BudgetTracker's exact pattern
export class CreditTracker {
  private readonly storage: StorageBackend;
  private readonly emitter: EventEmitter;
  private readonly cooldownManager: CooldownManager;
  private readonly configs: Map<string, CreditConfig>;
  private readonly alertsFired: Map<string, Set<number>>; // per-provider dedup
  private balanceCache: Map<string, number>; // cached consumed amounts

  constructor(
    storage: StorageBackend,
    cooldownManager: CooldownManager,
    emitter: EventEmitter,
    configs: Map<string, CreditConfig>,
  ) { ... }

  // Load persisted consumed amounts at startup
  async loadPersistedCredits(): Promise<void> { ... }

  // Record consumption after a call (fire-and-forget)
  async recordConsumption(
    provider: string,
    usage: { promptTokens: number; completionTokens: number },
  ): Promise<void> { ... }

  // Check if credits are estimated exhausted for a provider
  isEstimatedExhausted(provider: string): boolean { ... }

  // Check if credits have expired
  isExpired(provider: string): boolean { ... }

  // Should skip this provider? (exhausted OR expired)
  shouldSkip(provider: string): boolean { ... }

  // Top up credits without resetting consumed history
  async topUp(provider: string, amount: number): Promise<void> { ... }

  // Get credit status for a provider
  getStatus(provider: string): CreditStatus | undefined { ... }
}
```

### Pattern 2: Storage Key Pattern for Credits

**What:** Credit consumption stored using StorageBackend with provider-specific keys.
**Storage key:** `credit:{provider}` with keyIndex 0, consumed micro-dollars in promptTokens field.
**Why:** Mirrors BudgetTracker's `budget` key pattern exactly. Uses a non-expiring window (credits don't reset monthly).

```typescript
// Storage window for credits (never expires -- credits are lifetime, not periodic)
const CREDIT_WINDOW: TimeWindow = {
  type: 'monthly', // Type doesn't matter for credits
  durationMs: Infinity, // Never expires -- credits are consumed, not renewed
};
// NOTE: If StorageBackend doesn't support Infinity durationMs,
// use a very large value (10 years) or a 'lifetime' sentinel.
// Need to verify MemoryStorage behavior with Infinity.
```

**Alternative approach if Infinity doesn't work with existing storage:**

```typescript
// Use a 100-year window as practical "never expires"
const CREDIT_WINDOW: TimeWindow = {
  type: 'monthly',
  durationMs: 100 * 365 * 24 * 60 * 60 * 1000, // ~100 years
};
```

### Pattern 3: ChainExecutor Credit Gate

**What:** Credit check integrated into ChainExecutor's per-entry evaluation loop.
**Where:** Between cooldown check (line 159) and budget check (line 165) in executeChain().
**Recommendation:** Place credit check AFTER cooldown check but BEFORE budget check. Cooldown is the cheapest check (in-memory Map lookup). Credit check may read from storage cache. Budget check is for paid models only. Credit check is for trial-tier providers only.

```typescript
// In executeChain(), after cooldown check, before budget check:
// c2. Check credit depletion for trial-tier providers
if (creditTracker && creditTracker.shouldSkip(entry.provider)) {
  debug(
    'Skipping provider %s (credits exhausted/expired) at position %d',
    entry.provider,
    position,
  );
  continue;
}
```

### Pattern 4: Config Schema Expansion

**What:** Expand `credits` field from `z.number().positive().optional()` to a full object schema.
**Backward compatibility:** The existing `credits: z.number()` is only used in the cross-field validation `tier: 'trial' requires credits`. Expanding to an object is a breaking change to the config shape but Phase 12 just added it, so no external consumers yet.

```typescript
const costRatesSchema = z.object({
  inputPer1MTokens: z.number().nonnegative(),
  outputPer1MTokens: z.number().nonnegative(),
});

const creditsConfigSchema = z.object({
  balance: z.number().positive(),
  expiresAt: z.string().datetime().optional(), // ISO 8601
  costRates: costRatesSchema,
  alertThresholds: z.array(z.number().min(0).max(1)).default([0.2, 0.05]),
  expiryWarningDays: z.number().int().positive().default(7),
});
```

### Pattern 5: createCreditLimit() Builder

**What:** Standalone builder function consistent with createTokenLimit/createRateLimit/createCallLimit.
**Returns:** The credits config object for embedding in provider config.

```typescript
export function createCreditLimit(options: {
  balance: number;
  costRates: { inputPer1MTokens: number; outputPer1MTokens: number };
  expiresAt?: string;
  alertThresholds?: number[];
  expiryWarningDays?: number;
}): CreditsConfig { ... }
```

### Pattern 6: topUp() Interaction with Storage

**What:** topUp() increases the provider's configured balance without resetting consumed history.
**How:** Mutate the in-memory config (increase balance), NOT the stored consumed amount. The formula `remaining = balance - consumed` naturally gives more remaining when balance increases.

```typescript
async topUp(provider: string, amount: number): Promise<void> {
  const config = this.configs.get(provider);
  if (!config) throw new ConfigError(...);

  // Increase the configured balance
  config.balance += amount;

  // If provider was marked depleted, clear the depletion
  // (CooldownManager permanent cooldown)
  if (this.cooldownManager.isProviderDepleted(provider)) {
    this.cooldownManager.onProviderSuccess(provider); // clears permanent cooldown
  }

  // Re-check thresholds (alerts may need re-firing at new thresholds)
  this.alertsFired.get(provider)?.clear();

  debug('Provider %s topped up by $%d, new balance: $%d', provider, amount, config.balance);
}
```

### Anti-Patterns to Avoid

- **Querying storage on every credit check:** Cache the consumed amount in memory. Update cache on recordConsumption(). Only read from storage at startup (loadPersistedCredits).
- **Using BudgetTracker for credits:** Credits are fundamentally different from budgets (finite vs recurring, per-provider vs global, deplete vs reset). Separate class is cleaner.
- **Resetting consumed on topUp():** Would lose consumption history. Instead, increase the balance ceiling.
- **Throwing on recordConsumption failure:** Follow fire-and-forget pattern. Credit recording is observability, not correctness. 402 safety net is the real guard.

## Don't Hand-Roll

| Problem                      | Don't Build               | Use Instead                                                            | Why                                                                       |
| ---------------------------- | ------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Micro-dollar precision       | Custom decimal arithmetic | `Math.round(cost * 1_000_000)` in integer storage                      | Floating-point avoidance, established BudgetTracker pattern               |
| Threshold deduplication      | Custom dedup logic        | `Set<number>` per provider (same as BudgetTracker.alertsFired)         | Proven pattern, simple, no edge cases                                     |
| Permanent provider depletion | Custom depletion tracking | `CooldownManager.setProviderCooldown(provider, Infinity, 'permanent')` | Already integrated into ChainExecutor skip logic                          |
| ISO date validation          | Manual regex              | `z.string().datetime()` Zod validator                                  | Handles timezone offsets, edge cases                                      |
| Event emission safety        | Raw emitter.emit()        | `safeEmit()` helper from ChainExecutor                                 | Fire-and-forget pattern prevents event handler errors from breaking chain |

## Common Pitfalls

### Pitfall 1: StorageBackend Window Expiration

**What goes wrong:** If the TimeWindow's durationMs causes the storage key to expire, consumed credit data is lost on restart.
**Why it happens:** MemoryStorage uses lazy expiration based on durationMs. Credits should never expire from storage.
**How to avoid:** Use a sufficiently large durationMs (100 years) or verify that MemoryStorage/SQLite/Redis adapters handle very large durations correctly. Test by creating a credit record and verifying it survives a getUsage() call.
**Warning signs:** Credits appearing to reset to 0 after restart.

### Pitfall 2: exactOptionalPropertyTypes Compliance

**What goes wrong:** TypeScript errors when building objects with optional credit fields.
**Why it happens:** Project uses `exactOptionalPropertyTypes: true` in tsconfig.
**How to avoid:** Use conditional property inclusion pattern: `if (value !== undefined) obj.field = value`. Never spread `{ field: undefined }`.
**Warning signs:** TS2375 or TS4111 errors during `tsc --noEmit`.

### Pitfall 3: Config Schema Migration (credits: number -> object)

**What goes wrong:** Existing `providerConfigSchema` has `credits: z.number().positive().optional()`. Changing to object breaks the cross-field validation `.refine()` that checks `tier: 'trial' && credits === undefined`.
**Why it happens:** The refinement logic assumes `credits` is a number.
**How to avoid:** Update the cross-field validation simultaneously with the schema change. New check: `tier === 'trial' && credits === undefined` still works (credits is now an object or undefined). Additionally validate that `credits.costRates` exists when `credits` is provided.
**Warning signs:** Zod parse errors on valid configs, or missing validation on invalid configs.

### Pitfall 4: Race Between Credit Check and 402 Confirmation

**What goes wrong:** Multiple concurrent requests pass the credit check, all get 402, and multiple `credit:exhausted` events fire.
**Why it happens:** In-memory consumed amount is updated asynchronously. Multiple requests may read "remaining > 0" before any updates.
**How to avoid:** Dedup `credit:exhausted` event emission (fire once per provider per session). The "try one more" strategy already accounts for estimation inaccuracy. CooldownManager's permanent cooldown prevents further attempts after first 402.
**Warning signs:** Multiple `credit:exhausted` events for the same provider.

### Pitfall 5: Expiry Check Timezone Issues

**What goes wrong:** `expiresAt` ISO string compared with `Date.now()` gives wrong results if timezone handling is inconsistent.
**Why it happens:** `new Date('2026-04-15')` in JavaScript creates a UTC midnight date. If user means end of day in their timezone, credits expire ~24 hours early.
**How to avoid:** Document that expiresAt is UTC. Use `new Date(expiresAt).getTime()` for comparison. Encourage full ISO strings with timezone: `'2026-04-15T23:59:59Z'`.
**Warning signs:** Credits expiring earlier than expected.

## Code Examples

### Credit Configuration Example

```typescript
// Source: CONTEXT.md locked decisions
const config = defineConfig({
  providers: {
    sambanova: {
      tier: 'trial',
      keys: ['sk-...'],
      credits: {
        balance: 5.0, // $5 from provider
        expiresAt: '2026-04-15T23:59:59Z',
        costRates: {
          inputPer1MTokens: 0.2,
          outputPer1MTokens: 0.6,
        },
        alertThresholds: [0.2, 0.05], // 20% and 5% remaining
        expiryWarningDays: 7,
      },
    },
  },
});
```

### createCreditLimit() Builder Example

```typescript
// Source: CONTEXT.md - consistent with createTokenLimit/createRateLimit pattern
import { createCreditLimit } from 'pennyllm';

const credits = createCreditLimit({
  balance: 5.0,
  costRates: { inputPer1MTokens: 0.2, outputPer1MTokens: 0.6 },
  expiresAt: '2026-04-15T23:59:59Z',
  alertThresholds: [0.2, 0.05],
});

// Use in config:
const config = defineConfig({
  providers: {
    sambanova: { tier: 'trial', keys: ['sk-...'], credits },
  },
});
```

### Cost Calculation (from BudgetTracker pattern)

```typescript
// Source: src/budget/BudgetTracker.ts recordCost() pattern
function calculateCost(
  usage: { promptTokens: number; completionTokens: number },
  costRates: { inputPer1MTokens: number; outputPer1MTokens: number },
): number {
  return (
    (usage.promptTokens * costRates.inputPer1MTokens +
      usage.completionTokens * costRates.outputPer1MTokens) /
    1_000_000
  );
}
```

### Event Subscription Example

```typescript
const router = await createRouter(config);

router.on('credit:low', (event) => {
  console.log(`${event.provider}: ${event.percentRemaining}% credits remaining`);
});

router.on('credit:exhausted', (event) => {
  console.log(`${event.provider}: credits exhausted, removed from chain`);
});

router.on('credit:expiring', (event) => {
  console.log(`${event.provider}: credits expire in ${event.daysRemaining} days`);
});
```

## State of the Art

| Old Approach               | Current Approach                     | When Changed | Impact                                                                                              |
| -------------------------- | ------------------------------------ | ------------ | --------------------------------------------------------------------------------------------------- |
| NVIDIA credit-based system | Rate-limited trial (perpetual)       | Late 2025    | NVIDIA no longer needs credit tracking; 402 permanent cooldown suffices                             |
| SambaNova free tier only   | Free + Developer tier ($0 card link) | Ongoing      | Credits mainly relevant for SambaNova free tier $5 signup; developer tier is perpetual rate-limited |

**Provider credit landscape (March 2026):**

- **SambaNova**: $5 signup credit, 30-day expiry. Primary use case for Phase 13.
- **NVIDIA NIM**: Credits discontinued. 402 still possible for legacy accounts. Existing permanent cooldown handles it.
- **Future providers**: Credit-based billing is common (Replicate, Modal, etc.). CreditTracker provides the foundation.

## Validation Architecture

### Test Framework

| Property           | Value                               |
| ------------------ | ----------------------------------- |
| Framework          | vitest (existing)                   |
| Config file        | vitest.config.ts                    |
| Quick run command  | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run`                    |

### Phase Requirements to Test Map

| Req ID    | Behavior                                                        | Test Type | Automated Command                                                        | File Exists? |
| --------- | --------------------------------------------------------------- | --------- | ------------------------------------------------------------------------ | ------------ |
| CREDIT-01 | createCreditLimit() builder returns valid config                | unit      | `npx vitest run src/credit/CreditTracker.test.ts -t "createCreditLimit"` | Wave 0       |
| CREDIT-02 | Credit depletion tracking (record consumption, check remaining) | unit      | `npx vitest run src/credit/CreditTracker.test.ts -t "depletion"`         | Wave 0       |
| CREDIT-03 | Expiry date modeling (isExpired, credit:expiring event)         | unit      | `npx vitest run src/credit/CreditTracker.test.ts -t "expiry"`            | Wave 0       |
| CREDIT-04 | Router skips provider when credits estimated exhausted          | unit      | `npx vitest run src/chain/ChainExecutor.test.ts -t "credit"`             | Wave 0       |
| CREDIT-05 | credit:low and credit:exhausted events fire correctly           | unit      | `npx vitest run src/credit/CreditTracker.test.ts -t "events"`            | Wave 0       |
| CREDIT-06 | topUp() increases balance and clears depletion                  | unit      | `npx vitest run src/credit/CreditTracker.test.ts -t "topUp"`             | Wave 0       |
| CREDIT-07 | Config validation: trial tier requires credits with costRates   | unit      | `npx vitest run src/config/schema.test.ts -t "credit"`                   | Wave 0       |
| CREDIT-08 | Persistence: consumed amount survives restart                   | unit      | `npx vitest run src/credit/CreditTracker.test.ts -t "persistence"`       | Wave 0       |

### Sampling Rate

- **Per task commit:** `npx vitest run --reporter=verbose` (or `tsc --noEmit` per CLAUDE.md)
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/credit/CreditTracker.test.ts` -- covers CREDIT-01 through CREDIT-08
- [ ] Test framework already configured (vitest.config.ts exists)

**Note:** Per CLAUDE.md testing strategy, tests are optional during build phases. The planner should use `tsc --noEmit` as primary verification. Test files listed above are for future validation, not required during implementation.

## Open Questions

1. **StorageBackend with non-expiring windows**
   - What we know: BudgetTracker uses monthly window (30d durationMs). Credits should never expire from storage.
   - What's unclear: Whether MemoryStorage handles very large durationMs values correctly (Infinity or 100-year).
   - Recommendation: During implementation, test with a large durationMs value. If issues arise, use a 100-year value as practical "never expires". The lazy expiration in MemoryStorage checks `Date.now() >= expiresAt`, so a far-future expiresAt should work.

2. **Credit cost rates for NVIDIA NIM**
   - What we know: NVIDIA discontinued credits. Free tier is rate-limited, not credit-based.
   - What's unclear: Whether any user would configure credits for NVIDIA.
   - Recommendation: CreditTracker is provider-agnostic. Config-only -- if user doesn't configure credits, nothing happens. Document that NVIDIA doesn't need credit config.

3. **Concurrent topUp() and recordConsumption()**
   - What we know: Both modify in-memory state and persist to storage.
   - What's unclear: Race condition potential if topUp() is called while recordConsumption() is in-flight.
   - Recommendation: topUp() modifies config.balance (separate from consumed). recordConsumption() modifies consumed. They don't conflict because `remaining = balance - consumed` is computed from independent values.

## Sources

### Primary (HIGH confidence)

- `src/budget/BudgetTracker.ts` -- Direct template: micro-dollar storage, fire-and-forget recording, threshold events, monthly window pattern
- `src/usage/cooldown.ts` -- CooldownManager with provider-level permanent depletion, storage persistence
- `src/chain/ChainExecutor.ts` -- Chain walking logic, budget gate at line 165, integration point for credit check
- `src/config/schema.ts` -- Current credits field (z.number()), Zod cross-field validation, providerConfigSchema
- `src/wrapper/error-classifier.ts` -- 402 -> permanent cooldown classification (line 120-129)
- `src/config/index.ts` -- createRouter() initialization flow, BudgetTracker creation pattern

### Secondary (MEDIUM confidence)

- `docs/providers/notes/sambanova.md` -- $5 signup credit, 30-day expiry, free vs developer tier
- `docs/providers/notes/nvidia-nim.md` -- Credit system discontinued, 402 handling
- `docs/providers/GAP-REPORT.md` -- P2-2 defines credit tracking scope

### Tertiary (LOW confidence)

- None -- all findings verified from codebase inspection

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH -- no new dependencies, all patterns from existing codebase
- Architecture: HIGH -- CreditTracker follows BudgetTracker almost exactly, integration points clearly identified in ChainExecutor
- Pitfalls: HIGH -- identified from codebase patterns (exactOptionalPropertyTypes, storage windows, schema migration)

**Research date:** 2026-03-18
**Valid until:** 2026-04-18 (stable -- no external dependencies, all internal patterns)
