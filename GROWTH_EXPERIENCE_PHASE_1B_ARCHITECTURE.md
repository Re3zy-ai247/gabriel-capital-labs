# CreditVector Growth Experience Phase 1B — Capability Contract Architecture

Status: **GROWTH EXPERIENCE PHASE 1B — AUTHORIZED NON-MONETARY CONTRACT WORK**  
Package state: **READY FOR FOUNDER REVIEW**  
Architecture authority: [ADR-0042](.ai/ADR/ADR-0042-growth-experience-phase-1b-capability-contract.md)  
Scope: protected, synthetic, participant-data-free Founder Preview  
Founder review metadata: see §18

## 1. Executive architecture decision

Phase 1B is an isolated capability-contract annex beneath the approved Growth Center Founder Preview. It does not replace Phase 1A, create a second Growth room, or connect a live bounded context.

The review route is:

```text
/review/growth-center/capability-contract
```

Its architecture has five deliberate properties:

1. **Subordinate:** the route is nested under Growth Center and requires every parent review gate plus its own exact-string gate.
2. **Pure:** all contract definitions, fixtures, and resolver behavior are immutable deterministic data with no effects.
3. **Compositional:** Growth projects named canonical-owner responsibilities but owns none of their participant records.
4. **Fail-closed:** unsupported values, combinations, owners, sources, and transitions render one bounded unavailable state without inference.
5. **Dormant:** there is no schema, migration, API, event, enrollment, runtime AI, commerce, reputation effect, economic logic, or production activation.

This is an internal product contract, not a participant agreement, credential framework, compensation plan, or legal terms.

## 2. Controlling status taxonomy

- **CGN ECONOMIC PHASE 1A — BLOCKED**
- **GROWTH EXPERIENCE PHASE 1A — APPROVED FOUNDER PREVIEW**
- **GROWTH EXPERIENCE PHASE 1B — AUTHORIZED NON-MONETARY CONTRACT WORK**

The Founder Economic Decision Matrix remains unratified. The economic master flag and payout execution boundary remain dormant. No Phase 1B object is an economic object.

## 3. Placement in the frozen platform

Phase 1B is a review-only L6 experience projection over hypothetical future L4/L5 owner interfaces. It adds no source-of-truth context and does not amend frozen platform ownership.

```text
Founder review request
        |
        v
Next.js review server boundary
  - reviewBuildAllowed()
  - GROWTH_CENTER_PREVIEW_ENABLED === "true"
  - GROWTH_CAPABILITY_CONTRACT_PREVIEW_ENABLED === "true"
        |
        | all three pass
        v
Capability Contract Stage
        |
        +--> pure pathway definitions
        +--> strict deterministic request resolver
        +--> fixed synthetic fixture projection
        +--> headless CXOS Core Runtime lifecycle only
        |
        v
Complete semantic review document

No branch reaches:
database | API | model | Event Fabric | canonical owner | billing | money
```

Growth Center may state that a future canonical owner would supply a fact. It may not fetch, cache, copy, reconcile, or mutate that fact in Phase 1B.

## 4. Bounded ownership

### 4.1 Growth Experience owns

- capability-contract vocabulary;
- fixed synthetic pathway definitions;
- fixed state-axis definitions;
- deterministic fixture identifiers and safe review copy;
- strict allowlist resolution;
- presentation-only composition rules;
- unsupported-state behavior; and
- the protected review experience.

### 4.2 Growth Experience does not own

| Canonical owner | Reserved truth |
|---|---|
| Identity | Person/operator identity and account truth |
| Organizations | Organization identity, control, scope, hierarchy, and stewardship facts |
| Membership | Role, authority, and relationship to an organization |
| Performance Intelligence | Organization health, retention, performance, and improvement projections |
| Learning | Pathways, curricula, assessments, completions, credentials, and certifications |
| Operator Network | Mentorship relationship, participation, screening, and matching |
| Meetings | Calendar, meeting, attendance, and session truth |
| Documents | Files, notes, artifacts, access, provenance, and retention |
| Community | Contribution submission, publication, moderation, and Community recognition |
| Marketplace | Listing, seller, order, delivery, refund, price, and transaction truth |
| Reputation | Trust, recognition, source integrity, score, badge, and rank |
| Agency Command | Agency task, assignment, workflow, and deadline truth |
| Kai | Deterministic preparation and explanation; never business-object ownership |

