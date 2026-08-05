# CreditVector — Launch Closure Execution Plan

**Date:** 2026-08-05 · **Target launch:** 2026-09-01 · **Coordinator:** Fable 5 (coordination only — no implementation performed)
**Evidence basis:** 3 bounded read-only Sonnet recon packets (git/production truth · `.ai/` governance state · launch-surface inventory) + `origin/main` spot-checks. Repository Truth authoritative; Production Truth verified live.
**Status of this document:** PLAN — untracked file added to the `feat/cxos-phase3` working tree; commit or discard is a Founder call (tree was already dirty before this file).

---

## 1. Executive launch assessment

1. **Production is healthier and further along than the continuation briefing assumed.** Prod serves exactly `origin/main` = `f449c35` ("Merge PR #9 — release/pr2-stripe-lifecycle-v2", 2026-07-29), verified live via the `x-cv-release: f449c35d0eca` response header. Both historical P0s are **fixed in production**: the build is `prisma generate && next build` (no `db push --accept-data-loss`; `scripts/schema-safety.test.ts` asserts its absence in CI), and plan upgrades use in-place `stripe.subscriptions.update` with proration (no second $498/mo subscription; the old bug is documented in-file as prevented).
2. **The binding launch constraint is counsel, not engineering.** `CREDITVECTOR_RC1_EXECUTION.md:7` locks RC1 scope ("self-mail consumer product") and states: the binding constraint to launch is COUNSEL sign-off (external, 1–3 wk). `.ai/COMPLIANCE.md:32`: "Nothing in this repository is Counsel approved." Engaging counsel this week is the single highest-leverage September-1 action, and it is an OWNER action.
3. **The top engineering risk is integration debt, not missing features.** Two pushed but **diverged** lanes: `feat/experience-runtime-phase-1a` (30 ahead of main; Founder Experience gate closed 8/04, 1A-CX2 walkthrough tip `da3d751` 8/05) and `feat/cxos-phase3` (63 ahead; CXOS 5→6.2 under **RC5 HOLD — INTEGRATION BLOCKED**, but also carrying launch-critical non-CXOS work: Terms acceptance B-06, legal/company-identity, Brief digest fixes). Neither branch contains the other. On top of that, the `feat/cxos-phase3` checkout has a **142-path dirty tree** including uncommitted launch-critical code (`lib/companyIdentity.server.ts` is untracked; `lib/terms.ts`, `app/legal/*`, `lib/briefDigest.ts` modified).
4. **September 1 is achievable for the LOCKED RC1 scope** (self-mail consumer product + dormant platform + targeted polish) **if**: counsel is engaged by ~Aug 8, the 1A merge decision lands this week, launch-critical work is *extracted* from the CXOS lane rather than waiting on RC5's six blockers, and Gate D runs early. **Not realistic by Sep 1:** Teams-style collaboration and a fully activated Arena/operator ecosystem — both also conflict with the locked RC1 scope and REFUSED_V1 (see §4 scope ruling).

---

## 2. Ground-truth corrections (recon vs. briefing)

| Briefing claim | Repository/Production truth |
|---|---|
| "main @ f449c35 remains untouched. No production deployment." | `f449c35` **is deployed production** since 2026-07-29 (live `x-cv-release` header match). True parts: **no prod migrations** (Gate D not executed; 5 operator tables absent) and **all feature flags OFF** (every flag fail-closed). |
| "Wallet Runtime remains gated." | **No wallet code exists** anywhere in `app/` or `lib/` (docs-only concept). Nothing to gate; post-launch by definition. |
| "Phase 1A-R remains the remediation slice before merge." | 1A-R + CCO correction slice **completed** on `feat/experience-runtime-phase-1a` (`ccb69fb`, 8/04); tip is the 8/05 walkthrough package (`da3d751`); branch pushed. What remains is the **Founder merge/deploy decision**, not remediation. |
| "Six Founder Experience blockers" | Two distinct six-item sets exist — do not conflate: (a) the 1A-R six (1a lane) — closed per that gate's arc; (b) the **RC5 Agency-HQ integration six** — OPEN, verdict `HOLD — INTEGRATION BLOCKED` (`CXOS_AGENCY_RC5_PRODUCTION_INTEGRATION_READINESS.md`, 2026-08-01, §18). |
| "LetterStream remains gated." | Confirmed: `MAIL_LIVE` fail-closed OFF, "must stay OFF pre-CSO/CCO" (`lib/platform/health.ts`). Deferred out of RC1 by locked scope. |
| Pulse Runtime (foundation before launch) | **Zero code** — "Pulse" appears nowhere as a product/module. Foundation would be net-new; recommend post-launch (§4). |

