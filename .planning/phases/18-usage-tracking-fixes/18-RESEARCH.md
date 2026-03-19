# Phase 18: Usage & Tracking Fixes - Research

**Researched:** 2026-03-19
**Domain:** Usage tracking, policy evaluation, cooldown management, deduplication
**Confidence:** HIGH

## Summary

Phase 18 addresses 6 bugs in the usage and tracking subsystems. All bugs are clearly identifiable from source code inspection -- no external library research is needed since every fix is internal logic. The bugs range from a simple loop error (rolling-30d querying the same bucket 30 times) to a data structure design issue (Set-based dedup losing all history on overflow).

The fixes are isolated: each bug is in a distinct file/class with no cross-dependencies between the 6 fixes. The primary risk is USAGE-02 (credit bucketing) which touches the storage layer's period key logic and needs careful handling of the monthly window type vs. the credit tracker's "never expire" semantics.

**Primary recommendation:** Fix each bug independently in the exact file where it lives. No architectural changes needed -- these are all localized logic fixes.

<phase_requirements>

## Phase Requirements

| ID       | Description                                                           | Research Support                                                                                                                                |
| -------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| USAGE-01 | Rolling-30d `getUsage()` reports accurate data (not 30x inflated)     | Bug in `UsageTracker.getUsage()` lines 316-324: loop queries same daily bucket 30 times instead of 30 distinct daily buckets                    |
| USAGE-02 | Credit tracking survives month-boundary process restarts              | Bug in `CreditTracker` using `CREDIT_WINDOW` with type `'monthly'` -- `getPeriodKey` generates `YYYY-MM`, so new month = new bucket = lost data |
| USAGE-03 | PolicyEngine handles `limit.value === 0` without producing `Infinity` | Bug in `PolicyEngine.evaluate()` line 100: `effectiveCurrent / limit.value` divides by zero                                                     |
| USAGE-04 | Cooldown backoff counter only increments when no Retry-After header   | Bug in `CooldownManager.setCooldown()` lines 70-72: always increments `consecutiveFailures` regardless of header presence                       |
| USAGE-05 | Round-robin distributes evenly when keys enter/exit cooldown          | Bug in `RoundRobinStrategy.selectKey()`: modulo based on `available.length` which changes dynamically, corrupting cycling                       |
| USAGE-06 | Dedup set uses LRU-style eviction (not bulk clear)                    | Bug in `UsageTracker.record()` lines 93-96: `Set.clear()` drops all 10K entries on overflow                                                     |

</phase_requirements>

## Architecture Patterns

### Bug-by-Bug Fix Locations

```
src/
  usage/
    UsageTracker.ts     # USAGE-01 (getUsage rolling-30d), USAGE-06 (dedup set)
    cooldown.ts         # USAGE-04 (backoff counter)
  credit/
    CreditTracker.ts    # USAGE-02 (credit window bucketing)
  policy/
    PolicyEngine.ts     # USAGE-03 (div-by-zero)
  selection/
    strategies/
      round-robin.ts    # USAGE-05 (modulo drift)
```

### USAGE-01: Rolling-30d 30x Inflation

**File:** `src/usage/UsageTracker.ts` lines 308-324

**Bug:** The `rolling-30d` branch loops 30 times but calls `this.storage.getUsage()` with `{ type: 'daily', durationMs: 86400000 }` every iteration. Since `getUsage()` looks up the current period key (`getPeriodKey(window, Date.now())`), it returns the **same** daily bucket each time. Result: 30x inflation.

**Root cause:** There is no way to query a historical daily bucket -- `getUsage()` always uses `Date.now()` for the period key. The TODO comment on line 315 acknowledges this.

**Fix approach:** Since storage only has the current daily bucket (both MemoryStorage and SqliteStorage key on current period), the realistic fix is to query the single `rolling-30d` window directly instead of trying to sum 30 daily buckets. The `rolling-30d` window type already has its own storage entries (data is recorded per-window in the `record()` method at line 135). Simply query storage with the original `limit.window` (which is `{ type: 'rolling-30d', durationMs: ... }`) and use that result directly -- same as the non-rolling-30d branch.

