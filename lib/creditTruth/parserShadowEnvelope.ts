import type { Bureau } from "@prisma/client";
import { createHash } from "node:crypto";
import {
  CREDIT_BUREAUS,
  CREDIT_TRUTH_SECTIONS,
  type ParserV2AccountInput,
  type SourceLocator,
} from "./types";

export const P0_PARSER_SHADOW_ENVELOPE_VERSION =
  "p0-parser-shadow-envelope-v2" as const;

export interface P0ParserSourceBinding {
  readonly ingestionId: string;
  readonly artifactId: string;
  readonly artifactVersion: number;
  readonly artifactKind: "NORMALIZED_TEXT";
  readonly mimeType: "text/plain";
  readonly sha256: string;
  readonly byteLength: number;
  readonly normalizationVersion: string;
}

export const P0_SHADOW_METADATA_SOURCE_SECTIONS = [
  "REPORT_HEADER",
  "SCORE",
  "SCORE_MODEL",
] as const;
export type P0ShadowSourceLocator = Omit<SourceLocator, "section"> & {
  readonly section:
    | SourceLocator["section"]
    | (typeof P0_SHADOW_METADATA_SOURCE_SECTIONS)[number];
};

/** One account input is scoped to exactly one bureau. */
export interface P0BureauScopedParserAccountInput {
  readonly bureau: Bureau;
  readonly account: ParserV2AccountInput;
}

export type P0ScoreModelEvidence =
  | {
      readonly presence: "PRESENT";
      /** Exact source lexical model/type label; never a derived normalized key. */
      readonly modelValue: string;
      readonly sourceLocator: P0ShadowSourceLocator;
    }
  | {
      readonly presence: "NOT_PROVIDED";
      readonly sourceLocator: P0ShadowSourceLocator;
    }
  | { readonly presence: "UNKNOWN" };

export type P0ReportDateEvidence =
  | {
      readonly presence: "PRESENT";
      readonly precision: "DAY" | "MONTH" | "YEAR";
      readonly value: string;
      readonly sourceLocator: P0ShadowSourceLocator;
    }
  | {
      readonly presence: "EXPLICIT_NOT_PROVIDED";
      readonly precision: "UNKNOWN";
      readonly sourceLocator: P0ShadowSourceLocator;
    }
  | { readonly presence: "UNKNOWN"; readonly precision: "UNKNOWN" };

export type P0ScoreEvidence =
  | {
      readonly presence: "PRESENT";
      readonly occurrence: number;
      readonly score: number;
      readonly scaleMin: number;
      readonly scaleMax: number;
      readonly model: P0ScoreModelEvidence;
      readonly sourceLocator: P0ShadowSourceLocator;
      readonly confidence: number;
    }
  | {
      readonly presence: "NOT_PROVIDED";
      readonly occurrence: number;
      /** Model evidence is independent from numeric score evidence. */
      readonly model: P0ScoreModelEvidence;
      readonly sourceLocator: P0ShadowSourceLocator;
    }
  | {
      readonly presence: "UNKNOWN";
      readonly occurrence: number;
      /** Model evidence is independent from numeric score evidence. */
      readonly model: P0ScoreModelEvidence;
    };

export const P0_IDENTITY_SOURCE_FACT_TYPES = [
  "LEGAL_NAME",
  "ALIAS",
  "CURRENT_ADDRESS",
  "FORMER_ADDRESS",
  "SAFE_IDENTIFIER",
  "PHONE",
  "EMPLOYMENT",
  "MIXED_FILE_INDICATOR",
] as const;
export type P0IdentitySourceFactType = (typeof P0_IDENTITY_SOURCE_FACT_TYPES)[number];

export const P0_ROUND0_COMPLETENESS_CATEGORIES = [
  ...P0_IDENTITY_SOURCE_FACT_TYPES,
  "UNRECOGNIZED_ACCOUNT",
] as const;
export type P0Round0CompletenessCategory =
  (typeof P0_ROUND0_COMPLETENESS_CATEGORIES)[number];

