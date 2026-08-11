import { createCipheriv, createHash, randomBytes } from "node:crypto";
import type { Bureau } from "@prisma/client";
import type { P0Principal, P0Scope } from "./principal";
import { p0ScopeFromPrincipal } from "./principal";
import {
  p0Phase2AGatePermitAuthorizes,
  type P0Phase2AGatePermit,
} from "./phase2Flags";
import type {
  P0ExtractionRunReadback,
  P0ReportIngestion,
  P0ReportVersionCommitReadback,
} from "./reportIngestion";
import {
  adaptP0ParserShadowEnvelope,
  type P0AdaptedParserShadowEnvelope,
} from "./parserShadowAdapter";
import type {
  P0ShadowSourceLocator,
  VerifiedP0ParserShadowEnvelope,
} from "./parserShadowEnvelope";
import { P0_ROUND0_COMPLETENESS_CATEGORIES } from "./parserShadowEnvelope";
import {
  isVerifiedP0SourceArtifactWriteReceipt,
  type VerifiedP0SourceArtifactWriteReceipt,
} from "./sourceArtifact";
import {
  P0_LOCAL_REPOSITORY_ID,
  P0_LOCAL_REPOSITORY_SEMANTICS_VERSION,
  computeP0RepositorySemanticSha256,
  computeP0RepositorySourceSetSha256,
  isVerifiedP0RepositoryAttestation,
  verifyLocalP0RepositoryReadback,
  type P0LocalRepositoryAttestationVerifier,
  type P0RepositorySourceRef,
  type VerifiedP0RepositoryAttestation,
} from "./repositoryAttestation";
import {
  runP0PostgresTransaction,
  type VerifiedP0PostgresRetryAttestation,
} from "./postgresTransaction";
import {
  ROUND0_SOURCE_SEAL_CONTRACT_VERSION,
  bindRound0SourceSnapshotInputSetSha256,
  computeRound0CompletenessMembershipSha256,
  computeRound0SourceSetSha256,
  type Round0SourceCompletenessEvidenceRef,
  type Round0SourceIdentityCategory,
  type Round0SourceSnapshot,
} from "./round0SourceSeal";
import {
  CREDIT_BUREAUS,
  CREDIT_TRUTH_FIELD_NAMES,
  CREDIT_TRUTH_SECTIONS,
  type CreditTruthFieldName,
  type CreditTruthSection,
  type FieldObservation,
  type SourceLocator,
} from "./types";

export const P0_SHADOW_EXTRACTION_SERVICE_VERSION =
  "p0-shadow-truth-graph-service-v2" as const;

type ExtractionStatus = "SUCCEEDED" | "PARTIAL" | "FAILED";
type Presence = "PRESENT" | "ABSENT_CONFIRMED" | "UNKNOWN";
type CoverageStatus = "COVERED" | "OUTSIDE_COVERAGE";

export interface P0ProtectedShadowValue {
  readonly ciphertextBase64: string;
  readonly ivBase64: string;
  readonly authTagBase64: string;
  readonly algorithm: "AES_256_GCM";
  readonly keyVersion: string;
  readonly envelopeVersion: "p0-local-shadow-value-v1";
  readonly aadVersion: "p0-shadow-row-aad-v1";
}

export interface P0ShadowValueProtector {
  readonly adapterClass: "LOCAL_SYNTHETIC_ONLY";
  protect(input: {
    readonly scope: P0Scope;
    readonly rowId: string;
    readonly value: unknown;
  }): Promise<P0ProtectedShadowValue | null>;
}

interface ScopedRow {
  readonly tenantId: string;
  readonly consumerId: string;
  readonly reportVersionId: string;
}

export interface P0ShadowExtractionRunRow extends ScopedRow, P0ExtractionRunReadback {
  readonly runKey: string;
  readonly attempt: number;
  readonly engine: "AI_V2" | "REGEX_V2";
  readonly engineVersion: string;
  readonly schemaVersion: "credit-truth-v2";
  readonly normalizationVersion: string;
  readonly errorCodes: readonly string[];
  readonly startedAt: string;
  readonly completedAt: string;
}

