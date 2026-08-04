// CXOS isolated review registry.
//
// This RC advertises the review destinations actually reconstructed from
// Founder-approved evidence: RC2's own two (Agency Headquarters, Mission
// Control — listed first, untouched) plus four routes recovered from
// phase3's own registry (`git show a40a41c:lib/cxos/rooms.ts`) during the
// Phase 1A-CX reconciliation. Those four routes were already copied into
// this integration and render correctly — the RC2-wins-overlap decision on
// THIS file (RC2's rooms.ts, not phase3's) orphaned them from this hub only,
// making two of the build's most convincing artifacts invisible in the
// Founder's own review surface. Recovery-completion of what already shipped,
// not new room graph: it still does not inherit phase3's WIDER registry
// (hero, academy, kai, marketplace, operator-network, dashboard, enterprise)
// or expose dead links to rooms this candidate excludes.

export interface CxosRoom {
  key:
    | "agency-command"
    | "mission-control"
    | "threshold"
    | "landing-journey"
    | "arena"
    | "passage";
  name: string;
  href: string;
  // "PLANNED" is not used by any entry in the registry below, but the status
  // vocabulary is shared with the wider CXOS room graph — DirectorHUD.tsx
  // filters on it. Widening the type only (never the data here) keeps that
  // consumer honest without reintroducing the feature branch's excluded
  // rooms.
  status: "PROTOTYPE" | "PLANNED";
  phase: string;
  line: string;
}

export const CXOS_ROOMS: readonly CxosRoom[] = [
  {
    key: "agency-command",
    name: "Agency Headquarters",
    href: "/review/agency-command",
    status: "PROTOTYPE",
    phase: "Phase 6.2 + Core Runtime 1.0",
    line: "Seven-district Agency Headquarters with the isolated CXOS Core Runtime reference integration. Synthetic, non-persistent, and review-only.",
  },
  {
    key: "mission-control",
    name: "Mission Control",
    href: "/review/mission-control",
    status: "PROTOTYPE",
    phase: "Phase 4 return prerequisite",
    line: "The unchanged reviewed Mission Control destination required for Agency Headquarters return navigation. It is not migrated to Core Runtime in this candidate.",
  },
  // The four entries below are recovered VERBATIM from phase3's own registry
  // (name/href/status/phase/line unchanged from `a40a41c`) — ordered by
  // phase3's own phase sequence (2 → 3 → 5 → 5.1), not the order phase3's
  // array happened to list them in.
  {
    key: "threshold",
    name: "The Threshold",
    href: "/review/threshold",
    status: "PROTOTYPE",
    phase: "Phase 2",
    line: "Darkness → light → architecture → the name → CreditVector → the opening. The public entry.",
  },
  {
    key: "landing-journey",
    name: "The Landing Journey",
    href: "/review/landing",
    status: "PROTOTYPE",
    phase: "Phase 3",
    line: "Chapters 1–2 (Problem Chamber → Intelligence Awakens) + the pricing route transition. Scroll-directed, native scroll authoritative.",
  },
  {
    key: "arena",
    name: "Arena",
    href: "/review/arena",
    status: "PROTOTYPE",
    phase: "Phase 5",
    line: "Clearance → evidence vault → ascent → the chamber. Own-record only (policy v1); live surface stays flag+cohort gated.",
  },
  {
    key: "passage",
    name: "The Passage",
    href: "/review/mission-control-to-arena",
    status: "PROTOTYPE",
    phase: "Phase 5.1",
    line: "Mission Control origin → the call → clearance → the passage → dimensional conversion → threshold → greeting → the floor → the return. Synthetic fixtures, end to end.",
  },
] as const;
