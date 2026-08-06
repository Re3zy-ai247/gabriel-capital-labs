# CREDITVECTOR — CONTINUATION HANDOFF (post-Gate-D, pre-M2)

**Written:** 2026-08-06 ~11:50Z · **For:** the next coding session (any agent) · **Launch:** Sep 1, 2026

## 1. Verified frozen state — do NOT re-derive

| Fact | Value |
|---|---|
| **Gate D** | **COMPLETE 2026-08-06T11:13Z · CLOSED 11:35Z** (observation window clean: last 100 runtime log lines all `info`, zero errors) |
| Migrations | **6/6 `ALL_PRESENT_AND_MATCHING`**, 466/466 components, checksums true, none rolled back, `NO_PENDING_MIGRATIONS` |
| Production release | `x-cv-release: 3a9943040da5` — **unchanged by Gate D**; release-verify PASS |
| New tables | 8 Operator tables live, **0 rows each** (dormant); public tables 31→40 |
| Flags | All five **provably OFF** (`/operator` 404 · `/reputation` 404 · `/arena` 307) |
| Backup | P4 restore-proven (row-identical, 286 rows/31 tables) — **but see §3: NOT valid for M2** |
| Prisma | **pinned 5.22.0** — ignore the 7.x upgrade notice until after launch |
| Legacy tables | 5 (`Campaign` `MailManifest` `OutcomeConsent` `TradelineContact` `VerifiedOutcome`) untouched — all in `LEGACY_SELF_HEAL_ALLOWLIST`, sanctioned, empty |
| Not started | Wallet · Pulse · Teams · LetterStream · Arena expansion · Interior CXOS — nothing unrelated touched |
| Main freeze | **LIFTED** (re-arms for any future Gate-D-class op) |

Reports: `.ai/GATE-D-COMPLETION-REPORT-2026-08-06.md` · `.ai/GATE-D-CLOSURE-RECORD-2026-08-06.md` ·
evidence workspace `~/Documents/Gabriel-Capital-Labs-AIOS/gate-d-backups/20260806T012051Z/` (mode 700 —
the dump inside holds **regulated consumer data**: never gist/commit/cloud).

## 2. Repository state at handoff

| Item | Value |
|---|---|
| Main repo | `~/Documents/gabriel-capital-labs-to-upload`, branch **`launch/extraction-wave-2`**, in sync with origin |
| origin/main | `3a99430` (= production) |
| Branch merge-base | **is** `origin/main` → merge conflict-free by construction |
| CI on tip | verify ✅ · Gate D preflight ✅ · preview ✅ |
| §6 suite on tip | npm ci ✓ · generate ✓ · **tsc 0** · **build 0** · terms 78/0 · checkout-consent 12/0 · schema-safety 17/0 · preflight 105/0 · runtime guards 5/0 |
| §1.5 lockstep | `migrate diff` schema↔migrations: **no difference** (disposable shadow PG) |
| 7-chain manifest | 7 migrations · 35 tables · `manifestHash 95ca6532c3203c5b…` · terms checksum `d67e5b4b4761…` |
| **M2 worktree (use this)** | `~/Documents/worktrees/creditvector-m2-exec` — branch tip, `npm ci` done, Prisma 5.22.0, `validate-url.mjs` + `rowcount-probe.sql` staged |
| Gate D worktree | `creditvector-gate-d-exec` @ `3a99430` — **wrong checkout for M2** (no migration 7); removable |
| Credential terminals | **All Gate D shells must be closed** (parent holds a wrongly-sealed fingerprint; child held the live credential). Nothing survives for M2 — the next session re-pastes fresh. |

## 3. M2 — authoritative scope and current status

**M2 = Wave 2 item 5 (S2 completion)** of `.ai/LAUNCH-CLOSURE-EXECUTION-PLAN-2026-08-05.md` (in git at
`bec5c01`; not in the working tree) + Launch Command Center row 4:
merge `launch/extraction-wave-2` → `main` (44-file launch-critical extraction: Terms B-06 + migration 7,
legal/company-identity, Brief digest fixes) with the **terms migration applied first** per
`.ai/RUNBOOKS/migration-apply-terms-acceptance.md`. Sequence: **terms migration → PR → merge (= deploy) → smoke**.
Reviews on the code surface are complete (CCO applied; Opus READY-PENDING-GATES — gates now passed).

