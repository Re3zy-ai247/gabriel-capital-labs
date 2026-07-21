# Gate D — Production Migration Runbook (Operator Platform Schema)

**Status:** PREPARED · NOT EXECUTED · **HARDENED at Architecture Freeze 1.0** (2026-07-21, see [`ARCHITECTURE-FREEZE-1.0.md`](../ARCHITECTURE-FREEZE-1.0.md) §Gate-D). This is an owner-ready execution package. Running it is a deliberate, owner-approved release step — **no migration in this chain has been applied to production** (the `migrate resolve --applied 0_init` baseline was done on the isolated PREVIEW DB only). Authored against merged `main` @ `cf0d95a` (code); reviewed at HEAD `6c76454`. **The freeze review found and fixed a blocker: `migrate deploy` alone would fail on `0_init` — the §6.4 baseline reconcile is now mandatory.**

> Read this whole document before running anything. It is written so the migration can be executed later without re-deriving architecture. If any statement here no longer matches the repository, STOP and reconcile before proceeding.

---

## 1. Purpose

Apply the Operator Platform's additive schema (Operator Identity + Operator Reputation, plus the Event Fabric tables they depend on) to the production database, so the dormant services **can** later be activated. This runbook **only creates tables/indexes/constraints**. It does **not** enable any feature, wire any producer, expose any route, or write any row. Production behaviour is unchanged by a successful run — the code that reads these tables stays fail-closed OFF behind its flags.

## 2. Risk level

**MEDIUM.** Every migration is strictly additive (0 destructive statements, verified §7). The realistic failure modes are operational, not data-loss:
- Running through the **Accelerate** proxy instead of a **direct** Postgres connection (migrations require a direct connection).
- Partial application if the connection drops mid-chain (Prisma records each migration atomically in `_prisma_migrations`; re-running resumes — see §10).
- Applying against the wrong database (Production and Preview currently share one `DATABASE_URL` — see §4 precondition P4).

There is **no `DROP`, no `ALTER COLUMN`, no `DELETE`, no `TRUNCATE`** anywhere in the chain, so a correctly-targeted run cannot lose existing data.

## 3. Preconditions (ALL must hold)

| # | Precondition | How to confirm |
|---|---|---|
| P1 | Merged code is live: prod = `cf0d95a`, dormant, healthy | `curl -s -o /dev/null -w "%{http_code}" https://www.creditvector.app/` → `200` |
| P2 | Feature flags are OFF (so post-migration the services stay dormant) | `npx vercel env ls production \| grep -iE "OPERATOR_(IDENTITY\|REPUTATION)_ENABLED"` → **empty** |
| P3 | A **fresh production DB backup / snapshot** exists and its restore path is known | Prisma Postgres console snapshot, or `pg_dump` against the direct URL, timestamped **immediately before** the run |
| P4 | You are targeting **production** and know whether Preview shares it | `DATABASE_URL` is one shared value across Production+Preview (CLAUDE.md gotcha #1). Applying to it applies to both. Confirm this is intended. |
| P5 | You have the **direct** (non-Accelerate) connection string | Direct endpoint `db.prisma.io:5432` (NOT the `prisma://accelerate…` runtime URL). `prisma migrate deploy` MUST use the direct URL. |
| P6 | Local tree matches prod | `git fetch && git rev-parse origin/main` → the current merged prod SHA |
| **P7** | **You know production's `_prisma_migrations` baseline state** | **Production carries NO migration history — the `migrate resolve --applied 0_init` baseline was performed on the isolated PREVIEW DB only (see CURRENT-STATE Sprint 7/8), never on production.** The v0.8.0 tables (`User`, etc.) exist PHYSICALLY but are unrecorded. This is a Prisma *baselining* situation (§6.4) — `migrate deploy` alone will try to re-create existing tables and fail. Confirm the actual state with the §6.3 probe before applying. |
| **P8** | **The direct-connection role can create schema** | The role must hold `CREATE` on the target database/schema (`CREATE TABLE`, `CREATE TYPE`, `CREATE INDEX`). The Prisma Postgres owner role normally does; verify with `SELECT has_database_privilege(current_user, current_database(), 'CREATE');` → `t`. |

If any precondition fails → **do not proceed.**

## 4. What gets created (full expected object inventory)

The chain has **6 migrations**. Production has **no `_prisma_migrations` history**, but the earlier migrations' objects may physically exist (0_init's 26 tables **certainly** do — the app is live; the network/event_bus tables exist only if a prior `db push`/self-heal created them). `migrate deploy` applies whatever `_prisma_migrations` shows as pending, so an already-present-but-unrecorded migration must first be marked applied (**§6.4 baseline reconcile**) or `deploy` will attempt to re-create it and fail. Expected **new** objects for the two operator migrations that are the point of Gate D:

