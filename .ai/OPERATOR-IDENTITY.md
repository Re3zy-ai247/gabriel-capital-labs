# Operator Identity — bounded context (consolidating index + future service package)

Status: **index of EXISTING truth + PROPOSED future service.** The *principle* **identity precedes reputation** is RATIFIED (founder-approved 2026-07-20 via [`ADR-0037`](ADR/ADR-0037-operator-growth-constitution.md) OG-3); the future Operator Identity Service architecture + all policy/schema remain PROPOSED (owner-gated). No code/schema/flag change from this document. Ratification does NOT imply implementation or legal approval.
Authority: subordinate to [`GIOS-PLATFORM.md`](GIOS-PLATFORM.md) (ownership registry — one owner per thing) and [`CREDITVECTOR-OS.md`](CREDITVECTOR-OS.md) (apex). This file **cites, never redefines** the code and docs that already own each rule (ADR-0034 Law 26). If this file and the cited code disagree, the code wins.

Cites: [`lib/session.ts`](../lib/session.ts) · [`lib/auth.ts`](../lib/auth.ts) · [`lib/entitlements.ts`](../lib/entitlements.ts) · `prisma/schema.prisma` (model `User`, enum `UserRole`) · [`lib/network/authz.ts`](../lib/network/authz.ts) (36/36) · [`AGENCY-COMMAND.md`](AGENCY-COMMAND.md) §role model · [`ADR-0035`](ADR/ADR-0035-platform-event-bus.md) §2 (identity triple) · [`COUNSEL-REVIEW-operator-network.md`](COUNSEL-REVIEW-operator-network.md) §1/§6/§8.

---

## 1. Why this document

Identity, roles, agency membership, workspace, handle, and presence rules are **correct but scattered** across session resolution, auth, entitlements, the Operator Network authz matrix, and the agency role model. There is no single map. This is that map — a **consolidating index** so a new engineer (or a future Operator Identity Service) inherits one coherent picture without re-deriving it from six files. It changes nothing; it points precisely.

## 2. Canonical identity rules TODAY (VERIFIED — cited, not redefined)

These are load-bearing invariants already enforced in code. **Do not restate them elsewhere; link here, which links to source.**

1. **Principal = `currentAccount().id`, never `currentUser().id`.** `currentAccount()` ([`lib/session.ts`](../lib/session.ts)) is the real signed-in payer; it re-checks `disabled` on **every** call (a suspension takes effect immediately, since every gate resolves through it). `currentUser()` is the **effective data subject** — the same person, except an agency with a client open, or an admin impersonating, resolves to that other user. **Actions/authorship/billing use the account (principal); data operations use the effective user.** (Sprint 7/8 both bind identity to `currentAccount()`.)
2. **Agency is a MODE, not a role.** `isAgency` (boolean on `User`) marks an account operating in agency mode; it is **not** a `UserRole`. The role enum is exactly **`{ USER, ADMIN }`** (`prisma/schema.prisma`). Agency status is set by the Stripe $399/mo webhook (`lib/billing.ts`) or admin/`SETUP_SECRET` (`app/api/agency/enable`) — **never** by flipping `role`.
3. **The agency↔client edge is `managedByAgencyId`, verified server-side — never `agencyName`.** A managed client is a passwordless `User` with `managedByAgencyId` set. Opening a client's workspace verifies `where { id: clientId, managedByAgencyId: account.id }` before setting `WORKSPACE_COOKIE` (`gcl_client`). The free-text brand `agencyName` is display-only and spoofable; isolation keys on the id. (Same rule the Operator Network authz matrix proves, `lib/network/authz.ts`.)
4. **Admin impersonation is account-preserving.** `IMPERSONATE_COOKIE` (`gcl_impersonate`) flips `currentUser()` only; `currentAccount()` stays the real admin (controls remain), and it is honored **only** when the real account is `ADMIN`. Recorded to `AdminAuditLog`.
5. **Entitlements resolve from plan, server-authoritative.** `lib/entitlements.ts` (`isPremium`, `agencyClientLimit`→capacity resolver) reads `plan`/`subscriptionStatus`/`isAgency`; capabilities never derive from the client.
6. **Fail closed.** A disabled account reads as no account; an unverified agency edge denies; unknown role → least privilege.

