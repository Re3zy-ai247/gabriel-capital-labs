# Architecture & QA-fix traceability

This rebuild maps every issue found in QA of the Abacus app to a concrete part of the codebase.

| QA finding | Fix location |
|---|---|
| Letter generation 500 / hard-fail | `app/api/letters/generate/route.ts` — deterministic grounded draft + optional LLM refine + try/catch; never depends on LLM to return content |
| Empty Bureaus column | `lib/bureauData.ts` presence model + `app/tradelines/page.tsx` `BureauBadges` |
| Fabricated "other bureaus don't report this" | `lib/letter.ts` `renderTemplateLetter` (cross-bureau block gated on `hasCrossBureauKnowledge`) + `buildSystemPrompt` rule 3 |
| Everything scored "Low" | `lib/scoring.ts` — multi-factor weights independent of cross-bureau data |
| Discover/OneMain/Upgrade mislabeled Collection | `lib/classify.ts` original-creditor patterns |
| Child Support / NYS OTDA disputable | `lib/classify.ts` GOVERNMENT + `Probability.NOT_RECOMMENDED`, excluded in `app/strategist/page.tsx` |
| Duplicate tradelines | `lib/dedupe.ts` |
| §609 myth | `lib/strategies.ts` (`fcra_609` relabeled, `fcra_611` default) + `lib/statutes.ts` |
| Pay-for-delete / C&D risk | `lib/strategies.ts` `riskNote` surfaced in `app/letters/page.tsx` |
| Dashboard metrics didn't reconcile | `app/dashboard/page.tsx` single-source-of-truth derivation |
| No re-analyze for stored data | `app/api/reports/analyze/route.ts` + `components/ReanalyzeButton.tsx` |
| Placeholder addresses in mailed letters | consumer-info gating in generate route + `app/letters` warning |
| Guarantee language | `lib/compliance.ts` applied to final text |
