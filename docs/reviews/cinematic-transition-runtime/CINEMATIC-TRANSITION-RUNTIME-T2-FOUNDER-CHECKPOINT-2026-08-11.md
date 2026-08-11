# Cinematic Transition Runtime — T2 Founder Checkpoint

**Date:** 2026-08-11 · **Author:** Fable 5 (coordinator/design authority; 3 Sonnet writers, 5 Sonnet recon readers, 3-lens Opus adversarial gate)
**Branch:** `feat/cinematic-transition-t2` · **T2 head `7f562b9`** (= T2 `09e0d61` + T2.2 gate closure) on accepted T1 `1698e2b` · production `main` untouched at `a72a47c`
**Binding docs:** `T2-SPEC.md` (with §6.5 T2.1 + T2.2 adjudications) · T1 checkpoint · the Wave-plan audit

## 1 · What T2 is

The structural fix for CLICK → PAGE → CONTENT plus the first production wiring of the
accepted T1 journey grammar:

- **Persistent product shell** — new route group `app/(rooms)/` hosting ONE
  `RoomsShell` (byte-faithful reproduction of AppShell's DOM) for 25 product pages;
  the chrome (Sidebar, header, banners, KaiPresence, MobileNav) is mounted once and
  **provably survives navigation** (element-identity verified live). 21 route dirs
  moved URL-identically; 26 pages + 4 loading files de-shelled; `AppShell` itself
  untouched (admin keeps it).
- **Three deliberate chrome-free escapes** stay outside the group, byte-identical at
  their original paths: `billing/cancel` (the disabled-account escape hatch),
  `letters/print/[id]`, and `onboarding` (its signed-in surface was always
  full-bleed standalone — caught by the adversarial gate). Guard-pinned.
- **Flagship journey integration** — dashboard ↔ agency ↔ arena run the accepted T1
  machine via ONE capture-phase delegated handler on the shell root (the production
  TransitionShell precedent; capture is load-bearing — next/link preventDefaults
  during bubble, proven live). It covers sidebar links, the mobile bottom bar, and
  in-content portals (ArenaDoor — a frozen component — journeys without being
  touched). Non-flagship rooms navigate exactly as before.
- **Departure/arrival grammar** — opacity-only shell CSS: origin recedes to 0.55
  during departing; destination content and header title settle in over 360 ms on
  arrival; `data-journey-phase` stamped on the shell root drives it. Reduced-motion
  resets belt-and-braces.
- **Entry-grammar differentiation (Founder directive)** — Mission Control and Arena
  returning veils are suppressed **only** for an in-flight cinematic journey arrival
  to that exact room; first-visit ceremonies, tier-C veils, deep-link/refresh veils,
  and Back/Forward veils all preserved (guard-pinned predicate).
- **Persistence-safety** — the five mount-once shell data hooks are now
  pathname-reactive (today's per-navigation cadence, TTL-limited); AgencyBar and
  ImpersonationBanner exits clear their own state (`clearAdminContextCache` added);
  AnnouncementBanner clears deactivated announcements; KaiPresence can no longer
  flash the previous subject after a workspace switch.
- **Readability hardening** — the departure recede IS the travel-hierarchy state;
  the two under-text ambient canvases' alpha ceilings are guard-pinned (the
  numeric-contract discipline from the audit), and no global darkening was done.

## 2 · Validation (all executed)

| Gate | Result |
|---|---|
| typecheck / `next build` | clean / clean (70/70; with and without the review flag) |
| Guards | T1 suite **151/151** · persistent-shell **59/59** · cxos-mission **33/33** · cxos-arena **27/27** |
| Shell persistence | **Element identity held across every navigation** (marked sidebar node survives; title updates reactively) |
| Full Motion (emulated no-preference = production cinematic path) | Full grammar on all three interception surfaces — sidebar click, in-content anchor, mobile tap: `departing(recede) → traveling(veil, chrome INERT) → arriving(settle) → settled(H1 focus)` |
| Reduced Motion (inherited forced reduce = Founder environment) | Deterministic instant swap, zero veil, shell persisted |
| Router/history | Browser Back clean past the verify horizon · Escape mid-departing holds at origin · anonymous `/arena` **server-redirect absorbed mid-journey** (settles at `/dashboard`, no hijack, no reload) |
| Mobile (375×812, touch, mobile UA) | Full grammar via bottom tab bar, chrome inert during travel, CLS 0 |
| CLS during journeys | **0** (desktop and mobile, layout-shift observer) |
| Isolation | Guard-enforced: zero diffs under `app/admin`, `app/api`, `lib/cxos`, `components/cxos/runtime`, `app/review/agency-command`, middleware/configs/prisma; M2 clone untouched; T1 frozen files byte-identical except two pinned TravelLayer amendments |

Local-validation caveat (disclosed): no local database exists, so the live battery ran
anonymously with `/api/**` aborted at the browser layer (journey mechanics are pure
client; server renders don't need the DB on anonymous paths). Authenticated visual
flow — including the first-visit ceremonies and the veil-suppression on re-entry — is
yours on the preview, where the real DB and your login exist.

## 3 · Adversarial gate (3-lens Opus on the exact committed source)

**0 Critical / 5 High (4 distinct) / 10 Medium / 14 Low.** All Highs and all
actionable Mediums repaired in T2.2 and re-verified live:

| Finding | Repair |
|---|---|
| Keyboard/SR could reach the persistent chrome behind the opaque veil (the T1 inert law only covered `<main>`) | Inert scope marker on the whole shell root; T1 demo fallback unchanged; verified live — chrome `[INERT]` during every traveling window |
| Slow/cold destination: arrival announced + focused for a room the browser never reached | Arrival announce/focus now location-gated (silent settle on mismatch; router-verify owns recovery) |
| Ceremony suppression keyed on "any journey ever" (killed tier-C/Back/Forward veils, violating spec §5) | Precise predicate: in-flight cinematic arrival to that exact room (`ROOM_ID`), guard-pinned |
| Arrival/departure animation created a stacking context that trapped ceremony veils under the sticky header | `z-index` lift on `main#main` scoped to the two transient phases |
| `/onboarding` silently gained chrome it never had (signed-in surface is full-bleed standalone) | Third chrome-free escape — restored byte-identical outside the group, guard-pinned |
| Review MotionPreviewControl statically bundled into the product chunk | Code-split via `next/dynamic`; production never fetches the chunk |
| AnnouncementBanner never cleared · KaiPresence stale-subject flash · same-origin gap · Escape recede-snap · unpinned capture phase | All fixed + guard-pinned |

**Accepted with disclosure** (each traced, none blocking): post-fallthrough journeys
leave the machine's advisory `destination` unreconciled until the next journey (the
location-gated announce removes the user-facing harm; reconciliation is T3);
`readyTimeout` fail-open on a >1.6 s destination render releases the veil before the
content swap (fail-open by design; small on a real DB; richer slow-arrival treatment
is T3); ~5 chrome re-renders per journey (React reconciliation only — zero DOM churn,
CLS 0); SSR title fallback paints one frame before hydration on dynamic-title rooms;
mobile drawer state persists across non-drawer navigations; CSS mirrors tier-A pacing
constants (tier B phases flip the attribute regardless — commented in the block);
per-navigation shell API cadence equals today's remount cadence by design.

## 4 · What the Founder should review (visual pass)

On the preview (URL in the report), signed in as yourself:

1. **`/dashboard` → sidebar → Agency → back to Mission Control** — the shell never
   flashes; travel reads departure → travel → arrival; the returning Mission veil no
   longer replays on the journey re-entry (your entry-grammar directive).
2. **Mission Control → ArenaDoor → Arena** — an in-content portal journeys with the
   same grammar (first Arena visit keeps its full ceremony; re-entries don't).
3. **Reduced motion (your Mac's default)** — everything resolves instantly and
   deterministically; nothing waits on animation.
4. **Full Motion preview of the product shell** — append `?director` to any room URL
   on the preview build: the T1.3 MOTION PREVIEW control appears (review builds
   only); FULL MOTION shows the cinematic path despite OS Reduce Motion.
5. Non-flagship rooms (Letters, Mail, Academy…) behave exactly as before — persistent
   chrome, plain navigation.
6. `/onboarding`, `/billing/cancel`, letter print sheets — unchanged, chrome-free.

## 5 · Boundaries honored

No production deploy/alias/merge; `main` = `a72a47c` throughout. No schema, billing,
Stripe, migrations, counsel copy. P0/M2/Launch Closure untouched (guard-enforced).
Registry/`CRITICAL_NEVER` untouched (T3 Founder decision). Admin untouched.

## 6 · Recommended next (T3, on your acceptance)

Portal/spatial Level-1 controls + the governed registry/`CRITICAL_NEVER` ruling +
destination-state reconciliation + slow-arrival instrumentation; then T4 ambient
(budget model) and T5 mobile/perf hardening per the audit's wave plan.
