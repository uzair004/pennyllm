# Research Summary: LLM Cost-Avoidance Router Architecture

**Domain:** LLM API key rotation and cost-avoidance system
**Researched:** 2026-03-11
**Overall confidence:** MEDIUM

*Confidence level reflects that architectural patterns are well-established and applicable, but not verified against current (2026) LLM router implementations or provider APIs. WebSearch was unavailable; findings based on established architectural patterns, Node.js ecosystem knowledge, and project requirements analysis.*

## Executive Summary

An LLM cost-avoidance router should be built as a **transparent proxy/decorator** around an existing base LLM router, following a layered architecture with six core components. The system must be stateful (persistent usage tracking), async throughout, and policy-driven (configurable limits, not hardcoded).

The recommended architecture separates concerns cleanly: Request Interceptor handles the public API, Policy Engine evaluates eligibility based on configurable provider policies, Key Selection Strategy chooses the optimal key using pluggable algorithms (round-robin, least-used, policy-aware), Usage Tracker records consumption across multiple time windows, State Storage persists data (SQLite default, Redis optional), and Fallback Handler manages exhaustion scenarios with configurable behaviors.

Critical architectural decision: build the core engine (Policy Engine, Usage Tracker, State Storage) **before** selecting or integrating a base LLM router. This allows thorough testing of the cost-avoidance logic independently and doesn't block on external package research. The decorator pattern makes swapping base routers trivial once selected.

The primary technical challenges are: (1) accurate multi-window usage tracking (per-minute, hourly, daily, monthly) with proper reset handling, (2) handling race conditions between key selection and exhaustion, and (3) designing flexible policies that accommodate diverse provider limit structures (token-based vs call-based vs time-windowed vs hybrid). The architecture addresses these through declarative policy configuration, state machine-based usage tracking, and pluggable selection strategies.

## Key Findings

**Stack:** TypeScript/Node.js with SQLite for default state storage (Redis optional), async-first APIs throughout, policy engine driven by YAML/JSON config files, decorator pattern for base router integration, round-robin key selection initially with pluggable strategy interface.

**Architecture:** Six-component layered system: Request Interceptor (public API) → Policy Engine (eligibility evaluation) → Key Selection Strategy (algorithm-based selection) → Usage Tracker (multi-window recording) → State Storage (persistence layer) → Fallback Handler (exhaustion management). Base LLM router is wrapped via decorator pattern, not modified or forked.

**Critical pitfall:** Optimistic usage tracking (selecting key, calling API, then recording usage) creates race conditions where keys become exhausted mid-request without tracking. Mitigation: implement state machine for tracking lifecycle, handle failures with rollback/retry logic, mark keys as "in-flight" during calls to prevent concurrent over-selection.

## Implications for Roadmap

Based on research, suggested phase structure:

### 1. **Phase 1: Core Engine (Independent Foundation)**
   - Addresses: State Storage interface + SQLite implementation, Policy Engine with declarative config, Usage Tracker with multi-window support
   - Avoids: Blocking on base router selection, integration complexity upfront, premature provider-specific logic
   - **Why first:** Zero external dependencies, can be unit tested thoroughly with mocks, establishes data models and business logic, highest-risk component (concurrent access, data persistence)
   - **Deliverable:** Working policy evaluation and usage tracking system (tested with synthetic data, no real API calls)
   - **Acceptance criteria:** Can load policies from YAML, track usage across time windows, evaluate key eligibility, persist state to SQLite

### 2. **Phase 2: Selection & Fallback Logic**
   - Addresses: Key Selection Strategy (round-robin algorithm), Fallback Handler (hard-stop mode), pluggable strategy interface
   - Avoids: Algorithm complexity (defers least-used, policy-aware to Phase 4), paid fallback logic (deferred), retry complexity
   - **Why second:** Depends on Phase 1 (needs Policy Engine, Usage Tracker), still independent of base router, completes core routing logic
   - **Deliverable:** Complete routing engine (select key → track usage → fallback if exhausted), tested with mocked API calls
   - **Acceptance criteria:** Round-robin distributes fairly, fallback triggers on exhaustion, errors are descriptive

### 3. **Phase 3: Base Router Integration**
   - Addresses: Base router selection/evaluation, Request Interceptor implementation, adapter pattern wrapping, end-to-end flow with real APIs
   - Avoids: Premature commitment to base router before core logic is proven, multi-provider complexity initially
   - **Why third:** Depends on Phases 1-2 (needs complete routing engine), requires external package research, validates architecture with real LLM calls
   - **Deliverable:** Working router making real API calls with cost-avoidance, tested with 1-2 providers
   - **Acceptance criteria:** Can make LLM requests via base router, keys rotate correctly, usage tracked accurately, errors propagate properly
   - **CRITICAL RESEARCH NEEDED:** Base router package selection, API key injection patterns, usage metadata extraction, error handling

