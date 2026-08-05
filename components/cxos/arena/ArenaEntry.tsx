"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { detectTier } from "@/lib/cxos/capability";
import { isDirectorActive } from "@/lib/cxos/reviewMode";

// CXOS Phase 5 — the entry into the Arena.
//
// Plays OVER the real, already-rendered Arena page. Every line is REAL
// resolved state handed down by the server component — and the server
// component only renders after arenaAccessible() passed, so eligibility can
// never be fabricated here: an ineligible account was redirected before this
// file could mount (the Phase 4 unmaskability law, inherited).
//
// Beats (first entry ≈ 8.6 s, ≤ the 7–12 s law):
//   b1 CLEARANCE       identity · internal cohort · policy version
//   b2 EVIDENCE VAULT  the operator's own top evidenced awards (or the
//                      truthful empty vault)
//   b3 ASCENT          rank + level — scale through typography and light
//   b4 REVEAL          the chamber ring opens (the one ceremonial element,
//                      declared in the semantic ledger)
//   b5 FLOOR           dissolve; focus to the room's heading
// Returning ≈ 1.1 s. Tier C short. Tier D (reduced motion / effects off)
// mounts NOTHING. Skip: Escape, the autofocused button, or click anywhere.
// A pure-CSS 12 s safety fade guarantees the floor is never stranded.
export interface ArenaEntryProps {
  identity: string;
  rank: string;
  level: number;
  totalXp: number;
  awardCount: number;
  badges: string[];
  topAwards: { label: string; xp: number; cls: string }[];
  policyVersion: number | string;
  forceVariant?: "first" | "returning";
  forceReview?: boolean;
}

const SESSION_KEY = "cx-arena";

