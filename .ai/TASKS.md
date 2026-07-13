# Tasks (active work queue)

Compact, current-only. Done items get deleted (history lives in git). Company backlog: `~/Documents/Gabriel-Capital-Labs-AIOS/BACKLOG.md` via `/gcl` — link, don't copy.

## Owner-blocked (surface at every session start)
- [ ] Decide: upgrade Vercel to Pro (~$20/mo) to enable Skew Protection (eliminates stale-tab 500s across deploys; checklist in `OPERATIONS.md`)
- [ ] Set `COMPANY_POSTAL_ADDRESS` in Vercel prod → digest test → verify (CAN-SPAM gate)
- [ ] Run `/api/admin/encrypt-letters` backfill (admin console, one-time, idempotent); confirm `/api/admin/encrypt-reports` was run
- [ ] Counsel: CROA positioning sign-off · news-editorial posture before first auto-drafted publish
- [ ] Stripe: enable Customer emails → Successful payments; merchant-notification email
- [ ] Owner test: Brief comment flow (banned phrase → 422; report → moderate)
- [ ] MDG verify: Re-analyze a report (also backfills furnisher addresses)

## Engineering (next up)
- [ ] Regenerate favicon/PWA/OG from de-shadowed `logo-mark.png`
- [ ] Letters/upload server-prefetch — deliberately deferred until CX-1 conversational letter flow (restructuring those pages first avoids rework)
- [ ] Letters form htmlFor/id association pass (a11y, low)

Done in Wave 3 (2026-07-12): landing force-dynamic→middleware (/ is static now) · Sidebar/shell context fetches deduped via TTL'd module cache.

Verified already done (removed 2026-07-12): `List-Unsubscribe` + One-Click headers live in `lib/briefDigest.ts` · `*.tsbuildinfo` untracked & gitignored · `.env.example` updated (adds `CRON_SECRET`+`COMPANY_POSTAL_ADDRESS`; `SETUP_SECRET`/`STRIPE_PRICE_ID` are still live code paths, so kept with a delete-after-bootstrap warning instead of dropped).

## Candidate features (unscheduled)
- [ ] Brief stat/data cards · [ ] Brief admin image-upload (licensed/.gov only)
