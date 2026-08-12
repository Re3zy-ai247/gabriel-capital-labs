import type { P0Scope } from "./principal";
import { p0PrincipalAuthorizesScope, validateP0Principal } from "./principal";
import { p0Phase2AGatePermitAuthorizes } from "./phase2Flags";
import {
  P0_PRISMA_REPOSITORY_ID,
  P0_PRISMA_REPOSITORY_SEMANTICS_VERSION,
  computeP0RepositorySemanticSha256,
  verifyPrismaP0RepositoryReadback,
  type P0PrismaRepositoryAttestationVerifier,
} from "./repositoryAttestation";
import type { P0ExtractionRunReadback } from "./reportIngestion";
import {
  isVerifiedP0ShadowWriterAuthority,
  type P0ProtectedShadowValue,
  type P0ShadowTruthGraphBatch,
  type P0ShadowTruthGraphRepository,
  type P0ShadowTruthGraphRepositoryResult,
} from "./shadowExtractionService";
import type {
  P0PrismaTransactionalClient,
  P0PrismaTransactionalPrincipalRevalidator,
} from "./prismaReportIngestionRepository";
import { P0_PRISMA_SOURCE_PROVIDER_KEY } from "./sourceArtifact";
import {
  deriveP0PrismaSourcePhysicalIdentity,
  isValidP0PrismaSourceObjectRow,
} from "./prismaSourceArtifactProvider";

export const P0_PRISMA_SHADOW_GRAPH_REPOSITORY_VERSION =
  "p0-prisma-shadow-graph-repository-v1" as const;

export interface P0PrismaShadowTruthGraphRepositoryDependencies {
  readonly client: P0PrismaTransactionalClient;
  readonly principalRevalidator: P0PrismaTransactionalPrincipalRevalidator;
  readonly maxWaitMs?: number;
  readonly timeoutMs?: number;
}

const SAFE_REF_PREFIX = "P0_SAFE_REF_V1:";
const STABLE = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,199}$/;
const SHA256 = /^[a-f0-9]{64}$/;

const PRISMA_ATTESTATION_VERIFIER: P0PrismaRepositoryAttestationVerifier =
  Object.freeze({
    repositoryId: P0_PRISMA_REPOSITORY_ID,
    semanticsVersion: P0_PRISMA_REPOSITORY_SEMANTICS_VERSION,
    async verifyReadback(
      input: Parameters<P0PrismaRepositoryAttestationVerifier["verifyReadback"]>[0],
    ) {
      return (
        input.adapterClass === "AUTHENTICATED_TENANT_SCOPED_PRISMA" &&
        input.repositoryId === P0_PRISMA_REPOSITORY_ID &&
        input.semanticsVersion === P0_PRISMA_REPOSITORY_SEMANTICS_VERSION
      );
    },
  });

function bytes(value: string): Buffer {
  return Buffer.from(value, "base64");
}

function base64(value: unknown): string {
  if (Buffer.isBuffer(value)) return value.toString("base64");
  if (value instanceof Uint8Array) return Buffer.from(value).toString("base64");
  throw new Error("invalid encrypted Prisma value");
}

function protectedData(value: P0ProtectedShadowValue | null, prefix: string) {
  return value
    ? {
        [`${prefix}Ciphertext`]: bytes(value.ciphertextBase64),
        [`${prefix}Iv`]: bytes(value.ivBase64),
        [`${prefix}AuthTag`]: bytes(value.authTagBase64),
        [`${prefix}KeyVersion`]: value.keyVersion,
        [`${prefix}Algorithm`]: value.algorithm,
        [`${prefix}EnvelopeVersion`]: value.envelopeVersion,
        [`${prefix}AadVersion`]: value.aadVersion,
      }
    : {
        [`${prefix}Ciphertext`]: null,
        [`${prefix}Iv`]: null,
        [`${prefix}AuthTag`]: null,
        [`${prefix}KeyVersion`]: null,
        [`${prefix}Algorithm`]: null,
        [`${prefix}EnvelopeVersion`]: null,
        [`${prefix}AadVersion`]: null,
      };
}

function protectedReadback(row: any, prefix: string): P0ProtectedShadowValue | null {
  const ciphertext = row[`${prefix}Ciphertext`];
  if (ciphertext === null || ciphertext === undefined) return null;
  return Object.freeze({
    ciphertextBase64: base64(ciphertext),
    ivBase64: base64(row[`${prefix}Iv`]),
    authTagBase64: base64(row[`${prefix}AuthTag`]),
    algorithm: row[`${prefix}Algorithm`],
    keyVersion: row[`${prefix}KeyVersion`],
    envelopeVersion: row[`${prefix}EnvelopeVersion`],
    aadVersion: row[`${prefix}AadVersion`],
  }) as P0ProtectedShadowValue;
}

function encodeSafeRef(value: P0ShadowTruthGraphBatch["safeErrorRefs"][number]): string {
  return `${SAFE_REF_PREFIX}${Buffer.from(JSON.stringify([
    value.code,
    value.severity,
    value.bureau ?? null,
    value.section ?? null,
    value.field ?? null,
  ]), "utf8").toString("base64url")}`;
}

