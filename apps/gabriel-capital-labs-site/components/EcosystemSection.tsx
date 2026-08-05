"use client";

import { useEffect, useRef } from "react";
import { ensureGsapRegistered, gsap } from "@/lib/gsap";
import { ecosystem } from "@/content/site";

// D15 — each wing gets its own restrained architectural identity rather
// than four identical blocks: an alternating numeral gutter, one
// full-measure wing, and a staggered hairline inset. No added ornament,
// just grid position/measure variation, matched 1:1 to the four domains.
const WING_VARIANTS = ["", "offset", "wide", "inset"];

export default function EcosystemSection() {
  const rootRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    ensureGsapRegistered();

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const wings = gsap.utils.toArray<HTMLElement>(".ecosystem__wing");
        wings.forEach((wing) => {
          // D22 — clip-path animated alone. Pairing it with opacity:0.001
          // left a transient near-invisible-but-technically-painted frame;
          // the clip-path reveal alone is a clean wipe with no such artifact.
          gsap.fromTo(
            wing,
            { clipPath: "inset(0 0 100% 0)" },
            {
              clipPath: "inset(0 0 0% 0)",
              duration: 0.9,
              ease: "power3.inOut",
              scrollTrigger: {
                trigger: wing,
                start: "top 82%",
                once: true,
              },
            }
          );
        });
      });

      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set(".ecosystem__wing", { clipPath: "none", opacity: 1 });
      });
    }, rootRef);

    return () => ctx.revert();
  }, []);

  return (
    <section id="ecosystem" ref={rootRef} className="ecosystem" aria-labelledby="ecosystem-heading">
      <div className="container ecosystem__header">
        <p className="chapter-mark">{ecosystem.chapterMark}</p>
        <h2 id="ecosystem-heading" className="ecosystem__intro">
          {ecosystem.intro}
        </h2>
      </div>

      <div>
        {ecosystem.domains.map((domain, i) => (
          <article
            key={domain.name}
            className={`ecosystem__wing${WING_VARIANTS[i % WING_VARIANTS.length] ? ` ecosystem__wing--${WING_VARIANTS[i % WING_VARIANTS.length]}` : ""}`}
          >
            <div className="container">
              <div className="ecosystem__wing-top">
                <span className="ecosystem__wing-numeral">{domain.numeral}</span>
                <h3 className="ecosystem__wing-name">{domain.name}</h3>
              </div>
              <p className="ecosystem__wing-designation">{domain.designation}</p>
              <p className="ecosystem__wing-status">{domain.status}</p>
              <p className="ecosystem__wing-desc">{domain.description}</p>
              {domain.link ? (
                <a
                  className="ecosystem__wing-link"
                  href={domain.link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {domain.link.label}
                </a>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
