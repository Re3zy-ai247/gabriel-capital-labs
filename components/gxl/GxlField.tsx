"use client";
import { useEffect, useRef, useState } from "react";

// GXL styleframe — the Quiet Lattice field (Plane 0). A whisper-opacity web of
// hairline threads whose density derives from REAL aggregates (GXL L10: aliveness
// is never simulated). Motion is a single slow luminance breath across threads —
// sub-perceptual, state-driven, dead-still when the room is quiet.
//
// Etiquette (same laws as the production ambient layer, reimplemented here so no
// production component is touched): reduced-motion/Save-Data ⇒ never mounts
// (static CSS grain remains); paused when hidden/offscreen; DPR ≤ 2; deterministic
// (index-hashed geometry, no RNG); full cleanup; viewport-bounded sticky canvas.
export interface GxlFieldState { total: number; awaiting: number; active: number }

const MAX_DPR = 2;

function hash(i: number, j: number): number {
  const n = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

export function GxlField({ state, tint }: { state: GxlFieldState; tint: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [active, setActive] = useState(false);
  const { total, awaiting, active: liveCount } = state;

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    type NavConn = Navigator & { connection?: { saveData?: boolean } };
    if (reduced.matches || (navigator as NavConn).connection?.saveData === true) return;
    let cancelled = false;
    const start = () => { if (!cancelled) setActive(true); };
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    const h = idle ? idle(start, { timeout: 1500 }) : window.setTimeout(start, 1200);
    const onChange = () => { if (reduced.matches) setActive(false); };
    reduced.addEventListener?.("change", onChange);
    return () => { cancelled = true; if (!idle) window.clearTimeout(h as number); reduced.removeEventListener?.("change", onChange); };
  }, []);

  useEffect(() => {
    if (!active) return;
    const wrap = wrapRef.current, stick = stickRef.current, canvas = canvasRef.current;
    if (!wrap || !stick || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Lattice density from real state: node count scales with the record's size,
    // breath rate with live work — bounded, calm.
    const nodes = Math.min(26, 10 + Math.floor(total / 4));
    const breath = 0.22 + Math.min(liveCount, 20) * 0.012;
    const warmThreads = Math.min(awaiting, 6); // threads that carry the gold flag tone

    let raf = 0, running = false, visible = true, onScreen = true, W = 0, H = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const resize = () => {
      const r = stick.getBoundingClientRect();
      W = Math.ceil(r.width); H = Math.ceil(r.height);
      canvas.width = W * dpr; canvas.height = H * dpr;
      canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (now: number) => {
      raf = 0;
      if (!running) return;
      const t = now / 1000;
      ctx.clearRect(0, 0, W, H);
      // Deterministic node positions; threads connect near neighbors.
      const pts: Array<[number, number]> = [];
      for (let i = 0; i < nodes; i++) {
        pts.push([hash(i, 1) * W, hash(i, 7) * H]);
      }
      let threadIdx = 0;
      for (let i = 0; i < nodes; i++) {
        for (let j = i + 1; j < nodes; j++) {
          const dx = pts[i][0] - pts[j][0], dy = pts[i][1] - pts[j][1];
          const d2 = dx * dx + dy * dy;
          if (d2 > (W * 0.28) * (W * 0.28)) continue;
          const p = hash(i, j) * Math.PI * 2;
          const a = 0.015 + 0.02 * (0.5 + 0.5 * Math.sin(t * breath + p));
          const warm = threadIdx < warmThreads;
          ctx.strokeStyle = warm ? `rgba(227,169,46,${(a * 1.4).toFixed(3)})` : `rgba(148,163,184,${a.toFixed(3)})`;
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(pts[i][0], pts[i][1]);
          ctx.lineTo(pts[j][0], pts[j][1]);
          ctx.stroke();
          threadIdx++;
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
    const onVis = () => { visible = !document.hidden; setRunning(); };
    const io = new IntersectionObserver((e) => { onScreen = e[0]?.isIntersecting ?? true; setRunning(); });
    const ro = new ResizeObserver(resize);
    resize(); io.observe(wrap); ro.observe(stick);
    document.addEventListener("visibilitychange", onVis);
    visible = !document.hidden; setRunning();
    return () => {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      io.disconnect(); ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [active, total, awaiting, liveCount]);

  return (
    <div ref={wrapRef} aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-clip">
      <div className={`absolute inset-0 bg-gradient-to-b ${tint} via-transparent to-transparent`} />
      {active && (
        <div ref={stickRef} className="sticky top-0 h-screen">
          <canvas ref={canvasRef} className="absolute inset-0" />
        </div>
      )}
    </div>
  );
}
