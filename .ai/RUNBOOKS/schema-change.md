# Runbook: Schema change — MIGRATION-FIRST (owner-ratified 2026-07-20)

Editing `schema.prisma` alone does NOT reach prod. (⚠️ Corrected 2026-07-20: the old claim that `db push` "silently fails through Accelerate" was FALSE — build logs showed it SUCCEEDING against a direct endpoint and dropping self-heal-owned tables. The push has been removed from all build commands; see ADR-0001's correction note.)

## POLICY (owner-ratified 2026-07-20): MIGRATION-FIRST for all new schema

Migrations govern every new table, column, index, relation, constraint, enum, and
model. **Runtime self-heal is LEGACY** — permitted only for the tables already on
the `LEGACY_SELF_HEAL_ALLOWLIST` in `scripts/schema-safety.test.ts`. A new feature
must NOT self-heal; the guard fails on any self-heal DDL outside that list. Adding a
table to the legacy list requires a new owner-approved ADR.

## Adding a table or column (migration-first)
1. Add/modify the model in `prisma/schema.prisma`.
2. Generate the migration SQL. This repository now has the reviewed six-file
   `prisma/migrations/` baseline, but Production history remains owner-gated and
   unknown until Gate D. Do **not** use this generic procedure to reconcile that
   baseline; follow `RUNBOOKS/gate-d-production-migration.md`. For later additive
   work, append a reviewed migration after the committed chain. Generate forward SQL with
   `npx --no-install prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script` (or `migrate dev` only against an owner-proven disposable target) and review it.
3. **Validate only against a disposable target whose isolation is freshly proved**
   (see below). Never presume a Vercel Preview target is isolated; never validate
   against Production or in the build.
4. Ship: the migration is applied as a deliberate release step (owner-gated for
   production), with preflight, forward-validation, and a rollback/compensating plan
   recorded in the release checklist (`.ai/RUNBOOKS/release.md`).
5. Static DDL only if any raw SQL is unavoidable — never interpolate input.

**Every migration records:** preflight · expected SQL effect · forward validation ·
rollback or compensating plan · data-risk assessment. A destructive or uncertain
production migration STOPS for owner approval.

## Baseline (Gate D only)
The source baseline is already committed as the six reviewed migrations. Production
adoption is not a generic schema-change operation: use the dedicated Gate D runbook's
read-only catalog proof, owner-approved reconciliation, and deliberate deploy steps.
Do NOT run `migrate dev`, `db push --accept-data-loss`, or any destructive command
against a shared/production database.

## Legacy self-heal (existing tables only — do NOT extend)
The 32 legacy tables in `LEGACY_SELF_HEAL_ALLOWLIST` still create themselves via
`CREATE TABLE IF NOT EXISTS`/`ALTER TABLE … ADD COLUMN IF NOT EXISTS` gate functions
(`ensureCommunityTables` in `lib/community.ts`, etc.). These retire incrementally
through separately reviewed migrations. Do not add a new table here.

## Legacy fallback
`app/api/admin/migrate/route.ts` — needs ADMIN session; run from the owner's browser console:
`fetch('/api/admin/migrate',{method:'POST'}).then(r=>r.json()).then(console.log)`

## Client/server rule
A `"use client"` page must not import anything pulling in `prisma`/`next/headers` — shared constants go in a `*Shared.ts`.

## Preview / disposable target status

Repository history names a Preview Prisma Postgres project, but its current separation,
emptiness, credential routing, and relationship to Production are **UNKNOWN until the
owner proves them from current provider-side evidence**. Treat every nonlocal Preview or
staging target as potentially shared until that proof is retained with the change.

`db push` is a legacy synchronizer, not a Gate D procedure. It is prohibited for
Production, shared Preview/staging, or any target whose migration history matters.
It may be considered only for a newly-created, owner-approved disposable database after
fresh provider evidence proves isolation; never use an ambient or broadly pulled
credential, never run it in a build, and never pass `--accept-data-loss`.

For the committed migration chain, use `prisma migrate deploy` only through the
owner-gated Gate D runbook. Its documented local disposable engine proof deliberately
does not use Vercel credentials or the application Docker path.
