# Performance Intelligence Service — architecture

Status: **PROPOSED (2026-07-20 — architecture only; no code, schema, or migration).**
Authority: derives from [`ADR-0037`](ADR/ADR-0037-operator-growth-constitution.md) (OG-4: business health ≠ reputation; OG-5: projections ≠ truth). Cites — does not restate — [`AGENCY-COMMAND.md`](AGENCY-COMMAND.md) §4 (Revenue Intelligence) + §8 (Agency Health Score, the existing seed) · [`business-intelligence/METRICS.md`](business-intelligence/METRICS.md) · `lib/missionControl.ts` · `lib/analytics/aggregate.ts` · [`ADR-0032`](ADR/ADR-0032-platform-layering-kai-kernel.md) §5 (numbers deterministic, LLM writes prose only) · [`ADR-0035`](ADR/ADR-0035-platform-event-bus.md)/[`ADR-0036`](ADR/ADR-0036-event-contract-evolution.md) (Event Fabric) · [`GIOS-PLATFORM.md`](GIOS-PLATFORM.md) §3 (ownership).
Boundary: the **Performance Intelligence Service** owns how effectively an organization *operates*. **Mission Control is its experience, not its truth.** It is **separate from reputation** (OG-4) — a KPI decline never touches Vector XP.

---

## 1. Why a service, and what already exists (no duplication)

Performance/health/BI concepts already exist, **scattered**: the Agency Health Score (`AGENCY-COMMAND.md §8` — one deterministic executive number, bands Healthy/Watch/At-risk, "not yet instrumented" over guesses), Revenue Intelligence read-models (`§4`), the metrics catalog (`business-intelligence/METRICS.md`), `lib/missionControl.ts` (state roll-up), and `lib/analytics/aggregate.ts` (funnel/adoption over `ProductEvent`). **No consolidated SOP/KPI/Health/Maturity service exists** (SOP and KPI *engines* are ABSENT in code). This document declares the consolidating context and its sub-engines; the existing artifacts are its **seed**, not a second catalog. The Agency Health Score is the first instance of the general Business Health Engine.

## 2. Determinism & the projection boundary (binding)

Every performance **number is deterministic and auditable** (ADR-0032 §5 + `AGENCY-COMMAND §8`): it is a pure function of authoritative data + a versioned formula, with disclosed provenance. Kai's LLM writes **narrative only** (ADR-0006, untrusted-fenced) — it never invents a measurement. Health scores, KPI dashboards, maturity levels, and Mission Control views are **projections** (OG-5); the authoritative records are the domain contexts' own tables + the versioned formulas. A projection is always rebuildable; if it disagrees with source truth, source wins.

## 2.1 Two binding laws for every metric (adversarial review, 2026-07-20)

