# Current State

> Authoritative operational snapshot of the **CreditVector app**. Compact by mandate — never a
> chronological log. **GIOS/kernel current truth → [../architecture/FOUNDER-CONTEXT.md](../architecture/FOUNDER-CONTEXT.md)** (do not restate it here). **Full sprint history (V–XXV, Build Waves)
> → `ARCHIVE/CURRENT-STATE-full-2026-07-15.md` + ADRs 0010–0027 + `KAI-ENGINEERING-JOURNAL.md` + git.**

**Last updated:** 2026-07-15 · **Branch:** `main` @ `0ebba21` · **Prod:** LIVE at
https://www.creditvector.app (Vercel auto-deploys on push to `main`) · **MAIL_LIVE OFF**.

**Stripe Professional Migration (2026-07-16, owner-approved):** removed the dead `STRIPE_PRICE_ID` override branch (verified unset in ALL Vercel envs → lookup-key resolution is the sole production path); renamed the code catalog product `premium` → "CreditVector — Professional"; added product-name self-heal to `reconcileTaxCodes`; swept residual user/admin-facing "Premium" → "Professional" (paywall, admin MRR tooltip, admin sync message). Live Stripe changes (rename catalog product, Option-A consolidation of the split-brain $99 monthly onto the Professional product via `transfer_lookup_key`, archive the orphan `prod_UhM6…`, canonical product metadata) executed via direct API post-deploy. ⚠️ Debt: stale $799/$7,990 Agency Pro prices remain (agency_pro is coming-soon + removed from checkout whitelist → unreachable); the admin "Sync products to Stripe" route would create the $699 `_v2` prices — **do not run it until Agency Pro is activated for sale.**

**Platform Phase B — B1 COMPLETE (2026-07-16, dormant):** capability engine foundation per the approved architecture package (`~/Documents/Gabriel-Capital-Labs-AIOS/PLATFORM-PHASE-B-ARCHITECTURE.md`). `lib/os/kernel/tiers.ts` (GIOS mechanism types) + `config/capabilityMatrix.ts` (injected CV data, 7 tiers × 16 capabilities) + `scripts/capability-matrix.test.ts` (**38/38**: lockstep law vs `agencyClientLimit`, grandfather clause, two-branch superset laws, gated-capability flags OFF, session limits declared-not-enforced, live-equivalence on the paid axis, and the KNOWN DIVERGENCE pinned exactly — host grants `campaign.compose`+`notify.plan` free vs matrix pricing them, to be resolved consciously at B3). Zero production consumers; no route behavior changed; KERNEL_DURABLE off. **B1 STOP gate reached — next is B2 (pure resolver + quota + billing port, dormant), owner-gated.**

