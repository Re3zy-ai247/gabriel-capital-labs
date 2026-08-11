"use client";

// Cinematic Transition Runtime — Wave T1
// (components/transition-runtime/TransitionRuntimeProvider.tsx)
//
// The React adapter (spec §4). Owns exactly one `JourneyMachine` instance,
// exposes it through context, and is the ONLY place in T1 that touches the
// router, `document.hidden`, or `popstate` — the pure machine in
// lib/transition-runtime/machine.ts never does.
//
// Two hooks are exported: `useJourney()` is the public, spec-exact surface
// (`{ state, navigate(dest), cancel() }`) meant for room content
// (DemoRoom.tsx, TravelLayer.tsx). `useJourneyMachine()` is the lower-level
// escape hatch onto the raw `JourneyMachine` — RoomReady.tsx needs it for
// `machine.ready(sequence)`, which `useJourney()` deliberately does not
// expose (spec §4 pins useJourney()'s shape to exactly three members).
//
// StrictMode (spec §4, repo runs `reactStrictMode: true`): the machine is
// created lazily in a ref DURING RENDER — React's own documented pattern for
// a one-time expensive object (a double-render's second call sees
// `machineRef.current` already set and skips creation, so this alone never
// constructs two machines).
//
// That is not, by itself, enough to survive the mount's cleanup being
// double-invoked. React's StrictMode dev-only effect dance is a SEPARATE
// mechanism from double-rendering: mount -> run effect -> immediately run
// its cleanup -> immediately run the effect again, all synchronously,
// against the ONE render that already happened — nothing re-renders this
// component in between. If the cleanup destroyed the machine synchronously,
// the context value already handed to children (computed during that one
// render, before any effect ran) would keep pointing at the now-destroyed
// instance forever, since nothing forces a fresh render afterward to hand
// out whatever a naive "recreate on second setup" would produce. Every
// request()/cancel()/fail() on a destroyed machine is a silent no-op by
// design (machine.ts's own `destroyed` guard) — so that failure mode is not
// a crash, it is the entire demo going silently inert in development.
//
// The fix: destruction is deferred through a cancelable microtask.
// `queueMicrotask` is guaranteed to run only after the current synchronous
// job finishes — and StrictMode's cleanup-then-immediate-re-setup is one
// synchronous job. So: cleanup schedules the destroy and arms a flag;
// setup (real OR the StrictMode-synthetic remount) clears that flag first.
// On the synthetic cycle, setup #2 clears the flag before the microtask
// ever runs, so it finds the flag already false and does nothing — the
// ORIGINAL machine, and the context value already handed out, survive
// completely untouched. On a genuine unmount there is no following setup to
// clear the flag, so the microtask proceeds and destroys for real.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { detectTier } from "@/lib/cxos/capability";
import { createJourneyMachine } from "@/lib/transition-runtime/machine";
import { JOURNEY_PACING } from "@/lib/transition-runtime/pacing";
import type {
  JourneyDestination,
  JourneyEffect,
  JourneyMachine,
  JourneyState,
} from "@/lib/transition-runtime/types";

const TransitionRuntimeContext = createContext<JourneyMachine | null>(null);

/**
 * T1.3 — REVIEW-ONLY motion preview (Founder review harness).
 *
 * "system" is byte-for-byte the production resolution path (detectTier() +
 * document.hidden) and is the default everywhere: a provider mounted without
 * the prop behaves exactly as before T1.3. "full" / "reduced" exist so the
 * Founder — whose Mac keeps OS Reduce Motion ON for memory headroom — can
 * preview either path from the review harness without touching the OS
 * setting. Safety boundary, in order: (1) this provider has ZERO production
 * consumers — only app/review/transition-runtime/layout.tsx mounts it;
 * (2) that segment 404s in production via the existing reviewBuildAllowed()
 * gate; (3) production motion detection (lib/cxos/capability.ts) is
 * untouched; (4) the machine's own law-7 backstop is intact — "full" works
 * by RESOLVING tier A/B at this review adapter (exactly what the Playwright
 * evidence harness does via reducedMotion:'no-preference' emulation), never
 * by weakening the C/D→immediate forcing inside machine.ts. Precedent: the
 * CXOS review surfaces' own consent overrides (Agency HQ
 * reducedMotionOverride, Passage confirmReducedCinematic()).
 */
