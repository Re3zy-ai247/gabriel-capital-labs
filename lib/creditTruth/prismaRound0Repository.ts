import { createHash } from "node:crypto";
import type { Bureau } from "@prisma/client";
import type { P0Principal, P0Scope } from "./principal";
import { p0PrincipalAuthorizesScope, validateP0Principal } from "./principal";
import {
  ROUND0_ACCOUNT_REVIEW_CATEGORY,
  consumerAccountReviewReceiptMatchesSource,
  round0AccountReviewSourceFromSeal,
  type ConsumerAccountReviewReceiptRecord,
  type ConsumerAccountReviewRepository,
} from "./accountReview";
import {
  ROUND0_CONTRACT_VERSION,
  ROUND0_FACT_CLASSIFICATIONS,
  computeIdentityCorrespondenceAssertionSeriesKey,
  computeIdentityCorrespondenceAssertionSourceSeriesKey,
  computeRound0SemanticSha256,
  isValidDurableIdentityCategoryCompletionRecord,
  isValidDurableIdentityCorrespondenceAssertionRecord,
  type ConfirmedRound0FactSourceContext,
  type DurableIdentityCorrespondenceAssertionRecord,
  type Round0CompleteSourceAbsenceCandidate,
} from "./round0";
import {
  ROUND0_ACCOUNT_SET_ABSENCE_CONTRACT_VERSION,
  ROUND0_SOURCE_IDENTITY_CATEGORY_KEYS,
  ROUND0_SOURCE_SEAL_CONTRACT_VERSION,
  computeRound0CompletenessSetSha256,
  round0SourceCompletenessSet,
  verifyRound0SourceSnapshot,
  type Round0AccountSetAbsenceCandidate,
  type Round0SourceSnapshot,
  type VerifiedRound0SourceSeal,
} from "./round0SourceSeal";
import {
  ROUND0_CONFIRMED_BASELINE_POLICY_VERSION,
  type Round0BaselineSeriesHeadRead,
  type Round0BaselineSourceRead,
  type Round0ConfirmedBaselinePersistenceBundle,
  type Round0RuntimeRepository,
} from "./round0Runtime";
import { p0Phase2AGatePermitAuthorizes } from "./phase2Flags";
import type {
  P0PrismaTransactionalClient,
  P0PrismaTransactionalPrincipalRevalidator,
} from "./prismaReportIngestionRepository";

export const P0_PRISMA_ROUND0_REPOSITORY_VERSION =
  "p0-prisma-round0-repository-v1" as const;

export interface P0PrismaRound0RepositoryDependencies {
  readonly client: P0PrismaTransactionalClient;
  readonly principalRevalidator: P0PrismaTransactionalPrincipalRevalidator;
  readonly maxWaitMs?: number;
  readonly timeoutMs?: number;
}

export interface P0PrismaRound0Repositories {
  readonly round0: Round0RuntimeRepository;
  readonly accountReview: ConsumerAccountReviewRepository;
}

const STABLE = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,199}$/;
const SHA256 = /^[0-9a-f]{64}$/;

function semantic(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}
function canonical(value: unknown): string {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("non-finite semantic value");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (!value || typeof value !== "object") throw new Error("invalid semantic value");
  const record = value as Readonly<Record<string, unknown>>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
}
function canonicalSemantic(value: unknown): string {
  return createHash("sha256").update(canonical(value), "utf8").digest("hex");
}
function dateIso(value: unknown): string {
  const date = value instanceof Date ? value : new Date(String(value));
  if (!Number.isFinite(date.getTime())) throw new Error("invalid Round 0 timestamp");
  return date.toISOString();
}
function readOperationId(purpose: string, ...refs: readonly string[]): string {
  return `p0read_${semantic([purpose, ...refs]).slice(0, 48)}`;
}
function authorized(principal: P0Principal, scope: P0Scope): boolean {
  return validateP0Principal(principal).length === 0 && p0PrincipalAuthorizesScope(principal, scope);
}
function gateAuthorized(input: { readonly principal: P0Principal; readonly scope: P0Scope; readonly gatePermit: any }): boolean {
  return Boolean(authorized(input.principal, input.scope) && p0Phase2AGatePermitAuthorizes({
    permit: input.gatePermit,
    principal: input.principal,
    scope: input.scope,
    stage: "ROUND0_REVIEW",
    mode: input.gatePermit.mode,
    operationId: input.gatePermit.operationId,
  }));
}
function baselineReadId(baseline: any): string {
  return `p0r0src_${semantic([baseline.tenantId, baseline.consumerId, baseline.id, baseline.version, baseline.inputSetSha256]).slice(0, 48)}`;
}
function headReadId(baseline: any): string {
  return `p0r0head_${semantic([baseline.tenantId, baseline.consumerId, baseline.id, baseline.version, baseline.semanticSha256]).slice(0, 48)}`;
}
function reviewReadId(receipt: ConsumerAccountReviewReceiptRecord): string {
  return `p0r0review_${semantic([receipt.id, receipt.version, receipt.sourceSetSha256]).slice(0, 48)}`;
}
function confirmedBaselineSemanticProjection(
  bundle: Round0ConfirmedBaselinePersistenceBundle,
): unknown {
  const { semanticSha256: _semanticSha256, ...baseline } = bundle.baseline;
  return {
    baseline,
    identityFactPins: [...bundle.identityFactPins].sort(
      (left, right) =>
        left.factOrdinal - right.factOrdinal || left.id.localeCompare(right.id),
    ),
    categoryCompletions: [...bundle.categoryCompletions].sort(
      (left, right) =>
        left.category.localeCompare(right.category) || left.id.localeCompare(right.id),
    ),
    accountReviewMemberships: [...bundle.accountReviewMemberships].sort(
      (left, right) => left.ordinal - right.ordinal || left.id.localeCompare(right.id),
    ),
  };
}
function exactConfirmedBundleAuthority(
  input: Parameters<Round0RuntimeRepository["appendConfirmedRound0Baseline"]>[0],
): boolean {
  const bundle = input.persistence;
  const baseline = bundle?.baseline;
  if (!baseline) return false;
  try {
    return Boolean(
      baseline.tenantId === input.scope.tenantId &&
        baseline.consumerId === input.scope.consumerId &&
        baseline.confirmedByActorId === input.principal.actorId &&
        baseline.createdByActorId === input.principal.actorId &&
        baseline.confirmedAt === input.gatePermit.issuedAt &&
        baseline.status === "CONFIRMED" &&
        baseline.policyVersion === ROUND0_CONFIRMED_BASELINE_POLICY_VERSION &&
        baseline.version >= 2 &&
        baseline.expectedIdentityFactCount === bundle.identityFactPins.length &&
        baseline.expectedCategoryCompletionCount === bundle.categoryCompletions.length &&
        baseline.expectedAccountReviewReceiptCount === bundle.accountReviewMemberships.length &&
        computeRound0SemanticSha256(confirmedBaselineSemanticProjection(bundle)) ===
          baseline.semanticSha256 &&
        new Set(bundle.identityFactPins.map((pin) => pin.id)).size ===
          bundle.identityFactPins.length &&
        new Set(bundle.identityFactPins.map((pin) => pin.factSeriesKey)).size ===
          bundle.identityFactPins.length &&
        bundle.identityFactPins.every(
          (pin, index) =>
            pin.tenantId === baseline.tenantId &&
            pin.consumerId === baseline.consumerId &&
            pin.reportVersionId === baseline.reportVersionId &&
            pin.extractionRunId === baseline.extractionRunId &&
            pin.identityBaselineId === baseline.id &&
            pin.baselineInputSetSha256 === baseline.inputSetSha256 &&
            pin.factOrdinal === index &&
            ROUND0_FACT_CLASSIFICATIONS.includes(pin.classification) &&
            SHA256.test(pin.integritySha256) &&
            (pin.presence === "PRESENT" ||
              (pin.presence === "UNKNOWN" && pin.classification === "REVIEW_NEEDED")),
        ) &&
        new Set(bundle.categoryCompletions.map((item) => item.id)).size ===
          bundle.categoryCompletions.length &&
        new Set(bundle.categoryCompletions.map((item) => item.category)).size ===
          bundle.categoryCompletions.length &&
        bundle.categoryCompletions.every(
          (item) =>
            isValidDurableIdentityCategoryCompletionRecord(item) &&
            item.tenantId === baseline.tenantId &&
            item.consumerId === baseline.consumerId &&
            item.reportVersionId === baseline.reportVersionId &&
            item.extractionRunId === baseline.extractionRunId &&
            item.identityBaselineId === baseline.id &&
            item.identityBaselineVersion === baseline.version &&
            item.baselineInputSetSha256 === baseline.inputSetSha256 &&
            item.completedByActorId === input.principal.actorId &&
            item.completedAt === input.gatePermit.issuedAt,
        ) &&
        new Set(bundle.accountReviewMemberships.map((item) => item.id)).size ===
          bundle.accountReviewMemberships.length &&
        new Set(
          bundle.accountReviewMemberships.map(
            (item) => item.consumerAccountReviewReceiptId,
          ),
        ).size === bundle.accountReviewMemberships.length &&
        bundle.accountReviewMemberships.every(
          (item, index) =>
            item.tenantId === baseline.tenantId &&
            item.consumerId === baseline.consumerId &&
            item.reportVersionId === baseline.reportVersionId &&
            item.extractionRunId === baseline.extractionRunId &&
            item.confirmedIdentityBaselineId === baseline.id &&
            item.confirmedIdentityBaselineVersion === baseline.version &&
            item.confirmedBaselineInputSetSha256 === baseline.inputSetSha256 &&
            item.reviewState !== "REVOKED" &&
            item.ordinal === index,
        )
    );
  } catch {
    return false;
  }
}

