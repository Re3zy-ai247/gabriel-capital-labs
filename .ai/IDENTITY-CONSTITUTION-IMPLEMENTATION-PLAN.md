# Identity Constitution v1.0 — Implementation Delta and Roadmap

> **STATUS: RATIFIED SEMANTICS · IMPLEMENTATION PENDING**
>
> This is the canonical convergence plan for the [Identity Constitution v1.0 Ratification Edition](IDENTITY-CONSTITUTION.md), ratified by the Founder on 2026-07-26. It authorizes controlled implementation planning and staged repository work only. It does not authorize production access, Gate D, migration execution, feature activation, merge, deployment, or customer-visible release.

## 1. Evidence baseline

The implementation audit was performed against runtime and schema at branch source `0bffb52f21c19b639b309f2613ef7f0a5baf37b4`; `origin/main` was `e28bd684eaf27540465fcd2e71cafafc033f2b2e`. The branch delta before ratification integration was documentation-only. No production, database, encrypted environment value, or feature-flag service was accessed, so current production schema and deployed flag values remain **UNKNOWN**.

Verified reusable foundations:

- `lib/identity/state.ts:14-59` has the ratified Operator, Organization, and Membership state sets and legal transition maps.
- `lib/identity/flags.ts:3-8` fails closed unless `OPERATOR_IDENTITY_ENABLED` is exactly `true`.
- `lib/session.ts:15-63` exposes canonical-account resolution separately from effective-user/workspace resolution.
- `prisma/schema.prisma:693-747` contains dormant OperatorIdentity, Organization, and OrganizationMembership foundations.
- `lib/eventBus/**` provides deterministic append/replay transport primitives; domains retain evidence meaning.
- No runtime or migration automatically converts `managedByAgencyId` into OperatorIdentity or OrganizationMembership.

## 2. Ownership reconciliation

| Prior statement | Ratified disposition | Repository action | ADR disposition |
| --- | --- | --- | --- |
| `PLATFORM-OWNERSHIP-MAP.md` described `OrganizationMembership` as the direct successor to `managedByAgencyId`. | **INVALID.** Consumer-management owns `managedByAgencyId`; Membership owns OrganizationMembership. Neither projects, succeeds, or authorizes the other. | Map updated to explicit separate owners and read-only reconciliation. | No GIOS/freeze ADR: no owner moved. |
| `ARCHITECTURE-FREEZE-1.0.md` recommended a `managedByAgencyId → OrganizationMembership` reconciliation migration. | **INVALID.** Automatic conversion/backfill is forbidden. | Historical review artifact now carries a ratification supersession note and inline supersession markers. | No ADR: ratified domain Constitution is the valid semantic supersession mechanism. |
| `OPERATOR-IDENTITY.md` called the Constitution proposed and treated the live edge as current membership. | **INVALID.** Ratified semantics are authoritative; implementation remains pending. | Status, owners, reconciliation, and implementation gates updated. | No ADR for the documentation correction. |
| `Organization.ownerAccountId` is the current ownership projection; `OrgRole.OWNER` is derived and nonassignable. | **VALID.** Normal owner operations additionally require an active OperatorIdentity and active owner Membership. | Retain the projection; add atomic owner Membership, transfer, and evidence mechanics. | Replacing `ownerAccountId` with an Ownership table would require a versioned ADR; this plan does not replace it. |
| One physical `lib/identity/**` package owns all Identity implementation. | **VALID WITH SEMANTIC SUBDOMAINS.** Identity, Organizations, and Membership remain distinct owners of meaning while sharing the package. | Keep one package and one enforcement integration; do not extract or duplicate services. | Extraction or an L0-L3 ownership move would require a superseding ADR; neither is planned. |
| Raw `User.role.ADMIN` is platform-wide Identity authority. | **INVALID for new constitutional commands.** Platform Authority is separately classified, bounded, expiring/revocable, and evidenced. | Preserve unrelated compatibility behavior; remove raw ADMIN as authority for new Identity/Organization/Membership commands. | No ADR is required if implementation stays within Constitution §9, the existing owners, and the existing PEP contract. A new owner, extracted service, or frozen platform-contract change would require the applicable ADR. |
| The fixed six-directory Gate D manifest is sufficient for remediation. | **VALID only as the grandfathered baseline.** It cannot admit a seventh migration or the required FK replacement grammar. | Add a versioned post-baseline manifest/parser/runbook mechanism without weakening exact-set equality. | Owner-approved governance revision is required. An ADR is required only if the revision changes frozen platform governance rather than implementing Constitution §13.3. |

