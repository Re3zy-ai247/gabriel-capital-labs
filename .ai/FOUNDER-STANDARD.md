# The Founder's Standard (the quality gate — nothing ships below it)

Status: **BINDING** — this is gate 6 of the ship process (after the five reviews: CEO, Eng, Design, Compliance, QA). Codifies the founder's Trust-First Company Rule (2026-07-12), recorded as Constitution **Article XI**.

## The Trust-First Rule (company law)
We no longer optimize for feature count. We optimize for trust. **Every feature must do at least one of:** increase trust · increase clarity · increase customer confidence · reduce maintenance · increase brand equity · reduce operational cost · reduce AI cost. **If it does none — do not build it.** And the standing question is never "what feature next?" but "**what makes Gabriel Capital Labs one of the most trusted AI companies in consumer finance?**"

## The gate (answer all eleven; any "no" returns the feature to design)
1. Would Steve Jobs ship this?
2. Would Stripe ship this? (billing/money surfaces especially)
3. Would Linear ship this? (speed, keyboard, craft)
4. Would Apple animate this — with this timing, this restraint?
5. Does it reduce cognitive load? (fewer decisions, clearer defaults)
6. Does it increase trust? (receipts, honesty, no dark patterns)
7. Does it pass the three-question rule? (Where am I / Why / What's next — `PRODUCT-VISION-V2.md`)
8. Would Rey proudly demonstrate this live, unrehearsed, to a skeptic?
9. Does it survive the CROA bar without a single caveat asterisk?
10. Does it strengthen at least one moat? (`MOAT.md` — name which)
11. Is it the smallest honest version? (no speculative complexity — Constitution Art. VIII)

## How it runs (lightweight, not bureaucracy)
- Applied at TWO points: design sign-off (before build) and pre-ship review (on the real thing, not screenshots).
- The answers are one line each, recorded in the PR/ship note. Total cost: five minutes. A feature that can't pass in five minutes of honest answers isn't ready.
- The gate judges *quality of the version*, not ambition of the idea — "return to design" means "make it smaller and truer," almost never "add more."
- Delight items (`DELIGHT-SYSTEM.md`) ship WITH their feature and are covered by the same gate run.

## Standing kill-list (auto-fail patterns)
Fake progress bars or invented numbers · urgency theater (countdowns, scarcity) · celebration that ambushes with an upsell · settings that hide consequences · guilt-trip copy anywhere · notification without action · any Kai behavior off-bible · any claim without a receipt.
