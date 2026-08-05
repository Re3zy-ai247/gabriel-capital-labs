# CreditVector — Phase 1A-CX — CXOS Reconciliation

**Date:** 2026-08-04 · **Branch:** `feat/experience-runtime-phase-1a` @ `a488e96` — pushed; preview building
**Production:** `f449c35`, untouched · **Stop conditions honored:** no merge · no deploy · no new branches · no schema · no migrations · no Wallet / LetterStream / Teams Chat / Pulse
**Execution:** Sonnet A (archaeology) → Sonnet B (integration + 2 bounded fix passes) → Sonnet C (validation) → Opus (one bounded UX challenge) → coordinator commits, stitches, push.

---

## 1. Repository Evidence — what "the approved CXOS work" actually is

The archaeology settled a fact nobody had stated: **there is no single CXOS baseline.** Two sibling lineages fork from the same `main` tip (`f449c35`), neither an ancestor of the other, colliding at ten identical paths with independently-authored content:

| Lineage | Status (in-repo evidence) | Carries |
|---|---|---|
| `feat/cxos-living-environment-engine-rc2` @ `0e0f9be` (product HEAD `f7ee9c5`) | **ACCEPTED** — CHECKPOINT.md: browser acceptance 0 findings / 20 gates / 170 states; guards 96+185+76+25; adversarial gate READY-WITH-DISCLOSURES | Agency HQ facility (7 chambers), three-class motion model, core runtime, review shell |
| `feat/cxos-phase3` @ `a40a41c` | **Founder-candidate** — its own `.ai/CURRENT-STATE.md`: "remote Founder review pending… must not be merged wholesale"; ratified for this reconciliation by your directive | Landing Threshold + Journey chapters, TransitionShell, THE PASSAGE (MC→Arena), Arena entry/chamber, Mission Control entry/header, dashboard wiring |