The counsel-ratified, owner-approved retention schedule is a policy dependency before general activation. It is not an ownership transfer and is not replaced by an ADR. Two later design choices have explicit ADR gates: replacing `ownerAccountId` (not planned) and selecting the append-only re-admission structure required by Constitution §7.6 before re-admission is implemented.

## 3. Exact implementation gaps

Repository line numbers below are the assessed source lines; future edits must refresh them.

| ID | Severity | File and current behavior | Constitutional violation | Required fix type | Migration impact | Activation risk |
| --- | --- | --- | --- | --- | --- | --- |
| ID-B01 | **BLOCKER** | `app/api/agency/clients/[id]/route.ts:8-25` writes `AgencyClientDeletion`, then calls `prisma.user.delete`. `prisma/schema.prisma:89-97` and `prisma/migrations/0_init/migration.sql:533` define `managedByAgencyId` with `ON DELETE CASCADE`. Audit and deletion are not atomic. | §§12.1-12.3, 12.6, 19.1: service termination is not Consumer erasure; deleting an agency cannot delete managed Consumers; evidence cannot claim a deletion before a fallible delete. | Consumer-management safety containment first; then an explicit relationship-termination command and separate subject-scoped erasure workflow. | Permanent FK remediation requires a new reviewed migration; never rewrite `0_init`. | Source-level path can destroy Consumer and case evidence. Exact current production deployment was not reverified. |
| ID-B02 | **BLOCKER** | `scripts/gate-d-preflight-core.ts:5-12,682-740,755-769` accepts exactly six directories and only its current SQL grammar; `scripts/gate-d-preflight.test.ts:364-389` rejects an extra directory. | §§13.1-13.5, 19.7: required remediation cannot land outside a versioned, exact, independently reviewed migration set. | Versioned post-baseline manifest plus safe parser/catalog/test/runbook extension; preserve the six-file baseline and exact equality. | Governance prerequisite to every new migration, including FK replacement. | No seventh migration can pass Gate D today. |
| ID-H01 | **HIGH** | `lib/identity/service.ts:55-80` allows global ADMIN transitions and direct self-deactivation; `lib/identity/principal.ts:27-35` equates ADMIN to raw product role. No sole-owner guard, confirmation, policy version, reason, or matching-command idempotency exists. | §§4, 6.4, 9, 15, 19.2, 19.3, 19.6. | Lifecycle command policy; voluntary exit defaults to SUSPENDED; atomic owner transfer/archive/recovery guard; bounded review/recovery authority; durable decision evidence. | Existing state enum is reusable; command/authority/evidence persistence is additive. | A sole owner can be deactivated and an Organization stranded. |
| ID-H02 | **HIGH** | `lib/identity/service.ts:84-100` and `repository.ts:65-77` create only an Organization from any gated account. They do not require ACTIVE OperatorIdentity or atomically create owner Membership and evidence. | §§5.3, 6.4, 7, 18, 19.4. | One domain transaction: eligibility check, Organization, `ownerAccountId`, active owner Membership, ownership/membership evidence. | Current Organization/Membership tables can hold projections; durable evidence may require additive storage. | An Organization can exist without its constitutional owner operating relation. |
| ID-H03 | **HIGH** | `lib/identity/service.ts:104-112` rejects only ARCHIVED, so SUSPENDED Organizations remain normally manageable. No suspend, reinstate, archive, or ownership-transfer command exists. | §§6.5-6.8, 8.4, 15.4. | State-aware authorization and legal lifecycle/transfer commands with explicit resolution authority and evidence. | State field is reusable; transfer/evidence history is additive. | Suspension fails to contain tenant operations; ownership cannot safely change. |
| ID-H04 | **HIGH** | `lib/identity/service.ts:114-170` and `repository.ts:94-142` create ACTIVE Membership immediately, accept PENDING/SUSPENDED targets, and expose no invitation/application/acceptance/approval or owner protection. `schema.prisma:733-747` has one row per org/operator and cannot represent a new re-admission episode after REMOVED. | §§5.2, 5.5, 7, 8, 19.5, 19.6. | Pre-membership objects/facts; active-identity eligibility; separate invitation/application, acceptance, approval, role-grant, suspend/reinstate/remove, and owner-protection commands. | Additive admission/evidence/episode persistence and revised uniqueness strategy. | Consentless or ineligible Membership/admin grants; owner Membership can be removed. |
| ID-H05 | **HIGH** | `lib/identity/service.ts:34-43,104-170` authorizes by owner projection or raw ADMIN. `lib/os/kernel/pep.ts:1-41` is default-deny but lacks Identity context and is not wired; `lib/identity/rbac.ts:3-39` is a map only. | §§8, 9, 15, 18, 19.3. | One Identity authorization adapter into the existing PEP: canonical account, active Operator, active Organization, active Membership, resource tenant, exact policy, scoped Platform Authority, feature/cohort gate, evidence. | Basic evaluation is code-only; durable authority issuance/expiry/revocation/evidence is additive unless the selected Constitution §9 implementation reuses an already durable signed-authority mechanism. | Raw ADMIN can bypass the constitutional authorization lattice. |
| ID-H06 | **HIGH** | `prisma/schema.prisma:693-747` and `prisma/migrations/20260721120000_operator_identity/migration.sql:89-98` cascade User→OperatorIdentity and Organization/OperatorIdentity→Membership. | §§4, 6, 7, 11.3, 12, 19.1, 19.7. | Make lifecycle/archive the ordinary path; preserve history; replace destructive constraints prospectively; keep governed erasure separate. | Reviewed FK replacement migration after Gate D extension. Historical migration remains byte-identical. | Applied dormant schema could lose owner/Membership history through unrelated deletion. |
| ID-H07 | **HIGH** | `lib/identity/service.ts:12-15,75-78` writes state before recording an event. `lib/identity/events.ts:25-82,100-158` lacks complete command, authority, reason, policy, consent, provenance, and lifecycle evidence. `prisma/schema.prisma:619-637` is a transport envelope, not an atomic domain decision record. | §§11, 18, 19.10. | Versioned domain-owned evidence envelope plus one transactional/outbox-equivalent mutation boundary; Event Fabric transports facts only. | Additive evidence/outbox storage if the existing transaction boundary cannot durably satisfy the envelope. | Partial writes and incomplete evidence prevent deterministic constitutional replay. |
| ID-H08 | **HIGH** | `app/api/event-bus/redact/route.ts:6-29` and `lib/eventBus/store.ts:129-136` redact one event only. `lib/outcomeConsent.ts:7-49`, `lib/outcomeLedger.ts:104-213`, and legacy stores enumerated at `scripts/schema-safety.test.ts:106-160` have no repository-wide subject erasure/retention orchestration. | §§12.3-12.5, 16, 19.8. | Inventory every identity-bearing store by owner, linkage, retention class, legal hold, erasure action, and receipt; implement subject-scoped transactional/resumable workflow. | Likely additive receipts/evidence plus targeted store/FK changes. | Indefinite retention, orphaned evidence, or incomplete subject erasure blocks activation. |
| ID-M01 | **MEDIUM** | `lib/identity/flags.ts:3-8` and `service.ts:34-39` expose one global boolean for every Identity write. | §§14.6-14.9, 19.9. | Retain master kill switch; add independently auditable enrollment/cohort, Organization-command, and Membership-command reachability gates. | None unless cohorts are persisted. | One flag would expose all dormant commands at once. |
| ID-M02 | **MEDIUM** | `lib/session.ts:15-63` correctly separates canonical account from effective user, but `lib/identity/principal.ts:3-35` accepts an injected principal and no route bridge proves canonical-account-only construction. | §§8.2, 15.1-15.3. | One mandatory server-side principal resolver from `currentAccount()`; reject managed/effective-user and impersonation-derived operator authority. | None. | Future route wiring could accidentally authorize on the Consumer workspace. |
| ID-M03 | **MEDIUM** | No §10 classifier exists. `schema.prisma:89-97,693-747` permits zero/many Organization candidates and a managed Consumer without OperatorIdentity. | §§10, 13.4, 23.1-23.2. | Read-only sealed-input classifier with stable ordering and the ratified outcome set; RECONCILED only for an independently valid Membership. | Persisted classification evidence is additive. | Shadow evaluation cannot begin; automatic mapping would create false identity. |
| ID-M04 | **MEDIUM** | `lib/identity/service.ts:175-180` distinguishes not-found from forbidden; no step-up boundary exists for recovery, deactivation, ownership, or authority actions. | §§15.10, 15.12. | Non-enumerating external errors plus explicit step-up policy and evidence for high-risk commands. | Error handling is code-only; step-up decision evidence may be additive. | Entity discovery and insufficient assurance on irreversible actions. |
| ID-L01 | **LOW** | `scripts/identity-runtime.test.ts:40,55,64,68-72` positively asserts current owner/global-ADMIN and direct-membership behavior; `identity-migration-guard.test.ts:42-56` assumes the grandfathered schema shape. | Tests currently preserve compatibility behavior that §§6-9 and 19 require to change. | Replace assertions stage-by-stage with constitutional command, denial, owner-protection, and migration-v2 invariants. | Test-only, alongside the applicable migration tests. | A correct remediation could appear as a regression, or old behavior could stay green. |

