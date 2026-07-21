// Operator Reputation — policy adapter (Sprint 10). REUSE, never duplicate.
//
// The scoring POLICY (classes, weights, refusals, evidence caps) is owned by
// ARENA-CONTRIBUTION-POLICY.md with lib/arena/policy.ts as its machine source of truth
// (VECTOR-XP.md §boundary: "the policy doc owns what earns and how much + the refusals;
// this doc owns how it is stored"). This adapter is the reputation service's ONLY view
// onto that policy — no weight, class, or refusal is redefined here, so no new XP value
// is minted (DW-D1 stays owner-gated). The level curve + rank ladder are likewise
// reused from lib/arena/project.ts (already-shipped pure math).
//
// Fail-closed: awards resolve ONLY for live classes with a positive baseXp; everything
// else (non-live class, unknown class, prohibited source) resolves to null.
import {
  ARENA_CLASSES, ARENA_POLICY_VERSION, PROHIBITED_XP_SOURCES, REFUSED_V1,
  outcomeAwardKey, classifyOutcome, type ArenaClassId,
} from "@/lib/arena/policy";
import { xpForLevel, levelForXp, rankForLevel } from "@/lib/arena/project";

export { ARENA_POLICY_VERSION as REPUTATION_POLICY_VERSION, outcomeAwardKey, classifyOutcome };
export { xpForLevel, levelForXp, rankForLevel };
export type { ArenaClassId };

// Earning dimensions — the awardKind axis of the idempotency triple. One subject mints
// at most one award per operator per DIMENSION (not per class), so an outcome flip that
// changes class (A -> Aq) can never double-award one letter (Arena rule 2, generalized).
export const AWARD_KINDS = ["outcome"] as const; // future: "education" | "community" | "agency" (owner-gated)
export type AwardKind = (typeof AWARD_KINDS)[number];
export const REVERSAL_PREFIX = "reverse:";

export function isAwardKind(k: string): k is AwardKind {
  return (AWARD_KINDS as readonly string[]).includes(k);
}
export function reversalKindFor(kind: AwardKind): string {
  return `${REVERSAL_PREFIX}${kind}`;
}

// Resolve the XP an award mints — SERVER-authoritative, from the shipped policy only.
// A browser-supplied amount is impossible by construction: there is no xp input.
// null = this class mints nothing (fail-closed: non-live, zero-weight, or unknown).
export function resolveAwardXp(classId: string): { classId: ArenaClassId; xp: number; policyVersion: number } | null {
  const cls = ARENA_CLASSES[classId as ArenaClassId];
  if (!cls || !cls.live || cls.baseXp <= 0) return null;
  return { classId: cls.id, xp: cls.baseXp, policyVersion: ARENA_POLICY_VERSION };
}

// The refusal register is binding here exactly as in Arena: these are asserted by the
// guard so the reputation service can never quietly grow a refused surface.
export const REPUTATION_REFUSED: readonly string[] = REFUSED_V1; // streaks, leaderboards, named_ranking, seasons, cash_affiliate_payout, outcome_count_broadcast
export const REPUTATION_PROHIBITED_SOURCES: readonly string[] = PROHIBITED_XP_SOURCES;

// ── Milestone definitions port — MECHANISM ONLY, zero built-in values ─────────
// Milestone definitions (keys + conditions) are owner-gated policy (DW-D8: the
// milestone state model is an open owner decision). The service ships the LATCH
// mechanism; definitions are injected at activation. A definition's condition is a
// pure predicate over the deterministic standing fold.
export interface MilestoneDefinition {
  key: string; // bounded machine key, e.g. "xp.500" — validated by the service
  test: (standing: { totalXp: number; level: number; awardCount: number }) => boolean;
}
export const MILESTONE_DEFINITIONS: readonly MilestoneDefinition[] = []; // none built — owner-gated
