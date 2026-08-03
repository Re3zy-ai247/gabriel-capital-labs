# CreditVector Fulfillment Platform — Phase 1 Execution Plan (Program Director synthesis)

Planning only. Architecture LOCKED (not reopened). Merges the five domain plans (EXEC-SEQUENCING · LETTERSTREAM-ADAPTER-PLAN · MAIL-CENTER-EVOLUTION-PLAN · WALLET-VC-RUNTIME-PLAN · CASE-JOURNEY-RUNTIME-PLAN) with the coordinator's adjudications of the cross-agent tensions. Target launch: September 1, 2026. No implementation, no migration, no deploy; production `origin/main` `f449c35` untouched.

## 1. The one insight that shapes everything
The **two-option law forks the critical path**. "Download Package" (self-mail) moves no money and calls no live provider; "Send with CreditVector Fulfillment" needs the wallet (CROA/legal-gated) and the live provider (vendor-gated). Therefore CreditVector can ship **real fulfillment value — the Download path — while the CROA counsel review and LetterStream vendor Q&A run in parallel**, with zero money code and zero legal exposure crossed. The wallet-free path is the launch's safety valve; the money path lands only after its gates clear.

## 2. Adjudicated rulings (resolving the cross-agent tensions)
- **P-1 — Gate D is not atomic (adopt A's split).** P1a = execute the six already-committed migrations against production (resolve the missing `_prisma_migrations` baseline first — `migrate resolve --applied 0_init`). P1b = land the versioned manifest-extension mechanism (the preflight hard-codes "exactly six directories" and rejects a 7th — ID-B02; shared infrastructure with the Identity Constitution's Slice 7). **No fulfillment migration exists until P1b lands.**
- **P-2 — The fork is at Approve (resolves the E + C branch-point tension identically).** Download: wallet-free, no hold, no FINAL REVIEW irreversibility gate (nothing irreversible or money-moving occurs; the operator's own "mark mailed" IS fulfillment for that path, exactly as shipped today). Send: hold → FINAL REVIEW pre-Submit token → Submit → provider acceptance (irreversible) → settlement. The linear Approve→hold→FINAL-REVIEW→Submit chain in KAI-FULFILLMENT-UX §1.1 is the **Send path's** chain; it does not gate Download.
- **P-3 — Phase splits (adopt C).** P6→P6a (Download, flag `FULFILLMENT_PACKAGE_UI_ENABLED`, depends P1b+P5) / P6b (Send, additionally `WALLET_ENABLED`, depends P2+P7). P8→ wallet-independent Kai panels (Summary / Recommended Disputes / Educational Explanation) pull forward with P5/P6a; the Recovery/money-narration catalog stays wallet-gated. **Accept the schema-free acceleration slice:** the `/mail` queue/band/drawer/metrics/timeline evolution runs over today's `Letter[]` via `lib/mailCenter.ts` and needs no `DisputePackage` — the earliest increment of all.
- **P-4 — All wallet code behind the legal gate (strict).** Every P7 stage, schema included, is deferred behind P2 (CROA §404 counsel + Founder legal). This is stricter than the prior IMPLEMENTATION-SEQUENCE and matches the Founder ruling "wallet implementation remains blocked."
- **P-5 — Vector Credits.** Purchased VC = the existing `WalletLedger` shape (built at P7, legal-gated). Earned / Bonus / Pending-Payout VC = named, **schema NOT scheduled this plan** (counsel + CCO gated, later timeline). Four separate append-only ledgers, one anchor, **deficit-isolation is a locked rule: one lock ≠ one balance — a deficit in one ledger must never gate another.** OPEN FOUNDER/CCO DECISION (do not resolve in engineering): **Earned VC does not map onto ADR-0038's five instruments** — it is either a sixth instrument or a productized promotional credit; its ledger and gates depend on that ruling.
- **P-6 — The vendor-confirmation set is 16, not 11.** B's 11 named questions + 5 adjacent blockers (rate-card currency, CASS-endpoint existence, PDF delivery mechanism, metadata passthrough, health-check reality). All 16 answered is a precondition of the live-wiring gate.
- **P-7 — Vendor Opacity is immediate, not polish.** The **live present leak** (`app/api/mail/[mailId]/route.ts:13` serializes the raw `provider` field today) is fixed in P4 with the DTO + static guard, before any provider work. The dormant `` `Accepted by ${provider.name}` `` audit template (`MailService.ts:186`) must be neutralized in the **same change** that first calls `dispatch()` (the audit trail is append-only — ordering is load-bearing).
- **P-8 — Pre-build doc corrections (P0).** A small documentation pass, not implementation: the base-package corrections (F11 `PolicyInput.estimate`, F13 restore 9-step chain references, F14 cascade→Restrict actually applied in A-DOMAIN-MODEL, ADR-0044 vocabulary superseded by the newer `fund/authorize/settle/release/clawback/adjust` + Wallet-anchor model) and the 3 LOW re-gate fidelity items (adjust enum propagation, adjust/reversesId contract, FINAL REVIEW token note).

## 3. Unified phased roadmap

| Phase | Goal | Money? | Gate dependency | Key flag | Migration |
|---|---|---|---|---|---|
| **P0** | Pre-build doc corrections (P-8) | no | none | — | none |
| **P1a** | Execute the 6 committed migrations vs prod (baseline-resolve first) | no | Gate D runbook + Founder sign-off | — | applies existing 6 |
| **P1b** | Versioned manifest-extension mechanism (ID-B02; shared w/ Identity Slice 7) | no | P1a | — | tooling, no feature schema |
| **P2** | CROA §404 counsel + Founder legal decision (parallel track) | — | external counsel | — | none (decision) |
| **P3** | LetterStream conformance — answer 16 vendor questions + dry-run conformance suite | no | vendor docs | `MAIL_LIVE` OFF | none |
| **P4** | Provider abstraction — interface + **Vendor Opacity DTO/guard (fixes the live leak)** | no | P1b | — | `MailManifestFlags` (additive) |
| **P5** | Fulfillment Engine — Case/DisputePackage/state machine/Policy Engine/Recovery skeleton (non-money) | no | P1b, P4 | `FULFILLMENT_ENGINE_ENABLED` | Case, DisputePackage, DisputePackageLetter, Claim (additive) |
| **P5-accel** | Schema-free `/mail` evolution over today's `Letter[]` (queue/band/drawer/metrics/timeline) | no | P1b | `FULFILLMENT_PACKAGE_UI_ENABLED` | none |
| **P6a** | Mail Center **Download** workspace + Package Review chain steps 1–7 → package Download | no | P5 | `FULFILLMENT_PACKAGE_UI_ENABLED` | none |
| **P6b** | Mail Center **Send** path | **yes** | P2, P7 | + `WALLET_ENABLED` | none |
| **P7** | Wallet Runtime + Vector Credits (Purchased VC) | **yes** | **P2 (legal)** + P1b | `WALLET_ENABLED` + per-ledger | Wallet anchor, WalletLedger (additive) |
| **P8a** | Kai Summary / Recommended / Educational panels (wallet-independent) | no | P5 | `KAI_PACKAGE_ENABLED` | none |
| **P8b** | Kai Recovery + money-narration catalog | **yes** | P7 | `WALLET_ENABLED` | none |
| **P3-live** | LetterStream live wiring (`MAIL_LIVE` flip) | **yes** | 16 vendor Qs + conformance green + Founder sign-off | `MAIL_LIVE` | none |
| **P9a / P9b** | Internal Founder testing — Download path / Send path | no / yes | P6a / P6b+P3-live | — | none |
| **P10a / P10b** | Beta rollout — Download / Send | no / yes | P9a / P9b | staged flag % | none |

**Engineering critical path (Send):** `P0 → P1a → P1b → P5 → P6a → P7(∥P2) → P6b → P3-live → P9b → P10b`. Bottleneck is P2 wall-clock (counsel), outside engineering control.
**Earliest shippable wallet-free milestone:** `P0 → P1a → P1b → P5 → P6a → P9a → P10a` — Download Package live, zero wallet, zero live provider, decoupled from CROA and vendor Q&A. (Even earlier operator-visible value: **P5-accel** ships the evolved `/mail` room over existing data with one flag.)

## 4. The eleven required deliverables (index)
1. Execution Plan — this document. 2. Dependency Graph — `DEPENDENCY-GRAPH.md` (+ EXEC-SEQUENCING §2). 3. Implementation Sequence — §3 above + EXEC-SEQUENCING. 4. Migration Plan — `MIGRATION-PLAN.md`. 5. Feature Flag Strategy — `FEATURE-FLAG-STRATEGY.md`. 6. Testing Strategy — `TESTING-STRATEGY.md`. 7. Rollback Strategy — `ROLLBACK-STRATEGY.md`. 8. Risk Register — `RISK-REGISTER.md`. 9. Founder Summary — `FOUNDER-SUMMARY.md` (+ HTML). 10. Markdown — all of the above. 11. Standalone HTML — the handoff set.

## 5. Founder decision gates (carried; nothing proceeds past a closed gate)
1. **CROA §404 counsel** — blocks all money code (P2 gates P6b/P7/P8b/P3-live-settlement). 2. **Gate D Phase −1** (P1a+P1b) — blocks all fulfillment schema. 3. **16 LetterStream vendor questions** — block live wiring. 4. **Earned VC instrument classification** (sixth instrument vs promotional credit) — CCO/Founder decision, gates the Earned VC ledger. 5. **§611-clock-without-receipt** CCO question. 6. **Founder sign-offs**: `MAIL_LIVE` flip, each production migration apply, each money-flag flip. Keeping the prepaid wallet does not moot gate 1.

## 6. Standing constraints
Additive-migration-first (0 DROP; no new self-heal table); flags fail-closed `=== "true"` OFF; no build step mutates the DB; Provider Acceptance irreversible (settled stays settled; post-acceptance = accounting `adjust`); Vendor Opacity from day one; Case Journey Runtime is the primary workflow everything reports into; no third architecture cycle. This plan schedules nothing money-moving before its legal gate and nothing live before its vendor gate.