function decodeSafeRef(value: string): P0ShadowTruthGraphBatch["safeErrorRefs"][number] {
  const parsed = JSON.parse(
    Buffer.from(value.slice(SAFE_REF_PREFIX.length), "base64url").toString("utf8"),
  ) as [string, "WARNING" | "ERROR", string | null, string | null, string | null];
  return Object.freeze({
    code: parsed[0],
    severity: parsed[1],
    ...(parsed[2] ? { bureau: parsed[2] } : {}),
    ...(parsed[3] ? { section: parsed[3] } : {}),
    ...(parsed[4] ? { field: parsed[4] } : {}),
  }) as P0ShadowTruthGraphBatch["safeErrorRefs"][number];
}

function errorCodesForStorage(batch: P0ShadowTruthGraphBatch): readonly string[] {
  return Object.freeze([
    ...batch.extractionRun.errorCodes,
    ...batch.safeErrorRefs.map(encodeSafeRef),
  ]);
}

function databaseCodes(error: unknown): readonly string[] {
  const found = new Set<string>();
  const visit = (value: unknown, depth: number): void => {
    if (!value || typeof value !== "object" || depth > 5) return;
    const record = value as Record<string, unknown>;
    for (const key of ["code", "sqlState", "sqlstate"]) {
      if (typeof record[key] === "string") found.add(record[key] as string);
    }
    visit(record.cause, depth + 1);
    visit(record.originalError, depth + 1);
  };
  visit(error, 0);
  return Object.freeze([...found]);
}

function rethrowDeadlock(error: unknown): void {
  if (databaseCodes(error).includes("40P01")) throw error;
}

function isUniqueConflict(error: unknown): boolean {
  const codes = databaseCodes(error);
  return codes.includes("P2002") || codes.includes("23505");
}

