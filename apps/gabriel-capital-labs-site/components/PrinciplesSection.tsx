"use client";

import { useEffect, useRef, useState } from "react";
import { ensureGsapRegistered, gsap } from "@/lib/gsap";
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

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        setIsStatic(false);
        const items = gsap.utils.toArray<HTMLElement>(".principles__item");

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
              items.forEach((el, i) => {
                el.classList.toggle("principles__item--active", i === idx);
              });
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
      });

      mm.add("(prefers-reduced-motion: reduce)", () => {
        setIsStatic(true);
      });
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
