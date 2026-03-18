# Phase 13: Credit-Based Limits - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Handle providers with finite credits (NVIDIA NIM, SambaNova) — track credit depletion via usage-based estimation, detect exhaustion, handle time-limited credit expiry, and stop routing to depleted providers. Existing 402 permanent cooldown (Phase 12) serves as safety net; this phase adds proactive tracking on top.

Requirements: extends POLICY-04 (diverse limit types) with credit-based limits.

</domain>

<decisions>
## Implementation Decisions

### Credit Tracking Mechanism

- **Usage-based estimation**: Track cost per call (token count \* user-configured cost rates), subtract from configured initial balance. No provider API queries needed
- **Per-provider granularity**: One credit balance per provider. All models from that provider draw from the same credit pool
- **Persistence via StorageBackend**: Consumed amount persisted (survives restarts). Pattern mirrors BudgetTracker (micro-dollars in promptTokens field). First boot: consumed = 0. Every restart: reads existing consumed from storage
- **Balance model**: `remaining = config.balance - storedConsumed`. Config has the ceiling (what provider gave you). Storage tracks how much used. Restarts resume from stored consumed amount
- **Cost estimation timing**: Use actual token count from provider response + user-configured cost rates. Same pattern as BudgetTracker.recordCost()
- **Config-only tracking**: Only track credits for providers where user explicitly configures `credits` in config. 402 without credit config still triggers permanent cooldown (existing behavior unchanged)
- **Missing cost rates = ConfigError**: If tier: 'trial' has credits but no costRates, throw ConfigError at startup. No silent bad estimates
- **Separate CreditTracker class**: New class parallel to BudgetTracker. Clean separation. CreditTracker marks provider depleted via CooldownManager when credits exhausted
- **topUp() API**: `creditTracker.topUp(provider, amount)` increases balance without resetting consumed history. Users who purchase more credits update without restarting

### Config Shape & Builder API

- **Extend existing provider credits field**: Phase 12 already defined `credits` on provider config. Expand to full object:
  ```
  sambanova: {
    tier: 'trial',
    keys: ['sk-...'],
    credits: {
      balance: 5.00,           // initial $ from provider
      expiresAt: '2026-04-15', // optional ISO string, omit for perpetual
      costRates: {
        inputPer1MTokens: 0.20,
        outputPer1MTokens: 0.60
      },
      alertThresholds: [0.2, 0.05]  // optional, fire credit:low at 20% and 5% remaining
    }
  }
  ```
- **createCreditLimit() standalone builder**: Consistent with existing createTokenLimit/createRateLimit/createCallLimit builders from Phase 8. Returns the credits config object
- **Both input and output rates required**: costRates must have inputPer1MTokens AND outputPer1MTokens. Matches BudgetTracker pricing format
- **expiresAt as ISO string only**: JSON-serializable, works in YAML/JSON config files. Zod validates as ISO date string
- **Single flat rate**: One cost rate per provider. No tiered pricing support (add later if needed)
- **Cross-field Zod validation**: tier: 'trial' requires credits config at startup. ConfigError if missing. Same pattern as Phase 9 budget+fallback validation

### Exhaustion & Expiry Behavior

- **Try one more, then confirm**: When estimated remaining <= 0, try one more request. If 402, confirmed exhausted. If success, estimation was off. Reactive safety net is the final arbiter
- **Permanent until topUp()**: Once confirmed exhausted (estimated <= 0 AND 402 received), provider marked depleted permanently. Only topUp() or new router instance clears it. Consistent with existing 402 -> permanent cooldown
- **Expiry checked at startup AND mid-session**: Date.now() > expiresAt check before each call. Credits could expire during long-running sessions. Cheap check
- **Expiry warning**: credit:expiring event emitted at startup when expiresAt is within configurable warning threshold (default: 7 days). Gives users time to renew

### Events & Observability

- **credit:low**: Fires when remaining credits drop below configured thresholds (e.g., 20%, 5% remaining). Array-based thresholds like BudgetTracker.alertThresholds. Deduped via Set
- **credit:exhausted**: Fires when credits confirmed exhausted (estimated <= 0 + 402) or expired past expiresAt. Provider removed from chain
- **credit:expiring**: Fires at startup when expiresAt is within warning threshold. Contains provider, daysRemaining, expiresAt
- **credit:recorded as debug log only**: Use debug('pennyllm:credit') for per-call deductions: "Provider X: consumed $0.0012, remaining $4.23 (84.6%)". No EventEmitter noise for routine deductions
- **Extend router.getStatus()**: Add creditStatus per provider entry: { remaining, consumed, balance, expiresAt, percentUsed }. Natural extension of existing ChainEntryStatus

### Claude's Discretion

