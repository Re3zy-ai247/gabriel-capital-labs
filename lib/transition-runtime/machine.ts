// Cinematic Transition Runtime — Wave T1 (lib/transition-runtime/machine.ts)
//
// The pure journey state machine. docs/reviews/cinematic-transition-runtime/
// T1-SPEC.md §2 is BINDING here: the phase grammar, the eight numbered laws,
// and the `createJourneyMachine`/`JourneyMachine` API shape. This file
// implements every law; each is called out by number at its enforcement
// point below rather than restated in full (read spec §2 alongside this
// file). Zero React, DOM, or `next/*` imports — `globalThis.setTimeout`/
// `clearTimeout` (never `window.*`) back the default clock so this module
// never assumes a browser exists, only that a clock does.
//
// TWO PHASES ARE INSTANT BY DESIGN: `intent` and `recovering` own no pacing
// duration (pacing.ts has none for either) and are never rendered by
// TravelLayer. `request()` walks settled/recovering straight through
// `intent` into either `departing` (cinematic) or `settled` (immediate) —
// and `cancel()`/`fail()` walk straight through `recovering` into
// `settled(origin)` — all synchronously, inside the one call that triggered
// it. Both are still genuinely entered and exited (a synchronous
// `subscribe()` listener observes them as their own notification), matching
// the Founder-grammar mapping in spec §2 exactly; they simply never wait on
// a timer to leave.
//
// REENTRANCY: `onEffect` and `onEvent` are caller-supplied callbacks invoked
// synchronously from inside a transition. A caller (a test, or a future
// consumer) is free to call back into the machine — request()/cancel()/
// fail()/destroy() — from inside one of those callbacks. Two defenses make
// that safe rather than corrupting: (1) `commitOnce` — the one function that
// produces the hard-to-undo effect — independently re-checks that this
// sequence is still current and still active immediately before firing, no
// matter which call path reached it; (2) every multi-step cascade
// (`request`, `onDepartingTimer`, `tryAdvanceToArriving`) re-checks both
// sequence AND the phase it just set after every `emitEvent` call, since a
// reentrant `cancel()`/`fail()` resolves without bumping `sequence` (only
// `request()` does — spec law 1) and so would not be caught by a
// sequence-only check.
import type {
  CreateJourneyMachineOptions,
  JourneyClock,
  JourneyDestination,
  JourneyEvent,
  JourneyMachine,
  JourneyPhase,
  JourneyResolution,
  JourneyState,
  JourneyTier,
} from "./types";
import { JOURNEY_PACING, type JourneyPacing } from "./pacing";

// The default clock — used whenever a caller doesn't inject one (spec §2:
// "Date.now only via injected clock (default real)"; the same seam covers
// setTimeout/clearTimeout, the only timer primitives this file uses).
// `globalThis`, not `window`: this keeps the module runnable anywhere a
// `setTimeout`-shaped global exists, not only inside a DOM. Handles are
// threaded through as `unknown` (see JourneyClock in types.ts) and only ever
// handed back to this same clock's own `clearTimeout` — never inspected.
function createRealClock(): JourneyClock {
  return {
    setTimeout: (handler, ms) => globalThis.setTimeout(handler, ms),
    clearTimeout: (handle) =>
      globalThis.clearTimeout(handle as Parameters<typeof globalThis.clearTimeout>[0]),
  };
}

// Only A/B ever reach a timed phase: tier C/D always resolves to
// `immediate` (law 7), which never arms departing/travelMin/arriving. Any
// non-"A" tier defensively selects the shorter B band rather than throwing —
// this is only ever exercised on "A" | "B" in practice.
function resolveBand(tier: JourneyTier): "A" | "B" {
  return tier === "A" ? "A" : "B";
}

