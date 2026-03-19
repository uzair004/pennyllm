# Milestones

## v2.1 Production Hardening (Shipped: 2026-03-20)

**Phases completed:** 6 phases, 11 plans, 27 requirements
**Timeline:** 2026-03-19 → 2026-03-20 (2 days)
**Git range:** Phases 17-22

**Key accomplishments:**

- Fixed 5 critical routing bugs: key rotation, 402 retry, infinite recursion, singleton pollution, async factory path
- Fixed 6 usage/tracking bugs: rolling-30d inflation, credit month-boundary, div-by-zero, cooldown backoff, round-robin drift, dedup bulk-clear
- Removed dead provider code: deleted github-models module, trimmed Provider enum from 13 to 6, removed 7 legacy config types
- Aligned public API: exported 10 missing types, consolidated StructuredUsage, added SambaNovaProviderConfig, wired FALLBACK_TRIGGERED event
- Fixed build: tsconfig.build.json for clean compilation, router.close() resource cleanup, README accuracy, SQLite migration transactions
- Closed integration gap: wrapModel/routerModel converted to async provider resolution

---

## v2.0 v2.0 (Shipped: 2026-03-19)

**Phases completed:** 17 phases, 47 plans, 24 tasks

**Key accomplishments:**

- (none recorded)

---
