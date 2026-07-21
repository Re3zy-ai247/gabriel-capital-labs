// Operator Reputation — ledger repository (Sprint 10). APPEND-ONLY by construction.
//
// This module exposes NO update and NO delete — the XpAward/ReputationMilestone tables
// have no mutation path anywhere in the codebase (asserted by the guard). Writes are
// find-or-create guarded by the canonical unique constraints, so a retry, a concurrent
// caller, or a re-delivered fact lands exactly once (replayed:true on collision):
//   • XpAward:            UNIQUE(subjectId, operatorId, awardKind)
//   • ReputationMilestone: UNIQUE(operatorId, milestoneKey)   (the latch)
// Authorization lives in the SERVICE; this layer takes ids the service already
// authorized and never reads request input.
import { Prisma } from "@prisma/client";
import type { XpAward, ReputationMilestone } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

export interface AppendAwardInput {
  operatorId: string;
  subjectId: string;
  awardKind: string; // dimension, or "reverse:<dimension>" for a compensating record
  classId: string;
  xp: number; // resolved by the SERVICE from policy (signed for reversals)
  policyVersion: number;
  reversesId?: string | null;
  sourceEventId?: string | null;
}

// Idempotent append. The unique triple makes redelivery/replay a no-op returning the
// original row. Throws on real failures (retry-safe).
export async function appendAward(input: AppendAwardInput): Promise<{ award: XpAward; created: boolean }> {
  const where = { subjectId_operatorId_awardKind: { subjectId: input.subjectId, operatorId: input.operatorId, awardKind: input.awardKind } };
  const existing = await prisma.xpAward.findUnique({ where });
  if (existing) return { award: existing, created: false };
  try {
    const award = await prisma.xpAward.create({
      data: {
        operatorId: input.operatorId, subjectId: input.subjectId, awardKind: input.awardKind,
        classId: input.classId, xp: input.xp, policyVersion: input.policyVersion,
        reversesId: input.reversesId ?? null, sourceEventId: input.sourceEventId ?? null,
      },
    });
    return { award, created: true };
  } catch (e) {
    if (isUniqueViolation(e)) {
      const award = await prisma.xpAward.findUnique({ where });
      if (award) return { award, created: false };
    }
    throw e;
  }
}

// The latch. Idempotent on UNIQUE(operatorId, milestoneKey) — earned once, ever.
export async function latchMilestone(
  input: { operatorId: string; milestoneKey: string; xpAtAchieve: number; policyVersion: number },
): Promise<{ milestone: ReputationMilestone; created: boolean }> {
  const where = { operatorId_milestoneKey: { operatorId: input.operatorId, milestoneKey: input.milestoneKey } };
  const existing = await prisma.reputationMilestone.findUnique({ where });
  if (existing) return { milestone: existing, created: false };
  try {
    const milestone = await prisma.reputationMilestone.create({ data: input });
    return { milestone, created: true };
  } catch (e) {
    if (isUniqueViolation(e)) {
      const milestone = await prisma.reputationMilestone.findUnique({ where });
      if (milestone) return { milestone, created: false };
    }
    throw e;
  }
}

// Reads — deterministic canonical order (the fold's replay order).
export function listAwards(operatorId: string): Promise<XpAward[]> {
  return prisma.xpAward.findMany({ where: { operatorId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
}
export function listMilestones(operatorId: string): Promise<ReputationMilestone[]> {
  return prisma.reputationMilestone.findMany({ where: { operatorId }, orderBy: [{ achievedAt: "asc" }, { id: "asc" }] });
}
export function findAwardById(id: string): Promise<XpAward | null> {
  return prisma.xpAward.findUnique({ where: { id } });
}
