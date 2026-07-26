> **STATUS: RATIFIED**
>
> Ratified by the Founder on 2026-07-26 through the exact declaration `RATIFY CREDITVECTOR IDENTITY CONSTITUTION V1.0`.
> This Ratification Edition is authoritative domain law. It authorizes controlled implementation under its staged gates; it does not itself authorize production access, Gate D, migration execution, feature activation, merge, deployment, or customer-visible release.
>
> Incorporated source SHA-256: `1cac8e43a003d81ef254a0b16e35d5f0c041581f15ca24e90deda2afd991a816`.

# CREDITVECTOR IDENTITY CONSTITUTION
## Version 1.0 — Ratification Edition

**Project:** CreditVector by Gabriel Capital Labs
**Constitutional owner:** Founder, subject to the CreditVector Platform Constitution
**Document class:** Domain constitution
**Status before founder declaration:** Ratification-ready; not yet authoritative
**Ratification command:** `RATIFY CREDITVECTOR IDENTITY CONSTITUTION V1.0`
**Effective scope:** Authentication-account boundaries, consumer workspaces, operator identity, operator lifecycle, organizations, organization ownership, organization membership, managed-consumer relationships, platform authority, enrollment, authorization, reconciliation, historical evidence, erasure, retention, migration readiness, and staged activation
**Edition date:** 2026-07-26

---

# PREAMBLE

CreditVector requires a durable distinction between a person receiving credit-related services and a professional actor operating the platform. The repository already contains parts of that distinction, but prior roadmap language incorrectly suggested that a managed-consumer relationship could be converted into organization membership. Independent Codex and Claude reviews demonstrated that the two relationships involve different subjects, different consent, different authority, and different legal and operational consequences.

This Constitution resolves that ambiguity.

Its purpose is not to preserve every existing implementation choice. Its purpose is to define the meaning that implementation must preserve before Operator Identity becomes reachable. Existing code, schema, migrations, and production behavior remain evidence of present state. They do not silently acquire constitutional authority, and they must not be rewritten destructively merely to make the repository resemble this document.

This Constitution therefore distinguishes:

1. **normative authority** — what the system is required to mean;
2. **implementation evidence** — what the repository currently does;
3. **production evidence** — what is directly proven to exist or occur in production;
4. **migration obligations** — how present state may safely converge on constitutional state.

No clause in this document authorizes production access, Gate D execution, migration deployment, feature activation, or customer-visible release.

---

# 0. CONSTITUTIONAL POSITION

## 0.1 Normative authority

Within CreditVector, normative authority is ordered as follows:

1. applicable law, binding legal obligations, and counsel-ratified compliance policy;
2. the CreditVector Platform Constitution and its valid amendment mechanism;
3. the frozen Ownership Map, interpreted through ratified constitutional clarifications;
4. this Identity Constitution once ratified;
5. ratified ADRs, security policies, privacy policies, retention schedules, and domain contracts;
6. versioned command, event, projection, and API contracts.

A lower normative layer may refine a higher layer but may not contradict it.

## 0.2 Evidentiary truth

Evidence of current state is ordered separately:

1. directly observed and authenticated production evidence;
2. repository schema, migrations, runtime, tests, and deployment configuration;
3. generated artifacts and projections;
4. reports, prompts, summaries, screenshots, and human recollection.

Production evidence outranks repository assumptions about what is deployed. Repository evidence outranks documentation claims about what is implemented.

Evidentiary truth does **not** automatically outrank normative authority. When current implementation conflicts with this Constitution, the implementation is classified as a compatibility condition, defect, activation blocker, or migration obligation. The conflict does not silently rewrite the Constitution.

## 0.3 Conflict protocol

When normative authority and implementation evidence conflict:

1. no new activation may rely on the conflicting behavior;
2. current production behavior must not be destroyed or rewritten without an approved migration and operational plan;
3. the conflict must be recorded with owner, severity, evidence, and remediation gate;
4. ambiguous authorization fails closed;
5. any semantic amendment requires a versioned constitutional change;
6. implementation may proceed only after the relevant owner approves the convergence plan.

## 0.4 Relationship to existing architecture

This Constitution preserves the frozen semantic owners:

- Authentication owns credentials and authentication assurance.
- Identity owns OperatorIdentity and operator lifecycle.
- Organizations owns organization identity, organization lifecycle, and constitutional ownership.
- Membership owns organization participation, membership lifecycle, and organization-scoped role authority.
- Event Fabric transports facts only.
- Reputation owns XP truth.
- Arena owns presentation only.
- Kai owns intelligence.
- Marketplace owns commerce.
- Billing owns money.
- Knowledge Graph owns semantic graph.
- Performance Intelligence owns SOP/KPI intelligence.

For Version 1.0, Identity, Organizations, and Membership may remain physically implemented inside the existing bounded package, including `lib/identity/**`. Physical package placement does not merge semantic ownership and does not authorize duplicate owners. No package extraction is required by this Constitution.

## 0.5 Current evidence baseline

The review that produced this edition established, subject to re-verification before implementation:

- `managedByAgencyId` currently represents a managed-consumer relationship, not operator membership;
- `OperatorIdentity` is linked uniquely to an authentication account;
- Organization ownership is currently represented by `Organization.ownerAccountId`;
- `OrgRole.OWNER` is derived and is not an assignable Membership role;
- Organization and Membership state machines exist;
- OperatorIdentity has its own state machine and terminal `DEACTIVATED` state;
- dormant Identity code is structurally unreachable from public routes and also protected by a fail-closed feature flag;
- Gate D currently accepts a fixed migration-directory set;
- existing migration history contains cascade behavior that must be treated prospectively and remediated before activation rather than rewritten retroactively;
- production migration state remains unproven without owner-authorized direct evidence.

These are implementation facts, not permanent semantic laws unless expressly ratified below.

---

# 1. FOUNDATIONAL LAWS

The following laws are locked upon ratification:

1. **An Authentication Account is not an OperatorIdentity.** Authentication proves a credentialed principal; Identity proves a professional platform identity.
2. **A Consumer is not an Operator.** A Consumer may remain consumer-only indefinitely and receives no operator authority implicitly.
3. **A managed-consumer relationship is not OrganizationMembership.** `managedByAgencyId` may never satisfy operator-membership or organization-authorization requirements.
4. **Consumer-to-operator enrollment is explicit.** No read path, migration, flag change, billing event, agency relationship, or UI action may auto-promote a Consumer into an Operator.
5. **One Authentication Account may have at most one canonical OperatorIdentity.** This Constitution does not claim one identity per biological human and does not solve cross-account person deduplication.
6. **One account may hold both Consumer and Operator personas.** Their data, consent, authority, and lifecycle remain separated.
7. **Organization ownership is not Membership.** Ownership is a singular Organizations-owned fact; Membership is participation and scoped authority.
8. **`OWNER` is derived, not assigned.** An ordinary role mutation may not create or transfer constitutional ownership.
9. **OrganizationMembership requires explicit evidence.** Invitation, application, consent, approval, role policy, and identity eligibility must be satisfied under the applicable command.
10. **Roles are not credentials.** Authentication owns credentials; roles and ownership contribute authorization facts only after authentication succeeds.
11. **Authorization fails closed.** Missing, ambiguous, conflicting, suspended, archived, removed, unratified, or stale state grants no authority.
12. **Tenant boundaries are explicit.** Cross-organization access is denied by default.
13. **Platform Authority is a distinct authority class.** It is not silently equivalent to the ordinary product role `User.role === "ADMIN"`.
14. **Event Fabric transports only.** Domain owners determine meaning, transition validity, and authority.
15. **Feature flags control reachability, not truth.** Enabling a flag creates no identity, membership, ownership, migration, backfill, or reconciliation result by itself.
16. **State transitions are deterministic and policy-versioned.** Sealed inputs and the same policy version must produce the same canonical result.
17. **Historical evidence is prospective and append-only.** New constitutional mutations must retain durable evidence; present-state rows may remain projections.
18. **Hard deletion is never an implicit side effect of relationship termination.** Consumer-service termination, account closure, erasure, and organization lifecycle are distinct commands.
19. **No active or suspended Organization may be ownerless.** Owner transfer, owner eligibility, and owner Membership are protected invariants.
20. **Repository and production truth are never fabricated.** Unknown production state remains unknown until directly evidenced.

