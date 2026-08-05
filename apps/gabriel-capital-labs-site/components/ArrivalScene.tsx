"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ensureGsapRegistered, gsap, ScrollTrigger, REDUCED_MOTION_QUERY } from "@/lib/gsap";
import { arrival, site } from "@/content/site";

const SESSION_KEY = "gcl-arrival-seen";

export default function ArrivalScene() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const pinRef = useRef<HTMLDivElement | null>(null);
  const glowRef = useRef<HTMLDivElement | null>(null);
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

    // The camera-pull-back on first scroll: short pin (~60vh), gated out
    // entirely under reduced motion (zero pins), per the motion constitution.
    const pinCtx = gsap.context(() => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        if (!sectionRef.current || !pinRef.current) return undefined;
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
      });
    }, sectionRef);

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

  const handleReplay = useCallback(() => {
    const reducedMotion = window.matchMedia(REDUCED_MOTION_QUERY).matches;
    sectionRef.current?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" });
    if (reducedMotion) return;

    sessionStorage.removeItem(SESSION_KEY);
    completedRef.current = false;
    setIsStatic(false);
    setShowReplay(false);
    setShowSkip(true);

    timelineRef.current?.restart();
  }, []);

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
        className={`arrival__replay${showReplay ? " arrival__replay--visible" : ""}`}
        onClick={handleReplay}
        aria-label={arrival.replayLabel}
        tabIndex={showReplay ? 0 : -1}
      >
        {arrival.replayLabel}
      </button>

      <div ref={pinRef} className="arrival__pin">
        <div ref={glowRef} className="arrival__glow" aria-hidden="true" />

        <div className="arrival__stage">
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
