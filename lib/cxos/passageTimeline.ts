// CXOS Phase 5.1 — THE PASSAGE · the one timeline (client-safe constants).
//
// Every number the journey obeys lives here so the state machine, the CSS
// (which mirrors these as literals), the director tray and the guard all
// read the SAME truth. The safety ordering law, pinned numerically by
// scripts/cxos-passage.test.ts:
//
//   journey end  <  JS watchdog  <  pure-CSS safety fade
//      11.8 s          14 s              18 s
//
// Phase 5.2 redistributed the beats WITHIN the same 11.8 s envelope rather
// than lengthening it: the departure is quieter, the threshold holds longer,
// and the room's recognition of the operator moved onto the settled floor.
//
// The forced part of the first journey ends ≤ 12 s — the house first-entry
// ceiling ratified in Phase 4/5 (cxos-arena.test.ts pins 7–12 s) is not
// silently outgrown; the ceremony's tail (Kai's line, the scroll hint)
// lands ON the settled floor where nothing is forced.

export type PassagePhase =
  | "origin" // settled Mission Control
  | "call" // B1  the room acknowledges; the set covers the document
  | "clearance" // B2  in-world clearance stencils pass the camera
  | "passage" // B3  full advance — rails converge on the aperture
  | "conversion" // B4  rectilinear→radial, blue→gold
  | "threshold" // B5  the chamber, silence and scale (no text but the SYNTHETIC tab)
  | "greeting" // B5b recognition — the one place standing is spoken
  | "floor" // settled Arena
  | "returning"; // the return journey (gold contracts, cools to blue)

// First journey (tier A). Camera motion begins at CALL's end (~0.8 s) and
// does not stop until THRESHOLD — the beats after B1 are windows on one
// continuous dolly, not stationary caption cards.
export const BEATS_FIRST: { phase: PassagePhase; at: number }[] = [
  { phase: "call", at: 0 },
  { phase: "clearance", at: 1000 },
  { phase: "passage", at: 3400 },
  { phase: "conversion", at: 5800 },
  { phase: "threshold", at: 8000 },
  { phase: "greeting", at: 10400 },
];
export const JOURNEY_END_MS = 11800;

// Tier B (mobile): a single-plane journey, PACED SLOWER than it was — the
// Founder's review found the condensed run too fast to comprehend. It is
// now 10.6 s (was 8.2 s), still under the desktop run and the 12 s ceiling,
// with the readable beats given the most room.
export const BEATS_MOBILE: { phase: PassagePhase; at: number }[] = [
  { phase: "call", at: 0 },
  { phase: "clearance", at: 900 },
  { phase: "passage", at: 3000 },
  { phase: "conversion", at: 5200 },
  { phase: "threshold", at: 7300 },
  { phase: "greeting", at: 9000 },
];
export const JOURNEY_END_MOBILE_MS = 10600;

// Returning (director instrument) — inside the house ≤1.5 s returning law.
export const RETURNING_END_MS = 1400;

// The return journey (floor → Mission Control).
export const RETURN_END_MS = 1800;

// The JS watchdog: if no settle handler ran by here, force the truthful
// forward settle. Strictly after every journey end, strictly before CSS.
export const WATCHDOG_MS = 14000;

// The pure-CSS safety fade delay carried by .cx-p-veil (mirrored as a CSS
// literal in app/globals.css — the guard cross-checks both sides). If every
// script after mount died, the veil removes itself here; no scroll ever
// happened, so the document beneath (the origin) IS the truthful state.
export const CSS_SAFETY_DELAY_S = 18;

// CANCEL vs SKIP — the two-phase escape law. Before the camera has left the
// room (call/clearance), Escape/click/wheel CANCELS back to the origin:
// the visitor who misclicked is never force-shipped to the Arena. From
// PASSAGE onward the truthful nearest destination is the floor.
export const CANCEL_PHASES: readonly PassagePhase[] = ["call", "clearance"];
export const CINEMATIC_PHASES: readonly PassagePhase[] = [
  "call",
  "clearance",
  "passage",
  "conversion",
  "threshold",
  "greeting",
  "returning",
];