export type MotionPreviewMode = "system" | "full" | "reduced";
const MotionPreviewContext = createContext<MotionPreviewMode>("system");

// Outer, adapter-owned safety net (TransitionShell law — see this repo's
// components/cxos/transitions/TransitionShell.tsx for the production
// precedent: an unconditional `location.assign` fail-open clock measured
// from the click). This is DELIBERATELY separate from, not a rewiring of,
// the pure machine's own hardCapMs force-settle: that guarantees the
// MACHINE's internal state resolves; it has zero visibility into whether
// `router.push()` actually landed (the machine never touches the router at
// all). This timer independently verifies the BROWSER's real location and
// only ever forces a hard navigation when that verification fails — so a
// merely-slow-but-eventually-successful App Router push is never punished
// with a jarring unnecessary full-page reload. The margin keeps the
// machine's own resolution first in line; this is truly the last resort.
const ROUTER_VERIFY_MARGIN_MS = 200;
const ROUTER_VERIFY_MS = JOURNEY_PACING.hardCapMs + ROUTER_VERIFY_MARGIN_MS;

function hasReachedHref(href: string): boolean {
  try {
    const target = new URL(href, window.location.href);
    return (
      window.location.pathname === target.pathname &&
      window.location.search === target.search
    );
  } catch {
    // An unparsable href can't be verified — fail open toward forcing
    // navigation rather than silently trusting an unreachable destination.
    return false;
  }
}