## 4. Risk assessment

| Risk | Level | Control |
| --- | --- | --- |
| Managed-client deletion or agency cascade destroys Consumer/case evidence. | **CRITICAL** | Slice 0 unconditional containment; permanent FK/service-termination remediation before any Organization/Membership command activation. |
| Gate D extension weakens exact migration-set verification. | **CRITICAL** | Version manifests; preserve exact equality per version; independently test governance logic and schema SQL; disposable PostgreSQL only until separately authorized. |
| Dormant Identity code becomes reachable before lifecycle, authority, and evidence are complete. | **HIGH** | Existing master flag remains fail-closed; add scoped gates; no HTTP route or cohort before Slice 8 readiness. |
| Raw ADMIN or managed-consumer state becomes Operator authority. | **HIGH** | Canonical-account-only principal, bounded Platform Authority, PEP integration, denial tests, no fallback. |
| Mutation succeeds without byte-identical evidence. | **HIGH** | One transaction or durable outbox-equivalent; command identity, policy, authority, reason, provenance, causation, and hashes in versioned evidence. |
| Erasure removes required evidence or retention keeps data indefinitely. | **HIGH** | Counsel-ratified retention schedule, legal-hold classification, subject-scoped receipts, per-domain owner actions, resumable failure states. |
| Current production state is inferred from repository source. | **HIGH** | Keep deployment/schema/flag claims UNKNOWN until separately authorized direct evidence; no production check in this integration. |
| Multiple semantic owners are accidentally created inside or beside `lib/identity/**`. | **MEDIUM** | Keep the ratified semantic owner split and one physical package; PEP and Event Fabric remain enforcement/transport seams, not domain owners. |

