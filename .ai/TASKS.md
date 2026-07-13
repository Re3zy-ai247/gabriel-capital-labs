# Tasks (active work queue)

Compact, current-only. Done items get deleted (history lives in git). Company backlog: `~/Documents/Gabriel-Capital-Labs-AIOS/BACKLOG.md` via `/gcl` — link, don't copy.

## Owner-blocked (surface at every session start)
- [ ] Set `COMPANY_POSTAL_ADDRESS` in Vercel prod → digest test → verify (CAN-SPAM gate)
- [ ] Run `/api/admin/encrypt-letters` backfill (admin console, one-time, idempotent); confirm `/api/admin/encrypt-reports` was run
- [ ] Counsel: CROA positioning sign-off · news-editorial posture before first auto-drafted publish
- [ ] Stripe: enable Customer emails → Successful payments; merchant-notification email
- [ ] Owner test: Brief comment flow (banned phrase → 422; report → moderate)
- [ ] MDG verify: Re-analyze a report (also backfills furnisher addresses)

## Engineering (next up)
- [ ] Add `List-Unsubscribe` header to the digest before/at go-live
- [ ] G-14: real Stripe MRR on `/admin` overview or label "estimated"; unify `overview`/`stats`
- [ ] `.env.example` hygiene: drop `SETUP_SECRET`/`STRIPE_PRICE_ID`, add `COMPANY_POSTAL_ADDRESS`+`CRON_SECRET` (names only)
- [ ] Regenerate favicon/PWA/OG from de-shadowed `logo-mark.png`
- [ ] Untrack `tsconfig.tsbuildinfo` (add to `.gitignore`)

## Candidate features (unscheduled)
- [ ] Brief stat/data cards · [ ] Brief admin image-upload (licensed/.gov only)
