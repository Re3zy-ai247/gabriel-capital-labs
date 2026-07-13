# CX Review — every screen, every friction point (CPO/Head-of-UX/CCO audit)

Date: 2026-07-12. Evidence: all 42 `page.tsx` screens enumerated with form/input density (VERIFIED); `dashboard/page.tsx` read in full (VERIFIED); other screens assessed from size/structure/known architecture (INFERRED — run gstack `/qa` visual pass to upgrade). Bar: *"Would this feel like a product worthy of a multi-billion-dollar software company?"* New work items carry CX-IDs, slotted into `ROADMAP-V2.md` Amendment 1 — this doc recommends; the roadmap ranks.

## 1 · The one big architectural CX move: conversational workflows (CX-1 class)
The codebase's form-heaviest surfaces are exactly the highest-anxiety moments: `letters/page.tsx` (546L, 6 inputs), `settings` (344L, 11 inputs), `agency` (446L, 7 inputs), `upload` (292L), `support` (260L, 4 inputs). V2 pattern — **Kai-guided flows**: one question/decision per screenful, Kai's working states between steps, defaults pre-filled from the file (strategy, furnisher address already exist as data), forms reserved for what's genuinely tabular. Rules: every step shows why it's asked · every flow is resumable · the "power path" (all fields at once) stays available for pros/agencies — conversational is the default, never a cage. Priority order: letter flow (CX-1) → support intake (CX-11) → onboarding upgrade (exists as roadmap #23) → settings decomposition (CX-10).

## 2 · Customer journey — friction audit (stage → friction → fix)
| Stage | Friction today | Fix (refs) |
|---|---|---|
| Landing (519L, solid) | proves less than it could; no Kai | Landing V2 (#13), MK-H2 register |
| Signup (register 95L, clean) | fine; post-signup drop into app is unguided | route into onboarding always; D51 greeting |
| **Identity verification** | ⚠️ stage doesn't exist as a gate today (identity vault is optional storage). Adding IDV is a product+legal decision, not assumed | CX-12: founder/CLO decision — if added, make it Kai-explained ("why we ask") |
| Upload (292L) | good bones; parse states are generic | D1–D8 truth pass (#22) |
| AI analysis | results appear; no reveal moment | Analysis reveal + replay (#30, W10) |
| Letter generation (546L) | the form wall at the peak-commitment moment | **CX-1 conversational letter flow** + D25–D34 |
| Waiting period | dashboard shows clocks (VERIFIED, good) but no forward story | Deadline radar (#12), timeline (#6), retention engine §6 |
| Escalation | verified-outcome dead-end risk | Next-step cards (#11), escalation tree (#37) |
| Success | resolution recorded, not celebrated | D45, D94, proportional celebrations |
| Long-term | journey/scores pages exist but thin (74L/168L); no goals | Goal tracker (#43), arc views (#44), CX-3 timeline merge |

## 3 · Screen-by-screen verdicts (consumer surfaces)
| Screen | Verdict | V2 recommendation |
|---|---|---|
| `dashboard` (VERIFIED, 212L) | **B+** — follow-up clocks, §605 quick wins, honest bureau bars already live; but it's a report, not a briefing; `Est. Points Recovered` renders literal "~ estimate" (dashboard/page.tsx:177) — honest but reads broken | Becomes Kai Home (#7); kill or replace the est-points card with a real derived signal (CX-2); generic "Welcome back 👋" → event-driven greeting |
| `upload` | B | D1–D8; bureau auto-detect celebration (D4) |
| `tradelines` (76L, thin wrapper) | B− | per-row Kai chips, presence-dot draws (D10–D14, #14, #28) |
| `letters` | **C+ at the most important moment** | CX-1 + print elevation (#26) |
| `strategist` (72L) | B− | frame as Kai's plan; add reasoning expanders (W27) |
| `journey` (74L) | C — static; will collide with E1 timeline | **CX-3: merge into the KaiEvent timeline — one timeline, never two** |
| `scores` | B− | arc view (#44), goal distance (#43) |
| `identity` | B | discrepancy card polish (W9) |
| `community` + thread | B | smart search (#18), like-yours (#52), summaries (CX-6) |
| `brief` + article | B+ (strong already) | relevant-match chips (#51) |
| `support` | B− | CX-11 conversational intake + deflection (#17) |
| `settings` | C+ — 11 inputs, one wall | CX-10 decomposition, consequence copy (D77) |
| `billing` | B | credit math when economy ships (D78–D79) |
| `onboarding` (131L) | B− | SB-003 sequence (#23) |
| `login/register/reset` | B+ (clean) | leave alone — passes the gate |
| `pricing` (32L) | B | honesty pledge (W46, #48) |
| `help` | B− | fold into support deflection + statute cards |
| Admin suite (14 screens) | B — honest and functional | not customer-facing; only #27 (real MRR) urgent |

## 4 · Agency Command Center (CX-5, expands roadmap #34–35)
The most powerful AI workspace for agencies = the owner's morning in one screen:
- **Daily command center:** Kai Agency Briefing at top (events across all clients overnight, SLA risks ranked, today's must-dos) — the agency version of Kai Home, from the same event engine (client-scoped).
- **Client prioritization:** the existing needs-attention logic promoted to a ranked queue with *reasons shown* (D88) — "Maria R: bureau response day 32, unopened."
- **AI workload suggestions:** rule-based batching — "6 clients are ready for Round 2 — generate all six?" (bulk action with per-client review step; never blind-bulk).
- **Revenue insights:** real plan/entitlement data only (Art. II) — client count vs cap, at-risk clients (no activity 30d), per-client activity intensity. No invented LTV.
- **Team collaboration (NEW scope — currently single-seat):** phase 1 = activity log per client (who did what, already partially in audit patterns); phase 2 = multi-seat with roles (owner/operator), assignment chips, per-seat audit. Phase 2 is L-effort and needs pricing + security review — sequenced after the economy ships.
- **Kai Agency Briefings:** weekly digest email per workspace (E3c) + Monday SLA board (D91).

## 5 · Community as a Premium feature (cost-protected by design)
Alignment: ADR-0006 already gives every Premium user Kai + community; the cost architecture makes it safe. The additions:
- **Discussions:** unchanged (moderated, compliance-screened) — reading stays open to all signed-in tiers; posting per current rules.
- **Limited Kai interactions:** Premium credits (300/mo) + existing rate limits; **AI summaries instead of unlimited chat** → **CX-6: per-thread AI summary, generated ONCE per N replies, cached for every reader, batch-lane eligible** — the whole community shares one summary cost instead of a thousand chats. Kai deflects "ask Kai" on questions already answered in-thread or in the verified library (free layers).
- **Verified success stories (CX-8):** consent-gated program formalizing D49/W40 — user opts in post-victory, story is anonymized + compliance-framed ("results aren't typical"), staff-reviewed, badged. Becomes the social-proof engine that never violates the CROA bar.
- **Anonymous lender statistics (CX-7):** aggregate furnisher/bureau response patterns ("disputes naming this furnisher got responses in a median N days" — platform-wide, k-anonymity threshold, DPO+CCO gated). The category-defining data feature (Moat #4) — ship only above minimum sample sizes, always typical-results framed.
- **Educational content:** statute cards (#15) surfaced contextually in threads.

## 6 · Retention engine (value every day, even while waiting)
Base: the passive layer (E1–E3). Additions this review adds:
- **Timeline forecasts (CX-9):** "bureaus typically respond around day 24" — from OUR aggregate response data once sample size permits (until then: statutory windows only, labeled). Anxiety killer #1 in the waiting period.
- **Credit-building opportunities:** education cards matched to file state (high utilization → utilization explainer; thin file → builder concepts) — pure knowledge-pack content, zero AI, never product recommendations without compliance review.
- **Status + regulatory:** already designed (deadline radar #12, Brief matching #51, weekly digest #20) — the review confirms these as the retention core, no duplication needed.
- Cadence guardrail: retention surfaces obey the notification caps — daily value ≠ daily pings; Kai Home absorbs everything the push channel shouldn't carry.

## 7 · What this review did NOT find
No trust violations (no dark patterns, no fake numbers — the codebase already refuses them: the "~ estimate" card literally declines to invent a number). No compliance regressions. The foundation is honest; V2's job is to make honesty *felt* — which is exactly what the delight/wow systems encode. The gap between today's product and the bar is presentation and proactivity, not integrity. That's the best possible starting position.
