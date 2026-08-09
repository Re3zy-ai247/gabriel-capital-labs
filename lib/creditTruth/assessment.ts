import type { Bureau } from "@prisma/client";
import {
  validateConsumerAssertionBinding,
  type BoundConsumerAssertion,
  type ObservationBinding,
} from "./consumerAssertion";
import {
  CREDIT_BUREAUS,
  type BureauCreditTruth,
  type CreditTruthFieldName,
  type CreditTruthSection,
  type CreditTruthShadowAccount,
  type FieldObservation,
} from "./types";

export const CREDIT_ASSESSMENT_CONTRACT_VERSION = "credit-assessment-v1" as const;

export const ACCOUNT_CONDITIONS = ["CLEAN", "DEROGATORY", "MIXED", "NEEDS_REVIEW"] as const;
export type AccountCondition = (typeof ACCOUNT_CONDITIONS)[number];

export const DISPUTE_GROUNDS = [
  "STRONG",
  "MODERATE",
  "LIMITED",
  "NONE_DETECTED",
  "CONSUMER_REVIEW_REQUIRED",
] as const;
export type DisputeGrounds = (typeof DISPUTE_GROUNDS)[number];

export const REPORTED_ADVERSITY_VALUES = [
  "ADVERSE",
  "POTENTIALLY_ADVERSE",
  "NEUTRAL",
  "FAVORABLE",
  "UNKNOWN",
] as const;
export type ReportedAdversity = (typeof REPORTED_ADVERSITY_VALUES)[number];

export type AssessmentEvidenceCompleteness = "COMPLETE" | "INCOMPLETE" | "UNKNOWN";

export const CONDITION_REQUIRED_SECTIONS = [
  "ACCOUNT_INDEX",
  "ACCOUNT_SUMMARY",
  "ACCOUNT_DETAIL",
  "PAYMENT_HISTORY",
  "COLLECTIONS",
  "REMARKS",
] as const satisfies readonly CreditTruthSection[];

/**
 * Fields whose known presence or confirmed absence is necessary before CLEAN is
 * possible. Product type is intentionally excluded: it describes the account,
 * not its condition. Context-only fields cannot make an account derogatory.
 */
export const CONDITION_REQUIRED_FIELDS = [
  "summaryStatus",
  "detailedStatus",
  "balanceCents",
  "dofd",
  "relevantDates",
  "paymentHistory",
  "collectionFacts",
  "chargeOffMarker",
  "lossReported",
  "remarks",
] as const satisfies readonly CreditTruthFieldName[];

export type AssessmentRationaleCode =
  | "ACCOUNT_PRESENT"
  | "ACCOUNT_ABSENT_CONFIRMED"
  | "ACCOUNT_PRESENCE_UNKNOWN"
  | "NO_PRESENT_ACCOUNT_IN_SCOPE"
  | "REQUIRED_SECTION_UNKNOWN"
  | "REQUIRED_SECTION_INCOMPLETE"
  | "REQUIRED_SECTION_PROVENANCE_MISSING"
  | "REQUIRED_FIELD_UNKNOWN"
  | "REQUIRED_FIELD_PROVENANCE_MISSING"
  | "PARSER_CONTRACT_ERROR"
  | "SOURCE_CONFLICT"
  | "CURRENT_ADVERSE_OBSERVATION"
  | "HISTORICAL_ADVERSE_OBSERVATION"
  | "CURRENT_AFFIRMATIVE_NON_ADVERSE"
  | "CURRENT_NEUTRAL_OBSERVATION"
  | "CONTEXT_ONLY_HISTORY"
  | "COMPLETE_NON_ADVERSE_EVIDENCE"
  | "INSUFFICIENT_AFFIRMATIVE_EVIDENCE"
  | "COVERED_BUREAU_REQUIRES_REVIEW"
  | "CROSS_BUREAU_MIXED_CONDITION"
  | "CURRENT_CONSUMER_ASSERTION_BOUND"
  | "ASSERTION_SCOPE_MISMATCH"
  | "ASSERTION_RECONFIRMATION_REQUIRED"
  | "ASSERTION_NOT_DISPUTE_SUPPORTING"
  | "CONSUMER_CONFIRMATION_REQUIRED";