**`20260721120000_operator_identity`** — 3 tables, 9 indexes, 4 FKs, 0 destructive
- Tables: `OperatorIdentity`, `Organization`, `OrganizationMembership`
- Unique indexes: `OperatorIdentity_accountId_key`, `OperatorIdentity_handle_key`, `Organization_slug_key`, `OrganizationMembership_organizationId_operatorId_key`
- Non-unique indexes: `OperatorIdentity_state_idx`, `Organization_ownerAccountId_idx`, `Organization_state_idx`, `OrganizationMembership_operatorId_idx`, `OrganizationMembership_organizationId_state_idx`
- FKs: `OperatorIdentity_accountId_fkey` → `User` **CASCADE** · `Organization_ownerAccountId_fkey` → `User` **RESTRICT** · `OrganizationMembership_organizationId_fkey` → `Organization` **CASCADE** · `OrganizationMembership_operatorId_fkey` → `OperatorIdentity` **CASCADE**

**`20260721160000_operator_reputation`** — 2 tables, 4 indexes, 2 FKs, 0 destructive
- Tables: `XpAward`, `ReputationMilestone`
- Unique indexes: `XpAward_subjectId_operatorId_awardKind_key`, `ReputationMilestone_operatorId_milestoneKey_key`
- Non-unique indexes: `XpAward_operatorId_createdAt_id_idx` (the canonical fold order), `ReputationMilestone_operatorId_idx`
- FKs: `XpAward_operatorId_fkey` → `OperatorIdentity` **RESTRICT** · `ReputationMilestone_operatorId_fkey` → `OperatorIdentity` **RESTRICT**

> **Why the two ledger FKs are RESTRICT (do not "fix" them to CASCADE):** the XP ledger is append-only audit truth and milestones are latched facts. RESTRICT blocks `prisma.user.delete` from silently cascade-destroying the ledger or un-latching a milestone; data-subject erasure must retain pseudonymous rows explicitly. This was the Sprint-10 adversarial MED fix.

## 5. Migration order (dependency-verified)

```
0_init                                  (26 tables — the v0.8.0 baseline; User, etc.)
        ↓  provides User (identity + org owner FK target)
20260720204355_operator_network_messages   (2 tables)
        ↓
20260720223438_event_bus                 (1 table — the durable EventEnvelope log)
        ↓
20260720231803_event_bus_agency_index    (1 index — agency isolation axis)
        ↓  Event Fabric present (Identity & Reputation record facts here)
20260721120000_operator_identity         (3 tables — depends on User)
        ↓  provides OperatorIdentity (ledger FK target)
20260721160000_operator_reputation       (2 tables — depends on OperatorIdentity)
```

**Dependency proof:** `operator_reputation`'s two FKs both point at `OperatorIdentity`, created by `operator_identity`; `operator_identity`'s FKs point at `User`, created by `0_init`. Reputation therefore CANNOT be applied before Identity, and Identity cannot precede `0_init`. `prisma migrate deploy` walks this order by filename timestamp — do not apply out of order manually.

## 6. Execution

**Do not run these until every §3 precondition is confirmed and an owner has approved (§13).**

```bash
# 0) From a clean checkout of the merged prod SHA
git fetch origin && git rev-parse origin/main        # expect the current prod SHA

# 1) Take/verify the backup (P3) — timestamp it. STOP if it fails.

# 2) Point at the DIRECT production connection (NOT accelerate).
export DATABASE_URL="postgresql://<direct-prod-credentials>@db.prisma.io:5432/<db>?sslmode=require"
```

**6.3 — PROBE actual production state (read-only; changes nothing).** Because production has no migration history (P7), you MUST discover which migrations' objects already exist before applying:

