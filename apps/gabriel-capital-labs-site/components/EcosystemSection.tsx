"use client";

import { useEffect, useRef } from "react";
import {
  ensureGsapRegistered,
  gsap,
  REDUCED_MOTION_QUERY,
  DESKTOP_MOTION_QUERY,
  MOBILE_MOTION_QUERY,
} from "@/lib/gsap";
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

          const wings = gsap.utils.toArray<HTMLElement>(".ecosystem__wing");

          if (isReduced) {
            gsap.set(wings, { clipPath: "none", opacity: 1, x: 0 });
            gsap.set(".ecosystem__wing-rule", { scaleX: 1 });
            gsap.set(
              ".ecosystem__wing-numeral, .ecosystem__wing-name, .ecosystem__wing-designation, .ecosystem__wing-status, .ecosystem__wing-desc, .ecosystem__wing-link",
              { opacity: 1, y: 0 }
            );
            return undefined;
          }

          if (isMobile) {
            // Exactly the pre-R2 behavior — untouched.
            wings.forEach((wing) => {
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
            return undefined;
          }

          if (isDesktop) {
            // R2 2.4 — each wing enters via a horizontal clip-path wipe
            // from alternating sides + a 60px translateX settle + a
            // hairline draw, with its content staggering in
            // (numeral → name → designation → status → description →
            // link, 80ms steps). The previous wing dims to 0.5 as the
            // next one enters — one room receding as the next opens.
            wings.forEach((wing, i) => {
              const fromLeft = i % 2 === 0;
              const content = wing.querySelectorAll<HTMLElement>(
                ".ecosystem__wing-numeral, .ecosystem__wing-name, .ecosystem__wing-designation, .ecosystem__wing-status, .ecosystem__wing-desc, .ecosystem__wing-link"
              );
              const rule = wing.querySelector<HTMLElement>(".ecosystem__wing-rule");

              const tl = gsap.timeline({
                scrollTrigger: {
                  trigger: wing,
                  start: "top 82%",
                  once: true,
                },
              });

              tl.fromTo(
                wing,
                {
                  clipPath: fromLeft ? "inset(0 100% 0 0)" : "inset(0 0 0 100%)",
                  x: fromLeft ? -60 : 60,
                },
                { clipPath: "inset(0 0 0 0)", x: 0, duration: 0.9, ease: "power3.inOut" },
                0
              );

              if (rule) {
                tl.fromTo(
                  rule,
                  { scaleX: 0 },
                  { scaleX: 1, duration: 0.6, ease: "power2.out" },
                  0.2
                );
              }

              tl.fromTo(
                content,
                { opacity: 0, y: 12 },
                { opacity: 1, y: 0, duration: 0.5, ease: "power2.out", stagger: 0.08 },
                0.35
              );

              if (i > 0) {
                tl.to(wings[i - 1], { opacity: 0.5, duration: 0.6, ease: "power2.out" }, 0);
              }
            });

            return undefined;
          }

          return undefined;
        }
      );
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
            <span className="ecosystem__wing-rule" aria-hidden="true" />
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
