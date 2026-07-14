// CreditVector Mail — the canonical, provider-agnostic mail lifecycle.
//
// Every mailed document moves through ONE state machine, regardless of which
// provider (LetterStream, Lob, PostGrid, …) physically prints and mails it.
// Providers map their own status strings INTO these canonical stages inside
// their own implementation — this enum is the only status vocabulary the rest of
// the platform (Kai, timeline, manifest, audit) ever sees.

export type MailStatus =
  | "GENERATED"          // letter body exists (from the dispute flow)
  | "IN_REVIEW"          // presented to the user for approval
  | "APPROVED"           // user approved sending (Kai recommends, user approves)
  | "PAID"               // payment captured for this mail job
  | "QUEUED"             // accepted by MailService, awaiting dispatch to a provider
  | "PDF_GENERATED"      // print-ready PDF produced
  | "PROVIDER_ACCEPTED"  // provider accepted the job (has a provider job id)
  | "PRINTED"            // physically printed by the provider
  | "CARRIER_ACCEPTED"   // handed to the postal carrier (USPS or other)
  | "IN_TRANSIT"         // moving through the mail stream
  | "DELIVERED"          // delivered to the recipient
  | "RESPONSE_RECEIVED"  // a response to this mailing was logged
  | "CLOSED"             // lifecycle complete
  | "CANCELED"           // canceled before it entered the physical mail stream
  | "FAILED"             // a step failed (payment, PDF, provider, …)
  | "RETURNED";          // USPS returned it to sender

// The happy-path order, used for display and for "is this forward progress?".
export const MAIL_PIPELINE: MailStatus[] = [
  "GENERATED", "IN_REVIEW", "APPROVED", "PAID", "QUEUED", "PDF_GENERATED",
  "PROVIDER_ACCEPTED", "PRINTED", "CARRIER_ACCEPTED", "IN_TRANSIT", "DELIVERED",
  "RESPONSE_RECEIVED", "CLOSED",
];

export const TERMINAL_STATUSES: ReadonlySet<MailStatus> = new Set<MailStatus>([
  "CLOSED", "CANCELED", "FAILED", "RETURNED",
]);

// Allowed transitions. Forward-only along the pipeline, plus the side exits.
// A job may FAIL from any active stage; it may be CANCELED only before it is
// physically in the mail stream (up to PROVIDER_ACCEPTED — after that the
// provider owns the paper). RETURNED comes from the delivery leg. DELIVERED may
// close directly (no response logged) or wait for RESPONSE_RECEIVED.
const CANCELABLE: MailStatus[] = ["GENERATED", "IN_REVIEW", "APPROVED", "PAID", "QUEUED", "PDF_GENERATED", "PROVIDER_ACCEPTED"];

const FORWARD: Record<MailStatus, MailStatus[]> = {
  GENERATED: ["IN_REVIEW", "APPROVED"],
  IN_REVIEW: ["APPROVED"],
  APPROVED: ["PAID"],
  PAID: ["QUEUED"],
  QUEUED: ["PDF_GENERATED"],
  PDF_GENERATED: ["PROVIDER_ACCEPTED"],
  PROVIDER_ACCEPTED: ["PRINTED"],
  PRINTED: ["CARRIER_ACCEPTED"],
  CARRIER_ACCEPTED: ["IN_TRANSIT"],
  IN_TRANSIT: ["DELIVERED", "RETURNED"],
  DELIVERED: ["RESPONSE_RECEIVED", "CLOSED", "RETURNED"],
  RESPONSE_RECEIVED: ["CLOSED"],
  CLOSED: [],
  CANCELED: [],
  FAILED: [],
  RETURNED: [],
};

export function nextStatuses(from: MailStatus): MailStatus[] {
  const out = new Set<MailStatus>(FORWARD[from]);
  if (!TERMINAL_STATUSES.has(from)) out.add("FAILED");
  if (CANCELABLE.includes(from)) out.add("CANCELED");
  out.delete(from);
  return [...out];
}

export function canTransition(from: MailStatus, to: MailStatus): boolean {
  return nextStatuses(from).includes(to);
}

export function isTerminal(status: MailStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

// Position on the happy path (−1 for side/terminal states not on the pipeline),
// so the UI can render "step N of M" without knowing provider specifics.
export function pipelineIndex(status: MailStatus): number {
  return MAIL_PIPELINE.indexOf(status);
}

// Human, outcome-neutral labels (no promises — "Delivered" is a fact; nothing
// here implies a dispute result).
export const MAIL_STATUS_LABEL: Record<MailStatus, string> = {
  GENERATED: "Letter ready",
  IN_REVIEW: "Awaiting your approval",
  APPROVED: "Approved",
  PAID: "Paid",
  QUEUED: "Queued to send",
  PDF_GENERATED: "Print file prepared",
  PROVIDER_ACCEPTED: "Accepted by mail provider",
  PRINTED: "Printed",
  CARRIER_ACCEPTED: "Accepted by postal carrier",
  IN_TRANSIT: "In transit",
  DELIVERED: "Delivered",
  RESPONSE_RECEIVED: "Response received",
  CLOSED: "Closed",
  CANCELED: "Canceled",
  FAILED: "Needs attention",
  RETURNED: "Returned to sender",
};
