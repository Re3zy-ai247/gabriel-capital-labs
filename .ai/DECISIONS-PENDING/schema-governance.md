# Decision package: migration-first vs runtime self-heal

**Status: DECISION RECORDED (2026-07-20) — staged implementation pending owner scheduling.**

> **Owner principle (stated 2026-07-20):** migrations are the authoritative mechanism for planned production schema evolution; runtime self-heal remains ONLY for the explicitly enumerated legacy tables and must never become the default for a new model; every new feature schema change ships with a migration and a rollback plan; legacy self-heal dependencies retire incrementally. This matches the recommendation below. No risky production schema conversion is performed in this release.

**Original status when written: DECISION REQUIRED — owner.** Nothing has been changed. This document
presents evidence and a recommendation; it does not pick a side by implementing one.

**Why it exists.** The Verified Launch Hardening sprint asked for a migration-first
workflow. ADR-0001 deliberately chose runtime self-heal. Both cannot be true at
once, and today the repository half-lives in each — which is the actual risk.

---

## 1. Repository evidence

| Fact | Value |
|---|---|
| Models declared in `prisma/schema.prisma` | **26** |
| Tables created at runtime by self-heal DDL | **23** |
| Tables created ONLY at runtime, absent from `schema.prisma` | **15** |
| `prisma/migrations/` directory | **does not exist** |
| Build-time schema mutation | **removed** (2026-07-20, commit `7e5dc85`) |
| `ensure*` gate functions | 8 (`ensureAttachmentTable`, `ensureBriefTables`, `ensureCommunityTables`, `ensureDigestColumn`, `ensurePasswordResetTable`, `ensurePushTable`, `ensureRateLimitTable`, `ensureSupportTables`) |

### The 15 tables with no schema.prisma declaration

`Campaign` · `ClientAssignment` · `DecisionRegistry` · `KernelAudit` · `KernelEvent` ·
`KernelIdempotency` · `MailManifest` · `OutcomeConsent` · `StripeWebhookEvent` ·
`TeamInvitation` · `TeamMember` · `TradelineContact` · `UserDevice` · `UserSession` ·
`VerifiedOutcome`

Three of those carry money or consent state: **`StripeWebhookEvent`** (webhook
idempotency), **`OutcomeConsent`** (user consent), **`VerifiedOutcome`** (the outcome
ledger).

### How the contradiction became dangerous

Until 2026-07-20 the build ran `prisma db push --accept-data-loss`. Because `db push`
reconciles the database *to* `schema.prisma`, those 15 undeclared tables were exactly
the set it was entitled to drop — and the Prisma CLI's own output confirmed it was
executing schema steps on most builds. That is now removed, so the two models coexist
without actively destroying each other. **The contradiction is currently dormant, not
resolved.**

---

## 2. Production risk of each model

### Staying with self-heal (ADR-0001)

- **No schema history.** There is no record of when a column appeared, and no way to
  reproduce a past schema. Debugging "when did this change?" has no answer.
- **No rollback path.** A code rollback does not roll back a table; the runtime
  recreates it on next use.
- **Cold-start DDL on request paths.** `ensureCommunityTables` fires 8 statements
  behind a per-instance flag, so every new serverless instance pays it on the first
  request that touches the feature.
- **Drift is silent by design.** A model in `schema.prisma` with no matching DDL, or
  DDL with no model, produces no error until the query that needs it runs.
- **But: it has never caused a production outage**, and it survives a platform where
  build-time migration was unreliable.

### Moving to migration-first

- **The transition itself is the risk.** Introducing `prisma/migrations` against a
  live database requires a correct baseline; a wrong baseline makes Prisma believe it
  must create tables that already hold customer data.
- **Adding the 15 tables to `schema.prisma` is not free.** A model present in the
  schema but absent from the database fails *every* query against it. The ordering —
  DDL first, deploy second — must hold for each one.
- **Gains what self-heal cannot give:** reviewable schema diffs in pull requests, a
  reproducible schema for the preview database (now separate), an actual rollback
  story, and removal of DDL from request paths.

---

## 3. Recommendation

**Adopt migration-first for everything new; leave the existing 15 where they are
until each is individually migrated.** Do not attempt a big-bang conversion.

The reasoning: every *future* schema change is where the pain is cheapest to avoid,
and the existing 15 are already working. A conversion sprint would take on the
baseline risk for all 15 at once in exchange for tidiness, which is the wrong trade
for a product with paying customers.

### Staged transition

| Stage | Action | Reversible? |
|---|---|---|
| 0 | **Freeze the split.** No new self-heal-only tables. New tables go to `schema.prisma` + a migration. | yes |
| 1 | Baseline: `prisma migrate diff` from the live database to an initial migration, marked applied. Changes nothing in the database. | yes — delete the directory |
| 2 | New changes only: every new column/table ships as a migration, applied before deploy. | yes |
| 3 | Adopt the 15 opportunistically: when a table is next touched, declare it and generate a no-op migration proving schema and database agree. | yes, per table |
| 4 | Retire `ensure*` calls from request paths once their tables are declared. | yes |

**Do not attempt stage 3 for `StripeWebhookEvent`, `OutcomeConsent` or
`VerifiedOutcome` without a verified backup**, since a baseline error there touches
money or consent records.

### Rollback

Stages 0–2 are reversible by deleting `prisma/migrations` and reverting the commit;
the database is untouched by the baseline. Stage 3 is reversible per table. The
irreversible step would be applying a destructive migration — which the release
runbook already forbids.

### Safe to do before the decision

- Keep build-time schema mutation removed. **Already done** (`7e5dc85`, guarded by
  `scripts/schema-safety.test.ts`).
- Keep the self-heal inventory pinned so adding a sixteenth undeclared table is a
  conscious act. **Already done** (same guard).
- Nothing else. Both stage 1 and declaring any of the 15 change how production
  resolves its schema and need the owner's decision first.

---

## 4. What the owner is deciding

1. Migration-first for new changes — yes or no?
2. If yes: run stage 1 baseline now, or after Sprint 6?
3. Does ADR-0001 get superseded, or amended to "self-heal is the legacy mechanism
   for the 15 named tables, migrations are the mechanism for everything else"?

The third question matters most. ADR-0001 is currently written as *the* schema
mechanism; leaving it unamended while behaving differently is how the last
contradiction went unnoticed for months.