## 3. Current identity surfaces (code truth)

| Capability | Status | Source |
|---|---|---|
| Credentials auth (NextAuth JWT, email-or-username, dual rate-limit) | SHIPPED | `lib/auth.ts` |
| Session resolution (account / effective user / workspace) | SHIPPED | `lib/session.ts` |
| Role model `{USER, ADMIN}` | SHIPPED | `prisma/schema.prisma` |
| Agency mode + managed-client workspaces + switching | SHIPPED | `app/api/agency/{clients,select,enable}` |
| Admin impersonation ("view as") | SHIPPED | `lib/session.ts`, `AdminAuditLog` |
| Entitlements / capability resolution | SHIPPED | `lib/entitlements.ts` |
| Managed client's **own** identity (login/consent) | PARTIAL | passwordless `User`, synthetic `@clients.*` email — cannot sign in today |
| Durable **OperatorIdentity** record + lifecycle state machine | **FOUNDATION BUILT (Sprint 9, dormant)** | `lib/identity/**` + migration `20260721120000_operator_identity`; flag-gated `OPERATOR_IDENTITY_ENABLED` (off) |
| Durable **Organization** + **OrganizationMembership** (org-scoped RBAC) | **FOUNDATION BUILT (Sprint 9, dormant)** | `lib/identity/{repository,service}.ts`, `rbac.ts` (OrgRole → permission map) — beyond `{USER, ADMIN}` |
| Durable identity lifecycle **events** | **FOUNDATION BUILT (Sprint 9, dormant)** | 6 refs-only Security/Audit contracts on the Event Fabric (`lib/identity/events.ts`); recorded via `appendEvent`, no fanout |

## 4. The Operator Network identity split (do not conflate)

Two distinct surfaces both called "Operator Network"; they have different identity+activation postures:
- **Community forum (`/community`)** — the **LIVE** public Operator Network face (member-authored threads/replies, CROA-screened). Identity = `currentAccount()` display name.
- **Real-time floor (`/network`)** — **DORMANT**, flag-gated `OPERATOR_NETWORK_ENABLED` (off), counsel/moderation-blocked. Tenant-safe message layer proven (Sprint 7, 36/36) but not publicly activated.
- **Agency Command Center (`/agency`)** — SHIPPED; note the route is titled **"/ Agency"** ("Command Center" appears nowhere in code and is deprecated by ADR-0032).

Handle/presence disclosure and any cross-user surface remain under the counsel gate (`COUNSEL-REVIEW-operator-network.md` §1/§6/§8).

## 5. The Operator Identity Service (FOUNDATION BUILT — Sprint 9, dormant · rest PROPOSED)

**Sprint 9 status (2026-07-21, merged; repository source confirmed at `origin/main` `e28bd68` on 2026-07-25):** the **foundation** is implemented in `lib/identity/**`, migration-first (`20260721120000_operator_identity`, additive 0 DROP) and fully **dormant behind `OPERATOR_IDENTITY_ENABLED` (fail-closed off)**. Built: durable `OperatorIdentity` (1:1 to account, lifecycle state machine — terminal states block resurrection), durable `Organization` (owner by id, unique slug — not the spoofable `agencyName`), `OrganizationMembership` (`@@unique(org,operator)`, idempotent/orphan-free), the org-scoped RBAC permission map (`rbac.ts`, the extension beyond `{USER,ADMIN}` — a PEP-consumable mapping, NOT a parallel authz), the auth boundary (`principal.ts` — consumes `currentAccount()`, never authenticates), 6 refs-only Security/Audit identity events on the Event Fabric, and the reserved `operator_profile` media boundary (hard-off, not built). Authorization is by id (owner `ownerAccountId` / admin), fail-closed. NOT built (still PROPOSED, owner/counsel-gated): public profiles + rendering, managed-client credential login, educator verification, certifications, cross-agency multi-org activation, marketplace/reputation linkage, and any HTTP route. No route, no activation, deployment, or production migration was performed by this repository assessment. The rest of this section is the still-PROPOSED target the foundation grows into.