async function buildSourceSeal(transaction: any, scope: P0Scope, identityBaselineId: string): Promise<VerifiedRound0SourceSeal | null> {
  const baseline = await transaction.identityBaseline.findFirst({ where: { tenantId: scope.tenantId, consumerId: scope.consumerId, id: identityBaselineId, status: "DRAFT" } });
  if (!baseline || !baseline.reportIngestionId || !baseline.extractionRunId) return null;
  const [reportVersion, ingestion, extraction, coverage, completeness, reportAccounts, presence, identityFacts] = await Promise.all([
    transaction.reportVersion.findFirst({ where: { tenantId: scope.tenantId, consumerId: scope.consumerId, id: baseline.reportVersionId, authorityStatus: "SHADOW_V2" } }),
    transaction.reportIngestion.findFirst({ where: { tenantId: scope.tenantId, consumerId: scope.consumerId, id: baseline.reportIngestionId, reportVersionId: baseline.reportVersionId, extractionRunId: baseline.extractionRunId } }),
    transaction.extractionRun.findFirst({ where: { tenantId: scope.tenantId, consumerId: scope.consumerId, reportVersionId: baseline.reportVersionId, id: baseline.extractionRunId } }),
    transaction.extractionBureauCoverage.findMany({ where: { tenantId: scope.tenantId, consumerId: scope.consumerId, reportVersionId: baseline.reportVersionId, extractionRunId: baseline.extractionRunId }, orderBy: { bureau: "asc" } }),
    transaction.round0SourceCompletenessEvidence.findMany({ where: { tenantId: scope.tenantId, consumerId: scope.consumerId, reportVersionId: baseline.reportVersionId, extractionRunId: baseline.extractionRunId, identityBaselineId: baseline.id }, orderBy: [{ bureau: "asc" }, { category: "asc" }] }),
    transaction.reportVersionAccount.findMany({ where: { tenantId: scope.tenantId, consumerId: scope.consumerId, reportVersionId: baseline.reportVersionId, membershipOrigin: "SOURCE_LISTED", authorityStatus: "SHADOW_V2" }, orderBy: { sourceAccountOrdinal: "asc" } }),
    transaction.accountPresenceObservation.findMany({ where: { tenantId: scope.tenantId, consumerId: scope.consumerId, reportVersionId: baseline.reportVersionId, extractionRunId: baseline.extractionRunId } }),
    transaction.identityFact.findMany({ where: { tenantId: scope.tenantId, consumerId: scope.consumerId, reportVersionId: baseline.reportVersionId, extractionRunId: baseline.extractionRunId, identityBaselineId: baseline.id }, orderBy: { factOrdinal: "asc" } }),
  ]);
  if (!reportVersion || !ingestion || !extraction || !ingestion.sourceArtifactId || !extraction.inputArtifactId || !extraction.inputSha256 || extraction.inputRepresentation !== "DERIVED_NORMALIZED_TEXT" || !["SUCCEEDED", "PARTIAL"].includes(extraction.status)) return null;
  const [sourceArtifact, inputArtifact] = await Promise.all([
    transaction.artifact.findFirst({ where: { tenantId: scope.tenantId, consumerId: scope.consumerId, id: ingestion.sourceArtifactId, reportVersionId: baseline.reportVersionId, kind: "REPORT_SOURCE", sha256: ingestion.sourceSha256 } }),
    transaction.artifact.findFirst({ where: { tenantId: scope.tenantId, consumerId: scope.consumerId, id: extraction.inputArtifactId, reportVersionId: baseline.reportVersionId, kind: "OTHER", mimeType: "text/plain", sha256: extraction.inputSha256 } }),
  ]);
  if (!sourceArtifact || !inputArtifact) return null;
  const inputSourceObject = await transaction.p0SourceObject.findFirst({
    where: {
      tenantId: scope.tenantId,
      consumerId: scope.consumerId,
      ingestionId: ingestion.id,
      artifactId: inputArtifact.id,
      artifactVersion: inputArtifact.version,
      kind: "NORMALIZED_TEXT",
      sha256: inputArtifact.sha256,
    },
  });
  if (!inputSourceObject || inputArtifact.id === sourceArtifact.id) return null;
  const presenceByAccount = new Map(presence.map((row: any) => [row.accountId, row]));
  const accountMembers = reportAccounts.map((account: any) => {
    const observed: any = presenceByAccount.get(account.accountId);
    if (!observed || observed.coverageStatus !== "COVERED" || !["PRESENT", "UNKNOWN"].includes(observed.presence)) throw new Error("invalid source-listed account membership");
    return Object.freeze({
      reportAccountId: account.id, accountId: account.accountId, sourceAccountOrdinal: account.sourceAccountOrdinal,
      membershipOrigin: "SOURCE_LISTED" as const, authorityStatus: "SHADOW_V2" as const,
      bureau: observed.bureau, bureauCoverageId: observed.bureauCoverageId, coverageStatus: "COVERED" as const,
      accountPresenceId: observed.id, accountPresence: observed.presence,
      accountPresenceSeriesKey: observed.observationSeriesKey, accountPresenceRevision: observed.revision,
      accountPresenceIntegritySha256: observed.integritySha256, accountPresenceSourceLocatorToken: observed.sourceLocatorToken,
      accountIndexCompletenessId: observed.accountIndexCompletenessId, accountIndexStatus: observed.accountIndexStatus,
    });
  });
  const snapshot: Round0SourceSnapshot = Object.freeze({
    contractVersion: ROUND0_SOURCE_SEAL_CONTRACT_VERSION,
    repositoryReadId: baselineReadId(baseline), tenantId: scope.tenantId, consumerId: scope.consumerId,
    reportIngestionId: ingestion.id, reportVersionId: reportVersion.id,
    reportSeriesKey: reportVersion.reportSeriesKey, reportVersion: reportVersion.version,
    reportSourceSha256: ingestion.sourceSha256,
    sourceArtifact: Object.freeze({ artifactId: sourceArtifact.id, artifactVersion: sourceArtifact.version, kind: "REPORT_SOURCE", representation: "ORIGINAL_BYTES", sha256: sourceArtifact.sha256 }),
    extractionRunId: extraction.id, extractionStatus: extraction.status,
    inputArtifact: Object.freeze({ artifactId: inputArtifact.id, artifactVersion: inputArtifact.version, kind: "NORMALIZED_TEXT", representation: "DERIVED_NORMALIZED_TEXT", sha256: inputArtifact.sha256 }),
    identityBaselineId: baseline.id, baselineSeriesKey: baseline.baselineSeriesKey, baselineVersion: baseline.version,
    expectedCoverageCount: coverage.length,
    coverage: Object.freeze(coverage.map((row: any) => Object.freeze({ bureauCoverageId: row.id, bureau: row.bureau, coverageStatus: row.coverageStatus }))),
    expectedCompletenessCount: completeness.length,
    completenessMembers: Object.freeze(completeness.map((row: any) => Object.freeze({
      id: row.id, bureau: row.bureau, coverageStatus: row.coverageStatus, bureauCoverageId: row.bureauCoverageId,
      identityBaselineId: row.identityBaselineId, baselineInputSetSha256: row.baselineInputSetSha256,
      category: row.category, status: row.status, sourceMemberCount: row.sourceMemberCount,
      sourceMembershipSha256: row.sourceMembershipSha256, sourceLocatorToken: row.sourceLocatorToken,
      integritySha256: row.integritySha256, ruleKey: row.ruleKey, ruleVersion: row.ruleVersion,
    }))),
    expectedAccountMemberCount: accountMembers.length, accountMembers: Object.freeze(accountMembers),
    expectedIdentityFactCount: identityFacts.length,
    identityFacts: Object.freeze(identityFacts.map((row: any) => Object.freeze({
      identityFactId: row.id, factSeriesKey: row.factSeriesKey, factOrdinal: row.factOrdinal,
      categoryKey: row.reviewCategory, bureau: row.bureau, presence: row.presence,
      sourceKind: row.presence === "PRESENT" ? "SOURCE_REPORTED" : "PARSER_UNCERTAINTY",
      classification: row.classification, integritySha256: row.integritySha256, sourceLocatorToken: row.sourceLocatorToken,
    }))),
  });
  return verifyRound0SourceSnapshot(snapshot, {
    verifierId: "p0-prisma-round0-source-v1",
    async verifyExactRound0SourceSnapshot({ sourceSetSha256 }) {
      return sourceSetSha256 === baseline.inputSetSha256;
    },
  });
}

