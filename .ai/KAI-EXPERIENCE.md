# Kai Experience Architecture (Phase 4 design)

Status: **PROPOSED** (design only — no runtime code). Governing decisions: ADR-0006 (intelligence engine, Proposed) + ADR-0007 (experience layer, Proposed). Canonical split — **this doc owns the experience** (how Kai shows up, passive intelligence, events, notifications, brand); **`KAI-INTELLIGENCE.md` owns the brain** (8-layer retrieval pipeline, confidence scoring, AI activation, attorney verification, metering, token strategy); **`CREDIT-ECONOMY.md` owns the meter**. Zero duplication: this doc links, never restates.

**Primary principle: Kai works for the user before they ask.** Chat is the *final* interface, not the primary one. Kai becomes to CreditVector what Duo is to Duolingo — except Kai's proactivity is grounded in structured data, so it is cheap, truthful, and never gimmicky.

---

## 1. The two modes (the load-bearing cost decision)

| Mode | Powers | Data source | Token cost | Share of Kai surface |
|---|---|---|---|---|
| **PASSIVE** | Timelines, summaries, reminders, deadlines, dashboards, recommendations, statistics, digests, notifications | Structured data only: the user's existing DB rows + the event engine (§3) + deterministic rules (existing `lib/recommend.ts`, `lib/scoring.ts`, `lib/obsolescence.ts`, cross-bureau presence model) | **Zero** | ~90% of what users see |
| **ACTIVE** | Dispute strategy, legal explanation, document review, bureau comparison narrative, personalized synthesis | Layer 8 of the pipeline, entered only through the retrieval waterfall (`KAI-INTELLIGENCE.md` §1) | Credits (`CREDIT-ECONOMY.md`) | Explicit user asks only |

**Hard rule:** no surface may call AI to produce passive content. "Kai detected 12 inconsistencies" comes from the deterministic per-bureau presence/dedupe engines that already exist — not a model. Passive confidence percentages are rule-derived scores (the `lib/scoring.ts` family), labeled as such; never fabricated model confidence (Constitution Art. II).

## 2. Retrieval priority (reconciled — no duplicate system)

Phase 4's priority list maps 1:1 onto the existing 8-layer pipeline; the one new term, **Verified Legal Library**, is NOT a new store — it is the `attorney_verified` (and `staff_approved`) subset of `KaiAnswer`/`KnowledgePack` (`KAI-INTELLIGENCE.md` §4), surfaced with priority and badging. Confidence ≥ threshold → return immediately with provenance; otherwise escalate to live reasoning. One pipeline, one set of tables.

## 3. Event engine (the passive backbone) — NEW

**`KaiEvent`** — append-only self-heal table (ADR-0001): `{userId/accountId, type, refType/refId, payload(small), occurredAt, seenAt?}`. Producers are one-line `recordKaiEvent()` calls (fail-safe, non-blocking) added inside flows that already exist:

`report.uploaded` · `report.analyzed` (payload: inconsistency/duplicate counts from the existing engines) · `letter.generated` · `letter.mailed` · `response.received` · `response.analyzed` · `round2.ready` · `brief.published` · `community.replied` (to user's thread) · `comment.attorney_activity` (future) · `score.logged` · `client.added` (agency).

**Derived events (computed on read, no storage, no cron for v1):** `deadline.upcoming` = mailedAt + 30d §611 window minus today · `obsolescence.reached` = DOFD + 7/10yr (existing `lib/obsolescence.ts`) · `followup.due` (agency — the follow-up clocks already computed in `/api/agency/clients`).

**Consumers:** Timeline (§5) · Kai Home (§4) · notifications (§7) · digests (§8) · future improvement-engine analytics. One event stream, many renderings — no consumer invents facts the stream doesn't contain.

**`KaiRecommendation`** — issued next-best-actions with `{rule, targetRef, status: open|accepted|dismissed|expired, confidenceScore}`. This is Kai's "memory of its own advice": never re-nag a dismissed rec; measure acceptance rate (feeds `improvement/ENGINE.md` Q1).

## 4. Kai Home (the new default screen)

Dashboard evolves into Kai Home — greeting, overnight delta, one recommended action:

```
┌────────────────────────────────────────────────────────────┐
│  🐕 Good morning, Rey.            [Kai mark]   ⚡ 287 credits │
│  Here's what happened since yesterday:                      │
│  ✓ Experian responded to your Round 1 letter                │
│  ✓ FTC announced a new enforcement action        → Brief    │
│  ✓ 3 new replies in discussions you follow       → Community│
│  ⚠ §611 response window closes in 2 days (TransUnion)       │
│  ● 1 account is ready for Round 2                           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ KAI RECOMMENDS                                        │   │
│  │ Generate a Method of Verification letter (Experian).  │   │
│  │ Est. time: 3 min · Rule confidence: 96%               │   │
│  │            [ Generate letter → ]   [ dismiss ]        │   │
│  └──────────────────────────────────────────────────────┘   │
│  ── Your timeline ──────────────────────── [view all →]     │
│  Jul 17  Experian responded          Jul 5  Round 1 mailed  │
└────────────────────────────────────────────────────────────┘
```

Everything above is PASSIVE: events since `lastSeenAt`, derived deadlines, the recommendation rule engine. The one-click action deep-links into the existing letter builder with strategy pre-selected (the `?tradeline=&strategy=` deep links already exist). Compliance: recommendations phrase *process*, never outcomes ("generate a MoV letter", never "get this deleted").

## 5. Kai Timeline

Per-user (and per-client, in agency workspaces) chronological rendering of `KaiEvent` + derived events, newest first, grouped by day, each entry linking to its object:

```
Jul 17 ── Experian responded to Round 1        [view response]
Jul 17 ── Kai: response analyzed — "verified" outcome
          → Recommendation: Method of Verification   [generate →]
Jul  5 ── Round 1 mailed to Experian (3 items)
Jul  3 ── Kai detected 12 cross-bureau inconsistencies [review]
Jul  2 ── Credit report uploaded (Equifax tri-merge)
```

The timeline IS the product story — progress made visible without a single token.

## 6. Screen-by-screen surfacing (all PASSIVE unless marked ⚡ACTIVE)

| Screen | Kai surfaces |
|---|---|
| **Kai Home** (dashboard) | §4. Overnight delta, deadlines, next best action, timeline snippet |
| **Upload/Reports** | post-analyze card: "Kai found N inconsistencies, M duplicates, K obsolete items" (existing engines) → deep links |
| **Tradelines** | per-row Kai chips: recommended strategy + reason (existing `lib/recommend.ts` output, re-voiced), obsolescence countdown |
| **Dispute workspace (Letters)** | recommended next round (rules on letter/response state) · contradiction panel (per-bureau presence conflicts — deterministic) · missing-documentation checklist (rule: strategy X benefits from doc Y; links identity vault) · ⚡ "Ask Kai to review this letter" (active, credits) |
| **Strategist** | plan framed as "Kai's strategy" · ⚡ plan generation stays active (already AI) |
| **Scores** | trend commentary from stored entries ("3 resolved since your last score log") |
| **Identity** | discrepancy results re-voiced as Kai findings; vault completeness nudges |
| **Community** | "discussions like your dispute" (tag/creditor-kind match) · attorney-verified answer surfacing (§2 library) · trending threads (existing counts) · smart search = layers 2–5 of the pipeline behind one search box |
| **Brief** | daily legal digest framing (CFPB/FTC already ingested; categories = FCRA/enforcement/lawsuits) · "relevant to your dispute" matching (creditor/topic tags) |
| **Support** | Kai deflection: before ticket submit, show matching cached answers/docs (layers 2+7) — reduces queue |
| **Agency workspace** | client-health board (existing follow-up clocks + funnel data re-voiced) · workload prioritization (needs-attention sort already exists — promote to "Kai's priority list") · SLA reminders (derived deadlines per client) · revenue insights from real plan/entitlement data only (never estimated — Art. II) |
| **Settings** | digest preferences (§8), notification preferences, credit balance |
| **Admin** | executive digest (§8) rides the four existing dashboards; no new metrics invented |

## 7. Notification system (voice + rules)

Reuses the existing push (`lib/push.ts`) + email (`lib/email.ts`) plumbing and Settings toggles — no new transport. What changes:
- **Voice:** templates open with `Kai noticed…` / `Kai recommends…` / `Kai found…`. Calm, specific, one sentence + one action link. Never exclamatory, never vague.
- **Usefulness gate:** a notification must carry (a) a fact from the event stream and (b) an action. No engagement-bait, no streak mechanics.
- **Rules (v1):** response.received (immediate) · deadline.upcoming at T-3d and T-1d · round2.ready (daily batch) · brief relevant-match (daily max 1) · agency followup.due (daily batch to agency owner). Global cap: ≤2 pushes/day/user; overflow folds into the digest.
- **Compliance:** every template passes `/compliance-review` once at design time; templates are static strings + data slots (no generation → no drift).

## 8. Kai Digest (layered briefings — all passive)

| Digest | Channel | Content | Infra |
|---|---|---|---|
| **Morning** | in-app (Kai Home) on first visit of day | §4 overnight delta | event queries only |
| **Weekly** | email, opt-in | personal progress (letters, responses, deadlines) + Brief highlights | extends the BUILT Brief digest sender (`lib/briefDigest.ts`) — canonical server-scoped LLC postal footer + unsubscribe; CCO pass on template; received delivery still requires verification |
| **Monthly** | email, opt-in | month-in-review: funnel movement, score log trend, milestones | same sender, monthly cron |
| **Agency** | email/in-app to agency owners | client-health rollup, SLA risks, follow-ups due | agency data + events |
| **Executive** | in-app `/admin` (+ optional email) | rides the four live admin dashboards; adds week-over-week deltas | existing admin APIs |

## 9. Kai memory architecture (mostly already built)

Kai's "memory" is **structured data the platform already stores** — not an AI memory system: uploaded reports, dispute history, bureau responses, generated letters (encrypted at rest, ADR-0002 — decrypt server-side only when rendering), preferences, agency settings. Phase 4 adds only: `KaiEvent` (what happened) and `KaiRecommendation` (what Kai advised + user reaction). Retrieval is always DB-first/cached; live AI never re-derives what a query can fetch. Active-mode context assembly pulls from these stores through the layer-1 path with existing authz (own-data only), fenced per `KAI-INTELLIGENCE.md` §2.

## 10. Personality & brand (Kai the Shiba)

Named after the founder's Shiba Inu. **Feel:** helpful · calm · professional · confident · friendly — an elite strategist who genuinely wants the user to win. **Never:** sarcastic, robotic, over-verbose, hype-y, fear-mongering. Writing rules: short sentences; verbs first; facts with receipts (provenance chips); admits uncertainty plainly ("I don't have a confident answer for this yet"); the CROA bar is part of the personality — Kai *never* promises outcomes, and that restraint reads as trustworthiness.
- **Mascot mark:** does not exist yet. Owner-approved artwork required (raster, owner-sourced — same law as the shield logo, `ASSET-REGISTRY.md`; never an AI-generated stand-in shipped to prod). Until then, Kai surfaces use the wordmark "Kai" + existing brand tokens.
- Voice specifics for marketing use live in `marketing/BRAND-VOICE.md` (Kai section pointer added).

## 11. Token optimization (delta over Phase 3)

`KAI-INTELLIGENCE.md` §6 governs (caching, caps, circuit breaker, metering). Phase 4's contribution is structural: the passive layer makes ~90% of Kai's perceived presence cost **zero tokens**, and support/community deflection (§6 table) cuts active asks before they happen. KPI additions: passive-to-active ratio · notification action-through rate · support-deflection rate — all measurable from `KaiEvent`/`KaiRecommendation` + `AiUsage`, feeding `business-intelligence/METRICS.md` as BI-KAI-01..03 when implemented.

## 12. Roadmap (each step: five-review gate; E1–E4 need NO credit system)

| Step | Ships | Depends on |
|---|---|---|
| **E1** | Event engine (`KaiEvent` + producers) + Timeline page | nothing (pure passive) |
| **E2** | Kai Home (dashboard evolution) + recommendation rules + notification voice | E1 |
| **E3** | Digests (weekly personal → monthly → agency) | E1 + legal-footer integration/delivery verification (G-01 source fact resolved) |
| **E4** | Agency intelligence board + support deflection + community smart search (layers 2–5) | E1 + KaiAnswer/KnowledgePack stores |
| **E5** | Active-mode integration (⚡ asks wired to credits + metering) | ADR-0006 approval + BI-COST-01 live |
| **E6** | Mascot/brand rollout (owner artwork) + Kai-framed marketing | owner asset |
