# Runbook — Applying `20260728000000_terms_acceptance` (B-06)

**Status: PREPARED FOR REVIEW · NOT EXECUTED · NOT AUTHORIZED.**
**This document is an execution package, not execution approval. Nothing in it has been run.**

**Scope.** The owner-controlled sequence that takes the `TermsAcceptance` table from "authored in the
repository" to "live, forward-validated, and enforced by deployed code" — in the one order that never
leaves the paid upgrade path broken.

**Out of scope, deliberately.** The Gate D baseline itself (§2 points at the existing runbook rather
than restating it), the four unrelated release PRs (`RC1-RELEASE-SEQUENCE.md`), and any legal
question about acceptance scope, retention or backfill (**COUNSEL REQUIRED**).

**No credential, connection string, secret value, or fingerprint appears in this file, and none may
be added to it.** Every command below takes its target from an environment the operator sets in their
own shell, out of band.

---

## 0. The one-line summary of why order matters

`app/api/stripe/checkout/route.ts` calls `hasAcceptedTermsVersion()` on **every** in-place upgrade,
and `lib/terms.ts` deliberately never catches. **Table absent + code deployed = HTTP 500 on every
in-place upgrade.** Therefore:

```
Gate D baseline  →  backup/snapshot  →  APPLY  →  forward-validate  →  generate + build  →  MERGE (= deploy)  →  smoke test
```

There is **no kill switch** on the gate — that was a deliberate decision so a direct API call cannot
bypass it. The consequence is that this ordering is **not optional**.

---

## 1. Preconditions — all must hold, verified in this order

| # | Precondition | How to check | If it fails |
|---|---|---|---|
| 1.1 | Owner has answered **YES** to "apply the migration" (Wave 2 report decision 13.1) in writing. | — | **STOP.** Nothing below may run. |
| 1.2 | Owner has separately approved the **Gate D baseline** (decision 13.2). Applying *this* migration is impossible without it. | — | **STOP.** Go to §2. |
| 1.3 | A clean checkout of the exact commit that will be deployed, with `node_modules` from `npm ci`. | `git status --porcelain` is empty; `git rev-parse HEAD` recorded in the change log. | **STOP.** Never apply from a dirty tree. |
| 1.4 | The corrective commit **C1** is present — `GATE_D_MIGRATION_CHAIN` in `scripts/gate-d-preflight-core.ts` lists all **seven** migrations. | `npx --no-install tsx scripts/gate-d-preflight.test.ts` completes and prints an `N passed, M failed` line. | **STOP.** Without C1 the guard *throws* (`UnsupportedMigrationSqlError`, verified) and the Gate D preflight tooling cannot produce a manifest at all. |
| 1.5 | Schema and migration are in lockstep. | `npx prisma migrate diff --from-schema-datamodel prisma/schema.prisma --to-migrations prisma/migrations --exit-code` → **exit 0**. | **STOP.** A drifting pair means the applied table would not match the generated client. |
| 1.6 | The migration is still additive. | `npx tsx scripts/terms-acceptance.test.ts` → `0 failed`; `npx tsx scripts/schema-safety.test.ts` → `0 failed`. | **STOP.** |
| 1.7 | The FK is `ON DELETE RESTRICT` in **both** `prisma/schema.prisma` and `migration.sql`. | read both. | **STOP.** `CASCADE` would make a foreign key an erasure mechanism — forbidden by Identity Constitution §12.3/§16/§18. |
| 1.8 | No build step mutates the database. | `vercel.json` `buildCommand` is exactly `prisma generate && next build`; `scripts/schema-safety.test.ts` green. | **STOP.** |
| 1.9 | The connection used below is a **direct** PostgreSQL endpoint, never an Accelerate URL, and matches the grammar constraints in `.ai/RUNBOOKS/gate-d-production-migration.md` §1. | operator-side. | **STOP.** |
| 1.10 | A recovery position exists (§3). | §3. | **STOP** — see §3, this is currently the weakest link. |

---

## 2. Migration-baseline prerequisite — expect `migrate deploy` to FAIL first

**Production carries no `_prisma_migrations` history.** Prisma treats a non-empty database with no
history as un-baselined: `prisma migrate deploy` will refuse, reporting that the database schema is
not empty and pointing at baselining. It will **not** silently apply `0_init` over live tables.

**That refusal is the expected first outcome and is not an incident.** It means the baseline has not
been established yet.

**Do not improvise the baseline here.** The complete, reviewed, owner-gated procedure —
read-only catalog preflight inside an explicit `READ ONLY` transaction, the state taxonomy, the
`prisma migrate resolve --applied` sequence for the prior migrations, and the boundaries on what may
and may not be executed — is **`.ai/RUNBOOKS/gate-d-production-migration.md`**. Execute that runbook
in full, under its own owner approval, **before returning here.**

