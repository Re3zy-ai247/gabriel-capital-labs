# Cinematic Transition Runtime — Wave T2 Specification

Author: Fable 5 (Design Authority) · Date: 2026-08-11
Branch: `feat/cinematic-transition-t2` from accepted T1 head `1698e2b` · Status: **BINDING**.
Founder authorization: T1 APPROVED; T2 authorized (persistent shell + departure/arrival
grammar + entry-grammar differentiation + readability hardening; preview only).
Repository evidence overrides this spec on conflict — stop and report.

## 0. Non-negotiables

- Accepted T1 behavior/grammar is preserved: phases, laws, pacing, TravelLayer, demo
  segment — `lib/transition-runtime/machine.ts`, `pacing.ts`, `types.ts`,
  `TravelLayer.tsx`, `RoomReady.tsx`, and `app/review/transition-runtime/*` are
  **unmodified in T2** (provider gains additive exports only).
- Untouchable: P0 · M2 · Launch Closure · counsel copy · schema/billing/Stripe ·
  `lib/cxos/*` (except nothing) · `components/cxos/runtime/*` · `app/review/agency-command/*` ·
  `lib/cxos/transitions/registry.ts` + `CRITICAL_NEVER` (T3 decision) · `middleware.ts` ·
  `next.config.js` · `vercel.json` · `app/admin/*` (keeps its own layout + AppShell).
- Exception, Founder-authorized in this directive: `components/cxos/mission/MissionEntry.tsx`
  and `components/cxos/arena/ArenaEntry.tsx` receive the bounded journey-arrival
  recalibration in §5 (their guard pins updated accordingly). Nothing else under
  `components/cxos/` changes.
- One writer per file (ownership table §8). No push until I (coordinator) authorize the
  preview push. No production deploy/alias/merge.

## 1. Persistent shell architecture

New route group **`app/(rooms)/`** hosting the 26 product pages (route groups don't
change URLs). `app/admin/*` stays where it is (18 pages, own layout gate — the
in-repo precedent). Marketing/auth/legal untouched.

### app/(rooms)/layout.tsx — server component
```tsx
// server: compute review capability once; NO auth here (pages keep their guards —
// auth semantics preserved exactly; admin precedent notwithstanding, adding a group
// auth gate would CHANGE per-page redirect targets, so we don't).
import { reviewBuildAllowed } from "@/lib/cxos/reviewMode";
import { RoomsShell } from "@/components/shell/RoomsShell";
export default function RoomsLayout({ children }) {
  return <RoomsShell reviewInstrumentsAllowed={reviewBuildAllowed()}>{children}</RoomsShell>;
}
```

### components/shell/RoomsShell.tsx — client, the persistent chrome
Reproduces AppShell's DOM **exactly** (evidence: AppShell.tsx:10-32) — outer
`div.flex.min-h-screen` → `<Sidebar/>` + inner `div.flex.min-w-0.flex-1.flex-col` →
`<header sticky top-0 z-20 …>` (h1 title + ThemeToggle + "+ New Dispute" Link +
HeaderLogout) → `<ImpersonationBanner/>` → `<AnnouncementBanner/>` → `<AgencyBar/>` →
`<main id="main" class="flex-1 px-5 py-6 pb-24 md:pb-6">{children}</main>` →
`<KaiPresence/>` → `<MobileNav/>`. DOM order, classNames, `id="main"` (skip-link
target), and the z-index/offset couplings (MobileNav z-30/z-40, KaiPresence
`bottom-20`, main `pb-24`) are preserved byte-for-byte.

**Title**: from `usePathname()` against the room registry (§3) — longest-prefix match.
Fallback for unmatched paths: `"/ CreditVector"`. Dynamic-title rooms use
`<RoomTitleOverride title>` (context setter rendered by the page; sole consumer today:
`modules/[slug]` with `/ Modules / ${mod.name}`; restore-on-unmount).

