# CreditVector™ — Claude working notes

CreditVector™ (by **Gabriel Capital Labs**) — a Next.js 14 credit-dispute **education** SaaS.
This file is the fast-start: read it instead of re-reading the whole tree.

## 🧭 CreditVector Operating System
*The governing doc — every other section serves these rules.*

**Company:** Gabriel Capital Labs · **Product:** CreditVector™

**Mission:** Build the leading AI-powered credit intelligence platform in America.

**Every decision optimizes:** Compliance · Trust · Retention · Revenue · Product quality · User outcomes. *(When these conflict, the override rule below governs: Stripe/legal/compliance beat growth.)*

**Before implementing ANY feature — run all five reviews. No feature ships until all five pass:**
1. **CEO Review** → `/plan-ceo-review` — validate scope, mission fit, North Star.
2. **Engineering Review** → `/plan-eng-review` — architecture, correctness, risk.
3. **Design Review** → `/plan-design-review` (design system) + `/design-review` (visual QA).
4. **Compliance Review** → `/compliance-review` — CreditVector's CCO gate for consumer-finance law (FCRA / FDCPA / CROA / FTC §5 / CFPB-UDAAP / state CSO / Stripe / UDAP), anchored to `lib/compliance.ts` + the **CROA bar** at the bottom of this file. *(gstack `/cso` is the **security**/STRIDE pass — not legal. gstack doesn't know consumer-finance law; `/compliance-review` does.)*
5. **QA Review** → `/qa` (or `/qa-only`).

**Special Compliance Rules (non-negotiable):**
- Never promise credit-repair outcomes.
- Never guarantee deletions.
- Never guarantee score improvements.
- Treat CreditVector as **software and education first**.
- Review every user-facing flow through **CROA, FCRA, CFPB, FTC, and state CSO** risk lenses.
- **Stripe, legal, and compliance concerns override growth concerns.**

**Product North Star:** CreditVector should feel like the **Bloomberg Terminal for consumer credit**.

