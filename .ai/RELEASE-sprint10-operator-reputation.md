# Sprint 10 — Operator Reputation Service (implementation record)

**Point-in-time record · 2026-07-21 · branch `feat/operator-reputation` (stacked on `feat/operator-identity`, UN-MERGED).** Platform Services Phase II slice — the engine behind Arena. Built, tested, adversarially reviewed; **dormant behind `OPERATOR_REPUTATION_ENABLED` (fail-closed OFF)**. Nothing merged/deployed/migrated/activated. Live state: [`CURRENT-STATE.md`](CURRENT-STATE.md); canon: [`VECTOR-XP.md`](VECTOR-XP.md) (architecture) + [`ARENA-CONTRIBUTION-POLICY.md`](ARENA-CONTRIBUTION-POLICY.md) (policy) + [`PLATFORM-OWNERSHIP-MAP.md`](PLATFORM-OWNERSHIP-MAP.md).

## Status
`Built` · `Dormant (flag OFF)` · `Migration-first (additive, un-applied)` · `Append-only by construction` · `Zero policy values minted`

**Constitutional boundary implemented:** Identity → Event Fabric → **Reputation** → Arena. Identity knows WHO; **Reputation knows HOW ACCOMPLISHED**; Arena only visualizes. Reputation consumes identity **read-only** (one lookup: `findOperatorById`) and never mutates it; Arena is untouched (zero UI, zero routes).

