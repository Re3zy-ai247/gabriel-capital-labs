# ROLLBACK-STRATEGY.md — Per-Phase Rollback

Consolidation only. Primary mechanism throughout: **flag-flip-off, instant, fail-closed.** Secondary/structural fact: additive migrations are forward-only — there is no destructive rollback, only a dormant table left behind. Sources: `EXEC-SEQUENCING.md` §1.2, `EXECUTION-PLAN.md` §6, `LETTERSTREAM-ADAPTER-PLAN.md` §2.5/§4.3, `WALLET-VC-RUNTIME-PLAN.md` §1.0/§1.4/§1.5/§5.4, `CASE-JOURNEY-RUNTIME-PLAN.md` §1.2/§3.1.

---

## 1. The governing distinction — reversible vs. irreversible

| | Reversible | Irreversible |
|---|---|---|
| **Where** | Everything pre-acceptance (Case → Approval → Wallet Authorization/hold → FINAL REVIEW → Submit) | The moment a manifest reaches `PROVIDER_ACCEPTED` (Send path) or a `settle` entry posts (wallet) |
| **Mechanism** | Flag-flip-off; a hold's `release`; a migration left dormant | None — accounting `adjust`/`clawback` only, never an undo |
| **Governing law** | R5 (flag-gated, fail-closed, rollback plan per phase) | "Provider Acceptance = irreversible boundary... never pretend the mailing didn't happen" (`EXECUTION-PLANNING-BRIEF.md`; `EXECUTION-PLAN.md` §6) |

This is the single fact every row below is an instance of.

---

## 2. Per-phase rollback table

| Phase | Rollback mechanism | Note |
|---|---|---|
| P0 | Plain code/doc revert | Paper decision, no runtime effect |
| P1a | Application rollback only — **no DB reversal for a clean apply** | Once the six migrations are applied cleanly, there is nothing to roll back at the schema level; a bad apply is a Gate D runbook incident, not a flag-off case |
| P1b | Revert the tooling change; the frozen six-file baseline stays untouched | Tooling/governance change, not a schema change |
| P2 | N/A — a decision gate, not a build artifact | If counsel's answer is unfavorable, P7 and everything behind it simply never proceeds — no code to unwind |
| P3 | N/A — vendor Q&A and dry-run conformance suite; test-only | No live effect to roll back |
| P4 | Code revert | No schema beyond `MailManifestFlags` (see P4 migration row below) |
| P5 | Flag OFF (`FULFILLMENT_ENGINE_ENABLED`) = byte-identical to today | Schema rollback (see §3) = drop 5 new tables, zero pre-existing table altered |
| P5-accel / P6a | Flag OFF (`FULFILLMENT_PACKAGE_UI_ENABLED`) | Reverts to today's plain `/mail` + 3-step wizard instantly |
| P6b | Flag OFF (either `FULFILLMENT_PACKAGE_UI_ENABLED` or `WALLET_ENABLED`) collapses to Download-only | Money-touching — see §5 for what flag-off does and does not undo |
| P7 | Flag OFF (`WALLET_ENABLED`) | Schema rollback = drop `Wallet`/`WalletLedger` — valid **only** pre-activation (zero rows ever written); once real holds/settlements exist, see §5 |
| P8a | Code revert, no flag consequence beyond `KAI_PACKAGE_ENABLED` OFF | Narration only |
| P8b | Code revert, flag stays OFF (`WALLET_ENABLED` governs; no separate flag) | Narration only, but its content depends on real wallet state — see §5 |
| P3-live | `MAIL_LIVE` OFF → back to dry-run | **Not a full undo** — see §4, post-acceptance pieces already mailed stay mailed |
| P9a/P9b | Flag OFF reverts instantly | Cohort-scoped; narrowing the cohort is itself a partial rollback lever |
| P10a/P10b | Flag OFF / cohort narrowing | Download: no residual exposure. Send: any already-`ACCEPTED` piece in the expanded cohort is governed by §4/§5, not by this flag |

(`EXEC-SEQUENCING.md` §1.2.)

---

## 3. Migration rollback mechanics — additive-only, forward-only

