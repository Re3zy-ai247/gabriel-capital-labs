"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ensureGsapRegistered,
  gsap,
  ScrollTrigger,
  scheduleScrollTriggerRefresh,
  REDUCED_MOTION_QUERY,
  DESKTOP_MOTION_QUERY,
  MOBILE_MOTION_QUERY,
} from "@/lib/gsap";
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

function setInitialHiddenStates(refs: ArrivalRefs) {
  if (refs.glow) gsap.set(refs.glow, { opacity: 0 });
  if (refs.markWrap) gsap.set(refs.markWrap, { opacity: 0, y: 18, scale: 1.04 });
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
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const completedRef = useRef(false);

  const [isStatic, setIsStatic] = useState(false);
  const [showSkip, setShowSkip] = useState(true);
  const [showReplay, setShowReplay] = useState(false);
  const [offscreen, setOffscreen] = useState(false);
  const [isReplaying, setIsReplaying] = useState(false);

  useEffect(() => {
    ensureGsapRegistered();

    const reducedMotion = window.matchMedia(REDUCED_MOTION_QUERY).matches;
    const alreadySeen = sessionStorage.getItem(SESSION_KEY) === "1";

    const markComplete = () => {
      if (completedRef.current) return;
      completedRef.current = true;
      sessionStorage.setItem(SESSION_KEY, "1");
      window.dispatchEvent(new Event("gcl:arrival-complete"));
      setShowSkip(false);
      setShowReplay(true);
      setIsReplaying(false);
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
          { opacity: 1, scale: 1, y: 0, duration: 1.6, ease: "power3.out" },
          "-=0.25"
        )
        .to(wordTopRef.current, { opacity: 1, duration: 0.6, ease: "power2.out" }, "-=0.6")
        .to(wordBottomRef.current, { opacity: 1, duration: 0.6, ease: "power2.out" })
        .to(tagline1Ref.current, { opacity: 1, duration: 0.5, ease: "power2.out" })
        .to(tagline2Ref.current, { opacity: 1, duration: 0.5, ease: "power2.out" }, "-=0.15")
        .to(cueRef.current, { opacity: 1, duration: 0.4, ease: "power2.out" });

      if (reducedMotion || alreadySeen) {
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
        { isMobile: MOBILE_MOTION_QUERY, isDesktop: DESKTOP_MOTION_QUERY },
        (context) => {
          const { isMobile, isDesktop } = context.conditions as {
            isMobile: boolean;
            isDesktop: boolean;
          };
          if (!sectionRef.current || !pinRef.current) return undefined;

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

          if (isDesktop) {
            // R2 2.1 — extended ~100vh handoff: the glow dims further and a
            // stage-darken overlay fades in — a longer, more dramatic camera
            // move than the old bare 60% pullback. (Institution's own
            // approach-drift, see InstitutionSection.tsx, picks up the
            // handoff on the other side — tying it to Institution's own
            // scrollTrigger rather than to this one, because layout math
            // shows Institution stays fully below the viewport for this
            // entire pin: any pre-animation driven from here would be
            // invisible.)
            //
            // D8 — the scale/drift targets `.arrival__stage` (mark +
            // wordmark + taglines together), not just the mark, so the
            // whole composition recedes as ONE rigid unit and the internal
            // mark→wordmark gap only changes by the uniform scale factor
            // (a small, predictable amount) instead of blowing out because
            // the mark moved/shrank while the text stayed put. The ENTER
            // cue fades out within the first 30% of the pin — it's a
            // "keep scrolling" affordance that no longer applies once the
            // handoff has begun.
            const pullback = gsap.timeline({
              scrollTrigger: {
                trigger: sectionRef.current,
                start: "top top",
                end: "+=100%",
                scrub: 0.6,
                pin: pinRef.current,
                pinSpacing: true,
              },
            });
            pullback
              .to(stageRef.current, { scale: 0.92, y: -22, duration: 1, ease: "none" }, 0)
              .fromTo(glowRef.current, { opacity: 1 }, { opacity: 0.25, duration: 1, ease: "none" }, 0)
              .fromTo(overlayRef.current, { opacity: 0 }, { opacity: 0.55, duration: 1, ease: "none" }, 0)
              .to(cueRef.current, { opacity: 0, duration: 0.3, ease: "none" }, 0);

            return () => {
              pullback.scrollTrigger?.kill();
            };
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
  const handleReplay = useCallback(() => {
    if (isReplaying) return;
    setIsReplaying(true);

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
    replayButtonRef.current?.blur();
    requestAnimationFrame(() => {
      window.scrollTo(0, 0);
      requestAnimationFrame(() => window.scrollTo(0, 0));
    });

    const reducedMotion = window.matchMedia(REDUCED_MOTION_QUERY).matches;

    waitForScrollTop(reducedMotion ? "auto" : "smooth").then(() => {
      sessionStorage.removeItem(SESSION_KEY);
      completedRef.current = false;
      setShowReplay(false);

      if (reducedMotion) {
        setIsStatic(true);
        setShowSkip(false);
        timelineRef.current?.progress(1);
        setIsReplaying(false);
        return;
      }

      setIsStatic(false);
      setShowSkip(true);

      const tl = timelineRef.current;
      if (tl) {
        tl.pause(0).invalidate();
        setInitialHiddenStates({
          glow: glowRef.current,
          markWrap: markWrapRef.current,
          wordTop: wordTopRef.current,
          wordBottom: wordBottomRef.current,
          tagline1: tagline1Ref.current,
          tagline2: tagline2Ref.current,
          cue: cueRef.current,
        });
        tl.play(0);
      } else {
        setIsReplaying(false);
      }
    });
  }, [isReplaying]);

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
        disabled={isReplaying}
        tabIndex={showReplay ? 0 : -1}
      >
        {arrival.replayLabel}
      </button>

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

          <h1 id="arrival-heading" className="arrival__wordmark">
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