**Alternative (if historical queries are needed):** For SqliteStorage, query `SELECT SUM(...) FROM usage_counters WHERE window_type = 'daily' AND period_key >= ?` with a date 30 days ago. But MemoryStorage cleans up old period keys, so this only works for SQLite. The simpler fix (query the rolling-30d bucket directly) works for both backends.

**Confidence:** HIGH -- verified by reading both storage implementations and the UsageTracker recording path.

### USAGE-02: Credit Window Month Boundary

**File:** `src/credit/CreditTracker.ts` line 21-24

**Bug:** `CREDIT_WINDOW` is defined as `{ type: 'monthly', durationMs: 100 * 365 * 24 * 60 * 60 * 1000 }`. Despite the 100-year duration, `getPeriodKey()` for `monthly` type returns `YYYY-MM` (line 28 in periods.ts). When a process restarts in a new month, `getUsage()` generates a new period key, so previous consumption is invisible.

Additionally, `cleanupExpired()` in both storage backends deletes rows whose period key differs from the current one -- so even if old data existed, it gets cleaned up.

**Fix approach:** Change the credit window type to something that does not rotate period keys. Options:

1. Use a **fixed period key** for credit storage (e.g., `'credit-lifetime'`). This requires either a new window type or special-casing credit storage.
2. Change `CREDIT_WINDOW` type to use a custom approach: since credits are stored under `credit:{provider}` prefix with keyIndex 0, the simplest fix is to make `getPeriodKey` return a fixed string for a new window type like `'lifetime'`, or change the credit tracker to use `put()` semantics (which stores exact values, not additive) with a fixed key.
3. Simplest: Add a `'lifetime'` window type that always returns a fixed period key (e.g., `'lifetime'`). This requires adding it to the `TimeWindow.type` union and handling it in `getPeriodKey` and `getResetAt`.

**Recommended:** Add a `'lifetime'` window type to `TimeWindow`, return fixed period key `'lifetime'` from `getPeriodKey`, return `new Date(8640000000000000)` (max date) from `getResetAt`. Update `CREDIT_WINDOW` to use `{ type: 'lifetime', durationMs: ... }`. This is clean and explicit.

**Impact on cleanup:** `cleanupExpired()` compares period keys -- a fixed `'lifetime'` key will never differ from itself, so no cleanup occurs. This is correct behavior for credits.

**Confidence:** HIGH -- verified the full chain: `CREDIT_WINDOW` -> `getPeriodKey` -> storage `makeKey` -> `cleanupExpired`.

### USAGE-03: PolicyEngine Division by Zero

**File:** `src/policy/PolicyEngine.ts` line 100

**Bug:** `const percentUsed = (effectiveCurrent / limit.value) * 100;` produces `Infinity` when `limit.value === 0`.

Also in `UsageTracker.getUsage()` lines 349-350: `(1 - remaining / limit.value) * 100` -- same issue but the existing code has a guard: `limit.value > 0 ? ... : 0`. The PolicyEngine lacks this guard.

**Fix:** Add guard: `const percentUsed = limit.value > 0 ? (effectiveCurrent / limit.value) * 100 : 100;`. When limit is 0, the resource is 100% consumed (fully exhausted).

Also need to check that `remaining` on line 99 handles `limit.value === 0` correctly: `Math.max(0, 0 - effectiveCurrent)` = `0`. That is correct.

And `eligible` check on line 118: `status.remaining > 0` -- when limit.value is 0, remaining is 0, so `eligible = false`. Correct behavior.

**Confidence:** HIGH -- single line fix with clear semantics.

### USAGE-04: Cooldown Backoff Always Increments

**File:** `src/usage/cooldown.ts` lines 70-72

**Bug:** After the `if/else` block that determines `cooldownMs`, the code unconditionally increments `consecutiveFailures`:

```typescript
const currentFailures = this.consecutiveFailures.get(key) ?? 0;
this.consecutiveFailures.set(key, currentFailures + 1);
```

When a `Retry-After` header is present, the provider is telling us exactly how long to wait. The backoff counter should NOT escalate because the provider is providing authoritative timing. Only when there is NO header should the counter increment (to enable exponential backoff guessing).

**Fix:** Move the increment inside the `else` block (the no-header branch), or reset to 1 when header is present:

