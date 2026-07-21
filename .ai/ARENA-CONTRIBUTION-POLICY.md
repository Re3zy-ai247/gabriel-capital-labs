# Arena Contribution Policy v1

**Version 1 · 2026-07-20 · owner-ratified feature, engineering-shaped by adversarial review.**
Canonical machine form: `lib/arena/policy.ts` (`ARENA_POLICY_VERSION = 1`). This doc explains the *why*; the code is the source of truth. A policy change ships as a NEW version, never an edit to a shipped one.

---

## The one principle

**XP derives only from verified evidence, and verified progress must be difficult to fake.** An adversarial review reshaped the naïve first draft; its conclusions are binding.

## What the evidence actually is (and isn't)

There is **no bureau-confirmed "verified" outcome in the system today.** Every `VerifiedOutcome.outcome` is AI-classified from text the *user pasted* into the response endpoint, and letters are unlimited self-service. A "deletion" is therefore self-attested and trivially fabricable. Per the frozen evidence-scale law, AI-classified evidence **caps at "documented."**

Consequence: Arena awards a **modest documented weight** for a favorable logged outcome and has **no high/verified tier.** A real verified tier would require a human-attestation or independent signal that the schema does not carry. Making the top tier reachable from pasted text would make the whole system farmable — so we don't.

## Classes

| Class | Meaning | Live? | Base XP | Evidence |
|---|---|---|---|---|
| **A** | Favorable outcome logged (`deleted`/`updated`) | ✅ | 20 | documented |
| **Aq** | Bureau response logged (`verified`/`no_response`) | ✅ | 8 | documented |
| **D** | Completed cycle (any recorded, non-`unknown` result) | ✅ | 12 | documented |
| B | Accepted community contribution | ⏳ pending | 0 | needs a durable "reply accepted" signal |
| C | Education completion | ⏳ pending | 0 | needs durable Academy completion evidence |
| E | Agency client activation | ⏳ pending | 0 | needs the verified `managedByAgencyId` edge + first cycle |
| F | Affiliate conversion | ⛔ refused | 0 | cash payout refused; non-cash needs owner + CCO |

Relative ordering (A > D > Aq) is preserved; the absolute numbers are deliberately small so fabrication buys little. `unknown` (an AI-classification failure) and `null` mint **nothing**.

## The four rules that make it un-farmable

1. **Attribution = the evidence owner** (`VerifiedOutcome.userId`), copied verbatim — never the session (`currentAccount`/`currentUser`). Otherwise an agency operating a client's workspace would farm the client's XP onto itself. Guard-pinned: the engine never imports or calls a session identity.
2. **Idempotency keyed on `letterId`** (the stable entity), never the mutable outcome. One letter → at most one award. A `deleted`↔`updated` flip cannot double-count.
3. **Reconcile-on-read.** Standing is a pure fold over *current* outcome truth. A later revision (outcomes are mutable, ADR-0014) is reflected automatically — a flipped-to-`unknown` outcome drops to zero XP, with no stored award to go stale. This is why v1 needs no new table.
4. **Own-XP only.** No cross-user ranking ships. See below.

## Refused in v1 (not deferred — refused, pending a separate gate)

- **Cross-user / named leaderboard.** A public ranking of "who deleted the most tradelines" is an implied-typical-results surface (**CROA §1679b / FTC §5**), and the recorded corpus-consent authorizes *anonymized* contribution only — not a named competitive board. A ranked surface requires a **separate, explicit display-consent record + CCO/CROA sign-off**, defaulting off. Until then the only multi-user surface is **aggregate integers** (counts, never people) on the admin inspector.
- **Streaks, seasons, cash affiliate payouts** — refusal register, pending owner + CCO.
- **Generic public 1–5 star operator rating** — **constitutionally refused** ([`ADR-0037 §3`](ADR/ADR-0037-operator-growth-constitution.md)): incumbency bias, subjective popularity, fake reviews, competitive sabotage, unequal starting conditions, weak evidence, disproportionate harm from small samples. The platform presents **evidence-backed contribution, not a popularity number.** A future *structured, context-specific* feedback system (response-time compliance, verified attendance, moderated testimonials) is not categorically prohibited but must never become a popularity score, and needs its own architecture + consent + abuse controls + legal review.

## Prohibited XP sources (asserted by the guard, can never be awarded)

login · page-open · letter generation · report upload/analysis · message/reply/thread counts · likes/bookmarks/shares · any KaiEvent as a direct source · `unknown` outcomes · invite-sends · referral clicks · unpaid signups · self-acceptance.

## Versioning

`ARENA_POLICY_VERSION` + a frozen weight table in `lib/arena/policy.ts`. A reweight ships as **version 2** with its own frozen table; shipped awards are never edited. Changing a number here is a policy decision, not an implementation detail — it changes what contribution means.

## Shipped this session (proven) vs deferred (owner/DB-gated)

- **Shipped, pure, tested (27/27 + negative controls):** the policy, the projection engine (`deriveAwards`/`projectStanding`/`aggregateStats`), the level/rank ladder, the flag (OFF).
- **Deferred:** any append-only award *table* (the v1 read-projection needs none), the user-facing own-XP surface, and every refused surface above.

**Scope note:** this doc owns the **scoring policy** (classes, weights, refusals, un-farmable rules). The **lifetime-progression architecture** it feeds — the append-only award ledger, milestones, entitlements, reward claims, the 6 earning dimensions, and the anti-Sybil/fraud controls — is [`VECTOR-XP.md`](VECTOR-XP.md) (the Operator Reputation Service), governed by [`ADR-0037`](ADR/ADR-0037-operator-growth-constitution.md). "Vector XP" is the product framing of this same evidence-backed reputation. Arena is the **experience**; this policy + the ledger are the **truth**.
