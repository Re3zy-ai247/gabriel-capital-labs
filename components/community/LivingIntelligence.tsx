"use client";
import { useEffect } from "react";

// Living Intelligence layer (Phase 1.2) — the interaction language's behavior
// island. ONE component, TWO delegated listeners, ZERO per-card hydration:
//
//  1. Computation reveal: moving the pointer over a work item (.ops-card) sets
//     CSS custom properties (--lx/--ly) on that card; a pure-CSS overlay renders
//     a faint luminance that follows the cursor. The card itself stays server
//     HTML — the browser is doing the work, not React.
//  2. Room presence: considering a workspace door ([data-workspace]) dispatches
//     an `operator-focus` event; the ambient field leans in slightly (a small,
//     eased breath bias in AmbientGrid). Entering a room changes the atmosphere
//     because the ROOM changed — behavior, never decoration.
//
// Etiquette (same laws as the ambient layer): prefers-reduced-motion or
// Save-Data ⇒ this component attaches NOTHING; rAF-throttled; passive
// listeners; full cleanup; no information is conveyed that isn't available
// statically (Design Bible Law M2 — this layer is presence, not content).
export function LivingIntelligence() {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    type NavConn = Navigator & { connection?: { saveData?: boolean } };
    const saveData = (navigator as NavConn).connection?.saveData === true;
    if (reduced.matches || saveData) return;

    let raf = 0;
    let pending: { card: HTMLElement; x: number; y: number } | null = null;

    const onMove = (e: PointerEvent) => {
      const card = (e.target as Element | null)?.closest?.(".ops-card") as HTMLElement | null;
      if (!card) return;
      const r = card.getBoundingClientRect();
      pending = { card, x: e.clientX - r.left, y: e.clientY - r.top };
      if (!raf) {
        raf = requestAnimationFrame(() => {
          raf = 0;
          if (!pending) return;
          pending.card.style.setProperty("--lx", `${pending.x}px`);
          pending.card.style.setProperty("--ly", `${pending.y}px`);
          pending = null;
        });
      }
    };

    const onOver = (e: PointerEvent) => {
      const door = (e.target as Element | null)?.closest?.("[data-workspace]");
      if (!door) return;
      window.dispatchEvent(new CustomEvent("operator-focus", { detail: { room: door.getAttribute("data-workspace") } }));
    };

    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerover", onOver, { passive: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerover", onOver);
    };
  }, []);

  return null;
}
