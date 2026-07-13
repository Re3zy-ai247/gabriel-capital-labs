# ADR-0001: Self-healing tables instead of Prisma migrations

Status: Accepted (in production since ~2026-06; recorded retroactively 2026-07-12)
Date: 2026-07-12 (recorded)
Decision owners: Owner + Claude Code sessions

## Context
The database is reached only through a Prisma Accelerate proxy. `prisma db push` **silently fails** through Accelerate — schema edits never reach prod, and the Vercel build tolerates the push failing (`vercel.json` buildCommand). There is no direct-connection migration path in the deploy pipeline.

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