function safePositiveInteger(value: unknown): number | null {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function sameBytes(left: unknown, right: unknown): boolean {
  return (
    (Buffer.isBuffer(left) || left instanceof Uint8Array) &&
    (Buffer.isBuffer(right) || right instanceof Uint8Array) &&
    Buffer.from(left).equals(Buffer.from(right))
  );
}

/**
 * Re-proves the normalized parser input from durable rows immediately before
 * graph mutation. A process-local writer authority cannot substitute for the
 * exact Artifact/P0SourceObject binding in PostgreSQL.
 */
async function exactNormalizedInputAuthority(input: {
  readonly transaction: any;
  readonly batch: P0ShadowTruthGraphBatch;
  readonly sourceRefs: Parameters<
    P0ShadowTruthGraphRepository["persistExact"]
  >[0]["sourceRefs"];
}): Promise<boolean> {
  const { transaction, batch } = input;
  const extraction = batch.extractionRun;
  if (
    extraction.inputRepresentation !== "DERIVED_NORMALIZED_TEXT" ||
    !STABLE.test(extraction.inputArtifactId) ||
    !SHA256.test(extraction.inputSha256)
  ) {
    return false;
  }
  const sourceRefs = input.sourceRefs.filter(
    (ref) => ref.resourceType === "SOURCE_ARTIFACT",
  );
  if (
    sourceRefs.length !== 1 ||
    sourceRefs[0]?.resourceId !== extraction.inputArtifactId ||
    sourceRefs[0]?.integritySha256 !== extraction.inputSha256
  ) {
    return false;
  }
  const artifactVersion = Number(sourceRefs[0].resourceVersion);
  if (
    !Number.isSafeInteger(artifactVersion) ||
    artifactVersion < 1 ||
    String(artifactVersion) !== sourceRefs[0].resourceVersion
  ) {
    return false;
  }
  try {
    const artifact = await transaction.artifact.findFirst({
      where: {
        tenantId: batch.tenantId,
        consumerId: batch.consumerId,
        id: extraction.inputArtifactId,
        version: artifactVersion,
        reportVersionId: batch.reportVersionId,
      },
    });
    const sourceObject = await transaction.p0SourceObject.findFirst({
      where: {
        tenantId: batch.tenantId,
        consumerId: batch.consumerId,
        ingestionId: batch.ingestionId,
        artifactId: extraction.inputArtifactId,
        artifactVersion,
      },
    });
    const artifactBytes = safePositiveInteger(artifact?.byteLength);
    const objectBytes = safePositiveInteger(sourceObject?.byteLength);
    const physical = sourceObject
      ? deriveP0PrismaSourcePhysicalIdentity({
          scope: {
            tenantId: batch.tenantId,
            consumerId: batch.consumerId,
            ingestionId: batch.ingestionId,
            artifactId: extraction.inputArtifactId,
            artifactVersion,
          },
          providerOperationId: sourceObject.providerOperationId,
          sha256: extraction.inputSha256,
        })
      : null;
    return Boolean(
      artifact &&
        sourceObject &&
        isValidP0PrismaSourceObjectRow(sourceObject) &&
        artifact.tenantId === batch.tenantId &&
        artifact.consumerId === batch.consumerId &&
        artifact.id === extraction.inputArtifactId &&
        artifact.version === artifactVersion &&
        artifact.kind === "OTHER" &&
        artifact.reportVersionId === batch.reportVersionId &&
        artifact.storageProviderKey === P0_PRISMA_SOURCE_PROVIDER_KEY &&
        artifact.sha256 === extraction.inputSha256 &&
        artifact.mimeType === "text/plain" &&
        artifactBytes !== null &&
        sourceObject.tenantId === batch.tenantId &&
        sourceObject.consumerId === batch.consumerId &&
        sourceObject.ingestionId === batch.ingestionId &&
        sourceObject.artifactId === extraction.inputArtifactId &&
        sourceObject.artifactVersion === artifactVersion &&
        sourceObject.id === physical?.id &&
        STABLE.test(sourceObject.providerOperationId) &&
        sourceObject.providerObjectVersion === physical?.providerObjectVersion &&
        sourceObject.kind === "NORMALIZED_TEXT" &&
        sourceObject.mimeType === "text/plain" &&
        sourceObject.sha256 === extraction.inputSha256 &&
        objectBytes === artifactBytes &&
        sameBytes(
          artifact.storageLocatorCiphertext,
          sourceObject.locatorCiphertext,
        ) &&
        sameBytes(artifact.storageLocatorIv, sourceObject.locatorIv) &&
        sameBytes(
          artifact.storageLocatorAuthTag,
          sourceObject.locatorAuthTag,
        ) &&
        artifact.storageLocatorKeyVersion ===
          sourceObject.locatorKeyVersion &&
        artifact.storageLocatorAlgorithm ===
          sourceObject.locatorAlgorithm &&
        artifact.storageLocatorEnvelopeVersion ===
          sourceObject.locatorEnvelopeVersion &&
        artifact.storageLocatorAadVersion === sourceObject.locatorAadVersion,
    );
  } catch {
    return false;
  }
}

function exactSet<T extends { readonly id: string }>(
  expected: readonly T[],
  stored: readonly any[],
  convert: (row: any, expected: T) => T,
): readonly T[] {
  if (expected.length !== stored.length) throw new Error("readback membership count mismatch");
  const byId = new Map(stored.map((row) => [row.id, row]));
  if (byId.size !== stored.length) throw new Error("duplicate readback identity");
  return Object.freeze(
    expected.map((item) => {
      const row = byId.get(item.id);
      if (!row) throw new Error("missing readback identity");
      return Object.freeze(convert(row, item));
    }),
  );
}

function persistedHistoricalEvidenceType(
  value: P0ShadowTruthGraphBatch["historicalEvidence"][number]["evidenceType"],
):
  | "COLLECTION"
  | "CHARGE_OFF"
  | "DELINQUENCY"
  | "LOSS"
  | "TRANSFER_OR_SALE"
  | "CONSUMER_DISPUTE_REMARK"
  | "OTHER_ADVERSE" {
  switch (value) {
    case "COLLECTION": return "COLLECTION";
    case "CHARGE_OFF": return "CHARGE_OFF";
    case "PAYMENT_DELINQUENCY":
    case "FIRST_DELINQUENCY_DATE":
      return "DELINQUENCY";
    case "LOSS_REPORTED": return "LOSS";
    case "TRANSFER_OR_SALE": return "TRANSFER_OR_SALE";
    case "CONSUMER_DISPUTE_REMARK": return "CONSUMER_DISPUTE_REMARK";
    case "OTHER_ADVERSE_REMARK": return "OTHER_ADVERSE";
    default:
      throw new Error("unsupported historical evidence type");
  }
}

async function readbackBatch(
  transaction: any,
  expected: P0ShadowTruthGraphBatch,
): Promise<P0ShadowTruthGraphBatch> {
  const scope = { tenantId: expected.tenantId, consumerId: expected.consumerId };
  const runId = expected.extractionRun.extractionRunId;
  const reportVersionId = expected.reportVersionId;
  const whereRun = { ...scope, reportVersionId, extractionRunId: runId };
  const extraction = await transaction.extractionRun.findUnique({
    where: {
      tenantId_consumerId_reportVersionId_id: {
        ...scope,
        reportVersionId,
        id: runId,
      },
    },
  });
  if (!extraction) throw new Error("missing extraction readback");
  const [
    coverageRows,
    reportAccountRows,
    presenceRows,
    sectionRows,
    fieldRows,
    historicalRows,
    scoreRows,
    dateRows,
    baselineRows,
    identityRows,
    completenessRows,
  ] = await Promise.all([
    transaction.extractionBureauCoverage.findMany({ where: whereRun }),
    transaction.reportVersionAccount.findMany({ where: { ...scope, reportVersionId } }),
    transaction.accountPresenceObservation.findMany({ where: whereRun }),
    transaction.sectionCompleteness.findMany({ where: whereRun }),
    transaction.fieldObservation.findMany({ where: whereRun }),
    transaction.historicalEvidence.findMany({ where: whereRun }),
    transaction.creditScoreObservation.findMany({ where: whereRun }),
    transaction.bureauReportDateEvidence.findMany({ where: whereRun }),
    transaction.identityBaseline.findMany({ where: whereRun }),
    transaction.identityFact.findMany({ where: whereRun }),
    transaction.round0SourceCompletenessEvidence.findMany({ where: whereRun }),
  ]);
  const accountIds = reportAccountRows.map((row: any) => row.accountId);
  const accountRows = await transaction.account.findMany({
    where: { ...scope, id: { in: accountIds } },
  });

  const storedErrorCodes = extraction.errorCodes as string[];
  const safeErrorRefs = Object.freeze(
    storedErrorCodes.filter((code) => code.startsWith(SAFE_REF_PREFIX)).map(decodeSafeRef),
  );
  const extractionRun = Object.freeze({
    tenantId: extraction.tenantId,
    consumerId: extraction.consumerId,
    reportVersionId: extraction.reportVersionId,
    extractionRunId: extraction.id,
    inputArtifactId: extraction.inputArtifactId,
    inputSha256: extraction.inputSha256,
    inputRepresentation: extraction.inputRepresentation,
    runKey: extraction.runKey,
    attempt: extraction.attempt,
    engine: extraction.engine,
    engineVersion: extraction.engineVersion,
    schemaVersion: extraction.schemaVersion,
    normalizationVersion: extraction.normalizationVersion,
    status: extraction.status,
    errorCodes: Object.freeze(
      storedErrorCodes.filter((code) => !code.startsWith(SAFE_REF_PREFIX)),
    ),
    startedAt: new Date(extraction.startedAt).toISOString(),
    completedAt: new Date(extraction.completedAt).toISOString(),
  });

  const bureauCoverage = exactSet(expected.bureauCoverage, coverageRows, (row) => ({
    id: row.id,
    tenantId: row.tenantId,
    consumerId: row.consumerId,
    reportVersionId: row.reportVersionId,
    extractionRunId: row.extractionRunId,
    bureau: row.bureau,
    coverageStatus: row.coverageStatus,
  }));
  const accounts = exactSet(expected.accounts, accountRows, (row) => ({
    id: row.id,
    tenantId: row.tenantId,
    consumerId: row.consumerId,
    stableKey: row.stableKey,
    authorityStatus: row.authorityStatus,
  }));
  const reportAccounts = exactSet(expected.reportAccounts, reportAccountRows, (row) => ({
    id: row.id,
    tenantId: row.tenantId,
    consumerId: row.consumerId,
    reportVersionId: row.reportVersionId,
    accountId: row.accountId,
    sourceAccountOrdinal: row.sourceAccountOrdinal,
    membershipOrigin: row.membershipOrigin,
    authorityStatus: row.authorityStatus,
  }));
  const accountPresence = exactSet(expected.accountPresence, presenceRows, (row) => ({
    id: row.id,
    tenantId: row.tenantId,
    consumerId: row.consumerId,
    reportVersionId: row.reportVersionId,
    accountId: row.accountId,
    extractionRunId: row.extractionRunId,
    bureau: row.bureau,
    bureauCoverageId: row.bureauCoverageId,
    coverageStatus: row.coverageStatus,
    presence: row.presence,
    observationSeriesKey: row.observationSeriesKey,
    revision: row.revision,
    integritySha256: row.integritySha256,
    sourceLocatorToken: row.sourceLocatorToken,
    parserConfidence: row.parserConfidence === null ? null : Number(row.parserConfidence),
    errorCodes: Object.freeze([...row.errorCodes]),
    accountIndexCompletenessId: row.accountIndexCompletenessId,
  }));
  const sectionCompleteness = exactSet(expected.sectionCompleteness, sectionRows, (row) => ({
    id: row.id,
    tenantId: row.tenantId,
    consumerId: row.consumerId,
    reportVersionId: row.reportVersionId,
    accountId: row.accountId,
    extractionRunId: row.extractionRunId,
    bureau: row.bureau,
    bureauCoverageId: row.bureauCoverageId,
    coverageStatus: row.coverageStatus,
    reportSection: row.reportSection,
    status: row.status,
    requiredFieldKeys: Object.freeze([...row.requiredFieldKeys]),
    observedFieldKeys: Object.freeze([...row.observedFieldKeys]),
    errorCodes: Object.freeze([...row.errorCodes]),
    normalizationRuleKey: row.normalizationRuleKey,
    normalizationRuleVersion: row.normalizationRuleVersion,
  }));
  const fieldObservations = exactSet(expected.fieldObservations, fieldRows, (row) => ({
    id: row.id,
    tenantId: row.tenantId,
    consumerId: row.consumerId,
    reportVersionId: row.reportVersionId,
    accountId: row.accountId,
    extractionRunId: row.extractionRunId,
    bureau: row.bureau,
    bureauCoverageId: row.bureauCoverageId,
    coverageStatus: row.coverageStatus,
    sectionCompletenessId: row.sectionCompletenessId,
    reportSection: row.reportSection,
    sectionStatus: row.sectionStatus,
    fieldKey: row.fieldKey,
    occurrence: row.occurrence,
    presence: row.presence,
    observationSeriesKey: row.observationSeriesKey,
    revision: row.revision,
    integritySha256: row.integritySha256,
    protectedValue: protectedReadback(row, "value"),
    sourceLocatorToken: row.sourceLocatorToken,
    parserConfidence: Number(row.parserConfidence),
    errorCodes: Object.freeze([...row.errorCodes]),
    normalizationRuleKey: row.normalizationRuleKey,
    normalizationRuleVersion: row.normalizationRuleVersion,
  }));
  const historicalEvidence = exactSet(expected.historicalEvidence, historicalRows, (row, expectedRow) => {
    if (row.evidenceType !== persistedHistoricalEvidenceType(expectedRow.evidenceType)) {
      throw new Error("historical evidence type readback mismatch");
    }
    return ({
    id: row.id,
    tenantId: row.tenantId,
    consumerId: row.consumerId,
    reportVersionId: row.reportVersionId,
    accountId: row.accountId,
    extractionRunId: row.extractionRunId,
    bureau: row.bureau,
    bureauCoverageId: row.bureauCoverageId,
    coverageStatus: row.coverageStatus,
    sectionCompletenessId: row.sectionCompletenessId,
    reportSection: row.reportSection,
    sectionStatus: row.sectionStatus,
    evidenceType: expectedRow.evidenceType,
    occurrence: row.occurrence,
    presence: row.presence,
    protectedDetail: protectedReadback(row, "detail")!,
    sourceLocatorToken: row.sourceLocatorToken,
  });
  });
  const creditScoreObservations = exactSet(expected.creditScoreObservations, scoreRows, (row) => ({
    id: row.id,
    tenantId: row.tenantId,
    consumerId: row.consumerId,
    reportVersionId: row.reportVersionId,
    extractionRunId: row.extractionRunId,
    bureau: row.bureau,
    bureauCoverageId: row.bureauCoverageId,
    coverageStatus: row.coverageStatus,
    presence: row.presence === "SCORE_REPORTED" ? "PRESENT" : row.presence === "SCORE_NOT_PROVIDED" ? "NOT_PROVIDED" : "UNKNOWN",
    occurrence: row.occurrence,
    protectedScore: protectedReadback(row, "score"),
    scoreModelPresence: row.scoreModelPresence,
    scoreModelEvidenceValue: row.scoreModelEvidenceValue,
    scoreModelSourceLocatorToken: row.scoreModelSourceLocatorToken,
    scoreScaleMin: row.scoreScaleMin,
    scoreScaleMax: row.scoreScaleMax,
    sourceLocatorToken: row.sourceLocatorToken,
    sourceMethodKey: row.sourceMethodKey,
    sourceMethodVersion: row.sourceMethodVersion,
    parserConfidence: row.parserConfidence === null ? null : Number(row.parserConfidence),
    integritySha256: row.integritySha256,
  }));
  const reportDateEvidence = exactSet(expected.reportDateEvidence, dateRows, (row) => ({
    id: row.id,
    tenantId: row.tenantId,
    consumerId: row.consumerId,
    reportVersionId: row.reportVersionId,
    extractionRunId: row.extractionRunId,
    bureau: row.bureau,
    bureauCoverageId: row.bureauCoverageId,
    coverageStatus: row.coverageStatus,
    presence: row.presence,
    precision: row.precision,
    sourceValue: row.sourceValue,
    provenance: row.provenance,
    sourceLocatorToken: row.sourceLocatorToken,
    integritySha256: row.integritySha256,
  }));
  const identityBaselines = exactSet(expected.identityBaselines, baselineRows, (row) => ({
    id: row.id,
    tenantId: row.tenantId,
    consumerId: row.consumerId,
    reportVersionId: row.reportVersionId,
    reportIngestionId: row.reportIngestionId,
    extractionRunId: row.extractionRunId,
    baselineSeriesKey: row.baselineSeriesKey,
    version: row.version,
    status: row.status,
    policyVersion: row.policyVersion,
    inputSetSha256: row.inputSetSha256,
    createdByActorId: row.createdByActorId,
  }));
  const identityFacts = exactSet(expected.identityFacts, identityRows, (row) => ({
    id: row.id,
    tenantId: row.tenantId,
    consumerId: row.consumerId,
    reportVersionId: row.reportVersionId,
    extractionRunId: row.extractionRunId,
    identityBaselineId: row.identityBaselineId,
    baselineInputSetSha256: row.baselineInputSetSha256,
    factSeriesKey: row.factSeriesKey,
    factOrdinal: row.factOrdinal,
    bureau: row.bureau,
    factType: row.factType,
    classification: row.classification,
    reviewCategory: row.reviewCategory,
    presence: row.presence,
    protectedValue: protectedReadback(row, "value"),
    sourceKind: row.presence === "PRESENT" ? "SOURCE_REPORTED" : "PARSER_UNCERTAINTY",
    integritySha256: row.integritySha256,
    sourceLocatorToken: row.sourceLocatorToken,
  }));
  const round0SourceCompleteness = exactSet(expected.round0SourceCompleteness, completenessRows, (row) => ({
    id: row.id,
    tenantId: row.tenantId,
    consumerId: row.consumerId,
    reportVersionId: row.reportVersionId,
    extractionRunId: row.extractionRunId,
    identityBaselineId: row.identityBaselineId,
    baselineInputSetSha256: row.baselineInputSetSha256,
    bureau: row.bureau,
    coverageStatus: row.coverageStatus,
    bureauCoverageId: row.bureauCoverageId,
    category: row.category,
    status: row.status,
    sourceMemberCount: row.sourceMemberCount,
    sourceMembershipSha256: row.sourceMembershipSha256,
    sourceLocatorToken: row.sourceLocatorToken,
    integritySha256: row.integritySha256,
    ruleKey: row.ruleKey,
    ruleVersion: row.ruleVersion,
  }));

  return Object.freeze({
    contractVersion: expected.contractVersion,
    tenantId: expected.tenantId,
    consumerId: expected.consumerId,
    ingestionId: expected.ingestionId,
    reportVersionId: expected.reportVersionId,
    authorityStatus: expected.authorityStatus,
    legacyWriteAllowed: false,
    extractionRun,
    bureauCoverage,
    round0SourceCompleteness,
    accounts,
    reportAccounts,
    accountPresence,
    sectionCompleteness,
    fieldObservations,
    historicalEvidence,
    creditScoreObservations,
    reportDateEvidence,
    identityBaselines,
    identityFacts,
    safeErrorRefs,
  }) as P0ShadowTruthGraphBatch;
}

async function createGraphRows(transaction: any, batch: P0ShadowTruthGraphBatch): Promise<void> {
  const run = batch.extractionRun;
  await transaction.extractionRun.create({ data: {
    id: run.extractionRunId, tenantId: run.tenantId, consumerId: run.consumerId,
    reportVersionId: run.reportVersionId, runKey: run.runKey, attempt: run.attempt,
    engine: run.engine, engineVersion: run.engineVersion, schemaVersion: run.schemaVersion,
    normalizationVersion: run.normalizationVersion, status: run.status,
    errorCodes: [...errorCodesForStorage(batch)], startedAt: new Date(run.startedAt),
    completedAt: new Date(run.completedAt), inputArtifactId: run.inputArtifactId,
    inputSha256: run.inputSha256, inputRepresentation: run.inputRepresentation,
  }});
  const createMany = async (delegate: any, data: readonly Record<string, unknown>[]) => {
    if (data.length < 1) return;
    const result = await delegate.createMany({ data: [...data] });
    if (result.count !== data.length) throw new Error("partial graph write");
  };
  const createReusableMembership = async (
    delegate: any,
    data: readonly Record<string, unknown>[],
  ) => {
    if (data.length < 1) return;
    // Account identity and ReportVersion membership may already have been
    // established by an earlier exact extraction. Skip only the conflicting
    // insert; the same-transaction full readback below must still prove every
    // expected id and semantic field, so a different row cannot be adopted.
    await delegate.createMany({ data: [...data], skipDuplicates: true });
  };
  await createMany(transaction.extractionBureauCoverage, batch.bureauCoverage.map((row) => ({ ...row })));
  await createReusableMembership(transaction.account, batch.accounts.map((row) => ({ ...row })));
  await createReusableMembership(transaction.reportVersionAccount, batch.reportAccounts.map((row) => ({ ...row })));
  await createMany(transaction.sectionCompleteness, batch.sectionCompleteness.map((row) => ({ ...row })));
  const sectionById = new Map(batch.sectionCompleteness.map((row) => [row.id, row]));
  await createMany(transaction.accountPresenceObservation, batch.accountPresence.map((row) => ({
    ...row,
    accountIndexReportSection: "ACCOUNT_INDEX",
    accountIndexStatus: sectionById.get(row.accountIndexCompletenessId)?.status ?? null,
    observedAt: new Date(run.completedAt),
  })));
  await createMany(transaction.fieldObservation, batch.fieldObservations.map((row) => ({
    id: row.id, tenantId: row.tenantId, consumerId: row.consumerId,
    reportVersionId: row.reportVersionId, accountId: row.accountId,
    extractionRunId: row.extractionRunId, bureau: row.bureau,
    bureauCoverageId: row.bureauCoverageId, coverageStatus: row.coverageStatus,
    observationSeriesKey: row.observationSeriesKey, revision: row.revision,
    integritySha256: row.integritySha256, reportSection: row.reportSection,
    sectionStatus: row.sectionStatus, sectionCompletenessId: row.sectionCompletenessId,
    fieldKey: row.fieldKey, occurrence: row.occurrence, presence: row.presence,
    valueType: "JSON", ...protectedData(row.protectedValue, "value"),
    normalizedCiphertext: null, normalizedIv: null, normalizedAuthTag: null,
    normalizedKeyVersion: null, normalizedAlgorithm: null,
    normalizedEnvelopeVersion: null, normalizedAadVersion: null,
    assessmentSignal: "UNCLASSIFIED", sourceLocatorToken: row.sourceLocatorToken,
    normalizationRuleKey: row.normalizationRuleKey,
    normalizationRuleVersion: row.normalizationRuleVersion,
    parserConfidence: row.parserConfidence, errorCodes: [...row.errorCodes],
    observedAt: new Date(run.completedAt),
  })));
  await createMany(transaction.historicalEvidence, batch.historicalEvidence.map((row) => ({
    id: row.id, tenantId: row.tenantId, consumerId: row.consumerId,
    reportVersionId: row.reportVersionId, accountId: row.accountId,
    extractionRunId: row.extractionRunId, bureau: row.bureau,
    bureauCoverageId: row.bureauCoverageId, coverageStatus: row.coverageStatus,
    reportSection: row.reportSection, sectionStatus: row.sectionStatus,
    sectionCompletenessId: row.sectionCompletenessId,
    evidenceType: persistedHistoricalEvidenceType(row.evidenceType),
    occurrence: row.occurrence, presence: row.presence,
    ...protectedData(row.protectedDetail, "detail"),
    sourceLocatorToken: row.sourceLocatorToken,
    normalizationRuleKey: "PARSER_V2_SHADOW",
    normalizationRuleVersion: run.normalizationVersion,
    parserConfidence: null, observedAt: new Date(run.completedAt),
  })));
  await createMany(transaction.creditScoreObservation, batch.creditScoreObservations.map((row) => ({
    id: row.id, tenantId: row.tenantId, consumerId: row.consumerId,
    reportVersionId: row.reportVersionId, extractionRunId: row.extractionRunId,
    bureau: row.bureau, coverageStatus: row.coverageStatus,
    bureauCoverageId: row.bureauCoverageId, sourceType: "REPORT_DERIVED",
    evidenceRole: "PRIMARY_REPORT_EVIDENCE",
    presence: row.presence === "PRESENT" ? "SCORE_REPORTED" : row.presence === "NOT_PROVIDED" ? "SCORE_NOT_PROVIDED" : "UNKNOWN",
    evidenceCompleteness: row.presence === "PRESENT" ? "COMPLETE" : row.presence === "NOT_PROVIDED" ? "NOT_PROVIDED" : "UNKNOWN",
    observationSeriesKey: `p0-score:${row.id}`, revision: 1, occurrence: row.occurrence,
    idempotencyKey: `p0-score:${row.id}`, integritySha256: row.integritySha256,
    ...protectedData(row.protectedScore, "score"), scoreModelKey: null,
    scoreModelVersion: null, scoreModelPresence: row.scoreModelPresence,
    scoreModelEvidenceValue: row.scoreModelEvidenceValue,
    scoreModelSourceLocatorToken: row.scoreModelSourceLocatorToken,
    scoreScaleMin: row.scoreScaleMin, scoreScaleMax: row.scoreScaleMax,
    // Legacy normalized model metadata remains absent by contract for exact
    // parser evidence; a reported scale alone is therefore PARTIAL. The new
    // independent scoreModelPresence/evidence fields carry source truth.
    modelMetadataCompleteness:
      row.scoreScaleMin !== null && row.scoreScaleMax !== null
        ? "PARTIAL"
        : "UNKNOWN",
    sourceMethodKey: row.sourceMethodKey, sourceMethodVersion: row.sourceMethodVersion,
    sourceLocatorToken: row.sourceLocatorToken, parserConfidence: row.parserConfidence,
    errorCodes: [], normalizationRuleKey: "PARSER_V2_SHADOW",
    normalizationRuleVersion: run.normalizationVersion,
    observedAt: new Date(run.completedAt),
  })));
  await createMany(transaction.bureauReportDateEvidence, batch.reportDateEvidence.map((row) => ({ ...row })));
  await createMany(transaction.identityBaseline, batch.identityBaselines.map((row) => ({
    ...row, sourceIdentityBaselineId: null, supersedesIdentityBaselineId: null,
    semanticSha256: null, expectedIdentityFactCount: null,
    expectedCategoryCompletionCount: null, expectedAccountReviewReceiptCount: null,
    confirmedByActorId: null, confirmedAt: null,
  })));
  await createMany(transaction.identityFact, batch.identityFacts.map((row) => ({
    id: row.id, tenantId: row.tenantId, consumerId: row.consumerId,
    reportVersionId: row.reportVersionId, identityBaselineId: row.identityBaselineId,
    extractionRunId: row.extractionRunId,
    baselineInputSetSha256: row.baselineInputSetSha256,
    factSeriesKey: row.factSeriesKey, factOrdinal: row.factOrdinal, bureau: row.bureau,
    factType: row.factType, classification: row.classification,
    reviewCategory: row.reviewCategory, integritySha256: row.integritySha256,
    presence: row.presence, ...protectedData(row.protectedValue, "value"),
    sourceLocatorToken: row.sourceLocatorToken,
    normalizationRuleKey: row.sourceKind,
    normalizationRuleVersion: run.normalizationVersion,
  })));
  await createMany(transaction.round0SourceCompletenessEvidence, batch.round0SourceCompleteness.map((row) => ({ ...row })));
}

export function createPrismaP0ShadowTruthGraphRepository(
  dependencies: P0PrismaShadowTruthGraphRepositoryDependencies,
): P0ShadowTruthGraphRepository {
  if (!dependencies?.client || !dependencies?.principalRevalidator) {
    throw new Error("authenticated Prisma graph dependencies are required");
  }
  const transactionOptions = Object.freeze({
    isolationLevel: "Serializable" as const,
    maxWait: dependencies.maxWaitMs ?? 5_000,
    timeout: dependencies.timeoutMs ?? 30_000,
  });

  return Object.freeze({
    async persistExact(
      input: Parameters<P0ShadowTruthGraphRepository["persistExact"]>[0],
    ): Promise<P0ShadowTruthGraphRepositoryResult> {
      const permit = input.gatePermit;
      if (
        validateP0Principal(input.principal).length > 0 ||
        !p0PrincipalAuthorizesScope(input.principal, input.scope) ||
        !permit ||
        !p0Phase2AGatePermitAuthorizes({
          permit,
          principal: input.principal,
          scope: input.scope,
          stage: "INGESTION_SHADOW",
          mode: permit.mode,
          operationId: input.operationId,
        }) ||
        !isVerifiedP0ShadowWriterAuthority({
          authority: input.writerAuthority,
          operationId: input.operationId,
          scope: input.scope,
          batch: input.batch,
          sourceRefs: input.sourceRefs,
          now: input.now,
        }) ||
        input.batch.tenantId !== input.scope.tenantId ||
        input.batch.consumerId !== input.scope.consumerId ||
        input.batch.authorityStatus !== "SHADOW_V2" ||
        input.batch.legacyWriteAllowed !== false
      ) {
        return { kind: "DENIED" };
      }
      try {
        return await dependencies.client.$transaction(async (transaction) => {
          const principalValid = await dependencies.principalRevalidator.revalidateInTransaction({
            transaction,
            principal: input.principal,
            scope: input.scope,
            purpose: "SHADOW_EXTRACTION_WRITE",
            operationId: input.operationId,
          }).catch(() => false);
          if (!principalValid) return { kind: "DENIED" } as const;
          if (!isVerifiedP0ShadowWriterAuthority({
            authority: input.writerAuthority,
            operationId: input.operationId,
            scope: input.scope,
            batch: input.batch,
            sourceRefs: input.sourceRefs,
            now: new Date(),
          })) return { kind: "DENIED" } as const;

          const ingestion = await transaction.reportIngestion.findUnique({
            where: { tenantId_consumerId_id: {
              tenantId: input.scope.tenantId,
              consumerId: input.scope.consumerId,
              id: input.batch.ingestionId,
            }},
          });
          if (!ingestion || ingestion.state !== "EXTRACTING" ||
              ingestion.reportVersionId !== input.batch.reportVersionId ||
              ingestion.sourceArtifactId === null ||
              ingestion.sourceReadbackSha256 !== ingestion.sourceSha256) {
            return { kind: "DENIED" } as const;
          }
          const reportVersion = await transaction.reportVersion.findUnique({
            where: { tenantId_consumerId_id: {
              tenantId: input.scope.tenantId,
              consumerId: input.scope.consumerId,
              id: input.batch.reportVersionId,
            }},
          });
          if (!reportVersion || reportVersion.authorityStatus !== "SHADOW_V2" ||
              reportVersion.inputSha256 !== ingestion.sourceSha256) {
            return { kind: "DENIED" } as const;
          }
          if (!(await exactNormalizedInputAuthority({
            transaction,
            batch: input.batch,
            sourceRefs: input.sourceRefs,
          }))) {
            return { kind: "DENIED" } as const;
          }

          const existing = await transaction.extractionRun.findUnique({
            where: { tenantId_consumerId_reportVersionId_id: {
              tenantId: input.scope.tenantId,
              consumerId: input.scope.consumerId,
              reportVersionId: input.batch.reportVersionId,
              id: input.batch.extractionRun.extractionRunId,
            }},
          });
          if (!existing) await createGraphRows(transaction, input.batch);
          const readback = await readbackBatch(transaction, input.batch);
          if (computeP0RepositorySemanticSha256(readback) !== computeP0RepositorySemanticSha256(input.batch)) {
            if (existing) return { kind: "CONFLICT" } as const;
            throw new Error("shadow graph persisted readback mismatch");
          }
          const attestation = await verifyPrismaP0RepositoryReadback({
            operationId: input.operationId,
            purpose: "SHADOW_EXTRACTION_WRITE",
            scope: input.scope,
            expectedSnapshot: input.batch,
            readbackSnapshot: readback,
            sourceRefs: input.sourceRefs,
            verifier: PRISMA_ATTESTATION_VERIFIER,
          });
          // Preserve the full durable extraction-run snapshot in the receipt.
          // P0ExtractionRunReadback is the minimum consumer projection, while
          // the semantic attestation intentionally binds every persisted run
          // field exactly like the accepted local repository contract.
          const runReadback: P0ExtractionRunReadback = readback.extractionRun;
          const extractionRunAttestation = await verifyPrismaP0RepositoryReadback({
            operationId: input.operationId,
            purpose: "SHADOW_EXTRACTION_WRITE",
            scope: input.scope,
            expectedSnapshot: runReadback,
            readbackSnapshot: runReadback,
            sourceRefs: input.sourceRefs,
            verifier: PRISMA_ATTESTATION_VERIFIER,
          });
          if (!attestation || !extractionRunAttestation) {
            if (existing) return { kind: "CONFLICT" } as const;
            throw new Error("shadow graph persisted readback was not attested");
          }
          return {
            kind: existing ? "IDEMPOTENT_REPLAY" : "CREATED",
            value: attestation.snapshot,
            attestation,
            extractionRunAttestation,
          } as const;
        }, transactionOptions);
      } catch (error) {
        rethrowDeadlock(error);
        return { kind: isUniqueConflict(error) ? "CONFLICT" : "OUTCOME_UNKNOWN" };
      }
    },
  });
}
