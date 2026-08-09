import { AccountType, type Bureau } from "@prisma/client";
import { classifyCreditor } from "../classify";
import {
  CREDIT_BUREAUS,
  CREDIT_TRUTH_CONTRACT_VERSION,
  CREDIT_TRUTH_FIELD_NAMES,
  CREDIT_TRUTH_SECTIONS,
  PARSER_V2_ROLLOUT_MODE,
  type BureauCreditTruth,
  type BureauCreditTruthFields,
  type CreditTruthFieldName,
  type CreditTruthSection,
  type CreditTruthShadowAccount,
  type FieldObservation,
  type HistoricalEvidence,
  type HistoricalEvidenceKind,
  type ParserObservationInput,
  type ParserV2AccountInput,
  type ParserV2Error,
  type ParserV2InputError,
  type ParserV2Source,
  type PresentObservation,
  type ProductTypeResolution,
  type SectionCompleteness,
  type SectionCompletenessInput,
  type SourceProductType,
} from "./types";

export interface BuildParserV2ShadowOptions {
  parser: ParserV2Source;
  parserVersion: string;
  coveredBureaus: Bureau[];
}

function clampConfidence(value: number | undefined, fallback: number): number {
  if (value == null || !Number.isFinite(value)) return fallback;
  return Math.min(1, Math.max(0, value));
}

function mapInputErrors(
  errors: ParserV2InputError[] | undefined,
  context: { bureau?: Bureau; section?: CreditTruthSection; field?: CreditTruthFieldName }
): ParserV2Error[] {
  return (errors ?? []).map((error) => ({
    code: error.code,
    message: error.message,
    severity: error.severity ?? "WARNING",
    ...context,
  }));
}

function unknownObservation<T>(
  parser: ParserV2Source,
  reason: "PARSER_SILENCE" | "PARSE_FAILURE" | "OUTSIDE_COVERAGE" | "INVALID_INPUT",
  errors: ParserV2Error[] = []
): FieldObservation<T> {
  return {
    presence: "UNKNOWN",
    provenance: { parser, origin: reason },
    confidence: 0,
    errors,
  };
}

function hasUsableValue(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  return true;
}

export function normalizeParserObservation<T>(
  input: ParserObservationInput<T> | undefined,
  parser: ParserV2Source,
  context: { bureau?: Bureau; field?: CreditTruthFieldName } = {},
  defaultUnknownReason: "PARSER_SILENCE" | "PARSE_FAILURE" | "OUTSIDE_COVERAGE" | "INVALID_INPUT" =
    "PARSER_SILENCE"
): FieldObservation<T> {
  if (!input || !input.presence || input.presence === "UNKNOWN") {
    const errors = mapInputErrors(input?.errors, context);
    const reason = input?.reason ?? defaultUnknownReason;
    return unknownObservation(parser, reason, errors);
  }

  const errors = mapInputErrors(input.errors, context);
  if (!input.locator) {
    const missingLocator: ParserV2Error = {
      code: "MISSING_SOURCE_LOCATOR",
      message: "A present or confirmed-absent fact must identify its source location.",
      severity: "ERROR",
      ...context,
    };
    return unknownObservation(parser, "INVALID_INPUT", [...errors, missingLocator]);
  }

  if (input.presence === "ABSENT_CONFIRMED") {
    return {
      presence: "ABSENT_CONFIRMED",
      provenance: {
        parser,
        origin: "EXPLICIT_SOURCE",
        locator: { ...input.locator },
        normalizationRule: input.normalizationRule,
      },
      confidence: clampConfidence(input.confidence, 1),
      errors,
    };
  }

  if (!hasUsableValue(input.value)) {
    const missingValue: ParserV2Error = {
      code: "MISSING_PRESENT_VALUE",
      message: "A PRESENT observation must carry a non-empty value.",
      severity: "ERROR",
      ...context,
    };
    return unknownObservation(parser, "INVALID_INPUT", [...errors, missingValue]);
  }

  return {
    presence: "PRESENT",
    value: structuredClone(input.value),
    provenance: {
      parser,
      origin: "EXPLICIT_SOURCE",
      locator: { ...input.locator },
      normalizationRule: input.normalizationRule,
    },
    confidence: clampConfidence(input.confidence, 1),
    errors,
  };
}

