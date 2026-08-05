# ADR-0042: Growth Experience Phase 1B Non-Monetary Capability Contract

Status: **GROWTH EXPERIENCE PHASE 1B — AUTHORIZED NON-MONETARY CONTRACT WORK**  
Date: 2026-07-31  
Decision owner: Founder  
Authorized phase status: **GROWTH EXPERIENCE PHASE 1B — AUTHORIZED NON-MONETARY CONTRACT WORK**  
Package state: **READY FOR FOUNDER REVIEW**  
Derives from: [`ADR-0039`](ADR-0039-growth-network-foundation.md) · [`ADR-0041`](ADR-0041-growth-center-foundation-preview.md) · [`GROWTH_NETWORK_CONSTITUTION.md`](../../GROWTH_NETWORK_CONSTITUTION.md) · [`DECISION_MATRIX.md`](../../DECISION_MATRIX.md)

## Context

The Founder approved Growth Experience Phase 1A with conditions as a protected, synthetic, non-monetary Founder Preview. The Founder then authorized **Growth Experience Phase 1B — Non-Monetary Capability Contract** for architecture, product specification, deterministic review fixtures, and protected Founder Preview work only.

The controlling statuses are intentionally separate:

1. **CGN ECONOMIC PHASE 1A — BLOCKED**
2. **GROWTH EXPERIENCE PHASE 1A — APPROVED FOUNDER PREVIEW**
3. **GROWTH EXPERIENCE PHASE 1B — AUTHORIZED NON-MONETARY CONTRACT WORK**

The Founder Economic Decision Matrix remains unratified. Live economics remains NO-GO. Phase 1B has no authority for participant data, enrollment, schema, migrations, APIs, runtime AI, Marketplace transactions, billing, payouts, public access, production integration, or a live Growth program.

The Growth Center needs a review-safe way to make future capability concepts precise without silently taking ownership from Identity, Organizations, Membership, Learning, Community, Operator Network, Marketplace, Reputation, Agency Command, Meetings, Documents, or Kai.

## Decision

1. Add a nested review annex at `/review/growth-center/capability-contract`. It is subordinate to the approved Growth Center and is not a second room, dashboard, participant surface, or new bounded context.
2. Define a pure capability-contract projection covering seven pathways: professional capability, professional-development pathway, mentorship preparation and participation, educational program/learning artifact, operator-created contribution, Community contribution, and organizational stewardship.
3. Growth Experience owns only contract grammar, deterministic synthetic fixtures, strict composition rules, and presentation. Every hypothetical future fact names its canonical owner. An unresolved owner becomes `OWNER_UNRESOLVED` and the projection fails closed.
4. Keep eight state lanes independent: availability/contract support, preparation/participation, evidence sufficiency, completion, source-review disposition, correction, appeal, and visibility. No lane implies another.
5. Never use a fixture's completion or source-review state to imply approval, qualification, certification, publication, recognition, reputation, access, employment, XP, Arena state, or economics.
6. Carry one deeply frozen, owner-labeled eleven-part synthetic evidence preview on every supported projection: professional purpose, source owner, subject/scope, evidence category, occurrence/source confirmation, reviewer role, policy/contract version, visibility, correction route, appeal route, and expiry/supersession. Render the detailed list only for an owner-resolved contract. An owner-unresolved contract fails every item closed and withholds the list. Store and display no participant evidence or raw content.
7. Privacy is deny-by-default. Phase 1B reads no participant, customer, identity, organization, Membership, Learning, Operator Network, Meetings, Documents, Community, Marketplace, Reputation, Agency Command, or Kai runtime record. Unknown visibility is hidden/unavailable; public and cross-organization visibility are unsupported.
8. Corrections challenge source facts and route conceptually to the source owner. Appeals challenge review decisions and require a future authorized human reviewer. Growth and Kai may explain, but may not file, route, resolve, or adjudicate either.
9. Kai retains its canonical Credit Intelligence Officer identity. Growth Advisor is a route-local deterministic explanation mode. It accepts fixed controls only, calls no model, reads no source system, retains no memory, and takes no action.
10. Use a strict allowlist resolver for the optional public review selection parameters. Unknown, multiple, malformed, incomplete, impossible, or unauthorized selections render one generic unsupported state. Raw input is never echoed and invalid input never silently defaults to a nearby state.
11. Gate the nested stage behind the existing production-hard-off review policy, exact `GROWTH_CENTER_PREVIEW_ENABLED=true`, and exact `GROWTH_CAPABILITY_CONTRACT_PREVIEW_ENABLED=true`. Import the stage only after all gates pass. Production identity fails closed regardless of flags.
12. Keep the route no-index, direct-link-only, unregistered, and absent from product navigation, the review hub, sitemap, and CXOS room registry.
13. Reuse CXOS Core Runtime only as already-authorized headless presentation lifecycle. Do not modify it or any Agency/CXOS isolation surface. It receives no Growth truth.
14. Add no schema, migration, API, server action, job, event, webhook, storage, analytics, telemetry, model, prompt, canonical-owner adapter, billing, provider, tax, ledger, wallet, payout, or production mutation.
15. Agency Builder must persistently disclose: **No live Growth Distribution. These stewardship examples create no eligibility, allocation, obligation, or payment right. Recruiting is not rewarded.**
16. Treat this ADR and its reports as internal product architecture. They are not participant terms, program rules, legal approval, a credential policy, or an economic policy ratification.

