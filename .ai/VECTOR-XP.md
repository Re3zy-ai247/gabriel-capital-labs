# Vector XP — Operator Reputation Service architecture

Status: **PROPOSED (2026-07-20 — architecture only; no code, schema, table, or migration).**
Authority: derives from [`ADR-0037`](ADR/ADR-0037-operator-growth-constitution.md) (the law). Cites — does not restate — [`ARENA-CONTRIBUTION-POLICY.md`](ARENA-CONTRIBUTION-POLICY.md) (the scoring **policy**, source of truth `lib/arena/policy.ts`), [`ADR-0035`](ADR/ADR-0035-platform-event-bus.md)/[`ADR-0036`](ADR/ADR-0036-event-contract-evolution.md) (Event Fabric), [`OPERATOR-IDENTITY.md`](OPERATOR-IDENTITY.md) (identity precedes reputation), [`GIOS-PLATFORM.md`](GIOS-PLATFORM.md) §3 (ownership).
Boundary: the **Operator Reputation Service** owns this. **Arena is the experience, not the truth.** The policy doc owns *what earns and how much + the refusals*; this doc owns *how it is stored, awarded idempotently, protected from fraud, and converted to milestones → entitlements → claims*. No overlap.

---

## 1. Terminology

**Vector XP** is the product/brand framing of the platform's **lifetime, evidence-backed operator progression** — the same reputation already governed by the Arena Contribution Policy, elevated from a reconcile-on-read projection (v1, storage-free) to a **durable append-only ledger** as new earning dimensions come online. "Vector XP" is the concept; `lib/arena/*` is today's implementation. No rename of shipped code.

## 2. The conceptual flow (authoritative → projection)

```
  Authoritative domain event   (a bounded context committed its truth, then emitted — Event Fabric)
        │
  Versioned XP policy          (ARENA-CONTRIBUTION-POLICY / lib/arena/policy.ts — what earns, how much)
        │
  Eligibility + fraud eval     (§6 anti-exploitation: velocity, Sybil, collusion, quality, holds)
        │
  Idempotent append-only award record   (§5 — TRUTH; unique-constrained; never edited)
        │
  Lifetime XP projection       (a pure fold over award records — PROJECTION, never truth: OG-5)
        │
  Milestone achievement        (§4B — stable, protected from future re-weighting)
        │
  Entitlement granted          (§4C — access right)
        │
  Reward claim                 (§4D — one-time benefit; claiming NEVER deducts XP)
        │
  Arena / Profile / Marketplace projection   (experiences render; they never mutate)
```

## 3. Frozen product requirements (from ADR-0037 OG-2)

Vector XP: **never decreases** through normal use · **never spent** · **non-transferable** · cannot be **purchased / sold / redeemed for cash** · cannot be **edited by the client** · cannot be **awarded from a browser-supplied amount** · must derive from **authoritative, evidence-backed** activity · corrections use **auditable compensating/invalidation records**, never a mutable balance. Vector XP *unlocks* milestones/entitlements/claims; **claiming or using an unlocked benefit never reduces XP.**

## 4. The four distinct records

| Record | Is | Mutable? | Rule |
|---|---|---|---|
| **A. Vector XP** | permanent lifetime progression (a fold over award records) | no (projection) | never spent/decreased in normal use |
| **B. Milestone** | a stable achievement earned when defined conditions are met | no once earned | a valid milestone does **not** disappear when future policy thresholds change — it protects the operator from re-weighting |
| **C. Entitlement** | an access right created from a milestone or other verified eligibility (marketplace tier, course, certification path, special room, educator application, business tool, coaching, competition eligibility, profile customization, office hours) | grant/revoke via records | distinct from the **plan** entitlements in `lib/entitlements.ts` (billing-derived); an XP-derived entitlement is a *second, additive source* resolved through the same PEP, never a parallel authz |
| **D. Reward claim** | a one-time benefit claimable after an entitlement/milestone (consultation voucher, exam voucher, template bundle, one-month add-on, event admission, limited profile artifact) | append-only claim record | claiming requires its own authoritative record; **claiming never deducts XP** |

**Milestones stabilize progression:** XP is a running fold (re-weightable forward per policy version); a milestone is a *latched* fact. This is why the ledger stores both the raw awards (for the fold) and the milestone-earned records (immune to re-weighting).

