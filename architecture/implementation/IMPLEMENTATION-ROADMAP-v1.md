# CreditVector Implementation Roadmap · v1 *(planning only — no code)*

Tomorrow's execution plan, derived from the **frozen Constitution v1.0** and the Phase-D design work.
Every phase compiles against the Five Laws and the two-world visual identity. Governing discipline:
[ADR-0001 Engineering Lifecycle](../constitution/adr/ADR-0001-engineering-lifecycle.md) — design and
governance stages precede any production code, and **reuse-first is mandatory** (name the existing
engine/component/state before proposing anything new).

**The one cross-cutting prerequisite:** `graphInputFromSnapshot` — the DB-snapshot → `GraphInput`
loader — **does not exist** (verified zero hits). Until it lands, per-item evidence strength,
Decision-Card citations, and graph-derived Case Presence render honestly as "still gathering." It
unblocks Phases 4, 6, and parts of 2. It is the highest-leverage single build.

**The two-world invariant, on every UI phase:** the product renders the **KAI monogram** only —
never the rendered Shiba Inu, a face, or emotional animation. A character on any product surface
**fails design review** (Design Laws §11).

---

## Phase 0 — Repository preparation
- **Objective:** establish a clean, verified baseline and the implementation branch; confirm no
  current code violates the frozen constitution; spec the graph loader.
- **Files affected:** none (verification + planning). Reads: `lib/intelligence/*`, `lib/execution/*`,
  `lib/kai*`, `components/kai/*`, `components/mission/*`, `vercel.json`, guard scripts.
- **Dependencies:** frozen Constitution v1.0; the `docs/constitution-freeze-v1` PR (review/merge is a
  founder action).
- **Risks:** discovering existing two-world violations (e.g., a product surface referencing
  `/kai/states/*`); baseline guard/build failures.
- **Constitutional articles affected:** Art. VI (engineering rules, reuse-first); Design Laws §11
  (engineering invariant audit).
- **Acceptance criteria:** `tsc` clean · `next build` clean · full guard suite green · a written audit
  confirming zero rendered-character usage on product surfaces · a `graphInputFromSnapshot` spec.
- **Estimated complexity:** Low.

## Phase 1 — Application shell
- **Objective:** confirm/standardize the executive shell (sidebar, presence mount, tokens) as the
  monogram-only, calm, dense surface the constitution mandates.
- **Files affected:** `components/AppShell.tsx`, `components/Sidebar.tsx`,
  `components/kai/KaiPresence.tsx`, `components/BrandLogo.tsx`, `app/globals.css`, `tailwind.config.ts`,
  `lib/brand.ts`.
- **Dependencies:** Phase 0.
- **Risks:** re-introducing labor/character language in chrome; token drift; double-presence.
- **Constitutional articles affected:** Brand §7 (two-world); Design Laws §2/§5/§11; Identity §19;
  Law IV.
- **Acceptance criteria:** shell renders monogram only; presence is single-mount and self-suppressing;
  design tokens match the system; no character asset referenced; AA contrast verified.
- **Estimated complexity:** Low–Medium.

## Phase 2 — Kai Home
- **Objective:** the executive brief + the **Credit OS layer** (readiness spread + roadmap journey +
  pinned goal), rendered over engines that already ship.
- **Files affected:** `app/dashboard/page.tsx`, `components/mission/MissionControl.tsx`,
  `components/mission/ReadinessStrip.tsx`, `components/mission/RoadmapView.tsx`, `lib/missionControl.ts`,
  `lib/kaiHome.ts`, `lib/intelligence/modules.ts` (readiness), `lib/roadmap/engine.ts`,
  `app/api/kai/context/route.ts`, `lib/kaiSeen.ts`; a small stored **pinned-goal** preference.
- **Dependencies:** Phase 1; readiness/roadmap engines (exist); goal-pin preference.
- **Risks:** confidence rendered as machine-confidence (must be evidence strength); readiness framed
  as approval (must be file-state, no causal deltas); "while you were away" last-seen boundary bug;
  §605-style strategy routing (must go through `recommend.ts`).
