# The Moat — everything that compounds

The question every shipped feature must answer (Founder's Standard Q10): **which moat does this strengthen?** A moat here = an asset that gets more valuable with use and is expensive/slow for competitors to replicate. Ranked by compounding power.

| # | Moat | What compounds | Fed by | Status |
|---|---|---|---|---|
| 1 | **Verified knowledge corpus** | Attorney-verified + staff-approved answer library; every verification is permanent, citable, and un-fakeable by competitors | KaiAnswer pipeline, counsel reviews, community promotion (ADR-0006) | DESIGNED |
| 2 | **Trust/brand equity** | Reputation for never promising outcomes, receipts-everywhere; compounds with every restrained interaction and becomes the recommendation engine | Every surface; Article XI; the CROA-bar-as-identity | LIVE & compounding |
| 3 | **Compliance framework** | The scrubber, review gates, approved-language corpus, counsel sign-offs; each ruling/review makes the next product decision faster and safer — competitors must rebuild years of this to move at our speed safely | `lib/compliance.ts`, `/compliance-review`, COMPLIANCE.md | LIVE |
| 4 | **Dispute outcome data** | Anonymized strategy→outcome funnel across users; over time = the only honest "what actually works" dataset in the category (always typical-results framed) | outcome tracking, funnel metrics, W36/W40 | PARTIAL (funnel live; scale pending) |
| 5 | **Community intelligence** | Threads, verified answers, situational matches; network effects — each member makes the next member's experience richer | Community Hub + promotion loop | LIVE, early |
| 6 | **Kai (the character IP)** | Recognition compounds with every consistent appearance; a trusted character is unforkable — competitors can copy features, not a relationship | Creative OS, Brand Universe, consistency gate | DESIGNED (assets pending) |
| 7 | **Institutional memory / engineering governance** | The `.ai/` OS itself: constitution, ADRs, bibles, registries — every session starts smarter and cheaper; velocity compounds while competitors re-derive context | this entire system | LIVE (this session's work) |
| 8 | **Educational content library** | Statute cards, explainers, Brief archive, series episodes — evergreen SEO + in-product teaching; each piece is a permanent trust asset | Media OS, Brief pipeline, statute library | LIVE, early |
| 9 | **Prompt & creative asset libraries** | Composable prompt blocks, scored renders, templates, storyboards — production cost per asset falls monotonically | HIGGSFIELD-PROMPTS, ASSET/CAMPAIGN registries | LIVE (docs), assets pending |
| 10 | **Knowledge graph / event history** | Per-user event streams + platform-wide patterns; the longer a user stays, the more irreplaceable their timeline (switching cost measured in personal history) | KaiEvent/KaiRecommendation (E1) | DESIGNED |
| 11 | **Agency rails** | Professional workflows, follow-up clocks, client trust chains — B2B relationships compound and refer | Agency OS | LIVE, early |
| 12 | **Cost-structure advantage** | AI-last architecture: deflection rate rises with corpus growth → blended cost per question FALLS as competitors' chatbot costs scale linearly | ADR-0006 pipeline + metering | DESIGNED |

## Rules
1. Feature reviews name their moat by number (ship note, one line).
2. Moats 1, 4, and 10 are **data moats — privacy law applies absolutely**: anonymization, consent, and Art. V come before compounding. A moat built on user betrayal is a liability.
3. Quarterly: re-rank this table on evidence (which moats actually deepened?); feed the improvement engine.
4. The meta-moat is #7: we compound *decision-making itself*. Guard it — governance drift is moat erosion.
