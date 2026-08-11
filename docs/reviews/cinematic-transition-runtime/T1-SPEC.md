# Cinematic Transition Runtime — Wave T1 Specification

Author: Fable 5 (Principal Spatial Experience Architect / Design Authority)
Date: 2026-08-10 · Branch: `feat/cinematic-transition-runtime-t1` (from `origin/main` @ `a72a47c`)
Status: BINDING for T1 implementation. Repository evidence overrides this spec on conflict — stop and report, do not silently diverge.

## 1. Scope

T1 establishes the reusable transition runtime FOUNDATION only. No product room is
modified. No visual choreography beyond a skeletal veil. No registry/denylist change.
All new code is additive; the demo surface lives under `app/review/` and inherits the
existing `reviewBuildAllowed()` production hard-off via `app/review/layout.tsx`.

### Files (one writer per file)

| File | Owner | Purpose |
|---|---|---|
| `lib/transition-runtime/types.ts` | Implementer | Contracts: phases, events, destinations, policy, listener types |
| `lib/transition-runtime/machine.ts` | Implementer | Pure journey state machine. Zero React/DOM imports. Injectable clock. |
| `lib/transition-runtime/pacing.ts` | Implementer | Named timing constants (single source of truth, cxos-pacing style) |
| `components/transition-runtime/TransitionRuntimeProvider.tsx` | Implementer | React adapter: provider, useJourney(), router coordination |
| `components/transition-runtime/TravelLayer.tsx` | Implementer | Persistent veil layer: input discipline, aria-live, data-journey-phase |
| `components/transition-runtime/RoomReady.tsx` | Implementer | Destination-readiness beacon (mount signal) |
| `app/review/transition-runtime/page.tsx` | Implementer | Demo index (redirect to first room) |
| `app/review/transition-runtime/layout.tsx` | Fable (T1.1 amendment) | Segment layout hosting the provider + TravelLayer so one machine/veil persists across the real route swap |
| `app/review/transition-runtime/[room]/page.tsx` + client component | Implementer | 3-room demo over REAL router navigation |
| `scripts/transition-runtime.test.ts` | Test engineer | Deterministic guard suite (npx tsx, repo guard style) |
| `docs/reviews/cinematic-transition-runtime/*` | Fable | Spec, audit, checkpoint |

### Explicitly out of T1 scope
- Persistent AppShell layout migration (T2 — prerequisite for real-room adoption).
- Any edit to `lib/cxos/transitions/registry.ts`, `CRITICAL_NEVER`, or `scripts/cxos-journey.test.ts` (guard-pinned; governed Founder decision, planned T3).
- Any edit to `lib/cxos/*`, `components/cxos/*`, `app/review/agency-command/*` (CXOS RC2 frozen at `f7ee9c5`; main-branch copies are additive-reuse only).
- Departure/arrival choreography, portal controls, ambient motion (T2–T4).
- Readability/darkening changes (audit verdict PARTIAL; hardening is T2, per-state contrast).

## 2. State machine (lib/transition-runtime/machine.ts)

