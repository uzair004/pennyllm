# Feature Landscape

**Domain:** LLM Cost-Avoidance Router (TypeScript npm package)
**Researched:** 2026-03-11
**Confidence:** MEDIUM (based on project requirements and cost-optimization domain patterns)

---

## Table Stakes

Features users expect. Missing = product feels incomplete or broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Multi-key support per provider** | Core value prop — multiplying free tier limits requires multiple keys | Medium | Requires key registry, concurrent usage tracking |
| **Persistent usage tracking** | Free tier limits persist across restarts (monthly quotas) | Medium | SQLite/Redis storage, schema design for multi-window tracking |
| **Configurable provider policies** | Provider limits change frequently, can't wait for package updates | Low | YAML/JSON config with schema validation |
| **Automatic key rotation** | Main automation benefit — shouldn't need manual key selection | Medium | Selection algorithm (round-robin minimum), policy evaluation |
| **Limit enforcement** | Must prevent exceeding free tier (avoid charges) | Medium | Pre-call validation, post-call tracking, atomic updates |
| **Hard-stop on exhaustion** | Safety net for $0 budget goal | Low | Throw error when all keys exhausted |
| **Token usage tracking** | Providers charge by tokens, must track accurately | High | Per-provider tokenizers, estimation + actual reconciliation |
| **Time window support** | Providers use different reset windows (minute, day, month) | High | Multi-window schema, calendar vs rolling windows |
| **Basic error handling** | Distinguish rate limit vs auth vs network errors | Medium | Error classification, helpful messages |
| **Minimal config** | Should work with just API keys and provider names | Low | Sensible defaults, optional overrides |

---

## Differentiators

Features that set product apart. Not expected, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Multiple storage backends** | Redis for prod, SQLite for dev — flexibility | Medium | Abstract storage interface, pluggable implementations |
| **Pluggable selection algorithms** | Round-robin, least-used, custom — user choice | Medium | Strategy pattern, extensible interface |
| **Provider policy versioning** | Track policy changes over time, audit compliance | Low | Timestamp policies, warn on staleness |
| **Observability hooks** | Integrate with monitoring without forking | Medium | Event callbacks for key selection, usage updates, limits |
| **Dry-run mode** | Validate config without consuming API quota | Low | Mock provider responses, simulate routing |
| **Usage forecasting** | "At current rate, quota exhausted in X days" | Medium | Historical usage analysis, trend projection |
| **Budget alerts** | Proactive warnings before hitting limits | Low | Threshold-based hooks, configurable percentages |
| **Multi-provider fallback** | Auto-route to alternative provider when primary exhausted | High | Model equivalency mapping, quality considerations |
| **Request batching** | Optimize usage by batching small requests | High | Complex implementation, provider support varies |
| **Rate limit prediction** | Pre-emptively avoid rate limits before hitting them | Medium | Track request patterns, predict limit exhaustion |

---

## Anti-Features

