# CreditVector Growth Network — Product Specification

Status: **PROPOSED FOR FOUNDER REVIEW · DORMANT**  
Version: **1.0**  
Date: **2026-07-31**  
Technical authority: [`GROWTH_NETWORK_ARCHITECTURE.md`](GROWTH_NETWORK_ARCHITECTURE.md)  
Delivery authority: [`GROWTH_NETWORK_ROADMAP.md`](GROWTH_NETWORK_ROADMAP.md)

> This specification describes the intended product and acceptance contract. It authorizes no public surface, database, payment, tax, billing, provider, or production change.

> **Growth Center Foundation Preview addendum (2026-07-31):** former “no route/UI” and “zero consumer” acceptance statements continue to govern the dormant economic/program foundation. ADR-0041 adds only a synthetic Founder-review projection at `/review/growth-center`; its seven presentation districts are review vocabulary, not a replacement for §5.1, participant availability, or a new source of truth.

## 1. Product definition

CreditVector Growth Network (CGn) is intended, after separate approvals, to help participants build durable businesses and careers through verified contribution, education, mentorship, operational quality, and independently validated value. No participant-facing CGn program is active.

It is not an affiliate dashboard, referral plugin, MLM, recruiting game, social popularity system, or promise of income. It is the governed economic layer through which CreditVector may eventually recognize and account for multiple kinds of professional value.

## 2. Outcomes

CGn would succeed when it:

1. gives future Agency Builders a transparent route to qualify for an approved Agency Growth Distribution without rewarding recruitment;
2. can eventually support independently approved Professional Operator revenue paths without forcing agency ownership;
3. makes every eligibility, hold, reversal, and statement explainable and appealable;
4. improves operator retention through education, mentorship, and useful operating systems—not lock-in;
5. keeps reputation, health, attribution, entitlements, accruals, and cash structurally separate;
6. enables organization collaboration without creating a chat clone or weakening deterministic ownership;
7. gives Kai enough authorized context to prepare excellent advice without letting AI own or execute truth;
8. prevents fraud and deceptive growth incentives before any economic activation.

## 3. Non-goals

The foundation does not include:

- production distributions, payouts, settlement, ACH, PayPal, crypto, stored value, wallets, or bank accounts;
- Stripe, billing, checkout, subscription, pricing, or entitlement changes;
- tax form collection, validation, filing, withholding, or advice;
- public earnings claims, income projections, leaderboards, ratings, or public Growth Reputation;
- recruiting trees, downlines, upline overrides, rank by headcount, team-volume bonuses, or pay-to-earn;
- modifications to Mission Control, Agency Command, Arena, CXOS rooms, Community, or the existing dispute-campaign engine;
- a second identity, organization, membership, reputation, health, event, analytics, task, calendar, document, or messaging owner;
- autonomous Kai actions.

## 4. Personas and permissions

| Persona | Primary job | Product boundary |
|---|---|---|
| **Professional Operator** | Build an independent professional path through verified contribution and direct value creation | Does not need an organization or Agency Builder path |
| **Agency Builder** | Build a lawful, healthy organization and mentor operators | Organization ownership does not automatically make the owner the payee |
| **Organization Operator** | Work, learn, mentor, and contribute inside an organization | Membership determines access, not `managedByAgencyId` |
| **Educator / Creator** | In a future approved program, publish useful learning or Kai assets and receive proceeds from accepted sales/use | Popularity and promotional reach do not establish quality |
| **Mentor / Consultant** | Deliver accepted professional services | Any future approved compensation is for own verified service; no claim on mentee revenue |
| **Growth Leader** | Functional permission to coordinate an approved program, training, or organization improvement initiative—not a rank | Cannot alter source evidence, ledger, or risk decisions |
| **Integrity Reviewer** | Investigate economic-risk cases | Signals are not guilt; maker-checker and conflict rules apply |
| **Finance Reviewer** | Approve accrual/statement/reconciliation under future policy | Cannot edit qualification evidence or self-approve |
| **Tax Administrator** | Manage future tax-readiness workflow | Tax data is isolated and never available to Kai, analytics, or general fraud scoring |
| **Platform Administrator** | Operate scoped controls and audits | Step-up authentication, reason, least privilege, and immutable audit required |
| **Kai Growth Strategist** | Explain, recommend, summarize, and prepare | Read-only intelligence; never a record owner or approver |

