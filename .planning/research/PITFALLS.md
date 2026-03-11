# Domain Pitfalls: LLM Cost-Avoidance Router

**Domain:** LLM API cost management and key rotation
**Researched:** 2026-03-11
**Confidence:** LOW (unable to verify current ToS, provider policies, or recent changes due to tool restrictions)

**RESEARCH LIMITATION:** This research is based on training data (cutoff January 2025) without ability to verify current provider Terms of Service, API documentation, or recent policy changes. All findings should be validated against current official sources before implementation.

---

## Critical Pitfalls

Mistakes that cause account suspension, financial liability, or require architectural rewrites.

### Pitfall 1: Terms of Service Violations via Multiple Accounts

**What goes wrong:** Creating multiple accounts per provider to multiply free tier limits violates most providers' ToS, leading to account suspension, API key revocation, or being permanently banned from the service.

**Why it happens:**
- Developers assume free tier = unlimited if you rotate accounts
- ToS often prohibit "abuse" of free tiers without defining clear boundaries
- Device fingerprinting and IP tracking can link multiple accounts to same user
- Providers explicitly prohibit circumventing rate limits via multiple accounts

**Consequences:**
- All accounts associated with your identity get banned
- Loss of access to the provider entirely (not just free tier)
- Potential financial liability if ToS includes penalty clauses
- Reputational damage if building for commercial use
- Legal exposure if provider pursues ToS violation claims

**Prevention:**
1. **Read and comply with each provider's ToS** — document findings in provider policies
2. **Default to single key per provider** — make multi-key opt-in with clear warnings
3. **Add ToS compliance warnings** — display when user configures multiple keys
4. **Document risk** — README must explicitly state "multiple accounts may violate ToS"
5. **Consider alternative approach** — rotate across different providers instead of multiple accounts per provider
6. **Provide audit mode** — log which keys/accounts are being used for compliance review

**Detection:**
- User configures multiple keys for same provider
- Usage patterns show rapid switching between keys
- Provider sends warning emails about suspicious activity
- API errors indicating account review or suspension

**Phase mapping:** Phase 1 (Configuration) — must address in initial design before any key rotation logic.

**Confidence:** LOW — Cannot verify current ToS for OpenAI, Anthropic, Google, Groq, OpenRouter, or other providers.

---

### Pitfall 2: Race Conditions in Concurrent Usage Tracking

**What goes wrong:** Multiple concurrent API calls to the same provider cause usage counters to be out of sync, leading to accidental overage charges when requests exceed free tier limits.

**Why it happens:**
- Node.js applications handle many concurrent requests
- Usage tracking has check-then-act race window: `if (usage < limit) { makeRequest(); updateUsage(); }`
- Redis/SQLite operations are not atomic by default
- Token estimation happens before call, actual usage updated after, creating timing gap
- Multiple applications sharing same storage compound the problem

**Consequences:**
- Free tier limits exceeded without triggering fallback behavior
- Unexpected charges appear on billing
- Hard-to-reproduce bugs that only manifest under load
- Usage dashboards show incorrect numbers
- Budget caps fail to prevent charges

**Prevention:**
1. **Atomic operations** — use Redis INCRBY or SQLite transactions with locks
2. **Pessimistic locking** — reserve quota before making call: `INCR usage_counter`; if over limit, rollback
3. **Pre-call validation** — increment counter BEFORE making API call (even if call fails, count it as used)
4. **Idempotency keys** — track each request by ID to prevent double-counting on retries
5. **Circuit breaker pattern** — if usage reaches 95% of limit, stop routing to that key entirely
6. **Token reservation system** — allocate tokens from quota before call, release on failure
7. **Distributed locking** — if using Redis, implement proper locking for multi-service scenarios

**Detection:**
- Usage counter exceeds provider limit in tracking but no fallback triggered
- Billing shows charges when budget was set to $0
- Race conditions in logs: multiple requests passed limit check
- Token usage totals don't match provider dashboard
- SQLite "database is locked" errors under concurrent load