**Journey wiring**: RoomsShell body is wrapped by `<TransitionRuntimeProvider
initialRoom={registryMatch} >` + `<TravelLayer/>` (inside the provider, after MobileNav).
The shell's outer div carries `data-journey-phase={phase}` (from `useJourney()` in a
tiny inner component to keep the provider above it). `motionPreview` state lives in
RoomsShell exactly like the demo layout, but the `<MotionPreviewControl/>` renders
ONLY when `props.reviewInstrumentsAllowed && isDirectorActive()` (the established
Founder-instrument pattern: preview/dev builds + `?director` param; impossible in
production by `reviewBuildAllowed()` server truth).

### Persistence-safety fixes (recon-proven hazards — all in §8 ownership)
1. `components/admin/useAdminContext.ts` — effect deps `[]` → `[pathname]`
   (usePathname), preserving the 60 s module TTL: net behavior = today's cadence
   (attempt per navigation, TTL suppresses spam). ADD exported
   `clearAdminContextCache()` (symmetry with the other two hooks).
2. `components/community/useCommunityAccess.ts`, `components/onboarding/useOnboardingStatus.ts`
   — same `[]` → `[pathname]` deps change.
3. `components/AgencyBar.tsx` — effect deps `[]` → `[pathname]` (raw fetch, no TTL —
   matches today's per-navigation fetch); `exit()` additionally `setClient(null)`
   immediately (fixes the stale-banner break recon confirmed).
4. `components/admin/ImpersonationBanner.tsx` — `exit()` calls
   `clearAdminContextCache()` before `router.refresh()`.
5. `components/AnnouncementBanner.tsx` — deps `[]` → `[pathname]` (announcement
   check per navigation, as today).
6. `components/kai/KaiPresence.tsx` — **comment-only** update (lines 26-39 premise
   "remounts on each navigation" goes false; the code is already pathname-reactive).
7. `components/Sidebar.tsx` — active state already `usePathname`-reactive (no change
   needed there). ADD journey interception (§4).

### Page migration (26 pages + 4 loading + co-located files)
`git mv` the 22 top-level route dirs (academy, agency, arena, billing, builder,
campaigns, community, dashboard, gxl, identity, journey, letters, mail, modules,
network, onboarding, scores, settings, strategist, support, tradelines, upload) into
`app/(rooms)/` **as whole units** (gxl's `../allowed`/`../gallery.module.css` imports
survive only if the subtree moves together — recon-verified as the single escaping
case; every other relative import is same-dir). Then per page: remove the
`<AppShell title="…">` wrapper (unwrap children; delete the import). The 4 loading.tsx
files (community, dashboard, journey, tradelines) lose their AppShell wrapper too —
skeleton content only (this also kills the audited third-shell-mount defect).
`components/AppShell.tsx` itself is NOT deleted (admin still consumes it).
Middleware/next.config/vercel.json reference no room paths (recon-verified) — no
route-string updates exist.

## 2. Flagship journey integration

Flagship set (representative pairs, per directive): **dashboard ↔ agency ↔ arena**.
- `<RoomReady roomId="dashboard|agency|arena"/>` rendered by those three pages.
- Sidebar + MobileNav: nav items whose href matches a **journey-enabled** registry
  room intercept plain primary clicks (DemoRoom pattern: `navigate()` first,
  `preventDefault()` only when accepted; modified clicks and non-flagship rooms fall
  through to plain `<Link>`). Sidebar is also mounted by admin's AppShell (no
  provider) — interception uses `useOptionalJourneyMachine()` (new additive export):
  null context ⇒ plain links everywhere, zero behavior change outside `(rooms)`.
- Non-flagship rooms navigate exactly as today (plain App Router) in T2.

## 3. Room registry — lib/transition-runtime/roomRegistry.ts (new)

`ROOMS: { id, href, label, journey: boolean }[]` for all 26 product rooms (labels =
the existing per-page titles from the recon inventory; journey=true only for
dashboard/agency/arena). Helpers: `matchRoom(pathname)` longest-prefix,
`roomTitle(pathname)`. Single source for shell title + provider seeding + Sidebar
interception. (The T1 demo keeps its own 3-room registry — separate surface,
unchanged.)

## 4. Departure / arrival grammar (shell-level, restrained)

New `/* T2 journey grammar */` block in `app/globals.css`:
- Departure recede (origin, pre-veil):
  `[data-journey-phase="departing"] main#main { opacity:.55; transition:opacity 240ms var(--ease-vector); }`
  — opacity/luminance only (PASSAGE power-down precedent, gentler at shell level).