**The additive-only law (`EXECUTION-PLAN.md` §6): 0 DROP, no new self-heal table.** This means the *default and primary* rollback for every migration in `MIGRATION-PLAN.md` is simply: **flag stays off, the new table(s) sit dormant, empty, and cost nothing.** There is no automated down-migration in this program's discipline — `prisma migrate deploy` is a forward-only operation here, matching the repo's existing MIGRATION-FIRST policy (`CLAUDE.md` gotcha #1).

A literal schema-level revert (an actual `DROP TABLE`) is described in `EXEC-SEQUENCING.md`'s rollback-note column only as a **theoretical, manual, exceptional** action — never the standard mechanism, and valid only under a strict precondition: **zero rows have ever been written to that table.** Once any table in `MIGRATION-PLAN.md` rows 1–13 has live data, dropping it is a destructive operation this program's own law forbids (`0 DROP`) and would require its own separate, owner-approved, out-of-band decision — not a "rollback," a data-loss event.

**Practical consequence:** rolling back P5 or P7 in any real sense always means flag-off, never schema removal. The tables `Case`/`DisputePackage`/`DisputePackageLetter`/`Claim`/`MailManifestFlags`/`Wallet`/`WalletLedger` are permanent once applied; what varies is only whether code paths write to or read from them.

---

## 4. Provider live-wiring rollback (`MAIL_LIVE`)

`MAIL_LIVE` OFF returns the system to dry-run — the `not_wired` throw guard (`LetterStreamProvider.ts`) — before any network call. This is a clean, instant, fully reversible flag-off **for anything not yet submitted.**

**What it does not undo:** once a manifest reaches `PROVIDER_ACCEPTED` (real vendor confirmation the piece was submitted for mailing), flipping `MAIL_LIVE` back off does nothing to that piece — it is already in the mail. Per `LETTERSTREAM-ADAPTER-PLAN.md` §2.5: "once a manifest reaches `PROVIDER_ACCEPTED`, (a) wallet settlement is permanent — no reversal path; (b) `ACCEPTED → CANCELED` is shipped-legal in `CANCELABLE` but **guarded-forbidden** at the Commitment layer — no fulfillment-layer code path may invoke `MailService.cancel()` once a manifest is at/after `ACCEPTED`."

**Rollback here is forward-recovery, not undo.** A mailed letter cannot be un-mailed. Any post-acceptance problem (returned-to-sender, wrong address, provider error after acceptance) is handled by the Recovery Engine's scenario matrix and the Kai copy-class translation layer (cited, not designed, in `LETTERSTREAM-ADAPTER-PLAN.md` §2.4) — never by pretending the submission didn't happen. This is the concrete meaning of "Provider Acceptance = irreversible boundary" carried from `EXECUTION-PLANNING-BRIEF.md` into every domain plan.

---

## 5. Wallet rollback

**Flag-off freezes new authorizations.** `WALLET_ENABLED` OFF means every door checks the flag first and fails closed (`{ok:false, code:"disabled"}`) before any lock is taken (`WALLET-VC-RUNTIME-PLAN.md` §5.1) — so no new `authorize` call can open a hold once the flag is off. This is instant and total for **new** entry into the runtime.

**What flag-off does not do:** the source docs describe the flag as a door at entry, not a kill-switch over in-flight state. Nothing in `WALLET-VC-RUNTIME-PLAN.md` describes an automatic mass-release of already-open holds when the flag flips off — a hold's own lifecycle (§1.0/§1.3: opened via `authorize`, resolved forward via `settle` or undone via `release`) is independent of the flag once it exists. This consolidation states that inference explicitly rather than assuming an undocumented auto-release behavior.

**Settled stays settled — the irreversibility law, restated for rollback purposes:**
- `release` is a hold's own reversal — valid **only** pre-settle. Never a correction to something already permanent (`WALLET-VC-RUNTIME-PLAN.md` §1.0).
- `settle` is the one irreversible conversion — a hold becomes permanent, at provider acceptance, never by Submit, never by top-up, never by timeout (§1.0, §1.4).
- Post-settlement, the **only** corrections available are `clawback` (automatic/webhook-driven — chargeback, refund, won-dispute) and `adjust` (human/CCO-triggered make-good) — both operate strictly **after** money has already moved; neither undoes a still-open hold, and neither pretends the settlement didn't happen (§1.0, §1.5). This matches `EXECUTION-PLAN.md` §6's standing constraint verbatim: "post-acceptance = accounting `adjust` only."
- Both directions of the settle/release race are guarded symmetrically: settle-after-release and release-after-settle are each refused (§1.4, citing `WALLET-COMMITMENT-MODEL.md` §7.6).

**Reconciliation via `adjust`, not reversal.** Any post-settlement correction — a chargeback, a refund, a CCO-approved make-good — is booked as a new, append-only ledger entry, never a mutation or deletion of the original `settle` row. The ledger is fold-derived from all entries in order; there is nothing to "roll back" in the database-migration sense, only new entries to append.

**Schema-level rollback, pre-activation only:** if `Wallet`/`WalletLedger` have zero rows (true before `WALLET_ENABLED` is ever flipped anywhere but a test harness), a manual drop is the same exceptional, non-standard action described in §3 — not the expected path once real usage exists.

---

## 6. Summary table — the one distinction that governs every row above

| | Pre-acceptance / pre-settle | Post-acceptance / post-settle |
|---|---|---|
| Mail | Cancelable (guarded by state machine) | Guarded-forbidden to cancel; forward-recovery only |
| Wallet | `release` undoes the hold | `clawback`/`adjust` correct the books; the `settle` itself stands forever |
| Migration | N/A — flag governs behavior, not the table's existence | N/A — the table is permanent once applied, regardless of flag state |
| Flag | Instant, total, fail-closed | Instant for *new* entry; has no retroactive effect on rows/state already committed |
