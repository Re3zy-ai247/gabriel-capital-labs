# ADR-0038: The CreditVector Professional Growth Economy — constitution

Status: **RATIFIED (principles — founder-approved 2026-07-20) · PROPOSED (all policy values).** Architecture/law only; no code, schema, flag, migration, merge, or deploy.
Decision owners: **Founder (explicit approval of the strategic principles, this session)** · Chief Architect (reconciliation).
Derives from & cites (ADR-0034 Law 26): [`GIOS-PLATFORM.md`](../GIOS-PLATFORM.md) (frozen constitution — ownership registry, architecture laws) · [`ADR-0034`](ADR-0034-gios-platform-freeze.md) (freeze + ratification protocol) · [`ADR-0037`](ADR-0037-operator-growth-constitution.md) (Operator Growth — parent of this economy).
Governs / cites detail (does not restate): [`VECTOR-XP.md`](../VECTOR-XP.md) (Reputation Service architecture — XP ledger, milestones, entitlements, claims, dimensions, anti-fraud) · [`PERFORMANCE-INTELLIGENCE.md`](../PERFORMANCE-INTELLIGENCE.md) (SOP/KPI/health/maturity/improvement measurement) · [`ARENA-CONTRIBUTION-POLICY.md`](../ARENA-CONTRIBUTION-POLICY.md) (scoring policy + refusals) · [`CREDITVECTOR-ECONOMY.md`](../CREDITVECTOR-ECONOMY.md) (the economy architecture: improvement recognition, competitions, cohorts, referral/affiliate/credits separation, economic threat model) · [`OPERATOR-IDENTITY.md`](../OPERATOR-IDENTITY.md).

---

## 1. Context — the ratified vision

CreditVector is **"The Credit Operating System."** Its economy is a **Professional Growth Economy**: measurable pathways for operators, agencies, educators, members, and consumers to learn financial/credit literacy, build competence, improve operations, serve clients, grow legitimate businesses, teach/mentor, create resources, and unlock tools — through **evidence-backed contribution**. This ADR ratifies the **laws**; the detailed subsystem docs keep their specialized ownership (no second source of truth).

**What CreditVector's economy is NOT** (positioning laws, §2 PGE-3): a gamified CRM · a popularity contest · a social-reputation system · a pay-to-win marketplace · a cryptocurrency · a speculative token economy · a public ranking dominated by the largest agencies.

**"Professional Growth Economy"** is adopted as **canonical strategic + architectural terminology** (this ADR + `CREDITVECTOR-ECONOMY.md` are its home).

## 2. Ratified laws (PGE-1 … PGE-6)

Where a law already exists as canon, this ADR **cross-references** it (Law 1: no second source of truth).

| # | Law | Status |
|---|---|---|
| **PGE-1 — Meaningful Action** | *Every meaningful action in CreditVector should improve a person's knowledge, improve a business's operations, strengthen the professional community, or produce verifiable value for a client. Activities that accomplish none of these must not become primary progression mechanisms.* Governs XP policy, competitions, challenges, marketplace unlocks, community/education/referral rewards, business-performance recognition, and future affiliate programs. | **NEW · RATIFIED** |
| **PGE-2 — Improvement, not scale** | *Scale may be measured, but scale alone must not determine professional progression or recognition.* A large agency naturally emits more events; raw volume is not merit. The economy recognizes **improvement, goal attainment, percentage gains, sustained improvement, recovery, and high-quality contribution within a smaller context** — with **equal opportunity** to earn recognition (never a guarantee of equal outcome). Extends ADR-0037 OG-2 (fair start + fair accrual slope). | **NEW · RATIFIED** |
| **PGE-3 — Not a monetary/token instrument** | Vector XP is **not** a credit, coin, token, currency, or balance of monetary value; **never** legal tender, an investment, or a speculative instrument; the economy is **not** pay-to-win. XP is never spent/transferred/purchased/sold/redeemed-for-cash/reduced-in-normal-use/client-awarded/browser-derived (the frozen `VECTOR-XP.md` §3 requirements, ratified here as law). | **NEW · RATIFIED** |
| **PGE-4 — Separation of instruments** | **Reputation (Vector XP) · Business Health · Affiliate commissions · Promotional credits · Cash** are **five distinct instruments with distinct ownership; they are never combined, converted, or cross-credited.** Health ≠ reputation (ADR-0037 OG-4); XP ≠ cash (PGE-3); affiliate/credits are separate ledgers (§4). | **NEW · RATIFIED** |
| **PGE-5 — Evidence, explainability, appeal** | Progression is **evidence-backed, explainable, and appealable** (`CREDITVECTOR-ECONOMY.md §Explainability`): an operator can learn what qualified, which policy+version applied, why an award/milestone/entitlement was granted or denied, whether it is pending review, and how to appeal an error. No hidden scoring, no arbitrary ranking, no discriminatory proxies. | **NEW · RATIFIED** (extends ADR-0037 OG-5 projections≠truth) |
| **PGE-6 — ADR-0037 principles ratified** | The Operator Growth principles (evidence-not-popularity; **no public 1–5 star rating**; identity ≻ reputation; business-health ≠ reputation; projections ≠ truth; XP unlocks milestones→entitlements→claims; multiple contribution paths; financial/credit literacy first-class; SOPs/KPIs improve real businesses; Arena/Marketplace as evidence-gated experiences) are **founder-ratified** by this ADR. | ADR-0037 principles → **RATIFIED**; its policy values stay PROPOSED |

## 3. Economic object model — relationships (detail lives in `VECTOR-XP.md`)