```bash
npx prisma migrate status         # will likely report 0_init … as "not yet applied"
```
```sql
-- Run against the direct connection. NULL = object absent (migration genuinely pending);
-- non-NULL = object already exists physically (migration must be baseline-reconciled in §6.4).
SELECT to_regclass('public."User"')            AS init_0,          -- 0_init            (expect NON-NULL: live app)
       to_regclass('public."NetworkMessage"')  AS network_msgs,    -- operator_network_messages (unknown)
       to_regclass('public."EventEnvelope"')   AS event_bus,       -- event_bus          (unknown)
       to_regclass('public."OperatorIdentity"')AS operator_ident,  -- operator_identity  (expect NULL)
       to_regclass('public."XpAward"')          AS operator_rep;   -- operator_reputation(expect NULL)
SELECT indexname FROM pg_indexes                                    -- event_bus_agency_index (unknown)
  WHERE indexname = 'EventEnvelope_agencyId_createdAt_id_idx';
```

**6.4 — BASELINE RECONCILE (the step `migrate deploy` alone cannot do).** For EVERY migration in the chain whose objects the §6.3 probe found to **already exist** but which is **not** in `_prisma_migrations`, mark it applied — this records history WITHOUT running its DDL, so `deploy` will skip it instead of colliding. `0_init` is a certainty; the rest are conditional on the probe. Apply in chain order, only for the ones the probe showed present:

```bash
npx prisma migrate resolve --applied 0_init                                   # ALWAYS (26 v0.8.0 tables exist)
# npx prisma migrate resolve --applied 20260720204355_operator_network_messages  # ONLY if NetworkMessage existed in §6.3
# npx prisma migrate resolve --applied 20260720223438_event_bus                  # ONLY if EventEnvelope existed
# npx prisma migrate resolve --applied 20260720231803_event_bus_agency_index     # ONLY if that index existed
```

> If the §6.3 probe shows a migration's objects **absent**, do NOT resolve it — leave it pending so `deploy` creates it. Marking an absent migration "applied" would skip its DDL and leave the schema missing tables (a silent, worse failure than the collision). The two operator migrations must ALWAYS be absent (probe returns NULL); if either already exists, STOP — the repository's assumptions do not hold.

**6.5 — RE-INSPECT, then APPLY.**

```bash
npx prisma migrate status         # should now list ONLY the genuinely-pending migrations (the 2 operator ones + any absent earlier one)
npx prisma migrate deploy         # the only schema-CREATING command in this runbook
```

`migrate deploy` is the production-safe applicator: it applies only pending migrations, in order, each wrapped in its own transaction, recording success in `_prisma_migrations`. It never resets, never generates, never touches the schema beyond the migration files. **Do not** use `prisma db push` or `prisma migrate dev` against production.

**Expected duration:** < 30 seconds for the two operator migrations (small additive DDL on tables that start empty). The full chain from scratch is still < 2 minutes.

## 7. Expected output

The initial `prisma migrate status` (§6.3) will report the pre-existing migrations (`0_init`, and any physically-present others) as **"not yet applied"** — this is the expected un-baselined state, **not** an error. Each `migrate resolve --applied` (§6.4) prints:

```
Migration 20260721… marked as applied.
```

After §6.4, the re-inspect (`migrate status`, §6.5) should list **only** the genuinely-pending migrations. `prisma migrate deploy` (§6.5) should then print, for each:

```
Applying migration `20260721120000_operator_identity`
Applying migration `20260721160000_operator_reputation`
All migrations have been successfully applied.
```

No `--accept-data-loss` prompt should ever appear (there is nothing destructive). **If Prisma prints a data-loss warning or asks to reset, ABORT immediately (§8)** — that means the target DB diverges from the migration history and this runbook's assumptions do not hold.

## 8. Abort conditions (stop the run)

- Any data-loss / reset prompt from Prisma.
- `migrate deploy` reports a **failed** migration (it stops at the first failure and records it as failed in `_prisma_migrations`).
- **`migrate deploy` tries to apply `0_init` (or another pre-existing migration) and fails with "relation … already exists"** — the §6.4 baseline reconcile was skipped or incomplete. STOP, run the §6.3 probe + §6.4 `migrate resolve --applied` for the present-but-unrecorded migration, then re-run deploy.
- The §6.3 probe shows `OperatorIdentity` or `XpAward` **already exists** (expected NULL) — the repository's assumptions do not hold; STOP and reconcile.
- The connection is Accelerate (`prisma://`) not direct — abort, fix the URL, restart.
- Any uncertainty about whether the target is the correct production DB.

## 9. Rollback