## 5. Deterministic implementation roadmap

The user-requested “Stage 0–8” work sequence is named **Implementation Slice 0–8** below. The word **Stage** is reserved for the Constitution §14 release-state machine.

| User-requested roadmap label | Unambiguous plan name |
| --- | --- |
| Stage 0 — Safety Fixes (pre-identity) | Implementation Slice 0 |
| Stage 1 — Operator Lifecycle | Implementation Slice 1 |
| Stage 2 — Enrollment System | Implementation Slice 2 |
| Stage 3 — Organization Fixes | Implementation Slice 3 |
| Stage 4 — Membership System | Implementation Slice 4 |
| Stage 5 — Authorization Rewrite | Implementation Slice 5 |
| Stage 6 — Evidence Layer | Implementation Slice 6 |
| Stage 7 — Migration + Gate D expansion | Implementation Slice 7 |
| Stage 8 — Activation Readiness | Implementation Slice 8 |

### Constitutional release-stage crosswalk

| Implementation work | Constitution §14 release stage | Meaning |
| --- | --- | --- |
| Ratification lock in this documentation change | **Stage 0 — Ratification** | Completed locally; no higher release state implied. |
| Implementation Slices 0-6 | **Stage 1 — Dormant implementation** | Safety containment plus dormant contracts/policy/tests; no Identity reachability. |
| Implementation Slice 7 | **Stage 2 — Migration and evidence readiness** | Gate D tooling/migration package is prepared and disposable-target validated; no production migration. |
| Implementation Slice 8 | **Stage 2 readiness closeout** | Produces an owner decision packet only. |
| Separately authorized release work | **Stage 3 — Gate D: production schema, feature off** | Not part of Slices 0-8; production preflight/migration remains owner-gated. |
| Separately authorized release work | **Stage 4 — Read-only shadow evaluation** | Not part of Slices 0-8; begins only after direct Stage 3 evidence. |
| Separately authorized release work | **Stage 5 — Gate F: controlled operator enrollment** | Not part of Slices 0-8; independently owner-authorized. |
| Separately authorized release work | **Stage 6 — Controlled Organization and Membership commands** | Not part of Slices 0-8; independently owner-authorized after enrollment evidence. |
| Separately authorized release work | **Stage 7 — General availability** | Not part of Slices 0-8; requires all constitutional release evidence. |