**Phase mapping:** Phase 2 (State Management) — critical for storage implementation.

**Code example (wrong):**
```typescript
// RACE CONDITION: Two concurrent calls both pass check
const usage = await getUsage(apiKey);
if (usage < FREE_TIER_LIMIT) {
  const response = await makeAPICall(apiKey); // Both requests make it here
  await updateUsage(apiKey, response.usage);
}
```

**Code example (correct):**
```typescript
// ATOMIC: Reserve tokens before call
const reserved = await reserveTokens(apiKey, estimatedTokens);
if (!reserved) {
  return await fallbackToNextKey();
}
try {
  const response = await makeAPICall(apiKey);
  await updateActualUsage(apiKey, response.usage, estimatedTokens);
} catch (error) {
  await releaseTokens(apiKey, estimatedTokens); // Rollback on failure
  throw error;
}
```

**Confidence:** HIGH — This is a well-known distributed systems problem.

---

### Pitfall 3: Silent Charging After Free Tier Exhaustion

**What goes wrong:** Provider starts charging without clear warning when free tier is exhausted, especially when user has payment method on file. No error is thrown, charges accumulate silently.

**Why it happens:**
- Most providers default to "seamless transition" from free to paid
- APIs return successful responses whether using free or paid tier
- No HTTP header or response field indicates billing status
- Provider dashboards update billing with delays (hours to days)
- Some providers have "soft limits" that warn vs "hard limits" that block

**Consequences:**
- Unexpected charges accumulate (potentially hundreds/thousands of dollars)
- Users discover charges days later when bill arrives
- No programmatic way to detect charging has started
- Budget caps in your code don't help if provider doesn't enforce them
- Small test projects can rack up significant bills

**Prevention:**
1. **Never store payment methods** — encourage users to use providers without payment info
2. **Provider-level billing alerts** — document how to set up in provider dashboard
3. **Hard budget caps at provider level** — use provider's billing limit features if available
4. **Conservative local limits** — set tracking limits at 80% of provider's actual limit
5. **Regular provider dashboard checks** — log recommendations to check billing status
6. **Polling provider usage APIs** — some providers expose current usage/billing status
7. **Request ID tracking** — log every request ID to cross-reference with provider billing
8. **Fail closed** — if quota status is uncertain, refuse to make call

**Detection:**
- Provider dashboard shows charges when you expected $0
- Response times change (paid tier may be faster/slower)
- Rate limits change unexpectedly (paid tiers often have different limits)
- Monthly billing emails arrive with charges

**Phase mapping:** Phase 1 (Configuration) — design must assume silent charging. Phase 3 (Monitoring) — add provider dashboard polling if APIs available.

**Provider-specific notes:**
- **OpenAI:** Seamless transition to paid with payment method on file
- **Anthropic:** Requires payment method even for free tier (as of knowledge cutoff)
- **Google Gemini:** Hard blocks after free tier limit (as of knowledge cutoff)
- **Groq:** Hard blocks after free tier limit (as of knowledge cutoff)

**Confidence:** MEDIUM — Behavior patterns known, but specific provider policies may have changed since January 2025.

---

### Pitfall 4: Token Counting Accuracy — Estimation vs Reality

**What goes wrong:** Pre-call token estimation differs significantly from actual token usage, causing either premature quota exhaustion (over-estimation) or accidental overages (under-estimation).

**Why it happens:**
- Different tokenization algorithms per model/provider (GPT uses tiktoken, Claude uses different encoding)
- Special tokens, system prompts, and function calling add uncounted tokens
- Streaming responses may have different token counts than non-streaming
- Model-specific overhead (some models add hidden tokens for formatting)
- Provider APIs may round or calculate differently than their tokenizer libraries
- Multi-turn conversations accumulate hidden context tokens

**Consequences:**
- Under-estimation: Exceed free tier limits and trigger charges
- Over-estimation: Waste free tier quota, premature key rotation
- Usage tracking shows 10-30% error rate vs provider dashboard
- Budget planning becomes unreliable
- Different errors for different model families (GPT-4 vs Claude vs Gemini)

