> **PROPOSED — NOT RATIFIED**
>
> This file preserves the founder draft for independent review. It does not authorize implementation, activation, a migration, Gate D, or any production action.
>
> See [the repository-grounded audit](IDENTITY-CONSTITUTION-AUDIT.md) before considering ratification.

# CREDITVECTOR IDENTITY CONSTITUTION
## Version 1.0 — Founder Draft for Adversarial Review

**Project:** CreditVector by Gabriel Capital Labs
**Constitutional owner:** Founder / Platform Constitution
**Status:** Proposed; not ratified until explicit founder approval after independent review
**Scope:** Authentication-account boundaries, consumer workspaces, operator identity, organizations, organization ownership, organization membership, managed-consumer relationships, authority, lifecycle, reconciliation, historical truth, migration, and activation readiness.

---

# 0. CONSTITUTIONAL POSITION

This Constitution is subordinate to the frozen CreditVector Platform Constitution and Ownership Map. It interprets those higher-order laws for the Identity, Organizations, and Membership domains. It does not transfer ownership between domains.

Order of authority:

1. Platform Constitution and frozen Ownership Map
2. This Identity Constitution once ratified
3. Ratified ADRs and domain contracts
4. Database schema and migrations
5. Runtime implementation
6. Projections, APIs, UI, reports, and documentation

When two layers conflict, execution must fail closed and the conflict must be escalated. A convenience field, legacy foreign key, projection, or existing code path does not acquire constitutional meaning merely because it exists.

---

# 1. VERIFIED REPOSITORY FINDINGS

The following findings are treated as the current implementation baseline and must be reverified before implementation:

1. `managedByAgencyId` currently represents an active agency-managed consumer/client relationship. It is not proven to represent an operator, organization membership, employment, ownership, or professional authority.
2. The managed client is a passwordless consumer workspace and may never become an operator.
3. `OrganizationMembership` is a dormant relationship from `OperatorIdentity` to `Organization` and is structurally unique per organization/operator pair in the current model.
4. Organizations are generic. `AGENCY` is one organization kind, not a synonym for Organization.
5. An operator may structurally belong to multiple organizations.
6. Organization lifecycle states currently include `ACTIVE`, `SUSPENDED`, and `ARCHIVED`.
7. Membership lifecycle states currently include `ACTIVE`, `SUSPENDED`, and `REMOVED`.
8. Event Fabric transports facts but does not own their meaning.
9. `OPERATOR_IDENTITY_ENABLED` remains fail-closed and disabled.
10. Production migration state is unknown until owner-authorized Gate D evidence exists.
11. Gate D currently constrains the accepted migration manifest and must be deliberately extended before any new migration is eligible for production execution.

These findings describe repository truth. The remaining sections make the founder-level semantic decisions required to remove ambiguity.

---

# 2. FOUNDATIONAL IDENTITY LAWS

The following laws are immutable unless this Constitution is formally superseded:

1. **An authentication account is not an operator identity.** Authentication proves a credentialed principal; Identity proves a professional platform identity.
2. **A consumer is not an operator.** A consumer may remain a consumer indefinitely and must never receive operator authority implicitly.
3. **A managed-consumer relationship is not an organization membership.** `managedByAgencyId` must never be treated as canonical membership truth.
4. **Organization membership requires explicit intent, explicit authority, and durable evidence.** It may not be inferred from convenience fields, UI state, billing state, or historical association alone.
5. **Organization ownership is distinct from organization membership.** Membership roles do not create legal or constitutional ownership.
6. **Roles and capability policies are not credentials.** Authentication owns credentials; Membership and Organizations contribute authorization facts.
7. **No identity promotion is automatic.** Consumer-to-operator enrollment is an explicit workflow.
8. **Historical truth is append-only.** Current state may be projected, suspended, removed, archived, superseded, or tombstoned, but prior facts are not silently rewritten.
9. **Authorization fails closed.** Missing, ambiguous, conflicting, suspended, archived, removed, or unratified state grants no authority.
10. **Cross-organization access is denied by default.** Authority is scoped to the exact organization, resource, role, and policy version.
11. **Feature flags control reachability, not truth.** Enabling a flag must never create identities, memberships, ownership, or backfills by itself.
12. **Event Fabric transports only.** Domain owners decide identity, lifecycle, ownership, membership, and authorization meaning.

