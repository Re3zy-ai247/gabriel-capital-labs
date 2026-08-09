"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ensureGsapRegistered,
  gsap,
  ScrollTrigger,
  scheduleScrollTriggerRefresh,
  REDUCED_MOTION_QUERY,
  DESKTOP_MOTION_QUERY,
  DESKTOP_REDUCED_QUERY,
  MOBILE_MOTION_QUERY,
} from "@/lib/gsap";
import { reveal, revealFromTo, pinEnd } from "@/lib/motion";
import { arrival, site } from "@/content/site";

const SESSION_KEY = "gcl-arrival-seen";

function hasSeenArrival() {
  try {
    return sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

function markArrivalSeen() {
  try {
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    // Storage can be unavailable in privacy modes; completion must still
    // release interaction and compose the page for this visit.
  }
}

function resetArrivalSeen() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Replay remains deterministic even when session persistence is denied.
  }
}

function focusReplayWhenVisible(
  replayRef: { current: HTMLButtonElement | null },
  mountedRef: { current: boolean },
  framesRemaining = 30
) {
  requestAnimationFrame(() => {
    if (!mountedRef.current) return;
    const replay = replayRef.current;
    if (!replay) return;
    const style = getComputedStyle(replay);
    if (style.visibility === "visible" && style.pointerEvents !== "none") {
      replay.focus({ preventScroll: true });
      return;
    }
    if (framesRemaining > 0) {
      focusReplayWhenVisible(replayRef, mountedRef, framesRemaining - 1);
    }
  });
}

// R4.2 — R-1/R-2: `window.__gclLockEpoch` is the shared invalidation token
// for the pre-paint script's first-load and replay watchdog signals. The
// most recently armed `gcl-prologue` lock owns the current epoch, so an
// older timer/animationend callback becomes a harmless no-op instead of
// releasing a later session. The component invokes the script's shared
// arm/release primitives without duplicating either lifecycle locally.
declare global {
  interface Window {
    __gclLockEpoch?: number;
    __gclArmPrologueWatchdog?: () => number | false;
    __gclReleasePrologue?: (expectedEpoch?: number, notify?: boolean) => boolean;
  }
}

// R2 1.2 — the composed-timeline targets, and the exact hidden values the
// `html.js` CSS gate gives them before any GSAP tween runs. Replay's
// belt-and-braces re-set uses this same table so there is one place that
// has to stay truthful to globals.css, not two.
// R4 — `tagline2` is gone (COPY RULING, content/site.ts): the arrival
// composition now renders a single Founder-specified line. `atmosphere`
// and `signal` are new — the Gateway G Institutional Prologue's P1/P2
// sibling layers (never ancestors of the mark; see the Gateway G lock note
// in ArrivalScene's JSX below).
type ArrivalRefs = {
  atmosphere: HTMLDivElement | null;
  signal: HTMLDivElement | null;
  glow: HTMLDivElement | null;
  markWrap: HTMLDivElement | null;
  wordTop: HTMLSpanElement | null;
  wordBottom: HTMLSpanElement | null;
  tagline1: HTMLParagraphElement | null;
  cue: HTMLDivElement | null;
};

// R3 — `reduced` is the desktop-reduce channel policy (DESKTOP_REDUCED_QUERY),
// NOT the raw REDUCED_MOTION_QUERY: the markWrap hidden state under reduce
// drops the y-drift/scale-overshoot and hides through opacity alone, per the
// vestibular-safe channel policy in lib/motion.ts. Every other target here
// was already opacity-only and needs no reduced twin.
// R4 — `desktop` gates the LCP floor on markWrap, mirroring the
// `@media (min-width: 1024px)` rule in globals.css: Chrome's LCP heuristic
// ignores an exactly-0 opacity candidate, so >=1024px needs a
// nonzero-but-imperceptible starting value to keep the mark as a covered
// LCP candidate through the dark P1/P2 phases. Mobile stays at a true 0 —
// pixel-identical to R3.
// R4.1 — F8/F10: the wordmark half of this floor is REMOVED (see the CSS
// comment in globals.css). `wordTop` no longer takes `markFloor` at all —
// it is a true 0 on every width, in every path, including a replay reset
// (this function's own only caller). The mark's own floor is lowered from
// 0.011 to 0.002 (still a covered LCP candidate, quarter the ghost).
function setInitialHiddenStates(refs: ArrivalRefs, reduced: boolean, desktop: boolean) {
  const markFloor = desktop ? 0.002 : 0;

  if (refs.atmosphere) gsap.set(refs.atmosphere, { opacity: 0 });
  if (refs.signal) {
    // R4 — neutral-rest pattern (MissionSection's connector segments):
    // under reduce the hairline is pre-seeded at full width (scaleX:1) and
    // only ever cross-fades in opacity; under full motion it starts
    // collapsed (scaleX:0) and draws outward.
    gsap.set(refs.signal, reduced ? { opacity: 0, scaleX: 1 } : { opacity: 0, scaleX: 0 });
  }
  if (refs.glow) gsap.set(refs.glow, { opacity: 0 });
  if (refs.markWrap) {
    gsap.set(
      refs.markWrap,
      reduced ? { opacity: markFloor, y: 0, scale: 1 } : { opacity: markFloor, y: 18, scale: 1.04 }
    );
  }
  // R4.1 — F8/F10: unconditional 0, never the mark's LCP floor. See the
  // function-level comment above.
  if (refs.wordTop) gsap.set(refs.wordTop, { opacity: 0 });
  if (refs.wordBottom) gsap.set(refs.wordBottom, { opacity: 0 });
  if (refs.tagline1) gsap.set(refs.tagline1, { opacity: 0 });
  if (refs.cue) gsap.set(refs.cue, { opacity: 0 });
}

