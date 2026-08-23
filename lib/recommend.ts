import { AccountType, Probability } from "@prisma/client";
import { getBureauData, crossBureauConflicts } from "./bureauData";
import { obsolescenceWindowYears, bureauTextBlob, reportingOffsetDays } from "./obsolescence";
import { yearsSince } from "./utils";
import { type ConsumerAssertionType } from "./letter";

export interface RecommendInput {
  accountType: AccountType;
  isDebtBuyer: boolean;
  probability: Probability;
  dateOfFirstDelinquency?: Date | string | null;
  bureauData: unknown;
  creditorName?: string | null;
}

export interface Recommendation {
  strategyId: string | null; // null = not recommended for dispute
  reason: string;
  // RC1-S4: which facts are WORTH THE CONSUMER CHECKING on this item, ordered
  // most-likely-relevant first. A SUGGESTION and nothing more — it pre-selects
  // nothing, writes no ConsumerAssertion row, and never reaches a letter. Only
  // the consumer's own confirmation (POST /api/tradelines/[id]/assertion) does
  // that. See suggestAssertionTypes below.
  suggestedAssertions: ConsumerAssertionType[];
}

// The facts most worth a second look for this KIND of item — derived from the
// account type and the report's own data, never from anything the consumer said.
//
// THE BOUNDARY THIS MUST NOT CROSS. Everything here is a prompt to look, phrased
// in the product's voice; the moment one of these becomes a claim it has to be
// the consumer making it. A collection is worth checking for ownership because
// debt buyers routinely report accounts to the wrong person — NOT because we
// have any reason to think this particular account is not theirs. So this
// function's output only ever ORDERS the choices the consumer is offered.
export function suggestAssertionTypes(t: RecommendInput): ConsumerAssertionType[] {
  const out: ConsumerAssertionType[] = [];
  const push = (x: ConsumerAssertionType) => {
    if (!out.includes(x)) out.push(x);
  };

  // REMEDIATION M-3: an INQUIRY is a record that someone LOOKED at the file. It
  // has no balance, no status, no payment history and no first-delinquency date,
  // so the generic tail below would have steered the consumer toward three
  // claims that cannot be true of it. Returns EARLY: the inquiry vocabulary is
  // the whole list for an inquiry.
  if (t.accountType === AccountType.INQUIRY) return ["inquiry_not_authorized"];

  if (t.accountType === AccountType.COLLECTION) {
    // A collection reaches the consumer through at least one transfer, and a
    // debt buyer's file is the most common place an account is attributed to
    // the wrong person or carries a balance nobody can itemize.
    push("not_mine");
    push("inaccurate_balance");
  }
  if (t.accountType === AccountType.CHARGE_OFF) {
    push("inaccurate_status");
    push("inaccurate_balance");
  }
  if (t.accountType === AccountType.PUBLIC_RECORD) {
    push("not_mine");
    push("inaccurate_status");
  }
  // Where the bureaus disagree, at least one of them is reporting something the
  // consumer can recognize as wrong — status and balance are the two fields
  // crossBureauConflicts actually compares.
  if (crossBureauConflicts(getBureauData(t.bureauData)).length > 0) {
    push("inaccurate_status");
    push("inaccurate_balance");
  }
  // A first-delinquency date on file is the field the §605 clock runs from, so
  // it is worth the consumer checking the dates against their own records.
  if (t.dateOfFirstDelinquency) push("late_dates_wrong");

  push("inaccurate_status");
  push("inaccurate_balance");
  push("late_dates_wrong");
  return out.slice(0, 4);
}

// Picks the best opening dispute strategy for an account, and explains why. This
// drives the auto-selection + guidance in the letter builder so users aren't left
// guessing which letter to send.
export function recommendStrategy(t: RecommendInput): Recommendation {
  if (t.probability === Probability.NOT_RECOMMENDED || t.accountType === AccountType.GOVERNMENT) {
    return {
      strategyId: null,
      reason:
        "Government/statutory debt — generally cannot be disputed off a report. Disputing it is ineffective and can hurt credibility.",
      // Nothing to suggest: this item is excluded from the dispute path for a
      // legal reason, and offering fact choices here would imply otherwise.
      suggestedAssertions: [],
    };
  }

  // Computed once: the same suggestion list rides on every recommendation this
  // function can return, because it describes the ITEM, not the strategy.
  const suggestedAssertions = suggestAssertionTypes(t);

  // Obsolete items first — if it's past its §605 window, removal is the cleanest
  // play. A Chapter 7/11 bankruptcy public record reports for 10 years, not 7, so
  // we never recommend an obsolescence dispute on a bankruptcy until year 10.
  const windowYears = obsolescenceWindowYears({
    accountType: t.accountType,
    creditorName: t.creditorName,
    text: bureauTextBlob(getBureauData(t.bureauData)),
  });
  const age = (t.dateOfFirstDelinquency ? yearsSince(t.dateOfFirstDelinquency) : 0) ?? 0;
  // §1681c(c)(1): collection/charge-off reporting starts 180 days after DOFD.
  const windowYrs = windowYears + reportingOffsetDays(t.accountType) / 365.25;
  if (age >= windowYrs) {
    return {
      strategyId: "fcra_605",
      reason: `This item's first delinquency is about ${Math.floor(age)} years old. Under FCRA §605 the reporting period for this item is ${windowYears} years — because it appears to sit beyond that window, ask the bureau to verify the reporting period and remove it as obsolete if it can't be substantiated.`,
      suggestedAssertions,
    };
  }

  // Third-party collections: make them prove the debt first.
  if (t.accountType === AccountType.COLLECTION) {
    if (t.isDebtBuyer) {
      return {
        strategyId: "validation",
        reason:
          "Third-party debt-buyer collection. Start with Debt Validation (FDCPA §809) — demand the chain of assignment and account-level proof before anything else. Debt buyers frequently can't produce it.",
        suggestedAssertions,
      };
    }
    return {
      strategyId: "validation",
      reason:
        "Collection account. Start with Debt Validation (FDCPA §809) — require the collector to validate the debt and pause collection until they do.",
      suggestedAssertions,
    };
  }

  // Genuine cross-bureau inconsistencies → lead with the inconsistency.
  const conflicts = crossBureauConflicts(getBureauData(t.bureauData));
  if (conflicts.length > 0) {
    return {
      strategyId: "metro2",
      reason:
        "The bureaus report this account inconsistently (balance/status/date mismatch). Lead with the inconsistency under FCRA §611 — inconsistent data cannot all be accurate.",
      suggestedAssertions,
    };
  }

  if (t.accountType === AccountType.CHARGE_OFF) {
    return {
      strategyId: "fcra_611",
      reason:
        "Charge-off. Dispute the accuracy of the status, balance, and dates under FCRA §611 — charge-offs frequently carry reporting errors.",
      suggestedAssertions,
    };
  }

  return {
    strategyId: "fcra_611",
    reason:
      "Original-creditor account. The strongest angle is the accuracy of the reported status and dates under FCRA §611.",
    suggestedAssertions,
  };
}