**Prevention:**
1. **Use provider's official tokenizers** — tiktoken for OpenAI, official libs for others
2. **Add safety margin** — count estimated tokens * 1.2 to account for hidden overhead
3. **Track estimation accuracy** — log estimated vs actual, calculate error rates per model
4. **Post-call reconciliation** — update usage with actual token count from response
5. **Model-specific overrides** — maintain per-model adjustment factors based on observed errors
6. **Function calling multiplier** — add 20-50% overhead for function/tool use prompts
7. **System prompt inclusion** — add system prompt tokens to every request estimate
8. **Periodic re-calibration** — compare tracked usage to provider dashboard monthly

**Detection:**
- Provider dashboard shows different usage than local tracking
- Consistent over/under by percentage across multiple calls
- Function calling requests show larger discrepancies
- Streaming vs non-streaming show different error patterns
- Multi-turn conversations drift further from estimates over time

**Phase mapping:** Phase 2 (Usage Tracking) — implement estimation with safety margins. Phase 3 (Monitoring) — add accuracy tracking and auto-calibration.

**Example error rates (from training data, may be outdated):**
- GPT-4: ±5% with tiktoken
- Claude: ±10% (no official tokenizer as of knowledge cutoff)
- Gemini: ±15% (tokenization less documented)
- Function calling: +20-50% overhead
- System prompts: Often uncounted by naive implementations

**Confidence:** MEDIUM — Tokenization behavior known but provider implementations may have changed.

---

### Pitfall 5: Stale Provider Policy Data

**What goes wrong:** Provider free tier limits, rate limits, and pricing change frequently (monthly or quarterly), making hardcoded or infrequently updated policies dangerously outdated.

**Why it happens:**
- Providers adjust free tiers based on abuse patterns and business needs
- New model releases have different limits than previous generations
- Rate limits tighten during high-demand periods or expand during competition
- Pricing changes with little notice (sometimes as short as 30 days)
- Different limits for different regions or user tiers (verified vs unverified accounts)

**Consequences:**
- Routing logic uses wrong limits, causing overages or wasted quota
- Rate limit violations when provider has tightened limits
- False "quota exhausted" when provider has increased limits
- Wrong model selection when pricing changes make different model cheaper
- Users get charged when provider has eliminated free tier
- Security vulnerabilities if provider has added new restrictions

**Prevention:**
1. **Configurable policies** — never hardcode limits, always load from config
2. **Version policies** — timestamp each policy: `gemini_pro_free_tier_v2026_01.json`
3. **Update notifications** — log warnings when policy is >30 days old
4. **Provider API polling** — fetch current limits from provider APIs if available (OpenAI has usage API)
5. **Community-driven updates** — GitHub repository for provider policies, accept PRs
6. **Changelog documentation** — require users to review policy changes before updating
7. **Fallback to conservative defaults** — if policy is stale, assume lower limits
8. **Validation on startup** — check policy timestamp, warn if stale
9. **Multiple policy sources** — local config overrides default policies

**Detection:**
- Provider API returns errors indicating limit changes
- Rate limit errors when usage should be under limit
- Provider dashboard shows different limits than config
- Community reports of limit changes in issues/discussions
- Provider blog posts or emails announcing changes

**Phase mapping:** Phase 1 (Configuration) — design policy system to be updateable. Phase 3 (Monitoring) — add staleness warnings and update notifications.

**Historical examples (training data, may be outdated):**
- OpenAI: Multiple free tier adjustments in 2023-2024
- Anthropic: Claude 3 launch changed free tier availability
- Google: Gemini pricing changed multiple times in first 6 months
- Groq: Rate limits adjusted monthly based on capacity

**Confidence:** HIGH — This is a known pattern in API services, though specific examples may be outdated.

---

### Pitfall 6: Insecure API Key Storage