All permissions derive from authenticated account, active Operator Identity, applicable Organization Membership, PEP/capability, feature flag, and record scope. A display role alone never grants access.

**Verified** means a named source owner accepted a specific record under a versioned policy at a stated time. It is not an endorsement, predicted success, payment assurance, or guarantee that the record remains valid after later source correction.

## 5. Product information architecture

### 5.1 Growth Center and its Overview

The future Growth Center is the single top-level experience. “Growth Dashboard” is the name of its default Overview view, not a duplicate destination. Across its child views, it must answer:

- Which path or paths am I participating in?
- What verified value have I contributed?
- What is qualified, pending verification, held, or ineligible—and why?
- Which revenue streams have records?
- What must I do next, and who owns that action?
- What is the current Agency Growth Distribution cycle and its scheduled 15th date?
- What policy/version and evidence support each result?
- How do I correct evidence or appeal a decision?

It must not present speculative earnings, countdown pressure, confetti, recruit counts, public rank, or false precision.

The information architecture is one hierarchy; these are sections/views, not a mandate for a generic card mosaic:

```text
Growth Center
├─ Overview (the Growth Dashboard)
│  1. Program stage + selected scope
│  2. Review needed + next human action
│  3. Latest source-confirmed record + freshness
├─ Evidence
├─ Program Records
├─ Growth Reputation
├─ Organization Growth        [organization scope only]
├─ Education & Mentorship
└─ Reviews & Appeals

Team Operations               [separate future workspace]
```

The selected scope—`Personal` or a specifically named organization—is persistent, visible, and announced to assistive technology. Personal and organization records are never mixed silently.

The Overview contains only three priorities:

1. **Program mode/stage and selected scope** — dormant/shadow/live truth plus Personal or named Organization.
2. **Review needed and next human action** — the most important accountable action; Kai may explain/prepare only.
3. **Latest source-confirmed record and freshness** — no projected amount or synthetic balance.

Evidence, Program Records, Growth Reputation, Organization Growth, Education & Mentorship, and Reviews & Appeals remain child views in the hierarchy above.

### 5.2 Program mode and date presentation

| Mode | Participant-facing contract |
|---|---|
| `DORMANT` | No participant-facing route, personal status, amount, or payment date |
| `SHADOW` | Persistent “Simulation only — no payment or legal obligation”; no currency, projected totals, countdown, or personal payment date |
| `LIVE_NO_ACCRUAL` | Program calendar may be shown; no personal payment date or amount |
| `LIVE_ACCRUED` | Show only the recorded obligation with policy/source; do not imply settlement |
| `LIVE_SCHEDULED` | Show only after future provider instruction acceptance; disclose bank settlement may differ |
| `LIVE_SETTLED` | “Paid” is permitted only with a reconciled provider receipt |

Canonical schedule copy: **“The 15th is the Agency Growth Distribution program's target schedule date. It does not mean every participant is paid monthly or that funds settle that day.”**

### 5.3 Team Operations

Team Operations is a proposed focused **experience** that composes records from canonical owners; it is not a new generic task, messaging, campaign, calendar, or document store. It may eventually present:

- organization spaces and bounded channels;
- internal announcements;
- accountable tasks and handoffs;
- meeting preparation and action drafts;
- optional coarse presence;
- shared-work references;
- mentoring and training coordination;
- Kai summaries and preparation.

It is not a general social network or real-time chat product. It prioritizes decisions, responsibilities, evidence, and durable work state.

## 6. Functional requirements

### 6.1 Participation

| ID | Requirement | Acceptance condition |
|---|---|---|
| GN-PAR-01 | Support both paths independently and simultaneously | An operator can participate without an organization; Agency Builder enrollment requires canonical identity/org/owner membership |
| GN-PAR-02 | Separate program participation from identity roles | Changing a program cannot change Identity, Organization, or Membership truth |
| GN-PAR-03 | Capture agreement/policy version and effective dates | Every active episode cites immutable acceptance evidence |
| GN-PAR-04 | Fail closed on suspended/inactive prerequisites | No qualification or economic approval proceeds |
| GN-PAR-05 | Do not infer payee from organization owner | Explicit payee designation and future tax readiness are required |

### 6.2 Qualification and contribution