export interface P0ShadowTruthGraphBatch {
  readonly contractVersion: typeof P0_SHADOW_EXTRACTION_SERVICE_VERSION;
  readonly tenantId: string;
  readonly consumerId: string;
  readonly ingestionId: string;
  readonly reportVersionId: string;
  readonly authorityStatus: "SHADOW_V2";
  readonly legacyWriteAllowed: false;
  readonly extractionRun: P0ShadowExtractionRunRow;
  readonly bureauCoverage: readonly (ScopedRow & {
    readonly id: string; readonly extractionRunId: string; readonly bureau: Bureau;
    readonly coverageStatus: CoverageStatus;
  })[];
  readonly round0SourceCompleteness: readonly (ScopedRow &
    Omit<
      Round0SourceCompletenessEvidenceRef,
      "identityBaselineId" | "baselineInputSetSha256"
    > & {
      readonly extractionRunId: string;
      readonly identityBaselineId: string | null;
      readonly baselineInputSetSha256: string | null;
    })[];
  readonly accounts: readonly ({
    readonly id: string; readonly tenantId: string; readonly consumerId: string;
    readonly stableKey: string; readonly authorityStatus: "SHADOW_V2";
  })[];
  readonly reportAccounts: readonly (ScopedRow & {
    readonly id: string; readonly accountId: string; readonly sourceAccountOrdinal: number;
    readonly membershipOrigin: "SOURCE_LISTED"; readonly authorityStatus: "SHADOW_V2";
  })[];
  readonly accountPresence: readonly (ScopedRow & {
    readonly id: string; readonly accountId: string; readonly extractionRunId: string;
    readonly bureau: Bureau; readonly bureauCoverageId: string; readonly coverageStatus: CoverageStatus;
    readonly presence: Presence; readonly observationSeriesKey: string; readonly revision: 1;
    readonly integritySha256: string; readonly sourceLocatorToken: string | null;
    readonly parserConfidence: number; readonly errorCodes: readonly string[];
    readonly accountIndexCompletenessId: string;
  })[];
  readonly sectionCompleteness: readonly (ScopedRow & {
    readonly id: string; readonly accountId: string; readonly extractionRunId: string;
    readonly bureau: Bureau; readonly bureauCoverageId: string; readonly coverageStatus: CoverageStatus;
    readonly reportSection: CreditTruthSection;
    readonly status: "COMPLETE" | "PARTIAL" | "FAILED" | "NOT_PROVIDED" | "UNKNOWN";
    readonly requiredFieldKeys: readonly string[]; readonly observedFieldKeys: readonly string[];
    readonly errorCodes: readonly string[]; readonly normalizationRuleKey: string;
    readonly normalizationRuleVersion: string;
  })[];
  readonly fieldObservations: readonly (ScopedRow & {
    readonly id: string; readonly accountId: string; readonly extractionRunId: string;
    readonly bureau: Bureau; readonly bureauCoverageId: string; readonly coverageStatus: CoverageStatus;
    readonly sectionCompletenessId: string; readonly reportSection: CreditTruthSection;
    readonly sectionStatus: string; readonly fieldKey: CreditTruthFieldName;
    readonly occurrence: 0; readonly presence: Presence; readonly observationSeriesKey: string;
    readonly revision: 1; readonly integritySha256: string;
    readonly protectedValue: P0ProtectedShadowValue | null;
    readonly sourceLocatorToken: string; readonly parserConfidence: number;
    readonly errorCodes: readonly string[]; readonly normalizationRuleKey: string;
    readonly normalizationRuleVersion: string;
  })[];
  readonly historicalEvidence: readonly (ScopedRow & {
    readonly id: string; readonly accountId: string; readonly extractionRunId: string;
    readonly bureau: Bureau; readonly bureauCoverageId: string; readonly coverageStatus: CoverageStatus;
    readonly sectionCompletenessId: string; readonly reportSection: CreditTruthSection;
    readonly sectionStatus: string; readonly evidenceType: string; readonly occurrence: number;
    readonly presence: "PRESENT"; readonly protectedDetail: P0ProtectedShadowValue;
    readonly sourceLocatorToken: string;
  })[];
  readonly creditScoreObservations: readonly (ScopedRow & {
    readonly id: string; readonly extractionRunId: string; readonly bureau: Bureau;
    readonly bureauCoverageId: string; readonly coverageStatus: CoverageStatus;
    readonly presence: "PRESENT" | "NOT_PROVIDED" | "UNKNOWN";
    readonly occurrence: number; readonly protectedScore: P0ProtectedShadowValue | null;
    readonly scoreModelPresence: "PRESENT" | "NOT_PROVIDED" | "UNKNOWN";
    /** Independent durable model/type value; never inferred from score presence. */
    readonly scoreModelEvidenceValue: string | null;
    readonly scoreModelSourceLocatorToken: string | null;
    readonly scoreScaleMin: number | null;
    readonly scoreScaleMax: number | null; readonly sourceLocatorToken: string | null;
    readonly sourceMethodKey: "AI_V2" | "REGEX_V2";
    readonly sourceMethodVersion: string;
    readonly parserConfidence: number | null; readonly integritySha256: string;
  })[];
  readonly reportDateEvidence: readonly (ScopedRow & {
    readonly id: string; readonly extractionRunId: string; readonly bureau: Bureau;
    readonly bureauCoverageId: string; readonly coverageStatus: CoverageStatus;
    readonly presence: "PRESENT" | "EXPLICIT_NOT_PROVIDED" | "UNKNOWN";
    readonly precision: "DAY" | "MONTH" | "YEAR" | "UNKNOWN";
    readonly sourceValue: string | null;
    readonly provenance: "SOURCE_REPORTED" | "EXPLICIT_NOT_PROVIDED" | "UNKNOWN";
    readonly sourceLocatorToken: string | null; readonly integritySha256: string;
  })[];
  readonly identityBaselines: readonly (ScopedRow & {
    readonly id: string; readonly reportIngestionId: string;
    readonly extractionRunId: string;
    readonly baselineSeriesKey: string; readonly version: 1;
    readonly status: "DRAFT"; readonly policyVersion: "p0-round0-source-review-v1";
    readonly inputSetSha256: string; readonly createdByActorId: string;
  })[];
  readonly identityFacts: readonly (ScopedRow & {
    readonly id: string; readonly extractionRunId: string;
    readonly identityBaselineId: string; readonly baselineInputSetSha256: string;
    readonly factSeriesKey: string;
    readonly factOrdinal: number; readonly bureau: Bureau; readonly factType: "NAME" | "ADDRESS" | "EMPLOYMENT" | "IDENTIFIER" | "OTHER";
    readonly classification: "REVIEW_NEEDED"; readonly reviewCategory: Round0SourceIdentityCategory;
    readonly presence: "PRESENT" | "UNKNOWN"; readonly protectedValue: P0ProtectedShadowValue | null;
    readonly sourceKind: "SOURCE_REPORTED" | "PARSER_UNCERTAINTY";
    readonly integritySha256: string; readonly sourceLocatorToken: string;
  })[];
  readonly safeErrorRefs: readonly ({
    readonly code: string; readonly severity: "WARNING" | "ERROR";
    readonly bureau?: Bureau; readonly section?: string; readonly field?: string;
  })[];
}

export type P0ShadowTruthGraphRepositoryResult =
  | {
      readonly kind: "CREATED" | "IDEMPOTENT_REPLAY";
      readonly value: P0ShadowTruthGraphBatch;
      readonly attestation: VerifiedP0RepositoryAttestation<P0ShadowTruthGraphBatch>;
      readonly extractionRunAttestation: VerifiedP0RepositoryAttestation<P0ExtractionRunReadback>;
    }
  | { readonly kind: "DENIED" | "CONFLICT" | "OUTCOME_UNKNOWN" };

export interface P0ShadowTruthGraphRepository {
  persistExact(input: {
    readonly principal: P0Principal;
    readonly scope: P0Scope;
    readonly gatePermit: P0Phase2AGatePermit;
    readonly operationId: string;
    readonly now: Date;
    readonly batch: P0ShadowTruthGraphBatch;
    readonly sourceRefs: readonly P0RepositorySourceRef[];
  }): Promise<P0ShadowTruthGraphRepositoryResult>;
}

export type P0ShadowExtractionPersistenceResult =
  | {
      readonly ok: true; readonly kind: "PERSISTED" | "IDEMPOTENT_REPLAY";
      readonly value: P0ShadowTruthGraphBatch;
      readonly extractionRunReceipt: VerifiedP0RepositoryAttestation<P0ExtractionRunReadback>;
    }
  | {
      readonly ok: false;
      readonly kind: "DENIED" | "CONFLICT" | "DEADLOCK_DETECTED" | "OUTCOME_UNKNOWN";
      readonly code: string;
    };

export interface P0ShadowExtractionService {
  persist(input: {
    readonly principal: P0Principal;
    readonly gatePermit: P0Phase2AGatePermit;
    readonly ingestion: P0ReportIngestion;
    readonly reportVersionReceipt: VerifiedP0RepositoryAttestation<P0ReportVersionCommitReadback>;
    readonly inputReceipt: VerifiedP0SourceArtifactWriteReceipt;
    readonly envelope: VerifiedP0ParserShadowEnvelope;
    readonly operationId: string;
    readonly now: Date;
    readonly retryAttestation?: VerifiedP0PostgresRetryAttestation;
  }): Promise<P0ShadowExtractionPersistenceResult>;
}

const STABLE = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,199}$/;
const SAFE = /^[A-Z][A-Z0-9_]{0,63}$/;
const FIELD_SECTION: Readonly<Record<CreditTruthFieldName, CreditTruthSection>> = Object.freeze({
  summaryStatus: "ACCOUNT_SUMMARY", detailedStatus: "ACCOUNT_DETAIL",
  balanceCents: "ACCOUNT_SUMMARY", reportedDate: "ACCOUNT_SUMMARY", dofd: "ACCOUNT_DETAIL",
  relevantDates: "ACCOUNT_DETAIL", paymentHistory: "PAYMENT_HISTORY",
  collectionFacts: "COLLECTIONS", chargeOffMarker: "ACCOUNT_DETAIL",
  lossReported: "ACCOUNT_DETAIL", transferOrSale: "REMARKS",
  consumerDisputeRemarks: "REMARKS", productType: "ACCOUNT_DETAIL", remarks: "REMARKS",
});