Two amendments that runbook needs before it is executed, both consequences of this migration
(recorded in `RC1-RELEASE-SEQUENCE.md` §8, items E1/E2):

- its §2 manifest table enumerates **six** migrations; it must be regenerated for **seven** using its
  own review gate — `npx --no-install tsx scripts/gate-d-preflight.ts --manifest` is the authority,
  not the table;
- that command depends on C1 (§1.4).

**Return condition.** Do not proceed past this section until:

```bash
npx prisma migrate status
```

reports the six prior migrations as applied and **exactly one** migration as not yet applied:
`20260728000000_terms_acceptance`.

> If it reports anything else — a different pending set, a failed migration, a checksum mismatch, or
> drift — **STOP** and return to the Gate D runbook. Do not "fix" history by hand.

---

## 3. Backup / snapshot requirement — **currently unsatisfied**

**Do not read this section as confirmation that a backup exists. No backup has ever been verified for
this database, in this repository or in this session.** B-09 (backup/recovery) is recorded as **OPEN**
and the DB provider behind Prisma Accelerate has not been confirmed (`RC1-RELEASE-SEQUENCE.md` §8,
items P4/P5/X4).

Requirement before §4 runs:

1. **Identify the provider** and confirm what point-in-time or snapshot capability actually exists
   (~15 minutes of console work — this is the single highest-leverage unblock in RC1).
2. **Take a snapshot immediately before the apply** and **record its identifier and timestamp** in
   the change log.
3. **Verify the snapshot is restorable** — `.ai/RUNBOOKS/restore-drill.md`. An unrestored snapshot is
   an assumption, not a recovery position.

**Stop condition:** if any of the three is unmet, the honest statement is *"this migration would be
applied with no proven recovery position."* Whether to proceed on that basis is an **OWNER DECISION**
and must be recorded as one — it is not a step this runbook can grant.

Mitigating fact, stated so the decision is proportionate and not so it substitutes for a backup: the
migration is **1 `CREATE TABLE` + 2 `CREATE INDEX` + 1 `ADD CONSTRAINT`**, with **zero** `DROP`, zero
`ALTER` of an existing table, and zero `INSERT`/`UPDATE`/`COPY` (verified in the repository). It
reads, writes, locks-for-write and deletes **no existing row**. The realistic failure mode is the
table failing to be created, not existing data being harmed. That reduces the probability of needing
the backup; it does not create one.

---

## 4. Apply — the only mutating step

Run from the clean checkout of §1.3, with a direct database endpoint exported in the operator's own
shell.

**Dry read first (non-mutating):**

```bash
npx prisma migrate status
```

*Expected:* six applied, one pending — `20260728000000_terms_acceptance`. Anything else → **STOP**.

**Apply:**

```bash
npx prisma migrate deploy
```

*Expected output shape:*

```
6 migrations found in prisma/migrations
Applying migration `20260728000000_terms_acceptance`
The following migration(s) have been applied:
…
All migrations have been successfully applied.
```

> The migration count Prisma prints is informational; the load-bearing line is that
> **`20260728000000_terms_acceptance` and only that migration was applied.** If the output names any
> other migration as being applied, **STOP immediately** and escalate — the baseline is wrong.

**Forbidden at every point in this runbook:** `prisma db push`, `prisma migrate dev`, `prisma migrate
reset`, hand-written DDL, editing `_prisma_migrations`, and any use of an Accelerate URL for a
migration command.

### Failure stop conditions

| Symptom | Meaning | Action |
|---|---|---|
| P3005 / "database schema is not empty" | Baseline never completed. | **STOP.** §2. |
| `0_init` appears in the applied list | Baseline is wrong; catastrophic if it proceeds. | **STOP.** Escalate to the owner immediately. Do not retry. |
| Checksum mismatch on any prior migration | The applied database does not match the repository chain. | **STOP.** Gate D runbook. Do not resolve by hand. |
| `relation "TermsAcceptance" already exists` | The table exists outside migration history. | **STOP.** Do **not** drop it — inspect its row count first (§5). |
| FK creation fails | `User` shape or connection target is not what was assumed. | **STOP.** The table may exist without its constraint — §5 will show it; do not deploy code. |
| Timeout / connection reset mid-apply | Partial state unknown. | **STOP.** Re-run §5 read-only checks before any retry. |
| Any error at all | — | **STOP. Do not deploy application code.** An unapplied or half-applied table plus deployed code = 500 on every in-place upgrade. |

