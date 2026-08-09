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
import { pinEnd } from "@/lib/motion";
import { institutionalOutro } from "@/content/site";

const SIGNAL_DIM = "rgba(212, 161, 70, 0.35)";
const SIGNAL_LIT = "#d4a146";

export default function InstitutionalOutroScene() {
  const rootRef = useRef<HTMLElement | null>(null);
  const pinRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    ensureGsapRegistered();

    const applyStaticFallback = () => {
      gsap.set(
        ".institutional-outro__field, .institutional-outro__light, .institutional-outro__signal, .institutional-outro__mark-wrap, .institutional-outro__line",
        { opacity: 1, visibility: "visible" }
      );
      gsap.set(
        ".institutional-outro__signal, .institutional-outro__mark-wrap, .institutional-outro__line",
        { clearProps: "transform" }
      );
      gsap.set(".institutional-outro__signal", { backgroundColor: SIGNAL_LIT });
      gsap.set(".institutional-outro__line", { color: "#e6e6e6" });
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

          const buildScene = (reduced: boolean, pinned: boolean) => {
            if (reduced) {
              gsap.set(
                ".institutional-outro__signal, .institutional-outro__mark-wrap, .institutional-outro__line",
                { clearProps: "transform" }
              );
            }

            const tl = scrollTimeline({
              trigger: rootRef.current,
              start: pinned ? "top top" : "top 78%",
              end: pinned ? pinEnd(reduced, 100) : undefined,
              pin: pinned ? pinRef.current : false,
              pinSpacing: pinned,
              scrub: pinned ? (reduced ? 0.45 : 0.8) : false,
              once: !pinned,
              anticipatePin: pinned ? 1 : 0,
              invalidateOnRefresh: true,
              id: "gcl-institutional-outro",
            });

            tl.fromTo(
              ".institutional-outro__field",
              { opacity: 0.45 },
              { opacity: 1, duration: 0.16, ease: "none" },
              0
            ).fromTo(
              ".institutional-outro__light",
              { opacity: 0 },
              { opacity: reduced ? 0.48 : 0.68, duration: 0.2, ease: "power1.out" },
              0.06
            );

            if (reduced) {
              tl.fromTo(
                ".institutional-outro__signal",
                { opacity: 0, backgroundColor: SIGNAL_DIM },
                { opacity: 1, backgroundColor: SIGNAL_LIT, duration: 0.16, ease: "power2.out" },
                0.14
              ).fromTo(
                ".institutional-outro__mark-wrap",
                { opacity: 0 },
                { opacity: 1, duration: 0.22, ease: "power2.out" },
                0.28
              );
            } else {
              tl.fromTo(
                ".institutional-outro__signal",
                { opacity: 0, scaleX: 0.18 },
                { opacity: 1, scaleX: 1, duration: 0.16, ease: "power2.out" },
                0.14
              ).fromTo(
                ".institutional-outro__mark-wrap",
                { autoAlpha: 0, y: 16, scale: 0.94 },
                { autoAlpha: 1, y: 0, scale: 1, duration: 0.22, ease: "power3.out" },
                0.28
              );
            }

            tl.to(
              ".institutional-outro__signal",
              { opacity: 0.42, duration: 0.12, ease: "power1.out" },
              0.5
            );

            if (reduced) {
              tl.fromTo(
                ".institutional-outro__line",
                { opacity: 0, color: "#a7a9ac" },
                {
                  opacity: 1,
                  color: "#e6e6e6",
                  duration: 0.22,
                  ease: "power2.out",
                  stagger: 0.06,
                },
                0.54
              );
            } else {
              tl.fromTo(
                ".institutional-outro__line",
                { opacity: 0, y: 18 },
                { opacity: 1, y: 0, duration: 0.22, ease: "power3.out", stagger: 0.06 },
                0.54
              );
            }

            // The final quarter is intentionally unchanged: the institutional
            // mark and sentence hold before document flow releases the footer.
            tl.to(".institutional-outro__composition", { opacity: 1, duration: 0.24 }, 0.76);

            return () => tl.scrollTrigger?.kill();
          };

          try {
            // Desktop-reduced must win over the broad reduced query so the
            // Third Motion Class retains its shorter, opacity/luminance pin.
            if (isDesktopReduced) return buildScene(true, true);
            if (isReduced) {
              applyStaticFallback();
              return undefined;
            }
            if (isMobile) return buildScene(false, false);
            if (isDesktop) return buildScene(false, true);
          } catch (error) {
            console.error("[InstitutionalOutroScene] scene failed, falling back to static", error);
            applyStaticFallback();
          }

          return undefined;
        }
      );
    }, rootRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      id="institutional-outro"
      ref={rootRef}
      className="institutional-outro"
      aria-labelledby="institutional-outro-heading"
    >
      <div ref={pinRef} className="institutional-outro__pin">
        <div className="institutional-outro__field" aria-hidden="true" />
        <div className="institutional-outro__light" aria-hidden="true" />

        <div className="institutional-outro__composition">
          <span className="institutional-outro__signal" aria-hidden="true" />

          <div className="institutional-outro__mark-wrap">
            <picture>
              <source type="image/webp" srcSet="/img/gateway-g-480.webp" />
              <img
                className="institutional-outro__mark"
                src="/img/gateway-g-480.png"
                width={480}
                height={520}
                alt=""
                aria-hidden="true"
                loading="lazy"
              />
            </picture>
          </div>

          <h2 id="institutional-outro-heading" className="institutional-outro__heading">
            <span className="institutional-outro__line">{institutionalOutro.headingLines[0]}</span>{" "}
            <span className="institutional-outro__line">{institutionalOutro.headingLines[1]}</span>
          </h2>
        </div>
      </div>
    </section>
  );
}
