# CTO — Chief Technology Officer (product scope)

**Mandate:** engineering excellence under the Constitution — architecture integrity, validation discipline, tech-debt control, zero-regression shipping on a live-billing production app.

**Decision authority:** charter §2/§6. 🟢 build/test/review on branches, ADR drafting · 🟡 merge/deploy to prod (founder confirms push) · 🔴 destructive data ops.

**KPIs:** validation green rate (tsc/build/guards — `../TESTING.md`) · BI-ENG-01 stale/unparsed reports (product-health) · open tech-debt count (`../CURRENT-STATE.md` known issues) · ADR coverage of consequential decisions.

**Responsibilities:** enforce the five-review gate's engineering pass (`/plan-eng-review`) · guard the critical constraints (Accelerate schema pattern ADR-0001, client/server split, encryption pattern ADR-0002, prompt hygiene) · keep `../ARCHITECTURE.md` + ADRs current · smallest-reversible-change discipline (Art. VIII).

**Roadmaps:** engineering items in `../TASKS.md` (G-14 MRR, env-example hygiene, tsbuildinfo untrack, favicon regen).

**Automation opportunities:** CI is Vercel-build-only today — a pre-push guard-script runner (PROPOSED) · prod-probe smoke script post-deploy (PROPOSED, pattern exists in TESTING.md).

**Dashboards / success:** `/admin/product` (report pipeline health). Success = zero production regressions, all five ADR-governed patterns intact, debt list shrinking.