Corrections belong to the canonical owner of the challenged source fact. Appeals belong to the owner of the challenged review decision. Growth can explain those routes but cannot open or adjudicate them.

An unresolved owner becomes `OWNER_UNRESOLVED`; the associated projection is unavailable.

## 5. Source layout and isolation seam

The authorized review slice is intentionally small:

| Source | Responsibility | Forbidden responsibilities |
|---|---|---|
| `lib/growthNetwork/capabilityContract.ts` | Pure types, pathways, state axes, fixtures, strict resolver, fixed Kai explanations | Environment, network, storage, model, canonical data, side effects |
| `lib/growthNetwork/capabilityPreviewFlags.ts` | Exact-string subordinate preview gate | Client export, general Growth activation, payout authority |
| `app/review/growth-center/capability-contract/page.tsx` | Server-side three-key gate and post-gate stage import | Data fetch, session decision, participant access, effect |
| `app/review/growth-center/capability-contract/stage.tsx` | Semantic contract workbench and explicit review controls | Free text, submission, enrollment, personalization, owner mutation |
| `app/review/growth-center/capability-contract/capability-contract.module.css` | Route-local responsive visual language and motion fail-down | Global design-system mutation, existing room redesign |
| `scripts/growth-capability-contract.test.ts` | Executable boundary, determinism, copy, ownership, and fail-closed guard | Production effects |
| `.ai/ADR/ADR-0042-growth-experience-phase-1b-capability-contract.md` | Decision and authorization boundary | Economic policy ratification |

Phase 1A source remains an approved snapshot. Phase 1B is a nested consumer rather than a rewrite of the approved Growth Center. Existing Mission Control, Agency Command, Arena, Community, Billing, Authentication, Organizations, Identity, Marketplace backend, and Agency/CXOS isolation surfaces are outside the diff.

## 6. Server activation boundary

The stage is reachable only when all conditions are explicitly true:

1. the current build identity is allowed by the existing Founder-review policy;
2. `GROWTH_CENTER_PREVIEW_ENABLED` equals the exact string `true`; and
3. `GROWTH_CAPABILITY_CONTRACT_PREVIEW_ENABLED` equals the exact string `true`.

Unknown, absent, malformed, mixed-case, or false values deny access. A Vercel production identity denies access regardless of environment values. The stage module is dynamically imported only after authorization, so review content is not part of the denied request path.

The route remains:

- under `/review`;
- no-index;
- direct-link-only;
- absent from public and authenticated product navigation;
- absent from the review hub, sitemap, and CXOS room registry; and
- protected by Vercel Preview access controls when deployed.

A feature flag controls code reachability; it does not authorize a participant program, canonical integration, economics, or production use.

## 7. Deterministic projection contract

### 7.1 Inputs

The only supported selection inputs are public, non-sensitive allowlisted review identifiers for:

- one pathway; and
- one synthetic fixture.

The route may accept them as query parameters to make review states linkable and browser history deterministic. It may not put person, organization, evidence, membership, customer, private workflow, or source-record state in a URL.

### 7.2 Strict resolver

The resolver:

1. accepts no input or exactly one allowlisted value for each supported key;
2. normalizes nothing beyond the documented literal identifiers;
3. rejects arrays, duplicates, unknown keys that affect state, unknown values, incomplete dependent combinations, and impossible state combinations;
4. returns a sanitized supported projection or one generic unsupported projection;
5. never echoes raw input; and
6. never chooses a nearest, default, inferred, or personalized state after an invalid request.

The default no-query route renders a fixed orientation fixture. It is an explicit review state, not an inferred participant state.

### 7.3 Determinism

For the same supported selection, the projection is byte-for-byte semantically stable. The contract module uses no:

- clock or date derivation;
- random value;
- browser or server storage;
- cookie or session;
- identity or organization context;
- database or API;
- network request;
- model or prompt;
- analytics or telemetry; or
- mutable singleton.

## 8. State architecture

The contract keeps eight independent state lanes:

1. availability and contract support;
2. preparation/participation;
3. evidence sufficiency;
4. completion;
5. source-review disposition;
6. correction;
7. appeal; and
8. visibility.

The rendered status panel must show that one axis cannot imply another. In particular:

