# CreditVector — RC1 Release Candidate Extraction, Wave 2.2

**Date:** 2026-07-28 · **Branch:** `claude/creditvector-founder-library-jwnbhc`
**Commit range:** `d6303fc` → HEAD (2 commits) · **Status:** Draft — not ratified

> **Verdict: the extraction plan was UNSAFE AS PLANNED. It is now CONDITIONAL.**
> **RC1 remains 🔴 NO-GO.** No blocker status changed.
>
> **No merge, no deploy, no migration applied, no Gate D baseline, no production contact,
> no GitHub PR created, no secret value printed.**

---

## 1. Context for a reader with no repository access

**CreditVector** is a live Next.js 14 consumer-credit **education** SaaS (creditvector.app) with live
Stripe billing. **RC1** is its Version 1.0 release program. An audit of 26 subsystems produced NO-GO
with 12 launch-blocking defects; Waves 1, 2 and 2.1 closed 9 and produced a proposed six-PR release
sequence.

**Wave 2.2 asked one question: is that sequence actually safe?** The combined branch passing every
check proves nothing about whether each extracted PR is independently buildable, testable and free of
hidden dependencies. So every proposed PR was **cherry-picked onto `origin/main` in an isolated
worktree and verified there**.

**Merging to `main` auto-deploys production.** Merge and deploy are the same event; there is no
"merge now, migrate later".

---

## 2. Starting and ending state

| | |
|---|---|
| Branch | `claude/creditvector-founder-library-jwnbhc` (unchanged, never force-pushed) |
| Starting commit | `d6303fc` (Wave 2.1 end) |
| Ending commit | `beeafd1` + this docs commit |
| `origin/main` | `dfe7a3a` — **a strict ancestor**, no independent drift |
| Worktrees | all `sim/*` created, used, and removed; `git worktree list` = source repo only |
| Working tree | clean |

---

## 3. Agents and ownership

| Agent | Scope |
|---|---|
| 1 — Commit archaeology | Read-only. 18 CreditVector commits, 53 paths, 18 solo cherry-pick probes via `git merge-tree` |
| 2 — PR-0 / PR-1 simulation | Worktrees `a2-*` |
| 3 — PR-2 / PR-3 simulation | Worktrees `a3-*` |
| 4 — PR-4 migration package | Worktrees `a4-*`, disposable local PostgreSQL, six states A–F |
| 5 — PR-5 + adversarial | Worktrees `a5-*`, intermediate-state truth probes, 15 scripted attacks |
| Coordinator | Shared facts, worktree infra, corrective commits, RC1 update, reports |

**Simulation infrastructure:** `package.json` and `package-lock.json` are byte-identical across the
whole range, so `node_modules` was shared by symlink — which later proved to be a **methodological
finding in itself** (§7.6).

---

## 4. Commit archaeology — what the branch actually contains

**The branch carries TWO WORKSTREAMS stacked on one another.** Beneath the 18 CreditVector RC1
commits sit 8 Founder Library / Knowledge Architecture commits (`bda4d22` … `e6d9b21`) belonging to a
**separate workstream that must never ship in a CreditVector PR**.

**Consequence: every PR must be built by CHERRY-PICK, never by branching and merging this branch.**
A GitHub PR opened from it would carry all 8.

**Solo cherry-pick probes onto `origin/main` (executed, 18 commits):**

- **Clean (10):** `c9c884e` `a2fa6ea` `c3c4954` `6bc4cf4` `013ea53` `bd8f108` `826413b` `26d2b1c` `a2b0a04` `4871d4e`
- **CONFLICT (8):** `27bc430` `86ba824` `7099bde` `59fad4f` `c7d1506` `717697f` `2911d44` `d6303fc`

**The dangerous class — commits that pick CLEANLY but are semantically broken alone (3):**
`a2b0a04` registers a migration that does not exist → Gate D guard **crashes**; `26d2b1c` adds the
migration without registering it → the same throw fires in the opposite direction (**bidirectional
coupling**); `4871d4e`'s runtime guards execute route handlers that do not yet contain the asserted
behaviour.

---

## 5. Hidden dependencies found

