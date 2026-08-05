"use client";

import type { CSSProperties } from "react";
import type { PassageFixture } from "./fixtures";

// CXOS Phase 5.1 — the cinematic world.
//
// One continuous camera: every visual is a child of ONE CSS timeline
// (.cx-p-run-*), windowed by keyframe percentages — the camera never stops
// between the call and the threshold, and the clearance lines are objects
// IN the world (stencils at depth that pass the lens), not HUD captions.
// The whole world is aria-hidden; assistive technology hears the concise
// beat announcements from the journey's live region instead of every
// visual. Scrubbing (director tray) drives --cxp-seek, which every child
// consumes as a negative animation-delay.
//
// Honesty furniture that exists OUTSIDE every beat conditional: the
// SYNTHETIC tab (minimized during travel, never removed — including the
// threshold's silence) and the Cancel/Skip control. The veil carries the
// pure-CSS 18 s safety fade (cx-p-safety): if every script after mount
// died, the veil removes itself and reveals the origin — no scroll ever
// happened, so that IS the truthful state.

export interface PassageOverlayProps {
  run: "first" | "mobile" | "returning" | "return";
  fx: PassageFixture;
  cancelable: boolean;
  onSkip: () => void;
  paused?: boolean;
  seekMs?: number | null;
  // False when a director instrument drove this mount: focus stays where
  // the director put it instead of being yanked to the Skip button.
  takeFocus?: boolean;
}

export function PassageOverlay({
  run,
  fx,
  cancelable,
  onSkip,
  paused,
  seekMs,
  takeFocus = true,
}: PassageOverlayProps) {
  const r = fx.record;
  const runClass =
    run === "first" ? "cx-p-run-a" : run === "mobile" ? "cx-p-run-b" : run === "returning" ? "cx-p-run-r" : "cx-p-run-ret";
  const seekStyle =
    seekMs != null ? ({ "--cxp-seek": `-${(seekMs / 1000).toFixed(2)}s` } as CSSProperties) : undefined;
  return (
    <div
      role="dialog"
      aria-label={
        run === "return"
          ? "Returning to Mission Control. Press Escape to skip."
          : cancelable
            ? "Arena passage called. Press Escape to cancel and remain in Mission Control."
            : "Traveling to the Arena. Press Escape to skip to the Arena threshold."
      }
      data-cxp-paused={paused ? "" : undefined}
      className={`cx-p-veil fixed inset-0 z-[97] overflow-hidden ${runClass}`}
      style={seekStyle}
      onClick={onSkip}
    >
      {/* the world — decorative travel, hidden from assistive technology */}
      <div aria-hidden className="cx-p-world absolute inset-0">
        {run !== "return" ? (
          <>
            {/* the room becomes the set: MC-continuous ground + panels */}
            <div className="cx-p-set absolute inset-0" />
            <div className="cx-p-grid absolute inset-x-[-40%] bottom-[-12%] h-[70%]" />
            {/* the floor separates along the command axis */}
            <div className="cx-p-split cx-p-split-l" />
            <div className="cx-p-split cx-p-split-r" />
            {/* rectilinear wall planes retract past the camera */}
            <div className="cx-p-panelrow cx-p-pr-l absolute" />
            <div className="cx-p-panelrow cx-p-pr-r absolute" />
            {/* converging rails */}
            <div className="cx-p-rails absolute inset-0" />
            {/* the circular aperture forms on the axis */}
            <div className="cx-p-aperture" />
            {/* and far beyond it, late and small: the first gold light */}
            <div className="cx-p-farlight" />
            {/* ONE in-world line. Everything the ceremony used to say in
                flight is now said on arrival, in flow, where it is legible
                at any width (Phase 5.2 — the collision fix is structural). */}
            <div className="cx-p-stencil">Clearance confirmed.</div>
            {/* dimensional conversion: warmth + concentric gold arcs */}
            <div className="cx-p-warm absolute inset-0" />
            <div className="cx-p-arcs absolute inset-0" />
            {/* the Arena's atmosphere reaches back up the hallway */}
            <div className="cx-p-shafts" />
            <div className="cx-p-motes" />
            {/* the threshold — the chamber's establishing geometry (the
                match cut: same cx-p-est composition Station A rests in),
                with the monument's colonnade receding into the dark */}
            <div className="cx-p-gate absolute inset-0 grid place-items-center">
              <div className="cx-p-colonnade" />
              <div className="relative text-center">
                <div className="cx-p-est mx-auto">
                  <div className="cx-p-est-ring" />
                  <div className="cx-p-est-engrave" />
                </div>
                <p className="cx-p-engraved cx-p-gate-name mt-6 font-bold text-amber-100/90">
                  THE ARENA
                </p>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* the return: gold contracts to a line, cools into blue rails */}
            <div className="cx-p-retgold absolute inset-0" />
            <div className="cx-p-retline absolute inset-x-0 top-1/2 h-px" />
            <div className="cx-p-retcool absolute inset-0" />
          </>
        )}
      </div>

      {/* THE WELCOME — one line, the emotional peak. The room's recognition
          of the record plays on the settled floor (ArenaFloor), slowly and
          in flow, so nothing is ever rushed or stacked. */}
      {run !== "return" && (
        <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center px-5">
          <div className="w-full max-w-lg text-center">
            <p className="cx-p-greet cx-p-g-1 font-semibold text-slate-100">
              Welcome to the Arena, {r.displayName}.
            </p>
          </div>
        </div>
      )}

      {/* honesty furniture — OUTSIDE every beat conditional */}
      <span className="cx-p-tab absolute left-1/2 top-3 -translate-x-1/2 rounded-full border border-gold-400/40 bg-ink-950/80 px-2.5 py-0.5 text-[10px] font-bold tracking-widest text-gold-400">
        SYNTHETIC
      </span>
      <button
        type="button"
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus={takeFocus}
        onClick={(e) => {
          e.stopPropagation();
          onSkip();
        }}
        className="absolute right-4 min-h-11 min-w-11 rounded-lg border border-ink-600 bg-ink-950/70 px-3 py-2 text-xs text-slate-300 transition hover:border-amber-400/50 hover:text-slate-100 sm:right-6"
        style={{ bottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      >
        {cancelable ? "Cancel — Esc" : "Skip — Esc"}
      </button>
    </div>
  );
}