---

## 5. Forward validation — read-only, all four must pass

Run inside an explicitly read-only transaction where the tool permits it. **Zero writes.**

| # | Check | Expected |
|---|---|---|
| 5.1 | `SELECT to_regclass('"TermsAcceptance"');` | non-NULL |
| 5.2 | `\d "TermsAcceptance"` | columns `id`, `userId`, `version`, `context`, `acceptedAt`; `acceptedAt` defaults to `CURRENT_TIMESTAMP`; PK `TermsAcceptance_pkey` |
| 5.3 | `SELECT COUNT(*) FROM "TermsAcceptance";` | **`0`** |
| 5.4 | indexes present | `TermsAcceptance_userId_version_key` (**UNIQUE**) and `TermsAcceptance_userId_acceptedAt_idx` |
| 5.5 | `SELECT confdeltype, convalidated FROM pg_constraint WHERE conname = 'TermsAcceptance_userId_fkey';` | `confdeltype = 'r'` (RESTRICT) and `convalidated = true` |
| 5.6 | `npx prisma migrate status` | all seven applied, none pending, none failed |

**5.3 is the consent check, not a formality.** A non-zero count immediately after apply would mean
something fabricated acceptance. Owner direction #2 forbids that absolutely. **Any count other than
`0` → STOP and escalate before deploying anything.**

**5.5 is the erasure check.** `confdeltype = 'c'` (CASCADE) → **STOP**; a foreign key must never be
the mechanism that destroys consent evidence.

> If §5 does not fully pass, the correct action is **do not deploy the code**. The empty table sitting
> unused harms nothing; the code without the table takes down upgrades.

---

## 6. Prisma client generation and build

The `prisma.termsAcceptance` accessor exists only in a client generated from a `schema.prisma` that
declares the model. Production regenerates it on every Vercel build (`buildCommand` =
`prisma generate && next build`) — no manual generation against production is required or permitted.

Locally, on the exact commit to be deployed:

```bash
npm ci
npx prisma generate
npx tsc --noEmit                 # expect exit 0
npx next build                   # expect exit 0
npx tsx scripts/terms-acceptance.test.ts    # expect "0 failed"
npx tsx scripts/checkout-consent.test.ts    # expect "0 failed"
npx tsx scripts/schema-safety.test.ts       # expect "0 failed"
npx --no-install tsx scripts/gate-d-preflight.test.ts   # expect a "N passed, 0 failed" line
npx --no-install tsx scripts/runtime/run-all.ts         # mocked-runtime guards; expect exit 0
```

**Label discipline.** The last command is a **mocked-runtime** check. It executes the real route
handler against fakes. It is *not* a production verification and must never be reported as one.
Everything else in this list is a **toolchain/source-level** check.

---

## 7. UI availability and server enforcement — one atomic deploy

`components/TermsAccept.tsx` and the three wired upgrade callers (`app/pricing/PricingTiers.tsx`,
`app/billing/page.tsx`, `app/agency/page.tsx`) ship in the **same** commit range as the route gate.
This is enforced, not merely intended: `scripts/terms-acceptance.test.ts` §6 fails if the component
or any caller wiring is missing.

- **Deploying the route without the UI** → the customer receives 428 and has no way to satisfy it.
  Upgrades are dead.
- **Deploying the UI without the route** → cannot happen; the guard fails CI first.
- `app/letters/page.tsx` is deliberately **not** wired. It posts `product: "letters_5"`, which the
  route handles as a `mode: "payment"` Checkout Session before the subscription branch is reached, so
  it can never see the gate. Wiring it would prompt for a gate that does not exist.

**The deploy itself is a merge.** Pushing to `main` auto-deploys production in about two minutes.
Therefore **the merge of the terms PR is the last step of this runbook**, executed only after §5 has
fully passed. See `RC1-RELEASE-SEQUENCE.md` §6 PR-4.

Before merging, confirm the release commit is the one validated in §6 (`git rev-parse HEAD`), and
record it.

---

## 8. Smoke test — after the deploy is live

Confirm the deployed release first (e.g. the release header on a production response) matches the
commit recorded in §7. Then, in this order:

