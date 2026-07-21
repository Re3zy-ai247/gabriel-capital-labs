// Operator Reputation — the deterministic standing fold (Sprint 10). PURE, no I/O.
//
// THE REPLAY MODEL: the append-only XpAward ledger is the single source of truth, and
// standing (total XP, level, rank, counts) is a DETERMINISTIC FOLD over it in the
// canonical [createdAt asc, id asc] order. There is no stored balance to drift, no
// projection table to go stale — recomputation from the ledger IS the projection, and
// replaying the same rows always yields byte-identical standing (asserted by the guard).
//
// Invariants (VECTOR-XP.md §3):
//   • XP never decreases through NORMAL use — only appended compensating records
//     (negative xp reversal rows) can lower the fold, and never below zero.
//   • No hidden mutable balance: totalXp exists only as this fold's output.
import { levelForXp, rankForLevel, xpForLevel } from "./policy";

// The minimal award row the fold consumes (a subset of the XpAward model).
export interface AwardRow {
  id: string;
  awardKind: string; // "outcome" | "reverse:outcome" | …
  classId: string;
  xp: number; // signed; reversal rows negative
  createdAt: Date | string;
}

export interface ReputationStanding {
  totalXp: number; // fold result, floored at 0
  level: number;
  rank: string;
  xpForNextLevel: number; // threshold of level+1 (progress rendering is Arena's job)
  awardCount: number; // positive award rows (reversals excluded)
  reversalCount: number;
  byClass: Readonly<Record<string, number>>; // net XP per classId (refs-only stats)
}

const canonicalOrder = (a: AwardRow, b: AwardRow): number => {
  const ta = new Date(a.createdAt).getTime();
  const tb = new Date(b.createdAt).getTime();
  if (ta !== tb) return ta - tb;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
};

// Fold the ledger into standing. Deterministic: same rows (any input order) → same
// output. Unknown/malformed rows contribute nothing (fail-closed), never throw.
export function foldStanding(rows: readonly AwardRow[]): ReputationStanding {
  const ordered = [...rows].sort(canonicalOrder);
  let total = 0;
  let awardCount = 0;
  let reversalCount = 0;
  const byClass: Record<string, number> = {};
  for (const r of ordered) {
    const xp = Number.isFinite(r.xp) ? Math.trunc(r.xp) : 0;
    if (xp === 0) continue;
    total += xp;
    if (xp > 0) awardCount++; else reversalCount++;
    byClass[r.classId] = (byClass[r.classId] ?? 0) + xp;
  }
  if (total < 0) total = 0; // the floor: a reversal can zero standing, never indebt it
  const level = levelForXp(total);
  return {
    totalXp: total,
    level,
    rank: rankForLevel(level),
    xpForNextLevel: xpForLevel(level + 1),
    awardCount,
    reversalCount,
    byClass,
  };
}

export const EMPTY_STANDING: ReputationStanding = foldStanding([]);
