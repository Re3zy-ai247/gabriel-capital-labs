"use client";

import { useEffect, useRef } from "react";
import { ensureGsapRegistered, gsap } from "@/lib/gsap";
import { engagement, contactHref, contactIsPlaceholder } from "@/content/site";

export default function EngagementSection() {
  const rootRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    ensureGsapRegistered();

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
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
      });

      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set(
          ".engagement__glow, .engagement__mark, .engagement__heading, .engagement__category",
          { opacity: 1, y: 0 }
        );
      });
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
          {engagement.heading}
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