---

## 3. Launch readiness matrix

### READY — live in production at `f449c35`
Marketing site + legal shell · auth (login/register/reset) · onboarding checklist (`app/onboarding`) · Mission Control (`app/dashboard`, missionEngine) · upload → analyze → tradelines → dispute letters engine · Mail Center self-mail flow (print/send) · community + moderation · Kai surfaces (`KaiPresence`, ask-Kai, strategist) · Brief + crons (ingest daily 13:00 UTC, digest Mon 14:00 UTC) · Stripe billing (lifecycle v2, in-place upgrades, webhook idempotency, 409 multi-sub refusal) · admin suite (17 sections) · hardening (encrypted letters/reports at rest, rate limits, schema-safety CI, gate-d-preflight CI job).

### NEEDS POLISH / NEEDS MERGE — work exists but is unmerged, unconfigured, or unverified
| Item | Evidence | What closes it |
|---|---|---|
| **Terms acceptance (RC1 B-06)** | `lib/terms.ts` (version `2026-08-01`), `components/TermsAccept.tsx`, migration `20260728000000_terms_acceptance`, 428-gate on upgrade path — committed on cxos lane only; **not on main**; migration **not applied** (runbook `.ai/RUNBOOKS/migration-apply-terms-acceptance.md`) | Extraction slice → CCO pass → merge → apply migration per runbook |
| Stripe-native ToS consent | `STRIPE_TOS_CONSENT` env default OFF; Stripe 500s until Dashboard ToS/Privacy URLs configured | Owner configures Stripe Dashboard, sets `STRIPE_TOS_CONSENT=1` |
| Registration-time terms acceptance | **NOT FOUND** at `app/register` / `app/api/register` | Counsel input → small slice if required |
| Legal footer / company identity | `COMPANY_POSTAL_ADDRESS` **RESOLVED BY FOUNDER** via `lib/companyIdentity.server.ts` — currently **untracked/uncommitted**; digest test-delivery unverified | S1 triage commit → merge → deploy → owner test delivery |
| Kai first-time experience | Onboarding is a plain 5-step checklist; `KaiPresence` exists | Bounded Kai-guided FTUE slice (no schema) + CCO copy pass |
| Owner ledger items | §10 below | Owner burn-down |

### BLOCKED — not by engineering
| Item | Evidence | Unblock |
|---|---|---|
| **Counsel sign-off (B-12) — THE long pole** | `.ai/COMPLIANCE.md:25-32`; `CREDITVECTOR_RC1_CRITERIA.md:341` ("not an engineering task"); RC1 verdict currently `🔴 NO-GO for Version 1.0` | Owner engages outside counsel (CROA positioning · ToS/Privacy/refund · subscription-vs-advance-fee · state CSO · agency tier · Brief news/defamation · B-05 scrubber question) |
| **Gate D production migration** | Runbook `HARDENED FOR REVIEW · NOT EXECUTED · NOT AUTHORIZED`; preconditions P1–P10 incl. **fresh verified backup** and **`migrate resolve --applied 0_init`** baseline (prod has no `_prisma_migrations` history); direct-connection URL grammar enforced; 6-chain already on `origin/main` → **can run independent of any merge** | Owner authorization + backup + runbook execution (4 approval points) |
| **Gate F activations** | All flags OFF; **DW-D14** (demo cohort + public secretless `/api/demo/seed`) before `OPERATOR_NETWORK_ENABLED`; **wire award producers + re-point Arena to ledger** before `OPERATOR_REPUTATION_ENABLED` | Owner-gated, after Gate D; only if Arena stretch is chosen (§4) |
| RC5 Agency-HQ integration | `HOLD — INTEGRATION BLOCKED`, six open Founder items (§18) | Founder resolves the six items — **not required for Sep 1** (extraction strategy bypasses it) |

