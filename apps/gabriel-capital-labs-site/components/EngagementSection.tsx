"use client";

import { useEffect, useRef } from "react";
import {
  ensureGsapRegistered,
  gsap,
  scrollTimeline,
  REDUCED_MOTION_QUERY,
  DESKTOP_MOTION_QUERY,
  DESKTOP_REDUCED_QUERY,
  MOBILE_MOTION_QUERY,
} from "@/lib/gsap";
import { revealFromTo } from "@/lib/motion";
import { engagement } from "@/content/site";

export default function EngagementSection() {
  const rootRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    ensureGsapRegistered();

    const applyStaticFallback = () => {
      gsap.set(
        ".engagement__chapter-mark, .engagement__category",
        { opacity: 1, y: 0 }
      );
    };

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

          const buildScene = (reduced: boolean) => {
            const tl = scrollTimeline({
              trigger: rootRef.current,
              start: "top 74%",
              once: true,
            });
            const [chapterFrom, chapterTo] = revealFromTo(
              reduced,
              { opacity: 0, y: 14 },
              { opacity: 1, y: 0, duration: 0.7, ease: "power2.out" }
            );
            const [rowFrom, rowTo] = revealFromTo(
              reduced,
              { opacity: 0, y: 12 },
              { opacity: 1, y: 0, duration: 0.5, ease: "power2.out", stagger: 0.08 }
            );

            tl.fromTo(".engagement__chapter-mark", chapterFrom, chapterTo, 0).fromTo(
              ".engagement__category",
              rowFrom,
              rowTo,
              0.28
            );

            return () => tl.scrollTrigger?.kill();
          };

          try {
            // The desktop reduced branch also matches the raw reduced query;
            // preserve the Third Motion Class before considering mobile-static.
            if (isDesktopReduced) return buildScene(true);
            if (isReduced) {
              applyStaticFallback();
              return undefined;
            }
            if (isMobile || isDesktop) return buildScene(false);
          } catch (error) {
            console.error("[EngagementSection] scene failed, falling back to static", error);
            applyStaticFallback();
          }

          return undefined;
        }
      );
    }, rootRef);

    return () => ctx.revert();
  }, []);

  return (
    <section id="contact" ref={rootRef} className="engagement" aria-labelledby="engagement-heading">
      <div className="container engagement__inner">
        <h2 id="engagement-heading" className="chapter-mark engagement__chapter-mark">
          {engagement.chapterMark}
        </h2>

        <ul className="engagement__categories">
          {engagement.categories.map((category) => (
            <li key={category.label} className="engagement__category">
              <a className="engagement__category-link" href={category.href}>
                <span className="engagement__category-label">{category.label}</span>
                <span className="engagement__category-desc">{category.description}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
