# LiteLLM Evaluation for TypeScript Free Tier Key Rotation Package

**Researched:** 2026-03-11
**LiteLLM Version:** 1.82.0 (released March 1, 2026)
**License:** MIT
**Repository:** https://github.com/BerriAI/litellm
**Verdict:** NOT RECOMMENDED as a base for this project. Use Vercel AI SDK instead.

---

## 1. Library vs Proxy Server: Can LiteLLM Be Imported as a Library?

**Answer: Yes, but only in Python.**

LiteLLM has two deployment modes:

### Python SDK (Library Mode)
- Install: `pip install litellm`
- Import directly: `from litellm import completion` or `from litellm import Router`
- Zero infrastructure required (no Postgres, no Redis, no Docker)
- Supports sync and async calls
- Includes the Router class for load balancing and key rotation
- Best for: solo devs, small teams, prototyping

### Proxy Server Mode (AI Gateway)
- Runs as a standalone HTTP server (FastAPI-based)
- Exposes OpenAI-compatible REST endpoints
- Deployment: Docker, Kubernetes, Helm, or CLI (`litellm --config config.yaml`)
- Requires PostgreSQL for production features (virtual keys, budgets, teams)
- Optionally requires Redis for distributed rate limiting, caching, and multi-instance coordination
- Best for: centralized team management, production deployments

### Minimal Deployment
- **Absolute minimum:** `pip install litellm` + one `completion()` call in Python
- **Proxy minimum:** `litellm --model gpt-3.5-turbo` (single command, no config file)
- **Proxy with config:** `litellm --config config.yaml` (YAML file defining models)
- **Production proxy:** Docker + PostgreSQL + Redis + YAML config

**Key limitation for our project:** The SDK mode is Python-only. There is no way to import LiteLLM as a native TypeScript/JavaScript library.

---

## 2. Provider Support and Free Tiers

### Total Provider Count
- **140+ providers** supported
- **2,600+ models** cataloged with pricing, context windows, and features
- Full provider list: https://docs.litellm.ai/docs/providers
- Model catalog: https://models.litellm.ai/

### Supported Providers (Partial List)
Major cloud: OpenAI, Azure OpenAI, Azure AI, Google Vertex AI, Google AI Studio, Anthropic, AWS Bedrock, AWS Sagemaker
AI/ML platforms: Anyscale, Cohere, Mistral AI, Together AI, Groq, DeepInfra, Fireworks AI, HuggingFace, Replicate
Specialized: AI21, Aleph Alpha, Cerebras, DeepSeek, FriendliAI, Meta Llama, Perplexity AI, xAI
Regional/Emerging: SambaNova, Nebius AI Studio, OVHCloud, Volcano Engine, Scaleway, SAP Generative AI Hub
Open-source/Local: Ollama, vLLM, LM Studio, Llamafile, Xinference, Triton Inference Server
Additional: Baseten, Clarifai, Cloudflare Workers AI, GitHub Models, Lambda AI, Novita AI, NLP Cloud, OpenRouter, Predibase, NVIDIA NIM

### Free Tier Providers (LiteLLM-Compatible)

