// CXOS Phase 3 — the cinematic capability policy.
//
// One question, answered once per page view: how much motion has this visit
// EARNED? Four tiers, failing downward — a detection failure never upgrades:
//
//   A  full chapter choreography + depth planes; full route transitions
//   B  same choreography on a single plane (mobile); shortened transitions
//   C  no scroll-driven transforms (settles only); minimal 280ms crossfade
//   D  none — content at rest state, navigation instant
//
// Decision order is a safety order, not a preference order: the visitor's
// explicit signals (reduced motion, the footer toggle) outrank everything;
// the network's signal (saveData) and the device's (deviceMemory) outrank
// the viewport guess. Anything unreadable counts as the conservative answer.
export type CxTier = "A" | "B" | "C" | "D";

/** localStorage key for the user-facing cinematic toggle (footer control). */
export const CINEMATIC_PREF_KEY = "cx-cinematic";

export function cinematicDisabled(): boolean {
  try {
    return localStorage.getItem(CINEMATIC_PREF_KEY) === "off";
  } catch {
    return false;
  }
}

export function detectTier(): CxTier {
  if (typeof window === "undefined") return "C";
  try {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return "D";
    if (cinematicDisabled()) return "D";
    const nav = navigator as Navigator & {
      connection?: { saveData?: boolean };
      deviceMemory?: number;
    };
    if (nav.connection?.saveData) return "C";
    if (typeof nav.deviceMemory === "number" && nav.deviceMemory < 4) return "C";
    if (window.matchMedia("(max-width: 768px)").matches) return "B";
    return "A";
  } catch {
    return "C";
  }
}
