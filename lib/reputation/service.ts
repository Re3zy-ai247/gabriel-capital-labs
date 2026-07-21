// Operator Reputation — runtime service (Sprint 10). The single orchestration door.
//
// CONSTITUTIONAL BOUNDARY: Identity -> Event Fabric -> Reputation -> Arena.
// This service CONSUMES identity facts (operator ids resolved through lib/identity's
// read surface) and NEVER mutates identity — the only identity import is the read-only
// operator lookup. It owns scoring/progression truth; Arena renders projections of it.
//
// Doors (all fail-closed: flag -> input -> authorize -> policy -> idempotent append ->
// facts). Award ingestion is SERVER-INTERNAL (a trusted caller wiring domain facts —
// there is no HTTP surface and no client-supplied XP amount; xp resolves from the
// shipped policy only). Reads are self/admin (own standing — the same own-data posture
// as Arena v1; every cross-user surface stays in the refusal register).
import { operatorReputationEnabled } from "./flags";
import {
  resolveAwardXp, isAwardKind, reversalKindFor, REPUTATION_POLICY_VERSION,
  MILESTONE_DEFINITIONS, type MilestoneDefinition,
} from "./policy";
import { foldStanding, type ReputationStanding } from "./fold";
import { evaluateMilestones, isValidMilestoneKey } from "./milestones";
import * as repo from "./repository";
import { findOperatorById } from "@/lib/identity/repository"; // READ-ONLY identity lookup — reputation never mutates identity
import { type IdentityPrincipal, isAdmin } from "@/lib/identity/principal";
import { recordReputationEvent, xpGrantedEvent, rankChangedEvent, milestoneReachedEvent } from "./events";
import type { XpAward, ReputationMilestone } from "@prisma/client";

export type ErrorCode = "disabled" | "forbidden" | "invalid" | "conflict" | "not_found";
export type ServiceResult<T> = { ok: true; data: T } | { ok: false; code: ErrorCode; error: string };
const fail = (code: ErrorCode, error: string): { ok: false; code: ErrorCode; error: string } => ({ ok: false, code, error });

// ── Internal award ingestion (server-side trusted callers only) ──────────────

export interface RecordAwardInput {
  operatorId: string;
  subjectId: string; // the STABLE, version-free business entity (reputationSubjectId(type, id))
  awardKind: string; // earning dimension — must be a declared AwardKind
  classId: string; // resolved against the shipped policy (must be live)
  sourceEventId?: string | null; // provenance only
  actorId?: string; // causing principal; defaults to "system" (fact-driven)
}

export interface RecordAwardOutcome {
  award: XpAward;
  created: boolean;
  standing: ReputationStanding;
  rankChanged: { from: string; to: string } | null;
}

// Award XP for a subject. Idempotent: same (subject, operator, kind) -> the original
// row, no double-mint, no duplicate facts. XP comes from policy — never from input.
export async function recordAward(input: RecordAwardInput): Promise<ServiceResult<RecordAwardOutcome>> {
  if (!operatorReputationEnabled()) return fail("disabled", "operator reputation disabled");
  if (!input.operatorId || !input.subjectId) return fail("invalid", "missing operator/subject");
  if (input.subjectId.length > 120) return fail("invalid", "subjectId too long");
  if (!isAwardKind(input.awardKind)) return fail("invalid", `unknown award kind: ${input.awardKind}`);

  const resolved = resolveAwardXp(input.classId);
  if (!resolved) return fail("invalid", `class ${input.classId} mints nothing (non-live or unknown)`); // fail-closed

  const operator = await findOperatorById(input.operatorId);
  if (!operator) return fail("not_found", "operator not found");
  if (operator.state === "DEACTIVATED") return fail("conflict", "operator is deactivated");

  const before = foldStanding(await repo.listAwards(operator.id));
  const { award, created } = await repo.appendAward({
    operatorId: operator.id, subjectId: input.subjectId, awardKind: input.awardKind,
    classId: resolved.classId, xp: resolved.xp, policyVersion: resolved.policyVersion,
    sourceEventId: input.sourceEventId ?? null,
  });
  if (!created) {
    // Replay: no state change, no facts. Deterministic standing from the ledger.
    return { ok: true, data: { award, created: false, standing: before, rankChanged: null } };
  }

  const standing = foldStanding(await repo.listAwards(operator.id));
  const actorId = input.actorId ?? "system";
  const opRef = { operatorId: operator.id, accountId: operator.accountId };

  await recordReputationEvent(xpGrantedEvent(opRef, { id: award.id, classId: award.classId, xp: award.xp }, standing.totalXp, actorId));
  let rankChanged: { from: string; to: string } | null = null;
  if (standing.rank !== before.rank) {
    rankChanged = { from: before.rank, to: standing.rank };
    await recordReputationEvent(rankChangedEvent(opRef, before.rank, standing.rank, actorId, award.id));
  }
  return { ok: true, data: { award, created: true, standing, rankChanged } };
}

