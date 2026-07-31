// CXOS — Founder Review Mode gating.
//
// Review mode (the Director HUD, /review routes, session-memory bypass) is a
// FOUNDER instrument, not a public feature. The policy, in order:
//
//   1. HARD OFF on production. On the server, Vercel's authoritative
//      VERCEL_TARGET_ENV / VERCEL_ENV values take precedence over every public
//      flag and manual override. An unknown Vercel context also fails closed.
//      Production visitors can append ?director all day; nothing happens.
//   2. ON for Vercel PREVIEW builds automatically. Previews are protected by
//      Vercel Authentication (owner-verified configuration), so every pushed
//      feature branch is a reviewable build with zero setup.
//   3. ON in local development.
//   4. ON in a local production build only with NEXT_PUBLIC_CXOS_REVIEW=1
//      (how CI and the capture tooling exercise it).
//
// NEXT_PUBLIC_* values are inlined at build time for client-only consumers.
// They are a secondary projection of the server policy, never its authority.
export function reviewBuildAllowed(): boolean {
  if (typeof window === "undefined") {
    const targetEnvironment = process.env.VERCEL_TARGET_ENV;
    const deploymentEnvironment = process.env.VERCEL_ENV;
    const isVercelDeployment =
      process.env.VERCEL === "1" ||
      targetEnvironment !== undefined ||
      deploymentEnvironment !== undefined;

    if (
      targetEnvironment === "production" ||
      deploymentEnvironment === "production"
    ) {
      return false;
    }

    if (isVercelDeployment) {
      return (
        targetEnvironment === "preview" ||
        (targetEnvironment === undefined && deploymentEnvironment === "preview")
      );
    }
  }

  const publicEnvironment =
    process.env.NEXT_PUBLIC_VERCEL_TARGET_ENV ??
    process.env.NEXT_PUBLIC_VERCEL_ENV;
  if (publicEnvironment === "production") return false;
  if (process.env.NODE_ENV === "development") return true;
  if (publicEnvironment === "preview") return true;
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
