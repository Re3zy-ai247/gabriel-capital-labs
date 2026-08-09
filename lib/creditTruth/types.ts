import type { Bureau } from "@prisma/client";

/**
 * Parser v2 is deliberately a shadow-only truth contract. It is not a stored
 * replacement for the current Tradeline/BureauData read path.
 */
export const CREDIT_TRUTH_CONTRACT_VERSION = "credit-truth-v2" as const;
export const PARSER_V2_ROLLOUT_MODE = "SHADOW_ONLY" as const;

export const CREDIT_BUREAUS = ["EQUIFAX", "EXPERIAN", "TRANSUNION"] as const satisfies readonly Bureau[];

export const CREDIT_TRUTH_SECTIONS = [
  "ACCOUNT_INDEX",
  "ACCOUNT_SUMMARY",
  "ACCOUNT_DETAIL",
  "PAYMENT_HISTORY",
  "COLLECTIONS",
  "REMARKS",
] as const;

export type CreditTruthSection = (typeof CREDIT_TRUTH_SECTIONS)[number];
export type ParserV2Source = "AI_V2" | "REGEX_V2";
export type CreditTruthPresence = "PRESENT" | "ABSENT_CONFIRMED" | "UNKNOWN";
export type SectionCompletenessState = "COMPLETE" | "PARTIAL" | "FAILED" | "NOT_PROVIDED" | "UNKNOWN";
export type ParserV2ErrorSeverity = "WARNING" | "ERROR";

export interface ParserV2Error {
  code: string;
  message: string;
  severity: ParserV2ErrorSeverity;
  bureau?: Bureau;
  section?: CreditTruthSection;
  field?: CreditTruthFieldName;
}

/**
 * A locator points into the source without carrying source text. Value-bearing
 * source material is intentionally not duplicated into parser diagnostics.
 */
export interface SourceLocator {
  section: CreditTruthSection;
  page?: number;
  lineStart?: number;
  lineEnd?: number;
  charStart?: number;
  charEnd?: number;
  blockId?: string;
}

export interface SourceObservationProvenance {
  parser: ParserV2Source;
  origin: "EXPLICIT_SOURCE";
  locator: SourceLocator;
  normalizationRule?: string;
}

export interface UnknownObservationProvenance {
  parser: ParserV2Source;
  origin: "PARSER_SILENCE" | "PARSE_FAILURE" | "OUTSIDE_COVERAGE" | "INVALID_INPUT";
}

export interface PresentObservation<T> {
  presence: "PRESENT";
  value: T;
  provenance: SourceObservationProvenance;
  confidence: number;
  errors: ParserV2Error[];
}

export interface AbsentConfirmedObservation {
  presence: "ABSENT_CONFIRMED";
  provenance: SourceObservationProvenance;
  confidence: number;
  errors: ParserV2Error[];
}

export interface UnknownObservation {
  presence: "UNKNOWN";
  provenance: UnknownObservationProvenance;
  confidence: number;
  errors: ParserV2Error[];
}

/**
 * The union makes it impossible to attach a value to UNKNOWN or
 * ABSENT_CONFIRMED in a valid v2 result.
 */
export type FieldObservation<T> = PresentObservation<T> | AbsentConfirmedObservation | UnknownObservation;

export type ParserObservationInput<T> =
  | {
      presence: "PRESENT";
      value: T;
      locator: SourceLocator;
      confidence?: number;
      normalizationRule?: string;
      errors?: ParserV2InputError[];
    }
  | {
      presence: "ABSENT_CONFIRMED";
      locator: SourceLocator;
      confidence?: number;
      normalizationRule?: string;
      errors?: ParserV2InputError[];
    }
  | {
      presence: "UNKNOWN";
      reason?: UnknownObservationProvenance["origin"];
      confidence?: number;
      errors?: ParserV2InputError[];
    };

export interface ParserV2InputError {
  code: string;
  message: string;
  severity?: ParserV2ErrorSeverity;
}

export interface SectionCompleteness {
  state: SectionCompletenessState;
  confidence: number;
  locator?: SourceLocator;
  errors: ParserV2Error[];
}

export interface SectionCompletenessInput {
  state: SectionCompletenessState;
  confidence?: number;
  locator?: SourceLocator;
  errors?: ParserV2InputError[];
}

export type SourceProductType =
  | "REVOLVING"
  | "INSTALLMENT"
  | "MORTGAGE"
  | "COLLECTION"
  | "CHARGE_OFF"
  | "STUDENT_LOAN"
  | "PUBLIC_RECORD"
  | "INQUIRY"
  | "GOVERNMENT"
  | "OTHER";

export interface RelevantDateValue {
  kind:
    | "OPENED"
    | "CLOSED"
    | "LAST_PAYMENT"
    | "LAST_ACTIVITY"
    | "FIRST_DELINQUENCY"
    | "CHARGE_OFF"
    | "COLLECTION_PLACED"
    | "TRANSFERRED_OR_SOLD"
    | "OTHER";
  isoDate: string;
  sourceLabel?: string;
}

