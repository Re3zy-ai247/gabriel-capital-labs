"use client";

import { useEffect, useRef } from "react";
import {
  ensureGsapRegistered,
  gsap,
  REDUCED_MOTION_QUERY,
  DESKTOP_MOTION_QUERY,
  MOBILE_MOTION_QUERY,
} from "@/lib/gsap";
import { institution } from "@/content/site";

export default function InstitutionSection() {
  const rootRef = useRef<HTMLElement | null>(null);
  const pinRef = useRef<HTMLDivElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const ruleFillRef = useRef<HTMLDivElement | null>(null);
  const markRef = useRef<HTMLParagraphElement | null>(null);
  const headingLine0Ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    ensureGsapRegistered();

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      mm.add(
        {
          isReduced: REDUCED_MOTION_QUERY,
          isMobile: MOBILE_MOTION_QUERY,
          isDesktop: DESKTOP_MOTION_QUERY,
        },
        (context) => {
          const { isReduced, isMobile, isDesktop } = context.conditions as {
            isReduced: boolean;
            isMobile: boolean;
            isDesktop: boolean;
          };

          const lines = gsap.utils.toArray<HTMLElement>(".institution__heading-line span");
          const paras = gsap.utils.toArray<HTMLElement>(".institution__paragraphs p");

          if (isReduced) {
            gsap.set(lines, { y: "0%" });
            gsap.set(paras, { opacity: 1, y: 0 });
            if (headingRef.current) gsap.set(headingRef.current, { x: 0 });
            if (markRef.current) gsap.set(markRef.current, { y: 0, opacity: 1 });
            if (headingLine0Ref.current) gsap.set(headingLine0Ref.current, { y: 0, opacity: 1 });
            if (ruleFillRef.current) gsap.set(ruleFillRef.current, { height: "100%" });
            return undefined;
          }

          if (isMobile) {
            // Exactly the pre-R2 behavior — untouched.
            gsap.to(lines, {
              y: "0%",
              duration: 0.9,
              ease: "power3.out",
              stagger: 0.14,
              scrollTrigger: {
                trigger: rootRef.current,
                start: "top 70%",
                once: true,
              },
            });

            gsap.fromTo(
              paras,
              { opacity: 0, y: 16 },
              {
                opacity: 1,
                y: 0,
                duration: 0.8,
                ease: "power2.out",
                stagger: 0.12,
                scrollTrigger: {
                  trigger: rootRef.current,
                  start: "top 55%",
                  once: true,
                },
              }
            );

            if (ruleFillRef.current) {
              gsap.to(ruleFillRef.current, {
                height: "100%",
                ease: "none",
                scrollTrigger: {
                  trigger: rootRef.current,
                  start: "top bottom",
                  end: "bottom center",
                  scrub: 0.6,
                },
              });
            }

            return undefined;
          }

          if (isDesktop) {
            // R2 2.1/2.2 — the arrival→institution camera handoff.
            // Institution is provably fully below the viewport for the
            // entire duration of Arrival's extended pull-back pin (its
            // document top only reaches the viewport's bottom edge at the
            // exact instant that pin releases — verified via the pin +
            // spacer geometry), so any pre-animation tied to Arrival's own
            // scrub would run invisibly. Instead this drift is tied to
            // Institution's own approach: from the moment its top touches
            // the bottom of the viewport to the moment it reaches the top
            // (where the pinned reveal below takes over), the chapter-mark
            // and the first heading-line's OUTER wrapper (not the inner
            // span the mask-reveal below owns — kept on separate elements
            // so the two tweens never fight over one transform) drift up
            // into the lower third as the scene approaches — a real,
            // visible camera-handoff rather than an animation that
            // completes off-screen.
            if (markRef.current) gsap.set(markRef.current, { y: 32, opacity: 0.5 });
            if (headingLine0Ref.current) gsap.set(headingLine0Ref.current, { y: 20, opacity: 0.6 });

            const approach = gsap.timeline({
              scrollTrigger: {
                trigger: rootRef.current,
                start: "top bottom",
                end: "top top",
                scrub: 0.5,
              },
            });
            if (markRef.current) {
              approach.to(markRef.current, { y: 0, opacity: 1, duration: 1, ease: "none" }, 0);
            }
            if (headingLine0Ref.current) {
              approach.to(headingLine0Ref.current, { y: 0, opacity: 1, duration: 1, ease: "none" }, 0);
            }

            // R2 2.2 — pinned scene: the statement mask-reveals line by
            // line (staged, not simultaneous), then the supporting
            // paragraphs fade/rise in a second beat while the statement
            // shifts left ~4% (a spatial separation between statement and
            // support), and the vertical gold rule (now in its own
            // dedicated grid track — R2 defect A, see globals.css
            // .institution__frame) draws top-to-bottom on the same scrub.
            gsap.set(lines, { y: "110%" });
            gsap.set(paras, { opacity: 0, y: 16 });

            // D13 — trimmed from +=110% to +=90% (pin-budget pass); D11 —
            // the heading reveal window is tightened (duration/stagger
            // reduced) so each line finishes its mask-reveal sooner,
            // shrinking the scrub range in which a line sits mid-clip.
            const tl = gsap.timeline({
              scrollTrigger: {
                trigger: rootRef.current,
                start: "top top",
                end: "+=90%",
                scrub: 0.6,
                pin: pinRef.current,
                pinSpacing: true,
              },
            });

            tl.to(lines, { y: "0%", duration: 0.7, ease: "none", stagger: 0.15 }, 0);

            if (headingRef.current) {
              tl.to(headingRef.current, { x: "-4%", duration: 0.6, ease: "none" }, 0.55);
            }

            tl.to(paras, { opacity: 1, y: 0, duration: 0.6, ease: "none", stagger: 0.15 }, 0.6);

            if (ruleFillRef.current) {
              tl.fromTo(
                ruleFillRef.current,
                { height: "0%" },
                { height: "100%", duration: 1.2, ease: "none" },
                0
              );
            }

            return () => {
              approach.scrollTrigger?.kill();
              tl.scrollTrigger?.kill();
            };
          }

          return undefined;
        }
      );
    }, rootRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      id="institution"
      ref={rootRef}
      className="institution"
      aria-labelledby="institution-heading"
    >
      <div className="container institution__frame">
        {/* R2 defect A — the rule now lives in its own dedicated grid
            track ([line]), never sharing an x-position with the content
            column, so it can never overlap the chapter-mark or heading
            text at any width. */}
        <div className="institution__rule-v" aria-hidden="true">
          <div ref={ruleFillRef} className="institution__rule-v-fill" />
        </div>

        <div className="institution__grid" ref={pinRef}>
          <p className="chapter-mark institution__mark" ref={markRef}>
            {institution.chapterMark}
          </p>

          <h2
            id="institution-heading"
            className="institution__heading"
            ref={headingRef}
          >
            {institution.headingLines.map((line, i) => (
              <span
                className="institution__heading-line"
                key={i}
                ref={i === 0 ? headingLine0Ref : undefined}
              >
                <span>{line}</span>
              </span>
            ))}
          </h2>

          <div className="institution__paragraphs">
            {institution.paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
