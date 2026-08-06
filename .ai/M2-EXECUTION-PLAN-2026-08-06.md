# M2 — Extraction Merge Execution Plan

**Status: ❌ BLOCKED — FAILED ADVERSARIAL REVIEW (33 findings; 3 confirmed incl. 1 BLOCKER, 2 BLOCKER-class unadjudicated-accepted). DO NOT EXECUTE. Revise per `.ai/M2-PLAN-REVIEW-FINDINGS-2026-08-06.md` first.**
Key invalidations: the Gate D dump is NOT a valid M2 recovery position (predates the migrations — fresh dump mandatory); the session must re-establish database identity (fingerprint + full 7-chain preflight) before the apply; F5 must leave the merge window; D2 becomes a pre-session prerequisite.
**Date:** 2026-08-06 · **Author:** Fable 5 coordinator · **Governing runbook:** `.ai/RUNBOOKS/migration-apply-terms-acceptance.md`

## 1. Repository-backed M2 definition

M2 = **Wave 2 item 5 (S2 completion)** of `.ai/LAUNCH-CLOSURE-EXECUTION-PLAN-2026-08-05.md`
(committed at `bec5c01`), operationalized by Launch Command Center row 4:

> `launch/extraction-wave-2` — Terms B-06 (+ migration 7) + legal/company-identity + Brief digest
> fixes → CCO pass → merge → apply terms migration per its runbook → owner sets Stripe Dashboard
> ToS/Privacy URLs → `STRIPE_TOS_CONSENT=1`.
> Sequence: ~~Gate D~~ ✅ → **terms migration (own runbook, same window as deploy) → PR → merge → smoke.**

Explicitly NOT M2: Wallet, Pulse, Teams, LetterStream, Arena expansion, Interior CXOS, RC5
cinematics, any flag flip, any change to the five legacy tables.

## 2. Current verified state (delta vs. the runbook's assumptions)

The runbook was authored **before Gate D**. Three of its sections are now satisfied or amended:

| Runbook § | Written assumption | Post-Gate-D reality |
|---|---|---|
| §2 baseline | "Production carries no `_prisma_migrations` history; expect `migrate deploy` to refuse" | **SATISFIED 2026-08-06T11:13Z** — 6 rows of completed history, `NO_PENDING_MIGRATIONS`, 466/466 components verified |
| §3 backup | "currently unsatisfied … no backup has ever been verified" | **P4 satisfied** — restore-proven dump (row-identical, 286 rows/31 tables) at 10:01:50Z. Freshness at apply time is an owner decision (D1 below) |
| §1.4 C1 | corrective commit required | **PRESENT on branch** — `GATE_D_MIGRATION_CHAIN` lists 7; `gate-d-preflight.test.ts` 105 passed, 0 failed |

Branch evidence (all verified this session):

- `launch/extraction-wave-2` @ `4d842e7`, pushed, in sync with origin; merge-base **is** `origin/main`
  (`3a99430`) — merge is conflict-free by construction (`git merge-tree`: 0 conflict markers).
- Code surface = reviewed tip `6479b60` + **4 docs-only commits** (each touches only `.ai/`), so the
  completed reviews (CCO GO-WITH-CHANGES→applied; Opus READY-PENDING-GATES, gates now passed) still
  cover the entire code diff: 44 files, +2893 −95.
- CI at `6479b60`: verify ✅ · Gate D preflight ✅ · Vercel preview ✅. Tip `4d842e7`: preflight ✅,
  verify pending (docs-only).
- §1.5 lockstep: `prisma migrate diff` vs migrations → **"No difference detected", exit 0**
  (disposable shadow PG, digest-pinned image).
- 7-chain manifest regenerates cleanly (amendment E1): 7 migrations, 35 tables,
  `manifestHash 95ca6532c3203c5b…`, terms checksum `d67e5b4b4761…`.
- Migration 7 SQL re-verified additive-only: 1 `CREATE TABLE` + 2 `CREATE INDEX` + 1 FK
  `ON DELETE RESTRICT ON UPDATE CASCADE`; zero DROP/ALTER-existing/data mutation; no backfill.
- §6 toolchain suite on the branch tip: running this session; results recorded in the handoff.

## 3. Execution sequence — one Founder session (~30–40 min)

**Pre-session (coordinator, no credential):** §6 suite green · CI green on tip · fresh worktree at
the branch tip for the credential shell (the apply MUST run from branch code — the Gate D worktree is
at `3a99430`, which has no migration 7).

