// Cinematic Transition Runtime — Wave T1 (lib/transition-runtime/types.ts)
//
// Every contract the runtime speaks: phases, destinations, the resolution
// policy an adapter hands in, effects the machine asks an adapter to
// perform, events it narrates for instrumentation, and the machine's own
// public shape. Pure types only — no runtime code, no React, no DOM.
//
// docs/reviews/cinematic-transition-runtime/T1-SPEC.md §2 is binding for
// this file: the phase grammar, the `JourneyMachine`/`createJourneyMachine`
// shapes, and `JourneyResolution`/`JourneyDestination` are pinned there.
// `JourneyState`, `JourneyEffect`, `JourneyEvent` and `JourneyClock` are
// this file's own elaboration of the spec's shorthand (e.g. the spec's
// `state(): JourneyState; // { phase, origin, destination, sequence, mode }`
// names five fields for illustration; `tier` is added alongside `mode`
// because spec §5's live readout strip needs it, and every other field
// matches the comment exactly).
//
import type { JourneyPacing } from "./pacing";

// Deliberately NOT imported here: `CxTier` from lib/cxos/capability.ts. That
// module stays the single source of truth for the tier VALUES ("A"|"B"|"C"|
// "D"), but this module is pure-module law (spec §2: "no window, no
// document, no React") and lib/cxos/capability.ts, while itself free of
// React/DOM imports, is still part of the CXOS surface T1 must only
// additive-reuse, never depend on structurally. `JourneyTier` below is the
// SAME four-letter literal union by value, so `detectTier()`'s return type
// is assignable to it with zero cast — the one place that reuse actually
// happens is the adapter (TransitionRuntimeProvider.tsx), exactly where
// spec §4 asks for it.

/**
 * The six phases of a journey. Grammar (spec §2):
 *
 *   settled --request--> intent --begin--> departing --departed--> traveling
 *      ^                   |cancel/Esc         |cancel/Esc             |ready|readyTimeout
 *      +---------------- recovering <--fail-----+                      v
 *      ^                                                            arriving
 *      +----------------------------- arrivalComplete ------------------+
 *
 * `intent` and `recovering` are real phases a subscriber can observe, but
 * neither owns a named pacing duration (pacing.ts has none for either) —
 * both are pass-through states the machine advances out of synchronously,
 * in the same call that entered them (see machine.ts's own header for why).
 */
export type JourneyPhase =
  | "settled"
  | "intent"
  | "departing"
  | "traveling"
  | "arriving"
  | "recovering";

/** A room reference — origin, destination, or the room a journey settles in. Opaque to the machine beyond its fields. */
export interface JourneyDestination {
  id: string;
  href: string;
  label: string;
}

/** `'immediate'` is full citizenship (HELIOS RM law), not a degraded cinematic — see machine.ts's law-7 comment. */
export type JourneyMode = "cinematic" | "immediate";

/** The four CXOS capability tiers, restated by value (see this file's header for why this isn't an import of `CxTier`). */
export type JourneyTier = "A" | "B" | "C" | "D";

/**
 * What an adapter hands `request()`: the already-resolved policy for this
 * journey. The adapter computes this (spec §4: `detectTier()` +
 * `document.hidden`) — the machine only consumes it, though it also
 * independently re-derives `immediate` from `tier` (machine.ts) as a second,
 * defense-in-depth guarantee that reduced motion can never be bypassed by a
 * caller mistake.
 */
export interface JourneyResolution {
  mode: JourneyMode;
  tier: JourneyTier;
}

/**
 * A subscriber's snapshot. `origin`/`destination` describe the current or
 * most recently concluded journey; before any `request()` both are `null`.
 * Once settled, `destination` always names the room actually active — on a
 * normal arrival that is the new room; on a cancel/fail recovery, `machine.ts`
 * collapses `destination` to equal `origin` (nothing ever navigated, so both
 * names the same room). `mode`/`tier` persist at rest (not reset to `null`
 * on settle) so a readout can show what the last journey resolved to.
 */
export interface JourneyState {
  phase: JourneyPhase;
  sequence: number;
  origin: JourneyDestination | null;
  destination: JourneyDestination | null;
  mode: JourneyMode | null;
  tier: JourneyTier | null;
}

/**
 * The one effect T1 needs. A discriminated union of one member so a future
 * wave can add a variant (spec §2's own comment ends the effect line in
 * "etc.") without breaking a consumer that already switches on `type`.
 */
export interface JourneyCommitEffect {
  type: "commit";
  destination: JourneyDestination;
  sequence: number;
}
export type JourneyEffect = JourneyCommitEffect;

export type JourneyEventType =
  | "acknowledged"
  | "departed"
  | "travel"
  | "ready"
  | "arrived"
  | "settled"
  | "cancelled"
  | "ignored"
  | "failed"
  | "recovered";

