"use client";

import { useEffect, useRef, useState } from "react";

// An illustrative "dispute progress" card for the hero: a ring that fills as
// items are addressed, a self-drawing trend sparkline of items resolved over
// time, and three bureau chips that check in. This mirrors the product's actual
// function — tracking disputes through the bureaus — and deliberately avoids any
// credit-score-boost framing to stay CROA-safe. Numbers are a representative
// illustration, not a promised outcome.
const TOTAL = 12;
const RESOLVED = 9;
const R = 80; // ring radius
const CIRC = 2 * Math.PI * R;

function prefersReduced(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function HeroVisual() {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReduced()) {
      setCount(RESOLVED);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !started.current) {
          started.current = true;
          const duration = 1500;
          const t0 = performance.now();
          const tick = (now: number) => {
            const p = Math.min(1, (now - t0) / duration);
            const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
            setCount(Math.round(RESOLVED * eased));
            if (p < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const pct = count / TOTAL;
  const dash = CIRC * pct;

  return (
    <div ref={ref} className="animate-float relative mx-auto w-full max-w-sm">
      <div className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-6 shadow-2xl backdrop-blur">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Dispute progress</span>
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
            {TOTAL - RESOLVED} in review
          </span>
        </div>

        {/* Progress ring */}
        <div className="relative mx-auto my-3 h-48 w-48">
          <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90">
            <circle cx="100" cy="100" r={R} fill="none" stroke="rgba(148,163,184,0.18)" strokeWidth="14" />
            <circle
              cx="100"
              cy="100"
              r={R}
              fill="none"
              stroke="url(#progGrad)"
              strokeWidth="14"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${CIRC}`}
            />
            <defs>
              <linearGradient id="progGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#2bd07f" />
                <stop offset="100%" stopColor="#5fe3a1" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-5xl font-bold tabular-nums text-white">
              {count}
              <span className="text-2xl text-slate-500">/{TOTAL}</span>
            </span>
            <span className="text-[11px] uppercase tracking-wide text-slate-400">items addressed</span>
          </div>
        </div>

        {/* Self-drawing trend sparkline — items resolved over time */}
        <svg viewBox="0 0 280 70" className="mt-2 h-16 w-full">
          <polyline
            points="0,62 40,58 80,50 120,46 160,34 200,28 240,18 280,10"
            fill="none"
            stroke="#2bd07f"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="animate-draw"
            style={{ strokeDasharray: 400, strokeDashoffset: 400 }}
          />
          <polyline
            points="0,62 40,58 80,50 120,46 160,34 200,28 240,18 280,10 280,70 0,70"
            fill="url(#fillGrad)"
            stroke="none"
            opacity="0.25"
          />
          <defs>
            <linearGradient id="fillGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2bd07f" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#2bd07f" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>

        {/* Bureau chips */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          {["Equifax", "Experian", "TransUnion"].map((b, i) => (
            <div
              key={b}
              className="animate-rise-stagger rounded-lg border border-slate-700/60 bg-slate-800/60 px-2 py-1.5 text-center"
              style={{ animationDelay: `${600 + i * 150}ms` }}
            >
              <div className="text-[10px] text-slate-400">{b}</div>
              <div className="text-xs font-semibold text-emerald-300">✓ Reviewed</div>
            </div>
          ))}
        </div>

        <p className="mt-3 text-center text-[10px] leading-tight text-slate-500">
          Illustrative example. Individual results vary; no outcome is guaranteed.
        </p>
      </div>
    </div>
  );
}
