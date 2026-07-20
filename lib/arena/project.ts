// Arena projection — PURE, deterministic, own-user only. Zero I/O, no clock, no
// randomness. Given a user's OWN verified-outcome rows, it derives their XP, level,
// rank and badges by RECONCILE-ON-READ: the projection is a pure fold over current
// truth, so a later outcome revision is reflected automatically — no stored award
// to go stale, no compensating row to forget. That is the whole reason the v1
// slice needs no new table.
//
// It never ranks users against each other and never reads another user's data.
// Cross-user surfaces are refused in v1 (see lib/arena/policy.ts note 4).
import {
  xpForOutcome, classifyOutcome, outcomeAwardKey, ARENA_POLICY_VERSION,
  type ArenaClassId,
} from "./policy";

// The minimal shape Arena reads from a VerifiedOutcome row. `userId` is the
// evidence owner and is the ONLY legitimate award earner — carried here so callers
// and tests can assert attribution is never re-derived from a session.
export interface OutcomeRow {
  letterId: string;
  userId: string;
  outcome: string | null;
}

// A derived award. Not persisted in v1 — it is the read-time projection of one
// letter's current outcome. Idempotent by construction: one letterId => one award.
export interface DerivedAward {
  key: string; // outcomeAwardKey(letterId) — stable, mutable-outcome-free
  letterId: string;
  userId: string;
  classId: ArenaClassId;
  xp: number;
  policyVersion: number;
}

export interface ArenaStanding {
  userId: string;
  totalXp: number;
  level: number;
  rank: string;
  awardCount: number;
  favorableCount: number;
  badges: string[];
}

// Deterministic level curve. xpForLevel(n) = 25*n*(n-1): 0/50/150/300/500/750...
// Integer-only, tuned to the documented XP scale (a favorable outcome = 20).
export function xpForLevel(n: number): number {
  return 25 * n * (n - 1);
}
export function levelForXp(xp: number): number {
  let n = 1;
  while (xpForLevel(n + 1) <= xp) n++;
  return n;
}

// Rank ladder by level. Deterministic, ordered, no ties to break.
const RANKS: readonly { at: number; name: string }[] = [
  { at: 1, name: "recruit" },
  { at: 3, name: "contender" },
  { at: 6, name: "operator" },
  { at: 10, name: "veteran" },
  { at: 15, name: "elite" },
];
export function rankForLevel(level: number): string {
  let name = RANKS[0].name;
  for (const r of RANKS) if (level >= r.at) name = r.name;
  return name;
}

// Derive the award set for ONE user's outcome rows. Dedupe strictly on letterId
// (the stable entity), so re-logged/duplicate rows for one letter collapse to a
// single award scored from the LAST-seen outcome. Non-awarding outcomes (unknown,
// null) produce no award at all.
export function deriveAwards(rows: readonly OutcomeRow[]): DerivedAward[] {
  const byLetter = new Map<string, DerivedAward>();
  for (const r of rows) {
    const classId = classifyOutcome(r.outcome);
    if (!classId) { byLetter.delete(r.letterId); continue; } // a revision to non-favorable removes the award
    byLetter.set(r.letterId, {
      key: outcomeAwardKey(r.letterId),
      letterId: r.letterId,
      userId: r.userId,
      classId,
      xp: xpForOutcome(r.outcome),
      policyVersion: ARENA_POLICY_VERSION,
    });
  }
  // Stable order: by letterId, so the fold is input-order-independent (replay-safe).
  return Array.from(byLetter.values()).sort((a, b) => (a.letterId < b.letterId ? -1 : a.letterId > b.letterId ? 1 : 0));
}

// Pure predicates over own data only. Reversals are automatic: if a favorable
// outcome regresses, deriveAwards drops it and the badge disappears on next read.
function badgesFor(awards: readonly DerivedAward[]): string[] {
  const favorable = awards.filter((a) => a.classId === "A").length;
  const b: string[] = [];
  if (favorable >= 1) b.push("first-favorable");
  if (favorable >= 5) b.push("momentum");
  if (awards.length >= 10) b.push("persistent");
  return b;
}

// The full own-user standing. `userId` MUST be the evidence owner; callers pass
// rows already scoped to one user (the DB query filters by userId).
export function projectStanding(userId: string, rows: readonly OutcomeRow[]): ArenaStanding {
  const scoped = rows.filter((r) => r.userId === userId); // defense-in-depth: never fold another user's rows
  const awards = deriveAwards(scoped);
  const totalXp = awards.reduce((sum, a) => sum + a.xp, 0);
  const level = levelForXp(totalXp);
  return {
    userId,
    totalXp,
    level,
    rank: rankForLevel(level),
    awardCount: awards.length,
    favorableCount: awards.filter((a) => a.classId === "A").length,
    badges: badgesFor(awards),
  };
}

// Platform-wide AGGREGATE INTEGERS only — for an admin diagnostic. Carries NO
// userId, handle, ranking, or outcome detail, so it is not a leaderboard and
// cannot imply typical results. This is the only multi-user surface v1 exposes,
// and it exposes counts, never people.
export function aggregateStats(rows: readonly OutcomeRow[]): {
  qualifyingUsers: number; totalAwards: number; totalXp: number; favorableAwards: number;
} {
  const byUser = new Map<string, OutcomeRow[]>();
  for (const r of rows) {
    const list = byUser.get(r.userId) ?? [];
    list.push(r);
    byUser.set(r.userId, list);
  }
  let qualifyingUsers = 0, totalAwards = 0, totalXp = 0, favorableAwards = 0;
  for (const [userId, userRows] of byUser) {
    const awards = deriveAwards(userRows.filter((r) => r.userId === userId));
    if (awards.length === 0) continue;
    qualifyingUsers++;
    totalAwards += awards.length;
    totalXp += awards.reduce((s, a) => s + a.xp, 0);
    favorableAwards += awards.filter((a) => a.classId === "A").length;
  }
  return { qualifyingUsers, totalAwards, totalXp, favorableAwards };
}