function sha(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}
function opaque(prefix: string, ...parts: readonly unknown[]): string {
  return `${prefix}_${sha(parts).slice(0, 40)}`;
}
function safeCodes(errors: readonly { code: string }[]): readonly string[] {
  return Object.freeze([...new Set(errors.map((item) => item.code).filter((code) => SAFE.test(code)))]);
}
function locatorToken(sourceSha256: string, locator: P0ShadowSourceLocator | undefined, fallback: string): string {
  return opaque("loc", sourceSha256, locator ?? fallback);
}
function observationValue(observation: FieldObservation<unknown>): unknown | undefined {
  return observation.presence === "PRESENT" ? observation.value : undefined;
}
function observationLocator(observation: FieldObservation<unknown>): SourceLocator | undefined {
  return observation.presence === "UNKNOWN" ? undefined : observation.provenance.locator;
}
function identityFactType(value: string): "NAME" | "ADDRESS" | "EMPLOYMENT" | "IDENTIFIER" | "OTHER" {
  if (value === "LEGAL_NAME" || value === "ALIAS") return "NAME";
  if (value === "CURRENT_ADDRESS" || value === "FORMER_ADDRESS") return "ADDRESS";
  if (value === "EMPLOYMENT") return "EMPLOYMENT";
  if (value === "SAFE_IDENTIFIER" || value === "PHONE") return "IDENTIFIER";
  return "OTHER";
}

function exactReportVersionSourceReadback(input: {
  readonly receipt: VerifiedP0RepositoryAttestation<P0ReportVersionCommitReadback>;
  readonly ingestion: P0ReportIngestion;
  readonly scope: P0Scope;
}): P0ReportVersionCommitReadback | null {
  const { receipt, ingestion, scope } = input;
  if (
    !isVerifiedP0RepositoryAttestation(receipt) ||
    receipt.purpose !== "REPORT_VERSION_COMMIT" ||
    receipt.scope.tenantId !== scope.tenantId ||
    receipt.scope.consumerId !== scope.consumerId ||
    !STABLE.test(receipt.operationId)
  ) {
    return null;
  }
  const readback = receipt.snapshot;
  const artifact = readback?.sourceArtifact;
  if (
    !readback ||
    computeP0RepositorySemanticSha256(readback) !== receipt.semanticSha256 ||
    readback.tenantId !== scope.tenantId ||
    readback.consumerId !== scope.consumerId ||
    readback.reportVersionId !== ingestion.reportVersionId ||
    readback.reportSeriesKey !== ingestion.reportSeriesKey ||
    readback.version !== ingestion.reservedVersion ||
    readback.inputSha256 !== ingestion.sourceSha256 ||
    readback.authorityStatus !== "SHADOW_V2" ||
    !artifact ||
    artifact.tenantId !== scope.tenantId ||
    artifact.consumerId !== scope.consumerId ||
    artifact.artifactId !== ingestion.sourceArtifactId ||
    !STABLE.test(artifact.artifactId) ||
    !Number.isSafeInteger(artifact.artifactVersion) ||
    artifact.artifactVersion < 1 ||
    artifact.artifactKind !== "REPORT_SOURCE" ||
    artifact.reportVersionId !== readback.reportVersionId ||
    artifact.sha256 !== ingestion.sourceSha256 ||
    artifact.mimeType !== ingestion.sourceDetectedMimeType ||
    artifact.byteLength !== ingestion.sourceByteLength ||
    artifact.storageProviderKey !== ingestion.sourceStorageProviderKey ||
    artifact.storageLocatorCiphertext !== ingestion.sourceLocatorCiphertext ||
    artifact.storageLocatorIv !== ingestion.sourceLocatorIv ||
    artifact.storageLocatorAuthTag !== ingestion.sourceLocatorAuthTag ||
    artifact.storageLocatorKeyVersion !== ingestion.sourceLocatorKeyVersion ||
    artifact.storageLocatorAlgorithm !== ingestion.sourceLocatorAlgorithm ||
    artifact.storageLocatorEnvelopeVersion !== ingestion.sourceLocatorEnvelopeVersion ||
    artifact.storageLocatorAadVersion !== ingestion.sourceLocatorAadVersion
  ) {
    return null;
  }
  return readback;
}

export function createLocalSyntheticP0ShadowValueProtector(): P0ShadowValueProtector {
  const key = randomBytes(32);
  const protectedByOperationRow = new Map<string, P0ProtectedShadowValue>();
  return Object.freeze({
    adapterClass: "LOCAL_SYNTHETIC_ONLY" as const,
    async protect(input: { readonly scope: P0Scope; readonly rowId: string; readonly value: unknown }): Promise<P0ProtectedShadowValue | null> {
      try {
        const plaintext = Buffer.from(JSON.stringify(input.value), "utf8");
        const cacheKey = sha([input.scope.tenantId, input.scope.consumerId, input.rowId, plaintext.toString("base64")]);
        const prior = protectedByOperationRow.get(cacheKey);
        if (prior) return prior;
        const iv = randomBytes(12);
        const aad = Buffer.from(JSON.stringify([input.scope.tenantId, input.scope.consumerId, input.rowId]), "utf8");
        const cipher = createCipheriv("aes-256-gcm", key, iv);
        cipher.setAAD(aad);
        const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
        const protectedValue = Object.freeze({ ciphertextBase64: ciphertext.toString("base64"), ivBase64: iv.toString("base64"), authTagBase64: cipher.getAuthTag().toString("base64"), algorithm: "AES_256_GCM" as const, keyVersion: "local-ephemeral-v1", envelopeVersion: "p0-local-shadow-value-v1" as const, aadVersion: "p0-shadow-row-aad-v1" as const });
        protectedByOperationRow.set(cacheKey, protectedValue);
        return protectedValue;
      } catch { return null; }
    },
  });
}

function localVerifier(): P0LocalRepositoryAttestationVerifier {
  return Object.freeze({
    repositoryId: P0_LOCAL_REPOSITORY_ID,
    semanticsVersion: P0_LOCAL_REPOSITORY_SEMANTICS_VERSION,
    async verifyReadback(
      input: Parameters<P0LocalRepositoryAttestationVerifier["verifyReadback"]>[0],
    ): Promise<boolean> {
      return input.adapterClass === "LOCAL_SYNTHETIC_ONLY" && input.repositoryId === P0_LOCAL_REPOSITORY_ID && input.semanticsVersion === P0_LOCAL_REPOSITORY_SEMANTICS_VERSION;
    },
  });
}