```typescript
if (retryAfterHeader) {
  // Provider gave us timing -- reset counter
  this.consecutiveFailures.set(key, 1);
} else {
  // No header -- escalate backoff
  const currentFailures = this.consecutiveFailures.get(key) ?? 0;
  this.consecutiveFailures.set(key, currentFailures + 1);
}
```

Per the success criteria: "Cooldown backoff counter stays at 1 when the provider sends a Retry-After header" -- so the fix should set it to 1 (not 0) when header is present.

**Confidence:** HIGH -- requirement is explicit about the expected value (1).

### USAGE-05: Round-Robin Modulo Drift

**File:** `src/selection/strategies/round-robin.ts` lines 19-22

**Bug:** The cycling index is tracked per-provider as a raw counter, but modulo is applied against `available.length` which is the count of currently eligible, non-cooldown keys. When a key enters cooldown, `available.length` shrinks, and the same modulo position now points to a different key. When the key exits cooldown, the mapping shifts again. This causes uneven distribution.

**Example:** 3 keys (0,1,2), index=0. All available: selects key 0 (index becomes 1). Key 0 enters cooldown. Available=[1,2], index=1, `1 % 2 = 1`, selects key 2. Key 0 recovers. Available=[0,1,2], index=2, `2 % 3 = 2`, selects key 2 again. Key 0 never gets selected.

**Fix:** Track the index against the full candidate list (all keys, including cooldown). Cycle through all candidates, skipping cooldown/ineligible ones, advancing the counter for each skip. Or simpler: use `keyIndex` as the stable identity rather than array position.

**Recommended approach:** Change the round-robin to cycle through `context.candidates` (the full list) rather than the filtered `available` list. Skip ineligible entries but still advance the counter:

```typescript
selectKey(context: SelectionContext): Promise<SelectionResult> {
  const all = context.candidates;
  const startIndex = this.indices.get(context.provider) ?? 0;

  for (let i = 0; i < all.length; i++) {
    const idx = (startIndex + i) % all.length;
    const candidate = all[idx]!;
    if (candidate.eligible && !candidate.cooldown) {
      this.indices.set(context.provider, (idx + 1) % all.length);
      return Promise.resolve({
        keyIndex: candidate.keyIndex,
        reason: `round-robin position ${idx}`,
      });
    }
  }

  throw new Error('No eligible keys');
}
```

**Confidence:** HIGH -- standard round-robin fix pattern.

### USAGE-06: Dedup Set Bulk Clear

**File:** `src/usage/UsageTracker.ts` lines 92-97

**Bug:** When `recordedRequests.size > 10000`, the code calls `this.recordedRequests.clear()` then re-adds only the current request. This loses all 10,000 entries, meaning recently-seen requests could be double-counted.

**Fix:** Replace `Set<string>` with a bounded LRU-style structure. Options:

1. **Simple approach (no new deps):** Use a `Map<string, true>` and delete the oldest entry (first key via `Map.keys().next()`) when over limit. `Map` preserves insertion order in JavaScript, so `Map.keys().next().value` gives the oldest entry.
2. **Alternative:** Keep two sets (current and previous), swap when current exceeds half the limit. This is a "generational" approach.

**Recommended:** Use a `Map<string, true>` with individual eviction. When size exceeds limit, delete the oldest N entries (e.g., evict the oldest 1000 to avoid per-insert overhead):

```typescript
private recordedRequests: Map<string, true> = new Map();

// In record():
if (this.recordedRequests.has(requestId)) return; // dedup check
this.recordedRequests.set(requestId, true);

if (this.recordedRequests.size > 10000) {
  // Evict oldest entries (Map preserves insertion order)
  const evictCount = 1000;
  const iter = this.recordedRequests.keys();
  for (let i = 0; i < evictCount; i++) {
    const key = iter.next().value;
    if (key !== undefined) this.recordedRequests.delete(key);
  }
}
```

This keeps 9000+ recent entries instead of dropping all 10000.

**Confidence:** HIGH -- `Map` insertion-order guarantee is specified in ES2015+.

## Don't Hand-Roll

