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

## Status (2026-06-18)
- **Frontend redesign SHIPPED** — premium navy/blue/teal fintech system. Repaletted tokens (`tailwind.config.ts` + `app/globals.css`: navy `ink` surfaces, blue→teal `brand` primary, **green kept only as `success`**), Plus Jakarta Sans, tinted shadows + marketing utilities (`.container-x/.section/.eyebrow/.h-display`). New `components/marketing/*` (SiteNav, SiteFooter, Showcase, DashboardPreview, AuthLayout, LegalShell). Rebuilt landing (all required sections), pricing, login, register; added custom `not-found.tsx` + `/legal/{privacy,terms}`. Logo reverted to the owner's real **3D shield** (`public/logo-mark.png`, drop-shadow removed via PIL). Every in-app page inherits the new look through the token classes (no per-page rewrite). Font swapped Inter→Plus Jakarta Sans. `theme-color` → `#060a14`. **Follow-up:** `og-image.png` + favicon PNGs are still the older shield render (on-brand, not regenerated from the de-shadowed mark).
- **Attachment/upload security review DONE & hardened** — stream route adds `X-Content-Type-Options: nosniff` + sandbox CSP + `X-Frame-Options: DENY`, authorizes (incl. community parent-existence) **before** decrypting; `validateFiles` sniffs magic bytes vs declared MIME; `deleteAttachmentsFor` sweeps orphaned attachments on community thread/reply delete.
- **`Report.rawText` ENCRYPTED at rest + rate limiting + brand assets SHIPPED 2026-06-18** (built via 3 parallel subagents + central verification). rawText → AES-256-GCM (`lib/docCrypto` `encryptText`/`decryptText`, dual-read of legacy plaintext, no schema change); `/api/admin/encrypt-reports` backfills existing rows (one-time admin POST). DB-backed `RateHit` self-heal rate limiter on register/ask-kai/strategist/letters/support (fails open). Favicon/PWA/OG regenerated from the de-shadowed shield. Verified: `prisma generate`+`tsc`+`next build` green, crypto round-trip/dual-read/tamper tested.
## Status (2026-06-17)
- **Attachments (support + community):** image/PDF uploads with drag-drop + paste-a-screenshot on every composer (new ticket, ticket reply, new thread, thread reply). Stored AES-256-GCM-encrypted (`Attachment` model, self-heal table, reuses `DOCUMENT_ENCRYPTION_KEY`); served only via the ownership-checked `GET /api/attachments/[id]`. Limits: images+PDF, 10MB/file, 5/post. Compose routes are now `multipart/form-data`.
- **Furnisher address auto-fill:** the AI parser now extracts each account's Contact block (name + mailing address) into a self-heal `TradelineContact` table; the Dispute Letter Builder pre-fills the recipient name + address (editable), and the generate route falls back to it when blank. Existing accounts need a **Re-analyze** to backfill.
- **Go-live audit: GREEN** (all 6 dimensions). Static: `tsc --noEmit` clean, `classify.test.ts` 29/29. Live prod probes: public 200; every protected API 401/403; admin routes + `/api/admin/migrate` 403; unsigned Stripe webhook 400. Dimensions: `auth-security`, `croa-legal`, `email-change`, `session-12` (session integrity), `stripe-live`, `billing-entitlements`.
- **Stripe LIVE** (`sk_live`); webhook (`/api/stripe/webhook`, 5 events) verified with a real $1 charge; live catalog synced; letter-pack credits idempotent.
- **Kai hardened against prompt injection / scope abuse / prompt-extraction** (`lib/kai.ts`): absolute SECURITY & SCOPE block (credit-only, refuse code/off-topic, never reveal the system prompt, never emit secrets, compliance rules can't be waived); forum post fenced in BEGIN/END markers labeled UNTRUSTED; `sanitizeForPrompt()` caps length + strips fence-spoofing (`scripts/kai-sanitize.test.ts`, 8/8). **Verified architectural fact: no secret/env var is ever interpolated into ANY AI prompt — keys are only SDK constructor args. Kai has no tools/DB/secrets, so it cannot exfiltrate data.**
- **Strategist plan now renders as markdown** (`components/Markdown.tsx`, a tiny dependency-free renderer: headings, bold/italic/code, GFM tables, hr, lists) instead of a raw `<pre>`.
- **Shipped:** account-email change (Settings) — **now requires current-password confirmation** (`bcrypt.compare`, 403 on mismatch; UI prompts only when the email actually changes); **Community Hub + Kai** master agent (Opus 4.8, CROA-reviewed — bankruptcy answer approved); **Support ticket center** (`/support`, all plans, admin staff view); **MDG creditor-classification fix** (AI now judges `creditorKind`); `agency/enable` ADMIN-escalation removed; `invoice.payment_succeeded` handler.

## ▶ NEXT SESSION — resume here (updated 2026-06-18; encryption + rate limiting + redesign all shipped to `main`)
Pre-launch checklist — **all CODE items done; only owner/counsel actions remain (#4, #5, #6).**
1. ✅ **DONE (2026-06-18) — attachment / file-upload security review + hardening.** nosniff + sandbox CSP + X-Frame-Options on the stream route, authorize-before-decrypt (+ community parent-existence check), magic-byte MIME sniffing in `validateFiles`, orphan-attachment cleanup on thread/reply delete. **→ Top remaining item is now #2.**
2. ✅ **DONE (2026-06-18) — `Report.rawText` encrypted at rest.** AES-256-GCM via `lib/docCrypto` (`encryptText`/`decryptText`/`isEncryptedText`; self-describing `cv1:` string; **backward-compatible dual-read** of legacy plaintext; no schema change). Encrypt on write (`reports/upload`), decrypt on read (`reports/analyze`, `identity/discrepancies` — keeps its `where:{rawText:{not:null}}` query since ciphertext is non-null). **⚠️ ONE-TIME OWNER ACTION — encrypt EXISTING rows:** as admin run `fetch('/api/admin/encrypt-reports',{method:'POST'}).then(r=>r.json()).then(console.log)` (idempotent backfill route).
3. ✅ **DONE (2026-06-18) — rate limiting.** DB-backed fixed-window limiter (`lib/rateLimit.ts`) on a self-healing `RateHit` table (`CREATE TABLE IF NOT EXISTS` via Accelerate; **fails OPEN** on any error). register 5/10m (per-IP); ask-kai 20/h, strategist 10/h, letters 40/h, support 10/h (per-user) → 429 + `Retry-After` before any expensive work.
4. **User-side Stripe (owner does these):** set merchant-notification email to `reygabriel@creditvector.app`; enable **Customer emails → Successful payments**.
5. **MDG verify:** click **Re-analyze report** on Tradelines (also backfills furnisher addresses).
6. **CROA/legal positioning** — "educational, not credit-repair" framing is a counsel sign-off, not a code task.

Verification baseline (all green at park): `tsc` clean · `next build` ok · `classify.test.ts` 29/29 · `kai-sanitize.test.ts` 8/8.

## File map
- **Stripe:** `lib/stripe.ts` (catalog), `lib/billing.ts` (sub sync + `creditLetters`), `app/api/stripe/{checkout,webhook,portal}`.
- **Entitlements/tiers:** `lib/entitlements.ts` (free=3/mo no-AI, premium=unlimited+AI, agency/agency_pro=full+isAgency, Agency cap 50 clients).
- **Report ingestion / accuracy:** `lib/aiParse.ts` (AI extraction incl. `creditorKind`), `lib/parse.ts` (regex fallback), `lib/classify.ts` (creditor kind/type, `scripts/classify.test.ts`), `lib/analyze.ts` (pipeline).
- **Letters:** `lib/letter.ts`, `lib/obsolescence.ts` (7yr/10yr §605). Furnisher mailing contact: `lib/furnisher.ts` (self-heal `TradelineContact`), parsed in `lib/aiParse.ts`, pre-filled in `app/letters/page.tsx`.
- **Community/Kai:** `app/community/*`, `app/api/community/*`, `lib/community.ts` (+ `lib/communityShared.ts`), `lib/kai.ts`.
- **Support:** `app/support/page.tsx`, `app/api/support/*`, `lib/support.ts` (+ `lib/supportShared.ts`).
- **Attachments:** `lib/attachments.ts` (server, `Attachment` model) + `lib/attachmentsShared.ts` (client-safe), `components/Attachments.tsx` (`AttachmentPicker`/`AttachmentList`/`imagesFromClipboard`), `app/api/attachments/[id]` (auth'd stream).
- **Admin:** `app/admin/*`, `app/api/admin/*` (gated by `requireAdmin`). **Auth/session:** `lib/auth.ts`, `lib/session.ts`.
- **AI safety:** `lib/kai.ts` (Kai system prompt + injection defenses), `lib/compliance.ts` (CROA scrubber), `components/Markdown.tsx` (renders AI markdown output). All AI surfaces: `lib/kai.ts`, `lib/aiParse.ts`, `lib/letter.ts`, `app/api/strategist/plan`, `lib/round2.ts`, `app/api/identity/*` — none ever puts a secret in a prompt.

**CROA bar:** never guarantee deletion or score increases; no §609 / Metro-2 deletion myths; don't promise removal of accurate negative items. Kai + letters run through `lib/compliance.ts`.