### POST-LAUNCH — recommended deferral (consistent with locked RC1 scope + REFUSED_V1)
LetterStream live mail (CSO/CCO) · Teams-style multi-seat collaboration (CX-5b; dormant `TeamMember`/`TeamInvitation`/`ClientAssignment` store exists with **zero callers**; Operator Network channels are polling-based by documented design) · Arena/Identity/Reputation/Network **activation** (code ships dormant) · CXOS production navigation (review routes are hard-off in prod by construction) · Growth Center/Network (economic phase `BLOCKED` pending counsel/tax/payments reviews) · Wallet (no code) · Pulse (no code) · SOC2 · public API.

---

## 4. Scope ruling needed (prompt vs. repository — Founder decision)

The continuation roadmap names Teams-style collaboration → Arena polish → Kai FTUE as launch-critical. The repository locks RC1 scope to the self-mail consumer product and binds cross-user surfaces under `REFUSED_V1` (no leaderboards, named ranking, streaks, seasons, cash affiliate payout, outcome broadcast — code-enforced in `lib/arena/policy.ts`).

**Recommendation:**
- **Kai FTUE — IN for Sep 1.** Small, in-scope, no schema, high first-session impact.
- **Arena — ship dormant; activation is a stretch goal**, only if Gate D + award-producer wiring + Arena→ledger repoint + DW-D14 + Gate F all clear by ~Aug 22 with Opus review. Otherwise post-launch.
- **Teams-style collaboration — post-launch.** Real substrate already exists dormant (team store + Operator Network channels/messages), so a fast post-launch start is credible; pre-launch it collides with counsel's open agency-tier question and the locked scope.
- **Pulse — post-launch entirely** (even foundation; zero code today, no launch payoff).

---

## 5. Updated roadmap + recommended execution order

### Wave 1 — Aug 5–9 (this week)
1. **OWNER: engage outside counsel** (package = `.ai/COMPLIANCE.md` items + ToS/Privacy/refund review). The 1–3 week clock starts here. `[critical path]`
2. **S1 — Dirty-tree triage** on `feat/cxos-phase3` (142 paths): commit launch-critical work in coherent slices (`lib/companyIdentity.server.ts`, `app/legal/*`, `lib/terms.ts` edits, `lib/briefDigest.ts`, compliance docs), move handoff sprawl out of the repo root into archive, push. Produces the S2 extraction manifest. `[Sonnet S1 — blocks S2–S4]`
3. **FOUNDER: 1A merge decision** → merge `feat/experience-runtime-phase-1a` → deploy. Prod-inert by `reviewBuildAllowed()` construction (production bundles contain no active review path — verified 4/4 in the Founder Review System report). Run release-verify; confirm `x-cv-release` advances.
4. **Gate D execution** (owner-supervised, per runbook): fingerprint → preflight → privilege proof → `migrate resolve --applied 0_init` → `migrate deploy` → §13 post-verify (5 operator tables zero rows, flags OFF). Independent of all merges — the 6-chain is already on `origin/main`. `[owner + 4 approval points]`

### Wave 2 — Aug 10–16
5. **S2 — Launch-critical extraction** off the cxos lane: Terms B-06 (+ migration 7) + legal/company-identity + Brief digest fixes → dedicated integration branch → **CCO pass** → merge → apply terms migration per its runbook → owner sets Stripe Dashboard ToS/Privacy URLs → `STRIPE_TOS_CONSENT=1`. RC5 cinematics stay on HOLD, untouched. `[Sonnet S2 + Opus integration review + CCO]`
6. **S3 — Kai FTUE slice**: onboarding checklist → Kai-guided first-run (existing `KaiPresence` + missionEngine; no schema). `[Sonnet S3 + CCO copy pass]`
7. **S4 — DW-D14 fix**: secure `/api/demo/seed` + demo cohort exclusion in prod — do it now regardless of Gate F (public secretless route is latent risk). `[Sonnet S4, small]`
8. **OWNER ledger burn-down**: §10.