---

# 3. CANONICAL ENTITIES AND THEIR MEANING

## 3.1 Authentication Account

An Authentication Account is the credential-bearing principal owned by Authentication. It may authenticate a person, but it does not by itself prove that the person is a consumer, operator, member, organization owner, administrator, educator, or agency representative.

Authentication owns:

- credentials
- sessions
- multi-factor authentication
- credential recovery
- device/session trust
- authentication assurance

Authentication does not own:

- operator identity
- organization identity
- membership
- professional role
- consumer-management authority
- XP or reputation

## 3.2 Consumer Workspace

A Consumer Workspace is the consumer/client-facing identity and case workspace used for credit-related services. It may be passwordless under existing product rules.

A Consumer Workspace:

- may exist without an OperatorIdentity
- may remain consumer-only forever
- does not grant professional or administrative authority
- is not an Organization
- is not an OrganizationMembership
- may be managed by an agency through a scoped service relationship
- retains its own historical case, dispute, document, and consent records

A consumer’s identity is never owned by an agency. An agency receives scoped, revocable, policy-bound management access; it does not acquire ownership of the person or identity.

## 3.3 OperatorIdentity

An OperatorIdentity is the durable professional identity of a human operator inside CreditVector.

Constitutional rules:

- One human authentication account may have at most one canonical OperatorIdentity.
- The OperatorIdentity persists across organization changes.
- An operator may belong to zero, one, or multiple organizations.
- Organization-specific role, title, authority, and tenure belong to Membership, not OperatorIdentity.
- Professional profile data is a projection of OperatorIdentity plus authorized domain facts; it is not canonical membership or ownership truth.
- Nonhuman system/service principals are not OperatorIdentities.
- An Organization may suspend or remove a membership, but it may not suspend the person’s global OperatorIdentity. Global OperatorIdentity lifecycle is owned by Identity and platform security authority.

## 3.4 Organization

An Organization is a durable legal or operational entity represented in CreditVector.

Constitutional rules:

- `AGENCY` is an Organization kind, not the definition of Organization.
- Organizations may support additional kinds without changing Identity or Membership ownership.
- An Organization has its own lifecycle, policy context, tenant boundary, and durable identifier.
- An ACTIVE or SUSPENDED Organization must have exactly one current constitutional owner.
- Organization ownership is governed by Organizations, not by a raw membership role.
- Organization deletion is not a normal lifecycle action. Historical records are retained; terminal closure uses `ARCHIVED` and tombstone/projection rules where required.

## 3.5 Organization Ownership

Organization Ownership is the singular constitutional authority relation for an Organization.

Ownership:

- is owned by Organizations
- is distinct from Membership
- must identify one current owner for every ACTIVE or SUSPENDED Organization
- must be backed by an active OperatorIdentity
- requires an active OrganizationMembership for operational access
- may not be inferred solely from `ADMIN`, `managedByAgencyId`, billing contact, creator metadata, or authentication account ownership
- must be transferred through an explicit, evidenced, two-party or owner-plus-platform-authority workflow

If an existing schema stores legacy owner-account references, they are compatibility truth until reconciled. New constitutional ownership must resolve to an OperatorIdentity without destroying legacy evidence.

## 3.6 OrganizationMembership

OrganizationMembership is the canonical relationship proving that an OperatorIdentity participates in a specific Organization under an explicit role and policy context.

Membership proves:

- platform participation in that Organization
- current role/capability context
- lifecycle state
- authority provenance
- organization-scoped tenure

Membership does not, by itself, prove:

- legal employment
- contractor status
- equity
- ownership
- consumer-management consent
- authentication assurance
- platform-wide identity authority

An operator may hold memberships in multiple Organizations. Every membership is scoped to one OperatorIdentity and one Organization.

## 3.7 ManagedConsumerRelationship

The semantic meaning currently represented by `managedByAgencyId` is a ManagedConsumerRelationship.

It proves only that:

