// Operator Reputation — deterministic fact reconciliation (Sprint 10 Phase 7).
//
// The XpAward ledger is authoritative; fact emission at write time is best-effort (a
// crash between the ledger append and the Event Fabric append loses a FACT, never
// TRUTH — standing always re-folds from the ledger). This makes recovery EXECUTABLE
// WITHOUT a new outbox table or queue: it REUSES the Event Fabric's durable mechanism —
// deterministic event ids + idempotent appendEvent. We fold the ledger and re-derive
// EXACTLY the facts the live path would have emitted (identical deterministic ids), so
// re-emitting an already-published fact is a pure no-op (replayed:true) and a missing
// fact is recovered. Never double-publishes; deterministic; replay-equivalent.
//
// Invariants: ledger stays authoritative (READ-ONLY here — no award is created,
// updated, or deleted); publication status never becomes XP truth; a policy-version
// change cannot re-mint (we re-emit facts for EXISTING rows, we do not append awards);
// reversals get their own REPUTATION_AWARD_REVERSED fact; rank facts stay cause-keyed;
// admin-gated + tenant-safe (facts are scoped to the operator's own account).
import { operatorReputationEnabled } from "./flags";
import { type IdentityPrincipal, isAdmin } from "@/lib/identity/principal";
import { findOperatorById } from "@/lib/identity/repository"; // READ-ONLY identity lookup
import { levelForXp, rankForLevel } from "./scoring";
import { EMPTY_STANDING } from "./fold";
import * as repo from "./repository";
import { recordReputationEvent, operatorXpChangedEvent, awardReversedEvent, rankChangedEvent, milestoneReachedEvent } from "./events";
import type { ServiceResult, ErrorCode } from "./service";

const fail = (code: ErrorCode, error: string): { ok: false; code: ErrorCode; error: string } => ({ ok: false, code, error });

export interface ReconcileResult {
  operatorId: string;
  awards: number;
  factsCreated: number; // facts that were MISSING and are now recovered
  factsReplayed: number; // facts already present (idempotent no-op)
}

// Re-emit every fact implied by an operator's ledger, idempotently. Admin-only. Because
// each fact's id is deterministic in (tenant, type, source, dedupeKey), this converges:
// running it twice creates nothing the second time.
export async function reconcileOperatorFacts(
  principal: IdentityPrincipal | null, operatorId: string,
): Promise<ServiceResult<ReconcileResult>> {
  if (!operatorReputationEnabled()) return fail("disabled", "operator reputation disabled");
  if (!principal || principal.disabled || !isAdmin(principal)) return fail("forbidden", "admin required");
  const operator = await findOperatorById(operatorId);
  if (!operator) return fail("not_found", "operator not found");

  const opRef = { operatorId: operator.id, accountId: operator.accountId };
  const actorId = principal.id;
  const awards = await repo.listAwards(operator.id); // canonical [createdAt asc, id asc] — the fold order

  let created = 0, replayed = 0;
  const tally = (r: { ok: boolean; replayed?: boolean }) => { if (r.ok) { r.replayed ? replayed++ : created++; } };

  // Walk the ledger in fold order, tracking the running standing EXACTLY as foldStanding
  // does (raw running sum, floored at 0 for display) so each fact carries the same
  // historical totalXp / rank the live path emitted.
  let rawSum = 0;
  let prevRank = EMPTY_STANDING.rank;
  for (const a of awards) {
    const xp = Number.isFinite(a.xp) ? Math.trunc(a.xp) : 0;
    if (xp === 0) continue; // foldStanding skips zero-xp rows; so do we
    rawSum += xp;
    const totalXp = Math.max(0, rawSum);
    const isReversal = a.xp < 0 || a.awardKind.startsWith("reverse:");
    // The XP/reversal fact — same builder, dedupeKey, and type as the live path, so the
    // deterministic id matches and appendEvent dedupes.
    tally(await recordReputationEvent(
      isReversal
        ? awardReversedEvent(opRef, { id: a.id, xp: a.xp }, a.reversesId ?? "", totalXp, actorId)
        : operatorXpChangedEvent(opRef, { id: a.id, classId: a.classId, xp: a.xp }, totalXp, actorId),
    ));
    // The rank fact, cause-keyed on THIS row's id (matches the live path exactly).
    const newRank = rankForLevel(levelForXp(totalXp));
    if (newRank !== prevRank) {
      tally(await recordReputationEvent(rankChangedEvent(opRef, prevRank, newRank, actorId, a.id)));
      prevRank = newRank;
    }
  }

  // Latched milestones (their own idempotent facts).
  for (const m of await repo.listMilestones(operator.id)) {
    tally(await recordReputationEvent(milestoneReachedEvent(opRef, m.milestoneKey, actorId)));
  }

  return { ok: true, data: { operatorId: operator.id, awards: awards.length, factsCreated: created, factsReplayed: replayed } };
}
