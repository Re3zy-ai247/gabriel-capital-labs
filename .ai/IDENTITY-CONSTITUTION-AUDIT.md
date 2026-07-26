# Identity Constitution v1.0 — Repository Feasibility and Contradiction Audit

> **REPOSITORY TRUTH — NOT A RATIFICATION**
>
> Reviewed 2026-07-26 against the frozen Platform Ownership Map, Architecture Freeze 1.0, current source, Prisma schema and migration history, Gate D tooling, and the dormant Identity foundation. This audit does not authorize implementation, activation, a migration, Gate D, production access, or a deployment.

**Subject:** [Identity Constitution v1.0 — founder draft](IDENTITY-CONSTITUTION.md)
**Audit status:** complete; proposed Constitution remains **PROPOSED — NOT RATIFIED**
**Audit verdict:** **CONSTITUTION REQUIRES CLAUSE-LEVEL AMENDMENTS**

## Scope and classification

This is an adversarial compatibility audit, not an interpretation that upgrades any
draft statement to repository truth.

| Classification | Meaning in this audit |
| --- | --- |
| **SUPPORTED** | The clause matches a frozen rule or verified present repository fact. |
| **SUPPORTED WITH IMPLEMENTATION** | The clause is constitutionally compatible, but current code/schema does not yet enforce it. |
| **CONFLICTS WITH REPOSITORY** | The clause contradicts current code, schema, state, or operational fact if read as present truth. |
| **CONFLICTS WITH HIGHER CONSTITUTION** | The clause contradicts the frozen Ownership Map, Architecture Freeze, or a higher binding rule. |
| **OWNER DECISION REQUIRED** | Repository evidence cannot choose the product, retention, legal, or authority policy. |
| **INSUFFICIENT EVIDENCE** | The assertion exceeds evidence available without production access or new data modeling. |

## Verified baseline