**What goes wrong:** Multiple API keys stored in plaintext, committed to git, or accessible to unauthorized processes, leading to key theft and abuse.

**Why it happens:**
- Developers store keys in .env files and accidentally commit them
- Multiple keys make key management complex, leading to shortcuts
- SQLite databases with keys stored in plaintext
- Redis instances without authentication exposing keys
- Log files containing full API keys in debug output
- Environment variables accessible to all processes on system

**Consequences:**
- Stolen keys used for cryptocurrency mining or spam
- Free tier quota exhausted by attackers
- Paid tier charges racked up by unauthorized usage
- Account suspension for abuse by third party
- Legal liability if keys used for illegal activity
- Difficult to identify which key was compromised in multi-key setup

**Prevention:**
1. **Encrypt at rest** — use encryption for SQLite database, Redis encryption in transit
2. **Environment variable best practices** — never commit .env, use .env.example template
3. **Key masking in logs** — `sk-...abc123` → `sk-...***123` in all output
4. **Least privilege** — separate read/write permissions for key storage
5. **Key rotation support** — make it easy to invalidate and replace compromised keys
6. **Git commit hooks** — use tools like git-secrets to prevent key commits
7. **Provider key restrictions** — use provider features to limit keys to specific IPs/domains
8. **Audit logging** — log every key access with timestamp and caller
9. **Key expiration** — encourage users to regenerate keys periodically
10. **Separate storage** — don't store keys in same database as usage data

**Detection:**
- GitHub/GitLab secret scanning alerts
- Unusual usage patterns on specific keys
- Provider emails about suspicious activity
- Keys showing up in public repositories or leaks
- Usage from unexpected IPs or geolocations
- Sudden quota exhaustion on specific keys

**Phase mapping:** Phase 1 (Configuration) — design secure storage from start. Phase 2 (State Management) — implement encryption and masking.

**Security checklist:**
- [ ] Keys encrypted at rest
- [ ] Keys never logged in full
- [ ] .env in .gitignore
- [ ] Git commit hooks configured
- [ ] Redis authentication enabled
- [ ] SQLite file permissions restricted
- [ ] Provider IP restrictions configured
- [ ] Regular key rotation documented
- [ ] Audit logging implemented

**Confidence:** HIGH — Standard security practices for API key management.

---

## Moderate Pitfalls

Issues that cause bugs, degraded performance, or operational headaches.

### Pitfall 7: Naive Retry Logic Amplifies Costs

**What goes wrong:** Retrying failed API calls without checking failure reason causes rapid quota exhaustion, especially when rate limited.

**Why it happens:**
- Rate limit errors (429) get retried immediately, triggering more rate limits
- Network timeouts retry with same key instead of rotating to fresh key
- Exponential backoff not implemented, leading to retry storms
- Streaming failures retry entire request, doubling token usage
- Context length errors (400) get retried without truncation

**Prevention:**
1. **Error classification** — rate limit (429) → rotate key; auth (401) → disable key; validation (400) → don't retry
2. **Exponential backoff** — wait 1s, 2s, 4s, 8s before retry
3. **Retry budget** — max 3 retries per request across all keys
4. **Key rotation on 429** — never retry rate limit error with same key
5. **Partial success handling** — streaming responses that partially succeed should not retry consumed tokens

**Detection:**
- Spike in token usage after transient errors
- Rate limit errors in cascading pattern
- Same request retried 10+ times
- Usage counters show duplicate requests

**Phase mapping:** Phase 2 (Routing Logic) — implement smart retry with error classification.

**Confidence:** HIGH — Standard retry pattern pitfalls.

---

### Pitfall 8: Ignoring Provider-Specific Reset Windows

**What goes wrong:** Assuming all providers use calendar month resets when many use rolling windows or per-minute rate limits.

**Why it happens:**
- Developers assume "monthly free tier" means calendar month
- Some providers use 30-day rolling windows from first API call
- Per-minute rate limits need separate tracking from monthly quotas
- Reset times are in provider's timezone, not user's timezone