| ID | Requirement | Acceptance condition |
|---|---|---|
| GN-QUA-01 | Evaluate only sealed source-owned evidence | Every input has owner, subject ref, occurrence/effective time, digest/provenance, and policy version |
| GN-QUA-02 | Use deterministic versioned policy | Same sealed inputs + policy yield byte-equivalent decision |
| GN-QUA-03 | Disclose reasons | Qualified, held, and ineligible decisions expose bounded user-safe reasons and evidence references |
| GN-QUA-04 | Refuse recruitment/popularity/activity shortcuts | Recruiting, invitations, clicks, raw signups, likes, views, logins, messages, and follower counts cannot qualify |
| GN-QUA-05 | Validate actors without rewarding their count (proposed; Phase 0.5 decision) | Current compliance mechanism: operator-related evidence is admissible only when its actor was independently verified and active during the evidence window; operator count/addition cannot unlock eligibility or affect allocation |
| GN-QUA-06 | Keep reputation non-monetary | No XP, rank, milestone, or Growth Reputation dimension converts into cash or determines an amount by itself |
| GN-QUA-07 | Support invalidation and replay | Source invalidation creates a new decision/reversal trail; history remains immutable |
| GN-QUA-08 | Protect improvement integrity | Cohorts, baselines, exclusions, completeness, and anti-sandbagging rules are policy-versioned |

### 6.3 Monthly Growth Distribution

| ID | Requirement | Acceptance condition |
|---|---|---|
| GN-DST-01 | Schedule Agency Growth Distribution for the 15th | Explicit `AgencyDistributionMonth` `YYYY-MM` maps to the same month's `YYYY-MM-15`; never infer from an observation month; settlement timing is not claimed; other streams keep source/contract cadence |
| GN-DST-02 | Separate qualification from amount and settlement | UI/API/state cannot imply that `QUALIFIED` means accrued, scheduled, or paid |
| GN-DST-03 | Seal a cycle | Source watermarks, policy, participants, and decision digest are immutable after lock |
| GN-DST-04 | Support holds | Fraud, compliance, tax, identity, dispute, missing evidence, and finance holds are explicit and reason-coded |
| GN-DST-05 | Require maker-checker | No actor/system can both produce evidence/qualification and finally approve an accrual |
| GN-DST-06 | Handle late evidence | It moves to the next cycle or explicit adjustment under policy; no silent retroactive rewrite |
| GN-DST-07 | Support statements | Gross, adjustments, reversals, holds, withholding, and net are separate; policy/evidence/appeal links included |
| GN-DST-08 | Never claim payment without receipt | Only reconciled provider receipt may produce `SETTLED` in a future phase |

### 6.4 Revenue streams

CGn must support distinct source and accounting semantics for:

| Stream | Qualifying source | Key controls |
|---|---|---|
| Agency Growth Distribution | Sealed organization-quality qualification | No per-recruit/headcount multiplier, paid-retention, credit outcomes, or required purchase |
| Marketplace Sales | Settled marketplace order | Seller/payee, refund, chargeback, complaint, takedown, tax classification |
| Course Sales / Education | Settled order or accepted direct service | Content quality, IP, corrections, learner protection, no outcome promises |
| Mentorship | Accepted completed engagement | Independent attendance/outcome evidence; no future-revenue override |
| Consulting | Accepted completed engagement | Scope/delivery/dispute and worker-classification analysis |
| Kai Assets | Licensed/sold approved asset | Prompt/security review, IP rights, no secrets/PII, marketplace policy |
| Affiliate Growth | Future qualified attribution after independent conversion/maturation | One-level is proposed pending Founder/counsel; disclosure, no self/related-party, no review incentives, no recruitment |
| Sponsorships / Partnerships | Future signed program and verified delivery | Contract-specific policy, brand/compliance review |
| Enterprise Programs | Future contract and accepted deliverables | Explicit payer/payee, service, tax, privacy, security, and revenue-recognition terms |

Streams may share infrastructure only when accounting, policy, and legal semantics stay explicit. Cross-stream offsets are off unless separately authorized.

### 6.5 Referral Attribution and affiliate growth

