"use client";

import { useEffect, useRef } from "react";
import { ensureGsapRegistered, gsap } from "@/lib/gsap";
import { mission } from "@/content/site";

export default function MissionSection() {
  const rootRef = useRef<HTMLElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const pathRef = useRef<SVGPathElement | null>(null);

  useEffect(() => {
    ensureGsapRegistered();

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        if (pathRef.current) {
          const length = pathRef.current.getTotalLength();
          gsap.set(pathRef.current, { strokeDasharray: length, strokeDashoffset: length });
          gsap.to(pathRef.current, {
            strokeDashoffset: 0,
            ease: "none",
            scrollTrigger: {
              trigger: bodyRef.current,
              start: "top 75%",
              end: "bottom 75%",
              scrub: 0.6,
            },
          });
        }

        const pillars = gsap.utils.toArray<HTMLElement>(".mission__pillar");
        pillars.forEach((pillar) => {
          gsap.fromTo(
            pillar,
            { opacity: 0, y: 28 },
            {
              opacity: 1,
              y: 0,
              duration: 0.9,
              ease: "power2.out",
              scrollTrigger: {
                trigger: pillar,
                start: "top 78%",
                once: true,
              },
            }
          );
        });
      });

      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set(".mission__pillar", { opacity: 1, y: 0 });
        if (pathRef.current) {
          gsap.set(pathRef.current, { strokeDasharray: "none", strokeDashoffset: 0 });
        }
      });
    }, rootRef);

    return () => ctx.revert();
  }, []);

  return (
    <section id="mission" ref={rootRef} className="mission" aria-labelledby="mission-heading">
      <div className="container mission__header">
        <p className="chapter-mark">{mission.chapterMark}</p>
        <h2 id="mission-heading" className="visually-hidden">
          Mission Architecture
        </h2>
      </div>

      <div className="container mission__body" ref={bodyRef}>
        <div className="mission__connector" aria-hidden="true">
          <svg width="100%" height="100%" viewBox="0 0 4 100" preserveAspectRatio="none">
            <path
              ref={pathRef}
              className="mission__connector-path"
              d="M2 0 L2 100"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>

        {mission.pillars.map((pillar, i) => (
          <div
            key={pillar.title}
            className={`mission__pillar${i % 2 === 1 ? " mission__pillar--right" : ""}`}
          >
            <span className="mission__pillar-numeral">{pillar.numeral}</span>
            <h3 className="mission__pillar-title">{pillar.title}</h3>
            <p className="mission__pillar-def">{pillar.definition}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
