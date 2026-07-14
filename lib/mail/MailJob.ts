// Pure job-transition logic. Given a manifest and a target status, produce the
// NEXT manifest (status advanced, milestone timestamp stamped, audit appended)
// plus the KaiEvent that transition should emit — or a typed error if the
// transition is illegal. No I/O: MailService owns persistence + event emission
// and calls this to compute what should happen.
import type { MailManifest } from "./MailManifest";
import { milestoneField } from "./MailManifest";
import { appendAudit, type AuditActor } from "./MailAudit";
import { canTransition, isTerminal, type MailStatus } from "./MailStatus";

export interface TransitionInput {
  to: MailStatus;
  at: string;                 // ISO (caller supplies — deterministic + testable)
  actor: AuditActor;
  event: string;              // audit verb, e.g. "provider.accepted"
  detail?: string;
  providerJobId?: string;
  trackingNumber?: string;
}

// A description of the KaiEvent MailService should record. Kept as data so the
// transition stays pure (MailService does the fail-open write).
export interface MailKaiEvent {
  userId: string;
  type: "mail.status";
  refType: "mail";
  refId: string;              // mailId
  payload: {
    mailId: string;
    status: MailStatus;
    provider: string;
    letterId: string;
    tradelineId: string | null;
    disputeId: string | null;
  };
}

export type TransitionResult =
  | { ok: true; manifest: MailManifest; kaiEvent: MailKaiEvent }
  | { ok: false; error: string };

export function applyTransition(m: MailManifest, input: TransitionInput): TransitionResult {
  if (m.status === input.to) {
    return { ok: false, error: `already ${input.to}` };
  }
  if (isTerminal(m.status)) {
    return { ok: false, error: `${m.status} is terminal — no further transitions` };
  }
  if (!canTransition(m.status, input.to)) {
    return { ok: false, error: `illegal transition ${m.status} → ${input.to}` };
  }

  const patch: Partial<MailManifest> = { status: input.to };
  if (input.providerJobId) patch.providerJobId = input.providerJobId;
  if (input.trackingNumber) patch.trackingNumber = input.trackingNumber;

  const field = milestoneField(input.to);
  if (field && (m[field] == null)) {
    // Only stamp a milestone once, and only if not already set.
    (patch as Record<string, unknown>)[field] = input.at;
  }

  const auditTrail = appendAudit(m.auditTrail, {
    at: input.at,
    actor: input.actor,
    event: input.event,
    fromStatus: m.status,
    toStatus: input.to,
    detail: input.detail,
    providerRef: input.providerJobId ?? input.trackingNumber,
  });

  const manifest: MailManifest = { ...m, ...patch, auditTrail };

  const kaiEvent: MailKaiEvent = {
    userId: m.userId,
    type: "mail.status",
    refType: "mail",
    refId: m.mailId,
    payload: {
      mailId: m.mailId,
      status: input.to,
      provider: m.provider,
      letterId: m.letterId,
      tradelineId: m.tradelineId,
      disputeId: m.disputeId,
    },
  };

  return { ok: true, manifest, kaiEvent };
}
