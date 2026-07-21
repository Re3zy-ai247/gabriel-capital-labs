// Platform Event Bus — typed, versioned event contracts (Sprint 8).
//
// One contract per event type. The contract is the SINGLE source of truth for: the
// payload schema (zod — already a dependency, so no new provider), the contract
// `version` (bump on a breaking payload change; old versions stay registered so
// persisted history keeps validating — replay must never fail on an old row), the
// publish `scope` (self/agency/platform), and an optional `requiredPermission` mapped
// to an EXISTING permission from lib/os/host/entitlements.ts (no bus-local permission
// model is invented).
//
// PAYLOADS ARE REFS-ONLY. They carry ids, enums, counts, booleans, and field NAMES —
// never value-bearing PII (no email, balance, address, letter body, insight text).
// This is enforced structurally in validate.ts on top of these schemas, so a future
// contributor cannot quietly add a PII field. The event log is a coordination spine,
// not a data store; consumers resolve details from the owning table under their own
// authorization.
import { z } from "zod";
import type { EventType, PublishScope } from "./envelope";

const BUREAU = z.enum(["EQUIFAX", "EXPERIAN", "TRANSUNION"]);
// Field NAMES only (for *_UPDATED events) — never the changed values.
const CHANGED_FIELDS = z.array(z.string().min(1).max(60)).max(40);

export interface EventContract {
  type: EventType;
  version: number;              // current major; matches PlatformEvent.version
  defaultSource: string;        // emitting subsystem when the publisher doesn't override
  scope: PublishScope;
  requiredPermission?: string;  // an EXISTING Permission (entitlements.ts) — defense-in-depth
  schema: z.ZodType;            // payload schema (refs-only)
}