export interface PaymentHistoryEntry {
  period: string;
  rating: string;
  daysLate?: number;
}

export interface CollectionFact {
  kind:
    | "COLLECTION_ACCOUNT"
    | "PLACED_FOR_COLLECTION"
    | "COLLECTION_BALANCE"
    | "ORIGINAL_CREDITOR_IDENTIFIED"
    | "COLLECTION_STATUS"
    | "OTHER";
  detail?: string;
  amountCents?: number;
}

export type HistoricalEvidenceKind =
  | "PAYMENT_DELINQUENCY"
  | "COLLECTION"
  | "CHARGE_OFF"
  | "LOSS_REPORTED"
  | "TRANSFER_OR_SALE"
  | "CONSUMER_DISPUTE_REMARK"
  | "FIRST_DELINQUENCY_DATE"
  | "OTHER_ADVERSE_REMARK";

export interface HistoricalEvidenceValue {
  kind: HistoricalEvidenceKind;
  period?: string;
  daysLate?: number;
  detail?: string;
  isoDate?: string;
}

export interface HistoricalEvidence {
  kind: HistoricalEvidenceKind;
  assessmentSignal: "ADVERSE" | "CONTEXT_ONLY";
  sourceField: CreditTruthFieldName;
  observation: PresentObservation<HistoricalEvidenceValue>;
}

export const CREDIT_TRUTH_FIELD_NAMES = [
  "summaryStatus",
  "detailedStatus",
  "balanceCents",
  "reportedDate",
  "dofd",
  "relevantDates",
  "paymentHistory",
  "collectionFacts",
  "chargeOffMarker",
  "lossReported",
  "transferOrSale",
  "consumerDisputeRemarks",
  "productType",
  "remarks",
] as const;

export type CreditTruthFieldName = (typeof CREDIT_TRUTH_FIELD_NAMES)[number];

export interface BureauCreditTruthFields {
  summaryStatus: FieldObservation<string>;
  detailedStatus: FieldObservation<string>;
  balanceCents: FieldObservation<number>;
  reportedDate: FieldObservation<string>;
  dofd: FieldObservation<string>;
  relevantDates: FieldObservation<RelevantDateValue[]>;
  paymentHistory: FieldObservation<PaymentHistoryEntry[]>;
  collectionFacts: FieldObservation<CollectionFact[]>;
  chargeOffMarker: FieldObservation<boolean>;
  lossReported: FieldObservation<boolean>;
  transferOrSale: FieldObservation<boolean>;
  consumerDisputeRemarks: FieldObservation<string[]>;
  productType: FieldObservation<SourceProductType>;
  remarks: FieldObservation<string[]>;
}

export interface ParserV2BureauInput {
  accountPresence: ParserObservationInput<true>;
  sectionCompleteness?: Partial<Record<CreditTruthSection, SectionCompletenessInput>>;
  fields?: Partial<{
    [K in keyof BureauCreditTruthFields]: BureauCreditTruthFields[K] extends FieldObservation<infer V>
      ? ParserObservationInput<V>
      : never;
  }>;
  errors?: ParserV2InputError[];
}

export interface BureauCreditTruth {
  bureau: Bureau;
  coveredBySource: boolean;
  accountPresence: FieldObservation<true>;
  sectionCompleteness: Record<CreditTruthSection, SectionCompleteness>;
  fields: BureauCreditTruthFields;
  historicalEvidence: HistoricalEvidence[];
  errors: ParserV2Error[];
}

export type ProductTypeResolutionBasis =
  | "EXPLICIT_SOURCE"
  | "CREDITOR_NAME_HEURISTIC"
  | "SOURCE_CONFLICT"
  | "UNKNOWN";

/**
 * A heuristic result is a derived inference and never masquerades as a source
 * observation. Any explicit source type wins over a name-based heuristic.
 */
export interface ProductTypeResolution {
  value: SourceProductType | "UNKNOWN";
  basis: ProductTypeResolutionBasis;
  isInference: boolean;
  sourceBureaus: Bureau[];
  confidence: number;
  errors: ParserV2Error[];
}

export interface ParserV2AccountInput {
  sourceAccountKey: string;
  creditorName: ParserObservationInput<string>;
  bureaus?: Partial<Record<Bureau, ParserV2BureauInput>>;
  errors?: ParserV2InputError[];
}

export interface CreditTruthShadowAccount {
  contractVersion: typeof CREDIT_TRUTH_CONTRACT_VERSION;
  rolloutMode: typeof PARSER_V2_ROLLOUT_MODE;
  legacyWriteAllowed: false;
  parser: ParserV2Source;
  parserVersion: string;
  sourceAccountKey: string;
  creditorName: FieldObservation<string>;
  coveredBureaus: Bureau[];
  bureaus: Record<Bureau, BureauCreditTruth>;
  productTypeResolution: ProductTypeResolution;
  errors: ParserV2Error[];
}