- a consumer workspace is currently managed by an agency-side actor or agency context under existing client-management rules
- scoped service access may exist under the consumer-management policy

It does not prove:

- OperatorIdentity
- OrganizationMembership
- organization ownership
- employment
- professional role
- organization consent to admit the consumer as an operator
- consumer consent to become an operator

For the current product generation, a consumer may have at most one active managing agency relationship at a time unless a separate multi-agency collaboration constitution is later ratified. Multiple historical relationships may exist over time and must be preserved.

`managedByAgencyId` remains active compatibility and authorization truth only for the existing managed-consumer capability until that capability receives its own migration. It is permanently forbidden as a fallback for operator or organization authorization.

## 3.8 Invitations, Applications, and Enrollment

An invitation, application, enrollment request, or suggested affiliation is not a Membership.

These are pre-membership evidence objects. Membership exists only after all required acceptance, approval, policy, and identity conditions succeed.

---

# 4. PERSONA SEPARATION

A single human account may simultaneously hold:

- a Consumer Workspace
- an OperatorIdentity

These personas must remain semantically and authorization-wise separate.

Rules:

1. Consumer data does not automatically populate the public Operator Profile.
2. Operator authority does not automatically grant access to the person’s consumer case.
3. Managed-consumer status does not automatically select an OrganizationMembership.
4. The same person may be a consumer of one agency and an operator in another organization if explicit policies permit it.
5. Persona switching must be explicit in the product experience and server-side authorization context.
6. Deactivating one persona does not silently delete or rewrite the other persona’s history.

---

# 5. OPERATOR ENROLLMENT CONSTITUTION

A consumer becomes an operator only through explicit Operator Enrollment.

## 5.1 Mandatory Conditions

Operator Enrollment requires:

1. a valid authenticated principal
2. explicit intent to create or activate a professional OperatorIdentity
3. acceptance of the applicable operator terms, privacy disclosures, and professional policies
4. completion of required professional identity/profile fields
5. successful server-authoritative validation
6. an idempotent OperatorIdentity creation or retrieval operation

## 5.2 Joining an Existing Organization

Joining an Organization requires, in addition:

1. an Organization-issued invitation or an Organization-approved application
2. an explicitly identified Organization
3. an explicitly assigned role or capability policy
4. consent by the operator
5. approval by an authorized Organization actor
6. creation of durable membership provenance

Membership is created only after acceptance and approval. A pending invitation or application grants no Organization authority.

## 5.3 Creating an Organization

Creating an Organization requires an active OperatorIdentity. Organization creation, constitutional ownership establishment, and initial operational Membership must succeed atomically or fail as a unit.

No ACTIVE Organization may be created ownerless.

## 5.4 Relationship to `managedByAgencyId`

A legacy managed-consumer relationship may be used only as a non-authoritative suggestion during enrollment, and only when it maps unambiguously to one Agency Organization.

It may prefill an invitation candidate. It may not:

- create an OperatorIdentity
- create a Membership
- choose a role
- confer Organization authority
- bypass consumer consent
- bypass Organization approval

---

# 6. ORGANIZATION LIFECYCLE CONSTITUTION

The existing lifecycle states are retained:

- `ACTIVE`
- `SUSPENDED`
- `ARCHIVED`

No additional state is introduced by this Constitution.

## 6.1 Legal Transitions

- `ACTIVE -> SUSPENDED`
- `ACTIVE -> ARCHIVED`
- `SUSPENDED -> ACTIVE`
- `SUSPENDED -> ARCHIVED`
- `ARCHIVED` is terminal

All other transitions fail closed.

## 6.2 Authority

### Create

An active OperatorIdentity may create an Organization under product policy. Creation must establish constitutional ownership and initial Membership atomically.

### Suspend

An Organization may be suspended by:

- its constitutional owner under an owner-initiated suspension policy
- platform security/compliance authority under a platform-initiated suspension policy

Organization administrators may request suspension if policy permits, but an `ADMIN` role alone does not silently acquire ownership authority.

### Reactivate

Reactivation must be performed by the same authority class that imposed the suspension, or by a higher ratified platform authority. The suspension reason and resolution evidence must be preserved.

### Archive

