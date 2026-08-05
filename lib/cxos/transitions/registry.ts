// CXOS Phase 3 — the cinematic route-transition registry.
//
// Route transitions are REGISTERED, never scattered: a navigation gets a
// transition only when an entry here matches its origin and destination, and
// only after the critical-route denylist has said no first. Business routes
// never import this file — the TransitionShell consults it from the root
// layout, and everything else on the site remains a plain link.
//
// THE LAW THAT CANNOT BE REGISTERED AWAY: CRITICAL_NEVER is consulted before
// the registry. Authentication, billing, checkout, legal, support, security
// and product surfaces are immediate, always — an entry matching them is dead
// code by construction.
export type TransitionKind = "resolve";

export interface CxTransitionDef {
  id: string;
  /** Destination pathname this transition stages. */
  to: RegExp;
  /** Origin pathnames it may play from (marketing surfaces only). */
  from: RegExp;
  kind: TransitionKind;
  label: string;
  /** Cover-in / open-out in ms per tier (A full, B mobile, C crossfade). */
  coverMs: { A: number; B: number; C: number };
  openMs: { A: number; B: number; C: number };
}

// Immediate-by-law destinations. Matched against the destination pathname
// BEFORE any registry lookup. Product, money, identity, legal, admin, review
// and API surfaces stay untouched by cinematic navigation.
export const CRITICAL_NEVER =
  /^\/(login|register|forgot-password|reset-password|billing|dashboard|api|legal|support|settings|admin|onboarding|upload|letters|mail|identity|review|checkout)(\/|$)/;

// Level 3 duration law (0.4–1.5s total): every entry's A cover+open must land
// inside it. cxos-journey.test.ts pins this numerically.
export const TRANSITIONS: CxTransitionDef[] = [
  {
    id: "pricing-resolve",
    to: /^\/pricing\/?$/,
    from: /^\/$/,
    kind: "resolve",
    label: "The commercial surface",
    coverMs: { A: 420, B: 340, C: 140 },
    openMs: { A: 520, B: 420, C: 140 },
  },
];

/** Absolute ceiling from click to guaranteed arrival — the fail-open clock. */
export const TRANSITION_TIMEOUT_MS = 1800;

export function findTransition(fromPath: string, toPath: string): CxTransitionDef | null {
  if (CRITICAL_NEVER.test(toPath)) return null;
  for (const t of TRANSITIONS) {
    if (t.to.test(toPath) && t.from.test(fromPath)) return t;
  }
  return null;
}