## Implemented fixture boundary

The selector exposes exactly ten fixtures: `overview`, `empty`, `preparing`, `completed-unreviewed`, `in-review`, `changes-requested`, `source-corrected`, `appeal-in-review`, `privacy-restricted`, and `unsupported`.

Not every pair is valid. Mentorship refuses `completed-unreviewed` and `appeal-in-review`; organizational stewardship refuses `appeal-in-review`; operator-created contribution remains owner-unresolved and projects no favorable state. Unknown, duplicate, partial, malformed, and invalid contract/fixture requests fail closed.

Required-evidence-missing, not-accepted, source-conflict, source-owner-review, and resolved-appeal terms remain conceptual future contract vocabulary unless represented by an exact fixture. The rejection-pattern panel is separate from the selector and does not detect, accuse, or sanction.

## Canonical ownership decision

| Concern | Canonical owner | Phase 1B treatment |
|---|---|---|
| Operator identity | Identity | Owner label only; no read or copy |
| Organization scope and stewardship truth | Organizations | Fictional requirement only |
| Role and authority | Membership | Fictional authority requirement only |
| Organization health and improvement projection | Performance Intelligence | Future source requirement only; no health claim |
| Pathway, assessment, completion, credential | Learning | Synthetic pathway preview only |
| Mentorship relationship and participation | Operator Network | Preparation and hypothetical state only |
| Meeting occurrence and attendance | Meetings | Source requirement only |
| Notes, files, and artifacts | Documents | Artifact category only |
| Contribution submission/publication/moderation | Community | Synthetic contribution-path preview only |
| Listing/order/delivery/refund | Marketplace | Quality preview only; commerce unavailable |
| Trust and recognition | Reputation | Boundary explanation only; no Growth score, badge, or rank |
| Agency task/routing/deadline | Agency Command | Owner label only; no integration |
| Preparation and explanation | Kai | Fixed explanation only |
| Capability-contract grammar | Growth Experience | Review-only canonical owner |

Correction authority follows the source fact's owner. Appeal authority follows the review decision's owner. Growth is neither.

## Required fixed disclosures

### Global boundary

> **Founder review · Synthetic capability-contract fixtures · No live Growth program. Nothing shown is a participant record, enrollment, mentor match, course, contribution, Community post, organization assessment, credential, certification, opportunity, qualification, Growth Reputation record, compensation, or promise of business or credit results. No participant data is read or saved, and no action is taken.**

### Unsupported state

> **Unsupported review state · unavailable in this Preview. No status, eligibility, completion, review, or action has been inferred.**

### Kai receipt

> Kai is explaining fixed synthetic review fixtures. Kai did not analyze a person, organization, evidence, eligibility, or opportunity. No model was called. Nothing was saved, submitted, reviewed, corrected, appealed, assigned, scheduled, published, enrolled, purchased, or changed.

## Alternatives considered

### Extend the approved Phase 1A page in place

Rejected. Phase 1A is an approved experience snapshot. A nested annex preserves its approval boundary, URL provenance, arrival pacing, and evidence while making Phase 1B independently gated and reversible.

### Connect read-only canonical owner data

Rejected. Read-only access is still participant-data access, creates privacy and tenant-boundary obligations, and can turn fixture vocabulary into apparent live status. Phase 1B is explicitly participant-data-free and integration-free.

### Create a Growth capability table or generic evidence model

Rejected. It would violate schema-free authorization, duplicate canonical owners, and prematurely freeze policy. Runtime self-heal is prohibited for new schema, and no migration is authorized.

### Collapse all state into a single progress status

Rejected. A single status would conflate preparation, completion, evidence, review, visibility, correction, and appeal, creating misleading qualification or approval meaning.

### Let Kai interpret open-ended reviewer questions

Rejected. Runtime AI, free text, inference, source access, and action are outside authorization. Fixed deterministic explanations are sufficient for contract review.

### Register the annex in the review hub or product navigation

Rejected. Phase 1B is a direct-link protected Founder Preview, not public or participant access.

### Reuse Community, Agency Command, or an Agency/CXOS room as the workbench

Rejected. Those surfaces and owners are explicitly outside this stream. Growth may name their future ownership but may not modify or embed within them.

## Consequences

### Positive

- The Founder can inspect a production-shaped capability contract without participant data or live program meaning.
- Source ownership is visible before integration or schema decisions.
- Separate axes prevent completion, review, visibility, and appeal from becoming an opaque score.
- Privacy, correction, appeal, and unsupported states are designed before any live record exists.
- Kai can demonstrate useful preparation and explanation without model or action authority.
- The nested route is isolated, reversible, and preserves the approved Phase 1A snapshot.

### Cost and limitation