export function TransitionRuntimeProvider({
  children,
  initialRoom,
  motionPreview = "system",
}: {
  children: ReactNode;
  /**
   * T1.2 seeding (fix 6): seeds the ONE machine this provider ever
   * constructs (see `ensureMachine` below — its deps are deliberately
   * `[]`). A later render passing a DIFFERENT `initialRoom` is
   * intentionally ignored: this only ever seeds construction, it is never
   * re-read afterward. `undefined` seeds nothing (machine.ts's `initial`
   * defaults to `null`) — the original T1 behaviour.
   */
  initialRoom?: JourneyDestination;
  /**
   * T1.3 — review-only motion preview; see MotionPreviewMode above. Unlike
   * `initialRoom`, this IS live-reactive: the review harness toggles it at
   * runtime and the next navigate() resolves under the new mode.
   */
  motionPreview?: MotionPreviewMode;
}) {
  const router = useRouter();
  // Read fresh on every render so the onEffect closure below (created once,
  // at machine-construction time) always pushes through the CURRENT router
  // instance rather than one captured at that first render.
  const routerRef = useRef(router);
  routerRef.current = router;

  const machineRef = useRef<JourneyMachine | null>(null);
  const verifyTimerRef = useRef<number | null>(null);
  // See this file's header: true while a destroy is queued but not yet run.
  const destroyPendingRef = useRef(false);

  const ensureMachine = useCallback((): JourneyMachine => {
    // Any call — render or effect setup — means the machine is still
    // wanted: cancel whatever destroy a preceding cleanup may have queued.
    destroyPendingRef.current = false;
    if (machineRef.current !== null) return machineRef.current;
    const machine = createJourneyMachine({
      // Fix 6: seeds this ONE construction from whatever `initialRoom` the
      // render that first called ensureMachine() closed over. This
      // callback's deps are `[]` (below) precisely so a later `initialRoom`
      // prop change is never re-read — the machine, once created, owns its
      // own state from then on.
      initial: initialRoom ?? null,
      onEffect: (effect: JourneyEffect) => {
        if (effect.type !== "commit") return;
        const destination = effect.destination;
        const commitSequence = effect.sequence;
        if (verifyTimerRef.current !== null) {
          window.clearTimeout(verifyTimerRef.current);
          verifyTimerRef.current = null;
        }
        // T1.3 hardening (found live): the pre-push location, captured so the
        // verify callback can distinguish "the push never went anywhere" from
        // "SOMETHING navigated" — including navigations this adapter never
        // sees: an ignored post-commit request falling through to its real
        // <Link> (fix 7's fallthrough) is a genuine client navigation that is
        // neither a popstate nor a new commit, and before this predicate the
        // timer treated it as a failed push and force-reloaded the browser
        // out of the user's own chosen destination.
        const prePushLocation = window.location.pathname + window.location.search;
        routerRef.current.push(destination.href);
        verifyTimerRef.current = window.setTimeout(() => {
          verifyTimerRef.current = null;
          // Fix 1c: the machine may have moved on since this timer was
          // armed — superseded by a newer request(), or resolved via
          // cancel/fail/hard-cap. Comparing the CURRENT machine sequence
          // against the sequence this commit belonged to keeps this timer
          // scoped to only the one journey it was ever verifying; a stale
          // timer for an abandoned journey must never force-navigate a
          // browser that has since moved on to somewhere else entirely.
          const current = machineRef.current;
          if (!current || current.state().sequence !== commitSequence) return;
          // The assign is only for a push that NEVER moved the browser: if
          // the location differs from the pre-push snapshot at all, either
          // our push landed (hasReachedHref would pass anyway) or the user
          // navigated somewhere else on purpose — their navigation wins,
          // never this timer.
          const here = window.location.pathname + window.location.search;
          if (here !== prePushLocation) return;
          if (!hasReachedHref(destination.href)) {
            window.location.assign(destination.href);
          }
        }, ROUTER_VERIFY_MS);
      },
      // Fix 1a: governed abandonment (cancel pre-commit, or fail/recovery
      // post-commit) must never let a still-armed router-verify timer force
      // the browser to the destination anyway — abandoning the journey has
      // to actually mean abandoning it. `cancel()` is pre-commit only, so
      // in practice only `failed`/`recovered` ever find a timer armed here,
      // but all three are cleared defensively (idempotent no-op if already
      // clear).
      onEvent: (event) => {
        if (
          event.type === "cancelled" ||
          event.type === "failed" ||
          event.type === "recovered"
        ) {
          if (verifyTimerRef.current !== null) {
            window.clearTimeout(verifyTimerRef.current);
            verifyTimerRef.current = null;
          }
        }
      },
    });
    machineRef.current = machine;
    return machine;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberate: `initialRoom` only ever seeds THIS one machine construction (see the `initial:` comment above); a later prop change must never re-seed an already-constructed machine.
  }, []);

  // Render-time lazy init — see this file's header for why the effect below
  // also calls ensureMachine() rather than relying on this alone.
  const machine = ensureMachine();

  useEffect(() => {
    const active = ensureMachine();

    const onPopState = () => {
      // Fix 1b: a user-initiated navigation (back/forward) ALWAYS
      // supersedes the router-verify fallback — clear it first,
      // unconditionally, before any phase logic below. A settled no-op or
      // a governed cancel/fail must never leave a stale verify timer armed
      // to force-navigate the browser somewhere else later.
      if (verifyTimerRef.current !== null) {
        window.clearTimeout(verifyTimerRef.current);
        verifyTimerRef.current = null;
      }

      // Fix 2: pre-commit (intent/departing) -> governed cancel — nothing
      // has navigated yet, so this is exactly the same governed abandonment
      // Escape already performs (spec law 4), just triggered by the browser
      // instead of the keyboard. Post-commit (traveling/arriving) -> fail,
      // as before (the router has already been asked to navigate at the
      // departing->traveling boundary — spec §2 law 2). Settled: nothing
      // further to do beyond the timer clear above.
      const phase = active.state().phase;
      if (phase === "intent" || phase === "departing") {
        active.cancel("route-change");
      } else if (phase === "traveling" || phase === "arriving") {
        active.fail("route-change");
      }
    };
    window.addEventListener("popstate", onPopState);

    return () => {
      window.removeEventListener("popstate", onPopState);
      destroyPendingRef.current = true;
      queueMicrotask(() => {
        if (!destroyPendingRef.current) return; // cancelled by a following setup — see header
        if (verifyTimerRef.current !== null) {
          window.clearTimeout(verifyTimerRef.current);
          verifyTimerRef.current = null;
        }
        active.destroy();
        if (machineRef.current === active) machineRef.current = null;
      });
    };
  }, [ensureMachine]);

  return (
    <TransitionRuntimeContext.Provider value={machine}>
      <MotionPreviewContext.Provider value={motionPreview}>
        {children}
      </MotionPreviewContext.Provider>
    </TransitionRuntimeContext.Provider>
  );
}