function normalizeCompleteness(
  input: SectionCompletenessInput | undefined,
  parser: ParserV2Source,
  bureau: Bureau,
  section: CreditTruthSection,
  outsideCoverage: boolean
): SectionCompleteness {
  if (!input) {
    return {
      state: "UNKNOWN",
      confidence: 0,
      errors: [],
    };
  }

  const errors = mapInputErrors(input.errors, { bureau, section });
  if (outsideCoverage && input.state !== "UNKNOWN" && input.state !== "NOT_PROVIDED") {
    errors.push({
      code: "SECTION_OUTSIDE_COVERAGE",
      message: "A parser cannot claim section completeness for a bureau outside the provided source coverage.",
      severity: "ERROR",
      bureau,
      section,
    });
    return { state: "UNKNOWN", confidence: 0, errors };
  }

  return {
    state: input.state,
    confidence: clampConfidence(input.confidence, input.state === "UNKNOWN" ? 0 : 1),
    locator: input.locator ? { ...input.locator } : undefined,
    errors,
  };
}

function emptyFields(parser: ParserV2Source, reason: "PARSER_SILENCE" | "OUTSIDE_COVERAGE"): BureauCreditTruthFields {
  return {
    summaryStatus: unknownObservation(parser, reason),
    detailedStatus: unknownObservation(parser, reason),
    balanceCents: unknownObservation(parser, reason),
    reportedDate: unknownObservation(parser, reason),
    dofd: unknownObservation(parser, reason),
    relevantDates: unknownObservation(parser, reason),
    paymentHistory: unknownObservation(parser, reason),
    collectionFacts: unknownObservation(parser, reason),
    chargeOffMarker: unknownObservation(parser, reason),
    lossReported: unknownObservation(parser, reason),
    transferOrSale: unknownObservation(parser, reason),
    consumerDisputeRemarks: unknownObservation(parser, reason),
    productType: unknownObservation(parser, reason),
    remarks: unknownObservation(parser, reason),
  };
}

function presentHistoricalObservation(
  source: PresentObservation<unknown>,
  value: { kind: HistoricalEvidenceKind; period?: string; daysLate?: number; detail?: string; isoDate?: string }
): PresentObservation<typeof value> {
  return {
    presence: "PRESENT",
    value,
    provenance: {
      ...source.provenance,
      locator: { ...source.provenance.locator },
    },
    confidence: source.confidence,
    errors: [...source.errors],
  };
}

