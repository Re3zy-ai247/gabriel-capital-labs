// CXOS Phase 5 — the Arena semantic ledger.
//
// THE LAW (carried from Phase 3's pylon test): every visual element in the
// Arena entry and chamber has a row here stating what it represents, where
// its truth comes from, its honest status, what happens when data is absent,
// whether it is interactive, and its reduced-motion projection. An element
// without a row does not ship — the guard enforces this file's coverage.
//
// OWNERSHIP (frozen): Reputation owns XP/standing/milestone truth
// (lib/reputation/*). Arena renders projections of it (lib/arena/* reads;
// lib/arena/policy.ts re-exports reputation scoring UNCHANGED). Nothing in
// components/cxos/arena may import the reputation service's write surface —
// mutation-guarded.

export type LedgerStatus = "LIVE" | "DORMANT" | "PROTOTYPE" | "SPECIMEN" | "PLANNED";

export interface ArenaLedgerRow {
  element: string;
  represents: string;
  source: string;
  status: LedgerStatus;
  whenAbsent: string;
  interactive: boolean;
  reducedMotion: string;
}

export const ARENA_LEDGER: ArenaLedgerRow[] = [
  {
    element: "Clearance register (entry b1)",
    represents: "the operator's resolved Arena access: identity + internal cohort + policy version",
    source: "arenaAccessible() server gate + OwnProgress.policyVersion — the entry renders ONLY after the real gate passed",
    status: "DORMANT",
    whenAbsent: "the entry never mounts — the page's server redirect to /dashboard happened first",
    interactive: false,
    reducedMotion: "not rendered (tier D mounts nothing; the chamber is simply there)",
  },
  {
    element: "Evidence vault lines (entry b2)",
    represents: "the operator's OWN top evidenced awards — class label, evidence class, XP",
    source: "OwnProgress.awards (reputation ledger rows, own-data only)",
    whenAbsent: "the truthful empty line: 'No XP yet — only evidenced activity counts.'",
    status: "DORMANT",
    interactive: false,
    reducedMotion: "not rendered",
  },
  {
    element: "Ascent line (entry b3)",
    represents: "earned standing: rank + level, scale conveyed by typography and light only",
    source: "ArenaStanding.rank / .level (reputation fold)",
    whenAbsent: "level 0 renders as itself — never inflated",
    status: "DORMANT",
    interactive: false,
    reducedMotion: "not rendered",
  },
  {
    element: "Arena reveal ring (entry b4)",
    represents: "the chamber opening — pure architecture, carries no data",
    source: "none (declared decorative threshold, the one admitted ceremonial element)",
    whenAbsent: "n/a",
    status: "PROTOTYPE",
    interactive: false,
    reducedMotion: "not rendered",
  },
  {
    element: "Standing ring (chamber)",
    represents: "progress through the CURRENT level: XP into level / level span",
    source: "OwnProgress.xpIntoLevel / .xpForNextLevel (derived by reputation projection)",
    whenAbsent: "ring renders at 0% with the truthful caption",
    status: "DORMANT",
    interactive: false,
    reducedMotion: "static ring at the real percentage — no sweep",
  },
  {
    element: "Milestone seals (chamber)",
    represents: "earned milestone badges from the reputation fold",
    source: "ArenaStanding.badges",
    whenAbsent: "the seals row is absent — no placeholder seals, ever",
    status: "DORMANT",
    interactive: false,
    reducedMotion: "static",
  },
  {
    element: "Ledger wall (chamber)",
    represents: "the operator's own award history — immutable, evidence-classed",
    source: "OwnProgress.awards (existing page logic, unchanged)",
    whenAbsent: "the existing truthful empty state (evidenced-activity-only copy)",
    status: "DORMANT",
    interactive: false,
    reducedMotion: "static list",
  },
  {
    element: "Competition aperture (chamber)",
    represents: "where seasons/competitions WILL open — refused in policy v1",
    source: "REFUSED_V1 (reputation scoring policy) — rendered AS refused, never as live",
    whenAbsent: "always renders its PLANNED seal; there is no live branch to fake",
    status: "PLANNED",
    interactive: false,
    reducedMotion: "static seal",
  },
  {
    element: "Kai brief (chamber)",
    represents: "Kai's interpretation of the operator's own record — never ownership of it",
    source: "computed from OwnProgress only (awardCount/level); no AI call, no forecast",
    whenAbsent: "interprets the empty vault truthfully",
    status: "PROTOTYPE",
    interactive: false,
    reducedMotion: "static text",
  },
  {
    element: "Arena door (Mission Control)",
    represents: "the call — the Arena is reachable for THIS account",
    source: "arenaAccessible(user) evaluated server-side on the dashboard",
    whenAbsent: "not rendered at all — no teaser for accounts outside the cohort",
    interactive: true,
    status: "DORMANT",
    reducedMotion: "plain link card",
  },
];