### Wave 3 — Aug 17–23
9. **Arena go/no-go (stretch)**: if GO — award producers + Arena→ledger repoint + Gate F subset (`OPERATOR_IDENTITY_ENABLED` → `OPERATOR_REPUTATION_ENABLED` → `ARENA_ENABLED`), Opus-reviewed; if NO-GO — confirm dormant posture. `[Sonnet S5 + Opus]`
10. **S6 — Launch polish sweep**: pricing/billing copy (CCO), transactional emails, 404/SEO/analytics events, load sanity. `[Sonnet S6, parallel]`
11. **RC1 criteria re-run** (`CREDITVECTOR_RC1_CRITERIA.md`): flip closed B-items with evidence; draft READY verdict.

### Wave 4 — Aug 24–29 (freeze + release)
12. **Code freeze Aug 25.** Opus release-risk + security review (auth surfaces, IDOR re-verify, injection, demo/seed). CCO final pass on launch marketing.
13. **Launch runbook**: tag pre-launch SHA (rollback anchor), go/no-go **Aug 29 explicitly gated on counsel status**. **Launch Sep 1.**

---

## 6. Parallel task map (Sonnet packets — one writer per file)

| Packet | Files owned | Depends on |
|---|---|---|
| S1 triage | entire dirty tree (exclusive until pushed) | — (first) |
| S2 extraction | `lib/terms.ts`, `components/TermsAccept.tsx`, `app/legal/*`, `lib/companyIdentity.server.ts`, `lib/briefDigest.ts`, migration 7 + runbooks | S1 |
| S3 Kai FTUE | `app/onboarding/*`, `components/kai/*` | S1 |
| S4 DW-D14 | `app/api/demo/seed/*`, `lib/network/cohort.ts` | S1 |
| S5 Arena (conditional) | `lib/reputation/*`, `lib/arena/*`, `app/arena/*` | Gate D + §4 GO |
| S6 polish | `app/pricing/*`, email templates, `components/marketing/*` | S1 |

S2/S3/S4 run in parallel after S1 (disjoint files). S5/S6 run in parallel in Wave 3.

**Opus review — only where actually required:** (A) integration-order + S2 extraction plan (two diverged lanes; architecture-sensitive); (B) Arena activation slice if GO (billing-adjacent XP/ledger semantics); (C) Wave-4 release-risk + security review. **Not** for routine S3/S4/S6 implementation. Gate D already has independent review artifacts (`review/gate-d-preflight-independent`, `ops/gate-d-readiness-verification` worktrees) + a hardened owner runbook.

**CCO (compliance-review) gates:** terms copy/flow · Kai FTUE copy · pricing/billing copy · digest content · launch marketing · any Brief auto-publish (counsel first).

---

## 7. Risk register