/** Derives history only from explicit bureau-scoped observations. */
export function historicalEvidenceFromFields(fields: BureauCreditTruthFields): HistoricalEvidence[] {
  const out: HistoricalEvidence[] = [];

  if (fields.paymentHistory.presence === "PRESENT") {
    for (const entry of fields.paymentHistory.value) {
      if (/\b(?:co|charge[- ]?off|charged off)\b/i.test(entry.rating)) {
        const kind = "CHARGE_OFF" as const;
        out.push({
          kind,
          assessmentSignal: "ADVERSE",
          sourceField: "paymentHistory",
          observation: presentHistoricalObservation(fields.paymentHistory, {
            kind,
            period: entry.period,
            detail: entry.rating,
          }),
        });
      }
      const ratingWithoutCleanNegations = entry.rating
        .replace(/\bnever(?:\s+\w+){0,3}\s+(?:late|delinquent|past[- ]?due)\b/gi, " ")
        .replace(/\b(?:no|not)(?:\s+\w+){0,3}\s+(?:late|delinquent|past[- ]?due)(?:\s+payments?)?\b/gi, " ");
      const containedCleanNegation = ratingWithoutCleanNegations !== entry.rating;
      const hasUnnegatedAdverseRating = /\b(?:late|delinquent|past[- ]?due)\b/i.test(
        ratingWithoutCleanNegations
      );
      const hasPositiveDaysLate = (entry.daysLate ?? 0) > 0;
      if (hasPositiveDaysLate || hasUnnegatedAdverseRating) {
        const kind = "PAYMENT_DELINQUENCY" as const;
        const observation = presentHistoricalObservation(fields.paymentHistory, {
          kind,
          period: entry.period,
          daysLate: entry.daysLate,
          detail: entry.rating,
        });
        if (hasPositiveDaysLate && containedCleanNegation) {
          observation.errors.push({
            code: "CONFLICTING_PAYMENT_HISTORY_ENTRY",
            message: "Positive days-late evidence conflicts with clean-negated rating text; both signals were preserved.",
            severity: "WARNING",
            field: "paymentHistory",
          });
        }
        out.push({
          kind,
          assessmentSignal: "ADVERSE",
          sourceField: "paymentHistory",
          observation,
        });
      }
    }
  }

  if (fields.collectionFacts.presence === "PRESENT") {
    for (const fact of fields.collectionFacts.value) {
      const kind = "COLLECTION" as const;
      out.push({
        kind,
        assessmentSignal: "ADVERSE",
        sourceField: "collectionFacts",
        observation: presentHistoricalObservation(fields.collectionFacts, {
          kind,
          detail: fact.kind,
        }),
      });
    }
  }

  const booleanEvidence: Array<{
    field: "chargeOffMarker" | "lossReported" | "transferOrSale";
    kind: "CHARGE_OFF" | "LOSS_REPORTED" | "TRANSFER_OR_SALE";
  }> = [
    { field: "chargeOffMarker", kind: "CHARGE_OFF" },
    { field: "lossReported", kind: "LOSS_REPORTED" },
    { field: "transferOrSale", kind: "TRANSFER_OR_SALE" },
  ];
  for (const item of booleanEvidence) {
    const observation = fields[item.field];
    if (observation.presence === "PRESENT" && observation.value === true) {
      out.push({
        kind: item.kind,
        assessmentSignal: item.kind === "TRANSFER_OR_SALE" ? "CONTEXT_ONLY" : "ADVERSE",
        sourceField: item.field,
        observation: presentHistoricalObservation(observation, { kind: item.kind }),
      });
    }
  }

  if (fields.consumerDisputeRemarks.presence === "PRESENT") {
    for (const remark of fields.consumerDisputeRemarks.value) {
      const kind = "CONSUMER_DISPUTE_REMARK" as const;
      out.push({
        kind,
        assessmentSignal: "CONTEXT_ONLY",
        sourceField: "consumerDisputeRemarks",
        observation: presentHistoricalObservation(fields.consumerDisputeRemarks, { kind, detail: remark }),
      });
    }
  }

  if (fields.dofd.presence === "PRESENT") {
    const kind = "FIRST_DELINQUENCY_DATE" as const;
    out.push({
      kind,
      assessmentSignal: "ADVERSE",
      sourceField: "dofd",
      observation: presentHistoricalObservation(fields.dofd, { kind, isoDate: fields.dofd.value }),
    });
  }

  return out;
}

