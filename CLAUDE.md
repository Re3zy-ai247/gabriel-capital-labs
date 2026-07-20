# CreditVector™ — Claude Code entry point

CreditVector™ (by **Gabriel Capital Labs**) — a Next.js 14 consumer-credit **education** SaaS, LIVE at https://www.creditvector.app with live Stripe billing. This file is the compact fast-start; the governance hub is `.ai/`.

## 🚀 Startup sequence (every session — read these, nothing else by default)
1. This file.
2. [.ai/INDEX.md](.ai/INDEX.md) — routing map; open other `.ai/` docs ONLY when the task matches.
3. [.ai/CURRENT-STATE.md](.ai/CURRENT-STATE.md) — live snapshot + **pending owner actions (raise them)** + next tasks.
4. Files directly related to the task.

**GIOS / kernel work?** Skip the broad corpus — read [architecture/BOOTSTRAP.md](architecture/BOOTSTRAP.md) (5-min) → [architecture/FOUNDER-CONTEXT.md](architecture/FOUNDER-CONTEXT.md) (canonical current truth). These replace the dashboard/journal/ADR sprawl for GIOS context. One concept → one home (FOUNDER-CONTEXT §12).

Binding rules: [.ai/CONSTITUTION.md](.ai/CONSTITUTION.md) (truth labels VERIFIED/INFERRED/PROPOSED/NEEDS CONFIRMATION · reuse-first · small reversible changes · no false completion · token-efficiency protocol). Do NOT bulk-read `.ai/` or the whole tree.

## 🧭 CreditVector Operating System
**Company:** Gabriel Capital Labs · **Product:** CreditVector™
**Mission:** Build the leading AI-powered credit intelligence platform in America.
**North Star:** the **Bloomberg Terminal for consumer credit**.
**Every decision optimizes:** Compliance · Trust · Retention · Revenue · Product quality · User outcomes — and **Stripe/legal/compliance beat growth** when they conflict.

**Before implementing ANY feature — all five reviews must pass** (details: `.ai/SOP/ship-a-feature.md`):
1. **CEO** `/plan-ceo-review` · 2. **Engineering** `/plan-eng-review` · 3. **Design** `/plan-design-review` + `/design-review` · 4. **Compliance** `/compliance-review` (the CCO gate — consumer-finance law; gstack `/cso` is security/STRIDE, NOT legal) · 5. **QA** `/qa` (or `/qa-only`).

**Compliance non-negotiables (the CROA bar):** never promise credit-repair outcomes, guaranteed deletions, or score improvements; no §609/Metro-2 deletion myths; never promise removal of accurate negative items; software-and-education first. `lib/compliance.ts` scrubs letters — marketing/UI copy and Kai hold the same bar. Full domain doc: `.ai/COMPLIANCE.md`.

## gstack
Installed at `~/.claude/skills/gstack` (drives the five-review gate). Use `/browse` from gstack for web browsing; never `mcp__claude-in-chrome__*` tools. Skills list: run `/help` or see gstack's README.

## Stack (VERIFIED)
Next.js 14.2.18 App Router · TS 5.6 · Prisma 5.22 over **Prisma Accelerate** · NextAuth (JWT credentials; login by email OR username) · Stripe-hosted Checkout (LIVE) · Anthropic SDK (`LLM_MODEL`) · Tailwind tokens · next-pwa. Brand source of truth `lib/brand.ts`. Details + file map: `.ai/ARCHITECTURE.md`.

## Essential commands
```bash
npm run typecheck          # tsc --noEmit — required for any code change
npx next build             # required for structural changes
npx tsx scripts/<g>.test.ts  # guard scripts — see .ai/TESTING.md for the map
npm run lint
```
No local `DATABASE_URL`/`ANTHROPIC_API_KEY` — validate statically + `curl` prod auth gates (expect 401/403, never 200-with-effect).