export function createJourneyMachine(
  options: CreateJourneyMachineOptions,
): JourneyMachine {
  const clock = options.clock ?? createRealClock();
  const pacing: JourneyPacing = { ...JOURNEY_PACING, ...options.pacing };
  const onEffect = options.onEffect;
  const onEvent = options.onEvent;

  // Fix 6 (seeding): `options.initial` seeds ONLY `destination` here — never
  // `origin`. `origin` stays `null` until a real journey is accepted, at
  // which point `request()`'s existing settled-phase branch
  // (`origin = stillAtOrigin ? state.origin : state.destination`) reads
  // this seeded `destination` as that first journey's `origin`, with no
  // special-casing needed in `request()` itself.
  const initialState: JourneyState = {
    phase: "settled",
    sequence: 0,
    origin: null,
    destination: options.initial ?? null,
    mode: null,
    tier: null,
  };

  let state: JourneyState = initialState;
  let destroyed = false;
  const listeners = new Set<(state: JourneyState) => void>();

  // Per-journey (per-sequence) bookkeeping. Reset at the top of every
  // accepted request(); only ever read by callbacks tagged with that same
  // sequence, so a superseded sequence's stale callback finds these already
  // overwritten by whatever came after it and bails via stale() first.
  let committedForSequence = false;
  let minHoldElapsed = false;
  let readySignaled = false;

  // Every named timer a journey can own. At most one instance of each is
  // ever armed; clearAllTimers() is the single place all five are cleared
  // together (destroy, cancel, fail, and the top of every accepted
  // request()) — each timer's own callback additionally nulls itself out on
  // entry, before doing anything else, so a timer can never fire twice.
  let departingTimer: unknown = null;
  let travelMinTimer: unknown = null;
  let readyTimeoutTimer: unknown = null;
  let arrivingTimer: unknown = null;
  let hardCapTimer: unknown = null;

  function stale(sequence: number): boolean {
    return destroyed || state.sequence !== sequence;
  }

  // A deliberate function-call boundary, not a stylistic alias for
  // `state.phase`. TypeScript's control-flow narrowing tracks repeated
  // reads of `state.phase` across statements as if `state` could not have
  // changed in between — but it has no visibility into `setState`/
  // `commitOnce`/`emitEvent` (all defined elsewhere, and `emitEvent` calls
  // an arbitrary caller-supplied callback) reassigning the closured `state`
  // variable, including reentrantly. Left as direct `state.phase` reads,
  // every post-callback re-check in this file would get narrowed against
  // stale, pre-callback type information and either type-error as
  // "no overlap" or — worse — silently stop being a real re-check at all.
  // Routing every such read through this call breaks that narrowing outright:
  // a function call's return type is whatever it's declared, never inherited
  // from an earlier comparison of the expression inside it.
  function currentPhase(): JourneyPhase {
    return state.phase;
  }

  function notify(): void {
    listeners.forEach((listener) => listener(state));
  }

  function setState(patch: Partial<JourneyState>): void {
    // A fresh object identity on every real transition, and ONLY then —
    // this is what lets state() double as a useSyncExternalStore
    // getSnapshot without ever causing an infinite render loop.
    state = { ...state, ...patch };
    notify();
  }

  function emitEvent(event: JourneyEvent): void {
    onEvent?.(event);
  }

  function clearAllTimers(): void {
    if (departingTimer !== null) {
      clock.clearTimeout(departingTimer);
      departingTimer = null;
    }
    if (travelMinTimer !== null) {
      clock.clearTimeout(travelMinTimer);
      travelMinTimer = null;
    }
    if (readyTimeoutTimer !== null) {
      clock.clearTimeout(readyTimeoutTimer);
      readyTimeoutTimer = null;
    }
    if (arrivingTimer !== null) {
      clock.clearTimeout(arrivingTimer);
      arrivingTimer = null;
    }
    if (hardCapTimer !== null) {
      clock.clearTimeout(hardCapTimer);
      hardCapTimer = null;
    }
  }

  // The one function that produces the hard-to-undo effect. Guarded twice:
  // `committedForSequence` keeps it to exactly once per sequence (law 2 /
  // spec test 15); the sequence + phase check immediately below is the
  // reentrancy backstop (see this file's header) — if a caller's onEvent
  // callback reentrantly cancelled/failed this exact journey before its own
  // cascade reached commitOnce, the journey is already over and no commit
  // may fire, no matter which code path arrives here.
  function commitOnce(sequence: number, destination: JourneyDestination): void {
    if (committedForSequence) return;
    if (state.sequence !== sequence) return;
    if (state.phase === "settled" || state.phase === "recovering") return;
    committedForSequence = true;
    onEffect({ type: "commit", destination, sequence });
  }

  function armHardCap(sequence: number, destination: JourneyDestination): void {
    hardCapTimer = clock.setTimeout(
      () => onHardCap(sequence, destination),
      pacing.hardCapMs,
    );
  }

  // Law 6 (second half): force-settles from ANY non-settled phase, at
  // hardCapMs from acceptance, no matter what got stuck. Always resolves
  // toward the destination (never abandons back to origin) — a hard cap
  // that could strand the user at neither endpoint would defeat its own
  // purpose. Skips straight to `settled`, synthesizing no departed/travel/
  // arrived events for phases that, from the caller's perspective, never
  // meaningfully happened — the same honesty immediate mode already
  // practices (law 7).
  function onHardCap(sequence: number, destination: JourneyDestination): void {
    if (stale(sequence)) return;
    if (currentPhase() === "settled" || currentPhase() === "recovering") return;
    clearAllTimers();
    commitOnce(sequence, destination);
    if (stale(sequence) || currentPhase() === "settled" || currentPhase() === "recovering") {
      return;
    }
    setState({ phase: "settled", destination });
    emitEvent({ type: "settled", sequence, room: destination });
  }

  // departing -> traveling (spec grammar's "departed" edge). Route commits
  // exactly here (law 2): entry-to-traveling, once per journey.
  function onDepartingTimer(sequence: number): void {
    if (stale(sequence) || currentPhase() !== "departing") return;
    departingTimer = null;

    emitEvent({ type: "departed", sequence });
    // A reentrant cancel()/fail() inside the emit above resolves without
    // bumping `sequence` (only request() does) — the phase check is what
    // catches that case; see this file's header.
    if (stale(sequence) || currentPhase() !== "departing") return;

    const destination = state.destination;
    if (!destination) return; // unreachable: departing always carries a destination
    commitOnce(sequence, destination);
    if (stale(sequence) || currentPhase() !== "departing") return;

    setState({ phase: "traveling" });
    emitEvent({ type: "travel", sequence });
    if (stale(sequence) || currentPhase() !== "traveling") return;

    minHoldElapsed = false;
    readySignaled = false;
    const band = resolveBand(state.tier ?? "B");
    travelMinTimer = clock.setTimeout(
      () => onTravelMinTimer(sequence),
      pacing.travelMinMs[band],
    );
    readyTimeoutTimer = clock.setTimeout(
      () => onReadyTimeout(sequence),
      pacing.readyTimeoutMs,
    );
  }

  // traveling -> arriving. Gated on BOTH conditions together (whichever
  // settles last wins): the travelMinMs floor (no blank flash on a
  // lightning-fast ready) and readiness itself (real ready() or the
  // readyTimeoutMs fallback) — law 6 (first half) + the travelMinMs floor
  // from pacing.ts.
  function tryAdvanceToArriving(sequence: number): void {
    if (stale(sequence) || state.phase !== "traveling") return;
    if (!minHoldElapsed || !readySignaled) return;

    if (travelMinTimer !== null) {
      clock.clearTimeout(travelMinTimer);
      travelMinTimer = null;
    }
    if (readyTimeoutTimer !== null) {
      clock.clearTimeout(readyTimeoutTimer);
      readyTimeoutTimer = null;
    }

    setState({ phase: "arriving" });
    emitEvent({ type: "arrived", sequence });
    if (stale(sequence) || currentPhase() !== "arriving") return;

    const band = resolveBand(state.tier ?? "B");
    arrivingTimer = clock.setTimeout(
      () => onArrivingTimer(sequence),
      pacing.arrivingMs[band],
    );
  }

  function onTravelMinTimer(sequence: number): void {
    if (stale(sequence) || state.phase !== "traveling") return;
    travelMinTimer = null;
    minHoldElapsed = true;
    tryAdvanceToArriving(sequence);
  }

  // Fail-open (law 6, first half): destination never called ready() within
  // readyTimeoutMs. No `ready` event fires — this signal never really
  // arrived (law 8) — but readiness is still marked resolved so
  // tryAdvanceToArriving can proceed once the travelMinMs floor also clears.
  function onReadyTimeout(sequence: number): void {
    if (stale(sequence) || state.phase !== "traveling") return;
    readyTimeoutTimer = null;
    readySignaled = true;
    tryAdvanceToArriving(sequence);
  }

  // arriving -> settled(destination): the "arrivalComplete" edge.
  function onArrivingTimer(sequence: number): void {
    if (stale(sequence) || state.phase !== "arriving") return;
    arrivingTimer = null;
    if (hardCapTimer !== null) {
      clock.clearTimeout(hardCapTimer);
      hardCapTimer = null;
    }
    const destination = state.destination;
    if (!destination) return; // unreachable: arriving always carries a destination
    setState({ phase: "settled" });
    emitEvent({ type: "settled", sequence, room: destination });
  }

  // recovering -> settled(origin), shared by cancel() and fail(). Nothing
  // ever navigated on this path, so `destination` collapses to equal
  // `origin` (see types.ts's JourneyState doc): both now name the one room
  // that was, and still is, active.
  function recoverToOrigin(sequence: number): void {
    setState({ phase: "recovering" });
    if (stale(sequence)) return;
    const room = state.origin;
    setState({ phase: "settled", destination: room });
    emitEvent({ type: "recovered", sequence, room });
  }

  function request(
    destination: JourneyDestination,
    resolution: JourneyResolution,
  ): boolean {
    if (destroyed) return false;
    const phase = currentPhase();

    // Law 3, second half: post-commit, a new request() is ignored — the
    // in-flight journey is unaffected. Recorded, never blocked (spec §2's
    // own framing: "No input is ever blocked to achieve safety").
    if (phase === "traveling" || phase === "arriving") {
      emitEvent({ type: "ignored", sequence: state.sequence, attempted: destination });
      return false;
    }

    clearAllTimers();

    // Law 3, first half: pre-commit (intent/departing) supersedes, restarting
    // from intent — nothing has navigated yet, so the room to depart FROM is
    // still whatever `origin` already was. `recovering` gets the same
    // treatment: a request() landing in that fleeting window (only reachable
    // via reentrancy — see this file's header) is likewise still physically
    // at `origin`, not the target `recovering` was about to abandon.
    // Anything else (`settled`) is a genuinely fresh journey, departing from
    // the room the machine last knew it settled in.
    const stillAtOrigin =
      phase === "intent" || phase === "departing" || phase === "recovering";
    const origin = stillAtOrigin ? state.origin : state.destination;

    const sequence = state.sequence + 1;
    // Law 7, defense in depth: `immediate` is forced whenever the tier is
    // C/D, regardless of what `resolution.mode` claims — reduced motion (or
    // an adapter bug) can never be bypassed at the machine boundary.
    const mode: JourneyResolution["mode"] =
      resolution.mode === "immediate" ||
      resolution.tier === "C" ||
      resolution.tier === "D"
        ? "immediate"
        : "cinematic";

    committedForSequence = false;

    setState({
      phase: "intent",
      sequence,
      origin,
      destination,
      mode,
      tier: resolution.tier,
    });
    emitEvent({
      type: "acknowledged",
      sequence,
      destination,
      resolution: { mode, tier: resolution.tier },
    });
    // The request WAS accepted the instant it was set above — `true` is
    // correct even if a reentrant call (from inside the emit, or from a
    // subscribe() listener woken by the setState before it) has already
    // moved the machine on by the time control returns here.
    if (stale(sequence) || currentPhase() !== "intent") return true;

    armHardCap(sequence, destination);
    if (stale(sequence) || currentPhase() !== "intent") return true;

    if (mode === "immediate") {
      // Law 7: intent -> commit -> settled(destination). No departing/
      // traveling/arriving phase, no veil, no synthesized events for phases
      // that never happened.
      commitOnce(sequence, destination);
      if (stale(sequence) || currentPhase() !== "intent") return true;
      if (hardCapTimer !== null) {
        clock.clearTimeout(hardCapTimer);
        hardCapTimer = null;
      }
      setState({ phase: "settled" });
      emitEvent({ type: "settled", sequence, room: destination });
      return true;
    }

    setState({ phase: "departing" });
    const band = resolveBand(resolution.tier);
    departingTimer = clock.setTimeout(
      () => onDepartingTimer(sequence),
      pacing.departingMs[band],
    );
    return true;
  }

  // Law 8: edge-triggered and sequence-bound. Stale (wrong sequence), too
  // early (before traveling), too late (after a force-arrival already
  // resolved readiness), and duplicate calls are all silent no-ops.
  function ready(sequence: number): void {
    if (destroyed) return;
    if (sequence !== state.sequence) return;
    if (state.phase !== "traveling") return;
    if (readySignaled) return;
    if (readyTimeoutTimer !== null) {
      clock.clearTimeout(readyTimeoutTimer);
      readyTimeoutTimer = null;
    }
    readySignaled = true;
    emitEvent({ type: "ready", sequence });
    tryAdvanceToArriving(sequence);
  }

  // Law 4: governed cancel, valid only pre-commit. Post-commit (traveling/
  // arriving), already-settled, or already-recovering: a no-op ("the return
  // journey is a new journey").
  function cancel(reason?: string): void {
    if (destroyed) return;
    const phase = state.phase;
    if (phase !== "intent" && phase !== "departing") return;
    clearAllTimers();
    const sequence = state.sequence;
    emitEvent({ type: "cancelled", sequence, reason });
    if (stale(sequence)) return;
    recoverToOrigin(sequence);
  }

  // Adapter-reported failure (e.g. popstate mid-journey — law 4's last
  // sentence). Valid in any active phase; a no-op once settled/recovering
  // (nothing left to fail).
  function fail(reason: string): void {
    if (destroyed) return;
    const phase = state.phase;
    if (phase === "settled" || phase === "recovering") return;
    clearAllTimers();
    const sequence = state.sequence;
    emitEvent({ type: "failed", sequence, reason });
    if (stale(sequence)) return;
    recoverToOrigin(sequence);
  }

  function subscribe(listener: (state: JourneyState) => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  // Law 5: after destroy(), zero timers remain. Idempotent — safe to call
  // more than once (StrictMode double-unmount, or a caller being careful).
  function destroy(): void {
    if (destroyed) return;
    clearAllTimers();
    destroyed = true;
    listeners.clear();
  }

  return {
    state: () => state,
    request,
    ready,
    cancel,
    fail,
    subscribe,
    destroy,
  };
}
