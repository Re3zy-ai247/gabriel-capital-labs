// CXOS isolated review registry.
//
// This RC deliberately advertises only the two review destinations actually
// reconstructed from Founder-approved evidence. It does not inherit the
// feature branch's historical room graph or expose dead links to excluded
// rooms.

export interface CxosRoom {
  key: "agency-command" | "mission-control";
  name: string;
  href: string;
  // "PLANNED" is not used by this RC's own (deliberately pruned) two-room
  // registry below, but the status vocabulary is shared with the wider CXOS
  // room graph — DirectorHUD.tsx filters on it. Widening the type only (never
  // the data here) keeps that consumer honest without reintroducing the
  // feature branch's excluded rooms.
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
] as const;
