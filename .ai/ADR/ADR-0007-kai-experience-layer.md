# ADR-0007: Kai Experience Layer — passive intelligence, event engine, proactive surfacing

Status: **Proposed** (design documented 2026-07-12; runtime implementation awaits founder approval)
Date: 2026-07-12
Decision owners: Founder (Phase 4 mandate) + CPO/CAIO/CMO lenses

## Context
Kai lives in a chat box; users must ask to receive value, and every interaction costs tokens. The platform already computes rich structured intelligence (cross-bureau conflicts, strategy recommendations, obsolescence windows, follow-up clocks, funnel state) that is under-surfaced. The founder's mandate: Kai becomes the proactive intelligence layer and brand identity — "Duo for consumer credit" — grounded, not gimmicky.

## Decision
Split Kai into **PASSIVE** (structured-data-only: event engine, timeline, Kai Home, recommendations, notifications, digests — zero tokens) and **ACTIVE** (live AI reasoning, entered only via the ADR-0006 retrieval waterfall, metered by credits). Add two append-only self-heal stores: `KaiEvent` (platform event stream, produced by one-line fail-safe hooks in existing flows + derived on-read deadline events) and `KaiRecommendation` (issued advice + user reaction). All proactive surfaces render from these streams and existing rule engines (`lib/recommend.ts`, `lib/scoring.ts`, `lib/obsolescence.ts`, per-bureau presence model). Notifications adopt the "Kai noticed/recommends/found" voice as static compliance-reviewed templates over the existing push/email transport. Full spec: `.ai/KAI-EXPERIENCE.md`.

## Alternatives considered
- **AI-generated proactive content** (LLM writes the daily summary): rejected — linear token cost, hallucination risk on a compliance-sensitive surface, and slower. Structured data is already the truth.
- **Third-party notification/engagement platform:** rejected — transport exists (web-push + Resend); adding a vendor duplicates a working system.
- **New "Kai memory" store:** rejected — the user's DB rows ARE the memory; only the event stream and recommendation ledger are genuinely new.

## Consequences
~90% of Kai's perceived presence becomes token-free; product feels alive without AI spend. Costs: event-producer hooks touch many routes (small, fail-safe each); dashboard becomes Kai Home (UX change needing design review); notification volume needs the caps specified (≤2 pushes/day, digest overflow) to avoid fatigue.

## Security implications
Passive surfaces read only the requesting user's rows via existing authz; events carry references + small payloads, never encrypted-field contents (letter bodies stay encrypted; timeline links to the authed route). No new AI input surface until E5 wires active mode (covered by ADR-0006's envelope).

## Compliance implications
All notification/recommendation templates are static strings + data slots, `/compliance-review`-approved once at design time — process language only ("generate a MoV letter"), never outcome promises. Digest emails inherit the Brief digest's CAN-SPAM gates (postal address, unsubscribe). Rule-derived "confidence" percentages are labeled as rule scores, never model confidence (Art. II).

## Migration or rollback plan
Purely additive, staged E1→E6 (`KAI-EXPERIENCE.md` §12); each stage independently removable. Event producers fail open — a `recordKaiEvent` failure never blocks the underlying flow. Rollback = hide surfaces; tables remain inert.

## Evidence
Rule engines verified in code: `lib/recommend.ts` (strategy recs), `lib/bureauData.ts`/`lib/dedupe.ts` (conflict/duplicate detection), `lib/obsolescence.ts` (§605 windows), agency follow-up clocks (`/api/agency/clients`), funnel counts (`/api/admin/product-health`). Transport verified: `lib/push.ts`, `lib/email.ts`, `lib/briefDigest.ts`. Patterns reused: ADR-0001 self-heal, ADR-0006 retrieval envelope.
