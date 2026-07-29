# CXOS Phase 5 — Arena Entry & Arena Spatial Experience

**Gabriel Capital Labs · CreditVector™ Experience OS**
Date 2026-07-29 · Branch `feat/cxos-phase3` · Implementation commit `4a57575` (parent `8d9198c`) · Production truth `f449c35` on `main` — **untouched**.
Feature branch only: no merge, no production PR, no production deploy, no migration, no flag enabled, no Stripe/pricing/legal/auth change.

## 1. Executive summary

Phase 5 ships the first complete Arena vertical slice: the **call** (an Arena door on Mission Control, rendered only for genuinely eligible accounts), the **entry** (a 8.6-second first-arrival rite over the real Arena page — clearance → evidence vault → standing → reveal — every line real resolved data), and the **chamber** (the operator's own standing ring, milestone seals, award ledger, Kai's interpretive brief, and a competition aperture that renders its refusal honestly as PLANNED). A synthetic-only Founder Review stage at `/review/arena` replays every state without touching any real account.

The frozen ownership constitution held by construction and by guard: **Reputation owns XP, standing, milestones, and reputation truth. Arena owns presentation, ceremony, and interaction only.** Nothing in the Arena UI can write XP, invent a number, fake a competition, or show another user. 12 files changed (849 insertions, 26 deletions), zero new dependencies, zero schema change, zero WebGL.

Validation: dedicated guard `scripts/cxos-arena.test.ts` **25/25** with **7 mutations all RED** and byte-identical restores; real-stack behavioral battery **30/30** (real login, real database, real rate limiters); full repository suite **84 guard files green**; typecheck and build green; a production-flagged build proves the review stage is hard-off and `/arena` stays dormant in production.

## 2. Project-context firewall — clearance

The mandate's firewall was enforced before any work: this phase contains **no** HELIOS, GIOS-implementation, GTG Quant, Gabriel AI OS, or Infinite Brain artifact, import, namespace, or concept. The prior accidental HELIOS work was already surgically removed and force-pushed away in the preceding recovery (recovery commit `8d9198c`); Phase 5 was built on the verified-clean tree. A deliberate consequence: the Arena entry uses **DOM + CSS only** — no three.js, no WebGL, no canvas — so no spatial-engine code path from any other project could leak in. No violation was encountered; there is nothing to report under the violation protocol.

## 3. Truth audit — what the Arena actually is today

Audited before designing anything, from repository truth:

| Fact | Source | Status |
|---|---|---|
| Arena is fail-closed opt-in: only `ARENA_ENABLED === "true"` enables it | `lib/arena/flags.ts` | VERIFIED |
| Access = flag AND (ADMIN OR internal-cohort allowlist), checked server-side | `lib/arena/cohort.ts` → `arenaAccessible()` | VERIFIED |
| XP/standing/rank/badges derive only from the operator's own verified outcomes | `lib/reputation/*` fold via `lib/arena/ownProgress.ts` | VERIFIED |
| `readOwnProgress()` fails closed to the EMPTY standing on any error | `lib/arena/ownProgress.ts` | VERIFIED |
| Cross-user surfaces are refused by policy v1: `cross_user_leaderboard`, `named_ranking`, `streaks`, `seasons`, `cash_affiliate_payout`, `outcome_count_broadcast` | `REFUSED_V1`, re-exported unchanged by `lib/arena/policy.ts` | VERIFIED |
| No competitions, seasons, or leaderboards exist anywhere in runtime truth | policy + absence of any such model | VERIFIED |
| The pre-Phase-5 `/arena` page already rendered own-record truth (meter, award list, refusal footer) | `app/arena/page.tsx` history | VERIFIED |

