"use client";

import { useEffect, useRef } from "react";
import { ensureGsapRegistered, gsap } from "@/lib/gsap";
import { institution } from "@/content/site";

export default function InstitutionSection() {
  const rootRef = useRef<HTMLElement | null>(null);
  const ruleFillRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    ensureGsapRegistered();

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const lines = gsap.utils.toArray<HTMLElement>(".institution__heading-line span");
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

        const paras = gsap.utils.toArray<HTMLElement>(".institution__paragraphs p");
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
      });

      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set(".institution__heading-line span", { y: "0%" });
        gsap.set(".institution__paragraphs p", { opacity: 1, y: 0 });
        if (ruleFillRef.current) gsap.set(ruleFillRef.current, { height: "100%" });
      });
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
      <div className="institution__rule-v" aria-hidden="true">
        <div ref={ruleFillRef} className="institution__rule-v-fill" />
      </div>
      <div className="container institution__grid">
        <p className="chapter-mark institution__mark">{institution.chapterMark}</p>

        <h2 id="institution-heading" className="institution__heading">
          {institution.headingLines.map((line, i) => (
            <span className="institution__heading-line" key={i}>
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
    </section>
  );
}