Archival may be authorized by the constitutional owner or ratified platform authority. Billing and legal prerequisites are consulted but remain owned by Billing and applicable compliance domains. `ARCHIVED` is terminal and does not erase history.

### Transfer Ownership

Ownership transfer requires:

1. an ACTIVE Organization
2. a current valid owner
3. an active target OperatorIdentity
4. explicit initiation by the current owner or ratified platform authority
5. explicit acceptance by the target owner, except for a separately ratified emergency process
6. atomic establishment of the new ownership relation and required active Membership
7. append-only retention of prior ownership evidence

Membership role elevation alone may not transfer ownership.

## 6.3 Effects of Lifecycle State

### ACTIVE

Normal organization-scoped operations may proceed if all other authorization gates pass.

### SUSPENDED

- normal state-changing business operations fail closed
- membership records are not silently rewritten
- narrowly scoped owner/compliance resolution surfaces may remain available under explicit policy
- platform security authority retains only its independently authorized access

### ARCHIVED

- no new memberships
- no normal operational mutations
- no new consumer-management assignments
- read-only historical access only where retention, privacy, and legal policy permit
- no cascade deletion of memberships, ownership history, events, or evidence

Organization suspension or archival affects authorization through Organization state. It does not fabricate Membership transitions.

---

# 7. MEMBERSHIP LIFECYCLE CONSTITUTION

The existing lifecycle states are retained:

- `ACTIVE`
- `SUSPENDED`
- `REMOVED`

## 7.1 Creation

A Membership is created in `ACTIVE` only after the invitation/application/enrollment contract has completed. Pending states belong to pre-membership objects, not Membership.

## 7.2 Legal Transitions

- `ACTIVE -> SUSPENDED`
- `ACTIVE -> REMOVED`
- `SUSPENDED -> ACTIVE`
- `SUSPENDED -> REMOVED`
- `REMOVED` is terminal for the current membership record

All other transitions fail closed.

## 7.3 Authority

- The constitutional owner may manage non-owner memberships under policy.
- An administrator may manage only memberships and roles allowed by the active policy version.
- An operator may resign from their own non-owner Membership, resulting in `REMOVED`.
- Platform security/compliance may suspend or remove Membership under independently ratified authority.
- An Organization may never suspend the person’s global OperatorIdentity merely because it can suspend that Organization’s Membership.

## 7.4 Owner Protection

The current owner’s required Membership may not be suspended or removed until ownership is transferred, except through a ratified platform emergency process.

An ACTIVE Organization must not become ownerless due to a Membership mutation.

## 7.5 Re-admission

`REMOVED` remains terminal for the current record. Automatic reactivation is prohibited. A future re-admission mechanism requires a separate ratified ADR defining whether it creates a new membership episode, a superseding record, or another append-only structure. Legacy reconciliation may never bypass this rule.

## 7.6 Role Changes

Role changes require explicit authority, policy-versioned validation, and append-only evidence. A role change:

- does not transfer constitutional ownership
- does not change Authentication credentials
- does not change OperatorIdentity
- does not alter XP
- may not self-elevate an actor beyond their grant authority

---

# 8. AUTHORIZATION CONSTITUTION

Every organization-scoped operator action must pass all applicable gates:

1. authenticated principal is valid
2. OperatorIdentity exists and is operationally eligible
3. requested Organization matches the resource tenant
4. Organization is `ACTIVE`, unless an explicit suspension-resolution policy applies
5. OrganizationMembership is `ACTIVE`, or constitutional ownership supplies a separately ratified authority fact
6. role/capability policy authorizes the exact action
7. policy version, resource state, and feature flag permit execution

Failure or ambiguity at any gate produces denial.

Additional laws:

- `managedByAgencyId` may not satisfy any operator-authorization gate.
- A consumer-management path may continue using its existing delegated-access rules, but those rules may not leak into operator or organization authorization.
- `OrgRole.ADMIN` is an authorization input only after its policy enforcement point is ratified and implemented.
- Raw foreign keys never constitute complete authorization.
- Cross-organization access is denied by default.
- Event Fabric may transport authorization facts but may not decide authorization meaning.

---

