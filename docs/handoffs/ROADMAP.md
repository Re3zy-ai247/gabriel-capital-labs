# Roadmap — CreditVector Execution Era

This document places the Fulfillment Engine v1.0 architecture package inside the Founder's stated Execution-Era priority order. Items 1 and 4–10 are the broader company roadmap, carried here for context; this handoff package's actual content — the 22 documents under `docs/fulfillment/` — speaks directly and only to items **2 (Wallet)** and **3 (LetterStream integration)**. Where a roadmap item is outside this package's scope, this document says so rather than inventing coverage.

**Launch target:** September 1, 2026 — stated directly in the architecture package itself: `docs/fulfillment/PROGRAM-BRIEF.md` §0 frames the accepted CXOS RC2 baseline as "operational UX for the September 1, 2026 launch," and `docs/fulfillment/IMPLEMENTATION-SEQUENCE.md` is explicitly "bounded toward a September 1, 2026 target: every phase ships flags OFF, product behavior byte-identical to today until an owner-gated flip." The architecture is designed to ship, inert, on schedule — activation is a deliberately separate, later, owner-gated event (Phase 7), never coupled to the launch date.

## Priority order and readiness

| # | Priority | Architectural readiness (this package) | Gating precondition |
|---|---|---|---|
| 1 | **Production readiness** | Out of this package's scope — this program touched no product code, schema, dependency, or flag. Production remains `origin/main@f449c35`, unchanged. | N/A to this handoff |
| 2 | **Wallet** | **Architecture READY-WITH-DISCLOSURES.** The commitment model, anchor-lock serialization, per-letter/attempt settlement grain, payer model, and Recovery Engine are fully designed and adversarially re-gated clean (`docs/fulfillment/COMMITMENT-RESOLUTION.md`). Nothing is implemented. | **CROA §404 counsel question** (hard precondition to any implementation phase, `ADVERSARIAL-REVIEW.md` §3.4) and **Gate D Phase −1** (hard precondition to any new migration, `ADVERSARIAL-REVIEW.md` F1) — both stand unchanged since the first gate. See `docs/handoffs/EXECUTIVE-SUMMARY.md` for the full statement. |
| 3 | **LetterStream integration** | Provider abstraction and Vendor Opacity law are designed (`A-PROVIDER-ABSTRACTION.md`); the honest `validateAddress` contract and fail-closed status mapping are specified. **Live wiring is explicitly out of scope for this entire program** — `MAIL_LIVE` stays OFF throughout; the LetterStream adapter still throws `not_wired` on every method even when live. | The 11-question vendor-confirmation set (`FULFILLMENT-COMMITMENT-BOUNDARY.md` §2.1) must be answered before any live wiring; `MAIL_LIVE` flip is its own final, separately-gated runbook step (`IMPLEMENTATION-SEQUENCE.md` §8, Order 5) requiring CASS/USPS live validation (if pursued) and CSO + CCO review — never bundled with any other flag flip. |
| 4 | **Kai onboarding** | Not addressed by this package. Kai's fulfillment-specific narration/boundary laws are designed (`D-KAI-EXPERIENCE.md`, `KAI-FULFILLMENT-UX.md`), but general Kai onboarding is a separate product surface. | N/A to this handoff |
| 5 | **Mission Control polish** | Not addressed. `OPERATIONAL-ROOM-CONSTITUTION-PROPOSAL.md` §4 notes Mission Control (`/dashboard`) "already substantially conforms in spirit" to the six-presentation standard this program formalizes, via its existing Executive Queue pattern — but states plainly that Mission Control was "not re-audited by this program." | A future pass should confirm it meets all six presentations explicitly, not just the recommendation one (named as future work, not this program's) |
| 6 | **Arena** | Not addressed. Explicitly named as a reserved-integration-point-only surface for the Wallet — "Marketplace consuming Wallet cents" is named, not designed, in v1 (`IMPLEMENTATION-SEQUENCE.md` §9). | Wallet activation (item 2) must land first; Arena/Marketplace consumption is a separate future decision |
| 7 | **Growth Network** | Not addressed beyond a named reserved surface. "Growth Network funding" is explicitly flagged as "undefined by any existing ADR — Brief §1.6 names it, nothing else does" (`IMPLEMENTATION-SEQUENCE.md` §9). | Undefined — needs its own future architecture pass before any Wallet-funding integration |
| 8 | **Operator collaboration** | Not addressed by this package. | N/A to this handoff |
| 9 | **Mobile UX** | Not addressed by this package. | N/A to this handoff |
| 10 | **Performance** | Not addressed by this package, with one disclosed exception: the Wallet's anchor-lock serialization cost (one row lock per payer) is disclosed as "acceptable for launch scale; measured before Marketplace fan-out" — a performance consideration named, not resolved (`docs/fulfillment/COMMITMENT-RESOLUTION.md` §1, closing paragraph). | Measurement work, not designed here |

## Preserved subsystems

The following subsystems are named across the architecture package as things this program evolves, integrates with, or explicitly does not touch — carried here as the preserved-subsystems list for Execution-Era planning:

- **Wallet ledger** — the subject of this package (items 2 above); append-only, fold-derived, anchor-lock serialized.
- **Credit system** (`User.letterCredits`) — explicitly coexists with, never replaced by, the cents-denominated Wallet; the two gate different Case Journey steps (letter *generation* vs. fulfillment) — see `ADR-0044`'s "Alternatives considered."
- **Provider abstraction** (`lib/mail/MailProvider.ts` + five registered `MailProviderId`s) — formalized, not redesigned, by `A-PROVIDER-ABSTRACTION.md`.
- **Fulfillment pipeline** (`lib/mail/*`, the 16-state manifest machine, the send wizard) — the spine this entire program evolves; explicitly "evolve THIS, never a parallel system" (`PROGRAM-BRIEF.md` §2.1).
- **Identity** — the payer-principal model integrates with `lib/session.ts`'s existing `currentAccount`/`impersonationContext`/`currentWorkspace` primitives without redesigning them (`WALLET-COMMITMENT-MODEL.md` §9).
- **Organizations** — the dormant Operator Identity/Organization/Membership tables are named as existing-but-out-of-scope; the agency-staff sub-identity granularity residual (F7) is explicitly deferred to whenever that system activates.
- **Billing** — the Stripe top-up branch reuses the existing one-time-payment (`mode:"payment"`) shape verbatim and the existing 3-state webhook claim ledger; no new billing primitive is introduced.
- **Kai** — narration and boundary laws extended (`package.*`/`fulfillment.status` event family, the failure-translation catalog), never redesigned; Kai's four laws (never truth/money/execution/policy; never vendor identity; every event system-emitted; every claim carries `basis`) are restated, not altered.
- **Arena** — named as a future consumer of Wallet cents, explicitly not designed here (item 6 above).
- **Mission Control** — named as an existing precedent for the Room Constitution, explicitly not re-audited (item 5 above).
- **Operator Network** — not addressed by this package.
- **Growth Network** — named as a reserved, undefined future Wallet-funding surface (item 7 above).

## What "done" looks like for this package specifically

Per `docs/fulfillment/IMPLEMENTATION-SEQUENCE.md` §7 (Phase 6 — Pre-Launch Verification + Freeze): the architecture branch is mergeable to `main` with **zero observable behavior change** to any operator. That is the September 1 target for this package — the architecture ships, inert, on schedule; activation (Phase 7) is explicitly a separate, later, owner-gated event, never coupled to the launch date. See `docs/handoffs/NEXT-SPRINT.md` for what should happen between now and Phase 1.
