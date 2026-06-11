# Gabriel Capital Labs

AI-powered **credit dispute education platform** — one codebase that ships as a **website**, an **installable desktop app**, and a **mobile app** (PWA). Rebuilt as a clean, deploy-ready Next.js full-stack application with the accuracy and compliance fixes from QA baked in.

> Educational tool. Not legal advice. No outcome is guaranteed.

## Stack
- **Next.js 14** (App Router, TypeScript)
- **Tailwind CSS** — refreshed premium dark theme
- **Prisma + PostgreSQL**
- **NextAuth (Auth.js)** — credentials auth
- **Anthropic SDK** — dispute-letter generation (optional; deterministic fallback included)
- **next-pwa** — installable on web / desktop / mobile, offline shell

## What makes this build "10/10"
1. **No fabricated cross-bureau claims.** Every tradeline tracks per-bureau presence — `PRESENT`, `ABSENT`, or `UNKNOWN`. Letters only make cross-bureau statements when 2+ bureaus are actually known. With a single-bureau report, the letter disputes that bureau's internal accuracy and never asserts what the other bureaus report. (`lib/bureauData.ts`, `lib/letter.ts`)
2. **Letter generation can't hard-fail.** A grounded, compliance-safe letter is rendered deterministically first; the LLM only *refines* it. If the API key is missing or the call errors, the grounded draft is used. (`app/api/letters/generate/route.ts`)
3. **Compliance Mode always runs** on the final letter text, scrubbing guarantees and illegal phrasing. (`lib/compliance.ts`)
4. **Correct statutes.** §611 reinvestigation, §623 furnisher, §605 obsolescence, FDCPA §809 validation — the §609 option is paired with §611 so the "609 letter forces deletion" myth isn't perpetuated. (`lib/statutes.ts`, `lib/strategies.ts`)
5. **Honest scoring.** Weights account type, age vs the 7-year window, debt-buyer status, $0 collections, and *verified* cross-bureau conflicts — so strong targets reach **High** even from a single-bureau report. (`lib/scoring.ts`)
6. **Correct classification + non-disputable category.** Original creditors aren't mislabeled "Collection"; government/child-support/benefit debts are flagged `NOT_RECOMMENDED` and excluded from the dispute queue. (`lib/classify.ts`)
7. **Duplicate detection** groups the same debt reported by multiple furnishers. (`lib/dedupe.ts`)
8. **Re-analyze / migration.** `POST /api/reports/analyze` re-runs the current pipeline over stored reports so older data gets the new logic. Button in the UI.
9. **Consumer-info gating.** Letters warn before printing if name/address placeholders remain.
10. **Reconciled dashboard.** Every metric derives from one source of truth.

## Local setup
```bash
cp .env.example .env        # fill in DATABASE_URL, NEXTAUTH_SECRET, ANTHROPIC_API_KEY
npm install
npm run db:push             # create tables
npm run db:seed             # demo user + demo report (single-bureau Equifax)
npm run dev                 # http://localhost:3000
```
Demo login: `demo@gabrielcapitallabs.com` / `demo1234`
(In development you can also browse without signing in — it falls back to the demo user.)

## Deploy as a WEBSITE (Vercel — recommended)
1. Push this folder to a Git repo.
2. Import it in Vercel.
3. Add a Postgres database (Vercel Postgres, Neon, or Supabase) and set `DATABASE_URL`.
4. Set env vars: `NEXTAUTH_SECRET` (`openssl rand -base64 32`), `NEXTAUTH_URL` (your domain), `ANTHROPIC_API_KEY`.
5. Deploy. After first deploy, run `npx prisma db push` and `npm run db:seed` against the production DB (or add them to the build).

## Install as a DESKTOP APP
Once deployed, open the site in Chrome/Edge → **Install** icon in the address bar (or ⋮ → "Install Gabriel Capital Labs"). It installs as a standalone desktop window via the PWA manifest. No separate build required.

## Install as a MOBILE APP
Open the deployed URL on a phone → **Add to Home Screen** (iOS Safari share menu / Android Chrome prompt). It launches full-screen with the app icon and offline shell. The UI is fully responsive with a bottom nav bar on mobile.

> Want true native store apps later? Wrap this same URL with **Capacitor** (iOS/Android) or **Tauri/Electron** (desktop). The codebase is structured so that's an add-on, not a rewrite.

## Project layout
```
app/            routes (pages + /api handlers)
components/     UI (AppShell, Sidebar, cards, badges)
lib/            domain logic — the heart of the system
prisma/         schema + seed
public/         manifest, icons, service worker (generated)
```

## Security & legal notes
- This is an **educational** product. Keep all disclaimers intact.
- Have a consumer-credit attorney review letter templates before any production launch.
- Do not store full SSNs; the schema intentionally avoids sensitive PII beyond mailing address.
