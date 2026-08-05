"use client";

import Link from "next/link";
import { CinematicToggle } from "@/components/cxos/CinematicToggle";
import type { WalkthroughPersona } from "@/app/review/cxos/steps";

// CXOS Phase 1A-CX2 (C) — the Founder Walkthrough's persistent chrome.
//
// A slim, top-pinned bar — deliberately z-[95]: BELOW MissionEntry/ArenaEntry
// (z-[96]), The Passage's overlay (z-[97]) and the Threshold (z-[100]), all
// of which paint a near-opaque (0.97) full-bleed background. That means this
// bar is naturally, structurally hidden behind any of those four ceremonies
// while they play, and reappears the instant they settle — without this
// component needing to know anything about their internal state. It sits
// ABOVE every composed room's own in-flow chrome (Agency Command's arrival
// gate is z-20 *inside its own room*, Mission Control/Arena's own Director
// panels are unpositioned/static), so it stays visible and usable across
// every settled step.
//
// This is also the ONE mount point for components/cxos/CinematicToggle.tsx
// (built + guard-tested in CX2-A, previously mounted nowhere) — the
// Founder's "existing controls" clause wants a reachable control, and this
// shell's chrome is that placement, exactly once.
export interface ProgressRailProps {
  persona: WalkthroughPersona;
  stepIndex: number; // 1-based
  totalSteps: number;
  stepTitle: string;
  prevLabel: string;
  nextLabel: string;
  onPrev: () => void;
  onNext: () => void;
  onReplay: () => void;
  onRestart: () => void;
}

export function ProgressRail({
  persona,
  stepIndex,
  totalSteps,
  stepTitle,
  prevLabel,
  nextLabel,
  onPrev,
  onNext,
  onReplay,
  onRestart,
}: ProgressRailProps) {
  return (
    <div
      role="navigation"
      aria-label="Founder walkthrough progress"
      data-testid="walkthrough-progress-rail"
      className="fixed inset-x-0 top-0 z-[95] flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-ink-700/60 bg-ink-950/90 px-3 py-1.5 font-mono text-[11px] text-slate-300 backdrop-blur"
    >
      <span className="font-bold tracking-widest text-brand-300">
        STEP {stepIndex} OF {totalSteps}
      </span>
      <span className="truncate font-sans font-semibold text-slate-100">
        {stepTitle}
      </span>
      <span aria-hidden className="text-slate-600">
        ·
      </span>
      <span className="text-slate-500">
        {persona === "new" ? "New visitor" : "Returning operator"}
      </span>

      <div className="ml-auto flex items-center gap-1.5">
        <button
          type="button"
          onClick={onPrev}
          className="rounded border border-ink-600 px-2 py-0.5 hover:border-brand-500/60"
        >
          {prevLabel}
        </button>
        <button
          type="button"
          onClick={onNext}
          className="rounded border border-ink-600 px-2 py-0.5 hover:border-brand-500/60"
        >
          {nextLabel}
        </button>
        <details className="relative">
          <summary className="cursor-pointer list-none rounded border border-ink-600 px-2 py-0.5 hover:border-brand-500/60">
            More ▾
          </summary>
          <div className="absolute right-0 top-full z-10 mt-1 w-72 space-y-2 rounded-lg border border-ink-600 bg-ink-900 p-3 shadow-lift">
            <button
              type="button"
              onClick={onReplay}
              className="block w-full rounded border border-ink-600 px-2 py-1 text-left hover:border-brand-500/60"
            >
              Replay this transition
            </button>
            <button
              type="button"
              onClick={onRestart}
              className="block w-full rounded border border-ink-600 px-2 py-1 text-left hover:border-brand-500/60"
            >
              Restart walkthrough
            </button>
            <div className="border-t border-ink-700/60 pt-2">
              <CinematicToggle />
            </div>
            <Link
              href="/review"
              className="block font-sans text-brand-300 hover:text-brand-200"
            >
              ← All rooms
            </Link>
          </div>
        </details>
      </div>
    </div>
  );
}
