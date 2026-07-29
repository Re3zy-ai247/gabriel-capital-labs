"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import gsap from "gsap";
import { createThresholdScene, type ThresholdScene } from "./thresholdScene";
import { BRAND } from "@/lib/brand";

// CXOS Threshold — the ENTRY (Phase 2 · "walking into the operating system").
//
// The visitor does not load CreditVector; they enter it. Ten seconds, six
// beats: the void · the first light · the architecture · the name carved into
// it · CreditVector materializing · the opening onto the Hero. The real
// landing is fully rendered BENEATH this overlay the entire time — the
// Threshold is an entrance, never a gate: skip is one keystroke, the sequence
// self-advances (scroll makes you walk faster, it never traps you), and it
// plays once per session.
//
// SOUND: designed, present, and OFF by default (grammar §5.11 — silence is the
// design; the mandate's facility is "almost silent"). The toggle synthesizes a
// deep facility hum with WebAudio on the user's explicit click — no audio
// files, no autoplay, nothing essential lives in sound.

const DUR = 10; // master timeline seconds (auto-advance; input accelerates)

export function Threshold({ onDone }: { onDone: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const skipRef = useRef<HTMLButtonElement>(null);
  const doneRef = useRef(false);
  const [soundOn, setSoundOn] = useState(false);
  const audioRef = useRef<{ ctx: AudioContext; gain: GainNode } | null>(null);

  useEffect(() => {
    const root = rootRef.current!;
    const canvas = canvasRef.current!;
    const mobile = window.innerWidth < 768 || "ontouchstart" in window;
    let scene: ThresholdScene | null = null;
    try {
      scene = createThresholdScene(canvas, mobile);
    } catch {
      finish(true); // any GL failure: straight to the landing, silently
      return;
    }

    // The page beneath must not scroll while the visitor walks.
    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    // This overlay (z-100) now owns the darkness the entry script painted (z-99).
    document.documentElement.removeAttribute("data-cxenter");

    // ── Master timeline: DOM beats keyed to normalized time ──────────────────
    const q = (sel: string) => root.querySelector<HTMLElement>(sel);
    const tl = gsap.timeline({ paused: true, defaults: { ease: "power3.out" } });
    tl.to(q(".cxt-vignette"), { opacity: 0.55, duration: 1.4 }, 0.1)
      .to(q(".cxt-skip"), { opacity: 1, duration: 0.6 }, 0.6)
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
    // The sequence completes on its own (~10s). Wheel / touch / arrow keys add
    // stride — "every scroll is another step" — and can only move forward.
    let target = 0;
    let actual = 0;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      target += Math.min(Math.abs(e.deltaY), 120) * 0.0022;
    };
    let touchY = 0;
    const onTouchStart = (e: TouchEvent) => { touchY = e.touches[0].clientY; };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const dy = touchY - e.touches[0].clientY;
      touchY = e.touches[0].clientY;
      if (dy > 0) target += dy * 0.004;
    };

    // The room answers the hand: pointer parallax, and device tilt where it is
    // available without a permission wall (never prompt inside the Threshold).
    const onPointer = (e: PointerEvent) => {
      scene?.setParallax((e.clientX / window.innerWidth - 0.5) * 2, (e.clientY / window.innerHeight - 0.5) * 2);
    };
    const iosPermissionWall =
      typeof (DeviceOrientationEvent as unknown as { requestPermission?: unknown }).requestPermission === "function";
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      scene?.setParallax(Math.max(-1, Math.min(1, e.gamma / 28)), Math.max(-1, Math.min(1, (e.beta - 40) / 32)));
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish(false);
      if (e.key === "ArrowDown" || e.key === " ") { e.preventDefault(); target += 0.06; }
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("keydown", onKey);
    if (!iosPermissionWall) window.addEventListener("deviceorientation", onTilt);

    const onResize = () => scene?.resize();
    window.addEventListener("resize", onResize);

    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!document.hidden) {
        target = Math.min(1, target + dt / (mobile ? 8 : DUR)); // the walk never stalls
        actual += (target - actual) * Math.min(1, dt * 4.5);    // heavy, smooth inertia
        tl.progress(actual);
        scene?.setProgress(actual);
        scene?.tick(dt);
        if (audioRef.current) {
          // sound follows the walk: the hum swells toward the opening
          audioRef.current.gain.gain.setTargetAtTime(0.02 + actual * 0.03, audioRef.current.ctx.currentTime, 0.2);
        }
        if (actual > 0.999) finish(false);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    skipRef.current?.focus({ preventScroll: true });

    function finish(immediate: boolean) {
      if (doneRef.current) return;
      doneRef.current = true;
      try { sessionStorage.setItem("cx-threshold", "1"); } catch { /* private mode */ }
      const cleanup = () => {
        cancelAnimationFrame(raf);
        window.removeEventListener("wheel", onWheel);
        window.removeEventListener("touchstart", onTouchStart);
        window.removeEventListener("touchmove", onTouchMove);
        window.removeEventListener("pointermove", onPointer);
        window.removeEventListener("keydown", onKey);
        window.removeEventListener("deviceorientation", onTilt);
        window.removeEventListener("resize", onResize);
        document.documentElement.style.overflow = prevOverflow;
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
      };
      if (immediate) cleanup();
      else gsap.to(root, { opacity: 0, duration: 0.55, ease: "power2.inOut", onComplete: cleanup });
    }

    return () => { if (!doneRef.current) { doneRef.current = true; cancelAnimationFrame(raf); tl.kill(); scene?.dispose(); document.documentElement.style.overflow = prevOverflow; } };
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
          className="cxt-skip rounded-lg border border-ink-600/80 bg-ink-900/60 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-slate-300 opacity-0 backdrop-blur transition hover:border-brand-500/50 hover:text-white">
          Skip intro
        </button>
      </div>
    </div>
  );
}