```text
completion != source acceptance
source acceptance != visibility
visibility != publication or consent
source confirmation != qualification
any state != reputation, XP, Arena, credential, access, employment, or economics
```

The implementation exposes exactly ten selectable fixtures: `overview`, `empty`, `preparing`, `completed-unreviewed`, `in-review`, `changes-requested`, `source-corrected`, `appeal-in-review`, `privacy-restricted`, and `unsupported`. The default request is the explicit `overview` fixture. A request with only one selector, an unknown or duplicate value, an unknown key, or an invalid contract/fixture pair fails closed.

Contract-specific refusals are explicit: mentorship refuses `completed-unreviewed` and `appeal-in-review`; organizational stewardship refuses `appeal-in-review`; operator-created contribution remains owner-unresolved and never projects a favorable state.

The following is conceptual future state vocabulary, not a list of additional selectable fixtures or executable transitions:

```text
no-participation-represented example
  -> preparing example
  -> under-review example
  -> source-confirmed-state example

under-review example
  -> changes-requested example
  -> preview correction path
  -> source-owner-review example

not-accepted example
  -> preview appeal path
  -> human-review-required example
  -> resolved example | not-accepted example
```

No control performs a transition. It selects one of the exact fixed fixtures above. Terms such as not accepted, source conflict, source-owner review, and resolved appeal remain conceptual unless an exact fixture represents them.

Unknown owner, policy, source, evidence category, reviewer, visibility, actor, scope, state, or transition fails closed. Completion without source confirmation, acceptance without reviewer authority, and appeal without an underlying decision are unsupported.

## 9. Evidence architecture

Phase 1B stores no evidence and displays no realistic evidence content. Every supported projection now carries one deeply frozen, owner-labeled eleven-part synthetic evidence contract; the stage renders it only for an owner-resolved contract.

The exact rendered items are:

- **Professional purpose** — canonical contract owner;
- **Source owner** — future evidence owner and explicit no-connection statement;
- **Subject and scope** — synthetic scope with no person, participant, organization, or customer;
- **Evidence category** — purpose-bound category with no artifact, submission, or verification;
- **Occurrence / source confirmation** — future confirmation requirement and refused substitutes;
- **Reviewer role** — future human review owner or unresolved-owner refusal;
- **Policy / contract version** — Growth review grammar version only;
- **Visibility** — deny-by-default privacy boundary and visibility owner;
- **Correction route** — source-fact owner and no-live-case boundary;
- **Appeal route** — decision owner or independent-owner refusal; and
- **Expiry / supersession** — future stale-state behavior with no live validity period.

The stage renders these items as a semantic definition list for an owner-resolved contract. For an owner-unresolved contract, every item resolves to the unsupported copy and the stage withholds the detailed list. This structure is a review projection, not evidence storage or a schema proposal.

Evidence is purpose-bound. No accepted example can be replayed across pathways by inference. Conflicting sources resolve to **Needs human review**. Growth and Kai never decide which source wins.

The separate review-rejection panel may illustrate self-review, reviewer conflict, collusion, replay, duplicate evidence, completion farming, popularity substitution, plagiarism, fabricated provenance, retaliation, PII inclusion, unauthorized visibility, supersession, and purpose misuse. These fixed examples are control education, not selectable fixtures, detection, or accusation.

## 10. Privacy architecture

Privacy is deny-by-default:

- synthetic generic labels only;
- no PII, protected attributes, employment evaluation, consumer credit facts, customers, files, cases, or realistic identifiers;
- no participant, session, organization, Membership, Learning, Operator Network, Meetings, Documents, Community, Marketplace, Reputation, Agency Command, or Kai runtime read;
- no form, upload, free text, persistence, Growth-owned cookie, Growth-owned local storage, Growth-owned analytics, or Growth-owned telemetry;
- unknown visibility resolves to hidden/unavailable; and
- public, cross-organization, named-peer, customer, and broad workforce visibility are unsupported.

The application root may still provide inherited framework-level session/theme behavior. Growth does not consume it. Browser evidence must distinguish inherited reads from Growth-owned activity and prove there is no Growth write path.

## 11. Kai architecture

Kai remains the canonical Credit Intelligence Officer. Growth Advisor is a route-local deterministic explanation mode.