**Prevention:**
1. **Per-provider reset logic** — configurable reset windows in provider policies
2. **Rolling window tracking** — track usage with 30-day sliding window for rolling resets
3. **Timezone handling** — store reset times in UTC, convert for display
4. **Multiple limit types** — track both rate limits (per-minute) and quota limits (per-month) separately
5. **Reset notifications** — log when quotas reset to help users plan usage

**Detection:**
- Free tier shows as exhausted when new month started
- Rate limits trigger unexpectedly
- Usage tracking shows quota available when provider says exhausted

**Phase mapping:** Phase 2 (Usage Tracking) — implement flexible reset window logic.

**Known patterns (may be outdated):**
- OpenAI: Calendar month reset
- Groq: Per-minute rate limits + daily request limits
- Anthropic: Monthly billing cycle (not calendar month)
- Gemini: Per-minute rate limits

**Confidence:** MEDIUM — Reset patterns known but may have changed per provider.

---

### Pitfall 9: Memory Leaks from Long-Running Connections

**What goes wrong:** Streaming connections, WebSocket connections to providers, or connection pooling causes memory leaks in long-running Node.js processes.

**Why it happens:**
- Streaming response handlers not properly cleaned up
- Connection pools grow unbounded
- Event listeners not removed after request completes
- Cached tokenizers held in memory indefinitely
- Usage tracking stores full request/response history

**Prevention:**
1. **Connection limits** — max connections per provider (use `http.Agent` with `maxSockets`)
2. **Streaming cleanup** — always close streams in finally blocks
3. **Event listener cleanup** — remove listeners after request completes
4. **LRU caches** — bound cache sizes for tokenizers and usage history
5. **Memory monitoring** — log memory usage periodically, alert on growth

**Detection:**
- Node.js process memory grows over time
- "MaxListenersExceededWarning" errors
- Slower response times as memory fills
- Out of memory crashes after hours/days

**Phase mapping:** Phase 2 (Core Implementation) — design with cleanup from start.

**Confidence:** HIGH — Common Node.js issue.

---

### Pitfall 10: Missing Fallback Provider Strategy

**What goes wrong:** When all keys for preferred provider are exhausted, router has no strategy for falling back to alternative providers with different model names.

