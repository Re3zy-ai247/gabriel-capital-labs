import { AccountType, Probability } from "@prisma/client";
import { type BureauData, crossBureauConflicts, hasCrossBureauKnowledge } from "./bureauData";
import { obsolescenceWindowYears, bureauTextBlob } from "./obsolescence";
import { yearsSince } from "./utils";

export interface ScoreInput {
  accountType: AccountType;
  isDebtBuyer: boolean;
  balanceCents: number;
  dateOfFirstDelinquency?: Date | string | null;
  bureauData: BureauData;
  nonStrategic: boolean;
  creditorName?: string | null;
}

export interface ScoreResult {
  score: number;
  probability: Probability;
  reasons: string[];
  disputeAngles: string[];
}

const BANDS = { HIGH: 60, MEDIUM: 35 };

// Weighted scoring that does NOT depend solely on cross-bureau conflict data, so
// genuinely strong dispute targets surface even from a single-bureau report.
export function scoreTradeline(input: ScoreInput): ScoreResult {
  const reasons: string[] = [];
  const angles: string[] = [];

  if (input.nonStrategic || input.accountType === AccountType.GOVERNMENT) {
    return {
      score: 0,
      probability: Probability.NOT_RECOMMENDED,
      reasons: ["Government / statutory debt — generally cannot be disputed off a report and is excluded from the dispute queue."],
      disputeAngles: [],
    };
  }

  let score = 0;

  // Category impact
  if (input.accountType === AccountType.COLLECTION) {
    score += input.isDebtBuyer ? 38 : 28;
    reasons.push(input.isDebtBuyer ? "Third-party debt-buyer collection — the buyer must be able to validate the debt it purchased, including the chain of assignment." : "Collection account.");
    if (input.isDebtBuyer) angles.push("Demand validation of the chain of assignment from the original creditor.");
  } else if (input.accountType === AccountType.CHARGE_OFF) {
    score += 30;
    reasons.push("Charge-off — frequently carries reporting inconsistencies.");
  } else if (input.accountType === AccountType.STUDENT_LOAN) {
    score += 18;
    reasons.push("Student loan tradeline.");
  } else if (input.accountType === AccountType.REVOLVING || input.accountType === AccountType.INSTALLMENT) {
    score += 12;
    reasons.push("Original-creditor account — accuracy of status/dates is disputable, deletion less likely.");
  } else {
    score += 8;
  }

  // $0-balance closed collection — low downside, often stale
  if (input.accountType === AccountType.COLLECTION && input.balanceCents === 0) {
    score += 8;
    angles.push("Zero-balance collection still reporting — challenge ongoing accuracy/relevance.");
  }

  // Age vs the FCRA §605 reporting window — 7 years for most items, 10 for a
  // Chapter 7/11 (or dismissed Chapter 13) bankruptcy public record.
  const windowYears = obsolescenceWindowYears({
    accountType: input.accountType,
    creditorName: input.creditorName,
    text: bureauTextBlob(input.bureauData),
  });
  const yrs = yearsSince(input.dateOfFirstDelinquency);
  if (yrs != null) {
    if (yrs >= windowYears) {
      score += 30;
      reasons.push(`Past the ${windowYears}-year FCRA reporting window — strong obsolescence argument (§605).`);
      angles.push("Dispute as obsolete under FCRA §605.");
    } else if (yrs >= windowYears - 1) {
      score += 10;
      reasons.push(`Approaching the ${windowYears}-year window.`);
    }
  }

  // Cross-bureau conflicts only when we truly know about 2+ bureaus
  if (hasCrossBureauKnowledge(input.bureauData)) {
    const conflicts = crossBureauConflicts(input.bureauData);
    if (conflicts.length) {
      score += Math.min(20, conflicts.length * 8);
      reasons.push(`${conflicts.length} verifiable cross-bureau inconsistency(ies).`);
      angles.push(...conflicts);
    }
  } else {
    reasons.push("Single-bureau data — dispute focuses on this bureau's internal accuracy (no cross-bureau claims).");
  }

  score = Math.max(0, Math.min(100, score));
  const probability =
    score >= BANDS.HIGH ? Probability.HIGH : score >= BANDS.MEDIUM ? Probability.MEDIUM : Probability.LOW;

  return { score, probability, reasons, disputeAngles: angles };
}

// Rough estimated score impact (educational only).
export function estimatedPointImpact(accountType: AccountType, probability: Probability): number {
  const base: Record<string, number> = {
    COLLECTION: 25, CHARGE_OFF: 30, PUBLIC_RECORD: 35, STUDENT_LOAN: 15, REVOLVING: 12, INSTALLMENT: 12,
  };
  const mult = probability === "HIGH" ? 1 : probability === "MEDIUM" ? 0.6 : 0.35;
  return Math.round((base[accountType] ?? 8) * mult);
}
