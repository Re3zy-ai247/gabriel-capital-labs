import { AccountType, Probability } from "@prisma/client";
import { getBureauData, crossBureauConflicts } from "./bureauData";
import { obsolescenceWindowYears, bureauTextBlob } from "./obsolescence";
import { yearsSince } from "./utils";

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
    };
  }

  // Obsolete items first — if it's past its §605 window, removal is the cleanest
  // play. A Chapter 7/11 bankruptcy public record reports for 10 years, not 7, so
  // we never recommend an obsolescence dispute on a bankruptcy until year 10.
  const windowYears = obsolescenceWindowYears({
    accountType: t.accountType,
    creditorName: t.creditorName,
    text: bureauTextBlob(getBureauData(t.bureauData)),
  });
  const age = (t.dateOfFirstDelinquency ? yearsSince(t.dateOfFirstDelinquency) : 0) ?? 0;
  if (age >= windowYears) {
    return {
      strategyId: "fcra_605",
      reason: `This item's first delinquency is about ${Math.floor(age)} years old. Under FCRA §605 this item should drop off after ${windowYears} years — request removal as obsolete.`,
    };
  }

  // Third-party collections: make them prove the debt first.
  if (t.accountType === AccountType.COLLECTION) {
    if (t.isDebtBuyer) {
      return {
        strategyId: "validation",
        reason:
          "Third-party debt-buyer collection. Start with Debt Validation (FDCPA §809) — demand the chain of assignment and account-level proof before anything else. Debt buyers frequently can't produce it.",
      };
    }
    return {
      strategyId: "validation",
      reason:
        "Collection account. Start with Debt Validation (FDCPA §809) — require the collector to validate the debt and pause collection until they do.",
    };
  }

  // Genuine cross-bureau inconsistencies → lead with the inconsistency.
  const conflicts = crossBureauConflicts(getBureauData(t.bureauData));
  if (conflicts.length > 0) {
    return {
      strategyId: "metro2",
      reason:
        "The bureaus report this account inconsistently (balance/status/date mismatch). Lead with the inconsistency under FCRA §611 — inconsistent data cannot all be accurate.",
    };
  }

  if (t.accountType === AccountType.CHARGE_OFF) {
    return {
      strategyId: "fcra_611",
      reason:
        "Charge-off. Dispute the accuracy of the status, balance, and dates under FCRA §611 — charge-offs frequently carry reporting errors.",
    };
  }

  return {
    strategyId: "fcra_611",
    reason:
      "Original-creditor account. The strongest angle is the accuracy of the reported status and dates under FCRA §611.",
  };
}