**Uncommitted, working tree (2026-07-16) — Agency Pricing & Packaging update (owner-approved, stacked on the Polish Sprint):** Agency $399/**15** workspaces (solo operator) · Agency Pro **$699**/40 (growing team) · Scale $1,299/**100** (established) · Enterprise custom. Live cap source `agencyClientLimit` → 15/40/100/null (creation-gating only; existing clients never locked); tier-aware 402 + roster shows honest `N / limit` + 80% capacity banner (`/api/agency/clients` GET now returns `limit`). Stripe `AGENCY_PRO_PRICE_CENTS` 79900→**69900** (+ yearly 699000) with legacy 79900/799000 still resolving to agency_pro in `planForPrice`; product descriptions updated (⚠️ owner must reconcile any already-provisioned $799 Stripe prices — archive + re-provision via admin Billing sync). Kai's AGENCY TIER FACTS updated (was speaking $799/20-client). **Dormant Phase-B B1 files added (zero consumers): `lib/os/kernel/tiers.ts` (GIOS types) + `config/capabilityMatrix.ts` (CV data — all 7 tiers, 16 capabilities, limits incl. CONCURRENT_SESSION_LIMIT 1/3/5/10-default-configurable; lockstep law with agencyClientLimit documented).** Concurrent sessions NOT enforceable (stateless JWT, no registry) → not advertised anywhere in UI; implementation-grade session-architecture package (CSAP-1) at `~/Documents/Gabriel-Capital-Labs-AIOS/CONCURRENT-SESSION-ARCHITECTURE.md`. **10-lens adversarial review (33 agents) → 24 confirmed findings = 6 root defects, ALL FIXED:** (1) agency_pro removed from checkout whitelist (was API-purchasable at stale $799 while marked "Coming soon"); (2) agency_pro lookup keys versioned `_v2` (Stripe prices amount-immutable; old keys would forever resolve $799 — `planForPrice` prefix-match keeps legacy subs mapping); (3) **grandfather clause** in `agencyClientLimit` (pre-2026-07-17 accounts keep sold caps: Agency 20, Agency Pro unlimited — prices AND limits now both grandfathered); (4) 402 + capacity-banner copy honest ("coming soon", never buy-now for unpurchasable tiers) + plan-aware next-tier (agency→Pro, pro→Scale, scale→Enterprise) + truthful over-cap phrasing; (5) matrix superset fix (MEMORY added to agency_pro/scale/enterprise per pricing page) + two-branch superset law documented; (6) billing $699 display OK once (1) closes the purchase path — owner verifies zero agency_pro subs exist in Stripe. Re-validated: tsc/build(53)/guards green.

**Uncommitted, working tree (2026-07-16) — Product Polish Sprint (pre-Private-Alpha):** 25 files changed + 3 new; typecheck/build(53 pages)/guard-suite all green. (P1) 8 launch-blocking copy/compliance fixes: removed fabricated "+N pts est. impact" score projection (strategist page + `/api/strategist` route) → "Dispute strength" label; removed upload "accuracy guarantee"; softened mail-queue "locks in this price" + journey "Price locked in" (Stripe/UDAAP); inverted letter CTAs (Print primary, "Mail via CreditVector (soon)" demoted — MAIL_LIVE off); unified plan naming Premium→**Professional** across billing/help/onboarding/identity/letters/landing (internal `plan:'premium'` + Stripe product names UNTOUCHED — Stripe product still "CreditVector — Premium", owner rename pending); aligned Agency Pro price $699→$799 (matches `lib/stripe.ts` money-system-of-record); help-page dead search/buttons removed, SLA softened, §611 process language. (P2) KAI persona unified as **Credit Intelligence Officer** (calm, evidence-driven analyst, never chatbot/promotional) in `KAI_SYSTEM` + strategist-plan prompt + KAI const; "AI Strategist" nav→"Strategy Desk"; SECURITY/COMPLIANCE prompt blocks intact. (P3) Strategy plan now persists **client-side (localStorage, per-user key)** — survives refresh/nav + staleness nudge; server-side durable store deliberately NOT built (ADR-0006 gate on persisting Kai AI outputs — same gate as blocked `#16 KaiAnswer store`); documented for owner approval. (P4) Minimal `ProductEvent` analytics sink (`lib/events.ts`, self-heal ADR-0001, fail-open, no PII) + `POST /api/events` (auth + whitelist, no spoofing) — 10 alpha funnel events wired. (P5) print-page "How to mail this" screen-only guide. **Adversarial 5-lens review of the diff → 2 CONFIRMED findings FIXED** (server-side 402/checkout error strings still said "Premium" and rendered beside the renamed "Professional" CTAs at paywalls — now consistent in `strategist/plan`, `letters/generate`, `identity/letter`, `stripe/checkout`) + 2 consistency/accuracy fixes (`communityShared` "master agent"→Kai blurb; `dispute_completed` now fires only on the actual transition into RESOLVED); all other findings refuted (notably: dead `estimatedPointImpact` in `lib/scoring.ts` is now zero-caller — recommend deletion as follow-up; localStorage plan not cleared on logout — per-user-keyed so no cross-user display, minor residual only). **NOT committed/pushed — awaiting owner review.**

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
