# CreditVector™ — Claude working notes

CreditVector™ (by **Gabriel Capital Labs**) — a Next.js 14 credit-dispute **education** SaaS.
This file is the fast-start: read it instead of re-reading the whole tree.

## Stack
- Next.js 14 App Router · Prisma over a **Prisma Accelerate** proxy · NextAuth (JWT, credentials — login by **email OR username**) · Stripe-hosted Checkout · Anthropic SDK (Opus 4.8).
- Brand single-source-of-truth: `lib/brand.ts`. CROA compliance scrubber: `lib/compliance.ts`.

## Deploy
- **Prod:** https://www.creditvector.app · Vercel project `gabriel-capital-labs` (team `rey-gabriel-s-projects`), CLI auth'd as `re3zy-ai247`, repo is `vercel link`-ed.
- **Push to `main` → Vercel auto-deploys.** Use `npx vercel ...` (no global binary).
- **Env-var change only (no code):** redeploy the latest build → `npx vercel redeploy <prod-deployment-url>` (get it from `npx vercel ls gabriel-capital-labs --prod`).
- Build runs `prisma db push` from **`vercel.json` buildCommand** (NOT package.json).
- No local `DATABASE_URL`/`ANTHROPIC_API_KEY` — verify with `npx tsc --noEmit` + `npx next build` + `npx tsx scripts/*.test.ts`, and `curl` prod for auth gates.

## ⚠️ Critical gotchas
1. **Schema-sync:** `prisma db push` **silently fails** through Accelerate; editing `schema.prisma` does NOT reach prod.
2. **Self-healing tables (preferred way to add a table):** new tables create themselves at runtime via `CREATE TABLE IF NOT EXISTS` raw SQL inside a gate function — `ensureCommunityTables` (`lib/community.ts`), `ensureSupportTables` (`lib/support.ts`), the dedup ledger in `lib/billing.ts`. Runtime raw SQL works through Accelerate even though build-time push doesn't. No migrate, works on mobile. Still add the Prisma model to `schema.prisma` for the typed client + build, then `npx prisma generate`.
3. **Legacy migrate route** (`app/api/admin/migrate/route.ts`) still works but now needs an **ADMIN session** (`SETUP_SECRET` was deleted 2026-06-16): run from the owner's browser console → `fetch('/api/admin/migrate',{method:'POST'}).then(r=>r.json()).then(console.log)`. Prefer self-heal for new tables.
4. **Owner/ADMIN:** username `CEOGABRIEL` (login email being changed to `reygabriel@creditvector.app`). Sessions resolve by **user id**, not email. `currentUserOrDemo()` returns null in prod.
5. **Client/server split:** a `"use client"` page must NOT import a module that pulls in `prisma`/`next/headers`. Keep shared constants in a `*Shared.ts` (see `lib/communityShared.ts`, `lib/supportShared.ts`).

## Status (2026-06-17)
- **Go-live audit: GREEN** (all 6 dimensions). Static: `tsc --noEmit` clean, `classify.test.ts` 29/29. Live prod probes: public 200; every protected API 401/403; admin routes + `/api/admin/migrate` 403; unsigned Stripe webhook 400. Dimensions: `auth-security`, `croa-legal`, `email-change`, `session-12` (session integrity), `stripe-live`, `billing-entitlements`.
- **Stripe LIVE** (`sk_live`); webhook (`/api/stripe/webhook`, 5 events) verified with a real $1 charge; live catalog synced; letter-pack credits idempotent.
- **Shipped:** account-email change (Settings) — **now requires current-password confirmation** (`bcrypt.compare`, 403 on mismatch; UI prompts only when the email actually changes); **Community Hub + Kai** master agent (Opus 4.8, CROA-reviewed — bankruptcy answer approved); **Support ticket center** (`/support`, all plans, admin staff view); **MDG creditor-classification fix** (AI now judges `creditorKind`); `agency/enable` ADMIN-escalation removed; `invoice.payment_succeeded` handler.

## Pending / next tasks
- [x] **Go-live audit — DONE 2026-06-17:** all 6 dimensions green (see Status).
- [ ] **User-side Stripe (owner does these):** set merchant-notification email to `reygabriel@creditvector.app`; enable **Customer emails → Successful payments**.
- [ ] **MDG verify:** click **Re-analyze report** on Tradelines to reclassify existing tradelines with the new classifier.

## File map
- **Stripe:** `lib/stripe.ts` (catalog), `lib/billing.ts` (sub sync + `creditLetters`), `app/api/stripe/{checkout,webhook,portal}`.
- **Entitlements/tiers:** `lib/entitlements.ts` (free=3/mo no-AI, premium=unlimited+AI, agency/agency_pro=full+isAgency, Agency cap 50 clients).
- **Report ingestion / accuracy:** `lib/aiParse.ts` (AI extraction incl. `creditorKind`), `lib/parse.ts` (regex fallback), `lib/classify.ts` (creditor kind/type, `scripts/classify.test.ts`), `lib/analyze.ts` (pipeline).
- **Letters:** `lib/letter.ts`, `lib/obsolescence.ts` (7yr/10yr §605).
- **Community/Kai:** `app/community/*`, `app/api/community/*`, `lib/community.ts` (+ `lib/communityShared.ts`), `lib/kai.ts`.
- **Support:** `app/support/page.tsx`, `app/api/support/*`, `lib/support.ts` (+ `lib/supportShared.ts`).
- **Admin:** `app/admin/*`, `app/api/admin/*` (gated by `requireAdmin`). **Auth/session:** `lib/auth.ts`, `lib/session.ts`.

**CROA bar:** never guarantee deletion or score increases; no §609 / Metro-2 deletion myths; don't promise removal of accurate negative items. Kai + letters run through `lib/compliance.ts`.
