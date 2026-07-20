# Runbook: Schema change (ADR-0001 — no build step may mutate the database)

Editing `schema.prisma` alone does NOT reach prod. (⚠️ Corrected 2026-07-20: the old claim that `db push` "silently fails through Accelerate" was FALSE — build logs showed it SUCCEEDING against a direct endpoint and dropping self-heal-owned tables. The push has been removed from all build commands; see ADR-0001's correction note.)

## Adding a table (preferred: self-heal)
1. Add the model to `prisma/schema.prisma` (typed client + build) → `npx prisma generate`.
2. Create the table at runtime: `CREATE TABLE IF NOT EXISTS …` raw SQL inside a gate function called before first use. Copy an existing gate: `ensureCommunityTables` (`lib/community.ts`), `ensureSupportTables` (`lib/support.ts`), `ensureBriefTables` (`lib/brief.ts`).
3. Static DDL strings only — never interpolate input.

## Adding a column
`ALTER TABLE … ADD COLUMN IF NOT EXISTS "col"` inside the domain's existing gate (example: `videoUrl` in `ensureBriefTables`).

## Legacy fallback
`app/api/admin/migrate/route.ts` — needs ADMIN session; run from the owner's browser console:
`fetch('/api/admin/migrate',{method:'POST'}).then(r=>r.json()).then(console.log)`

## Client/server rule
A `"use client"` page must not import anything pulling in `prisma`/`next/headers` — shared constants go in a `*Shared.ts`.