export function ArenaEntry(props: ArenaEntryProps) {
  const [mode, setMode] = useState<"off" | "first" | "returning">("off");
  const [beat, setBeat] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const review = useRef(false);
  const doneRef = useRef(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    try {
      const tier = detectTier();
      if (tier === "D") return;
      review.current = props.forceReview ?? isDirectorActive();
      let returning = false;
      try {
        returning = sessionStorage.getItem(SESSION_KEY) === "1";
      } catch {
        /* no storage → first */
      }
      const variant = props.forceVariant ?? (returning || tier === "C" ? "returning" : "first");
      setMode(variant);
      start(variant);
    } catch {
      /* detection failure: the floor is simply there */
    }
    return () => timers.current.forEach((t) => window.clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const arm = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  function start(variant: "first" | "returning") {
    doneRef.current = false;
    setLeaving(false);
    setBeat(1);
    if (variant === "first") {
      arm(() => setBeat(2), 1700);
      arm(() => setBeat(3), 4300);
      arm(() => setBeat(4), 6100);
      arm(() => finish(), 8600);
    } else {
      arm(() => finish(), 1100);
    }
  }

  function finish() {
    if (doneRef.current) return;
    doneRef.current = true;
    if (!review.current) {
      try {
        sessionStorage.setItem(SESSION_KEY, "1");
      } catch {
        /* fine */
      }
    }
    setLeaving(true);
    arm(() => {
      setMode("off");
      const h = document.querySelector<HTMLElement>("main h1, h1");
      if (h) {
        h.setAttribute("tabindex", "-1");
        h.focus({ preventScroll: true });
      }
    }, 550);
  }

  function replay(variant: "first" | "returning") {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    setMode(variant);
    start(variant);
  }

  useEffect(() => {
    if (mode === "off") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  if (mode === "off") return null;

  return (
    <div
      role="dialog"
      aria-label="Entering the Arena. Press Escape to skip."
      className={`cx-ar-veil fixed inset-0 z-[96] flex items-center justify-center ${leaving ? "cx-mc-leave" : ""}`}
      onClick={finish}
    >
      {/* the chamber ring — ceremonial architecture, ledger-declared */}
      <div aria-hidden className={`cx-ar-ring ${beat >= 4 ? "cx-ar-ring-open" : ""}`} />

      <div className="relative mx-6 w-full max-w-md" aria-live="polite">
        {mode === "first" ? (
          <>
            {beat >= 1 && (
              <div className="cx-mc-line">
                <div className="text-[10px] font-bold tracking-[0.3em] text-amber-200/70">ARENA CLEARANCE</div>
                {/* Phase 5.1 copy law: the audience hears ceremony; the
                    technical truth lives in the director instruments. Only
                    the claim the server actually proved is spoken: the gate
                    passed. "Record located." was removed — the progress
                    read fails closed to EMPTY on error, so an affirmative
                    located-record line could be false during a degraded
                    read (adversarial review finding, 2026-07-29). */}
                <p className="mt-1 text-sm text-slate-200">Clearance confirmed.</p>
                {review.current && (
                  <p className="mt-1 font-mono text-[11px] text-slate-500">
                    {props.identity} · internal cohort · policy v{props.policyVersion}
                  </p>
                )}
              </div>
            )}
            {beat >= 2 && (
              <div className="cx-mc-line mt-4">
                <div className="text-[10px] font-bold tracking-[0.3em] text-amber-200/70">THE EVIDENCE VAULT</div>
                {props.topAwards.length > 0 ? (
                  <ul className="mt-1.5 space-y-1 font-mono text-sm">
                    {props.topAwards.slice(0, 3).map((a) => (
                      <li key={a.label + a.xp} className="flex items-baseline justify-between gap-3 text-slate-300">
                        <span className="truncate">{a.label}</span>
                        <span className="shrink-0 text-amber-200">
                          +{a.xp} <span className="text-[10px] text-slate-500">{a.cls} evidence</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1.5 font-mono text-sm text-slate-400">
                    No XP yet — only evidenced activity counts.
                  </p>
                )}
              </div>
            )}
            {beat >= 3 && (
              <div className="cx-mc-line mt-5">
                <div className="text-[10px] font-bold tracking-[0.3em] text-amber-200/70">STANDING</div>
                <p className="mt-1 text-3xl font-semibold capitalize tracking-wide text-slate-100">
                  {props.rank} · Level {props.level}
                </p>
                <p className="mt-0.5 font-mono text-[12px] text-slate-400 tnum">
                  {props.totalXp} lifetime XP · {props.awardCount} evidenced award{props.awardCount === 1 ? "" : "s"}
                </p>
              </div>
            )}
            {beat >= 4 && (
              <div className="cx-mc-line mt-6 text-center">
                <div className="text-2xl font-bold tracking-[0.4em] text-amber-100">THE ARENA</div>
                <p className="mt-1 text-[11px] tracking-[0.2em] text-slate-400">your record, on the floor</p>
              </div>
            )}
          </>
        ) : (
          <div className="cx-mc-line text-center">
            <div className="text-[10px] font-bold tracking-[0.3em] text-amber-200/70">THE ARENA</div>
            <p className="mt-1 text-slate-200">
              <span className="capitalize">{props.rank}</span> · Level {props.level}
            </p>
          </div>
        )}
      </div>

      <button
        type="button"
        autoFocus
        onClick={(e) => {
          e.stopPropagation();
          finish();
        }}
        className="absolute right-6 rounded-lg border border-ink-600 px-3 py-1.5 text-xs text-slate-400 transition hover:border-amber-400/50 hover:text-slate-200"
        style={{ bottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      >
        Skip — Esc
      </button>

      {review.current && (
        <div
          className="absolute left-4 flex max-w-[calc(100vw-8.5rem)] flex-wrap items-center gap-2 font-mono text-[11px] text-slate-400"
          style={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }}
          onClick={(e) => e.stopPropagation()}
        >
          <span className="font-bold text-amber-200">ENTRY</span>
          <button type="button" className="rounded border border-ink-600 px-1.5 py-0.5 hover:border-amber-400/60" onClick={() => replay("first")}>replay first</button>
          <button type="button" className="rounded border border-ink-600 px-1.5 py-0.5 hover:border-amber-400/60" onClick={() => replay("returning")}>returning</button>
          {[1, 2, 3, 4].map((b) => (
            <button key={b} type="button" className="rounded border border-ink-600 px-1.5 py-0.5 hover:border-amber-400/60" onClick={() => setBeat(b)}>b{b}</button>
          ))}
        </div>
      )}
    </div>
  );
}