| ID | Requirement | Acceptance condition |
|---|---|---|
| GN-ATT-01 | Capture a bounded attribution episode | Policy, touchpoint class, disclosure, consent, expiry, subject refs, and disposition are present |
| GN-ATT-02 | Qualify only after independent value | Click/invite/signup cannot qualify; source owner confirms activation and maturation |
| GN-ATT-03 | Detect conflicts | Self, same payer/beneficiary, related party, duplicate, circular, and collusive patterns hold/exclude |
| GN-ATT-04 | Keep attribution depth owner/counsel gated | If the Founder and counsel ratify a one-level constraint, no inherited downstream economics or genealogy may exist |
| GN-ATT-05 | Enforce disclosures | Approved channel/language disclosure version, monitoring, remediation, and suspension workflow |
| GN-ATT-06 | Exclude review sentiment | Reviews, ratings, positive sentiment, likes, and follower counts cannot earn compensation |

### 6.6 Growth Reputation View

| ID | Requirement | Acceptance condition |
|---|---|---|
| GN-REP-01 | Reuse canonical Reputation and Performance Intelligence | No new award/score/ledger or recalculation of source truth |
| GN-REP-02 | Show separate dimensions | Mentoring, onboarding, operator success, education, retention, contribution, and ecosystem health remain separate |
| GN-REP-03 | Cite provenance | Every displayed fact identifies source owner, policy, effective window, and freshness |
| GN-REP-04 | Default private | Own-data visibility; organization views role/purpose/consent limited; public off |
| GN-REP-05 | Be rebuildable | Projection deletion/replay does not destroy canonical evidence |
| GN-REP-06 | No popularity or cash conversion | Guard and policy reject ranking, rating, social activity, and amount conversion |

Persistent descriptor: **“Private evidence record — not a rating, rank, or payment score.”** The view groups by subject:

```text
Your contribution
  Mentoring · Education · Contribution

Organization outcomes
  Onboarding · Operator success · Retention · Ecosystem health
```

Organization administrators see aggregate organization outcomes by default, not named personal reputation. Peer comparison is excluded from v1 and every shadow pilot. Each row shows source owner, policy/window, last-verified time, and correction/appeal route.

“Operator success” and “ecosystem health” are not free-form composite scores:

| Concept | Candidate allowed evidence (policy/counsel review required) | Refused evidence |
|---|---|---|
| Operator success | accepted education/mentorship/service outcomes; independently verified operational improvement; correction quality; repeated lawful contribution within a fair cohort | credit-score/deletion outcomes, dispute volume, revenue or client count alone, testimonials, self-claims, hours/messages, recruit count |
| Ecosystem health | substantiated complaint/remediation rate; invalidation/reversal quality; cross-organization contribution accepted by source owner; safe retention and successful exits; evidence diversity | network/headcount growth, paid retention, prevented cancellation, engagement/popularity, hidden churn, participant purchases |

Each dimension displays allowed source facts separately. Neither phrase may become an opaque universal score or an amount input.

### 6.7 Economic ledger and reporting

| ID | Requirement | Acceptance condition |
|---|---|---|
| GN-LED-01 | Append-only journal | Corrections use linked adjustment/reversal entries |
| GN-LED-02 | Deterministic idempotency | Retry produces no duplicate; same key/different payload is a conflict |
| GN-LED-03 | Integer money model | Minor units + ISO currency; no floating point |
| GN-LED-04 | Balanced accounting | Journal lines balance under accountant-approved account model |
| GN-LED-05 | Preserve lineage | Source, participant/payee, cycle, policy, evidence, approval, and causation refs exist |
| GN-LED-06 | Distinguish instruments | XP, health, entitlements, promotional value, billing, obligations, and cash cannot share type/field semantics |
| GN-LED-07 | Reconcile | Projections reconcile to journal; future settlement reconciles to provider receipts |
| GN-LED-08 | Protect reporting | Statements are immutable snapshots or versioned replacements; prior views remain auditable |

### 6.8 Fraud, suspension, disputes, and appeals