# 9. MANAGED-CONSUMER RECONCILIATION CONSTITUTION

The previous roadmap phrase “`managedByAgencyId` to `OrganizationMembership` reconciliation” is hereby corrected.

The valid goal is not automatic conversion. The valid goal is deterministic classification and evidence-preserving enrollment readiness.

## 9.1 Semantic Outcomes

A reconciliation evaluation may produce one of these semantic outcomes, subject to repository naming conventions:

- `NOT_APPLICABLE`: the consumer has no OperatorIdentity or no enrollment intent
- `CANDIDATE`: exactly one Agency Organization can be suggested, but explicit consent/approval is incomplete
- `RECONCILED`: an independently created, explicit Membership already exists and the legacy relation matches it
- `AMBIGUOUS`: zero or multiple Organization candidates, identity mismatch, or insufficient evidence
- `CONFLICT`: existing Membership or Organization facts contradict the legacy relationship
- `SUPERSEDED`: the legacy relationship is no longer current or has been replaced

Only `RECONCILED` recognizes an already valid Membership. No outcome automatically creates one.

## 9.2 Default Behavior

Reconciliation is read-only classification by default.

Mutation may occur only through the normal Operator Enrollment and Membership commands after all explicit approvals succeed.

## 9.3 Evidence Requirements

Every persisted reconciliation decision must retain:

- source record identifier
- source `managedByAgencyId` value or a safe evidence reference
- candidate Organization identifiers in stable order
- linked OperatorIdentity, if any
- decision status
- policy/version identifier
- evidence digest
- idempotency key
- decision authority or automated classifier identity
- correlation and causation identifiers where supported
- effective timestamp supplied as an input
- supersession reference when revised

## 9.4 Idempotency and Replay

The same sealed inputs and policy version must produce the same classification and byte-identical canonical evidence representation.

Retries must not create duplicate Memberships, duplicate decisions, or divergent ordering.

## 9.5 Prohibitions

Reconciliation may not:

- infer a role
- infer consent
- infer Organization ownership
- infer employment
- auto-create OperatorIdentity
- auto-create Membership
- use production data without owner-authorized Gate D access
- mutate records while `OPERATOR_IDENTITY_ENABLED` is off

---

# 10. HISTORICAL TRUTH AND EVIDENCE

Identity, Organization, Ownership, Membership, and reconciliation changes must preserve append-only history.

Each state-changing fact must include, where supported by repository conventions:

- stable event or command identifier
- subject identifier
- prior and resulting state
- actor principal
- authority source
- reason code
- policy/version identifier
- idempotency key
- correlation and causation identifiers
- effective timestamp as a sealed input
- evidence/provenance reference

Current state may be stored as a projection for efficient reads. The projection is not permitted to erase the event/evidence chain.

Hard-delete cascades that destroy identity, ownership, membership, or reconciliation history are prohibited. Privacy erasure must use ratified tombstone, redaction, pseudonymization, or projection-removal rules without fabricating history.

---

# 11. MIGRATION CONSTITUTION

## 11.1 Migration-First

Any implementation requiring schema changes must begin with an additive migration and schema-safety contract before runtime mutation code.

## 11.2 No Automatic Legacy Conversion

No migration may automatically convert `managedByAgencyId` into OrganizationMembership.

No migration may infer:

- OperatorIdentity
- Organization
- role
- consent
- ownership
- membership authority

## 11.3 Additive Bridge

A future bridge may add evidence, enrollment, invitation, ownership-provenance, reconciliation, or history structures only after repository review proves they are necessary and correctly owned.

The bridge must:

- preserve the legacy field during compatibility
- record ambiguity rather than guess
- use restrictive foreign keys
- avoid cascade deletion
- support idempotent dry-run and replay
- separate classification from mutation
- preserve historical provenance

## 11.4 Gate D Manifest

Gate D currently accepts an explicit migration manifest. Before adding any production-eligible migration, the Gate D owner must approve a separate, reviewable extension mechanism or manifest revision.

The migration must not be created merely to force the manifest to change. Governance changes and schema changes remain separate reviewable concerns.

## 11.5 Production State

Production migration state remains unknown until an owner-authorized, read-only Gate D preflight produces direct evidence.

