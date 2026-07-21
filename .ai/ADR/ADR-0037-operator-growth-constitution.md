# ADR-0037: Operator Growth & Business Intelligence — constitutional extension

Status: **PROPOSED (2026-07-20 — architecture/law only; not implemented, not merged, not pushed).**
Decision owners: Founder directive (Operator Growth vision) · Chief Architect (reconciliation).
Derives from & cites (ADR-0034 Law 26): [`GIOS-PLATFORM.md`](../GIOS-PLATFORM.md) (frozen platform constitution — layer model, ownership registry, architecture laws) · [`ADR-0034`](ADR-0034-gios-platform-freeze.md) (freeze + derivation mandate) · [`ADR-0033`](ADR-0033-platform-constitution-gios-kai-creditvector.md) (GIOS→Kai→CreditVector hierarchy).
Reconciles with: [`ARENA-CONTRIBUTION-POLICY.md`](../ARENA-CONTRIBUTION-POLICY.md) (reputation policy) · [`OPERATOR-IDENTITY.md`](../OPERATOR-IDENTITY.md) (identity) · [`ADR-0035`](ADR-0035-platform-event-bus.md)/[`ADR-0036`](ADR-0036-event-contract-evolution.md) (Event Fabric) · [`AGENCY-COMMAND.md`](../AGENCY-COMMAND.md) (Agency Health Score) · [`PRODUCT-VISION-V2.md`](../PRODUCT-VISION-V2.md) (experience).
Scope: **law + bounded-context declaration only.** The detailed architecture lives in [`VECTOR-XP.md`](../VECTOR-XP.md) and [`PERFORMANCE-INTELLIGENCE.md`](../PERFORMANCE-INTELLIGENCE.md); this ADR does not restate them. **No code, schema, flag, migration, or frozen-law edit.**

---

## 1. Context — the ratified vision, reconciled not rewritten

The Operator Growth vision positions CreditVector as **"The Credit Operating System"** — a platform whose purpose includes improving operators', agencies', educators', members', and consumers' **operational capability, financial/credit literacy, professional development, and business growth**, with measurable pathways to build a real business.

This is a **product-vision extension**, not a new platform. Most of its machinery already has canonical owners (reputation → Arena policy; identity → OPERATOR-IDENTITY; health → AGENCY-COMMAND §8; transport → Event Fabric). This ADR ratifies the **new laws** and **declares two bounded contexts**, then defers detail. It creates **no second source of truth** for any frozen subject.

**Mission-amendment proposal (routed, NOT silently applied):** the vision restates the mission as *"CreditVector exists to improve the operational excellence of every agency and create measurable pathways for every operator to build and grow a real business."* The mission lives in [`CREDITVECTOR-OS.md`](../CREDITVECTOR-OS.md) (apex constitution, amendable only by founder + ADR). This ADR **proposes** that amendment; it does not edit CREDITVECTOR-OS.md. Founder ratification folds it in.

## 2. Ratified laws (the new constitutional principles)

Where a principle already exists as frozen law, this ADR **cross-references** it rather than restating (Law 1: no second source of truth).

| # | Law | Status vs existing canon |
|---|---|---|
| **OG-1** | **The platform rewards measurable, evidence-backed contribution — never popularity.** No public 1–5 star operator rating (§3). | **NEW law**, anchors the Arena refusal-register extension. Consistent with the existing refusal of named leaderboards. |
| **OG-2** | **Every operator starts from the same platform-defined state.** XP cannot be purchased, imported, inherited, transferred, sold, redeemed for cash, or granted from a client-supplied amount. Prior experience is represented by *separately verified* credentials, never silent XP. **Equal starting line AND fair accrual slope:** because lifetime XP is monotonic, per-dimension **weight floors** must keep business *volume* from becoming the determinant of tier, and **size-independent** dimensions (education, community, mentorship) must be earnable **before** any XP-gated entitlement activates — so new/small/excellent operators have a real path, not only high-throughput incumbents. | **NEW**; extends the Arena un-farmable rules + prohibited-sources list. Fairness-slope added per adversarial review 2026-07-20. |
| **OG-3** | **Identity precedes reputation.** An operator has a professional identity before the platform computes reputation, progression, eligibility, or marketplace access. Identity and Reputation are **separate bounded contexts**. | Already stated in [`OPERATOR-IDENTITY.md §5`]; **ratified as law** here. |
| **OG-4** | **Business health ≠ reputation.** An organization's operational health (Performance Intelligence) is separate from an operator's lifetime Vector XP (Reputation). A KPI decline never erases lifetime XP; high XP never implies a currently-healthy agency. | **NEW separation** between two contexts. |
| **OG-5** | **Projections never become truth.** Displayed XP, KPIs, health scores, ranks, unlock progress, and Arena/Profile/Mission-Control views are projections over immutable authoritative records + versioned evidence. | **Already a GIOS-PLATFORM Architecture Law** — **cross-referenced**, not restated. |

