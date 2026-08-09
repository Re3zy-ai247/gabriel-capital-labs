// R3 — the single channel-policy helper for the desktop-reduced-motion
// cinematic path (see DESKTOP_REDUCED_QUERY in lib/gsap.ts).
//
// The architectural ruling: under reduce, every section runs the SAME scene
// structure as the full-motion path (same chapters, same pins, same
// sequencing) but expressed only through vestibular-safe channels — opacity,
// colour/luminance, rule-opacity, and scroll-position hold (pinning). Spatial
// channels (translate, scale, rotate, skew, clip-path wipes) are forbidden
// under reduce because they read as movement.
//
// Rather than forking every section into two divergent scene bodies, each
// section builds ONE scene and passes its tween vars through `reveal` (or
// `revealFromTo` for fromTo call sites). That keeps the stripping policy in
// exactly one place instead of sprinkled per-file.
import type { gsap } from "@/lib/gsap";

// R3 — pinned scenes hold shorter under reduce (0.6x the full-motion pin
// budget). A hold that lasts as long as a scale/parallax pull-back but has no
// spatial motion to justify the length just feels stuck.
export const REDUCED_PIN_SCALE = 0.6;

// R3 — every pinned scene computes its ScrollTrigger `end` through this so the
// 0.6x scale lives in one place. percent is the full-motion value (e.g. 100
// for Arrival's `+=100%`); pass the boolean reduced-policy flag for the
// section's current matchMedia branch.
export function pinEnd(reduced: boolean, percent: number): string {
  return `+=${reduced ? Math.round(percent * REDUCED_PIN_SCALE) : percent}%`;
}

// R3 — tween var keys that read as spatial movement. Anything in this list is
// stripped from the vars object when the reduced channel policy is active.
// Keys NOT in this list (opacity, autoAlpha, duration, ease, stagger, delay,
// position args, callbacks, ...) pass through untouched in both policies.
const MOTION_KEYS = [
  "x",
  "y",
  "xPercent",
  "yPercent",
  "scale",
  "scaleX",
  "scaleY",
  "rotation",
  "rotate",
  "rotationX",
  "rotationY",
  "skewX",
  "skewY",
  "clipPath",
  "transform",
] as const;

// R3 — the channel-policy gate. Full-motion path: vars pass through
// unchanged. Reduced path: every spatial key is deleted, leaving an
// opacity/colour-only tween. Callers still supply the full-motion vars object
// at every call site; this is the ONE place that turns it into the reduced
// twin, so the two policies can never drift apart in scene structure.
export function reveal(reduced: boolean, vars: gsap.TweenVars): gsap.TweenVars {
  if (!reduced) return vars;

  const stripped: gsap.TweenVars = { ...vars };
  for (const key of MOTION_KEYS) {
    delete stripped[key];
  }
  return stripped;
}

// R3 — convenience for fromTo call sites (Ecosystem wings, Engagement,
// Lab grid): runs both the from-vars and to-vars through the same policy.
export function revealFromTo(
  reduced: boolean,
  fromVars: gsap.TweenVars,
  toVars: gsap.TweenVars,
): [gsap.TweenVars, gsap.TweenVars] {
  return [reveal(reduced, fromVars), reveal(reduced, toVars)];
}
