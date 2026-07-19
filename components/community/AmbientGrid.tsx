"use client";
import { useEffect, useRef, useState } from "react";

// Operator Network ambient layer (Design Bible §4.3, plane 0) — a single canvas
// "intelligence grid": a dot lattice with slow deterministic drift and a small
// pointer-parallax depth response. It is peripheral and NEVER informational —
// if this component renders nothing, the product is complete.
//
// Laws implemented here:
//  • deterministic motion — phase comes from grid indices, no RNG anywhere;
//  • paused when the tab is hidden or the layer is off-viewport;
//  • prefers-reduced-motion / Save-Data ⇒ canvas never mounts (CSS gradient only);
//  • deferred mount (idle callback after LCP) so it costs nothing on first paint;
//  • pointer parallax is depth only (≤6px), applied to the lattice, never content;
//  • DPR capped at 2; frame work bounded to the visible area.
//
// No external libraries. No runtime asset generation.

const SPACING = 64; // px between lattice dots
const DRIFT_PX_PER_S = 3; // slow, sub-perceptual drift
const PARALLAX_MAX = 6; // px — Design Bible cap
const MAX_DPR = 2;

// Deterministic per-dot phase from lattice indices (no randomness).
function phase(col: number, row: number): number {
  const n = Math.sin(col * 12.9898 + row * 78.233) * 43758.5453;
  return (n - Math.floor(n)) * Math.PI * 2;
}

export function AmbientGrid() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [active, setActive] = useState(false);

  // Mount gate: idle (post-LCP), motion allowed, data saver off.
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    type NavConn = Navigator & { connection?: { saveData?: boolean } };
    const saveData = (navigator as NavConn).connection?.saveData === true;
    if (reduced.matches || saveData) return; // CSS fallback only

    let cancelled = false;
    const start = () => { if (!cancelled) setActive(true); };
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    const handle = idle ? idle(start, { timeout: 1500 }) : window.setTimeout(start, 1200);

    // If the user enables reduced motion mid-session, honor it immediately.
    const onChange = () => { if (reduced.matches) setActive(false); };
    reduced.addEventListener?.("change", onChange);
    return () => {
      cancelled = true;
      if (!idle) window.clearTimeout(handle as number);
      reduced.removeEventListener?.("change", onChange);
    };
  }, []);

  useEffect(() => {
    if (!active) return;
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Theme-aware dot color: read the wrapper's resolved text color once.
    const resolved = getComputedStyle(wrap).color || "rgb(148, 163, 184)";
    const rgb = resolved.startsWith("rgb") ? resolved.replace(/rgba?\(([^)]+)\)/, "$1").split(",").slice(0, 3).join(",") : "148,163,184";

    let raf = 0;
    let running = false;
    let visible = true; // page visibility
    let onScreen = true; // intersection
    let width = 0;
    let height = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 }; // current + target parallax offset

    const resize = () => {
      const r = wrap.getBoundingClientRect();
      width = Math.ceil(r.width);
      height = Math.ceil(r.height);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (now: number) => {
      raf = 0;
      if (!running) return;
      const t = now / 1000;
      // Ease the parallax toward its target (settled, no spring/overshoot).
      pointer.x += (pointer.tx - pointer.x) * 0.06;
      pointer.y += (pointer.ty - pointer.y) * 0.06;

      ctx.clearRect(0, 0, width, height);
      const drift = (t * DRIFT_PX_PER_S) % SPACING;
      const cols = Math.ceil(width / SPACING) + 2;
      const rows = Math.ceil(height / SPACING) + 2;
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const p = phase(c, r);
          // Sub-perceptual breathing: alpha oscillates slowly per dot.
          const alpha = 0.04 + 0.05 * (0.5 + 0.5 * Math.sin(t * 0.35 + p));
          const x = c * SPACING - drift + pointer.x;
          const y = r * SPACING - drift * 0.6 + pointer.y;
          ctx.fillStyle = `rgba(${rgb},${alpha.toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(x, y, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      raf = requestAnimationFrame(draw);
    };

    const setRunning = () => {
      const next = visible && onScreen;
      if (next === running) return;
      running = next;
      if (running && !raf) raf = requestAnimationFrame(draw);
      if (!running && raf) { cancelAnimationFrame(raf); raf = 0; }
    };

    const onVisibility = () => { visible = !document.hidden; setRunning(); };
    const io = new IntersectionObserver((entries) => { onScreen = entries[0]?.isIntersecting ?? true; setRunning(); });
    const onPointer = (e: PointerEvent) => {
      // Depth response only: offset the lattice a few px toward the pointer.
      const nx = e.clientX / window.innerWidth - 0.5;
      const ny = e.clientY / window.innerHeight - 0.5;
      pointer.tx = nx * PARALLAX_MAX * 2;
      pointer.ty = ny * PARALLAX_MAX * 2;
    };
    const ro = new ResizeObserver(resize);

    resize();
    io.observe(wrap);
    ro.observe(wrap);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pointermove", onPointer, { passive: true });
    visible = !document.hidden;
    setRunning();

    return () => {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointermove", onPointer);
    };
  }, [active]);

  return (
    <div ref={wrapRef} aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden text-slate-400">
      {/* Static fallback + base: always present, costs nothing, reads as depth. */}
      <div className="absolute inset-0 bg-gradient-to-b from-ocean-500/[0.04] via-transparent to-transparent" />
      {active && <canvas ref={canvasRef} className="absolute inset-0" />}
    </div>
  );
}
