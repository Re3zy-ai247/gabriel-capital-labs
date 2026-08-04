"use client";

import { useEffect, useRef, useState } from "react";
import { CXOS_ROOMS } from "@/lib/cxos/rooms";

// CXOS — the Director HUD (Founder Review Mode).
//
// A film director's console over a running room: scrub the walk, jump to a
// beat, slow the motion, thin the particles, dim the lights, read the frame
// budget — without rebuilding anything. This ships INSIDE the lazy experience
// chunk (it is imported only by Threshold), so it costs the public bundle
// nothing, and it renders only when reviewMode allows (never on production).

export interface DirectorController {
  getProgress(): number;
  setProgress(p: number): void;
  setPaused(v: boolean): void;
  isPaused(): boolean;
  setSpeed(v: number): void;
  getSpeed(): number;
  setDensity(f: number): void;
  setIntensity(f: number): void;
  setParallaxEnabled(v: boolean): void;
  getCameraZ(): number;
  /** rolling frame times (ms), newest last — filled by the rAF loop */
  frameTimes: number[];
  replay(): void;
}

const BEATS: Array<[string, number]> = [
  ["0 · Void", 0.02],
  ["1 · First light", 0.16],
  ["2 · Architecture", 0.34],
  ["3 · The name", 0.55],
  ["4 · CreditVector", 0.72],
  ["5 · The opening", 0.9],
];

export function DirectorHUD({ ctl }: { ctl: DirectorController }) {
  const [, force] = useState(0);
  const [density, setDensityUi] = useState(100);
  const [intensity, setIntensityUi] = useState(100);
  const [parallax, setParallax] = useState(true);
  const raf = useRef(0);

  // The HUD's own readout loop — 4Hz, so the console never costs the scene.
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 250);
    return () => clearInterval(id);
  }, []);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const ft = ctl.frameTimes;
  const avg = ft.length ? ft.reduce((a, b) => a + b, 0) / ft.length : 0;
  const p95 = ft.length ? [...ft].sort((a, b) => a - b)[Math.floor(ft.length * 0.95)] : 0;
  const fps = avg > 0 ? Math.round(1000 / avg) : 0;
  const p = ctl.getProgress();

  const btn =
    "rounded border border-ink-600 bg-ink-900/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-300 hover:border-brand-500/60 hover:text-white";

  return (
    <div
      className="pointer-events-auto fixed bottom-4 left-4 z-[110] w-[300px] select-none rounded-xl border border-ink-600/80 bg-ink-900/90 p-3 font-sans text-slate-300 shadow-lift backdrop-blur"
      role="group"
      aria-label="Director console"
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-brand-300">Director</span>
        <span className="tnum text-[10px] text-slate-500">
          {fps} fps · {avg.toFixed(1)}ms avg · {p95.toFixed(1)}ms p95
        </span>
      </div>

      {/* timeline scrubber — the camera path, in the hand */}
      <label className="mt-2 block">
        <span className="tnum flex justify-between text-[10px] text-slate-500">
          <span>timeline</span>
          <span>
            p={p.toFixed(3)} · cam z={ctl.getCameraZ().toFixed(1)}
          </span>
        </span>
        <input
          type="range"
          min={0}
          max={1000}
          value={Math.round(p * 1000)}
          onChange={(e) => ctl.setProgress(Number(e.target.value) / 1000)}
          className="w-full accent-[#0ea5c4]"
          aria-label="Timeline position"
        />
      </label>

      {/* beats */}
      <div className="mt-1 grid grid-cols-3 gap-1">
        {BEATS.map(([label, at]) => (
          <button key={label} type="button" className={btn} onClick={() => ctl.setProgress(at)}>
            {label}
          </button>
        ))}
      </div>

      {/* transport + speed */}
      <div className="mt-2 flex items-center gap-1">
        <button type="button" className={btn} onClick={() => ctl.setPaused(!ctl.isPaused())}>
          {ctl.isPaused() ? "Play" : "Pause"}
        </button>
        {[0.25, 0.5, 1, 2].map((s) => (
          <button
            key={s}
            type="button"
            className={`${btn} ${ctl.getSpeed() === s ? "border-brand-500/70 text-white" : ""}`}
            onClick={() => ctl.setSpeed(s)}
          >
            {s}×
          </button>
        ))}
        <button type="button" className={btn} onClick={() => ctl.replay()}>
          Replay
        </button>
      </div>

      {/* environment controls */}
      <label className="mt-2 block">
        <span className="tnum flex justify-between text-[10px] text-slate-500">
          <span>particle density</span>
          <span>{density}%</span>
        </span>
        <input
          type="range"
          min={10}
          max={100}
          value={density}
          onChange={(e) => {
            const v = Number(e.target.value);
            setDensityUi(v);
            ctl.setDensity(v / 100);
          }}
          className="w-full accent-[#0ea5c4]"
          aria-label="Particle density"
        />
      </label>
      <label className="mt-1 block">
        <span className="tnum flex justify-between text-[10px] text-slate-500">
          <span>light intensity</span>
          <span>{intensity}%</span>
        </span>
        <input
          type="range"
          min={20}
          max={150}
          value={intensity}
          onChange={(e) => {
            const v = Number(e.target.value);
            setIntensityUi(v);
            ctl.setIntensity(v / 100);
          }}
          className="w-full accent-[#0ea5c4]"
          aria-label="Light intensity"
        />
      </label>
      <div className="mt-1 flex items-center justify-between">
        <button
          type="button"
          className={btn}
          onClick={() => {
            ctl.setParallaxEnabled(!parallax);
            setParallax(!parallax);
          }}
        >
          parallax {parallax ? "on" : "off"}
        </button>
        <span className="text-[10px] text-slate-500">sound: use the stage toggle ↗</span>
      </div>

      {/* rooms */}
      <div className="mt-2 border-t border-ink-700/70 pt-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Rooms</span>
        <div className="mt-1 flex flex-wrap gap-1">
          {CXOS_ROOMS.filter((r) => r.status !== "PLANNED").map((r) => (
            <a key={r.key} href={r.href} className={btn}>
              {r.name}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
