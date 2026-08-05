// CXOS Phase 3 — the cinematic capability policy.
//
// Founder Decision (2026-08-04): CINEMATIC is the default posture. One
// question, answered once per page view: is there a PROVEN reason to show
// less? Absent one, the visit gets the fullest tier the device permits —
// motion is withheld for a reason, never withheld by default. Four tiers,
// failing downward — a detection failure never upgrades:
//
//   A  full chapter choreography + depth planes; full route transitions
//   B  same choreography on a single plane (mobile); shortened transitions
//   C  no scroll-driven transforms (settles only); minimal 280ms crossfade
//   D  none — content at rest state, navigation instant
//
// Precedence below is a safety order, not a preference order, and every
// line can only downgrade, never upgrade: (1) reduced motion is D, ALWAYS —
// no signal below it, including the cinematic default itself, ever
// overrides it; (2) the persisted footer toggle is the visitor's own
// explicit choice and is honored next, also to D; (3) Data Saver and (4) a
// hard device-memory floor are real constraints, not preference, so they
// still downgrade to C; (5) a narrow viewport downgrades to B — the fullest
// tier that layout permits, not a penalty. Nothing left standing -> A.
// Anything unreadable counts as the conservative answer.
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
    return "A"; // the default: nothing above earned a downgrade.
  } catch {
    return "C";
  }
}
