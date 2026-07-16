# Current State

> Authoritative operational snapshot of the **CreditVector app**. Compact by mandate — never a
> chronological log. **GIOS/kernel current truth → [../architecture/FOUNDER-CONTEXT.md](../architecture/FOUNDER-CONTEXT.md)** (do not restate it here). **Full sprint history (V–XXV, Build Waves)
> → `ARCHIVE/CURRENT-STATE-full-2026-07-15.md` + ADRs 0010–0027 + `KAI-ENGINEERING-JOURNAL.md` + git.**

**Last updated:** 2026-07-15 · **Branch:** `main` @ `0ebba21` · **Prod:** LIVE at
https://www.creditvector.app (Vercel auto-deploys on push to `main`) · **MAIL_LIVE OFF**.

**Committed locally, push pending (2026-07-16):** KAI-first branding pass — all user-facing foundation-model references removed (AiPlan card → "KAI Intelligence" badge + new description; billing bullet; identity/strategist unconfigured-AI notices; SETUP.md "refined by" line) + KAI identity policy in `KAI_SYSTEM` (never expose provider/model/vendor/routing; identify only as KAI) + strategist-plan persona branded as KAI. Guards green (kai-sanitize 8/8, kai-manifest 44/44, tsc). Internal model config/comments/engineering docs untouched. Owner OK required before push→deploy.

## What's live now
- **CreditVector app:** all Sprints XII–XXV + Pricing V2 shipped to prod (7 pricing tiers; LIVE
  checkout only for Explorer/Professional/Agency; rest "Coming soon"). History → ADRs/archive.
- **GIOS kernel layer (active work):** CreditVector is being wrapped as **Plugin #1**. Kernel in
  `lib/os/`; 6 capabilities registered (5 credit + platform `notify.plan`), all byte-identical,
  **no live route flipped**. Current sprint + roadmap + risks → **FOUNDER-CONTEXT.md**.

## Production integrations (all live)
- **Stripe** LIVE (`sk_live`), webhook verified, catalog synced, letter-pack credits idempotent.
- **Resend** email live from verified `creditvector.app` (deliverability warming).
- **Anthropic** live (Opus 4.8 via `LLM_MODEL`); daily Brief-ingest + weekly digest crons
  (`vercel.json`), `CRON_SECRET` set.

## Working major modules (all shipped + verified)
Report upload → AI parse/analyze → tradelines/scoring → strategist → dispute letters (+ round 2,
response analysis) · Community Hub + Kai · Support tickets · Encrypted attachments & identity docs ·
Agency workspaces · Billing/entitlements · **Brief** (news feed, Phases 1–3: publish flow,
likes/bookmarks/shares, post-moderated comments, RSS+PDF automation draft-only, YouTube embeds,
weekly digest built) · Admin dashboards (Overview+churn, Product Health, Marketing, Automation) ·
Web Push · Password reset · Mail Center + Campaign engine (self-mail today; `lib/mail/` provider
pipeline dry-run, MAIL_LIVE off).

## ⏰ Pending OWNER actions (raise at session start — PRESERVED)
1. **`COMPANY_POSTAL_ADDRESS` env var** — weekly Brief digest is built & live (`e699eb6`) but sends
   NOTHING until this is set in Vercel prod (CAN-SPAM footer). Then: owner subscribes in Settings →
   "Send test digest" from `/admin/brief` → verify.
2. **One-time backfills** — admin console: `fetch('/api/admin/encrypt-letters',{method:'POST'})`
   (encrypts pre-existing plaintext Letter rows; idempotent). Also `/api/admin/encrypt-reports` if
   never run. Status: NEEDS CONFIRMATION whether either has run.
3. **Counsel sign-offs (Article IV):** (a) CROA "educational, not credit-repair" positioning;
   (b) news-editorial/defamation posture **before publishing the FIRST auto-drafted Brief article**
   (drafting/queuing is fine); **(c) CCO gate before any user-facing credit-content notification
   path is enabled through the GIOS notification mechanism (ADR-0027 §5.5).**
4. **User-side Stripe emails:** enable Customer emails → Successful payments; merchant-notification.
5. **Owner test:** Brief comment flow (post → banned phrase → 422; report → moderate at
   `/admin/brief/comments`).
6. **Vercel Skew Protection** is BLOCKED on Hobby (`invalid_billing_plan`) — OWNER decision: upgrade
   to Pro (~$20/mo) to enable. Checklist in `OPERATIONS.md`.

## Known issues / debt
- Favicon/OG images still the pre-de-shadow shield render (on-brand; regen pending).
- `.env.example` drift: still lists deleted `SETUP_SECRET`; missing `COMPANY_POSTAL_ADDRESS`.
- `tsconfig.tsbuildinfo` tracked in git (build artifact) — confirm untracked.
- GIOS kernel debt (D-07/D-08 effect-safety, D-02 perf) → FOUNDER-CONTEXT §10.

## Operational runbooks
- **`OPERATIONS.md`** (root): deploy protocol · incident triage · CDN cache contract · rollback ·
  skew protection. Triage rule: `x-cv-release` header = 12-char build SHA; stale SHA = deploy skew
  (self-heals on refresh), current SHA = real bug. Codebase has **zero server actions** (all
  mutations = API routes) — never add one without skew protection.
- **Deploy:** push to `main` → Vercel auto-deploys prod (~2 min); **confirm with owner before
  pushing**. Env-only change → `npx vercel redeploy <prod-url>`. Build command lives in
  `vercel.json`. ⚠️ `prisma db push` silently fails through Accelerate → new tables self-heal at
  runtime (ADR-0001). Details: `CLAUDE.md` + `.ai/RUNBOOKS/deploy.md`.

## Next recommended tasks
1. **GIOS Sprint 3** (active): ADR-0028 + #11 Durable Audit → D-02 perf harness → route flips.
   Ranked plan: **FOUNDER-CONTEXT §11**.
2. Owner: unblock the digest (`COMPANY_POSTAL_ADDRESS`); run/confirm the encrypt backfills.
3. CreditVector app backlog: deferred perf items (Sidebar context provider, letters/upload
   server-prefetch); `#16` KaiAnswer store blocked on ADR-0006 founder approval.

## Validation status
`npx tsc --noEmit` clean · `next build` clean · guards green (kernel 33 · credit 19 · notify 23 ·
plus the app guard suite per `TESTING.md`). MAIL_LIVE OFF (no provider traffic possible).
