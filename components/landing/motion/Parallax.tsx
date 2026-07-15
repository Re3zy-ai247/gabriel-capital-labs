"use client";
import { useEffect, useRef, type ReactNode } from "react";

// Subtle scroll-linked parallax (Sprint XXIII motion primitive). Foundation for the
// future cinematic homepage — kept deliberately gentle and cheap:
//   • transform-only (translate3d) → stays on the compositor, never triggers layout
//   • rAF-throttled, passive scroll listener → no scroll jank
//   • runs ONLY while on-screen (IntersectionObserver gate)
//   • FULLY DISABLED under prefers-reduced-motion (returns before wiring anything)
// `speed` is the fraction of scroll distance to offset by (0.1–0.3 reads as premium;
// higher feels gimmicky). Positive = element drifts up as you scroll down.
export function Parallax({
  children,
  speed = 0.15,
  className = "",
}: {
  children: ReactNode;
  speed?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    let onScreen = false;

    const update = () => {
      raf = 0;
      const rect = el.getBoundingClientRect();
      const fromCenter = rect.top + rect.height / 2 - window.innerHeight / 2;
      el.style.transform = `translate3d(0, ${(fromCenter * -speed).toFixed(1)}px, 0)`;
    };
    const schedule = () => { if (onScreen && !raf) raf = requestAnimationFrame(update); };

    const io = new IntersectionObserver(
      ([e]) => { onScreen = e.isIntersecting; if (onScreen) schedule(); },
      { threshold: 0 }
    );
    io.observe(el);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [speed]);

  return (
    <div ref={ref} className={className} style={{ willChange: "transform" }}>
      {children}
    </div>
  );
}