| # | Test | Expected | Notes |
|---|---|---|---|
| 8.1 | Unauthenticated `POST /api/stripe/checkout` | **401**, never 200-with-effect | no Stripe call |
| 8.2 | Authenticated **test account with an active subscription**, POST an upgrade **without** `acceptTerms` | **428** with `termsRequired: true`, a `termsVersion`, and `termsUrl` | **then verify in the Stripe Dashboard that the subscription is unchanged and no invoice was created** — the status code alone proves nothing about Stripe |
| 8.3 | Same account, upgrade **with** `acceptTerms` set to the version the 428 named | **200**, subscription updated | |
| 8.4 | Immediately after 8.3, read the table | exactly **one** row for that user, correct `version`, `context = "stripe_subscription_upgrade"` | |
| 8.5 | Repeat 8.3 | no duplicate row; the **original `acceptedAt` is unchanged** | idempotency by `UNIQUE(userId, version)` |
| 8.6 | Browser: reach the upgrade UI as a subscriber | checkbox renders **unchecked**, links to `/legal/terms`, confirm refuses until checked | keyboard + screen-reader path |
| 8.7 | **New** subscription (no active sub) | unaffected — normal Checkout Session, no 428 | regression check |
| 8.8 | Letter pack purchase | unaffected | regression check |
| 8.9 | An **existing subscriber who never accepted** | is prompted once at their next upgrade, and has **no** pre-existing row | proves nothing was backfilled |

**Use a test account.** Do not run 8.2–8.5 against a real customer's subscription.

**Stop condition:** if 8.2 does not return 428, or Stripe shows *any* change during 8.2, treat it as
an incident and roll back the application (§9) — the gate is the only thing standing between an
in-place price increase and a customer who agreed to nothing.

---

## 9. Rollback considerations — stated honestly

There are two different rollbacks and they are **not** equally safe.

### 9.1 Application rollback — the supported path
`git revert` the terms PR and redeploy. The gate disappears; upgrades return to pre-B-06 behaviour.
Rows already written **persist, are referenced by nothing, and are not orphaned**. No subscription is
touched. **This is the rollback to use.**

*Unproven:* this has not been executed in this environment. It is INFERRED from the repository — the
route is the only reader/writer of the table, and nothing else imports `lib/terms.ts` (verified by
tree-wide grep).

### 9.2 Database rollback — **not proven safe; treat as unavailable**
`DROP TABLE "TermsAcceptance";` is safe **only** in the narrow window where the table is empty *and*
the application code is not deployed — i.e. between §4 and §7, and only if §5.3 returned `0`.

Outside that window it is unsafe in two independent ways:

1. **With the code deployed**, dropping the table breaks every in-place upgrade (§0).
2. **Once the table holds rows**, dropping it destroys consent evidence that **nothing may
   recreate** — there is no backfill and none is permitted (owner direction #2). It is not
   recoverable by re-running the migration.

**The repository cannot prove a database rollback is safe, so this runbook does not claim it is.** If
a state is reached where dropping the table seems necessary, that is an escalation, not a step.

### 9.3 What rollback does *not* undo
Stripe-side subscription changes already made in §8.3 are real. Reverting application code does not
reverse a proration or an invoice. Handle those in Stripe, deliberately.

---

## 10. Post-deploy monitoring — first 24 hours

| Signal | Where | Threshold / action |
|---|---|---|
| 500s on `/api/stripe/checkout` | runtime logs | **any** → suspect the table is missing or unreachable. Roll back the application (§9.1). This is the primary failure mode. |
| 428 rate on the upgrade path | runtime logs | a *nonzero* rate is expected and correct — existing subscribers are being asked once. A rate that never falls, or 428s with no subsequent 200 from the same user, suggests the UI is not letting them through. |
| `TermsAcceptance` row count | read-only query | should grow slowly and only alongside successful upgrades. **A jump uncorrelated with upgrades means something is writing rows that should not be.** |
| Upgrade success count vs. the prior baseline | Stripe Dashboard + logs | a drop to zero = the revenue path is down. |
| Stripe webhook delivery success | Stripe Dashboard | unrelated to this change, but this deploy is the confounder if it regresses. |
| P2003 foreign-key violations on user deletion | runtime logs | **expected and correct** under `ON DELETE RESTRICT`. It means a raw `User` delete was attempted and correctly refused. Erasure is a policy-driven command, not a cascade — route it through the governed path, do not "fix" it by loosening the FK. |

---

## 11. Change-log entries to record (nothing here is complete without them)

Commit SHA applied · exact `migrate status` output before and after · snapshot identifier and
timestamp, **or an explicit owner-signed statement that none existed** · the four §5 results verbatim
· the deployed release identifier · §8 outcomes · who authorized, and when.

---

## 12. Honest status of this document

**Not one command in this runbook has been executed.** No database was contacted, no migration
applied, no deploy triggered, no Stripe object touched, and no production secret read. Section 2's
Gate D dependency, section 3's absent backup, and section 9.2's unprovable database rollback are the
three places where a written procedure is *not* a capability. **A merged runbook is not operational
proof; only a recorded execution is.**