---

# 2. CANONICAL DEFINITIONS

## 2.1 Authentication Account

An Authentication Account is the credential-bearing principal owned by Authentication.

Authentication owns:

- credentials;
- sessions;
- multifactor and step-up authentication;
- device and session assurance;
- credential recovery;
- authentication revocation.

An Authentication Account does not by itself prove:

- Consumer status;
- OperatorIdentity;
- OrganizationMembership;
- Organization ownership;
- organization role;
- professional standing;
- consumer-management consent;
- platform authority.

## 2.2 Consumer Workspace

A Consumer Workspace is the consumer/client-facing identity and case workspace used for credit-related services.

A Consumer Workspace:

- may exist without OperatorIdentity;
- may remain consumer-only forever;
- may be passwordless under the existing consumer product contract;
- does not grant professional or administrative authority;
- is not an Organization;
- is not OrganizationMembership;
- retains consumer-specific consent, case, dispute, document, response, score, and outcome history according to applicable policy;
- may be managed by an agency only through scoped, revocable, policy-bound delegation.

An agency never owns the Consumer’s identity. Agency management is a service relationship, not ownership of the person, account, or case truth.

## 2.3 OperatorIdentity

OperatorIdentity is the durable professional identity attached to one Authentication Account.

Rules:

- one Authentication Account may have at most one canonical OperatorIdentity;
- OperatorIdentity persists across organization changes;
- an Operator may belong to zero, one, or multiple Organizations;
- organization-specific role, title, authority, and tenure belong to Membership;
- an Organization may suspend or remove its Membership but may not thereby suspend the global OperatorIdentity;
- nonhuman services and automation principals are not OperatorIdentities;
- professional profile projections may draw from OperatorIdentity and authorized domain facts but are not canonical ownership or membership truth.

Cross-account linking, merger, and proof that two accounts represent the same human are outside Version 1.0 and require a later identity-linking constitution.

## 2.4 Organization

An Organization is a durable legal or operational entity represented inside CreditVector.

Rules:

- `AGENCY` is one Organization kind, not a synonym for Organization;
- an Organization has a stable identifier, kind, lifecycle, tenant boundary, policy context, and current owner;
- Organization deletion is not a normal lifecycle operation;
- `ARCHIVED` is the terminal operational state in Version 1.0;
- historical facts survive lifecycle change subject to privacy and retention policy.

## 2.5 Constitutional Organization Ownership

Constitutional Ownership is the singular Organizations-owned fact identifying the current owner of an Organization.

For Version 1.0:

- the current canonical projection is `Organization.ownerAccountId`;
- the owner subject is an Authentication Account;
- ownership is distinct from OrganizationMembership;
- `OrgRole.OWNER` is derived from ownership and is never assigned through Membership role mutation;
- the current owner must resolve to an eligible OperatorIdentity and an active owner Membership before exercising normal owner operations after activation;
- prior owners, transfer authority, acceptance, reason, and policy version must be retained as append-only evidence even if current ownership remains a mutable projection;
- an explicit ownership-history or ownership-provenance structure may be added additively without changing the singular current-owner invariant.

This Constitution does not require immediate replacement of `ownerAccountId`. Any later replacement requires a versioned ADR and additive migration.

## 2.6 OrganizationMembership

OrganizationMembership is the canonical relationship proving that an OperatorIdentity participates in one Organization under a role, lifecycle state, and policy context.

Membership proves:

- participation in the Organization;
- organization-scoped authority under a policy version;
- lifecycle state;
- role provenance;
- organization-scoped tenure.

Membership does not, by itself, prove:

- legal employment;
- contractor status;
- ownership or equity;
- consumer-management consent;
- authentication assurance;
- platform-wide authority;
- professional licensing outside separately verified evidence.

## 2.7 ManagedConsumerRelationship

The meaning currently represented by `managedByAgencyId` is a ManagedConsumerRelationship.

It proves only that a Consumer Workspace is managed through the existing agency-client capability under its consumer-service authorization rules.

It does not prove:

- OperatorIdentity;
- OrganizationMembership;
- Organization ownership;
- employment;
- professional role;
- operator consent;
- organization consent to admit the Consumer as an Operator.

For Version 1.0, one Consumer may have at most one active managing agency relationship at a time unless a later multi-agency collaboration constitution is ratified. Historical relationships may be preserved over time.

`managedByAgencyId` may remain compatibility and authorization truth for the existing managed-consumer capability. It is permanently forbidden as a fallback for operator or organization authorization.

## 2.8 Pre-membership Evidence

The following are not Membership:

- invitation;
- application;
- enrollment request;
- acceptance;
- organization approval;
- suggested affiliation;
- legacy relationship classification.

They are pre-membership evidence objects or facts. Membership exists only after the constitutionally required command completes.

## 2.9 Platform Authority

Platform Authority is a separately governed authority class for narrowly scoped platform security, compliance, identity, recovery, or emergency actions.

Platform Authority is not established merely by:

- `User.role === "ADMIN"`;
- Organization ownership;
- OrganizationMembership;
- a database credential;
- infrastructure access;
- a developer account.

A valid Platform Authority action requires:

1. an authenticated acting principal;
2. an explicit authority class and scope;
3. a permitted reason class;
4. a versioned policy;
5. a durable command or event identifier;
6. actor, subject, reason, and policy evidence;
7. non-self-authored review or post-action review where the action class requires it;
8. no ability for the acting principal to rewrite the audit record.

Existing `User.role.ADMIN` paths remain compatibility behavior. They do not automatically satisfy new constitutional commands. Before activation, every Platform Authority action used by Identity, Organizations, or Membership must be explicitly mapped, bounded, tested, and evidenced.

---

# 3. PERSONA SEPARATION

One Authentication Account may hold both:

- a Consumer Workspace; and
- an OperatorIdentity.

The personas share an account boundary but do not share authority by default.

Rules:

1. Consumer facts may never authorize an operator action.
2. Operator status may never grant access to the person’s Consumer case except through a separately valid consumer-service relationship.
3. Consumer records do not automatically populate the public Operator Profile.
4. Managed-consumer status does not select an Organization or Membership.
5. The same account may be a Consumer of one agency and an Operator in another Organization.
6. Persona selection must be explicit in product context and server-side authorization context.
7. Deactivation, suspension, erasure, or relationship termination affecting one persona does not silently rewrite the other persona’s history.
8. No agent or service may use the shared account identifier as proof that Consumer consent and Operator consent are interchangeable.

---

# 4. OPERATOR LIFECYCLE CONSTITUTION

The OperatorIdentity state machine is constitutional and load-bearing.

## 4.1 States

Version 1.0 retains the existing states:

- `PENDING`
- `ACTIVE`
- `SUSPENDED`
- `DEACTIVATED`

## 4.2 Legal transitions

The only legal transitions are:

- `PENDING -> ACTIVE`
- `PENDING -> DEACTIVATED`
- `ACTIVE -> SUSPENDED`
- `ACTIVE -> DEACTIVATED`
- `SUSPENDED -> ACTIVE`
- `SUSPENDED -> DEACTIVATED`
- `DEACTIVATED` is terminal