function normalizeBureau(
  bureau: Bureau,
  accountInput: ParserV2AccountInput,
  options: BuildParserV2ShadowOptions
): BureauCreditTruth {
  const coveredBySource = options.coveredBureaus.includes(bureau);
  const input = accountInput.bureaus?.[bureau];
  const outsideReason = coveredBySource ? "PARSER_SILENCE" : "OUTSIDE_COVERAGE";
  const sectionCompleteness = {} as Record<CreditTruthSection, SectionCompleteness>;

  for (const section of CREDIT_TRUTH_SECTIONS) {
    sectionCompleteness[section] = normalizeCompleteness(
      input?.sectionCompleteness?.[section],
      options.parser,
      bureau,
      section,
      !coveredBySource
    );
  }

  if (!coveredBySource) {
    const errors = mapInputErrors(input?.errors, { bureau });
    if (input) {
      errors.push({
        code: "BUREAU_OUTSIDE_COVERAGE",
        message: "Bureau-scoped parser output was supplied for a bureau not covered by the source.",
        severity: "ERROR",
        bureau,
      });
    }
    return {
      bureau,
      coveredBySource,
      accountPresence: unknownObservation(options.parser, "OUTSIDE_COVERAGE", errors),
      sectionCompleteness,
      fields: emptyFields(options.parser, "OUTSIDE_COVERAGE"),
      historicalEvidence: [],
      errors,
    };
  }

  const accountPresence = normalizeParserObservation(input?.accountPresence, options.parser, { bureau });
  const fields = emptyFields(options.parser, outsideReason);
  const primarySectionByField: Record<CreditTruthFieldName, CreditTruthSection> = {
    summaryStatus: "ACCOUNT_SUMMARY",
    detailedStatus: "ACCOUNT_DETAIL",
    balanceCents: "ACCOUNT_SUMMARY",
    reportedDate: "ACCOUNT_SUMMARY",
    dofd: "ACCOUNT_DETAIL",
    relevantDates: "ACCOUNT_DETAIL",
    paymentHistory: "PAYMENT_HISTORY",
    collectionFacts: "COLLECTIONS",
    chargeOffMarker: "ACCOUNT_DETAIL",
    lossReported: "ACCOUNT_DETAIL",
    transferOrSale: "REMARKS",
    consumerDisputeRemarks: "REMARKS",
    productType: "ACCOUNT_DETAIL",
    remarks: "REMARKS",
  };
  for (const field of CREDIT_TRUTH_FIELD_NAMES) {
    const primarySection = primarySectionByField[field];
    const defaultReason = sectionCompleteness[primarySection].state === "FAILED" ? "PARSE_FAILURE" : "PARSER_SILENCE";
    const normalizedField = normalizeParserObservation(input?.fields?.[field] as never, options.parser, {
      bureau,
      field,
    }, defaultReason);
    if (normalizedField.presence === "ABSENT_CONFIRMED") {
      const locatorSection = normalizedField.provenance.locator.section;
      const ownerSection = primarySection;
      const locatorMatchesCanonicalSection = locatorSection === ownerSection;
      const ownerCompleteness = sectionCompleteness[ownerSection];
      const hasCompleteSectionProvenance =
        locatorMatchesCanonicalSection &&
        ownerCompleteness.state === "COMPLETE" &&
        ownerCompleteness.locator?.section === ownerSection;
      if (!hasCompleteSectionProvenance) {
        const unsupportedAbsence: ParserV2Error = {
          code: locatorMatchesCanonicalSection
            ? "UNSUPPORTED_FIELD_ABSENCE_CONFIRMATION"
            : "FIELD_ABSENCE_SECTION_MISMATCH",
          message: locatorMatchesCanonicalSection
            ? "Confirmed field absence requires a complete canonical owning section with source provenance."
            : "Confirmed field absence must be located in the field's canonical owning section.",
          severity: "ERROR",
          bureau,
          section: ownerSection,
          field,
        };
        fields[field] = unknownObservation(options.parser, "INVALID_INPUT", [
          ...normalizedField.errors,
          unsupportedAbsence,
        ]) as never;
        continue;
      }
    }
    fields[field] = normalizedField as never;
  }

  const errors = [
    ...mapInputErrors(input?.errors, { bureau }),
    ...accountPresence.errors,
    ...Object.values(fields).flatMap((field) => field.errors),
    ...Object.values(sectionCompleteness).flatMap((section) => section.errors),
  ];

  const anyPresentField = Object.values(fields).some((field) => field.presence === "PRESENT");
  let resolvedPresence = accountPresence;
  if (accountPresence.presence === "ABSENT_CONFIRMED") {
    const presenceLocatorMatchesIndex =
      accountPresence.provenance.locator.section === "ACCOUNT_INDEX";
    const accountIndexCompleteness = sectionCompleteness.ACCOUNT_INDEX;
    const indexIsComplete = accountIndexCompleteness.state === "COMPLETE";
    const completenessLocatorMatchesIndex =
      accountIndexCompleteness.locator?.section === "ACCOUNT_INDEX";
    const absenceIsSupported =
      presenceLocatorMatchesIndex && indexIsComplete && completenessLocatorMatchesIndex;
    if (!absenceIsSupported) {
      const code = !presenceLocatorMatchesIndex
        ? "ACCOUNT_PRESENCE_SECTION_MISMATCH"
        : indexIsComplete && !completenessLocatorMatchesIndex
          ? "ACCOUNT_INDEX_COMPLETENESS_PROVENANCE_MISMATCH"
          : "UNSUPPORTED_ABSENCE_CONFIRMATION";
      const message = !presenceLocatorMatchesIndex
        ? "Confirmed account absence must be located in ACCOUNT_INDEX."
        : indexIsComplete && !completenessLocatorMatchesIndex
          ? "Complete account-index evidence must carry an ACCOUNT_INDEX source locator."
          : "Confirmed account absence requires a complete bureau account index with source provenance.";
      const unsupportedAbsence: ParserV2Error = {
        code,
        message,
        severity: "ERROR",
        bureau,
        section: "ACCOUNT_INDEX",
      };
      errors.push(unsupportedAbsence);
      resolvedPresence = unknownObservation(options.parser, "INVALID_INPUT", [
        ...accountPresence.errors,
        unsupportedAbsence,
      ]);
    }
  }
  if (accountPresence.presence === "ABSENT_CONFIRMED" && anyPresentField) {
    const conflict: ParserV2Error = {
      code: "CONFLICTING_ACCOUNT_PRESENCE",
      message: "A bureau cannot be confirmed absent while carrying present account fields.",
      severity: "ERROR",
      bureau,
    };
    errors.push(conflict);
    resolvedPresence = unknownObservation(options.parser, "INVALID_INPUT", [...resolvedPresence.errors, conflict]);
  }

  return {
    bureau,
    coveredBySource,
    accountPresence: resolvedPresence,
    sectionCompleteness,
    fields,
    historicalEvidence: historicalEvidenceFromFields(fields),
    errors,
  };
}