Because every migration is additive and the services stay flag-OFF:
- **Preferred rollback = do nothing / leave the new empty tables in place.** They are inert dormant schema; nothing reads or writes them until Gate F. This is the lowest-risk option and is usually correct.
- **If a clean revert is required:** restore the pre-run backup from §3/P3 (authoritative), OR hand-drop only the newly-created objects **in reverse dependency order** (`operator_reputation` objects first, then `operator_identity`) and delete their `_prisma_migrations` rows. Dropping is safe **only** while the tables are empty (pre-activation). Prefer the backup restore.
- **Code rollback is independent and already available:** production code can revert to `f690373` (Sprint 9) or earlier without touching the DB — additive tables don't break older code.

## 10. Partial-failure recovery

If the run dies mid-chain: `_prisma_migrations` has recorded each completed migration. Fix the cause (connection, credentials), then re-run `npx prisma migrate deploy` — it resumes at the first pending migration. A migration that recorded as **failed** must be resolved with `prisma migrate resolve` per Prisma docs before deploy will continue; escalate rather than guessing.

## 11. Post-migration verification checklist

Run against the **direct** production connection after `migrate deploy` succeeds:

- [ ] `npx prisma migrate status` → "Database schema is up to date!"
- [ ] All 5 new tables exist: `OperatorIdentity`, `Organization`, `OrganizationMembership`, `XpAward`, `ReputationMilestone`
- [ ] Row counts are **0** on all 5 (migration writes no data)
- [ ] The 13 new indexes from §4 exist (spot-check the 6 unique ones)
- [ ] The 6 new FKs exist with the correct `ON DELETE` (2 ledger FKs = RESTRICT; identity account FK = CASCADE; org owner FK = RESTRICT)
- [ ] Production HTTP unchanged: `/ /pricing /login /community` → 200; `/operator` `/reputation` → 404; `/arena` → 307
- [ ] Flags still OFF: `npx vercel env ls production | grep OPERATOR_` → empty
- [ ] No new runtime errors in Vercel logs for 10 minutes post-migration

## 12. Success criteria

Gate D is complete when: all 6 migrations show applied, the 5 operator tables exist and are empty, production HTTP behaviour is byte-for-byte what it was pre-migration, and all feature flags remain OFF. **The deliverable of Gate D is capability-latent schema, not behaviour.** Activation is a separate, later, owner-gated step (Gate F).

## 13. Owner approvals required (before §6)

1. Owner confirms a fresh production backup exists (P3).
2. Owner confirms the Production/Preview shared-DB implication (P4) is acceptable, or Preview has been scoped off first.
3. Owner confirms the §6.3 probe was run and the §6.4 baseline `migrate resolve --applied` list was derived from it (0_init at minimum).
4. Owner explicitly authorizes running `prisma migrate resolve` (§6.4) + `prisma migrate deploy` (§6.5) against production.
4. (Not part of this runbook) Activation — enabling `OPERATOR_IDENTITY_ENABLED` / `OPERATOR_REPUTATION_ENABLED`, wiring award producers, re-pointing Arena — remains separately owner- and counsel-gated.

## 14. What Gate D explicitly does NOT do

No flag enabled · no award producer wired · no Arena UI · no HTTP route exposed · no XP value or milestone definition created · no row written · no data migrated · no existing table/column/constraint altered or dropped. Production stays dormant and behaviour-neutral.

---

### Appendix A — Compatibility invariants (do not regress)

- **Event Fabric:** Reputation/Identity record refs-only facts into the `event_bus` table via `appendEvent` (deterministic id = `sha256(tenant|type|source|dedupeKey)`), idempotent, no fanout. The reputation source tag is `reputation`; identity is `identity`. The Arena-named `ARENA_POINTS_CHANGED@1` / `ACHIEVEMENT_UNLOCKED@1` contracts are **retained (replay-safe) but deprecated** — no producer emits them.
- **Identity:** consumed READ-ONLY by Reputation (`findOperatorById`); Reputation never mutates identity.
- **Reputation:** append-only ledger; standing is a deterministic fold in `[createdAt, id]` order floored at 0; canonical scoring policy lives in `lib/reputation/scoring.ts` (Arena re-exports it); recovery via `lib/reputation/reconcile.ts` re-derives identical event ids (admin-gated, read-only on the ledger).
- **Replay:** additive/versioned contracts; historical rows validate against their own version; the fold is order-independent.