export interface BureauConditionAssessment {
  bureau: Bureau;
  scope: "PRESENT_ACCOUNT" | "CONFIRMED_ABSENT" | "UNKNOWN" | "OUTSIDE_COVERAGE";
  accountCondition: AccountCondition | null;
  reportedAdversity: ReportedAdversity;
  evidenceCompleteness: AssessmentEvidenceCompleteness;
  rationaleCodes: AssessmentRationaleCode[];
}

/**
 * Authorized persistence supplies this exact account-scoped observation set.
 * The assessment resolves candidates inside the set and performs validation
 * itself; callers cannot submit a precomputed validation result as authority.
 */
export interface AssessmentObservationScope {
  sourceAccountKey: string;
  tenantId: string;
  consumerId: string;
  accountId: string;
  reportVersionId: string;
  extractionRunId: string;
  currentObservations: readonly ObservationBinding[];
}

export interface AssessCreditTruthAccountOptions {
  observationScope?: AssessmentObservationScope;
  consumerAssertionCandidates?: readonly BoundConsumerAssertion[];
}

export interface CreditTruthAccountAssessment {
  contractVersion: typeof CREDIT_ASSESSMENT_CONTRACT_VERSION;
  sourceTruthContractVersion: CreditTruthShadowAccount["contractVersion"];
  sourceAccountKey: string;
  accountCondition: AccountCondition;
  disputeGrounds: DisputeGrounds;
  reportedAdversity: ReportedAdversity;
  evidenceCompleteness: AssessmentEvidenceCompleteness;
  bureauAssessments: Record<Bureau, BureauConditionAssessment>;
  rationaleCodes: AssessmentRationaleCode[];
}

type CurrentStatusSignal = "ADVERSE" | "AFFIRMATIVE_NON_ADVERSE" | "NEUTRAL" | "UNRECOGNIZED";

const ADVERSE_STATUS =
  /\b(?:collection(?: account)?|charge(?:d)?[- ]?off|repossession|foreclosure|default(?:ed)?|past due|delinquen(?:t|cy)|late|loss|profit and loss|written off|bad debt|derogatory|(?:30|60|90|120|150|180)\s*(?:days?)?)\b/i;
const AFFIRMATIVE_NON_ADVERSE_STATUS =
  /\b(?:pays? as agreed|paid(?: in full)?|current|good standing|satisfactory|never late|on time)\b/i;
const NEUTRAL_STATUS = /\b(?:closed|open|inactive|transferred|sold)\b/i;
const NEGATED_ADVERSE_STATUS =
  /\b(?:never\s+(?:late|delinquent)|no\s+(?:late payments?|delinquen(?:t|cy)|past due|collection(?: account)?|charge[- ]?off)|not\s+(?:late|delinquent|past due|in collection|charged off))\b/gi;

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function statusSignal(value: string): CurrentStatusSignal {
  const explicitNegations = value.match(NEGATED_ADVERSE_STATUS);
  const withoutExplicitNegations = value.replace(NEGATED_ADVERSE_STATUS, " ");
  if (ADVERSE_STATUS.test(withoutExplicitNegations)) return "ADVERSE";
  if (explicitNegations || AFFIRMATIVE_NON_ADVERSE_STATUS.test(value)) return "AFFIRMATIVE_NON_ADVERSE";
  if (NEUTRAL_STATUS.test(value)) return "NEUTRAL";
  return "UNRECOGNIZED";
}

function hasSourceProvenance(observation: FieldObservation<unknown>): boolean {
  if (observation.presence === "UNKNOWN") return false;
  const locator = observation.provenance.locator;
  return (
    observation.provenance.origin === "EXPLICIT_SOURCE" &&
    typeof locator.section === "string" &&
    locator.section.length > 0
  );
}