| Provider | Free Tier Limits | Models | LiteLLM Support |
|----------|-----------------|--------|-----------------|
| **Google AI Studio (Gemini)** | ~1M tokens/min on Gemini 2.5 Flash; free on most Gemini models (2.5 Flash, Flash-Lite, 2.0 Flash) | Gemini 2.5 Flash, 2.0 Flash, Flash-Lite, Gemma | Yes |
| **Groq** | 1,000-14,400 req/day (varies by model), 6,000 tokens/min | Llama 3.3 70B, Mixtral, Gemma | Yes |
| **Mistral AI** | 1 billion tokens/month, 1 req/sec, 500K tokens/min per model | Mistral models, Codestral | Yes |
| **OpenRouter** | 20 req/min, 200 req/day (free tier); 27+ free models | Various (GPT, Claude, Llama, etc.) | Yes |
| **Cloudflare Workers AI** | 10,000 neurons/day | Various open-source models | Yes |
| **HuggingFace Inference** | Models <10GB, rate limited | Open-source models | Yes |
| **xAI (Grok)** | Free tier via Grok 4.1 Fast | Grok models | Yes |
| **Cohere** | 20 req/min, 1,000 req/month | Command models | Yes |
| **DeepSeek** | Free tier available | DeepSeek R1, V3 | Yes |
| **Together AI** | Generous free tier / trial credits | Open-source models | Yes |
| **Cerebras** | Free beta, 8K context limit | Open-source models (fast inference) | Yes |
| **NVIDIA NIM** | 40 req/min (phone verification required) | Various open models | Yes |
| **GitHub Models** | Free tier available | Various models | Yes |
| **Fireworks AI** | $1 trial credit | Open-source models | Yes |
| **Nebius** | $1 trial credit | Various models | Yes |

**Total free tier providers compatible with LiteLLM: 15+ confirmed**

Reference: https://github.com/cheahjs/free-llm-api-resources (comprehensive directory of 45+ free LLM API providers)

---

## 3. Built-in Key Rotation and Load Balancing

**Answer: Yes. LiteLLM has sophisticated built-in key rotation and load balancing via its `Router` class.**

### How It Works

The Router groups multiple deployments under the same `model_name`. When a request comes in, the Router selects one deployment based on the configured routing strategy. Different API keys on the same model are treated as separate "deployments."

### Configuration Example (Python SDK)

```python
from litellm import Router

model_list = [
    {
        "model_name": "gemini-flash",       # user-facing alias
        "litellm_params": {
            "model": "gemini/gemini-2.5-flash",
            "api_key": "key-1",
            "rpm": 15,                        # rate limit for this key
        },
    },
    {
        "model_name": "gemini-flash",       # same alias = load balanced
        "litellm_params": {
            "model": "gemini/gemini-2.5-flash",
            "api_key": "key-2",
            "rpm": 15,
        },
    },
    {
        "model_name": "gemini-flash",
        "litellm_params": {
            "model": "gemini/gemini-2.5-flash",
            "api_key": "key-3",
            "rpm": 15,
        },
    },
]

router = Router(
    model_list=model_list,
    routing_strategy="simple-shuffle",
    num_retries=2,
    allowed_fails=1,
    cooldown_time=60,
)

# Router automatically picks a key
response = await router.acompletion(
    model="gemini-flash",
    messages=[{"role": "user", "content": "Hello!"}]
)
```

### Configuration Example (Proxy YAML)

```yaml
model_list:
  - model_name: gemini-flash
    litellm_params:
      model: gemini/gemini-2.5-flash
      api_key: os.environ/GEMINI_KEY_1
      rpm: 15
  - model_name: gemini-flash
    litellm_params:
      model: gemini/gemini-2.5-flash
      api_key: os.environ/GEMINI_KEY_2
      rpm: 15

router_settings:
  routing_strategy: simple-shuffle
  num_retries: 2
```

### Routing Strategies

| Strategy | Description | Use Case |
|----------|-------------|----------|
| **simple-shuffle** (default) | Random selection, weighted by RPM/TPM if set | General load distribution |
| **usage-based-routing** | Picks based on RPM/TPM headroom | Respect rate limits |
| **least-busy** | Fewest active in-flight requests | Real-time load balancing |
| **lowest-cost** | Uses pricing database to pick cheapest | Cost minimization |
| **latency-based** | Picks deployment with lowest response time | Speed optimization |

### Advanced Features
- **Priority ordering:** `order` parameter (lower = higher priority); requires `enable_pre_call_checks=True`
- **Weighted distribution:** `weight` parameter for biased selection
- **Cooldown mechanism:** After `allowed_fails` failures per minute, deployment is cooled down for `cooldown_time` seconds; auto-recovers after cooldown expires
- **Credential management:** `credential_list` for DRY key configuration across multiple models
- **Per-key/per-team router settings:** Hierarchical resolution (Key > Team > Global)

