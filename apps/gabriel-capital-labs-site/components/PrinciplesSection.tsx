"use client";

import { useEffect, useRef, useState } from "react";
import {
  ensureGsapRegistered,
  gsap,
  REDUCED_MOTION_QUERY,
  DESKTOP_MOTION_QUERY,
  DESKTOP_REDUCED_QUERY,
  MOBILE_MOTION_QUERY,
} from "@/lib/gsap";
import { revealFromTo, pinEnd } from "@/lib/motion";
import { principles } from "@/content/site";

export default function PrinciplesSection() {
  const rootRef = useRef<HTMLElement | null>(null);
  const pinRef = useRef<HTMLDivElement | null>(null);
  const progressFillRef = useRef<HTMLDivElement | null>(null);
  const progressLabelRef = useRef<HTMLSpanElement | null>(null);
  const [isStatic, setIsStatic] = useState(false);

  const total = principles.items.length;

  useEffect(() => {
    ensureGsapRegistered();

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      mm.add(
        {
          isReduced: REDUCED_MOTION_QUERY,
          isMobile: MOBILE_MOTION_QUERY,
          isDesktop: DESKTOP_MOTION_QUERY,
          isDesktopReduced: DESKTOP_REDUCED_QUERY,
        },
        (context) => {
          const { isReduced, isMobile, isDesktop, isDesktopReduced } = context.conditions as {
            isReduced: boolean;
            isMobile: boolean;
            isDesktop: boolean;
            isDesktopReduced: boolean;
          };

          // R3 — isDesktopReduced MUST be checked before isReduced:
          // REDUCED_MOTION_QUERY also matches desktop widths, and if
          // isReduced won here setIsStatic(true) would fire on desktop too
          // and the Founder would get the static list again (D-1). The
          // surviving isReduced branch below now only ever fires <1024px.
          if (isDesktopReduced) {
            return buildScene(true);
          }

          if (isReduced) {
            setIsStatic(true);
            return undefined;
          }

          if (isMobile) {
            // Exactly the pre-R2 behavior — untouched. See D4: only one
            // principle is ever mid-transition (autoAlpha only, no
            // y-motion), overwrite:'auto' guards a fast scrub.
            setIsStatic(false);
            const items = gsap.utils.toArray<HTMLElement>(".principles__item");
            gsap.set(items, { autoAlpha: (i) => (i === 0 ? 1 : 0) });
            let activeIndex = 0;

            const st = gsap.timeline({
              scrollTrigger: {
                trigger: rootRef.current,
                start: "top top",
                end: "+=250%",
                scrub: true,
                pin: pinRef.current,
                pinSpacing: true,
                onUpdate: (self) => {
                  const idx = Math.min(total - 1, Math.floor(self.progress * total));
                  if (idx !== activeIndex) {
                    gsap.to(items[activeIndex], {
                      autoAlpha: 0,
                      duration: 0.3,
                      ease: "power1.out",
                      overwrite: "auto",
                    });
                    gsap.to(items[idx], {
                      autoAlpha: 1,
                      duration: 0.3,
                      ease: "power1.out",
                      overwrite: "auto",
                    });
                    activeIndex = idx;
                  }
                  if (progressFillRef.current) {
                    progressFillRef.current.style.width = `${((idx + 1) / total) * 100}%`;
                  }
                  if (progressLabelRef.current) {
                    progressLabelRef.current.textContent = `${idx + 1}/${total}`;
                  }
                },
              },
            });

            return () => {
              st.scrollTrigger?.kill();
            };
          }

          // R3 — one shared scene builder for both desktop policies: the
          // identical pinned one-principle-at-a-time scene (a pin-hold plus
          // cross-fades — already the most reduced-motion-friendly chapter
          // on the site). Under reduce the item swap is opacity-only (y
          // stripped via revealFromTo(); R3.1 — the alpha key itself is
          // opacity, not autoAlpha, so hidden items stay in the a11y tree —
          // see finding 2). The D5 short-out/delayed-in sequencing survives
          // intact since it's duration/delay, not transform.
          function buildScene(reduced: boolean) {
            // R2 2.6 — same pin/mechanism ("no structural change"), refined
            // pacing: the incoming principle rises 24px + settles while
            // the outgoing one sinks, and the progress numeral gets a
            // brief crossfade pulse rather than an instant text swap. The
            // continuous gold fill (driven every onUpdate tick, same as
            // mobile) already scrubs smoothly — unchanged.
            setIsStatic(false);
            const items = gsap.utils.toArray<HTMLElement>(".principles__item");
            // R3.1 — titles resolved per item (not a second toArray query)
            // so index correspondence with `items` can't drift.
            const titleEls = items.map((item) =>
              item.querySelector<HTMLElement>(".principles__item-title")
            );

            // R3.1 — finding 11 fix: resolved once from the real design
            // tokens so the reduced-path luminance channel tweens actual
            // colour values. GSAP can't interpolate through a raw
            // `var(--x)` reference (it snaps instead of easing), so this
            // reads the computed value out of :root the same way the
            // tokens are defined in globals.css, with the literal fallback
            // only for the pathological case getComputedStyle returns "".
            const rootStyles = getComputedStyle(document.documentElement);
            const goldColor = rootStyles.getPropertyValue("--gcl-gateway-gold").trim() || "#d4a146";
            const goldDimColor =
              rootStyles.getPropertyValue("--gcl-gateway-gold-dim").trim() || "rgba(212, 161, 70, 0.35)";
            const ruleDim = "rgba(183, 183, 183, 0.14)"; // matches the static-list border token

            // R3.1 — finding 2 fix (BLOCKER): under reduce, hiding items
            // with autoAlpha sets visibility:hidden, which drops 4 of 5
            // principles from the accessibility tree (baseline exposed all
            // five — see the CDP AX-tree evidence in R3-FINDINGS #2). Plain
            // opacity keeps visibility:visible so every item stays exposed
            // to AT regardless of which one currently has visual focus.
            // Full motion keeps autoAlpha: there, items are literally
            // stacked in the same inset:0 box, so visibility:hidden is
            // also what pulls the off-screen text out of the tab order.
            gsap.set(
              items,
              reduced
                ? { opacity: (i: number) => (i === 0 ? 1 : 0), visibility: "visible", y: 0 }
                : { autoAlpha: (i: number) => (i === 0 ? 1 : 0), y: 0 }
            );

            // R3.1 — finding 11: seed the luminance + rule-weight channels
            // so the reduced path isn't opacity-only from frame one. The
            // active title sits at full gold with a lit rule; the rest sit
            // at the dim gold token with the same hairline rule the static
            // list uses. This is the "architecture resolving" cue the
            // ruling asks for in place of the spatial motion reduce
            // forbids — reduced-only, full motion is visually untouched.
            //
            // R3.2 — regression fix: these were raw `el.style.x = …`
            // assignments, invisible to gsap.matchMedia's per-branch
            // revert (it only auto-reverts GSAP-created tweens/sets, not
            // plain DOM mutation). Crossing back under 1024px killed the
            // ScrollTrigger but left the inline color/border-top stamped
            // on the DOM forever — 4 of 5 titles stuck at the dim-gold
            // token, well under contrast, on every mobile width. Routing
            // the same values through gsap.set() puts them under the SAME
            // tracked-revert gsap.matchMedia already gives every other
            // tween in this branch, so leaving isDesktopReduced (any
            // direction, any number of times) clears them back to the
            // CSS-authored state with no extra cleanup code needed here.
            if (reduced) {
              titleEls.forEach((title, i) => {
                if (title) gsap.set(title, { color: i === 0 ? goldColor : goldDimColor });
              });
              items.forEach((item, i) => {
                gsap.set(item, { borderTopColor: i === 0 ? goldColor : ruleDim });
              });
            }

            let activeIndex = 0;

            // D13 — trimmed from +=250% to +=200% (pin-budget pass). R3 —
            // pinEnd() applies the 0.6x reduced-hold budget (+=120%).
            const st = gsap.timeline({
              scrollTrigger: {
                trigger: rootRef.current,
                start: "top top",
                end: pinEnd(reduced, 200),
                scrub: true,
                pin: pinRef.current,
                pinSpacing: true,
                onUpdate: (self) => {
                  const idx = Math.min(total - 1, Math.floor(self.progress * total));
                  if (idx !== activeIndex) {
                    // R3.1 — finding 0 / 8 fix (BLOCKER / HIGH): a fast
                    // flick or a coarse PageDown can jump `idx` by more
                    // than one step. The old code only ever tweened
                    // items[activeIndex] out and items[idx] in, so any
                    // index *skipped over* kept whatever tween it already
                    // had in flight — including a still-delayed "fade in"
                    // from a prior tick that overwrite:'auto' doesn't
                    // catch (auto only kills tweens that have already
                    // started rendering; a delayed tween hasn't). That
                    // orphaned tween fires later and pins an
                    // already-passed item at full opacity forever,
                    // stacking up to four items on top of each other.
                    // Killing every item's (and, under reduce, every
                    // title's) tweens and explicitly declaring the full
                    // hidden set makes the outcome a pure function of
                    // `idx` each tick instead of an accumulation of
                    // overlapping animations — a jump of any size
                    // converges to exactly one visible item.
                    gsap.killTweensOf(items);
                    if (reduced) gsap.killTweensOf(titleEls.filter(Boolean) as HTMLElement[]);
                    items.forEach((item, i) => {
                      if (i === idx || i === activeIndex) return;
                      if (reduced) {
                        gsap.set(item, { opacity: 0, visibility: "visible", y: 0, borderTopColor: ruleDim });
                        const title = titleEls[i];
                        // R3.2 — same tracked-revert fix as the seed above:
                        // gsap.set (not raw `.style.color =`) so this stays
                        // inside gsap.matchMedia's auto-revert on branch exit.
                        if (title) gsap.set(title, { color: goldDimColor });
                      } else {
                        gsap.set(item, { autoAlpha: 0, y: 0 });
                      }
                    });

                    // D5 — the outgoing item finishes sinking/fading BEFORE
                    // the incoming one rises past the point of legibility:
                    // a same-duration, same-start, complementary-alpha
                    // crossfade always has a window where both read
                    // >0.25 simultaneously (their alphas sum to 1 for any
                    // shared ease). Giving the outgoing tween a shorter
                    // duration and the incoming one a start delay removes
                    // that window — by the time incoming begins rising,
                    // outgoing has already dropped under the threshold.
                    // This sequencing is preserved intact under reduce
                    // (duration/delay, not transform); only y is stripped.
                    // R3.1 — overwrite:true (not 'auto') so this pair can
                    // never itself become the orphaned tween finding 0
                    // describes; the alpha key is opacity (not autoAlpha)
                    // under reduce so visibility never flips to hidden
                    // (finding 2). The reduced-only borderTopColor key
                    // rides in the SAME tween call as the alpha channel —
                    // overwrite:true kills every OTHER tween of a target,
                    // not just conflicting properties, so a separate later
                    // gsap.to() on items[idx] would have silently killed
                    // this alpha tween the instant it ran (caught live:
                    // the item never reached opacity 1 because its own
                    // border-colour tween destroyed it first).
                    const outAlpha = reduced ? { opacity: 0, visibility: "visible" as const } : { autoAlpha: 0 };
                    const [outFrom, outTo] = revealFromTo(
                      reduced,
                      { y: 0 },
                      {
                        ...outAlpha,
                        y: 20,
                        duration: 0.3,
                        ease: "power1.out",
                        overwrite: true,
                        ...(reduced ? { borderTopColor: ruleDim } : null),
                      }
                    );
                    gsap.fromTo(items[activeIndex], outFrom, outTo);
                    const inAlpha = reduced ? { opacity: 1, visibility: "visible" as const } : { autoAlpha: 1 };
                    const [inFrom, inTo] = revealFromTo(
                      reduced,
                      { y: 24 },
                      {
                        ...inAlpha,
                        y: 0,
                        duration: 0.35,
                        delay: 0.18,
                        ease: "power1.out",
                        overwrite: true,
                        ...(reduced ? { borderTopColor: goldColor } : null),
                      }
                    );
                    gsap.fromTo(items[idx], inFrom, inTo);

                    // R3.1 — finding 11: the luminance companion to the
                    // crossfade above, reduced-only. Titles are separate
                    // elements from `items`, so their own tween call
                    // doesn't collide with the alpha/border pair above.
                    // Same short-out/delayed-in shape as D5 so the two
                    // channels read as one coordinated resolve.
                    if (reduced) {
                      const outTitle = titleEls[activeIndex];
                      const inTitle = titleEls[idx];
                      if (outTitle) {
                        gsap.to(outTitle, { color: goldDimColor, duration: 0.3, ease: "power1.out", overwrite: true });
                      }
                      if (inTitle) {
                        gsap.to(inTitle, {
                          color: goldColor,
                          duration: 0.35,
                          delay: 0.18,
                          ease: "power1.out",
                          overwrite: true,
                        });
                      }
                    }

                    activeIndex = idx;

                    if (progressLabelRef.current) {
                      gsap.fromTo(
                        progressLabelRef.current,
                        { opacity: 0.4 },
                        { opacity: 1, duration: 0.3, ease: "power1.out", overwrite: "auto" }
                      );
                    }
                  }
                  if (progressFillRef.current) {
                    // Retained as-is in both policies — the fill width is
                    // an instant per-step style assignment (never
                    // tweened), i.e. a discrete state change, not
                    // animated motion.
                    progressFillRef.current.style.width = `${((idx + 1) / total) * 100}%`;
                  }
                  if (progressLabelRef.current) {
                    progressLabelRef.current.textContent = `${idx + 1}/${total}`;
                  }
                },
              },
            });

            return () => {
              st.scrollTrigger?.kill();
              // R3.2 — regression fix (mobile-leak, HARD CONSTRAINT).
              // Two-part race, both required: (1) killing the
              // ScrollTrigger above stops FUTURE onUpdate ticks, but a
              // per-tick crossfade `gsap.fromTo` created by the LAST tick
              // before the media query flipped keeps running — it's an
              // independent tween on GSAP's global ticker, not owned by
              // the ScrollTrigger — so it re-stamps opacity/visibility/
              // border-top-color/color on the next frame or two even
              // after this cleanup runs. killTweensOf stops it. (2) gsap.
              // matchMedia's automatic revert doesn't reliably restore a
              // tween that was still mid-flight at revert time, so
              // `clearProps` afterward is the deterministic belt-and-
              // braces: unconditional, independent of GSAP's tween-
              // history bookkeeping. Order matters — kill before clear,
              // or a tween still resolving this frame can win the race.
              // Reduced-only: full motion's autoAlpha/y items are
              // untouched, matching the reduced-only scope of the seed/
              // onUpdate fix above.
              if (reduced) {
                gsap.killTweensOf(items);
                gsap.killTweensOf(titleEls.filter(Boolean) as HTMLElement[]);
                gsap.set(items, { clearProps: "opacity,visibility,borderTopColor" });
                titleEls.forEach((title) => {
                  if (title) gsap.set(title, { clearProps: "color" });
                });
              }
              // R3.2 — finding 6/LOW: progressFill's width and
              // progressLabel's textContent are raw DOM writes (never
              // routed through GSAP), so nothing above restores them. Reset
              // both to their JSX-authored rest state so a crossing below
              // 1024px can't leave a stale fill percentage or "n/total"
              // label behind.
              if (progressFillRef.current) progressFillRef.current.style.width = "";
              if (progressLabelRef.current) progressLabelRef.current.textContent = `1/${total}`;
            };
          }

          if (isDesktop) {
            return buildScene(false);
          }

          return undefined;
        }
      );
    }, rootRef);

    return () => ctx.revert();
  }, [total]);

  return (
    <section
      id="principles"
      ref={rootRef}
      className={`principles${isStatic ? " principles--static" : ""}`}
      aria-labelledby="principles-heading"
    >
      <div ref={pinRef} className="principles__pin">
        <div className="principles__header">
          <p className="chapter-mark" style={{ justifyContent: "center" }}>
            {principles.chapterMark}
          </p>
          <h2 id="principles-heading" className="visually-hidden">
            Principles
          </h2>
        </div>

        {principles.items.map((item, i) => (
          <div
            key={item.numeral}
            className={`principles__item${i === 0 ? " principles__item--active" : ""}`}
          >
            <span className="principles__item-numeral">{item.numeral}</span>
            <h3 className="principles__item-title">{item.title}</h3>
            <p className="principles__item-statement">{item.statement}</p>
          </div>
        ))}

        <div className="principles__progress" aria-hidden="true">
          <div className="principles__progress-track">
            <div ref={progressFillRef} className="principles__progress-fill" />
          </div>
          <span ref={progressLabelRef} className="principles__progress-label">
            1/{total}
          </span>
        </div>
      </div>
    </section>
  );
}