## Deploy (full runbook: `.ai/RUNBOOKS/deploy.md`)
Push to `main` → Vercel auto-deploys prod (~2 min). **Always confirm with the owner before pushing.** Vercel CLI only via `npx vercel` (auth'd `re3zy-ai247`). Env-var-only change → `npx vercel redeploy <latest-prod-url>`. Build command lives in **`vercel.json`**, not package.json.

## ⚠️ Critical gotchas
1. **MIGRATION-FIRST governs all new schema (owner-ratified 2026-07-20, supersedes the old self-heal-first policy).** Every NEW table/column/index/relation/constraint/enum/model ships as a reviewed Prisma migration with preflight, forward-validation, and a rollback plan, applied as a deliberate release step (never in the build). Runtime self-heal (`CREATE TABLE IF NOT EXISTS`) is a **LEGACY mechanism, permitted ONLY for the 32 enumerated legacy tables** in `scripts/schema-safety.test.ts`'s `LEGACY_SELF_HEAL_ALLOWLIST`; adding a table to that list requires a new owner-approved ADR. **No new feature may introduce or depend on runtime-created schema.** Startup may VERIFY required schema but must not silently create new feature schema. **No build step may mutate the database.** Procedure: `.ai/RUNBOOKS/schema-change.md`. Guard: `scripts/schema-safety.test.ts` (fails on any self-heal DDL outside the legacy allowlist).
   ⚠️ **Corrected 2026-07-20 — the old note here said "`prisma db push` silently fails through Accelerate." That was FALSE in current production.** Vercel build logs (prod *and* preview) showed `prisma db push --accept-data-loss` **succeeding** against a direct endpoint (`db.prisma.io:5432`), and `DATABASE_URL` is one shared value across Production+Preview. Since `db push` makes the DB match `schema.prisma`, it was armed to **drop the 15 self-heal-owned tables** — including `VerifiedOutcome`, `OutcomeConsent`, and `StripeWebhookEvent` — on every deploy, from any branch. The Prisma CLI's own branch logic proves the push **executed steps every build** (it prints "now in sync" only when `executedSteps !== 0`; "already in sync" is the no-op message). No data-loss warning appeared in sampled builds, meaning those drops hit *empty* tables — the moment one holds rows, `--accept-data-loss` suppresses the refusal and the rows go. The push has been removed from both build commands.
2. **Client/server split:** `"use client"` pages must not import modules pulling in `prisma`/`next/headers` — shared constants go in `*Shared.ts`.
3. **Owner/ADMIN:** username `CEOGABRIEL`, login email `reygabriel@creditvector.app`. Sessions resolve by **user id**, not email. `currentUserOrDemo()` returns null in prod.
4. **Logo:** `public/logo-mark.png` (real 3D shield) via `components/BrandLogo.tsx` — **never substitute a vector recreation** (`.ai/ASSET-REGISTRY.md`).
5. **No secret ever goes into an AI prompt** — keys are SDK constructor args only. Prompts taking user content keep the untrusted fencing (`.ai/SECURITY.md`, ADR-0005).

## High-risk areas (extra care + the right `.ai/` doc + review gate)
Auth/session (`lib/auth.ts`, `lib/session.ts`) · Stripe/webhook/entitlements · encrypted storage (`lib/docCrypto.ts` pattern is mandatory for new PII) · AI prompts (`lib/kai.ts`, `lib/letter.ts`, `lib/brief*.ts`) · compliance-sensitive copy (letters, Kai, Brief, marketing) · admin routes · `vercel.json`.

## Task workflow & definition of done
7 steps: Orient → Verify → Execute per plan (Goal/Files/Risks/Validation) → Validate (`.ai/TESTING.md`) → update affected `.ai/` docs (always `CURRENT-STATE.md` if state changed) → report **Changed · Validated · Remaining risks · Next task**. Full DoD: `.ai/SOP/ship-a-feature.md`. A task is NOT done until validation actually ran (Constitution Art. X).

## Token-efficiency rules
Read only the startup set + task files · search before opening broad directories · reference canonical docs, don't duplicate them · smallest relevant diff · compact plans and reports · ask only at genuine stop conditions (ambiguous product decision, missing credentials, legal approval needed, conflicting evidence).

## Canonical docs (never create a second source of truth)
`.ai/INDEX.md` routes to: CONSTITUTION · CURRENT-STATE · PRODUCT · ARCHITECTURE · SECURITY · COMPLIANCE · DESIGN-SYSTEM · TESTING · INTEGRATIONS · ROADMAP · TASKS · DECISIONS/ADR · ASSET-REGISTRY · PROMPT-REGISTRY · GIOS-COMPATIBILITY · RUNBOOKS · SOP — plus the CVIOS layer (Phase 2): VISION · CVIOS · executive/ · business-intelligence/ · marketing/ · knowledge/ · improvement/. Historical material (old status logs, pre-2026-07 CLAUDE.md): `.ai/ARCHIVE/` — don't load by default. Root `README/SETUP/DEPLOY/ADMIN_SETUP/USER_GUIDE` are legacy/user-facing; `.ai/` wins on conflict.