**Latch vs clawback — the reconciliation (economy review 2026-07-20).** A milestone latches against **policy re-weighting**, NOT against **evidence invalidation**. A milestone (or entitlement, or consumed reward claim) built on **revocable evidence** — a referral that may charge back, an outcome that may flip — is **provisional until that evidence matures** past its clawback/chargeback-liability window; on reversal it is revoked via a compensating record (`CREDITVECTOR-ECONOMY.md §11`). **Cash-valued reward claims** (a subscription-month add-on, a consultation/exam voucher) carry real monetary value and therefore inherit the **promotional-credit governance** ([`ADR-0038 §4`](ADR/ADR-0038-professional-growth-economy.md)) — "claiming never deducts XP" is necessary but not sufficient. **Maker-checker** (two independent approvers) applies not just to manual XP adjustments but to entitlement grant/revoke, reward-claim issuance, and every compensating/invalidation write (§6.1).

## 5. Award ledger architecture (the integrity core)

The v1 Arena engine is **reconcile-on-read** (no table — a pure fold over `VerifiedOutcome`). As non-outcome dimensions (education, community, growth) come online, that fold has **no single authoritative source event to reconcile against**, so a **durable append-only award ledger** becomes necessary. Design (migration-first when built; **not built now**):

- **Append-only.** Awards are inserted, never updated or deleted. Corrections are new **compensating** (negative-offset) or **invalidation** records that reference the original — the running total stays a fold, and history is preserved (deterministic recalculation is always possible).
- **Server-authoritative.** Only the Reputation Service writes awards, from a validated domain event. The browser can never supply an amount (OG-2); the amount is a pure function of the versioned policy + the event's evidence.
- **Attribution = the evidence owner**, copied verbatim from the source event's subject — never the acting session (`currentAccount`/`currentUser`). (The Arena un-farmable rule, generalized: an agency operating a client's workspace can never farm the client's XP.)
- **Evidence + lineage on every row:** `sourceEventId` (the `EventEnvelope.id`), `policyId`+`policyVersion` (recorded, for audit + deterministic recalculation), `correlationId`/`causationId` (Event Fabric lineage, ADR-0036), operator + organization tenancy.
- **Tenancy** is keyed on ids (operator id, organization id), never names — the platform-wide isolation rule.

### 5.1 Idempotency identity — canonical form + tradeoff
The prompt proposes `sourceEventId + operatorId + policyId + policyVersion`. **Repository convention argues for a stronger key — and a naïve `sourceEventId` key is a BLOCKER-grade regression** (adversarial review, 2026-07-20). Arena rule 2 keys idempotency on the **stable business entity** (`letterId`): "one letter → at most one award; a `deleted`↔`updated` flip cannot double-count." `EventEnvelope.id` is **per-emission**, and outcomes are mutable (ADR-0014) — a `deleted→updated→deleted` flip emits three fresh event ids, so keying on `sourceEventId` would mint three awards for one letter, **weaker than the v1 reconcile-on-read it replaces.** Canonical **unique constraint** (preserves rule 2):

```
UNIQUE (subjectId, operatorId, awardKind)
```

- **`subjectId` is the stable business entity** the award is *about* (the `letterId`-equivalent: a letter, a certification, a referral, an accepted-answer id) — NOT the per-emission event id. One subject → at most one active award per operator per kind, regardless of how many times its evidence re-emits. This is Arena rule 2, generalized.
- `awardKind` identifies the specific award (`outcome.favorable`, `education.completion`) so one subject legitimately awarding two operators (teacher + learner) or two kinds does not collide.
- `sourceEventId`, `policyId`, `policyVersion` are **recorded on the row** (lineage, audit, deterministic recalculation) but are **not** in the uniqueness key.
- **Mutable evidence → compensating records, never a new award.** When a subject's evidence materially changes (a `deleted` flips to `unknown`), a **compensating/invalidation** record is appended referencing the original — the running fold re-derives the correct total, preserving reconcile-on-read correctness over an append-only ledger. Re-weights are **forward-only** (a v2 policy applies to events after activation; issued awards are never edited; a deliberate recompute is rare, governed, and done via compensating records).

