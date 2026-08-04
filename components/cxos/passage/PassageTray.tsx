"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
  type Ref,
} from "react";
import type { CxTier } from "@/lib/cxos/capability";
import type { PassagePhase } from "@/lib/cxos/passageTimeline";
import type { PassageRecord, PassageStateKey } from "./fixtures";
import type { PassageProjection } from "./projection";

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
  projection,
  projectionReason,
  browserReduced,
  applicationEffectsOff,
  cinematicAvailable,
  confirmedReduced,
  projectionLocked,
  projectionPrompt,
  journeyControlsDisabled,
  phase,
  env,
  fxKey,
  states,
  journeyEndMs,
  record,
  note,
  trayOpenRef,
  onProjection,
  onConfirmCinematic,
  onCancelCinematic,
  onState,
  onFirst,
  onReturning,
  onJump,
  onScrub,
  onResume,
}: {
  tier: CxTier | null;
  projection: PassageProjection;
  projectionReason: string;
  browserReduced: boolean | null;
  applicationEffectsOff: boolean | null;
  cinematicAvailable: boolean;
  confirmedReduced: boolean;
  projectionLocked: boolean;
  projectionPrompt: "reduced" | "constrained" | null;
  journeyControlsDisabled: boolean;
  phase: PassagePhase;
  env: "mc" | "arena";
  fxKey: PassageStateKey;
  states: { key: PassageStateKey; label: string }[];
  journeyEndMs: number;
  record: PassageRecord;
  note: string | null;
  trayOpenRef: MutableRefObject<boolean>;
  onProjection: (projection: PassageProjection) => void;
  onConfirmCinematic: () => void;
  onCancelCinematic: () => void;
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
  const pillRef = useRef<HTMLButtonElement>(null);
  const cinematicRef = useRef<HTMLButtonElement>(null);
  const previousPromptRef = useRef(projectionPrompt);
  const projectionLabel =
    projection === "auto"
      ? "AUTO"
      : projection === "cinematic"
        ? "CINEMATIC"
        : "STATIC";
  // Closing always returns focus to the pill — never to body, from which the
  // next Escape would silently settle the journey (review finding).
  const close = useCallback(() => {
    if (projectionPrompt) onCancelCinematic();
    setOpen(false);
    pillRef.current?.focus({ preventScroll: true });
  }, [onCancelCinematic, projectionPrompt]);
  const keepCurrentProjection = () => {
    onCancelCinematic();
    requestAnimationFrame(() =>
      cinematicRef.current?.focus({ preventScroll: true })
    );
  };
  const playConfirmedCinematic = () => {
    onConfirmCinematic();
    requestAnimationFrame(() =>
      cinematicRef.current?.focus({ preventScroll: true })
    );
  };

  useEffect(() => {
    trayOpenRef.current = open;
  }, [open, trayOpenRef]);

  useEffect(() => {
    const previous = previousPromptRef.current;
    previousPromptRef.current = projectionPrompt;
    if (open && previous !== null && projectionPrompt === null) {
      requestAnimationFrame(() =>
        cinematicRef.current?.focus({ preventScroll: true })
      );
    }
  }, [open, projectionPrompt]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
    };
    // Capture phase: the sheet consumes Escape before the journey handler.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [close, open]);

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
        ref={pillRef}
        type="button"
        aria-expanded={open}
        aria-controls="cxp-tray-sheet"
        onClick={() => (open ? close() : setOpen(true))}
        className="cx-p-traypill fixed left-4 z-[99] min-h-11 rounded-full border border-ink-600 bg-ink-950/85 px-4 py-2.5 font-mono text-[11px] font-bold tracking-widest text-slate-300 backdrop-blur transition hover:border-brand-500/60"
        style={{ bottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        DIRECTOR · {projectionLabel} {open ? "▾" : "▸"}
      </button>

      {open && (
        <div
          id="cxp-tray-sheet"
          ref={sheetRef}
          role="group"
          aria-label="Director console"
          className="cx-p-sheet fixed inset-x-0 bottom-0 z-[98] overflow-y-auto rounded-t-2xl border-t border-ink-600 bg-ink-950/95 px-4 pt-4 backdrop-blur"
          style={{
            maxHeight: "60vh",
            // svh wins where supported; the vh line above is the fallback so
            // an old engine can never render an unbounded sheet.
            maxBlockSize: "60svh",
            overscrollBehavior: "contain",
            paddingBottom: "max(4.5rem, calc(env(safe-area-inset-bottom) + 4rem))",
          }}
        >
          <div className="mx-auto max-w-3xl space-y-4 font-mono text-[12px] text-slate-300">
            <fieldset className="border-b border-ink-700/60 pb-4">
              <legend className="mb-2 text-[10px] font-bold tracking-[0.25em] text-slate-300">
                FOUNDER PROJECTION
              </legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <TrayBtn
                  active={projection === "auto"}
                  disabled={
                    projectionLocked || projectionPrompt !== null
                  }
                  onClick={() => onProjection("auto")}
                >
                  Auto
                </TrayBtn>
                <TrayBtn
                  buttonRef={cinematicRef}
                  active={projection === "cinematic"}
                  disabled={projectionLocked}
                  onClick={() => onProjection("cinematic")}
                >
                  Cinematic
                </TrayBtn>
                <TrayBtn
                  active={projection === "static"}
                  disabled={
                    projectionLocked || projectionPrompt !== null
                  }
                  onClick={() => onProjection("static")}
                >
                  Reduced Motion / Static
                </TrayBtn>
              </div>

              {projectionLocked && (
                <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
                  {browserReduced === null
                    ? "Detecting browser conditions before projection controls become available."
                    : "Projection changes are locked during the journey. Skip or wait for it to settle."}
                </p>
              )}

              {projectionPrompt === "reduced" && (
                <div
                  className="mt-3 border-l-2 border-amber-400/70 bg-amber-400/5 px-3 py-3"
                  aria-describedby="cxp-reduced-warning"
                >
                  <p
                    id="cxp-reduced-warning"
                    className="max-w-2xl leading-relaxed text-amber-100"
                  >
                    Your browser requests reduced motion. Cinematic will
                    animate this synthetic review only and does not change
                    your system setting.
                  </p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <TrayBtn onClick={playConfirmedCinematic}>
                      Play Cinematic for this review
                    </TrayBtn>
                    <TrayBtn onClick={keepCurrentProjection}>
                      Keep Reduced Motion / Static
                    </TrayBtn>
                  </div>
                </div>
              )}

              {projectionPrompt === "constrained" && (
                <div className="mt-3 border-l-2 border-slate-500 bg-slate-400/5 px-3 py-3">
                  <p className="max-w-2xl leading-relaxed text-slate-300">
                    Cinematic is unavailable in this browser condition.
                    Data Saver, low-memory safety, and failed capability
                    detection are never overridden.
                  </p>
                  <div className="mt-3">
                    <TrayBtn onClick={keepCurrentProjection}>
                      Keep current projection
                    </TrayBtn>
                  </div>
                </div>
              )}

              <dl className="mt-3 grid gap-1 text-[11px] text-slate-400 sm:grid-cols-2">
                <div>
                  <dt className="inline">Browser preference: </dt>
                  <dd className="inline text-slate-200">
                    {browserReduced === null
                      ? "detecting…"
                      : browserReduced
                        ? "reduced motion"
                        : "no motion reduction"}
                  </dd>
                </div>
                <div>
                  <dt className="inline">Review projection: </dt>
                  <dd className="inline text-slate-200">
                    {projectionLabel} · tier {tier ?? "…"}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="inline">Reason: </dt>
                  <dd className="inline text-slate-200">
                    {projectionReason}
                  </dd>
                </div>
                <div>
                  <dt className="inline">Application effects: </dt>
                  <dd className="inline text-slate-200">
                    {applicationEffectsOff === null
                      ? "detecting…"
                      : applicationEffectsOff
                        ? "off"
                        : "available"}
                  </dd>
                </div>
                <div>
                  <dt className="inline">Cinematic safety: </dt>
                  <dd className="inline text-slate-200">
                    {cinematicAvailable
                      ? confirmedReduced
                        ? "confirmed for this route instance"
                        : "available"
                      : "bounded static"}
                  </dd>
                </div>
              </dl>
            </fieldset>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
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
              <div className="mb-1.5 text-[10px] font-bold tracking-[0.25em] text-slate-400">JOURNEY</div>
              <div className="flex flex-wrap gap-2">
                <TrayBtn
                  disabled={journeyControlsDisabled}
                  onClick={onFirst}
                >
                  ▶ first (~{(journeyEndMs / 1000).toFixed(1)}s)
                </TrayBtn>
                <TrayBtn
                  disabled={journeyControlsDisabled}
                  onClick={onReturning}
                >
                  ▶ returning (~1.4s)
                </TrayBtn>
                <TrayBtn
                  disabled={journeyControlsDisabled}
                  onClick={onResume}
                >
                  resume
                </TrayBtn>
              </div>
            </div>

            <div>
              <div className="mb-1.5 text-[10px] font-bold tracking-[0.25em] text-slate-400">JUMP TO BEAT</div>
              <div className="flex flex-wrap gap-2">
                {beatJumps.map((b) => (
                  <TrayBtn
                    key={b.p}
                    active={phase === b.p}
                    disabled={
                      journeyControlsDisabled &&
                      b.p !== "origin" &&
                      b.p !== "floor"
                    }
                    onClick={() => onJump(b.p)}
                  >
                    {b.label}
                  </TrayBtn>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="cxp-scrub" className="mb-1.5 block text-[10px] font-bold tracking-[0.25em] text-slate-400">
                TIMELINE SCRUB · {(scrubMs / 1000).toFixed(1)}s / {(journeyEndMs / 1000).toFixed(1)}s
              </label>
              <input
                id="cxp-scrub"
                type="range"
                min={0}
                max={journeyEndMs}
                step={100}
                value={scrubMs}
                disabled={journeyControlsDisabled}
                onChange={(e) => {
                  const ms = Number(e.target.value);
                  setScrubMs(ms);
                  onScrub(ms);
                }}
                className="w-full disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            <div>
              <div className="mb-1.5 text-[10px] font-bold tracking-[0.25em] text-slate-400">FLOOR STATIONS</div>
              <div className="flex flex-wrap gap-2">
                {stations.map((s) => (
                  <TrayBtn
                    key={s.id}
                    onClick={() => {
                      // The sheet covers the lower viewport: close it so the
                      // centered station is actually visible (review finding).
                      if (env !== "arena") onJump("floor");
                      close();
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
              <div className="mb-1.5 text-[10px] font-bold tracking-[0.25em] text-slate-400">FIXTURE STATE</div>
              <div className="flex flex-wrap gap-2">
                {states.map((s) => (
                  <TrayBtn key={s.key} active={fxKey === s.key} onClick={() => onState(s.key)}>
                    {s.label}
                  </TrayBtn>
                ))}
              </div>
              {note && <p className="mt-2 max-w-xl text-[11px] leading-relaxed text-slate-400">{note}</p>}
            </div>

            <div className="border-t border-ink-700/60 pt-3 text-[11px] text-slate-400">
              <div className="mb-1 text-[10px] font-bold tracking-[0.25em]">TECHNICAL CLEARANCE (director only)</div>
              <p className="tnum">
                {record.handle} · internal cohort mirror · policy v{record.policyVersion} · curve-consistent standing
                (xpForLevel = 25·n·(n−1))
              </p>
              <p className="mt-1">
                Auto honors browser reduced motion and application effects-off
                as separate signals. A confirmed Cinematic override applies
                only to this synthetic review route; Data Saver and low-memory
                safety remain static. No-JS renders the settled document. No
                WebGL exists anywhere in this experience.
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
  disabled,
  buttonRef,
  onClick,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  buttonRef?: Ref<HTMLButtonElement>;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`min-h-[44px] rounded border px-3 py-2 transition disabled:cursor-not-allowed disabled:opacity-50 ${
        active
          ? "border-amber-400/70 font-bold text-amber-200 ring-1 ring-amber-400/40"
          : "border-ink-600 hover:border-amber-400/60"
      }`}
    >
      {/* state is never colour alone: the active control also carries a
          mark, a ring and heavier weight (review finding) */}
      {active && <span aria-hidden>▸ </span>}
      {children}
    </button>
  );
}
