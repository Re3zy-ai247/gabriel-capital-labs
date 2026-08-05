"use client";

import { useEffect, useRef } from "react";
import { ensureGsapRegistered, gsap } from "@/lib/gsap";
import { lab } from "@/content/site";

export default function LabSection() {
  const rootRef = useRef<HTMLElement | null>(null);
  const indexRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    ensureGsapRegistered();

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
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
      });

      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set(".lab__row", { opacity: 1, y: 0 });
      });
    }, rootRef);

    return () => ctx.revert();
  }, []);

  return (
    <section id="lab" ref={rootRef} className="lab" aria-labelledby="lab-heading">
      <div className="lab__grid-bg" aria-hidden="true" />
      <div className="container lab__header">
        <p className="chapter-mark">{lab.chapterMark}</p>
        <h2 id="lab-heading" className="lab__intro">
          {lab.intro}
        </h2>
      </div>

      <div className="container lab__index" ref={indexRef}>
        {lab.domains.map((domain) => (
          <div className="lab__row" key={domain.numeral}>
            <span className="lab__row-numeral">{domain.numeral}</span>
            <h3 className="lab__row-title">{domain.title}</h3>
          </div>
        ))}
      </div>
    </section>
  );
}
