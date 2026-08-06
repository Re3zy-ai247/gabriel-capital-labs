"use client";

import { useEffect, useRef } from "react";
import {
  ensureGsapRegistered,
  gsap,
  REDUCED_MOTION_QUERY,
  DESKTOP_MOTION_QUERY,
  MOBILE_MOTION_QUERY,
} from "@/lib/gsap";
import { lab } from "@/content/site";

export default function LabSection() {
  const rootRef = useRef<HTMLElement | null>(null);
  const indexRef = useRef<HTMLDivElement | null>(null);
  const gridBgRef = useRef<HTMLDivElement | null>(null);
  const introLineRef = useRef<HTMLSpanElement | null>(null);

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

          if (isReduced) {
            gsap.set(".lab__row", { opacity: 1, y: 0 });
            gsap.set(".lab__row-rule", { scaleX: 1 });
            if (introLineRef.current) gsap.set(introLineRef.current, { y: "0%" });
            gsap.set(rootRef.current, { "--gcl-rule-scale": 1 } as any);
            return undefined;
          }

          if (isMobile) {
            // Exactly the pre-R2 behavior — untouched.
            gsap.to(".lab__row", {
              opacity: 1,
              y: 0,
              duration: 0.7,
              ease: "power2.out",
              stagger: 0.09,
              scrollTrigger: {
                trigger: indexRef.current,
                start: "top 80%",
                once: true,
              },
            });
            return undefined;
          }

          if (isDesktop) {
            // D9 — the intro heading mask-reveals and the chapter-mark's
            // hairline draws (via --gcl-rule-scale, see globals.css) as
            // the header scrolls in — matches Ecosystem's treatment,
            // removing a dead scroll zone before the row index reveals.
            if (introLineRef.current) {
              gsap.set(introLineRef.current, { y: "110%" });
              gsap.fromTo(
                introLineRef.current,
                { y: "110%" },
                {
                  y: "0%",
                  duration: 0.8,
                  ease: "power3.out",
                  scrollTrigger: { trigger: rootRef.current, start: "top 75%", once: true },
                }
              );
            }
            gsap.fromTo(
              rootRef.current,
              { "--gcl-rule-scale": 0 } as any,
              {
                "--gcl-rule-scale": 1,
                duration: 0.6,
                ease: "power2.out",
                scrollTrigger: { trigger: rootRef.current, start: "top 80%", once: true },
              } as gsap.TweenVars
            );

            // R2 2.5 — keep the index reveal, but row hairlines now DRAW
            // (scaleX 0→1) instead of simply fading in with the row, and
            // the blueprint-grid gets a subtle parallax drift. The grid
            // element is oversized (110%) via CSS headroom so translating
            // it within ±4% never reveals an edge — transform-only,
            // compositor-cheap, no background-position repaint.
            const rows = gsap.utils.toArray<HTMLElement>(".lab__row");
            rows.forEach((row) => {
              const rule = row.querySelector<HTMLElement>(".lab__row-rule");
              const tl = gsap.timeline({
                scrollTrigger: { trigger: row, start: "top 85%", once: true },
              });
              tl.to(row, { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" }, 0);
              if (rule) {
                tl.fromTo(rule, { scaleX: 0 }, { scaleX: 1, duration: 0.6, ease: "power2.out" }, 0.1);
              }
            });

            if (gridBgRef.current) {
              gsap.fromTo(
                gridBgRef.current,
                { xPercent: -2, yPercent: -2 },
                {
                  xPercent: 2,
                  yPercent: 2,
                  ease: "none",
                  scrollTrigger: {
                    trigger: rootRef.current,
                    start: "top bottom",
                    end: "bottom top",
                    scrub: 0.8,
                  },
                },
              );
            }

            return undefined;
          }

          return undefined;
        }
      );
    }, rootRef);

    return () => ctx.revert();
  }, []);

  return (
    <section id="lab" ref={rootRef} className="lab" aria-labelledby="lab-heading">
      <div ref={gridBgRef} className="lab__grid-bg" aria-hidden="true" />
      <div className="container lab__header">
        <p className="chapter-mark">{lab.chapterMark}</p>
        <h2 id="lab-heading" className="lab__intro">
          <span className="lab__intro-mask">
            <span ref={introLineRef} className="lab__intro-line">
              {lab.intro}
            </span>
          </span>
        </h2>
      </div>

      <div className="container lab__index" ref={indexRef}>
        {lab.domains.map((domain) => (
          <div className="lab__row" key={domain.numeral}>
            <span className="lab__row-numeral">{domain.numeral}</span>
            <h3 className="lab__row-title">{domain.title}</h3>
            <span className="lab__row-rule" aria-hidden="true" />
          </div>
        ))}
      </div>
    </section>
  );
}