| ID | Requirement | Acceptance condition |
|---|---|---|
| GN-RSK-01 | Treat signals as evidence, not guilt | A signal creates/references a case; it does not silently punish |
| GN-RSK-02 | Human review for material adverse decisions | Reviewer authority, conflict checks, evidence, rationale class, and effective time are recorded |
| GN-RSK-03 | Scope suspension | CGn can hold/suspend economic participation; only Identity can suspend identity/org/membership |
| GN-RSK-04 | Provide notice and appeal | User-safe reason, evidence request, deadline, appeal route, independent reviewer, and SLA |
| GN-RSK-05 | Protect detection | Exact thresholds need not be disclosed; outcome reasons remain explainable |
| GN-RSK-06 | No autonomous AI disposition | Kai/LLM cannot create risk truth, suspend, reverse, or release |
| GN-RSK-07 | Handle post-settlement reversal safely | No automatic account debit; legal/accounting policy determines offset/recovery |

### 6.9 Tax readiness

| ID | Requirement | Acceptance condition |
|---|---|---|
| GN-TAX-01 | Separate payee from operator/org | Actual legal payee and tax identity are explicit |
| GN-TAX-02 | Use tax-year policy | Thresholds, form class, withholding, jurisdiction, and filing party are versioned; no eternal constants |
| GN-TAX-03 | Isolate tax data | W-9/TIN/document data is encrypted, restricted, absent from events/logs/Kai/analytics/fraud |
| GN-TAX-04 | Support payer/form matrix | Legal payer × payee × stream × agreement × rail × tax year × jurisdiction determines reviewed classification |
| GN-TAX-05 | Fail closed | Missing/invalid readiness blocks release, not account access or reputation |
| GN-TAX-06 | Preserve corrections | Notice, mismatch, withholding, corrected-return, and prior-year reversal states are auditable |

No tax requirement is implemented in the foundation.

### 6.10 Team Operations

| ID | Requirement | Acceptance condition |
|---|---|---|
| GN-OPS-01 | Canonical tenant authorization | Account → Operator → Organization Membership → PEP on every read/write |
| GN-OPS-02 | Deterministic record owner | Every displayed workspace/channel/work item/brief retains one canonical owner; unresolved ownership blocks schema; Kai never becomes owner |
| GN-OPS-03 | Focused channels | Any channel comes from Operator Network or a separately approved Rooms owner; CGn creates no third messaging stack |
| GN-OPS-04 | Accountable work | Agency task/campaign/priority truth remains with Agency Command; non-agency work ownership requires an ADR before implementation; no hidden Kai assignment |
| GN-OPS-05 | Meeting preparation, not calendar ownership | Brief may reference schedule; canonical calendar/scheduler owns the event |
| GN-OPS-06 | Privacy-safe presence | Off by default, opt-in, coarse/ephemeral, short retention, never used for evaluation |
| GN-OPS-07 | Safe shared work | References canonical encrypted storage; no public object URLs or unrestricted embeds |
| GN-OPS-08 | Immediate revocation | Suspended/removed membership loses access without relying on stale client state |
| GN-OPS-09 | No customer PII in general workspace | UI warnings, policy, classification, detection, and canonical structured workflow |
| GN-OPS-10 | No protected-surface coupling | Independent route/package later; no changes to Agency Command/Mission Control/Community/CXOS |
| GN-OPS-11 | No surveillance economics | Task completion, availability, presence, channel activity, message count, and response time cannot feed compensation, Growth Reputation, retention, or worker evaluation |

### 6.11 Kai Growth Strategist

| ID | Requirement | Acceptance condition |
|---|---|---|
| GN-KAI-01 | Read authorized structured projections | No direct ledger/tax/document/database access outside approved tools |
| GN-KAI-02 | Cite evidence and uncertainty | Every material assertion has provenance or states what is missing |
| GN-KAI-03 | Prepare only | Plans, briefs, drafts, and recommendations require user action in the owner system |
| GN-KAI-04 | Never calculate unratified economics | No invented rates, distributions, tax conclusions, or earnings forecasts |
| GN-KAI-05 | Preserve compliance bar | No credit-repair promises, earnings promises, unauthorized legal/tax advice, or deceptive endorsements |
| GN-KAI-06 | Keep untrusted content fenced | Marketplace/team/user content cannot override policy, tools, or system instructions |

### 6.12 Economic governance and shadow isolation