/** Local truth-graph adapter only; it has no Prisma, storage, network, or production authority. */
export function createLocalSyntheticP0ShadowTruthGraphRepository(options: {
  readonly mutateReadback?: (value: P0ShadowTruthGraphBatch) => P0ShadowTruthGraphBatch;
} = {}): P0ShadowTruthGraphRepository {
  const rows = new Map<string, P0ShadowTruthGraphBatch>();
  const verifier = localVerifier();
  return Object.freeze({
    async persistExact(
      input: Parameters<P0ShadowTruthGraphRepository["persistExact"]>[0],
    ): Promise<P0ShadowTruthGraphRepositoryResult> {
      if (!p0Phase2AGatePermitAuthorizes({ permit: input.gatePermit, principal: input.principal, scope: input.scope, stage: "INGESTION_SHADOW", mode: "LOCAL_BUILD", operationId: input.operationId })) return { kind: "DENIED" };
      const key = `${input.scope.tenantId}\u001f${input.scope.consumerId}\u001f${input.batch.extractionRun.extractionRunId}`;
      const existing = rows.get(key);
      if (existing && computeP0RepositorySemanticSha256(existing) !== computeP0RepositorySemanticSha256(input.batch)) return { kind: "CONFLICT" };
      if (!existing) rows.set(key, structuredClone(input.batch));
      const stored = rows.get(key)!;
      const readback = options.mutateReadback ? options.mutateReadback(structuredClone(stored)) : structuredClone(stored);
      const attestation = await verifyLocalP0RepositoryReadback({ operationId: input.operationId, purpose: "SHADOW_EXTRACTION_WRITE", scope: input.scope, expectedSnapshot: input.batch, readbackSnapshot: readback, sourceRefs: input.sourceRefs, verifier });
      const runSnapshot: P0ExtractionRunReadback = readback.extractionRun;
      const runAttestation = await verifyLocalP0RepositoryReadback({ operationId: input.operationId, purpose: "SHADOW_EXTRACTION_WRITE", scope: input.scope, expectedSnapshot: input.batch.extractionRun, readbackSnapshot: runSnapshot, sourceRefs: input.sourceRefs, verifier });
      if (!attestation || !runAttestation) return { kind: "OUTCOME_UNKNOWN" };
      return { kind: existing ? "IDEMPOTENT_REPLAY" : "CREATED", value: attestation.snapshot, attestation, extractionRunAttestation: runAttestation };
    },
  });
}

