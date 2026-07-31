// CXOS — the room registry (Founder Review System).
//
// One list, consumed by the /review hub, the Director HUD's room selector, and
// every future phase's review page. A room is a destination with its own
// atmosphere and its own entry; PLANNED rooms appear here so the Founder always
// sees the whole map, not just what shipped.
//
// Client-safe: constants only, no server imports.

export type RoomStatus =
  | "PROTOTYPE" // CXOS entry experience implemented, under Founder review
  | "LIVE" // CXOS treatment shipped to the product surface
  | "PRODUCT" // the product surface exists; its CXOS entry is not built yet
  | "PLANNED"; // neither surface nor entry exists yet

export interface CxosRoom {
  key: string;
  name: string;
  /** Where the experience (or today's surface) is entered. */
  href: string;
  status: RoomStatus;
  phase: string;
  /** One line the Founder reads on the review card. */
  line: string;
  /** True when the room requires an authenticated session to be meaningful. */
  authed?: boolean;
}

export const CXOS_ROOMS: CxosRoom[] = [
  {
    key: "threshold",
    name: "The Threshold",
    href: "/review/threshold",
    status: "PROTOTYPE",
    phase: "Phase 2",
    line: "Darkness → light → architecture → the name → CreditVector → the opening. The public entry.",
  },
  {
    key: "hero",
    name: "Hero / Arrival",
    href: "/?director",
    status: "LIVE",
    phase: "Phase 1",
    line: "Scene 1 arrival on the landing — aurora breath, settle ladder, sheen. Pure CSS, zero JS.",
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
    key: "mission-control",
    name: "Mission Control",
    href: "/review/mission-control",
    status: "PROTOTYPE",
    phase: "Phase 4",
    line: "Identity → clearance → systems waking → evidence online → Kai's brief → command transferred. Entry + shell over the real room.",
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
  {
    key: "agency-command",
    name: "Agency Command",
    href: "/review/agency-command",
    status: "PROTOTYPE",
    phase: "Phase 6.2",
    line: "Seven-district agency headquarters → six-beat arrival → one deterministic natural-language Kai command surface. No live agency data, persistence, team system, billing, calendar, customer mutation, model call, or production action is connected.",
  },
  {
    key: "academy",
    name: "Academy",
    href: "/review#academy",
    status: "PLANNED",
    phase: "Unscheduled (needs product definition D-5)",
    line: "The warm room — knowledge as light. No route exists yet; nothing is faked as live.",
  },
  {
    key: "kai",
    name: "Kai",
    href: "/dashboard",
    status: "PRODUCT",
    phase: "Phase 4 (planned)",
    line: "Executive intelligence, present in every room; its own introduction rides Mission Control.",
    authed: true,
  },
  {
    key: "marketplace",
    name: "Marketplace",
    href: "/review#marketplace",
    status: "PLANNED",
    phase: "Unscheduled",
    line: "Registry placeholder — no product surface exists.",
  },
  {
    key: "operator-network",
    name: "Operator Network",
    href: "/community",
    status: "PRODUCT",
    phase: "Unscheduled",
    line: "The operator floor. CXOS entry unscheduled.",
    authed: true,
  },
  {
    key: "dashboard",
    name: "Consumer Command",
    href: "/dashboard",
    status: "PRODUCT",
    phase: "Phase 4 (planned)",
    line: "The consumer's own case as the first protagonist.",
    authed: true,
  },
  {
    key: "enterprise",
    name: "Enterprise",
    href: "/review#enterprise",
    status: "PLANNED",
    phase: "Unscheduled",
    line: "Registry placeholder — no product surface exists.",
  },
];
