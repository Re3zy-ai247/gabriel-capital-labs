"use client";

import { useEffect, useRef, useState } from "react";
import { detectTier, type CxTier } from "@/lib/cxos/capability";
import { isDirectorActive } from "@/lib/cxos/reviewMode";

// CXOS Phase 3 — the landing-journey runtime.
//
// One tiny engine drives every chapter: it stamps the capability tier on
// <html> and, on tiers A/B, writes each chapter's scroll progress into its
// own --cxp custom property. ALL choreography lives in CSS on top of that
// number — this file never animates anything itself.
//
// The engine is the repository's own Parallax.tsx discipline, generalized:
//   • passive scroll/resize listeners, rAF-throttled — never blocks scrolling
//   • IntersectionObserver gates work to on-screen chapters only
//   • transform/opacity-only choreography — zero layout writes from CSS
//   • tier D (reduced motion, or the footer toggle) mounts NOTHING: the
//     document is not even stamped, and the page is its server-rendered self
//
// Native scroll stays authoritative by construction: there is no wheel
// handler, no touch handler, no preventDefault anywhere in the journey.
export function JourneyRuntime() {
  const [director, setDirector] = useState(false);
  const [tier, setTier] = useState<CxTier>("A");
  const [forced, setForced] = useState<CxTier | null>(null);
  const baseTier = useRef<CxTier>("D");

  useEffect(() => {
    const detected = detectTier();
    baseTier.current = detected;
    setTier(detected);
    setDirector(isDirectorActive());
  }, []);

  // The active tier: a Director force-preview may DOWNGRADE the projection or
  // restore the detected tier, but a reduced-motion visitor is tier D
  // absolutely — no instrument overrides accessibility.
  const active: CxTier = baseTier.current === "D" ? "D" : forced ?? tier;

  useEffect(() => {
    if (active === "D") return; // nothing stamped, nothing listened to
    const html = document.documentElement;
    html.setAttribute("data-cxjourney", active);

    const chapters = Array.from(document.querySelectorAll<HTMLElement>("[data-chapter]"));
    if (chapters.length === 0) return () => html.removeAttribute("data-cxjourney");

    const onScreen = new Set<HTMLElement>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const el = e.target as HTMLElement;
          if (e.isIntersecting) {
            onScreen.add(el);
            el.setAttribute("data-chapter-state", "active");
          } else {
            onScreen.delete(el);
            el.setAttribute(
              "data-chapter-state",
              e.boundingClientRect.top < 0 ? "passed" : "ahead"
            );
          }
        }
        schedule();
      },
      { rootMargin: "10% 0px 10% 0px" }
    );
    chapters.forEach((c) => io.observe(c));

    let raf = 0;
    const update = () => {
      raf = 0;
      if (document.hidden) return;
      const vh = window.innerHeight;
      // Tier C keeps the tier stamp (CSS settles) but skips progress writes.
      if (active === "C") return;
      onScreen.forEach((el) => {
        const rect = el.getBoundingClientRect();
        // 0 as the chapter's top meets the viewport bottom → 1 as its bottom
        // leaves the viewport top: one full viewport-crossing = one chapter arc.
        const p = (vh - rect.top) / (vh + rect.height);
        el.style.setProperty("--cxp", Math.min(1, Math.max(0, p)).toFixed(4));
      });
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    document.addEventListener("visibilitychange", schedule);
    schedule();

    return () => {
      html.removeAttribute("data-cxjourney");
      io.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      document.removeEventListener("visibilitychange", schedule);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [active]);

  if (!director) return null;
  return (
    <JourneyDirectorStrip
      active={active}
      locked={baseTier.current === "D"}
      onCycle={() =>
        setForced((f) => {
          const order: (CxTier | null)[] = [null, "B", "C", "D"];
          return order[(order.indexOf(f) + 1) % order.length];
        })
      }
    />
  );
}

// Director-only journey instrumentation: current chapter, live progress, the
// active tier, tier-projection cycling (reduced-motion / low-power previews),
// and chapter-boundary outlines. Ships only inside review-enabled builds'
// director sessions; renders nothing otherwise.
function JourneyDirectorStrip({
  active,
  locked,
  onCycle,
}: {
  active: CxTier;
  locked: boolean;
  onCycle: () => void;
}) {
  const [reading, setReading] = useState("—");
  const [bounds, setBounds] = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      const chapters = Array.from(document.querySelectorAll<HTMLElement>("[data-chapter]"));
      const activeCh = chapters.find(
        (c) => c.getAttribute("data-chapter-state") === "active"
      );
      setReading(
        activeCh
          ? `${activeCh.dataset.chapter} · p=${activeCh.style.getPropertyValue("--cxp") || "0"}`
          : "between chapters"
      );
    }, 250);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("cx-debug-bounds", bounds);
    return () => document.documentElement.classList.remove("cx-debug-bounds");
  }, [bounds]);

  return (
    <div className="fixed bottom-3 left-3 z-[90] flex items-center gap-2 rounded-lg border border-ink-600 bg-ink-950/90 px-3 py-2 font-mono text-[11px] text-slate-300 backdrop-blur">
      <span className="font-bold text-brand-300">JOURNEY</span>
      <span>{reading}</span>
      <button
        type="button"
        onClick={onCycle}
        disabled={locked}
        className="rounded border border-ink-600 px-1.5 py-0.5 hover:border-brand-500/60 disabled:opacity-50"
        title={locked ? "reduced-motion visitor — tier D is absolute" : "cycle tier projection"}
      >
        tier {active}
      </button>
      <button
        type="button"
        onClick={() => setBounds((b) => !b)}
        className="rounded border border-ink-600 px-1.5 py-0.5 hover:border-brand-500/60"
        aria-pressed={bounds}
      >
        bounds
      </button>
    </div>
  );
}