export type P0Round0CompletenessEvidence = {
  readonly category: P0Round0CompletenessCategory;
  readonly status:
    | "COMPLETE"
    | "PARTIAL"
    | "FAILED"
    | "NOT_PROVIDED"
    | "UNKNOWN";
  readonly sourceLocator?: P0ShadowSourceLocator;
  readonly ruleKey: string;
  readonly ruleVersion: string;
};

export type P0IdentitySourceObservation =
  | {
      readonly presence: "PRESENT";
      readonly factKey: string;
      readonly factType: P0IdentitySourceFactType;
      readonly value: string | boolean;
      readonly sourceLocator: SourceLocator;
      readonly confidence: number;
    }
  | {
      readonly presence: "UNKNOWN";
      readonly factKey: string;
      readonly factType: P0IdentitySourceFactType;
      readonly reason: "PARSER_SILENCE" | "PARSE_FAILURE" | "INVALID_INPUT";
    };

export interface P0BureauReportEvidence {
  readonly bureau: Bureau;
  readonly reportDate: P0ReportDateEvidence;
  readonly scores: readonly P0ScoreEvidence[];
  readonly identity: readonly P0IdentitySourceObservation[];
  /** Explicit parser evidence; an empty array or run success is never completeness. */
  readonly round0Completeness: readonly P0Round0CompletenessEvidence[];
  readonly errors: readonly P0SafeParserErrorRef[];
}

export interface P0SafeParserErrorRef {
  readonly code: string;
  readonly severity: "WARNING" | "ERROR";
  readonly bureau?: Bureau;
  readonly section?: string;
  readonly field?: string;
}

export interface P0ParserShadowEnvelopeCandidate {
  readonly contractVersion: typeof P0_PARSER_SHADOW_ENVELOPE_VERSION;
  readonly parser: "AI_V2" | "REGEX_V2";
  readonly parserVersion: string;
  readonly source: P0ParserSourceBinding;
  readonly coveredBureaus: readonly Bureau[];
  readonly accounts: readonly P0BureauScopedParserAccountInput[];
  readonly bureauEvidence: readonly P0BureauReportEvidence[];
  readonly status: "SUCCEEDED" | "PARTIAL" | "FAILED";
  readonly safeErrorCodes: readonly string[];
}

const VERIFIED_PARSER_ENVELOPE = Symbol("verified-parser-shadow-envelope");
const verifiedEnvelopes = new WeakMap<object, string>();

export interface VerifiedP0ParserShadowEnvelope
  extends P0ParserShadowEnvelopeCandidate {
  readonly [VERIFIED_PARSER_ENVELOPE]: true;
}

const SHA256 = /^[a-f0-9]{64}$/;
const STABLE = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,199}$/;
const SAFE_CODE = /^[A-Z][A-Z0-9_]{0,63}$/;

function validDate(value: string, precision: "DAY" | "MONTH" | "YEAR"): boolean {
  if (precision === "YEAR") return /^(?:[1-9]\d{3})$/.test(value);
  if (precision === "MONTH") {
    const match = /^([1-9]\d{3})-(\d{2})$/.exec(value);
    return Boolean(match && Number(match[2]) >= 1 && Number(match[2]) <= 12);
  }
  const match = /^([1-9]\d{3})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const days = [31, year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1]!;
}

