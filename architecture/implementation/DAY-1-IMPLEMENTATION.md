# Day 1 — Implementation Checklist *(one page)*

*Tomorrow morning's starting point. Begins from the frozen Constitution v1.0, in the
[ADR-0001](../constitution/adr/ADR-0001-engineering-lifecycle.md) nine-stage order. This is **Phase 0
— Repository Preparation** (no runtime change, no deploy).*

---

## What is the highest-leverage work?
**Phase 0 — establish a verified baseline and unblock everything downstream.** In one session:
1. **Verify baseline green:** `tsc --noEmit`, `next build`, full guard suite — record the results.
2. **Two-world audit:** confirm **no product surface renders the character** (grep for `/kai/states/`
   and `kaiStateSrc` usage on product routes); confirm presence resolves to the KAI monogram only.
   Record any violation as a finding (do not fix yet — that's a later phase).
3. **Reuse inventory:** confirm the engines the roadmap reuses exist as documented — `readiness()`
   (`lib/intelligence/modules.ts`), `buildRoadmap` (`lib/roadmap/engine.ts`), the Execution Queue
   (`lib/execution/*`), `assessPortfolio` (`lib/intelligence/portfolio.ts`), `KaiEvent`, `KaiPresence`.
4. **Spec the one prerequisite:** write the `graphInputFromSnapshot` (snapshot → `GraphInput`) loader
   spec — the single build that unblocks evidence strength, Decision-Card citations, and Case
   Presence. Spec only; no code today.

## What should NOT be touched?
- **Production runtime behavior** — Phase 0 is verification + specs only.
- **`main`** — no push; **no merge** of `docs/constitution-freeze-v1`; **no deploy**.
- **The frozen Constitution** — changes only by ADR/Amendment.
- **The `kaiStates.ts` character assets** — they are now a *marketing* asset system; leave them.
- **The §605 fix** — already shipped; don't revisit.

## What dependencies exist?
- Frozen **Constitution v1.0** (done) and **ADR-0001** (drafted; founder ratifies the lifecycle).
- The **constitution PR** merge is a founder action (not required to start Phase 0).
- A green baseline (step 1) gates everything else.

## What can be completed in one session?
All of Phase 0: baseline verification + two-world audit + reuse inventory + the graph-loader spec.
No production code — this is the safe, high-leverage groundwork that makes Phase 1 (App Shell) and the
graph loader immediately actionable next session.

## What constitutes success?
- ✅ `tsc` clean · `next build` clean · guard suite green — recorded.
- ✅ A written two-world audit: **zero character usage on any product surface** (or findings logged).
- ✅ Reuse inventory confirms every engine the roadmap depends on exists.
- ✅ `graphInputFromSnapshot` spec written and ready to implement.
- ✅ Nothing pushed to `main`, nothing merged, nothing deployed, no runtime behavior changed.