All other transitions fail closed.

A duplicate request for the already-current state is an idempotent no-op only when the command identifier, subject, policy version, and material inputs match the original accepted command.

## 4.3 Enrollment result

Successful Operator Enrollment creates or retrieves one canonical OperatorIdentity in `PENDING` unless a ratified eligibility policy explicitly permits same-command activation.

Automatic activation is permitted only when:

- a named, versioned eligibility policy exists;
- every required input is server-validated;
- no discretionary judgment is required;
- the decision is deterministic and replayable;
- the resulting evidence identifies the policy version and inputs.

All other activation requires a bounded Platform Identity Review authority. An unbounded global `ADMIN` role is not sufficient.

## 4.4 ACTIVE

`ACTIVE` means the OperatorIdentity is globally eligible to participate in operator capabilities, subject to Organization, Membership, resource, policy, feature, and authentication gates.

`ACTIVE` does not itself grant membership, organization access, platform authority, or consumer access.

## 4.5 SUSPENDED

`SUSPENDED` is reversible and denies normal operator actions globally.

Suspension may result from:

- self-service operator disablement;
- security review;
- compliance review;
- policy-defined temporary ineligibility;
- bounded Platform Authority.

Self-service departure from active operator use must default to `SUSPENDED`, not `DEACTIVATED`, unless the user completes a separately confirmed irreversible deactivation process.

Suspension evidence must record actor, reason, authority class, policy version, effective time, and review or resolution requirements.

## 4.6 DEACTIVATED

`DEACTIVATED` is terminal in Version 1.0.

Because one Authentication Account may have only one OperatorIdentity, deactivation is a permanent account-level bar from becoming an Operator again under Version 1.0. It must never be presented as a routine reversible preference.

Deactivation requires:

- explicit irreversible-action disclosure;
- separately confirmed intent when user-initiated;
- actor, reason, authority, and policy evidence;
- confirmation that no ownership invariant would be violated;
- denial of automatic re-admission.

Platform-imposed deactivation requires bounded Platform Identity/Security Authority and the required review process for the reason class.

Re-admission after `DEACTIVATED` is prohibited in Version 1.0. A future re-admission mechanism requires a ratified amendment defining whether the terminal state, account uniqueness, or identity-linking model changes.

## 4.7 Owner protection

An OperatorIdentity linked to the sole current owner of an `ACTIVE` or `SUSPENDED` Organization may not be deactivated until one of the following succeeds atomically:

- ownership transfer to an eligible accepting owner;
- Organization archival under an authorized process;
- a separately ratified emergency custodial action.

Suspension of that OperatorIdentity may occur only when the resulting Organization control and resolution path is explicitly handled. The system must not create an inaccessible active tenant by suspending or deactivating its sole owner without a recovery authority.

## 4.8 Identity mutation boundaries

An Organization may suspend or remove its Membership. It may not suspend or deactivate the global OperatorIdentity.

A Consumer relationship, billing event, XP event, Arena event, or Marketplace event may not mutate OperatorIdentity lifecycle.

---

# 5. OPERATOR ENROLLMENT CONSTITUTION

## 5.1 Mandatory enrollment conditions

Operator Enrollment requires:

1. a valid authenticated principal;
2. explicit intent to establish a professional OperatorIdentity;
3. acceptance of applicable operator terms, privacy disclosures, and professional policies;
4. completion of required identity and profile inputs;
5. consent that is distinct from consumer-service consent;
6. deterministic server-authoritative validation;
7. an idempotent creation or retrieval command;
8. creation in `PENDING` unless a ratified automatic-activation policy applies.

No read path may lazy-create OperatorIdentity.

## 5.2 Existing Organization enrollment

Joining an existing Organization requires:

1. an Organization-issued invitation or Organization-approved application;
2. an explicitly identified Organization;
3. an explicitly identified proposed role or capability policy;
4. explicit acceptance by the Operator;
5. approval by an authorized Organization actor;
6. an eligible OperatorIdentity;
7. durable evidence of invitation/application, acceptance, approval, policy version, and command identity.

A pending invitation, application, or acceptance grants no Organization authority.

## 5.3 Organization creation

Creating an Organization requires an `ACTIVE` OperatorIdentity.

The following must succeed atomically or fail as a unit:

- Organization creation;
- establishment of `ownerAccountId` for the creating account;
- creation of the owner’s active OrganizationMembership;
- creation of ownership and membership evidence.

No `ACTIVE` Organization may be created ownerless or without an operational owner Membership.

The current dormant implementation is noncompliant if it can create an Organization without OperatorIdentity, owner Membership, or transactionality. That is an activation blocker, not authority to weaken this clause.

## 5.4 Relationship to managed consumers

A ManagedConsumerRelationship may be used only as a non-authoritative suggestion during enrollment when it maps unambiguously to one Agency Organization.

It may prefill a candidate Organization. It may not:

- create OperatorIdentity;
- activate OperatorIdentity;
- create Membership;
- infer a role;
- confer ownership;
- bypass consumer consent;
- bypass Organization approval;
- bypass Platform Identity Review.

## 5.5 Consent and self-registration

Membership may not be minted by an administrator without the Operator’s consent, except for a separately ratified nonhuman/service-principal system that is outside OperatorIdentity.

An operator may not self-register into an Organization without Organization approval.

Invitation, acceptance, and approval must be distinct facts even when a single atomic command records them together under an authorized workflow.

---

# 6. ORGANIZATION CONSTITUTION

## 6.1 States

Version 1.0 retains:

- `ACTIVE`
- `SUSPENDED`
- `ARCHIVED`

## 6.2 Legal transitions

- `ACTIVE -> SUSPENDED`
- `ACTIVE -> ARCHIVED`
- `SUSPENDED -> ACTIVE`
- `SUSPENDED -> ARCHIVED`
- `ARCHIVED` is terminal

All other transitions fail closed.

## 6.3 Creation authority

An `ACTIVE` OperatorIdentity may create an Organization when the applicable product policy permits it. Creation does not rely on Consumer status, `managedByAgencyId`, billing status alone, or `User.role.ADMIN` alone.

## 6.4 Ownership invariant

Every `ACTIVE` or `SUSPENDED` Organization must have exactly one current owner account.

The owner account must have:

- an `ACTIVE` OperatorIdentity for normal owner operations;
- an `ACTIVE` owner Membership in that Organization;
- no conflicting terminal or removed state.

`OrgRole.OWNER` is derived from the owner fact and is not assignable. `ADMIN` never implies ownership.

## 6.5 Suspension

Organization suspension affects authorization through Organization state. It does **not** mass-mutate Membership rows.

When an Organization is `SUSPENDED`:

- normal state-changing business operations fail closed;
- memberships retain their own prior states;
- narrowly scoped owner, compliance, billing-resolution, support, export, or recovery actions may remain available only under explicit policy;
- Platform Authority access remains limited to its independent scope.

Reacting the Organization to `ACTIVE` restores eligibility based on each Membership’s actual state. It does not guess or reconstruct prior Membership state.

## 6.6 Reactivation

Reactivation must be performed by:

- the same authority class that imposed the suspension; or
- a higher, separately ratified Platform Authority class.

Resolution evidence and the suspension reason must be preserved.

## 6.7 Archival

Archival may be authorized by:

- the current owner under policy; or
- bounded Platform Authority.

`ARCHIVED` is terminal in Version 1.0.

Archival:

- stops normal operations;
- permits no new Memberships;
- permits no new consumer-management assignments;
- preserves ownership, Membership, event, and evidence history;
- does not automatically erase consumer or operator data;
- permits read-only access only where retention, privacy, legal, and security policy allow it.

## 6.8 Ownership transfer

Ownership transfer requires:

1. an `ACTIVE` Organization;
2. a valid current owner;
3. an `ACTIVE` target OperatorIdentity;
4. an `ACTIVE` target Membership or atomic creation of the required Membership;
5. initiation by the current owner or bounded Platform Authority;
6. explicit acceptance by the target owner, except under a separately ratified emergency-custody process;
7. atomic replacement of the current owner projection and protection of the target owner Membership;
8. append-only evidence of prior owner, new owner, initiator, acceptor, reason, policy version, and command identity.

A Membership role change may not transfer ownership.

## 6.9 Current implementation compatibility

`Organization.ownerAccountId` remains the current owner projection in Version 1.0. A future explicit Ownership table is optional, not required, provided append-only transfer evidence and all ownership invariants can be satisfied.

---

# 7. MEMBERSHIP CONSTITUTION

## 7.1 States

Version 1.0 retains:

- `ACTIVE`
- `SUSPENDED`
- `REMOVED`

## 7.2 Creation

Membership is created in `ACTIVE` only after the applicable invitation/application/enrollment workflow completes.

`PENDING` is not a Membership state. Pending intent belongs to pre-membership evidence.

## 7.3 Legal transitions

- `ACTIVE -> SUSPENDED`
- `ACTIVE -> REMOVED`
- `SUSPENDED -> ACTIVE`
- `SUSPENDED -> REMOVED`
- `REMOVED` is terminal for the current Membership record

All other transitions fail closed.

## 7.4 Authority

- the owner may manage non-owner Memberships under a versioned policy;
- an administrator may manage only the roles and Memberships within their delegated grant boundary;
- an Operator may resign from their own non-owner Membership, resulting in `REMOVED`;
- bounded Platform Authority may suspend or remove Membership under an applicable reason class;
- no Organization actor may mutate global OperatorIdentity lifecycle merely because they control Membership.

## 7.5 Owner Membership protection

The current owner’s required Membership may not be suspended or removed until ownership is transferred, the Organization is archived, or a ratified emergency-custody process assumes control.

An Organization must not become ownerless or operationally owner-inaccessible through a Membership command.

## 7.6 Re-admission

`REMOVED` is terminal for the current record. Reactivating the same record is prohibited.

Future re-admission requires a new Membership episode or another append-only structure defined by a ratified ADR. The current uniqueness constraint may require additive schema evolution before re-admission is supported.

Legacy reconciliation may never bypass this rule.

## 7.7 Role changes

Role changes require:

- an actor with delegated grant authority;
- explicit target role;
- versioned policy validation;
- idempotent command identity;
- append-only actor, prior-role, resulting-role, reason, and policy evidence.

A role change:

- does not transfer ownership;
- does not change credentials;
- does not change OperatorIdentity;
- does not change XP;
- may not self-elevate the actor beyond their grant authority.

## 7.8 Self-membership protections

No actor may:

- add themselves to an Organization without an authorized invitation/application workflow;
- approve their own Membership when independent Organization approval is required;
- remove another Operator without the necessary role grant;
- use a global product role as a substitute for Membership evidence.

---

# 8. AUTHORIZATION CONSTITUTION

## 8.1 Organization-scoped action gates

Every organization-scoped operator action must pass all applicable gates:

1. the Authentication principal is valid;
2. the exact account context is established through the canonical server-side account resolver;
3. OperatorIdentity exists;
4. OperatorIdentity state is `ACTIVE`;
5. the requested Organization matches the resource tenant;
6. Organization state is `ACTIVE`, unless a narrowly scoped suspension-resolution policy applies;
7. OrganizationMembership is `ACTIVE`;
8. constitutional ownership is resolved separately when owner authority is required;
9. role/capability policy authorizes the exact action;
10. feature, cohort, resource-state, and policy-version gates permit execution;
11. the command remains within the actor’s grant boundary.

Failure or ambiguity at any gate produces denial.

## 8.2 Principal resolution

The canonical operator principal must be resolved from the current authenticated account context, not from consumer impersonation context or managed-consumer relationships.

The current implementation’s use of the canonical account resolver is ratified as the required direction. Any alternate helper that resolves a Consumer impersonation context may not be substituted without a security review and constitutional amendment.

## 8.3 Forbidden shortcuts

The following may never independently authorize an operator action:

- `managedByAgencyId`;
- raw Organization foreign key;
- raw Membership foreign key;
- billing contact status;
- Consumer ownership or client status;
- `User.role.ADMIN` without a valid Platform Authority policy for the action;
- a UI-visible button;
- event receipt alone;
- possession of a database or infrastructure credential.

## 8.4 Suspended Organizations

A suspended Organization is denied normal operational actions even when the OperatorIdentity and Membership remain active.

Any exception must name:

- the exact action;
- the authority class;
- the reason class;
- the resource scope;
- the evidence requirement.

## 8.5 Event Fabric

Event Fabric may transport authorization facts and outcomes. It may not:

- decide Membership meaning;
- infer ownership;
- activate OperatorIdentity;
- resolve consumer-to-operator conversion;
- bypass a domain command.

---

# 9. PLATFORM AUTHORITY CONSTITUTION

## 9.1 Authority classes

Platform Authority must be separated into bounded classes such as:

- Platform Identity Review;
- Platform Security;
- Platform Compliance;
- Platform Recovery;
- Platform Data-Subject Operations;
- Platform Migration Owner.

The exact implementation may use policy grants, internal roles, or signed authority facts. One undifferentiated global admin actor is prohibited for new constitutional actions.

## 9.2 Minimum authority fact

A Platform Authority fact must identify:

- actor account;
- authority class;
- action scope;
- subject or resource scope;
- permitted reason classes;
- policy version;
- issuance and expiry where applicable;
- issuing authority;
- revocation status.

## 9.3 Action evidence

Every Platform Authority action must record:

- actor;
- authority class and grant identifier;
- subject;
- action;
- reason;
- policy version;
- command identifier;
- effective time;
- result;
- review requirement;
- correlation and causation identifiers where supported.

An actor may not rewrite or erase their own authority-action evidence.

## 9.4 Emergency authority

Emergency authority must be:

- explicit;
- narrowly scoped;
- time-bounded where possible;
- independently reviewable;
- incapable of silently becoming ordinary product authority.

Emergency authority may not be inferred from `User.role.ADMIN` alone.

## 9.5 Current `ADMIN` compatibility

Current code may use `User.role === "ADMIN"`. Before activation, every such Identity, Organization, or Membership path must be classified as:

- ordinary product administration;
- Organization-scoped administration;
- Platform Authority;
- prohibited legacy shortcut.

No new constitutional command may rely solely on the compatibility role.

---

# 10. MANAGED-CONSUMER RECONCILIATION CONSTITUTION

The frozen roadmap phrase describing `managedByAgencyId -> OrganizationMembership` is ratified only as a **superseded semantic interpretation**:

> Existing managed-consumer evidence may be reconciled with explicit operator enrollment and Membership facts, but it may not be automatically converted into Membership.

This clarification preserves owner boundaries and rejects automatic promotion or backfill.

## 10.1 Classification outcomes

A reconciliation evaluation may produce:

- `NOT_APPLICABLE` — no OperatorIdentity, no enrollment intent, or no relevant legacy relation;
- `CANDIDATE` — exactly one Agency Organization may be suggested, but consent or approval is incomplete;
- `RECONCILED` — an independently created valid Membership exists and is consistent with the legacy relation;
- `AMBIGUOUS` — zero or multiple candidates, identity mismatch, or insufficient evidence;
- `CONFLICT` — existing Membership, Organization, or account facts contradict the legacy relation;
- `SUPERSEDED` — the legacy relationship is no longer current or has been replaced.

Only `RECONCILED` recognizes an already-valid Membership. No classification creates one.

