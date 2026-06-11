import type { StatuteKey } from "./statutes";

export type RecipientType = "bureau" | "furnisher" | "collector";

export interface Strategy {
  id: string;
  tier: number;
  label: string;
  recipient: RecipientType;
  statutes: StatuteKey[];
  blurb: string;
  // Risk note surfaced in the UI for strategies that carry consumer risk.
  riskNote?: string;
}

// The 12 dispute strategies. Note the §609 label pairs it with §611 so the app
// never perpetuates the "609 letter forces deletion" myth.
export const STRATEGIES: Strategy[] = [
  {
    id: "fcra_611",
    tier: 1,
    label: "FCRA §611 — Bureau Reinvestigation",
    recipient: "bureau",
    statutes: ["fcra_611", "fcra_607b"],
    blurb: "The primary dispute. Demands a reasonable reinvestigation and deletion of anything that can't be verified.",
  },
  {
    id: "fcra_609",
    tier: 1,
    label: "FCRA §609/§611 — File Disclosure & Dispute",
    recipient: "bureau",
    statutes: ["fcra_609", "fcra_611"],
    blurb: "Requests the file disclosure under §609 and disputes inaccuracies under §611. §609 alone does not compel deletion.",
  },
  {
    id: "validation",
    tier: 1,
    label: "Debt Validation (Collections)",
    recipient: "collector",
    statutes: ["fdcpa_809"],
    blurb: "Forces a collector to validate the debt before continuing collection. Most effective within 30 days of first contact.",
  },
  {
    id: "metro2",
    tier: 2,
    label: "FCRA + Metro 2 Inconsistency",
    recipient: "bureau",
    statutes: ["fcra_611", "fcra_607b"],
    blurb: "Challenges internal data inconsistencies. Note: Metro 2 is a formatting standard, not the legal basis — the FCRA is.",
  },
  {
    id: "fcra_605",
    tier: 2,
    label: "FCRA §605 — Obsolete Item",
    recipient: "bureau",
    statutes: ["fcra_605"],
    blurb: "For items beyond the 7-year reporting window that must be removed as obsolete.",
  },
  {
    id: "fcra_623",
    tier: 3,
    label: "FCRA §623 — Direct Furnisher Dispute",
    recipient: "furnisher",
    statutes: ["fcra_623", "fcra_611"],
    blurb: "Disputes directly with the data furnisher, who must conduct its own investigation.",
  },
  {
    id: "fdcpa",
    tier: 3,
    label: "FDCPA + FCRA — Collection Agency",
    recipient: "collector",
    statutes: ["fdcpa_809", "fcra_623"],
    blurb: "Combined validation + furnisher-accuracy demand aimed at a third-party collection agency.",
  },
  {
    id: "escalation",
    tier: 4,
    label: "Escalation — Round 2 Demand",
    recipient: "bureau",
    statutes: ["fcra_611", "fcra_607b"],
    blurb: "Follow-up after a 'verified' result, demanding the method of verification used.",
  },
  {
    id: "goodwill",
    tier: 4,
    label: "Goodwill Adjustment",
    recipient: "furnisher",
    statutes: [],
    blurb: "A courtesy request to a creditor to remove an accurate late payment. Not a legal demand — relies on goodwill.",
  },
  {
    id: "pay_delete",
    tier: 4,
    label: "Pay-for-Delete Offer",
    recipient: "collector",
    statutes: ["fdcpa_809"],
    blurb: "Offers payment in exchange for deletion.",
    riskNote:
      "Many furnishers' data-furnishing agreements with the bureaus prohibit honoring pay-for-delete. Get any agreement in writing before paying.",
  },
  {
    id: "cease_desist",
    tier: 4,
    label: "Cease & Desist",
    recipient: "collector",
    statutes: ["fdcpa_805c"],
    blurb: "Directs a collector to stop contacting you.",
    riskNote:
      "A cease-and-desist on an active, valid debt can prompt the collector to escalate to a lawsuit instead of calling. Use deliberately.",
  },
  {
    id: "cfpb_threat",
    tier: 5,
    label: "Final Notice — CFPB / State AG Complaint",
    recipient: "bureau",
    statutes: ["fcra_611", "fcra_607b"],
    blurb: "A final demand noting intent to file complaints with the CFPB and state Attorney General if unresolved.",
  },
];

export const STRATEGY_BY_ID = Object.fromEntries(STRATEGIES.map((s) => [s.id, s]));