No development agent may infer production schema from repository state.

## 11.6 Backfill

Any future backfill must be a separate owner-authorized operation with:

- dry-run mode
- deterministic input snapshot
- counts and digests
- no-op detection
- idempotency
- ambiguous/conflict output
- resumability
- audit evidence
- no automatic Membership creation

---

# 12. ACTIVATION CONSTITUTION

Operator Identity activation must proceed through explicit stages:

## Stage 0 — Constitution

- Identity Constitution ratified
- unresolved owner decisions closed
- repository documentation aligned

## Stage 1 — Dormant Implementation

- additive schema and domain code merged
- flags remain off
- no routes or background mutation reachable
- tests prove dormant behavior

## Stage 2 — Migration Readiness

- Gate D manifest/governance updated through a separate reviewed change
- migration reviewed and schema-safe
- production backup and direct connection remain owner-gated

## Stage 3 — Production Schema, Feature Off

- owner authorizes Gate D
- migration applied under evidence-controlled runbook
- feature remains off
- production verification completed

## Stage 4 — Read-Only Shadow Evaluation

- reconciliation classification runs read-only
- no OperatorIdentity or Membership creation
- ambiguous/conflict counts reviewed by owner

## Stage 5 — Controlled Enrollment

- explicit new Operator Enrollment enabled for internal or limited cohort
- no automatic legacy conversion
- authorization and lifecycle evidence monitored

## Stage 6 — Controlled Organization/Membership Activation

- organization and membership commands enabled for approved cohort
- rollback and kill switch verified
- support and observability ready

## Stage 7 — General Availability

- explicit owner authorization
- production evidence, security review, and operational acceptance complete

Enabling `OPERATOR_IDENTITY_ENABLED` never creates data, executes migrations, performs backfills, or resolves legacy relationships by itself.

---

# 13. SECURITY AND PRIVACY CONSTITUTION

1. Agencies manage consumer workspaces through scoped delegation; they do not own consumer identity.
2. Consumer records and operator professional profiles remain separated by default.
3. Organization role and membership details are disclosed only under privacy and product policy.
4. Inactive, suspended, removed, archived, ambiguous, or conflicting state grants no authority.
5. Tenant/resource identifiers must be checked server-side.
6. Membership role changes and ownership transfer require step-up authentication when Authentication supports it.
7. Invitations and enrollment tokens must be single-purpose, expiring, revocable, and non-authoritative until accepted.
8. No credentials, secrets, sensitive consumer data, or provider identity may be placed in domain events.
9. Error responses must not reveal whether unrelated operators, consumers, or organizations exist.
10. Emergency platform authority must be explicit, logged, narrowly scoped, and independently reviewable.

---

# 14. AUTHORITY MATRIX

| Action | Constitutional owner | Authorized actor(s) | Forbidden shortcut |
|---|---|---|---|
| Authenticate account | Authentication | Credentialed principal / Auth policy | Membership role |
| Create OperatorIdentity | Identity | Authenticated person under enrollment policy | `managedByAgencyId` |
| Suspend global OperatorIdentity | Identity | Platform identity/security authority | Organization admin |
| Create Organization | Organizations | Active OperatorIdentity under policy | Consumer status alone |
| Own Organization | Organizations | Explicit current owner relation | `ADMIN` role alone |
| Transfer Organization ownership | Organizations | Current owner + accepting target, or ratified emergency authority | Role change |
| Suspend/activate/archive Organization | Organizations | Owner or ratified platform authority by reason class | Raw membership FK |
| Invite/apply to Organization | Membership pre-enrollment contract | Authorized org actor / applicant | Automatic membership |
| Create Membership | Membership | Accepted invitation/application plus authorized approval | Legacy agency relationship |
| Suspend/remove Membership | Membership | Owner/admin under policy, self-resignation, or platform authority | Global identity mutation |
| Assign role | Membership | Actor with delegated grant authority | Self-elevation |
| Manage consumer workspace | Existing consumer/client-management owner | Scoped delegated agency authority | Operator Membership alone |
| Transport facts | Event Fabric | Domain emitters and subscribers | Business-rule ownership |

---

