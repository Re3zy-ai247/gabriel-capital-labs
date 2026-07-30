"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
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
  // Remount key for the overlay: every fresh run/jump/scrub remounts it so
  // CSS animation clocks start at zero and the negative-delay seek is exact.
  const [runNonce, setRunNonce] = useState(0);

  const originRef = useRef<HTMLDivElement>(null);
  const floorRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLParagraphElement>(null);
  const timers = useRef<number[]>([]);
  const phaseRef = useRef<PassagePhase>("origin");
  const trayOpenRef = useRef(false);
  const rafToken = useRef<number | null>(null);
  const announceRef = useRef("");
  const skipRef = useRef<(() => void) | null>(null);

  phaseRef.current = phase;
  const fx = passageFixture(fxKey);
  const cinematic = tier === "A" || tier === "B";

  // aria-live only announces on a DOM change — an identical string is a
  // bailed-out state update and says nothing. A zero-width toggle makes
  // every announcement land (adversarial review finding, 2026-07-29).
  const say = useCallback((s: string) => {
    setAnnounce(announceRef.current === s ? s + "​" : s);
    announceRef.current = s;
  }, []);

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
  useLayoutEffect(() => {
    // A LAYOUT effect: it runs after the env display swap has committed
    // but BEFORE paint, so no frame can ever show the new environment at
    // a stale scroll offset (a plain effect runs post-paint — caught by
    // adversarial review). scroll-behavior:smooth in the base stylesheet
    // is overridden by the explicit instant behavior.
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [env]);

  // ── inert containment while the overlay plays ────────────────────────
  // Both environments AND the footer: the only operable things outside the
  // dialog are the director instruments, deliberately.
  const overlayActive = CINEMATIC.has(phase);
  useEffect(() => {
    const o = originRef.current;
    const f = floorRef.current;
    const ft = footerRef.current;
    for (const el of [o, f, ft]) {
      if (!el) continue;
      if (overlayActive) el.setAttribute("inert", "");
      else el.removeAttribute("inert");
    }
    return () => {
      for (const el of [o, f, ft]) el?.removeAttribute("inert");
    };
  }, [overlayActive]);

  // A mid-journey OS reduced-motion flip must never strand an invisible
  // modal (the reduce CSS hides the veil while inert holds): settle by the
  // same two-phase law the moment the preference changes.
  useEffect(() => {
    if (!overlayActive) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) skipRef.current?.();
    };
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [overlayActive]);

  // ── settles ──────────────────────────────────────────────────────────
  // Every settle lifts inert BEFORE focusing — an inert subtree refuses
  // focus, and the containment effect only clears after the phase change.
  const liftInert = useCallback(() => {
    originRef.current?.removeAttribute("inert");
    floorRef.current?.removeAttribute("inert");
  }, []);

  const settleForward = useCallback((announceArrival = true) => {
    clearTimers();
    setPaused(false);
    setSeekMs(null);
    swapEnv("arena");
    setArrived(true);
    // The natural end does NOT re-announce: the greeting was the last
    // utterance and a fresh status would stomp it in the live region
    // (adversarial review finding, 2026-07-29). Skips and watchdogs do.
    if (announceArrival) say("Arena arrival complete.");
    // Focus the destination heading BEFORE the overlay unmounts: the h1
    // is already in the (newly displayed) floor; the overlay goes next
    // commit, so no keystroke ever lands on body. When the director's
    // tray drove this settle, focus stays in the tray.
    const keepTray = trayOpenRef.current;
    requestAnimationFrame(() => {
      liftInert();
      // querySelector over a selector LIST returns the first match in
      // DOCUMENT order — the hidden origin h1 would win and refuse focus.
      // The floor's own heading must be tried first, explicitly.
      const h =
        document.querySelector<HTMLElement>("#arena-floor h1") ??
        document.querySelector<HTMLElement>("main h1, h1");
      if (!keepTray && h) {
        h.setAttribute("tabindex", "-1");
        h.focus({ preventScroll: true });
      }
      setPhase("floor");
    });
  }, [swapEnv, liftInert, say]);

  const settleCancel = useCallback(() => {
    clearTimers();
    setPaused(false);
    setSeekMs(null);
    say("Journey cancelled. Mission Control.");
    const keepTray = trayOpenRef.current;
    requestAnimationFrame(() => {
      liftInert();
      if (!keepTray) {
        // The call may not exist (access-refused fixtures): fall back to
        // the origin heading so focus never lands on body.
        const b =
          document.querySelector<HTMLElement>("[data-cxp-proceed]") ??
          document.querySelector<HTMLElement>(".cx-p-mc h1");
        if (b) {
          if (b.tagName === "H1") b.setAttribute("tabindex", "-1");
          b.focus({ preventScroll: true });
        }
      }
      setPhase("origin");
    });
  }, [liftInert, say]);

  const settleReturn = useCallback(() => {
    clearTimers();
    setPaused(false);
    setSeekMs(null);
    swapEnv("mc");
    setArrived(false);
    say("Mission Control.");
    const keepTray = trayOpenRef.current;
    requestAnimationFrame(() => {
      liftInert();
      const h = document.querySelector<HTMLElement>(".cx-p-mc h1, h1");
      if (!keepTray && h) {
        h.setAttribute("tabindex", "-1");
        h.focus({ preventScroll: true });
      }
      setPhase("origin");
    });
  }, [swapEnv, liftInert, say]);

  // ── the journeys ─────────────────────────────────────────────────────
  const beginJourney = useCallback(
    (variant: "first" | "returning", restart = false) => {
      // Double activation cannot stack journeys — but the director's
      // restart path deliberately replaces the running one (clearTimers
      // below disarms every ghost timer of the replaced run).
      if (!restart && CINEMATIC.has(phaseRef.current)) return;
      // No ceremony exists for a state the gate refuses: the flag-off and
      // outside-cohort fixtures have no call, and the director instruments
      // honor the same truth (adversarial review finding, 2026-07-29).
      if (!fx.access) return;
      clearTimers();
      const mobile = tier === "B";
      const kind = variant === "returning" ? "returning" : mobile ? "mobile" : "first";
      setRunKind(kind);
      setSeekMs(null);
      setPaused(false);
      // A fresh run always remounts the overlay so its animations start at
      // zero (a held final frame would otherwise persist — fill: both).
      setRunNonce((n) => n + 1);
      if (restart) swapEnv("mc");
      if (variant === "returning") {
        setPhase("call");
        say("Returning to the Arena floor.");
        arm(() => settleForward(), RETURNING_END_MS);
      } else {
        const beats = mobile ? BEATS_MOBILE : BEATS_FIRST;
        const end = mobile ? JOURNEY_END_MOBILE_MS : JOURNEY_END_MS;
        setPhase("call");
        say("Departure from Mission Control.");
        for (const b of beats.slice(1)) {
          arm(() => {
            setPhase(b.phase);
            if (b.phase === "clearance") {
              say(
                fx.key === "data-error"
                  ? "Clearance confirmed. Record unavailable. Fail-safe standing shown."
                  : fx.record.awardCount > 0
                    ? "Clearance confirmed. Record located. Evidence in order."
                    : "Clearance confirmed. Record located. No evidence on record."
              );
            }
            if (b.phase === "passage") say("The passage.");
            if (b.phase === "threshold") {
              // The chamber must exist beneath the final frame: swap while
              // the veil is fully opaque so the dissolve reveals the real
              // floor in match-cut alignment.
              swapEnv("arena");
              say("The Arena.");
            }
            if (b.phase === "greeting") {
              say(
                fx.key === "data-error"
                  ? `Welcome to the Arena, ${fx.record.displayName}. Record unavailable — the fail-safe empty standing is shown.`
                  : fx.record.awardCount > 0
                    ? `Welcome to the Arena, ${fx.record.displayName}. Standing recognized — ${fx.record.rank}, level ${fx.record.level}, ${fx.record.totalXp} lifetime XP, ${fx.record.awardCount} evidenced awards.`
                    : `Welcome to the Arena, ${fx.record.displayName}. Standing recognized — ${fx.record.rank}, level ${fx.record.level}. Only evidenced activity builds this record.`
              );
            }
          }, b.at);
        }
        arm(() => settleForward(false), end);
      }
      // The JS watchdog: strictly after every journey end, strictly before
      // the 18 s CSS safety fade.
      arm(() => {
        if (CINEMATIC.has(phaseRef.current)) settleForward();
      }, WATCHDOG_MS);
    },
    // fx.key/fx.access matter too — EMPTY_RECORD is shared by the empty
    // and data-error fixtures, so fx.record alone would go stale between them.
    [tier, fx, settleForward, swapEnv, say]
  );

  const beginReturn = useCallback(() => {
    if (CINEMATIC.has(phaseRef.current)) return;
    clearTimers();
    setRunKind("return");
    setRunNonce((n) => n + 1);
    setPhase("returning");
    say("Returning to Mission Control.");
    // Swap behind the opaque veil at its midpoint, settle at its end.
    arm(() => swapEnv("mc"), Math.round(RETURN_END_MS / 2));
    arm(() => settleReturn(), RETURN_END_MS);
    arm(() => {
      if (CINEMATIC.has(phaseRef.current)) settleReturn();
    }, WATCHDOG_MS);
  }, [swapEnv, settleReturn, say]);

  // ── two-phase skip (Escape · click · wheel · touch · keys) ───────────
  const cancelable = CANCEL_PHASES.includes(phase);
  const skip = useCallback(() => {
    const p = phaseRef.current;
    if (!CINEMATIC.has(p)) return;
    if (p === "returning") settleReturn();
    else if (CANCEL_PHASES.includes(p)) settleCancel();
    else settleForward();
  }, [settleCancel, settleForward, settleReturn]);

  // The reduced-motion listener and any late caller reach the CURRENT skip.
  skipRef.current = skip;

  useEffect(() => {
    if (!overlayActive) return;
    const onKey = (e: KeyboardEvent) => {
      // The tray consumes its own Escape first (director is inspecting).
      if (trayOpenRef.current) return;
      // Space and PageDown are ALSO activation/scroll keys: treat them as
      // skip intent only when focus is not on a real control, or the same
      // keypress would both settle the journey and press a button
      // (adversarial review finding, 2026-07-29). Escape is unconditional.
      const t = e.target as HTMLElement | null;
      const onControl =
        !!t && t !== document.body && !!t.closest("button, a, input, select, textarea, [tabindex]");
      if (e.key === "Escape") return skip();
      if ((e.key === " " || e.key === "PageDown") && !onControl) skip();
    };
    // Scroll input during the travel is skip intent, never a hijack: the
    // listeners are passive and never call preventDefault. While the tray
    // is open the director is scrolling the SHEET — never a skip.
    const onWheel = () => {
      if (!trayOpenRef.current) skip();
    };
    const onTouch = () => {
      if (!trayOpenRef.current) skip();
    };
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
      // The gate's truth binds the instruments too: no jump can conjure a
      // ceremony (or the floor) for a state whose call does not exist.
      if (!fx.access) return;
      if (target === "floor") return settleForward();
      if (target === "returning") {
        if (env !== "arena") swapEnv("arena");
        setRunKind("return");
        setRunNonce((n) => n + 1);
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
      setRunNonce((n) => n + 1);
      setPhase(target);
      setSeekMs(b.at);
      setPaused(true);
      // A held beat still gets a JS exit: without this the watchdog would
      // be disarmed and only the CSS fade could end the hold (adversarial
      // review finding, 2026-07-29).
      arm(() => {
        if (CINEMATIC.has(phaseRef.current)) settleForward();
      }, WATCHDOG_MS);
    },
    [tier, env, fx, swapEnv, settleForward, settleReturn]
  );

  const scrub = useCallback(
    (ms: number) => {
      if (!fx.access) return;
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
      // Remount so the overlay's animation clock starts at zero: the
      // negative-delay seek is only exact against an unstarted clock
      // (scrubbing into a live run showed elapsed+seek — review finding).
      setRunNonce((n) => n + 1);
      setPhase(current);
      setSeekMs(ms);
      setPaused(true);
      arm(() => {
        if (CINEMATIC.has(phaseRef.current)) settleForward();
      }, WATCHDOG_MS);
    },
    [tier, fx, swapEnv, settleForward]
  );

  // Resume a held inspection: the negative-delay seek is KEPT (the world
  // continues from the held frame, it does not restart) and the remainder
  // of the timeline is re-armed — beats, settle and watchdog. Without this
  // a resumed hold played to its final frame and never settled, leaving an
  // inert document behind a frozen veil (adversarial review finding).
  const resumeRun = useCallback(() => {
    const p = phaseRef.current;
    if (!CINEMATIC.has(p)) return;
    clearTimers();
    setPaused(false);
    if (p === "returning") {
      arm(() => swapEnv("mc"), Math.round(RETURN_END_MS / 2));
      arm(() => settleReturn(), RETURN_END_MS);
      arm(() => {
        if (CINEMATIC.has(phaseRef.current)) settleReturn();
      }, WATCHDOG_MS);
      return;
    }
    const mobile = tier === "B";
    const beats = mobile ? BEATS_MOBILE : BEATS_FIRST;
    const end = mobile ? JOURNEY_END_MOBILE_MS : JOURNEY_END_MS;
    const from = seekMs ?? 0;
    for (const b of beats) {
      if (b.at <= from) continue;
      arm(() => {
        setPhase(b.phase);
        if (b.phase === "threshold") swapEnv("arena");
      }, b.at - from);
    }
    arm(() => settleForward(), Math.max(120, end - from));
    arm(() => {
      if (CINEMATIC.has(phaseRef.current)) settleForward();
    }, WATCHDOG_MS);
  }, [tier, seekMs, swapEnv, settleForward, settleReturn]);

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
          key={runNonce}
          run={runKind}
          fx={fx}
          cancelable={cancelable}
          onSkip={skip}
          paused={paused}
          seekMs={seekMs}
          // When the director's tray drove this mount, focus stays in the
          // sheet instead of being yanked to the Skip button every press.
          takeFocus={!trayOpenRef.current}
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
          say(`Fixture state: ${k}. Mission Control.`);
        }}
        // restart=true: replacing a run is deliberate here, and
        // beginJourney's clearTimers disarms every ghost timer of the run
        // being replaced (a guard-return used to leave them armed, so a
        // dead journey later teleported the page — review finding).
        onFirst={() => beginJourney("first", true)}
        onReturning={() => beginJourney("returning", true)}
        onJump={jumpTo}
        onScrub={scrub}
        onResume={resumeRun}
      />

      <p
        ref={footerRef}
        className="px-6 pb-24 pl-6 text-center text-[11px] leading-relaxed text-slate-600 sm:pb-10"
      >
        Review instruments exist only in review builds; production is hard-off. This route
        never writes a session marker — no real visitor&apos;s first entry is consumed.{" "}
        <Link href="/review" className="text-brand-300">
          ← All rooms
        </Link>
      </p>
    </main>
  );
}