function validLocator(locator: P0ShadowSourceLocator | undefined): boolean {
  const allowedKeys = new Set([
    "section",
    "page",
    "lineStart",
    "lineEnd",
    "charStart",
    "charEnd",
    "blockId",
  ]);
  const structurallyValid = Boolean(
    locator &&
      Object.keys(locator).every((key) => allowedKeys.has(key)) &&
      [...CREDIT_TRUTH_SECTIONS, ...P0_SHADOW_METADATA_SOURCE_SECTIONS].includes(
        locator.section,
      ) &&
      (locator.page === undefined || (Number.isSafeInteger(locator.page) && locator.page >= 1)) &&
      (locator.lineStart === undefined || (Number.isSafeInteger(locator.lineStart) && locator.lineStart >= 0)) &&
      (locator.lineEnd === undefined || (Number.isSafeInteger(locator.lineEnd) && locator.lineEnd >= 0)) &&
      (locator.charStart === undefined || (Number.isSafeInteger(locator.charStart) && locator.charStart >= 0)) &&
      (locator.charEnd === undefined || (Number.isSafeInteger(locator.charEnd) && locator.charEnd >= 0)) &&
      (locator.blockId === undefined || STABLE.test(locator.blockId)),
  );
  if (!structurallyValid || !locator) return false;
  if (
    locator.lineStart !== undefined &&
    locator.lineEnd !== undefined &&
    locator.lineEnd < locator.lineStart
  ) return false;
  if (
    locator.charStart !== undefined &&
    locator.charEnd !== undefined &&
    locator.charEnd < locator.charStart
  ) return false;
  return true;
}

