# Sprint 9 — Operator Identity Foundation (implementation record)

**Point-in-time record · 2026-07-21 · branch `feat/operator-identity` (UN-MERGED, not pushed).** The first Platform Services Phase II slice. Built, tested, adversarially reviewed; **dormant behind `OPERATOR_IDENTITY_ENABLED` (fail-closed OFF)**. Nothing merged/deployed/migrated/activated. Stops for architectural review. Live state authority: [`CURRENT-STATE.md`](CURRENT-STATE.md); canonical design: [`OPERATOR-IDENTITY.md`](OPERATOR-IDENTITY.md).

## Status
`Built` · `Dormant (flag OFF)` · `Migration-first (additive, un-applied)` · `Adversarially reviewed — 1 MED fixed` · `Architecture-reviewed — APPROVE WITH MINOR CHANGES, corrections applied`

Base `main`/`e233ca4` (v0.8.0). 8 commits `4a51459…4270fc8`. `lib/identity/**` (10 modules) + 1 migration + 4 guard scripts.

## 1. What was built (only what Identity needs — no speculative modules)
- **Operator entity** — `OperatorIdentity` (1:1 to the auth account; the account stays the source of truth for auth/email/name). Lifecycle: `PENDING → ACTIVE ⇄ SUSPENDED → DEACTIVATED` (terminal).
- **Organization + membership** — `Organization` (owner by **id** `ownerAccountId`, unique `slug` — not the spoofable `agencyName`); `OrganizationMembership` (`@@unique(org,operator)` — idempotent, orphan-free).
- **State machines** (`state.ts`) — pure, fail-closed; terminal states have no outgoing edges ⇒ no resurrection.
- **RBAC integration point** (`rbac.ts`) — `OrgRole {OWNER,ADMIN,MEMBER}` → permission-set map, the extension beyond `{USER,ADMIN}`. A **PEP-consumable mapping, not a parallel authz**; the service authorizes strictly by ownership/admin.
- **Identity events** (`events.ts` + 6 Event-Fabric contracts) — `OPERATOR_REGISTERED`, `OPERATOR_STATE_CHANGED`, `ORGANIZATION_CREATED`, `MEMBERSHIP_ADDED/ROLE_CHANGED/REMOVED`. Refs-only Security/Audit, recorded via `appendEvent` under a trusted `systemIdentity`, idempotent, **no fanout**.
- **Auth boundary** (`principal.ts`) — consumes `currentAccount()`; identity never authenticates; principal = account id; fail-closed on `disabled`.
- **Media/Profile boundary** (`profileMedia.ts`) — reserves the `operator_profile` attachments scope + the prerequisite-controls register; **hard-off, not built** (counsel-gated).
- **Runtime service** (`service.ts`) — the single door: flag → principal → authorize-by-id → validate → state-machine → guarded/idempotent write → durable event. Reads are self/owned-org/admin only.

**Not built (still PROPOSED, owner/counsel-gated):** public profiles + rendering, managed-client credential login, educator verification, certifications, cross-agency multi-org activation, marketplace/reputation linkage, and **any HTTP route**.

## 2. Migration summary
`prisma/migrations/20260721120000_operator_identity/migration.sql` — **additive, 0 DROP**: 5 enums, 3 tables, their indexes, 3 FKs onto `User`/`Organization`/`OperatorIdentity` (cascade cleanup ⇒ no orphans). Migration-first (never self-heal; build runs no migration). Idempotency/isolation constraints declared: `OperatorIdentity.accountId` unique, `Organization.slug` unique, `OrganizationMembership(organizationId, operatorId)` unique. **Not applied to any DB** — owner-gated (preview-validate → `migrate deploy`), and gated behind the standing v0.8.0 Gate D (`0_init` baseline first).

## 3. Runtime summary
Every mutation is fail-closed and idempotent/race-safe: find-or-create guarded by UNIQUE (register, add-member); guarded CAS `updateMany(where {id, <field>: from[, state]})` for transitions (count≠1 ⇒ conflict, never a blind overwrite). Authorization is **by id** (org `ownerAccountId` / admin), never a client name/slug. Lifecycle transitions are admin-only except self-`DEACTIVATE`. Identity events cannot be forged (platform-scope; only a trusted/admin identity emits). The repository is internal (not re-exported from the barrel).