---

## 4. Cost and Usage Tracking

**Answer: Yes, with detailed granularity -- but full tracking requires the Proxy Server + PostgreSQL.**

### SDK Mode (Library)
- Basic token counting from provider responses
- No persistent cost tracking (in-memory only)
- No per-key spend attribution
- You must implement your own tracking layer

### Proxy Server Mode (Full Tracking)
- **Per API Key:** spend, prompt_tokens, completion_tokens, total_tokens, api_requests
- **Per Provider:** broken down by provider (openai, azure_ai, google, etc.)
- **Per Model:** per-model cost tracking
- **Per Team:** team-level budget enforcement
- **Per User:** user-level spend limits
- **Per Tag:** custom metadata tags for cost allocation by app/environment
- **Daily Activity:** `/user/daily/activity` endpoint provides daily breakdowns by models, providers, and API keys

### Pricing Data
- Maintains pricing database for 2,600+ models
- Automatically applies correct cost per token based on model
- Supports custom pricing (set `input_cost_per_token` and `output_cost_per_token` to 0 for free models)
- Provider-specific tier pricing (Vertex AI PayGo, Bedrock service tiers)

### Budget Enforcement
- Maximum budgets per key, per user, per team
- Automatic enforcement (requests blocked when budget exceeded)
- Budget reset functionality (`/global/spend/reset`)

### Requirements for Full Tracking
- PostgreSQL database (required)
- LiteLLM Proxy Server running (required)
- UI dashboard available at `/ui` for visual spend analysis

---

## 5. Fallback Logic

**Answer: Yes, highly configurable with multiple fallback types.**

### Fallback Types

| Type | Trigger | Example |
|------|---------|---------|
| **General fallbacks** (`fallbacks`) | Any error (rate limit, server error, etc.) | GPT-4 fails -> try Claude |
| **Context window fallbacks** (`context_window_fallbacks`) | `ContextWindowExceededError` | GPT-3.5 -> GPT-3.5-16k |
| **Content policy fallbacks** (`content_policy_fallbacks`) | `ContentPolicyViolationError` | Azure OpenAI -> Anthropic |
| **Default fallbacks** (`default_fallbacks`) | Misconfigured model group | Any model -> default model |

### Fallback Flow
1. Request sent to primary deployment
2. On failure: retry with exponential backoff (up to `num_retries`)
3. After retries exhausted: try other deployments in same model group
4. After all deployments fail: apply fallback to different model group
5. `ROUTER_MAX_FALLBACKS` prevents infinite loops (recommended: 5-10)

### Configuration (SDK)

```python
from litellm import Router

router = Router(
    model_list=model_list,
    fallbacks=[{"gemini-flash": ["groq-llama", "mistral-small"]}],
    context_window_fallbacks=[{"gpt-3.5-turbo": "gpt-3.5-turbo-16k"}],
    num_retries=3,
    retry_after=5,
)
```

### Configuration (Proxy YAML)

```yaml
router_settings:
  fallbacks:
    - gemini-flash: ["groq-llama", "mistral-small"]
  context_window_fallbacks:
    - gpt-3.5-turbo: gpt-3.5-turbo-16k
  num_retries: 3
```

### Fallback Management API (Proxy)
- `POST /fallback/create` -- add fallback models
- `GET /fallback/list` -- retrieve current configuration
- `DELETE /fallback/delete` -- remove fallback models
- Validation ensures configuration is correct before applying

---

## 6. Dependencies and Infrastructure

### Python SDK (Library Mode)

| Dependency | Required? | Purpose |
|------------|-----------|---------|
| Python 3.9+ | Required | Runtime |
| `litellm` PyPI package | Required | Core library |
| PostgreSQL | **Not needed** | N/A in SDK mode |
| Redis | **Not needed** | N/A in SDK mode |
| Docker | **Not needed** | N/A in SDK mode |