## 10.2 Default behavior

Reconciliation is read-only classification by default.

Mutation may occur only through normal enrollment, invitation, approval, Membership, and ownership commands.

## 10.3 Evidence

Persisted reconciliation evidence must include:

- source identifier;
- safe reference to the legacy relationship;
- candidate Organization identifiers in stable order;
- linked OperatorIdentity, if any;
- classification;
- policy version;
- evidence digest;
- idempotency key;
- classifier or decision authority;
- effective time supplied as a sealed input;
- supersession reference where applicable;
- correlation and causation identifiers where supported.

## 10.4 Replay

The same sealed inputs and policy version must produce the same classification and byte-identical canonical evidence representation.

Retries may not create duplicate decisions, Memberships, invitations, or divergent candidate ordering.

## 10.5 Prohibitions

Reconciliation may not infer:

- OperatorIdentity;
- role;
- consent;
- Organization ownership;
- employment;
- professional status;
- Membership authority.

It may not mutate data while the relevant scoped feature gate is off.

---

# 11. HISTORICAL TRUTH AND EVIDENCE

## 11.1 Prospective append-only rule

Upon ratification, every new Identity, Organization, Ownership, Membership, enrollment, reconciliation, Platform Authority, erasure, or retention mutation must produce durable evidence.

Current-state tables may remain mutable projections. The evidence chain may not be silently rewritten to make history resemble current state.

## 11.2 Minimum evidence envelope

Where supported by repository contracts, evidence must include:

- stable command or event identifier;
- subject identifier;
- prior and resulting state;
- actor principal;
- authority source;
- reason code;
- policy version;
- idempotency key;
- correlation and causation identifiers;
- effective time supplied as a sealed input;
- provenance or evidence reference;
- supersession reference when revised.

## 11.3 Grandfathered current state

Existing rows, schema relationships, and migration artifacts are historical implementation evidence. They are not retroactively invalidated or rewritten by ratification.

However:

- new code may not extend destructive patterns;
- activation may not proceed through known destructive identity cascades;
- current-state mutability must be wrapped with evidence for new constitutional commands;
- defects must be remediated through additive, reviewable convergence.

## 11.4 Events

Identity events that currently contain only actor identifiers and mutable reason fields are insufficient for new constitutional actions if they omit authority source, reason class, prior state, policy version, or tamper-resistant provenance.

Existing events remain compatibility facts. New actions must use a versioned evidence contract.

---

# 12. ERASURE, RETENTION, AND SERVICE TERMINATION

## 12.1 Separate commands

The following are constitutionally distinct:

1. **Managed-service termination** — ends an agency’s delegated management relationship with a Consumer;
2. **Consumer account closure** — disables or closes the Consumer account under product policy;
3. **Operator suspension or deactivation** — changes OperatorIdentity lifecycle;
4. **Organization archival** — ends normal Organization operation;
5. **Data-subject erasure** — executes a privacy/legal workflow over eligible data;
6. **Evidence retention** — preserves data required by law, security, audit, dispute, fraud, contractual, or policy obligations.

No one command may masquerade as another.

## 12.2 Managed-service termination

Ending agency management must:

- revoke agency-scoped access;
- remove or supersede the active `managedByAgencyId` relationship;
- preserve the Consumer account and Consumer-owned case truth;
- preserve an evidence receipt of who ended the relationship, why, and under what authority;
- never delete the Consumer User record as a side effect.

## 12.3 Data-subject erasure

Erasure is a named, subject-scoped, server-authoritative command. It is never a foreign-key cascade and never an incidental consequence of deleting another principal.

An erasure workflow must:

1. authenticate and authorize the requester or legal authority;
2. identify the exact data subject;
3. check legal hold, dispute, fraud, security, financial, regulatory, and contractual retention obligations;
4. classify each data category as delete, redact, pseudonymize, tombstone, retain, or deny;
5. execute transactionally or through a resumable evidence-controlled workflow;
6. record counts, digests, policy version, actor, authority, reason, and completion status;
7. avoid orphaned consumer data or dangling foreign keys;
8. produce a user-safe outcome without exposing restricted retention details.

## 12.4 Retention schedule

Exact retention durations are not fixed by this Constitution. Before activation, a counsel-ratified and owner-approved **Identity and Consumer Data Retention Schedule** must define minimum and maximum periods by data category and jurisdiction.

Until that schedule exists:

- no implementation may promise immediate total deletion;
- no implementation may retain identity-bearing data indefinitely by default without a stated purpose;
- erasure requests fail closed into a reviewed pending state rather than guessing.

## 12.5 Evidence and outcome stores

Any runtime table, raw SQL-created store, or ledger that holds Consumer data must have:

- a declared domain owner;
- schema visibility;
- subject linkage or approved pseudonymous linkage;
- retention classification;
- erasure behavior;
- legal-hold behavior;
- foreign-key or integrity policy;
- migration ownership.

Stores such as consent, verified outcome, or decision evidence may not remain outside the governed retention model before activation if they contain identity-bearing or Consumer data.

## 12.6 Critical data-safety hold

The following are mandatory pre-activation remediations and are independent of whether this Constitution is ratified:

1. no agency-client route may hard-delete a Consumer account merely because the agency manages that Consumer;
2. `managedByAgencyId` may not use a cascade that causes deletion of managed Consumers when an agency principal is deleted;
3. agency termination must first revoke or null/supersede the managed relationship under evidence;
4. foreign-key behavior must be changed prospectively to a non-destructive policy, such as `RESTRICT` with an explicit relationship-termination command;
5. Consumer erasure must become a subject-scoped, transactional or resumable, evidenced workflow;
6. audit/KPI evidence must be written in the same successful transaction or through a causally linked durable workflow, never before a deletion that may fail.

No Gate D authorization for Identity activation should be granted until these risks have a reviewed remediation plan and the release sequence proves they cannot destroy Consumer evidence or cross-tenant Operator/Membership data.

---

# 13. MIGRATION CONSTITUTION

## 13.1 Migration-first

Any constitutional implementation requiring schema change begins with:

- an additive migration design;
- schema-safety review;
- owner and domain ownership review;
- deterministic local/disposable validation;
- Gate D manifest eligibility;
- no production mutation.

## 13.2 Grandfathered Gate D baseline chain

The six migration directories already accepted by the ratified Gate D baseline are grandfathered as historical artifacts **as written**.

Ratification does not rewrite approved migration files or declare the entire chain invalid retroactively.

Known non-constitutional effects in that baseline, including destructive cascades, become prospective remediation obligations. They must be neutralized by later additive migration or command behavior before the affected capability is activated.

## 13.3 Future migration-chain extension

Gate D currently enforces exact migration-directory equality. Before a seventh migration or any later migration can land, the Gate D owner must approve a versioned extension mechanism or manifest revision.

Logical governance review and schema review must remain separately evidenced. If current CI makes separate commits mechanically impossible, one atomic PR may include:

- the owner-approved manifest revision or extension mechanism;
- the migration;
- an explicit governance section;
- an explicit schema section;
- independent review evidence for each concern.

No agent may weaken set equality merely to make CI pass.

## 13.4 No automatic conversion

No migration may automatically convert `managedByAgencyId` into:

- OperatorIdentity;
- OrganizationMembership;
- ownership;
- role;
- consent;
- professional standing.

## 13.5 Additive convergence

Future schema may add:

- enrollment and invitation evidence;
- ownership transfer evidence;
- reconciliation evidence;
- immutable history or evidence envelopes;
- Platform Authority grants;
- erasure and retention receipts;
- re-admission episodes;
- safe replacement foreign keys;
- scoped activation/cohort data.

Changes must preserve compatibility, record ambiguity rather than guess, and avoid destructive backfill.