async function buildTruthGraphBatch(input: {
  readonly principal: P0Principal; readonly scope: P0Scope; readonly ingestion: P0ReportIngestion;
  readonly reportVersionReadback: P0ReportVersionCommitReadback;
  readonly inputReceipt: VerifiedP0SourceArtifactWriteReceipt; readonly adapted: P0AdaptedParserShadowEnvelope;
  readonly operationId: string; readonly now: Date; readonly protector: P0ShadowValueProtector;
}): Promise<P0ShadowTruthGraphBatch | null> {
  const { adapted, ingestion, reportVersionReadback, scope } = input;
  const extractionRunId = opaque("p0run", scope.tenantId, scope.consumerId, input.operationId);
  const base = { tenantId: scope.tenantId, consumerId: scope.consumerId, reportVersionId: ingestion.reportVersionId! } as const;
  const coverage = adapted.coverage.map((item) => Object.freeze({ ...base, id: opaque("cov", extractionRunId, item.bureau), extractionRunId, bureau: item.bureau, coverageStatus: item.status }));
  const coverageByBureau = new Map(coverage.map((item) => [item.bureau, item]));
  const extractionRun: P0ShadowExtractionRunRow = Object.freeze({ ...base, extractionRunId, runKey: input.operationId, attempt: ingestion.attemptCount, engine: adapted.parser, engineVersion: adapted.parserVersion, schemaVersion: "credit-truth-v2", normalizationVersion: adapted.source.normalizationVersion, status: adapted.status, errorCodes: Object.freeze(adapted.safeErrorCodes.filter((code) => SAFE.test(code))), startedAt: input.now.toISOString(), completedAt: input.now.toISOString(), inputArtifactId: adapted.source.artifactId, inputSha256: adapted.source.sha256, inputRepresentation: "DERIVED_NORMALIZED_TEXT" });
  const accounts: P0ShadowTruthGraphBatch["accounts"][number][] = [];
  const reportAccounts: P0ShadowTruthGraphBatch["reportAccounts"][number][] = [];
  const accountPresence: P0ShadowTruthGraphBatch["accountPresence"][number][] = [];
  const sections: P0ShadowTruthGraphBatch["sectionCompleteness"][number][] = [];
  const observations: P0ShadowTruthGraphBatch["fieldObservations"][number][] = [];
  const historical: P0ShadowTruthGraphBatch["historicalEvidence"][number][] = [];

  if (adapted.status !== "FAILED") {
    for (let accountOrdinal = 0; accountOrdinal < adapted.accounts.length; accountOrdinal += 1) {
      const record = adapted.accounts[accountOrdinal]!;
      const truth = record.shadow.bureaus[record.bureau];
      const coverageRow = coverageByBureau.get(record.bureau)!;
      const accountId = opaque("acct", ingestion.reportVersionId, extractionRunId, record.bureau, accountOrdinal);
      const reportAccountId = opaque("rvacct", ingestion.reportVersionId, accountId);
      accounts.push(Object.freeze({ id: accountId, tenantId: scope.tenantId, consumerId: scope.consumerId, stableKey: opaque("stable", ingestion.reportVersionId, extractionRunId, record.bureau, accountOrdinal), authorityStatus: "SHADOW_V2" }));
      reportAccounts.push(Object.freeze({ ...base, id: reportAccountId, accountId, sourceAccountOrdinal: accountOrdinal, membershipOrigin: "SOURCE_LISTED", authorityStatus: "SHADOW_V2" }));
      const sectionIds = new Map<CreditTruthSection, string>();
      for (const section of CREDIT_TRUTH_SECTIONS) {
        const sectionValue = truth.sectionCompleteness[section];
        const sectionId = opaque("section", extractionRunId, accountId, record.bureau, section);
        sectionIds.set(section, sectionId);
        const required = CREDIT_TRUTH_FIELD_NAMES.filter((field) => FIELD_SECTION[field] === section);
        const observed = required.filter((field) => truth.fields[field].presence === "PRESENT");
        sections.push(Object.freeze({ ...base, id: sectionId, accountId, extractionRunId, bureau: record.bureau, bureauCoverageId: coverageRow.id, coverageStatus: coverageRow.coverageStatus, reportSection: section, status: sectionValue.state, requiredFieldKeys: Object.freeze(required), observedFieldKeys: Object.freeze(observed), errorCodes: safeCodes(sectionValue.errors), normalizationRuleKey: "parser-v2", normalizationRuleVersion: adapted.parserVersion }));
      }
      const presenceId = opaque("presence", extractionRunId, accountId, record.bureau);
      const presenceLocator = observationLocator(truth.accountPresence);
      const presenceCodes = safeCodes(truth.accountPresence.errors);
      accountPresence.push(Object.freeze({ ...base, id: presenceId, accountId, extractionRunId, bureau: record.bureau, bureauCoverageId: coverageRow.id, coverageStatus: coverageRow.coverageStatus, presence: truth.accountPresence.presence, observationSeriesKey: opaque("presence_series", accountId, record.bureau), revision: 1, integritySha256: sha([truth.accountPresence.presence, presenceLocator ?? null, presenceCodes]), sourceLocatorToken: presenceLocator ? locatorToken(adapted.source.sha256, presenceLocator, presenceId) : null, parserConfidence: truth.accountPresence.confidence, errorCodes: presenceCodes, accountIndexCompletenessId: sectionIds.get("ACCOUNT_INDEX")! }));
      for (const field of CREDIT_TRUTH_FIELD_NAMES) {
        const observation = truth.fields[field] as FieldObservation<unknown>;
        const rowId = opaque("obs", extractionRunId, accountId, record.bureau, field);
        const protectedValue = observation.presence === "PRESENT" ? await input.protector.protect({ scope, rowId, value: observationValue(observation) }) : null;
        if (observation.presence === "PRESENT" && !protectedValue) return null;
        const locator = observationLocator(observation);
        const codes = safeCodes(observation.errors);
        const section = FIELD_SECTION[field];
        const sectionRow = truth.sectionCompleteness[section];
        const token = locatorToken(adapted.source.sha256, locator, `${rowId}:${observation.presence}`);
        const integritySha256 = sha([observation.presence, protectedValue, token, codes, sectionRow.state]);
        observations.push(Object.freeze({ ...base, id: rowId, accountId, extractionRunId, bureau: record.bureau, bureauCoverageId: coverageRow.id, coverageStatus: coverageRow.coverageStatus, sectionCompletenessId: sectionIds.get(section)!, reportSection: section, sectionStatus: sectionRow.state, fieldKey: field, occurrence: 0, presence: observation.presence, observationSeriesKey: opaque("obs_series", accountId, record.bureau, field), revision: 1, integritySha256, protectedValue, sourceLocatorToken: token, parserConfidence: observation.confidence, errorCodes: codes, normalizationRuleKey: observation.presence === "UNKNOWN" ? "parser-v2-unknown" : observation.provenance.normalizationRule ?? "parser-v2", normalizationRuleVersion: adapted.parserVersion }));
      }
      for (let occurrence = 0; occurrence < truth.historicalEvidence.length; occurrence += 1) {
        const evidence = truth.historicalEvidence[occurrence]!;
        const rowId = opaque("hist", extractionRunId, accountId, record.bureau, evidence.kind, occurrence);
        const protectedDetail = await input.protector.protect({ scope, rowId, value: evidence.observation.value });
        if (!protectedDetail) return null;
        const section = FIELD_SECTION[evidence.sourceField];
        historical.push(Object.freeze({ ...base, id: rowId, accountId, extractionRunId, bureau: record.bureau, bureauCoverageId: coverageRow.id, coverageStatus: coverageRow.coverageStatus, sectionCompletenessId: sectionIds.get(section)!, reportSection: section, sectionStatus: truth.sectionCompleteness[section].state, evidenceType: evidence.kind, occurrence, presence: "PRESENT", protectedDetail, sourceLocatorToken: locatorToken(adapted.source.sha256, evidence.observation.provenance.locator, rowId) }));
      }
    }
  }

  const scores: P0ShadowTruthGraphBatch["creditScoreObservations"][number][] = [];
  const dates: P0ShadowTruthGraphBatch["reportDateEvidence"][number][] = [];
  type IdentityFactRow = P0ShadowTruthGraphBatch["identityFacts"][number];
  type IdentityFactDraft = Omit<IdentityFactRow, "baselineInputSetSha256">;
  const identityFactDrafts: IdentityFactDraft[] = [];
  const allIdentity = adapted.bureauEvidence.flatMap((item) => item.identity.map((fact) => ({ bureau: item.bureau, fact })));
  const identityBaselines: P0ShadowTruthGraphBatch["identityBaselines"][number][] = [];
  const baselineId = opaque("identity_baseline", ingestion.reportVersionId, extractionRunId);
  const baselineSeriesKey = opaque("identity_series", ingestion.reportVersionId, extractionRunId);
  for (const evidence of adapted.bureauEvidence) {
    const coverageRow = coverageByBureau.get(evidence.bureau)!;
    const dateId = opaque("report_date", extractionRunId, evidence.bureau);
    const sourceValue = evidence.reportDate.presence === "PRESENT"
      ? evidence.reportDate.value
      : null;
    const sourceLocatorToken = evidence.reportDate.presence === "UNKNOWN"
      ? null
      : locatorToken(
          adapted.source.sha256,
          evidence.reportDate.sourceLocator,
          dateId,
        );
    const provenance = evidence.reportDate.presence === "PRESENT"
      ? "SOURCE_REPORTED" as const
      : evidence.reportDate.presence;
    const integritySha256 = sha([
      dateId,
      extractionRunId,
      evidence.bureau,
      coverageRow.id,
      coverageRow.coverageStatus,
      evidence.reportDate.presence,
      evidence.reportDate.precision,
      sourceValue,
      provenance,
      sourceLocatorToken,
      adapted.parser,
      adapted.parserVersion,
      adapted.source.artifactId,
      adapted.source.sha256,
    ]);
    dates.push(Object.freeze({
      ...base,
      id: dateId,
      extractionRunId,
      bureau: evidence.bureau,
      bureauCoverageId: coverageRow.id,
      coverageStatus: coverageRow.coverageStatus,
      presence: evidence.reportDate.presence,
      precision: evidence.reportDate.precision,
      sourceValue,
      provenance,
      sourceLocatorToken,
      integritySha256,
    }));
    for (const score of evidence.scores) {
      if (adapted.status === "FAILED" && score.presence === "PRESENT") continue;
      const rowId = opaque("score", extractionRunId, evidence.bureau, score.occurrence);
      const protectedScore = score.presence === "PRESENT" ? await input.protector.protect({ scope, rowId, value: score.score }) : null;
      if (score.presence === "PRESENT" && !protectedScore) return null;
      const sourceLocatorToken = score.presence === "UNKNOWN"
        ? null
        : locatorToken(adapted.source.sha256, score.sourceLocator, rowId);
      const scoreModelPresence = score.model.presence;
      const scoreModelEvidenceValue = score.model.presence === "PRESENT" ? score.model.modelValue : null;
      const scoreModelSourceLocatorToken = score.model.presence !== "UNKNOWN"
        ? locatorToken(adapted.source.sha256, score.model.sourceLocator, `${rowId}:model`)
        : null;
      const scoreScaleMin = score.presence === "PRESENT" ? score.scaleMin : null;
      const scoreScaleMax = score.presence === "PRESENT" ? score.scaleMax : null;
      const parserConfidence = score.presence === "PRESENT" ? score.confidence : null;
      const sourceMethodKey = adapted.parser;
      const sourceMethodVersion = adapted.parserVersion;
      const integritySha256 = sha([
        rowId,
        extractionRunId,
        evidence.bureau,
        coverageRow.id,
        coverageRow.coverageStatus,
        score.occurrence,
        score.presence,
        protectedScore,
        scoreModelPresence,
        scoreModelEvidenceValue,
        scoreModelSourceLocatorToken,
        scoreScaleMin,
        scoreScaleMax,
        sourceLocatorToken,
        parserConfidence,
        adapted.parser,
        adapted.parserVersion,
        adapted.source.artifactId,
        adapted.source.sha256,
      ]);
      scores.push(Object.freeze({ ...base, id: rowId, extractionRunId, bureau: evidence.bureau, bureauCoverageId: coverageRow.id, coverageStatus: coverageRow.coverageStatus, presence: score.presence, occurrence: score.occurrence, protectedScore, scoreModelPresence, scoreModelEvidenceValue, scoreModelSourceLocatorToken, scoreScaleMin, scoreScaleMax, sourceLocatorToken, sourceMethodKey, sourceMethodVersion, parserConfidence, integritySha256 }));
    }
  }
  if (adapted.status !== "FAILED") {
    for (let factOrdinal = 0; factOrdinal < allIdentity.length; factOrdinal += 1) {
      const { bureau, fact } = allIdentity[factOrdinal]!;
      const rowId = opaque("identity_fact", baselineId, bureau, fact.factKey);
      const protectedValue = fact.presence === "PRESENT" ? await input.protector.protect({ scope, rowId, value: fact.value }) : null;
      if (fact.presence === "PRESENT" && !protectedValue) return null;
      const sourceLocatorToken = fact.presence === "PRESENT" ? locatorToken(adapted.source.sha256, fact.sourceLocator, rowId) : opaque("loc", adapted.source.sha256, rowId, fact.reason);
      identityFactDrafts.push(Object.freeze({ ...base, id: rowId, extractionRunId, identityBaselineId: baselineId, factSeriesKey: opaque("identity_fact_series", ingestion.reportSeriesKey, bureau, fact.factKey), factOrdinal, bureau, factType: identityFactType(fact.factType), classification: "REVIEW_NEEDED", reviewCategory: fact.factType, presence: fact.presence, sourceKind: fact.presence === "PRESENT" ? "SOURCE_REPORTED" : "PARSER_UNCERTAINTY", protectedValue, integritySha256: sha([fact.presence, protectedValue, sourceLocatorToken]), sourceLocatorToken }));
    }
  }
  const identityFacts: IdentityFactRow[] = [];
  const accountMembers: Round0SourceSnapshot["accountMembers"][number][] = [];
  const round0SourceCompleteness: (ScopedRow &
    Omit<
      Round0SourceCompletenessEvidenceRef,
      "identityBaselineId" | "baselineInputSetSha256"
    > & {
      readonly extractionRunId: string;
      readonly identityBaselineId: string | null;
      readonly baselineInputSetSha256: string | null;
    })[] = [];
  if (adapted.status !== "FAILED") {
    for (const reportAccount of reportAccounts) {
      const presence = accountPresence.find(
        (row) => row.accountId === reportAccount.accountId,
      );
      const accountIndex = presence
        ? sections.find(
            (row) =>
              row.accountId === reportAccount.accountId &&
              row.bureau === presence.bureau &&
              row.reportSection === "ACCOUNT_INDEX" &&
              row.id === presence.accountIndexCompletenessId,
          )
        : null;
      if (
        !presence ||
        !accountIndex ||
        (presence.presence !== "PRESENT" && presence.presence !== "UNKNOWN") ||
        (presence.presence === "PRESENT" && !presence.sourceLocatorToken)
      ) {
        return null;
      }
      accountMembers.push(Object.freeze({
        reportAccountId: reportAccount.id,
        accountId: reportAccount.accountId,
        sourceAccountOrdinal: reportAccount.sourceAccountOrdinal,
        membershipOrigin: reportAccount.membershipOrigin,
        authorityStatus: reportAccount.authorityStatus,
        bureau: presence.bureau,
        bureauCoverageId: presence.bureauCoverageId,
        coverageStatus: "COVERED",
        accountPresenceId: presence.id,
        accountPresence: presence.presence,
        accountPresenceSeriesKey: presence.observationSeriesKey,
        accountPresenceRevision: presence.revision,
        accountPresenceIntegritySha256: presence.integritySha256,
        accountPresenceSourceLocatorToken: presence.sourceLocatorToken,
        accountIndexCompletenessId: accountIndex.id,
        accountIndexStatus: accountIndex.status,
      }));
    }
  }
  const identitySourceMembers = Object.freeze(
    identityFactDrafts.map((fact) => Object.freeze({
      identityFactId: fact.id,
      factSeriesKey: fact.factSeriesKey,
      factOrdinal: fact.factOrdinal,
      categoryKey: fact.reviewCategory,
      bureau: fact.bureau,
      presence: fact.presence,
      sourceKind: fact.sourceKind,
      classification: fact.classification,
      integritySha256: fact.integritySha256,
      sourceLocatorToken: fact.sourceLocatorToken,
    })),
  );
  const completenessMembers = round0SourceCompleteness;
  for (const coverageRow of coverage) {
    const bureauEvidence = adapted.bureauEvidence.find(
      (item) => item.bureau === coverageRow.bureau,
    );
    for (const category of P0_ROUND0_COMPLETENESS_CATEGORIES) {
      const parserEvidence = bureauEvidence?.round0Completeness.find(
        (item) => item.category === category,
      );
      if (coverageRow.coverageStatus === "COVERED" && !parserEvidence) {
        return null;
      }
      const id = opaque(
        "round0_complete",
        extractionRunId,
        coverageRow.bureau,
        category,
      );
      const status = coverageRow.coverageStatus === "OUTSIDE_COVERAGE"
        ? "NOT_PROVIDED" as const
        : parserEvidence!.status;
      const ruleKey = coverageRow.coverageStatus === "OUTSIDE_COVERAGE"
        ? "parser-v2-outside-coverage"
        : parserEvidence!.ruleKey;
      const ruleVersion = coverageRow.coverageStatus === "OUTSIDE_COVERAGE"
        ? adapted.parserVersion
        : parserEvidence!.ruleVersion;
      const sourceLocatorToken =
        coverageRow.coverageStatus === "COVERED" &&
        parserEvidence?.sourceLocator
          ? locatorToken(adapted.source.sha256, parserEvidence.sourceLocator, id)
          : null;
      const sourceMemberCount = category === "UNRECOGNIZED_ACCOUNT"
        ? accountMembers.filter((member) => member.bureau === coverageRow.bureau).length
        : identitySourceMembers.filter(
            (member) =>
              member.bureau === coverageRow.bureau &&
              member.categoryKey === category,
          ).length;
      const sourceMembershipSha256 =
        computeRound0CompletenessMembershipSha256({
          category,
          bureau: coverageRow.bureau,
          accountMembers,
          identityFacts: identitySourceMembers,
        });
      const integritySha256 = sha([
        id,
        extractionRunId,
        adapted.status === "FAILED" ? null : baselineId,
        coverageRow.bureau,
        coverageRow.id,
        coverageRow.coverageStatus,
        category,
        status,
        sourceMemberCount,
        sourceMembershipSha256,
        sourceLocatorToken,
        ruleKey,
        ruleVersion,
        adapted.parser,
        adapted.parserVersion,
        adapted.source.artifactId,
        adapted.source.sha256,
      ]);
      completenessMembers.push(Object.freeze({
        ...base,
        id,
        extractionRunId,
        identityBaselineId: adapted.status === "FAILED" ? null : baselineId,
        baselineInputSetSha256:
          adapted.status === "FAILED" ? null : "0".repeat(64),
        bureau: coverageRow.bureau,
        coverageStatus: coverageRow.coverageStatus,
        bureauCoverageId: coverageRow.id,
        category,
        status,
        sourceMemberCount,
        sourceMembershipSha256,
        sourceLocatorToken,
        integritySha256,
        ruleKey,
        ruleVersion,
      }));
    }
  }
  if (adapted.status !== "FAILED") {
    const unboundSourceSnapshot: Round0SourceSnapshot = Object.freeze({
      contractVersion: ROUND0_SOURCE_SEAL_CONTRACT_VERSION,
      repositoryReadId: opaque("round0_source_read", extractionRunId),
      tenantId: scope.tenantId,
      consumerId: scope.consumerId,
      reportIngestionId: ingestion.id,
      reportVersionId: ingestion.reportVersionId!,
      reportSeriesKey: ingestion.reportSeriesKey,
      reportVersion: ingestion.reservedVersion,
      reportSourceSha256: ingestion.sourceSha256,
      sourceArtifact: Object.freeze({
        artifactId: reportVersionReadback.sourceArtifact.artifactId,
        artifactVersion: reportVersionReadback.sourceArtifact.artifactVersion,
        kind: "REPORT_SOURCE",
        representation: "ORIGINAL_BYTES",
        sha256: reportVersionReadback.sourceArtifact.sha256,
      }),
      extractionRunId,
      extractionStatus: adapted.status,
      inputArtifact: Object.freeze({
        artifactId: input.inputReceipt.object.scope.artifactId,
        artifactVersion: input.inputReceipt.object.scope.artifactVersion,
        kind: "NORMALIZED_TEXT",
        representation: "DERIVED_NORMALIZED_TEXT",
        sha256: input.inputReceipt.object.sha256,
      }),
      identityBaselineId: baselineId,
      baselineSeriesKey,
      baselineVersion: 1,
      expectedCoverageCount: coverage.length,
      coverage: Object.freeze(coverage.map((row) => Object.freeze({
        bureauCoverageId: row.id,
        bureau: row.bureau,
        coverageStatus: row.coverageStatus,
      }))),
      expectedCompletenessCount: completenessMembers.length,
      completenessMembers: Object.freeze(completenessMembers.map((member) =>
        Object.freeze({
          id: member.id,
          bureau: member.bureau,
          coverageStatus: member.coverageStatus,
          bureauCoverageId: member.bureauCoverageId,
          identityBaselineId: member.identityBaselineId!,
          baselineInputSetSha256: member.baselineInputSetSha256!,
          category: member.category,
          status: member.status,
          sourceMemberCount: member.sourceMemberCount,
          sourceMembershipSha256: member.sourceMembershipSha256,
          sourceLocatorToken: member.sourceLocatorToken,
          integritySha256: member.integritySha256,
          ruleKey: member.ruleKey,
          ruleVersion: member.ruleVersion,
        }),
      )),
      expectedAccountMemberCount: accountMembers.length,
      accountMembers: Object.freeze(accountMembers),
      expectedIdentityFactCount: identitySourceMembers.length,
      identityFacts: identitySourceMembers,
    });
    let sourceSnapshot: Round0SourceSnapshot;
    let inputSetSha256: string;
    try {
      sourceSnapshot = bindRound0SourceSnapshotInputSetSha256(
        unboundSourceSnapshot,
      );
      inputSetSha256 = computeRound0SourceSetSha256(sourceSnapshot);
    } catch {
      return null;
    }
    const boundCompletenessById = new Map(
      sourceSnapshot.completenessMembers.map((member) => [member.id, member]),
    );
    for (let index = 0; index < round0SourceCompleteness.length; index += 1) {
      const row = round0SourceCompleteness[index]!;
      const bound = boundCompletenessById.get(row.id);
      if (!bound) return null;
      round0SourceCompleteness[index] = Object.freeze({
        ...row,
        identityBaselineId: bound.identityBaselineId,
        baselineInputSetSha256: bound.baselineInputSetSha256,
      });
    }
    identityFacts.push(...identityFactDrafts.map((fact) => Object.freeze({
      ...fact,
      baselineInputSetSha256: inputSetSha256,
    })));
    identityBaselines.push(Object.freeze({
      ...base,
      id: baselineId,
      reportIngestionId: ingestion.id,
      extractionRunId,
      baselineSeriesKey,
      version: 1,
      status: "DRAFT",
      policyVersion: "p0-round0-source-review-v1",
      inputSetSha256,
      createdByActorId: input.principal.actorId,
    }));
  }
  const safeErrorRefs = Object.freeze(adapted.bureauEvidence.flatMap((item) => item.errors.map((error) => Object.freeze({ code: error.code, severity: error.severity, bureau: item.bureau, ...(error.section ? { section: error.section } : {}), ...(error.field ? { field: error.field } : {}) }))));
  return Object.freeze({ contractVersion: P0_SHADOW_EXTRACTION_SERVICE_VERSION, tenantId: scope.tenantId, consumerId: scope.consumerId, ingestionId: ingestion.id, reportVersionId: ingestion.reportVersionId!, authorityStatus: "SHADOW_V2", legacyWriteAllowed: false, extractionRun, bureauCoverage: Object.freeze(coverage), round0SourceCompleteness: Object.freeze(round0SourceCompleteness), accounts: Object.freeze(accounts), reportAccounts: Object.freeze(reportAccounts), accountPresence: Object.freeze(accountPresence), sectionCompleteness: Object.freeze(sections), fieldObservations: Object.freeze(observations), historicalEvidence: Object.freeze(historical), creditScoreObservations: Object.freeze(scores), reportDateEvidence: Object.freeze(dates), identityBaselines: Object.freeze(identityBaselines), identityFacts: Object.freeze(identityFacts), safeErrorRefs });
}

