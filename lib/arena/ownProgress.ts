// Server-only reader for a user's OWN Arena progression. Reads only this user's
// verified-outcome rows (scoped by userId in the query) and folds them through the
// pure engine. Own-data only — gate-free like ownOutcomeTrack, never cross-user.
// Fail-closed to an empty standing on any error.
import { prisma } from "@/lib/prisma";
import { projectStanding, deriveAwards, type OutcomeRow, type ArenaStanding } from "./project";
import { ARENA_CLASSES, ARENA_POLICY_VERSION } from "./policy";
import { xpForLevel } from "./project";

export interface OwnAwardLine {
  letterId: string;
  classId: string;
  classLabel: string;
  xp: number;
  evidenceClass: string;
}

export interface OwnProgress {
  standing: ArenaStanding;
  xpIntoLevel: number;
  xpForNextLevel: number; // XP span of the current level (this level -> next)
  awards: OwnAwardLine[];
  policyVersion: number;
}

export async function readOwnProgress(userId: string): Promise<OwnProgress> {
  let rows: OutcomeRow[] = [];
  try {
    const raw = await prisma.$queryRawUnsafe<{ letterId: string; outcome: string | null }[]>(
      `SELECT "letterId", "outcome" FROM "VerifiedOutcome" WHERE "userId" = $1`,
      userId,
    );
    rows = raw.map((r) => ({ letterId: r.letterId, userId, outcome: r.outcome }));
  } catch {
    rows = [];
  }

  const standing = projectStanding(userId, rows);
  const awards = deriveAwards(rows).map<OwnAwardLine>((a) => ({
    letterId: a.letterId,
    classId: a.classId,
    classLabel: ARENA_CLASSES[a.classId].label,
    xp: a.xp,
    evidenceClass: ARENA_CLASSES[a.classId].evidenceClass,
  }));

  const base = xpForLevel(standing.level);
  const next = xpForLevel(standing.level + 1);
  return {
    standing,
    xpIntoLevel: standing.totalXp - base,
    xpForNextLevel: next - base,
    awards: awards.sort((a, b) => b.xp - a.xp || (a.letterId < b.letterId ? -1 : 1)),
    policyVersion: ARENA_POLICY_VERSION,
  };
}
