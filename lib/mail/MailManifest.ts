// The Mail Manifest — the record of one mailed item. Identity fields are set
// once at creation and NEVER change (enforced by the store); only progress
// fields (status, milestone timestamps, tracking number) advance, and the audit
// trail is append-only (enforced at the store boundary). Together with MailAudit
// this is the durable entry in the customer's Case Timeline — a process record
// of what was mailed and when, never a claim about a dispute's outcome.
import type { MailProviderId, MailClass, MailAddress } from "./MailProvider";
import type { MailStatus } from "./MailStatus";
import type { AuditEntry } from "./MailAudit";
import { appendAudit } from "./MailAudit";
import type { PriceBreakdown } from "./MailPricing";

// Immutable identity — assigned at creation, never rewritten.
export interface MailIdentity {
  mailId: string;                 // CreditVector's own id (idempotency key)
  provider: MailProviderId;
  letterId: string;
  userId: string;
  disputeId: string | null;       // the dispute this mailing belongs to
  tradelineId: string | null;
  recipient: MailAddress;
  // The exact print spec the customer was priced on — persisted so the piece
  // dispatched to the provider always matches what was estimated and paid for.
  mailClass: MailClass;
  certified: boolean;
  pages: number;
  color: boolean;
  doubleSided: boolean;
  cost: PriceBreakdown;           // the price the customer agreed to
  createdAt: string;              // ISO
}

// Progress — advances forward only, driven by MailService transitions.
export interface MailProgress {
  status: MailStatus;
  providerJobId: string | null;
  trackingNumber: string | null;
  printedAt: string | null;
  carrierAcceptedAt: string | null;
  deliveredAt: string | null;
  responseReceivedAt: string | null;
  closedAt: string | null;
}

export interface MailManifest extends MailIdentity, MailProgress {
  auditTrail: AuditEntry[];
}

// Build a fresh manifest at APPROVED→creation time. The first audit entry records
// the birth of the record.
export function createManifest(
  identity: MailIdentity,
  initialStatus: MailStatus,
  at: string,
): MailManifest {
  return {
    ...identity,
    status: initialStatus,
    providerJobId: null,
    trackingNumber: null,
    printedAt: null,
    carrierAcceptedAt: null,
    deliveredAt: null,
    responseReceivedAt: null,
    closedAt: null,
    auditTrail: appendAudit([], {
      at, actor: "system", event: "manifest.created", toStatus: initialStatus,
      detail: `Mail piece created for letter ${identity.letterId}`,
    }),
  };
}

// The fields a transition is allowed to touch. Identity fields are intentionally
// absent — the store rejects any attempt to change them.
export type ProgressPatch = Partial<Omit<MailProgress, "status">> & { status?: MailStatus };

// Which milestone timestamp (if any) a status implies. Keeps the transition
// logic honest — reaching DELIVERED stamps deliveredAt, etc.
export function milestoneField(status: MailStatus): keyof MailProgress | null {
  switch (status) {
    case "PRINTED": return "printedAt";
    case "CARRIER_ACCEPTED": return "carrierAcceptedAt";
    case "DELIVERED": return "deliveredAt";
    case "RESPONSE_RECEIVED": return "responseReceivedAt";
    case "CLOSED": return "closedAt";
    default: return null;
  }
}