Features to explicitly NOT build (at least initially).

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Automatic API key provisioning** | Security risk, ToS violations, complexity | Document how to obtain keys manually |
| **Hosted proxy service** | Infrastructure cost, operational burden, scope creep | Library/SDK only (runs in user's process) |
| **Custom LLM model implementations** | Out of scope, base router handles this | Wrap existing router, don't reimplement |
| **Image/video/audio model support** | Different pricing models, different limits, complexity | Text LLMs only for v1 |
| **Prompt optimization/caching** | Different problem domain, separate tools exist | Focus on cost-avoidance via key rotation |
| **Model performance benchmarking** | Unrelated to cost optimization | Delegate to other tools |
| **Built-in retry logic** | Base router should handle this | Intercept errors, don't implement retries |
| **Request queue management** | Adds complexity, most users don't need it | Let user implement if needed |
| **Multi-tenant isolation** | Enterprise feature, MVP is single-user | Document how to namespace keys if needed |
| **API key sharing/rotation service** | Security nightmare, ToS violations | Each user manages their own keys |
| **Cost tracking for paid tiers** | Different problem (billing analysis vs cost avoidance) | Focus on free tier maximization |
| **Provider uptime monitoring** | Orthogonal concern, other tools exist | Let base router handle provider selection |

---

## Feature Dependencies

```
┌─────────────────────────────────────────────────────────────┐
│                    Foundation Layer                         │
├─────────────────────────────────────────────────────────────┤
│  Storage Interface                                          │
│  ↓                                                           │
│  SQLite Implementation (required)                           │
│  Redis Implementation (optional, depends on Storage)        │
├─────────────────────────────────────────────────────────────┤
│  Policy Engine                                              │
│  ↓                                                           │
│  Configurable Policies (depends on Policy Engine)           │
│  Policy Versioning (depends on Policy Engine)               │
├─────────────────────────────────────────────────────────────┤
│  Usage Tracker                                              │
│  ↓                                                           │
│  Token Tracking (depends on Usage Tracker)                  │
│  Time Window Support (depends on Usage Tracker)             │
│  Persistent Tracking (depends on Storage + Usage Tracker)   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    Selection Layer                          │
├─────────────────────────────────────────────────────────────┤
│  Key Selection Strategy                                     │
│  ↓                                                           │
│  Round-robin Algorithm (depends on Selection + Policy)      │
│  Least-used Algorithm (depends on Selection + Usage)        │
│  Policy-aware Algorithm (depends on Selection + Policy +    │
│                         Usage)                              │
│  ↓                                                           │
│  Automatic Key Rotation (depends on Selection Strategy)     │
├─────────────────────────────────────────────────────────────┤
│  Fallback Handler                                           │
│  ↓                                                           │
│  Hard-stop on Exhaustion (depends on Fallback)             │
│  Multi-provider Fallback (depends on Fallback + base router)│
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    Integration Layer                        │
├─────────────────────────────────────────────────────────────┤
│  Base Router Adapter                                        │
│  ↓                                                           │
│  Error Handling (depends on Adapter)                        │
│  Multi-key Support (depends on Adapter + Selection)         │
│  Limit Enforcement (depends on Adapter + Policy + Usage)    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    Enhancement Layer                        │
├─────────────────────────────────────────────────────────────┤
│  Observability Hooks (depends on all above)                 │
│  Dry-run Mode (depends on Adapter + Policy)                 │
│  Usage Forecasting (depends on Usage Tracker + historical   │
│                     data)                                   │
│  Budget Alerts (depends on Usage Tracker + Hooks)           │
│  Rate Limit Prediction (depends on Usage Tracker + Policy)  │
└─────────────────────────────────────────────────────────────┘
```

---

## MVP Recommendation

### Must-Have (Phase 1-3)

**Core functionality that makes the package useful:**

1. **Multi-key support per provider** — Without this, package has no value prop
2. **Persistent usage tracking (SQLite)** — Limits persist, tracking must too
3. **Configurable provider policies** — Limits change, must be updateable
4. **Automatic key rotation (round-robin)** — Main automation benefit
5. **Token usage tracking** — Accurate limit enforcement requires this
6. **Time window support (basic)** — At minimum: monthly + per-minute
7. **Hard-stop on exhaustion** — Safety net for $0 budget goal
8. **Basic error handling** — Rate limit vs auth vs network distinctions
9. **Minimal config** — Should work with minimal user effort
10. **Base router integration** — Core architecture, wraps existing router

**Rationale:** These 10 features form the minimum viable cost-avoidance router. Without any one, the package either doesn't work or doesn't provide value.

### Nice-to-Have (Phase 4)

**Enhancements that improve experience but aren't blockers:**

1. **Redis storage backend** — Production-ready distributed storage
2. **Least-used selection algorithm** — Optimizes quota consumption
3. **Observability hooks** — Monitoring integration
4. **Policy versioning** — Audit and compliance support
5. **Budget alerts** — Proactive warnings
6. **Dry-run mode** — Config validation without API calls

**Rationale:** Valuable features but MVP works without them. Add based on user feedback.

### Defer (Phase 5+)

**Features that require maturity or different use cases:**

1. **Multi-provider fallback** — Complex, needs model equivalency mapping
2. **Usage forecasting** — Needs historical data to be useful
3. **Rate limit prediction** — Needs real usage patterns to calibrate
4. **Request batching** — Optimization, not core functionality
5. **Policy-aware selection algorithm** — Complex, benefits unclear until tested

**Rationale:** Either require real-world usage data or address edge cases. Ship MVP first, validate value, then enhance.

---

## Feature Prioritization Matrix

| Feature | Value | Effort | Risk | Priority |
|---------|-------|--------|------|----------|
| Multi-key support | HIGH | Medium | Medium (concurrent access) | P0 (MVP) |
| Persistent tracking | HIGH | Medium | Medium (schema design) | P0 (MVP) |
| Configurable policies | HIGH | Low | Low | P0 (MVP) |
| Automatic rotation | HIGH | Medium | Low | P0 (MVP) |
| Token tracking | HIGH | High | High (accuracy) | P0 (MVP) |
| Time window support | HIGH | High | Medium (complexity) | P0 (MVP) |
| Hard-stop exhaustion | HIGH | Low | Low | P0 (MVP) |
| Error handling | HIGH | Medium | Low | P0 (MVP) |
| Minimal config | HIGH | Low | Low | P0 (MVP) |
| Base router integration | HIGH | High | High (unknown router) | P0 (MVP) |
| Redis storage | MEDIUM | Medium | Low | P1 (Enhancement) |
| Least-used algorithm | MEDIUM | Low | Low | P1 (Enhancement) |
| Observability hooks | MEDIUM | Medium | Low | P1 (Enhancement) |
| Policy versioning | MEDIUM | Low | Low | P1 (Enhancement) |
| Budget alerts | MEDIUM | Low | Low | P1 (Enhancement) |
| Dry-run mode | MEDIUM | Low | Low | P1 (Enhancement) |
| Multi-provider fallback | MEDIUM | High | High (model equivalency) | P2 (Later) |
| Usage forecasting | LOW | Medium | Low | P2 (Later) |
| Rate limit prediction | LOW | Medium | Medium (calibration) | P2 (Later) |
| Request batching | LOW | High | High (complex) | P3 (Maybe never) |
| Policy-aware algorithm | LOW | High | Medium (untested value) | P2 (Later) |

**Priority key:**
- **P0 (MVP):** Must have for initial release
- **P1 (Enhancement):** Add in Phase 4 based on feedback
- **P2 (Later):** Consider for Phase 5+ or v2
- **P3 (Maybe never):** Only if users explicitly request

---

## User Stories by Feature

### Multi-key support per provider

**As a** developer building side projects,
**I want to** configure multiple API keys for the same provider,
**So that** I can multiply my free tier limits without manual rotation.

**Acceptance criteria:**
- Can configure 2+ keys for same provider
- Each key tracked independently
- Router automatically selects among available keys
- Configuration validation catches duplicate keys

---

### Persistent usage tracking

**As a** developer,
**I want** usage data to persist across application restarts,
**So that** monthly quotas are accurately tracked even if my app restarts frequently.

**Acceptance criteria:**
- Usage data stored in SQLite/Redis
- Survives application restart
- Tracks per key, not per session
- Historical data retained for analysis

---

### Configurable provider policies

**As a** developer,
**I want to** override default provider limits with my own values,
**So that** I can update policies without waiting for package updates when providers change limits.

**Acceptance criteria:**
- Policies loadable from YAML/JSON config
- User config overrides package defaults
- Schema validation catches errors
- Policy changes apply without code changes

---

### Automatic key rotation

**As a** developer,
**I want** the router to automatically select the best available key,
**So that** I don't have to manually manage key selection in my application code.

**Acceptance criteria:**
- No manual key selection in user code
- Router transparently rotates to next available key
- Selection is deterministic and fair (round-robin)
- Logs explain which key was selected and why

---

### Token usage tracking

**As a** developer with free tier limits,
**I want** accurate token counting for my requests,
**So that** I don't accidentally exceed limits and trigger charges.

**Acceptance criteria:**
- Tracks both prompt and completion tokens
- Uses provider-specific tokenizers
- Reconciles estimated vs actual usage
- Exposes usage metrics for monitoring

---

### Time window support

**As a** developer,
**I want** the router to handle different time windows (per-minute, daily, monthly),
**So that** all provider limit types are correctly enforced.

**Acceptance criteria:**
- Supports per-minute rate limits
- Supports daily request limits
- Supports monthly token quotas
- Handles calendar vs rolling window resets

---

### Hard-stop on exhaustion

**As a** developer with a $0 budget,
**I want** the router to throw an error when all free keys are exhausted,
**So that** I never accidentally incur charges.

**Acceptance criteria:**
- Throws descriptive error when all keys exhausted
- Error includes which provider, which limit hit, when resets
- No requests made after exhaustion
- User can catch error and handle gracefully

---

### Basic error handling

**As a** developer,
**I want** clear error messages that distinguish between different failure types,
**So that** I can debug issues and handle errors appropriately.

**Acceptance criteria:**
- Rate limit errors identified (429)
- Auth errors identified (401)
- Network errors identified
- Error messages include actionable details

---

### Minimal config

**As a** developer,
**I want to** get started with minimal configuration,
**So that** I can quickly integrate the router without reading extensive docs.

**Acceptance criteria:**
- Works with just API keys + provider names
- Sensible defaults for all policies
- Optional overrides for advanced use cases
- Example configs provided

---

### Base router integration

**As a** developer already using an LLM router,
**I want** the cost-avoidance layer to wrap my existing router,
**So that** I don't have to rewrite my application code.

**Acceptance criteria:**
- Wraps existing router via decorator pattern
- Preserves existing router's API
- No breaking changes to user code
- Works with streaming and non-streaming requests

---

### Redis storage backend (P1)

**As a** developer deploying to production with multiple instances,
**I want** shared state storage via Redis,
**So that** usage tracking is accurate across all instances.

**Acceptance criteria:**
- Redis backend implements same interface as SQLite
- Atomic operations for concurrent access
- Configuration via connection string
- Falls back to SQLite if Redis unavailable (optional)

---

### Least-used selection algorithm (P1)

**As a** developer,
**I want** the router to prefer keys with the most remaining quota,
**So that** I maximize total available quota before exhaustion.

**Acceptance criteria:**
- Configurable selection strategy (round-robin OR least-used)
- Least-used selects key with lowest usage percentage
- Handles ties gracefully
- Logs selection reasoning

---

### Observability hooks (P1)

**As a** developer,
**I want** to receive events when keys are selected, limits approached, or fallbacks triggered,
**So that** I can integrate with my monitoring system.

**Acceptance criteria:**
- Configurable event hooks
- Events: key selected, usage recorded, limit warning, fallback triggered
- Hook signature includes relevant context
- Hooks are optional (no-op if not configured)

---

### Multi-provider fallback (P2)

**As a** developer,
**I want** automatic fallback to equivalent models on different providers,
**So that** my application stays operational even if one provider is exhausted.

**Acceptance criteria:**
- Configurable model equivalency mappings
- Automatic fallback to equivalent model
- Logs when fallback occurs
- Quality considerations configurable (e.g., only fall back to same tier)

---

## Feature Interactions & Conflicts

### Positive Interactions

**Multi-key + Automatic rotation:**
- More keys = more rotation opportunities = longer runway

**Time window support + Policy versioning:**
- Different windows for different providers = need versioned policies

**Observability hooks + Budget alerts:**
- Hooks enable alerts without coupling to specific alerting system

**Redis storage + Multi-instance deployment:**
- Redis makes multi-instance safe, SQLite doesn't

### Negative Interactions / Conflicts

**Token tracking accuracy vs Request latency:**
- Accurate tracking requires tokenization before request = added latency
- Mitigation: Async estimation, reconcile after response

**Hard-stop exhaustion vs Multi-provider fallback:**
- Hard-stop says "fail when exhausted", fallback says "try alternative"
- Resolution: Make fallback opt-in, hard-stop default

**Minimal config vs Flexibility:**
- Minimal config hides complexity, but advanced users need control
- Resolution: Sensible defaults + optional overrides

**Persistent tracking vs Privacy:**
- Tracking stores request patterns = potential privacy concern
- Resolution: Store only aggregates (tokens, counts), not prompts/responses

**Automatic rotation vs Provider ToS:**
- Multiple keys may violate provider terms of service
- Resolution: Document risk, user accepts, consider single-key default

---

## Feature Evolution Strategy

### Version 1.0 (MVP)

**Focus:** Core cost-avoidance functionality

**Includes:**
- Multi-key support (2+ keys per provider)
- SQLite storage
- Configurable policies (YAML)
- Round-robin selection
- Token tracking (basic estimation)
- Monthly + per-minute windows
- Hard-stop exhaustion
- Base router integration (1-2 providers)

**Excludes:** Redis, advanced algorithms, observability, forecasting, fallbacks

### Version 1.1 (Enhancement)

**Focus:** Production readiness and observability

**Adds:**
- Redis storage backend
- Least-used selection algorithm
- Observability hooks (events)
- Policy versioning
- Budget alerts (thresholds)
- Dry-run mode

**Maintains:** All v1.0 features

### Version 2.0 (Advanced)

**Focus:** Multi-provider intelligence and optimization

**Adds:**
- Multi-provider fallback (model equivalency)
- Usage forecasting (historical trends)
- Rate limit prediction
- Policy-aware selection algorithm
- Extended provider support (10+ providers)

**Maintains:** All v1.x features

### Version 3.0 (Enterprise - Maybe)

**Focus:** Advanced use cases and scale

**Potential adds:**
- Request batching
- Multi-tenant isolation
- Centralized policy server
- Provider uptime integration
- Cost optimization across providers

**Decision:** Only if user demand justifies complexity

---

## Success Metrics

How to measure if features achieve their goals:

| Feature | Success Metric |
|---------|---------------|
| Multi-key support | Users configure 3+ keys per provider (avg) |
| Automatic rotation | Zero manual key selection in user code (surveys) |
| Token tracking | <5% variance from provider dashboards |
| Hard-stop exhaustion | Zero unexpected charges reported in issues |
| Minimal config | Time-to-first-request < 5 minutes (onboarding analytics) |
| Observability hooks | 30%+ users configure hooks (usage analytics) |
| Multi-provider fallback | 50%+ reduction in exhaustion errors (telemetry) |

---

## Feature Risk Assessment

| Feature | Risk | Mitigation |
|---------|------|-----------|
| Multi-key support | Provider ToS violations | Document risks, require explicit opt-in |
| Token tracking | Inaccuracy leads to overages | Use official tokenizers, add safety margins |
| Time window support | Complexity causes bugs | Comprehensive unit tests, validation |
| Base router integration | Router incompatibility | POC validation before committing |
| Redis storage | External dependency | Make optional, SQLite default |
| Multi-provider fallback | Model quality degradation | Make opt-in, require explicit mapping |
| Usage forecasting | Misleading predictions | Conservative estimates, wide error bars |

---

## Feature Documentation Requirements

Each feature needs:

1. **README section** — Brief description, why it exists
2. **Configuration example** — How to enable/configure
3. **API documentation** — Types, methods, interfaces
4. **Usage example** — Real code snippet
5. **Edge cases** — Known limitations, workarounds
6. **Migration guide** (if breaking) — How to upgrade

**High priority docs:**
- Multi-key configuration (users will do this first)
- Policy configuration (most common customization)
- Error handling (users will encounter errors)
- Storage backends (production deployment needs this)

---

## Sources

- Feature identification based on PROJECT.md requirements
- Prioritization based on cost-avoidance domain patterns
- User stories derived from project goals ("never get charged")
- Dependencies inferred from architectural research (ARCHITECTURE.md)
- Confidence: MEDIUM (based on project requirements, not market validation)

---

*Last updated: 2026-03-11*
*Confidence: MEDIUM (requirements-driven, not user-validated)*
*Note: MVP features reflect PROJECT.md scope, enhancements await user feedback*
