// CXOS — Founder Review Mode gating.
//
// Review mode (the Director HUD, /review routes, session-memory bypass) is a
// FOUNDER instrument, not a public feature. The policy, in order:
//
//   1. HARD OFF on hosted production and on unknown/malformed hosted identity.
//      VERCEL_ENV is the server-authoritative identity. A public variable or
//      manual override can never defeat it.
//   2. ON for Vercel PREVIEW builds only when the server-authoritative identity
//      is exactly "preview". Preview protection remains an independent gate.
//   3. ON in local development.
//   4. ON in a non-hosted local production build only with
//      NEXT_PUBLIC_CXOS_REVIEW=1 (how CI and capture tooling exercise it).
//
// Server authorization and client presentation are deliberately separate. A
// client-side signal may shape an already-authorized review page; it never
// authorizes a server route or stage import.
export interface ReviewBuildEnvironment {
  NODE_ENV?: string;
  VERCEL?: string;
  VERCEL_ENV?: string;
  NEXT_PUBLIC_VERCEL_ENV?: string;
  NEXT_PUBLIC_CXOS_REVIEW?: string;
}

export interface ReviewBuildDecision {
  allowed: boolean;
  identity:
    | "HOSTED_PREVIEW"
    | "HOSTED_PRODUCTION"
    | "HOSTED_DEVELOPMENT"
    | "HOSTED_UNKNOWN"
    | "LOCAL_DEVELOPMENT"
    | "LOCAL_PRODUCTION_REVIEW"
    | "LOCAL_CLOSED";
  reason: string;
}

/**
 * Pure review-gate policy used by the runtime and the adversarial matrix.
 * `VERCEL_ENV` is the only hosted environment authority. Public variables and
 * the local capture override may make a result stricter, but can never grant a
 * hosted result.
 */
export function resolveReviewBuildDecision(
  environment: ReviewBuildEnvironment,
): ReviewBuildDecision {
  const hostedIdentity = environment.VERCEL_ENV;
  const publicIdentity = environment.NEXT_PUBLIC_VERCEL_ENV;
  const vercelMarkerPresent = environment.VERCEL !== undefined;

  // Vercel defines this marker as the exact string "1". Treat every other
  // present value as evidence of an unknown/malformed hosted identity; it must
  // never fall through to the local-production capture exception.
  if (vercelMarkerPresent && environment.VERCEL !== "1") {
    return {
      allowed: false,
      identity: "HOSTED_UNKNOWN",
      reason: "The Vercel hosting marker is malformed or unknown.",
    };
  }

  if (hostedIdentity !== undefined) {
    if (hostedIdentity === "production") {
      return {
        allowed: false,
        identity: "HOSTED_PRODUCTION",
        reason: "Canonical hosted identity is production.",
      };
    }
    if (hostedIdentity === "development") {
      return {
        allowed: false,
        identity: "HOSTED_DEVELOPMENT",
        reason: "Hosted development identity is not an authorized protected Preview.",
      };
    }
    if (hostedIdentity !== "preview") {
      return {
        allowed: false,
        identity: "HOSTED_UNKNOWN",
        reason: "Canonical hosted identity is missing, malformed, or unknown.",
      };
    }

    const publicIdentityConsistent =
      publicIdentity === undefined || publicIdentity === "preview";
    const nodeIdentityConsistent = environment.NODE_ENV === "production";
    return {
      allowed: publicIdentityConsistent && nodeIdentityConsistent,
      identity: "HOSTED_PREVIEW",
      reason: !publicIdentityConsistent
        ? "A contradictory public identity tightened the Preview gate."
        : nodeIdentityConsistent
          ? "Canonical hosted identity is preview."
          : "Hosted Preview requires the exact production Node runtime identity.",
    };
  }

  // A Vercel-hosted build with a missing identity is unknown and fails closed.
  if (vercelMarkerPresent) {
    return {
      allowed: false,
      identity: "HOSTED_UNKNOWN",
      reason: "Vercel hosting was detected without canonical hosted identity.",
    };
  }

  // A public identity cannot stand in for the missing canonical server value.
  if (publicIdentity !== undefined) {
    return {
      allowed: false,
      identity: "LOCAL_CLOSED",
      reason: "A public environment value cannot authorize review mode.",
    };
  }

  if (environment.NODE_ENV === "development") {
    return {
      allowed: true,
      identity: "LOCAL_DEVELOPMENT",
      reason: "Non-hosted local development is authorized for review tooling.",
    };
  }

  // The override is intentionally limited to a non-hosted local production
  // build used by deterministic capture and build verification.
  const localProductionReview =
    environment.NODE_ENV === "production"
    && environment.NEXT_PUBLIC_CXOS_REVIEW === "1";
  return {
    allowed: localProductionReview,
    identity: localProductionReview
      ? "LOCAL_PRODUCTION_REVIEW"
      : "LOCAL_CLOSED",
    reason: localProductionReview
      ? "Explicit non-hosted local production review build."
      : "No authorized review identity is present.",
  };
}

export function reviewServerBuildAllowed(): boolean {
  return resolveReviewBuildDecision(process.env).allowed;
}

function reviewClientPresentationAllowed(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.cxosReviewAllowed === "true";
}

export function reviewBuildAllowed(): boolean {
  return typeof window === "undefined"
    ? reviewServerBuildAllowed()
    : reviewClientPresentationAllowed();
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