- **Constitutional articles affected:** Laws I, II, III, IV, V; UX §1–§7; Voice; Decision/Trust models.
- **Acceptance criteria:** one next move (ranked, teaches why); evidence-strength meter (not
  "confidence"); readiness spread as file-state; roadmap journey renders; away-summary leads with the
  §611 clock and is honest when nothing changed; every string passes `scanForbiddenLanguage`.
- **Estimated complexity:** Medium–High.

## Phase 3 — Mission Control
- **Objective:** render the existing Execution Queue (ADR-0020) as the calm operating queue; lead each
  row with its consequence, not a bucket label.
- **Files affected:** `components/mission/ExecutiveQueue.tsx`, `app/dashboard/page.tsx`,
  `lib/execution/*`, `lib/missionEngine/*`.
- **Dependencies:** Phase 2.
- **Risks:** rebuilding the ranker (forbidden — reuse `ExecutionPriority`); manufactured urgency.
- **Constitutional articles affected:** Laws III, IV; Decision Model §4/§5; UX §1.
- **Acceptance criteria:** buckets/order come straight from the state machine; each row teaches "if
  ignored"; no re-ranking; no alarm styling.
- **Estimated complexity:** Medium.

## Phase 4 — Decision Cards
- **Objective:** the signature four-layer object (Verified Facts → Analysis → Recommended Action →
  Expected Outcome), composing existing producers; one `<DecisionCard>` + `KaiDecision` view-model.
- **Files affected:** NEW `KaiDecision` view-model + `<DecisionCard>` (absorbing `KaiWhy` +
  `RecommendationIntelPanel`), `lib/explain.ts`, `lib/recommendationIntel.ts`, `lib/recommend.ts`,
  `lib/statutes.ts`, `lib/intelligence/reasoning.ts` (`scoreConfidence`, `scanForbiddenLanguage`),
  `lib/intelligence/graph.ts` + the `graphInputFromSnapshot` loader.
- **Dependencies:** the graph loader (Phase 0 spec → build); `recommend.ts` authority.
- **Risks:** shipping a third parallel panel (must absorb, not add); Expected-Outcome lane leaking a
  promise; confidence as probability; the graph loader absent → confidence dark.
- **Constitutional articles affected:** Law II, Law III; Decision Model §1–§3; Trust Model §2–§5;
  Voice §6.
- **Acceptance criteria:** four layers always separated; recommendation routed through `recommend.ts`;
  Expected-Outcome passes the forbidden-language scanner fail-closed; confidence is evidence strength
  with basis, or honest "still gathering" until the loader lands; every card cites its records.
- **Estimated complexity:** High.

## Phase 5 — Timeline / Mission Feed
- **Objective:** the operational history (who/when/why/what changed, with provenance) over the existing
  `KaiEvent` stream; one shared event catalog.
- **Files affected:** `app/journey/page.tsx`, `lib/kaiEvents.ts`, `lib/kaiStates.ts` (state→copy),
  NEW shared event catalog (`*Shared.ts`), NEW single `projectedKaiState` resolver.
- **Dependencies:** Phase 1; `KaiEvent` stream (exists).
- **Risks:** a second event store (forbidden); relabeling user actions as Kai's labor (Law I); the
  `@@index([type,occurredAt])` self-heal gap (query by userId, filter in memory).
- **Constitutional articles affected:** Law I; Notification Standard; Identity §10/§20.
- **Acceptance criteria:** each row links to a real `KaiEvent`; actor provenance shown (Kai/bureau/
  user/system); Kai-work vs case-transition distinguished; no fabricated activity; no character
  animation.
- **Estimated complexity:** Medium.

## Phase 6 — Case Presence
- **Objective:** the Live/Projected state partition as a compile-time anti-fabrication invariant;
  presence conveys state via caption + monogram, never a face.
- **Files affected:** NEW `KaiState` partition (`LiveKaiStateId`/`ProjectedKaiStateId`), the single
  `projectedKaiState` resolver (shared with Phase 5), `components/kai/KaiPresence.tsx`,
  `app/api/kai/context/route.ts`.
