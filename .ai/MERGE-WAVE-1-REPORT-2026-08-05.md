# CreditVector — Merge Wave 1 Report

**Date:** 2026-08-05 · **Era:** Launch Closure · **Coordinator:** Fable 5 · **Implementation:** Sonnet executor + 2 Sonnet recon packets · **Review:** Opus (merge risk, bounded)
**Baseline:** prod = `origin/main` @ `f449c35` (verified live via `x-cv-release`) · Strict stops honored: no merge to main, no deploy, no migration, no flag changes.

---

## 1. Executive merge assessment

1. **Both lanes fork from the exact production tip (`f449c35`) and are pure-ahead** — main has not moved since either branch cut. There is no three-way drift; every merge below is a clean fast-forward or conflict-free merge *if done in the right order*.
2. **The "cxos" branch is misnamed cargo: only ~46% of its 63 commits are CXOS.** It also carries the complete terms-acceptance system (6 commits, 1,375 net-new lines), 2 compliance-bar fixes (+316 lines in `lib/compliance.ts`), CI gate-d preflight repairs, the RC1 documentation arc, 5 Stripe fixes, and a security fix.
3. **The Stripe and security content is ALREADY ON MAIN** — PR #9 (`release/pr2-stripe-lifecycle-v2`, merged 2026-07-29) shipped it; end-state diffs vs main are empty for those file sets. They are excluded from extraction (cherry-picking them would double-apply).
4. **The two lanes collide on 63 files — almost entirely CXOS surface — because `feat/experience-runtime-phase-1a` deliberately reconciled the accepted cinematic runtime into itself** (`1a5cdfe`, `a488e96`). The 1a lane is therefore the authoritative CXOS carrier; the cxos lane's CXOS remainder is superseded-or-HOLD (RC5). **Never bulk-merge `feat/cxos-phase3`.** Extract the launch lanes; hold the rest.
5. **S1 dirty-tree recovery executed:** 142 dirty paths → 5 slice commits + out-of-repo archive (~40MB binaries, zips, a stray Vercel build-output tree) + a final governance rollup. Launch-critical uncommitted code (company legal identity module) is now versioned and pushed.
6. **Terms merge has one hard ordering rule:** `lib/terms.ts` fails closed by design (no catch — DB error refuses the operation). Deploying the 428 gate before the additive `TermsAcceptance` migration would refuse in-place paid upgrades until the table exists. The migration runbook (`.ai/RUNBOOKS/migration-apply-terms-acceptance.md`) must run in the same window as the M2 merge. New-subscription checkout is unaffected either way.

## 2. Branch topology (evidence-pinned)

