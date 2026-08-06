"use client";

import { useEffect, useRef, useState } from "react";
import {
  ensureGsapRegistered,
  gsap,
  REDUCED_MOTION_QUERY,
  DESKTOP_MOTION_QUERY,
  MOBILE_MOTION_QUERY,
} from "@/lib/gsap";
import { principles } from "@/content/site";

export default function PrinciplesSection() {
  const rootRef = useRef<HTMLElement | null>(null);
  const pinRef = useRef<HTMLDivElement | null>(null);
  const progressFillRef = useRef<HTMLDivElement | null>(null);
  const progressLabelRef = useRef<HTMLSpanElement | null>(null);
  const [isStatic, setIsStatic] = useState(false);

  const total = principles.items.length;

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
            setIsStatic(true);
            return undefined;
          }

          if (isMobile) {
            // Exactly the pre-R2 behavior — untouched. See D4: only one
            // principle is ever mid-transition (autoAlpha only, no
            // y-motion), overwrite:'auto' guards a fast scrub.
            setIsStatic(false);
            const items = gsap.utils.toArray<HTMLElement>(".principles__item");
            gsap.set(items, { autoAlpha: (i) => (i === 0 ? 1 : 0) });
            let activeIndex = 0;

            const st = gsap.timeline({
              scrollTrigger: {
                trigger: rootRef.current,
                start: "top top",
                end: "+=250%",
                scrub: true,
                pin: pinRef.current,
                pinSpacing: true,
                onUpdate: (self) => {
                  const idx = Math.min(total - 1, Math.floor(self.progress * total));
                  if (idx !== activeIndex) {
                    gsap.to(items[activeIndex], {
                      autoAlpha: 0,
                      duration: 0.3,
                      ease: "power1.out",
                      overwrite: "auto",
                    });
                    gsap.to(items[idx], {
                      autoAlpha: 1,
                      duration: 0.3,
                      ease: "power1.out",
                      overwrite: "auto",
                    });
                    activeIndex = idx;
                  }
                  if (progressFillRef.current) {
                    progressFillRef.current.style.width = `${((idx + 1) / total) * 100}%`;
                  }
                  if (progressLabelRef.current) {
                    progressLabelRef.current.textContent = `${idx + 1}/${total}`;
                  }
                },
              },
            });

            return () => {
              st.scrollTrigger?.kill();
            };
          }

          if (isDesktop) {
            // R2 2.6 — same pin/mechanism ("no structural change"), refined
            // pacing: the incoming principle rises 24px + settles while
            // the outgoing one sinks, and the progress numeral gets a
            // brief crossfade pulse rather than an instant text swap. The
            // continuous gold fill (driven every onUpdate tick, same as
            // mobile) already scrubs smoothly — unchanged.
            setIsStatic(false);
            const items = gsap.utils.toArray<HTMLElement>(".principles__item");
            gsap.set(items, { autoAlpha: (i) => (i === 0 ? 1 : 0), y: 0 });
            let activeIndex = 0;

            const st = gsap.timeline({
              scrollTrigger: {
                trigger: rootRef.current,
                start: "top top",
                end: "+=250%",
                scrub: true,
                pin: pinRef.current,
                pinSpacing: true,
                onUpdate: (self) => {
                  const idx = Math.min(total - 1, Math.floor(self.progress * total));
                  if (idx !== activeIndex) {
                    gsap.fromTo(
                      items[activeIndex],
                      { y: 0 },
                      { autoAlpha: 0, y: 20, duration: 0.35, ease: "power1.out", overwrite: "auto" }
                    );
                    gsap.fromTo(
                      items[idx],
                      { y: 24 },
                      { autoAlpha: 1, y: 0, duration: 0.35, ease: "power1.out", overwrite: "auto" }
                    );
                    activeIndex = idx;

                    if (progressLabelRef.current) {
                      gsap.fromTo(
                        progressLabelRef.current,
                        { opacity: 0.4 },
                        { opacity: 1, duration: 0.3, ease: "power1.out", overwrite: "auto" }
                      );
                    }
                  }
                  if (progressFillRef.current) {
                    progressFillRef.current.style.width = `${((idx + 1) / total) * 100}%`;
                  }
                  if (progressLabelRef.current) {
                    progressLabelRef.current.textContent = `${idx + 1}/${total}`;
                  }
                },
              },
            });

            return () => {
              st.scrollTrigger?.kill();
            };
          }

          return undefined;
        }
      );
    }, rootRef);

    return () => ctx.revert();
  }, [total]);

  return (
    <section
      id="principles"
      ref={rootRef}
      className={`principles${isStatic ? " principles--static" : ""}`}
      aria-labelledby="principles-heading"
    >
      <div ref={pinRef} className="principles__pin">
        <div className="principles__header">
          <p className="chapter-mark" style={{ justifyContent: "center" }}>
            {principles.chapterMark}
          </p>
          <h2 id="principles-heading" className="visually-hidden">
            Principles
          </h2>
        </div>

        {principles.items.map((item, i) => (
          <div
            key={item.numeral}
            className={`principles__item${i === 0 ? " principles__item--active" : ""}`}
          >
            <span className="principles__item-numeral">{item.numeral}</span>
            <h3 className="principles__item-title">{item.title}</h3>
            <p className="principles__item-statement">{item.statement}</p>
          </div>
        ))}

        <div className="principles__progress" aria-hidden="true">
          <div className="principles__progress-track">
            <div ref={progressFillRef} className="principles__progress-fill" />
          </div>
          <span ref={progressLabelRef} className="principles__progress-label">
            1/{total}
          </span>
        </div>
      </div>
    </section>
  );
}
