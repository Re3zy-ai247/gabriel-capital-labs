# Runbook: Schema change — MIGRATION-FIRST (owner-ratified 2026-07-20)

Editing `schema.prisma` alone does NOT reach production. `prisma db push` is not
a release, build, container-startup, or runtime schema procedure: it can
destructively reconcile migration-owned and runtime-owned objects without
preserving reviewed migration history.

## POLICY (owner-ratified 2026-07-20): MIGRATION-FIRST for all new schema

Migrations govern every new table, column, index, relation, constraint, enum, and
model. **Runtime self-heal is LEGACY** — permitted only for the tables already on
the `LEGACY_SELF_HEAL_ALLOWLIST` in `scripts/schema-safety.test.ts`. A new feature
must NOT self-heal; the guard fails on any self-heal DDL outside that list. Adding a
table to the legacy list requires a new owner-approved ADR.

## Adding a table or column (migration-first)
1. Add/modify the model in `prisma/schema.prisma`.
2. Generate the migration SQL. This repository has a reviewed six-file applied
   Gate D baseline plus two acknowledged RC1 authored/unapplied migrations. Before
   DB5, the dedicated runbook requires both authored migrations to be physically
   and historically absent and renders them, with exact checksums/order, only in
   `preDb5AbsenceGate.deployCandidateList`. A
   `READY_FOR_DB5_APPROVAL` result is explicitly non-authorizing. Do **not** use
   this generic procedure to reconcile or apply either set; follow
   `RUNBOOKS/gate-d-production-migration.md`. For later
   additive work, append a reviewed migration after the committed chain. Generate forward SQL with
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
The applied source baseline is committed as six reviewed migrations. The two RC1
authored/unapplied directories remain outside that applied chain until DB5 and
must pass the dedicated exact-absence gate beforehand. Production adoption is not
a generic schema-change operation: use the Gate D runbook's read-only catalog
proof, owner-approved reconciliation, and deliberate deploy steps. DB5 additionally
requires accepted DB4 evidence, rotation of the exposed Production credential
before the next Production DB contact, a fresh hardened backup immediately before
DB5, and explicit Founder approval of the exact two-item checksummed candidate
list. Do not run
`migrate dev`, `db push`, or any destructive schema command against a
shared/production database or from a release/runtime startup surface.

## Legacy self-heal (existing tables only — do NOT extend)
The 32 legacy tables in `LEGACY_SELF_HEAL_ALLOWLIST` still create themselves via
`CREATE TABLE IF NOT EXISTS`/`ALTER TABLE … ADD COLUMN IF NOT EXISTS` gate functions
(`ensureCommunityTables` in `lib/community.ts`, etc.). These retire incrementally
through separately reviewed migrations. Do not add a new table here.

## Client/server rule
A `"use client"` page must not import anything pulling in `prisma`/`next/headers` — shared constants go in a `*Shared.ts`.

## Preview / disposable target status

Repository history names a Preview Prisma Postgres project, but its current separation,
emptiness, credential routing, and relationship to Production are **UNKNOWN until the
owner proves them from current provider-side evidence**. Treat every nonlocal Preview or
staging target as potentially shared until that proof is retained with the change.

`db push` is not a Gate D or RC1 validation procedure. Validate reviewed migration
SQL through the dedicated disposable-engine procedure; never substitute an ambient
credential, a shared Preview target, application container startup, or a
human-triggered DDL API.

For the committed migration chain, use `prisma migrate deploy` only through the
Founder-gated Gate D runbook. Its documented local disposable engine proof
deliberately does not use Vercel credentials or the application Docker path and
supplies no Production authorization.
