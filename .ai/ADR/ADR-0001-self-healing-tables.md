# ADR-0001: Self-healing tables instead of Prisma migrations

Status: **SUPERSEDED for NEW schema by the migration-first policy (owner-ratified 2026-07-20).** Retained as ACCEPTED for the 32 enumerated LEGACY tables only (`LEGACY_SELF_HEAL_ALLOWLIST` in `scripts/schema-safety.test.ts`), which self-heal until retired incrementally through reviewed migrations. All NEW tables/columns/indexes/relations/constraints/enums/models are migration-first (`.ai/RUNBOOKS/schema-change.md`); no new feature may introduce or depend on runtime-created schema; the guard fails on any self-heal DDL outside the legacy allowlist. Adding a table to that allowlist requires a new owner-approved ADR.

Original status: Accepted (in production since ~2026-06; recorded retroactively 2026-07-12)
Date: 2026-07-12 (recorded)
Decision owners: Owner + Claude Code sessions

## Context
The application reads through a Prisma Accelerate proxy, and this ADR was written believing `prisma db push` **silently failed** through it — so the build tolerated a failing push and schema arrived only via runtime self-heal DDL.

> **CORRECTION (2026-07-20 — production truth).** The premise was wrong, or stopped being true. Vercel build logs for both production and preview show `prisma db push --skip-generate --accept-data-loss` **succeeding** against a direct endpoint: `Datasource "db": PostgreSQL database "postgres", schema "public" at "db.prisma.io:5432"` → `Your database is now in sync with your Prisma schema`. `DATABASE_URL` is a single value shared by Production and Preview, so any branch's preview build ran it against the production database.
>
> Because `db push` makes the database match `schema.prisma`, it drops tables the schema does not declare — and 15 tables here are deliberately self-heal-owned and absent from `schema.prisma`, including `VerifiedOutcome` (the outcome ledger, ADR-0014), `OutcomeConsent`, and `StripeWebhookEvent` (webhook dedupe).
>
> **The push was not idling.** The Prisma CLI (`node_modules/prisma/build/index.js`) branches on the outcome: it prints `The database is already in sync with the Prisma schema.` only when `warnings.length === 0 && executedSteps === 0`, and otherwise prints `🚀 Your database is now in sync with your Prisma schema.` Our build logs printed the **latter**, so schema steps were **executed on every build**. No data-loss warning block appeared in the sampled builds, which means the steps taken at those moments were non-destructive — consistent with dropping self-heal tables while they were still *empty* (Prisma warns only when rows would be lost). The danger is therefore precise: once any of those tables holds rows, the same command drops it **with data present**, and `--accept-data-loss` is exactly the flag that suppresses the refusal.
>
> **The decision below still stands and is now enforced rather than assumed:** schema reaches production only through runtime self-heal DDL or an explicit reviewed migration. No build step may mutate the database. Both build commands had the push removed; `scripts/schema-safety.test.ts` pins it, along with the inventory of self-heal-owned tables so the two-world split stays a conscious decision.

## Decision
New tables/columns are created **at runtime** via idempotent raw SQL (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE … ADD COLUMN IF NOT EXISTS`) inside per-domain gate functions called before first use. The Prisma model is still added to `schema.prisma` + `npx prisma generate` for the typed client and build.

## Alternatives considered
- Legacy migrate route `app/api/admin/migrate/route.ts` (still works; needs ADMIN session; manual) — kept as fallback.
- Direct-connection migrations — rejected: no direct URL in the pipeline; breaks mobile-only workflows.

## Consequences
Schema changes deploy with code, no manual step, works through Accelerate. Cost: schema drift between `schema.prisma` and prod is possible if a gate function is forgotten; every new model MUST get a gate function.

## Security implications
Raw SQL is static DDL strings only — no user input interpolation. Keep it that way.

## Compliance implications
None.

## Migration or rollback plan
Gate functions are idempotent; rollback = deploy prior code (tables remain, unused).

## Evidence
`lib/community.ts` (`ensureCommunityTables`), `lib/support.ts` (`ensureSupportTables`), `lib/brief.ts` (`ensureBriefTables`, incl. `videoUrl` ALTER), `lib/billing.ts` (dedup ledger), `lib/furnisher.ts` (`TradelineContact`), `lib/rateLimit.ts` (`RateHit`). Verified on prod repeatedly (e.g. `BriefComment` tables self-created on first request, 2026-06-25).