## 13.6 Production baseline reconciliation

Production migration state remains unknown until owner-authorized Gate D evidence exists.

If direct preflight proves that production contains a legacy baseline without corresponding Prisma migration history, the approved Gate D runbook must explicitly reconcile that baseline, including any required `migrate resolve` step, before `migrate deploy`. This Constitution does not authorize that action.

## 13.7 Backfill

Any future backfill requires a separate owner-authorized operation with:

- deterministic input snapshot;
- dry-run mode;
- counts and digests;
- stable ordering;
- no-op detection;
- idempotency;
- conflict and ambiguity output;
- resumability;
- audit evidence;
- kill switch;
- no automatic Membership creation.

---

# 14. ACTIVATION CONSTITUTION

## 14.1 Stage 0 — Ratification

Required:

- this Constitution ratified;
- amendments reflected in repository documentation;
- critical owner decisions closed or converted into explicit activation prerequisites;
- no runtime activation.

## 14.2 Stage 1 — Dormant implementation

Required:

- additive domain and schema work reviewed;
- public routes remain absent or unreachable;
- master feature flag remains off;
- tests prove dormant behavior;
- no background mutation;
- no production migration.

## 14.3 Stage 2 — Migration and evidence readiness

Required:

- Gate D extension governance approved if a new migration is required;
- evidence contracts, lifecycle contracts, erasure plan, and retention dependency reviewed;
- data-safety cascade remediation included in the release plan;
- scoped feature-gate design complete.

## 14.4 Stage 3 — Gate D: production schema, feature off

**Gate D corresponds to Stage 3.**

Required:

- explicit owner authorization;
- direct connection and backup gates satisfied;
- baseline reconciliation and migration deployment executed under the runbook;
- production verification completed;
- all Identity and scoped capability flags remain off.

## 14.5 Stage 4 — Read-only shadow evaluation

Required:

- reconciliation and eligibility classification only;
- no OperatorIdentity, Organization, Membership, ownership, or invitation creation;
- deterministic counts and digests;
- ambiguity and conflict reviewed;
- no customer-visible behavior.

## 14.6 Stage 5 — Gate F: controlled operator enrollment

**Gate F corresponds to Stage 5.**

Required:

- explicit owner authorization;
- a named cohort or allowlist;
- a distinct enrollment-scoped gate;
- `PENDING` creation and activation policy verified;
- rollback and kill switch verified;
- support, security, and observability ready;
- no automatic legacy conversion.

A single global boolean is insufficient to separate Stage 5 from Stage 6.

## 14.7 Stage 6 — Controlled Organization and Membership commands

Required:

- separate scoped gates or policy-controlled reachability for Organization and Membership commands;
- atomic Organization creation fixed and verified;
- invitation, acceptance, and approval evidence implemented;
- owner protection implemented;
- Platform Authority bounded;
- suspended-Organization authorization fixed;
- no unsafe Consumer deletion or cascade remains reachable.

## 14.8 Stage 7 — General availability

Required:

- explicit owner authorization;
- production evidence;
- security and privacy acceptance;
- counsel-ratified retention schedule where applicable;
- operational support and incident response readiness;
- all activation findings resolved or explicitly accepted by the proper owner.

## 14.9 Gate semantics

Feature gates:

- control command reachability;
- do not create data;
- do not run migrations;
- do not execute backfills;
- do not resolve legacy relationships;
- fail closed when missing or malformed.

Exact environment-variable names are implementation details. The semantic separation between master kill switch, enrollment, Organization commands, Membership commands, and cohort policy is constitutional.

---

# 15. SECURITY CONSTITUTION

1. Canonical account resolution for operator actions must not consume Consumer impersonation state.
2. Consumer facts may never authorize Operator actions.
3. `managedByAgencyId` may never authorize Organization or Membership actions.
4. Suspended Organizations deny normal operations even when Membership is active.
5. `PENDING`, `SUSPENDED`, and `DEACTIVATED` OperatorIdentities deny normal operator actions.
6. `SUSPENDED` and `REMOVED` Memberships deny normal Organization authority.
7. Cross-Organization access is denied by default.
8. Raw foreign keys do not constitute complete authorization.
9. Invitations and enrollment tokens must be single-purpose, expiring, revocable, and non-authoritative until accepted.
10. Ownership and role changes require step-up authentication when Authentication supports it; until then, the missing step-up capability is an explicit activation risk, not a silent no-op.
11. No credentials, secrets, sensitive Consumer data, or provider identity may be placed in domain events.
12. Error responses may not reveal unrelated accounts, Consumers, Operators, Memberships, or Organizations.
13. Platform Authority must be explicit, scoped, logged, and reviewable.
14. No actor may approve their own authority grant or rewrite their own authority-action evidence.
15. Repositories and services must enforce tenant boundaries, not rely on UI filtering.
16. The current global `ADMIN` role must be decomposed by action before activation; existing broad behavior is not ratified as future authority architecture.

---

# 16. PRIVACY CONSTITUTION

1. Consumer and Operator personas remain separated by default.
2. Consumer case data may not populate public Operator Profile fields without explicit, purpose-specific consent.
3. Operator Profile data may not expose Consumer status or case details by implication.
4. Agency management is delegated access, not ownership of Consumer identity.
5. Consumer relationship termination may not delete the Consumer account or case evidence.
6. Erasure and retention are policy-driven commands, not cascades.
7. Privacy disclosure must distinguish:
   - Consumer service processing;
   - Operator professional processing;
   - Organization administration;
   - public profile publication;
   - security and audit retention.
8. The shared Authentication Account may not be used to collapse consent across personas.
9. Public and organization-visible profile projections must honor privacy controls and policy scope.
10. Pseudonymized retained evidence must not be casually re-identifiable through ordinary product paths.
11. Legal hold or mandatory retention must be purpose-limited and inaccessible to ordinary Organization actors.
12. Every identity-bearing data store must have an owner, retention class, erasure behavior, and evidence contract.

---

# 17. DOMAIN BOUNDARIES

## 17.1 Authentication owns

- credentials;
- sessions;
- multifactor and step-up authentication;
- authentication assurance;
- credential recovery and revocation.

Authentication does not own OperatorIdentity, Organization, Membership, ownership, Consumer-management consent, or XP.

## 17.2 Identity owns

- OperatorIdentity;
- account-to-OperatorIdentity link;
- Operator lifecycle;
- operator enrollment eligibility;
- global operator suspension and deactivation;
- operator identity projections.

Identity does not own credentials, Organization lifecycle, Membership role meaning, Organization ownership, XP, billing, or Consumer-management consent.

## 17.3 Organizations owns

- Organization identity and kind;
- Organization lifecycle;
- current constitutional owner projection;
- ownership transfer;
- organization-level invariants.

Organizations does not own OperatorIdentity, credentials, Membership lifecycle, XP, or Billing money.

## 17.4 Membership owns

- OperatorIdentity-to-Organization participation;
- Membership lifecycle;
- Organization-scoped role and capability facts;
- invitation, application, acceptance, and approval semantics when implemented in this bounded context.

Membership does not own Organization identity, constitutional ownership, global OperatorIdentity, credentials, XP, or billing.

## 17.5 Consumer-management capability owns

- managed Consumer relationship meaning;
- agency-scoped Consumer-service authorization;
- service-relationship termination;
- Consumer-facing case access rules.

It does not own OperatorIdentity, OrganizationMembership, Organization ownership, or operator authority.

## 17.6 Platform Authority governance owns

- authority-class definitions;
- authority grants;
- reason classes;
- review requirements;
- emergency scope.

It does not absorb domain meaning. The domain still validates whether the requested action is legal.

## 17.7 Event Fabric owns

- fact transport only.