export function createP0ShadowExtractionService(dependencies: {
  readonly repository: P0ShadowTruthGraphRepository;
  readonly protector: P0ShadowValueProtector;
}): P0ShadowExtractionService {
  const service: P0ShadowExtractionService = {
    async persist(input: Parameters<P0ShadowExtractionService["persist"]>[0]): Promise<P0ShadowExtractionPersistenceResult> {
      let scope: P0Scope;
      try { scope = p0ScopeFromPrincipal(input.principal); } catch { return { ok: false, kind: "DENIED", code: "UNVERIFIED_PRINCIPAL" }; }
      if (!STABLE.test(input.operationId) || !(input.now instanceof Date) || !Number.isFinite(input.now.getTime()) || !p0Phase2AGatePermitAuthorizes({ permit: input.gatePermit, principal: input.principal, scope, stage: "INGESTION_SHADOW", mode: "LOCAL_BUILD", operationId: input.operationId })) return { ok: false, kind: "DENIED", code: "SHADOW_GATE_DENIED" };
      const ingestion = input.ingestion;
      if (!ingestion || ingestion.tenantId !== scope.tenantId || ingestion.consumerId !== scope.consumerId || ingestion.state !== "EXTRACTING" || !ingestion.reportVersionId || !isVerifiedP0SourceArtifactWriteReceipt(input.inputReceipt) || input.inputReceipt.object.kind !== "NORMALIZED_TEXT" || input.inputReceipt.object.scope.ingestionId !== ingestion.id || input.inputReceipt.object.scope.tenantId !== scope.tenantId || input.inputReceipt.object.scope.consumerId !== scope.consumerId || input.envelope.source.ingestionId !== ingestion.id || input.envelope.source.artifactId !== input.inputReceipt.object.scope.artifactId || input.envelope.source.artifactVersion !== input.inputReceipt.object.scope.artifactVersion || input.envelope.source.sha256 !== input.inputReceipt.object.sha256 || input.envelope.source.byteLength !== input.inputReceipt.object.byteLength) return { ok: false, kind: "DENIED", code: "EXTRACTION_INPUT_BINDING_MISMATCH" };
      const reportVersionReadback = exactReportVersionSourceReadback({
        receipt: input.reportVersionReceipt,
        ingestion,
        scope,
      });
      if (!reportVersionReadback) {
        return { ok: false, kind: "DENIED", code: "SOURCE_REPORT_READBACK_MISMATCH" };
      }
      if (input.envelope.status === "FAILED" && (input.envelope.accounts.length > 0 || input.envelope.bureauEvidence.some((item) => item.scores.some((score) => score.presence !== "UNKNOWN" || score.model.presence !== "UNKNOWN") || item.identity.length > 0 || item.reportDate.presence !== "UNKNOWN"))) return { ok: false, kind: "DENIED", code: "FAILED_EXTRACTION_CONTAINS_FACTS" };
      const adapted = adaptP0ParserShadowEnvelope(input.envelope);
      if (!adapted.ok) return { ok: false, kind: "DENIED", code: adapted.code };
      const batch = await buildTruthGraphBatch({ principal: input.principal, scope, ingestion, reportVersionReadback, inputReceipt: input.inputReceipt, adapted: adapted.value, operationId: input.operationId, now: input.now, protector: dependencies.protector });
      if (!batch) return { ok: false, kind: "OUTCOME_UNKNOWN", code: "VALUE_PROTECTION_FAILED" };
      const sourceRefs = Object.freeze([{ resourceType: "REPORT_INGESTION", resourceId: ingestion.id, resourceVersion: String(ingestion.revision) }, { resourceType: "REPORT_SOURCE_ARTIFACT", resourceId: reportVersionReadback.sourceArtifact.artifactId, resourceVersion: String(reportVersionReadback.sourceArtifact.artifactVersion), integritySha256: reportVersionReadback.sourceArtifact.sha256 }, { resourceType: "SOURCE_ARTIFACT", resourceId: input.inputReceipt.object.scope.artifactId, resourceVersion: String(input.inputReceipt.object.scope.artifactVersion), integritySha256: input.inputReceipt.object.sha256 }, { resourceType: "REPORT_VERSION", resourceId: ingestion.reportVersionId, resourceVersion: String(ingestion.reservedVersion), integritySha256: ingestion.sourceSha256 }]);
      const transaction = await runP0PostgresTransaction({ operationId: input.operationId, retryAttestation: input.retryAttestation, execute: () => dependencies.repository.persistExact({ principal: input.principal, scope, gatePermit: input.gatePermit, operationId: input.operationId, now: input.now, batch, sourceRefs }) });
      if (!transaction.ok) return transaction.kind === "DEADLOCK_DETECTED" || transaction.kind === "DEADLOCK_RETRY_EXHAUSTED" ? { ok: false, kind: "DEADLOCK_DETECTED", code: transaction.kind } : { ok: false, kind: "OUTCOME_UNKNOWN", code: "SHADOW_WRITE_OUTCOME_UNKNOWN" };
      const repositoryResult = transaction.value;
      if (!("value" in repositoryResult)) {
        if (repositoryResult.kind === "DENIED") return { ok: false, kind: "DENIED", code: "REPOSITORY_DENIED" };
        if (repositoryResult.kind === "CONFLICT") return { ok: false, kind: "CONFLICT", code: "DUPLICATE_EXTRACTION_CONFLICT" };
        return { ok: false, kind: "OUTCOME_UNKNOWN", code: "SHADOW_READBACK_MISMATCH" };
      }
      const batchAttestation = repositoryResult.attestation;
      const runAttestation = repositoryResult.extractionRunAttestation;
      const expectedSourceSetSha256 = computeP0RepositorySourceSetSha256(sourceRefs);
      const expectedBatchSha256 = computeP0RepositorySemanticSha256(batch);
      const expectedRunSha256 = computeP0RepositorySemanticSha256(batch.extractionRun);
      const exactAttestation = isVerifiedP0RepositoryAttestation(batchAttestation) &&
        batchAttestation.operationId === input.operationId &&
        batchAttestation.purpose === "SHADOW_EXTRACTION_WRITE" &&
        batchAttestation.scope.tenantId === scope.tenantId &&
        batchAttestation.scope.consumerId === scope.consumerId &&
        batchAttestation.sourceSetSha256 === expectedSourceSetSha256 &&
        batchAttestation.semanticSha256 === expectedBatchSha256 &&
        computeP0RepositorySemanticSha256(batchAttestation.snapshot) === expectedBatchSha256 &&
        computeP0RepositorySemanticSha256(repositoryResult.value) === expectedBatchSha256 &&
        isVerifiedP0RepositoryAttestation(runAttestation) &&
        runAttestation.operationId === input.operationId &&
        runAttestation.purpose === "SHADOW_EXTRACTION_WRITE" &&
        runAttestation.scope.tenantId === scope.tenantId &&
        runAttestation.scope.consumerId === scope.consumerId &&
        runAttestation.sourceSetSha256 === expectedSourceSetSha256 &&
        runAttestation.semanticSha256 === expectedRunSha256 &&
        computeP0RepositorySemanticSha256(runAttestation.snapshot) === expectedRunSha256;
      if (!exactAttestation) return { ok: false, kind: "OUTCOME_UNKNOWN", code: "SHADOW_READBACK_UNATTESTED" };
      return { ok: true, kind: repositoryResult.kind === "IDEMPOTENT_REPLAY" ? "IDEMPOTENT_REPLAY" : "PERSISTED", value: repositoryResult.value, extractionRunReceipt: repositoryResult.extractionRunAttestation };
    },
  };
  return Object.freeze(service);
}

