# Architecture (canonical)

All items VERIFIED from the repository as of 2026-07-12 unless labeled otherwise.
The 2026-06 QA-fix traceability table is archived at `ARCHIVE/qa-fix-traceability-2026-06.md`.

## Stack
- **Next.js 14.2.18** App Router, TypeScript 5.6, one codebase shipping web + desktop + mobile via **next-pwa** (`worker/index.js` custom service worker for Web Push).
- **Prisma 5.22** over a **Prisma Accelerate** proxy → PostgreSQL. 22 models in `prisma/schema.prisma` + runtime **self-heal tables** (see ADR-0001).
- **NextAuth 4** (JWT, credentials; login by email OR username). Sessions resolve by **user id**, not email. `currentUserOrDemo()` returns null in prod.
- **Stripe 22** hosted Checkout + webhook. **Anthropic SDK** (`@anthropic-ai/sdk`), model from `LLM_MODEL`.
- Tailwind 3.4 (token system — see `DESIGN-SYSTEM.md`), Zod, bcryptjs, pdf-parse, web-push, Resend via raw HTTP (`lib/email.ts`).

## Deployment
Vercel project `gabriel-capital-labs` (team `rey-gabriel-s-projects`); push to `main` → auto-deploy (~2 min). Build command lives in **`vercel.json`** (NOT package.json for prod): `prisma generate && (prisma db push || echo …) && next build`. Crons in `vercel.json`: brief-ingest daily 13:00 UTC, brief-digest Mondays 14:00 UTC (both `CRON_SECRET`-gated). Docker files exist for self-hosting (INFERRED: unused in practice).

## Critical constraints
1. **`prisma db push` silently fails through Accelerate** — schema edits do NOT reach prod. New tables/columns go through self-heal gate functions (`CREATE TABLE IF NOT EXISTS` / `ALTER TABLE … ADD COLUMN IF NOT EXISTS` raw SQL at runtime): `ensureCommunityTables` (`lib/community.ts`), `ensureSupportTables` (`lib/support.ts`), `ensureBriefTables` (`lib/brief.ts`), dedup ledger (`lib/billing.ts`). Still add the model to `schema.prisma` + `npx prisma generate` for the typed client. Legacy migrate route `app/api/admin/migrate/route.ts` needs an ADMIN session.
2. **Client/server split:** a `"use client"` page must not import anything that pulls in `prisma`/`next/headers`. Shared constants live in `*Shared.ts` (`lib/communityShared.ts`, `lib/supportShared.ts`, `lib/attachmentsShared.ts`, `lib/briefShared.ts`).
3. **AI provider boundary:** all Anthropic calls go through `lib/` modules (`kai.ts`, `aiParse.ts`, `letter.ts`, `round2.ts`, `brief.ts`/`briefIngest.ts`) and route handlers (`strategist/plan`, `identity/*`). Letters never hard-fail: deterministic grounded draft first, LLM refine optional (ADR-0004). No secret is ever interpolated into a prompt.

## File map
- **Stripe:** `lib/stripe.ts` (catalog), `lib/billing.ts` (sub sync + `creditLetters` + webhook dedup), `app/api/stripe/{checkout,webhook,portal}`.
- **Entitlements:** `lib/entitlements.ts` — free=3 letters/mo no-AI · premium=unlimited+AI · agency/agency_pro=full+`isAgency` (20-client cap).
- **Report ingestion/accuracy:** `lib/aiParse.ts` (AI extraction incl. `creditorKind` + furnisher contacts), `lib/parse.ts` (regex fallback), `lib/classify.ts` (creditor kind/type), `lib/analyze.ts` (pipeline), `lib/scoring.ts`, `lib/dedupe.ts`, `lib/bureauData.ts` (per-bureau presence model).
- **Letters:** `lib/letter.ts`, `lib/statutes.ts`, `lib/strategies.ts`, `lib/obsolescence.ts` (§605 7yr/10yr), `lib/round2.ts`, `lib/furnisher.ts` (self-heal `TradelineContact`), `app/api/letters/*`.
- **Community/Kai:** `app/community/*`, `app/api/community/*`, `lib/community.ts` + `lib/communityShared.ts`, `lib/kai.ts` (hardened — ADR-0005). Moderation: `CommunityReport`, admin `app/admin/reports`.
- **Brief:** `lib/brief.ts` + `lib/briefShared.ts` (summarizer, `BriefArticle`, YouTube parser), `lib/briefIngest.ts` (RSS+PDF ingestion — ADR-0003), `lib/briefDigest.ts`, public `app/brief/*`, admin `app/admin/brief/*`, cover `app/api/brief/cover` (edge `next/og`), crons `app/api/cron/*`.
- **Email/auth recovery:** `lib/email.ts` (Resend), `lib/passwordReset.ts`, `app/api/auth/{forgot,reset}-password`.
- **Web Push:** `lib/push.ts`, `worker/index.js`, `app/api/push/*`, `components/PushToggle.tsx`.
- **Support:** `app/support`, `app/api/support/*`, `lib/support.ts` + `lib/supportShared.ts`.
- **Attachments/documents (encrypted):** `lib/docCrypto.ts` (AES-256-GCM — ADR-0002), `lib/attachments.ts`, `components/Attachments.tsx`, `app/api/attachments/[id]`, `app/api/documents/[id]/raw`.
- **Admin:** `app/admin/*`, `app/api/admin/*` (all behind `requireAdmin`); nav badges via `/api/admin/context`.
- **Auth/session:** `lib/auth.ts`, `lib/session.ts`, `lib/password.ts`. **Rate limiting:** `lib/rateLimit.ts` (DB-backed `RateHit`, fails open).
- **AI safety:** `lib/kai.ts`, `lib/compliance.ts` (CROA scrubber), `components/Markdown.tsx` (XSS-safe AI-markdown renderer — use it, never raw `<pre>`).
- **Brand:** `lib/brand.ts` (single source of truth), `components/BrandLogo.tsx`.

## Security boundaries
Summarized in `SECURITY.md`. Key invariants: encrypted-at-rest fields decrypt only server-side; file bytes served only through ownership-checked routes; admin APIs behind `requireAdmin`; Kai fences untrusted forum content.

## Known technical debt
G-14 estimated MRR duplication · favicon/OG regen · `.env.example` drift · tracked `tsconfig.tsbuildinfo` (see `CURRENT-STATE.md`).