| # | Risk | Sev | Mitigation |
|---|---|---|---|
| R1 | **Counsel timing** (external 1–3 wk; nothing is counsel-approved today) | HIGH | Engage Aug 5–8; go/no-go counsel-gated; if late → launch slips or scope narrows per interim advice. Date moves before scope grows. |
| R2 | **Diverged lanes** (63 vs 30 ahead, no common containment; RC5 HOLD entangles launch-critical work) | HIGH | 1a merges first; *extract* launch bits from cxos (never bulk-merge it); Opus reviews the extraction. |
| R3 | **Dirty-tree data loss** — untracked launch code (`lib/companyIdentity.server.ts`) one `git clean` from gone; tree unbacked | HIGH | S1 immediately; push everything; archive sprawl. |
| R4 | **Gate D on a no-history prod DB** | MED | Hardened runbook P1–P10; **fresh verified backup (P4) — owner must produce; backup absent from the owner-action list today**; stop conditions; §13 post-verify. |
| R5 | **Terms gaps at launch** (no signup-time acceptance; `STRIPE_TOS_CONSENT` OFF) | MED | S2 + owner Stripe config + explicit counsel question on signup capture. |
| R6 | **DW-D14** — public secretless `/api/demo/seed`, demo in cohort (latent; 403s today) | MED | S4 this week, independent of Gate F. |
| R7 | **Scope creep** (CXOS RC5, Growth lanes, prompt's Teams/Arena ambitions) | MED | §4 ruling; RC5 HOLD and Growth `BLOCKED` stand; REFUSED_V1 binding. |
| R8 | **Vercel plan / Skew Protection ambiguity** (`.ai` says Hobby-blocked; earlier team-endpoint check said Pro) | LOW | Owner verifies dashboard once; enable Skew Protection if Pro. |
| R9 | Digest/email deliverability unverified after identity change | LOW | Owner test delivery post-Wave-2 deploy. |

---

## 8. Critical path to September 1

```
Counsel engaged (Aug 5–8) ──────────────── 1–3 wk external ──────────────┐
S1 triage (Aug 6) → 1A merge+deploy (Aug 7–8) → Gate D (Aug 8–9)         │
   → S2 extraction+CCO+merge+terms migration (Aug 11–15)                 ├→ go/no-go Aug 29 → LAUNCH Sep 1
   → S3/S4 parallel (Aug 11–14) → S5?/S6 (Aug 17–22)                     │
   → RC1 criteria READY draft (Aug 23) → FREEZE Aug 25 → Opus+CCO (25–28)┘
```
Engineering path ≈ 6–8 bounded working days plus gates — it fits with slack. **The schedule holds only if counsel returns by ~Aug 27.** If counsel slips, the date slips; that is the honest constraint the repo itself documents.

**Realistic Sep 1 deliverable:** locked RC1 scope, live terms acceptance, Gate D complete, dormant operator platform, Kai-guided FTUE, verified legal identity/digest, polished billing/marketing — counsel-approved. **Stretch:** Arena activated. **Out:** Teams collaboration, LetterStream live mail, Growth, CXOS production navigation, Wallet, Pulse.

---

## 9. Recommended next implementation task

**S1 — Dirty-tree triage & extraction prep** (single Sonnet packet, Fable-coordinated; Opus reviews only the resulting extraction manifest). It protects uncommitted launch-critical code, unblocks S2–S4, and converts the lane-split decision into evidence.

**Next prompt (copy-paste):**
> Execute S1 from `.ai/LAUNCH-CLOSURE-EXECUTION-PLAN-2026-08-05.md`: triage the 142-path dirty tree on `feat/cxos-phase3` — commit launch-critical work in coherent slices (companyIdentity, legal pages, terms edits, brief digest, compliance docs), archive handoff sprawl out of the repo root, push the branch, and produce the S2 extraction manifest. No merges, no migrations, no flag changes, no RC5 files.

---

## 10. Owner decision & action ledger (raise at every session)

| # | Item | Type | Status |
|---|---|---|---|
| O1 | Engage outside counsel (B-12 package) | DECISION+ACTION | OPEN — critical path |
| O2 | 1A merge/deploy decision (`feat/experience-runtime-phase-1a`, tip `da3d751`) | DECISION | OPEN |
| O3 | Authorize + supervise Gate D (incl. **fresh verified backup**) | DECISION+ACTION | OPEN — runbook ready |
| O4 | Scope ruling §4 (Kai FTUE in; Arena stretch; Teams post-launch) | DECISION | OPEN |
| O5 | Stripe Dashboard ToS/Privacy URLs → `STRIPE_TOS_CONSENT=1` | ACTION | OPEN |
| O6 | Stripe customer emails (successful payments) | ACTION | OPEN (`.ai` ledger) |
| O7 | Confirm/run one-time backfills `/api/admin/encrypt-letters` + `/api/admin/encrypt-reports` | ACTION | NEEDS CONFIRMATION |
| O8 | Brief digest test delivery after identity deploys; Brief comment-flow test | ACTION | OPEN |
| O9 | Verify Vercel plan; enable Skew Protection if Pro | ACTION | NEEDS CONFIRMATION (conflicting records) |
| O10 | Pre-1A-merge check from the 1A gate's CCO addendum (`mailedAt` midnight-UTC count SQL) — documented on the 1a lane, not found on the cxos checkout | ACTION | NEEDS CONFIRMATION — verify in the 1a worktree `.ai/SOP` before merge |
| O11 | RC5 six integration blockers (§18) — only if/when Agency-HQ integration is wanted | DECISION | OPEN — not Sep-1 critical |

---

## Appendix — evidence anchors

- Prod: `origin/main` `f449c35d0eca9463c15e86f8cbd4cd7f4e948d03` (PR #9, 2026-07-29); live `x-cv-release: f449c35d0eca`; apex 308→`www`, 200 OK.
- Branches: `feat/experience-runtime-phase-1a` +30 (tip `da3d751`, 8/05; contains `ccb69fb` CCO slice 8/04); `feat/cxos-phase3` +63 (tip `a40a41c`), neither ancestor of the other; local `main` stale (55 behind — do not trust); 0 open PRs; 1 tag `v0.8.0`; worktrees: 1a, gate-d ops + independent preflight review, fulfillment-engine docs, cxos-living-env RC2.
- Build safety on `origin/main`: `vercel.json` + `package.json` build = `prisma generate && next build`; `scripts/schema-safety.test.ts` present on main; CI `gate-d-preflight` job runs it.
- Stripe on `origin/main`: `app/api/stripe/checkout/route.ts:222` `stripe.subscriptions.update` (proration `create_prorations`); `PURCHASABLE_PLANS=["premium","agency"]`; multi-sub → 409.
- Migrations on `origin/main`: 6-chain through `operator_reputation`; `terms_acceptance` (7th) is branch-only, migration NOT applied to prod.
- Flags (all fail-closed OFF): `EVENT_BUS_ENABLED`, `OPERATOR_IDENTITY_ENABLED` (+enrollment), `OPERATOR_REPUTATION_ENABLED`, `OPERATOR_NETWORK_ENABLED`, `ARENA_ENABLED`, `GROWTH_*` (payout hard-off sentinel), `MAIL_LIVE`, `CAPABILITY_PLATFORM`, `KERNEL_DURABLE`, `TEAM_FOUNDATION`, `SESSION_FOUNDATION`, `KAI_CASE_MEMORY`, `MODULE_*`, `STRIPE_TOS_CONSENT`; CXOS review routes hard-off in prod via `reviewBuildAllowed()`.
- Tests: 96 files under `scripts/` (+`scripts/runtime/`), CI-executed via `tsx` loop; no `npm test` script.
- Governance: RC1 scope lock + counsel long-pole (`CREDITVECTOR_RC1_EXECUTION.md:7`); RC1 verdict `NO-GO` pending B-items (`CREDITVECTOR_RC1_CRITERIA.md:67`); Gate D runbook (`.ai/RUNBOOKS/gate-d-production-migration.md`); Gate F preconditions (`.ai/CURRENT-STATE.md:52`); DW-D14 (`.ai/RELEASE-REVIEW-sprint7-8.md:136`); REFUSED_V1 (`lib/arena/policy.ts`); RC5 HOLD (`CXOS_AGENCY_RC5_PRODUCTION_INTEGRATION_READINESS.md`); COMPANY_POSTAL_ADDRESS resolution (`.ai/CURRENT-STATE.md:3`).
- NEEDS CONFIRMATION: encrypt backfills run? · Vercel plan (Hobby vs Pro records conflict) · O10 mailedAt SQL location on 1a lane · whether the 1a branch also carries the terms system (extraction packet must diff before cherry-picking).