**Architectural-review decisions (2026-07-21, pre-push — 5-agent panel, all MINOR_CORRECTION, applied on-branch):**
1. **Organization is a GENERIC platform entity.** `kind ∈ {AGENCY, ENTERPRISE, EDUCATOR, VENDOR, INTERNAL}` (extensible via additive `ALTER TYPE`, never a redesign); kind-specific data lives in the owning vertical keyed by `organizationId`, never on the Organization row. It is NOT an Agency abstraction — AGENCY is one kind.
2. **Single ownership truth.** `Organization.ownerAccountId` is the sole ownership authority (what the service authorizes on). `OrgRole.OWNER` is **DERIVED** from it, never an assignable membership role — assignable roles are `{ADMIN, MEMBER}` — so ownership can't fork into two authorities once the PEP consumes `rbac.ts`. The owner FK is `ON DELETE RESTRICT`: an Organization outlives its owner-account's deletion (explicit archive / ownership-transfer required), so a single account deletion can't destroy a shared org and cascade-wipe every member's membership.
3. **⚠️ Membership ownership decision (one-owner-per-concept).** `lib/identity` (`Organization` + `OrganizationMembership` + `OrgRole`, migration-first) is the **SOLE owner** of durable org+membership records, the role taxonomy, and membership lifecycle. A pre-existing SECOND membership mechanism exists at the OS altitude — `lib/os/platform/teams.ts` + `lib/platform/teamStore.ts` (self-healed `TeamMember`/`TeamInvitation`/`ClientAssignment`, role vocabulary `owner|operator`). It is hereby declared **SUPERSEDED by the identity foundation**, slated to be recast as a generic OS mechanism that consumes identity's records, or retired. **Reconciliation is a documented follow-up — NOT built in this slice** (no code change to `teams.ts` here; the ownership decision is recorded so the two systems don't silently diverge).
4. **Membership stays a module inside Identity** (not extracted to its own Platform Service): no production evidence yet justifies the decomposition, and the membership table + events already form a clean future extraction seam. Revisit only on concrete multi-org/hierarchy demand.

**This is architecture only. No code. The next implementation slice is owner-gated.** The service consolidates the scattered identity concerns above into one bounded context that other platform services (Reputation, Marketplace, Notifications, Kai, Audit) consume — without any of them re-deriving identity.

**Owns:** operator profile (public + private), organization/agency membership, roles & permissions (the RBAC extension point), identity lifecycle, workspace/mode resolution, educator verification, certification *issuance records* (the credential fact — the achievement/reputation *meaning* stays with Reputation), and the durable identity **event stream**.
**Never owns:** reputation/XP math (→ Reputation/Arena, [`ARENA-CONTRIBUTION-POLICY.md`](ARENA-CONTRIBUTION-POLICY.md)), notification content (→ emitting context, ADR-0036), billing entitlements *policy* (→ Entitlements), domain data, Kai reasoning.

**Would publish (durable identity events, via the Event Fabric — none exist today):** `OPERATOR_REGISTERED`, `AGENCY_CLIENT_ADDED`, `ROLE_CHANGED`, `AGENCY_MODE_ENABLED`, `SESSION_IMPERSONATED`, `EDUCATOR_VERIFIED`, `CERTIFICATION_ISSUED`. Category = **Security/Audit** (permanent audit, refs-only, no external delivery — ADR-0036 §5).
**Would consume:** Stripe/billing plan changes (agency-mode source of truth), Reputation `award.earned`/`rank.promoted` (to surface trust on a profile, read-only).

**Consolidation scope (the gaps this closes):**
1. **RBAC extension** — beyond `{USER, ADMIN}`: team-member/operator/specialist roles (the `AGENCY-COMMAND.md` §role model, currently unimplemented) as a permission-set mapping, resolved through the existing PEP (`lib/os/kernel/pep.ts`), never a parallel authz.
2. **Managed-client own identity** — an optional credential/consent path so a managed client can access their own workspace (today they are passwordless); gated on counsel (consent, disclosure).
3. **Public vs private profile** — a public operator profile (handle, verified badges, reputation-fed trust signals) vs private account data; disclosure counsel-gated.
4. **Educator verification & certifications** — a verification record + issued-certification records (the credential *fact*; achievement *scoring* stays in Reputation).
5. **Cross-agency rules** — an operator belonging to more than one organization (today membership is a single `managedByAgencyId` edge).
6. **Reputation & Marketplace linkage** — the profile is the join point: Reputation supplies trust signals, Marketplace reads verified identity + trust to gate participation. Both **read** identity; neither **owns** it.
7. **Future experience integrations (all currently ABSENT/PROPOSED — label honestly):** Campus (=Academy today, `app/academy`), Room ownership (GXL is a founder-only specimen, `app/gxl`), Meeting/Event ownership (no routes exist), Knowledge, Kai profile-awareness, auditing, search, API, and third-party plugins (ADR-0026 plugin/bounded-context rules apply).