**Why it happens:**
- Router assumes one-to-one mapping between model name and provider
- No equivalent model mapping across providers (GPT-4 on OpenAI, but what's the Gemini equivalent?)
- Different model capabilities make direct substitution risky
- User expects specific model, doesn't want automatic substitution

**Prevention:**
1. **Model equivalency table** — map models to equivalents: `gpt-4` → [`claude-3-opus`, `gemini-pro`]
2. **Capability-based routing** — route by capability (reasoning, coding) not model name
3. **Explicit fallback config** — user defines fallback chain: `gpt-4 → claude-3 → gemini`
4. **Notification on fallback** — log warning when falling back to different provider
5. **Quality degradation tolerance** — configurable: fail hard vs accept cheaper model

**Detection:**
- Requests fail when one provider exhausted but others available
- Users manually switch between providers
- Quality complaints when model silently changes

**Phase mapping:** Phase 2 (Routing Logic) — design fallback strategy with user control.

**Confidence:** HIGH — Architectural decision needed early.

---

## Minor Pitfalls

Annoyances that degrade developer experience but don't break functionality.

### Pitfall 11: Poor Observability of Key Rotation

**What goes wrong:** Developers can't easily see which key is being used, why keys were rotated, or when quotas will reset.

**Prevention:**
- Structured logging with key IDs (masked), rotation reasons, quota status
- Dashboard/CLI for viewing current state of all keys
- Metrics export (Prometheus/StatsD) for quota usage, rotation frequency
- Debug mode that explains routing decisions in detail

**Phase mapping:** Phase 3 (Monitoring & DX) — add after core functionality works.

**Confidence:** HIGH — Standard observability needs.

---

### Pitfall 12: Confusing Configuration Schema

**What goes wrong:** Users misconfigure provider policies, leading to silent failures or unexpected behavior.

**Prevention:**
- JSON schema validation on config load
- Helpful error messages for common mistakes
- Config templates for each major provider
- Documentation with complete examples
- Dry-run mode that validates config without making calls

**Phase mapping:** Phase 1 (Configuration) — design clear schema from start.

**Confidence:** HIGH — UX design principle.

---

### Pitfall 13: Lack of Testing Infrastructure

**What goes wrong:** Can't test routing logic without consuming real API quotas or mocking every provider.

**Prevention:**
- Mock mode that simulates provider responses
- Test fixtures for different provider error conditions
- Chaos engineering: inject failures to test retry logic
- Local provider simulator for integration tests
- Record/replay mode for API calls

**Phase mapping:** Phase 4 (Testing) — build test infrastructure alongside core features.

**Confidence:** HIGH — Testing best practices.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Configuration Design | Pitfall 1 (ToS violations) | Add warnings for multi-key setup, require explicit opt-in |
| Configuration Design | Pitfall 12 (confusing config) | JSON schema validation, clear examples |
| State Management | Pitfall 2 (race conditions) | Atomic operations from day 1, test concurrency early |
| State Management | Pitfall 6 (key storage) | Encrypt from start, never store plaintext |
| Routing Logic | Pitfall 3 (silent charging) | Conservative limits, fail closed |
| Routing Logic | Pitfall 7 (retry logic) | Error classification, exponential backoff |
| Routing Logic | Pitfall 10 (fallback strategy) | Design model equivalency mapping early |
| Usage Tracking | Pitfall 4 (token counting) | Use official tokenizers, add safety margins |
| Usage Tracking | Pitfall 8 (reset windows) | Flexible per-provider reset logic |
| Monitoring | Pitfall 5 (stale policies) | Version policies, staleness warnings |
| Monitoring | Pitfall 11 (poor observability) | Structured logging, metrics export |
| Implementation | Pitfall 9 (memory leaks) | Connection limits, cleanup handlers |

---

## Research Gaps

Due to lack of access to verification tools, the following areas require validation before implementation:

1. **Current ToS for all providers** — OpenAI, Anthropic, Google, Groq, OpenRouter, HuggingFace, Chinese providers
   - Multi-account policies
   - Free tier abuse definitions
   - IP/device fingerprinting practices

2. **Current free tier limits** — All target providers
   - Token limits
   - Rate limits (per-minute, per-day, per-month)
   - Reset window types (calendar vs rolling)
   - Regional differences

3. **Silent charging behavior** — Per provider
   - Hard block vs soft transition
   - Billing warning mechanisms
   - API indicators of billing status

4. **Token counting APIs** — Current state
   - Official tokenizer libraries per provider
   - Accuracy of estimation vs actual
   - Special token handling

5. **Provider API stability** — Recent changes
   - Breaking changes in last 12 months
   - Deprecation notices
   - New authentication requirements

**Recommended approach:** Create a separate research phase for each provider before implementing routing logic. Maintain a living document of provider policies in repository.

---

## Sources

**NONE** — Research based entirely on training data (cutoff January 2025) without ability to verify current information. All findings marked as LOW confidence unless based on fundamental distributed systems principles (race conditions, security, etc.).

**Required verification before implementation:**
- Each provider's current Terms of Service
- Each provider's current API documentation
- Each provider's current free tier limits and reset policies
- Community reports of recent provider changes (GitHub issues, Reddit, Discord)
- Security best practices for current Node.js/TypeScript versions

---

**Next steps for roadmap:**
1. Phase 0: Provider Policy Research — validate all ToS and limits before any coding
2. Phase 1: Configuration — design with ToS compliance and security from start
3. Phase 2: Core Logic — address race conditions and token counting atomicity
4. Phase 3: Monitoring — track accuracy and policy staleness
5. All phases: Regular provider policy updates as ongoing maintenance
