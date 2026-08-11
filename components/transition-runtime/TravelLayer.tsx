"use client";

// Cinematic Transition Runtime — Wave T1
// (components/transition-runtime/TravelLayer.tsx)
//
// The persistent veil layer (spec §4). Two independent pieces share one
// component because they share one trigger (the machine's phase):
//
//   1. An always-mounted, visually-hidden `aria-live="polite"` announcer —
//      it must keep existing even after the veil itself unmounts, so a
//      settle announcement (fired exactly when phase reaches `settled`) is
//      never lost to its own host disappearing.
//   2. The veil itself: a fixed opacity-only overlay, rendered ONLY for
//      departing/traveling/arriving (spec §4) — `intent`/`recovering`/
//      `settled` render nothing here at all.
//
// Reduced motion needs no guard in this file: tier C/D (and a hidden
// document) resolve to `immediate` mode at the machine boundary (spec law
// 7, enforced in machine.ts even if a caller's resolution disagreed) — an
// immediate journey never enters departing/traveling/arriving, so this
// component's veil branch is simply never reached under reduced motion.
// "Reduced motion is full citizenship" (HELIOS RM law) — state still
// changes, just with no veil to skip.
import { useEffect, useRef, useState } from "react";
import { JOURNEY_PACING } from "@/lib/transition-runtime/pacing";
import type { JourneyPhase } from "@/lib/transition-runtime/types";
import { useJourney, useJourneyMachine } from "./TransitionRuntimeProvider";

// brand.ink (tailwind.config.ts) — the fixed near-black navy already used
// project-wide for anything that must read correctly in both themes. Spec
// §4: "opacity-only skeleton veil (near-black, brand ink)."
const VEIL_BACKGROUND = "#04121b";
const VEIL_Z_INDEX = 2000;

// Fix 8 (a11y): the ownership marker this component stamps on every
// top-level `<main>` it inerts while traveling — see the effect below.
const INERT_MARKER_ATTR = "data-trt-inert";

const VEIL_KEYFRAMES = `
@keyframes trt-veil-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes trt-veil-out { from { opacity: 1; } to { opacity: 0; } }
`;

// "Top-level" `<main>`: not nested inside another `<main>` this same query
// also found. T1's demo only ever has one `<main>` live at a time, but this
// keeps the selector honest about what "top-level" means rather than
// silently assuming a flat document.
function getTopLevelMains(): HTMLElement[] {
  const mains = Array.from(document.querySelectorAll<HTMLElement>("main"));
  return mains.filter((el) => !mains.some((other) => other !== el && other.contains(el)));
}

// T2.2 FIX 1: keyboard-inert SCOPE resolution. The product shell
// (components/shell/RoomsShell.tsx) marks its ShellBody outer div — the
// WHOLE chrome+main tree (Sidebar, header, banners, main#main, KaiPresence,
// MobileNav) — with `data-journey-inert-scope`, because a keyboard/AT user
// mid-travel must not be able to reach the persistent Sidebar or MobileNav
// either, not just the old room's `<main>`. TravelLayer's own veil overlay
// and the always-mounted announcer are siblings OUTSIDE that marked div (see
// RoomsShell.tsx), so they are never matched here and can never be inerted.
// When no marked scope exists — the T1 review demo, which carries no marker
// at all — this falls back to the original T1 top-level-`<main>` resolution
// unchanged, so the demo segment's behavior is untouched by this amendment.
function getInertScope(): HTMLElement[] {
  const marked = Array.from(document.querySelectorAll<HTMLElement>("[data-journey-inert-scope]"));
  if (marked.length > 0) return marked;
  return getTopLevelMains();
}

