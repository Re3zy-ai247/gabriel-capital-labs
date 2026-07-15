// CreditVector motion primitives (Sprint XXIII) — the reusable animation layer for
// the marketing/landing surface and the foundation for the future cinematic homepage
// (see .ai/ANIMATION-ARCHITECTURE.md). React primitives live here; the CSS keyframe
// utilities they build on live in app/globals.css. EVERY primitive respects
// prefers-reduced-motion.
//
// Catalog:
//   Reveal      — scroll-triggered section entrance (fade + rise on intersect)      [component]
//   Stagger     — cascade children in with incrementing delay                        [component]
//   Parallax    — subtle scroll-linked transform, on-screen + rAF gated              [component]
//   .animate-rise / .animate-fadein — one-shot fade/rise on mount                    [CSS util]
//   .animate-rise-stagger           — manual-delay staggered entrance                [CSS util]
//   a.card:hover / .card-interactive — hover lift + border highlight (elevation)     [CSS util]
//   .shine                          — sheen sweep across a CTA on hover              [CSS util]
//   .aurora / .animate-float / .animate-draw — ambient hero motion                   [CSS util]
export { Reveal } from "../Reveal";
export { Stagger } from "./Stagger";
export { Parallax } from "./Parallax";
