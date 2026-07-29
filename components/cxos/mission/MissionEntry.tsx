"use client";

import { useEffect, useRef, useState } from "react";
import { detectTier } from "@/lib/cxos/capability";
import { isDirectorActive } from "@/lib/cxos/reviewMode";

// CXOS Phase 4 — the authenticated entry into Mission Control.
//
// This overlay plays OVER the real, already-rendered dashboard, and every line
// it shows is a REAL resolved application state handed down by the server
// component: identity, role, plan, the deterministic health signals, the queue
// aggregates, and Kai's actual computed next action. Nothing is scanned,
// nothing is fabricated — authentication and authorization completed BEFORE
// this component ever mounted (it is rendered by the authenticated page, so an
// auth failure renders the page's own error state, never this).
//
// Duration policy: first entry ≈ 7s across five beats; returning entries in a
// session ≈ 1.1s; tier C short; tier D (reduced motion / effects off) mounts
// NOTHING. Skippable instantly — Escape, the button, or a click anywhere.
// A pure-CSS 12s safety fade (the reveal-safety pattern) guarantees the room
// is never stranded behind the veil even if every script after mount dies.
export interface MissionEntryProps {
  firstName: string;
  identity: string; // username or email local part — the operator handle
  role: "ADMIN" | "AGENCY" | "OPERATOR";
  plan: string;
  health: { label: string; status: "green" | "amber" | "red" }[];
  tasksCount: number;
  waitingCount: number;
  hasReport: boolean;
  nextAction: string | null;
  /** Review stages force variants; the live page leaves these unset. */
  forceVariant?: "first" | "returning";
  forceReview?: boolean;
}

const SESSION_KEY = "cx-mc";

export function MissionEntry(props: MissionEntryProps) {
  const [mode, setMode] = useState<"off" | "first" | "returning">("off");
  const [beat, setBeat] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const review = useRef(false);
  const doneRef = useRef(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    try {
      const tier = detectTier();
      if (tier === "D") return; // reduced motion / effects off: immediate room
      review.current = props.forceReview ?? isDirectorActive();
      let returning = false;
      try {
        returning = sessionStorage.getItem(SESSION_KEY) === "1";
      } catch {
        /* no storage → treat as first */
      }
      const variant =
        props.forceVariant ?? (returning || tier === "C" ? "returning" : "first");
      setMode(variant);
      start(variant);
    } catch {
      /* any detection failure: the room is simply there — no overlay */
    }
    return () => {
      timers.current.forEach((t) => window.clearTimeout(t));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const arm = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  function start(variant: "first" | "returning") {
    doneRef.current = false;
    setLeaving(false);
    setBeat(0);
    if (variant === "first") {
      // five beats — identity → clearance → systems → evidence → Kai
      arm(() => setBeat(1), 1300);
      arm(() => setBeat(2), 2700);
      arm(() => setBeat(3), 4500);
      arm(() => setBeat(4), 5900);
      arm(() => finish(), 7300);
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

  const roleLine =
    props.role === "ADMIN"
      ? "Administrator clearance"
      : props.role === "AGENCY"
        ? "Agency operator clearance"
        : "Operator clearance";

  return (
    <div
      role="dialog"
      aria-label="Mission Control is opening. Press Escape to skip."
      className={`cx-mc-veil fixed inset-0 z-[96] flex items-center justify-center bg-[#02040a]/[0.97] ${leaving ? "cx-mc-leave" : ""}`}
      onClick={finish}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="aurora aurora-app left-[-10%] top-[-10%] h-[420px] w-[420px] bg-ocean-500/25" />
        <div className="grid-texture absolute inset-0 opacity-40" />
      </div>

      <div className="relative mx-6 w-full max-w-md font-mono text-sm" aria-live="polite">
        {mode === "first" ? (
          <>
            <EntryLine on={beat >= 0} label="IDENTITY" value={`${props.firstName} · ${props.identity}`} />
            <EntryLine on={beat >= 1} label="CLEARANCE" value={`${roleLine} · ${props.plan}`} />
            {beat >= 2 && (
              <div className="cx-mc-line mt-3">
                <div className="text-[10px] font-bold tracking-[0.25em] text-slate-500">SYSTEMS</div>
                <ul className="mt-1 space-y-1">
                  {props.health.slice(0, 4).map((h) => (
                    <li key={h.label} className="flex items-center gap-2 text-slate-300">
                      <span
                        aria-hidden
                        className={`h-1.5 w-1.5 rounded-full ${h.status === "green" ? "bg-success-400" : h.status === "amber" ? "bg-gold-400" : "bg-rose-400"}`}
                      />
                      {h.label}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <EntryLine
              on={beat >= 3}
              label="EVIDENCE"
              value={
                props.hasReport
                  ? `${props.tasksCount} item${props.tasksCount === 1 ? "" : "s"} need you · ${props.waitingCount} awaiting a response`
                  : "No report on file yet — your first mission is staged"
              }
            />
            {beat >= 4 && (
              <div className="cx-mc-line mt-4 border-l-2 border-brand-500/50 pl-3">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-brand-300">KAI</span>
                  <span className="text-[11px] text-slate-400">Executive brief</span>
                </div>
                <p className="mt-1.5 leading-relaxed text-slate-200">
                  {props.nextAction ?? "I’ve organized what requires your attention."}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">Command is yours.</p>
              </div>
            )}
          </>
        ) : (
          <div className="cx-mc-line">
            <div className="text-[10px] font-bold tracking-[0.25em] text-slate-500">MISSION CONTROL</div>
            <p className="mt-1 text-slate-200">Welcome back, {props.firstName}.</p>
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
        className="absolute bottom-6 right-6 rounded-lg border border-ink-600 px-3 py-1.5 text-xs text-slate-400 transition hover:border-brand-500/50 hover:text-slate-200"
      >
        Skip — Esc
      </button>

      {review.current && (
        <div
          className="absolute bottom-6 left-6 flex items-center gap-2 font-mono text-[11px] text-slate-400"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="font-bold text-brand-300">ENTRY</span>
          <button type="button" className="rounded border border-ink-600 px-1.5 py-0.5 hover:border-brand-500/60" onClick={() => replay("first")}>replay first</button>
          <button type="button" className="rounded border border-ink-600 px-1.5 py-0.5 hover:border-brand-500/60" onClick={() => replay("returning")}>returning</button>
          {[0, 1, 2, 3, 4].map((b) => (
            <button key={b} type="button" className="rounded border border-ink-600 px-1.5 py-0.5 hover:border-brand-500/60" onClick={() => setBeat(b)}>b{b}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function EntryLine({ on, label, value }: { on: boolean; label: string; value: string }) {
  if (!on) return null;
  return (
    <div className="cx-mc-line mt-3 first:mt-0">
      <div className="text-[10px] font-bold tracking-[0.25em] text-slate-500">{label}</div>
      <p className="mt-1 text-slate-200">{value}</p>
    </div>
  );
}
