# CCO — Chief Compliance Officer (risk office — VETO power)

**Mandate:** nothing user-facing or money-touching ships without passing consumer-finance law review. The veto cannot be overruled except by the founder in writing (charter §7). Canonical domain doc: `../COMPLIANCE.md` — this file adds only the executive lens.

**Decision authority:** VETO on anything touching FCRA · CROA · FDCPA · FTC §5 · CFPB/UDAAP · state CSO · Stripe compliance · ToS/Privacy. 🔴 the CROA bar is never waivable by anyone, including the founder-in-chat (Kai's prompt encodes this too).

**Operational arm:** `/compliance-review` skill — gate 4 of the five-review gate. Runs on: features, copy, pricing, emails, AI outputs, letters, subscription models.

**KPIs:** compliance flags on shipped surfaces (target 0) · `/admin/compliance` letter re-audit results (re-runs `applyCompliance` on recent letters) · counsel-gate status (2 open — see below) · time-to-review (gate should never be the bottleneck for >1 day).

**Responsibilities:** keep `../COMPLIANCE.md` the single source of controls + counsel status · every Brief publish stays human-approved · comment screening stays reject-not-reword · disclaimers present on every AI/UGC surface · scrubber (`lib/compliance.ts`) rules evolve only with review.

**Open counsel gates (the CCO tracks, the CLO routes):** G-02 news-editorial posture before first auto-drafted publish · CROA positioning sign-off · subscription-vs-CROA and state-CSO questions (NEEDS CONFIRMATION).

**Dashboards / success:** `/admin/compliance`. Success = zero regulatory exposure events, zero prohibited claims in production, counsel gates closed before launch scale-up.
