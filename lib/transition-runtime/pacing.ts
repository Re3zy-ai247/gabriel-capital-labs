// Cinematic Transition Runtime — Wave T1 (lib/transition-runtime/pacing.ts)
//
// The runtime's timing budgets: SINGLE SOURCE OF TRUTH, named constants only
// (the cxos-pacing.ts discipline — see lib/cxos/pacing.ts's own header for
// the house law this follows: one place to tune, every consumer imports
// rather than restates a number). These are FOUNDATION values for T1's
// skeletal veil; T2 retunes the actual choreography once real
// departure/arrival visuals land. They are tier-scaled (A = full desktop
// cinema, B = mobile/single-plane) and sit inside the same runtime-budget
// vocabulary already shipping in production: TransitionShell's
// TRANSITION_TIMEOUT_MS (1800ms fail-open ceiling) and CXOS's
// districtTransitionFallbackRef pattern (a readiness fallback that
// force-advances rather than waiting forever) — see
// components/cxos/transitions/TransitionShell.tsx and
// components/cxos/runtime/useCxosRoomRuntime.ts.
//
// docs/reviews/cinematic-transition-runtime/T1-SPEC.md §3 pins these EXACT
// values (keys, shape, numbers) — this file is that pin, not a place to
// retune from. Tiers C/D never reach these: machine.ts resolves them to
// `immediate` mode (law 7), which enters no departing/traveling/arriving
// phase and reads no duration here at all.
//
// No CSS mirror is required for T1 (contrast this with cxos-pacing.ts's two
// hand-synced :root custom properties): TravelLayer.tsx imports this module
// directly and reads every duration inline via the `style` prop, so there is
// no second, hand-synced copy of these numbers for a sync guard to police.
export const JOURNEY_PACING = {
  /** Departing veil fade-in hold, per tier — Tier-2 band (180–400ms). */
  departingMs: { A: 280, B: 200 },
  /**
   * Minimum time `traveling` holds even if `ready()` arrives instantly —
   * the floor that keeps a fast destination from producing a blank flash.
   */
  travelMinMs: { A: 420, B: 300 },
  /** Skeletal arrival-settle hold, per tier, once `arriving` begins. */
  arrivingMs: { A: 360, B: 260 },
  /**
   * Fail-open: if the destination never calls `ready()`, force `arriving`
   * anyway after this long in `traveling`.
   *
   * T1.2 amendment (Opus adversarial gate, fix 5): lowered from 1400ms to
   * 1000ms so the worst-case CINEMATIC journey — departingMs.A (280) +
   * readyTimeoutMs (1000) + arrivingMs.A (360) = 1640ms — stays strictly
   * under hardCapMs (1800ms) below. That inequality is pinned as a static
   * guard assertion in scripts/transition-runtime.test.ts (§5 of that
   * suite's numbering): the journey hard cap must never be reachable while
   * a genuine fail-open readyTimeout -> arriving fallback is still
   * naturally in flight, so hardCapMs can never truncate — and silently
   * replace with a jarring forced settle — a fail-open arrival that was
   * already on its way.
   */
  readyTimeoutMs: 1000,
  /**
   * Absolute ceiling from an accepted `request()` to a forced `settled`,
   * from any phase — matches production TransitionShell's
   * TRANSITION_TIMEOUT_MS. A journey never outlives this.
   */
  hardCapMs: 1800,
} as const;

/**
 * The shape pacing.ts owns. `createJourneyMachine({ pacing })` accepts a
 * shallow `Partial<JourneyPacing>` override merged on top of these defaults
 * (shallow: overriding `departingMs` replaces the whole `{ A, B }` pair, it
 * does not let a caller patch just `departingMs.A`).
 */
export type JourneyPacing = typeof JOURNEY_PACING;
