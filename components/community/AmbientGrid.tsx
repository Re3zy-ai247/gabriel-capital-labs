"use client";
import { useEffect, useRef, useState } from "react";

// Operator Network ambient layer (Design Bible §4.3, plane 0) — a single canvas
// "intelligence grid" that is a sub-perceptual visualization of REAL network
// state, not decoration. The server passes aggregate, non-sensitive counts and
// the lattice derives from them deterministically:
//
//   • lattice density   ← total discussions      (a fuller network sits denser)
//   • breathing rate    ← recently-active count  (a working network breathes faster)
//   • attention accents ← open loops awaiting a first response (a few warmer dots)
//
// Only aggregate integers cross the server→client boundary — no content, no
// identifiers, no personal information. If this layer never renders, nothing
// is lost (it is peripheral and non-informational by law).
//
// Etiquette (unchanged from Phase 1):
//  • deterministic motion — phases come from grid indices, no RNG anywhere;
//  • paused when the tab is hidden or the layer is off-viewport;
//  • prefers-reduced-motion / Save-Data ⇒ canvas never mounts (CSS gradient only);
//  • deferred mount (idle callback after LCP);
//  • pointer parallax is depth only (≤6px), applied to the lattice, never content;
//  • DPR capped at 2; frame work bounded to the visible area.
//
// No external libraries. No runtime asset generation.

export interface AmbientState {
  total: number; // discussions in the network (capped upstream at the fetch cap)
  awaiting: number; // open loops: zero responses, not locked
  active: number; // threads with activity in the recent window
}

const PARALLAX_MAX = 6; // px — Design Bible cap
const MAX_DPR = 2;
const DRIFT_PX_PER_S = 3; // slow, sub-perceptual drift

// Deterministic per-dot phase from lattice indices (no randomness).
function phase(col: number, row: number): number {
  const n = Math.sin(col * 12.9898 + row * 78.233) * 43758.5453;
  return (n - Math.floor(n)) * Math.PI * 2;
}

// State → lattice parameters. Bounded, documented, deterministic.
function deriveParams(state: AmbientState) {
  const total = Math.max(0, Math.min(state.total, 120));
  const active = Math.max(0, Math.min(state.active, 20));
  const awaiting = Math.max(0, Math.min(state.awaiting, 10));
  return {
    spacing: 76 - total * 0.2, // 76px (quiet network) → 52px (full network)
    breath: 0.25 + active * 0.02, // alpha oscillation rate: 0.25 → 0.65 rad/s
    accents: awaiting, // number of attention-tinted dots per ~97-cell tile
  };
}

export function AmbientGrid({ state = { total: 0, awaiting: 0, active: 0 }, tint = "from-ocean-500/[0.04]" }: { state?: AmbientState; tint?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [active, setActive] = useState(false);
  // Primitive deps (not the object identity) so a re-render with equal values
  // never tears down the canvas/observers.
  const { total, awaiting, active: activeThreads } = state;

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
    const stick = stickRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !stick || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { spacing, breath, accents } = deriveParams({ total, awaiting, active: activeThreads });

    // Theme-aware base dot color from the wrapper's resolved text color; the
    // attention accent uses the gold/attention family at low alpha (Law C3:
    // saturation maps to "needs a person", and these dots ARE the open loops).
    const resolved = getComputedStyle(wrap).color || "rgb(148, 163, 184)";
    const rgb = resolved.startsWith("rgb") ? resolved.replace(/rgba?\(([^)]+)\)/, "$1").split(",").slice(0, 3).join(",") : "148,163,184";
    const accentRgb = "242,193,78"; // gold-400 — the attention family

    let raf = 0;
    let running = false;
    let visible = true;
    let onScreen = true;
    let width = 0;
    let height = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    // Room presence (Living Intelligence): considering a workspace door leans the
    // field in — a small, eased breath bias that decays back to rest. Behavior
    // tied to a real interaction, bounded, and imperceptible as "animation".
    const focus = { bias: 0, target: 0, decayAt: 0 };
    const onFocus = () => { focus.target = 0.12; focus.decayAt = performance.now() + 900; };

    const resize = () => {
      // Measure the STICKY viewport-sized frame, never the full-feed wrapper —
      // the canvas buffer and per-frame lattice loop must stay O(viewport),
      // independent of how tall the feed grows.
      const r = stick.getBoundingClientRect();
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
      pointer.x += (pointer.tx - pointer.x) * 0.06;
      pointer.y += (pointer.ty - pointer.y) * 0.06;
      if (now > focus.decayAt) focus.target = 0;
      focus.bias += (focus.target - focus.bias) * 0.04; // eased in, eased out
      const liveBreath = breath + focus.bias;

      ctx.clearRect(0, 0, width, height);
      const drift = (t * DRIFT_PX_PER_S) % spacing;
      const cols = Math.ceil(width / spacing) + 2;
      const rows = Math.ceil(height / spacing) + 2;
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const p = phase(c, r);
          // A cell is an attention accent iff its deterministic rank (0..96)
          // falls under the open-loop count — accent density tracks real state.
          const rank = Math.floor((p / (Math.PI * 2)) * 97);
          const isAccent = rank < accents;
          const alpha = isAccent
            ? 0.09 + 0.06 * (0.5 + 0.5 * Math.sin(t * liveBreath * 0.6 + p)) // slower, slightly warmer pulse
            : 0.04 + 0.05 * (0.5 + 0.5 * Math.sin(t * liveBreath + p));
          const x = c * spacing - drift + pointer.x;
          const y = r * spacing - drift * 0.6 + pointer.y;
          ctx.fillStyle = `rgba(${isAccent ? accentRgb : rgb},${alpha.toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(x, y, isAccent ? 1.3 : 1, 0, Math.PI * 2);
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
      const nx = e.clientX / window.innerWidth - 0.5;
      const ny = e.clientY / window.innerHeight - 0.5;
      pointer.tx = nx * PARALLAX_MAX * 2;
      pointer.ty = ny * PARALLAX_MAX * 2;
    };
    const ro = new ResizeObserver(resize);

    resize();
    io.observe(wrap);
    ro.observe(stick);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("operator-focus", onFocus);
    visible = !document.hidden;
    setRunning();

    return () => {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("operator-focus", onFocus);
    };
  }, [active, total, awaiting, activeThreads]);

  return (
    // overflow-clip (not hidden): clips without creating a scroll container, so
    // the sticky viewport frame below tracks the page scroll correctly.
    <div ref={wrapRef} aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-clip text-slate-400">
      {/* Static fallback + base: always present, costs nothing, reads as depth.
          The tint is the ROOM's atmosphere — server-chosen per workspace, so
          entering another room genuinely changes the environment (zero JS). */}
      <div className={`absolute inset-0 bg-gradient-to-b ${tint} via-transparent to-transparent`} />
      {active && (
        <div ref={stickRef} className="sticky top-0 h-screen">
          <canvas ref={canvasRef} className="absolute inset-0" />
        </div>
      )}
    </div>
  );
}
