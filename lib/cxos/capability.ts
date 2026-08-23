// CXOS Phase 3 — the cinematic capability policy.
//
// Founder Decision (2026-08-04): CINEMATIC was the default posture for the
// tier ladder below.
//
// SUPERSEDED IN PART — RC1 Founder Decision D-6 (2026-08-23): TASK-FIRST is
// the default for EVERYONE. The consumer's job is to upload a report, review
// items and generate a letter; a full-screen ENTRANCE in front of that job is
// now strictly opt-in, chosen by the visitor through the footer/app control
// (CinematicToggle) — never assumed. D-6 changes WHO gets the entrance, not
// how the tier ladder answers "how much motion can this device afford":
//
//   · the ENTRANCE (the Threshold overlay + its pre-paint blackout) requires
//     `cinematicEntranceOptIn()` below — an explicit, persisted "on".
//   · everything already governed by `detectTier()` — the landing journey
//     choreography, the route-transition shell — keeps the exact ladder it
//     had, because none of it blocks the page or paints darkness over it.
//
// Four tiers, failing downward — a detection failure never upgrades:
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

/**
 * localStorage key for the user-facing cinematic control (footer + app header).
 *
 * Three states, and the ABSENT one is the RC1 default (D-6):
 *   "on"     the visitor asked for the cinematic entrance. Still subject to
 *            reduced motion, `detectTier()` and the entrance's own ≤3 s cap —
 *            an opt-in is a request, never an override of a protection.
 *   "off"    the visitor asked for no cinematic motion at all. Tier D
 *            everywhere, exactly as this key has always meant.
 *   absent   RC1 default: task-first. No entrance, no pre-paint blackout;
 *            the non-blocking tier ladder below still applies.
 */
export const CINEMATIC_PREF_KEY = "cx-cinematic";

/**
 * localStorage key for "this visitor has already walked through the entrance".
 * D-6 / C-13: durable, not per-tab — a browser restart or a mobile-Safari tab
 * eviction must not re-charge someone for a first impression they already had.
 * The legacy per-session key of the same name is still written alongside it so
 * the entrance also cannot replay twice inside one session.
 */
export const THRESHOLD_SEEN_KEY = "cx-threshold";

export function cinematicDisabled(): boolean {
  try {
    return localStorage.getItem(CINEMATIC_PREF_KEY) === "off";
  } catch {
    return false;
  }
}

/**
 * D-6: has this visitor explicitly opted IN to the cinematic entrance?
 * Fails CLOSED — unreadable storage, an unset key, or an explicit "off" all
 * mean "no entrance", so the task-first default is what a failure lands on.
 */
export function cinematicEntranceOptIn(): boolean {
  try {
    return localStorage.getItem(CINEMATIC_PREF_KEY) === "on";
  } catch {
    return false;
  }
}

/**
 * D-6: has the entrance already been walked? Durable first (localStorage),
 * with the legacy per-session marker still honored so an in-flight session
 * that only has the old key is not re-shown the entrance.
 */
export function thresholdAlreadySeen(): boolean {
  try {
    if (localStorage.getItem(THRESHOLD_SEEN_KEY) === "1") return true;
  } catch {
    return true; // storage unreadable — never risk replaying forever
  }
  return false;
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