**Status: execution plan drafted, then ❌ BLOCKED by its own adversarial review.**
`.ai/M2-EXECUTION-PLAN-2026-08-06.md` (stamped BLOCKED) + `.ai/M2-PLAN-REVIEW-FINDINGS-2026-08-06.md`
(33 findings: 3 confirmed, 7 refuted, 23 unadjudicated; raw JSON in the evidence workspace).

**The five corrections any v2 plan MUST carry:**

1. **Fresh backup is MANDATORY** — the Gate D dump (10:01Z) predates the Gate D migrations
   (11:06–11:13Z): it contains neither the operator tables nor `_prisma_migrations`. Restoring it would
   erase Gate D. Use the proven dump procedure (~2 min) at session time.
2. **Database identity before the write** — `--observe-fingerprint`, compare programmatically to the
   approved value in `fingerprint-observation-2.json` (`e2e86da3…1685`; NEVER transcribe by eye), then
   the **full 7-chain preflight** expecting `pendingDeployList == ["20260728000000_terms_acceptance"]`
   exactly, then `migrate status` (6 applied + exactly that 1 pending).
3. **D2 pre-session** — a named test account with an active subscription exists BEFORE the session
   starts, or the session doesn't start. Smoke 8.3 gets its own mini-approval (it mutates real Stripe).
4. **F5 (`STRIPE_TOS_CONSENT=1`) leaves the merge window** — earliest +24h after a clean §10 window,
   after Stripe Dashboard ToS/Privacy URLs are set and verified. Same-day flipping confounds the
   primary failure signal (500s on checkout).
5. **Validated commit = deployed commit** — fast-forward or re-validate on the merge SHA; regenerate
   diff numbers at session time; credential flow written explicitly as read → export → validate → seal,
   with `DATABASE_URL="$GATE_D_DATABASE_URL"` + `npx --no-install` pinned on every DB command.

Supporting artifacts ready: `.ai/M2-PR-BODY-DRAFT.md` (PR body).

## 4. Exact next steps (in order)

1. **Revise the M2 plan to v2** — fold §3's five corrections + the findings register carry-ins.
   No credential, no production contact. Cheap.
2. Optionally adjudicate the 23 open findings (raw JSON has full claims) or accept conservatively.
3. **Founder session** (~40 min, 4 gates): fresh dump → identity evidence → **AP-M2-1** (Founder:
   apply) → `migrate deploy` (only the terms migration may apply; `0_init` in output = STOP) →
   §5 forward validation (COUNT=0 consent check; FK `confdeltype='r'`) → **AP-M2-2** (Founder: merge)
   → PR → merge → release-verify on the NEW SHA → §8 smoke (8.1 unauth 401; 8.2–8.5 test account +
   Stripe Dashboard; 8.6–8.9) → §10 24h monitoring → §11 change log.
4. After M2 + clean §10 window: F5, then Legal Review Packet → attorney outreach → Kai FTUE.

## 5. Standing constraints

- Owner approval REQUIRED for: the terms apply, the merge, any flag, any env change, anything Stripe.
- Never: `db push` / `migrate dev` / `reset` / hand-DDL / Accelerate URL for migrations / backfilling
  `TermsAcceptance` (fabricated consent) / dropping the table once it has rows.
- Open follow-ups: **F10** (encrypted offline copy + deletion date for the Gate D dump) · **F11**
  (remove `db push` from `Dockerfile:13` — post-M2, separately reviewed).
- Credential discipline: paste only at an explicit marker in a `HISTFILE= bash --noprofile --norc`
  shell; export before validate; seal after; never in chat/argv/files/history.
- Boot order every session: repo `CLAUDE.md` → `.ai/INDEX.md` → `.ai/CURRENT-STATE.md` →
  `.ai/LAUNCH-COMMAND-CENTER.md` (canonical dashboard).