// Compensating record (evidence invalidation — VECTOR-XP §5: never an edit). ADMIN
// principal required; maker-checker/second-approver is an ACTIVATION-gated governance
// layer documented in VECTOR-XP §6.1, not built here. Idempotent: one reversal slot
// per original (kind "reverse:<dimension>").
export async function reverseAward(
  principal: IdentityPrincipal | null, originalAwardId: string,
): Promise<ServiceResult<{ reversal: XpAward; created: boolean; standing: ReputationStanding }>> {
  if (!operatorReputationEnabled()) return fail("disabled", "operator reputation disabled");
  if (!principal || principal.disabled || !isAdmin(principal)) return fail("forbidden", "admin required");

  const original = await repo.findAwardById(originalAwardId);
  if (!original) return fail("not_found", "award not found");
  if (!isAwardKind(original.awardKind)) return fail("invalid", "only a base award can be reversed"); // a reversal can't be reversed
  if (original.xp <= 0) return fail("invalid", "nothing to reverse");

  const operator = await findOperatorById(original.operatorId);
  if (!operator) return fail("not_found", "operator not found");
  const before = foldStanding(await repo.listAwards(original.operatorId));
  const { award: reversal, created } = await repo.appendAward({
    operatorId: original.operatorId, subjectId: original.subjectId,
    awardKind: reversalKindFor(original.awardKind), classId: original.classId,
    xp: -original.xp, policyVersion: original.policyVersion, reversesId: original.id,
  });
  const standing = foldStanding(await repo.listAwards(original.operatorId));
  if (created) {
    // Emit the compensating facts so the durable fact stream tracks the ledger (a
    // consumer must see the reversal, and a rank drop, not just a silent ledger move).
    const opRef = { operatorId: operator.id, accountId: operator.accountId };
    await recordReputationEvent(xpGrantedEvent(opRef, { id: reversal.id, classId: reversal.classId, xp: reversal.xp }, standing.totalXp, principal.id));
    if (standing.rank !== before.rank) {
      await recordReputationEvent(rankChangedEvent(opRef, before.rank, standing.rank, principal.id, reversal.id));
    }
  }
  return { ok: true, data: { reversal, created, standing } };
}

// Evaluate + latch milestones for an operator against injected definitions (zero are
// built in — owner-gated). Latched milestones never re-earn or disappear.
export async function evaluateAndLatchMilestones(
  operatorId: string, definitions: readonly MilestoneDefinition[] = MILESTONE_DEFINITIONS, actorId = "system",
): Promise<ServiceResult<{ latched: ReputationMilestone[] }>> {
  if (!operatorReputationEnabled()) return fail("disabled", "operator reputation disabled");
  const operator = await findOperatorById(operatorId);
  if (!operator) return fail("not_found", "operator not found");

  const [standing, existing] = await Promise.all([
    repo.listAwards(operator.id).then(foldStanding),
    repo.listMilestones(operator.id),
  ]);
  const earned = evaluateMilestones(definitions, standing, new Set(existing.map((m) => m.milestoneKey)));

  const latched: ReputationMilestone[] = [];
  const opRef = { operatorId: operator.id, accountId: operator.accountId };
  for (const key of earned) {
    if (!isValidMilestoneKey(key)) continue; // defense-in-depth
    const { milestone, created } = await repo.latchMilestone({
      operatorId: operator.id, milestoneKey: key, xpAtAchieve: standing.totalXp, policyVersion: REPUTATION_POLICY_VERSION,
    });
    if (created) {
      latched.push(milestone);
      await recordReputationEvent(milestoneReachedEvent(opRef, key, actorId));
    }
  }
  return { ok: true, data: { latched } };
}

// ── Reads (own-data / admin — the projection Arena renders) ──────────────────

export async function getStanding(
  principal: IdentityPrincipal | null, operatorId: string,
): Promise<ServiceResult<{ standing: ReputationStanding; milestones: ReputationMilestone[] }>> {
  if (!operatorReputationEnabled()) return fail("disabled", "operator reputation disabled");
  if (!principal || principal.disabled) return fail("forbidden", "no principal");
  const operator = await findOperatorById(operatorId);
  if (!operator) return fail("not_found", "operator not found");
  if (!(isAdmin(principal) || operator.accountId === principal.id)) return fail("forbidden", "own standing only"); // refusal register: no cross-user surface
  const [awards, milestones] = await Promise.all([repo.listAwards(operator.id), repo.listMilestones(operator.id)]);
  return { ok: true, data: { standing: foldStanding(awards), milestones } };
}

// Deterministic replay: recompute standing purely from the ledger (proves stored-
// nothing / derived-everything). Authorized identically to getStanding — own-data or
// admin only; it returns the same ReputationStanding, so it must not be an
// unauthenticated cross-user read.
export async function replayStanding(
  principal: IdentityPrincipal | null, operatorId: string,
): Promise<ServiceResult<ReputationStanding>> {
  if (!operatorReputationEnabled()) return fail("disabled", "operator reputation disabled");
  if (!principal || principal.disabled) return fail("forbidden", "no principal");
  const operator = await findOperatorById(operatorId);
  if (!operator) return fail("not_found", "operator not found");
  if (!(isAdmin(principal) || operator.accountId === principal.id)) return fail("forbidden", "own standing only");
  return { ok: true, data: foldStanding(await repo.listAwards(operator.id)) };
}