Grammar (maps the Founder's conceptual machine):

```
settled ──request──▶ intent ──begin──▶ departing ──departed──▶ traveling
   ▲                   │ cancel/Esc        │ cancel/Esc            │ (route committed at entry)
   │                   ▼                   ▼                       │ ready|readyTimeout
   └────────────── recovering ◀───fail─────┘                       ▼
   ▲                                                            arriving
   └───────────────────────────── arrivalComplete ────────────────┘
```

Phases: `settled | intent | departing | traveling | arriving | recovering`.
Founder-grammar mapping: IDLE_IN_ROOM=settled · INTENT=intent (entry emits
`acknowledged` — INTERACTION_ACKNOWLEDGED is an event, not a phase) · DEPARTING=departing ·
TRAVELING=traveling · DESTINATION_READY=`ready` event · ARRIVING=arriving ·
ROOM_ACTIVE=settled(destination). Failure/recovery = recovering → settled(origin).

### Laws (each carries its lineage; tests must pin each)

1. **Sequence law** (CXOS `useCxosRoomRuntime` sequence grammar): every accepted
   `request()` increments a monotonic `sequence`. Every timer callback and external
   completion event carries the sequence it belongs to; mismatched sequence = silent
   no-op. No input is ever blocked to achieve safety.
2. **Route commits once, at the departing→traveling boundary** (HELIOS "history commits
   only at settleJourney", adapted: App Router needs the push before destination render,
   so the commit point is entry-to-traveling, exactly once per journey). The machine
   never touches the router; it emits a `commit` effect the adapter executes.
3. **Retarget policy**: during `intent`/`departing` (pre-commit) a new `request()`
   SUPERSEDES the journey (sequence bump, restart from intent). During
   `traveling`/`arriving` (post-commit) a new `request()` is IGNORED (HELIOS
   second-destination law) — recorded via an `ignored` event for instrumentation.
4. **Governed cancel** (HELIOS Esc law): `cancel()` in `intent`/`departing` →
   `recovering` → `settled(origin)`, emitting `cancelled`. Post-commit `cancel()` is a
   no-op (the return journey is a new journey). Browser back during travel is handled by
   the adapter as `fail('route-change')` → recovering.
5. **Separate clocks + deterministic cleanup** (HELIOS tween-vs-timers separation): each
   phase owns exactly one named timer handle; `destroy()` and every phase entry clears
   the handles it supersedes. After `destroy()`, zero timers remain (test-asserted via
   injected clock).
6. **Fail-open safety clock** (existing production `TransitionShell`
   `TRANSITION_TIMEOUT_MS` + CXOS `districtTransitionFallbackRef`): `traveling` arms a
   readiness fallback — if the destination never signals ready within
   `READY_TIMEOUT_MS`, force `arriving` anyway. A journey hard-cap
   (`JOURNEY_HARD_CAP_MS`) force-settles the MACHINE's own state from any
   non-settled phase — this is a pure-module state resolution; the machine
   never touches the router or `location` (§1/§2 header: zero `window`,
   zero `document`). Separately, the ADAPTER (`TransitionRuntimeProvider`)
   runs its own independent router-verify timer (T1.2 amendment) that is
   the only thing that may ever call `location.assign`, and only when it
   independently confirms the browser's real location never reached the
   commit effect's destination — never merely because the machine's hard
   cap fired. Navigation is never lost to a stuck overlay.
7. **Immediate resolution** (CXOS tier law + brief's reduced-motion mandate): if the
   resolved mode is `immediate` (tier C/D — which includes prefers-reduced-motion via
   `detectTier()` — or `document.hidden`, or an explicit option), the journey runs
   intent → commit → settled(destination) with NO departing/traveling/arriving phases and
   NO veil. Deterministic INTENT → DESTINATION → ACTIVE. Reduced motion is full
   citizenship (HELIOS RM law): state still changes, instantly.
8. **Readiness is edge-triggered and sequence-bound**: `ready(sequence)` before
   `traveling` is ignored; after force-arrival it is ignored; duplicate `ready` is
   idempotent.

### API shape (binding)

```ts
createJourneyMachine(options: {
  clock?: JourneyClock;                 // { setTimeout, clearTimeout } — injectable for tests
  pacing?: Partial<JourneyPacing>;      // defaults from pacing.ts
  onEffect: (effect: JourneyEffect) => void;  // { type: 'commit', destination, sequence } etc.
  onEvent?: (event: JourneyEvent) => void;    // acknowledged | departed | travel | ready | arrived | settled | cancelled | ignored | failed | recovered
}): JourneyMachine

interface JourneyMachine {
  state(): JourneyState;                // { phase, origin, destination, sequence, mode }
  request(destination: JourneyDestination, resolution: JourneyResolution): boolean;
  ready(sequence: number): void;        // destination signals mounted/ready
  cancel(reason?: string): void;
  fail(reason: string): void;           // adapter: route error / popstate mid-journey
  subscribe(listener: (s: JourneyState) => void): () => void;
  destroy(): void;
}

type JourneyResolution = { mode: 'cinematic' | 'immediate'; tier: 'A' | 'B' | 'C' | 'D' };
type JourneyDestination = { id: string; href: string; label: string };
```

Pure module: no `window`, no `document`, no React. `Date.now` only via injected clock
(default real). All phase durations from `pacing.ts`.

## 3. Pacing (lib/transition-runtime/pacing.ts)

Foundation values (T2 retunes choreography; these are runtime budgets, tier-scaled,
consistent with the existing production vocabulary — `TransitionShell` coverMs/openMs and
`lib/cxos/pacing.ts` discipline):

```ts
export const JOURNEY_PACING = {
  departingMs:   { A: 280, B: 200 },   // Tier-2 band (180–400ms)
  travelMinMs:   { A: 420, B: 300 },   // minimum travel hold — no blank flash
  arrivingMs:    { A: 360, B: 260 },   // skeletal arrival settle
  readyTimeoutMs: 1000,                // fail-open: force arrival without ready signal
  hardCapMs:      1800,                // matches TransitionShell TRANSITION_TIMEOUT_MS
} as const;
```

**T1.2 amendment (Opus adversarial gate, fix 5):** `readyTimeoutMs` lowered from 1400ms
to 1000ms. This pins the invariant that the worst-case CINEMATIC journey —
`departingMs.A` (280) + `readyTimeoutMs` (1000) + `arrivingMs.A` (360) = 1640ms — stays
strictly under `hardCapMs` (1800ms), so `hardCapMs` can never fire while a genuine
fail-open `readyTimeout → arriving` fallback is still naturally in flight, and can
therefore never truncate — and silently replace with a forced settle — a fail-open
arrival already under way. The inequality
`departingMs.A + readyTimeoutMs + arrivingMs.A < hardCapMs` is pinned as a static guard
assertion in `scripts/transition-runtime.test.ts`.

Every constant consumed by CSS must be mirrored with a comment naming the TS constant
(cxos-pacing sync discipline); T1's TravelLayer reads them inline via style, so no CSS
mirror is required yet.

## 4. React adapter (TransitionRuntimeProvider)

- One machine instance per provider (ref); state exposed via `useSyncExternalStore`.
- `useJourney()` → `{ state, navigate(dest), cancel() }`.
- `navigate()` resolves tier by REUSING `detectTier()` from `lib/cxos/capability.ts`
  (additive import — do not modify that file) + `document.hidden` → `JourneyResolution`;
  mode = immediate for tier C/D or hidden.
- Effect `commit` → `router.push(destination.href)` (next/navigation). Exactly once per
  sequence.
- Listens for `popstate`: always clears the router-verify timer first (a user-initiated
  navigation supersedes verification — T1.2); then pre-commit (`intent`/`departing`) →
  `machine.cancel('route-change')`, post-commit (`traveling`/`arriving`) →
  `machine.fail('route-change')`.
- `navigate()` returns the machine's accept boolean and no-ops on self-navigation
  (destination pathname already current) — T1.2.
- Accepts optional `initialRoom` to seed the machine's starting room (T1.2; the demo
  layout derives it from `useParams()`).
- Unmount → `machine.destroy()`.
- StrictMode-safe: all effects idempotent, machine created lazily in a ref, cleanup
  symmetrical (repo runs `reactStrictMode: true`).

### TravelLayer
- Fixed overlay, `z-index` above content, rendered only in
  departing/traveling/arriving; `pointer-events: auto` ONLY during traveling (matching
  production TransitionShell's cover behavior — old room must not receive clicks
  mid-travel); `aria-hidden="true"`; opacity-only skeleton veil (near-black, brand ink),
  no transform choreography in T1 (compositor-safe: opacity only).
- `data-journey-phase` attribute stamped on the layer host for CSS/instrumentation.
- A visually-hidden `aria-live="polite"` region announces "Traveling to {label}" on
  travel. T1.2 announce policy, keyed on the previous phase at settle: arrived
  cinematically (prev = `arriving`) → "{label} ready" + H1 focus handoff; recovered
  (prev = `recovering`) → "Journey cancelled…", no focus move; any other settle
  (immediate mode, hard-cap) → silent (Next's route announcer covers real navigations;
  a hard-capped journey must not announce a room against the wrong DOM).
- Escape key during intent/departing → `cancel()` (governed; HELIOS law). Post-commit
  Escape does nothing.
- During `traveling`, ownership-marked `inert` (`data-trt-inert`) on top-level `<main>`
  elements keeps keyboard focus from reaching content behind the opaque veil (GCL
  ownership-marker law; T1.2). Known residual: a destination `<main>` mounting
  mid-traveling is unmarked, bounded by `readyTimeoutMs`.

### RoomReady
`<RoomReady roomId />` — client component; subscription-based (T1.2, not mount-bound):
whenever the machine is `traveling` toward `roomId`, it signals
`machine.ready(sequence)` — so readiness survives re-renders without remounts, the
defect class the adversarial gate found. Idempotent per sequence and under StrictMode.

## 5. Demo surface (app/review/transition-runtime/)

- Three demo rooms (`atrium`, `operations`, `archive`) as REAL routes:
  `app/review/transition-runtime/[room]/page.tsx`; index page redirects to `atrium`.
  Rooms are static content (no Prisma, no auth semantics, no product data) with
  distinct headings, a `<RoomReady />` beacon, three portal links driven by
  `useJourney().navigate`, and a phase readout strip showing
  `phase / sequence / mode / tier` live (instrumentation made visible).
- The provider wraps only this demo subtree — nothing global is mounted in T1.
  **T1.1 amendment:** the wrapper is the segment's own `layout.tsx` (client), not
  per-page mounting — App Router preserves a layout across its child routes, so one
  machine and one TravelLayer genuinely span the router.push between rooms. This is
  the persistent-shell principle demonstrated in miniature, still confined to the
  demo segment.
- Inherits `app/review/layout.tsx` (`reviewBuildAllowed()` → `notFound()` in
  production). Do NOT add a second gate; do not modify the layout.
- **T1.3 amendment — Founder MOTION PREVIEW (review harness only):** the segment
  layout renders a SYSTEM / FULL MOTION / REDUCED MOTION radiogroup
  (`MotionPreviewControl.tsx`) feeding the provider's review-only `motionPreview`
  prop (default `system` = byte-for-byte production resolution). FULL resolves tier
  A/B at the review adapter (the same resolution the Playwright evidence harness
  produces) so the Founder can experience the T1 cinematic path while macOS Reduce
  Motion stays ON; REDUCED explicitly previews the tier-D deterministic path; hidden
  documents force immediate in every mode. Isolation: the provider has zero
  production consumers, the mode is never persisted, production motion detection is
  untouched, and machine.ts's law-7 C/D backstop is unchanged. Hardening from live
  verification: the router-verify fallback now compares against a pre-push location
  snapshot, so ANY navigation (including an ignored request's real-`<Link>`
  fallthrough) supersedes verification — the assign fires only when the push never
  moved the browser at all.
- Portals must remain plain `<a>`/`<Link>` semantics underneath (TransitionShell law:
  links stay real links) — intercept the click, call `navigate()`, and `preventDefault`
  ONLY when the request was accepted (T1.2: a rejected/ignored request falls through to
  the real link); a failed runtime must never strand navigation (the machine's hard cap
  force-settles state, and the adapter's independent router-verify timer performs
  `location.assign` only for a genuinely failed push — law 6).

## 6. Guard suite (scripts/transition-runtime.test.ts)

Repo guard style: standalone `npx tsx` script, numbered assertions, exits non-zero on
failure, prints `PASS n/n`. Machine tests use an injected manual clock (no real timers,
fully deterministic). Minimum coverage (each maps to a brief requirement):

1. Happy path: settled→intent(acknowledged)→departing→traveling(commit once)→ready→arriving→settled(dest).
2. Immediate mode: intent→commit→settled; no departing/traveling/arriving; no veil phases entered.
3. Double navigation pre-commit: second request supersedes; first sequence's timers dead (no stale fire).
4. Double navigation post-commit: ignored event emitted; in-flight journey unaffected.
5. Stale ready: ready(oldSequence) is a no-op; ready before traveling is a no-op; duplicate ready idempotent.
6. Ready timeout: no ready signal → force arriving at readyTimeoutMs → settled.
7. Hard cap: stuck journey force-settles at hardCapMs from any phase.
8. Cancel in intent and departing → recovering → settled(origin); commit never fired.
9. Cancel post-commit: no-op (state unchanged).
10. fail('route-change') mid-traveling → recovering → settled with failure event (rapid back navigation).
11. destroy() mid-journey: all timers cleared (manual clock queue empty), no further events.
12. Sequence monotonicity across supersede/cancel/fail (never reused).
13. Listener leak check: subscribe/unsubscribe leaves zero listeners; destroy clears all.
14. Tier B pacing applied (mobile mode: shorter budgets selected).
15. Commit-exactly-once invariant across every scenario above (count assertions).
16. Event-order pinning for the happy path (acknowledged < departed < travel < ready < arrived < settled).

Static structural guards (grep-based, same script): no `import` of React/next in
machine.ts/pacing.ts/types.ts; no modification markers — `git diff --name-only a72a47c`
contains ONLY the T1 file list (isolation gate, printed for the report).

## 7. Acceptance criteria (T1)

- `npm run typecheck` clean · `npx next build` clean · guard suite green.
- Isolation: diff vs `a72a47c` touches only the files in §1's table.
- Demo navigates between 3 rooms with real router pushes; reduced-motion (this Mac's
  forced state) resolves deterministically with zero veil; no stuck overlay under any
  tested fault; Escape governed-cancel works pre-commit.
- No production exposure: `/review/transition-runtime` inherits the 404 hard-off.
- No push, no merge, no deploy. Commit locally on `feat/cinematic-transition-runtime-t1`.
