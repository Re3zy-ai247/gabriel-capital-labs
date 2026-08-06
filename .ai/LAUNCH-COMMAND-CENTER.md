# 🚀 LAUNCH COMMAND CENTER — CreditVector v1.0

**Canonical operational dashboard through 2026-09-01.** One source of truth for launch state. Update on every state change; never fork this into per-session status docs.
**Scope law:** tracks launch-critical items ONLY. Wallet · Pulse · Teams · Growth · LetterStream activation · Interior CXOS stay OFF this board unless they become launch-critical.

_Last update: 2026-08-05 (Launch Operations phase) · Owner: Founder · Maintainer: coordinator session_

## Status board

| # | Item | Status | State / next action |
|---|---|---|---|
| 1 | **Production Health** | 🟢 | `main` @ `3a99430` live as `x-cv-release 3a9943040da5`; release-verify PASS; watch 24–48h post-M1 (172-file UX surface); triage by `x-cv-release` per OPERATIONS.md |
| 2 | **Experience Runtime** | 🟢 | LIVE in production (M1, PR #11); prod-inert review surfaces verified (`/review` 404, founder-bootstrap 404) |
| 3 | **Gate D** | 🟢 | **✅ COMPLETE 2026-08-06T11:13Z.** All 4 approvals granted; `resolve --applied 0_init` → `migrate deploy` (5 migrations) → §13 **`NO_PENDING_MIGRATIONS`**, all six `ALL_PRESENT_AND_MATCHING`, **466/466 components**, **18/18 privileges**. Post-deploy: 8 Operator tables live and **dormant (0 rows each)**, public tables 31→**40**, history **6 rows / 0 unfinished / 0 rolled back**. Production `x-cv-release 3a9943040da5` **unchanged**; `/operator` 404 · `/reputation` 404 · `/arena` 307 → **all five flags provably OFF**. **P4 backup proven restorable** (row-identical, 286 rows/31 tables). Report `.ai/GATE-D-COMPLETION-REPORT-2026-08-06.md`. **Open follow-ups:** remove `db push` from `Dockerfile:13`; encrypted offline copy + deletion date for the backup (holds regulated consumer data) |
| 4 | **M2 (extraction merge)** | 🟡 | `launch/extraction-wave-2` @ `6479b60`, pushed, CI-green lineage, reviews complete (CCO GO-WITH-CHANGES→applied; Opus READY-PENDING-GATES), **NOT merged**; sequence: Gate D → terms migration (own runbook, same window as deploy) → PR → merge → smoke |
| 5 | **Counsel (B-12)** | 🟡 | **THE LONG POLE.** External 1–3 wk. Package: CROA positioning · ToS/Privacy/refund · advance-fee vs subscription · state CSO · agency tier · Brief editorial posture · B-05 scrubber question. Founder to confirm engagement + ETA; go/no-go 8/29 is counsel-gated |
| 6 | **Kai FTUE** | 🟡 | Implementation plan READY (evidence-based, zero schema, wizard-free; fixes dashboard split-brain, onboarding-blind Kai, missing banners on `/onboarding` + `/letters`, agency first-client priority). Starts after M2; S3 + S3c packets; CEO/Eng/Design + CCO copy gates; ~2 days |
| 7 | **RC1 Re-run** | 🟡 | Re-run `CREDITVECTOR_RC1_CRITERIA.md` with evidence after M2 + FTUE; flip closed B-items (B-06 terms closes at M2); draft READY verdict ~Aug 23 |
| 8 | **Release Candidate** | 🟡 | Freeze **Aug 25** → Opus release-risk + security review → CCO launch-copy pass → tag RC + rollback anchor → go/no-go **Aug 29** (counsel-gated) |
| 9 | **Launch Readiness** | 🟢 | On track: engineering slack healthy (~2 wks work vs ~3.5 wks runway); schedule owned by counsel + the Gate D/M2 window — both Founder-controlled |

## Founder action queue (live)

| # | Action | Unblocks |
|---|---|---|
| ~~F1~~ | ~~Fresh verified backup + evidence (P4)~~ | ✅ **DONE 2026-08-06** — proven restorable, row-identical |
| ~~F2~~ | ~~Direct DB URL at the session~~ | ✅ **DONE** — never exposed; close the shell to dispose |
| ~~F3~~ | ~~Sit the Gate D session (4 approvals)~~ | ✅ **DONE 2026-08-06T11:13Z** |
| F4 | M2 GO + terms-migration window | M2 merge — **now unblocked** |
| F10 | Encrypted offline copy + deletion date for the Gate D backup (holds regulated consumer data) | backup hygiene |
| F11 | Remove `prisma db push` from `Dockerfile:13` (prod unaffected; drift risk now that history exists) | schema-integrity follow-up |
| F5 | Stripe Dashboard ToS/Privacy URLs → `STRIPE_TOS_CONSENT=1` | new-sub consent |
| F6 | Decision A `mailedAt` census SQL (read-only) | disclosure wording |
| F7 | Enable Vercel Skew Protection (team is Pro) | deploy hygiene |
| F8 | Digest **content** review (before any D3 flip; `BRIEF_DIGEST_ENABLED` stays unset) | digest activation only |
| F9 | **Counsel engagement + ETA (B-12)** | launch go/no-go |

## Standing rules (do not re-litigate)

- **🧊 MAIN FREEZE — ✅ LIFTED 2026-08-06T11:13Z (Gate D §13 complete).** Retained below as the standing rationale, and it **re-arms for any future Gate-D-class operation**. Original rule: no pushes to `main` of ANY kind (docs included) until Gate D §13 completes. Precedent 2026-07-21: a docs-only merge skipped the Vercel build, leaving production serving an older SHA than `origin/main` — which makes Gate D's P1 (`HEAD == origin/main`) and P2 (prod header == reviewed SHA) **simultaneously unsatisfiable** with no legal resolution inside the runbook. Same freeze applies to Vercel redeploys/env changes (they move the active deployment and re-open the Activity Log window). Extraction-branch pushes are unaffected.

- **Digest arming = one env var** (`BRIEF_DIGEST_ENABLED`): flipping it is a Founder decision (D3), never routine config. Negative-controlled guard pins the gate.
- **Terms ordering law:** the additive `terms_acceptance` migration runs **before/with** the M2 deploy (fail-closed lib; inverted order = in-place upgrades refuse, no charges).
- **Gate D before M2** (preflight manifest = the 6-chain; terms is the 7th under its own runbook).
- **`main` is PR-protected** — ship path is PR + required checks, never direct push.
- **Never bulk-merge `feat/cxos-phase3`** — extraction only; CXOS remainder rides RC5 (HOLD); the scrubber rewrite returns only via its own tested, CCO-gated slice.
- Rollback anchors: `pre-m1` = `f449c35` · `wave1-baseline` = `a40a41c` · `npx vercel rollback`.

## Key artifacts

Launch plan `.ai/LAUNCH-CLOSURE-EXECUTION-PLAN-2026-08-05.md` · Wave 1 `.ai/MERGE-WAVE-1-REPORT-2026-08-05.md` · Gate D runbook `.ai/RUNBOOKS/gate-d-production-migration.md` (+ corrected v2 session plan in the Wave 2 Execution report) · terms migration runbook `.ai/RUNBOOKS/migration-apply-terms-acceptance.md` · handoff gists: `f2ffb380` (plan) · `804291a3` (Wave 1) · `eb44b7bc` (M1+Wave 2 build) · `756fcb91` (Wave 2 execution).