### Global execution constraints

1. Slice 0 containment is the only pre-schema runtime safety slice and must fail closed without inventing erasure behavior.
2. Slices 1-6 may land only dormant command contracts, pure policy, and tests that use existing schema. Any code that depends on new persistence stops at an interface until Slice 7 supplies the reviewed migration first.
3. Within Slice 7, each new schema dependency lands migration-first, followed by its repository/persistence adapter in the same small review sequence. No historical migration is edited.
4. All flags remain absent or false throughout Slices 0-7. Slice 8 produces an authorization packet; it does not enable them.
5. Gate D (production schema) and Gate F (controlled enrollment) remain separate owner actions under Constitution §14.

### Implementation Slice 0 — Safety Fixes (requested Stage 0)

- **Exact scope:** remove reachability of agency-initiated Consumer hard deletion; until the governed termination workflow exists, fail closed instead of deleting. Inventory all User/Operator/Organization/Membership delete paths, cascading constraints, identity-bearing legacy stores, and current audit ordering. Record the explicit ADR triggers for re-admission structure, owner-projection replacement, or service/owner extraction, plus the retention-policy dependency.
- **Files affected in implementation:** `app/api/agency/clients/[id]/route.ts`; `prisma/schema.prisma` and a new migration only in Slice 7; `scripts/schema-safety.test.ts`; focused managed-client termination guard; relevant runbook/ownership/current-state docs.
- **Migrations required:** **No** for immediate containment. **Yes**, deferred to Slice 7, for non-destructive FK and durable termination/erasure evidence.
- **Feature flags:** none; safety containment is unconditional. Do not use `OPERATOR_IDENTITY_ENABLED` to protect a live Consumer path.
- **Primary risks:** silently turning deletion into an unaudited detach; claiming production remediation without deployment evidence; breaking agency capacity accounting.
- **Required tests:** prove the denied DELETE path calls neither `prisma.user.delete` nor any KPI/evidence writer; wrong-agency denial remains fail-closed; Consumer/case rows remain untouched; agency-capacity regression; schema-safety guard. Successful-termination atomicity is tested only after the governed workflow exists in Slice 7.
- **Exit gate:** destructive route is fail-closed in repository source, permanent remediation design is reviewed, and no production claim is made.