function mapLegacyAccountType(type: AccountType): SourceProductType {
  switch (type) {
    case AccountType.REVOLVING:
    case AccountType.INSTALLMENT:
    case AccountType.MORTGAGE:
    case AccountType.COLLECTION:
    case AccountType.CHARGE_OFF:
    case AccountType.STUDENT_LOAN:
    case AccountType.PUBLIC_RECORD:
    case AccountType.INQUIRY:
    case AccountType.GOVERNMENT:
      return type;
    default:
      return "OTHER";
  }
}

function resolveProductType(
  creditorName: FieldObservation<string>,
  bureaus: Record<Bureau, BureauCreditTruth>
): ProductTypeResolution {
  const sourceTypes = CREDIT_BUREAUS.flatMap((bureau) => {
    const observation = bureaus[bureau].fields.productType;
    return observation.presence === "PRESENT" ? [{ bureau, observation }] : [];
  });
  const uniqueTypes = [...new Set(sourceTypes.map(({ observation }) => observation.value))];

  if (uniqueTypes.length === 1) {
    return {
      value: uniqueTypes[0],
      basis: "EXPLICIT_SOURCE",
      isInference: false,
      sourceBureaus: sourceTypes.map(({ bureau }) => bureau),
      confidence: Math.min(...sourceTypes.map(({ observation }) => observation.confidence)),
      errors: [],
    };
  }

  if (uniqueTypes.length > 1) {
    return {
      value: "UNKNOWN",
      basis: "SOURCE_CONFLICT",
      isInference: false,
      sourceBureaus: sourceTypes.map(({ bureau }) => bureau),
      confidence: 0,
      errors: [
        {
          code: "CONFLICTING_EXPLICIT_PRODUCT_TYPES",
          message: "Explicit product types conflict across bureau source observations.",
          severity: "WARNING",
          field: "productType",
        },
      ],
    };
  }

  if (creditorName.presence === "PRESENT") {
    const inferred = classifyCreditor(creditorName.value);
    return {
      value: mapLegacyAccountType(inferred.accountType),
      basis: "CREDITOR_NAME_HEURISTIC",
      isInference: true,
      sourceBureaus: [],
      confidence: 0.5,
      errors: [],
    };
  }

  return {
    value: "UNKNOWN",
    basis: "UNKNOWN",
    isInference: false,
    sourceBureaus: [],
    confidence: 0,
    errors: [],
  };
}

export function buildParserV2ShadowAccount(
  input: ParserV2AccountInput,
  options: BuildParserV2ShadowOptions
): CreditTruthShadowAccount {
  const coveredBureaus = [...new Set(options.coveredBureaus)].filter((bureau): bureau is Bureau =>
    CREDIT_BUREAUS.includes(bureau)
  );
  const creditorName = normalizeParserObservation(input.creditorName, options.parser);
  const bureaus = {} as Record<Bureau, BureauCreditTruth>;

  for (const bureau of CREDIT_BUREAUS) {
    bureaus[bureau] = normalizeBureau(bureau, input, { ...options, coveredBureaus });
  }

  const productTypeResolution = resolveProductType(creditorName, bureaus);
  const errors = [
    ...mapInputErrors(input.errors, {}),
    ...creditorName.errors,
    ...CREDIT_BUREAUS.flatMap((bureau) => bureaus[bureau].errors),
    ...productTypeResolution.errors,
  ];

  return {
    contractVersion: CREDIT_TRUTH_CONTRACT_VERSION,
    rolloutMode: PARSER_V2_ROLLOUT_MODE,
    legacyWriteAllowed: false,
    parser: options.parser,
    parserVersion: options.parserVersion,
    sourceAccountKey: input.sourceAccountKey,
    creditorName,
    coveredBureaus,
    bureaus,
    productTypeResolution,
    errors,
  };
}