| ID | Requirement | Acceptance condition |
|---|---|---|
| GN-ECO-01 | Define funding before formula | Founder/Finance/CCO approve economic nature, funding source, cycle budget, maximum liability, reserves, and GCL value capture |
| GN-ECO-02 | Prevent cross-subsidy and chain funding | No new participant payment, required purchase, unrelated revenue stream, XP, or promotional value funds another participant unless explicitly lawful/accounted and prospectively approved |
| GN-ECO-03 | Govern policy changes | RACI, maker-checker, effective date, simulation, notice, immutable version, rollback, and appeal impact are documented |
| GN-ECO-04 | Isolate shadow records | Shadow qualification/journal types and storage have no transition/copy/post path to live obligations; a future live pilot recomputes from approved source evidence |
| GN-ECO-05 | Cap expectation liability | UI/terms distinguish shadow, qualified, held, accrued, scheduled, and settled; no prospective income promise or retroactive funding/formula change |
| GN-ECO-06 | Prove unit economics | Incremental retained gross profit/value capture is evaluated after distributions, integrity, support, tax/payment, refunds, and operating cost before scale |

## 7. State models

### 7.1 Participation

```text
NOT_ENROLLED → PENDING_ACCEPTANCE → ACTIVE → SUSPENDED → ACTIVE
                                      └────→ ENDED
```

No transition alters Identity or Membership. Every transition is actor-, authority-, reason-, policy-, and time-stamped.

### 7.2 Evidence qualification

```text
RECEIVED → PENDING_VERIFICATION → ACCEPTED → MATURED
                     │              │          │
                     ├→ HELD        ├→ INVALIDATED
                     └→ REJECTED    └→ HELD
```

The source owner controls source validity; Growth Policy controls economic qualification.

### 7.3 Orthogonal qualification, case, ledger, and settlement models

```text
QualificationDecision (Growth Policy):
  DRAFT → QUALIFIED / INELIGIBLE → SUPERSEDED

DistributionCase (Growth Distribution; references decision):
  OPEN → HELD / READY_FOR_ACCRUAL → CLOSED / CANCELLED

Ledger (append-only facts, no mutable status):
  ACCRUAL · HOLD · RELEASE · ADJUSTMENT · REVERSAL

SettlementReference (future provider phase only):
  PREPARED → SCHEDULED → SETTLED / FAILED / RETURNED
```

One model never mutates or impersonates another. Foundation code creates none of these records.

### 7.4 User-facing state language

| Internal fact | User-facing label and constraint |
|---|---|
| qualification `DRAFT` | “Cycle open — records may change” |
| source reconciliation | “Checking source records” |
| `QUALIFIED` | “Evidence requirements met — no payment amount has been created” |
| case `HELD` | “Review needed”; show category, next owner, requested evidence, actual deadline if one exists, and appeal route without accusation |
| `INELIGIBLE` | “Not qualified for this cycle”; always cycle/policy scoped, never a label on the person |
| journal `ACCRUAL` | “Amount recorded” |
| settlement `SCHEDULED` | “Processing scheduled — not yet settled” |
| settlement `SETTLED` | “Settled” |
| linked adjustment/reversal | “Record adjusted”; original and correction remain visible with support route |

## 8. UX requirements

### 8.1 Trust language

- Prefer “verified,” “pending verification,” “held for review,” “scheduled,” and “settled” only when true.
- Never use “guaranteed,” “passive income,” “replace your salary,” “easy recurring revenue,” “everyone earns,” or credit-outcome promises.
- Separate “qualified” from “payable” and “paid.”
- Explain that outcomes depend on policy, evidence, review, taxes, adjustments, and future provider settlement.
- Show policy version and “why” without exposing private anti-fraud thresholds.

### 8.2 Enrollment, exit, and no dark patterns

- No preselected path, bundled consent, default marketing opt-in, required purchase, paywall-to-earn, countdown, streak, badge, progress-to-payment meter, scarcity, shame language, or notification pressure.
- Participants review policy and material terms before accepting and may select one path, both paths where allowed, or neither.
- Program agreement, tax certification, and marketing consent are separate acts.
- Declining or ending participation cannot remove unrelated CreditVector access.
- Exit and appeal must be no harder than enrollment; the effect on prospective participation is explained before confirmation.
- Reversal and hold surfaces use neutral facts, never guilt, threat, or loss-aversion framing.

### 8.3 Design-system and accessibility contract

