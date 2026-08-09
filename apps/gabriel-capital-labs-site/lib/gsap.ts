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

// R3 — the third motion class. Desktop-width visitors with the OS reduce-motion
// flag on used to fall through to REDUCED_MOTION_QUERY and get the flat, unpinned
// static layout (0 ScrollTrigger pins). That is a defect, not an accessibility
// choice: the same chapter architecture is reachable through vestibular-safe
// channels only (opacity, colour/luminance, scroll-position hold) per WCAG C39.
// Every desktop section now registers this query ALONGSIDE DESKTOP_MOTION_QUERY
// and runs one shared scene builder with a { reduced } channel policy — see
// lib/motion.ts. Must be checked BEFORE REDUCED_MOTION_QUERY in every section's
// matchMedia callback, since that query also matches desktop widths.
export const DESKTOP_REDUCED_QUERY = "(min-width: 1024px) and (prefers-reduced-motion: reduce)";

let refreshScheduled = false;

// Must match Nav.tsx's own NAV_OFFSET (its scroll-margin-top equivalent for
// a JS-computed scroll target) — duplicated rather than imported so this
// module has no dependency on a component file, same convention as the
// literal design-token twins elsewhere in this codebase (e.g. Ecosystem's/
// Lab's WING_RULE_LIT copy of --gcl-gateway-gold).
const NAV_OFFSET = 84;

// R3.2 — deep-link landing fix. A fresh load with a URL hash relies on the
// BROWSER's native fragment scroll, which fires against the pre-hydration,
// pre-pin document — every pinned section's spacer (pinSpacing:true)
// doesn't exist yet, so the document is shorter than its final height. By
// the time ScrollTrigger.refresh() above has built every pin's spacer and
// settled final layout, the native scroll position is stale — short of the
// target by however much pin spacing was inserted above it on the page
// (540–2200px, worse the further down the target sits). Once refresh() has
// established the FINAL layout, re-derive the hash target's live position
// (same getBoundingClientRect + NAV_OFFSET math Nav.tsx uses for an in-page
// click) and snap to it instantly — `behavior:'auto'`, no animated scroll,
// since this is a correction of an already-completed browser action, not a
// user-facing scroll gesture. One place, every section: this runs from the
// same central post-refresh callback every page load already reaches,
// regardless of which section (if any) the hash names.
function landOnHash() {
  const hash = window.location.hash;
  if (!hash) return;
  let target: Element | null = null;
  try {
    target = document.querySelector(hash);
  } catch {
    return; // an unparsable fragment (e.g. not a valid CSS selector) — no-op
  }
  if (!target) return;
  const top = target.getBoundingClientRect().top + window.scrollY - NAV_OFFSET;
  window.scrollTo({ top, behavior: "auto" });
}

// R2 2.x — ScrollTrigger measures trigger/pin distances from live layout;
// fonts swapping in or the hero image decoding after first layout can shift
// things enough to make pinned ranges start a little off. Call this once,
// from any single mounted component, after both are settled.
export function scheduleScrollTriggerRefresh() {
  if (refreshScheduled || typeof window === "undefined") return;
  refreshScheduled = true;

  const run = () => {
    ScrollTrigger.refresh();
    // R3.2 — must run AFTER refresh() above has finished inserting every
    // pin's spacer, so the target's measured position is the page's real,
    // final layout — not the pre-pin one the browser's native hash-scroll
    // landed against.
    landOnHash();
  };
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

// R3.2 — root cause of the deep-link ScrollTrigger crash (repro: load
// /#contact under desktop-reduce; LabSection's own scene construction threw
// "Cannot read properties of undefined (reading 'end')" out of
// ScrollTrigger.refresh, previously only papered over by a try/catch).
//
// GSAP defers a NEW ScrollTrigger's own first refresh by one tick (an
// internal `gsap.delayedCall(0.01, …)`) ONLY when it's hosted by an
// animation with an `.add` method — i.e. a Timeline. A ScrollTrigger handed
// to a plain `gsap.fromTo/to(...,{scrollTrigger})` is hosted by a Tween
// (no `.add`), so GSAP refreshes it SYNCHRONOUSLY, inline, the instant it's
// created. Every section on this page builds most of its scenes as
// `gsap.timeline({ scrollTrigger })` (the deferred path) but a few one-off
// reveals (an intro line, a chapter-mark hairline, a background parallax)
// were plain fromTo/to calls with the config inlined — the immediate path.
//
// During initial mount, six sections create ScrollTriggers synchronously,
// back to back, in one JS turn. Every timeline-hosted one queues its first
// refresh for the next tick and sits with `.end` still unresolved in
// GSAP's internal `_triggers` array in the meantime. The moment a
// plain-tween trigger (immediate path) is constructed, its own refresh()
// walks BACKWARD through every earlier `_triggers` entry and force-
// refreshes any with `.end` still unresolved — including pinned ones from
// earlier sections. That walk-back's own bookkeeping only tolerates the
// array shrinking by one entry per step; landing on a hash far enough down
// that the page opens already scrolled past several pins (#contact, the
// last section) is exactly the condition under which a forced pin refresh
// can revert more than one entry in a single step, desyncing the walk and
// reading one array slot past its new end.
//
// The fix isn't a later, better-timed refresh (that's the symptom-patch
// this replaces — see EcosystemSection's git history) — it's never letting
// a plain-tween ScrollTrigger exist at all. `scrollTimeline` hosts a lone
// reveal in an (otherwise plain) Timeline instead, with the scrollTrigger
// config living on the TIMELINE (the actual ScrollTrigger host) rather than
// on a child tween — matching the row/wing pattern every section already
// uses for its multi-step reveals, and taking GSAP's own deferred-refresh
// path like everything else built during mount. No section needs its own
// `gsap.delayedCall`/refresh-scheduling workaround for this: every trigger
// this creates is off the synchronous mount stack by construction, and the
// existing scheduleScrollTriggerRefresh() below remains the one place a
// refresh is ever explicitly requested.
export function scrollTimeline(scrollTrigger: object): gsap.core.Timeline {
  return gsap.timeline({ scrollTrigger });
}

export { gsap, ScrollTrigger };