/** Entering `intent`: the request was accepted (fresh or supersede). */
export interface JourneyAcknowledgedEvent {
  type: "acknowledged";
  sequence: number;
  destination: JourneyDestination;
  resolution: JourneyResolution;
}
/** The `departing` phase concluded (its timer fired) — the room has departed. */
export interface JourneyDepartedEvent {
  type: "departed";
  sequence: number;
}
/** Entering `traveling`: the commit effect has just been sent. */
export interface JourneyTravelEvent {
  type: "travel";
  sequence: number;
}
/** A genuine `ready(sequence)` call was accepted (never fires for a readyTimeoutMs force-advance). */
export interface JourneyReadyEvent {
  type: "ready";
  sequence: number;
}
/** Entering `arriving` — via a real `ready()`, a readyTimeoutMs force, or the same synchronous cascade in immediate mode is skipped for this one (see machine.ts law 7). */
export interface JourneyArrivedEvent {
  type: "arrived";
  sequence: number;
}
/** Reached `settled` via a normal arrival (or the hardCapMs force-arrival) — `room` is always the destination, never null. */
export interface JourneySettledEvent {
  type: "settled";
  sequence: number;
  room: JourneyDestination;
}
/** `cancel()` was accepted pre-commit (`intent`/`departing`). */
export interface JourneyCancelledEvent {
  type: "cancelled";
  sequence: number;
  reason?: string;
}
/** A `request()` arrived post-commit (`traveling`/`arriving`) and was ignored — the in-flight journey is unaffected. */
export interface JourneyIgnoredEvent {
  type: "ignored";
  sequence: number;
  attempted: JourneyDestination;
}
/** `fail()` was accepted (e.g. adapter-detected popstate mid-journey). */
export interface JourneyFailedEvent {
  type: "failed";
  sequence: number;
  reason: string;
}
/** Reached `settled(origin)` after a cancel/fail recovery — `room` is `null` only when the very first-ever journey (origin still unknown) was cancelled before anything settled. */
export interface JourneyRecoveredEvent {
  type: "recovered";
  sequence: number;
  room: JourneyDestination | null;
}

export type JourneyEvent =
  | JourneyAcknowledgedEvent
  | JourneyDepartedEvent
  | JourneyTravelEvent
  | JourneyReadyEvent
  | JourneyArrivedEvent
  | JourneySettledEvent
  | JourneyCancelledEvent
  | JourneyIgnoredEvent
  | JourneyFailedEvent
  | JourneyRecoveredEvent;

/**
 * Injectable timer seam (spec §2: "Date.now only via injected clock (default
 * real)"). Handles are opaque (`unknown`) on purpose: a manual test clock's
 * handles need not be the same type real `setTimeout`/`clearTimeout`
 * produce, and the machine never inspects a handle — it only ever hands one
 * straight back to `clearTimeout`.
 */
export interface JourneyClock {
  setTimeout(handler: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface CreateJourneyMachineOptions {
  /** Injectable for tests; defaults to real `setTimeout`/`clearTimeout`. */
  clock?: JourneyClock;
  /** Shallow override merged on top of `JOURNEY_PACING` (pacing.ts). */
  pacing?: Partial<JourneyPacing>;
  /**
   * T1.2 seeding (fix 6): seeds the machine's initial `destination` — and,
   * transitively, the very first accepted `request()`'s `origin`, since
   * `request()` reads `origin` from `state.destination` whenever the
   * current phase is `settled` (machine.ts). `null`/omitted preserves T1's
   * original behaviour: the machine starts knowing no room at all. The
   * machine is constructed once per adapter instance — this seeds only
   * that one construction, never re-applied later (see
   * TransitionRuntimeProvider.tsx's `initialRoom` prop comment).
   */
  initial?: JourneyDestination | null;
  /** The machine never touches the router itself — this is its only way to ask for one. */
  onEffect: (effect: JourneyEffect) => void;
  /** Optional narration for instrumentation/tests; absent means events are simply not observed, never buffered. */
  onEvent?: (event: JourneyEvent) => void;
}

export interface JourneyMachine {
  /** A stable snapshot reference: only replaced on a real transition, safe as a `useSyncExternalStore` getSnapshot. */
  state(): JourneyState;
  /** Returns `true` when the request became (or superseded into) the current journey; `false` when post-commit-ignored or the machine is destroyed. */
  request(destination: JourneyDestination, resolution: JourneyResolution): boolean;
  /** Destination signals mounted/ready. Edge-triggered and sequence-bound (spec law 8) — see machine.ts. */
  ready(sequence: number): void;
  /** Governed cancel (spec law 4) — a no-op once post-commit. */
  cancel(reason?: string): void;
  /** Adapter-reported failure (e.g. route-change mid-journey) — a no-op once settled/recovering. */
  fail(reason: string): void;
  subscribe(listener: (state: JourneyState) => void): () => void;
  /** Clears every outstanding timer and every listener. Idempotent; safe to call more than once. */
  destroy(): void;
}

// Re-exported so a consumer only needs to import from "./types" for the full
// public contract; the value itself still lives in pacing.ts (single source
// of truth for the shape AND the numbers).
export type { JourneyPacing } from "./pacing";