async function readBaselineSource(transaction: any, scope: P0Scope, identityBaselineId: string): Promise<Round0BaselineSourceRead | null> {
  const seal = await buildSourceSeal(transaction, scope, identityBaselineId);
  if (!seal) return null;
  return Object.freeze({
    repositoryReadId: seal.repositoryReadId, tenantId: seal.tenantId, consumerId: seal.consumerId,
    reportIngestionId: seal.reportIngestionId, reportVersionId: seal.reportVersionId,
    extractionRunId: seal.extractionRunId, identityBaselineId: seal.identityBaselineId,
    baselineSeriesKey: seal.baselineSeriesKey, baselineVersion: seal.baselineVersion,
    status: "DRAFT", inputSetSha256: seal.sourceSetSha256, sourceSeal: seal,
    requiredCategorySlots: Object.freeze(ROUND0_SOURCE_IDENTITY_CATEGORY_KEYS.map((categoryKey) => Object.freeze({ categoryKey }))),
    facts: Object.freeze(seal.identityFacts.map((fact) => Object.freeze({
      tenantId: seal.tenantId, consumerId: seal.consumerId, reportVersionId: seal.reportVersionId,
      extractionRunId: seal.extractionRunId, identityBaselineId: seal.identityBaselineId,
      baselineSeriesKey: seal.baselineSeriesKey, baselineVersion: seal.baselineVersion,
      baselineInputSetSha256: seal.sourceSetSha256, identityFactId: fact.identityFactId,
      factSeriesKey: fact.factSeriesKey, categoryKey: fact.categoryKey, bureau: fact.bureau,
      sourceLocatorToken: fact.sourceLocatorToken, integritySha256: fact.integritySha256,
      presence: fact.presence, sourceKind: fact.sourceKind, classification: fact.classification,
    }))),
  });
}

async function readHead(transaction: any, scope: P0Scope, seriesKey: string, sourceId: string): Promise<Round0BaselineSeriesHeadRead | null> {
  const row = await transaction.identityBaseline.findFirst({ where: { tenantId: scope.tenantId, consumerId: scope.consumerId, baselineSeriesKey: seriesKey, OR: [{ id: sourceId }, { sourceIdentityBaselineId: sourceId }] }, orderBy: { version: "desc" } });
  if (!row) return null;
  const successor = await transaction.identityBaseline.findFirst({ where: { tenantId: scope.tenantId, consumerId: scope.consumerId, supersedesIdentityBaselineId: row.id }, select: { id: true } });
  if (successor) return null;
  return Object.freeze({
    repositoryReadId: headReadId(row), tenantId: row.tenantId, consumerId: row.consumerId,
    reportIngestionId: row.reportIngestionId, reportVersionId: row.reportVersionId,
    extractionRunId: row.extractionRunId, identityBaselineId: row.id,
    sourceIdentityBaselineId: row.sourceIdentityBaselineId, supersedesIdentityBaselineId: row.supersedesIdentityBaselineId,
    baselineSeriesKey: row.baselineSeriesKey, baselineVersion: row.version, status: row.status,
    inputSetSha256: row.inputSetSha256, semanticSha256: row.semanticSha256,
    expectedIdentityFactCount: row.expectedIdentityFactCount,
    expectedCategoryCompletionCount: row.expectedCategoryCompletionCount,
    expectedAccountReviewReceiptCount: row.expectedAccountReviewReceiptCount,
    supersededByIdentityBaselineId: null,
  });
}

function receiptFromRow(row: any): ConsumerAccountReviewReceiptRecord {
  return Object.freeze({
    id: row.id, tenantId: row.tenantId, consumerId: row.consumerId,
    reportVersionId: row.reportVersionId, extractionRunId: row.extractionRunId,
    identityBaselineId: row.identityBaselineId, identityBaselineVersion: row.identityBaselineVersion,
    baselineInputSetSha256: row.baselineInputSetSha256, bureau: row.bureau, accountId: row.accountId,
    reportVersionAccountId: row.reportVersionAccountId, accountPresenceObservationId: row.accountPresenceObservationId,
    accountPresenceObservationRevision: row.accountPresenceObservationRevision,
    accountPresenceIntegritySha256: row.accountPresenceIntegritySha256,
    accountPresenceSourceLocatorToken: row.accountPresenceSourceLocatorToken,
    accountIndexCompletenessEvidenceId: row.accountIndexCompletenessEvidenceId,
    accountIndexSourceMembershipSha256: row.accountIndexSourceMembershipSha256,
    accountIndexCompletenessIntegritySha256: row.accountIndexCompletenessIntegritySha256,
    sourceSeriesKey: row.sourceSeriesKey, reviewSeriesKey: row.reviewSeriesKey, version: row.version,
    reviewState: row.reviewState, sourceSetSha256: row.sourceSetSha256,
    authorizationKind: row.authorizationKind, authorizationVersion: row.authorizationVersion,
    reviewedByActorId: row.reviewedByActorId, reviewedAt: dateIso(row.reviewedAt),
    supersedesReviewId: row.supersedesReviewId,
  });
}