function hasParserContractError(bureau: BureauCreditTruth): boolean {
  return bureau.errors.some((error) => error.severity === "ERROR");
}

function currentStatusSignals(bureau: BureauCreditTruth): CurrentStatusSignal[] {
  return ([bureau.fields.summaryStatus, bureau.fields.detailedStatus] as const).flatMap((observation) =>
    observation.presence === "PRESENT" ? [statusSignal(observation.value)] : []
  );
}

function hasCurrentAdverseObservation(bureau: BureauCreditTruth): boolean {
  if (currentStatusSignals(bureau).includes("ADVERSE")) return true;
  if (bureau.fields.chargeOffMarker.presence === "PRESENT" && bureau.fields.chargeOffMarker.value) return true;
  if (bureau.fields.lossReported.presence === "PRESENT" && bureau.fields.lossReported.value) return true;
  if (bureau.fields.collectionFacts.presence === "PRESENT") return true;
  if (
    bureau.fields.relevantDates.presence === "PRESENT" &&
    bureau.fields.relevantDates.value.some((date) =>
      ["FIRST_DELINQUENCY", "CHARGE_OFF", "COLLECTION_PLACED"].includes(date.kind)
    )
  ) {
    return true;
  }
  return (
    bureau.fields.remarks.presence === "PRESENT" &&
    bureau.fields.remarks.value.some((remark) => statusSignal(remark) === "ADVERSE")
  );
}

