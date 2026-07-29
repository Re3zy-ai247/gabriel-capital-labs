// CXOS Phase 5.1 — THE PASSAGE · synthetic review fixtures (labeled).
//
// The ONLY place a standing figure may be written as a literal in the
// passage: every component renders fixture properties, never numbers
// (guard-enforced). Values are CURVE-CONSISTENT with the real engine
// (lib/reputation/scoring.ts: xpForLevel(n) = 25·n·(n−1); ranks recruit@1,
// contender@3, operator@6): 820 XP ⇒ level 6 ⇒ operator, 70 into a
// 300-XP level span; 0 XP ⇒ level 1 ⇒ recruit. No engine-impossible
// standing is ever staged.

export interface PassageAward {
  label: string;
  xp: number;
  cls: string;
}

export interface PassageRecord {
  displayName: string;
  handle: string;
  rank: string;
  level: number;
  totalXp: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  awardCount: number;
  awards: PassageAward[];
  badges: string[];
  policyVersion: number;
}

export const OPERATOR_RECORD: PassageRecord = {
  displayName: "Jordan",
  handle: "cxreview-consumer",
  rank: "operator",
  level: 6,
  totalXp: 820,
  xpIntoLevel: 70,
  xpForNextLevel: 300,
  awardCount: 5,
  awards: [
    { label: "Bureau response logged — deletion", xp: 220, cls: "documented" },
    { label: "Bureau response logged — correction", xp: 180, cls: "documented" },
    { label: "Reinvestigation completed", xp: 180, cls: "documented" },
    { label: "Bureau response logged — correction", xp: 120, cls: "documented" },
    { label: "Reinvestigation completed", xp: 120, cls: "documented" },
  ],
  badges: ["First evidenced outcome", "Round 2 completed"],
  policyVersion: 1,
};

export const EMPTY_RECORD: PassageRecord = {
  displayName: "Jordan",
  handle: "cxreview-consumer",
  rank: "recruit",
  level: 1,
  totalXp: 0,
  xpIntoLevel: 0,
  xpForNextLevel: 50,
  awardCount: 0,
  awards: [],
  badges: [],
  policyVersion: 1,
};

export type PassageStateKey =
  | "populated"
  | "empty"
  | "flag-off"
  | "outside-cohort"
  | "data-error";

export const PASSAGE_STATES: { key: PassageStateKey; label: string }[] = [
  { key: "populated", label: "Populated" },
  { key: "empty", label: "Empty record" },
  { key: "flag-off", label: "Flag off / dormant" },
  { key: "outside-cohort", label: "Outside cohort" },
  { key: "data-error", label: "Data error" },
];

export interface PassageFixture {
  key: PassageStateKey;
  // Mirrors the real arenaAccessible() truth: flag AND cohort. When false,
  // the origin wall renders NOTHING in the call's place — no teaser.
  access: boolean;
  record: PassageRecord;
  // A truthful note the floor shows for the degraded states.
  note: string | null;
}

export function passageFixture(key: PassageStateKey): PassageFixture {
  switch (key) {
    case "populated":
      return { key, access: true, record: OPERATOR_RECORD, note: null };
    case "empty":
      return { key, access: true, record: EMPTY_RECORD, note: null };
    case "flag-off":
      return {
        key,
        access: false,
        record: EMPTY_RECORD,
        note:
          "Real behavior: ARENA_ENABLED is fail-closed opt-in — only the exact string “true” enables it. Flag off ⇒ every account is redirected by the server before any Arena markup exists.",
      };
    case "outside-cohort":
      return {
        key,
        access: false,
        record: EMPTY_RECORD,
        note:
          "Real behavior: flag ON but the account is outside the internal cohort ⇒ the same server redirect. No teaser, no implied purchase path — the call simply does not exist for this account.",
      };
    case "data-error":
      // The record read failed: the floor renders the EMPTY standing —
      // fail-closed, never a stale or invented number (readOwnProgress law).
      return {
        key,
        access: true,
        record: EMPTY_RECORD,
        note:
          "Real behavior: the progress read fails closed to the EMPTY standing on any error — the chamber shows the truthful empty record, never a cached figure.",
      };
  }
}