### Implementation Slice 1 — Operator Lifecycle (requested Stage 1)

- **Exact scope:** implement command identities and legal transition policy; active eligibility; matching-command idempotent retry; self-service exit to SUSPENDED; separately confirmed terminal deactivation; sole-owner transfer/archive/recovery guard; no resurrection.
- **Files affected:** `lib/identity/state.ts`, `service.ts`, `repository.ts`, `principal.ts`, `errors.ts`, `scripts/identity-core.test.ts`, `scripts/identity-runtime.test.ts`.
- **Migrations required:** **No** for state/guard policy; **Yes in Slice 7** if existing durable primitives cannot satisfy command/authority/evidence requirements.
- **Feature flags:** existing `OPERATOR_IDENTITY_ENABLED` remains the master kill switch and stays off.
- **Primary risks:** time-of-check/time-of-use owner race; raw ADMIN fallback; replay of a different command as an idempotent no-op.
- **Required tests:** full transition matrix; illegal and terminal transitions; exact-command retry versus conflicting retry; concurrent sole-owner deactivation; self-exit suspension; canonical-account principal.
- **Exit gate:** pure lifecycle policy and dormant service deny every unratified path; no new route.

### Implementation Slice 2 — Enrollment System (requested Stage 2)

- **Exact scope:** explicit Operator enrollment intent, terms/consent and policy version, eligibility inputs, activation decision, command identity, withdrawal/rejection evidence; no Consumer auto-promotion. Define pre-membership invitation/application/acceptance/approval contracts without creating Membership yet.
- **Files affected:** `lib/identity/service.ts`, `repository.ts`, `events.ts`, `principal.ts`, `lib/eventBus/contracts.ts` as registry only, `prisma/schema.prisma`, identity tests.
- **Migrations required:** **Yes in Slice 7** for queryable enrollment/pre-membership state and append-only decision evidence.
- **Feature flags:** add `OPERATOR_IDENTITY_ENROLLMENT_ENABLED`, default false, subordinate to the master flag.
- **Primary risks:** consent conflation; self-approval; effective-user enrollment; irreversible activation without evidence.
- **Required tests:** authenticated-account-only enrollment; managed-consumer non-promotion; consent/policy hashing; invite/accept/approve separation; idempotency; deny malformed/expired/revoked intent.
- **Exit gate:** contracts and pure decision policy are complete; persistence remains unreachable until migration/evidence readiness.

### Implementation Slice 3 — Organization Fixes (requested Stage 3)

- **Exact scope:** require ACTIVE OperatorIdentity; atomically create Organization, `ownerAccountId`, active owner Membership, and evidence; implement suspend/reinstate/archive; deny normal operations while suspended; implement accepted ownership transfer while retaining `ownerAccountId` as sole current projection.
- **Files affected:** `lib/identity/service.ts`, `repository.ts`, `state.ts`, `rbac.ts`, `events.ts`, `prisma/schema.prisma`, Organization-focused identity tests.
- **Migrations required:** **Yes in Slice 7** for ownership/transfer evidence if not represented by the common evidence model; no Ownership-table replacement.
- **Feature flags:** add `OPERATOR_ORGANIZATION_COMMANDS_ENABLED`, default false, subordinate to master and enrollment eligibility.
- **Primary risks:** two ownership truths; partial creation; owner Membership removal; suspended-tenant bypass; transfer race.
- **Required tests:** transactional rollback at every write boundary; owner projection/membership invariant; derived nonassignable OWNER; suspended denials and bounded resolution; transfer acceptance/concurrency/history.
- **Exit gate:** dormant Organization commands satisfy invariants and have an atomic evidence design; flag remains off.

### Implementation Slice 4 — Membership System (requested Stage 4)