## 4. Adversarial review (Phase 7 — 9 agents, 6 vectors, verify-passed, 0 errors)
Vectors CLEAN: duplicate-identity/resurrection, tenant+org isolation/spoofing, privilege-escalation/authz-bypass, replay/event-duplication, migration/PII/fail-closed. **Confirmed: 1 MED + 1 INFO; refuted: 1.**
- **MED — FIXED (`4270fc8`):** `changeMembershipRole` CAS guarded only on role, not state → a role change could race a concurrent remove/suspend into `(REMOVED, ADMIN)` (latent elevation). Fixed by adding `state: "ACTIVE"` to the guard.
- **INFO — documented:** read-back after a guarded `updateMany` is not transactional; a returned row/audit `seq` may reflect a later concurrent transition. Non-exploitable; atomic write+read coupling is future hardening.
- **Refuted:** addMember TOCTOU on a concurrently-DEACTIVATED operator — no invariant is violated (memberships aren't auto-closed on operator deactivation in the foundation).

## 5. Validation evidence
`npm run typecheck` **0** · `npm run build` **0** · full guard suite **60 pass / 2 fail** (the 2 — `execution`, `missionEngine` — are pre-existing on `main`, unrelated). Identity guards: migration **29/0**, core **52/0**, events **63/0**, runtime **36/0**. Sprint 8 Event-Fabric guards re-pass (validate 69/0, migration-guard 18/0, authz-isolation 43/0). Fail-closed dormancy is **executed**: all 9 service doors return `disabled` with the flag off, no DB touch. DB-backed preview validation is owner-gated (not run here).

## 6. Commit inventory (`feat/operator-identity`, off `e233ca4`)
| # | SHA | Subject |
|---|---|---|
| 1 | `4a51459` | schema + additive migration + migration guard |
| 2 | `4da1cda` | pure core — state machines, RBAC map, validation |
| 3 | `0ada10b` | identity events on the Event Fabric |
| 4 | `4e8e1c1` | idempotent, race-safe repository |
| 5 | `74fbada` | runtime service + auth & profile-media boundaries |
| 6 | `0f50f3a` | runtime/dormancy tests + operator-shell guard fix |
| 7 | `4270fc8` | adversarial MED fix (state-guard role change) |
| 8 | _this_ | docs — OPERATOR-IDENTITY status + this record |

## 6b. Architectural review (pre-push, 2026-07-21 — 5-agent panel)
All 5 boundary verdicts = **MINOR_CORRECTION**, 0 REQUIRES_REDESIGN → **APPROVE WITH MINOR CHANGES**. Auth independence, ownership boundaries, and Event-Fabric emit-only were confirmed clean. Corrections applied on-branch (`f6…` commits):
- **Organization made genuinely generic** — `OrganizationKind` broadened to `{AGENCY, ENTERPRISE, EDUCATOR, VENDOR, INTERNAL}` and `kind` un-hardcoded through validation/service/repository/contract (it was agency-locked). Model was already generic; only the discriminator was under-populated ⇒ minor, not a redesign.
- **FK integrity** — `Organization.ownerAccountId` FK `CASCADE → RESTRICT`: a shared org (and every member's membership) can't be destroyed by one account deletion.
- **Single ownership truth** — assignable membership roles restricted to `{ADMIN, MEMBER}`; `OWNER` is derived from `ownerAccountId`, killing the latent dual-authority before the PEP consumes `rbac.ts`.
- **Ownership decision recorded** ([`OPERATOR-IDENTITY.md §5`](OPERATOR-IDENTITY.md)) — `lib/identity` is the sole owner of durable org+membership; the pre-existing self-healed `lib/os/platform/teams.ts` + `teamStore.ts` (`TeamMember`/`TeamInvitation`/`ClientAssignment`) is **superseded**, reconciliation/retirement a **documented follow-up** (not built here). Membership stays a module inside Identity (no evidence to extract).

All corrections migration-safe (migration unapplied, edited in place). Re-validated: typecheck 0, build 0, identity guards 31/58/65/36, full suite 60/2.

## 7. Owner-gated next steps (STOP — architectural review)
Do NOT merge / deploy / migrate / enable. When approved: architectural review of this branch → merge (auto-deploys, dormant) → owner-gated migration (this migration, after the v0.8.0 Gate D `0_init` baseline) → **only then** may `OPERATOR_IDENTITY_ENABLED` be considered, with the still-PROPOSED profile/counsel items (public profiles, managed-client consent, educator/certs) unbuilt and out of scope until their own gates clear.