```text
fixed reviewer control
        |
        v
allowlisted intent + selected synthetic fixture
        |
        v
pure lookup / fixed explanation
        |
        v
owner + requirement + boundary + no-action receipt
```

No free text, model, prompt, network, memory, retrieval, tool, action, or source-system call exists. Kai cannot assess, verify, approve, match, enroll, publish, schedule, correct, appeal, adjudicate, or transact.

Every explanation displays the exact receipt:

> Kai is explaining fixed synthetic review fixtures. Kai did not analyze a person, organization, evidence, eligibility, or opportunity. No model was called. Nothing was saved, submitted, reviewed, corrected, appealed, assigned, scheduled, published, enrolled, purchased, or changed.

## 12. Experience architecture

The Phase 1B page is a **capability-contract workbench**, not a dashboard, referral page, statistics page, social feed, or second immersive headquarters.

Recommended semantic order:

1. persistent Founder/synthetic/no-live disclosure;
2. purpose and contract boundary;
3. seven pathway spine;
4. selected synthetic fixture;
5. independent state-axis ledger;
6. evidence-requirement preview;
7. canonical ownership map;
8. correction and appeal explanation;
9. deterministic rejection examples;
10. Kai explanation; and
11. Agency Builder and global no-economic boundaries.

The DOM order is the visual, reading, and focus order. Mobile layouts must not use CSS reordering. Controls are native and at least 44 by 44 CSS pixels. A complete semantic document is available with JavaScript motion disabled, high zoom, static mode, and `prefers-reduced-motion`.

CXOS Core Runtime may provide only presentation lifecycle mechanics already authorized by ADR-0040: capability projection, arrival settlement, visibility pause, district focus/activation, reduced-motion fail-down, and bounded local navigation. It receives no Growth truth and is not modified by this stream.

## 13. Security threat model

| Threat | Architectural control |
|---|---|
| Accidental production exposure | Production-hard-off server policy plus two exact-string subordinate flags; post-gate import; unregistered route |
| Participant-data leakage | No owner-system read, no input, generic fixtures, no raw query echo |
| Cross-tenant disclosure | No tenant context; unsupported cross-organization visibility |
| Injection through review selection | Literal allowlist and generic unsupported state |
| State forgery by query editing | Resolver validates complete combinations; displayed state remains synthetic and carries persistent disclosure |
| Silent ownership takeover | Every fact category names its canonical owner; unresolved owner fails closed |
| Model or tool action | No AI SDK, prompt, fetch, tool, or action seam |
| Hidden persistence | No schema, API, action, form, storage, cookie, analytics, telemetry, or event |
| Economic activation by vocabulary | No amount/rate/balance/entitlement; Agency and global no-economics disclosures; economic guards |
| Social/reputation gaming | No likes, followers, leaderboard, XP, Arena, score, rank, badge, or Reputation write |
| Misleading completion or approval | Separate axes, forbidden live-status labels, non-inference copy |
| Review-route discoverability | No navigation, review-hub, sitemap, registry, or public link |

## 14. Compliance architecture

Persistent disclosure:

> **Founder review · Synthetic capability-contract fixtures · No live Growth program. Nothing shown is a participant record, enrollment, mentor match, course, contribution, Community post, organization assessment, credential, certification, opportunity, qualification, Growth Reputation record, compensation, or promise of business or credit results. No participant data is read or saved, and no action is taken.**

Agency disclosure:

> **No live Growth Distribution. These stewardship examples create no eligibility, allocation, obligation, or payment right. Recruiting is not rewarded.**

Unsupported-state copy:

> **Unsupported review state · unavailable in this Preview. No status, eligibility, completion, review, or action has been inferred.**

Mentorship and education remain future B2B operator-development concepts. They exclude consumer-specific credit work, dispute execution, representation, legal/tax/financial/employment/business-opportunity advice, advance-fee guidance, matching, booking, contracting, payment, live sessions, enrollment, credentials, and outcome promises.

## 15. Validation architecture

No validation result is claimed until commands and rendered checks actually run.

Required evidence:

- TypeScript typecheck;
- targeted lint and repository lint disposition;
- dedicated Phase 1B contract guard;
- Growth Network, Growth Center, CXOS Core Runtime, schema-safety, compliance, and protected-room regression guards;
- optimized Preview build with all gates enabled;
- optimized production-identity build proving hard-off;
- source scan for schema, APIs, effects, runtime AI, canonical-owner imports, economic shapes, secrets, and prohibited protected-surface changes;
- desktop, tablet, mobile, 320-pixel, high-zoom, keyboard, focus, reduced-motion, static-equivalence, and browser-history checks;
- accessibility scan and manual semantic review;
- network/write observation distinguishing inherited root behavior from Growth behavior;
- performance observation;
- direct unauthenticated protection response and authenticated protected-preview response, if deployment occurs;
- evidence checksums and curated-source manifest; and
- exact repository branch/SHA/local-state warning.

Final validation, repository, Preview, and secret-review observations are recorded in §18 only after direct evidence exists.

## 16. Rollback

Rollback removes the nested route, pure capability-contract module, subordinate flag, route-local CSS, dedicated guard, ADR, reports, generated HTML, text handoff, evidence, and package. It requires no database, participant, provider, billing, economic, or external-state reversal.

If a protected Preview environment flag exists, remove that deployment-scoped flag or retire the Preview. No production flag is authorized.

## 17. Implementation readiness and next gate

The architecture is ready for an isolated protected Founder Preview implementation only. That implementation must remain within this document and ADR-0042.

The next decision after validated Preview evidence is a Founder choice to approve, approve with amendments, hold, or reject the Phase 1B capability contract. No source-system integration or later phase is implied.

Only after a separate Founder authorization may the team consider a narrow source-owner interface specification. Participant data, enrollment, schema, APIs, events, runtime AI, public access, reputation effects, commerce, billing, payouts, and live economics remain independently blocked.

**CGN ECONOMIC PHASE 1A — BLOCKED.**

## 18. Founder review metadata and checklist

| Item | Status |
|---|---|
| Local path | `/Users/re3zy/Documents/gabriel-capital-labs-to-upload` |
| Branch | **feat/cxos-phase3** |
| Verified baseline SHA | **a40a41c5a76028ad5cae2ff655c5bf168fb86a4a · does not contain Phase 1B** |
| Phase 1B commit status | **NONE · local/uncommitted** |
| Shared worktree | **DIRTY · parallel streams present; curated snapshot deployed** |
| Preview URL | **https://gabriel-capital-labs-ewbkldcd7-rey-gabriel-s-projects.vercel.app/review/growth-center/capability-contract** |
| Deployment ID and protection | **dpl_C6CD6RzWGkzegsAAxd1mnndycVS3 · READY · anonymous 302 SSO/noindex · authenticated CLI 200** |
| Validation | **PASS · typecheck, targeted ESLint, 3,438 guards, builds, hard-off, browser, accessibility, reduced motion, performance, protection** |
| Secret and PII review | **PASS · scoped patterns absent; screenshots synthetic and visually PII-free** |
| Production | **HARD OFF · NOT AUTHORIZED** |
| Decision Matrix | **UNRATIFIED** |
| Live economics | **NO-GO** |

Branch warning: **The verified SHA is baseline provenance only and does not contain the local/uncommitted Phase 1B files. The shared dirty worktree was not deployed; Vercel received a fresh baseline archive plus only explicit Growth and approved Core Runtime files.**

Production safety remains structural: three server-side controls precede stage import; production identity always denies access; the route remains direct-link-only and unregistered; and no participant data, canonical owner, schema, API, model, event, commerce, billing, payout, or mutation path exists.

Founder checklist:

- [ ] Confirm the exact three phase statuses remain separate.
- [ ] Confirm the nested annex preserves the approved Phase 1A snapshot.
- [ ] Confirm every future fact names one canonical owner or fails closed.
- [ ] Confirm all eight state lanes remain separate.
- [ ] Confirm the exact ten fixtures are distinguished from conceptual vocabulary and transitions.
- [ ] Confirm the eleven-part evidence preview is structured, owner-labeled, synthetic, and content-free.
- [ ] Confirm privacy, correction, appeal, and contract-specific unsupported combinations fail closed.
- [ ] Confirm Kai displays the exact no-model/no-action receipt.
- [ ] Confirm production identity, route registration, and no-effect boundaries from observed evidence.
- [ ] Review final repository, validation, secret-review, deployment, and artifact provenance.
- [ ] Approve, approve with amendments, hold, or reject the Phase 1B architecture and protected Preview.