- **Exact scope:** invitation or application; acceptance; authorized approval; active-Operator eligibility; policy-versioned role grant; suspend/reinstate/remove; owner Membership protection; self-action restrictions. Before implementing re-admission, ratify the Constitution §7.6 ADR that selects a new Membership episode or other append-only structure; until then, re-admission fails closed.
- **Files affected:** `lib/identity/service.ts`, `repository.ts`, `state.ts`, `rbac.ts`, `events.ts`, `prisma/schema.prisma`, Membership-focused identity tests.
- **Migrations required:** **Yes in Slice 7** for pre-membership facts, the ratified episode structure, evidence, expiry/revocation, and uniqueness evolution.
- **Feature flags:** add `OPERATOR_MEMBERSHIP_COMMANDS_ENABLED`, default false, subordinate to master and Organization-command gate.
- **Primary risks:** self-invite/self-approval; stale acceptance; duplicate active episode; privilege escalation; removal of required owner Membership.
- **Required tests:** complete admission matrix; expiry/revocation; concurrent approval; one active episode; re-admission as new episode; role policy; owner protections; suspended Organization denial.
- **Exit gate:** no `addMember`-style immediate-active path remains in the dormant command surface.

### Implementation Slice 5 — Authorization Rewrite (requested Stage 5)

- **Exact scope:** connect Identity policy context to the existing default-deny PEP; require canonical account, active Operator, active Organization, active Membership, tenant/resource match, exact permission, policy version, scoped feature gate, and bounded Platform Authority where applicable. Remove raw ADMIN as authority for constitutional commands. Add step-up and non-enumerating external errors.
- **Files affected:** `lib/identity/principal.ts`, `service.ts`, `rbac.ts`, a single Identity-to-PEP adapter inside `lib/identity/**`, `lib/os/kernel/pep.ts` only if its generic input contract must be extended, `lib/session.ts` only if a canonical resolver seam is missing, authorization tests.
- **Migrations required:** **Yes in Slice 7** for durable Platform Authority issuance, expiry, revocation, separation-of-duty, and action evidence if the selected Constitution §9 implementation requires new persistence.
- **Feature flags:** master plus the exact enrollment/Organization/Membership gates; all false.
- **Primary risks:** parallel authorization engine; compatibility ADMIN bleed-through; cross-tenant access; actor approving own grant; stale/revoked authority.
- **Required tests:** every authority-matrix row and forbidden shortcut; inactive state combinations; tenant IDOR; grant scope/expiry/revocation; separation of duties; step-up; effective-user/impersonation rejection.
- **Exit gate:** one enforcement path, no raw role or managed relationship can satisfy a constitutional command.

### Implementation Slice 6 — Evidence Layer (requested Stage 6)

- **Exact scope:** domain-owned, versioned evidence envelope for every Identity/Organization/Membership/Platform Authority mutation; append-only command/decision history; atomic state+evidence or durable outbox-equivalent; provenance, command ID, correlation/causation, authority, policy, reason, consent, before/after hashes, effective time, and schema version. Define retention, legal hold, erasure/tombstone receipts, and reconciliation evidence.
- **Files affected:** `lib/identity/events.ts`, `service.ts`, `repository.ts`, `lib/eventBus/contracts.ts` and envelope/store integration without transferring meaning, `prisma/schema.prisma`, `lib/outcomeConsent.ts`, `lib/outcomeLedger.ts`, subject-erasure owner adapters, evidence/replay tests.
- **Migrations required:** **Yes in Slice 7** for evidence/outbox, authority, retention/erasure receipts, and any required store linkage.
- **Feature flags:** evidence recording is mandatory for a reachable command and cannot be skipped by a delivery flag; Event Fabric fanout may remain off.
- **Primary risks:** dual writes; mutable evidence; PII in event payloads; non-deterministic timestamps/order; erasure destroying required proof.
- **Required tests:** failure injection at every transaction boundary; append-only enforcement; payload PII guard; byte-identical replay; deterministic ordering; provenance completeness; redaction/tombstone/retention/legal-hold cases.
- **Exit gate:** every future mutation is impossible without durable evidence; Event Fabric still transports only.