| Dependency | Kind | How proven |
|---|---|---|
| `717697f` → `26d2b1c` | Hard, modify/delete | Solo pick conflicts on `migration.sql` |
| `26d2b1c` ⟷ `a2b0a04` | **Bidirectional** | `loadGateDManifest` set-equality **throws** either way |
| `2911d44` → `a2fa6ea` | Hard, hunk-level | `2911d44` carries `a2fa6ea`'s import as trailing *context* |
| **PR-4 → `6bc4cf4`** | **Semantic, textually invisible** | Picks clean without it and **builds** — but reintroduces the email-keyed billing identity `6bc4cf4` fixed |
| `59fad4f` → `c3c4954` | Hard, 3 shared files | Solo pick conflicts |
| `86ba824` → `013ea53` | Hard, 2 shared files | Solo pick conflicts |
| `7099bde` → `826413b` | Hard, content | `OPERATIONS.md` conflict — **this breaks PR-0's published commit list** |
| `27bc430` → `c9c884e` | Hard, modify/delete | Criteria file exists nowhere on `main` |
| RC1 docs → cherry-pick mechanism | **Unsatisfiable** | ~90 branch-local SHAs; cherry-pick mints new ones |
| Every result → shared Prisma client | Methodological | Global mutable state across worktrees |

**PR-2 → PR-1 was FALSIFIED**, not confirmed: `[c3c4954, 59fad4f]` picks clean onto bare
`origin/main`, builds, and passes 71/71. It has no ordering constraint against PR-1.

---

## 6. Defects confirmed and corrected this wave

### D-1 · The FK corrective was protected by nothing — **CLOSED** (`beeafd1`)
**The disqualifying finding.** A PR-4 assembled with `717697f` silently omitted:

- cherry-picks **clean**
- `tsc --noEmit` **exit 0**
- `scripts/terms-acceptance.test.ts` **exit 0**
- `scripts/schema-safety.test.ts` **exit 0**
- `scripts/gate-d-preflight.test.ts` **exit 0**
- `scripts/runtime/terms-acceptance.runtime.test.ts` **exit 0**

…while shipping `ON DELETE CASCADE` — the foreign key that **destroys consent evidence on any User
delete**, irreversibly, because no backfill exists and none is permitted. `grep RESTRICT|CASCADE`
across every guard returned **zero hits**. A reviewer seeing green CI had no signal at all.

`scripts/terms-acceptance.test.ts` now pins the FK action in **both** the model and the migration,
following the precedent `identity-migration-guard.test.ts:52` already sets for `Organization.owner`.
**Negative control: the exact state that was fully green now fails 4 assertions** (78 → 74 pass).

### D-2 · Runtime guards never ran in CI — **CLOSED** (`beeafd1`)
`scripts/*.test.ts` is a **non-recursive** glob, so `scripts/runtime/` — the only checks that execute
real route handlers instead of matching source text — was executed by **no CI job**. The strongest
evidence in the repository was evidence CI never looked at. Added as its own step; registered in
`.ai/TESTING.md` with the source-level/runtime distinction stated explicitly.

### D-3 · Release-sequence document was false — **CORRECTED** (`beeafd1`)
PR-0's published list `[7099bde, 27bc430]` **does not apply** — both conflict. PR-4 was documented as
depending only on the migration; it also hard-depends on `a2fa6ea` **and** `6bc4cf4`. Both corrections
are marked **in place** rather than rewritten away, so the record shows what was believed and what
execution showed.

---

## 7. Extraction matrix

| PR | Base | Commits | Independent build | Tests | Migration dep | Counsel gate | Safe to merge now | Auto-deploy |
|---|---|---|---|---|---|---|---|---|
| **PR-0** | `origin/main` | `c9c884e`→`826413b`→`7099bde`→`27bc430` **(corrected)** | **PASS** | 70/70 | NONE | N/A | **CONDITIONAL** — carries `app/global-error.tsx`, so not documentation-only | **YES**, behaviourally inert |
| **PR-1** | `origin/main` | `a2fa6ea`, `6bc4cf4`, `bd8f108` **(re-cut)** | **PASS** | 73/73 | **NONE** (zero `TermsAcceptance` hits) | none — `013ea53` removed | **PASS — strongest unit** | **YES** |
| **PR-2** | `origin/main` | `c3c4954`, `59fad4f` + runtime split | **PASS** | 73/73 | NONE | none | **CONDITIONAL** | **YES** |
| **PR-3** | `origin/main` | `013ea53`, `86ba824` **(must combine)** | **PASS** | compliance corpus green | NONE | **YES** | **BLOCKED — COUNSEL** | **YES** |
| **PR-4** | **PR-1** | `26d2b1c`,`717697f`,`a2b0a04`,`2911d44` + terms runtime | **FAIL as a unit** | 74 guards + 6 DB states | **HARD** | consent retention | **BLOCKED — OWNER + PRODUCTION** | **YES — hazardous** |
| **PR-5a** | `origin/main` | `c9c884e` | **PASS** | 70/70 | NONE | disclosure only | **CONDITIONAL** | **YES**, inert |
| **PR-5b** | after PR-1…PR-4 | `27bc430`,`c7d1506`,`d6303fc` | **PASS** | 70/70 | truth dep | N/A | **NOT SAFE** until all land | **YES**, inert |