```
  Authoritative evidence (domain event, Event Fabric)
        │  Reputation Service evaluates a versioned policy (PGE-1 filter: does it improve knowledge/ops/community/client-value?)
        ▼
  Vector XP award (append-only ledger; PGE-3: not monetary)  ──► lifetime XP projection
        │
        ▼  qualifies
  Milestone (latched; survives re-weighting)
        │  grants
        ▼
  Entitlement (access/eligibility; PGE-4: never subtracts XP)
        │  makes claimable
        ▼
  Reward Claim (one-time benefit; own record; claiming never deducts XP)

  Competitions/Challenges ── recognize improvement within evidence-based COHORTS (not raw totals)
  Marketplace ── consumes entitlements/milestones to gate access; NEVER mutates XP
  Referrals ── contribute ONLY when independently verified + capped (never dominant)
  Affiliate commissions / Promotional credits ── SEPARATE instruments + ledgers (§4)
```

## 4. Instrument separation — affiliate & promotional credits (reservation only)

- **Affiliate payouts** are **cash compensation**, entirely separate from reputation/XP/promotional rewards. They require their **own** ownership for commission policy · attribution · payment ledger · tax reporting · refunds/chargebacks · recurring eligibility · fraud review · financial accounting · legal terms. **Architecturally reserved; NOT implemented, NOT owned here.** No affiliate concept is built now.
- **Promotional credits** are **not introduced.** If ever reserved, they are a **closed-loop promotional instrument** requiring legal + accounting review, liability treatment, expiration, non-transferability, **no cash redemption**, a **separate ledger + terminology**, and a clear distinction from Vector XP. **Vector XP is never called a credit/coin/token/currency/balance** (PGE-3).
- **Cash-valued reward claims** (a subscription-month add-on, consultation/exam vouchers, bundles, event admission) carry real monetary value and therefore fall under the **same promotional-credit governance** — the control "claiming never deducts XP" is necessary but **not sufficient** to keep them outside the monetary-instrument regime.
- **Separation is ENFORCED, not doctrinal (economy review 2026-07-20).** "No conversion path" is guaranteed by a **guard-pinned cross-instrument no-read invariant** in any future affiliate/promotional-credit ledger, not by assertion. And the **indirect** path is acknowledged: cash can buy paid subscriptions or fund referred signups that mint Business-Growth XP — so **self-funded / same-payer / same-beneficiary / related-party referred memberships are ineligible progression evidence**, and that path is capped so it can never determine tier (PGE-2/PGE-3). Detail: [`CREDITVECTOR-ECONOMY.md §11`](../CREDITVECTOR-ECONOMY.md).

## 5. Bounded-context ownership dispositions

Reconciled against `GIOS-PLATFORM.md §3` (one owner per thing) and `VECTOR-XP.md`/`PERFORMANCE-INTELLIGENCE.md`:

- **Operator Reputation Service** — owns Vector XP award policies/records, lifetime projection, contribution dimensions, reputation milestones, evidence refs, reversals/invalidations, XP anti-abuse hooks. **Does not own** identity, business health, marketplace inventory, cash/affiliate, course content, event transport.
- **Milestone** — a **module inside the Operator Reputation Service** (a latched projection over the award ledger), **not** a premature microservice. Rationale: milestones are pure functions of reputation truth; no independent lifecycle warrants a separate service yet (evidence earns architecture).
- **Entitlement Service** — a **distinct context**: access grants, eligibility state, entitlement lifecycle, source milestone/policy, activation/expiration, revocation (fraud/policy/legal), historical audit. Resolves through the existing PEP (a *second, additive* entitlement source alongside billing-plan entitlements in `lib/entitlements.ts`; never a parallel authz). **Does not own** marketplace inventory.
- **Reward Claim** — a **module inside the Entitlement Service** owning authoritative one-time claim consumption (its own append-only record). Not a separate service (it is the consumption event of an entitlement).
- **Performance Intelligence Service** — owns SOP/KPI/health/goals/trends/maturity/**improvement measurement**; **emits authoritative evidence** eligible for reputation-policy evaluation; **does not award XP directly**.
- **Marketplace** — owns inventory/listings/products/services/availability/orders/marketplace-compliance; **consumes** entitlements; **never mutates XP**.
- **Campus** — owns educational content/progress/assessments/certification evidence; **does not arbitrarily mint XP** (it emits completion evidence the Reputation policy may reward).
- **Arena** — **experience/projection**: presents progression, challenges, competitions, cohorts, recognition, milestones, unlock progress. Not a truth source.
- **Kai** — explains *why* (XP awarded, milestone reached, entitlement available, health improved, what may improve the business); **does not create economic truth**; must cite evidence + pass the CROA scrub (`PERFORMANCE-INTELLIGENCE §3E`).
- **Event Fabric** — transports evidence; owns no reward meaning, amount, human-facing content, or policy.

## 6. Ratification status (ADR-0034 protocol)

**Result: RATIFIED PRINCIPLES + PROPOSED POLICIES.** The founder approved the strategic principles this session; PGE-1…PGE-6 and the ADR-0037 principle set are **RATIFIED**. **Explicitly UNRATIFIED and owner-gated** (no founder approval claimed): XP amounts/weights/caps/thresholds · referral qualification periods · affiliate commission %/payout structures · financial liability · tax treatment · marketplace legal terms · promotional credits · public performance fields · fraud thresholds/enforcement rules · production implementation · migration approval · feature activation. Amend the laws only via a superseding ADR + founder (+ CCO where L3/compliance or a public cross-user surface is touched).

## 7. Protected state

No code/UI/DB/billing/flag/migration/merge/push-to-main. All subsystems remain dormant behind fail-closed flags. Public cross-user reputation/profile/competition/performance surfaces remain under the **CROA §1679b / FTC §5** counsel STOP. First implementation slice remains owner-gated (Operator Identity foundation, per `ROADMAP.md`).