The SDK is lightweight with minimal Python dependencies. No external infrastructure needed.

### Proxy Server (Minimal)

| Dependency | Required? | Purpose |
|------------|-----------|---------|
| Python 3.9+ or Docker | Required | Runtime |
| YAML config file | Required | Model/routing configuration |
| `LITELLM_MASTER_KEY` | Required | Admin authentication |

### Proxy Server (Production)

| Dependency | Required? | Purpose |
|------------|-----------|---------|
| PostgreSQL | **Required** | Virtual keys, budgets, teams, spend logs, persistent config |
| Redis | **Optional** (recommended) | Distributed rate limiting, caching, multi-instance coordination, DB deadlock prevention |
| Docker/K8s | Recommended | Container deployment |
| Prometheus | Optional | Metrics export |

### When Redis Becomes Important
- Multi-instance deployments (load balancing across LiteLLM containers)
- 10+ instances (prevents PostgreSQL deadlocks by using Redis queue)
- Caching (reduce API costs and improve response times)
- High-RPS scenarios (500+ req/sec)

### Infrastructure Cost Estimate (Production)
- Typical mid-sized deployment: $200-$500/month on AWS for 1-5M requests/month
- Plus 2-4 weeks initial setup time

---

## 7. TypeScript/Node.js Integration Options

**Answer: No native TypeScript SDK. Three integration paths exist, all with significant drawbacks.**

### Option A: LiteLLM Proxy + OpenAI Node.js SDK (Recommended by LiteLLM)

```typescript
import OpenAI from 'openai';

// Point OpenAI SDK at LiteLLM proxy
const client = new OpenAI({
  apiKey: 'sk-litellm-master-key',
  baseURL: 'http://localhost:4000',  // LiteLLM proxy
});

const response = await client.chat.completions.create({
  model: 'gemini-flash',  // model alias configured in LiteLLM
  messages: [{ role: 'user', content: 'Hello!' }],
});
```

**Pros:** Full LiteLLM features, well-typed OpenAI SDK, production-proven
**Cons:** Requires running a Python proxy server alongside Node.js app; PostgreSQL/Redis for full features; 200-400MB RAM for proxy; additional deployment complexity

### Option B: `litellm` npm package (Community JS Port)

```typescript
import { completion } from 'litellm';

const response = await completion({
  model: 'gpt-3.5-turbo',
  messages: [{ role: 'user', content: 'Hello!' }],
});
```