// The registry. Keyed by `${type}@${version}` so multiple retained versions of one
// type can coexist (old rows validate against their own version on replay).
export const CONTRACTS: Readonly<Record<string, EventContract>> = {
  "DISPUTE_CREATED@1": {
    type: "DISPUTE_CREATED", version: 1, defaultSource: "disputes", scope: "self", requiredPermission: "letters:generate",
    schema: z.object({ disputeId: z.string().min(1), tradelineId: z.string().min(1), bureau: BUREAU }).strict(),
  },
  "LETTER_GENERATED@1": {
    type: "LETTER_GENERATED", version: 1, defaultSource: "letters", scope: "self", requiredPermission: "letters:generate",
    schema: z.object({ letterId: z.string().min(1), tradelineId: z.string().min(1).optional(), bureau: BUREAU.optional(), status: z.string().min(1).max(40) }).strict(),
  },
  "LETTER_SENT@1": {
    type: "LETTER_SENT", version: 1, defaultSource: "mail", scope: "self", requiredPermission: "letters:generate",
    schema: z.object({ letterId: z.string().min(1), channel: z.enum(["mail", "print"]) }).strict(),
  },
  "ACCOUNT_DELETED@1": {
    type: "ACCOUNT_DELETED", version: 1, defaultSource: "account", scope: "self",
    schema: z.object({ accountId: z.string().min(1) }).strict(),
  },
  "ACCOUNT_UPDATED@1": {
    type: "ACCOUNT_UPDATED", version: 1, defaultSource: "account", scope: "self",
    schema: z.object({ accountId: z.string().min(1), changedFields: CHANGED_FIELDS }).strict(),
  },
  "CLIENT_CREATED@1": {
    type: "CLIENT_CREATED", version: 1, defaultSource: "agency", scope: "agency",
    schema: z.object({ clientId: z.string().min(1) }).strict(),
  },
  "CLIENT_UPDATED@1": {
    type: "CLIENT_UPDATED", version: 1, defaultSource: "agency", scope: "agency",
    schema: z.object({ clientId: z.string().min(1), changedFields: CHANGED_FIELDS }).strict(),
  },
  // Progression facts are SERVER-AUTHORITATIVE (VECTOR-XP: XP can never be awarded
  // from a browser-supplied amount). Scope tightened self -> platform in Sprint 10 when
  // the Operator Reputation service became their emitting owner: only a trusted/admin
  // identity may publish them (zero producers existed, so tightening breaks nothing).
  // ⚠️ DEPRECATED (Sprint 10 Phase 6): ARENA_POINTS_CHANGED@1 is superseded by
  // OPERATOR_XP_CHANGED@1, and ACHIEVEMENT_UNLOCKED@1 (badges, never emitted) has no
  // reputation producer. Both are RETAINED (never removed) so replay of any historical
  // row keeps validating; Reputation no longer emits either.
  "ACHIEVEMENT_UNLOCKED@1": {
    type: "ACHIEVEMENT_UNLOCKED", version: 1, defaultSource: "arena", scope: "platform",
    schema: z.object({ achievementId: z.string().min(1) }).strict(),
  },
  "ARENA_POINTS_CHANGED@1": {
    type: "ARENA_POINTS_CHANGED", version: 1, defaultSource: "arena", scope: "platform",
    // Refs-only: signed delta, running total, and the arena CLASS id (not free text).
    schema: z.object({ xpDelta: z.number().int(), totalXp: z.number().int().nonnegative(), classId: z.string().min(1).max(8) }).strict(),
  },
  "MISSION_COMPLETED@1": {
    type: "MISSION_COMPLETED", version: 1, defaultSource: "missions", scope: "self",
    schema: z.object({ missionId: z.string().min(1) }).strict(),
  },
  "NOTIFICATION_CREATED@1": {
    type: "NOTIFICATION_CREATED", version: 1, defaultSource: "notify", scope: "platform", requiredPermission: "notify:plan",
    // Feeds the EXISTING notify path (buildNotificationPlan). recipientUserId is an
    // opaque id, never an email address; dedupeEvent is the stable logical event id.
    schema: z.object({
      channel: z.enum(["email", "push"]),
      purpose: z.string().min(1).max(60),
      recipientUserId: z.string().min(1),
      commercial: z.boolean(),
      dedupeEvent: z.string().min(1).max(120),
    }).strict(),
  },
  "SYSTEM_EVENT@1": {
    type: "SYSTEM_EVENT", version: 1, defaultSource: "system", scope: "platform",
    // Operational only (admin/system). `detail` is a short bounded, PII-free note.
    schema: z.object({ kind: z.string().min(1).max(60), detail: z.string().max(200).optional() }).strict(),
  },
  "KAI_INSIGHT_CREATED@1": {
    type: "KAI_INSIGHT_CREATED", version: 1, defaultSource: "kai", scope: "platform",
    // Ref-only: the insight id + optional subject ref — never the insight TEXT.
    schema: z.object({ insightId: z.string().min(1), subjectRef: z.string().min(1).max(120).optional() }).strict(),
  },

  // ── Operator Identity (Sprint 9) ───────────────────────────────────────────
  // Security/Audit events (permanent audit, refs-only, no external delivery — ADR-0036
  // §5). defaultSource "identity"; scope "platform" (the identity service is platform
  // infrastructure and records under a trusted systemIdentity). Payloads are ids +
  // enums only — the lifecycle `reason` lives on OperatorIdentity.stateReason, never
  // here (the PII guard rejects a "reason" KEY). Enum literals are inlined (not imported
  // from lib/identity) to keep the bus free of a dependency cycle; identity-events.test.ts
  // asserts they stay in lockstep with the schema enums.
  "OPERATOR_REGISTERED@1": {
    type: "OPERATOR_REGISTERED", version: 1, defaultSource: "identity", scope: "platform",
    schema: z.object({ operatorId: z.string().min(1), accountId: z.string().min(1) }).strict(),
  },
  "OPERATOR_STATE_CHANGED@1": {
    type: "OPERATOR_STATE_CHANGED", version: 1, defaultSource: "identity", scope: "platform",
    schema: z.object({
      operatorId: z.string().min(1),
      from: z.enum(["PENDING", "ACTIVE", "SUSPENDED", "DEACTIVATED"]),
      to: z.enum(["PENDING", "ACTIVE", "SUSPENDED", "DEACTIVATED"]),
    }).strict(),
  },
  "ORGANIZATION_CREATED@1": {
    type: "ORGANIZATION_CREATED", version: 1, defaultSource: "identity", scope: "platform",
    schema: z.object({ organizationId: z.string().min(1), ownerAccountId: z.string().min(1), kind: z.enum(["AGENCY", "ENTERPRISE", "EDUCATOR", "VENDOR", "INTERNAL"]) }).strict(),
  },
  "MEMBERSHIP_ADDED@1": {
    type: "MEMBERSHIP_ADDED", version: 1, defaultSource: "identity", scope: "platform",
    schema: z.object({ organizationId: z.string().min(1), operatorId: z.string().min(1), role: z.enum(["OWNER", "ADMIN", "MEMBER"]) }).strict(),
  },
  "MEMBERSHIP_ROLE_CHANGED@1": {
    type: "MEMBERSHIP_ROLE_CHANGED", version: 1, defaultSource: "identity", scope: "platform",
    schema: z.object({
      organizationId: z.string().min(1), operatorId: z.string().min(1),
      from: z.enum(["OWNER", "ADMIN", "MEMBER"]), to: z.enum(["OWNER", "ADMIN", "MEMBER"]),
    }).strict(),
  },
  "MEMBERSHIP_REMOVED@1": {
    type: "MEMBERSHIP_REMOVED", version: 1, defaultSource: "identity", scope: "platform",
    schema: z.object({ organizationId: z.string().min(1), operatorId: z.string().min(1) }).strict(),
  },

  // ── Operator Reputation (Sprint 10) ────────────────────────────────────────
  // Progression facts recorded by lib/reputation (refs-only: ids, bounded rank names,
  // integers). XP grants reuse ARENA_POINTS_CHANGED@1; badges reuse
  // ACHIEVEMENT_UNLOCKED@1 — the reputation service is now their emitting owner
  // (Arena consumes projections; it emits nothing). Source "reputation".
  "OPERATOR_RANK_CHANGED@1": {
    type: "OPERATOR_RANK_CHANGED", version: 1, defaultSource: "reputation", scope: "platform",
    // Bounded rank identifiers from the shipped ladder (recruit/contender/…) — not free text.
    schema: z.object({ operatorId: z.string().min(1), from: z.string().min(1).max(20), to: z.string().min(1).max(20) }).strict(),
  },
  "MILESTONE_REACHED@1": {
    type: "MILESTONE_REACHED", version: 1, defaultSource: "reputation", scope: "platform",
    schema: z.object({ operatorId: z.string().min(1), milestoneKey: z.string().min(3).max(60) }).strict(),
  },

  // ── Canonical Reputation-domain facts (Sprint 10 Phase 6) ───────────────────
  // OPERATOR_XP_CHANGED is the canonical XP-grant fact (the award-recorded and
  // xp-changed events are ONE fact — emitting both would double-count downstream).
  // It SUPERSEDES ARENA_POINTS_CHANGED@1 (retained above, deprecated, replay-only —
  // Reputation no longer emits it). REPUTATION_AWARD_REVERSED is the dedicated
  // compensating-record fact (a reversal is not a grant). Refs-only; source "reputation".
  "OPERATOR_XP_CHANGED@1": {
    type: "OPERATOR_XP_CHANGED", version: 1, defaultSource: "reputation", scope: "platform",
    schema: z.object({
      operatorId: z.string().min(1), awardId: z.string().min(1),
      xpDelta: z.number().int(), totalXp: z.number().int().nonnegative(), classId: z.string().min(1).max(8),
    }).strict(),
  },
  "REPUTATION_AWARD_REVERSED@1": {
    type: "REPUTATION_AWARD_REVERSED", version: 1, defaultSource: "reputation", scope: "platform",
    schema: z.object({
      operatorId: z.string().min(1), reversalId: z.string().min(1), reversedAwardId: z.string().min(1),
      xpDelta: z.number().int(), totalXp: z.number().int().nonnegative(),
    }).strict(),
  },
};

export function contractKey(type: string, version: number): string {
  return `${type}@${version}`;
}

// The current version for a type (the highest registered). Publishers default to this.
export function currentVersion(type: EventType): number {
  const versions = Object.values(CONTRACTS).filter((c) => c.type === type).map((c) => c.version);
  return versions.length ? Math.max(...versions) : 0;
}

export function getContract(type: string, version: number): EventContract | null {
  return CONTRACTS[contractKey(type, version)] ?? null;
}
