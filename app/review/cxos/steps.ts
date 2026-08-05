// CXOS Phase 1A-CX2 (C) — the Founder Walkthrough's step model.
//
// Pure data — no JSX, no browser API — safe to import from either the
// server gate (page.tsx) or the client orchestrator (stage.tsx).
//
// Two persona sequences, per the Founder's addendum:
//   RETURNING OPERATOR: arrival → identity recognition → Kai acknowledgement
//     → Mission Boot → Mission Control → continuous room travel.
//   NEW VISITOR: landing chapters → authentication → Arrival Runtime →
//     Mission Boot → Mission Control [→ continuous room travel].
// "Arrival Runtime" for the new visitor is the SAME Threshold + Mission Boot
// corridor the returning operator gets — the addendum's own wording ("→
// Arrival Runtime → Mission Boot →") places it AFTER sign-in, not a
// different experience. So NEW_VISITOR_STEPS is exactly two steps
// (landing, simulated-signin) prepended to RETURNING_OPERATOR_STEPS, not a
// parallel, duplicated spine.
//
// "The Passage · Arena · Agency Headquarters" continue past Mission Control
// for both personas — the Founder's ORDER list composes all approved
// cinematic surfaces into ONE tour; the two flows only differ in how they
// ARRIVE at Mission Control, not in what is toured afterward.
export type WalkthroughPersona = "returning" | "new";

export type WalkthroughStepKey =
  | "landing"
  | "simulated-signin"
  | "arrival"
  | "mission-boot"
  | "mission-control"
  | "the-passage"
  | "arena"
  | "agency-hq";

export interface WalkthroughStepMeta {
  key: WalkthroughStepKey;
  title: string;
  synopsis: string;
}

export const STEP_META: Record<WalkthroughStepKey, WalkthroughStepMeta> = {
  landing: {
    key: "landing",
    title: "The Landing Journey",
    synopsis:
      "Chapters 1–2 of the marketing story a new visitor sees before ever signing in.",
  },
  "simulated-signin": {
    key: "simulated-signin",
    title: "Simulated Sign-in",
    synopsis:
      "A labeled, theatrical placeholder beat — no credentials, no session, no form.",
  },
  arrival: {
    key: "arrival",
    title: "Arrival — The Threshold",
    synopsis:
      "Darkness → light → architecture → the name → CreditVector → the opening.",
  },
  "mission-boot": {
    key: "mission-boot",
    title: "Mission Boot",
    synopsis:
      'Identity recognition and Kai’s acknowledgement: IDENTITY → CLEARANCE → SYSTEMS → Kai brief → "Command is yours."',
  },
  "mission-control": {
    key: "mission-control",
    title: "Mission Control",
    synopsis: "The settled operating room, explorable in every fixture state.",
  },
  "the-passage": {
    key: "the-passage",
    title: "The Passage",
    synopsis:
      "Mission Control origin → the call → clearance → the passage → conversion → threshold → greeting → the floor.",
  },
  arena: {
    key: "arena",
    title: "Arena",
    synopsis: "Clearance → evidence vault → ascent → the chamber.",
  },
  "agency-hq": {
    key: "agency-hq",
    title: "Agency Headquarters",
    synopsis:
      "The seven-district facility transfer — the crown jewel of the review surface.",
  },
};

export const RETURNING_OPERATOR_STEPS: readonly WalkthroughStepKey[] = [
  "arrival",
  "mission-boot",
  "mission-control",
  "the-passage",
  "arena",
  "agency-hq",
];

// Prepends the new-visitor-only opening (landing chapters, then the
// simulated sign-in beat) onto the SAME shared spine above — see this
// file's header comment for why this is prepended, not parallel.
export const NEW_VISITOR_STEPS: readonly WalkthroughStepKey[] = [
  "landing",
  "simulated-signin",
  ...RETURNING_OPERATOR_STEPS,
];

export function stepsForPersona(
  persona: WalkthroughPersona
): readonly WalkthroughStepKey[] {
  return persona === "new" ? NEW_VISITOR_STEPS : RETURNING_OPERATOR_STEPS;
}

export function parsePersona(value: string | null): WalkthroughPersona {
  return value === "new" ? "new" : "returning";
}

/**
 * Clamp an arbitrary (possibly absent/invalid/out-of-range) 1-indexed
 * `?step=` value to a valid position in the given persona's sequence. Never
 * throws, never returns an out-of-bounds index — this is what makes a
 * refresh or a hand-typed deep link recover deterministically instead of
 * rendering nothing.
 */
export function resolveStepIndex(
  persona: WalkthroughPersona,
  rawStep: string | null
): number {
  const sequence = stepsForPersona(persona);
  const parsed = rawStep ? Number.parseInt(rawStep, 10) : NaN;
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.min(parsed, sequence.length);
}

/** Builds the `?persona=&step=` query string this route's links/pushes use. */
export function walkthroughHref(
  persona: WalkthroughPersona,
  step: number | null
): string {
  if (step === null) return "/review/cxos";
  const params = new URLSearchParams({ persona, step: String(step) });
  return `/review/cxos?${params.toString()}`;
}