- Synthetic fixtures cannot validate real demand, curriculum quality, mentor safety, evidence provenance, Community moderation, organization health, reviewer operations, or participant comprehension.
- The contract cannot prove owner APIs or policies that do not yet exist.
- No enrollment, participation, completion, contribution, appeal, or business outcome can be measured.
- A protected Preview is review infrastructure, not a launch.

## Security and privacy implications

- No identity, organization, tenant, customer, source, or participant data is read, inferred, collected, stored, or transmitted.
- No input, upload, free text, database, API, action, event, storage, cookie, Growth-owned analytics, or Growth-owned telemetry exists.
- Generic fixtures contain no realistic PII, protected attribute, consumer credit fact, customer file, case, employment evaluation, or private identifier.
- Strict literal allowlists and generic unsupported copy prevent query echo and state injection.
- Production hard-off plus exact subordinate flags prevent accidental route exposure.
- Unknown visibility is hidden/unavailable; public and cross-organization visibility are unsupported.
- The root application may still perform inherited session/theme behavior; Growth neither consumes nor mutates those values. Browser evidence must distinguish inherited behavior from Growth behavior.
- Secret and protected-surface diff review are required before handoff.

## Compliance implications

- Recruiting is not rewarded, and no recruitment, referral, popularity, headcount, purchase, retention-payment, XP, Arena, rank, badge, reputation, or economic signal exists.
- No amount, rate, balance, entitlement, obligation, earnings projection, salary-like claim, passive-income claim, or business-opportunity promise exists.
- Mentorship and education are future B2B operator professional-development concepts only. They exclude consumer-specific credit work, dispute execution, representation, legal/tax/financial/employment/business-opportunity advice, advance-fee guidance, matching, screening, booking, contracting, payment, live services, credentials, and outcome promises.
- Fixture states may use **source-confirmed-state example** but not **verified**, **approved**, **qualified**, **certified**, **recognized**, **expert**, **verified mentor**, or **approved instructor**.
- Correction and appeal controls say **Preview** and cannot imply that a live filing or record exists.
- This ADR is not legal approval for a participant program, public marketing, employment practice, credential, or economy.

## Anti-abuse review boundary

Fixed fixtures may explain rejection patterns for self-review, reviewer conflict, collusion, replay, duplicate evidence, completion farming, popularity substitution, plagiarism, fabricated provenance, retaliation, PII inclusion, unauthorized visibility, superseded/conflicting evidence, and purpose misuse.

The Preview does not detect fraud, score risk, identify a person, impose a sanction, or operate a review queue. Every example is fictional and routes uncertainty to a future canonical owner or authorized human.

## Rollback

Remove the nested route, pure capability-contract module, subordinate preview flag, route-local CSS, dedicated guard, ADR, reports, generated HTML, text handoff, evidence, and ZIP package. Retire any deployment-scoped Preview flag and protected Preview deployment.

No schema, data, enrollment, participant record, canonical source, event, provider, billing state, money, or external effect must be reversed.

## Evidence required before Founder handoff

- dedicated capability-contract source guard;
- Growth Network, Growth Center, CXOS Core Runtime, schema-safety, compliance, and protected-room regression guards;
- typecheck, touched lint, repository lint disposition, optimized Preview build, and production-identity hard-off build;
- strict resolver and unsupported-combination tests;
- source scans for data/effect imports, schema, APIs, runtime AI, economics, protected-surface changes, PII, and secrets;
- rendered desktop, tablet, mobile, 320-pixel, 200% text, keyboard, focus, static, reduced-motion, browser-history, pathway, evidence, ownership, correction/appeal, Kai, Agency, and return checks;
- accessibility, performance, and network/write observations;
- protected Vercel Preview access proof if deployed;
- evidence checksums, exact repository truth, and curated deployment provenance.

Validation status: **PASS for the protected synthetic Preview — typecheck, targeted ESLint, 3,438 guard assertions, optimized review and production-identity builds, final production hard-off, browser/accessibility/reduced-motion/performance validation, protection probes, and secret/PII review. Repository-wide lint remains red only on disclosed unrelated existing files.**  
Preview URL: **https://gabriel-capital-labs-ewbkldcd7-rey-gabriel-s-projects.vercel.app/review/growth-center/capability-contract · deployment dpl_C6CD6RzWGkzegsAAxd1mnndycVS3 · READY · protected.**  
Verified baseline SHA: **a40a41c5a76028ad5cae2ff655c5bf168fb86a4a — provenance only; it does not contain the local/uncommitted Phase 1B files. No Phase 1B commit, push, merge, production deployment, or project-environment mutation occurred.**

## Next decision gate

The Founder must review the completed Phase 1B contract and validated protected Preview, then explicitly approve, approve with amendments, hold, or reject it.

This ADR does not authorize a later phase. A future source-owner interface specification may be considered only through a separate Founder decision. Participant data, source integration, enrollment, schema, migration, APIs, events, runtime AI, public access, reputation effects, commerce, billing, payout, and economics remain independently blocked.

**CGN ECONOMIC PHASE 1A — BLOCKED.**