**Prerequisites before writing any code (the "everything required first"):** a migration-first identity schema plan (profile/roles/memberships/certifications tables); the durable identity-event contracts added to `lib/eventBus/contracts.ts` (versioned, refs-only); a CCO/counsel pass on public-profile disclosure, managed-client consent, and educator verification; the RBAC permission-set map reconciled with the PEP; and an explicit statement of what stays owner-gated (public activation, cross-user surfaces).

### Activation-readiness assessment (2026-07-25 — VERIFIED repository source; no runtime or schema change)

The requested `managedByAgencyId → OrganizationMembership` bridge is **not yet semantically implementable**. This is a fail-closed design record, not an activation or backfill authorization.

| Concern | Repository truth / required future decision |
| --- | --- |
| Canonical truth today | `managedByAgencyId` is the LIVE `User`→`User` agency-managed-client edge: a passwordless consumer workspace is managed by an agency account. It remains the sole active agency-client authorization and entitlement relation until a separately approved cutover. |
| Dormant canonical successor | `OrganizationMembership` is an `OperatorIdentity`→`Organization` relation owned by `lib/identity/**`; an organization owner may own zero or many organizations, and a managed client need not have an `OperatorIdentity`. Therefore the legacy edge yields zero or multiple possible targets and does not prove a membership role. |
| Compatibility and deprecation | Keep the legacy field readable and authoritative for its existing live paths. It is neither a membership projection nor safe fallback authorization for the dormant model. Deprecation requires an owner-approved cutover and compatibility plan. |
| Migration bridge and history | No automatic backfill, canonical membership creation, reconciliation status, or event is authorized. The scalar legacy edge has no immutable provenance or supersession history. A future additive bridge must preserve source evidence, explicit candidate selection/ambiguity, deterministic ordering, stable idempotency keys, and non-cascading history before it can replay safely. |
| Lifecycle | Existing legal organization transitions are `ACTIVE → SUSPENDED|ARCHIVED` and `SUSPENDED → ACTIVE|ARCHIVED`; `ARCHIVED` is terminal. Membership transitions are `ACTIVE → SUSPENDED|REMOVED` and `SUSPENDED → ACTIVE|REMOVED`; `REMOVED` is terminal. Their service reachability, lifecycle-event contracts, suspended-org policy, and ownership-transfer authority remain unimplemented. |
| Authorization and dormancy | Authentication remains outside Identity. `OrgRole.ADMIN` is a pure future PEP map, not a live grant; the current service uses `ownerAccountId` or global admin. Do not let a raw legacy FK, an inactive membership, or an ambiguous candidate authorize anything. With `OPERATOR_IDENTITY_ENABLED !== "true"`, every identity service door remains disabled before data access. |

**Owner decisions required before code or a migration:** (1) whether a managed consumer may ever become an operator/member and, if so, consent and role; (2) how an agency account selects one organization when it owns zero or many; (3) reconciliation provenance, conflict, supersession, and review policy; (4) lifecycle authority, including the role of membership `ADMIN`, suspended-org access, and owner transfer; and (5) whether a new migration may expand the owner-gated Gate D six-migration manifest. Until then, no reconciliation is a valid no-op and any proposed mapping must fail closed.

## 5b. Professional Operator Profile + media boundary (PROPOSED)

Every operator needs a professional presence. The profile is a **projection** the Identity service owns; it *renders* selectively-authorized data it does not itself compute (reputation, KPIs, certifications live in their own contexts).

