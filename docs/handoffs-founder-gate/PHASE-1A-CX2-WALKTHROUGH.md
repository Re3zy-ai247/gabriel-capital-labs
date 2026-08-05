# CreditVector — Phase 1A-CX2 — Continuous Cinematic Operating Experience

**Date:** 2026-08-05 · **Branch:** `feat/experience-runtime-phase-1a` @ `4d48648` — pushed; preview building
**Baseline:** CX2 began at `7e6941d` (the completed Phase 1A-CX reconciliation) · **Production:** `f449c35`, untouched
**Stop conditions honored:** no merge · no production deploy · no push-main · no migrations · no env changes · no Wallet / Phase 1B / LetterStream / Teams Chat / Pulse · no Arena product expansion · no Mission Control business-logic rewrite · no compliance/billing changes · no fake activity

---

## 1. Executive Implementation Summary

Your three directives — cinematic by default, readable pacing, one assembled experience — plus the Arrival Runtime addendum are implemented, adversarially reviewed, corrected, and re-verified:

- **CINEMATIC is the default.** The "AUTO" you saw was Agency Command's Director badge; the projection now defaults cinematic with a truth-telling badge, and the tier engine's precedence is documented as a safety order that only downgrades: reduced-motion always wins, your persisted opt-out second, Data-Saver/device floors next — otherwise the full experience. Deterministic across entry, refresh, replay, direct entry, and restart.
- **Pacing is deliberate and centralized.** One new law file — `lib/cxos/pacing.ts` — owns every retuned duration. The facility-transfer arrival dwells 2200ms (was 1500), the settle crossfade 760ms (was 220), the departure ceremony 900ms (was 460) **and gained an Escape skip it never had**. The boot veil, THE PASSAGE, and the Threshold were measured against your criteria and deliberately left frozen — already right.
- **One URL assembles everything: `/review/cxos`.** Both personas, composed purely from the existing vocabulary — no room interiors touched. The Arrival Runtime opens the returning-operator flow exactly as your addendum specified (the boot veil already *is* identity recognition + Kai acknowledgement — composed, not rebuilt).

## 2–4. Branch, Baseline, Commits, Files

| Commit | Content | Files |
|---|---|---|
| `6625187` | **A** — cinematic default + precedence + badge truth | 5 (+96/−9) |
| `6e01495` | **B** — pacing centralized + retuned + departure skip + Passage default (PRM-safe) | 12 (+641/−27) |
| `261ab4d` | **C** — the Founder Walkthrough + Arrival Runtime | 12 (+1,105/−13) |
| `96a35d4` | **R7** — Mission Boot replay remounts (found by the evidence pass) | 2 (+8/−1) |
| `4d48648` | **Opus corrections** — tier-D visibility (blocker), guarded exits, arrival reset, readable Kai line | 5 (+168/−15) |

## 5. Agent Delegation Map

Fable coordinated only. **CX2-A** (Sonnet): default-mode contract. **CX2-B** (Sonnet): pacing + inherited Passage fix. **CX2-C** (Sonnet): walkthrough + arrival + the Opus fix pass. **CX2-D** (Sonnet): 16-capture evidence sweep + 10 regression checks. **Opus**: one bounded adversarial review (verdict below). Coordinator: three stitches (guard reconciliations, the R7 key, the corrected Kai-line target), commits, push, this package.

## 6. Cinematic Default — implementation

`lib/cxos/capability.ts` remains the single source of truth; its precedence is now documented law. Agency Command's Director projection defaults `"cinematic"` (was `"auto"`), with a derived badge that reports **STATIC** whenever the resolution is actually static — the label can no longer claim what the room isn't doing. The Passage's identical auto-default was fixed **PRM-safely** (upgrade-on-mount gated on `!browserReduced` — a bare default would have bypassed the reduced-motion consent gate; the literal instruction was refused for the safer shape, disclosed). The long-built-but-never-mounted **CinematicToggle is now reachable** (walkthrough rail's More panel). Discovery, disclosed: only real `prefers-reduced-motion` reaches Agency Command — the site-wide toggle deliberately doesn't (its no-storage law).

## 7. Transition Timing — before / after

| Surface | Before | After |
|---|---|---|
| Facility-transfer arrival dwell (tier A / B) | 1500 / 700ms | **2200 / 1000ms** |
| Arrival settle crossfade | 220ms | **760ms** |
| Departure ceremony | 460ms, **non-interruptible** | **900ms + Escape skip** (live-proven ~500-700ms short-circuit) |
| Kai line on the arrival gate | settled ~1.9s of 2.2s (~820ms legible) | **settled ~1.5s (~doubled legibility)** |
| Boot veil (7.8s) · THE PASSAGE (11.8s) · Threshold (10s) | — | **unchanged — deliberately frozen** (measured, already right) |
| Chamber-to-chamber micro-transitions | 620/460ms | unchanged (not room transitions) |

All values live in `lib/cxos/pacing.ts` (CSS pair mirrored as custom properties with a sync guard). Live A/B measured via stash on identical code.

## 8–10. The Walkthrough

**Entry point: `/review/cxos`** — synthetic-review banner, ordered overview, one BEGIN control, persona toggle, full room index beneath.