| Problem                    | Don't Build                     | Use Instead                     | Why                                                                                   |
| -------------------------- | ------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------- |
| LRU cache                  | Full LRU with get-reorders      | Map with oldest-first eviction  | Dedup set only needs insert-order eviction, not access-order. Map does this natively. |
| Rolling window aggregation | Historical daily bucket queries | Direct rolling-30d window query | Storage already records to rolling-30d buckets. No need for multi-bucket aggregation. |

## Common Pitfalls

### Pitfall 1: Rolling-30d Fix Breaking Recording

**What goes wrong:** Changing how `getUsage()` queries rolling-30d without verifying that `record()` still writes to the same window type.
**Why it happens:** The recording path (line 135) iterates `policy.limits` and writes per-window. If rolling-30d is in the policy limits, data is already stored under that window type.
**How to avoid:** Verify that policies with rolling-30d windows actually write to `rolling-30d` window type in storage. The fix just changes the read path.
**Warning signs:** After fix, `getUsage()` returns 0 for rolling-30d windows.

### Pitfall 2: Lifetime Window Type Propagation

**What goes wrong:** Adding `'lifetime'` to `TimeWindow.type` union but missing exhaustive switch cases.
**Why it happens:** TypeScript exhaustiveness checks (`const _exhaustive: never = window.type`) will catch this at compile time, but only if all switch statements are actually exhaustive.
**How to avoid:** After adding the type, run `tsc --noEmit` to find all exhaustive switches that need updating. Files: `periods.ts` (2 functions), `MemoryStorage.ts` (cleanup), `SqliteStorage.ts` (DURATION_MAP, cleanup).
**Warning signs:** TypeScript compiler errors after adding the union member.

### Pitfall 3: Round-Robin Candidate Order Assumption

**What goes wrong:** Assuming `context.candidates` always has the same order across calls.
**Why it happens:** If the caller constructs candidates differently each time, the round-robin index becomes meaningless.
**How to avoid:** Verify that the caller (likely in the chain executor or selection module) always provides candidates in a stable order (sorted by keyIndex). Check the call site.

### Pitfall 4: Map Iteration During Deletion

**What goes wrong:** Deleting from a Map while iterating its keys.
**Why it happens:** The dedup eviction loop deletes entries from the Map while iterating.
**How to avoid:** Collect keys to delete first, then delete. Or use the iterator approach (which is safe in ES2015+ -- `Map.delete()` during iteration is explicitly allowed per spec).

## Code Examples

### USAGE-01 Fix: Rolling-30d Query

```typescript
// BEFORE (bug): queries same daily bucket 30 times
if (limit.window.type === 'rolling-30d') {
  for (let i = 0; i < 30; i++) {
    const dailyUsage = await this.storage.getUsage(providerName, policy.keyIndex, {
      type: 'daily',
      durationMs: 24 * 60 * 60 * 1000,
    });
    promptSum += dailyUsage.promptTokens;
    // ...
  }
}

// AFTER (fix): query the rolling-30d window directly
// The rolling-30d case is removed -- falls through to the standard single-query path
// (line 332-335 already handles all window types correctly)
usage = await this.storage.getUsage(providerName, policy.keyIndex, limit.window);
```

### USAGE-03 Fix: Division by Zero Guard

```typescript
// BEFORE (bug):
const percentUsed = (effectiveCurrent / limit.value) * 100;

// AFTER (fix):
const percentUsed = limit.value > 0 ? (effectiveCurrent / limit.value) * 100 : 100; // limit.value === 0 means fully consumed
```

### USAGE-04 Fix: Conditional Backoff Increment

```typescript
// BEFORE (bug): always increments
this.cooldowns.set(key, { until: Date.now() + cooldownMs, reason: '429 rate limit' });
const currentFailures = this.consecutiveFailures.get(key) ?? 0;
this.consecutiveFailures.set(key, currentFailures + 1);

// AFTER (fix): only increment when no Retry-After
this.cooldowns.set(key, { until: Date.now() + cooldownMs, reason: '429 rate limit' });
if (retryAfterHeader) {
  // Provider gave authoritative timing -- hold counter at 1
  this.consecutiveFailures.set(key, 1);
} else {
  const currentFailures = this.consecutiveFailures.get(key) ?? 0;
  this.consecutiveFailures.set(key, currentFailures + 1);
}
```