### 4. **Phase 4: Enhanced Features & Multi-Provider**
   - Addresses: Redis storage implementation, advanced selection algorithms (least-used, policy-aware), comprehensive provider support, observability hooks
   - Avoids: Over-engineering before validating core value, premature optimization
   - **Why last:** All are enhancements not MVP blockers, depends on proven architecture from Phase 3, requires real-world usage patterns
   - **Deliverable:** Production-ready features for scale and optimization, support for 5+ providers
   - **Acceptance criteria:** Redis works in multi-process environments, least-used algorithm extends runway, policy-aware optimizes reset windows

### 5. **Phase 5: Free Tier Catalog & DX**
   - Addresses: Default provider policies with researched limits, key acquisition documentation, developer experience polish, npm packaging
   - Avoids: Hardcoding limits that will become stale, assuming docs are accurate without testing
   - **Why last:** Requires empirical testing with real APIs, limits change over time (shouldn't block development), DX improvements need working product
   - **Deliverable:** Comprehensive free tier catalog, example configs, published npm package
   - **CRITICAL RESEARCH NEEDED:** Empirical testing of provider free tier limits, enforcement behavior observation, reset timing validation

### Phase Ordering Rationale

**Dependency-driven:** Phase 1 has no dependencies, Phase 2 depends on 1, Phase 3 depends on 1+2, Phase 4 depends on 1+2+3, Phase 5 depends on all. This enables parallel work on documentation and policy definitions while building sequentially.

**Risk-minimizing:** Building core engine first (Phases 1-2) proves the hardest logic (multi-window tracking, policy evaluation, selection algorithms) before integrating external dependencies. If usage tracking or policy evaluation is flawed, discover it early without tearing out base router integration.

**Testing-optimized:** Phase 1 is 100% unit testable with mocks, Phase 2 adds integration tests (still mocked), Phase 3 requires real API keys for E2E testing, Phase 4 needs multi-process testing environments, Phase 5 requires empirical limit testing. Progressive testing complexity matches development maturity.

**Validation-friendly:** Can ship Phase 1+2 as a "policy simulator" tool that validates configs and selection logic without making API calls, getting early user feedback on policy design and selection behavior before full integration.

**Architecture validation checkpoint:** Phase 3 proves the core assumption (can we wrap a base router with cost-avoidance?). If decorator pattern doesn't work with selected base router, pivot is cheaper before building advanced features in Phase 4.

## Research Flags for Phases

### Phase 1: Core Engine
**Research needed:** MINIMAL
- SQLite schema design for multi-window tracking (standard patterns, high confidence)
- Policy configuration format (declarative YAML/JSON, well-understood)
- Round-robin algorithm (trivial implementation)

**Likelihood:** Can proceed immediately with training data knowledge

### Phase 2: Selection & Fallback
**Research needed:** MINIMAL
- Fallback error handling patterns in Node.js (established best practices)
- Strategy pattern implementation (standard GoF pattern)

**Likelihood:** Can proceed with minimal research

### Phase 3: Base Router Integration
**Research needed:** CRITICAL AND BLOCKING

**Must verify before implementation:**
1. **Base router selection** — What packages exist? Feature comparison? Community adoption? (LiteLLM, Portkey, Vercel AI SDK, OpenRouter, custom?)
2. **API key injection pattern** — Does base router support per-request key override? Or need multiple instances?
3. **Usage metadata extraction** — How does base router return token counts? Standardized or provider-specific parsing?
4. **Error propagation** — HTTP 429 handling? Standard error objects or exceptions?
5. **Streaming compatibility** — Does decorator pattern preserve streaming responses?

**Recommendation:** Dedicate a full research cycle to Phase 3 before starting implementation. Survey LLM router packages, build proof-of-concept with 2-3 options, test with real API calls to validate assumptions.

**Risk:** If decorator pattern incompatible with selected base router, may need architecture pivot to proxy pattern or fork/extend approach.

### Phase 4: Enhanced Features
**Research needed:** MODERATE
- Redis atomic operations for concurrent usage updates (standard patterns, medium confidence)
- Advanced selection algorithms (custom logic, needs validation with real usage data)
- Observability patterns for TypeScript libraries (established practices, medium confidence)

**Likelihood:** Can proceed for Redis implementation, algorithms need empirical validation

### Phase 5: Free Tier Catalog
**Research needed:** CRITICAL, EMPIRICAL, AND ONGOING

**Must research and test:**
1. **Current limits** — What are actual free tier limits per provider? (documentation often outdated)
2. **Enforcement behavior** — Hard block vs throttle vs silent charging? When do limits kick in?
3. **Reset windows** — Calendar month vs rolling 30 days vs fixed dates? What timezone?
4. **Tracking granularity** — Per-minute/hour/day/month? Which windows matter per provider?

**Recommendation:** Cannot be desk research. Requires creating test accounts, making real API calls, observing behavior. Budget time for empirical testing with throwaway keys.

**Risk:** Provider limits change over time. Research findings will require periodic updates. Design system to allow user override of shipped defaults.

**Note:** This is the least "researchable" in advance — fundamentally empirical, not documentary.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Architecture patterns | HIGH | Decorator, Strategy, Policy Engine are proven patterns directly applicable |
| Component boundaries | HIGH | Clear separation of concerns, well-defined interfaces, minimal coupling |
| Build order | HIGH | Dependency graph is unambiguous (1 → 2 → 3 → 4 → 5), tested progression |
| Storage design | MEDIUM | SQLite/Redis patterns well-known, but multi-window schema needs validation under load |
| Selection algorithms | MEDIUM | Round-robin proven simple and fair, least-used/policy-aware need real-world testing |
| Policy configuration | MEDIUM | Declarative format is sound, but ergonomics need user feedback |
| Base router integration | LOW | Unknown until base router package selected and tested (Phase 3 research) |
| Provider API behavior | LOW | Unknown without testing real provider APIs (Phase 3 and 5 research) |
| Free tier limits | VERY LOW | Training data outdated (Jan 2025), limits change frequently, requires empirical testing |

## Gaps to Address

### Architecture gaps (can be resolved with focused research)

1. **Concurrency handling details**
   - What if two processes select same key simultaneously? (SQLite write locks? Redis distributed locks?)
   - Should usage increments be atomic? (Redis HINCRBY? SQLite transactions?)
   - How to handle "in-flight" requests that haven't updated usage yet?

2. **State storage schema optimization**
   - Index strategy for fast "find all keys for provider where usage < limit" queries
   - Partition strategy for time-series data (separate tables per month? JSON columns?)
   - Cleanup strategy for old data (TTL? Manual purge?)

3. **Usage sync frequency tradeoffs**
   - Real-time post-call (accurate but higher latency)
   - Batched async (lower latency but risk of missed limits)
   - Write-through cache (balanced but complex)

### Implementation gaps (phase-specific research required)

**Phase 3 gaps:**
1. Base router API surface and compatibility
2. Provider response formats and token counting methods
3. Error codes and retry strategies per provider
4. Streaming vs non-streaming API differences

**Phase 4 gaps:**
1. Redis connection pooling and failover strategies
2. Algorithm performance with real usage patterns
3. Observability format preferences (events? callbacks? streams? metrics export?)

**Phase 5 gaps:**
1. Provider free tier policies (current limits, enforcement, resets)
2. Key acquisition processes per provider (documentation, automation potential)
3. Provider-specific quirks and workarounds

### Validation gaps (need user feedback or empirical testing)

1. **Policy config format** — Is YAML intuitive for developers? Or prefer TypeScript config objects? JSON?
2. **Selection algorithm defaults** — Should round-robin be default or least-used? Or user must choose?
3. **Fallback behavior defaults** — Hard-stop safe but might surprise users expecting automatic failover. Default to error or cheapest paid?
4. **Error message verbosity** — How much detail in errors? (which key, which limit, when resets, remaining quota?)
5. **Observability defaults** — Should hooks be opt-in or opt-out? What's logged by default?

## Next Steps

### Immediate (before roadmap creation)

1. **Validate architecture assumptions** (if possible without tools)
   - Review PROJECT.md constraints against proposed architecture
   - Ensure decorator pattern aligns with stated requirements
   - Confirm phasing matches project goals

2. **Flag critical unknowns** for orchestrator
   - Base router selection blocks Phase 3
   - Free tier limit research blocks Phase 5
   - Both require external verification tools

### Pre-Phase 1 (before implementation)

No additional research needed. Can begin immediately with:
- SQLite schema design
- Policy config format (start with YAML, JSON schema validation)
- Usage tracking data model
- Round-robin selection algorithm

### Pre-Phase 3 (before base router integration)

**CRITICAL RESEARCH SPRINT REQUIRED:**

1. **Survey existing LLM router packages**
   - Features: model selection, provider abstraction, usage tracking
   - API design: function-based vs class-based, sync vs async
   - Community: adoption, maintenance, documentation quality
   - Options: Vercel AI SDK, LiteLLM, Portkey, OpenRouter client, Langchain JS, others

2. **Test candidate packages with proof-of-concept**
   - Can we inject different API keys per request?
   - How is token usage exposed?
   - Does decorator pattern work or need proxy?
   - Do all features (streaming, tools, structured output) work through wrapper?

3. **Document provider API behaviors**
   - Test with OpenAI, Google, Anthropic, Groq (minimum 4 providers)
   - Record: response format, usage metadata location, error codes, rate limit headers
   - Identify commonalities and outliers

### Pre-Phase 5 (before free tier catalog)

**EMPIRICAL TESTING REQUIRED:**

1. **Create test accounts** for all target providers
2. **Systematically test limits** with scripted requests
   - Token limits: send requests until limit hit
   - Call limits: rapid-fire requests to find per-minute/hour caps
   - Time windows: observe reset behavior (calendar vs rolling)
   - Enforcement: hard block (429) vs throttle vs silent charge
3. **Document findings** with confidence levels (tested vs documented vs assumed)
4. **Design update mechanism** for when limits change (user override, quarterly research, community contributions)

## Architecture Decision Record (Key Choices)

| Decision | Rationale | Alternative Considered | Why Not Alternative |
|----------|-----------|----------------------|---------------------|
| **Decorator pattern** for base router | Non-invasive integration, swappable base routers, preserves full feature set | Fork/extend base router | Creates maintenance burden, locks into specific router, must track upstream changes |
| **Persistent state** required | Free tier limits persist across restarts (e.g., monthly quotas), multi-instance deployment | Ephemeral in-memory only | Inaccurate tracking defeats purpose, usage resets on restart |
| **Policy-as-config** (YAML/JSON) | Providers change limits frequently (can't wait for package releases), users may have custom limits | Hardcoded in TypeScript | Stale data, forces npm updates for limit changes, no user customization |
| **Post-call usage tracking** | Accurate (actual tokens from provider response), accounts for tokenization variance | Pre-call estimation | Inaccurate (tokenization varies by provider/model), cumulative error breaks limits |
| **SQLite default**, Redis optional | Lower barrier to entry (file-based, no external service), simpler local development | Redis-only | Requires external service, complicates simple use cases, higher operational complexity |
| **Round-robin first** algorithm | Simplest to implement and test, fair distribution, predictable behavior | Least-used or policy-aware first | More complex, harder to debug, benefits unclear until tested with real usage |
| **Async APIs throughout** | Storage I/O is async (SQLite, Redis), policy evaluation may need network calls, enables parallel optimization | Synchronous with blocking I/O | Blocks event loop, poor performance under load, incompatible with async base routers |
| **Pluggable selection strategy** | Allows algorithm experimentation without core changes, users can provide custom logic | Single hardcoded algorithm | Inflexible, can't optimize for different use cases, no user extension |
| **Configurable fallback** | Different use cases need different behaviors (hard-stop vs paid fallback), user decides risk tolerance | Hardcoded behavior (always error or always use paid) | One-size-fits-all doesn't work (side projects want $0, production may accept small cost) |

## Open Questions Requiring Verification

### Architecture Questions

1. **Concurrency model** — How to handle multiple concurrent requests selecting keys simultaneously? Lock-based? Optimistic with retry?
2. **State consistency** — Eventual consistency acceptable or strong consistency required? Affects Redis vs SQLite choice.
3. **Error recovery** — If usage tracking fails, should request succeed (optimistic) or fail (pessimistic)?

### Integration Questions

4. **Base router compatibility** — Which routers support decorator pattern? Do any require proxy or fork?
5. **Token counting** — Do all base routers expose token usage? Standardized location or provider-specific?
6. **Streaming** — Can decorator pattern intercept and track streaming responses? Or only non-streaming?
7. **Retry behavior** — Should this package handle retries or delegate to base router?

### Provider Questions

8. **Limit granularity** — Do providers track per-key or per-account? If per-account, multi-key rotation is useless.
9. **Enforcement timing** — Are limits enforced immediately or with delay? Affects safety margin.
10. **Reset precision** — Calendar month boundaries in what timezone? UTC? User's? Provider's?

### Implementation Questions

11. **Storage schema** — Single table with JSON columns or normalized schema? Indexes needed?
12. **Time window tracking** — Store raw events and aggregate on query, or maintain pre-aggregated counters?
13. **Policy versioning** — How to handle policy config changes without breaking existing data?
14. **Observability format** — Events? Callbacks? EventEmitter? Metrics export? All of the above?

## Recommended Immediate Actions

Before roadmap creation:

1. **Review ARCHITECTURE.md** for detailed component designs (already created in `.planning/research/ARCHITECTURE.md`)
2. **Confirm phasing** with orchestrator (does 1 → 2 → 3 → 4 → 5 make sense given project goals?)
3. **Flag research blockers** (Phase 3 and 5 need external verification)
4. **Prepare for Phase 1** (no blockers, can start immediately with SQLite + policies + usage tracking)

Before Phase 3 implementation:

1. **Base router research sprint** (survey packages, test POCs, select winner)
2. **Provider API testing** (real API calls with test keys, document behaviors)
3. **Architecture validation** (confirm decorator pattern works with selected base router)

Before Phase 5 implementation:

1. **Empirical free tier testing** (create test accounts, systematically probe limits)
2. **Enforcement behavior observation** (document hard vs soft limits, reset timing)
3. **Community research** (what limits do other developers report? GitHub issues, forums, etc.)

## Success Criteria for Research Completion

Research is complete when:

- [x] Architecture patterns identified and documented
- [x] Component boundaries defined with clear responsibilities
- [x] Data flow mapped from user request to provider API
- [x] Build order established with dependency rationale
- [x] Routing algorithm options evaluated (round-robin, least-used, policy-aware)
- [x] Storage options compared (SQLite vs Redis)
- [x] Integration patterns analyzed (decorator vs proxy vs fork)
- [x] Critical pitfalls identified with mitigation strategies
- [x] Confidence levels assigned to all findings
- [x] Gaps documented for phase-specific research
- [ ] **BLOCKED:** Base router package evaluated (requires WebSearch/WebFetch)
- [ ] **BLOCKED:** Current free tier limits cataloged (requires WebSearch/WebFetch)
- [ ] **BLOCKED:** Provider API behaviors verified (requires real API testing)

**Blockers resolved by:**
- Base router evaluation: Phase 3 research sprint (dedicated research milestone)
- Free tier catalog: Phase 5 empirical testing (hands-on with real accounts)
- API behavior verification: Phase 3 proof-of-concept (test with real keys)

## Handoff to Roadmap Creation

**For roadmap agent:**

1. **Use phased approach** outlined above (1: Core → 2: Selection → 3: Integration → 4: Enhancement → 5: Catalog)

2. **Phase 1 can start immediately** (no external dependencies, no API keys needed, no research blockers)

3. **Phase 3 MUST include research milestone** (base router selection + POC validation) before implementation

4. **Phase 5 MUST include empirical testing** (not desk research, requires real API accounts and systematic probing)

5. **Consider validation checkpoints:**
   - End of Phase 1: Storage schema works, policies load, usage tracks correctly (unit tests pass)
   - End of Phase 2: Selection is fair, fallback triggers correctly (integration tests pass)
   - End of Phase 3: Real API calls work, cost-avoidance functions (E2E tests pass with real keys)
   - End of Phase 4: Redis works multi-process, algorithms optimize as expected (load tests pass)
   - End of Phase 5: Free tier limits accurate, documentation complete (empirical validation done)

6. **Build research flags into roadmap:**
   - Phase 1: No research needed ✓
   - Phase 2: No research needed ✓
   - Phase 3: RESEARCH MILESTONE (base router + provider APIs)
   - Phase 4: Minimal research (Redis patterns well-known)
   - Phase 5: RESEARCH MILESTONE (empirical free tier testing)

7. **Key insight for scope:**
   - This is NOT "build LLM router from scratch"
   - This IS "add cost-aware key selection layer to existing router"
   - Scope is narrow and focused: usage tracking + policy evaluation + smart selection
   - Roadmap should reflect this constraint (don't reinvent provider abstraction)

8. **Architecture provides:**
   - Component list (6 components defined with boundaries)
   - Data flow (request → intercept → evaluate → select → track → respond)
   - Build order (dependencies explicit, enables parallel docs/tests)
   - Extension points (pluggable strategies, swappable storage, custom policies)

**Critical for roadmap success:**
- Don't skip Phase 3 research (base router selection is load-bearing decision)
- Don't defer Phase 5 testing to post-MVP (free tier catalog is core value prop)
- Do maintain phase independence where possible (Phases 1-2 are fully independent)
- Do include validation gates (confirm architecture works before expanding)

---

*Research completed: 2026-03-11*
*Overall confidence: MEDIUM (solid architectural foundations, requires external verification for integration details)*
*Primary limitation: No WebSearch/WebFetch access for current package versions and provider limits*
*Architecture document: See `.planning/research/ARCHITECTURE.md` for detailed component designs, data flows, and implementation patterns*