It does not own lifecycle, authority, consent, reconciliation, erasure, or retention meaning.

---

# 18. AUTHORITY MATRIX

| Action | Semantic owner | Authorized actor or authority | Required subject state | Forbidden shortcut |
|---|---|---|---|---|
| Authenticate account | Authentication | Credentialed principal / Auth policy | Valid account/session | Membership role |
| Create OperatorIdentity enrollment | Identity | Authenticated account | No existing OperatorIdentity | `managedByAgencyId` |
| Activate `PENDING` OperatorIdentity | Identity | Versioned eligibility policy or Platform Identity Review | `PENDING` | Raw `ADMIN` role alone |
| Suspend OperatorIdentity | Identity | Self-service or bounded Identity/Security authority | `ACTIVE` | Organization admin |
| Deactivate OperatorIdentity | Identity | Separately confirmed subject or bounded Platform Authority | `PENDING`, `ACTIVE`, or `SUSPENDED`; owner invariant clear | Routine preference toggle |
| Create Organization | Organizations | `ACTIVE` OperatorIdentity under policy | Owner account and membership created atomically | Consumer status |
| Own Organization | Organizations | Explicit `ownerAccountId` relation | Eligible owner account; active operator and membership for normal operations | `ADMIN` Membership role |
| Transfer ownership | Organizations | Current owner + accepting target, or emergency authority | `ACTIVE` Organization | Role change |
| Suspend/reactivate/archive Organization | Organizations | Owner or bounded Platform Authority by reason class | Legal transition | Raw Membership FK |
| Invite/apply | Membership pre-enrollment | Authorized Organization actor / applicant | Eligible Organization and applicant | Immediate Membership |
| Create Membership | Membership | Accepted invitation/application plus approval | `ACTIVE` OperatorIdentity and eligible Organization | Legacy agency relationship |
| Suspend/remove Membership | Membership | Owner/admin within grant, self-resignation, or bounded authority | Legal transition | Global identity mutation |
| Assign role | Membership | Actor with delegated grant authority | `ACTIVE` Membership | Self-elevation |
| Manage Consumer Workspace | Consumer-management capability | Scoped delegated agency authority | Valid Consumer relationship | OrganizationMembership alone |
| End managed service | Consumer-management capability | Consumer, agency actor under contract, or bounded support authority | Active managed relationship | Delete Consumer account |
| Execute erasure | Data-subject operations under owning domains | Verified subject or bounded legal/privacy authority | Retention and hold checks complete | FK cascade |
| Transport facts | Event Fabric | Domain emitters/subscribers | Valid contract | Business-rule ownership |

---

# 19. REQUIRED PRE-ACTIVATION REMEDIATIONS

Ratification does not mean implementation is ready. The following are mandatory before the relevant activation stage:

## 19.1 Critical — Consumer deletion and cascade safety

- remove or neutralize destructive `managedByAgencyId` cascade behavior through an additive migration and explicit relationship-termination workflow;
- replace agency-client hard-delete behavior with a subject-scoped service-termination or erasure command;
- ensure Consumer documents, reports, trade lines, letters, bureau responses, score history, encrypted identifiers, and other case evidence cannot be destroyed by agency relationship termination;
- make KPI/audit evidence transactional or causally durable.

## 19.2 High — Operator lifecycle implementation

- enforce the exact Operator transition table;
- make self-service disablement `SUSPENDED` by default;
- protect terminal `DEACTIVATED` with confirmation and authority evidence;
- prevent sole-owner deactivation without transfer or archival.

## 19.3 High — Platform Authority

- classify every current `User.role.ADMIN` Identity/Organization/Membership path;
- create bounded authority checks for new commands;
- prevent broad cross-tenant authority from remaining implicit.

## 19.4 High — Atomic Organization creation

- require active OperatorIdentity;
- create Organization, owner projection, owner Membership, and evidence atomically;
- prohibit ownerless active Organizations.

## 19.5 High — Membership consent and enrollment evidence

- add invitation/application/acceptance/approval evidence or an equivalent ratified contract;
- prohibit `addMember`-style immediate active Membership without the applicable consent workflow;
- prevent self-registration and self-approval.

## 19.6 High — Owner protections

- protect owner Membership;
- protect owner OperatorIdentity lifecycle;
- ensure transfer and acceptance are atomic and evidenced.

## 19.7 High — Gate D extension and migration safety

- establish the approved migration-set extension process;
- include prospective FK/cascade remediation;
- preserve the grandfathered baseline chain;
- keep production mutation owner-gated.

## 19.8 High — Erasure and retention

- ratify the Identity and Consumer Data Retention Schedule;
- govern all identity-bearing stores;
- implement subject-scoped erasure receipts and legal-hold behavior;
- eliminate orphaned or unowned Consumer data stores.

## 19.9 Medium — Scoped activation gates

- preserve the master kill switch;
- add semantically separate enrollment and Organization/Membership reachability controls or equivalent policy gates;
- define exact activation cohort and rollback.

## 19.10 Medium — Event evidence

- version Identity/Organization/Membership evidence envelopes;
- include authority source, reason class, prior state, policy version, and immutable provenance;
- prevent actor-controlled audit rewriting.

---

# 20. CURRENT IMPLEMENTATION CLASSIFICATION

The dormant implementation may contain behavior that differs from this Constitution. Such differences are classified as follows:

- **Compatible:** already preserves the clause.
- **Dormant defect:** unreachable while flags and routes remain off; must be fixed before the corresponding activation stage.
- **Migration obligation:** schema must converge additively before activation.
- **Governance obligation:** owner policy or constitutional mechanism must be established.
- **Critical safety defect:** must be remediated independently of feature activation because it affects live Consumer data or cross-tenant integrity.

Dormancy permits safe deferral. It does not ratify false statements, unsafe cascades, or unbounded authority.

---

# 21. NON-GOALS

This Constitution does not:

- authorize Gate D;
- authorize production access;
- authorize migration execution or resolution;
- enable any feature flag;
- activate Operator Identity;
- create routes or customer-visible UI;
- define employment or contractor legal status;
- define all future Organization roles;
- define cross-account human identity linking;
- define multi-agency Consumer collaboration;
- define Billing entitlements;
- define XP, Reputation, or Arena behavior;
- define Marketplace commerce;
- replace the current managed-consumer capability;
- permit automatic Consumer-to-Operator conversion;
- permit automatic Membership backfill;
- promise a specific legal retention period without counsel-ratified policy.

---

# 22. RATIFIED FOUNDER DECISIONS

Upon ratification, the following decisions are locked:

1. A Consumer is not an Operator.
2. A Consumer may remain consumer-only forever.
3. `managedByAgencyId` is a managed-consumer relationship, not OrganizationMembership.
4. The frozen roadmap phrase is interpreted as evidence reconciliation plus explicit enrollment, never automatic conversion.
5. Consumer-to-Operator enrollment requires explicit intent and distinct consent.
6. One Authentication Account may have at most one canonical OperatorIdentity.
7. One account may hold both Consumer and Operator personas, which remain authorization-separated.
8. OperatorIdentity uses `PENDING`, `ACTIVE`, `SUSPENDED`, and terminal `DEACTIVATED` states with the transition table in this Constitution.
9. Routine self-service disablement uses reversible `SUSPENDED`; `DEACTIVATED` is irreversible in Version 1.0.
10. An Operator may belong to multiple Organizations.
11. `AGENCY` is one Organization kind.
12. Organization ownership is distinct from Membership.
13. `Organization.ownerAccountId` remains the Version 1.0 current-owner projection.
14. `OWNER` is derived and non-assignable; `ADMIN` does not imply ownership.
15. Every active or suspended Organization has exactly one current owner.
16. Normal owner operations require an active OperatorIdentity and active owner Membership.
17. Organization creation, owner establishment, and owner Membership are atomic.
18. Organization suspension changes authorization, not all Membership rows.
19. Membership requires invitation/application, consent, approval, and durable evidence under policy.
20. Membership uses `ACTIVE`, `SUSPENDED`, and terminal `REMOVED` states.
21. Owner Membership and owner OperatorIdentity are protected against ownerless-tenant outcomes.
22. Platform Authority is a distinct, bounded, evidenced authority class and is not raw `User.role.ADMIN`.
23. Legacy reconciliation is read-only classification by default.
24. No automatic OperatorIdentity, Membership, role, ownership, or consent inference is permitted.
25. New constitutional mutations preserve append-only evidence prospectively.
26. Existing migrations are grandfathered as historical artifacts; known unsafe effects must be remediated additively before activation.
27. Managed-service termination may never hard-delete the Consumer account.
28. Erasure is a subject-scoped evidenced command, never an FK cascade.
29. Exact retention durations require a separate counsel-ratified schedule before general activation.
30. Gate D corresponds to production-schema Stage 3; Gate F corresponds to controlled-enrollment Stage 5.
31. A single global feature flag is insufficient to separate controlled enrollment from Organization/Membership activation.
32. Event Fabric transports only.
33. Production state remains unknown without direct owner-authorized evidence.
34. No implementation may proceed by weakening invariants merely to pass tests.

---

# 23. IMPLEMENTATION CONSEQUENCES

## 23.1 Invalid prior plan

The following plan is rejected:

`managedByAgencyId -> OrganizationMembership` automatic migration, backfill, or conversion.

## 23.2 Valid replacement sequence

1. Ratify this Constitution.
2. Commit the Ratification Edition and supersede the Founder Draft.
3. Record the pre-activation remediation plan, beginning with Consumer deletion/cascade safety.
4. Establish the Gate D migration-chain extension mechanism or owner-approved manifest revision process.
5. Implement Operator lifecycle and bounded Platform Authority contracts while dormant.
6. Implement atomic Organization creation and owner protection while dormant.
7. Implement pre-membership evidence, consent, approval, and Membership commands while dormant.
8. Implement read-only reconciliation classification; do not convert legacy relationships.
9. Add prospective evidence, erasure, and retention contracts.
10. Add scoped activation/cohort gates while preserving the master kill switch.
11. Independently review implementation with Codex and Claude.
12. Merge only through the constitutional repository ruleset.
13. Keep Gate D, production migration, Gate F, and activation separately owner-authorized.

---

# 24. AMENDMENT AND SUPERSESSION

After ratification:

- semantic changes require a versioned amendment or superseding Constitution;
- implementation details may evolve without amendment only when every locked invariant remains preserved;
- emergency deviations require explicit owner authorization, bounded duration, evidence, and a scheduled constitutional review;
- no prompt, agent report, code comment, migration, or runtime shortcut may silently amend this document;
- a proposed amendment must identify:
  - exact clause;
  - repository and production evidence;
  - normative conflict or risk;
  - replacement language;
  - domain owner;
  - migration impact;
  - authorization impact;
  - backward-compatibility impact;
  - activation impact.

The Founder Draft and its audit remain historical review evidence. Upon ratification, this Ratification Edition supersedes their semantic authority.

---

# 25. RATIFICATION

This document becomes authoritative only when the Founder explicitly states:

`RATIFY CREDITVECTOR IDENTITY CONSTITUTION V1.0`

Ratification means:

- the semantic decisions in Section 22 are approved;
- the pre-activation remediations in Section 19 become mandatory gates;
- Codex, Claude, and future engineers must implement against this document;
- no production access, migration, deployment, Gate D execution, Gate F execution, or feature activation is authorized merely by ratification.

Until the exact declaration is made, this document remains ratification-ready but not authoritative.

---

# APPENDIX A — REVIEW RECONCILIATION

This edition incorporates the strongest surviving findings from the independent Codex audit and Claude Opus 5 adversarial review.

## A.1 Incorporated Codex findings

- account-level, not unverifiable human-level, OperatorIdentity uniqueness;
- current `ownerAccountId` ownership projection and derived `OWNER` role;
- Gate D fixed migration-set governance;
- current mutable and cascading schema as implementation evidence;
- consumer/operator separation and prohibition on legacy fallback;
- physical `lib/identity/**` boundary without semantic owner collapse.

## A.2 Incorporated Claude findings

- explicit Operator lifecycle and transition table;
- irreversible `DEACTIVATED` semantics and reversible self-service `SUSPENDED` default;
- owner OperatorIdentity lifecycle protection;
- bounded Platform Authority distinct from raw `ADMIN`;
- grandfathering of the six-migration Gate D baseline;
- prospective rather than retroactive append-only rules;
- erasure and retention constitution;
- critical managed-consumer cascade and hard-delete remediation;
- atomic Organization creation;
- invitation/acceptance/approval evidence;
- Organization suspension affecting authorization rather than Membership state;
- Gate D and Gate F stage crosswalk;
- scoped activation gates;
- distinction between normative authority, implementation evidence, and production evidence.

## A.3 Founder decisions resolved in this edition

- Operator Enrollment creates `PENDING` unless a versioned deterministic policy permits same-command activation.
- Routine self-service operator exit uses `SUSPENDED`.
- `DEACTIVATED` remains terminal and re-admission is prohibited in Version 1.0.
- Exact retention periods are delegated to a separate counsel-ratified schedule and block general activation until completed.

---

# APPENDIX B — TRANSITION TABLES

## B.1 OperatorIdentity

| Current | Allowed target | Notes |
|---|---|---|
| `PENDING` | `ACTIVE` | Eligibility policy or bounded review |
| `PENDING` | `DEACTIVATED` | Terminal rejection/withdrawal under evidence |
| `ACTIVE` | `SUSPENDED` | Reversible |
| `ACTIVE` | `DEACTIVATED` | Terminal; owner invariant must be clear |
| `SUSPENDED` | `ACTIVE` | Resolution evidence required |
| `SUSPENDED` | `DEACTIVATED` | Terminal; owner invariant must be clear |
| `DEACTIVATED` | none | Terminal in Version 1.0 |

## B.2 Organization

| Current | Allowed target | Notes |
|---|---|---|
| `ACTIVE` | `SUSPENDED` | Authorization becomes restricted |
| `ACTIVE` | `ARCHIVED` | Terminal operational closure |
| `SUSPENDED` | `ACTIVE` | Same/higher authority class resolves |
| `SUSPENDED` | `ARCHIVED` | Terminal operational closure |
| `ARCHIVED` | none | Terminal in Version 1.0 |

## B.3 OrganizationMembership

| Current | Allowed target | Notes |
|---|---|---|
| `ACTIVE` | `SUSPENDED` | Organization-scoped authority denied |
| `ACTIVE` | `REMOVED` | Terminal record |
| `SUSPENDED` | `ACTIVE` | Resolution evidence required |
| `SUSPENDED` | `REMOVED` | Terminal record |
| `REMOVED` | none | New episode required for future re-admission |

---

# APPENDIX C — RELEASE-STATE VOCABULARY

To prevent repository truth from being confused with production truth:

- **L0 — Local:** unpushed local work;
- **L1 — Branch:** pushed feature branch;
- **L2 — PR Verified:** hosted checks green on exact source HEAD;
- **L3 — Merged:** protected merge into `main`;
- **L4 — Deployed:** direct evidence that the merged artifact reached production infrastructure;
- **L5 — Schema Applied:** direct evidence that the intended production migration completed;
- **L6 — Feature Reachable:** feature or cohort gate enabled;
- **L7 — Customer Visible:** customer-facing behavior verified.

No lower level implies a higher level.
