# FEATURE-FLAG-STRATEGY.md — Flag Ladder + Activation Order

Consolidation only. Primary sources: `EXEC-SEQUENCING.md` §4 (idiom, compositional rule, activation order), `EXECUTION-PLAN.md` §3 (authoritative Key-flag column per phase), `WALLET-VC-RUNTIME-PLAN.md` §5.1 (VC per-ledger flags), `CASE-JOURNEY-RUNTIME-PLAN.md` §4.2 (`CASE_JOURNEY_ENABLED`), `MAIL-CENTER-EVOLUTION-PLAN.md` §1.3 (`WALLET_ENABLED` exact-idiom citation).

**Standing law (`EXECUTION-PLAN.md` §6, `EXEC-SEQUENCING.md` R5):** every flag fails closed, exact-string `=== "true"` idiom, default OFF, no truthy coercion. No build step mutates the DB or flips a flag.

---

## 1. Flag ladder — activation order

| Order | Flag | Governs | Default | Idiom | Gates (capability/phase) | Money-gated? | Vendor-gated? | Prerequisite to flip |
|---|---|---|---|---|---|---|---|---|
| 1 | `FULFILLMENT_ENGINE_ENABLED` | Policy Engine consulted by prepare/confirm routes | OFF | `=== "true"` | P5 exit | No | No | P5 exit |
| 2 | `FULFILLMENT_PACKAGE_UI_ENABLED` | Evolved `/mail` room (P5-accel) **and** the full Package Review chain + package-level Download (P6a) — same flag, two increments | OFF | `=== "true"` | P5-accel (immediate, needs only P1b) / P6a (needs P5, P4) | No | No | P1b (P5-accel) or P5+P4 exit (P6a) |
| 3 | `KAI_PACKAGE_ENABLED` | Kai Summary / Recommended Disputes / Educational Explanation panels — wallet-independent, pulled forward (P8a) | OFF | `=== "true"` | P8a exit | No | No | P5 exit |
| 4 | `WALLET_ENABLED` | Real `fund`/`authorize`/`settle`/`release`/`clawback`/`adjust`; promotes Send from visible-disabled to live inside the already-shipped P6a UI (P6b); also the sole gate for P8b's Recovery + money-narration catalog (no separate flag) | OFF | `=== "true"` (`C-WALLET-INTEGRATION.md:784` verbatim) | P7 exit → P6b, P8b | **YES — LEGAL-GATE** | No | P7 exit, P2 cleared, CCO Gate 2 |
| 5 | `MAIL_LIVE` | Real LetterStream network calls, real postage spend | OFF | `=== "true"` (existing) | P3-live | **YES** — own runbook (ADR-0011) | **YES** | P3 exit (16 vendor Qs + conformance green) + Vendor Opacity guard green + `MailManifestFlags` shipped + CSO+CCO Gate 5 |
| — | `CASE_JOURNEY_ENABLED` (PROPOSED, `CASE-JOURNEY-RUNTIME-PLAN.md` §4.2) | Gates the 9-node read-model rendering vs. today's plain `/journey` | OFF | `=== "true"` | Threaded through P5 (anchor rows) / P6a (rendering) — no standalone phase box in `EXECUTION-PLAN.md` §3 (see `DEPENDENCY-GRAPH.md` §1 note) | No | No | P5 exit |
| — | `EVENT_BUS_ENABLED` (pre-existing) | The dormant Platform Event Bus; this program only adds 7 new Fulfillment/Wallet contracts to its registry, code-only, flag stays OFF through P8a/P8b | OFF (unchanged) | `=== "true"` (existing) | Contract registration at P8a/P8b; **activation is a separate, broader platform decision not owned by this program** | No | No | Not this program's to flip |
| — (unscheduled) | `EARNED_VC_ENABLED` | Earned VC ledger | OFF | `=== "true"` | Row 11, `MIGRATION-PLAN.md` | **YES — counsel+CCO-GATE, different and later than P2** | No | P1 + reward/incentive gate + §2.4 instrument-mapping resolved |
| — (unscheduled) | `BONUS_VC_ENABLED` | Bonus VC ledger | OFF | `=== "true"` | Row 12 | **YES — counsel+CCO-GATE** | No | P1 + promotional-credit gate |
| — (unscheduled) | `PENDING_PAYOUT_VC_ENABLED` | Pending Payout VC ledger | OFF | `=== "true"` | Row 13 | **YES — counsel+CCO-GATE** | No | P1 + affiliate/money-transmission gate + Stripe Connect built (does not exist today) |
| — (unscheduled) | `VECTOR_CREDITS_ENABLED` (PROPOSED, additive) | Whether "Vector Credits" surfaces as a UI/product concept at all — a visibility gate over the four sub-flags, not itself money-movement | OFF | `=== "true"` | Product/Founder call | No (visibility only) | No | independent of the per-ledger legal gates |

