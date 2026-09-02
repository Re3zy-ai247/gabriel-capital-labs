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
The repository-configured Vercel build command lives in **`vercel.json`**: `prisma generate && next build` — **no DB mutation in the build** (guard: `scripts/schema-safety.test.ts`). The repository also declares brief-ingest and brief-digest cron schedules. Repository contents do not prove provider-side project linkage, branch protection, promotion rules, environment bindings, or whether a router honors readiness; those controls require separate external verification. Docker/Compose is a supported self-host surface: Node and PostgreSQL use digest-pinned official OCI indexes, both Node Alpine stages install exact `openssl=3.5.8-r0` for Prisma, and dependencies install from the committed lockfile after copying `prisma/`. `.dockerignore` excludes local secrets, build outputs, and `.ai` content except the two JSON ledgers statically imported by `lib/engOps.ts`. The web runtime command is exactly `npm run start`; Compose waits for PostgreSQL health and exposes application readiness through `/api/health/ready`, but an external router must be separately configured to honor it. Both Vercel and Docker require schema migration as a separate, explicitly authorized operator action before promotion; build and startup never mutate schema.

## Critical constraints
1. **MIGRATION-FIRST for all new schema (owner-ratified 2026-07-20); no install, build, release, or startup path may mutate the database.** Runtime self-heal is LEGACY-only (32 enumerated tables, `scripts/schema-safety.test.ts`); new tables/columns ship as reviewed migrations applied in a separately authorized release step (⚠️ the previous claim that `db push` "silently fails through Accelerate" was disproven 2026-07-20 — it succeeded and was dropping self-heal-owned tables; see ADR-0001). The listed self-heal gate functions (`ensureCommunityTables` in `lib/community.ts`, `ensureSupportTables` in `lib/support.ts`, `ensureBriefTables` in `lib/brief.ts`, and the dedup ledger in `lib/billing.ts`) are legacy-only and must not be extended for new schema. Still add the model to `schema.prisma` + `npx prisma generate` for the typed client. There is no HTTP schema-migration route; direct raw DDL must not be reintroduced under `app/api/**`.
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
