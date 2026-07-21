# Operator Identity — bounded context (consolidating index + future service package)

Status: **index of EXISTING truth + PROPOSED future service.** No code/schema/flag change from this document.
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
| Fine-grained RBAC beyond USER/ADMIN | PROPOSED | no team-member/staff/moderator role exists |
| Durable identity lifecycle **events** | PROPOSED | only fire-and-forget `track(workspaceCreated)`; no durable `account.created`/`agency.client.added` |

## 4. The Operator Network identity split (do not conflate)

Two distinct surfaces both called "Operator Network"; they have different identity+activation postures:
- **Community forum (`/community`)** — the **LIVE** public Operator Network face (member-authored threads/replies, CROA-screened). Identity = `currentAccount()` display name.
- **Real-time floor (`/network`)** — **DORMANT**, flag-gated `OPERATOR_NETWORK_ENABLED` (off), counsel/moderation-blocked. Tenant-safe message layer proven (Sprint 7, 36/36) but not publicly activated.
- **Agency Command Center (`/agency`)** — SHIPPED; note the route is titled **"/ Agency"** ("Command Center" appears nowhere in code and is deprecated by ADR-0032).

Handle/presence disclosure and any cross-user surface remain under the counsel gate (`COUNSEL-REVIEW-operator-network.md` §1/§6/§8).

## 5. The future Operator Identity Service (PROPOSED — next implementation target)

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

## 6. Compliance & counsel gates (binding)

Public activation of any cross-user identity surface (public profiles, handles, presence, cross-user trust display) is under the same hard **CROA §1679b / FTC §5** posture as Reputation and the Operator Network (`COUNSEL-REVIEW-operator-network.md` §0). No profile/handle/presence ships publicly without a CCO/counsel pass and the privacy-policy amendment. This document does not reopen those decisions.

## 7. Governance & status

PROPOSED architecture + index of VERIFIED current truth. Amend the future-service design only via an ADR + founder approval; the current-truth citations track the code (update when the code changes). Dormant flags to remember: `EVENT_BUS_ENABLED`, `ARENA_ENABLED`, `OPERATOR_NETWORK_ENABLED`, `CAPABILITY_PLATFORM` — all default **off** (fail-closed). Nothing here is live.
