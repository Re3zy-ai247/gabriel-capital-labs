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
    blurb: "For items that appear to sit beyond their FCRA §605 reporting window — disputed to ask the bureau to verify the reporting period and remove the item as obsolete if it can't be substantiated.",
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

// ── RC1-S11 · NON-TRADELINE STRATEGIES ───────────────────────────────────────
//
// Every entry in STRATEGIES above disputes a TRADELINE. The Personal
// Information correction letter (app/api/identity/letter/route.ts) does not: it
// disputes the consumer's own name, addresses and employers — items in the file
// that hang off no account.
//
// It is kept OUT of STRATEGIES on purpose. That array drives the dispute
// chooser (/api/strategies → app/letters/page.tsx), Kai's strategy catalogue
// (lib/kai.ts), the strategist's prompt catalogue and the alternatives list in
// lib/recommendationIntel.ts. Offering "Personal Information Correction" as a
// way to dispute a charge-off would be wrong in all four places.
//
// It IS registered in STRATEGY_BY_ID below, so the id RESOLVES everywhere a
// stored letter's strategy is looked up (lib/mailCenter.ts's package basis, the
// letters list). Before this entry existed the identity letter recorded an id
// that was in no registry at all: `personal_info` resolved to nothing, and the
// L-09 remediation papered over that by recording `fcra_611` instead — which
// mislabelled an identity correction as a tradeline reinvestigation AND erased
// the only thing distinguishing the two populations of letters that carry no
// tradelineId (an identity letter, and a tradeline letter whose report was
// later deleted). A real, distinct, registered id fixes the label and restores
// the discriminator in one move.
//
// STATUTES: §611 and §607(b) genuinely reach identifying information —
// §1681i(a)(1)(A) covers "any item of information contained in a consumer's
// file", and §1681e(b) requires reasonable procedures for maximum possible
// accuracy of everything reported. No §605B identity-theft block is claimed
// (that needs an identity-theft report the consumer has not filed), and no
// outcome is promised.
export const NON_TRADELINE_STRATEGIES: Strategy[] = [
  {
    id: "personal_info",
    tier: 1,
    label: "Personal Information Correction",
    recipient: "bureau",
    statutes: ["fcra_611", "fcra_607b"],
    blurb:
      "Asks a bureau to correct or remove inaccurate personal details on your file — names, addresses and employers you have confirmed are wrong. It disputes no account.",
  },
];

/** True for a strategy that disputes something OTHER than a tradeline. Such a
 *  letter legitimately carries no tradelineId, so a tradeline-confirmation rule
 *  has nothing to say about it. */
export function isNonTradelineStrategy(id: string | null | undefined): boolean {
  return typeof id === "string" && NON_TRADELINE_STRATEGIES.some((s) => s.id === id);
}

// Lookup covers BOTH sets: a stored letter's strategy must always resolve to a
// real label, whichever kind of letter it is (including rows written before
// this entry existed — production identity letters already carry
// `personal_info`, and they resolve here now instead of falling back).
export const STRATEGY_BY_ID = Object.fromEntries(
  [...STRATEGIES, ...NON_TRADELINE_STRATEGIES].map((s) => [s.id, s])
);
