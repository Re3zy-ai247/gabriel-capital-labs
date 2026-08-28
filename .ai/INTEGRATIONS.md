# Integrations (canonical)

Actual services + env-var **names** only (never values). Server-side only unless marked `NEXT_PUBLIC_`.

| Service | Purpose | Env vars | Failure mode |
|---|---|---|---|
| Vercel | Hosting, project `gabriel-capital-labs` (team `rey-gabriel-s-projects`), crons | — (`CRON_SECRET` auto-injected as Bearer to cron routes; **cron routes 503 if unset**) | build fails → previous deploy stays live |
| PostgreSQL via **Prisma Accelerate** | Data | `DATABASE_URL` | `prisma db push` is prohibited for release/runtime use; schema changes require explicit reviewed migrations through the separately authorized direct-database procedure |
| Stripe (LIVE) | Checkout, portal, webhook (5 events → `/api/stripe/webhook`) | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | webhook events deduped on `event.id`; catalog provisions lazily (admin Billing → "Sync products to Stripe") |
| Anthropic | Kai, parse, letters refine, strategist, Brief summarizer | `ANTHROPIC_API_KEY`, `LLM_MODEL` | letters fall back to deterministic draft (ADR-0004); Brief ingest skips |
| Resend (HTTP API, no SDK — `lib/email.ts`) | Transactional + digest email; domain `creditvector.app` VERIFIED (DNS at Squarespace) | `RESEND_API_KEY`, `RESEND_FROM`, `RESEND_REPLY_TO`, `ADMIN_EMAIL` | `sendEmail` fails safe; deliverability still warming |
| Web Push (VAPID) | PWA phone alerts | `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | `lib/push.ts` fails safe |
| NextAuth | Auth | `NEXTAUTH_SECRET`, `NEXTAUTH_URL` | — |
| Field encryption | At-rest crypto (ADR-0002) | `DOCUMENT_ENCRYPTION_KEY` | dual-read of legacy plaintext |
| Brief digest (CAN-SPAM) | Weekly email footer address | `COMPANY_POSTAL_ADDRESS` — **NOT YET SET; digest sends nothing until it is** | gated, silent |
| Admin bootstrap | seed admin | `ADMIN_EMAIL`, `ADMIN_PASSWORD` | — |

## Known drift (VERIFIED 2026-07-12)
`.env.example` still lists **`SETUP_SECRET`** (deleted from prod 2026-06-16) and `STRIPE_PRICE_ID` (catalog is now lazily provisioned — Status: INFERRED unused); it's missing `COMPANY_POSTAL_ADDRESS` and `CRON_SECRET`. Fix candidate — see `TASKS.md`.

## Env-var changes without code
`npx vercel env add <NAME> production` then redeploy latest build: `npx vercel ls gabriel-capital-labs --prod` → `npx vercel redeploy <url>`. CLI only via `npx vercel` (auth'd as `re3zy-ai247`).