function exactKeys(value: object, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function validReportDate(date: P0ReportDateEvidence): boolean {
  if (!date || typeof date !== "object") return false;
  if (date.presence === "UNKNOWN") {
    return exactKeys(date, ["presence", "precision"]) && date.precision === "UNKNOWN";
  }
  if (date.presence === "EXPLICIT_NOT_PROVIDED") {
    return (
      exactKeys(date, ["presence", "precision", "sourceLocator"]) &&
      date.precision === "UNKNOWN" &&
      validLocator(date.sourceLocator)
    );
  }
  return (
    date.presence === "PRESENT" &&
    exactKeys(date, ["presence", "precision", "value", "sourceLocator"]) &&
    validLocator(date.sourceLocator) &&
    validDate(date.value, date.precision)
  );
}

function validScoreModel(model: P0ScoreModelEvidence | undefined): boolean {
  if (!model || typeof model !== "object") return false;
  if (model.presence === "PRESENT") {
    return (
      exactKeys(model, ["presence", "modelValue", "sourceLocator"]) &&
      typeof model.modelValue === "string" &&
      model.modelValue.trim().length > 0 &&
      Array.from(model.modelValue).length <= 200 &&
      !/[\u0000-\u001f\u007f-\u009f\uD800-\uDFFF]/u.test(model.modelValue) &&
      validLocator(model.sourceLocator)
    );
  }
  if (model.presence === "NOT_PROVIDED") {
    return (
      exactKeys(model, ["presence", "sourceLocator"]) &&
      validLocator(model.sourceLocator)
    );
  }
  return model.presence === "UNKNOWN" && exactKeys(model, ["presence"]);
}

function validScore(score: P0ScoreEvidence): boolean {
  if (!score || typeof score !== "object") return false;
  if (!Number.isSafeInteger(score.occurrence) || score.occurrence < 0) return false;
  if (score.presence === "NOT_PROVIDED") {
    return (
      exactKeys(score, ["presence", "occurrence", "model", "sourceLocator"]) &&
      validLocator(score.sourceLocator) &&
      validScoreModel(score.model)
    );
  }
  if (score.presence === "UNKNOWN") {
    return (
      exactKeys(score, ["presence", "occurrence", "model"]) &&
      validScoreModel(score.model)
    );
  }
  if (
    !exactKeys(score, [
      "presence",
      "occurrence",
      "score",
      "scaleMin",
      "scaleMax",
      "model",
      "sourceLocator",
      "confidence",
    ]) ||
    !Number.isSafeInteger(score.score) ||
    !Number.isSafeInteger(score.scaleMin) ||
    !Number.isSafeInteger(score.scaleMax) ||
    score.scaleMin < 0 ||
    score.scaleMax <= score.scaleMin ||
    score.score < score.scaleMin ||
    score.score > score.scaleMax ||
    !Number.isFinite(score.confidence) ||
    score.confidence < 0 ||
    score.confidence > 1 ||
    !validLocator(score.sourceLocator)
  ) return false;
  return validScoreModel(score.model);
}

function validIdentity(observation: P0IdentitySourceObservation): boolean {
  if (!observation || typeof observation !== "object") return false;
  if (
    !STABLE.test(observation.factKey) ||
    !P0_IDENTITY_SOURCE_FACT_TYPES.includes(observation.factType)
  ) return false;
  if (observation.presence === "UNKNOWN") {
    return (
      exactKeys(observation, ["presence", "factKey", "factType", "reason"]) &&
      ["PARSER_SILENCE", "PARSE_FAILURE", "INVALID_INPUT"].includes(observation.reason)
    );
  }
  return (
    observation.presence === "PRESENT" &&
    exactKeys(observation, ["presence", "factKey", "factType", "value", "sourceLocator", "confidence"]) &&
    (typeof observation.value === "boolean" ||
      (typeof observation.value === "string" && observation.value.trim().length > 0)) &&
    Number.isFinite(observation.confidence) &&
    observation.confidence >= 0 &&
    observation.confidence <= 1 &&
    validLocator(observation.sourceLocator)
  );
}

function validRound0Completeness(
  evidence: P0Round0CompletenessEvidence,
): boolean {
  if (!evidence || typeof evidence !== "object") return false;
  const hasLocator = Object.prototype.hasOwnProperty.call(
    evidence,
    "sourceLocator",
  );
  if (
    !exactKeys(
      evidence,
      hasLocator
        ? ["category", "status", "sourceLocator", "ruleKey", "ruleVersion"]
        : ["category", "status", "ruleKey", "ruleVersion"],
    ) ||
    !P0_ROUND0_COMPLETENESS_CATEGORIES.includes(evidence.category) ||
    !["COMPLETE", "PARTIAL", "FAILED", "NOT_PROVIDED", "UNKNOWN"].includes(
      evidence.status,
    ) ||
    !STABLE.test(evidence.ruleKey) ||
    !STABLE.test(evidence.ruleVersion)
  ) {
    return false;
  }
  if (evidence.status === "COMPLETE" || evidence.status === "PARTIAL") {
    return hasLocator && validLocator(evidence.sourceLocator);
  }
  return !hasLocator || validLocator(evidence.sourceLocator);
}

function envelopeBinding(envelope: P0ParserShadowEnvelopeCandidate): string {
  return createHash("sha256").update(JSON.stringify(envelope), "utf8").digest("hex");
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
}

export function validateP0ParserShadowEnvelope(
  envelope: P0ParserShadowEnvelopeCandidate,
): readonly string[] {
  const errors: string[] = [];
  if (!envelope || typeof envelope !== "object" || envelope.contractVersion !== P0_PARSER_SHADOW_ENVELOPE_VERSION) {
    return Object.freeze(["INVALID_ENVELOPE_VERSION"]);
  }
  try {
  if (!exactKeys(envelope, [
    "contractVersion",
    "parser",
    "parserVersion",
    "source",
    "coveredBureaus",
    "accounts",
    "bureauEvidence",
    "status",
    "safeErrorCodes",
  ])) errors.push("UNEXPECTED_ENVELOPE_FIELD");
  if (!["AI_V2", "REGEX_V2"].includes(envelope.parser) || !STABLE.test(envelope.parserVersion)) {
    errors.push("INVALID_PARSER_IDENTITY");
  }
  const source = envelope.source;
  if (
    !source ||
    typeof source !== "object" ||
    !exactKeys(source, [
      "ingestionId",
      "artifactId",
      "artifactVersion",
      "artifactKind",
      "mimeType",
      "sha256",
      "byteLength",
      "normalizationVersion",
    ]) ||
    !STABLE.test(source.ingestionId) ||
    !STABLE.test(source.artifactId) ||
    !Number.isSafeInteger(source.artifactVersion) ||
    source.artifactVersion < 1 ||
    source.artifactKind !== "NORMALIZED_TEXT" ||
    source.mimeType !== "text/plain" ||
    !SHA256.test(source.sha256) ||
    !Number.isSafeInteger(source.byteLength) ||
    source.byteLength < 0 ||
    !STABLE.test(source.normalizationVersion)
  ) errors.push("INVALID_SOURCE_BINDING");

  const covered = Array.isArray(envelope.coveredBureaus) ? envelope.coveredBureaus : [];
  if (
    !Array.isArray(covered) ||
    covered.length < 1 ||
    new Set(covered).size !== covered.length ||
    !covered.every((bureau) => CREDIT_BUREAUS.includes(bureau))
  ) errors.push("INVALID_BUREAU_COVERAGE");

  const accountKeys = new Set<string>();
  const accounts = Array.isArray(envelope.accounts) ? envelope.accounts : [];
  if (!Array.isArray(envelope.accounts)) errors.push("MALFORMED_ACCOUNTS");
  for (const item of accounts) {
    const suppliedBureaus = item?.account && typeof item.account === "object"
      ? Object.keys(item.account.bureaus ?? {})
      : [];
    const key = `${item?.bureau}:${item?.account?.sourceAccountKey}`;
    if (
      !item ||
      !covered.includes(item.bureau) ||
      !STABLE.test(item.account?.sourceAccountKey) ||
      suppliedBureaus.length !== 1 ||
      suppliedBureaus[0] !== item.bureau ||
      accountKeys.has(key)
    ) errors.push("NON_BUREAU_SCOPED_ACCOUNT_INPUT");
    accountKeys.add(key);
  }

  const bureauEvidence = Array.isArray(envelope.bureauEvidence) ? envelope.bureauEvidence : [];
  if (!Array.isArray(envelope.bureauEvidence)) errors.push("MALFORMED_BUREAU_EVIDENCE");
  const evidenceBureaus = bureauEvidence.map((item) => item?.bureau);
  if (
    evidenceBureaus.length !== covered.length ||
    new Set(evidenceBureaus).size !== evidenceBureaus.length ||
    !covered.every((bureau) => evidenceBureaus.includes(bureau))
  ) errors.push("INCOMPLETE_BUREAU_EVIDENCE");
  for (const evidence of bureauEvidence) {
    const scores = Array.isArray(evidence?.scores) ? evidence.scores : [];
    const identity = Array.isArray(evidence?.identity) ? evidence.identity : [];
    const identityKeys = identity.map((fact: P0IdentitySourceObservation) => fact?.factKey);
    const round0Completeness = Array.isArray(evidence?.round0Completeness)
      ? evidence.round0Completeness
      : [];
    const completenessCategories = round0Completeness.map(
      (item: P0Round0CompletenessEvidence) => item?.category,
    );
    const safeErrors = Array.isArray(evidence?.errors) ? evidence.errors : [];
    const safeErrorsValid = safeErrors.every((error: P0SafeParserErrorRef) => {
      if (!error || typeof error !== "object") return false;
      const permitted = ["code", "severity", "bureau", "section", "field"];
      if (!Object.keys(error).every((key) => permitted.includes(key))) return false;
      return (
        SAFE_CODE.test(error.code) &&
        ["WARNING", "ERROR"].includes(error.severity) &&
        (error.bureau === undefined || error.bureau === evidence.bureau) &&
        (error.section === undefined || SAFE_CODE.test(error.section)) &&
        (error.field === undefined || /^[A-Za-z][A-Za-z0-9_]{0,127}$/.test(error.field))
      );
    });
    const scoreEvidenceShapeValid =
      (scores.length >= 1 && scores.every((score: P0ScoreEvidence) => score.presence === "PRESENT")) ||
      (scores.length === 1 &&
        scores[0]?.occurrence === 0 &&
        (scores[0]?.presence === "NOT_PROVIDED" || scores[0]?.presence === "UNKNOWN"));
    if (
      !evidence ||
      !exactKeys(evidence, ["bureau", "reportDate", "scores", "identity", "round0Completeness", "errors"]) ||
      !covered.includes(evidence.bureau) ||
      !validReportDate(evidence.reportDate) ||
      !Array.isArray(evidence.scores) ||
      !scores.every(validScore) ||
      !scoreEvidenceShapeValid ||
      new Set(scores.map((score: P0ScoreEvidence) => score.occurrence)).size !== scores.length ||
      !Array.isArray(evidence.identity) ||
      !identity.every(validIdentity) ||
      new Set(identityKeys).size !== identityKeys.length ||
      !Array.isArray(evidence.round0Completeness) ||
      round0Completeness.length !== P0_ROUND0_COMPLETENESS_CATEGORIES.length ||
      !round0Completeness.every(validRound0Completeness) ||
      new Set(completenessCategories).size !== completenessCategories.length ||
      !P0_ROUND0_COMPLETENESS_CATEGORIES.every((category) =>
        completenessCategories.includes(category),
      ) ||
      !Array.isArray(evidence.errors) ||
      !safeErrorsValid
    ) errors.push("INVALID_BUREAU_EVIDENCE");
  }
  if (!["SUCCEEDED", "PARTIAL", "FAILED"].includes(envelope.status)) {
    errors.push("INVALID_EXTRACTION_STATUS");
  }
  if (!Array.isArray(envelope.safeErrorCodes) || !envelope.safeErrorCodes.every((code) => SAFE_CODE.test(code))) {
    errors.push("UNSAFE_ERROR_CODE");
  }
  if (
    envelope.status === "FAILED" &&
    bureauEvidence.some((evidence) =>
      evidence.round0Completeness?.some(
        (item: P0Round0CompletenessEvidence) =>
          item.status === "COMPLETE" || item.status === "PARTIAL",
      ),
    )
  ) {
    errors.push("FAILED_EXTRACTION_ASSERTS_COMPLETENESS");
  }
  if (
    envelope.status === "FAILED" &&
    (accounts.length > 0 ||
      bureauEvidence.some(
        (evidence) =>
          evidence.reportDate.presence !== "UNKNOWN" ||
          evidence.identity.length > 0 ||
          evidence.scores.some(
            (score: P0ScoreEvidence) =>
              score.presence !== "UNKNOWN" ||
              score.model.presence !== "UNKNOWN",
          ),
      ))
  ) {
    errors.push("FAILED_EXTRACTION_ASSERTS_SOURCE_FACTS");
  }
  } catch {
    errors.push("MALFORMED_ENVELOPE");
  }
  return Object.freeze([...new Set(errors)]);
}

export function verifyP0ParserShadowEnvelope(
  envelope: P0ParserShadowEnvelopeCandidate,
): VerifiedP0ParserShadowEnvelope | null {
  if (validateP0ParserShadowEnvelope(envelope).length > 0) return null;
  let snapshot: VerifiedP0ParserShadowEnvelope;
  try {
    snapshot = structuredClone(envelope) as VerifiedP0ParserShadowEnvelope;
  } catch {
    return null;
  }
  Object.defineProperty(snapshot, VERIFIED_PARSER_ENVELOPE, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  deepFreeze(snapshot);
  verifiedEnvelopes.set(snapshot, envelopeBinding(snapshot));
  return snapshot;
}

export function isVerifiedP0ParserShadowEnvelope(
  envelope: VerifiedP0ParserShadowEnvelope | null | undefined,
): envelope is VerifiedP0ParserShadowEnvelope {
  return Boolean(
    envelope &&
      envelope[VERIFIED_PARSER_ENVELOPE] === true &&
      verifiedEnvelopes.get(envelope) === envelopeBinding(envelope),
  );
}
