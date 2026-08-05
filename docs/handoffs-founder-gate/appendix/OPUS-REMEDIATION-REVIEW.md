# Appendix H — Opus Bounded Review of the Six Fixes (Phase 1A-R)

One bounded adversarial review: the six blocker fixes, cross-fix state consistency, launch risk, regressions. No experience walk, no repository-wide inspection. Commits reviewed: `7750cba`, `ec8ad41`, `fd15988`. All three SHOULD-FIX findings below were subsequently closed in `18f0ea2` and live-verified (FIX-A on the demo account; FIX-B before/after on a mailed letter; FIX-C click-tested approved→canceled).

---

## 1. VERDICT: REMAINING CONCERNS

No blocker. Three SHOULD-FIX, four ACCEPT-WITH-NOTE. Nothing here makes the product riskier than the gate baseline; the money path is clean.

## 2. Per-blocker

| # | Fixed as claimed? | Evidence |
|---|---|---|
| RB-1 | **Partially.** `kaiHome.ts:91` hoists `disputedIds` above the `obsolete` candidate and adds `!disputedIds.has(t.id)` at `:102`. Verified live — demo `/dashboard` no longer headlines the §605 pick. But the *product-level* claim ("the OS orders work it already did") is not closed; see finding A. *(Closed in `18f0ea2`.)* | diff + live |
| RB-2 | **Yes.** `isFactualNegative` replaces the `probability !== NOT_RECOMMENDED` band at `negatives`, `disputable`, the Deferred Queue, and both per-item surfaces. Live: 3 rows render Clean / "nothing to dispute"; deferred 9 raw → "6 accounts staged" — cross-metric consistent. | diff + live |
| RB-3 | **Yes.** New rung at `mailCenter.ts:517`; `app/mail/page.tsx` passes `readyPackages.length`. Live on demo: band reads "Do this first · 1 package ready to prepare"; zero occurrences of "all caught up". | diff + live |
| RB-4 | **Yes for the download chain**, with a records-integrity regression on the print view (finding B, closed in `18f0ea2`). List route uses the **full** decrypted body, not the 240-char preview — so card and artifact cannot disagree. | diff |
| RB-5 | **Yes.** Client `min`/`max`/value use local getters; server shifts the raw instant by ±14h *before* flooring; storage at UTC noon. Two residuals (findings D, E). | diff |
| RB-6 | **Yes.** `planLetterRegeneration` + net-new-only gating + `plannedItemKeys`. One inverse failure (finding C, closed in `18f0ea2`). | diff |

## 3. Money-adjacent ruling — PASS

The relaxed 402 is *not* the enforcement point. Exact logic:

```js
const hasQuota = entitlement.lettersRemaining === null || entitlement.lettersRemaining > 0;
if (toUpdate.length === 0 && toCreate.length > 0 && !hasQuota) { /* 402 */ }
let allowedNew = toCreate.length;
if (entitlement.lettersRemaining !== null && toCreate.length > entitlement.lettersRemaining) {
  allowedNew = Math.max(0, entitlement.lettersRemaining); capped = true;
}
const newTargets = toCreate.slice(0, allowedNew);
...
await spendLetterCredits(user.id, entitlement, created.length);
```

- **The named attack (0 remaining, 1 unmailed EQ, select EQ+EX+TU):** the 402 is skipped because `toUpdate.length !== 0` — but `allowedNew = Math.max(0, 0) = 0`, so `newTargets = []`. Result: 1 update, **0 creates**, `spendLetterCredits(…, 0)` no-ops. The bureau-widening bypass does not exist. With 1 remaining: `allowedNew = 1`, one create, charged once.
- **Free-letter factory via strategy/tradeline switch:** impossible. The candidate query is `{ userId, tradelineId, strategy: strategyKey, round: 1 }` — any change to strategy, tradeline, round, or bureau falls to `toCreate` and is quota-gated. Update reuses a row; row count never grows uncharged.
- **Ledger:** `track(disputeCreated)` is gated on `created.length > 0`. Since quota is `MAX(rows, ledger)` and 0 rows are inserted in that case, skipping is exactly right — no under-metering.
- **`spendLetterCredits` literally intact:** `billing-integrity.test.ts` still pins the call text and the single-source decrement. `lib/entitlements.ts` is untouched by all three commits.
- **AI-cost leak:** none. Free tier has `aiRefinement: false`; premium is already unlimited. The 40/hr rate limit precedes the plan and covers both paths.