**Consequence (the mandate's honesty law):** there is enough authoritative runtime data for a real live experience of the operator's *own record* — and nothing more. So the slice renders exactly that. Competitions are rendered as the sealed PLANNED aperture, never as a fake bracket. Cross-user anything is absent by policy, stated rather than simulated. Nothing was faked to look alive.

## 4. Scope decision — the smallest true vertical slice

Shipped (all real data): **Operator Standing** (rank · level · lifetime XP as the standing ring), **Lifetime Vector XP**, **Verified Milestones** (seals; absent = nothing), **Contribution Timeline** (the existing award ledger, unchanged logic), and **one competition portal rendered honestly as PLANNED** (the aperture). Plus the entry rite and the Mission Control door.

Deliberately not built: competitions/seasons (REFUSED_V1), any cross-user surface (REFUSED_V1), agency Arena (policy v1 is own-record-only — stated on the review stage rather than faked), Academy/Marketplace/Enterprise (out of scope by change control).

## 5. Architecture

| File | Role |
|---|---|
| `lib/cxos/arenaLedger.ts` | NEW — the semantic visual ledger (law: no row, no ship); guard-enforced coverage |
| `components/cxos/arena/ArenaEntry.tsx` | NEW — the entry rite overlay; plays over the real page; real props only |
| `components/cxos/arena/ArenaChamber.tsx` | NEW — StandingRing · MilestoneSeals · CompetitionAperture · KaiArenaBrief; presentation only |
| `components/cxos/arena/ArenaDoor.tsx` | NEW — the call on Mission Control; plain real link |
| `app/arena/page.tsx` | MODIFIED — same server gate and data logic; chamber restaged around it; entry mounted after the gate |
| `app/dashboard/page.tsx` | MODIFIED — door rendered only behind `arenaAccessible(user)` + real standing read |
| `app/globals.css` | MODIFIED — `.cx-ar-*` classes + reduced-motion backstop + 12 s safety fade |
| `app/review/arena/page.tsx` + `stage.tsx` | NEW — Founder Review stage, synthetic fixtures only, production hard-off |
| `lib/cxos/rooms.ts` · `scripts/cxos-review.test.ts` | MODIFIED — Arena registered as the fourth PROTOTYPE review room |
| `scripts/cxos-arena.test.ts` | NEW — 25-check labeled guard, mutation-hardened |

No new dependency, no schema change, no env-var change, no API route, no client fetch. The entry is a client overlay; everything it shows was resolved by the server component that had already passed the real authorization gate.

## 6. Ownership matrix (frozen constitution)

| Concern | Owner | Arena's relationship to it |
|---|---|---|
| XP calculation & award | Reputation (`lib/reputation/*`) | Never calls it. Guard: no reputation write surface importable from Arena UI |
| Standing / rank / level / badges | Reputation fold | Read-only via `readOwnProgress()` server-side; passed down as props |
| Policy (refusals, versioning) | Reputation scoring policy | `lib/arena/policy.ts` re-exports **unchanged**; the aperture reads `REFUSED_V1` as its truth |
| Eligibility | `arenaAccessible()` server gate | Decided before any Arena pixel exists; the entry cannot fabricate it |
| Presentation, ceremony, interaction | **Arena (this phase)** | The only thing Phase 5 owns |

Enforced refusals, verified by guard vocabulary scans and mutation: no 1–5 stars, no popularity scoring, no leaderboard, no purchased/transferable XP, no decreasing lifetime XP (Arena has no write path at all), no invented ranks/achievements, no fabricated competitions, no locked-door upsell for the ungated (they see *nothing*, not a teaser).

## 7. The semantic visual ledger

Every visual element ships with a row in `lib/cxos/arenaLedger.ts` — what it represents, its data source, honest status, absent-state behavior, interactivity, reduced-motion projection. The guard fails if a shipped element lacks its row. The ten rows:

| Element | Represents | Source | Status | When absent |
|---|---|---|---|---|
| Clearance register (entry b1) | Resolved access: identity · cohort · policy v | server gate + `OwnProgress.policyVersion` | DORMANT | entry never mounts — redirect happened first |
| Evidence vault lines (entry b2) | Own top evidenced awards | `OwnProgress.awards` | DORMANT | truthful line: "No XP yet — only evidenced activity counts." |
| Ascent line (entry b3) | Earned rank + level | `ArenaStanding` | DORMANT | level 0 renders as itself, never inflated |
| Arena reveal ring (entry b4) | Chamber opening — pure architecture, no data | none (declared decorative) | PROTOTYPE | n/a |
| Standing ring (chamber) | XP into current level / span | `xpIntoLevel`/`xpForNextLevel` | DORMANT | ring at 0% with truthful caption |
| Milestone seals | Earned badges | `ArenaStanding.badges` | DORMANT | row absent — no placeholder seals, ever |
| Ledger wall | Own award history | `OwnProgress.awards` (unchanged logic) | DORMANT | existing truthful empty state |
| Competition aperture | Where competitions WILL open — refused in v1 | `REFUSED_V1` | PLANNED | always the sealed PLANNED seal; no live branch exists |
| Kai brief | Kai *interpreting* the operator's own record | computed from `OwnProgress` only; no AI call | PROTOTYPE | interprets the empty vault truthfully |
| Arena door (Mission Control) | The call — Arena reachable for THIS account | `arenaAccessible(user)` server-side | DORMANT | not rendered — no teaser outside the cohort |

Statuses are DORMANT (real code, real data, gated off in production by the unset flag) — not LIVE, because production truth is that the flag is off; the ledger refuses to inflate that.

## 8. Scene flow & camera choreography

There is no camera and no scroll seizure — the "camera" is staged typography, light, and one ceremonial ring, in keeping with the CXOS grammar (`--ease-vector`). First entry (≈8.6 s, inside the mandated 7–12 s):

| t | Beat | Content (all real) |
|---|---|---|
| 0 ms | b1 CLEARANCE | `identity · internal cohort · policy v{n}` — renders only because the server gate already passed |
| 1700 ms | b2 EVIDENCE VAULT | top 3 own awards (label · evidence class · +XP), or the truthful empty line |
| 4300 ms | b3 ASCENT / STANDING | rank · level · lifetime XP · evidenced award count — scale via typography and light only |
| 6100 ms | b4 REVEAL | the chamber ring opens (`.cx-ar-ring` → `-open`, 1.6 s transform); "THE ARENA — your record, on the floor" |
| 8600 ms | b5 FLOOR | dissolve; focus handed to the room's `h1`; the floor is the real chamber, already rendered beneath |

Returning entry ≈1.1 s (sessionStorage key `cx-arena`). Tier C (save-data / low memory) gets the short variant. Tier D (reduced motion or effects-off toggle) mounts **nothing** — the chamber is simply there. Eligibility is never fabricated: an ineligible account was server-redirected before this component could exist.

## 9. Interaction choreography

- **Skip, three ways, always:** Escape · an autofocused "Skip — Esc" button · click anywhere on the veil. Duplicate skips collapse to one clean dissolve (`doneRef`).
- **Focus discipline:** the overlay is `role="dialog"` with `aria-label="Entering the Arena. Press Escape to skip."`; beats announce via `aria-live="polite"`; on dissolve, focus lands on the chamber heading (`tabindex="-1"` + `focus({preventScroll:true})`).
- **Safety fade:** a pure-CSS 12 s animation forces the veil transparent even if every timer dies — the floor can never be stranded behind the ceremony.
- **Links stay real:** the Arena door is a plain `<Link href="/arena">`; browser back returns to Mission Control (battery-verified).
- **Director instruments** (review mode only): replay first/returning, jump to beats b1–b4 — never rendered for a normal visitor and never writing the first-entry marker.

## 10. Arena data-source map

Single server load per request: `currentUser()` → `arenaAccessible(user)` → `readOwnProgress(user.id)` → props. The entry and every chamber component receive only that load; the guard proves the Arena UI contains no `prisma.`, no `fetch(`, no `getServerSession(`, no random or clock-derived numbers, and no literal XP constants outside the review stage's clearly-marked fixtures. Kai's brief is a deterministic function of `awardCount`/`level`/`xpToNext` — no AI call, no forecast, no praise, no Shiba mascot, no ownership of the record ("reading your record" — interpretation only).

## 11. Authorization map

| Surface | Gate | Ungated experience |
|---|---|---|
| `/arena` | server: `arenaAccessible()` else `redirect("/dashboard")` — precedes all markup | redirect; zero Arena bytes, zero veil |
| Arena door (dashboard) | server: rendered only inside `arenaAccessible(user) ? readOwnProgress(...) : null` | door absent entirely — no teaser, no upsell |
| Entry overlay | exists only inside the post-gate server render | cannot mount for an ineligible account |
| `/review/arena` | `reviewBuildAllowed()` — production returns the "not enabled" page **first** | synthetic stage; fixtures only; no auth, no DB |
| Flag off (production today) | `ARENA_ENABLED !== "true"` fails everyone, including admins | fully dormant |

Battery-proven on the real stack: signed-out deep link, outside-cohort account, and flag-off cohort account all end away from `/arena` with no Arena markup and no door. Guard-proven ordering: the redirect line precedes `<ArenaEntry` in source, mutation-checked for vacuity.

## 12. Reduced-motion & capability projection

Reduced motion is absolute and first-priority in `detectTier()`: tier D mounts no entry at all, and a CSS backstop (`prefers-reduced-motion` → `.cx-ar-veil { animation: none; display: none }`, transitions none, static ring/aperture gradients) covers even a JS-detection failure. The user-facing cinematic toggle (`cx-cinematic=off`) produces the same tier-D result. No-JS: the chamber's server-rendered content is fully present with no veil (battery C3). The chamber itself is static CSS — the standing ring is a conic-gradient at the real percentage, not an animation.

## 13. Performance budget

- **Zero network cost added:** no new dependency, no image, no font, no API call; the entry is one client component (~5 KB source) over the existing page.
- **Zero WebGL/canvas:** DOM + CSS gradients only; compositor-friendly (`opacity`/`transform` transitions); one veil layer at `z-[96]`.
- **No layout thrash:** beats append absolutely-positioned/flow content inside a fixed overlay; the page beneath is already painted.
- **Timers:** four `setTimeout`s, all cleared on unmount; sessionStorage touched at most once per visit.
- Build output confirms `/arena` remains a server-rendered dynamic route; `/review/arena` is static-prerendered with the hard-off branch.

## 14. Failure scenarios

| Failure | Behavior (verified) |
|---|---|
| `readOwnProgress` throws (DB down, bad data) | fails closed to EMPTY standing — chamber renders the truthful empty vault, never a stale or invented number |
| Capability detection throws | entry silently absent; the floor is simply there |
| sessionStorage unavailable (private mode) | treated as first visit; write failure swallowed |
| All entry timers die | 12 s pure-CSS safety fade dissolves the veil regardless |
| JS disabled | server-rendered chamber fully readable, no veil |
| Review stage reached in production | `reviewBuildAllowed()` returns the "not enabled" page before any stage code renders |
| Ineligible account manipulates the client | nothing to manipulate — eligibility was decided server-side and the ineligible render contains no Arena code |

## 15. Validation evidence

**Guard — `scripts/cxos-arena.test.ts`: 25/25.** Labeled checks across ownership (no write surface, no prisma/fetch/session in UI, read-only policy import), honesty (no random/clock numbers, no literal XP outside fixtures, PLANNED aperture with no live branch, seals absent when empty, ledger coverage, no stars/popularity/leaderboard vocabulary), authorization ordering (redirect precedes entry; door behind the real gate; no upsell vocabulary), review isolation (fixtures only, unconditional synthetic banner, `reviewBuildAllowed`, no first-entry consumption), and entry laws (7–12 s first / ≤1.5 s returning parsed from source, tier D mounts nothing, three-way skip, safety fade, reduced-motion backstop, focus handoff, accessible dialog).

**Mutation testing — 7/7 RED, then byte-identical restores (`cmp` verified):**

| # | Mutation | Result |
|---|---|---|
| A-M1 | Arena UI given an XP-award write call | guard RED (ownership) |
| A-M2 | Invented literal XP metric rendered on the live page | guard RED (honesty) |
| A-M3 | Competition aperture given an open/LIVE branch | guard RED (PLANNED law) |
| A-M4 | Tier-D "mounts nothing" check removed | guard RED (reduced motion) |
| A-M5 | Synthetic banner removed from the review stage | guard RED (label law) |
| A-M6 | Review stage made to write the first-entry marker | guard RED (no consumption) |
| A-M7 | `reviewBuildAllowed()` production hard-off bypassed | guard RED (prod isolation) |

**Behavioral battery — 30/30 on the real stack** (embedded PostgreSQL, real NextAuth login, real product rate limiters, Playwright/Chromium): A1–A5 authorization (signed-out, outside-cohort, flag-off — all redirected, zero Arena markup, no door); B1–B13 cohort walk (door with real standing → first entry with all four beats textually verified on real data → completes inside the law → focus on the heading → floor is the real chamber → returning short variant → Escape skip → duplicate-skip collapse → browser back); C1–C3 reduced-motion / effects-off / no-JS projections; D1–D4 review stage (synthetic banner, fixture entry, truthful locked/permission/error states, hub lists Arena as the fourth PROTOTYPE room); E1–E2 mobile 390 px and tablet 768 px.

**Repository health:** full suite 84 guard files green (including schema-safety, compliance-bar, reputation and arena-cohort guards) · `npm run typecheck` exit 0 · `npx next build` green · **production-flagged build** (`NEXT_PUBLIC_VERCEL_ENV=production`): `/review/arena` renders "Founder Review is not enabled in this build." and `/arena` 307-redirects dormant with the flag unset.

**Recordings & frames** (delivered as files): desktop walkthrough `arena-desktop.webm`, mobile walkthrough `arena-mobile.webm`; real-frame storyboard — door, entry vault beat, entry reveal, chamber, reduced-motion, review stage entry and states, mobile entry/chamber, tablet.

## 16. Founder Review stage

`/review/arena` (fourth PROTOTYPE room on the `/review` hub): replay first (~8.6 s) and returning (~1.1 s) entries over clearly-labeled synthetic fixtures (`cxreview-consumer` — populated and empty variants); state selector for Populated · Empty vault · Flag off/dormant · Outside cohort · Data error, each describing the *real* behavior truthfully instead of simulating a fake account; unconditional banner "SYNTHETIC REVIEW DATA — no real account, no database, no reputation read"; agency projection stated as refused-by-policy rather than faked. Review runs never write the visitor's first-entry marker, and production builds hard-off the entire stage.

## 17. Rollback plan

Two-commit surface, fully additive: revert the docs commit and `4a57575` (or reset the branch to `8d9198c`) and Phase 5 is gone. No migration to unwind, no dependency to prune, no env var to unset, no flag was touched. `app/arena/page.tsx` modifications wrap unchanged data logic, so a partial rollback (remove entry/chamber components, restore the prior page body) is also a clean single-file operation. Production (`main` @ `f449c35`) never contained any of this.

## 18. Known limitations (honest)

1. **The live cohort experience in preview requires the Founder's flag decision.** `ARENA_ENABLED` is unset in the preview environment and I am not permitted to enable dormant flags — so `/arena` on the preview deployment stays dormant (redirects) until the Founder sets it for Preview. The review stage carries the full experience today without it.
2. **Entry duration is source-verified and battery-bounded, not frame-profiled** — no FPS instrumentation was added for a DOM/CSS overlay; the director HUD from earlier phases remains available for timing inspection.
3. **The reveal ring is the one element with no data meaning** — declared as decorative architecture in the ledger rather than smuggled in as fake signal.
4. **Kai's brief is deterministic copy, not the Kai engine** — labeled PROTOTYPE in the ledger; wiring it to the real Kai engine is a future, separately-reviewed step.
5. **Agency Arena does not exist** because policy v1 is own-record-only; the review stage says so explicitly instead of projecting a fake one.

## 19. Deliverables index

Working prototype (commit `4a57575`) · this report (`CXOS_PHASE_5_REPORT.md` + standalone HTML projection + mobile-friendly PDF) · truth audit (§3) · scope decision (§4) · architecture (§5) · ownership matrix (§6) · semantic ledger (§7) · scene/camera choreography (§8) · interaction choreography (§9) · data-source map (§10) · authorization map (§11) · reduced-motion projection (§12) · performance budget (§13) · failure scenarios (§14) · validation evidence with mutations and battery (§15) · Founder Review stage (§16) · rollback plan (§17) · desktop + mobile recordings and real-frame storyboard (files) · live protected preview URL (below) · Founder decision block (§20).

**Preview:** `https://gabriel-capital-labs-git-feat-cxo-06bc43-rey-gabriel-s-projects.vercel.app/review/arena` (protected preview; rebuilt on this push). The live `/arena` surface remains dormant there by design — see §18.1.

## 20. Founder decision block

- [ ] Approve project-isolation enforcement
- [ ] Approve Arena ownership boundaries
- [ ] Approve narrative direction
- [ ] Approve spatial environment
- [ ] Approve entry choreography
- [ ] Approve Arena surface language
- [ ] Approve Kai presence
- [ ] Approve interaction language
- [ ] Approve authoritative data projections
- [ ] Approve performance
- [ ] Approve accessibility
- [ ] Approve security and authorization
- [ ] Approve Phase 5 vertical slice
- [ ] Request changes
- [ ] Reject

Silence is not treated as approval. Work stops here pending these decisions.