**PR-4 is not one cherry-pickable unit.** Three independent proofs: it does not apply to `origin/main`;
it needs two PR-1 commits; and merging it *is* deploying schema-dependent code against a database with
no `TermsAcceptance` table. **Recommended split: PR-4a = schema + migration only** (deployable safely —
STATE B proved an additive unused table is inert), **PR-4b = route + UI + guards**, merged only after
the migration is applied and forward-validated.

---

## 8. PR-4 state matrix — six states on a disposable local PostgreSQL

| State | Setup | Result |
|---|---|---|
| **A** | App code, migration NOT applied | **UNSAFE** — `prisma.termsAcceptance` throws P2021 → **500 on every in-place upgrade**. Fails closed (no wrong charge), but the upgrade path is down |
| **B** | Migration applied, OLD app code | **SAFE — verified, not assumed.** Additive unused table; behaviour unchanged. *This is what makes the 4a/4b split viable* |
| **C** | Migration + full package | **PASS** — schema, generated client, UI, API and guards align |
| **D** | Code rolled back, rows exist | Gate disappears, rows persist — **safe** |
| **E** | Migration rollback, table empty | **Safe** — `DROP TABLE` clean, no dependent-object error |
| **F** | Migration rollback, rows exist | **UNSAFE AND IRREVERSIBLE** — Postgres executes the drop **silently**; consent evidence cannot be reconstructed and no backfill is permitted |

**Therefore: once the table holds rows, the migration is effectively forward-only.**

---

## 9. Verification — per exact simulated state

| State | tsc | Guards | next build |
|---|---|---|---|
| `origin/main` control | PASS | 70/70 | PASS |
| PR-0 | PASS | 70/70 | PASS |
| PR-1 | PASS | 73/73 | PASS |
| PR-2 | PASS | 73/73 | PASS |
| PR-3 | PASS | compliance corpus green | PASS |
| PR-4 (STATE C) | PASS | 74 terms guards + Gate D | PASS |
| PR-5 | PASS | 70/70 | PASS |
| Pre-PR-4 stack (11 picks) | PASS | 74/74 | PASS |
| Max counsel-free (16 picks) | PASS | 78/78 | PASS |
| **Source branch after correctives** | **PASS** | **79/79** | **PASS** |

`npm run lint` — **FAIL, 3 pre-existing errors** in files untouched by any wave; CI sets
`continue-on-error: true`. `prisma validate` fails in the harness on missing `DATABASE_URL` — a harness
artifact reproducing identically on bare `origin/main`, **not** a unit regression.

---

## 10. Runtime versus source-level evidence

**RUNTIME (real execution):** the six PR-4 database states on a disposable PostgreSQL · FK deletion
refusal · acceptance concurrency (10 concurrent upserts → 1 row; deterministic interleave → unique
violation, proving the *constraint* not luck enforces it) · the three `scripts/runtime/` guards.

**SOURCE-LEVEL ONLY:** every `scripts/*.test.ts` regex guard, including `stripe-lifecycle.test.ts`.
**Agent 3 flagged an overstatement:** `59fad4f`'s message says that guard "pins the three-state
contract" — it pins the **source text** of that contract. Corrected in this report's framing.

**Methodological finding (§7.6):** all worktrees shared one `node_modules`, so the generated Prisma
client is **global mutable state** that `verify.sh` never regenerates. Agent 5 observed it change
mid-flight, detected it, and repaired it. **Consequence, stated honestly: some simulated `tsc`/`build`
results in this wave may not be CI-equivalent.** Re-verification with a per-state `prisma generate` is
**OWNER DECISION REQUIRED** before any PR is opened.

---

## 11. Negative-control evidence

| Control | Result |
|---|---|
| **PR-4 with `717697f` omitted** | Fully green before the fix; **fails 4 assertions after** — the decisive proof |
| `scripts/terms-acceptance.test.ts` | 78/78; FK assertions fail on reverted FK |
| 18 solo cherry-pick probes | 10 clean / 8 conflict, each with exact conflicting paths |
| PR-2 → PR-1 dependency | **Falsified by execution**, not assumed |
| Intermediate-state truth probes | 3 states built; RC1 artifacts measurably false in all 3 |