| Fact | Evidence |
| --- | --- |
| Durable OperatorIdentity, Organization, and OrganizationMembership are dormant and owned together by lib/identity. | [Platform Ownership Map §registry](PLATFORM-OWNERSHIP-MAP.md#ownership-registry), rows 10–11; [schema](../prisma/schema.prisma#L693-L747). |
| The live managed-consumer relation is User.managedByAgencyId, a passwordless client User pointing to an agency User. | [schema](../prisma/schema.prisma#L89-L97); [session gate](../lib/session.ts#L35-L63). |
| The frozen map still calls OrganizationMembership the Gate-F successor of the live edge. | [Platform Ownership Map](PLATFORM-OWNERSHIP-MAP.md#ownership-registry), row 12 and [overlap resolution 2](PLATFORM-OWNERSHIP-MAP.md#overlap-resolutions-disclosed--none-is-an-active-dual-owner). |
| Current Organization ownership is Organization.ownerAccountId; OrgRole.OWNER is derived, not assignable membership truth. | [schema](../prisma/schema.prisma#L712-L747); [RBAC map](../lib/identity/rbac.ts#L13-L21). |
| Organization and Membership state sets and legal transitions match the draft’s listed state sets. | [state machine](../lib/identity/state.ts#L17-L40). |
| Current identity service is flag-gated, but it creates an Organization from a principal account and does not require an OperatorIdentity, an initial Membership, an invitation, or an ownership-transfer workflow. | [feature flag](../lib/identity/flags.ts#L1-L9); [service](../lib/identity/service.ts#L84-L100); [repository](../lib/identity/repository.ts#L65-L77). |
| Current service authorizes ownerAccountId/global admin and only blocks ARCHIVED Organizations; OrganizationMembership ADMIN is not its live PEP. | [service](../lib/identity/service.ts#L104-L152); [frozen PEP boundary](PLATFORM-OWNERSHIP-MAP.md#overlap-resolutions-disclosed--none-is-an-active-dual-owner). |
| Current legacy and dormant identity graph contains cascading relations; it is not a complete append-only ownership/membership history. | [schema](../prisma/schema.prisma#L95-L97), [schema](../prisma/schema.prisma#L693-L747). |
| Event Fabric is transport-only and current EventEnvelope supplies correlationId but no causationId or canonical evidence serialization. | [Ownership Map](PLATFORM-OWNERSHIP-MAP.md#ownership-registry), row 23; [envelope](../lib/eventBus/envelope.ts#L63-L81). |
| Gate D admits exactly six migration directories and rejects any different directory set. | [preflight manifest](../scripts/gate-d-preflight-core.ts#L5-L12); [manifest check](../scripts/gate-d-preflight-core.ts#L755-L769). |

## Clause-by-clause audit

### 0. Constitutional position

| Draft clause | Classification | Evidence and consequence | Required clause-level amendment | Founder-semantic effect |
| --- | --- | --- | --- | --- |
| §0, authority order placing schema/migrations over runtime implementation | **CONFLICTS WITH HIGHER CONSTITUTION** | The higher truth rule is evidence-led: owner-authorized production evidence can falsify repository assumptions. A schema is not automatically more authoritative than a verified runtime or production fact. | Replace the implementation portion of the order with: “Normative authority follows the Constitution/ADR order. Schema, migrations, runtime, and production are implementation evidence; owner-authorized production evidence supersedes repository assumptions.” | Implementation/truth-label correction only. |
| §0, statement that this Constitution does not transfer ownership | **CONFLICTS WITH HIGHER CONSTITUTION** unless coordinated | §§2.3, 17.2, and 18 reject a direct managed-client → OrganizationMembership successor, while the frozen Map and Freeze still prescribe it. | Add: “A ratification that changes a frozen transition includes the exact concurrent amendments to the Ownership Map/Freeze and any required ADR; until then this draft does not override them.” | No change to the founder’s intended separation; makes the governance effect explicit. |

### 1. Verified repository findings

| Draft clause | Classification | Evidence and consequence | Required clause-level amendment | Founder-semantic effect |
| --- | --- | --- | --- | --- |
| §1.1–§1.8 | **SUPPORTED** | The live edge is consumer-workspace delegation, the dormant relation is OperatorIdentity → Organization, the organization kind/state and membership state facts match source, and Event Fabric transports rather than decides meaning. | None. Keep the “reverify before implementation” qualifier. | None. |
| §1.9, “flag remains fail-closed and disabled” | **SUPPORTED WITH IMPLEMENTATION** | Source is exact-string fail-closed, but this audit did not inspect a production environment value. | Say “source is fail-closed when OPERATOR_IDENTITY_ENABLED is not exactly true; current production value remains unverified without owner-authorized evidence.” | Accuracy only. |
| §1.10 | **SUPPORTED** | The Gate D runbook records production migration state as unknown pending owner-authorized read-only preflight. | None. | None. |
| §1.11 | **SUPPORTED WITH IMPLEMENTATION** | Gate D is stricter than an extensible manifest: it rejects every directory set except the six hard-coded names. | Replace “before any new migration is eligible for production execution” with “before creating or merging any new migration directory, founder/repository owner must separately approve a reviewed Gate D parser/manifest/test/runbook change defining post-baseline handling.” | Governance sequencing only. |

### 2. Foundational identity laws

| Draft clause | Classification | Evidence and consequence | Required clause-level amendment | Founder-semantic effect |
| --- | --- | --- | --- | --- |
| §2.1, §2.2, §2.4–§2.7, §2.10–§2.12 | **SUPPORTED WITH IMPLEMENTATION** | Auth is outside Identity; identity consumes the principal; roles are not credentials; Event Fabric is transport-only. Enrollment, policy-versioned PEP enforcement, and persona handling are not implemented. | Prefix unimplemented rules with “target invariant on activation”; preserve the existing live consumer path until explicit cutover. | None. |
| §2.3, managed-consumer relationship is not canonical membership and may not auto-promote | **CONFLICTS WITH HIGHER CONSTITUTION** as written against the frozen bridge | The schema semantics support the clause: managed client is a User and membership requires OperatorIdentity. However the higher Map/Freeze currently call a direct reconciliation the successor. | Keep the no-automatic-promotion law, but add a coordinated amendment: “The legacy managed-consumer relationship remains separately authoritative. No direct Membership conversion/backfill is authorized; any future successor needs its own evidence-preserving model and cutover.” Amend the frozen Map/Freeze at ratification. | **Yes:** intentionally changes the documented transition interpretation, not an implemented behavior. |
| §2.8, §2.9 | **CONFLICTS WITH REPOSITORY** if read as present behavior | Existing User→User, User→OperatorIdentity, and membership FKs cascade. The service permits management of SUSPENDED Organizations because it only rejects ARCHIVED. | Scope append-only/non-cascading to new constitutional ownership, lifecycle, membership, and reconciliation evidence. Add that denial of suspended Organizations is an activation prerequisite with only explicit resolution exceptions. | No change to intended target protection; corrects current-state overclaim. |
| §2.11 | **SUPPORTED** | Flag source creates no data and is exact false unless the value is exactly true. | None; do not infer production flag value. | None. |

### 3. Canonical entities and persona separation

| Draft clause | Classification | Evidence and consequence | Required clause-level amendment | Founder-semantic effect |
| --- | --- | --- | --- | --- |
| §3.1 Authentication Account | **INSUFFICIENT EVIDENCE** for universal “credential-bearing” and MFA/assurance claims | The same User model represents credentialed accounts and passwordless managed-client workspaces. MFA/device assurance capability is not evidenced. | Say “Authentication owns credentials, sessions, recovery, and assurance when implemented. A User may also be a passwordless managed-client workspace under existing rules.” | Accuracy only. |
| §3.2 Consumer Workspace | **SUPPORTED WITH IMPLEMENTATION** | The passwordless consumer workspace and scoped agency access are verified. Historical retention, revocation policy, and consent records are not modeled; legacy deletion cascades negate a present guarantee of preserved history. | Treat retention/revocation/consent as future managed-consumer policy/data requirements, not present facts. | None. |
| §3.3, one human account / one OperatorIdentity | **INSUFFICIENT EVIDENCE** for “human” uniqueness | Schema proves one OperatorIdentity per User account, not one across multiple accounts belonging to one human. | Replace “One human authentication account” with “One Authentication Account may have at most one canonical OperatorIdentity,” unless the founder deliberately requires verified-person/account-linking infrastructure. | Owner decision only if human-level uniqueness is intended. |
| §3.3, multi-organization identity and global lifecycle | **SUPPORTED WITH IMPLEMENTATION** | Composite uniqueness permits multiple organizations, but multi-org activation and lifecycle authorization are unbuilt. | Mark it as a target capability; retain Identity as owner of global OperatorIdentity state. | None. |
| §3.4 Organization | **SUPPORTED WITH IMPLEMENTATION** | Generic kind, durable ID, and single non-null ownerAccountId exist. A policy-context tenant boundary is not live; the live tenant boundary remains the agency-client relation. | State that organization policy context and tenant enforcement are activation prerequisites, not current runtime behavior. | None. |
| §3.5 Ownership | **SUPPORTED WITH IMPLEMENTATION** for distinct ownership; **OWNER DECISION REQUIRED** for active owner membership | ownerAccountId is the sole ownership fact today, and OWNER is derived; no provenance, active OperatorIdentity requirement, acceptance, transfer, or transaction exists. Requiring a membership as owner authority risks two ownership truths. | State: “Until an approved one-source handoff, ownerAccountId remains the sole current ownership fact. A future ownership record may require an active OperatorIdentity and explicit evidence, but a Membership role never establishes ownership.” Choose explicitly whether an owner must also hold a non-owner operational membership. | The active-owner/membership requirement is a future policy choice; the separation of ownership from role is preserved. |
| §3.6 Membership | **SUPPORTED WITH IMPLEMENTATION** | Relation, scoped pair, state, and role are structurally present. Admission provenance, policy version, and PEP enforcement are absent. | Describe provenance and PEP enforcement as future requirements. | None. |
| §3.7 ManagedConsumerRelationship | **SUPPORTED WITH IMPLEMENTATION** | The central semantic separation is correct. The current FK points to an agency account User, not an Organization; it supports existing workspace, entitlement, and Network compatibility. It has no history and cascades. | Define it precisely as current managed-consumer compatibility/authorization/entitlement truth for existing paths. Scope “permanently forbidden” to new OperatorIdentity/Organization/Membership authority, while preserving the existing consumer path until cutover. Add a future append-only relationship record before claiming historical preservation. | **Yes:** aligns the draft with its intended distinction and changes the frozen direct-bridge wording. |
| §3.8 and §4 | **SUPPORTED WITH IMPLEMENTATION** | No invitation, application, enrollment, persona-selector, or consumer/operator separation model exists. The dormant flag keeps it unreachable. | Mark each as activation requirements and require explicit server-side persona context before any route is exposed. | None. |

### 5. Enrollment and organization creation

| Draft clause | Classification | Evidence and consequence | Required clause-level amendment | Founder-semantic effect |
| --- | --- | --- | --- | --- |
| §5.1 and §5.2 | **SUPPORTED WITH IMPLEMENTATION** | Current registration is idempotent but has no terms, profile, invitation/application, consent, approval, or membership-provenance record. | State that no current dormant service implements enrollment evidence; require additive evidence records before activation. | None. |
| §5.3 and §6.2 “Create” | **CONFLICTS WITH REPOSITORY** if “initial Membership” becomes ownership truth | createOrganization accepts any gated principal, writes only Organization.ownerAccountId, and is not transactionally coupled to OperatorIdentity/Membership. The frozen model derives OWNER from ownerAccountId. | Replace with: “An active OperatorIdentity may create an Organization only under separately ratified policy. Creation must atomically establish ownerAccountId from the authorized principal’s account. It must not create or rely on an OWNER Membership; any operational Membership is a separate explicit non-ownership decision.” | Potentially changes the founder’s requirement that owner access requires Membership; owner must decide the exact operational-access model. |
| §5.4 | **SUPPORTED WITH IMPLEMENTATION** | Legacy field provides no agency-account→Organization mapping; an agency account may own zero or many Organizations. | Replace “may prefill an invitation candidate” with “may be displayed to an authorized reviewer only after an explicit durable agency-account→Organization selection record exists.” | No. |

### 6–7. Organization and Membership lifecycle

| Draft clause | Classification | Evidence and consequence | Required clause-level amendment | Founder-semantic effect |
| --- | --- | --- | --- | --- |
| §6.1, §7.2, §7.5 terminality | **SUPPORTED** | Current state machine contains exactly the listed legal edges; ARCHIVED and REMOVED are terminal. | Add that a later re-admission episode requires a new additive representation because the current unique pair prevents a second row. | None. |
| §6.2 Suspend/Reactivate/Archive/Transfer | **SUPPORTED WITH IMPLEMENTATION** | No Organization lifecycle command, suspension reason/resolution, transfer, acceptance, provenance, or atomic transaction exists. | Mark these authority rules as future activation prerequisites. For transfer, target owner identity’s accountId must become ownerAccountId; Membership role elevation cannot do so. | None to target policy. |
| §6.3 SUSPENDED/ARCHIVED effects | **CONFLICTS WITH REPOSITORY** if read as current | Current service rejects ARCHIVED only; a SUSPENDED Organization remains manageable through ownerAccountId/global admin. Current membership relations cascade on Organization/OperatorIdentity deletion. | Add: “Before routes are reachable, PEP/service denies SUSPENDED Organizations except enumerated resolution operations.” Replace non-cascade present-tense guarantee with the prospective evidence scope from §2.8. | No. |
| §7.1 and §7.3 | **SUPPORTED WITH IMPLEMENTATION** | Existing addMember can create an ACTIVE membership directly; no invitation/application/consent, self-resignation, reason class, or delegated policy exists. | Prefix “Future activation behavior”; say current dormant service is not evidence of compliance. | None. |
| §7.4 Owner Protection | **CONFLICTS WITH REPOSITORY** | There is no required owner Membership. Ownership is ownerAccountId and the RBAC map forbids assigning OWNER to a membership. | Replace with: “An ACTIVE Organization retains a valid ownerAccountId. Membership mutation cannot alter or derive ownership. Until a separately ratified ownership model changes this, the Constitution does not require an owner Membership.” | Possible semantic change; owner must choose if a separate operational membership is mandatory. |
| §7.6 Role changes | **SUPPORTED WITH IMPLEMENTATION** | Role mutation is a mutable row update followed by event append; there is no policy version or atomic evidence chain. | Specify that new role evidence must be atomic/versioned and that current write-then-event behavior is not append-only compliance. | None. |

### 8–10. Authorization, reconciliation, and historical truth

| Draft clause | Classification | Evidence and consequence | Required clause-level amendment | Founder-semantic effect |
| --- | --- | --- | --- | --- |
| §8 gates and additional laws | **SUPPORTED WITH IMPLEMENTATION** | The intended gates are fail-closed and correctly forbid legacy membership fallback. Current service does not require OperatorIdentity for org creation, does not deny suspended orgs, does not use the role map as PEP, and authorizes raw ownerAccountId/global admin. | Add an opening sentence: “These are target PEP requirements. The dormant service does not satisfy them and may not be activated until it does.” For gate 5, identify ownerAccountId as the current separate ownership fact rather than requiring an OWNER Membership. | No, except the owner-membership policy decision above. |
| §9.1 outcomes | **SUPPORTED WITH IMPLEMENTATION** | Classification rather than conversion is the correct fail-closed direction, but no classifier/model exists and legacy field alone cannot select an Organization. | Define deterministic selection only after a durable mapping exists. In its absence, zero or multiple candidates must be AMBIGUOUS; RECONCILED requires independently created active Membership and matching OperatorIdentity accountId. | No. |
| §9.2 | **SUPPORTED** | Read-only classification followed by normal commands preserves the migration-first and no-auto-promotion rules. | None. | None. |
| §9.3–§9.4 | **SUPPORTED WITH IMPLEMENTATION** | EventEnvelope provides correlationId and deterministic event ID but no causationId, canonical JSON/digest algorithm, input snapshot, policy/version field, or reconciliation persistence. | Say causation is omitted until implemented; require a new additive, versioned evidence model plus a specified canonical serialization/digest before claiming byte-identical replay. | Implementation detail only. |
| §9.5 production-data wording | **CONFLICTS WITH HIGHER CONSTITUTION** | Gate D governs migration preflight; it is not blanket authorization for future operational classification. | Replace with: “This readiness slice must not access production data. Any future production evaluation needs its own owner-authorized, read-only operational plan after the applicable schema is verified; Gate D alone does not authorize evaluation.” | No. |
| §10 | **CONFLICTS WITH REPOSITORY** as present fact | Membership/Organization rows are mutable state, current events lack required evidence fields, and writes/events are not atomic. Cascades exist. | Replace opening with: “New constitutional ownership, lifecycle, membership, and reconciliation facts must preserve append-only evidence. Existing foundational rows remain mutable state and are not projections of a complete immutable chain.” Prohibit new cascades for new evidence only; resolve legacy erasure strategy separately. | No intended protection is weakened; current-state claim is corrected. |

### 11–12. Migration and activation

| Draft clause | Classification | Evidence and consequence | Required clause-level amendment | Founder-semantic effect |
| --- | --- | --- | --- | --- |
| §11.1–§11.2 | **SUPPORTED** | Migration-first is binding and semantic mismatch makes automatic conversion unsafe. | None. | None. |
| §11.3 | **OWNER DECISION REQUIRED** | “Restrictive FKs” conflicts with current cascades and can itself interfere with lawful deletion. Retention/erasure policy is not chosen. | Require an owner-approved non-cascading retention/erasure design for new evidence: immutable IDs, nullable/restricted references, tombstones, or pseudonymization as appropriate. | No, preserves the intended evidence rule while requiring a lawful design. |
| §11.4 | **SUPPORTED WITH IMPLEMENTATION** | Gate D has no general extension mechanism today; adding a directory fails parser/test/CI. | Require separate owner-approved parser/manifest/test/runbook governance before a migration directory is created or merged, not merely before it is “production-eligible.” | Governance sequencing only. |
| §11.5 | **SUPPORTED** | Production migration state remains unknown and was not accessed. | None. | None. |
| §11.6 | **SUPPORTED WITH IMPLEMENTATION** | No backfill framework exists. | Treat all listed controls as future requirements; no automatic Membership creation. | None. |
| §12 Stages 0–1 | **SUPPORTED WITH IMPLEMENTATION** | Flag is fail-closed; every future route/job needs separate reachability proof. | Add route/job-level dormant tests as an activation requirement. | None. |
| §12 Stages 2–3 | **OWNER DECISION REQUIRED** | Existing Gate D only governs the six baseline migrations. It cannot authorize a future readiness migration without the §11.4 governance revision and its own release decision. | State that baseline Gate D and every later readiness migration require their own owner-authorized preflight/release unless governance is explicitly revised. | No. |
| §12 Stage 4 | **SUPPORTED WITH IMPLEMENTATION** | There is no classifier or evidence model, and any future production shadow read needs explicit read-only controls. | Require a separate owner-approved operational plan before production shadow evaluation. | No. |
| §12 Stages 5–6 | **OWNER DECISION REQUIRED** | There is no cohort gate, second kill switch, lifecycle command, enrollment evidence, support procedure, or observability readiness. | Require owner approval of the activation cohort and readiness criteria before implementation. | No. |
| §12 Stage 7 and final flag sentence | **SUPPORTED** as target; **INSUFFICIENT EVIDENCE** for current production state | Enabling the source boolean does not itself create data; no production flag value was inspected. | Preserve the code-semantic claim and remove any implication of verified production state. | None. |

### 13–15. Security, authority matrix, and domain boundaries

| Draft clause | Classification | Evidence and consequence | Required clause-level amendment | Founder-semantic effect |
| --- | --- | --- | --- | --- |
| §13.1–§13.5, §13.8 | **SUPPORTED WITH IMPLEMENTATION** | Scoped consumer delegation and refs-only identity events align. Profile separation and Organization-resource PEP are not built. | State that profile visibility and resource PEP are activation prerequisites; no provider identifiers or credentials in future events. | None. |
| §13.6–§13.7 | **SUPPORTED WITH IMPLEMENTATION** | Step-up assurance, invitations, and enrollment tokens are absent. | Retain “when supported” and require single-purpose, expiration, revocation, and non-authoritative semantics before implementation. | None. |
| §13.9 | **SUPPORTED WITH IMPLEMENTATION** | Internal service returns distinguishable not_found and forbidden results; there is no public Identity HTTP boundary. | Limit the opaque-denial rule to external HTTP/public boundaries; internal service codes need not be rewritten until exposed. | No. |
| §13.10 | **OWNER DECISION REQUIRED** | No emergency authority actor, scope, audit contract, or review process exists. | Require a separately ratified emergency authority design before implementation. | No. |
| §14 rows for Organizations and Membership | **CONFLICTS WITH HIGHER CONSTITUTION** if read as separate implementation owners | Frozen code ownership is one bounded context: lib/identity owns durable Organization, Membership, and role taxonomy. | Prepend: “Organizations and Membership here name semantic responsibilities. Until a separately ratified bounded-context extraction, lib/identity is their sole durable implementation owner.” | No, unless separate deployable services were intended. |
| §14 Organization ownership / Membership rows | **SUPPORTED WITH IMPLEMENTATION** | Creation exists; transfer, lifecycle commands, invitations, suspension, self-resignation, delegated grant authority, and PEP enforcement do not. | Retain the action matrix as target authority, explicitly distinguishing current ownerAccountId from future evidence model. | None. |
| §15 Organizations/Membership ownership | **CONFLICTS WITH HIGHER CONSTITUTION** if it creates new services | Splitting physical owners would violate the sole owner rule. “Invitations … if assigned” also leaves an unowned capability. Reputation owns more than XP truth: ledger, progression, scoring policy, and milestones. | Define Identity, Organizations, and Membership as conceptual subdomains inside lib/identity; assign invitations/enrollment evidence explicitly before building; expand Reputation to its verified truth scope. | No, unless founder intended new services. |

### 16–19. Non-goals, locked decisions, implementation order, ratification

| Draft clause | Classification | Evidence and consequence | Required clause-level amendment | Founder-semantic effect |
| --- | --- | --- | --- | --- |
| §16 | **SUPPORTED** | It keeps Gate D, production, migration, activation, legacy replacement, and UI out of scope. | None. | None. |
| §17 heading and decision 6 | **CONFLICTS WITH REPOSITORY** as written | The entire document is proposed; “ratified” is premature. Schema proves account-level, not human-level, uniqueness. | Rename heading to “PROPOSED FOUNDER DECISIONS (effective only upon ratification)” and use “Authentication Account” in decision 6. | Accuracy only unless human-level uniqueness is retained. |
| §17 decisions 2, 10–11, 16, 18–19 | **CONFLICTS WITH REPOSITORY** | They repeat the bridge, physical-ownership, legacy authorization, cascade/history, and production-evidence issues above. | Apply the exact amendments from §§2.3, 3.5, 3.7, 10, 12, and 15. Decision 16 must forbid legacy edge only as new operator authority, not existing consumer-workspace authorization. | See those clauses. |
| §18 “Invalid prior plan” and replacement order | **CONFLICTS WITH HIGHER CONSTITUTION** | The draft correctly rejects automatic conversion, but map/freeze still describe it. Its numbered order says ratify before audit/resolve. | Say “superseded proposed interpretation,” not an implemented plan; reorder: audit → resolve/co-amend higher records → ratify → Gate D governance before a new migration → design/implement dormant contracts. | **Yes:** makes a deliberate frozen-record change explicit. |
| §18.8 | **SUPPORTED WITH IMPLEMENTATION** | Independent review is a process expectation, not a repository-enforced approval count. | Do not present it as current GitHub enforcement. | None. |
| §19 | **OWNER DECISION REQUIRED** | The stated phrase has no technical enforcement or governance record by itself. Frozen L0–L3/law changes require the applicable coordinated record/ADR. | Require explicit founder ratification recorded in project governance, including each Freeze/Map amendment and any required ADR. | Governance form only. |

## Mandatory adversarial decision matrix

| # | Required challenge | Classification | Repository truth and implementation prerequisite |
| --- | --- | --- | --- |
| 1 | One canonical OperatorIdentity per human authentication account | **INSUFFICIENT EVIDENCE** | Unique accountId proves one per account, not one per human. |
| 2 | Consumer and operator persona may coexist | **SUPPORTED WITH IMPLEMENTATION** | Structurally possible; no persona selector or PEP separation exists. |
| 3 | Consumer may remain consumer-only forever | **SUPPORTED** | No automatic OperatorIdentity creation exists; preserve this rule. |
| 4 | managedByAgencyId permanently forbidden as OperatorMembership truth | **SUPPORTED WITH IMPLEMENTATION** | Forbid it as new operator authority, preserve it for existing consumer paths. |
| 5 | One active managing agency at a time | **SUPPORTED WITH IMPLEMENTATION** | Scalar field represents one current pointer; durable historical episodes are absent. |
| 6 | Operator may belong to multiple organizations | **SUPPORTED WITH IMPLEMENTATION** | Composite unique permits it; activation is unbuilt. |
| 7 | AGENCY is one Organization kind | **SUPPORTED** | Explicit enum includes five kinds. |
| 8 | Organization ownership is separate from Membership | **SUPPORTED** | ownerAccountId/derived OWNER already separates them. |
| 9 | ACTIVE/SUSPENDED Organizations have exactly one owner | **SUPPORTED WITH IMPLEMENTATION** | Non-null ownerAccountId exists; transfer/lifecycle/provenance and active-owner policy do not. |
| 10 | Owner has active OperatorIdentity and active Membership | **OWNER DECISION REQUIRED** | Current owner is a User account and no owner Membership exists. Avoid two ownership truths. |
| 11 | ADMIN does not imply ownership | **SUPPORTED** | OWNER is derived; ADMIN is assignable and lacks owner-level PEP permissions. |
| 12 | Creation/ownership/initial Membership atomic | **SUPPORTED WITH IMPLEMENTATION** | Current creation writes only Organization; transaction/evidence design is needed. |
| 13 | Organization state set remains ACTIVE/SUSPENDED/ARCHIVED | **SUPPORTED** | Exact state machine matches. |
| 14 | Membership state set remains ACTIVE/SUSPENDED/REMOVED | **SUPPORTED** | Exact state machine matches. |
| 15 | REMOVED remains terminal | **SUPPORTED** | Exact state machine matches; future episodes need redesign. |
| 16 | Invitations/applications separate from Membership | **SUPPORTED WITH IMPLEMENTATION** | No pre-membership records exist. |
| 17 | Reconciliation is classification only | **SUPPORTED** | Correct fail-closed direction; no classifier yet. |
| 18 | No automatic Membership creation/backfill | **SUPPORTED** | Required by semantic mismatch and migration-first. |
| 19 | Named reconciliation outcomes | **SUPPORTED WITH IMPLEMENTATION** | Need deterministic candidate selection, evidence, and explicit SUPERSEDED proof. |
| 20 | Organization suspension affects authorization, not Membership state | **SUPPORTED WITH IMPLEMENTATION** | State semantics match; current service does not deny SUSPENDED Organizations. |
| 21 | Ownership transfer needs initiation and acceptance | **SUPPORTED WITH IMPLEMENTATION** | No transfer/provenance/acceptance exists. |
| 22 | Event Fabric transports only | **SUPPORTED** | Frozen permanent invariant. |
| 23 | Projections preserve append-only evidence | **SUPPORTED WITH IMPLEMENTATION** | Future evidence needed; existing mutable rows/events are insufficient. |
| 24 | Gate D governance extends separately before new migration | **SUPPORTED WITH IMPLEMENTATION** | Must change parser/test/runbook before directory creation/merge. |
| 25 | Feature activation cannot run migrations/backfills/create data | **SUPPORTED** | Exact false-by-default flag provides the base; each future path needs testing. |

## Schema and migration feasibility

No schema was changed for this audit. The Constitution can begin with **zero destructive
data operations**, but only if it preserves legacy truth and stages the following work.

| Prospective capability | Current gap | Migration classification | Constraint |
| --- | --- | --- | --- |
| Ownership provenance/transfer episodes | ownerAccountId is a single mutable compatibility fact with no provenance/acceptance. | **Additive**, followed by a carefully governed projection handoff. | Do not create a parallel canonical owner; choose one source during activation. |
| Owner eligibility (active OperatorIdentity / operational access) | No active-identity or membership link is required. | **Additive / unresolved policy**. | Decide whether ownership alone grants access or whether a non-owner Membership is separately required. |
| Enrollment, invitations, applications, consent | No models or durable evidence. | **Additive**. | Explicit owner, idempotency, expiry, revocation, and evidence required. |
| Reconciliation decision/evidence | No classifier, durable mapping, input snapshot, policy version, digest, or supersession. | **Additive**. | No automatic membership/backfill; canonical serialization must be specified. |
| Membership history / re-admission episodes | One mutable row per (organizationId, operatorId), unique pair, terminal REMOVED. | **Compatibility-preserving but index/constraint replacing**. | Need a separately reviewed episode/supersession model; no destructive rewrite. |
| Role-policy versioning | Role row contains no policy version/provenance. | **Additive**. | New evidence must be atomic with the authoritative mutation. |
| Historical retention / deletion | Current graph uses cascades. | **Unresolved**. | Owner/counsel must select tombstone, redaction, pseudonymization, or restricted deletion for new records. |
| Organization lifecycle and PEP authorization | State enums exist but no commands/PEP. | **No schema required initially; runtime implementation later**. | Deny suspended/ambiguous state before any route becomes reachable. |
| Gate D handling for any future migration | Exactly six-directory baseline. | **Governance/tooling prerequisite**. | Approved parser/manifest/test/runbook change must precede new migration directory. |

An additive first phase is feasible. Replacing the membership uniqueness representation or
changing historical deletion behavior is not inherently a destructive data operation, but
cannot be called safe until the compatibility and erasure design is owner-approved.

## Authorization and security assessment

The proposed target can be implemented without legacy operator fallback, raw-FK authority,
cross-organization leakage, membership-as-credential, or feature-off mutation. Current
source does **not** yet satisfy all gates:

- lib/session uses managedByAgencyId to verify the existing consumer workspace. That remains
  permitted only for the legacy consumer-management capability.
- lib/network/authz accepts a verified managed-client edge for an agency-private Network
  channel. It must never be reused as OperatorIdentity, Organization, or Membership authority.
- lib/identity/service authorizes ownerAccountId/global admin, does not require an
  OperatorIdentity to create an Organization, and permits SUSPENDED Organizations through the
  management helper.
- lib/identity/rbac is a future permission map, not the live PEP; no OrganizationMembership
  ADMIN role independently grants current route authority.
- Current identity events are refs-only, but they lack a causation ID, policy version,
  authority source, sealed effective input, and complete append-only mutation transaction.

Required pre-activation security controls are therefore: server-side resource tenant check;
explicit persona context; active Organization/OperatorIdentity/Membership gates; policy-version
PEP; opaque external denials; no consumer data or credentials in events; invitation/step-up
controls when Authentication supports them; and a separately ratified emergency authority.

## Gate D governance impact

The draft’s no-migration/no-backfill activation law is compatible with current source. Its
future-migration wording must recognize that Gate D presently governs a fixed historical
baseline, not a general migration stream. A later readiness migration must not be added,
merged, or treated as eligible until a separately reviewed governance change updates the
hard-coded chain, preflight behavior, tests, and runbook. Gate D authorization is also not
authorization to inspect production data for operational classification.

## Required coordinated amendments before ratification

1. Amend §0’s evidence hierarchy and add coordinated-Freeze/Map amendment language.
2. Amend §§2.3, 3.7, 9, 17.2, and 18 to distinguish the active managed-consumer relation
   from any future operator/membership model; update the frozen Map/Freeze’s direct bridge
   wording at the same ratification decision.
3. Amend §§3.3 and 17.6 from human-level to Authentication-Account-level uniqueness unless a
   verified-person design is separately authorized.
4. Amend §§3.5, 5.3, 6.2, 7.4, 8, and 17.10–11 to preserve ownerAccountId as sole current
   ownership truth and make owner-Membership policy an explicit decision.
5. Amend §§2.8, 3.2, 6.3, 10, 11.3, and 17.18 to scope append-only/non-cascading guarantees
   to new evidence while an owner-approved retention/erasure plan resolves legacy cascades.
6. Amend §§11.4, 12, and 18 so Gate D governance changes precede any new migration directory
   and each later migration has independent owner authorization.
7. Amend §§13–15 to keep Organizations/Membership as conceptual subdomains inside lib/identity
   until a separately ratified extraction; explicitly assign invitations/enrollment evidence;
   and state Reputation’s full existing truth scope.
8. Amend §19 to require a recorded founder ratification and any necessary ADR/Freeze/Map update,
   not just a magic phrase.

## Audit conclusion

The founder draft’s core security posture is sound: consumer/operator separation, explicit
enrollment, no automatic conversion, exact-scope authorization, fail-closed reconciliation,
migration-first changes, and Event Fabric transport-only semantics all improve constitutional
clarity. Ratification must nevertheless be deferred until the amendments above are resolved.
They protect current live consumer authorization, retain one implementation owner, avoid
parallel ownership, and prevent an unsupported historical/replay claim.