## Validation Architecture

### Test Framework

| Property           | Value                                                          |
| ------------------ | -------------------------------------------------------------- |
| Framework          | vitest (not currently configured -- CLAUDE.md says skip tests) |
| Config file        | none                                                           |
| Quick run command  | `npx tsc --noEmit`                                             |
| Full suite command | `npx tsc --noEmit`                                             |

### Phase Requirements to Test Map

| Req ID   | Behavior                                               | Test Type   | Automated Command                  | File Exists? |
| -------- | ------------------------------------------------------ | ----------- | ---------------------------------- | ------------ |
| USAGE-01 | Rolling-30d returns accurate (not 30x) data            | manual-only | `npx tsc --noEmit` (compile check) | N/A          |
| USAGE-02 | Credit tracking survives month boundary                | manual-only | `npx tsc --noEmit` (compile check) | N/A          |
| USAGE-03 | PolicyEngine handles limit.value === 0                 | manual-only | `npx tsc --noEmit` (compile check) | N/A          |
| USAGE-04 | Backoff counter stays at 1 with Retry-After            | manual-only | `npx tsc --noEmit` (compile check) | N/A          |
| USAGE-05 | Round-robin distributes evenly during cooldown changes | manual-only | `npx tsc --noEmit` (compile check) | N/A          |
| USAGE-06 | Dedup set uses LRU eviction                            | manual-only | `npx tsc --noEmit` (compile check) | N/A          |

### Sampling Rate

- **Per task commit:** `npx tsc --noEmit`
- **Per wave merge:** `npx tsc --noEmit`
- **Phase gate:** Full compile check before verification

### Wave 0 Gaps

None -- CLAUDE.md explicitly says "Build first, test later" and "Do NOT create test files unless the plan specifically calls for them." Compile check via `tsc --noEmit` is sufficient verification.

## Open Questions

1. **Rolling-30d: Is historical aggregation ever needed?**
   - What we know: Recording writes to both daily AND rolling-30d windows (per policy limits). The rolling-30d storage bucket already accumulates totals.
   - What's unclear: Whether the rolling-30d bucket properly resets/rolls over. With MemoryStorage, it uses `getPeriodKey('rolling-30d', Date.now())` which returns today's date -- so it only holds today's data, not 30 days.
   - Recommendation: For now, query the rolling-30d bucket directly (matches what's recorded). True rolling aggregation would need a storage-layer enhancement (out of scope per REQUIREMENTS.md: "Rolling-30d fix is minimal; full redesign is v3").

2. **Lifetime window type: impact on SQLite cleanup**
   - What we know: SqliteStorage's `cleanupExpired()` compares period keys. A fixed `'lifetime'` key will never be cleaned up.
   - What's unclear: Whether the cleanup statement `DELETE FROM usage_counters WHERE window_type = ? AND period_key < ?` would accidentally delete lifetime rows (since `'lifetime' < 'lifetime'` is false, this is safe).
   - Recommendation: Safe to proceed. Add `'lifetime'` to `DURATION_MAP` in SqliteStorage.ts.

## Sources

### Primary (HIGH confidence)

- Direct source code inspection of all affected files
- `src/usage/UsageTracker.ts` -- USAGE-01, USAGE-06 bugs verified
- `src/usage/cooldown.ts` -- USAGE-04 bug verified
- `src/credit/CreditTracker.ts` -- USAGE-02 bug verified
- `src/policy/PolicyEngine.ts` -- USAGE-03 bug verified
- `src/selection/strategies/round-robin.ts` -- USAGE-05 bug verified
- `src/storage/MemoryStorage.ts` -- storage behavior verified
- `src/sqlite/SqliteStorage.ts` -- SQLite storage behavior verified
- `src/usage/periods.ts` -- period key generation verified

## Metadata

**Confidence breakdown:**

- Standard stack: N/A - no external libraries needed for these fixes
- Architecture: HIGH - all bugs are localized, fixes are straightforward
- Pitfalls: HIGH - verified against actual code paths and type system behavior

**Research date:** 2026-03-19
**Valid until:** Indefinite (internal bug fixes, no external dependency concerns)