- **Dependencies:** Phase 5 (shared resolver); the graph loader for graph-derived states.
- **Risks:** an activity verb rendered from stored data (type error by design); a character/face
  (invariant violation); two divergent resolvers (must be one).
- **Constitutional articles affected:** Law I, Law V; Identity §10/§19/§20; Design Laws §3/§5/§11.
- **Acceptance criteria:** `KaiContext.state` typed as projected-only; Live states render only during
  a real in-flight op; monogram-only; guard test covers the partition.
- **Estimated complexity:** Medium.

## Phase 7 — Agency View
- **Objective:** the COO portfolio surface; Kai's synthesis leads, the roster table supports; via a
  batch adapter, sized to entitlement caps.
- **Files affected:** `app/agency/page.tsx`, `lib/intelligence/portfolio.ts`, NEW
  `rosterPortfolioRows` batch adapter, `lib/entitlements.ts`.
- **Dependencies:** `assessPortfolio` (exists, dark); Phases 2–4.
- **Risks:** 500×`loadSnapshot` fan-out (must batch groupBy); agency-tier CROA posture (open counsel
  item — gate behind `/compliance-review`); inflated "500" framing (size to real caps).
- **Constitutional articles affected:** Law II, Law IV; Brand §7; the CROA open sub-item.
- **Acceptance criteria:** synthesis-first; batch aggregates, not per-case recompute; sized to
  `agencyClientLimit`; passes compliance review.
- **Estimated complexity:** Medium–High.

## Phase 8 — Mobile
- **Objective:** the radically simple thumb surface — one priority, one deadline, one decision, one
  tap — reusing the shipped floating presence.
- **Files affected:** `components/kai/KaiPresence.tsx`, `components/Sidebar.tsx` (`MobileNav`),
  `app/api/kai/context/route.ts`.
- **Dependencies:** Phases 2, 6.
- **Risks:** shrinking the desktop instead of reimagining; losing the "why" line; re-introducing Kai
  as a character.
- **Constitutional articles affected:** UX §1–§7; Design Laws; Law IV.
- **Acceptance criteria:** one move above the fold with its one-sentence why; §611 ring in gold;
  monogram only; no re-introduction of Kai.
- **Estimated complexity:** Medium.

## Phase 9 — QA
- **Objective:** prove every surface upholds the constitution — guards + end-to-end verification.
- **Files affected:** `scripts/*.test.ts` (new/extended guards); the `verify` skill; no product code.
- **Dependencies:** Phases 1–8.
- **Risks:** guards that check types but not rendered behavior; missing the two-world / forbidden-
  language / evidence-strength invariants.
- **Constitutional articles affected:** all Five Laws; Design Laws §11 (engineering invariant as a
  test).
- **Acceptance criteria:** guards assert: no character on product surfaces; every rendered
  recommendation string passes `scanForbiddenLanguage`; confidence is evidence-strength; presence is
  projected-only; `tsc`/build/guards green; end-to-end flows driven and observed.
- **Estimated complexity:** Medium.

## Phase 10 — Production Readiness
- **Objective:** release discipline — flags, deploy, rollback, and the open counsel items resolved or
  gated.
- **Files affected:** `vercel.json`, env config, deploy runbook, feature flags; no new product code.
- **Dependencies:** Phase 9; the two open counsel items (CROA posture; commerce/offers boundary).
- **Risks:** deploying a surface that depends on an unresolved counsel item; skew; the graph loader's
  prod-DB validation.
- **Constitutional articles affected:** Art. VIII (non-Kai zones / commerce); the CROA open sub-item;
  Notification Standard (no send without the gate).
- **Acceptance criteria:** preview-first; founder approves each merge; no prod push without the CROA
  and commerce sub-items resolved for any affected surface; rollback verified.
- **Estimated complexity:** Medium.

---

*Planning only. No production code, no runtime change, no deploy. Execution begins tomorrow from the
frozen constitutional foundation, in the ADR-0001 nine-stage order.*