async function readReceipt(transaction: any, scope: P0Scope, id: string): Promise<ConsumerAccountReviewReceiptRecord | null> {
  const row = await transaction.consumerAccountReviewReceipt.findFirst({ where: { tenantId: scope.tenantId, consumerId: scope.consumerId, id } });
  return row ? receiptFromRow(row) : null;
}

async function readConfirmedBundle(transaction: any, scope: P0Scope, id: string): Promise<Round0ConfirmedBaselinePersistenceBundle | null> {
  const baseline = await transaction.identityBaseline.findFirst({ where: { tenantId: scope.tenantId, consumerId: scope.consumerId, id, status: "CONFIRMED" } });
  if (!baseline) return null;
  const [facts, completions, memberships] = await Promise.all([
    transaction.identityFact.findMany({ where: { tenantId: scope.tenantId, consumerId: scope.consumerId, identityBaselineId: id }, orderBy: { factOrdinal: "asc" } }),
    transaction.identityCategoryCompletion.findMany({ where: { tenantId: scope.tenantId, consumerId: scope.consumerId, identityBaselineId: id }, orderBy: { category: "asc" } }),
    transaction.identityBaselineAccountReviewMembership.findMany({ where: { tenantId: scope.tenantId, consumerId: scope.consumerId, confirmedIdentityBaselineId: id }, orderBy: { ordinal: "asc" } }),
  ]);
  return Object.freeze({
    baseline: Object.freeze({
      id: baseline.id, tenantId: baseline.tenantId, consumerId: baseline.consumerId,
      reportIngestionId: baseline.reportIngestionId, reportVersionId: baseline.reportVersionId,
      extractionRunId: baseline.extractionRunId, sourceIdentityBaselineId: baseline.sourceIdentityBaselineId,
      supersedesIdentityBaselineId: baseline.supersedesIdentityBaselineId,
      baselineSeriesKey: baseline.baselineSeriesKey, version: baseline.version, status: "CONFIRMED",
      policyVersion: ROUND0_CONFIRMED_BASELINE_POLICY_VERSION, inputSetSha256: baseline.inputSetSha256,
      expectedIdentityFactCount: baseline.expectedIdentityFactCount,
      expectedCategoryCompletionCount: baseline.expectedCategoryCompletionCount,
      expectedAccountReviewReceiptCount: baseline.expectedAccountReviewReceiptCount,
      confirmedByActorId: baseline.confirmedByActorId, confirmedAt: dateIso(baseline.confirmedAt),
      createdByActorId: baseline.createdByActorId, semanticSha256: baseline.semanticSha256,
    }),
    identityFactPins: Object.freeze(facts.map((row: any) => Object.freeze({
      id: row.id, tenantId: row.tenantId, consumerId: row.consumerId, reportVersionId: row.reportVersionId,
      extractionRunId: row.extractionRunId, identityBaselineId: row.identityBaselineId,
      baselineInputSetSha256: row.baselineInputSetSha256, factSeriesKey: row.factSeriesKey,
      factOrdinal: row.factOrdinal, bureau: row.bureau, classification: row.classification,
      reviewCategory: row.reviewCategory, integritySha256: row.integritySha256,
      presence: row.presence, sourceLocatorToken: row.sourceLocatorToken,
    }))),
    categoryCompletions: Object.freeze(completions.map((row: any) => Object.freeze({
      id: row.id, tenantId: row.tenantId, consumerId: row.consumerId, reportVersionId: row.reportVersionId,
      extractionRunId: row.extractionRunId, identityBaselineId: row.identityBaselineId,
      identityBaselineVersion: row.identityBaselineVersion, baselineInputSetSha256: row.baselineInputSetSha256,
      category: row.category, disposition: row.disposition, sourceCompletenessSha256: row.sourceCompletenessSha256,
      sourceCompletenessAttestationKey: row.sourceCompletenessAttestationKey,
      sourceCompletenessRuleVersion: row.sourceCompletenessRuleVersion,
      sourceCompletenessEvidenceCount: row.sourceCompletenessEvidenceCount,
      equifaxSourceCompletenessEvidenceId: row.equifaxSourceCompletenessEvidenceId,
      experianSourceCompletenessEvidenceId: row.experianSourceCompletenessEvidenceId,
      transunionSourceCompletenessEvidenceId: row.transunionSourceCompletenessEvidenceId,
      completedByActorId: row.completedByActorId, completedAt: dateIso(row.completedAt),
    }))),
    accountReviewMemberships: Object.freeze(memberships.map((row: any) => Object.freeze({
      id: row.id, tenantId: row.tenantId, consumerId: row.consumerId, reportVersionId: row.reportVersionId,
      extractionRunId: row.extractionRunId, confirmedIdentityBaselineId: row.confirmedIdentityBaselineId,
      confirmedIdentityBaselineVersion: row.confirmedIdentityBaselineVersion,
      confirmedBaselineInputSetSha256: row.confirmedBaselineInputSetSha256,
      consumerAccountReviewReceiptId: row.consumerAccountReviewReceiptId, reviewSeriesKey: row.reviewSeriesKey,
      reviewVersion: row.reviewVersion, reviewState: row.reviewState, receiptSourceSetSha256: row.receiptSourceSetSha256,
      bureau: row.bureau, accountId: row.accountId, reportVersionAccountId: row.reportVersionAccountId, ordinal: row.ordinal,
    }))),
  });
}

function identityAssertionFromRow(row: any): DurableIdentityCorrespondenceAssertionRecord {
  return Object.freeze({ id: row.id, tenantId: row.tenantId, consumerId: row.consumerId,
    reportVersionId: row.reportVersionId, extractionRunId: row.extractionRunId,
    identityBaselineId: row.identityBaselineId, identityBaselineVersion: row.identityBaselineVersion,
    baselineInputSetSha256: row.baselineInputSetSha256, identityFactSeriesKey: row.identityFactSeriesKey,
    identityFactId: row.identityFactId, identityFactClassification: row.identityFactClassification,
    identityFactIntegritySha256: row.identityFactIntegritySha256, factBureau: row.factBureau,
    factSourceLocatorToken: row.factSourceLocatorToken, correspondencePurposeCode: row.correspondencePurposeCode,
    sourceSeriesKey: row.sourceSeriesKey, assertionSeriesKey: row.assertionSeriesKey,
    version: row.version, status: row.status, sourceSetSha256: row.sourceSetSha256,
    attestedByActorId: row.attestedByActorId, attestedAt: dateIso(row.attestedAt),
    supersedesAssertionId: row.supersedesAssertionId });
}

