# Compliance (canonical)

High-risk domain. Claude Code never declares legal compliance from its own interpretation (Constitution Art. IV). `/compliance-review` (the CCO skill) gates every user-facing or money-touching change.

## The CROA bar (Existing product rule)
- Never guarantee deletions, removals, or score increases.
- No §609 / Metro-2 "deletion myth" framing (§609 is always paired with §611 — `lib/strategies.ts`).
- Never promise removal of accurate negative items.
- CreditVector is **software and education first** — never positioned as a credit-repair service.
- No fabricated cross-bureau claims (per-bureau presence model, `lib/bureauData.ts`).

## Implemented controls (VERIFIED in code)
| Control | Where |
|---|---|
| Compliance scrubber on all generated letters + Brief summaries | `lib/compliance.ts` (`applyCompliance`) |
| Kai guardrails: credit-only scope, compliance non-waivable, untrusted-input fencing | `lib/kai.ts` (ADR-0005) |
| Brief **admin-approval-before-publish** — THE compliance control for news; ingest creates DRAFTS only | `lib/brief.ts`, `lib/briefIngest.ts` (ADR-0003) |
| Brief comments: prohibited-claim comments REJECTED with 422 (never stored/reworded) | `screenCommentBody()` in `lib/brief.ts` |
| Disclaimers: `BRIEF_DISCLAIMER`, `BRIEF_COMMENT_DISCLAIMER` ("unverified… results aren't typical"), site-wide educational disclaimer | `lib/briefShared.ts`, `components/Disclaimer.tsx` |
| YouTube embeds host-allowlisted + publish confirm attests no guaranteed-deletion/score claims | `lib/briefShared.ts`, admin brief page |
| Correct statutes (§611 reinvestigation, §623 furnisher, §605 obsolescence, FDCPA §809) | `lib/statutes.ts` |
| Government/child-support debts flagged NOT_RECOMMENDED, excluded from dispute queue | `lib/classify.ts` |
| CAN-SPAM: opt-in digest includes one-click unsubscribe plus the Founder-approved LLC postal identity; send fails closed if the canonical server value is unavailable | `lib/companyIdentity.server.ts`, `lib/briefDigest.ts` (source VERIFIED in the isolated candidate 2026-08-01; deployment/received test NOT VERIFIED) |

## Counsel review REQUIRED (open — no attorney sign-off documented anywhere)
1. CROA "educational, not credit-repair" positioning — overall product/marketing posture.
2. News-editorial/defamation posture — **before publishing the first auto-drafted Brief article**.
3. Subscription model vs CROA advance-fee rules — Internal compliance assumption only. Status: NEEDS CONFIRMATION.
4. Agency-tier risk (third parties using the platform for clients) — Internal compliance assumption only.
5. State CSO law applicability — Status: NEEDS CONFIRMATION; no state-by-state analysis exists in the repo.

Nothing in this repository is **Counsel approved**. Do not use that label until a documented sign-off exists (record it here + as an ADR when it happens).

## Prohibited marketing claims (Existing product rule)
Guaranteed deletions/score gains · "we remove negative items" · outcome promises or "results typical" framing · §609 magic-letter claims · positioning as a credit-repair organization service. Approved copy source of truth: what is live on `main` (landing `app/page.tsx`, pricing, legal pages) — it has passed `/compliance-review`; treat deviations as new review triggers.

## Privacy
`app/legal/privacy` discloses public comments and Brief activity data (likes/bookmarks). Comment author display = username/first-name only (`briefCommentAuthorName()`). Bookmarks are private; `/brief/saved` is noindex.