function assessBureau(bureau: BureauCreditTruth): BureauConditionAssessment {
  const rationaleCodes: AssessmentRationaleCode[] = [];

  if (!bureau.coveredBySource) {
    return {
      bureau: bureau.bureau,
      scope: "OUTSIDE_COVERAGE",
      accountCondition: null,
      reportedAdversity: "UNKNOWN",
      evidenceCompleteness: "UNKNOWN",
      rationaleCodes,
    };
  }

  if (bureau.accountPresence.presence === "ABSENT_CONFIRMED") {
    const index = bureau.sectionCompleteness.ACCOUNT_INDEX;
    const completeAbsence =
      index.state === "COMPLETE" &&
      index.locator?.section === "ACCOUNT_INDEX" &&
      hasSourceProvenance(bureau.accountPresence) &&
      bureau.accountPresence.provenance.locator.section === "ACCOUNT_INDEX";
    return {
      bureau: bureau.bureau,
      scope: completeAbsence ? "CONFIRMED_ABSENT" : "UNKNOWN",
      accountCondition: completeAbsence ? null : "NEEDS_REVIEW",
      reportedAdversity: "UNKNOWN",
      evidenceCompleteness: completeAbsence ? "COMPLETE" : "INCOMPLETE",
      rationaleCodes: [completeAbsence ? "ACCOUNT_ABSENT_CONFIRMED" : "ACCOUNT_PRESENCE_UNKNOWN"],
    };
  }

  if (bureau.accountPresence.presence === "UNKNOWN" || !hasSourceProvenance(bureau.accountPresence)) {
    return {
      bureau: bureau.bureau,
      scope: "UNKNOWN",
      accountCondition: "NEEDS_REVIEW",
      reportedAdversity: "UNKNOWN",
      evidenceCompleteness: "UNKNOWN",
      rationaleCodes: ["ACCOUNT_PRESENCE_UNKNOWN"],
    };
  }

  rationaleCodes.push("ACCOUNT_PRESENT");
  let sawUnknownCompleteness = false;
  let sawIncompleteEvidence = false;

  for (const sectionName of CONDITION_REQUIRED_SECTIONS) {
    const section = bureau.sectionCompleteness[sectionName];
    if (section.state === "UNKNOWN") {
      sawUnknownCompleteness = true;
      rationaleCodes.push("REQUIRED_SECTION_UNKNOWN");
    } else if (section.state !== "COMPLETE") {
      sawIncompleteEvidence = true;
      rationaleCodes.push("REQUIRED_SECTION_INCOMPLETE");
    }
    if (section.state === "COMPLETE" && !section.locator) {
      sawIncompleteEvidence = true;
      rationaleCodes.push("REQUIRED_SECTION_PROVENANCE_MISSING");
    }
  }

  for (const fieldName of CONDITION_REQUIRED_FIELDS) {
    const observation = bureau.fields[fieldName] as FieldObservation<unknown>;
    if (observation.presence === "UNKNOWN") {
      sawUnknownCompleteness = true;
      rationaleCodes.push("REQUIRED_FIELD_UNKNOWN");
    } else if (!hasSourceProvenance(observation)) {
      sawIncompleteEvidence = true;
      rationaleCodes.push("REQUIRED_FIELD_PROVENANCE_MISSING");
    }
  }

  if (hasParserContractError(bureau)) {
    sawIncompleteEvidence = true;
    rationaleCodes.push("PARSER_CONTRACT_ERROR");
  }

  const currentSignals = currentStatusSignals(bureau);
  const hasCurrentAdverse = hasCurrentAdverseObservation(bureau);
  const hasHistoricalAdverse = bureau.historicalEvidence.some((item) => item.assessmentSignal === "ADVERSE");
  const hasContextOnlyHistory = bureau.historicalEvidence.some((item) => item.assessmentSignal === "CONTEXT_ONLY");
  const hasAffirmativeNonAdverse = currentSignals.includes("AFFIRMATIVE_NON_ADVERSE");
  const hasNeutralCurrent = currentSignals.includes("NEUTRAL");

  if (hasCurrentAdverse) rationaleCodes.push("CURRENT_ADVERSE_OBSERVATION");
  if (hasHistoricalAdverse) rationaleCodes.push("HISTORICAL_ADVERSE_OBSERVATION");
  if (hasAffirmativeNonAdverse) rationaleCodes.push("CURRENT_AFFIRMATIVE_NON_ADVERSE");
  if (hasNeutralCurrent) rationaleCodes.push("CURRENT_NEUTRAL_OBSERVATION");
  if (hasContextOnlyHistory) rationaleCodes.push("CONTEXT_ONLY_HISTORY");

  const evidenceCompleteness: AssessmentEvidenceCompleteness = sawIncompleteEvidence
    ? "INCOMPLETE"
    : sawUnknownCompleteness
      ? "UNKNOWN"
      : "COMPLETE";
  const definiteAdversity = hasCurrentAdverse || hasHistoricalAdverse;
  const reportedAdversity: ReportedAdversity = definiteAdversity
    ? "ADVERSE"
    : hasContextOnlyHistory
      ? "POTENTIALLY_ADVERSE"
      : evidenceCompleteness !== "COMPLETE"
        ? "UNKNOWN"
        : hasAffirmativeNonAdverse
          ? "FAVORABLE"
          : "NEUTRAL";

  if (evidenceCompleteness !== "COMPLETE") {
    return {
      bureau: bureau.bureau,
      scope: "PRESENT_ACCOUNT",
      accountCondition: "NEEDS_REVIEW",
      reportedAdversity,
      evidenceCompleteness,
      rationaleCodes: unique(rationaleCodes),
    };
  }

  if (definiteAdversity && (hasAffirmativeNonAdverse || hasNeutralCurrent)) {
    return {
      bureau: bureau.bureau,
      scope: "PRESENT_ACCOUNT",
      accountCondition: "MIXED",
      reportedAdversity,
      evidenceCompleteness,
      rationaleCodes: unique(rationaleCodes),
    };
  }

  if (definiteAdversity) {
    return {
      bureau: bureau.bureau,
      scope: "PRESENT_ACCOUNT",
      accountCondition: "DEROGATORY",
      reportedAdversity,
      evidenceCompleteness,
      rationaleCodes: unique(rationaleCodes),
    };
  }

  if (hasAffirmativeNonAdverse) {
    rationaleCodes.push("COMPLETE_NON_ADVERSE_EVIDENCE");
    return {
      bureau: bureau.bureau,
      scope: "PRESENT_ACCOUNT",
      accountCondition: "CLEAN",
      reportedAdversity,
      evidenceCompleteness,
      rationaleCodes: unique(rationaleCodes),
    };
  }

  rationaleCodes.push("INSUFFICIENT_AFFIRMATIVE_EVIDENCE");
  return {
    bureau: bureau.bureau,
    scope: "PRESENT_ACCOUNT",
    accountCondition: "NEEDS_REVIEW",
    reportedAdversity,
    evidenceCompleteness,
    rationaleCodes: unique(rationaleCodes),
  };
}

