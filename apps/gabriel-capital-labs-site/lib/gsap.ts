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

export { gsap, ScrollTrigger };
