"use client";

// Central GSAP registration point. Import `gsap` and `ScrollTrigger` from
// here so the plugin is registered exactly once, client-side only.
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";

let registered = false;

export function ensureGsapRegistered() {
  if (registered || typeof window === "undefined") return;
  gsap.registerPlugin(ScrollTrigger);
  registered = true;
}

export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

// R2 — the single desktop-cinematic breakpoint. Everything gated behind this
// (plus no-preference) is NEW motion; anything gated behind MOBILE_MOTION_QUERY
// alone must stay byte-for-byte identical to the pre-R2 behavior.
export const DESKTOP_MOTION_QUERY = "(min-width: 1024px) and (prefers-reduced-motion: no-preference)";
export const MOBILE_MOTION_QUERY = "(max-width: 1023.98px) and (prefers-reduced-motion: no-preference)";

let refreshScheduled = false;

// R2 2.x — ScrollTrigger measures trigger/pin distances from live layout;
// fonts swapping in or the hero image decoding after first layout can shift
// things enough to make pinned ranges start a little off. Call this once,
// from any single mounted component, after both are settled.
export function scheduleScrollTriggerRefresh() {
  if (refreshScheduled || typeof window === "undefined") return;
  refreshScheduled = true;

  const run = () => ScrollTrigger.refresh();
  const fontsReady = (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts?.ready;
  const heroImg = document.querySelector<HTMLImageElement>(".arrival__mark");
  const imgDecoded = heroImg && !heroImg.complete
    ? new Promise<void>((resolve) => {
        heroImg.addEventListener("load", () => resolve(), { once: true });
        heroImg.addEventListener("error", () => resolve(), { once: true });
      })
    : Promise.resolve();

  Promise.all([fontsReady ?? Promise.resolve(), imgDecoded])
    .then(run)
    .catch(run);
}

export { gsap, ScrollTrigger };