function rollUpCompleteness(assessments: BureauConditionAssessment[]): AssessmentEvidenceCompleteness {
  const present = assessments.filter((assessment) => assessment.scope === "PRESENT_ACCOUNT" || assessment.scope === "UNKNOWN");
  if (present.some((assessment) => assessment.evidenceCompleteness === "INCOMPLETE")) return "INCOMPLETE";
  if (present.length === 0 || present.some((assessment) => assessment.evidenceCompleteness === "UNKNOWN")) return "UNKNOWN";
  return "COMPLETE";
}

function rollUpAdversity(assessments: BureauConditionAssessment[]): ReportedAdversity {
  const values = assessments
    .filter((assessment) => assessment.scope === "PRESENT_ACCOUNT" || assessment.scope === "UNKNOWN")
    .map((assessment) => assessment.reportedAdversity);
  if (values.includes("ADVERSE")) return "ADVERSE";
  if (values.includes("POTENTIALLY_ADVERSE")) return "POTENTIALLY_ADVERSE";
  if (values.length === 0 || values.includes("UNKNOWN")) return "UNKNOWN";
  if (values.includes("FAVORABLE")) return "FAVORABLE";
  return "NEUTRAL";
}

function isNonEmptyScopeToken(value: string): boolean {
  return value.trim().length > 0;
}

function countCurrentDisputeSupportingAssertions(
  account: CreditTruthShadowAccount,
  options: AssessCreditTruthAccountOptions,
  rationaleCodes: AssessmentRationaleCode[]
): number {
  const candidates = options.consumerAssertionCandidates ?? [];
  if (candidates.length === 0) return 0;

  const scope = options.observationScope;
  if (
    !scope ||
    scope.sourceAccountKey !== account.sourceAccountKey ||
    !isNonEmptyScopeToken(scope.tenantId) ||
    !isNonEmptyScopeToken(scope.consumerId) ||
    !isNonEmptyScopeToken(scope.accountId) ||
    !isNonEmptyScopeToken(scope.reportVersionId) ||
    !isNonEmptyScopeToken(scope.extractionRunId)
  ) {
    rationaleCodes.push("ASSERTION_SCOPE_MISMATCH");
    return 0;
  }

  let confirmed = 0;
  for (const assertion of candidates) {
    const currentMatches = scope.currentObservations.filter(
      (observation) => observation.observationId === assertion.binding.observationId
    );
    if (currentMatches.length !== 1) {
      rationaleCodes.push("ASSERTION_SCOPE_MISMATCH");
      continue;
    }

    const current = currentMatches[0];
    const bureauTruth = account.bureaus[current.bureau];
    const currentField = bureauTruth.fields[current.field];
    const belongsToAssessmentScope =
      current.tenantId === scope.tenantId &&
      current.consumerId === scope.consumerId &&
      current.accountId === scope.accountId &&
      current.reportVersionId === scope.reportVersionId &&
      current.extractionRunId === scope.extractionRunId &&
      bureauTruth.coveredBySource &&
      bureauTruth.accountPresence.presence === "PRESENT" &&
      currentField.presence === "PRESENT";

    if (!belongsToAssessmentScope) {
      rationaleCodes.push("ASSERTION_SCOPE_MISMATCH");
      continue;
    }

    const validation = validateConsumerAssertionBinding(assertion, current);
    if (!validation.valid || validation.requiresReconfirmation || validation.status !== "CURRENT") {
      rationaleCodes.push("ASSERTION_RECONFIRMATION_REQUIRED");
      continue;
    }
    if (!validation.supportsDisputeGround) {
      rationaleCodes.push("ASSERTION_NOT_DISPUTE_SUPPORTING");
      continue;
    }
    confirmed += 1;
  }

  return confirmed;
}