- **Input integrity, not just formula integrity.** A deterministic formula over "authoritative" data is still gameable because *authoritative ≠ genuine*: phantom clients, fabricated activity, and closed-without-work cases all flow into KPIs → Health → Maturity → a **publicly-classifiable** profile. Every input-bearing engine (KPI, Health, Maturity) MUST carry a **fraud / velocity / quality gate equivalent to Vector XP §6** (a fake or inactive client contributes nothing), and must disclose completeness. This is not optional because these numbers can gate marketplace access and appear on profiles.
- **Outcome > activity (a prohibited-signal law, mirroring Arena's prohibited-XP-sources).** KPIs/Health/Maturity must **not** reward raw activity/vanity metrics (case throughput, letters-per-period, per-seat load, login frequency) as "healthy." Case throughput especially must never read as health — it steers Kai toward recommending volume over consumer outcome, a compliance and consumer-harm risk. A metric measures **outcome quality**; a prohibited-activity-signal list (analogous to `lib/arena/policy.ts` prohibited sources) is asserted and the behaviors Kai will be steered to recommend get compliance review.

## 3. Sub-engines

### A. SOP Engine
Owns: SOP definitions · versioned SOP templates · agency-specific customization (template inheritance + org overrides) · workflow steps · required vs optional controls · completion expectations · role responsibilities · timing expectations · evidence requirements · **SOP adherence** measurement · bottleneck detection · version history · activation/retirement. An SOP is a *versioned template*; adherence is measured against the **org's own** activated version, not a platform-wide ideal. (Guards against "checkbox theater": adherence must reference completion **evidence**, not a self-reported tick — see §5 risk.)

### B. KPI Engine
Owns: KPI definitions · formulas · ownership (which role owns a KPI) · measurement windows · targets · thresholds · trends · goals · **comparison against the agency's own history** · org-specific + role-specific KPI configuration · data provenance · calculation versions · missing-data behavior (a KPI over incomplete data discloses completeness, never guesses) · confidence/completeness where appropriate. Formulas are versioned like the XP policy — a formula change ships as a new version; historical KPIs keep their original formula.

### C. Business Health Engine
Composes health from **explainable, provenance-tagged dimensions** — no opaque universal score. Candidate dimensions (proposals, not ratified): Operational · Client-Activity · Communication · Compliance · Growth · Education · Automation · Team · Financial (where lawful and supported). Each dimension defines its composition, provenance, version, and explanation. **Default comparison is against the org's own goals / history / SOPs / operating standards — NOT a public ranking of agencies against one another** (OG-1 rationale: incumbency bias, unequal conditions). Any cross-agency comparison is a separate, consent-gated, CCO-reviewed surface — not the default. The existing `AGENCY-COMMAND §8` single number is one composition of this engine, kept transparent.

### D. Business Maturity model
A staged model — **Foundation → Growth → Scale → Leadership → Excellence** (names are **product proposals**, not ratified). Maturity is **evidence-based and explainable** (which milestones/KPIs/SOP-adherence put an org at a stage), never a vibe. It compares an org to defined stage criteria, not to competitors.

### E. Recommendation inputs (Kai consumes)
The service exposes authoritative, evidence-tagged outputs; **Kai** (`KAI-OS.md`, the executive intelligence layer) consumes them to produce priority recommendations, bottleneck explanations, workflow-improvement suggestions, staffing observations, training recommendations, compliance reminders, goal-progress, coaching, and trend explanations. **Kai must cite** the underlying evidence, KPI definition, SOP expectation, confidence, and data freshness — and **must not fabricate a measurement** (ADR-0037 §5 boundary; ADR-0006 verification).

**A recommendation is an INFERENCE, not a measurement** (adversarial review, 2026-07-20) — so bounding measurements is not enough. Two additional gates: (1) every Kai recommendation must be **grounded** — verified to follow from the evidence it cites, not merely accompanied by a citation; and (2) Performance-Intelligence Kai output MUST pass the same **`lib/compliance.ts` / CROA scrub** that letters, Brief, and marketing copy pass (a coaching suggestion cannot imply a guaranteed outcome, a §609 deletion myth, or a promised score jump). The service owns the numbers; Kai owns the prose — under the same compliance bar as every other Kai surface.

## 4. Inputs / outputs (Event-Fabric-mediated)

- **Consumes:** authoritative domain events (Disputes/Letters/Client-activity/Education/Community — via the Event Fabric, ADR-0035) + org configuration (its own SOP/KPI/goal definitions). It does **not** poll another context's tables directly (the Event Fabric consumer discipline).
- **Produces:** deterministic read-models (health, KPI, adherence, maturity) rendered by Mission Control; optional `SYSTEM_EVENT`/analytics signals. It produces **no** outward customer effect and mutates **no** other context.

## 5. What this service does NOT own

Identity (→ `OPERATOR-IDENTITY.md`) · Vector XP / reputation (→ `VECTOR-XP.md` — **a KPI decline never erases lifetime XP; high XP never implies current health**, OG-4) · marketplace inventory · notification content (→ emitting context) · Kai reasoning (it feeds Kai; Kai interprets) · the Event Fabric transport.

## 6. Status & gates

PROPOSED. No code/schema/migration/flag. When built: migration-first schema for SOP/KPI/goal definitions; versioned formulas; provenance + completeness on every metric; deterministic + auditable; Kai integration behind the existing verification gate. Any **public** cross-agency performance surface needs CCO/legal review (publishing operator/agency performance has discrimination + defamation + UDAP exposure). Mission Control renders it; it never becomes the source of truth.