**Fields:** profile photo · display name · professional headline · biography · organization/agency affiliation · role · specialties · certifications (from Identity credential records) · educator status · professional milestones (from Reputation, [`VECTOR-XP.md`](VECTOR-XP.md)) · Arena progression / Vector XP (projection from Reputation) · marketplace contributions · classes hosted · community contribution · member referrals / ecosystem growth (verified, capped — never dominant, per ADR-0037) · business-maturity indicators where appropriate ([`PERFORMANCE-INTELLIGENCE.md`](PERFORMANCE-INTELLIGENCE.md)).
**Visibility model:** every field carries a visibility class — **public · organization-only · private · platform-governed** — plus **verification state** and **lifecycle/suspension state**. Consent and deletion (data-subject erasure) are required. Cross-user public exposure stays under the §6 counsel gate.

**Profile-media boundary — REUSE, do not duplicate.** Image bytes must **not** live in the identity record. The existing **`lib/attachments.ts`** boundary already owns file storage (the `Attachment` table keyed by `scope`+`refId`, magic-byte/MIME validation via `validateFiles`, size limits `ATTACH_LIMITS`, encrypted at rest via `docCryptoReady`, tenant-safe `scope`/`refId` paths, `listAttachments` with a caller-run ownership check). Profile media adds an **`operator_profile` scope** to that boundary — **no new media subsystem**.
**Required FUTURE controls the current boundary does NOT yet have (document, do not build):** server-authorized uploads · **image re-encoding** (the current boundary validates magic bytes but does not re-encode) · **EXIF/geolocation metadata stripping** (server-side, not client-trusted) · dimension limits · malware scanning where supported · **CSAM detection + NCMEC reporting obligation** · **impersonation / brand-claim screening** (a photo or `agencyName` spoofing a real person/reputable brand) · replacement/deletion · upload rate limits · moderation + reporting · auditability · default-avatar behavior · profile-media access authorization. These are prerequisites before profile uploads ship — none is implemented now.

**§5b hardening (adversarial review, 2026-07-20) — binding when the profile is built:**
- **Every free-text field** (bio, headline, specialties, affiliation) passes the same **fail-closed CROA screener** as community posts (`screenCommunityText` → 422) **before render** — a public platform-published profile cannot host "I guarantee 100+ deletions / a 780 score." The §6 counsel gate covers consent/disclosure, not per-field content; this closes that.
- **Outcome-derived reputation fields** (Vector XP, favorable-outcome counts, milestones, classes hosted) on a **public** profile carry the **same CROA §1679b treatment as the refused Arena leaderboard** — a single public profile advertising outcomes is an implied-results surface. Such fields are **non-public / aggregate-only by default**, and any public exposure needs a **separate display-consent record + CCO/CROA sign-off**, not merely the generic §6 privacy gate.
- **Managed-client (consumer) reputation and profile are non-public and non-projected by DEFAULT**, suppressed until an explicit **consumer-consent** record exists. A consumer's dispute outcomes feed reputation attributed to the consumer (never the agency) but must not surface anywhere without their own consent — distinct from operator reputation.
- **Default-private, least-exposure.** Every field defaults to its **most-private** visibility class; public exposure requires an affirmative **per-field opt-in**. (The platform fail-closed rule §2.6 applies; state it explicitly here so an implementer cannot default a field to public.)
- **Serving-route enforcement.** The profile-media serving route (extending `app/api/attachments/[id]`) MUST resolve and enforce each field's visibility class (public / org-only / private) **before releasing bytes**, with a public-avatar cache posture defined separately from private `no-store`. The current route fails closed on unknown scopes but has no visibility branch — that branch is a build-time prerequisite.

## 6. Compliance & counsel gates (binding)

Public activation of any cross-user identity surface (public profiles, handles, presence, cross-user trust display) is under the same hard **CROA §1679b / FTC §5** posture as Reputation and the Operator Network (`COUNSEL-REVIEW-operator-network.md` §0). No profile/handle/presence ships publicly without a CCO/counsel pass and the privacy-policy amendment. This document does not reopen those decisions.

## 7. Governance & status

PROPOSED architecture + index of VERIFIED current truth. Amend the future-service design only via an ADR + founder approval; the current-truth citations track the code (update when the code changes). Dormant flags to remember: `EVENT_BUS_ENABLED`, `ARENA_ENABLED`, `OPERATOR_NETWORK_ENABLED`, `CAPABILITY_PLATFORM` — all default **off** (fail-closed). Nothing here is live.