export interface P0ReportUploadShadowHookInput {
  readonly legacyReportId: string;
  /** Request selectors are non-authoritative hints; coverage is derived from source evidence. */
  readonly bureauSelectors: readonly Bureau[];
  readonly sources: readonly (
    | { readonly kind: "ORIGINAL_PDF"; readonly mimeType: "application/pdf"; readonly content: Uint8Array }
    | { readonly kind: "ORIGINAL_TEXT"; readonly mimeType: "text/plain"; readonly content: Uint8Array }
  )[];
}
export interface P0ReportUploadShadowHook {
  /** Implementations must server-resolve principal/cohort/readiness and mint an exact-operation permit. */
  dispatch(input: P0ReportUploadShadowHookInput): Promise<{ readonly kind: "ACCEPTED"; readonly operationId: string } | { readonly kind: "FAILED"; readonly safeCode: string }>;
}
export type P0ReportUploadShadowHookResult = { readonly kind: "DISABLED" } | { readonly kind: "ACCEPTED"; readonly operationId: string } | { readonly kind: "FAILED"; readonly safeCode: string };

/** Dormant dependency-injected seam; a null hook cannot be enabled by request data. */
export function createP0ReportUploadShadowDispatcher(dependencies: { readonly hook: P0ReportUploadShadowHook | null }): (input: P0ReportUploadShadowHookInput | (() => P0ReportUploadShadowHookInput)) => Promise<P0ReportUploadShadowHookResult> {
  const hook = dependencies.hook;
  return async (input) => {
    if (!hook) return { kind: "DISABLED" };
    try {
      const result = await hook.dispatch(typeof input === "function" ? input() : input);
      if (result.kind === "ACCEPTED" && STABLE.test(result.operationId)) return result;
      if (result.kind === "FAILED" && SAFE.test(result.safeCode)) return result;
      return { kind: "FAILED", safeCode: "MALFORMED_SHADOW_HOOK_RESULT" };
    } catch { return { kind: "FAILED", safeCode: "SHADOW_HOOK_OUTCOME_UNKNOWN" }; }
  };
}
