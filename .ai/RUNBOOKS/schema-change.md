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
2. Generate the migration SQL. There is no `prisma/migrations/` baseline yet, so the
   first migration must baseline the existing DB before it can be applied cleanly —
   see "Baseline" below. Generate the forward SQL with
   `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script` (or `migrate dev` against a throwaway/preview DB) and review it.
3. **Validate against the PREVIEW database first** (it is isolated — see below). Never
   against production, never in the build.
4. Ship: the migration is applied as a deliberate release step (owner-gated for
   production), with preflight, forward-validation, and a rollback/compensating plan
   recorded in the release checklist (`.ai/RUNBOOKS/release.md`).
5. Static DDL only if any raw SQL is unavoidable — never interpolate input.

**Every migration records:** preflight · expected SQL effect · forward validation ·
rollback or compensating plan · data-risk assessment. A destructive or uncertain
production migration STOPS for owner approval.

## Baseline (the first migration)
`prisma/migrations/` does not exist. Introducing it against the live DB needs a
baseline so Prisma does not try to recreate existing tables. Do this against the
preview DB first and validate, then treat the production baseline as an owner-gated
release step. Do NOT run `migrate dev`, `db push --accept-data-loss`, or any
destructive command against the shared/production database.

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

## Preview database (added 2026-07-20)

Preview has its OWN Prisma Postgres database (`prisma-postgres-coffee-drawer`), separate from
production. It starts empty. To provision or re-sync its schema — explicitly, never in a build:

```bash
vercel env pull /tmp/p/.env.preview --environment=preview
DATABASE_URL="<the preview value>" npx prisma db push --skip-generate
```

Rules: never pass `--accept-data-loss`; verify the target is the preview database first
(`SELECT current_database()`, and confirm the table count is what you expect) — production's
`DATABASE_URL` is SENSITIVE and unreadable, so a mistake here cannot be undone by re-reading it.
Delete the pulled env file afterwards; it contains a live credential.