/** Lower-level: the raw machine. Prefer `useJourney()` unless you specifically need `.ready()` (RoomReady) or another method `useJourney()` doesn't expose. */
export function useJourneyMachine(): JourneyMachine {
  const machine = useContext(TransitionRuntimeContext);
  if (!machine) {
    throw new Error(
      "useJourneyMachine() was called outside a <TransitionRuntimeProvider>.",
    );
  }
  return machine;
}

/**
 * T2 — ADDITIVE ONLY (T2-SPEC.md §1/§8, the sole permitted change to this
 * otherwise-frozen T1 file). Same context read as `useJourneyMachine()`,
 * but never throws: outside a provider (or a provider that hasn't mounted
 * yet) this returns `null` instead. Built for consumers that exist both
 * INSIDE the persistent shell (where a `<TransitionRuntimeProvider>` always
 * wraps them) and OUTSIDE it — Sidebar.tsx is mounted by admin's own
 * AppShell with no provider in the tree at all, and it must render exactly
 * today's plain links there, zero behavior change, rather than crash.
 */
export function useOptionalJourneyMachine(): JourneyMachine | null {
  return useContext(TransitionRuntimeContext);
}

/**
 * The public hook (spec §4): `{ state, navigate(dest), cancel() }`.
 * Fix 3/4: `navigate()` now returns the boolean `machine.request()` itself
 * returns (`true` = accepted/superseded the journey, `false` = post-commit
 * ignored, destroyed, or the fix-3 self-nav guard below) — the ONLY signal
 * a caller (DemoRoom's onClick) needs to decide whether to `preventDefault`
 * the underlying real `<Link>` or let it fall through (fail-open,
 * TransitionShell law).
 */
export function useJourney(): {
  state: JourneyState;
  navigate: (destination: JourneyDestination) => boolean;
  cancel: () => void;
} {
  const machine = useJourneyMachine();
  const motionPreview = useContext(MotionPreviewContext);
  const state = useSyncExternalStore(machine.subscribe, machine.state, machine.state);

  const navigate = useCallback(
    (destination: JourneyDestination): boolean => {
      // Fix 3 (self-nav guard, belt to DemoRoom's own isCurrent check):
      // a destination whose pathname already equals the current location
      // must never start a journey — self-navigation is not a request to
      // travel anywhere. Comparing pathnames only (not search/hash)
      // matches this runtime's own `hasReachedHref` verification scope.
      try {
        const targetPathname = new URL(destination.href, window.location.href).pathname;
        if (targetPathname === window.location.pathname) return false;
      } catch {
        // An unparsable href can't be guarded here — fall through and let
        // request()/the router surface whatever is actually wrong with it.
      }
      // T1.3 review-only preview branches (see MotionPreviewMode). A hidden
      // document forces immediate in EVERY mode — animating an invisible
      // journey serves no one, preview included.
      if (motionPreview === "full") {
        // The same resolution the Playwright evidence harness produces under
        // reducedMotion:'no-preference' emulation: tier by viewport band
        // (detectTier's own 768px breakpoint), never C/D — so the machine's
        // law-7 backstop stays fully intact and untouched.
        const tier = window.matchMedia("(max-width: 768px)").matches ? "B" : "A";
        const mode = document.hidden ? "immediate" : "cinematic";
        return machine.request(destination, { mode, tier });
      }
      if (motionPreview === "reduced") {
        // Explicit accessibility-path preview: the production reduced-motion
        // contract (tier D → deterministic INTENT → DESTINATION → ACTIVE).
        return machine.request(destination, { mode: "immediate", tier: "D" });
      }
      // "system" — byte-for-byte the production path (spec §4): tier via
      // detectTier() (additive reuse — lib/cxos/capability.ts is never
      // modified), immediate for tier C/D or a hidden document.
      const tier = detectTier();
      const mode = tier === "C" || tier === "D" || document.hidden ? "immediate" : "cinematic";
      return machine.request(destination, { mode, tier });
    },
    [machine, motionPreview],
  );

  const cancel = useCallback(() => {
    machine.cancel();
  }, [machine]);

  return useMemo(() => ({ state, navigate, cancel }), [state, navigate, cancel]);
}
