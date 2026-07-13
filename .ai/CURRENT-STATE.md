# Current State

> Authoritative snapshot. Update after meaningful work; keep compact; move superseded detail to `ARCHIVE/`. Never turn this into a chronological log.

**Last updated:** 2026-07-12 · **Branch:** `main` @ `cb98aaf` + uncommitted governance work · **Prod:** LIVE at https://www.creditvector.app (Vercel auto-deploys on push to `main`)

**Recent (2026-07-12, docs-only, uncommitted):** Phase 1 governance layer (`.ai/` constitution + canonical docs + ADRs), **Phase 2 CVIOS** (`VISION.md`, `CVIOS.md`, `executive/` ×10, `business-intelligence/`, `marketing/`, `knowledge/`, `improvement/`), **Phase 3 Kai Intelligence design** (`KAI-INTELLIGENCE.md` + `CREDIT-ECONOMY.md` + ADR-0006 Proposed), and **Phase 4 Kai Experience design** (`KAI-EXPERIENCE.md` + ADR-0007 Proposed — passive/active split, event engine, Kai Home/Timeline/Digest, notification voice, brand) installed, plus the **Creative OS** (`creative/` — Kai Character Bible [now PERMANENT with IP clause], cinematography/motion bibles, Higgsfield prompt blocks, storyboards, consistency-scoring gate, **Kai product-design spec** (`creative/KAI-PRODUCT-DESIGN.md` — design language, landing/product UX, behavioral states, conversation UX, projection language) and a 50-concept marketing library; ADR-0008 Accepted), and the **Brand Universe layer** (company-level: `creative/BRAND-UNIVERSE.md` + Rey↔Kai dynamic + cinematic bible + Media OS + hologram system + founder story [facts DRAFT — founder to confirm] + production pipeline; Kai elevated to GCL-level IP, "mascot" vocabulary retired). Zero code changes. Runtime awaits founder approval; recommended first builds = AI-cost metering (BI-COST-01) and/or E1 event engine + timeline. **Creative next step: founder uploads the 4 Kai reference photos via the pending Higgsfield widget → generate + score the CV-KAI-MASTER-001 candidate (~1,010 credits available; stills-first).**

## Production status
- Stripe **LIVE** (`sk_live`), webhook verified; catalog synced; letter-pack credits idempotent.
- Resend email live from verified domain `creditvector.app` (deliverability still warming up).
- Anthropic AI live (Opus 4.8 via `LLM_MODEL`); daily Brief-ingest cron + weekly digest cron scheduled (`vercel.json`), `CRON_SECRET` set.

## Working major modules (all VERIFIED shipped)
Report upload → AI parse/analyze → tradelines/scoring → strategist → dispute letters (+ round 2, response analysis) · Community Hub + Kai · Support tickets · Encrypted attachments & identity documents · Agency workspaces · Billing/entitlements · **Brief** (news feed — Phases 1–3 complete: publish flow, likes/bookmarks/shares, post-moderated comments, RSS+PDF news automation with draft-only ingestion, YouTube embeds, weekly digest built) · Admin dashboards (Overview+churn, Product Health, Marketing, Automation — AIOS Phase 4 complete) · Web Push · Password reset.

## ⏰ Pending OWNER actions (raise at session start)
1. **`COMPANY_POSTAL_ADDRESS` env var** — weekly Brief digest is built & live (`e699eb6`) but sends NOTHING until this is set in Vercel prod (CAN-SPAM footer address). Then: owner subscribes in Settings → "Send test digest" from `/admin/brief` → verify.
2. **One-time backfill** — admin console: `fetch('/api/admin/encrypt-letters',{method:'POST'})` (encrypts pre-existing plaintext Letter rows; idempotent). Also `/api/admin/encrypt-reports` if never run. Status: NEEDS CONFIRMATION whether either has been run.
3. **Counsel sign-offs required** (Article IV): (a) CROA "educational, not credit-repair" positioning; (b) news-editorial/defamation posture **before publishing the FIRST auto-drafted Brief article** (drafting/queuing is fine).
4. User-side Stripe emails: enable Customer emails → Successful payments; merchant-notification email.
5. Owner test pending: Brief comment flow (post → banned phrase → 422; report → moderate at `/admin/brief/comments`).

## Known issues / debt
- **G-14:** `/admin` overview MRR is an estimate (counts×price), not real Stripe revenue; `overview`/`stats` duplicate it inconsistently.
- Favicon/OG images still the pre-de-shadow shield render (on-brand; regen pending).
- Digest should add a `List-Unsubscribe` header when it starts sending.
- `.env.example` drift: still lists deleted `SETUP_SECRET`; missing `COMPANY_POSTAL_ADDRESS`, `CRON_SECRET`.
- `tsconfig.tsbuildinfo` is tracked in git (build artifact).

## Validation status
`npx tsc --noEmit` clean (2026-07-12) · `next build` ok (2026-06-30) · 9 guard scripts green at last run (see `TESTING.md`).

**CX Review (2026-07-12, docs-only):** `CX-REVIEW.md` — all 42 screens audited (dashboard read in full; form-density measured); verdicts + journey friction fixes; conversational-workflow pattern defined; Agency Command Center + community-Premium cost model + retention additions specced; 12 CX items slotted into `ROADMAP-V2.md` Amendment 1. Notable code finding: dashboard's "Est. Points Recovered" renders literal "~ estimate" (dashboard/page.tsx:177) — replace with Kai Home (CX-2). Decision flagged: CX-12 identity-verification gate (founder/CLO).

**Platform layer (2026-07-12, docs-only):** `platform/` — Gabriel Intelligence blueprint (JARVIS runtime = 7 subsystems generalized from proven CV engines; Rule of Two extraction law — nothing extracted before product #2 commits), Product SDK (11 inheritance packages + 7 enforced inheritances + day-one bootstrap), Founder Intelligence layer (maps live AIOS fleet + adds decision journal/weekly brief/pre-review packs). **G-PLAT-1 RESOLVED (ADR-0009, founder directive):** GIOS does not exist in production; it will be extracted FROM CreditVector; CV runs standalone on Claude Opus 4.8; architecture frozen — customer experience only. Positioning ruled: **AI-powered Financial Reputation Platform**.

**V2 layer (2026-07-12, docs-only):** `PRODUCT-VISION-V2.md` (journey + three-question rule) · `DELIGHT-SYSTEM.md` (D1–D100 + W1–W50) · `FOUNDER-STANDARD.md` (binding gate; Constitution **Article XI** Trust-First added) · `MOAT.md` (12 moats) · `ROADMAP-V2.md` (**the ranked Top-100** — first sprint: #4 AI metering + #5 event engine) · Kai §7 intelligence-layer laws added to `creative/KAI-PRODUCT-DESIGN.md`.

## Next three recommended tasks
1. Unblock the digest: owner sets `COMPANY_POSTAL_ADDRESS`, run test digest, add `List-Unsubscribe` header.
2. Run/confirm the encrypt-letters (and encrypt-reports) backfills.
3. G-14: real Stripe MRR on `/admin` overview (or label it "estimated"), and de-duplicate `overview`/`stats`.