- Arrival settle (destination):
  `[data-journey-phase="arriving"] main#main, [data-journey-phase="arriving"] header h1`
  get a one-shot opacity rise (`t2-arrive` keyframes, 360 ms, opacity-only).
- Defense-in-depth: `@media (prefers-reduced-motion: reduce)` resets both to none
  (immediate mode never enters these phases; the CSS reset is the house belt).
- NO transform choreography at shell level in T2. No new veil visuals (accepted T1
  TravelLayer is the travel).

## 5. Entry-grammar differentiation (Founder-authorized recalibration)

MissionEntry + ArenaEntry: in the mount effect, after the tier-D bail, read
`useOptionalJourneyMachine()`; if machine present and `machine.state().sequence > 0`
(this mount follows an in-shell journey arrival) **and** the computed variant is
`"returning"` → set mode "off" and render nothing (the journey WAS the arrival; no
stacked 1.1 s veil). Unchanged: first-visit ceremony (7300/8600 ms), tier-C returning
veil on direct loads, deep-link/refresh returning veil (sequence 0), forceVariant/
forceReview (review stages), SESSION_KEY write semantics, Escape/skip, 12 s safety
fade, copy laws ("Clearance confirmed." stays; "Record located." stays banned).
Update the stale premise comments. Guard updates (same writer):
`scripts/cxos-mission.test.ts` + `scripts/cxos-arena.test.ts` — all existing pins
stay satisfiable (durations unchanged, literals intact); ADD pins for the
journey-arrival bail (regex on the new conditional) so the recalibration itself is
now law. `scripts/cxos-passage.test.ts` copy pins unaffected.

## 6. Readability hardening (state-aware, no global darkening)

- The §4 departure recede IS the "hierarchy shifts toward travel" state.
- Ambient-luminance contract: new guard section pins the ONLY two under-text ambient
  canvases (components/gxl/GxlField.tsx, components/community/AmbientGrid.tsx) to
  their current low-alpha ceilings (recon: 0.015–0.09 range) via source regex — the
  CINEMATIC-BIBLE lesson: numeric readability intent pinned so future drift fails a
  guard in diff review, exactly the failure mode that produced the RC2 regression.
  No visual change to either canvas in T2.