export function createP0PrismaRound0Repositories(dependencies: P0PrismaRound0RepositoryDependencies): P0PrismaRound0Repositories {
  const options = { isolationLevel: "Serializable" as const, maxWait: dependencies.maxWaitMs ?? 5_000, timeout: dependencies.timeoutMs ?? 10_000 };
  const inTransaction = async <T>(input: { principal: P0Principal; scope: P0Scope; purpose: string; operationId: string }, work: (transaction: any) => Promise<T>, denied: T | (() => T)): Promise<T> => dependencies.client.$transaction(async (transaction: any) => {
    const live = await dependencies.principalRevalidator.revalidateInTransaction({ transaction, ...input });
    return live
      ? work(transaction)
      : typeof denied === "function"
        ? (denied as () => T)()
        : denied;
  }, options);

  const accountReview: ConsumerAccountReviewRepository = Object.freeze({
    async readRound0AccountReviewSource(input: Parameters<ConsumerAccountReviewRepository["readRound0AccountReviewSource"]>[0]) {
      if (!authorized(input.principal, input.scope)) return null;
      return inTransaction({ principal: input.principal, scope: input.scope, purpose: input.purpose, operationId: readOperationId(input.purpose, input.identityBaselineId, input.reportVersionAccountId) }, async (transaction) => {
        const seal = await buildSourceSeal(transaction, input.scope, input.identityBaselineId);
        return seal && seal.sourceSetSha256 === input.baselineInputSetSha256 && round0AccountReviewSourceFromSeal({ seal, reportVersionAccountId: input.reportVersionAccountId, bureau: input.bureau })
          ? Object.freeze({ repositoryReadId: baselineReadId({ tenantId: input.scope.tenantId, consumerId: input.scope.consumerId, id: input.identityBaselineId, version: seal.baselineVersion, inputSetSha256: seal.sourceSetSha256 }), sourceSeal: seal })
          : null;
      }, null);
    },
    async readConsumerAccountReviewReceipt(input: Parameters<ConsumerAccountReviewRepository["readConsumerAccountReviewReceipt"]>[0]) {
      if (!gateAuthorized(input)) return null;
      return inTransaction({ principal: input.principal, scope: input.scope, purpose: input.purpose, operationId: input.gatePermit.operationId }, (transaction) => readReceipt(transaction, input.scope, input.reviewId), null);
    },
    async appendConsumerAccountReviewReceipt(input: Parameters<ConsumerAccountReviewRepository["appendConsumerAccountReviewReceipt"]>[0]) {
      if (
        !gateAuthorized(input) ||
        input.principal.authorizationKind !== "DIRECT_CONSUMER" ||
        input.receipt.reviewedByActorId !== input.principal.actorId ||
        input.receipt.authorizationVersion !== input.principal.authorizationVersion ||
        input.receipt.reviewedAt !== input.gatePermit.issuedAt ||
        (input.receipt.version === 1 &&
          (input.receipt.supersedesReviewId !== null ||
            input.receipt.reviewState === "REVOKED"))
      ) throw new Error("account review authority denied");
      return inTransaction({ principal: input.principal, scope: input.scope, purpose: input.purpose, operationId: input.gatePermit.operationId }, async (transaction) => {
        const seal = await buildSourceSeal(transaction, input.scope, input.receipt.identityBaselineId);
        const exactSource = seal ? round0AccountReviewSourceFromSeal({ seal, reportVersionAccountId: input.receipt.reportVersionAccountId, bureau: input.receipt.bureau }) : null;
        if (!seal || input.sourceReadId !== seal.repositoryReadId || !exactSource || !consumerAccountReviewReceiptMatchesSource(input.receipt, exactSource)) throw new Error("account review source changed");
        const existing = await readReceipt(transaction, input.scope, input.receipt.id);
        let disposition: "CREATED" | "IDEMPOTENT_REPLAY" = "CREATED";
        if (existing) {
          if (semantic(existing) !== semantic(input.receipt)) throw new Error("account review replay conflict");
          disposition = "IDEMPOTENT_REPLAY";
        } else {
          if (input.receipt.version > 1) {
            const prior = await transaction.consumerAccountReviewReceipt.findFirst({ where: { tenantId: input.scope.tenantId, consumerId: input.scope.consumerId, id: input.receipt.supersedesReviewId, reviewSeriesKey: input.receipt.reviewSeriesKey, version: input.receipt.version - 1 } });
            if (!prior || await transaction.consumerAccountReviewReceipt.findFirst({ where: { tenantId: input.scope.tenantId, consumerId: input.scope.consumerId, supersedesReviewId: prior.id } })) throw new Error("account review predecessor changed");
          }
          await transaction.consumerAccountReviewReceipt.create({ data: { ...input.receipt, reviewedAt: new Date(input.receipt.reviewedAt) } });
        }
        const persisted = await readReceipt(transaction, input.scope, input.receipt.id);
        if (!persisted || semantic(persisted) !== semantic(input.receipt)) throw new Error("account review readback mismatch");
        return Object.freeze({ disposition });
      }, () => { throw new Error("live principal revalidation failed"); });
    },
  });

  const round0: Round0RuntimeRepository = Object.freeze({
    verifierId: "p0-prisma-round0-account-absence-v1",
    async verifyCompleteSourceAbsence(
      { candidate, semanticSha256, sourceSealSha256 }: Parameters<Round0RuntimeRepository["verifyCompleteSourceAbsence"]>[0],
    ) {
      if (computeRound0SemanticSha256(candidate) !== semanticSha256) return false;
      return dependencies.client.$transaction(async (transaction: any) => {
        const seal = await buildSourceSeal(
          transaction,
          { tenantId: candidate.tenantId, consumerId: candidate.consumerId },
          candidate.identityBaselineId,
        );
        const set = seal
          ? round0SourceCompletenessSet(seal, candidate.categoryKey as any)
          : null;
        return Boolean(
          seal &&
            seal.sourceSetSha256 === sourceSealSha256 &&
            candidate.sourceSetSha256 === seal.sourceSetSha256 &&
            candidate.repositoryReadId === seal.repositoryReadId &&
            set &&
            set.every((member) => member.status === "COMPLETE") &&
            computeRound0CompletenessSetSha256(set) ===
              candidate.sourceCompletenessSha256 &&
            !seal.identityFacts.some(
              (fact) => fact.categoryKey === candidate.categoryKey,
            ),
        );
      }, options);
    },
    async verifyExactEmptyRound0AccountSet(
      { candidate, semanticSha256, sourceSealSha256 }: Parameters<Round0RuntimeRepository["verifyExactEmptyRound0AccountSet"]>[0],
    ) {
      if (canonicalSemantic(candidate) !== semanticSha256) return false;
      return dependencies.client.$transaction(async (transaction: any) => {
        const seal = await buildSourceSeal(
          transaction,
          { tenantId: candidate.tenantId, consumerId: candidate.consumerId },
          candidate.identityBaselineId,
        );
        const set = seal
          ? round0SourceCompletenessSet(seal, ROUND0_ACCOUNT_REVIEW_CATEGORY)
          : null;
        return Boolean(
          seal &&
            seal.sourceSetSha256 === sourceSealSha256 &&
            candidate.sourceSetSha256 === seal.sourceSetSha256 &&
            candidate.repositoryReadId === seal.repositoryReadId &&
            seal.extractionStatus === "SUCCEEDED" &&
            seal.accountMembers.length === 0 &&
            set &&
            set.every((member) => member.status === "COMPLETE") &&
            computeRound0CompletenessSetSha256(set) ===
              candidate.sourceCompletenessSha256,
        );
      }, options);
    },
    async readRound0Baseline(input: Parameters<Round0RuntimeRepository["readRound0Baseline"]>[0]) {
      if (!authorized(input.principal, input.scope)) return null;
      return inTransaction({ principal: input.principal, scope: input.scope, purpose: input.purpose, operationId: readOperationId(input.purpose, input.identityBaselineId) }, (transaction) => readBaselineSource(transaction, input.scope, input.identityBaselineId), null);
    },
    async readCurrentRound0BaselineSeriesHead(input: Parameters<Round0RuntimeRepository["readCurrentRound0BaselineSeriesHead"]>[0]) {
      if (!authorized(input.principal, input.scope)) return null;
      return inTransaction({ principal: input.principal, scope: input.scope, purpose: input.purpose, operationId: readOperationId(input.purpose, input.baselineSeriesKey, input.sourceIdentityBaselineId) }, (transaction) => readHead(transaction, input.scope, input.baselineSeriesKey, input.sourceIdentityBaselineId), null);
    },
    async readCompleteCategoryAbsence(input: Parameters<Round0RuntimeRepository["readCompleteCategoryAbsence"]>[0]) {
      if (!authorized(input.principal, input.scope)) return null;
      return inTransaction({ principal: input.principal, scope: input.scope, purpose: input.purpose, operationId: readOperationId(input.purpose, input.identityBaselineId, input.categoryKey) }, async (transaction) => {
        const source = await readBaselineSource(transaction, input.scope, input.identityBaselineId);
        if (!source || source.facts.some((fact) => fact.categoryKey === input.categoryKey)) return null;
        const set = round0SourceCompletenessSet(source.sourceSeal, input.categoryKey as any);
        if (!set || set.some((member) => member.status !== "COMPLETE")) return null;
        const candidate: Round0CompleteSourceAbsenceCandidate = Object.freeze({
          contractVersion: ROUND0_CONTRACT_VERSION, attestationId: `p0absence_${semantic([source.inputSetSha256, input.categoryKey]).slice(0, 48)}`,
          repositoryReadId: source.repositoryReadId, tenantId: input.scope.tenantId, consumerId: input.scope.consumerId,
          reportVersionId: source.reportVersionId, extractionRunId: source.extractionRunId,
          identityBaselineId: source.identityBaselineId, baselineSeriesKey: source.baselineSeriesKey,
          baselineVersion: source.baselineVersion, baselineInputSetSha256: source.inputSetSha256,
          categoryKey: input.categoryKey, expectedCompletenessEvidenceCount: 3,
          completenessEvidence: set, sourceCompletenessSha256: computeRound0CompletenessSetSha256(set),
          matchingFactIds: Object.freeze([]), sourceSetSha256: source.inputSetSha256,
          observedAt: dateIso((await transaction.extractionRun.findFirst({ where: { tenantId: input.scope.tenantId, consumerId: input.scope.consumerId, id: source.extractionRunId } })).completedAt),
        });
        return candidate;
      }, null);
    },
    async readCompleteAccountSetAbsence(input: Parameters<Round0RuntimeRepository["readCompleteAccountSetAbsence"]>[0]) {
      if (!authorized(input.principal, input.scope)) return null;
      return inTransaction({ principal: input.principal, scope: input.scope, purpose: input.purpose, operationId: readOperationId(input.purpose, input.identityBaselineId, input.attestationId) }, async (transaction) => {
        const source = await readBaselineSource(transaction, input.scope, input.identityBaselineId);
        if (!source || source.sourceSeal.accountMembers.length !== 0 || source.sourceSeal.extractionStatus !== "SUCCEEDED") return null;
        const set = round0SourceCompletenessSet(source.sourceSeal, ROUND0_ACCOUNT_REVIEW_CATEGORY);
        if (!set || set.some((member) => member.status !== "COMPLETE")) return null;
        const candidate: Round0AccountSetAbsenceCandidate = Object.freeze({
          contractVersion: ROUND0_ACCOUNT_SET_ABSENCE_CONTRACT_VERSION, attestationId: input.attestationId,
          repositoryReadId: source.repositoryReadId, tenantId: input.scope.tenantId, consumerId: input.scope.consumerId,
          reportVersionId: source.reportVersionId, extractionRunId: source.extractionRunId,
          identityBaselineId: source.identityBaselineId, baselineSeriesKey: source.baselineSeriesKey,
          baselineVersion: source.baselineVersion, sourceSetSha256: source.inputSetSha256,
          expectedCompletenessEvidenceCount: 3, completenessEvidence: set,
          sourceCompletenessSha256: computeRound0CompletenessSetSha256(set), extractionStatus: "SUCCEEDED",
          expectedAccountMemberCount: 0, accountMemberIds: Object.freeze([]) as readonly [],
          observedAt: dateIso((await transaction.extractionRun.findFirst({ where: { tenantId: input.scope.tenantId, consumerId: input.scope.consumerId, id: source.extractionRunId } })).completedAt),
        });
        return candidate;
      }, null);
    },
    async readCurrentConsumerAccountReviewReceipt(input: Parameters<Round0RuntimeRepository["readCurrentConsumerAccountReviewReceipt"]>[0]) {
      if (!gateAuthorized(input)) return null;
      return inTransaction({ principal: input.principal, scope: input.scope, purpose: input.purpose, operationId: input.gatePermit.operationId }, async (transaction) => {
        const receipt = await readReceipt(transaction, input.scope, input.reviewId);
        if (!receipt || await transaction.consumerAccountReviewReceipt.findFirst({ where: { tenantId: input.scope.tenantId, consumerId: input.scope.consumerId, supersedesReviewId: receipt.id } })) return null;
        return Object.freeze({ repositoryReadId: reviewReadId(receipt), receipt, supersededByReviewId: null });
      }, null);
    },
    async appendConfirmedRound0Baseline(input: Parameters<Round0RuntimeRepository["appendConfirmedRound0Baseline"]>[0]) {
      if (
        !gateAuthorized(input) ||
        input.principal.authorizationKind !== "DIRECT_CONSUMER" ||
        !exactConfirmedBundleAuthority(input)
      ) throw new Error("Round 0 confirmation authority denied");
      return inTransaction({ principal: input.principal, scope: input.scope, purpose: input.purpose, operationId: input.gatePermit.operationId }, async (transaction) => {
        const source = await readBaselineSource(transaction, input.scope, input.persistence.baseline.sourceIdentityBaselineId);
        const head = source ? await readHead(transaction, input.scope, source.baselineSeriesKey, source.identityBaselineId) : null;
        const target = input.persistence.baseline;
        if (
          !source ||
          !head ||
          source.repositoryReadId !== input.sourceReadId ||
          head.repositoryReadId !== input.currentHeadReadId ||
          head.identityBaselineId !== target.supersedesIdentityBaselineId ||
          target.sourceIdentityBaselineId !== source.identityBaselineId ||
          target.reportIngestionId !== source.reportIngestionId ||
          target.reportVersionId !== source.reportVersionId ||
          target.extractionRunId !== source.extractionRunId ||
          target.baselineSeriesKey !== source.baselineSeriesKey ||
          target.inputSetSha256 !== source.inputSetSha256 ||
          target.version !== head.baselineVersion + 1 ||
          input.persistence.identityFactPins.length !== source.facts.length ||
          input.persistence.accountReviewMemberships.length !==
            source.sourceSeal.accountMembers.length
        ) throw new Error("Round 0 source/head changed");
        for (const membership of input.persistence.accountReviewMemberships) {
          const receipt = await transaction.consumerAccountReviewReceipt.findFirst({
            where: {
              tenantId: input.scope.tenantId,
              consumerId: input.scope.consumerId,
              id: membership.consumerAccountReviewReceiptId,
              reviewSeriesKey: membership.reviewSeriesKey,
              version: membership.reviewVersion,
              reviewState: membership.reviewState,
              sourceSetSha256: membership.receiptSourceSetSha256,
              bureau: membership.bureau,
              accountId: membership.accountId,
              reportVersionAccountId: membership.reportVersionAccountId,
            },
          });
          const successor = receipt
            ? await transaction.consumerAccountReviewReceipt.findFirst({
                where: {
                  tenantId: input.scope.tenantId,
                  consumerId: input.scope.consumerId,
                  supersedesReviewId: receipt.id,
                },
                select: { id: true },
              })
            : null;
          if (!receipt || receipt.reviewState === "REVOKED" || successor) {
            throw new Error("Round 0 account review membership changed");
          }
        }
        const existing = await readConfirmedBundle(transaction, input.scope, input.persistence.baseline.id);
        let disposition: "CREATED" | "IDEMPOTENT_REPLAY" = "CREATED";
        if (existing) {
          if (semantic(existing) !== semantic(input.persistence)) throw new Error("Round 0 replay conflict");
          disposition = "IDEMPOTENT_REPLAY";
        } else {
          const b = input.persistence.baseline;
          await transaction.identityBaseline.create({ data: {
            id: b.id, tenantId: b.tenantId, consumerId: b.consumerId, reportVersionId: b.reportVersionId,
            extractionRunId: b.extractionRunId, reportIngestionId: b.reportIngestionId,
            sourceIdentityBaselineId: b.sourceIdentityBaselineId, supersedesIdentityBaselineId: b.supersedesIdentityBaselineId,
            semanticSha256: b.semanticSha256, expectedIdentityFactCount: b.expectedIdentityFactCount,
            expectedCategoryCompletionCount: b.expectedCategoryCompletionCount,
            expectedAccountReviewReceiptCount: b.expectedAccountReviewReceiptCount,
            baselineSeriesKey: b.baselineSeriesKey, version: b.version, status: "CONFIRMED",
            policyVersion: b.policyVersion, inputSetSha256: b.inputSetSha256,
            confirmedByActorId: b.confirmedByActorId, confirmedAt: new Date(b.confirmedAt), createdByActorId: b.createdByActorId,
          } });
          const sourceFacts = await transaction.identityFact.findMany({ where: { tenantId: input.scope.tenantId, consumerId: input.scope.consumerId, identityBaselineId: source.identityBaselineId } });
          const sourceBySeries = new Map(sourceFacts.map((row: any) => [row.factSeriesKey, row]));
          for (const pin of input.persistence.identityFactPins) {
            const origin: any = sourceBySeries.get(pin.factSeriesKey);
            if (!origin || origin.integritySha256 !== pin.integritySha256 || origin.sourceLocatorToken !== pin.sourceLocatorToken) throw new Error("Round 0 fact source changed");
            await transaction.identityFact.create({ data: {
              id: pin.id, tenantId: pin.tenantId, consumerId: pin.consumerId, reportVersionId: pin.reportVersionId,
              identityBaselineId: pin.identityBaselineId, extractionRunId: pin.extractionRunId,
              baselineInputSetSha256: pin.baselineInputSetSha256, factSeriesKey: pin.factSeriesKey,
              factOrdinal: pin.factOrdinal, bureau: pin.bureau, factType: origin.factType,
              classification: pin.classification, reviewCategory: pin.reviewCategory, integritySha256: pin.integritySha256,
              presence: pin.presence, valueCiphertext: origin.valueCiphertext, valueIv: origin.valueIv,
              valueAuthTag: origin.valueAuthTag, valueKeyVersion: origin.valueKeyVersion,
              valueAlgorithm: origin.valueAlgorithm, valueEnvelopeVersion: origin.valueEnvelopeVersion,
              valueAadVersion: origin.valueAadVersion, sourceLocatorToken: pin.sourceLocatorToken,
              normalizationRuleKey: origin.normalizationRuleKey, normalizationRuleVersion: origin.normalizationRuleVersion,
            } });
          }
          for (const completion of input.persistence.categoryCompletions) await transaction.identityCategoryCompletion.create({ data: { ...completion, completedAt: new Date(completion.completedAt) } });
          for (const membership of input.persistence.accountReviewMemberships) await transaction.identityBaselineAccountReviewMembership.create({ data: membership });
        }
        const persisted = await readConfirmedBundle(transaction, input.scope, input.persistence.baseline.id);
        if (!persisted || semantic(persisted) !== semantic(input.persistence)) throw new Error("Round 0 readback mismatch");
        return Object.freeze({ disposition });
      }, () => { throw new Error("live principal revalidation failed"); });
    },
    async readConfirmedRound0Baseline(input: Parameters<Round0RuntimeRepository["readConfirmedRound0Baseline"]>[0]) {
      if (!gateAuthorized(input)) return null;
      return inTransaction({ principal: input.principal, scope: input.scope, purpose: input.purpose, operationId: input.gatePermit.operationId }, (transaction) => readConfirmedBundle(transaction, input.scope, input.identityBaselineId), null);
    },
    async readIdentityFactForAssertion(input: Parameters<Round0RuntimeRepository["readIdentityFactForAssertion"]>[0]) {
      if (!authorized(input.principal, input.scope)) return null;
      return inTransaction({ principal: input.principal, scope: input.scope, purpose: input.purpose, operationId: readOperationId(input.purpose, input.identityBaselineId, input.identityFactId) }, async (transaction) => {
        const baseline = await transaction.identityBaseline.findFirst({ where: { tenantId: input.scope.tenantId, consumerId: input.scope.consumerId, id: input.identityBaselineId, status: "CONFIRMED" } });
        const fact = baseline ? await transaction.identityFact.findFirst({ where: { tenantId: input.scope.tenantId, consumerId: input.scope.consumerId, id: input.identityFactId, identityBaselineId: baseline.id } }) : null;
        if (!baseline || !fact) return null;
        return Object.freeze({ tenantId: fact.tenantId, consumerId: fact.consumerId, reportVersionId: fact.reportVersionId,
          extractionRunId: fact.extractionRunId, identityBaselineId: fact.identityBaselineId,
          baselineSeriesKey: baseline.baselineSeriesKey, baselineVersion: baseline.version,
          baselineInputSetSha256: fact.baselineInputSetSha256, identityFactId: fact.id,
          factSeriesKey: fact.factSeriesKey, categoryKey: fact.reviewCategory, bureau: fact.bureau,
          sourceLocatorToken: fact.sourceLocatorToken, integritySha256: fact.integritySha256,
          presence: fact.presence, sourceKind: fact.presence === "PRESENT" ? "SOURCE_REPORTED" : "PARSER_UNCERTAINTY",
          classification: fact.classification, sourceIdentityBaselineId: baseline.sourceIdentityBaselineId,
          baselineStatus: "CONFIRMED" } as ConfirmedRound0FactSourceContext);
      }, null);
    },
    async verifyCurrentIdentityBaselineForAssertionSource(input: Parameters<Round0RuntimeRepository["verifyCurrentIdentityBaselineForAssertionSource"]>[0]) {
      if (!gateAuthorized(input)) return false;
      return inTransaction({ principal: input.principal, scope: input.scope, purpose: input.purpose, operationId: input.gatePermit.operationId }, async (transaction) => {
        const baseline = await transaction.identityBaseline.findFirst({ where: { tenantId: input.scope.tenantId, consumerId: input.scope.consumerId, id: input.source.identityBaselineId, status: "CONFIRMED" } });
        if (!baseline || await transaction.identityBaseline.findFirst({ where: { tenantId: input.scope.tenantId, consumerId: input.scope.consumerId, supersedesIdentityBaselineId: baseline.id } })) return false;
        const memberships = await transaction.identityBaselineAccountReviewMembership.findMany({ where: { tenantId: input.scope.tenantId, consumerId: input.scope.consumerId, confirmedIdentityBaselineId: baseline.id } });
        for (const member of memberships) {
          const receipt = await transaction.consumerAccountReviewReceipt.findFirst({ where: { tenantId: input.scope.tenantId, consumerId: input.scope.consumerId, id: member.consumerAccountReviewReceiptId } });
          if (!receipt || receipt.reviewState === "REVOKED" || await transaction.consumerAccountReviewReceipt.findFirst({ where: { tenantId: input.scope.tenantId, consumerId: input.scope.consumerId, supersedesReviewId: receipt.id } })) return false;
        }
        return true;
      }, false);
    },
    async readIdentityCorrespondenceAssertion(input: Parameters<Round0RuntimeRepository["readIdentityCorrespondenceAssertion"]>[0]) {
      if (!gateAuthorized(input)) return null;
      return inTransaction({ principal: input.principal, scope: input.scope, purpose: input.purpose, operationId: input.gatePermit.operationId }, async (transaction) => {
        const row = await transaction.identityCorrespondenceAssertion.findFirst({ where: { tenantId: input.scope.tenantId, consumerId: input.scope.consumerId, id: input.assertionId } });
        return row ? identityAssertionFromRow(row) : null;
      }, null);
    },
    async appendIdentityCorrespondenceAssertion(input: Parameters<Round0RuntimeRepository["appendIdentityCorrespondenceAssertion"]>[0]) {
      if (
        !gateAuthorized(input) ||
        input.principal.authorizationKind !== "DIRECT_CONSUMER" ||
        input.assertion.attestedByActorId !== input.principal.actorId ||
        input.assertion.attestedAt !== input.gatePermit.issuedAt ||
        !isValidDurableIdentityCorrespondenceAssertionRecord(input.assertion)
      ) throw new Error("identity assertion authority denied");
      return inTransaction({ principal: input.principal, scope: input.scope, purpose: input.purpose, operationId: input.gatePermit.operationId }, async (transaction) => {
        const fact = await transaction.identityFact.findFirst({ where: { tenantId: input.scope.tenantId, consumerId: input.scope.consumerId, id: input.assertion.identityFactId, identityBaselineId: input.assertion.identityBaselineId, integritySha256: input.assertion.identityFactIntegritySha256 } });
        const baseline = fact ? await transaction.identityBaseline.findFirst({ where: { tenantId: input.scope.tenantId, consumerId: input.scope.consumerId, id: input.assertion.identityBaselineId, version: input.assertion.identityBaselineVersion, status: "CONFIRMED", inputSetSha256: input.assertion.baselineInputSetSha256 } }) : null;
        if (!fact || !baseline || !fact.bureau || !fact.reviewCategory || fact.classification !== input.assertion.identityFactClassification || fact.bureau !== input.assertion.factBureau || fact.sourceLocatorToken !== input.assertion.factSourceLocatorToken || fact.presence !== "PRESENT" || !baseline.sourceIdentityBaselineId) throw new Error("identity assertion source changed");
        const source: ConfirmedRound0FactSourceContext = Object.freeze({
          tenantId: fact.tenantId, consumerId: fact.consumerId,
          reportVersionId: fact.reportVersionId, extractionRunId: fact.extractionRunId,
          identityBaselineId: fact.identityBaselineId, baselineSeriesKey: baseline.baselineSeriesKey,
          baselineVersion: baseline.version, baselineInputSetSha256: fact.baselineInputSetSha256,
          identityFactId: fact.id, factSeriesKey: fact.factSeriesKey,
          categoryKey: fact.reviewCategory, bureau: fact.bureau,
          sourceLocatorToken: fact.sourceLocatorToken, integritySha256: fact.integritySha256,
          presence: "PRESENT", sourceKind: "SOURCE_REPORTED", classification: fact.classification,
          sourceIdentityBaselineId: baseline.sourceIdentityBaselineId, baselineStatus: "CONFIRMED",
        });
        const sourceSetSha256 = computeIdentityCorrespondenceAssertionSourceSeriesKey({
          source,
          purposeCode: input.assertion.correspondencePurposeCode,
        });
        const purposeAllowed =
          (input.assertion.correspondencePurposeCode === "CORRESPONDENCE_SENDER_IDENTITY" &&
            source.classification === "CORRECT_CURRENT" &&
            (source.categoryKey === "LEGAL_NAME" || source.categoryKey === "CURRENT_ADDRESS")) ||
          (input.assertion.correspondencePurposeCode === "CORRESPONDENCE_IDENTITY_CORRECTION" &&
            ["INCORRECT", "NEVER_MINE", "OUTDATED_UPDATE_REQUESTED"].includes(source.classification));
        const baselineSuccessor = await transaction.identityBaseline.findFirst({
          where: { tenantId: input.scope.tenantId, consumerId: input.scope.consumerId, supersedesIdentityBaselineId: baseline.id },
          select: { id: true },
        });
        if (
          !purposeAllowed ||
          baselineSuccessor ||
          input.assertion.sourceSetSha256 !== sourceSetSha256 ||
          input.assertion.sourceSeriesKey !== sourceSetSha256 ||
          input.assertion.assertionSeriesKey !==
            computeIdentityCorrespondenceAssertionSeriesKey(sourceSetSha256)
        ) throw new Error("identity assertion semantic authority denied");
        const existingRow = await transaction.identityCorrespondenceAssertion.findFirst({ where: { tenantId: input.scope.tenantId, consumerId: input.scope.consumerId, id: input.assertion.id } });
        let disposition: "CREATED" | "IDEMPOTENT_REPLAY" = "CREATED";
        if (existingRow) {
          if (semantic(identityAssertionFromRow(existingRow)) !== semantic(input.assertion)) throw new Error("identity assertion replay conflict");
          disposition = "IDEMPOTENT_REPLAY";
        } else {
          if (input.assertion.version > 1) {
            const predecessor = await transaction.identityCorrespondenceAssertion.findFirst({
              where: {
                tenantId: input.scope.tenantId,
                consumerId: input.scope.consumerId,
                id: input.assertion.supersedesAssertionId,
                assertionSeriesKey: input.assertion.assertionSeriesKey,
                version: input.assertion.version - 1,
              },
            });
            const successor = predecessor
              ? await transaction.identityCorrespondenceAssertion.findFirst({
                  where: {
                    tenantId: input.scope.tenantId,
                    consumerId: input.scope.consumerId,
                    supersedesAssertionId: predecessor.id,
                  },
                  select: { id: true },
                })
              : null;
            if (!predecessor || successor) {
              throw new Error("identity assertion predecessor changed");
            }
          }
          await transaction.identityCorrespondenceAssertion.create({ data: { ...input.assertion, attestedAt: new Date(input.assertion.attestedAt) } });
        }
        const row = await transaction.identityCorrespondenceAssertion.findFirst({ where: { tenantId: input.scope.tenantId, consumerId: input.scope.consumerId, id: input.assertion.id } });
        if (!row || semantic(identityAssertionFromRow(row)) !== semantic(input.assertion)) throw new Error("identity assertion readback mismatch");
        return Object.freeze({ disposition });
      }, () => { throw new Error("live principal revalidation failed"); });
    },
  });
  return Object.freeze({ round0, accountReview });
}
