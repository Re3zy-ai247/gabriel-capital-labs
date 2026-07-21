// Operator Reputation — durable progression events (Sprint 10).
//
// Reputation EMITS immutable facts and owns no downstream behavior (the constitutional
// boundary: Identity -> Event Fabric -> Reputation -> Arena). Same pattern as the
// identity event recorder: the shared Event Fabric spine (contracts + fail-closed
// validate/PII guard + publish PEP + idempotent appendEvent), a trusted systemIdentity,
// and deliberately NO fanout — Arena reads projections, not deliveries. The gate is the
// REPUTATION flag, never the realtime bus flag.
//
// XP grants reuse ARENA_POINTS_CHANGED@1 and badges reuse ACHIEVEMENT_UNLOCKED@1 (one
// fact type per fact); OPERATOR_RANK_CHANGED@1 + MILESTONE_REACHED@1 are the new facts.
// tenant = the operator's ACCOUNT id (server-resolved); actor = the causing principal.
import { getContract, currentVersion } from "@/lib/eventBus/contracts";
import { validateEvent } from "@/lib/eventBus/validate";
import { authorizePublish } from "@/lib/eventBus/publish";
import { appendEvent } from "@/lib/eventBus/store";
import { deriveEventId, systemIdentity, type DraftEvent, type EventType } from "@/lib/eventBus/envelope";
import { operatorReputationEnabled } from "./flags";

// Canonical Reputation-domain fact types (Sprint 10 Phase 6). Reputation no longer
// emits the Arena-named ARENA_POINTS_CHANGED / ACHIEVEMENT_UNLOCKED (retained as
// deprecated replay-only contracts).
export const REPUTATION_EVENT_TYPES = [
  "OPERATOR_XP_CHANGED",
  "REPUTATION_AWARD_REVERSED",
  "OPERATOR_RANK_CHANGED",
  "MILESTONE_REACHED",
] as const;
export type ReputationEventType = (typeof REPUTATION_EVENT_TYPES)[number];

export interface ReputationEventInput {
  type: ReputationEventType;
  tenantId: string; // the operator's account id — server-resolved, never client input
  actorId: string; // the causing principal (or "system" for fact-driven awards)
  payload: Record<string, unknown>; // refs-only, per contract
  dedupeKey: string; // stable natural key (award id / rank edge / milestone latch)
  correlationId?: string;
}

export type RecordResult =
  | { ok: true; eventId: string; replayed: boolean }
  | { ok: false; code: "disabled" | "invalid" | "forbidden"; error: string };

// The reputation service's own source tag — overrides ARENA_POINTS_CHANGED's legacy
// "arena" defaultSource so every reputation-emitted fact carries source "reputation".
const SOURCE = "reputation";

export async function recordReputationEvent(input: ReputationEventInput): Promise<RecordResult> {
  if (!operatorReputationEnabled()) return { ok: false, code: "disabled", error: "operator reputation disabled" };

  const version = currentVersion(input.type as EventType);
  const contract = getContract(input.type, version);
  if (!contract) return { ok: false, code: "invalid", error: `unknown contract ${input.type}@${version}` };

  const valid = validateEvent(input.type, version, input.payload);
  if (!valid.ok) return { ok: false, code: "invalid", error: valid.error };
  if (!input.dedupeKey) return { ok: false, code: "invalid", error: "missing dedupeKey" };
  if (!input.tenantId || !input.actorId) return { ok: false, code: "invalid", error: "unresolved identity" };

  const identity = systemIdentity(input.tenantId, { actorId: input.actorId });
  const authz = authorizePublish(contract, identity);
  if (!authz.ok) return { ok: false, code: "forbidden", error: authz.reason };

  const id = deriveEventId(input.tenantId, input.type, SOURCE, input.dedupeKey);
  const draft: DraftEvent = {
    id,
    type: input.type as EventType,
    version,
    tenantId: input.tenantId,
    agencyId: null,
    actorId: input.actorId,
    source: SOURCE,
    correlationId: input.correlationId ?? id,
    payload: valid.payload,
  };
  const { event, replayed } = await appendEvent(draft); // durable + idempotent; NO fanout
  return { ok: true, eventId: event.id, replayed };
}

// ── Pure builders ────────────────────────────────────────────────────────────

// Canonical XP-grant fact (the award-recorded AND xp-changed event are ONE fact —
// emitting a separate "award recorded" would double-count downstream). One fact per
// ledger row, replay-safe.
export function operatorXpChangedEvent(
  op: { operatorId: string; accountId: string }, award: { id: string; classId: string; xp: number }, totalXp: number, actorId: string,
): ReputationEventInput {
  return {
    type: "OPERATOR_XP_CHANGED",
    tenantId: op.accountId,
    actorId,
    payload: { operatorId: op.operatorId, awardId: award.id, xpDelta: award.xp, totalXp, classId: award.classId },
    dedupeKey: `award:${award.id}`,
  };
}

// Canonical reversal fact — a compensating record is NOT a grant, so it gets its own
// domain event. One fact per reversal row.
export function awardReversedEvent(
  op: { operatorId: string; accountId: string }, reversal: { id: string; xp: number }, reversedAwardId: string, totalXp: number, actorId: string,
): ReputationEventInput {
  return {
    type: "REPUTATION_AWARD_REVERSED",
    tenantId: op.accountId,
    actorId,
    payload: { operatorId: op.operatorId, reversalId: reversal.id, reversedAwardId, xpDelta: reversal.xp, totalXp },
    dedupeKey: `reversal:${reversal.id}`,
  };
}

export function rankChangedEvent(
  op: { operatorId: string; accountId: string }, from: string, to: string, actorId: string, causeId: string,
): ReputationEventInput {
  return {
    type: "OPERATOR_RANK_CHANGED",
    tenantId: op.accountId,
    actorId,
    payload: { operatorId: op.operatorId, from, to },
    // Keyed per CAUSE (the triggering award/reversal id), NOT per edge: rank is
    // non-monotonic once reversals exist (a drop then a re-cross is a real second fact),
    // so an edge key would silently dedupe the legitimate re-promotion.
    dedupeKey: `rank:${op.operatorId}:${causeId}`,
  };
}

export function milestoneReachedEvent(
  op: { operatorId: string; accountId: string }, milestoneKey: string, actorId: string,
): ReputationEventInput {
  return {
    type: "MILESTONE_REACHED",
    tenantId: op.accountId,
    actorId,
    payload: { operatorId: op.operatorId, milestoneKey },
    dedupeKey: `milestone:${op.operatorId}:${milestoneKey}`, // latched: one fact ever
  };
}
