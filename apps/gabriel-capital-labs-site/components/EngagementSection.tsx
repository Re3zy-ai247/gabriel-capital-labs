"use client";

import { useEffect, useRef } from "react";
import {
  ensureGsapRegistered,
  gsap,
  REDUCED_MOTION_QUERY,
  DESKTOP_MOTION_QUERY,
  MOBILE_MOTION_QUERY,
} from "@/lib/gsap";
import { engagement, contactHref, contactIsPlaceholder } from "@/content/site";

export default function EngagementSection() {
  const rootRef = useRef<HTMLElement | null>(null);
  const headingLineRef = useRef<HTMLSpanElement | null>(null);

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
            gsap.set(
              ".engagement__glow, .engagement__mark, .engagement__heading, .engagement__category",
              { opacity: 1, y: 0 }
            );
            if (headingLineRef.current) gsap.set(headingLineRef.current, { y: "0%" });
            return undefined;
          }

          if (isMobile) {
            // Exactly the pre-R2 behavior — untouched.
            gsap.fromTo(
              ".engagement__glow",
              { opacity: 0 },
              {
                opacity: 1,
                duration: 1.2,
                ease: "power2.out",
                scrollTrigger: { trigger: rootRef.current, start: "top 70%", once: true },
              }
            );
            gsap.fromTo(
              ".engagement__mark, .engagement__heading",
              { opacity: 0, y: 18 },
              {
                opacity: 1,
                y: 0,
                duration: 0.9,
                ease: "power2.out",
                stagger: 0.15,
                scrollTrigger: { trigger: rootRef.current, start: "top 65%", once: true },
              }
            );
            gsap.fromTo(
              ".engagement__category",
              { opacity: 0, y: 14 },
              {
                opacity: 1,
                y: 0,
                duration: 0.6,
                ease: "power2.out",
                stagger: 0.08,
                scrollTrigger: { trigger: ".engagement__categories", start: "top 85%", once: true },
              }
            );
            return undefined;
          }

          if (isDesktop) {
            // R2 2.7 — final resolve, in explicit sequence: mark + glow
            // fade up first (the glow mirrors Arrival's — a bookend),
            // then the headline mask-reveals (same technique as
            // Institution's heading lines), then the engagement rows
            // stagger in (defect C's grid, see globals.css).
            const tl = gsap.timeline({
              scrollTrigger: { trigger: rootRef.current, start: "top 70%", once: true },
            });

            tl.fromTo(".engagement__glow", { opacity: 0 }, { opacity: 1, duration: 1, ease: "power2.out" }, 0)
              .fromTo(
                ".engagement__mark",
                { opacity: 0, y: 18 },
                { opacity: 1, y: 0, duration: 0.8, ease: "power2.out" },
                0.15
              );

            if (headingLineRef.current) {
              tl.fromTo(
                headingLineRef.current,
                { y: "110%" },
                { y: "0%", duration: 0.8, ease: "power3.out" },
                0.5
              );
            }

            tl.fromTo(
              ".engagement__category",
              { opacity: 0, y: 14 },
              { opacity: 1, y: 0, duration: 0.5, ease: "power2.out", stagger: 0.08 },
              1.1
            );

            return () => {
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
      id="contact"
      ref={rootRef}
      className="engagement"
      aria-labelledby="engagement-heading"
    >
      <div className="engagement__glow" aria-hidden="true" />

      <div className="container">
        <p className="chapter-mark" style={{ justifyContent: "center" }}>
          {engagement.chapterMark}
        </p>

        <div className="engagement__mark">
          <picture>
            <source
              type="image/webp"
              srcSet="/img/gateway-g-480.webp"
            />
            <img
              src="/img/gateway-g-480.png"
              width={480}
              height={520}
              alt=""
              aria-hidden="true"
              loading="lazy"
            />
          </picture>
        </div>

        <h2 id="engagement-heading" className="engagement__heading">
          <span className="engagement__heading-mask">
            <span ref={headingLineRef} className="engagement__heading-line">
              {engagement.heading}
            </span>
          </span>
        </h2>

        <ul className="engagement__categories">
          {engagement.categories.map((category) =>
            contactIsPlaceholder ? (
              <li key={category.label} className="engagement__category">
                <div className="engagement__category-link engagement__category-link--static">
                  <span className="engagement__category-label">{category.label}</span>
                  <span className="engagement__category-desc">{category.description}</span>
                </div>
              </li>
            ) : (
              <li key={category.label} className="engagement__category">
                <a className="engagement__category-link" href={contactHref}>
                  <span className="engagement__category-label">{category.label}</span>
                  <span className="engagement__category-desc">{category.description}</span>
                </a>
              </li>
            )
          )}
        </ul>

        {contactIsPlaceholder ? (
          <p className="engagement__placeholder-note">
            Contact channels are being finalised.
          </p>
        ) : null}
      </div>
    </section>
  );
}