Tradeoff stated: keying on `sourceEventId` (or adding `policyVersion` to the key) allows clean parallel-version recompute but **breaks rule 2** (double-count on outcome flips / policy bumps); keying on the stable `subjectId` matches the frozen-awards rule and keeps the fold monotonic, at the cost of a compensating-record path for corrections. **We key on `subjectId`.** Owner + fraud sign-off gates the migration that introduces the ledger.

## 6. Anti-exploitation architecture (Vector XP is a high-value integrity system)

XP affects prestige, marketplace eligibility, and potentially valuable services, so it is an attack surface. Mandatory controls (design; **owner + fraud + compliance sign-off required before any weight goes live**):

- **Issuance integrity:** server-authoritative · append-only · `UNIQUE(sourceEventId, operatorId, awardKind)` · versioned policies · no hidden mutable balance · separation of duties (the service that *detects* eligibility is not the one that *approves* a manual adjustment) · admin adjustments are themselves audited append-only records · policy rollout behind fail-closed flags.
- **Replay/concurrency:** replay-safe (an event re-delivered awards at most once) · race-condition safe (the unique constraint + a single-writer claim, reusing the kernel `durableIdempotency` pattern) · transactional integrity (award + milestone evaluation in one unit) · deterministic recalculation from the immutable ledger.
- **Velocity & caps:** per-category and per-window (daily/weekly/monthly) caps so no single activity dominates progression (an explicit ADR-0037 OG requirement); reuse the existing `enforceRateLimit` idiom at issuance.
- **Anti-Sybil / anti-collusion / referral integrity:** referral and member-signup XP is **verified-only** and **capped so it can never dominate** (ADR-0037). Signals: duplicate-account detection, self-referral prevention, reciprocal-farming detection, suspicious relationship-graph analysis, bot/automation detection, client-activity **quality** checks (a fake or inactive client earns nothing). Unverified referrals/invites/unpaid-signups/self-acceptance are **already on the Arena prohibited-XP-sources list** — this generalizes it.
- **Holds & review:** pending-verification states, fraud holds (an award can be *pending* and not counted until cleared), reversal/invalidation policy, and an **appeal/review pathway** for contested awards or holds.
- **Privacy:** data-minimization on award payloads (refs, not PII — the Event Fabric refs-only rule); relationship-graph signals are internal, never a public surface.

### 6.1 Controls that MUST be specified before any weight goes live (adversarial review, 2026-07-20)
The review confirmed these as **named-but-unspecified** — each is a binding prerequisite, not a maybe. None is built; all gate the first live weight.
- **Velocity caps bind to the LIVE projection, not only the future ledger.** The live classes A/Aq/D run on unlimited self-service letters over AI-classified *pasted* text ("trivially fabricable"). A concrete **per-window and per-letter cap** (numbers set by product+fraud) must bind to the reconcile-on-read projection **before Arena XP is surfaced at all** — otherwise one ordinary account is an unbounded XP fountain. This is the keystone threat.
- **Define "verified client" before class E mints.** A managed client is a free, passwordless `User` with a synthetic email — the very edge (`managedByAgencyId`) the agency self-mints. Class E requires an **independent, un-fakeable activation signal** (paid / independently-consented / authenticated by the client themselves), never the self-minted edge. "Quality check" must become a named mechanism.
- **Specify a Sybil-resistance primitive + which earning is identity-gated.** Base earning currently needs only an account + pasted text. At least one concrete primitive (device signal / phone / KYC / a paid-plan gate) must gate the earning surfaces, with an explicit statement of what is earnable behind unverified vs verified/paid identity.
- **Define attestation authority for classes B/C/education; forbid self- and reciprocal-attestation.** The multi-operator award path (§5.1, teacher+learner) is the collusion vector. WHO may attest an "accepted answer" / "learner completion" must be defined (thread author or ADMIN / an independent completion record), and mutual/self attestation between related accounts explicitly barred.
- **Fairness — dimension floors + go-live sequencing (OG-1/OG-4).** OG-2 equalizes the *starting line* but not the *accrual slope*: a single lifetime monotonic fold makes business **volume** a proxy for tier, structurally out-ranking smaller-but-excellent operators. Bind: (a) **per-dimension weight floors** so no single dimension (esp. volume/throughput A/Aq/D) can dominate total progression, and (b) a **sequencing rule** — size-independent dimensions (education C, community B, mentorship) ship **before** any XP-gated entitlement or rank activates, so "a legitimate path for new + established operators" is architecturally guaranteed, not asserted.
- **The rank/level ladder is not an opaque overall grade.** Carry PI §3C's "explainable, provenance-tagged, no opaque universal score" rule onto reputation: the lifetime scalar/rank must never render as a de-facto total-quality grade (that is the star-rating OG-1 refuses, by another name).
- **Admin manual adjustments: maker-checker + magnitude cap.** The manual-adjustment path (an exception to server-authoritative-from-event issuance) requires **two-admin (maker-checker) approval** and a **per-adjustment magnitude cap**, on top of the append-only audit — the role model is only `{USER, ADMIN}`, so one admin otherwise holds unilateral mint power.
- **Erasure over an immutable ledger.** The append-only ledger and the data-subject erasure right must be reconciled: on erasure, **tombstone/crypto-shred the identity join + suppress all projections**, retaining only pseudonymous, PII-free award rows (refs-only already helps) — with a CCO-approved written position on that retention. Neither the ledger nor the profile may leave this unresolved.
- **Entitlement revocation notice (carry milestone-latching to entitlements).** An entitlement an operator *relied on* is not silently revoked on a reweight; add a notice/grandfathering rule (§4C), mirroring §4B milestone latching.