Order reversed vs. the prior-cycle `IMPLEMENTATION-SEQUENCE.md` (which put `WALLET_ENABLED` at #3, ahead of the Package UI flag, reasoning "the Wallet Authorization screen has nothing to authorize against otherwise") — superseded because R1 splits Download from Send: the Package UI has plenty to show/authorize (Download) before any wallet exists (`EXEC-SEQUENCING.md` §0.2#8).

---

## 2. The compositional Download/Send/Live rule — no third flag

Per the task brief and `EXEC-SEQUENCING.md` §4.2: **`FULFILLMENT_PACKAGE_UI_ENABLED` gates Download; add `WALLET_ENABLED` for Send; `MAIL_LIVE` gates whether Send's postage is real. No third flag is ever invented.**

| `FULFILLMENT_PACKAGE_UI_ENABLED` | `WALLET_ENABLED` | `MAIL_LIVE` | Operator sees |
|---|---|---|---|
| false | false | (irrelevant) | today's `/mail` + 3-step wizard, byte-identical |
| **true** | false | (irrelevant) | evolved Mail Center + 9-step Package Review; **Download Package live**; **Send visibly present, disabled**, honest-placeholder copy (precedent: `lib/mailCenter.ts:84`'s `RESERVED` string) |
| **true** | **true** | false | both options live; **Send fully functions dry-run** — real wallet hold/settle mechanics, no real network call to LetterStream (`app/api/mail/[mailId]/confirm/route.ts:52-54` already works this way today and continues to) |
| **true** | **true** | **true** | both options live; Send's postage submission is a real LetterStream network call |
| false | true | (any) | should not occur — no route exposes Wallet UI without the Package UI flag; treat as a bug, not a copy state |

This operationalizes R1 at the flag layer: `WALLET_ENABLED` is the entire mechanism that promotes Send from "soon" to co-equal — no Mail Center code changes at that moment, only the boolean it reads (`MAIL-CENTER-EVOLUTION-PLAN.md` §1.3). `MAIL_LIVE` is orthogonal to whether the Send UI/wallet mechanics are live at all; it only gates the actual vendor network call (R4).

---

## 3. Money-gated vs. vendor-gated, at a glance

| Category | Flags | Cannot flip before |
|---|---|---|
| **Money-gated** (blocked behind the Founder legal + CROA §404 counsel review, or its own later counsel+CCO gate) | `WALLET_ENABLED` (P2), `EARNED_VC_ENABLED`/`BONUS_VC_ENABLED`/`PENDING_PAYOUT_VC_ENABLED` (each its **own**, separate, later-clearing counsel+CCO gate — not P2 reused) | The applicable legal/counsel gate, full stop — no engineering workaround |
| **Vendor-gated** | `MAIL_LIVE` | All 16 vendor questions answered + adapter conformance suite green + Vendor Opacity guard green + Founder sign-off |
| **Engineering-phase-gated only** (no legal or vendor dependency) | `FULFILLMENT_ENGINE_ENABLED`, `FULFILLMENT_PACKAGE_UI_ENABLED`, `KAI_PACKAGE_ENABLED`, `CASE_JOURNEY_ENABLED` | Their own phase's exit criteria only |
| **Pre-existing, not owned by this program** | `EVENT_BUS_ENABLED` | A separate, platform-wide activation decision — this program adds contracts to the registry, never flips it |
| **Product/visibility gate** | `VECTOR_CREDITS_ENABLED` | Founder product call, independent of the per-ledger legal gates |

---

## 4. Fail-closed guarantee

Every door checks its flag first and fails closed before any lock is taken: `{ok:false, code:"disabled"}`, never a silent 200 (`ADR-0044` verbatim, cited in `EXEC-SEQUENCING.md` §4.2 and `WALLET-VC-RUNTIME-PLAN.md` §5.1). Identical structure across all flags in the ladder, including the four unscheduled VC flags once they exist. No flag is ever flipped speculatively "to unblock testing" in any environment this plan authorizes (`WALLET-VC-RUNTIME-PLAN.md` §5.4) — the only place any of these flags may be `"true"` before its gate clears is a local/test harness exercising the guard suite, never a shared environment.

---

## 5. Reconciliation notes

1. **P5's flag name.** `EXECUTION-PLAN.md` §3's phase table names P5's flag `FULFILLMENT_ENGINE_ENABLED`. `EXEC-SEQUENCING.md` §4.1 (written earlier, as the domain doc) names the same gate `FULFILLMENT_POLICY_ENGINE_ENABLED`. Reconciled in favor of `EXECUTION-PLAN.md` as the authoritative coordinator ruling — this document uses `FULFILLMENT_ENGINE_ENABLED`. Flagged here so an implementer does not create two flags for one gate.
2. **`sendAvailable`'s formula.** `CASE-JOURNEY-RUNTIME-PLAN.md` §3.2/§4.2 defines `sendAvailable = WALLET_RUNTIME_ENABLED === "true" && MAIL_LIVE === "true"` — i.e., it conditions the Send option's very availability on `MAIL_LIVE`, not just on the wallet flag. This conflicts with `EXEC-SEQUENCING.md` §4.2's compositional table (and the task's own explicit framing, §2 above), where Send becomes live/functional purely off `WALLET_ENABLED`, dry-run, independent of `MAIL_LIVE` — matching `MAIL-CENTER-EVOLUTION-PLAN.md` §1.3's direct citation that the Send button "already works fully dry-run today... and continues to." **Reconciled in favor of `EXECUTION-PLAN.md`/`EXEC-SEQUENCING.md`:** `WALLET_ENABLED` alone governs whether Send is a live, clickable, co-equal option; `MAIL_LIVE` governs only whether that option's postage submission is a real vendor call vs. dry-run. `CASE-JOURNEY-RUNTIME-PLAN.md`'s formula conflated "Send UI/mechanics live" with "Send's postage is real" — its own `WALLET_RUNTIME_ENABLED`-named flag is confirmed here to be `WALLET_ENABLED` (no such flag is separately defined anywhere in `WALLET-VC-RUNTIME-PLAN.md`).
3. **`CASE_JOURNEY_ENABLED` has no phase box.** Named only in `CASE-JOURNEY-RUNTIME-PLAN.md` §4.2 — `EXECUTION-PLAN.md` §3's unified roadmap does not assign the Journey its own top-level phase (per `DEPENDENCY-GRAPH.md` §1's note), so this flag is included here for completeness (every entry must trace to a source doc) but is not part of the authoritative P0–P10b ladder.