// R2 1.2b — wait for the page to actually be scrolled to top before doing
// anything else, rather than firing the reset mid-scroll. Resolves on
// scrollY reaching 0 OR a 1.5s safety timeout (a smooth scroll that's
// interrupted, or an already-at-top no-op, must never hang the control).
function waitForScrollTop(behavior: ScrollBehavior): Promise<void> {
  return new Promise((resolve) => {
    window.scrollTo({ top: 0, behavior });
    if (window.scrollY <= 0) {
      resolve();
      return;
    }
    const start = performance.now();
    const tick = () => {
      if (window.scrollY <= 0) {
        resolve();
        return;
      }
      if (performance.now() - start > 1500) {
        // R4.2 — R-1: a smooth scroll that misses the safety deadline must
        // still land at the one coherent replay start position before any
        // hidden states or containment are reset.
        window.scrollTo({ top: 0, behavior: "auto" });
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

// R4.1 — F2/F6: while the prologue withholds the rest of the page (P1's
// "no UI"), `overflow:hidden` blocks wheel/key scrolling but NOT the
// browser's own focus-driven scroll-into-view — a Tab press could still
// walk into the nav or any section below Arrival, scrolling the locked
// page out from under the visitor and force-revealing chrome early. Every
// element that isn't the arrival section itself (the nav header, every
// other `<main>` section, the footer) is made `inert` for the duration,
// which removes it from both the tab order and hit-testing — the skip
// chip and skip-link stay reachable because both live outside this set.
// Only nodes this feature actually changes receive its ownership marker.
// The shared release primitive removes inert from marked nodes only, so an
// unrelated pre-existing inert state can never be destroyed by the prologue.
function setChromeInert(arrivalSection: HTMLElement | null) {
  const navEl = document.querySelector<HTMLElement>(".nav");
  const footerEl = document.querySelector<HTMLElement>("footer");
  const targets: HTMLElement[] = [];
  if (navEl) targets.push(navEl);
  if (footerEl) targets.push(footerEl);
  const mainEl = arrivalSection?.parentElement;
  if (mainEl) {
    Array.from(mainEl.children).forEach((child) => {
      if (child !== arrivalSection && child instanceof HTMLElement) {
        targets.push(child);
      }
    });
  }
  targets.forEach((el) => {
    if (!el.hasAttribute("inert")) {
      el.setAttribute("inert", "");
      el.setAttribute("data-gcl-prologue-inert", "");
    }
  });
}

type ArrivalSceneInstanceProps = {
  desktopPolicy: boolean;
};

function ArrivalSceneInstance({ desktopPolicy }: ArrivalSceneInstanceProps) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const pinRef = useRef<HTMLDivElement | null>(null);
  const atmosphereRef = useRef<HTMLDivElement | null>(null);
  const signalRef = useRef<HTMLDivElement | null>(null);
  const glowRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const skipButtonRef = useRef<HTMLButtonElement | null>(null);
  const replayButtonRef = useRef<HTMLButtonElement | null>(null);
  const markWrapRef = useRef<HTMLDivElement | null>(null);
  const wordTopRef = useRef<HTMLSpanElement | null>(null);
  const wordBottomRef = useRef<HTMLSpanElement | null>(null);
  const tagline1Ref = useRef<HTMLParagraphElement | null>(null);
  const cueRef = useRef<HTMLDivElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const timelineDesktopPolicyRef = useRef<boolean | null>(null);
  const completedRef = useRef(false);
  // R3.1 / Finding 15 — has the visitor engaged the scroll-driven pull-back
  // yet? Read by the intro's own (wall-clock-scheduled) cue-reveal step so
  // it can defer to the pull-back instead of overwriting it; written by
  // the pull-back's own ScrollTrigger onUpdate. See both call sites below.
  const pullbackEngagedRef = useRef(false);
  // R3.1 / Finding 16 — is the intro CURRENTLY playing because of an
  // explicit desktop replay, as opposed to an ordinary fresh-visit
  // autoplay? markComplete reads this to decide whether to speak/refocus.
  const wasReplayRef = useRef(false);
  // R4.2 — R-1: React state commits asynchronously, so it cannot prevent
  // two replay activations arriving in the same task. This ref is the
  // synchronous lock; every completion/abort/unmount path clears it.
  const replayInFlightRef = useRef(false);
  const registerReclaimRef = useRef<(() => void) | null>(null);
  const mountedRef = useRef(true);

  const [isStatic, setIsStatic] = useState(false);
  const [showSkip, setShowSkip] = useState(true);
  const [showReplay, setShowReplay] = useState(false);
  const [offscreen, setOffscreen] = useState(false);
  const [isReplaying, setIsReplaying] = useState(false);
  // R3.1 / Finding 16 — gates the disabled-vs-aria-disabled choice on the
  // replay chip (see the button below). Computed once at mount, same
  // convention as reducedMotion/desktopReduced/staticJump: this component
  // doesn't react to live resize for any motion-policy flag, so neither
  // does this one.
  const [isDesktopWidth, setIsDesktopWidth] = useState(false);
  // R3.1 / Finding 16 — the sole aria-live status text for this scene.
  const [announcement, setAnnouncement] = useState("");
  // R4 — P6 "the institution awakens": drives `.arrival--awake`, which
  // starts the atmosphere's slow CSS breathe (globals.css). Set once by
  // awaken() and never unset — the institution, once awake, stays awake.
  const [awake, setAwake] = useState(false);

  // Component lifetime and controller lifetime are intentionally distinct.
  // The GSAP controller below rebuilds at the 1024px policy boundary, but a
  // replay preflight promise, its synchronous duplicate-request guard, and
  // its accessibility handoff belong to this still-mounted React instance.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      replayInFlightRef.current = false;
      wasReplayRef.current = false;
    };
  }, []);

  useEffect(() => {
    ensureGsapRegistered();

    // R4.1 — F2/F6: captured once so the cleanup below (which can run after
    // sectionRef.current has already changed) doesn't read the ref itself.
    const arrivalSection = sectionRef.current;

    const reducedMotion = window.matchMedia(REDUCED_MOTION_QUERY).matches;
    // R3 — desktop-reduce (>=1024px, prefers-reduced-motion: reduce) is no
    // longer folded into the same "just jump to the end" bucket as
    // mobile-reduce. It runs the SAME intro ladder as full motion, just with
    // the markWrap step stripped to opacity-only (WCAG C39 cross-fade). Only
    // <1024px reduce keeps the pre-R2 static-jump behavior below.
    const desktopReduced = window.matchMedia(DESKTOP_REDUCED_QUERY).matches;
    const staticJump = reducedMotion && !desktopReduced;
    const alreadySeen = hasSeenArrival();

    // R3.1 — computed once at mount, same convention as reducedMotion/
    // desktopReduced above. Drives the disabled-vs-aria-disabled choice on
    // the replay chip (Finding 16) — below 1024px that choice must render
    // byte-identical to pre-R3.1.
    const isDesktopWidthNow = desktopPolicy;
    timelineDesktopPolicyRef.current = isDesktopWidthNow;
    setIsDesktopWidth(isDesktopWidthNow);

    // R4.2 — R-2: the single source of truth for "is the lock actually
    // active for THIS load" is the DOM class itself, read once, right
    // here, at mount — never a recomputed predicate. layout.tsx's
    // pre-paint script is the only thing that ever ADDS `gcl-prologue`
    // (pathname '/', desktop width, no hash, not yet seen), and one of
    // its two dead-man watchdogs (the inline `setTimeout`, or the
    // pure-CSS keyframe in globals.css) may already have REMOVED it by
    // the time this effect runs, on a sufficiently slow hydration.
    // Reading the class instead of re-deriving the same predicate means
    // this component can never disagree with either of those — not on
    // pathname (a stray `/index.html` load never gets the class, so it
    // never gets a prologue or `inert`, full stop, with no need to
    // duplicate a pathname check here), and not on timing (a
    // watchdog-released load never gets a prologue either, even if every
    // OTHER condition below would otherwise say yes).
    const lockPresent = document.documentElement.classList.contains("gcl-prologue");
    // R4.2 — R-2 strict source: the pre-paint script owns every eligibility
    // condition. At mount this class is the complete answer, not one input
    // into a second predicate. Mobile, seen, hash, and non-root paths never
    // receive it; a watchdog-released load no longer has it.
    const willRunPrologue = lockPresent;

    // R3.1 / Finding 7 — desktop-reduce auto-plays the intro as a real
    // ~4.3s ladder (R3/D-3 above), but global chrome can't be gated behind
    // it: the intro is allowed to play OVER the nav and replay chip, it
    // just can never be the only way to reach them for 4+ seconds. Nav's
    // own reveal (Nav.tsx) listens for this exact event; firing it here at
    // mount — instead of only from markComplete — decouples "chrome is
    // reachable" from "the cinematic beat has finished," for this policy
    // only.
    //
    // R4 — gated behind `!willRunPrologue`: under a FIRST-VISIT prologue,
    // withholding nav until awaken() (P6, ~12.8s wall) is the Founder's
    // explicit "no UI in P1" mission requirement, superseding Finding 7 for
    // this one case (disclosed in every report — see the A11Y note). Every
    // OTHER desktop-reduce load (already-seen, hash-bypass, or any
    // desktop-reduce visit that isn't running the prologue) keeps Finding
    // 7's original immediate-nav fix untouched.
    if (desktopReduced && !willRunPrologue) {
      window.dispatchEvent(new Event("gcl:arrival-complete"));
      setShowReplay(true);
    }

    const markComplete = () => {
      // A policy rebuild composes its replacement timeline at progress(1).
      // If this scene had already completed, that duplicate callback must
      // not clear a still-awaited replay preflight's component-wide guard
      // or busy state.
      if (completedRef.current) return;
      replayInFlightRef.current = false;
      setIsReplaying(false);
      completedRef.current = true;
      markArrivalSeen();
      window.dispatchEvent(new Event("gcl:arrival-complete"));
      setShowSkip(false);
      setShowReplay(true);

      // R3.1 / Finding 16 — only a desktop REPLAY moves focus; an ordinary
      // fresh-visit completion must not suddenly steal focus nobody asked
      // to give up.
      //
      // R4.1 — F12: the announcement itself is no longer gated to replay
      // alone. `willRunPrologue` (closed over from mount) is true for
      // every path that actually spoke the "Introduction playing" start
      // announcement below — natural completion, Skip, Esc, and the
      // breakpoint-crossing abort all funnel through this same
      // markComplete — so every one of them now resolves it. The silent
      // already-seen/hash-bypass jump never announced a start
      // (willRunPrologue is false there), so it correctly still announces
      // nothing here.
      const isReplay = wasReplayRef.current;
      if (isReplay || willRunPrologue) {
        wasReplayRef.current = false;
        setAnnouncement("Introduction complete");
        if (isReplay) {
          // awaken() removes `gcl-replaying` immediately before this
          // callback, while React may still be committing the chip's
          // offscreen/visible state. Focusing a computed-hidden control is
          // rejected. Retry for at most half a second and land as soon as
          // the released control is genuinely rendered focusable.
          focusReplayWhenVisible(replayButtonRef, mountedRef);
        }
      }
    };

    // R4 — revealSkip (P2): the skip chip is kept invisible pre-paint by
    // the html.gcl-prologue CSS gate (globals.css). This inline autoAlpha
    // write beats that class rule by ordinary cascade priority — an inline
    // style always outranks a stylesheet rule with no !important on either
    // side — making the chip visible AND focusable at wall ~3.0s (0.4s
    // outer delay + 2.6s timeline position), ahead of the Founder's ~3s
    // a11y mitigation deadline. `pointerEvents: "auto"` is set alongside
    // autoAlpha for the same reason: autoAlpha only ever writes opacity +
    // visibility, never pointer-events — without this, the CSS gate's own
    // `pointer-events: none` would keep outranking nothing (no inline
    // pointer-events to beat it) and silently block every MOUSE click on
    // an otherwise visible, focusable chip until awaken() removes the
    // class at P6. Keyboard (Tab focus, Enter/Space, and the separate
    // Esc-to-skip effect below) never depended on pointer-events, which is
    // why this specific defect only ever affects a pointer/mouse skip.
    // R4.2 — R-5(a): 0.87 composites the prologue bronze near RGB(166,57,23)
    // over #060608: about 3.10:1, while remaining below the signal centre
    // near RGB(119,91,42), about 3.20:1. The old 0.65 value was only 2.17:1
    // once element opacity was included. Full weight (opacity:1 + brand
    // gold) restores on :hover/:focus-visible in globals.css.
    const revealSkip = () => {
      gsap.to(skipButtonRef.current, {
        autoAlpha: 0.87,
        pointerEvents: "auto",
        duration: 0.4,
        ease: "power2.out",
      });
    };

    // Assigned after reclaimPrologueGlow is declared below. awaken() can
    // run synchronously while introCtx is being built, so it calls this
    // initialized no-op rather than reaching through a temporal dead zone.
    let unregisterReclaim = () => {};

    // R4 — awaken (P6): the CONTINUITY MECHANISM. The one moment the
    // prologue becomes the site — release scroll, start the ambient
    // breathe, reveal nav, and re-measure every pin against the
    // post-scrollbar layout. Every action here is independently idempotent
    // (classList.remove on an absent class, setState to an already-true
    // value, a repeat Event dispatch, a repeat ScrollTrigger.refresh), so
    // it is safe to reach more than once — which it will, since
    // tl.progress(1) fires this tl.call inline on every seen/hash-bypass
    // jump AND on the timeline's own forward playback to completion.
    const awaken = () => {
      // R4.2 — R-1/R-2: the pre-paint-defined primitive atomically clears
      // both root classes, the current timer/animation listener, and only
      // inert attributes owned by this prologue.
      window.__gclReleasePrologue?.(undefined, false);
      // Synchronous class ownership matters on a crossing cleanup and replay
      // reset; React state follows so the next render agrees with the DOM.
      arrivalSection?.classList.add("arrival--awake");
      setAwake(true);
      window.dispatchEvent(new Event("gcl:arrival-complete"));
      // R4.1 — F5: the refresh-reclaim listener's whole job is protecting
      // the prologue's own glow tween from a pre-P3 stomp; once the
      // prologue is over, the R3 pull-back scrub is glow's sole owner, so
      // this unregisters the listener at the exact moment that becomes
      // true. `reclaimPrologueGlow` is declared further down this effect —
      // referencing it here is safe because this callback only ever runs
      // (via the timeline's P6 tl.call, or a jump) long after the whole
      // effect body — including that declaration — has already executed.
      unregisterReclaim();
      // R4 — the scroll lock's release can change viewport width (a
      // Windows-style scrollbar reappearing), so every pin measured while
      // locked needs one re-measure against the real, post-unlock layout.
      // No new ScrollTrigger is created anywhere in the prologue — this is
      // the one, single post-unlock refresh the beat table specifies.
      requestAnimationFrame(() => ScrollTrigger.refresh());
    };

    // D5 — ONE timeline owns the composition in every state. It is always
    // built (paused), so replay always has something to restart: fresh visit
    // plays it after the darkness beat; reduced-motion/already-seen/hash
    // jump it straight to progress(1) (no visible animation, but the same
    // object).
    //
    // R4 — the timeline position (seconds) of P3's glow reveal, shared with
    // the refresh-reclaim listener below (see `reclaimPrologueGlow`) so the
    // two can never drift apart.
    const GLOW_REVEAL_AT = 4.8;

    // R4 — reclaim glow from the pull-back's forced refresh-render. The
    // pull-back's own pinned ScrollTrigger (buildPullback below) renders
    // its progress-0 frame on every ScrollTrigger.refresh() — necessary for
    // GSAP to measure pin spacing correctly, but that forced render stamps
    // glow to its fromTo "from" value (opacity:1, R3.1/Finding 3) almost
    // immediately at page load, well before the prologue's own P3 beat
    // (wall ~5.2s) is due to touch it. Invisible under R3's old mobile/
    // desktop ladder (glow was ALSO an early beat there, so the stomp
    // landed on the same value the ladder was heading to anyway) but a
    // real defect under the prologue's P1 "darkness, silence" requirement.
    // This global "refresh" event (same public ScrollTrigger API
    // MissionSection.tsx already uses for its own post-refresh geometry
    // re-apply) fires once every individual trigger — including the
    // pull-back's — has already refreshed, so by the time this runs the
    // stomp has already landed. Re-rendering the prologue timeline at its
    // OWN current time only reclaims glow correctly once the prologue's
    // own tween has actually started (GSAP doesn't touch a tween's target
    // before the playhead reaches it); before that instant, the
    // unambiguously correct value is a plain 0 — nothing else has
    // legitimate authority over glow yet — so this positively re-asserts
    // it instead. Both branches use `suppressEvents`/a direct `gsap.set`,
    // never `.progress()`, so this can never re-fire revealSkip/awaken.
    // Scoped to the desktop prologue only: the mobile ladder's pull-back
    // has the identical characteristic, but it predates R4 and mobile must
    // stay byte-identical to R3.
    //
    // R4.1 — F5/F0: declared and registered HERE, before `introCtx`
    // (below) exists — NOT after it, where it used to live. The
    // already-seen/hash-bypass branch inside `introCtx` calls
    // `tl.progress(1)` SYNCHRONOUSLY during this same effect's execution,
    // which fires `awaken()` inline, which in turn now unregisters this
    // very listener — a `const` declared later in the same function is in
    // the temporal dead zone until its own declaration runs, so awaken()
    // referencing it from an earlier-defined closure invoked THIS
    // synchronously would have thrown a ReferenceError on every
    // already-seen/hash-bypass load. Declaring it before `introCtx` is
    // built removes that ordering hazard entirely.
    const reclaimPrologueGlow = () => {
      // R4.1 — F5: scoped to prologue-active only. awaken() already
      // unregisters this listener the moment the prologue ends, but a
      // refresh event already queued at that exact instant could still
      // reach this callback — this guard is the belt to that braces, so a
      // later ScrollTrigger.refresh() (a plain resize, a devtools dock)
      // can never re-stamp glow/cue over whatever the R3 pull-back scrub
      // currently owns.
      if (completedRef.current) return;
      const tl = timelineRef.current;
      if (!tl) return;
      if (tl.time() < GLOW_REVEAL_AT) {
        gsap.set(glowRef.current, { opacity: 0 });
      } else {
        tl.render(tl.time(), true, true);
      }
    };
    let reclaimRegistered = false;
    const registerReclaim = () => {
      if (!isDesktopWidthNow || reclaimRegistered) return;
      ScrollTrigger.addEventListener("refresh", reclaimPrologueGlow);
      reclaimRegistered = true;
    };
    unregisterReclaim = () => {
      if (!reclaimRegistered) return;
      ScrollTrigger.removeEventListener("refresh", reclaimPrologueGlow);
      reclaimRegistered = false;
    };
    registerReclaimRef.current = registerReclaim;
    registerReclaim();

    const introCtx = gsap.context(() => {
      const tl = gsap.timeline({ paused: true, delay: 0.4, onComplete: markComplete });
      timelineRef.current = tl;

      if (isDesktopWidthNow) {
        // R4 — Gateway G Institutional Prologue. Six phases, one timeline,
        // built once regardless of which branch below actually plays it.
        // Every numeric position argument is a timeline-local second
        // (wall-clock = this value + the 0.4s outer delay) — see the
        // beat-table math in the R4 report for the full derivation.

        // P1 — darkness. Pure obsidian silence for the 0.4s outer delay,
        // then the void breathes barely-visible. Opacity-only in both
        // policies already, so no reveal() wrapper is needed.
        tl.to(atmosphereRef.current, { opacity: 0.08, duration: 1.8, ease: "power1.inOut" }, 0);

        // P2 — the gold signal. scaleX is the only spatial key here;
        // revealFromTo strips it under reduce, leaving the pre-seeded
        // scaleX:1 (setInitialHiddenStates) untouched and the hairline
        // fading in at full width, opacity-only.
        const [signalFrom, signalTo] = revealFromTo(
          desktopReduced,
          { opacity: 0, scaleX: 0 },
          { opacity: 0.55, scaleX: 1, duration: 2.2, ease: "power2.inOut" }
        );
        tl.fromTo(signalRef.current, signalFrom, signalTo, 2.2);
        // Skip becomes visible+focusable at wall ~3.0s — ahead of the
        // Founder's ~3s a11y deadline, in both policies.
        tl.call(revealSkip, [], 2.6);

        // P3 — the Gateway G revealed. Light reveals the mark, never
        // redraws it: the glow rises, markWrap runs the EXACT approved
        // wrap-settle grammar (opacity + y:18->0 + scale:1.04->1, stripped
        // to opacity-only under reduce by reveal() — WCAG C39 cross-fade),
        // and the signal hands off into the glow.
        tl.to(glowRef.current, { opacity: 1, duration: 2.4, ease: "power2.inOut" }, GLOW_REVEAL_AT);
        tl.to(
          markWrapRef.current,
          reveal(desktopReduced, { opacity: 1, y: 0, scale: 1, duration: 1.6, ease: "power3.out" }),
          5.6
        );
        tl.to(signalRef.current, { opacity: 0, duration: 1.2, ease: "power1.inOut" }, 5.6);

        // P4 — hold. An empty dwell tween (same pattern as Mission's R3.1
        // dwell filler): nothing moves. The G is remembered before the
        // words arrive.
        // R4.1 — LOW finding 13 (craft): the hold measured at 2.2s, the
        // low end of a studio ident's typical 2-4s resolved-mark hold.
        // Extended +0.7s (1.6 -> 2.3) and every downstream P5/P6 position
        // shifted the same +0.7s so nothing else about the beat table
        // changes shape — only the dwell gets more weight. New total
        // ~15.1s wall, still inside the Founder's 12-16s window.
        tl.to({}, { duration: 2.3 }, 8.0);

        // P5 — the words. Sequential, no overlap — the symbol is
        // remembered before the words. Single tagline line per the R4
        // COPY RULING (content/site.ts) — the second <p>/tagline2Ref no
        // longer exists. Opacity-only in both policies.
        tl.to(wordTopRef.current, { opacity: 1, duration: 0.7, ease: "power2.out" }, 10.3);
        tl.to(wordBottomRef.current, { opacity: 1, duration: 0.7, ease: "power2.out" }, 11.1);
        tl.to(tagline1Ref.current, { opacity: 1, duration: 0.7, ease: "power2.out" }, 12.0);

        // P6 — the institution awakens.
        tl.call(awaken, [], 13.1);
        // R3.1 / Finding 15 — this step plays on the intro's own fixed
        // wall-clock ladder, independent of scroll. If the visitor has
        // already engaged the pull-back (scrolled, fading ENTER toward 0)
        // by the time this step's turn comes up, writing a flat `1` here
        // would "win" as the last write and leave ENTER burned in at full
        // opacity for the rest of the pin. The function-based value
        // re-reads pullbackEngagedRef at the moment THIS step actually
        // starts (not at timeline-build time) and, if the pull-back has
        // already taken over, targets the cue's own current opacity
        // instead — a no-op that leaves the pull-back's scrub tween as
        // sole authority over this element. Scroll only becomes possible
        // once awaken() (above) releases the lock, so under a genuine
        // first-visit play this guard is inert until P6 — it exists for
        // replay and for the general safety of the shared step.
        tl.to(
          cueRef.current,
          {
            opacity: () =>
              pullbackEngagedRef.current
                ? Number(gsap.getProperty(cueRef.current, "opacity"))
                : 1,
            duration: 0.4,
            ease: "power2.out",
          },
          13.5
        );
        tl.to({}, { duration: 0.6 }, 14.1);
      } else {
        // R3 (unchanged, verbatim) — the mobile arrival ladder. R4 only
        // removes the second tagline tween (tagline2Ref no longer exists —
        // R4 COPY RULING, content/site.ts); every remaining tween, offset,
        // and ease is untouched. Prologue code above is unreachable here.
        tl.to(glowRef.current, { opacity: 1, duration: 0.8, ease: "power2.out" })
          .to(
            markWrapRef.current,
            reveal(desktopReduced, { opacity: 1, scale: 1, y: 0, duration: 1.6, ease: "power3.out" }),
            "-=0.25"
          )
          .to(wordTopRef.current, { opacity: 1, duration: 0.6, ease: "power2.out" }, "-=0.6")
          .to(wordBottomRef.current, { opacity: 1, duration: 0.6, ease: "power2.out" })
          .to(tagline1Ref.current, { opacity: 1, duration: 0.5, ease: "power2.out" })
          .to(cueRef.current, {
            opacity: () =>
              pullbackEngagedRef.current
                ? Number(gsap.getProperty(cueRef.current, "opacity"))
                : 1,
            duration: 0.4,
            ease: "power2.out",
          });
      }

      // R3 / D-3 fix — `staticJump` (not raw `reducedMotion`) gates the
      // jump-to-end shortcut. A fresh desktop-reduce visit plays the intro
      // as a real, scroll-independent opacity cross-fade ladder;
      // already-seen still jumps straight to progress(1) in every motion
      // policy; mobile-reduce is unaffected (staticJump === reducedMotion
      // there).
      //
      // R4.2 — R-2 strict source: desktop plays the prologue iff the class
      // was present at mount. The pre-paint owner already folded pathname,
      // hash, seen-session, width, and watchdog state into that class. The
      // separate alreadySeen branch remains only for the inherited mobile
      // ladder, which intentionally has no hash awareness.
      if (
        staticJump ||
        (!isDesktopWidthNow && (alreadySeen || completedRef.current)) ||
        (isDesktopWidthNow && !willRunPrologue)
      ) {
        setIsStatic(true);
        tl.progress(1);
        // The inherited mobile timeline has no awaken() call of its own.
        // Its seen/reduced static branch used to remain composed only
        // because progress(1) left GSAP's inline opacity/transform behind.
        // R-3 deliberately clears that residue, so give the same composed
        // state an explicit CSS authority before normalization removes the
        // inline fallback. The atmosphere animation remains desktop-only.
        if (!isDesktopWidthNow) {
          arrivalSection?.classList.add("arrival--awake");
          setAwake(true);
        }
      } else {
        tl.play();
        if (willRunPrologue) {
          setAnnouncement("Introduction playing — press Escape to skip at any time.");
          // R4.1 — F2/F6: contain focus to the arrival section (skip chip
          // + skip-link only) for the duration of the real, first-visit
          // prologue. Released by awaken() above on every exit path.
          setChromeInert(arrivalSection);
        }
      }
    }, sectionRef);

    // R4.2 — R-1/R-2: both 22s watchdog signals atomically release the DOM
    // first, then synchronously dispatch this event. A mounted scene seeks
    // the same timeline to its end so awaken() and markComplete perform the
    // ordinary state, announcement, focus, and listener cleanup.
    const handleForcedPrologueRelease = () => {
      replayInFlightRef.current = false;
      const tl = timelineRef.current;
      if (tl && !completedRef.current) {
        tl.progress(1, false);
        return;
      }
      wasReplayRef.current = false;
      setIsReplaying(false);
    };
    window.addEventListener("gcl:prologue-force-release", handleForcedPrologueRelease);

    // R4.1 — F1/F3 (BLOCKER, breakpoint-crossing abort): the prologue's
    // timeline is built once, keyed on `isDesktopWidthNow` at mount, and
    // never re-evaluated — so resizing/rotating across the 1024px line
    // mid-play used to leave the DESKTOP ladder (and its scroll lock)
    // running over a now-mobile viewport with no escape. This listener
    // only cares about LEAVING desktop while the prologue could still be
    // holding the lock: `tl.progress(1, false)` seeks the timeline
    // straight to its end WITHOUT suppressing events, so every intervening
    // `tl.call` (revealSkip, awaken — unlock, nav event, session key) and
    // the final `onComplete` (markComplete) fire exactly as a natural
    // completion would. `completedRef` guards against firing on an already
    // -finished timeline (nothing to abort). The desktop-only prologue
    // siblings (atmosphere/signal) and the skip chip are then explicitly
    // cleared of their inline styles so nothing prologue-only leaks into
    // the mobile composition the visitor now sees.
    let breakpointCleanupFrame: number | null = null;
    const normalizeCrossingResidue = () => {
      if (!mountedRef.current || desktopWidthQuery.matches) return;
      const skip = skipButtonRef.current;
      if (skip) gsap.killTweensOf(skip);
      const crossingTargets: HTMLElement[] = [];
      const possibleTargets = [
        markWrapRef.current,
        atmosphereRef.current,
        signalRef.current,
        skip,
      ];
      possibleTargets.forEach((target) => {
        if (target) crossingTargets.push(target);
      });
      if (crossingTargets.length === 0) return;
      // `.arrival--awake .arrival__mark-wrap` is the later composed-state
      // CSS authority, so clearing all four targets now leaves a native,
      // visible mark instead of falling back to the pre-hidden rule.
      gsap.set(crossingTargets, { clearProps: "all" });
      // Refresh against that clean composed state, then clear once more in
      // case the newly built mobile trigger rendered a progress-0 inline
      // start value during its measurement.
      ScrollTrigger.refresh();
      gsap.set(crossingTargets, { clearProps: "all" });
    };
    const scheduleCrossingNormalization = () => {
      if (breakpointCleanupFrame !== null) {
        cancelAnimationFrame(breakpointCleanupFrame);
      }
      breakpointCleanupFrame = requestAnimationFrame(() => {
        breakpointCleanupFrame = null;
        normalizeCrossingResidue();
      });
    };
    const handleBreakpointChange = (event: MediaQueryListEvent) => {
      if (event.matches) return;
      const tl = timelineRef.current;
      if (!tl) return;
      // The pre-paint owner's width listener may run first and synchronously
      // force this timeline to completion. Progress only when still active,
      // but ALWAYS schedule residue normalization below; listener order can
      // never be allowed to skip the R-3 clearProps contract.
      if (!completedRef.current) {
        tl.progress(1, false);
      }
      // R4.2 — R-3: deferred one frame so this always runs AFTER the
      // forced `progress(1)` render above AND after gsap.matchMedia's own
      // synchronous rebuild of the mobile pull-back trigger — both fire
      // off the same viewport `change` event, and the mobile trigger's
      // own creation-time forced render (needed for GSAP's pin-spacing
      // measurement) is what was stamping the stale desktop scale,
      // captured before this abort ever ran, onto markWrap. Running one
      // frame later means these corrections are always the last write,
      // regardless of which listener the browser happens to fire first.
      scheduleCrossingNormalization();
    };
    const desktopWidthQuery = window.matchMedia("(min-width: 1024px)");
    desktopWidthQuery.addEventListener("change", handleBreakpointChange);

    // R2 2.1 — the camera-pull-back on first scroll. Mobile/tablet (<1024)
    // keeps the exact pre-R2 short pin; desktop gets an extended pull-back
    // with a stage-darken overlay, gated entirely out under reduced motion
    // (zero pins) per the motion constitution either way.
    const pinCtx = gsap.context(() => {
      const mm = gsap.matchMedia();
      mm.add(
        {
          isMobile: MOBILE_MOTION_QUERY,
          isDesktop: DESKTOP_MOTION_QUERY,
          isDesktopReduced: DESKTOP_REDUCED_QUERY,
        },
        (context) => {
          const { isMobile, isDesktop, isDesktopReduced } = context.conditions as {
            isMobile: boolean;
            isDesktop: boolean;
            isDesktopReduced: boolean;
          };
          if (!sectionRef.current || !pinRef.current) return undefined;

          // R3 — one builder, two channel policies. Same scene structure
          // (trigger/end/scrub/pin, same four targets, same timeline
          // positions) in both cases; the stage scale/y recede is the only
          // beat with no vestibular-safe equivalent, so it's wrapped in
          // `if (!reduced)` and dropped under reduce — the overlay-darken +
          // glow-dim carry the "stage falling away" read on their own.
          //
          // R4 — unchanged. This pin is built at mount regardless of the
          // prologue; while `html.gcl-prologue` locks scroll (P1-P5), no
          // scroll event can reach it, so it simply arms and waits.
          // awaken() releasing the lock (P6) is the only thing that lets a
          // visitor actually engage it.
          const buildPullback = (reduced: boolean) => {
            const pullback = gsap.timeline({
              scrollTrigger: {
                trigger: sectionRef.current,
                start: "top top",
                end: pinEnd(reduced, 100),
                scrub: 0.6,
                pin: pinRef.current,
                pinSpacing: true,
                // R3.1 / Finding 15 — flag first engagement so the intro's
                // own late cue-reveal step (built above) can defer to
                // whatever the visitor's scroll position already says
                // instead of overwriting it. See that step for the full
                // reasoning; this is just the write side of the flag.
                onUpdate: (self) => {
                  // R3.2 — regression fix: ScrollTrigger's pin/refresh setup
                  // fires this onUpdate synchronously a couple of times at
                  // creation (scrollY still 0), reporting a nonzero-but-
                  // floating-point-noise `progress` (~1e-6). The prior
                  // `self.progress > 0` guard treated that noise as "the
                  // visitor scrolled," latching pullbackEngagedRef true
                  // before any real scroll — which permanently starved the
                  // intro's own cue-reveal step below (it always saw
                  // "already engaged" and no-op'd, so ENTER never reached
                  // opacity 1 for anyone). 0.001 is far above the measured
                  // creation-time noise and far below any real scroll
                  // (even a single wheel tick moves progress by whole
                  // percentage points on both the 100%/60% pin ranges this
                  // trigger uses), so it only flips on genuine engagement.
                  if (self.progress > 0.001) {
                    pullbackEngagedRef.current = true;
                  } else {
                    // R3.2 — finding 8/LOW: un-latch when the visitor
                    // returns to the very top (progress back at/under the
                    // same noise floor used to engage above) instead of
                    // latching permanently for the rest of the intro. A
                    // visitor who nudges the page and scrolls back to y=0
                    // before the intro's cue-reveal step runs demonstrated
                    // no sustained scroll intent, so they should still get
                    // the ENTER affordance — the cue step re-reads this ref
                    // at execution time, so no other change is needed.
                    pullbackEngagedRef.current = false;
                  }
                },
              },
            });

            if (!reduced) {
              // D8 — the scale/drift targets `.arrival__stage` (mark +
              // wordmark + taglines together), not just the mark, so the
              // whole composition recedes as ONE rigid unit and the
              // internal mark→wordmark gap only changes by the uniform
              // scale factor (a small, predictable amount) instead of
              // blowing out because the mark moved/shrank while the text
              // stayed put.
              pullback.to(stageRef.current, { scale: 0.92, y: -22, duration: 1, ease: "none" }, 0);
            }

            // R3.1 / Finding 3 fix — glow is now a `.fromTo()` with an
            // explicit `{opacity:1}` start AND `immediateRender:false`.
            // The comment this replaces explained why a plain `.to()` was
            // chosen (to dodge stamping a competing value over the intro's
            // own fade at mount) — but that same lazy capture WAS the bug:
            // a scrubbed ScrollTrigger renders its progress-0 frame
            // synchronously at creation, before the intro's 0→1 fade has
            // ticked even once, so the plain `.to()` captured glow's real
            // value at that instant (0, the CSS pre-hidden state) as its
            // OWN start — making this a 0→0.25 tween wearing a "1→0.25"
            // comment, i.e. the glow collapsing to near-zero on the very
            // first scroll pixel instead of pulling back from full.
            // `immediateRender:false` is the actual fix for the dodge the
            // old comment was reaching for: it defers the fromTo's render
            // (both the stamped `1` and any visible change) until the
            // tween is actually asked to render a non-zero progress, so it
            // never fights the intro's fade at mount, and correctly
            // interpolates 1→0.25 once the visitor scrubs it.
            pullback
              .fromTo(
                glowRef.current,
                { opacity: 1 },
                { opacity: 0.25, duration: 1, ease: "none", immediateRender: false },
                0
              )
              .fromTo(overlayRef.current, { opacity: 0 }, { opacity: 0.55, duration: 1, ease: "none" }, 0)
              .to(cueRef.current, { opacity: 0, duration: 0.3, ease: "none" }, 0);
            // R3.2 — Finding 11's stage-brightness tween is REMOVED, in both
            // policies. `.arrival__stage` wraps the LOCKED Gateway G mark
            // (markWrap is a direct child — see the JSX below), so any
            // filter/brightness tween on the stage dims the mark itself.
            // Gateway G must render at full fidelity in every state of
            // every path; recession is carried by glow-dim + overlay-darken
            // alone, which is sufficient on its own (glow already fades
            // 1→0.25 and the overlay fades 0→0.55 across the same scrub) —
            // no replacement luminance tween was added to any layer,
            // mark-bearing or not.

            return () => {
              pullback.scrollTrigger?.kill();
            };
          };

          if (isMobile) {
            const pullback = gsap.timeline({
              scrollTrigger: {
                trigger: sectionRef.current,
                start: "top top",
                end: "+=60%",
                scrub: 0.4,
                pin: pinRef.current,
                pinSpacing: true,
              },
            });
            // R4.2 — R-3: `.fromTo` with an explicit `{scale:1}` start
            // (and `immediateRender:false`, same dodge as the desktop
            // glow fix above) instead of a plain `.to()`. A plain `.to()`
            // captures markWrap's CURRENT inline scale as its own implicit
            // start the moment this trigger is created — on a mid-P1/P2
            // 1024px crossing that value can still be the desktop LCP
            // floor's 1.04, so the scrub used to recede from 1.04, not 1,
            // leaving the Gateway G permanently 4% oversized. Hardcoding
            // the start makes this tween immune to whatever stale value
            // happens to be in markWrap's inline style at creation time,
            // regardless of listener ordering — the same guarantee
            // `handleBreakpointChange`'s own explicit reset (above)
            // provides for the REST frame, this provides for the SCRUB.
            pullback
              .fromTo(
                markWrapRef.current,
                { scale: 1 },
                { scale: 0.9, duration: 1, ease: "none", immediateRender: false },
                0
              )
              .to(pinRef.current, { opacity: 0.72, duration: 1, ease: "none" }, 0)
              .fromTo(glowRef.current, { opacity: 1 }, { opacity: 0.3, duration: 1, ease: "none" }, 0);

            return () => {
              pullback.scrollTrigger?.kill();
            };
          }

          // R2 2.1 — extended ~100vh handoff: the glow dims further and a
          // stage-darken overlay fades in — a longer, more dramatic camera
          // move than the old bare 60% pullback. (Institution's own
          // approach-drift, see InstitutionSection.tsx, picks up the
          // handoff on the other side — tying it to Institution's own
          // scrollTrigger rather than to this one, because layout math
          // shows Institution stays fully below the viewport for this
          // entire pin: any pre-animation driven from here would be
          // invisible.) The ENTER cue fades out within the first 30% of the
          // pin either way — it's a "keep scrolling" affordance that no
          // longer applies once the handoff has begun.
          if (isDesktop) {
            return buildPullback(false);
          }

          // R3 / D-1 fix — desktop-reduce runs the SAME pull-back scene
          // (same trigger, same pin, same glow-dim + overlay-darken beats,
          // same cue fade) at a shorter pin-hold (+=60% via pinEnd). Only
          // the stage scale/y recede is dropped (buildPullback's own
          // `if (!reduced)` guard) — it has no vestibular-safe equivalent,
          // and the darken/dim already carries the "receding" read.
          if (isDesktopReduced) {
            return buildPullback(true);
          }

          return undefined;
        }
      );
    }, sectionRef);

    scheduleScrollTriggerRefresh();

    // D12 — once the arrival scene has fully scrolled past, hide the
    // scroll cue + replay chip so they never collide with the fixed nav or
    // chapter 2's chrome; bring them back if the visitor scrolls back up.
    const offscreenTrigger = ScrollTrigger.create({
      trigger: sectionRef.current,
      start: "top top",
      end: "bottom top",
      onLeave: () => setOffscreen(true),
      onEnterBack: () => setOffscreen(false),
    });

    // The policy wrapper below rebuilds this controller's GSAP ownership at
    // the 1024px boundary without replacing its DOM or React state. A
    // desktop->mobile abort first completes the outgoing timeline; the
    // incoming mobile timeline then composes at progress(1). Normalize the
    // incoming timeline's prologue-only targets after its own
    // matchMedia/ScrollTrigger setup, otherwise that composition would put
    // inline residue back after the outgoing controller had cleared it.
    if (!isDesktopWidthNow && completedRef.current) {
      scheduleCrossingNormalization();
    }

    return () => {
      if (breakpointCleanupFrame !== null) {
        cancelAnimationFrame(breakpointCleanupFrame);
        breakpointCleanupFrame = null;
      }
      timelineDesktopPolicyRef.current = null;
      window.removeEventListener("gcl:prologue-force-release", handleForcedPrologueRelease);
      introCtx.revert();
      pinCtx.revert();
      offscreenTrigger.kill();
      desktopWidthQuery.removeEventListener("change", handleBreakpointChange);
      unregisterReclaim();
      registerReclaimRef.current = null;
      // R4.2 — R-1/R-2: unmount is an ordinary atomic release. It clears
      // the current replay timer/animation listener and only owned inert.
      window.__gclReleasePrologue?.(undefined, false);
    };
  }, [desktopPolicy]);

  // R4 — Esc-to-skip (Founder a11y mitigation): scoped to desktop width
  // only, computed once at mount (same convention as every other
  // motion-policy flag in this file). Mobile never had a keyboard skip
  // path in R3 and doesn't gain one now — the "mobile byte-identical"
  // constraint is stricter than the letter of the beat table here.
  // `timelineRef.current?.isActive()` is what actually scopes this to "the
  // prologue is genuinely playing" (true only during a real tl.play() run,
  // never during/after a progress(1) jump) — `completedRef` is a
  // belt-and-braces second guard against a double-fire race with a
  // near-simultaneous natural completion.
  useEffect(() => {
    if (!desktopPolicy) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !completedRef.current && timelineRef.current?.isActive()) {
        timelineRef.current?.progress(1, false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [desktopPolicy]);

  // R4.2 — R-5(b): the site-wide "Skip to content" link (layout.tsx,
  // outside this component's own JSX — a plain `<a href="#content">`)
  // used to be a genuine dead end for the whole prologue: with
  // `html.gcl-prologue` holding `overflow:hidden`, the browser's native
  // fragment jump has nowhere to scroll TO, and activating it left focus
  // stranded on <body> with only a `#content` hash to show for it. A
  // native `addEventListener` on the anchor (found by class, since it
  // lives outside this tree) lets this component unlock the SAME way
  // Skip/Esc do — `progress(1, false)`, which fires every intervening
  // `tl.call` and `awaken()` exactly like a natural completion — before
  // the browser's own default jump action runs for that same click.
  useEffect(() => {
    const skipLink = document.querySelector<HTMLAnchorElement>(".skip-link");
    if (!skipLink) return undefined;

    const handleSkipLinkActivate = () => {
      if (!timelineRef.current || completedRef.current) return;
      if (!document.documentElement.classList.contains("gcl-prologue")) return;
      timelineRef.current.progress(1, false);
      // Unlocking alone isn't enough: the browser's native fragment-focus
      // algorithm only moves focus to `#content` if that target is
      // itself programmatically focusable (a `tabIndex`), and
      // `<main id="content">` (app/page.tsx) has none — outside this
      // file's ownership to add. Land focus on the Arrival heading
      // instead, the first focusable landmark inside `#content`, so
      // activating the skip-link during the prologue never ends in a
      // scroll-only, focus-nowhere dead end.
      requestAnimationFrame(() => headingRef.current?.focus({ preventScroll: true }));
    };

    skipLink.addEventListener("click", handleSkipLinkActivate);
    return () => skipLink.removeEventListener("click", handleSkipLinkActivate);
  }, []);

  const handleSkip = () => {
    // R4.2 — R-5(c): the heading is still `visibility:hidden` during P2,
    // so trying to focus it before the jump is rejected by Chromium. Jump
    // through the ordinary awaken/complete path first; then restore focus
    // on the next frame, after the heading is composed and React has hidden
    // the activating button. This produces the required stable landing for
    // Enter/Space without competing with the button's `hidden` commit.
    timelineRef.current?.progress(1, false);
    requestAnimationFrame(() => headingRef.current?.focus({ preventScroll: true }));
  };

  // R2 1.2 — deterministic in every state (desktop+mobile, fresh/seen/
  // mid-scroll): disable the control immediately so it can't double-fire;
  // scroll to top and WAIT for arrival before touching any timeline state;
  // reset; re-capture tween start values (invalidate) AND belt-and-braces
  // re-apply the exact `html.js` hidden values so a fast scrub or a stale
  // captured value can never make the replay skip visibly; then play from 0.
  // Reduced motion still "does something" — it scrolls up and composes the
  // full static arrival rather than silently no-op'ing.
  const handleReplay = useCallback(
    (event?: React.MouseEvent<HTMLButtonElement>) => {
      if (replayInFlightRef.current) return;
      replayInFlightRef.current = true;
      setIsReplaying(true);

      // R3.1 / Finding 16 — recomputed on every call, same convention as
      // reducedMotion/desktopReduced below: below 1024px every new branch
      // in this handler must render byte-identical to pre-R3.1 (Founder
      // constraint — nothing below 1024 changes).
      const isDesktopWidthNow = window.matchMedia("(min-width: 1024px)").matches;

      // D1 — a real mouse click focuses the button first (the browser's own
      // default action, which happens before this handler runs), and on a
      // chip that isn't visible at the current scroll position that default
      // focus can trigger a native scroll-into-view a beat later — racing
      // waitForScrollTop() below and yanking the page away from y=0 mid-
      // intro. blur() immediately so the button holds no focus to scroll to,
      // then re-assert scrollTo(0,0) across a couple of rAFs so any focus-
      // scroll that was already in flight before the blur lands gets
      // overridden once it settles. (Belt-and-braces on top of the CSS fix —
      // the chip is now `position:fixed`, so it's always inside the
      // viewport and should never need scrolling into view at all.)
      //
      // R3.1 / Finding 16 — below 1024px this stays the original
      // unconditional blur. At >=1024px, only blur for a genuine pointer
      // activation (MouseEvent.detail > 0) — a keyboard Enter/Space
      // activation synthesizes a click with detail === 0, and blurring
      // THAT dropped focus straight to <body> with nothing to bring it
      // back, which is exactly what Finding 16 caught.
      const isPointerActivation = !isDesktopWidthNow || (event?.detail ?? 0) > 0;
      if (isPointerActivation) {
        replayButtonRef.current?.blur();
      }
      requestAnimationFrame(() => {
        window.scrollTo(0, 0);
        requestAnimationFrame(() => window.scrollTo(0, 0));
      });

      const reducedMotion = window.matchMedia(REDUCED_MOTION_QUERY).matches;
      // R3 / D-3 fix — recomputed on every replay (the preference/width can
      // change between mounts via matchMedia teardown+rebuild, though not
      // mid-click). `staticJump` is the ONLY branch that still jumps straight
      // to the finished frame; desktop-reduce now falls into the shared
      // "play a real ladder" path below, opacity-only.
      const desktopReduced = window.matchMedia(DESKTOP_REDUCED_QUERY).matches;
      const staticJump = reducedMotion && !desktopReduced;

      // R3.1 / Finding 16 — only a desktop replay gets the new focus
      // handoff + status announcement (staticJump is mobile-only and
      // isDesktopWidthNow is always false there, so this never fires on
      // mobile). markComplete checks wasReplayRef to decide whether to
      // speak/refocus at all, so an ordinary fresh-visit completion stays
      // silent exactly as before.
      wasReplayRef.current = isDesktopWidthNow;
      if (isDesktopWidthNow) {
        // R4.2 — R-1: matches the first-visit start announcement now that
        // a replay re-applies the same P1 "no UI" containment a first
        // visit does — Escape is a genuine, working way out of it here
        // too, so the announcement says so.
        setAnnouncement("Replaying introduction — press Escape to skip at any time.");
        // Move focus to a stable, always-focusable landing spot instead of
        // leaving it on the chip while the chip's own busy/disabled state
        // is about to change underneath it — the actual root cause of
        // Finding 16's focus-to-<body> drop.
        headingRef.current?.focus({ preventScroll: true });
      }

      waitForScrollTop(reducedMotion ? "auto" : "smooth").then(() => {
        if (!mountedRef.current) {
          replayInFlightRef.current = false;
          return;
        }
        // R4.2 — replay preflight breakpoint race: width was sampled when
        // the control was activated, but a mid-page smooth reset can take
        // up to 1.5s. If the viewport crossed the 1024px boundary during
        // that await, this component's timeline still has its mount-time
        // flavor and must not start under the stale policy. Keep the
        // already-composed scene, resolve the announced replay request,
        // and leave a later activation free to make a fresh decision.
        const desktopWidthAfterScroll = window.matchMedia("(min-width: 1024px)").matches;
        if (
          desktopWidthAfterScroll !== isDesktopWidthNow ||
          timelineDesktopPolicyRef.current !== desktopWidthAfterScroll
        ) {
          replayInFlightRef.current = false;
          wasReplayRef.current = false;
          setIsReplaying(false);
          setShowSkip(false);
          setOffscreen(false);
          setShowReplay(true);
          setAnnouncement("Introduction complete");
          window.__gclReleasePrologue?.(undefined, false);
          focusReplayWhenVisible(replayButtonRef, mountedRef);
          return;
        }
        // The replay reset has deterministically landed at the Arrival.
        // Do not wait for a ScrollTrigger state callback to make the fixed
        // replay control focusable again—its offscreen state is now known.
        setOffscreen(false);
        // R3.1 / Finding 16 — below 1024px the chip still hides during
        // replay exactly as before. At >=1024px it now stays in the AX
        // tree the whole time — isReplaying alone drives aria-busy/
        // aria-disabled below, so a screen-reader user can still find and
        // inspect the control mid-replay instead of it vanishing via
        // visibility:hidden.
        if (!isDesktopWidthNow) {
          setShowReplay(false);
        }

        // Mobile-reduce (<1024px, prefers-reduced-motion: reduce) keeps the
        // pre-R3 static-jump behavior exactly: no animation to replay, so
        // Replay's only job is to re-compose the static arrival and re-arm
        // the control.
        if (staticJump) {
          resetArrivalSeen();
          completedRef.current = false;
          pullbackEngagedRef.current = false;
          setIsStatic(true);
          setShowSkip(false);
          const tl = timelineRef.current;
          if (tl) {
            // The mobile-reduce timeline is already parked at progress 1
            // from its initial static composition. Rewind synchronously so
            // progress(1,false) re-fires markComplete and restores the
            // session key/showReplay contract instead of becoming a no-op.
            tl.pause(0).progress(1, false);
          } else {
            markArrivalSeen();
            setShowReplay(true);
          }
          replayInFlightRef.current = false;
          wasReplayRef.current = false;
          setIsReplaying(false);
          return;
        }

        // D-3 fix — every other case, including desktop-reduce, plays a real
        // staged arrival: pause+invalidate so GSAP re-captures fresh start
        // values, re-apply the exact hidden states (opacity-only under
        // desktop-reduce, per setInitialHiddenStates), then play from 0.
        // `markComplete` (the timeline's onComplete) re-enables the control
        // and re-shows the chip on finish, so this is repeatable without a
        // page refresh in both policies.
        //
        // R4 — a desktop replay plays the FULL six-phase prologue from 0
        // again.
        //
        // R4.2 — R-1 (the true sequence): a replay now re-applies the
        // EXACT SAME state a first visit gets, not a lighter-weight
        // imitation of it. R4.1's own fix only withheld the nav visually
        // (`gcl-replaying`) and contained focus/hit-testing
        // (`setChromeInert`) while leaving scroll itself unlocked — a gate
        // review measured that as an incoherent trap: `inert` everywhere
        // outside Arrival, but the page still scrollable, so a visitor who
        // scrolled mid-replay landed on a dead page with the mandated skip
        // chip 4900+px out of view (`.arrival__skip` is `position:
        // absolute`, correct only because the page is never supposed to
        // scroll while it's the sole reachable control). Re-adding
        // `gcl-prologue` itself makes that state structurally
        // unreachable: it re-arms `overflow:hidden` (so there is no scroll
        // position for the skip chip to be "5000px above"), and it
        // re-arms the SAME CSS gate that hides `.arrival__skip` until
        // revealSkip's own inline write beats it at wall ~3s — a replay's
        // P1/P2 chip timing now literally matches a first visit's, not a
        // parallel hand-rolled copy of it. `gcl-replaying` still layers on
        // top for the two things `gcl-prologue` doesn't cover on its own:
        // visually hiding the nav (Nav.tsx's own `visible` state is a
        // one-way ratchet that never resets) and — new here — the REPLAY
        // chip itself (globals.css), so the mandated skip chip is the
        // ONE interactive element for the sequence's duration, exactly as
        // a first visit's P1 already is. `setChromeInert` still removes
        // nav/other-sections/footer from the tab order and hit-testing.
        // Esc already worked before this change (it calls the same
        // `progress(1, false)` Skip does) and continues to; `awaken()`
        // firing again at its usual timeline position releases every one
        // of these — lock, inert, nav, replay chip, focus — on every exit
        // path, a harmless idempotent re-run for whichever of these a
        // first-visit play already cleared.
        if (isDesktopWidthNow) {
          document.documentElement.classList.add("gcl-replaying");
          document.documentElement.classList.add("gcl-prologue");
          setChromeInert(sectionRef.current);
          // The pre-paint script owns both 22s mechanisms and their epoch.
          // Natural completion/Skip/Esc/crossing all clear them through
          // awaken(); forced release synchronously finishes this timeline.
          const armed = window.__gclArmPrologueWatchdog?.();
          // arm() samples width before it mutates scene/session state. A
          // false result means the viewport crossed in the tiny interval
          // after the post-scroll check; shared release has already removed
          // classes/inert, while the completed composition and seen marker
          // are still intact. Resolve the announced request without ever
          // rewinding or hiding the scene.
          if (!armed || !document.documentElement.classList.contains("gcl-prologue")) {
            window.__gclReleasePrologue?.(undefined, false);
            replayInFlightRef.current = false;
            wasReplayRef.current = false;
            setIsReplaying(false);
            setShowSkip(false);
            setShowReplay(true);
            setAnnouncement("Introduction complete");
            focusReplayWhenVisible(replayButtonRef, mountedRef);
            return;
          }
          // awaken() unregisters this listener at every end. The guarded
          // registrar makes each new desktop replay add exactly one copy.
          registerReclaimRef.current?.();
        }

        // Only a successfully acquired desktop lock (or the inherited
        // mobile replay path) may reset the completion/session state.
        resetArrivalSeen();
        completedRef.current = false;
        pullbackEngagedRef.current = false;
        setIsStatic(false);
        setShowSkip(true);
        // R4.2 — R-1: remove the composed/awake class synchronously before
        // any hidden state is written. React state alone commits too late;
        // the still-running CSS breathe can otherwise outrank the reset.
        sectionRef.current?.classList.remove("arrival--awake");
        setAwake(false);

        const tl = timelineRef.current;
        if (tl) {
          tl.pause(0).invalidate();
          setInitialHiddenStates(
            {
              atmosphere: atmosphereRef.current,
              signal: signalRef.current,
              glow: glowRef.current,
              markWrap: markWrapRef.current,
              wordTop: wordTopRef.current,
              wordBottom: wordBottomRef.current,
              tagline1: tagline1Ref.current,
              cue: cueRef.current,
            },
            desktopReduced,
            isDesktopWidthNow
          );
          // R4.1 — F4(b): the skip chip's own P2 reveal writes an inline
          // `autoAlpha`/`pointerEvents` (see revealSkip above) that the
          // shared `setInitialHiddenStates` table doesn't cover. Without
          // this reset it stays at its first-play end value (visible,
          // clickable) for the whole replay instead of P2 genuinely
          // revealing it again.
          // R4.2 — R-1: `revealSkip`'s own tween (fired via `tl.call`, not
          // tracked as a timeline child GSAP would kill on its own) can
          // still be mid-flight from whatever ended the PREVIOUS cycle
          // (a natural completion, or Esc/Skip forcing `progress(1)`,
          // which fires every intervening `tl.call` including this one)
          // — measured this leftover tween overwriting THIS reset a beat
          // later, leaving the chip visible through the very start of a
          // fresh replay's own P1. Kill it first.
          if (isDesktopWidthNow) {
            gsap.killTweensOf(skipButtonRef.current);
            gsap.set(skipButtonRef.current, { autoAlpha: 0, pointerEvents: "none" });
          }
          tl.play(0);
        } else {
          replayInFlightRef.current = false;
          wasReplayRef.current = false;
          completedRef.current = true;
          markArrivalSeen();
          sectionRef.current?.classList.add("arrival--awake");
          setAwake(true);
          setShowSkip(false);
          setShowReplay(true);
          setAnnouncement("Introduction complete");
          setIsReplaying(false);
          window.__gclReleasePrologue?.(undefined, false);
        }
      });
    },
    []
  );

  // Allow the footer's "Replay arrival" control to trigger the same replay.
  useEffect(() => {
    const listener = () => handleReplay();
    window.addEventListener("gcl:request-replay", listener);
    return () => window.removeEventListener("gcl:request-replay", listener);
  }, [handleReplay]);

  return (
    <section
      id="top"
      ref={sectionRef}
      className={`arrival${isStatic ? " arrival--static" : ""}${
        offscreen ? " arrival--offscreen" : ""
      }${awake ? " arrival--awake" : ""}`}
      aria-labelledby="arrival-heading"
    >
      <button
        type="button"
        ref={skipButtonRef}
        className="arrival__skip"
        onClick={handleSkip}
        hidden={!showSkip}
        aria-label="Skip introduction"
      >
        {arrival.skipLabel}
      </button>

      <button
        type="button"
        ref={replayButtonRef}
        className={`arrival__replay${showReplay ? " arrival__replay--visible" : ""}`}
        onClick={handleReplay}
        aria-label={arrival.replayLabel}
        aria-busy={isReplaying}
        // R3.1 / Finding 16 — native `disabled` yanks focus to <body> the
        // instant it turns on, if the button currently holds focus (this
        // is what actually dropped focus on a keyboard-triggered replay,
        // not just the old unconditional blur() above). Below 1024px this
        // stays the original native `disabled` (Founder constraint:
        // nothing below 1024 changes); at >=1024px `aria-disabled` conveys
        // the same busy state to assistive tech without breaking focus —
        // the early `if (isReplaying) return;` at the top of handleReplay
        // is what actually stops a double-fire, not this DOM attribute.
        disabled={!isDesktopWidth && isReplaying}
        aria-disabled={isDesktopWidth ? isReplaying : undefined}
        tabIndex={showReplay ? 0 : -1}
      >
        {arrival.replayLabel}
      </button>

      {/* R3.1 / Finding 16 — the entire replay was a silent opacity fade
          to anyone who couldn't see it: zero aria-live regions existed
          anywhere on the page. Visually hidden, scoped to this component
          since only the replay flow currently has anything worth
          announcing; text is written by handleReplay/markComplete above.
          R4 — also carries the prologue-start announcement (see the
          mount effect's `willRunPrologue` branch). */}
      <div className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </div>

      <div ref={pinRef} className="arrival__pin">
        <div ref={glowRef} className="arrival__glow" aria-hidden="true" />
        <div ref={overlayRef} className="arrival__stage-overlay" aria-hidden="true" />

        {/* R4 — P1/P2 prologue siblings. Gateway G lock: these sit BEHIND
            `.arrival__stage` in DOM/paint order and are never ancestors of
            the mark — nothing here ever filters, dims, or wraps the mark
            itself. Inert on mobile and on any path that never builds the
            desktop prologue (rest opacity 0, untouched). */}
        <div ref={atmosphereRef} className="arrival__atmosphere" aria-hidden="true" />
        <div ref={signalRef} className="arrival__signal" aria-hidden="true" />

        <div ref={stageRef} className="arrival__stage">
          <div ref={markWrapRef} className="arrival__mark-wrap">
            <picture>
              <source
                type="image/webp"
                srcSet="/img/gateway-g-480.webp 480w, /img/gateway-g-768.webp 768w, /img/gateway-g-1080.webp 1036w"
                sizes="(max-width: 720px) 40vw, 220px"
              />
              <img
                className="arrival__mark"
                src="/img/gateway-g-480.png"
                width={480}
                height={520}
                alt={arrival.markAlt}
                // R4 — network/decode priority hint only; no pixel change
                // on any viewport. Part of the LCP-floor strategy (see
                // globals.css) that keeps this element (or the wordmark) a
                // covered LCP candidate through the dark P1/P2 phases.
                fetchPriority="high"
              />
            </picture>
          </div>

          <h1 id="arrival-heading" ref={headingRef} tabIndex={-1} className="arrival__wordmark">
            <span ref={wordTopRef} className="arrival__wordmark-top">
              {site.wordmarkTop}
            </span>
            <span ref={wordBottomRef} className="arrival__wordmark-bottom">
              {site.wordmarkBottom}
            </span>
          </h1>

          <div className="arrival__tagline">
            {/* R4 COPY RULING — single Founder-specified line replaces the
                two-line pair; see content/site.ts for the full ruling and
                the SEO-untouched disclosure. */}
            <p ref={tagline1Ref} className="arrival__tagline-line">
              {arrival.tagline}
            </p>
          </div>
        </div>

        <div ref={cueRef} className="arrival__cue" aria-hidden="true">
          <span className="arrival__cue-line" />
          <span className="arrival__cue-label">{arrival.scrollCue}</span>
        </div>
      </div>
    </section>
  );
}

// The intro timeline is intentionally built once per width policy. Re-run
// the controller effect at the 1024px boundary—without replacing its DOM or
// React state—so a scene mounted on mobile can never later acquire a desktop
// replay lock around its mobile timeline (or vice versa). Preserving the
// instance also lets an awaited replay preflight finish its cancellation
// announcement/focus handoff against the newly built live-policy timeline.
export default function ArrivalScene() {
  const [desktopPolicy, setDesktopPolicy] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches
  );

  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const handlePolicyChange = (event: MediaQueryListEvent) => setDesktopPolicy(event.matches);
    query.addEventListener("change", handlePolicyChange);
    return () => query.removeEventListener("change", handlePolicyChange);
  }, []);

  return <ArrivalSceneInstance desktopPolicy={desktopPolicy} />;
}