- Credit unit (dollars vs provider-native) — pick what makes config simplest across providers
- StorageBackend key pattern for credit consumption records
- Exact CreditTracker internal architecture (how it composes with ChainExecutor)
- How topUp() interacts with persisted consumed amount
- credit:expiring warning threshold default and config field name
- Whether credit check happens before or after cooldown check in chain executor

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Gap analysis (Phase 13 input)

- `docs/providers/GAP-REPORT.md` -- P2-2 defines credit tracking scope: SambaNova $5/30-day, NVIDIA 402 handling
- `.planning/phases/12.1-provider-nuance-gap-analysis/12.1-01-PLAN.md` -- Gap report plan with provider-by-provider analysis

### Phase 12 context (prior decisions)

- `.planning/phases/12-provider-overhaul-validation/12-CONTEXT.md` -- Provider tier system (free/trial/paid), credits field, reactive cooldown design, chain executor architecture

### Existing code patterns

- `src/budget/BudgetTracker.ts` -- Parallel pattern: micro-dollar storage, fire-and-forget recording, threshold events, monthly window
- `src/usage/cooldown.ts` -- CooldownManager with provider-level depletion, storage persistence, isProviderDepleted()
- `src/chain/ChainExecutor.ts` -- Chain walking logic where credit check will integrate (budget gate at line 165)
- `src/wrapper/error-classifier.ts` -- 402 -> permanent cooldown classification (line 120-129)
- `src/config/schema.ts` -- Existing providerConfigSchema with credits field, timeWindowSchema, Zod cross-field validation patterns

### Provider intelligence

- `docs/providers/notes/sambanova.md` -- $5 signup credit, 30-day expiry, free vs developer tier
- `docs/providers/notes/nvidia-nim.md` -- Credit legacy (discontinued), 402 handling, unpublished limits

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `BudgetTracker` (src/budget/BudgetTracker.ts): Direct template for CreditTracker. Same pattern: StorageBackend persistence, micro-dollar tracking, threshold events with Set dedup, fire-and-forget recording
- `CooldownManager.setProviderCooldown()` with `cooldownClass: 'permanent'`: Already marks providers as depleted. CreditTracker calls this when credits exhausted
- `CooldownManager.isProviderDepleted()`: ChainExecutor already checks this before attempting calls. CreditTracker just needs to trigger it
- `createTokenLimit/createRateLimit/createCallLimit` (src/config/builders.ts): Builder pattern template for createCreditLimit()
- `RouterEvent` constants (src/constants/index.ts): Add credit:low, credit:exhausted, credit:expiring event names

### Established Patterns

- Fire-and-forget for non-critical ops (events, usage recording) — CreditTracker.recordConsumption() should follow this
- Micro-dollar storage via promptTokens field — avoids StorageBackend interface changes
- Zod cross-field .strict().refine() for config validation (budget+fallback precedent)
- Debug logging via debug('pennyllm:credit') namespace
- Conditional property inclusion for exactOptionalPropertyTypes

### Integration Points

- `ChainExecutor.executeChain()` (src/chain/ChainExecutor.ts line 149-327): Credit check integrates alongside budget check (line 165). For trial-tier providers, check CreditTracker before attempting call
- `createRouter()` (src/config/index.ts): Initialize CreditTracker from config, pass to ChainExecutor deps
- `src/config/schema.ts`: Expand providerConfigSchema.credits from simple number to full object schema
- `getChainStatus()` (src/chain/ChainExecutor.ts line 435): Extend ChainEntryStatus with creditStatus
- `src/types/events.ts`: New credit event payload types
- `src/constants/index.ts`: New RouterEvent entries for credit events
- `package.json exports`: CreditTracker in main entry point

</code_context>

<specifics>
## Specific Ideas

- "don't think of credit as just entering value and starting server and it'll be straight path. think in real world" — drove persistence model: config has ceiling, storage tracks consumed, restarts resume
- "should we include endDate denoting the temp nature of credits" — drove expiresAt field for time-limited credits (SambaNova 30-day)
- BudgetTracker is the direct template — CreditTracker follows the same class structure, storage pattern, and event design

</specifics>

<deferred>
## Deferred Ideas

- **Provider balance API queries** — If providers add balance-check endpoints in the future, CreditTracker could verify estimated remaining. Not needed now since 402 safety net works
- **Tiered cost rates** — Multiple pricing tiers (e.g., different rates after first $X). Single flat rate covers known providers. Add later if needed
- **Per-model credit tracking** — Currently per-provider. If a provider charges different rates per model, per-model tracking could be added
- **Auto-detect credit providers from 402** — Currently config-only. Could auto-create depleted entry on unexpected 402

</deferred>

---

_Phase: 13-credit-based-limits_
_Context gathered: 2026-03-18_