### Implementation Slice 7 — Migration + Gate D expansion (requested Stage 7)

- **Exact scope:** version the Gate D post-baseline manifest and parser; preserve the six historical directories exactly; admit reviewed constraint replacement without broadly permitting destructive SQL; add the new migration set for Consumer FK safety, non-destructive Identity/Membership relations, enrollment/admission episodes, Platform Authority, evidence/outbox, and erasure/retention receipts. Complete persistence adapters only after each migration definition lands.
- **Files affected:** `scripts/gate-d-preflight-core.ts`, `gate-d-preflight-catalog.ts`, `gate-d-preflight.test.ts`, `gate-d-preflight.ts`, `identity-migration-guard.test.ts`, `schema-safety.test.ts`, `.ai/RUNBOOKS/gate-d-production-migration.md`, `prisma/schema.prisma`, new immutable `prisma/migrations/<timestamp>_*` directories, then the schema-dependent `lib/identity/**` adapters.
- **Migrations required:** **Yes.** New additive/prospective migrations only; explicit FK replacement is narrowly reviewed. Never edit the grandfathered six.
- **Feature flags:** every Identity and Event Fabric reachability flag remains false/absent.
- **Primary risks:** weakening exact-set verification; unsafe constraint order; lock duration; orphaned rows; rollback fiction; production-baseline assumptions.
- **Required tests:** existing Gate D fixture suite plus version-manifest and forbidden-SQL cases; disposable PostgreSQL from empty and grandfathered baseline; schema diff; FK delete behavior; failed/rolled-back history; deterministic second run; forward validation; documented rollback/containment posture; no production target. The governed service-termination command must preserve the Consumer/case graph, null or supersede only the managed relationship, and write evidence atomically or causally—failure writes neither state nor success evidence.
- **Exit gate:** hosted CI green on the exact source, independent governance/schema review complete, disposable PostgreSQL evidence complete, production state still unclaimed, and Gate D still unauthorized.

### Implementation Slice 8 — Activation Readiness (requested Stage 8)

- **Exact scope:** assemble a read-only readiness packet; verify Slice 0 containment, lifecycle/admission/ownership/authority/evidence invariants, scoped gates, migration/runbook evidence, retention policy, counsel/security/compliance gates, observability, rollback/containment, and release-state vocabulary. No activation occurs in this slice.
- **Files affected:** tests and canonical runbooks/current-state/owner checklist only unless readiness discovers a defect, which returns work to its owning implementation slice.
- **Migrations required:** **No new migration by default**; any discovered schema need returns to Slice 7.
- **Feature flags:** verify the Identity master, enrollment, Organization, and Membership gates are absent/false by authorized environment evidence. Verify `EVENT_BUS_ENABLED` only if it is a direct reachability dependency of the selected evidence transport. Do not broaden this gate to Reputation, Network, Arena, or other unrelated surfaces, and do not change any value.
- **Primary risks:** treating CI as production proof; coupling Gate D to Gate F; enabling one global flag; skipping counsel/retention/owner approval.
- **Required tests:** full typecheck/build/lint as applicable; all Identity/Event/Gate D/schema-safety guards; hosted required checks; authorized production read-only preflight only when separately approved; no mutation probes.
- **Exit gate:** a separately reviewable owner decision packet for Constitution Stage 3 (Gate D). Shadow evaluation (Stage 4), Gate F (Stage 5), Organization/Membership commands (Stage 6), and general availability (Stage 7) remain independent later authorizations.

## 6. First executable slice

The next executable implementation slice is **Implementation Slice 0: immediate containment of `app/api/agency/clients/[id]/route.ts`**, with a focused regression guard proving that the denied operation calls neither `prisma.user.delete` nor a success KPI/evidence writer. It is owned by Consumer-management, not Identity. It requires the normal five-review feature gate because it changes live-source behavior, but it requires no schema, migration, production access, feature flag, or Gate D execution.

Work must stop after that slice for review before Gate D governance or Identity runtime work begins.