# 15. DOMAIN BOUNDARIES

## Identity owns

- OperatorIdentity
- operator lifecycle
- account-to-operator link
- operator identity projections

Identity does not own Organization lifecycle, Membership roles, credentials, XP, or consumer-management consent.

## Organizations owns

- Organization identity and kind
- Organization lifecycle
- constitutional ownership
- ownership transfer
- organization-level invariants

Organizations does not own OperatorIdentity, credentials, Membership history, XP, or billing money.

## Membership owns

- OperatorIdentity-to-Organization participation
- membership lifecycle
- roles and organization-scoped authority facts
- membership invitations/applications/enrollment evidence if assigned by repository architecture

Membership does not own Organization identity, constitutional ownership, global OperatorIdentity, credentials, billing, or reputation.

## Authentication owns

- credentials, sessions, and authentication assurance

## Event Fabric owns

- transport only

## Reputation owns

- XP truth only

## Arena owns

- presentation only

No domain may duplicate another owner merely for convenience.

---

# 16. NON-GOALS

This Constitution does not:

- activate Operator Identity
- authorize Gate D
- execute or approve a production migration
- redesign Authentication
- define billing entitlements
- define XP or Arena behavior
- define employment or contractor legal status
- define all future Organization roles
- create multi-agency consumer collaboration
- replace the existing managed-consumer system
- permit automatic consumer-to-operator conversion
- permit automatic membership backfill
- create customer-visible UI

---

# 17. RATIFIED FOUNDER DECISIONS

Upon ratification, the following decisions are locked:

1. A consumer is not an operator.
2. `managedByAgencyId` is a managed-consumer relationship, not OrganizationMembership.
3. A managed consumer may remain consumer-only forever.
4. Consumer-to-operator conversion requires explicit Operator Enrollment.
5. An authentication account may hold both consumer and operator personas, which remain separated.
6. One human account may have at most one canonical OperatorIdentity.
7. An OperatorIdentity may belong to multiple Organizations.
8. `AGENCY` is one Organization kind.
9. OrganizationMembership proves participation and scoped authority, not ownership or employment.
10. Organization ownership is a distinct Organizations-owned relation.
11. An ACTIVE or SUSPENDED Organization must have exactly one current owner.
12. Membership and Organization lifecycle use the existing state sets unless separately amended.
13. `ARCHIVED` and `REMOVED` remain terminal under the current version.
14. Legacy reconciliation is classification, not automatic conversion.
15. No automatic Membership creation or backfill is permitted.
16. No raw legacy foreign key may authorize operator access.
17. Event Fabric transports only.
18. Historical truth is append-only and non-cascading.
19. `OPERATOR_IDENTITY_ENABLED` remains off until the staged activation gates are separately authorized.
20. Production state remains unknown without direct owner-authorized evidence.

---

# 18. IMPLEMENTATION CONSEQUENCES

The immediate implementation plan is changed as follows:

## Invalid prior plan

`managedByAgencyId -> OrganizationMembership` automatic reconciliation/backfill

## Valid replacement plan

1. Ratify this Constitution.
2. Perform a repository-grounded feasibility and contradiction audit.
3. Resolve any conflicts between this Constitution and frozen higher-order architecture.
4. Amend Gate D migration-manifest governance separately before introducing a new migration.
5. Design dormant, additive enrollment, ownership-provenance, and reconciliation-classification contracts only where repository evidence proves they are needed.
6. Implement Organization lifecycle authority and Membership authorization without using `managedByAgencyId` as fallback.
7. Keep all new behavior unreachable while the feature flag is off.
8. Independently review before merge.

---

# 19. RATIFICATION

This document becomes authoritative only when the founder explicitly states:

`RATIFY CREDITVECTOR IDENTITY CONSTITUTION V1.0`

Before ratification, Claude and Codex may review it adversarially but may not silently rewrite its founder decisions. Proposed amendments must identify:

- the exact clause
- repository evidence
- constitutional conflict or risk
- recommended replacement
- downstream migration and authorization impact

After ratification, any semantic change requires a versioned amendment or superseding Constitution. Implementation details may evolve without amendment only when they preserve every locked invariant.
