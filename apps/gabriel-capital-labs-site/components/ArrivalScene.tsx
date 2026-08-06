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
import { reveal, pinEnd } from "@/lib/motion";
import { arrival, site } from "@/content/site";

const SESSION_KEY = "gcl-arrival-seen";

// R2 1.2 — the six (seven, counting the cue) composed-timeline targets,
// and the exact hidden values the `html.js` CSS gate gives them before any
// GSAP tween runs. Replay's belt-and-braces re-set uses this same table so
// there is one place that has to stay truthful to globals.css, not two.
type ArrivalRefs = {
  glow: HTMLDivElement | null;
  markWrap: HTMLDivElement | null;
  wordTop: HTMLSpanElement | null;
  wordBottom: HTMLSpanElement | null;
  tagline1: HTMLParagraphElement | null;
  tagline2: HTMLParagraphElement | null;
  cue: HTMLDivElement | null;
};

// R3 — `reduced` is the desktop-reduce channel policy (DESKTOP_REDUCED_QUERY),
// NOT the raw REDUCED_MOTION_QUERY: the markWrap hidden state under reduce
// drops the y-drift/scale-overshoot and hides through opacity alone, per the
// vestibular-safe channel policy in lib/motion.ts. Every other target here
// was already opacity-only and needs no reduced twin.
function setInitialHiddenStates(refs: ArrivalRefs, reduced: boolean) {
  if (refs.glow) gsap.set(refs.glow, { opacity: 0 });
  if (refs.markWrap) {
    gsap.set(refs.markWrap, reduced ? { opacity: 0, y: 0, scale: 1 } : { opacity: 0, y: 18, scale: 1.04 });
  }
  if (refs.wordTop) gsap.set(refs.wordTop, { opacity: 0 });
  if (refs.wordBottom) gsap.set(refs.wordBottom, { opacity: 0 });
  if (refs.tagline1) gsap.set(refs.tagline1, { opacity: 0 });
  if (refs.tagline2) gsap.set(refs.tagline2, { opacity: 0 });
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
      if (window.scrollY <= 0 || performance.now() - start > 1500) {
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

export default function ArrivalScene() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const pinRef = useRef<HTMLDivElement | null>(null);
  const glowRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const replayButtonRef = useRef<HTMLButtonElement | null>(null);
  const markWrapRef = useRef<HTMLDivElement | null>(null);
  const wordTopRef = useRef<HTMLSpanElement | null>(null);
  const wordBottomRef = useRef<HTMLSpanElement | null>(null);
  const tagline1Ref = useRef<HTMLParagraphElement | null>(null);
  const tagline2Ref = useRef<HTMLParagraphElement | null>(null);
  const cueRef = useRef<HTMLDivElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
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

  useEffect(() => {
    ensureGsapRegistered();

    const reducedMotion = window.matchMedia(REDUCED_MOTION_QUERY).matches;
    // R3 — desktop-reduce (>=1024px, prefers-reduced-motion: reduce) is no
    // longer folded into the same "just jump to the end" bucket as
    // mobile-reduce. It runs the SAME intro ladder as full motion, just with
    // the markWrap step stripped to opacity-only (WCAG C39 cross-fade). Only
    // <1024px reduce keeps the pre-R2 static-jump behavior below.
    const desktopReduced = window.matchMedia(DESKTOP_REDUCED_QUERY).matches;
    const staticJump = reducedMotion && !desktopReduced;
    const alreadySeen = sessionStorage.getItem(SESSION_KEY) === "1";

    // R3.1 — computed once at mount, same convention as reducedMotion/
    // desktopReduced above. Drives the disabled-vs-aria-disabled choice on
    // the replay chip (Finding 16) — below 1024px that choice must render
    // byte-identical to pre-R3.1.
    const isDesktopWidthNow = window.matchMedia("(min-width: 1024px)").matches;
    setIsDesktopWidth(isDesktopWidthNow);

    // R3.1 / Finding 7 — desktop-reduce auto-plays the intro as a real
    // ~4.3s ladder (R3/D-3 above), but global chrome can't be gated behind
    // it: the intro is allowed to play OVER the nav and replay chip, it
    // just can never be the only way to reach them for 4+ seconds. Nav's
    // own reveal (Nav.tsx) listens for this exact event; firing it here at
    // mount — instead of only from markComplete — decouples "chrome is
    // reachable" from "the cinematic beat has finished," for this policy
    // only. Full-motion desktop keeps the existing (pre-R3, accepted)
    // cinematic withhold; mobile never reaches this branch at all
    // (desktopReduced requires >=1024px, so it's false on every mobile
    // width regardless of motion preference).
    if (desktopReduced) {
      window.dispatchEvent(new Event("gcl:arrival-complete"));
      setShowReplay(true);
    }

    const markComplete = () => {
      if (completedRef.current) return;
      completedRef.current = true;
      sessionStorage.setItem(SESSION_KEY, "1");
      window.dispatchEvent(new Event("gcl:arrival-complete"));
      setShowSkip(false);
      setShowReplay(true);
      setIsReplaying(false);

      // R3.1 / Finding 16 — only a desktop REPLAY moves focus and speaks;
      // an ordinary fresh-visit completion (first load, wasReplayRef never
      // set) must not suddenly steal focus or announce anything nobody
      // asked for. Mobile is excluded by construction — wasReplayRef is
      // only ever written true from the desktop-gated branch of
      // handleReplay below.
      if (wasReplayRef.current) {
        wasReplayRef.current = false;
        setAnnouncement("Introduction complete");
        replayButtonRef.current?.focus({ preventScroll: true });
      }
    };

    // D5 — ONE timeline owns the composition in every state. It is always
    // built (paused), so replay always has something to restart: fresh visit
    // plays it after the darkness beat; reduced-motion/already-seen jump it
    // straight to progress(1) (no visible animation, but the same object).
    const introCtx = gsap.context(() => {
      const tl = gsap.timeline({ paused: true, delay: 0.4, onComplete: markComplete });
      timelineRef.current = tl;
      tl.to(glowRef.current, { opacity: 1, duration: 0.8, ease: "power2.out" })
        .to(
          markWrapRef.current,
          reveal(desktopReduced, { opacity: 1, scale: 1, y: 0, duration: 1.6, ease: "power3.out" }),
          "-=0.25"
        )
        .to(wordTopRef.current, { opacity: 1, duration: 0.6, ease: "power2.out" }, "-=0.6")
        .to(wordBottomRef.current, { opacity: 1, duration: 0.6, ease: "power2.out" })
        .to(tagline1Ref.current, { opacity: 1, duration: 0.5, ease: "power2.out" })
        .to(tagline2Ref.current, { opacity: 1, duration: 0.5, ease: "power2.out" }, "-=0.15")
        // R3.1 / Finding 15 — this step plays on the intro's own fixed
        // wall-clock ladder, independent of scroll. If the visitor has
        // already engaged the pull-back (scrolled, fading ENTER toward 0)
        // by the time this step's turn comes up (~3.9s in), writing a flat
        // `1` here would "win" as the last write and leave ENTER burned in
        // at full opacity for the rest of the pin. The function-based
        // value re-reads pullbackEngagedRef at the moment THIS step
        // actually starts (not at timeline-build time) and, if the
        // pull-back has already taken over, targets the cue's own current
        // opacity instead — a no-op that leaves the pull-back's scrub
        // tween as sole authority over this element.
        .to(cueRef.current, {
          opacity: () =>
            pullbackEngagedRef.current
              ? Number(gsap.getProperty(cueRef.current, "opacity"))
              : 1,
          duration: 0.4,
          ease: "power2.out",
        });

      // R3 / D-3 fix — `staticJump` (not raw `reducedMotion`) gates the jump-
      // to-end shortcut. A fresh desktop-reduce visit now plays the intro as
      // a real, scroll-independent opacity cross-fade ladder; already-seen
      // still jumps straight to progress(1) in every motion policy; mobile-
      // reduce is unaffected (staticJump === reducedMotion there).
      if (staticJump || alreadySeen) {
        setIsStatic(true);
        tl.progress(1);
      } else {
        tl.play();
      }
    }, sectionRef);

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
            pullback
              .to(markWrapRef.current, { scale: 0.9, duration: 1, ease: "none" }, 0)
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

    return () => {
      introCtx.revert();
      pinCtx.revert();
      offscreenTrigger.kill();
    };
  }, []);

  const handleSkip = () => {
    timelineRef.current?.progress(1, false);
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
      if (isReplaying) return;
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
        setAnnouncement("Replaying introduction");
        // Move focus to a stable, always-focusable landing spot instead of
        // leaving it on the chip while the chip's own busy/disabled state
        // is about to change underneath it — the actual root cause of
        // Finding 16's focus-to-<body> drop.
        headingRef.current?.focus({ preventScroll: true });
      }

      waitForScrollTop(reducedMotion ? "auto" : "smooth").then(() => {
        sessionStorage.removeItem(SESSION_KEY);
        completedRef.current = false;
        // R3.1 / Finding 15 — a fresh play (replay or first load) starts
        // with no scroll engagement yet.
        pullbackEngagedRef.current = false;

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
          setIsStatic(true);
          setShowSkip(false);
          timelineRef.current?.progress(1);
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
        setIsStatic(false);
        setShowSkip(true);

        const tl = timelineRef.current;
        if (tl) {
          tl.pause(0).invalidate();
          setInitialHiddenStates(
            {
              glow: glowRef.current,
              markWrap: markWrapRef.current,
              wordTop: wordTopRef.current,
              wordBottom: wordBottomRef.current,
              tagline1: tagline1Ref.current,
              tagline2: tagline2Ref.current,
              cue: cueRef.current,
            },
            desktopReduced
          );
          tl.play(0);
        } else {
          setIsReplaying(false);
        }
      });
    },
    [isReplaying]
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
      }`}
      aria-labelledby="arrival-heading"
    >
      <button
        type="button"
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
          announcing; text is written by handleReplay/markComplete above. */}
      <div className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </div>

      <div ref={pinRef} className="arrival__pin">
        <div ref={glowRef} className="arrival__glow" aria-hidden="true" />
        <div ref={overlayRef} className="arrival__stage-overlay" aria-hidden="true" />

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
            <p ref={tagline1Ref} className="arrival__tagline-line">
              {site.tagline[0]}
            </p>
            <p ref={tagline2Ref} className="arrival__tagline-line">
              {site.tagline[1]}
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