- Any future CGn UI uses [`.ai/DESIGN-SYSTEM.md`](.ai/DESIGN-SYSTEM.md), Plus Jakarta Sans, existing token classes, and the established navy/blue/teal system. Green is reserved for objectively completed/settled states, not qualification or prospective money.
- No coins, trophies, confetti, rising-money charts, payout progress rings, ornamental gold, generic card mosaics, or casino/game patterns.
- WCAG 2.2 AA target; semantic headings, landmarks, lists, tables, and status regions.
- Entire experience works by keyboard with visible focus and logical focus return.
- Interactive targets are at least 44 CSS pixels where applicable; content reflows at 320 CSS pixels and remains usable at 200% text and 400% zoom.
- Status is never conveyed by color alone; text and icons have accessible names.
- Charts have text/table alternatives and do not require hover; tables have captions/header associations and a non-table mobile presentation.
- Financial numbers use readable labels, locale formatting, currency, sign, and unambiguous negative/reversal presentation.
- Motion is nonessential, honors reduced motion, and never celebrates a financial result.
- Holds, disputes, freshness changes, and errors use polite live regions without stealing or moving focus.
- Mobile preserves the decision/evidence/action order; no horizontal-scroll dependency.
- Plain-language summaries accompany policy/legal detail.
- No tooltip-only explanation or hover-only data; stale snapshots always display freshness.

### 8.4 Surface-state matrix

| Surface | Loading | Empty | Error/stale | Success | Partial/review |
|---|---|---|---|---|---|
| Overview | Shape-neutral; no resolved counts | No program record + safe next step | Last verified snapshot with age | Current stage and next action | Each unavailable dependency labeled independently |
| Evidence | “Checking source records” | No evidence window exists | Preserve correction draft/route | Requirements met, explicitly non-monetary | Missing sources itemized |
| Program Records | No amount-shaped skeleton | No posted record; never “$0 earned” | No synthetic balance | Actual posted facts only | Gross, holds, adjustments, net separated |
| Growth Reputation | No rank/score silhouette | Explain how source evidence appears | No inferred dimensions | Source rows with provenance | Stale/unavailable dimensions disclosed |
| Reviews & Appeals | Preserve draft submission | “No open reviews” | Retry without losing evidence | Receipt/reference and SLA | Requested evidence and remaining steps |
| Team Operations | No resolved occupancy | Explain unavailable/not configured | Owner-by-owner stale state | Canonical work refs only | Each owner dependency disclosed |

### 8.5 Journey storyboard

| Moment | Required experience |
|---|---|
| First visit | Program mode/stage first; no earnings teaser or forced enrollment |
| Enrollment | Terms before acceptance; one, both, or neither path; separate consents |
| Routine review | Scope, verified state, review needed, freshness, next human action |
| Hold | Neutral language, evidence source, owner, actual deadline, correction and appeal |
| Reversal | Original record plus correction; reason class and support route |
| Exit | Clear effect on prospective participation; no unrelated-access penalty |

### 8.6 General empty, loading, unavailable, and error rules

- Empty: explain why no data exists and the safe next step; never imply failure or zero earnings.
- Loading: do not reveal resolved counts or status through skeleton shape.
- Unavailable: distinguish feature disabled, missing permission, dependency unavailable, and not yet instrumented.
- Error: retain last verified snapshot with age/provenance when safe; do not synthesize values.
- Permission denied: no record existence leak.
- Held: identify category and next owner/action without accusing the user.

## 9. Analytics and success measures

Analytics must use the existing analytics owner and approved metric registry. Candidate measures require formal definitions before instrumentation:

### Proposed north star

**Verified Repeat Value Rate:** the percentage of an eligible, policy-defined cohort that produces at least one independently verified, non-recruiting value outcome in two consecutive observation windows without a material unresolved integrity/compliance issue. Every numerator event is source-owned; credit outcomes, purchases, raw activity, popularity, and headcount are excluded. This is a **proposal** until the metric owner defines cohort, completeness, exclusions, minimum k-anonymity, and policy version.

Business viability is a paired measure, not the product north star: incremental retained gross profit/value capture after distribution, integrity, support, refund, tax/payment, and program operating cost.

### Operating measures

- qualification-decision completeness and explainability;
- cycle sealing and statement correctness;
- duplicate/replay conflict rate;
- hold aging and appeal SLA;
- reversal/dispute rate by source stream;
- operator education/mentorship completion quality;
- organization retention and health improvement by fair cohort;
- fraud false-positive/false-negative review outcomes;
- cross-tenant/authz violations (target zero);
- payout reconciliation difference (future target zero);
- share of participants earning through each path and stream, with expenses/context before any external use.