| Group | Action | Contact | Gate |
|---|---|---|---|
| A | Dedicated shell (`HISTFILE= bash --noprofile --norc`) in the **M2 worktree**; paste credential at marker; `validate-url.mjs` PASS; seal | none | — |
| B | Dry read: `npx prisma migrate status` | read-only | expect **6 applied, exactly 1 pending: `20260728000000_terms_acceptance`**; anything else STOPS |
| C | Backup freshness (owner decision D1): fresh dump via the proven Gate D procedure (~2 min) **[recommended]** or owner-signed acceptance of the 11:13Z-era dump | read-only | P4-grade record either way |
| **AP-M2-1** | **Founder: "approve terms apply"** (Wave 2 decision 13.1) | — | 🔴 required |
| D | `DATABASE_URL="$GATE_D_DATABASE_URL" npx --no-install prisma migrate deploy` | **WRITE** | output must name **only** the terms migration; `0_init` in the applied list = STOP+escalate |
| E | §5 forward validation (5.1–5.6, read-only): table exists · exact columns · **COUNT(*) = 0** (consent check) · both indexes · FK `confdeltype='r'` + validated · status 7/7 applied | read-only | ALL must pass; any failure → **do not deploy code**; empty table harms nothing |
| **AP-M2-2** | **Founder: "approve merge"** | — | 🔴 required — merge auto-deploys production (~2 min) |
| F | Create PR → merge → watch deploy → `release-verify.sh` against the **new** SHA | deploy | header must advance to the merge SHA |
| G | §8 smoke: 8.1 unauth 401 (coordinator) · 8.2–8.5 test-account 428/200/idempotency + **Stripe Dashboard verification** (Founder; needs decision D2) · 8.6 UI checkbox · 8.7–8.9 regressions | mixed | 8.2 failure or any Stripe change during 8.2 = incident → §9.1 app rollback |
| H | §10 monitoring first 24h (500s on checkout route = primary failure mode) · §11 change log · Command Center update | — | — |

**Post-merge owner items (same day, not gating the merge):** F5 — Stripe Dashboard ToS/Privacy URLs
then `STRIPE_TOS_CONSENT=1` (wired in checkout + webhook routes, fail-closed absent).

## 4. Rollback posture

- **Application rollback (§9.1) — the supported path:** `git revert` the merge, redeploy. Terms rows
  persist harmlessly (route is the sole reader/writer — verified by tree-wide grep, INFERRED).
- **Database rollback (§9.2) — treat as unavailable.** `DROP TABLE` is legal only in the empty-table,
  code-not-deployed window (between D and F). After rows exist it destroys consent evidence — never.
- **Stripe (§9.3):** subscription changes made during smoke are real; reverting code does not undo
  them.
- Anchors: `pre-m1` = `f449c35` · `wave1-baseline` = `a40a41c` · `npx vercel rollback`.

## 5. Risk register

| # | Risk | Sev | Mitigation |
|---|---|---|---|
| R1 | Code deployed without table → 500 on every in-place upgrade (no kill switch, by design) | HIGH | Strict ordering: D→E gate before F; §5 failure blocks merge absolutely |
| R2 | Merge = production deploy of 44 files, not just terms | MED | Reviews complete on the exact code surface; CI green; §6 suite; release-verify + smoke |
| R3 | Backup staleness at apply time | LOW | D1: fresh dump via proven procedure (~2 min); migration touches no existing row |
| R4 | Smoke 8.2–8.5 mutates a real subscription | MED | D2: dedicated test account; Stripe Dashboard checked during 8.2 |
| R5 | Credential exposure during re-paste | LOW | Same discipline as Gate D (marker paste, validator, seal); zero incidents across 2 sessions |
| R6 | `verify` CI on tip not yet green | LOW | Docs-only delta; confirm green before AP-M2-2 |
| R7 | Post-merge 428s trap legitimate upgraders (UI not letting them through) | MED | §10: watch 428→200 conversion per user in first 24h |

## 6. Owner decisions required

| # | Decision | Needed by |
|---|---|---|
| D1 | Fresh backup at apply time (recommended) vs. signed acceptance of the Gate D dump | Group C |
| D2 | Test account with an active subscription for smoke 8.2–8.5 — exists? which? | Group G |
| D3 | AP-M2-1 — apply the terms migration | Group D |
| D4 | AP-M2-2 — merge (= deploy) | Group F |
| D5 | Schedule the M2 window | session start |