**Returning operator (6 steps):** 1 Arrival (Threshold) → 2 Mission Boot (the veil: IDENTITY → CLEARANCE → SYSTEMS → Kai's brief → "Command is yours") → 3 Mission Control → 4 THE PASSAGE → 5 Arena → 6 Agency Headquarters.
**New visitor (8 steps):** 1 Landing chapters → 2 SIMULATED SIGN-IN (labeled theatrical beat — zero forms, zero inputs) → then the same arrival spine.

Next/Previous + persistent progress rail (STEP N OF M) · Replay-this-transition · Restart (clears the walkthrough's own namespaced session keys — never the production ones) · deep-linkable steps (`?persona=…&step=N`) · refresh/back/forward deterministic · the arrival does not replay on ordinary room travel (your session-behavior rule).

**Direct room URLs** (all listed on `/review`, walkthrough first): `/review/cxos` · `/review/agency-command` · `/review/mission-control` · `/review/threshold` · `/review/landing` · `/review/arena` · `/review/mission-control-to-arena`.

## 11–12. Connected / Still Disconnected

**Connected:** the full review-surface experience — arrival, boot, all six rooms, room-to-room travel inside the walkthrough, mode control, pacing law.
**Still disconnected (unchanged, by scope):** the production product interior (dashboard↔letters↔mail room travel) remains non-cinematic — that is the standing CX2-interior decision from the CX report, untouched by this phase; the walkthrough's overview screen is deliberately an index (the tour begins at BEGIN); the marketing landing's chapters still cover 2 of 11 sections.

## 13. Validation

typecheck clean · **production build clean (69/69 pages; `/review/cxos` 7.21 kB / 102 kB first-load)** · **13/13 CXOS guard suites green** (walkthrough 43/43 incl. tier-D/exit-guard/reset pins; pacing 18/18; agency-command 191; passage 119; sweep total >900 checks) · Phase-1A regression suite green (kai-experience 78, missionControl, operator-session 82, schema-safety 17/17) · 16 evidence captures + NOTES (cx2-evidence/) · live click-throughs of both personas, restart, replay, deep-link, refresh, back/forward, mobile 375/768.

## 14. Opus Verdict — and its resolution

**Initial verdict: NOT READY** — one blocker + three ranked findings, every one closed in `4d48648` and live-re-verified:

1. **BLOCKER — tier-D rendered blank** (SSR `opacity:0` + React 18 hydration never removing server styles; the prescribed fix proved insufficient — the real fix moves tier detection fully post-mount with SSR-safe defaults). Hard-load verified visible, hydration warning gone. *Reduced-motion visitors now get the complete static experience.*
2. **HIGH — exit doors** (in-world links, including a live `/pricing` link mid-tour, silently ended the walkthrough). Now inert inside the walkthrough via a scoped guard (the prescription missed 4 of 6 bare-`/review` anchors — caught and broadened; the rail's own link exempted after live testing caught the self-regression); direct routes untouched, real-click verified both ways.
3. **MEDIUM — stale arrival state on Back** — reset on leave; Back now shows the settled placeholder.
4. **LOW — Kai-line legibility** — the authorized line turned out to govern an invisible element; the correct rule (line 3651) pulled 1035→700ms; measured settle now ~1.5s of the 2.2s travel.

**What Opus confirmed working:** cinematic default deterministic (with the noted SSR-first-frame conservatism before hydration) · pacing "readable and premium… calm and deliberate, not sluggish" · the spine "genuinely travels… each room's own ceremony plays in place" · truth boundary "holds on all seven items" · the production gate correct (`reviewBuildAllowed()` hard-offs production before the stage ever imports).

**The addendum's closing question — production-ready or review-only?** **Founder-review-only**, per Opus and per my concurrence: the gate, fixtures, and truth labels are production-*safe*, but this composition is a review runtime. Making it the production arrival is the next authorization (it inherits the CX2-interior decision).

## 15. Remaining Risks

- Headless-environment WebGL kills the Threshold instantly in local sandboxes (the recovery path firing correctly); the Vercel preview on a real GPU plays the full 10s arrival — judge it there.
- SSR's first paint is conservative tier-C for a few hundred ms before hydration upgrades to A — deterministic, disclosed.
- Root-layout `SessionProvider` pings `/api/auth/session` (empty `{}` bodies) site-wide — structural, no business data, pre-existing.
- The React `inert` dev-only warning in Agency Command — pre-existing, stripped in production.
- New synthetic-label copy (banner, sign-in beat, placeholder card) rides the standing CCO docket with the landing-chapter copy.

## 16–17. Git Status & Confirmations

Branch `feat/experience-runtime-phase-1a` @ `4d48648`, local ≡ remote, tree clean. `origin/main` @ `f449c35` — untouched. **Confirmed: no merge, no production deployment, no production migration, no env-var change, no flag activation, no schema change.** The only push was the authorized same-branch preview refresh.

## 18. Recommended Founder Acceptance Decision

**Accept CX2 as the Founder review runtime** — open the preview's `/review/cxos`, run both personas, and judge the three things this phase changed: the cinematic-first default, the pacing, the continuity. If it lands: your next decisions are (a) the CX2-interior authorization (extending travel into the product rooms — the standing decision from the CX report), and (b) whether this arrival composition graduates toward the production arrival runtime (a separate, gated authorization). The standing pre-merge items (Decision-A SQL, CCO docket) are unchanged.

**Preview:** **https://gabriel-capital-labs-mmaber194-rey-gabriel-s-projects.vercel.app/review/cxos** — start at `/review/cxos`.
