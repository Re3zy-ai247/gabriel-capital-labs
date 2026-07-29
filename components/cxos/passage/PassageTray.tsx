"use client";

import { useEffect, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import type { CxTier } from "@/lib/cxos/capability";
import type { PassagePhase } from "@/lib/cxos/passageTimeline";
import type { PassageRecord, PassageStateKey } from "./fixtures";

// CXOS Phase 5.1 — the director tray, mobile-safe by construction.
//
// The shipped entry strips collide on phones (two independent absolute
// rows at the same bottom offset, no wrap, no safe-area). This tray is
// the corrective pattern: ONE collapsed pill (bottom-LEFT, safe-area
// aware) that expands into a bottom sheet — max-height in small-viewport
// units, its own scroll with overscroll containment, 44 px touch targets,
// and an Escape that closes the sheet BEFORE the journey's Escape ever
// sees the key (the journey handler checks trayOpenRef). Opening the
// sheet is inspection: the parent pauses nothing implicitly, but every
// jump instrument replaces the running timeline deliberately.
//
// The technical clearance truth the ceremony no longer speaks lives here:
// handle · cohort mirror · policy version.

export function PassageTray({
  tier,
  phase,
  env,
  fxKey,
  states,
  journeyEndMs,
  record,
  note,
  trayOpenRef,
  onState,
  onFirst,
  onReturning,
  onJump,
  onScrub,
  onResume,
}: {
  tier: CxTier | null;
  phase: PassagePhase;
  env: "mc" | "arena";
  fxKey: PassageStateKey;
  states: { key: PassageStateKey; label: string }[];
  journeyEndMs: number;
  record: PassageRecord;
  note: string | null;
  trayOpenRef: MutableRefObject<boolean>;
  onState: (k: PassageStateKey) => void;
  onFirst: () => void;
  onReturning: () => void;
  onJump: (p: PassagePhase) => void;
  onScrub: (ms: number) => void;
  onResume: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [scrubMs, setScrubMs] = useState(0);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    trayOpenRef.current = open;
  }, [open, trayOpenRef]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    // Capture phase: the sheet consumes Escape before the journey handler.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open]);

  const lighting =
    env === "mc" ? "analytical blue" : phase === "conversion" ? "conversion" : "ceremonial gold";
  const beatJumps: { p: PassagePhase; label: string }[] = [
    { p: "origin", label: "Origin" },
    { p: "call", label: "Call" },
    { p: "clearance", label: "Clearance" },
    { p: "passage", label: "Passage" },
    { p: "conversion", label: "Conversion" },
    { p: "threshold", label: "Threshold" },
    { p: "greeting", label: "Greeting" },
    { p: "floor", label: "Floor" },
    { p: "returning", label: "Return" },
  ];
  const stations: { id: string; label: string }[] = [
    { id: "b", label: "Standing core" },
    { id: "c", label: "Evidence vault" },
    { id: "d", label: "Milestone gallery" },
    { id: "e", label: "Competition threshold" },
  ];

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="cxp-tray-sheet"
        onClick={() => setOpen((o) => !o)}
        className="cx-p-traypill fixed left-4 z-[99] rounded-full border border-ink-600 bg-ink-950/85 px-4 py-2.5 font-mono text-[11px] font-bold tracking-widest text-slate-300 backdrop-blur transition hover:border-brand-500/60"
        style={{ bottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        DIRECTOR {open ? "▾" : "▸"}
      </button>

      {open && (
        <div
          id="cxp-tray-sheet"
          ref={sheetRef}
          role="group"
          aria-label="Director console"
          className="cx-p-sheet fixed inset-x-0 bottom-0 z-[98] overflow-y-auto rounded-t-2xl border-t border-ink-600 bg-ink-950/95 px-4 pt-4 backdrop-blur"
          style={{
            maxHeight: "60svh",
            overscrollBehavior: "contain",
            paddingBottom: "max(4.5rem, calc(env(safe-area-inset-bottom) + 4rem))",
          }}
        >
          <div className="mx-auto max-w-3xl space-y-4 font-mono text-[12px] text-slate-300">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
              <span>
                tier <span className="text-slate-300">{tier ?? "…"}</span>
              </span>
              <span>
                phase <span className="text-amber-200">{phase}</span>
              </span>
              <span>
                environment <span className="text-slate-300">{env === "mc" ? "Mission Control" : "Arena"}</span>
              </span>
              <span>
                lighting <span className="text-slate-300">{lighting}</span>
              </span>
              <span>
                render <span className="text-slate-300">demand (CSS)</span>
              </span>
            </div>

            <div>
              <div className="mb-1.5 text-[10px] font-bold tracking-[0.25em] text-slate-500">JOURNEY</div>
              <div className="flex flex-wrap gap-2">
                <TrayBtn onClick={onFirst}>▶ first (~{(journeyEndMs / 1000).toFixed(1)}s)</TrayBtn>
                <TrayBtn onClick={onReturning}>▶ returning (~1.4s)</TrayBtn>
                <TrayBtn onClick={onResume}>resume</TrayBtn>
              </div>
            </div>

            <div>
              <div className="mb-1.5 text-[10px] font-bold tracking-[0.25em] text-slate-500">JUMP TO BEAT</div>
              <div className="flex flex-wrap gap-2">
                {beatJumps.map((b) => (
                  <TrayBtn key={b.p} active={phase === b.p} onClick={() => onJump(b.p)}>
                    {b.label}
                  </TrayBtn>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="cxp-scrub" className="mb-1.5 block text-[10px] font-bold tracking-[0.25em] text-slate-500">
                TIMELINE SCRUB · {(scrubMs / 1000).toFixed(1)}s / {(journeyEndMs / 1000).toFixed(1)}s
              </label>
              <input
                id="cxp-scrub"
                type="range"
                min={0}
                max={journeyEndMs}
                step={100}
                value={scrubMs}
                onChange={(e) => {
                  const ms = Number(e.target.value);
                  setScrubMs(ms);
                  onScrub(ms);
                }}
                className="w-full"
              />
            </div>

            <div>
              <div className="mb-1.5 text-[10px] font-bold tracking-[0.25em] text-slate-500">FLOOR STATIONS</div>
              <div className="flex flex-wrap gap-2">
                {stations.map((s) => (
                  <TrayBtn
                    key={s.id}
                    onClick={() => {
                      if (env !== "arena") onJump("floor");
                      requestAnimationFrame(() => {
                        document
                          .querySelector(`[data-station="${s.id}"]`)
                          ?.scrollIntoView({ behavior: "instant" as ScrollBehavior, block: "center" });
                      });
                    }}
                  >
                    {s.label}
                  </TrayBtn>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-1.5 text-[10px] font-bold tracking-[0.25em] text-slate-500">FIXTURE STATE</div>
              <div className="flex flex-wrap gap-2">
                {states.map((s) => (
                  <TrayBtn key={s.key} active={fxKey === s.key} onClick={() => onState(s.key)}>
                    {s.label}
                  </TrayBtn>
                ))}
              </div>
              {note && <p className="mt-2 max-w-xl text-[11px] leading-relaxed text-slate-500">{note}</p>}
            </div>

            <div className="border-t border-ink-700/60 pt-3 text-[11px] text-slate-500">
              <div className="mb-1 text-[10px] font-bold tracking-[0.25em]">TECHNICAL CLEARANCE (director only)</div>
              <p className="tnum">
                {record.handle} · internal cohort mirror · policy v{record.policyVersion} · curve-consistent standing
                (xpForLevel = 25·n·(n−1))
              </p>
              <p className="mt-1">
                Projections: reduced motion &amp; effects-off ⇒ tier D (no cinema, settled document) · no-JS ⇒ the same
                settled document · no WebGL anywhere in this experience.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function TrayBtn({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-[44px] rounded border px-3 py-2 transition ${
        active ? "border-amber-400/70 text-amber-200" : "border-ink-600 hover:border-amber-400/60"
      }`}
    >
      {children}
    </button>
  );
}
