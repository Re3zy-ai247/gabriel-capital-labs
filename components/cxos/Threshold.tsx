"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import gsap from "gsap";
import { createThresholdScene, type ThresholdScene } from "./thresholdScene";
import { DirectorHUD, type DirectorController } from "./DirectorHUD";
import { BRAND } from "@/lib/brand";
import { THRESHOLD_SEEN_KEY } from "@/lib/cxos/capability";

// CXOS Threshold — the ENTRY (Phase 2 · "walking into the operating system").
//
// The visitor does not load CreditVector; they enter it. Six beats: the void ·
// the first light · the architecture · the name carved into it · CreditVector
// materializing · the opening onto the Hero. The real landing is fully
// rendered BENEATH this overlay the entire time — the Threshold is an
// entrance, never a gate: skip is one keystroke, the sequence self-advances
// (scroll makes you walk faster, it never traps you), and it plays once.
//
// RC1 posture (Founder Decision D-6, findings C-03/C-07/C-13):
//   · This component only ever mounts for a visitor who explicitly opted in
//     (ThresholdGate) — it is no longer a toll every first-time consumer pays.
//   · The entrance is bounded at 3 s of VISIBLE time, fade included. The beat
//     SHAPE below is unchanged: playback is progress-normalized
//     (`tl.progress(actual)`), so the same six beats play, bounded by the cap
//     instead of a ten-second walk.
//
//     Review M-2 corrected an earlier version of this claim. `WALK_S` is the
//     rate at which `target` reaches 1, NOT the duration of the overlay:
//     `actual` follows `target` through an exponential smoother, dismissal
//     fires at `actual > 0.999`, and a fade runs after that. With the old
//     spelling (rate = 3 s) the observed overlay life was ~4.5 s at 60 fps and
//     over 5 s at 15 fps — 50 % past the figure the source claimed. The bound
//     is now enforced rather than asserted: VISIBLE_CAP_S + FADE_S = 3.0 s is
//     a hard ceiling at ANY frame rate, and the walk rate is tuned so the cap
//     does not bite on a healthy run.
//   · The skip control is visible and focused at t=0. It used to fade in from
//     t=0.6 s while already holding focus — a sighted keyboard user had focus
//     on an invisible control, and a touch visitor had no escape at all for
//     the first second.
//   · aria-modal + a real focus trap: the landing beneath is opaque-covered,
//     so it must not stay traversable behind this overlay.
//   · The "already entered" memory is DURABLE (localStorage) as well as
//     per-session, so a new tab or a mobile-Safari eviction is not a re-charge.
//
// SOUND: designed, present, and OFF by default (grammar §5.11 — silence is the
// design; the mandate's facility is "almost silent"). The toggle synthesizes a
// deep facility hum with WebAudio on the user's explicit click — no audio
// files, no autoplay, nothing essential lives in sound.

// The one number the product promises, and everything below derived from it.
const TOTAL_S = 3.0;   // user-visible bound: overlay fully gone by this mark
const FADE_S = 0.55;   // the dismissal fade that runs AFTER the walk completes
// The cap can only be TESTED once per frame, so the walk overshoots it by at
// most one frame. Budgeting for a 100 ms frame (10 fps) keeps the 3.0 s bound
// true down to that frame rate; below it the watchdog is the hard floor and no
// per-frame check could do better.
const FRAME_ALLOWANCE_S = 0.1;
const VISIBLE_CAP_S = TOTAL_S - FADE_S - FRAME_ALLOWANCE_S; // 2.35 s of visible walk
const WALK_S = 1.2;    // seconds for `target` to reach 1 (input accelerates it)
// Watchdog basis. Deliberately larger than TOTAL_S: this timer is the
// freeze-detector of last resort, so it must sit clear of every healthy
// dismissal or a merely slow device earns a console.warn. (DUR + 2) * 1000 = 5 s.
const DUR = 3;