## 4. RB-5 tolerance ruling — ACCEPT

The ±14h shift-then-floor is the correct construction (padding after flooring is wrong in both directions, as the code's comment argues). Over-acceptance is bounded at exactly one calendar day in each direction, and the client `max={todayIso()}` (local today) blocks the evening "tomorrow" entry through the UI — only a direct API call reaches it. On a self-attested mailing date with no carrier receipt, ≤1 day of over-acceptance is strictly better than rejecting the operator's true date. No consumer treats `mailedAt` as a UTC-midnight day-key. Ruling: accept.

## 5. Findings

**A. RB-1 survives in the campaign planner — SHOULD-FIX.** *(Closed: `campaignInput.ts:91` in `18f0ea2`.)*
`GET /api/campaigns` on demo returned Navient `alreadyInFlight=false` while three GENERATED unmailed fcra_605 letters existed on that tradeline; `alreadyInFlight = plannedKeys.has(key) || (latest?.status === "MAILED")` counts a generated-but-unmailed letter as neither. RB-1 removed the loud §605 pick, so the campaign offer became the headline — the same fabricated priority, relocated. Smallest fix: one disjunct (`|| history.some((l) => !l.mailedAt)`).

**B. Print view rewrites and warns on MAILED letters — SHOULD-FIX.** *(Closed: print page guards on `mailedAt` in `18f0ea2`.)*
`resolveSenderPlaceholders` and the "Before you mail this" banner ran unconditionally on the print view; every other RB-4 surface guards on mailedAt. An operator who mails a placeholder letter, completes Settings, and reopens the print view would see text that was never mailed presented as their dispute record. Smallest fix: mailed → verbatim body, no banner.

**C. RB-6 planner inverse — abandoned APPROVED campaign shadow-blocks permanently — SHOULD-FIX.** *(Closed: cancel control surfaced in `18f0ea2`, click-tested.)*
`CAMPAIGN_PLANNED_STATUSES` includes APPROVED; only COMPLETED/CANCELED/SUPERSEDED release; the API exposes `action:"cancel"` but the campaigns page rendered no cancel control. Mitigation existed (Mission Control still emits "Mail N approved disputes"), but items were otherwise locked with no user-reachable release. Smallest fix: surface the existing cancel action.

**D. RB-5 is forward-only — ACCEPT-WITH-NOTE.** No backfill. Letters already marked mailed keep UTC-midnight storage and still display one day early in every US timezone — the gate's own RB-5 display complaint, unfixed for existing rows.

**E. RB-5 noon shift moves `daysElapsed` — ACCEPT-WITH-NOTE.** `daysElapsedSinceEstimatedReceipt` floors `(now − mailedAtMs)/DAY`; +12h storage makes the count up to 1 lower for part of each day. Direction is conservative (a window never reads closer to closing than it is). At UTC+12..+14, noon-UTC renders as the next local day — non-US edge.

**F. RB-3 rung order can mask a near-lapse deadline — ACCEPT-WITH-NOTE.** Rung 1 only covers `daysLeft <= 0`. A window with `daysLeft === 1` lives in the deadlines rung, now *below* READY_TO_PREPARE. Impact is low: the deadlines rung's own copy is "no action needed yet", and Mission Control's `closing` set still surfaces ≤5-day windows.

**G. Band vs. card wording — ACCEPT-WITH-NOTE.** "N packages ready to prepare" can coexist with a card badge "Needs your details before mailing". Not a contradiction ("prepare" ≠ "mail"), but tighten if a walk flags it.

**H. Regression sweep — clean.** Only two out-of-blocker behavior changes, both deliberate and commented: `updateOne` resets `PRINTED → GENERATED`, and clean tradeline rows exclude Kai's read while preserving bureau detail behind a relabeled toggle. Guard blocks are real behavior assertions with negative controls — they would catch a regression, not just pin source text.

## 6. LAUNCH-RISK

**No.** Nothing in these three commits increases risk versus the gate baseline. Compliance surface improves materially (RB-2 stops staging accurate accounts for dispute), billing integrity is preserved with the charge strictly bound to rows created, and finding B was the only change that made any single surface less truthful than before — bounded to the print view of an already-mailed letter, and closed.