---

## 12. Release graph — merge *is* deploy

```
[review] ─► [owner approves merge] ─► [merge to main] ═══► [AUTO-DEPLOY prod]
                                          these are ONE event

PR-5a ─► PR-0 ─► PR-1 ─┬─► PR-2 ────────────────────────────────► PR-5b
                       │                                            ▲
PR-3 ── BLOCKED: COUNSEL ───────────────────────────────────────────┤
                       │                                            │
                       └─► PR-4a (schema+migration) ─► [owner: Gate D baseline]
                                                       ─► [backup — NOT VERIFIED]
                                                       ─► [apply migration]
                                                       ─► [forward-validate]
                                                       ─► PR-4b (route+UI) ──────┘
                                                       ─► [smoke test] ─► [monitor]
```

---

## 13. Updated Go/No-Go — 🔴 NO-GO, unchanged

| Blocker | State | Gate |
|---|---|---|
| B-01…B-04, B-04g, B-07, B-08, B-11, Gate D guard | ✅ **CLOSED** (9) | — |
| **B-05** compliance bar | ⚠️ PARTIAL | **BLOCKED — COUNSEL** |
| **B-06** terms acceptance | ⚠️ PARTIAL | **BLOCKED — OWNER + PRODUCTION** |
| **B-09** backup/recovery | ❌ OPEN — no drill has run | **OWNER + PRODUCTION** |
| **B-10** alerting | ⚠️ PARTIAL — `ALERT_WEBHOOK_URL` unset | **PRODUCTION** |
| **B-12** counsel sign-off | ❌ **BLOCKED — COUNSEL** | **COUNSEL** |
| C-01 · C-02 | **VERIFICATION REQUIRED — PRODUCTION** | **PRODUCTION** |

**SAFE TO REVIEW:** all seven units. **SAFE TO MERGE (after owner approval, given merge = deploy):**
PR-5a, PR-0 (with the `global-error.tsx` decision), PR-1, PR-2.
**NOT SAFE TO MERGE:** PR-3 (counsel), PR-4a/4b (owner + production), PR-5b (until the rest land).

---

## 14. Decisions required

**OWNER:** O1 accept `app/global-error.tsx` in PR-0 or split `826413b` · O2 approve the PR-1 re-cut
(moving `013ea53` → PR-3, `c3c4954` → PR-2) · O3 approve the **PR-4a/4b split** · O4 authorise a
documentation pass to strip ~90 branch-local hash citations · O5 accept the disabled-paying-subscriber
stranding PR-1 introduces, or open the remedy gate first · O6 require a per-state `prisma generate`
re-verification before any PR opens · O7 approve the Gate D baseline · O8 decide the disclosure posture
of merging a defect corpus to a public `main`.

**COUNSEL:** C1 **B-12** CROA/FCRA positioning · C2 **B-05** — and three newly measured gaps
(hyphenated Metro-2, the "forces" verb, the "accurate" qualifier) should go in front of counsel before
PR-3 · C3 consent-evidence retention (`TermsAcceptance` FK/retention) · C4 acceptance scope — per
revision or per transaction.

**PRODUCTION:** confirm DB provider + **run the restore drill** (B-09) · set `ALERT_WEBHOOK_URL` and
**prove delivery** (B-10) · `SETUP_SECRET` (C-01) · encryption backfill (C-02) · `STRIPE_TOS_CONSENT`
+ Dashboard Terms URL · **whether Vercel preview deployments are access-protected** — `DATABASE_URL` is
one shared value across Production and Preview, so a preview of the terms PR runs against the live
database · whether branch protection requires the CI check on `main` (V-09).

---

## 15. Recommendations

**MERGE: NO — not yet, and never as a branch.** **DEPLOY: NOT AUTHORIZED.**

**EXACT NEXT ACTION:** answer **O2** (approve the PR-1 re-cut) and **O3** (approve the PR-4a/4b split).
Those two unlock the entire sequence: PR-1 is extraction-proven and is the strongest unit in the
programme, and the 4a/4b split is the only shape that satisfies owner direction #6 — because STATE B
proved an additive unused table deploys safely while STATE A proved the route without it does not.

---

*Repository truth is authoritative. Nothing here asserts a production fact, a completed drill, a
measured RPO/RTO, a live alert delivery, or a legal conclusion. **No merge, deployment, Gate D
baseline, or production migration occurred in this wave.***