export function TravelLayer() {
  const machine = useJourneyMachine();
  const { state, cancel } = useJourney();
  const { phase, sequence, destination, mode, origin } = state;

  const [announcement, setAnnouncement] = useState("");
  // Per-sequence idempotency: each announcement kind fires at most once per
  // sequence (spec §4), even across a StrictMode double-render/double-effect.
  const travelAnnouncedRef = useRef<number | null>(null);
  const settledAnnouncedRef = useRef<number | null>(null);

  // Fix 7: raw, render-independent phase tracking. `cancel()`/`fail()` ->
  // `recoverToOrigin()` (machine.ts) sets phase to "recovering" and then to
  // "settled" via two synchronous `setState` calls in the SAME call stack —
  // React 18's automatic batching coalesces those into a single render that
  // only ever shows the FINAL phase, so a ref updated from inside a React
  // effect (which only runs post-render) would never observe "recovering"
  // as a distinct value at all. Subscribing here bypasses React's render
  // cycle entirely: `machine.subscribe`'s callback fires synchronously on
  // EVERY machine `notify()`, in the exact order the machine emits them —
  // independent of whatever React later chooses to actually render — so
  // `previousPhaseRef` always holds the true phase immediately preceding
  // whichever phase the announce effect below is reacting to.
  const lastSeenPhaseRef = useRef<JourneyPhase>(phase);
  const previousPhaseRef = useRef<JourneyPhase>(phase);
  useEffect(() => {
    return machine.subscribe((s) => {
      previousPhaseRef.current = lastSeenPhaseRef.current;
      lastSeenPhaseRef.current = s.phase;
    });
  }, [machine]);

  useEffect(() => {
    if (phase === "traveling" && travelAnnouncedRef.current !== sequence) {
      travelAnnouncedRef.current = sequence;
      setAnnouncement(`Traveling to ${destination?.label ?? "the next room"}`);
      return;
    }

    // sequence > 0 excludes the machine's initial, pre-any-journey rest
    // state from ever announcing on settle — there is nothing to report yet.
    if (
      phase === "settled" &&
      sequence > 0 &&
      settledAnnouncedRef.current !== sequence
    ) {
      settledAnnouncedRef.current = sequence;
      const previousPhase = previousPhaseRef.current;

      // Fix 7 (a): a genuine arrival — natural (arrivingMs elapsed) OR
      // hard-cap-DURING-arriving. Both are safe to announce/focus: reaching
      // "arriving" at all already required a real `ready()` (or the
      // readyTimeoutMs fallback), so the destination room's DOM already
      // exists by the time either path lands here.
      if (previousPhase === "arriving") {
        // T2.2 FIX 2: location-gated arrival. The machine's own `settled`
        // phase is not itself proof the browser is actually AT the
        // destination URL — a mid-journey Back/Forward, a manual address-bar
        // edit, or any other out-of-band navigation can race a `ready()`/
        // hard-cap settle. Announcing "<room> ready" or moving focus to that
        // room's heading while the DOM behind the veil is really some OTHER
        // page would be actively misleading (a false a11y signal is worse
        // than a missed one). Require the live `window.location.pathname` to
        // equal the destination's own resolved pathname before doing EITHER
        // side effect; on a mismatch, settle silently — the router-verify
        // fallback (elsewhere in the runtime) owns recovering the visible
        // truth, this component simply declines to narrate a room it cannot
        // confirm the user is actually looking at. `destination` is
        // theoretically nullable (JourneyState's own type) — no destination
        // means no pathname to verify against, so that also settles silently.
        const destinationPathname = destination
          ? new URL(destination.href, window.location.href).pathname
          : null;
        const atDestination =
          destinationPathname !== null && window.location.pathname === destinationPathname;
        if (!atDestination) return;

        setAnnouncement(`${destination?.label ?? "The room"} ready`);
        // CXOS focus-handoff law, cinematic journeys only (spec §4):
        // immediate mode leaves native focus behavior untouched, matching
        // TransitionShell's own settle-focus pattern (`main h1`, tabindex -1).
        // T2.1 amendment (new integration evidence, not a reopened T1
        // finding): in the T2 persistent product shell the room title <h1>
        // lives in the shell's <header>, not inside <main> (the T1 demo had
        // it in <main>) — without the fallback this handoff silently found
        // nothing product-wide, voiding the a11y law it implements.
        if (mode === "cinematic") {
          const heading =
            document.querySelector<HTMLElement>("main h1") ??
            document.querySelector<HTMLElement>("header h1");
          if (heading) {
            heading.setAttribute("tabindex", "-1");
            heading.focus({ preventScroll: true });
          }
        }
        return;
      }

      // Fix 7 (b): governed cancel/fail recovery — nothing ever navigated,
      // the user is still in `origin`. Announce that plainly and NEVER move
      // focus (there is nothing new to hand focus to).
      if (previousPhase === "recovering") {
        setAnnouncement(
          origin ? `Journey cancelled — still in ${origin.label}` : "Journey cancelled",
        );
        return;
      }

      // Fix 7 (c): any other settle — immediate mode's intent->settled, or
      // a hard-cap forcing settled directly from "traveling"/"departing"
      // before any destination DOM was guaranteed to exist. No
      // announcement, no focus: Next's own route announcer covers real
      // navigations, and a hard-capped journey must not announce a room
      // against what may still be the WRONG DOM.
    }
  }, [phase, sequence, destination, mode, origin]);

  // Escape governed-cancel (spec §4 / machine law 4): pre-commit only. The
  // listener is attached only while it could do anything — matching
  // TransitionShell's own idle-vs-active listener discipline — so this is
  // an inert no-op the rest of the time, never a global key-swallower.
  useEffect(() => {
    if (phase !== "intent" && phase !== "departing") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      cancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [phase, cancel]);

  // Fix 8 (a11y, "keyboard behind the veil"): while `traveling`, the veil is
  // opaque AND `pointer-events: auto` (matching production TransitionShell —
  // the old room must not receive clicks mid-travel), but a sighted mouse
  // user being blocked is not the same as a keyboard/AT user being blocked —
  // Tab order and screen-reader virtual-cursor navigation don't consult
  // pointer-events at all. Ownership-marked inert (GCL law): this effect
  // marks every element in the resolved inert SCOPE (T2.2 FIX 1:
  // `getInertScope()` — the shell's marked chrome+main tree, or the T1
  // top-level-`<main>` fallback) present the INSTANT traveling begins with
  // both `inert` and the `data-trt-inert` marker attribute, and on leaving
  // traveling (phase change) or unmount, unmarks ONLY elements still
  // carrying that marker — an element that was already inert for some
  // unrelated reason is never touched in either direction.
  //
  // KNOWN RESIDUAL (accepted for T1, still true under the T2.2 scope
  // amendment): an element belonging to the resolved scope that mounts for
  // the FIRST time mid-traveling — i.e. AFTER this effect's
  // querySelectorAll already ran — is never picked up by this effect
  // instance; it simply doesn't exist in the DOM yet at that point. (In the
  // T2 product shell this is moot in practice — the marked scope is the
  // shell's own persistent root, mounted well before any journey can begin
  // — but the residual is stated at the scope level, not just for `<main>`,
  // since FIX 1 broadened what this effect resolves.) This is bounded by
  // `readyTimeoutMs` (currently 1000ms): the destination signals `ready()`
  // well inside that window in the ordinary case, and until it does, the
  // newly-mounted room renders behind the still-opaque, still-pointer-
  // events:auto veil regardless, so it is not a reachable tab target either
  // way. Accepted as a T1 limitation, not fixed here.
  useEffect(() => {
    if (phase !== "traveling") return;

    const marked: HTMLElement[] = [];
    for (const el of getInertScope()) {
      if (el.hasAttribute("inert")) continue; // never touch a pre-existing inert node
      el.setAttribute("inert", "");
      el.setAttribute(INERT_MARKER_ATTR, "");
      marked.push(el);
    }

    return () => {
      for (const el of marked) {
        if (!el.hasAttribute(INERT_MARKER_ATTR)) continue; // only ever remove what carries the marker
        el.removeAttribute("inert");
        el.removeAttribute(INERT_MARKER_ATTR);
      }
    };
  }, [phase]);

  const showVeil =
    phase === "departing" || phase === "traveling" || phase === "arriving";
  const band = state.tier === "A" ? "A" : "B";
  const veilDurationMs =
    phase === "departing"
      ? JOURNEY_PACING.departingMs[band]
      : phase === "arriving"
        ? JOURNEY_PACING.arrivingMs[band]
        : 0;

  return (
    <>
      {/* Always mounted — outlives the veil itself so a settle
          announcement survives past the moment the overlay below unmounts. */}
      <p aria-live="polite" role="status" className="sr-only">
        {announcement}
      </p>
      <style>{VEIL_KEYFRAMES}</style>
      {showVeil && (
        <div
          aria-hidden="true"
          data-journey-phase={phase}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: VEIL_Z_INDEX,
            // Spec §4: pointer-events auto ONLY during traveling — matches
            // production TransitionShell's cover behavior (the old room must
            // not receive clicks mid-travel), while departing/arriving let
            // clicks pass through to whatever is still beneath the fade.
            pointerEvents: phase === "traveling" ? "auto" : "none",
            backgroundColor: VEIL_BACKGROUND,
            opacity: phase === "arriving" ? 0 : 1,
            animationName:
              phase === "departing"
                ? "trt-veil-in"
                : phase === "arriving"
                  ? "trt-veil-out"
                  : "none",
            animationDuration: `${veilDurationMs}ms`,
            animationTimingFunction: "linear",
            animationFillMode: "forwards",
          }}
        />
      )}
    </>
  );
}