| Branch | vs origin/main | vs upstream | Tip | Role |
|---|---|---|---|---|
| `origin/main` = PROD | — | — | `f449c35` (PR #9, 7/29) | deployed, verified via `x-cv-release` |
| local `main` | **55 behind**, 0 ahead | — | `c28188f` | stale pointer — never use |
| `feat/experience-runtime-phase-1a` | **+30 / −0** | 0/0 (pushed) | `da3d751` (8/05) | Founder-approved experience lane; carries reconciled cinematic runtime; CCO addendum `578a749` "APPROVED WITH DISCLOSURES" |
| `feat/cxos-phase3` | **+63 / −0** (pre-wave) | 0/0 (pushed) | `a40a41c` → [POST-WAVE TIP] | mixed lane: CXOS(14) + MIXED(15) + TERMS(4) + IDENTITY-LEGAL(11) + RC1-DOCS(9) + STRIPE(5, shipped) + OTHER(5) |
| `feat/cxos-living-environment-engine-rc2` | +32 / −0 | 0/0 | `0e0f9be` | CXOS interior — HOLD (stop condition) |
| `docs/fulfillment-engine-v1` | +22 / −0 | 0/0 | `df4ab14` | fulfillment docs — post-launch scope, HOLD |
| `ops/gate-d-readiness-verification` | 0 ahead | — | `ff19563` | fully contained in main — reference only |
| `review/gate-d-preflight-independent` | 0 ahead | — | `6ebf5e1` | fully contained in main — reference only |

Merge-bases: all three of (main↔1a), (main↔cxos), (1a↔cxos) = `f449c35`. Lane overlap 1a∩cxos = **63 files** (app/review/*, components/cxos/*, lib/cxos/*, dashboard/layout/globals/landing, `package.json` + `package-lock.json`, `.ai/CURRENT-STATE.md`, `.ai/INDEX.md`). Launch lanes (TERMS/IDENTITY-LEGAL/RC1-DOCS) are contamination-free of CXOS paths (verified per-commit). Worktrees: 5 (+1 detached RC5 baseline), all clean. Open PRs: 0. `git cherry`: no patch-equivalent commits either direction.

## 3. Merge Wave 1 classification (every pending change)

| Unit | Classification | Evidence |
|---|---|---|
| `feat/experience-runtime-phase-1a` (30 commits, whole lane) | **MERGE NOW** (Founder decision) | Founder-approved arc incl. CCO addendum `578a749`; forks from prod tip; prod-inert by `reviewBuildAllowed()` (prod bundles contain no review path); release package commit `e2e6eff` "READY TO PUSH" |
| Terms-acceptance system (11-file end-state, prov. `26d2b1c`,`717697f`,`2911d44`,`4871d4e`,`beeafd1`,`0e3957e`) | **EXTRACT FIRST** | 1,375 net-new lines vs main; zero CXOS contamination; hard dep: migration-before/with-deploy (fail-closed lib) |
| Company identity + terms version (C1 slice commit) | **EXTRACT FIRST** | new commit born this wave; 5 consumers verified; Founder-resolved 2026-08-01 per `.ai/CURRENT-STATE.md` |
| `lib/compliance.ts` end-state (prov. `013ea53`,`86ba824` + C1 import) | **EXTRACT FIRST** (CCO gate) | +316/−31 vs main; compliance-bar behavior — CCO review required |
| CI gate-d preflight repair (`a2b0a04` end-state) | **EXTRACT FIRST** | rides with terms migration guard integrity |
| RC1-DOCS arc (9 commits) + ops runbooks (`826413b`,`7099bde`) + Founder Library (9 docs commits) | **EXTRACT (optional docs batch)** | docs-only; governance continuity on main |
| Stripe-billing lane (5 commits) | **already shipped — no action** | end-state diff vs main EMPTY (PR #9) |
| Security fix `bd8f108` (admin revocation, demo-seed, letter orphaning) | **already shipped — no action** | end-state diff vs main EMPTY |
| CXOS remainder on cxos lane (14 CXOS + 15 MIXED commits incl. 3 near-duplicate finals) | **HOLD** | RC5 verdict `HOLD — INTEGRATION BLOCKED` (6 open Founder items); superseded for launch by 1a's reconciliation |
| Growth foundations (C3 slice) | **POST-LAUNCH** (code parked on lane, flags OFF) | ADR-0039/41/42; economic phase BLOCKED pending counsel/tax/payments |
| `feat/cxos-living-environment-engine-rc2` (+32) | **HOLD** | CXOS interior stop condition |
| `docs/fulfillment-engine-v1` (+22) | **POST-LAUNCH** | LetterStream/fulfillment deferred out of RC1 scope |
| gate-d branches (0 ahead) | **no action** (optional pruning later) | fully contained in main |

## 4. Dirty tree summary (S1 result)

Before: 143 paths (38 modified + 1 deleted + 104 untracked, incl. the launch-plan doc) on `feat/cxos-phase3`, including unversioned launch-critical code. After: **4 paths** — exactly the reserved governance set (`.ai/CURRENT-STATE.md`, `.ai/DECISIONS.md`, `.ai/INDEX.md` modified + the launch plan untracked), committed as C5 below.

| Commit | Slice | Files | Δ |
|---|---|---|---|
| `86c49d1` | C1 identity + terms version | 29 | +231/−66 |
| `1d3dfed` | C2 CXOS Core Runtime seam | 11 | +1,967/−883 |
| `69e673d` | C3 growth foundations (flags OFF) | 54 | +20,130 |
| `f851fe4` | C4 tooling | 9 | +791 |
| `b1a5079` | C6 archive docs (text kept; binaries out) | 17 | +3,629 |
| C5 | governance rollup (mixed `.ai` trio + plan + this report) | — | committed post-review |

Archive: 34 items moved to `Gabriel-Capital-Labs-AIOS/repo-archive/2026-08-05-merge-wave-1/` — 7 evidence dirs (~40MB), 2 zips (one embedding source copies + a nested copy of itself), a Vercel build-output tree, 14 HANDOFF html/txt renders, 7 derived CXOS html renders (md twins kept in-repo), + 4 GROWTH handoff htmls caught in a rules-gap sweep after the executor flagged them. Executor deviations: 2, both benign and reported (BSD-xargs retry with safe fallback; the 4-html rules gap — resolved by coordinator).

Slices:
- **C1 `feat(identity)`** — `lib/companyIdentity.server.ts` (new single owner of legal name + CAN-SPAM postal address) + 5 consumers + diagnostics/env retirement + terms version `2026-08-01` lockstep + identity docs (29 paths).
- **C2 `feat(cxos)`** — Core Runtime 1.0 seam (`lib/cxos/runtime.ts` + `useCxosRoomRuntime.ts`) + agency-command adoption (−450 inline lines) + ADR-0040 + doc amendments + superseded report deletion.
- **C3 `feat(growth)`** — dormant growthNetwork lib + preview routes (3-flag fail-closed) + guards + renderers + ADR-0039/41/42 + ratification records.
- **C4 `chore(tooling)`** — agents mirror, skill vendoring, `.gstack/` ignore.
- **C6 `docs(archive)`** — phase reports + manifests + RC5 record kept as text; **~40MB binaries/zips/build-output moved out-of-repo** to `Gabriel-Capital-Labs-AIOS/repo-archive/2026-08-05-merge-wave-1/`.
- **C5 `docs(governance)`** — final rollup: 3 mixed `.ai` files (CURRENT-STATE/DECISIONS/INDEX), launch-closure plan, this report.

Notable content decision surfaced (Founder visibility): `lib/companyIdentity.server.ts` embeds the real postal address (30 Montgomery Street, Suite 1200, Jersey City, NJ 07302) — Founder-resolved 2026-08-01 per repo record; it becomes **publicly rendered only at M2 deploy** (legal pages + digest footer). Confirm the exact address before authorizing M2.

## 5. S2 Extraction manifest (prepared — NOT executed this wave)

Branch to create: `launch/extraction-wave-2` off `origin/main` **after M1 lands** (rebase target = new main).
Method: **end-state file-set diffs + clean-commit cherry-picks — NOT historical cherry-pick of the 63** (a merge commit `7b1d2fd` and near-duplicate triplet make commit-level replay unsafe; Stripe content would double-apply).

**Revised per Opus review (the original E1-cherry-pick design was proven unappliable — 2/2 hunks fail on `lib/compliance.ts`; `lib/terms.ts` and `CREDITVECTOR_RC1_CRITERIA.md` are modify/delete conflicts against main):**

| # | Unit | Mechanism | Files | Provenance | Gates before merge |
|---|---|---|---|---|---|
| E1′ | Identity + compliance end-state (absorbs old E3) | **end-state diff vs POST-M1 main** over C1's 29-file set, **minus** `lib/terms.ts` (moves to E2′) and with `lib/compliance.ts` full end-state **included** (E1's own guard `company-identity.test.ts:82` requires it); decide `CREDITVECTOR_RC1_CRITERIA.md` whole-file or drop | 28 | C1 `86c49d1` + `013ea53`,`86ba824` | **CCO mandatory** (disclaimer/scrubber behavior) · Founder address confirm · **Founder digest go/no-go (hazard below)** |
| E2′ | Terms-acceptance system | end-state diff vs **post-M1 main** over the **12-file set** = original 11 **+ `app/pricing/PricingTiers.tsx`** (guard-mandated third upgrade caller; omitting = 4 red guard checks or a revenue-blocking dead end on /pricing) + C1's `lib/terms.ts` version bump (branch end-state already carries `2026-08-01`) | 12 | `26d2b1c`→`0e3957e` + C1 | **migration runbook in same window as deploy**; CCO (consent UI copy); terms guards re-run green **on the extracted tree** (branch-green does not transfer) |
| E4 | CI preflight repair | end-state diff: `scripts/gate-d-preflight-core.ts`, `scripts/gate-d-preflight.test.ts` (zero 1a intersection) | 2 | `a2b0a04`+wave | CI green |
| E5 | Docs batch (optional) | end-state diff: RC1-DOCS + ops runbooks + Founder Library + C6 archive docs | ~40 | 9+2+9 commits + C6 | none (docs) |
| — | EXCLUDED | Stripe lane (shipped) · security `bd8f108` (shipped) · all CXOS/MIXED CXOS content (HOLD/superseded) · growth (post-launch) · `package.json`/`package-lock.json` (take post-M1 main's) | | | |

Ordering: E1′ → E2′ → E4 (→ E5). **All end-states computed against post-M1 main** — mandatory for `app/agency/page.tsx`, the single file where the extraction set intersects the 1a lane (1a adds 8 lines there; a pre-M1 base would silently revert them).

**⚠️ HIGH-severity extraction hazard (Opus 6b) — E1′ arms the weekly Brief digest.** Pre-C1, `sendWeeklyDigest()` refused to send while the `COMPANY_POSTAL_ADDRESS` env var was unset in Vercel. C1 replaces that refusal with a check on a hard-coded, never-empty constant — so the first production deploy carrying E1′ removes the dormancy, and the live cron (`0 14 * * 1`) mails every opted-in user the following Monday 14:00 UTC. **Merging E1′ IS the digest go-live decision.** Required first: Founder go/no-go, address verification, CCO pass on digest content; if "not yet" — keep the send behind its own explicit flag or disable the cron entry in the same deploy.

## 6. Merge order (Founder-gated sequence)

| Step | What | Why | Depends on | Risk | Rollback | Validation | Effort |
|---|---|---|---|---|---|---|---|
| M0 | **This wave** — S1 commits + branch push (no main) | stop losing unversioned launch code; make slices cherry-pickable | — | low (branch-only; preview builds are 401-gated) | `git reset` branch to `a40a41c` (pre-wave tag) | typecheck + build + 10 guards **[PENDING]** | done |
| M1 | Merge `feat/experience-runtime-phase-1a` → main, deploy | Founder-approved lane; authoritative CXOS carrier; prod-inert by construction | Founder O2 + O10 (CCO-addendum pre-merge SQL check, doc on 1a lane) | low-med (30 commits, but forks from prod tip, 0 behind; review paths dead in prod bundles) | redeploy `f449c35` (tag it `pre-m1` first); revert-merge if needed | branch typecheck/build + release-verify script + post-deploy `x-cv-release` check + smoke of letters/mail flows (RB-1..6 changed behavior) | 0.5 day |
| M2 | Build `launch/extraction-wave-2` (E1′, E2′, E4[, E5] — revised manifest §5) → CCO + Opus verify on the **extracted tree** → **apply terms migration (runbook)** → merge + deploy | terms/identity/compliance are launch-legal requirements | M1 (all end-states vs post-M1 main) · **Founder digest go/no-go + address confirm (E1′ arms the Monday cron)** · owner Stripe-dashboard ToS URLs for `STRIPE_TOS_CONSENT` after | med (fail-closed window: in-place upgrades refuse between deploy and migration — run migration first, same window; digest activation rides E1′) | additive migration (no destructive rollback needed); redeploy previous SHA; 428 gate is upgrade-path-only | terms guards ×3 + checkout guards + company-identity guard **re-run on the extraction branch**, typecheck/`prisma generate && next build`; post-deploy: legal pages render LLC + address, digest admin test | 1–1.5 days |
| M3 | Gate D production migration (6-chain) | operator tables needed before any Gate F | owner authorization + fresh verified backup (independent of M1/M2 — chain already on main) | med (no `_prisma_migrations` history → `migrate resolve --applied 0_init` first; hardened runbook P1–P10) | backup restore; additive chain, flags OFF | runbook §13 post-verify | 0.5 day owner-supervised |
| M4+ | HOLD/POST-LAUNCH: RC5 CXOS interior, rc2 lane, growth activation, fulfillment docs | stop conditions + counsel gates | Founder decisions | — | — | — | — |

## 7. Parallel Sonnet task map (executed this wave)

| Packet | Scope | Status |
|---|---|---|
| A2 recon | 39 tracked diffs triaged + 104 untracked classified + import graph | done (read-only) |
| A3 recon | 63 commits → lane map + contamination check + terms self-containment | done (read-only) |
| S1 executor | 5 slice commits + archive moves + validation suite (exclusive tree lock, one writer) | done — 2 deviations, both reported not improvised |
| Fable inline | topology, cherry/patch-equivalence, fail-mode reads, C5 rollup, integration | done/this doc |

One-writer-per-file held: recon packets were read-only; the executor held the only write lock; C5 (governance rollup) committed by the coordinator after executor release.

## 8. Opus merge-risk review (bounded) — **APPROVE WAVE PUSH · BLOCK M2-AS-DRAFTED (now revised)**

Method: read-only git forensics; cherry-pick feasibility proven via `patch --dry-run` against exported blobs, never the repo.

| Item | Verdict |
|---|---|
| Slice integrity (C1–C6 cross-slice leakage) | **CONFIRMED clean** both directions |
| E1 as cherry-pick of `86c49d1` | **BLOCKER** — 2/2 hunks fail on `lib/compliance.ts` (authored against the branch's 329-line rewrite; main has the 59-line original); `lib/terms.ts` + `CREDITVECTOR_RC1_CRITERIA.md` are modify/delete conflicts → **rebuilt as E1′ end-state diff** (§5) |
| E1↔E3 ordering | **BLOCKER (inverted)** — `company-identity.test.ts:82` requires the compliance end-state inside E1 → **E3 folded into E1′** |
| E2 completeness | **BLOCKER** — guard names 3 upgrade callers; `app/pricing/PricingTiers.tsx` (+27/−2, TermsAccept wiring) was missing → **E2′ is a 12-file set** |
| M1 prod-inertness | **CONFIRMED** — `reviewBuildAllowed()` fails closed server-side on `VERCEL_TARGET_ENV`/`VERCEL_ENV`; `/review` layout `notFound()`s; middleware untouched; new `founder-bootstrap` route hard-404s in prod before any env/DB read, with DB-isolation attestation + timing-safe secret |
| M1 release risk | MEDIUM-by-design — 172 files across high-traffic surfaces (layout, landing, dashboard, register, letters APIs); risk is visual/UX regression, not inertness → post-deploy smoke list: `/`, `/dashboard`, `/letters`, `/mail`, `/register` |
| M2 fail-closed window | **CONFIRMED as scoped** — `hasAcceptedTermsVersion` has exactly one production call site, inside the in-place-upgrade branch, pre-mutation; degraded window touches only in-place upgrades (500, no charge) |
| Extraction∩1a conflicts | **FLAG** — single intersection `app/agency/page.tsx` → compute end-states vs post-M1 main (adopted, §5) |
| Digest arming (E1′) | **FLAG HIGH — Founder decision, not a code fix** (adopted, §5 hazard + D3) |
| Wave push safety | **CONFIRMED LOW** — fast-forward, branch-only, CI runs checks not deploys, Vercel preview 401-gated; note: CI runs *every* guard script, so a pre-existing unrelated red is signal noise, not wave regression |

All blocking conditions were adopted into the revised manifest before any extraction work; none affect the already-executed wave commits.

## 9. Validation results — ALL GREEN

| Check | Result |
|---|---|
| `tsc --noEmit` (typecheck) | **PASS** (exit 0) |
| `npx next build` (production build) | **PASS** (exit 0) |
| company-identity guard | 24/0 PASS |
| terms-acceptance guard | 78/0 PASS |
| checkout-consent guard | 12/0 PASS |
| cxos-core-runtime guard | 57/0 PASS |
| cxos-agency-command guard | 141/0 PASS |
| growth-capability-contract guard | 2,444/0 PASS |
| growth-center-foundation guard | 205/0 PASS |
| growth-network-foundation guard | 173/0 PASS |
| schema-safety guard | 17/0 PASS |
| gate-d-preflight guard | 105/0 PASS |

One transient false-negative during execution: the first typecheck run failed on `prisma.termsAcceptance` — a **stale generated Prisma client** (local `node_modules` predated the TermsAcceptance model; the executor was instructed to run `npx next build` without the `prisma generate` prefix the real build command carries). `npx prisma generate` (offline, no DB) resolved it; all checks green after. Lesson recorded: local validation must mirror `vercel.json`'s `prisma generate && next build`, not bare `next build`.

## 10. Git status (post-wave)

`feat/cxos-phase3` = `a40a41c` (pre-wave baseline) + 6 wave commits: C1 `86c49d1` → C2 `1d3dfed` → C3 `69e673d` → C4 `f851fe4` → C6 `b1a5079` → C5 (the governance commit carrying this report). Working tree **clean** (143 dirty paths → 0). Rollback anchor: tag **`wave1-baseline`** = `a40a41c` (reset the branch there to undo the entire wave). Branch + tag pushed to `origin/feat/cxos-phase3`; `origin/main` and production **untouched at `f449c35`**; no merges, no migrations, no flag changes, no deploys — all strict stops honored.

## 11. Recommended Founder decisions (in order)

1. **D1 — Authorize M1** (merge 1a → main + deploy). Prerequisite: run the CCO-addendum pre-merge SQL check (O10, doc on the 1a lane). This is the highest-leverage single action: it lands the approved experience AND collapses the CXOS divergence problem.
2. **D2 — Confirm the postal address** in `lib/companyIdentity.server.ts` (30 Montgomery St, Suite 1200, Jersey City NJ 07302) as the address that will render publicly at M2 deploy.
3. **D3 — Weekly Brief digest go/no-go (NEW, Opus-surfaced, HIGH).** Merging E1′ removes the env-var dormancy: the live Monday 14:00 UTC cron will send the digest to every opted-in user after the first deploy that carries it. Decide: GO (with CCO pass on digest content + verified address) or NOT-YET (we keep the send behind an explicit flag / disable the cron entry in the same deploy — small code change, done during extraction).
4. **D4 — Authorize building `launch/extraction-wave-2`** (E1′, E2′, E4, optional E5) per the **revised** manifest, with CCO gates and guard re-runs on the extracted tree.
4. **D4 — Schedule the terms-migration window** (runbook) to coincide with the M2 deploy.
5. **D5 — Gate D authorization + produce the fresh verified backup** (P4) — can run independent of D1/D3.
6. **D6 — Engage outside counsel** (B-12) if not already in motion — still the launch long pole; none of the above removes it.

## 12. Updated Launch Closure roadmap

- **Week of Aug 5:** M0 ✅ this wave · D1/M1 · D5/M3 window · D6 counsel · D2 address confirm
- **Week of Aug 10:** D3/M2 extraction branch → CCO/Opus → terms migration + merge + deploy · owner ledger burn-down (Stripe ToS URLs → `STRIPE_TOS_CONSENT=1`, Stripe customer emails, digest test, encrypt-backfill confirm)
- **Week of Aug 17:** Kai FTUE slice (S3) · Arena stretch go/no-go · polish sweep (S6) · RC1 criteria re-run
- **Week of Aug 24:** freeze (8/25) · Opus release review + CCO launch-copy pass · go/no-go 8/29 (counsel-gated) · **launch Sep 1**
- Post-launch: Teams collaboration (substrate ready), RC5 CXOS interior, growth activation, LetterStream/CSO, Wallet, Pulse.

## Appendix — evidence anchors

Topology: merge-bases all `f449c35`; overlap 63 files; `git cherry` 0 both directions. Lane math: TERMS 4 / IDENTITY-LEGAL 11 / RC1-DOCS 9 / CXOS 14 / MIXED 15 / STRIPE 5 (shipped, empty diff) / OTHER 5 / DIGEST 0 / GROWTH 0 (commits) — growth exists only as dirty-tree work (C3). Terms system spread: `26d2b1c` `717697f` `2911d44` `4871d4e` `beeafd1` `0e3957e`; migration touched only by first two. Mixed `.ai` trio deferred to C5 (non-interactive split). Fail-closed proof: `lib/terms.ts` lines 19–22 ("Nothing here catches…"). Stripe-shipped proof: empty end-state diffs for webhook/billing/cancel/test file-sets; `RC1-DISABLED-ACCOUNT-POLICY.md` + self-cancel route present on `origin/main`.
