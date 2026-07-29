// CXOS — Founder Review Mode gating.
//
// Review mode (the Director HUD, /review routes, session-memory bypass) is a
// FOUNDER instrument, not a public feature. The policy, in order:
//
//   1. HARD OFF on production. If this build is a Vercel PRODUCTION build
//      (NEXT_PUBLIC_VERCEL_ENV === "production"), review mode is off no matter
//      what else is set — including the manual override. Production visitors
//      can append ?director all day; nothing happens.
//   2. ON for Vercel PREVIEW builds automatically. Previews are protected by
//      Vercel Authentication (owner-verified configuration), so every pushed
//      feature branch is a reviewable build with zero setup.
//   3. ON in local development.
//   4. ON in a local production build only with NEXT_PUBLIC_CXOS_REVIEW=1
//      (how CI and the capture tooling exercise it).
//
// NEXT_PUBLIC_* values are inlined at build time, so this is a build property,
// not a runtime toggle — a production bundle simply does not satisfy it.
export function reviewBuildAllowed(): boolean {
  if (process.env.NEXT_PUBLIC_VERCEL_ENV === "production") return false;
  if (process.env.NODE_ENV === "development") return true;
  if (process.env.NEXT_PUBLIC_VERCEL_ENV === "preview") return true;
  return process.env.NEXT_PUBLIC_CXOS_REVIEW === "1";
}

/** The activation params. Any of ?director · ?cxos · ?review. */
export function hasReviewParam(search: string): boolean {
  return /[?&](director|cxos|review)(=|&|$)/.test(search);
}

/** Client-side: is the Director experience active for THIS page view? */
export function isDirectorActive(): boolean {
  if (typeof window === "undefined") return false;
  return reviewBuildAllowed() && hasReviewParam(window.location.search);
}
