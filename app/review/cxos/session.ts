// CXOS Phase 1A-CX2 (C) — the Founder Walkthrough's OWN per-session guards.
//
// The Founder's addendum: "the full arrival does NOT replay on ordinary
// room-to-room navigation — reuse the existing per-session guards
// (threshold-seen key; MissionEntry's own once-per-session behavior —
// inspect and REUSE their contracts)."
//
// This file reuses the CONTRACT (a sessionStorage flag decides first vs.
// returning, and an explicit action clears it) rather than the literal
// PRODUCTION keys ("cx-threshold", "cx-mc", "cx-arena"). That is deliberate,
// not a shortcut:
//   - Threshold/MissionEntry/ArenaEntry are all rendered here with an
//     explicit review flag forced true (never isDirectorActive()'s
//     query-param sniff — this route's OWN query string uses ?step=/
//     ?persona=, neither of which is "director"/"cxos"/"review", so relying
//     on isDirectorActive() would silently fall through to "real visitor"
//     and start writing production session state). Once forced into review
//     mode, those components CONTRACTUALLY never read or write the
//     production keys themselves (see each file's own "review runs never
//     consume the visitor's first impression" comment) — so there is no
//     production key for this file to safely "reuse" without reaching into
//     their prohibited internals.
//   - Writing to the real "cx-threshold"/"cx-mc" keys from here would also
//     be the wrong OUTCOME, not just an internals violation: a Founder who
//     walks this route and then opens the real product in the same tab
//     would find the real entrance permanently marked "seen" by a review
//     run, which is exactly the pollution every existing review stage is
//     built to avoid.
// The walkthrough's own namespaced keys below reproduce the SAME shape
// (seen ⇒ shorter/settled variant; an explicit restart clears it) scoped to
// this one route, so "restart" has a precise, honest meaning: it clears
// exactly these two keys, nothing production-owned.
const SEEN_KEY: Record<WalkthroughBeat, string> = {
  threshold: "cx-walkthrough-threshold-seen",
  "mission-boot": "cx-walkthrough-mission-boot-seen",
};

export type WalkthroughBeat = "threshold" | "mission-boot";

export function hasSeenBeat(beat: WalkthroughBeat): boolean {
  try {
    return sessionStorage.getItem(SEEN_KEY[beat]) === "1";
  } catch {
    return false; // storage unavailable (private mode): always show the full ceremony
  }
}

export function markSeenBeat(beat: WalkthroughBeat): void {
  try {
    sessionStorage.setItem(SEEN_KEY[beat], "1");
  } catch {
    /* private mode — the walkthrough still functions, ceremonies just replay every time */
  }
}

/** Clears one beat's own flag — used by "Replay this transition." */
export function clearBeat(beat: WalkthroughBeat): void {
  try {
    sessionStorage.removeItem(SEEN_KEY[beat]);
  } catch {
    /* nothing was persisted if storage never worked */
  }
}

/** Clears every walkthrough-scoped flag — used by "Restart walkthrough." This is the ONLY thing "restart" means: it never touches the production cx-threshold/cx-mc/cx-arena keys. */
export function clearWalkthroughSession(): void {
  clearBeat("threshold");
  clearBeat("mission-boot");
}