## gstack
Installed at `~/.claude/skills/gstack` ([Garry Tan's gstack](https://github.com/garrytan/gstack) — turns Claude Code into a virtual engineering team). Drives the five-review gate above.
Use `/browse` from gstack for all web browsing. Never use `mcp__claude-in-chrome__*` tools.
Available skills: `/office-hours`, `/plan-ceo-review`, `/plan-eng-review`, `/plan-design-review`, `/design-consultation`, `/design-shotgun`, `/design-html`, `/review`, `/ship`, `/land-and-deploy`, `/canary`, `/benchmark`, `/browse`, `/open-gstack-browser`, `/qa`, `/qa-only`, `/design-review`, `/setup-browser-cookies`, `/setup-deploy`, `/setup-gbrain`, `/sync-gbrain`, `/retro`, `/investigate`, `/document-release`, `/document-generate`, `/codex`, `/cso`, `/autoplan`, `/pair-agent`, `/careful`, `/freeze`, `/guard`, `/unfreeze`, `/gstack-upgrade`, `/learn`.

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
4. **Owner/ADMIN:** username `CEOGABRIEL`, login email `reygabriel@creditvector.app` (confirmed 2026-06-23). Sessions resolve by **user id**, not email. `currentUserOrDemo()` returns null in prod.
5. **Client/server split:** a `"use client"` page must NOT import a module that pulls in `prisma`/`next/headers`. Keep shared constants in a `*Shared.ts` (see `lib/communityShared.ts`, `lib/supportShared.ts`).

## Status (2026-06-23) — big session: Brief, password reset, email, Web Push, moderation
All shipped to `main` / live on prod; each ran through `/compliance-review`. New self-heal tables: `CommunityReport`, `PasswordResetToken`, `BriefArticle`, `PushSubscription`.
- **CreditVector Brief (Phase 1) SHIPPED** — consumer-credit news feed. `lib/briefShared.ts` (categories + `BRIEF_DISCLAIMER`), `lib/brief.ts` (AI summarizer w/ strict compliance system prompt + `applyCompliance` scrub; `ensureBriefTables`; `BriefArticle` model). Public `/brief` (SSR feed + filters/search) + `/brief/[slug]` (per-article `generateMetadata` SEO/OG); admin `/admin/brief` (paste → **AI summarize** → edit → Publish/Reject/Feature). **Admin-approval-before-publish is THE compliance control** (status defaults `draft`; only admin PATCH→`published`); publish gated behind an attribution/accuracy confirm; summaries re-scrubbed on every write; disclaimer everywhere; source http(s)-validated. **Branded cover/OG images:** `app/api/brief/cover` (edge `next/og`, stateless title+category) via `briefCoverUrl`, used as card/article cover AND OG image. ⚠️ **Feed is EMPTY until the owner publishes** (a CFPB draft was teed up but not published).
- **Self-service PASSWORD RESET SHIPPED + verified end-to-end** — `lib/passwordReset.ts` (`PasswordResetToken` self-heal; sha256-hashed single-use 1h tokens), `POST /api/auth/forgot-password` (rate-limited, anti-enumeration) + `/reset-password` (reuses `lib/password.validatePassword` + bcrypt); `/forgot-password` + `/reset-password` pages; "Forgot password?" on login.
- **Resend transactional email LIVE** — domain `creditvector.app` **VERIFIED** in Resend (DNS added at **Squarespace** = the domain's DNS host; Google Workspace apex email untouched). `lib/email.ts` `sendEmail`/`sendAdminEmail`. Prod env: `RESEND_API_KEY`, `RESEND_FROM=CreditVector <no-reply@creditvector.app>`, `RESEND_REPLY_TO=support@creditvector.app`, `ADMIN_EMAIL=admin@creditvector.app` (the creditvector.app role aliases all route to the owner's Workspace primary). Delivers to ANY recipient now.
- **Community "Report post" MODERATION SHIPPED** — `CommunityReport` model; member `POST /api/community/reports` (rate-limited, idempotent); admin `/admin/reports` queue (`GET`+`PATCH dismiss|remove`, audit-logged); shared `deleteThreadAndAttachments`/`deleteReplyAndAttachments` (DRY'd delete routes + auto-close open reports). Backs the Community Hub launch sign-off.
- **Admin alerts SHIPPED** — `/api/admin/context` returns `openReports`+`pendingBrief` → badges on Sidebar Admin link / AdminTabs / Overview; **email** on first community report + on new Brief draft.
- **Web Push (PWA phone notifications) SHIPPED + VERIFIED on-device (2026-06-24)** — `worker/index.js` (next-pwa custom worker: push+notificationclick), `lib/push.ts` (`web-push` + `PushSubscription` self-heal; `sendPushToUser`/`sendPushToAdmins`; fails safe), `POST /api/push/{subscribe,unsubscribe}`, `components/PushToggle.tsx` ("Enable phone alerts" in Settings). Wired to Brief-draft + community-report alerts (push + email both fire). Prod env: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`. ✅ **Confirmed: Chrome notification banner + email arrive.** ⚠️ **Gotcha fixed (`88f17a6`):** "service worker didn't start" = workbox precaching a 404ing `/_next/app-build-manifest.json` → SW never activated; fixed with `buildExcludes: [/app-build-manifest\.json$/]` in `next.config.js` (PushToggle also got `withTimeout` so it can't hang).
- **Landing copy refresh SHIPPED** — punchier hero, de-jargoned feature eyebrows, new **Community Hub** marketing section + nav + UGC disclaimer.
- **Tooling:** gstack installed (`~/.claude/skills/gstack`; needs `bun`; Playwright browser needs manual `ditto` extract — see the `gstack-playwright-extraction-hang` memory). `/compliance-review` skill created (CCO gate). The **CreditVector Operating System** + gstack sections were added to the top of this file.

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

## ▶ NEXT SESSION — resume here (updated 2026-06-24)
**✅ Done since 06-23:** Web Push CONFIRMED on-device (banner + email); first Brief article **published** (CFPB report — feed live, branded cover + OG verified); email **Reply-To** added (`RESEND_REPLY_TO`=reygabriel@creditvector.app). **Email deliverability:** the new sending domain initially lands in spam — normal reputation warm-up (SPF/DKIM/DMARC all pass, verified); owner marked "not spam"; warms over ~2–4 weeks. Add a `List-Unsubscribe` header when the digest ships.

**Top priorities:**
1. **YouTube embed field for Brief (offered, NOT built).** Add `videoUrl` to `BriefArticle` (self-heal `ALTER TABLE "BriefArticle" ADD COLUMN IF NOT EXISTS "videoUrl" TEXT`), an admin field validated to youtube.com/youtu.be, and an official `<iframe>` embed on the article page. Legal: embedding via the official YouTube player is fine; never download/reupload; prefer official channels.

**Brief roadmap (phased):**
4. **Phase 2:** likes, comments, bookmarks, social shares (reuse the community/report patterns). Also offered-but-unbuilt: stat/data cards (visuals #2), admin image-upload (#3, public-domain/.gov or licensed images only).
5. **Phase 3:** Perplexity automation (needs `PERPLEXITY_API_KEY` + **Vercel Cron** — none configured) → Claude summarize → DRAFT (never auto-publish) → admin approves; + weekly digest email (Resend, domain now verified). **Counsel sign-off on the news-editorial/defamation posture recommended before Phase 3.**

**Parked owner/counsel actions (pre-existing):**
6. **User-side Stripe:** merchant-notification email; enable Customer emails → Successful payments.
7. **MDG verify:** Re-analyze a report (also backfills furnisher addresses).
8. **CROA/legal** "educational, not credit-repair" positioning — counsel sign-off.
9. One-time (if not yet run): `/api/admin/encrypt-reports` backfill of existing rows.

Verification baseline (green at park): `tsc` clean · `next build` ok. Every ship this session passed `/compliance-review`. (`classify.test.ts` 29/29 · `kai-sanitize.test.ts` 8/8 last run.)

## File map
- **Stripe:** `lib/stripe.ts` (catalog), `lib/billing.ts` (sub sync + `creditLetters`), `app/api/stripe/{checkout,webhook,portal}`.
- **Entitlements/tiers:** `lib/entitlements.ts` (free=3/mo no-AI, premium=unlimited+AI, agency/agency_pro=full+isAgency, Agency cap 20 clients).
- **Report ingestion / accuracy:** `lib/aiParse.ts` (AI extraction incl. `creditorKind`), `lib/parse.ts` (regex fallback), `lib/classify.ts` (creditor kind/type, `scripts/classify.test.ts`), `lib/analyze.ts` (pipeline).
- **Letters:** `lib/letter.ts`, `lib/obsolescence.ts` (7yr/10yr §605). Furnisher mailing contact: `lib/furnisher.ts` (self-heal `TradelineContact`), parsed in `lib/aiParse.ts`, pre-filled in `app/letters/page.tsx`.
- **Community/Kai:** `app/community/*`, `app/api/community/*`, `lib/community.ts` (+ `lib/communityShared.ts`), `lib/kai.ts`. **Moderation:** `CommunityReport` model, member `app/api/community/reports`, admin `app/admin/reports` + `app/api/admin/community/reports/*`; shared `deleteThreadAndAttachments`/`deleteReplyAndAttachments` in `lib/community.ts`.
- **CreditVector Brief (news feed):** `lib/brief.ts` + `lib/briefShared.ts` (`BriefArticle` model, AI summarizer); public `app/brief/{page,[slug]/page}.tsx` + `app/api/brief/{route,cover}` (cover = edge `next/og` via `briefCoverUrl`); admin `app/admin/brief/page.tsx` + `app/api/admin/brief/*`; `components/brief/{BriefCard,BriefFeed}.tsx`.
- **Transactional email + auth recovery:** `lib/email.ts` (Resend HTTP API, no SDK). Password reset: `lib/passwordReset.ts`, `app/api/auth/{forgot,reset}-password`, `app/{forgot,reset}-password/page.tsx`.
- **Web Push:** `lib/push.ts` (`web-push`, `PushSubscription` model), `worker/index.js` (next-pwa custom worker), `app/api/push/{subscribe,unsubscribe}`, `components/PushToggle.tsx` (Settings). Admin nav badges via `/api/admin/context` (`openReports`+`pendingBrief`).
- **Support:** `app/support/page.tsx`, `app/api/support/*`, `lib/support.ts` (+ `lib/supportShared.ts`).
- **Attachments:** `lib/attachments.ts` (server, `Attachment` model) + `lib/attachmentsShared.ts` (client-safe), `components/Attachments.tsx` (`AttachmentPicker`/`AttachmentList`/`imagesFromClipboard`), `app/api/attachments/[id]` (auth'd stream).
- **Admin:** `app/admin/*`, `app/api/admin/*` (gated by `requireAdmin`). **Auth/session:** `lib/auth.ts`, `lib/session.ts`.
- **AI safety:** `lib/kai.ts` (Kai system prompt + injection defenses), `lib/compliance.ts` (CROA scrubber), `components/Markdown.tsx` (renders AI markdown output). All AI surfaces: `lib/kai.ts`, `lib/aiParse.ts`, `lib/letter.ts`, `app/api/strategist/plan`, `lib/round2.ts`, `app/api/identity/*` — none ever puts a secret in a prompt.

**CROA bar:** never guarantee deletion or score increases; no §609 / Metro-2 deletion myths; don't promise removal of accurate negative items. Kai + letters run through `lib/compliance.ts`.
