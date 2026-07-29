"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { detectTier, type CxTier } from "@/lib/cxos/capability";
import {
  BEATS_FIRST,
  BEATS_MOBILE,
  CANCEL_PHASES,
  JOURNEY_END_MS,
  JOURNEY_END_MOBILE_MS,
  RETURNING_END_MS,
  RETURN_END_MS,
  WATCHDOG_MS,
  type PassagePhase,
} from "@/lib/cxos/passageTimeline";
import { passageFixture, PASSAGE_STATES, type PassageStateKey } from "./fixtures";
import { MissionControlOrigin } from "./MissionControlOrigin";
import { ArenaFloor } from "./ArenaFloor";
import { PassageOverlay } from "./PassageOverlay";
import { PassageTray } from "./PassageTray";

// CXOS Phase 5.1 — THE PASSAGE · the journey state machine.
//
// One route, one document, no history mutation. The server renders both
// environments in normal flow (the no-JS truth). After hydration, tiers
// A/B stamp html[data-cxpassage] and the machine takes over:
//
//   origin ──proceed──▶ cinematic travel ──settle──▶ floor ──return──▶ origin
//
// Laws enforced here (guard-pinned in scripts/cxos-passage.test.ts):
// · The environment swap happens in ONE synchronous commit while the veil
//   is fully opaque: display swap + scrollTo({behavior:"instant"}) before
//   the next paint — nothing visible ever shifts (CLS 0).
// · Two-phase escape: during call/clearance Escape/click/wheel CANCELS to
//   the origin (the misclick is never force-shipped); from passage onward
//   they settle forward to the floor.
// · Focus containment: the overlay is aria-modal and both environments are
//   inert while it plays; focus moves to the destination heading BEFORE
//   the overlay unmounts.
// · Safety ordering: journey end < 14 s JS watchdog < 18 s pure-CSS fade.
// · Native scroll stays authoritative on the floor; the station rAF only
//   writes CSS vars, never preventDefault, never a scroll lock.
// · Review-only surface: no sessionStorage key exists here at all — every
//   run is a founder-review run, so there is no first-entry marker to
//   consume (the live cx-mc / cx-arena markers are never touched).

const CINEMATIC = new Set<PassagePhase>([
  "call",
  "clearance",
  "passage",
  "conversion",
  "threshold",
  "greeting",
  "returning",
]);

