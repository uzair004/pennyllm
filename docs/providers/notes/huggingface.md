# HuggingFace — Provider Intelligence

> Gathered: 2026-03-15 | Source: User research + HF docs + forums + AI SDK docs
> COMPLEXITY: HIGH — two different billing systems, HF is a meta-provider like OpenRouter

## Key Acquisition

- No credit card required
- Sign up: https://huggingface.co/join
- Tokens: https://huggingface.co/settings/tokens
- Token types: Read (sufficient for inference), Write, Fine-Grained
- Multiple tokens per account — all share same credit pool
- Env var: `HUGGINGFACE_API_KEY` (AI SDK) or `HF_TOKEN` (native HF convention)
- **Limits are per-account, NOT per-token/key**

## Two Systems (Critical to Understand)

### System 1: Legacy Serverless Inference API (EFFECTIVELY DEAD for LLMs)

- Endpoint: `api-inference.huggingface.co/models/{model_id}`
- Was the old free inference system
- As of mid-2025: **narrowed to CPU inference only** — embeddings, text-classification, BERT, GPT-2
- Modern chat-capable LLMs are NO LONGER hosted here
- The "300 requests/hour" figure that circulates online is **stale** — from the old system
- Still technically exists but **not viable for text generation**

### System 2: Inference Providers (THE current system)

- Endpoint: `https://router.huggingface.co/v1/chat/completions`
- HF acts as authenticated proxy/router to external providers
- 18 providers available: Together AI, SambaNova, Groq, Fireworks, Cerebras, Cohere, Scaleway, etc.
- Auth: same HF token for all providers — HF handles auth translation
- **This is what @ai-sdk/huggingface uses**

#### How provider selection works

Model ID format supports provider suffixes:

- `meta-llama/Llama-3.1-8B-Instruct` — default routing (`:fastest`)
- `meta-llama/Llama-3.1-8B-Instruct:together` — pin to Together AI
- `meta-llama/Llama-3.1-8B-Instruct:sambanova` — pin to SambaNova
- `meta-llama/Llama-3.1-8B-Instruct:cheapest` — cheapest available
- `meta-llama/Llama-3.1-8B-Instruct:fastest` — fastest available (default)

#### Available providers for text generation

Cerebras, Cohere, Featherless AI, Fireworks, Groq, Hyperbolic, Novita, Nscale, OVHcloud, Public AI, SambaNova, Scaleway, Together AI, Z.ai

## Credit System ($0.10/month)

### This is NOT a rate limit — it's a dollar budget

| Account Type | Monthly Credits | Pay-as-you-go                 |
| ------------ | --------------- | ----------------------------- |
| Free         | $0.10           | No (cut off until next month) |
| PRO ($9/mo)  | $2.00           | Yes                           |

### What $0.10 actually buys (approximate)

HF passes through provider costs with zero markup:

| Model                    | Approx cost          | $0.10 buys                           |
| ------------------------ | -------------------- | ------------------------------------ |
| Llama 3.1 8B (Together)  | ~$0.10/M tokens      | ~500K tokens (~1,250 short requests) |
| Llama 3.3 70B (Together) | ~$0.88/M tokens      | ~114K tokens (~140 short requests)   |
| DeepSeek R1              | ~$0.60-1.70/M tokens | ~50-80 short requests                |

### How it works

- Every routed inference request costs money — **no truly free models**
- Cost depends on: model size × provider pricing × token count
- Budget resets monthly
- When exhausted: requests fail (free users), or pay-as-you-go kicks in (PRO users)
- Cannot query remaining balance via API (only via billing page)

### "Custom Provider Key" mode

Users can supply their OWN provider key (e.g., their own Together AI key) — in that case HF doesn't charge credits. But then they need accounts with the underlying providers anyway.

## Rate Limits

### Hub-level API limits (largely irrelevant given credit budget)

- Free users: 1,000 requests per 5-minute window (across ALL Hub API calls)
- This is a Hub-wide rate limit, not inference-specific
- In practice, credits run out LONG before hitting this

### The "300 req/hour" myth

- From old articles about the legacy serverless API
- **No longer accurate** for modern LLM inference
- Current system is credit-gated, not request-gated

## AI SDK Integration

- Package: `@ai-sdk/huggingface`
- Factory: `createHuggingFace({ apiKey })` or import `huggingface` directly
- Base URL: `https://router.huggingface.co/v1` (the new inference providers system)
- Model IDs: full HF identifiers like `meta-llama/Llama-3.1-8B-Instruct`

```typescript
import { huggingface } from '@ai-sdk/huggingface';
const model = huggingface('meta-llama/Llama-3.1-8B-Instruct');
```

## Phase 12.1 Gap Analysis Notes

### Gap: Dollar-credit billing (FUNDAMENTAL)

- PennyLLM models limits as: request count (RPM, RPD) and token count (TPM, TPD)
- HuggingFace bills in **dollars per compute-time/token**, not request counts
- PennyLLM has NO concept of:
  - Dollar-denominated credit balance
  - Per-request cost that varies by model and provider
  - Monthly credit budget depletion tracking
  - Querying remaining credit balance
- **Severity**: (c) missing capability — this is the same gap identified for Phase 14 (Credit-Based Limits)
- **Workaround**: Use `createCallLimit()` as conservative proxy (our docs already suggest this)

### Gap: Meta-provider (same as OpenRouter)

- HF proxies to Together AI, SambaNova, Groq, etc.
- Same model via HF vs direct provider = different quota pools
- PennyLLM has no meta-provider concept

### Gap: Provider routing within HF

- HF has its own routing (`:fastest`, `:cheapest`, `:preferred`)
- Conflicts with PennyLLM's own routing — similar architectural tension as OpenRouter
- For PennyLLM: pin specific providers (`:together`, `:sambanova`) for predictability

### Gap: No way to know remaining credits

- PennyLLM can't query HF's billing API
- Can only approximate with `createCallLimit()` as conservative estimate
- No way to accurately predict when credits will exhaust

### What works

- Single key is fine (multiple keys don't help, per-account)
- The `createCallLimit()` workaround in our docs is reasonable
- Low value as primary provider ($0.10 is tiny) — better as occasional fallback

## Phase 13 Registry Notes

- Volatility: MEDIUM (provider list changes, credit amounts could change)
- Confidence: HIGH for credit system, LOW for specific costs (provider-dependent)
- Source URL: https://huggingface.co/docs/inference-providers/pricing
- Registry MUST distinguish credit-based vs rate-limit-based providers
- Phase 14 (Credit-Based Limits) directly addresses this gap
- HF is the strongest argument for implementing Phase 14

## E2E Testing Notes

- **Very limited testing budget** — $0.10 means ~50-1,250 requests depending on model
- Best test model: cheapest available small model (e.g., Llama 3.1 8B via Together)
- Keep test count LOW (5-10 requests max)
- Monitor credits at https://huggingface.co/settings/billing