## 1. What was built (`lib/reputation/**`, 8 modules)
- **Ledger (truth):** `XpAward` — append-only, `UNIQUE(subjectId, operatorId, awardKind)` per VECTOR-XP §5. `subjectId` = the stable business entity (never the per-emission event id — the BLOCKER the 2026-07-20 review flagged); `awardKind` = the earning **dimension** (`outcome` only in v1), so a class flip can't double-mint one letter (Arena rule 2, generalized). Corrections = appended compensating records (`reverse:<kind>`, one slot per original, negative xp); **no update/delete path exists anywhere** (guard-asserted).
- **Replay/projection model:** standing (total XP, level, rank, counts) is a **deterministic fold** over the ledger in `[createdAt, id]` order — no stored balance, no projection table, replay-identical across input order, floored at 0. `replayStanding()` proves derived-everything at any time.
- **Milestones:** `ReputationMilestone` — **latched** facts (`UNIQUE(operatorId, milestoneKey)`), immune to re-weighting; the latch **mechanism** ships with **zero built-in definitions** (DW-D8 owner-gated; definitions injected at activation).
- **Policy adapter (reuse, not duplicate):** `lib/arena/policy.ts` + `project.ts` are the sole policy/math source (the canon split: policy doc owns *what earns and how much*; reputation owns *storage/progression*). `resolveAwardXp` is server-authoritative and fail-closed (non-live/refused/unknown class → null); **no XP input exists**, so a browser-supplied amount is impossible by construction. No new XP value minted (DW-D1 stays owner-gated).
- **Facts on the Event Fabric (canonical, Phase 6):** `OPERATOR_XP_CHANGED@1` (grants), `REPUTATION_AWARD_REVERSED@1` (reversals), `OPERATOR_RANK_CHANGED@1`, `MILESTONE_REACHED@1` (refs-only, source `reputation`). The Arena-named `ARENA_POINTS_CHANGED@1` / `ACHIEVEMENT_UNLOCKED@1` are deprecated (retained for replay, no longer emitted). Recorded via `appendEvent` under a trusted `systemIdentity`, idempotent, **no fanout**. Rank facts derive from the shared canonical `rankTransitions` in both the write path and the reconciler (no double-publish). Reputation emits facts; owns no downstream behavior.
- **Service doors (5):** `recordAward` (server-internal ingestion; idempotent; xp from policy) · `reverseAward` (admin-only compensating record; a reversal can't be reversed; maker-checker documented as activation-gated per VECTOR-XP §6.1) · `evaluateAndLatchMilestones` · `getStanding` (own-data/admin only — the refusal register stands) · `replayStanding`. All fail-closed on the flag.

**Deviations from the sprint prompt (repository truth overrides):** no `StreakAdvanced`/streaks, no leaderboards/named ranking (**`REFUSED_V1` is binding**); no separate "trust score" number (not in canon; XP + milestones + rank only); XP-grant/badge facts reuse the existing contract types rather than minting duplicates; certifications remain a reserved seam (identity owns issuance records; reputation would own meaning — neither built).

## 2. Migration summary
`prisma/migrations/20260721160000_operator_reputation` — **additive, 0 DROP**: 2 tables (`XpAward`, `ReputationMilestone`), unique constraints, fold-order index, 2 cascade FKs onto `OperatorIdentity` (erasure-compatible). Migration-first; no self-heal; build runs no migration. **Not applied to any DB** — owner-gated, sequenced **after** the operator_identity migration (which itself sits behind the v0.8.0 Gate D `0_init` baseline).

## 3. Guard-caught constitutional fix
`ARENA_POINTS_CHANGED@1` + `ACHIEVEMENT_UNLOCKED@1` were minted in Sprint 8 at scope **`self`** — any authenticated identity could publish its own XP fact. Tightened to **`platform`** (server-authoritative; only trusted/admin emitters) — zero producers existed, so nothing breaks; VECTOR-XP's "never browser-awarded" invariant now holds at the contract layer too.

## 4. Validation evidence
`npm run typecheck` **0** · `npm run build` **0** · full guard suite **63 pass / 2 fail** (the 2 — `execution`, `missionEngine` — pre-existing on `main`, unrelated). Reputation guards: migration **15/0**, core **32/0**, runtime **25/0** (executed dormancy: all 5 doors + the event recorder return `disabled` flag-off, no DB touch). Regressions re-pass: eventbus (validate 73/0 incl. 21-type count, authz-isolation, idempotency-replay, notification-nodup), identity (core/events/runtime), arena (projection/cohort). DB-backed preview validation is owner-gated (not run).

## 4b. Adversarial review (Phase 7 — 14 agents, 4 vectors, verify-passed)
1 HIGH + 3 MED + LOWs, **0 BLOCKER**. Two vectors (forged-XP, ledger-mutation-application-layer) CLEAN. All fixed on-branch (`9250cd4`):
- **HIGH — double-mint:** the durable `subjectId` reused `outcomeAwardKey()`, which embeds `arena:v<POLICY_VERSION>` — a policy bump rotated every key, letting one letter mint twice (the exact key §5 rejects). Fixed: `reputationSubjectId(type, id)` is **version-free**; `policyVersion` stays a recorded column for the forward-reweight only.
- **MED — hard-delete:** ledger FKs `Cascade → RESTRICT`, so `prisma.user.delete` (the live agency client-delete route) can't silently cascade-destroy the append-only audit ledger or un-latch a milestone; erasure must retain pseudonymous rows explicitly (§6.1).
- **MED — cross-user read:** `replayStanding` was unauthenticated on the public barrel; now own-data/admin gated.
- **LOW — fact fidelity:** `reverseAward` now emits compensating XP + rank facts; the rank fact is keyed per **cause** (award id), not per edge, so a reversal-then-re-promotion isn't silently deduped.
- **INFO — canon:** VECTOR-XP §6 codified the `sourceEventId` key §5 rejected; §6 corrected to `UNIQUE(subjectId, operatorId, awardKind)`.
- **Documented, not folded (dormant, activation-gated):** award-append and fact-emit are non-atomic — a crash between them loses a *fact* (never *truth*: standing always re-folds from the ledger); at-most-once best-effort facts are reconcilable by a future replay sweep, matching the Event Fabric's own posture.

## 5. Commit inventory (`feat/operator-reputation`, stacked on `f690373`)
| # | SHA | Subject |
|---|---|---|
| 1 | `deea50a` | migration-first durable Vector XP ledger schema |
| 2 | `09b3578` | pure core — policy adapter (reuse), deterministic fold, milestone latch |
| 3 | `0886b6c` | progression facts on the Event Fabric |
| 4 | `7d6f947` | append-only ledger repository + runtime service |
| 5 | `bab22da` | guards + XP-fact scope tighten (self → platform) |
| 6 | `b174a78` | docs — release record + ownership/canon updates |
| 7 | `9250cd4` | adversarial fixes — version-free subject, RESTRICT FK, authz replay, reversal facts |
| 8 | _this_ | docs — adversarial review outcome + VECTOR-XP §6 canon fix |

## 6. Owner-gated next steps (STOP at branch push)
Do NOT merge/deploy/migrate/enable. Sequenced gates: Sprint 9 merge (approved, not executed) → this branch's review + merge → Gate D migrations (`0_init` baseline → event_bus → operator_identity → operator_reputation) → wiring real award producers (outcome facts) + Arena re-pointing to reputation projections (a thin-presentation refactor, its own slice) → only then `OPERATOR_REPUTATION_ENABLED`. Milestone definitions, non-outcome dimensions (education/community/agency), maker-checker approval flow, and every cross-user surface remain owner/counsel-gated and unbuilt.