## 7. Earning dimensions (categories, not amounts)

No single dimension may dominate total progression (OG). Each maps onto the Arena class system (`policy.ts`); **final weights/formulas require product + economic + fraud + compliance + owner approval — no production numbers are invented here.**

| Dimension | Examples | Arena mapping today |
|---|---|---|
| **Business operations** | client onboarding, timely activity, workflow completion, consistent case mgmt, follow-up discipline, evidence handling | classes **A/Aq/D** (LIVE, documented cap) |
| **Business growth** | *verified* members/clients onboarded, *qualified* referrals, retention milestones, team development | class **E** (pending — needs the verified `managedByAgencyId` edge + first cycle; §6 caps referrals) |
| **Professional development** | credit/financial-literacy education, Campus learning, certifications, assessments | class **C** (pending — needs durable Campus completion evidence) |
| **Education & mentorship** | classes hosted, office hours, approved content, verified learner completion | pending — needs verified teaching/learner-completion evidence |
| **Community contribution** | helpful/accepted answers, moderation assist, verified bug reports, product feedback | class **B** (pending — needs a durable "accepted" signal) |
| **Marketplace & innovation** | approved SOPs, templates, workflows, educational products, reusable assets | pending — needs an approved-asset signal |

Pending classes mint **nothing** until a durable, un-fakeable evidence source exists (the Arena discipline: no reachable tier without real evidence).

## 8. What this service does NOT own

Identity (→ `OPERATOR-IDENTITY.md`) · business health/KPI/SOP (→ `PERFORMANCE-INTELLIGENCE.md`) · notification content (→ emitting context, ADR-0036) · marketplace inventory/pricing (→ Marketplace) · the Event Fabric transport (→ ADR-0035) · Kai reasoning · **cash: affiliate commissions and any promotional credits are SEPARATE instruments with separate ledgers ([`ADR-0038`](ADR/ADR-0038-professional-growth-economy.md) PGE-4) — Vector XP never converts to or from them, and is never a credit/coin/token/currency (PGE-3).** It **reads** domain events and the policy; it **writes** only awards/milestones/entitlements/claims.

**Service dispositions (ADR-0038 §5):** **Milestone** = a module *inside* this service (a latched projection over the award ledger), not a separate microservice. **Entitlement** = a *distinct* context (grants/eligibility/lifecycle/revocation/audit, resolved through the existing PEP as an additive source). **Reward Claim** = a module inside the Entitlement Service (one-time consumption record). The economy's improvement-recognition, competitions/cohorts, and instrument-separation laws live in [`CREDITVECTOR-ECONOMY.md`](CREDITVECTOR-ECONOMY.md).

## 9. Status & gates

PROPOSED. No table/migration/flag/code. Public cross-user reputation surfaces stay under the CROA §1679b / FTC §5 counsel STOP (the Arena refusal register is binding). First build slice is owner-gated and **depends on Operator Identity first** (OG-3). When built: migration-first ledger + versioned policy + fraud sign-off + fail-closed flag.