- No new ambient surfaces for agency/arena in T2 (they are flat today; introducing
  ambience is T4 scope — building it now would be architectural drift "merely for
  animation").

## 6.5 T2.1 — coordinator adjudications (post-implementation, binding)

1. **Chrome-free routes escape the group:** THREE routes are deliberately
   shell-less and live outside `app/(rooms)/` — URLs unchanged, zero diff vs
   `1698e2b`, never wrapped by RoomsShell:
   - `billing/cancel` — the disabled-account escape hatch.
   - `letters/print/[id]` — a clean print sheet, no chrome by design.
   - `onboarding` (T2.2 FIX 8, added after this pass's original two): its
     signed-in branch was never AppShell-wrapped to begin with — a
     full-bleed standalone first-run surface, the same escape class as the
     other two, not caught in the original T2.1 recon.
   All three moved back to (or, for onboarding, were restored to) their
   original ungrouped paths.
2. **ONE interception mechanism:** Sidebar.tsx reverted byte-identical to baseline;
   journey interception is a single **capture-phase** delegated handler on the shell
   root (TransitionShell precedent — capture is load-bearing: next/link
   preventDefaults during bubble at the anchor, so a bubble handler can never
   intercept `<Link>` clicks; proven live in the T2 battery) — covers
   Sidebar/MobileNav links AND in-content portals (ArenaDoor, which is frozen and
   could never be wired directly). Earlier-capture handlers that preventDefault
   still win (defaultPrevented respected); rejected requests fall through to the
   real link.
3. **TravelLayer focus fallback (bounded T1 amendment on NEW integration evidence,
   not a reopened finding):** the product shell's title `<h1>` lives in `<header>`,
   so the arrival focus handoff gains `?? querySelector("header h1")`. Pinned in the
   T2 guard (exactly one diff hunk allowed in that file).
4. **Announcement labels:** `journeyLabel()` strips the header title's leading
   "/ " for spoken/announced destination names.
5. **T1 suite supersession:** `transition-runtime.test.ts`'s wave-scoped isolation
   gate defers to `persistent-shell.test.ts` when that successor guard exists.

## 7. Explicitly deferred (disclosed, not forgotten)

Admin group migration · non-flagship journey enrollment · registry/CRITICAL_NEVER
extension (T3, Founder) · agency/arena ambient (T4) · safe-area/visualViewport +
production CLS/LoAF telemetry (T5) · scroll-restoration beyond App Router defaults.

## 8. Ownership (one writer per file)

| Writer | Files |
|---|---|
| W1 shell | `components/shell/RoomsShell.tsx` (new) · `app/(rooms)/layout.tsx` (new, after W2 creates the dir — coordinate via mkdir-safe) · `lib/transition-runtime/roomRegistry.ts` (new) · `components/transition-runtime/TransitionRuntimeProvider.tsx` (ADDITIVE: export `useOptionalJourneyMachine`) · `components/Sidebar.tsx` · `components/AgencyBar.tsx` · `components/AnnouncementBanner.tsx` · `components/admin/{useAdminContext.ts,ImpersonationBanner.tsx}` · `components/community/useCommunityAccess.ts` · `components/onboarding/useOnboardingStatus.ts` · `components/kai/KaiPresence.tsx` (comment) · `app/globals.css` (T2 block only) |
| W2 migration | the 22 `git mv` moves · the 26 page.tsx unwraps · the 4 loading.tsx unwraps · `<RoomReady/>` in 3 flagship pages · `<RoomTitleOverride/>` in `modules/[slug]` (component itself is W1's, exported from RoomsShell.tsx) |
| W3 ceremonies+guards | `components/cxos/mission/MissionEntry.tsx` · `components/cxos/arena/ArenaEntry.tsx` · `scripts/cxos-mission.test.ts` · `scripts/cxos-arena.test.ts` · `scripts/persistent-shell.test.ts` (new) |
| Fable | this spec · checkpoint docs · final verification/fixes |

## 9. Guards — scripts/persistent-shell.test.ts (new, W3)

1. Zero `<AppShell` under `app/(rooms)/` (pages AND loading files).
2. `app/(rooms)/layout.tsx` exists, renders RoomsShell, calls reviewBuildAllowed().
3. RoomsShell DOM-order pins: Sidebar → header → ImpersonationBanner →
   AnnouncementBanner → AgencyBar → main#main → KaiPresence → MobileNav (source-order
   regex) + `id="main"` present + `pb-24` + KaiPresence untouched-offset cross-check.
4. Registry ⇄ filesystem consistency: every journey room dir exists under (rooms);
   every (rooms) top-level route has a registry entry.
5. Hook cadence pins: `[pathname]` deps present in the five persistence-fixed files;
   `clearAdminContextCache` exported and called by ImpersonationBanner.exit.
6. Ambient luminance contract (§6 alpha ceilings).
7. Sidebar interception: `useOptionalJourneyMachine` used; `preventDefault` only after
   accepted `navigate()` (regex).
8. Isolation gate: `git diff --name-only 1698e2b` ⊆ T2 allowlist (this table's files +
   moved paths) — admin/api/lib-cxos/review-agency-command must show ZERO diffs.
9. T1 freeze: machine.ts/pacing.ts/types.ts/TravelLayer/RoomReady/demo segment
   byte-identical to `1698e2b` (git diff empty).

## 10. Acceptance (Founder gate inputs)

Typecheck/build clean · all guard suites green (existing 153 + cxos suites + new) ·
shell persistence proven by ELEMENT IDENTITY across navigation (Playwright: tag the
sidebar node, navigate, assert same node) · flagship pair matrix (all 6 directed
pairs) full+reduced · returning-veil suppression on journey re-entry vs preserved
first-visit ceremony · history/Escape/rapid-nav/deep-link/refresh + unauthenticated
redirect behavior · mobile (375×812 touch) · CLS sampled during journeys (< 0.05
budget, house gate) · fresh 3-lens Opus adversarial on final source → fix
Critical/High → preview deploy → share link → checkpoint docs (MD+HTML).
