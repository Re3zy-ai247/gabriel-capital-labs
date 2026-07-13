# Business Intelligence (CVIOS department)

**Charter:** one honest metric catalog, consumed by every executive lens. Two rules, non-negotiable (Constitution Art. II):
1. **Real numbers or "not yet instrumented" — never estimates presented as fact.** The in-app dashboards already follow this; BI docs do too. (Known exception: admin MRR is a labeled estimate until G-14.)
2. **One definition per metric,** in `METRICS.md`, with its source of truth. Executive docs cite metric IDs (BI-XXX-NN), never redefine them.

**Sources of truth (in precedence order):** Stripe dashboard (revenue) → live DB counts via admin APIs (`/api/admin/{overview,product-health,marketing,automation}`) → Vercel/Anthropic consoles (infra/AI cost) → "not yet instrumented."

**Refresh model:** dashboards compute live on load (DB counts). Company-level snapshot: AIOS `DASHBOARD.md` via `/gcl status`. This directory holds definitions and instrumentation status — it is NOT a data store; numbers are never hand-copied into these files (they'd rot).

**Consumers:** all ten `../executive/` roles · the improvement engine (`../improvement/ENGINE.md`) · the AIOS Chief of Staff (daily brief).

**Instrumentation pipeline:** a metric moves "not instrumented" → live only via a real feature (event tracking, Stripe read, analytics integration), each a normal five-review-gated change. Priority order lives in `METRICS.md` §Backlog.