## 3. No generic public 1–5 star operator rating (constitutional refusal)

CreditVector **does not** use a generic public 1–5 star operator rating system. Rationale (binding): incumbency bias, subjective popularity, fake reviews, competitive sabotage, unequal starting conditions, historical advantage, ambiguous meaning, weak evidence quality, and disproportionate harm from small samples. This joins the existing refusal register in `ARENA-CONTRIBUTION-POLICY.md` (which already refuses named leaderboards under CROA §1679b / FTC §5).

A **future** structured, context-specific feedback system (response-time compliance, verified attendance, completed engagements, moderated testimonials, verified service-delivery indicators) is **not categorically prohibited** but must **not** become a generic popularity score and requires **separate architecture + consent + abuse controls + legal review**. It is **not designed now** (boundary reserved only).

## 4. Bounded-context declarations (one owner per thing — GIOS-PLATFORM §3)

Two first-class platform-service contexts are declared (both **PROPOSED**; neither implemented):

- **Operator Reputation Service** — owns **Vector XP** (lifetime progression), milestones, entitlements-from-progression, reward claims, the append-only award ledger, and progression events. Consumes: authoritative domain events (via the Event Fabric) + the versioned Arena policy. **Never owns**: identity, business health, notification content, domain data, or the Event Fabric transport. Architecture → [`VECTOR-XP.md`](../VECTOR-XP.md). Policy (scoring/refusals) stays in `ARENA-CONTRIBUTION-POLICY.md`. Arena is its **experience**, not its truth.
- **Performance Intelligence Service** — owns the **SOP Engine, KPI Engine, Business Health Engine, Business Maturity model, and Recommendation inputs** for how effectively an organization operates. Consumes: domain events + org configuration. **Never owns**: identity, Vector XP, marketplace inventory, notification content, or Kai reasoning. Architecture → [`PERFORMANCE-INTELLIGENCE.md`](../PERFORMANCE-INTELLIGENCE.md). Generalizes the existing `AGENCY-COMMAND.md §8` Agency Health Score + §4 Revenue Intelligence. Mission Control is its **experience**, not its truth.

## 5. Experience → service boundaries (canonical)

Experiences render **projections**; they never own truth.

| Experience | Presents | Owns truth? | Truth owner |
|---|---|---|---|
| **Mission Control** | business health, SOP adherence, KPI status, goals, bottlenecks, priorities, trends, Kai recs | no | Performance Intelligence |
| **Arena** | Vector XP, milestones, levels, achievements, challenges, opt-in category competitions, unlock progress | no | Operator Reputation Service |
| **Operator Profile** | selectively-authorized identity + reputation + certifications + education + marketplace + org data | no | Operator Identity (+ others) |
| **Marketplace** | items/services gated by entitlements & milestones | no — **may NOT mutate XP** | Reputation (entitlements) + Marketplace (inventory) — **no credit-related inventory (templates/SOPs/coaching) publishes without CROA/CCO content screening equivalent to the letter/Kai bar, a stated facilitator-liability position, and seller terms/indemnity** |
| **Campus** | financial/credit-literacy, certification, professional development | produces **authoritative educational evidence** | Campus (education) — does not award arbitrary XP |
| **Operator Network** | professional collaboration/community | may produce evidence-backed contribution events | Operator Network — not reputation policy |
| **Kai** | explains, recommends, assists over authorized projections + evidence | **no** — never the source of business/XP/KPI/entitlement truth; must cite evidence, not fabricate | consumes, never owns |

## 6. Financial & credit literacy positioning

Education (Campus, professional development) is a **first-class contributor to the operating model**, not marketing content bolted on. Legitimate growth journeys exist for new operators, experienced operators, educators, agency owners, team members, consumers, and prospects — each understandable without reducing professional value to popularity. Detail defers to `PRODUCT-VISION-V2.md` (experience) + `VECTOR-XP.md` (education → evidence → XP path); this ADR only locks the positioning as constitutional, not optional.

## 7. Governance & status

Subordinate to `GIOS-PLATFORM.md` + `CREDITVECTOR-OS.md`. Amend only via a superseding ADR + founder approval (+ CCO where a change touches L3 compliance or a public cross-user surface). Detailed architecture lives in the cited docs; this ADR owns the **law**. PROPOSED — nothing here is live; all subsystems remain dormant behind fail-closed flags; no production change.

## 8. Protected state

Architecture/law only — no code/UI/DB/billing/protected-flag/merge/push. Public activation of any cross-user reputation, profile, or feedback surface remains under the **CROA §1679b / FTC §5** counsel STOP ([`COUNSEL-REVIEW-operator-network.md §0`](../COUNSEL-REVIEW-operator-network.md)). First implementation slice remains owner-gated (Operator Identity foundation, per the roadmap).