**Package:** `npm install litellm` (https://github.com/zya/litellmjs)
**Stats:** 357 weekly downloads, 146 GitHub stars, 97 commits total
**Last release:** v0.12.0 (January 3, 2024 -- over 2 years old, effectively abandoned)

**Supported providers (JS port):**
| Provider | Completion | Streaming | Embedding |
|----------|-----------|-----------|-----------|
| OpenAI | Yes | Yes | Yes |
| Ollama | Yes | Yes | Yes |
| Mistral | Yes | Yes | Yes |
| Cohere | Yes | Yes | No |
| Anthropic | Yes | Partial | No |
| AI21 | Yes | No | No |
| Replicate | Yes | No | No |
| DeepInfra | Yes | No | No |

**Missing features (vs Python LiteLLM):**
- NO Router / load balancing / key rotation
- NO caching
- NO proxy
- NO cost tracking
- NO fallback logic
- NO cooldown mechanism
- Only 8 providers (vs 140+)
- No Google Gemini, no Groq, no Cerebras, no Cloudflare, no HuggingFace

**Verdict: Completely unsuitable for our use case.** Abandoned, missing all the features we need, tiny provider support.

### Option C: `@skadefro/litellm` npm package (Fork)

- Fork of the same `litellmjs` codebase
- Latest version: 0.5.1 (published 2+ years ago)
- Zero other projects using it
- Same limitations as Option B

**Verdict: Even less suitable than Option B.**

### Option D: Python Subprocess from Node.js

```typescript
import { execSync } from 'child_process';

// Terrible idea, but technically possible
const result = execSync('python -c "import litellm; print(litellm.completion(...))"');
```

**Verdict: Absurd for production use. Do not consider.**

---

## 8. Limitations for Our Use Case

Our use case: **Lightweight TypeScript npm package for free tier API key rotation management.**

### Critical Blockers

| Limitation | Impact | Severity |
|-----------|--------|----------|
| **Python-only SDK** | Cannot import as TypeScript library; must run proxy server | BLOCKER |
| **Proxy requires infrastructure** | PostgreSQL + Redis for full features defeats "lightweight" goal | BLOCKER |
| **No native TS/JS SDK** | Community port is abandoned, missing all key features | BLOCKER |
| **Heavy runtime overhead** | 200-400MB RAM for proxy; Python GIL limits concurrency | HIGH |
| **Operational complexity** | Users must deploy and maintain a Python proxy server | HIGH |

### Significant Drawbacks

| Limitation | Impact | Severity |
|-----------|--------|----------|
| **No free-tier-specific tracking** | LiteLLM tracks spend in dollars, not free tier quotas per provider | MEDIUM |
| **No multi-window time tracking** | No per-minute + daily + monthly combined limit tracking | MEDIUM |
| **No policy engine for free tiers** | No concept of "this key has X tokens/month free" with enforcement | MEDIUM |
| **GIL performance degradation** | Python's Global Interpreter Lock limits high-concurrency scenarios | MEDIUM |
| **DB scaling issues** | Logging slows after 1M+ logs (reached in ~10 days at 100K req/day) | MEDIUM |
| **Enterprise features paywalled** | SSO, RBAC, team budgets behind paid Enterprise license | LOW (not needed) |

### What LiteLLM Does Well (But We Don't Need via Proxy)

- Provider abstraction (Vercel AI SDK does this natively in TypeScript)
- Unified OpenAI-format API (Vercel AI SDK does this)
- Load balancing across deployments (we need this, but in TypeScript)
- Fallback chains (we need this, but in TypeScript)
- Cost tracking (we need free-tier-specific tracking, not dollar-based)

### Fundamental Mismatch

LiteLLM is designed as a **Python AI gateway for teams managing LLM spend at scale**. Our project is a **TypeScript npm package for individual developers maximizing free tiers**. These are fundamentally different products:

| Aspect | LiteLLM | Our Project |
|--------|---------|-------------|
| Language | Python | TypeScript |
| Deployment | Server/proxy | Library (in-process) |
| Target | Teams, enterprise | Individual devs |
| Cost model | Dollar-based budgets | Free tier quota tracking |
| Infrastructure | Postgres + Redis | SQLite (zero infra) |
| Tracking | Spend per key/team | Free quota remaining per key/window |
| Overhead | 200-400MB RAM | Zero (in-process) |

---

## 9. TypeScript/JavaScript Client or SDK

**Answer: No official TypeScript/JavaScript SDK exists.**

### Official Status
- LiteLLM is a **Python-only** project
- The recommended TypeScript integration is: run the proxy, use the OpenAI Node.js SDK pointed at it
- No plans announced for an official TypeScript SDK

### Community Attempts

| Package | npm Downloads | Last Updated | Providers | Router Support |
|---------|-------------|-------------|-----------|----------------|
| `litellm` (zya/litellmjs) | 357/week | Jan 2024 (abandoned) | 8 | No |
| `@skadefro/litellm` | ~0 | 2+ years ago | 8 | No |
| `@yucekj/litellm` | ~0 | Unknown | Fork | No |

### Related TypeScript Tooling
- `litellm-config-generator` (jvanmelckebeke): CDK-like TypeScript library for generating LiteLLM proxy YAML configs. Not an SDK -- just config generation.

**Verdict: The TypeScript ecosystem for LiteLLM is effectively non-existent.** No production-ready option exists.

---

## 10. Overhead of Running LiteLLM Proxy Alongside Node.js

### Performance Benchmarks (Official)
- **Claimed:** 8ms P95 latency at 1,000 RPS
- **Proxy overhead:** ~3.25ms additional latency vs direct API calls
- **With load balancer:** 30% increase in throughput
- **Q1 2026 target:** Sub-millisecond proxy overhead (via optional sidecar architecture)

### Real-World Performance Issues
- At ~500 RPS: P99 latency shoots to 90+ seconds (acknowledged architectural issue)
- Memory: 300-400MB RAM for what is marketed as a "thin proxy"
- Performance degrades under high concurrency due to Python GIL
- DB logging slows requests after 1M+ accumulated logs

### Resource Requirements

| Metric | Value |
|--------|-------|
| RAM (idle) | ~200MB |
| RAM (under load) | 300-400MB |
| CPU | 1 worker per CPU core recommended |
| Scaling | 2x instances = ~2x throughput, halves median latency |
| Optimal workers | Match CPU count |

### Deployment Complexity for Our Use Case

To run alongside a Node.js application:
1. User installs Python 3.9+ (or Docker)
2. User installs `litellm` (`pip install litellm` or Docker image)
3. User creates YAML config file
4. User starts proxy as a separate process or sidecar container
5. User configures Node.js app to point to `http://localhost:4000`
6. For full features: also provision PostgreSQL and Redis
7. User maintains two runtimes (Python + Node.js)

**This completely violates the project requirement of being a lightweight, zero-infrastructure TypeScript npm package.**

---

## Verdict and Recommendation

### Should We Use LiteLLM as a Base?

**No.**

### Reasoning

1. **Language mismatch:** LiteLLM is Python. Our project is TypeScript. There is no bridge that preserves the lightweight, in-process library experience we need.

2. **Architecture mismatch:** LiteLLM's valuable features (Router, cost tracking, fallbacks) only work fully in Python SDK mode or Proxy mode. Neither is consumable as a TypeScript library.

3. **Infrastructure overhead:** Even the minimal proxy deployment adds 200-400MB RAM, requires Python runtime, and needs PostgreSQL/Redis for full features. This contradicts the "zero infrastructure, just `npm install`" goal.

4. **Community TypeScript ports are dead:** The `litellm` npm package has 357 weekly downloads, was last updated January 2024, supports only 8 providers, and has zero Router/load-balancing/key-rotation features.

5. **Free tier tracking gap:** LiteLLM tracks spend in dollars. Our project needs free-tier-specific quota tracking (tokens remaining, API calls remaining, per-minute/daily/monthly windows). This would need to be built regardless.

### What to Learn From LiteLLM

LiteLLM's Router architecture is an excellent reference for our TypeScript implementation:

1. **Model group concept:** Multiple deployments (keys) sharing a `model_name` alias, with the router selecting among them
2. **Routing strategies:** Simple-shuffle (weighted), usage-based, least-busy, lowest-cost, latency-based
3. **Cooldown mechanism:** After N failures per minute, cool down deployment for N seconds, auto-recover
4. **Fallback chains:** General -> context window -> content policy -> default, with configurable depth
5. **Priority ordering:** `order` parameter for preferring certain keys over others
6. **Weighted distribution:** `weight` parameter for biased selection

### Recommended Approach

Stick with the current plan: **Vercel AI SDK as the base, with a custom TypeScript key rotation/policy engine built on top.** Specifically:

- Use Vercel AI SDK for provider abstraction and model interaction (TypeScript-native, 20M+ npm downloads)
- Build the Router/key-rotation logic in TypeScript, inspired by LiteLLM's Router patterns
- Build the Policy Engine for free-tier-specific tracking (not dollar-based)
- Use SQLite for persistence (zero infrastructure), Redis optional
- The entire package runs in-process -- no proxy, no Python, no Docker

---

## Appendix: LiteLLM Architecture Patterns Worth Borrowing

### 1. Deployment Model (Adapt to "Key" Model)

LiteLLM's concept of a "deployment" maps well to our concept of a "key registration":

```typescript
// LiteLLM-inspired key configuration
interface KeyDeployment {
  modelAlias: string;        // user-facing name (like model_name)
  provider: string;          // actual provider
  model: string;             // actual model ID
  apiKey: string;            // the API key
  rpm?: number;              // rate limit for this key
  tpm?: number;              // token limit for this key
  weight?: number;           // selection weight
  order?: number;            // priority (lower = higher)
}
```

### 2. Cooldown Pattern

```typescript
// LiteLLM-inspired cooldown
interface CooldownConfig {
  allowedFails: number;      // failures per minute before cooldown
  cooldownTime: number;      // seconds to cool down
  // Auto-recovery: check if cooldown expired before each request
}
```

### 3. Fallback Chain Pattern

```typescript
// LiteLLM-inspired fallback configuration
interface FallbackConfig {
  fallbacks: Record<string, string[]>;              // general fallbacks
  contextWindowFallbacks: Record<string, string>;   // for context overflow
  maxFallbackDepth: number;                          // prevent infinite loops
}
```

### 4. Routing Strategy Interface

```typescript
// LiteLLM-inspired pluggable routing
interface RoutingStrategy {
  name: string;
  select(
    availableKeys: KeyDeployment[],
    context: RequestContext,
  ): KeyDeployment;
}
```

---

## Sources

- [LiteLLM GitHub Repository](https://github.com/BerriAI/litellm)
- [LiteLLM Official Documentation](https://docs.litellm.ai/docs/)
- [LiteLLM Providers List](https://docs.litellm.ai/docs/providers)
- [LiteLLM Model Catalog](https://models.litellm.ai/)
- [LiteLLM Router Documentation](https://docs.litellm.ai/docs/routing)
- [LiteLLM Proxy Load Balancing](https://docs.litellm.ai/docs/proxy/load_balancing)
- [LiteLLM Fallbacks Documentation](https://docs.litellm.ai/docs/proxy/reliability)
- [LiteLLM Cost Tracking](https://docs.litellm.ai/docs/proxy/cost_tracking)
- [LiteLLM Production Best Practices](https://docs.litellm.ai/docs/proxy/prod)
- [LiteLLM Sub-Millisecond Proxy Overhead](https://docs.litellm.ai/blog/sub-millisecond-proxy-overhead)
- [LiteLLM Benchmarks](https://docs.litellm.ai/docs/benchmarks)
- [LiteLLM Deployment Options](https://docs.litellm.ai/docs/proxy/deploy)
- [LiteLLM on PyPI](https://pypi.org/project/litellm/)
- [litellmjs (Community JS Port)](https://github.com/zya/litellmjs)
- [@skadefro/litellm on npm](https://www.npmjs.com/package/@skadefro/litellm)
- [Free LLM API Resources Directory](https://github.com/cheahjs/free-llm-api-resources)
- [Free LLM API Provider Directory (45+ providers)](https://free-llm.com/)
- [15 Free LLM APIs in 2026](https://www.analyticsvidhya.com/blog/2026/01/top-free-llm-apis/)
- [LiteLLM Review 2026](https://www.truefoundry.com/blog/a-detailed-litellm-review-features-pricing-pros-and-cons-2026)
- [LiteLLM Alternatives 2026](https://www.truefoundry.com/blog/litellm-alternatives)
- [Langfuse + LiteLLM JS Integration Cookbook](https://langfuse.com/guides/cookbook/js_integration_litellm_proxy)
- [LiteLLM DeepWiki - Routing and Load Balancing](https://deepwiki.com/BerriAI/litellm/3.3-user-team-and-key-management)
- [LiteLLM DeepWiki - Configuration Management](https://deepwiki.com/BerriAI/litellm/4.1-configuration-management)

---

*Research completed: 2026-03-11*
*Confidence: HIGH (based on official documentation, GitHub source, community packages, and web research)*
