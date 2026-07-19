"use client";
import { useEffect, useRef, useState } from "react";

// GXL styleframe — the Provenance Pull (the signature verb, §8/§12 of GXL).
// Press-and-hold (or click, or Enter — every modality reaches the verb, §13) on
// any element marked [data-gxl-claim] and its thread draws taut from the claim
// to the Exhibit: the stamped record backing it, surfaced in the margin.
// One thread at a time, always. Escape or release-elsewhere lets the lattice rest.
//
// Motion law: the thread-draw IS computation being revealed (provenance
// resolution) — 320ms, decelerating, no bounce. Under reduced motion the thread
// appears complete instantly and the exhibit shows immediately (M5: zero
// information lost, merely still).
//
// The exhibit's contents are REAL record fields carried on data attributes —
// nothing fabricated (L10). This island is delegated + overlay-only: it renders
// one fixed SVG line + one exhibit card, and touches no server-rendered markup.

interface Exhibit {
  title: string; room: string; filed: string; author: string; responses: string; state: string;
  x1: number; y1: number; x2: number; y2: number;
}

const HOLD_MS = 350;

export function GxlPull() {
  const [exhibit, setExhibit] = useState<Exhibit | null>(null);
  const [drawn, setDrawn] = useState(false);
  const holdTimer = useRef<number>(0);
  const reducedRef = useRef(false);

  useEffect(() => {
    reducedRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const openFrom = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      const margin = document.getElementById("gxl-exhibit-anchor")?.getBoundingClientRect();
      const x2 = margin ? margin.left + 18 : window.innerWidth - 280;
      const y2 = margin ? Math.max(margin.top + 24, 96) : 120;
      setExhibit({
        title: el.dataset.gxlTitle ?? "",
        room: el.dataset.gxlRoom ?? "",
        filed: el.dataset.gxlFiled ?? "",
        author: el.dataset.gxlAuthor ?? "",
        responses: el.dataset.gxlResponses ?? "0",
        state: el.dataset.gxlState ?? "",
        x1: r.right, y1: r.top + r.height / 2, x2, y2,
      });
      setDrawn(reducedRef.current); // reduced motion: complete instantly
      if (!reducedRef.current) requestAnimationFrame(() => requestAnimationFrame(() => setDrawn(true)));
    };

    const claimOf = (t: EventTarget | null) => (t as Element | null)?.closest?.("[data-gxl-claim]") as HTMLElement | null;

    const onDown = (e: PointerEvent) => {
      const el = claimOf(e.target);
      if (!el) return;
      window.clearTimeout(holdTimer.current);
      holdTimer.current = window.setTimeout(() => openFrom(el), HOLD_MS);
    };
    const cancelHold = () => window.clearTimeout(holdTimer.current);
    const onClick = (e: MouseEvent) => {
      const el = claimOf(e.target);
      if (el) { e.preventDefault(); openFrom(el); }
      else if (!(e.target as Element | null)?.closest?.("#gxl-exhibit")) setExhibit(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExhibit(null);
      if (e.key === "Enter") { const el = claimOf(e.target); if (el) { e.preventDefault(); openFrom(el); } }
    };

    document.addEventListener("pointerdown", onDown, { passive: true });
    document.addEventListener("pointerup", cancelHold, { passive: true });
    document.addEventListener("pointercancel", cancelHold, { passive: true });
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(holdTimer.current);
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("pointerup", cancelHold);
      document.removeEventListener("pointercancel", cancelHold);
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  if (!exhibit) return null;
  const len = Math.hypot(exhibit.x2 - exhibit.x1, exhibit.y2 - exhibit.y1);
  return (
    <>
      {/* The thread — Plane 3 overlay, one only, retracts on close. */}
      <svg aria-hidden="true" className="pointer-events-none fixed inset-0 z-40 h-full w-full">
        <line
          x1={exhibit.x1} y1={exhibit.y1} x2={exhibit.x2} y2={exhibit.y2}
          stroke="rgba(40,194,219,0.55)" strokeWidth="1"
          strokeDasharray={len} strokeDashoffset={drawn ? 0 : len}
          style={{ transition: "stroke-dashoffset 320ms cubic-bezier(0.16,1,0.3,1)" }}
        />
        <circle cx={exhibit.x1} cy={exhibit.y1} r="2" fill="rgba(40,194,219,0.7)" />
      </svg>
      {/* The Exhibit — the stamped record backing the claim (real fields only). */}
      <aside
        id="gxl-exhibit"
        aria-label="Provenance exhibit"
        className="fixed right-4 top-24 z-50 w-64 border border-ocean-500/40 bg-ink-900/95 p-4 shadow-xl"
        style={{ opacity: drawn ? 1 : 0, transition: "opacity 200ms ease 160ms" }}
      >
        <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-slate-500">
          <span>Exhibit — the record</span>
          <button onClick={() => setExhibit(null)} className="text-slate-500 hover:text-slate-200" aria-label="Close exhibit">✕</button>
        </div>
        <p className="font-serif text-sm leading-snug text-slate-100">{exhibit.title}</p>
        <dl className="mt-3 space-y-1.5 border-t border-ink-700/60 pt-2 text-[11px] text-slate-400">
          <div className="flex justify-between"><dt className="uppercase tracking-wide text-slate-600">Filed</dt><dd className="tnum">{exhibit.filed}</dd></div>
          <div className="flex justify-between"><dt className="uppercase tracking-wide text-slate-600">Workspace</dt><dd>{exhibit.room}</dd></div>
          <div className="flex justify-between"><dt className="uppercase tracking-wide text-slate-600">Entered by</dt><dd className="truncate pl-2">{exhibit.author}</dd></div>
          <div className="flex justify-between"><dt className="uppercase tracking-wide text-slate-600">Responses</dt><dd className="tnum">{exhibit.responses}</dd></div>
          <div className="flex justify-between"><dt className="uppercase tracking-wide text-slate-600">State</dt><dd className="text-slate-300">{exhibit.state}</dd></div>
        </dl>
        <p className="mt-3 border-t border-ink-700/60 pt-2 text-[10px] leading-relaxed text-slate-600">
          Every statement traces to its record. Nothing asserts without provenance.
        </p>
      </aside>
    </>
  );
}