**Resolution rule: RC2 wins every overlap** (the accepted lineage, strictly more developed — its stage is 3,317 lines vs phase3's 2,606); phase3 supplies everything RC2 never built. Integration route: **bounded file-copy of blobs** — exactly what both lineages' own governance documents mandate ("reconstructed as bounded blobs… not merged wholesale"). Explicitly excluded: phase3's interleaved terms-of-service business feature, ADR-0031, all gate/ops scripts — none of it cinematic.

Also answered precisely: the "landing experience" you missed is real shipped code on `app/page.tsx` itself (Threshold WebGL arrival + JourneyRuntime + two chapter sections) — phase3-only, and Phase 1A never touched that file, which is why your preview showed a plain website: the branch was cut from `main`, which never had any of this.

## 2. Files Restored / Integrated

**Four commits:** `1a5cdfe` (69 files, +36,120 — the reconciliation) · `e492229` (Threshold robustness) · `a488e96` (review-index recovery). Summary:

- **60 engine files copied verbatim** (byte-verified at copy time): 16 from RC2 (facility, core runtime, review shell, mission entry/header), 30 from phase3 (Threshold/Journey/Passage/Arena/TransitionShell/review routes), 14 guard+harness files (both lineages — the motion law travels with the code).
- **5 files wired:** `app/layout.tsx` (TransitionShell mount), `app/page.tsx` (arrival + chapters), `app/globals.css` (+1,281; RC2's 25-line subset verified subsumed, value-identical), `app/arena/page.tsx` (entry/chamber over real data), and the **one true collision** — `app/dashboard/page.tsx` — hand-reconciled so every line of Phase 1A session/altitude logic survives (a scoped, commented type-bridge; zero behavior change).
- **`CXOS_LANGUAGE_1_0.md/.html`** — RC2's amended version wins per the accepted-lineage rule (closed the last two guard checks: agency-command 185/185).
- **Dependencies (disclosed):** `gsap@3.15.0`, `three@0.185.1`, `@types/three` — phase3's exact pins, required by the ratified Threshold; three.js is lazy-loaded behind a WebGL probe + `requestIdleCallback` ("not one cinematic byte competes with LCP" — landing first-load stays 99.1 kB).
- **Two bounded fix passes during validation:**
  1. **Threshold context-loss recovery** (`e492229`) — validation found the entrance could freeze permanently on WebGL context loss with no recovery path and both escape hatches dead. Root cause, proven live with markers: a `useRef` dismissal gate poisoned by React StrictMode's dev replay, silently no-oping every dismissal path — plus a latent TDZ crash in the error path. Fixed with effect-local guards, an already-lost microtask check (an event listener structurally can't see a loss that already happened), an unconditional escape hatch, and a 12s watchdog. Live: 5/5 runs recover in ~150ms; guard 44/44 with StrictMode-safety pins. In production (no StrictMode) the event path is primary.
  2. **Review-index recovery** (`a488e96`) — my own RC2-wins call had orphaned the four recovered phase3 review rooms (rendered, unlinked). All four registry entries recovered verbatim from phase3's own rooms.ts; `/review` now lists six rooms, every href 200; guards updated to the six-room reality (26/26, 25/25).

## 3. Validation Summary

| Check | Result |
|---|---|
| `npm run typecheck` / `npx next build` | Clean · 68/68 pages; `/` 4.76 kB (99.1 kB first load) · `/dashboard` 5.15 kB · `/review/agency-command` 33.6 kB |
| CXOS guard suites (11) | **All green:** agency-command 185 · living-environment 96 · core-runtime 76 · isolated-review 25 · grammar 164 · passage 117 · threshold 44 · journey 35 · mission 31 · arena 25 · review 26 |
| **Phase 1A regression suite** | **ALL GREEN — zero disturbance proven:** kai-recommendation 60 · missionControl · mail-download 78 · mailCenter · letter · kai-experience 78 · operator-session 82 · schema-safety 17/17 |
| Reduced-motion law | Three-class model verified: comprehensive PRM CSS blocks null every channel into explicit rest states; ThresholdGate downloads zero WebGL bytes under PRM; tier-D toggle pass = 0 animations, fully readable |
| Motion-ON (native observation) | Landing: 43 live animations · Agency HQ: 15 channel tokens across all three classes, 35 tagged elements, 9 live animations |
| Transition continuity | Full room round-trip: scroll/focus correct, room state identical before/after, zero console errors (one benign post-login 401 race) |
| Flag-off Passage | `/arena` → server-side 307 before any client paint; zero Arena traces in the DOM; no ghost door |
| Phase 1A interactions through the cinematic wrappers | Executive Queue links, continue-where-you-left-off deep link, Kai popover (on its allowed rooms), mark-mailed local date — all correct |

## 4. Mobile Performance Observations

375px and 768px: no horizontal scroll on landing or the facility; the RC2 pinned residual (≤740px kaiContext wrap) remains the only known sub-gate shift; the Phase 5.2 mobile-typography fix is present. Scroll-frame numbers from this machine are headless-software-rendering noise, not signal — real-device confirmation belongs to your preview walkthrough. Dev-only cosmetic: a React `inert` attribute warning (stripped in production builds).

## 5. Opus Bounded UX Verdict — reported unvarnished

> **"It is still a website — with three extraordinary rooms bolted onto it… roughly a third of the way."**

- **What genuinely lands (its words):** the facility transfer ("departure, transit, arrival — and Kai travelling with you"), THE PASSAGE ("four beats, one unbroken metaphor"), and the Mission Control boot veil ("you arrive into a place rather than wait on a loader").
- **Where the illusion still breaks (ranked):** (1) room-to-room travel does not exist inside the product — structural proof: the recovered transition registry's own deny-list forbids `dashboard|letters|mail|…` and holds exactly one transition, `/` → `/pricing`; (2) 0.5–1.6s of unmasked dead air between rooms; (3) the agency owner gets no cinematic runtime (phase3's wiring predates Phase 1A's agency altitude — the wrapper never existed for that branch); (4) the "persistent console" renders on one route, fifth block down. Then: the two-versions-of-each-room seam, the flat login page, chapters covering 2 of 11 landing sections, the review-index orphans (fixed in `a488e96`), the facility's synthetic-data banner placement, silent `/arena` bounce, "Timeline"-vs-`/journey` naming.
- **Its walkthrough line:** *"Yes as 'here is the vocabulary and three proofs it works' — no as 'does this feel like an operating system yet.'"*

**Coordinator's framing of that verdict — the honest boundary of this mission:** the reconciliation recovered **everything that exists**. Findings 1–4 are not lost work; **no accepted or candidate branch ever built in-app travel, agency-altitude cinematics, or a persistent console** — phase3 deliberately scoped travel to the storefront and the review rooms. Making the product's interior speak the recovered vocabulary is **net-new cinematic work** — a Phase 1A-CX2 decision that is yours, not a recovery defect. The recovery itself is complete, guard-pinned, and regression-proven.

## 6. Updated Preview URL

**https://gabriel-capital-labs-pec6a1tqr-rey-gabriel-s-projects.vercel.app** (stable branch alias: https://gabriel-capital-labs-git-feat-exp-931acd-rey-gabriel-s-projects.vercel.app) — Vercel Preview build of `a488e96` (isolated preview DB; 401 to anonymous visitors — view logged into your Vercel account). Recommended walkthrough order: `/` (the arrival — production plays the full 10s entrance; dev auto-recovers instantly by design) → scroll the chapters → login → `/dashboard` (boot veil, entry, wrapped session runtime) → `/review` (all six rooms — the facility and THE PASSAGE are the proofs) → the room round-trip.

## 7. Riders & Disclosures

- **CCO rider:** the landing chapters introduce marketing copy (ProblemChamber / IntelligenceAwakens — full verbatim list captured in the CX evidence). Initial read: educational framing, explicit "Illustrative" captions, decisions attributed to the bureaus, no outcome claims — but it is NEW user-facing marketing copy and rides the standing CCO docket before merge.
- The Founder-bootstrap review route and six review rooms ship review-gated (`reviewBuildAllowed()` — hard-off in production twice over, verified stricter than the original).
- The main repo's dirty working tree still holds uncommitted compliance-copy corrections that exist nowhere else (flagged earlier via task chip — untouched by this work, still needs protecting).
- Dev-environment `.next` build/dev cache collisions occurred twice during validation (infrastructure, not code); clean restarts resolved both.

## 8. Next Decisions (yours)

1. **Founder Experience Acceptance** on the updated preview — the purpose of this gate.
2. **Phase 1A-CX2 authorization decision** — extend the recovered vocabulary into the product interior (in-app travel + dead-air masking, agency-altitude cinematics, persistent console). Opus's findings 1–4 are its scope, pre-ranked.
3. The standing pre-merge items (Decision-A SQL, CCO docket incl. the new landing copy) — unchanged.
