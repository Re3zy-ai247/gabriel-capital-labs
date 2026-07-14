// The customer-facing receipt for a paid mail job. Pure projection of the
// manifest + its agreed price into a line-item receipt. No I/O, no provider
// knowledge — the receipt reads the same regardless of who printed the mail.
import type { MailManifest } from "./MailManifest";
import { MAIL_STATUS_LABEL } from "./MailStatus";

export interface MailReceipt {
  receiptId: string;       // stable: derived from mailId
  mailId: string;
  letterId: string;
  provider: string;        // provider id, shown for transparency
  recipientName: string;
  mailClass: string;
  certified: boolean;
  lineItems: { label: string; cents: number }[];
  totalCents: number;
  currency: "USD";
  paidAt: string | null;   // when payment was captured (from the audit trail)
  status: string;          // human label
}

export function buildReceipt(m: MailManifest): MailReceipt {
  const paid = m.auditTrail.find((e) => e.toStatus === "PAID");
  return {
    receiptId: `rcpt_${m.mailId}`,
    mailId: m.mailId,
    letterId: m.letterId,
    provider: m.provider,
    recipientName: m.recipient.name,
    mailClass: m.mailClass,
    certified: m.certified,
    lineItems: m.cost.lines.map((l) => ({ label: l.label, cents: l.cents })),
    totalCents: m.cost.totalCents,
    currency: m.cost.currency,
    paidAt: paid?.at ?? null,
    status: MAIL_STATUS_LABEL[m.status],
  };
}