export function PassageJourney() {
  const [tier, setTier] = useState<CxTier | null>(null);
  const [phase, setPhase] = useState<PassagePhase>("origin");
  const [env, setEnv] = useState<"mc" | "arena">("mc");
  const [fxKey, setFxKey] = useState<PassageStateKey>("populated");
  const [runKind, setRunKind] = useState<"first" | "mobile" | "returning" | "return">("first");
  const [arrived, setArrived] = useState(false);
  const [announce, setAnnounce] = useState("");
  const [paused, setPaused] = useState(false);
  const [seekMs, setSeekMs] = useState<number | null>(null);

  const originRef = useRef<HTMLDivElement>(null);
  const floorRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const phaseRef = useRef<PassagePhase>("origin");
  const trayOpenRef = useRef(false);
  const rafToken = useRef<number | null>(null);

  phaseRef.current = phase;
  const fx = passageFixture(fxKey);
  const cinematic = tier === "A" || tier === "B";

  // ── tier detection + the document stamp ─────────────────────────────
  useEffect(() => {
    try {
      const t = detectTier();
      setTier(t);
      if (t === "A" || t === "B") {
        document.documentElement.setAttribute("data-cxpassage", t);
      }
    } catch {
      setTier("C");
    }
    return () => {
      document.documentElement.removeAttribute("data-cxpassage");
      timers.current.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  const arm = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
  const clearTimers = () => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  };

  // ── the one environment swap (opaque-veil, same-frame) ───────────────
  const swapEnv = useCallback((to: "mc" | "arena") => {
    setEnv(to);
    // The scroll runs in the same commit's layout effect via the state
    // change below; doing it here synchronously is safe because the veil
    // is opaque — but React batches, so the authoritative scroll lives in
    // the env layout effect.
  }, []);
  useEffect(() => {
    // Fires after the env display swap has committed, before paint —
    // scroll-behavior:smooth in the base stylesheet is overridden by the
    // explicit instant behavior (never the two-argument form).
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [env]);

  // ── inert containment while the overlay plays ────────────────────────
  const overlayActive = CINEMATIC.has(phase);
  useEffect(() => {
    const o = originRef.current;
    const f = floorRef.current;
    for (const el of [o, f]) {
      if (!el) continue;
      if (overlayActive) el.setAttribute("inert", "");
      else el.removeAttribute("inert");
    }
    return () => {
      for (const el of [o, f]) el?.removeAttribute("inert");
    };
  }, [overlayActive]);

  // ── settles ──────────────────────────────────────────────────────────
  // Every settle lifts inert BEFORE focusing — an inert subtree refuses
  // focus, and the containment effect only clears after the phase change.
  const liftInert = useCallback(() => {
    originRef.current?.removeAttribute("inert");
    floorRef.current?.removeAttribute("inert");
  }, []);

  const settleForward = useCallback(() => {
    clearTimers();
    setPaused(false);
    setSeekMs(null);
    swapEnv("arena");
    setArrived(true);
    setAnnounce("Arena arrival complete.");
    // Focus the destination heading BEFORE the overlay unmounts: the h1
    // is already in the (newly displayed) floor; the overlay goes next
    // commit, so no keystroke ever lands on body.
    requestAnimationFrame(() => {
      liftInert();
      // querySelector over a selector LIST returns the first match in
      // DOCUMENT order — the hidden origin h1 would win and refuse focus.
      // The floor's own heading must be tried first, explicitly.
      const h =
        document.querySelector<HTMLElement>("#arena-floor h1") ??
        document.querySelector<HTMLElement>("main h1, h1");
      if (h) {
        h.setAttribute("tabindex", "-1");
        h.focus({ preventScroll: true });
      }
      setPhase("floor");
    });
  }, [swapEnv, liftInert]);

  const settleCancel = useCallback(() => {
    clearTimers();
    setPaused(false);
    setSeekMs(null);
    setAnnounce("Journey cancelled. Mission Control.");
    requestAnimationFrame(() => {
      liftInert();
      const b = document.querySelector<HTMLElement>("[data-cxp-proceed]");
      b?.focus({ preventScroll: true });
      setPhase("origin");
    });
  }, [liftInert]);

  const settleReturn = useCallback(() => {
    clearTimers();
    setPaused(false);
    setSeekMs(null);
    swapEnv("mc");
    setArrived(false);
    setAnnounce("Mission Control.");
    requestAnimationFrame(() => {
      liftInert();
      const h = document.querySelector<HTMLElement>(".cx-p-mc h1, h1");
      if (h) {
        h.setAttribute("tabindex", "-1");
        h.focus({ preventScroll: true });
      }
      setPhase("origin");
    });
  }, [swapEnv, liftInert]);

  // ── the journeys ─────────────────────────────────────────────────────
  const beginJourney = useCallback(
    (variant: "first" | "returning") => {
      // Double activation cannot stack journeys.
      if (CINEMATIC.has(phaseRef.current)) return;
      clearTimers();
      const mobile = tier === "B";
      const kind = variant === "returning" ? "returning" : mobile ? "mobile" : "first";
      setRunKind(kind);
      setSeekMs(null);
      setPaused(false);
      if (variant === "returning") {
        setPhase("call");
        setAnnounce("Returning to the Arena floor.");
        arm(() => settleForward(), RETURNING_END_MS);
      } else {
        const beats = mobile ? BEATS_MOBILE : BEATS_FIRST;
        const end = mobile ? JOURNEY_END_MOBILE_MS : JOURNEY_END_MS;
        setPhase("call");
        setAnnounce("Departure from Mission Control.");
        for (const b of beats.slice(1)) {
          arm(() => {
            setPhase(b.phase);
            if (b.phase === "clearance") {
              setAnnounce(
                fx.record.awardCount > 0
                  ? "Clearance confirmed. Record located. Evidence in order."
                  : "Clearance confirmed. Record located. No evidence on record."
              );
            }
            if (b.phase === "passage") setAnnounce("The passage.");
            if (b.phase === "threshold") {
              // The chamber must exist beneath the final frame: swap while
              // the veil is fully opaque so the dissolve reveals the real
              // floor in match-cut alignment.
              swapEnv("arena");
              setAnnounce("The Arena.");
            }
            if (b.phase === "greeting") {
              setAnnounce(
                fx.record.awardCount > 0
                  ? `Welcome to the Arena, ${fx.record.displayName}. Standing recognized — ${fx.record.rank}, level ${fx.record.level}, ${fx.record.totalXp} lifetime XP, ${fx.record.awardCount} evidenced awards.`
                  : `Welcome to the Arena, ${fx.record.displayName}. Standing recognized — ${fx.record.rank}, level ${fx.record.level}. Only evidenced activity builds this record.`
              );
            }
          }, b.at);
        }
        arm(() => settleForward(), end);
      }
      // The JS watchdog: strictly after every journey end, strictly before
      // the 18 s CSS safety fade.
      arm(() => {
        if (CINEMATIC.has(phaseRef.current)) settleForward();
      }, WATCHDOG_MS);
    },
    [tier, fx.record, settleForward, swapEnv]
  );

  const beginReturn = useCallback(() => {
    if (CINEMATIC.has(phaseRef.current)) return;
    clearTimers();
    setRunKind("return");
    setPhase("returning");
    setAnnounce("Returning to Mission Control.");
    // Swap behind the opaque veil at its midpoint, settle at its end.
    arm(() => swapEnv("mc"), Math.round(RETURN_END_MS / 2));
    arm(() => settleReturn(), RETURN_END_MS);
    arm(() => {
      if (CINEMATIC.has(phaseRef.current)) settleReturn();
    }, WATCHDOG_MS);
  }, [swapEnv, settleReturn]);

  // ── two-phase skip (Escape · click · wheel · touch · keys) ───────────
  const cancelable = CANCEL_PHASES.includes(phase);
  const skip = useCallback(() => {
    const p = phaseRef.current;
    if (!CINEMATIC.has(p)) return;
    if (p === "returning") settleReturn();
    else if (CANCEL_PHASES.includes(p)) settleCancel();
    else settleForward();
  }, [settleCancel, settleForward, settleReturn]);

  useEffect(() => {
    if (!overlayActive) return;
    const onKey = (e: KeyboardEvent) => {
      // The tray consumes its own Escape first (director is inspecting).
      if (trayOpenRef.current) return;
      if (e.key === "Escape" || e.key === " " || e.key === "PageDown") skip();
    };
    // Scroll input during the travel is skip intent, never a hijack: the
    // listeners are passive and never call preventDefault.
    const onWheel = () => skip();
    const onTouch = () => skip();
    window.addEventListener("keydown", onKey);
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchmove", onTouch, { passive: true });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchmove", onTouch);
    };
  }, [overlayActive, skip]);

  // ── floor depth choreography (tier A only; passive; CSS vars only) ───
  useEffect(() => {
    if (env !== "arena" || tier !== "A") return;
    const stations = Array.from(document.querySelectorAll<HTMLElement>(".cx-p-depth"));
    if (stations.length === 0) return;
    let scheduled = false;
    const measure = () => {
      scheduled = false;
      if (document.hidden) return;
      const vh = window.innerHeight;
      for (const el of stations) {
        const rect = el.getBoundingClientRect();
        // 0 when the station enters, 1 when it leaves — clamped.
        const p = Math.min(1, Math.max(0, 1 - (rect.top + rect.height * 0.5) / (vh + rect.height * 0.5)));
        el.style.setProperty("--cxs", p.toFixed(3));
      }
    };
    const onScroll = () => {
      if (scheduled) return;
      scheduled = true;
      rafToken.current = window.requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (rafToken.current) window.cancelAnimationFrame(rafToken.current);
    };
  }, [env, tier]);

  // ── director instruments (the route is review-only by its page gate) ─
  const jumpTo = useCallback(
    (target: PassagePhase) => {
      clearTimers();
      setPaused(false);
      if (target === "origin") return settleReturn();
      if (target === "floor") return settleForward();
      if (target === "returning") {
        if (env !== "arena") swapEnv("arena");
        setRunKind("return");
        setPhase("returning");
        arm(() => swapEnv("mc"), Math.round(RETURN_END_MS / 2));
        arm(() => settleReturn(), RETURN_END_MS);
        return;
      }
      // Jump into the forward timeline at the target's beat and hold.
      const mobile = tier === "B";
      const beats = mobile ? BEATS_MOBILE : BEATS_FIRST;
      const b = beats.find((x) => x.phase === target);
      if (!b) return;
      setRunKind(mobile ? "mobile" : "first");
      if (target === "threshold" || target === "greeting") swapEnv("arena");
      else swapEnv("mc");
      setPhase(target);
      setSeekMs(b.at);
      setPaused(true);
    },
    [tier, env, swapEnv, settleForward, settleReturn]
  );

  const scrub = useCallback(
    (ms: number) => {
      const mobile = tier === "B";
      const beats = mobile ? BEATS_MOBILE : BEATS_FIRST;
      if (!CINEMATIC.has(phaseRef.current) || phaseRef.current === "returning") {
        setRunKind(mobile ? "mobile" : "first");
        setPhase("call");
      }
      clearTimers();
      let current: PassagePhase = "call";
      for (const b of beats) if (ms >= b.at) current = b.phase;
      if (current === "threshold" || current === "greeting") swapEnv("arena");
      else swapEnv("mc");
      setPhase(current);
      setSeekMs(ms);
      setPaused(true);
    },
    [tier, swapEnv]
  );

  // ── render ───────────────────────────────────────────────────────────
  const journeyEnd = tier === "B" ? JOURNEY_END_MOBILE_MS : JOURNEY_END_MS;
  return (
    <main id="top" className="min-h-screen bg-ink-950 text-white">
      {/* concise assistive status — the world itself is decorative */}
      <p aria-live="polite" role="status" className="sr-only">
        {announce}
      </p>

      <div
        ref={originRef}
        style={cinematic && env !== "mc" ? { display: "none" } : undefined}
      >
        <MissionControlOrigin fx={fx} cinematic={cinematic} onProceed={() => beginJourney("first")} />
      </div>

      <div
        ref={floorRef}
        style={cinematic && env !== "arena" ? { display: "none" } : undefined}
      >
        <ArenaFloor fx={fx} cinematic={cinematic} arrived={arrived} onReturn={beginReturn} />
      </div>

      {overlayActive && (
        <PassageOverlay
          run={runKind}
          fx={fx}
          cancelable={cancelable}
          onSkip={skip}
          paused={paused}
          seekMs={seekMs}
        />
      )}

      <PassageTray
        tier={tier}
        phase={phase}
        env={env}
        fxKey={fxKey}
        states={PASSAGE_STATES}
        journeyEndMs={journeyEnd}
        record={fx.record}
        note={fx.note}
        trayOpenRef={trayOpenRef}
        onState={(k) => {
          clearTimers();
          setFxKey(k);
          setArrived(false);
          setPaused(false);
          setSeekMs(null);
          swapEnv("mc");
          setPhase("origin");
        }}
        onFirst={() => {
          if (env === "arena") {
            swapEnv("mc");
            setPhase("origin");
          }
          beginJourney("first");
        }}
        onReturning={() => beginJourney("returning")}
        onJump={jumpTo}
        onScrub={scrub}
        onResume={() => {
          setPaused(false);
          setSeekMs(null);
        }}
      />

      <p className="px-6 pb-10 text-center text-[11px] leading-relaxed text-slate-600">
        Review instruments exist only in review builds; production is hard-off. This route
        never writes a session marker — no real visitor&apos;s first entry is consumed.{" "}
        <Link href="/review" className="text-brand-300">
          ← All rooms
        </Link>
      </p>
    </main>
  );
}