export function Threshold({ onDone, review = false }: { onDone: () => void; review?: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const skipRef = useRef<HTMLButtonElement>(null);
  const ctlRef = useRef<DirectorController | null>(null);
  const [hudReady, setHudReady] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const audioRef = useRef<{ ctx: AudioContext; gain: GainNode } | null>(null);

  useEffect(() => {
    // `done`/`cleanedUp` are LOCAL to this effect invocation — never refs.
    // This is load-bearing under React StrictMode's dev-only
    // mount→unmount→mount replay: a ref's VALUE persists across that whole
    // cycle (the component instance is never actually torn down, only its
    // effects re-run), so the first (StrictMode-simulated) unmount's
    // legitimate `done = true` would otherwise poison the second, REAL,
    // persisting mount — Escape, Skip, context-loss, the watchdog, and
    // natural completion all gate on it, so a poisoned flag makes every one
    // of them a silent, permanent no-op on the mount that actually matters.
    // CONFIRMED root cause (live, gstack, StrictMode dev repro) of the prior
    // report that this file's fix was "structurally present but ineffective
    // live" — `done` used to be `doneRef.current`, a ref.
    let done = false;
    let cleanedUp = false;

    const root = rootRef.current!;
    const canvas = canvasRef.current!;
    const mobile = window.innerWidth < 768 || "ontouchstart" in window;
    let scene: ThresholdScene | null = null;
    try {
      // onContextLost fires asynchronously, any time after creation succeeds —
      // unlike this try/catch (which only guards synchronous creation
      // failure), it is the recovery path for a context lost mid-scene.
      // finish() is a hoisted function declaration below, safe to reference
      // here; the callback itself only ever runs after the whole effect body
      // (including finish's own definition) has finished executing once.
      scene = createThresholdScene(canvas, mobile, () => finish(true));
    } catch {
      // A synchronous throw here is a REAL, observed path (not theoretical):
      // React StrictMode's dev-only mount→unmount→mount replay reuses the
      // same <canvas>, and a canvas hands out exactly ONE WebGL context for
      // its lifetime — if the sibling instance's dispose() already force-lost
      // it, Three.js's WebGLRenderer constructor throws trying to query
      // capabilities from that dead context. Nothing below this point has run
      // yet on THIS invocation — no
      // listeners, no rAF, no scroll-lock, no tl — so finish()/cleanup()
      // (which assume that setup already happened, and reference bindings
      // that don't exist yet at this point in the function) are the wrong
      // tool here. This is its own minimal, self-contained, always-safe
      // dismissal: straight to the landing, silently.
      done = true;
      cleanedUp = true;
      if (!review) { try { sessionStorage.setItem("cx-threshold", "1"); localStorage.setItem(THRESHOLD_SEEN_KEY, "1"); } catch { /* private mode */ } }
      onDone();
      return;
    }

    // The page beneath must not scroll while the visitor walks.
    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    // C-07 (review L-4): aria-modal is a promise to assistive tech, not an
    // enforcement — AT that ignores it, and plain Tab, would still reach a
    // fully-painted landing sitting under an opaque overlay. `inert` is the
    // enforcement. Applied to every body-level subtree that does NOT contain
    // this overlay, so the overlay itself is never inerted whatever the mount
    // point is, and restored exactly on teardown.
    const inerted: HTMLElement[] = [];
    for (const el of Array.from(document.body.children)) {
      if (!(el instanceof HTMLElement) || el.contains(root) || el.hasAttribute("inert")) continue;
      el.setAttribute("inert", "");
      inerted.push(el);
    }
    // This overlay (z-100) now owns the darkness the entry script painted (z-99).
    document.documentElement.removeAttribute("data-cxenter");

    // ── Master timeline: DOM beats keyed to normalized time ──────────────────
    const q = (sel: string) => root.querySelector<HTMLElement>(sel);
    const tl = gsap.timeline({ paused: true, defaults: { ease: "power3.out" } });
    // C-07/C-03: `.cxt-skip` is NOT animated. It is painted opaque in the
    // markup below and focused at t=0, so the visitor's escape hatch exists
    // from the first frame — never a focused-but-invisible control.
    tl.to(q(".cxt-vignette"), { opacity: 0.55, duration: 1.4 }, 0.1)
      .to(q(".cxt-hint"), { opacity: 0.7, duration: 0.8 }, 1.6)
      .to(q(".cxt-hint"), { opacity: 0, duration: 0.6 }, 4.2)
      // Beat 3 · the parent name, carved into the environment
      .fromTo(q(".cxt-gcl"), { opacity: 0, letterSpacing: "1.4em", scale: 0.97 },
        { opacity: 1, letterSpacing: "0.62em", scale: 1, duration: 1.7 }, 5.1)
      .to(q(".cxt-gcl"), { opacity: 0, y: -26, duration: 0.9, ease: "power2.in" }, 6.7)
      // Beat 4 · CreditVector materializes
      .fromTo(q(".cxt-cv"), { opacity: 0, scale: 0.94 }, { opacity: 1, scale: 1, duration: 1.1 }, 7.0)
      .fromTo(q(".cxt-sub"), { opacity: 0 }, { opacity: 0.9, duration: 0.8 }, 7.7)
      .fromTo(q(".cxt-init"), { opacity: 0 }, { opacity: 0.75, duration: 0.4 }, 8.3)
      .to(q(".cxt-init"), { opacity: 0.35, duration: 0.32, yoyo: true, repeat: 3, ease: "sine.inOut" }, 8.7)
      // Beat 5 · the opening — the identity yields to the room beyond
      .to(q(".cxt-center"), { opacity: 0, scale: 1.05, duration: 0.9, ease: "power2.in" }, 9.1)
      .to(root, { opacity: 0, duration: 0.7, ease: "power2.inOut" }, 9.35);

    // ── Advance model: time walks, input strides ─────────────────────────────
    // The sequence completes on its own (walk rate WALK_S, hard-capped at
    // VISIBLE_CAP_S of visible time). Wheel / touch / arrow keys add
    // stride — "every scroll is another step" — and can only move forward.
    let target = 0;
    let actual = 0;
    let paused = false;
    let speed = 1;
    let parallaxOn = true;
    const frameTimes: number[] = [];
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (!paused) target += Math.min(Math.abs(e.deltaY), 120) * 0.0022 * speed;
    };
    let touchY = 0;
    const onTouchStart = (e: TouchEvent) => { touchY = e.touches[0].clientY; };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const dy = touchY - e.touches[0].clientY;
      touchY = e.touches[0].clientY;
      if (dy > 0 && !paused) target += dy * 0.004 * speed;
    };

    // The room answers the hand: pointer parallax, and device tilt where it is
    // available without a permission wall (never prompt inside the Threshold).
    const onPointer = (e: PointerEvent) => {
      if (!parallaxOn) return;
      scene?.setParallax((e.clientX / window.innerWidth - 0.5) * 2, (e.clientY / window.innerHeight - 0.5) * 2);
    };
    const iosPermissionWall =
      typeof (DeviceOrientationEvent as unknown as { requestPermission?: unknown }).requestPermission === "function";
    const onTilt = (e: DeviceOrientationEvent) => {
      if (!parallaxOn || e.gamma == null || e.beta == null) return;
      scene?.setParallax(Math.max(-1, Math.min(1, e.gamma / 28)), Math.max(-1, Math.min(1, (e.beta - 40) / 32)));
    };
    const onKey = (e: KeyboardEvent) => {
      // Escape (and the Skip button, which redispatches this same key) is the
      // visitor's one guaranteed way out — it must not depend on the timeline
      // advancing or the renderer being alive, so it hard-dismisses (true),
      // same as the no-WebGL and context-lost paths. Natural completion below
      // is the one call site that still asks for the cosmetic fade, because
      // reaching it already proves the loop is healthy.
      if (e.key === "Escape") finish(true);
      if (e.key === "ArrowDown" || e.key === " ") { e.preventDefault(); target += 0.06; }
      // C-07: focus containment. The landing is fully painted and fully
      // focusable BENEATH an opaque overlay, so without this a keyboard or
      // screen-reader user tabs straight out of the dialog into content they
      // cannot see. Paired with aria-modal="true" on the root below.
      if (e.key === "Tab") {
        const focusables = Array.from(
          root.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((el) => el.offsetParent !== null);
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey && (active === first || !root.contains(active))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && (active === last || !root.contains(active))) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("keydown", onKey);
    if (!iosPermissionWall) window.addEventListener("deviceorientation", onTilt);

    const onResize = () => scene?.resize();
    window.addEventListener("resize", onResize);

    // Watchdog — cheap belt-and-suspenders for any freeze mode besides the
    // named context-loss case, INCLUDING a stuck natural-completion fade (see
    // cleanup's own comment above for why this calls cleanup() directly
    // rather than finish()). DUR is the slower of the two auto-advance speeds
    // (mobile is ~8s); +2s is grace, never a deadline a healthy run should
    // ever approach. Exempt in review mode, where looping past DUR is the
    // intended behavior, not a freeze — the Director HUD's own Escape still
    // exits it on demand. Forward-referencing cleanup() here is safe: it is a
    // hoisted function declaration, and this timer can only ever FIRE well
    // after the whole effect body (including cleanup's definition) has run.
    const watchdog = review ? undefined : window.setTimeout(() => {
      console.warn("[Threshold] watchdog forced dismissal — entrance did not reach completion within DUR + grace");
      cleanup();
    }, (DUR + 2) * 1000);

    let raf = 0;
    let last = performance.now();
    // VISIBLE time, not wall time: a backgrounded tab is not costing the
    // visitor anything, so it must not burn the budget either. This is what
    // makes the 3 s claim true at every frame rate — the smoother's tail is
    // frame-rate dependent, the clock is not.
    let visible = 0;
    const frame = (now: number) => {
      const elapsed = (now - last) / 1000;
      // `dt` stays clamped at 50 ms — it drives the walk and the scene, where a
      // long stall must not teleport the visitor forward. The BUDGET must not
      // use that clamp: at 10 fps a clamped dt under-counts real time by half,
      // which would stretch the very bound it exists to enforce. It gets real
      // elapsed time, itself bounded so one frame after a tab unhide cannot
      // spend the whole budget at once.
      const dt = Math.min(0.05, elapsed);
      last = now;
      if (!document.hidden) {
        visible += Math.min(elapsed, FRAME_ALLOWANCE_S * 2);
        frameTimes.push(dt * 1000);
        if (frameTimes.length > 120) frameTimes.shift();
        if (!paused) {
          target = Math.min(1, target + (dt * speed) / WALK_S); // the walk never stalls
          actual += (target - actual) * Math.min(1, dt * 4.5);              // heavy, smooth inertia
        }
        tl.progress(actual);
        scene?.setProgress(actual);
        scene?.tick(dt);
        if (audioRef.current) {
          // sound follows the walk: the hum swells toward the opening
          audioRef.current.gain.gain.setTargetAtTime(0.02 + actual * 0.03, audioRef.current.ctx.currentTime, 0.2);
        }
        // Two ways out, one exit: the walk finished, or the visible budget is
        // spent. The cap is exempt in review mode for the same reason the
        // watchdog is — the Director's loop past the end is intended.
        if (actual > 0.999 || (!review && visible >= VISIBLE_CAP_S)) {
          if (review) { target = 0; actual = 0; } // the review stage loops; Escape exits
          else finish(false);
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    skipRef.current?.focus({ preventScroll: true });

    // ── Director console (Founder Review Mode only — never on production) ────
    if (review && scene) {
      const sc = scene;
      ctlRef.current = {
        getProgress: () => actual,
        setProgress: (p) => { target = p; actual = p; },
        setPaused: (v) => { paused = v; },
        isPaused: () => paused,
        setSpeed: (v) => { speed = v; },
        getSpeed: () => speed,
        setDensity: (f) => sc.setDensity(f),
        setIntensity: (f) => sc.setIntensity(f),
        setParallaxEnabled: (v) => { parallaxOn = v; },
        getCameraZ: () => sc.getCameraZ(),
        frameTimes,
        replay: () => { target = 0; actual = 0; paused = false; },
      };
      setHudReady(true);
    }

    // cleanup is the ONE teardown path — hard-guarded on its OWN flag
    // (cleanedUp), separate from `done` above. This is deliberate: `done`
    // marks that a dismissal has been REQUESTED (so a second Escape press or
    // the natural-completion check can't also request one), but a requested
    // dismissal is not the same as a completed one — the non-immediate branch
    // of finish() defers this call behind a GSAP fade's onComplete, and that
    // fade runs on GSAP's own rAF-driven ticker, which can stall for the same
    // reasons (backgrounding, context loss) the entrance itself can. The
    // watchdog above calls cleanup() directly, bypassing finish()/`done`
    // entirely, specifically so a stuck fade can never leave it stranded
    // waiting on `done` being already (truthfully) true.
    function cleanup() {
      if (cleanedUp) return;
      cleanedUp = true;
      done = true;
      if (watchdog !== undefined) window.clearTimeout(watchdog);
      // Review runs never consume the visitor's one first impression.
      // C-13: durable AND per-session. The durable key is what stops the
      // entrance replaying on every new tab; the session key is kept so an
      // in-flight session with only the old marker still counts as entered.
      if (!review) { try { sessionStorage.setItem("cx-threshold", "1"); localStorage.setItem(THRESHOLD_SEEN_KEY, "1"); } catch { /* private mode */ } }
      cancelAnimationFrame(raf);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("deviceorientation", onTilt);
      window.removeEventListener("resize", onResize);
      document.documentElement.style.overflow = prevOverflow;
      for (const el of inerted) el.removeAttribute("inert");
      tl.kill();
      scene?.dispose();
      if (audioRef.current) {
        audioRef.current.gain.gain.setTargetAtTime(0, audioRef.current.ctx.currentTime, 0.05);
        const ctx = audioRef.current.ctx;
        setTimeout(() => void ctx.close(), 300);
        audioRef.current = null;
      }
      document.querySelector<HTMLElement>("#main h1")?.focus?.();
      onDone();
    }

    function finish(immediate: boolean) {
      if (done) return;
      done = true;
      if (immediate) cleanup();
      else gsap.to(root, { opacity: 0, duration: FADE_S, ease: "power2.inOut", onComplete: cleanup });
    }

    return () => { if (!cleanedUp) { cleanedUp = true; done = true; if (watchdog !== undefined) window.clearTimeout(watchdog); cancelAnimationFrame(raf); tl.kill(); scene?.dispose(); document.documentElement.style.overflow = prevOverflow; for (const el of inerted) el.removeAttribute("inert"); } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Opt-in facility hum — created ONLY on this click, never automatically.
  function toggleSound() {
    if (audioRef.current) {
      const { ctx, gain } = audioRef.current;
      gain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
      setTimeout(() => void ctx.close(), 300);
      audioRef.current = null;
      setSoundOn(false);
      return;
    }
    const ctx = new AudioContext();
    const gain = ctx.createGain();
    gain.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 220;
    for (const f of [54, 54.35, 108.2]) {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = f;
      o.connect(filter);
      o.start();
    }
    filter.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setTargetAtTime(0.035, ctx.currentTime, 0.6);
    audioRef.current = { ctx, gain };
    setSoundOn(true);
  }

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={`${BRAND.product} introduction. Press Escape to skip.`}
      className="fixed inset-0 z-[100] bg-[#02040a]"
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden />
      {/* screen-space vignette — depth without postprocessing */}
      <div aria-hidden className="cxt-vignette pointer-events-none absolute inset-0 opacity-0"
        style={{ background: "radial-gradient(ellipse 78% 62% at 50% 46%, transparent 52%, rgba(1,2,6,0.9) 100%)" }} />

      <p className="cxt-hint pointer-events-none absolute inset-x-0 bottom-14 text-center text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-400 opacity-0">
        scroll to walk &nbsp;·&nbsp; esc to skip
      </p>

      <div className="cxt-center pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
        <div className="cxt-gcl select-none text-[11px] font-bold uppercase text-slate-300 opacity-0 md:text-sm"
          style={{ textShadow: "0 1px 0 rgba(0,0,0,0.9), 0 0 24px rgba(14,165,196,0.35)" }}>
          {BRAND.parent}
        </div>
        <div className="cxt-cv mt-2 flex select-none items-center gap-4 opacity-0">
          <Image src="/logo-mark.png" alt="" width={64} height={64} priority={false}
            className="h-12 w-12 md:h-16 md:w-16" />
          <span className="h-display text-4xl text-white md:text-6xl">{BRAND.product}<span className="align-super text-base md:text-xl">™</span></span>
        </div>
        <div className="cxt-sub mt-4 text-xs font-semibold uppercase tracking-[0.42em] text-brand-300 opacity-0 md:text-sm">
          Credit Intelligence Operating System
        </div>
        <div className="cxt-init tnum mt-8 text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500 opacity-0">
          Initializing…
        </div>
      </div>

      {hudReady && ctlRef.current ? <DirectorHUD ctl={ctlRef.current} /> : null}
      <div className="absolute right-4 top-4 flex items-center gap-2 md:right-6 md:top-6">
        <button type="button" onClick={toggleSound}
          className="rounded-lg border border-ink-600/80 bg-ink-900/60 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-slate-300 backdrop-blur transition hover:border-brand-500/50 hover:text-white"
          aria-pressed={soundOn}>
          {soundOn ? "Sound on" : "Sound off"}
        </button>
        <button ref={skipRef} type="button"
          // finish() lives in the effect closure; Escape is its one public entry,
          // so the button reuses that single code path (finish() self-guards).
          onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))}
          className="cxt-skip rounded-lg border border-ink-600/80 bg-ink-900/60 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-slate-300 backdrop-blur transition hover:border-brand-500/50 hover:text-white">
          Skip intro
        </button>
      </div>
    </div>
  );
}