Forbidden vanity measures include recruits, invitation volume, likes, views, follower counts, raw messages, streaks, and hours online.

### Kill metrics

Pause the affected wedge/stream and require Founder/CCO review when an owner-set threshold is crossed for:

- distribution or eligibility correlating with operator count/addition, participant purchases, or paid retention;
- negative incremental unit economics after full integrity/support/program cost;
- obligation projection above funded pool/reserve/liability cap;
- unexplained journal/reconciliation difference or duplicate posting;
- cross-tenant authorization/privacy incident;
- substantiated complaint, reversal, appeal-overturn, or fraud false-positive rate;
- earnings concentration inconsistent with stronger verified value;
- participants unable to reach first verified value without recruiting or an existing audience;
- external earnings/credit-outcome/disclosure violation;
- support/review load exceeding the approved operating budget.

## 10. Privacy and retention

- Purpose-limit every field and projection.
- Default to own-data; cross-user data requires consent, minimum cohort, disclosure, and CCO/privacy approval.
- Team presence is ephemeral and never reused for reputation, retention, fraud, or compensation.
- Tax data stays in its own restricted context and is never a duplicate-account key.
- Economic records use a counsel/accountant-approved retention matrix; a proposed seven-year engineering baseline is not legal approval.
- Legal holds are explicit, scoped, auditable, and reversible when released.
- Deletion/erasure preserves legally required economic/audit facts while de-identifying or severing optional profile/display data under policy.

## 11. Compliance acceptance criteria

Before a live pilot, all must be true:

1. Compensation counsel confirms the formula and real incentives do not reward recruiting, purchases, headcount, paid retention, or downstream activity.
2. CROA/TSR/CFPA/state credit-services review approves every agency-eligibility input, term, training, and monitoring control.
3. Employment counsel classifies each relationship and reviews Team Operations/task/presence controls.
4. Tax adviser approves payer/payee/form/withholding/jurisdiction matrix.
5. Privacy/security counsel resolves GLBA/Safeguards and state privacy scope.
6. Payments counsel resolves custody/money-transmission before provider design.
7. Earnings/endorsement copy has substantiation, disclosure, monitoring, and complaint controls.
8. No purchase/subscription itself generates or increases compensation or is bought solely to qualify; any legitimate platform-access requirement is separately valued and Founder/counsel approved.
9. Appeals, suspensions, reversals, retention, incident response, and maker-checker controls are operationally tested.
10. Production flags, schema, jobs, routes, and providers receive a separate owner-approved release decision.
11. Founder/Finance approve funding source, maximum liability, reserve/solvency, no-cross-subsidy, and GCL value-capture model.
12. Shadow records are physically/type isolated and cannot be promoted into live obligations.

## 12. Foundation acceptance criteria

The current dormant foundation passes review only if:

- it is schema-free and has no production mutation path;
- the master feature is off unless exactly enabled;
- payout execution is hard-off with no environment override;
- the only concrete schedule value is day 15;
- no amounts, rates, qualification windows, tax thresholds, or provider choices are encoded;
- paths and revenue streams are typed and distinct;
- non-qualifying recruiting/popularity/activity signals are explicit;
- code has zero consumers and no route/UI/job/subscriber;
- code has no billing, Stripe, Prisma, Event Fabric store, Reputation repository, protected-surface, network, or provider dependency;
- tests and static checks prove these invariants.

## 13. Open product decisions

- First shadow cohort and path.
- Economic nature, funding source, maximum liability, reserves, no-cross-subsidy, and GCL value capture.
- Pilot contribution categories and evidence minimums.
- Qualification/verification window.
- Weekend/holiday handling for the 15th.
- Growth Distribution amount formula, caps, reserves, and loss/reversal treatment.
- Any proposed organization-authenticity evidence that does not use operator count/addition as an eligibility or allocation factor.
- Public name and presentation of Growth Reputation View.
- Team Operations v1 record set after overlap review with existing/future owners.
- Payor-of-record, participant agreement types, launch jurisdictions, and tax/work classification.
- Appeal SLA, support model, retention schedule, and external disclosures.

All remain owner-gated; none blocks the dormant contract foundation.