function classifyGrounds(
  account: CreditTruthShadowAccount,
  condition: AccountCondition,
  options: AssessCreditTruthAccountOptions,
  rationaleCodes: AssessmentRationaleCode[]
): DisputeGrounds {
  const confirmed = countCurrentDisputeSupportingAssertions(account, options, rationaleCodes);
  if (confirmed > 0) {
    rationaleCodes.push("CURRENT_CONSUMER_ASSERTION_BOUND");
    // Strength above LIMITED requires a separately trusted, versioned policy
    // result. Phase 1 does not accept caller-supplied strength labels.
    return "LIMITED";
  }
  if (condition === "CLEAN") return "NONE_DETECTED";
  rationaleCodes.push("CONSUMER_CONFIRMATION_REQUIRED");
  return "CONSUMER_REVIEW_REQUIRED";
}

/**
 * Pure account assessment over parser-v2 shadow output. A clean covered bureau
 * never masks an UNKNOWN/partial covered bureau at account roll-up, and historical
 * adversity remains monotonic within the supplied report version.
 */
export function assessCreditTruthAccount(
  account: CreditTruthShadowAccount,
  options: AssessCreditTruthAccountOptions = {}
): CreditTruthAccountAssessment {
  const bureauAssessments = {} as Record<Bureau, BureauConditionAssessment>;
  for (const bureau of CREDIT_BUREAUS) {
    bureauAssessments[bureau] = assessBureau(account.bureaus[bureau]);
  }

  const covered = account.coveredBureaus.map((bureau) => bureauAssessments[bureau]);
  const present = covered.filter((assessment) => assessment.scope === "PRESENT_ACCOUNT");
  const rationaleCodes = covered.flatMap((assessment) => assessment.rationaleCodes);
  const needsReview = covered.some(
    (assessment) => assessment.scope === "UNKNOWN" || assessment.accountCondition === "NEEDS_REVIEW"
  );
  const sourceConflict =
    account.productTypeResolution.basis === "SOURCE_CONFLICT" ||
    account.errors.some((error) => error.code.includes("CONFLICT"));

  let accountCondition: AccountCondition;
  if (sourceConflict) {
    accountCondition = "NEEDS_REVIEW";
    rationaleCodes.push("SOURCE_CONFLICT");
  } else if (needsReview) {
    accountCondition = "NEEDS_REVIEW";
    rationaleCodes.push("COVERED_BUREAU_REQUIRES_REVIEW");
  } else if (present.length === 0) {
    accountCondition = "NEEDS_REVIEW";
    rationaleCodes.push("NO_PRESENT_ACCOUNT_IN_SCOPE");
  } else {
    const conditions = new Set(present.map((assessment) => assessment.accountCondition));
    if (conditions.has("MIXED") || (conditions.has("DEROGATORY") && conditions.has("CLEAN"))) {
      accountCondition = "MIXED";
      rationaleCodes.push("CROSS_BUREAU_MIXED_CONDITION");
    } else if (conditions.has("DEROGATORY")) {
      accountCondition = "DEROGATORY";
    } else {
      accountCondition = "CLEAN";
    }
  }

  const disputeGrounds = classifyGrounds(account, accountCondition, options, rationaleCodes);

  return {
    contractVersion: CREDIT_ASSESSMENT_CONTRACT_VERSION,
    sourceTruthContractVersion: account.contractVersion,
    sourceAccountKey: account.sourceAccountKey,
    accountCondition,
    disputeGrounds,
    reportedAdversity: rollUpAdversity(covered),
    evidenceCompleteness: rollUpCompleteness(covered),
    bureauAssessments,
    rationaleCodes: unique(rationaleCodes),
  };
}
