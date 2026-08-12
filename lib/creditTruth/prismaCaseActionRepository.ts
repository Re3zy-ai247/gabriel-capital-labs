import { createHash } from "node:crypto";
import type { P0Principal, P0Scope } from "./principal";
import {
  p0PrincipalAuthorizesScope,
  validateP0Principal,
} from "./principal";
import {
  CASE_ACTION_CODES,
  CASE_ACTION_DECISION_CONTRACT_VERSION,
  CASE_ACTION_STATES,
  computeCaseActionSourceSetSha256,
  type CaseActionDecisionRecord,
  type CaseActionDecisionRepository,
  type CaseActionSourceRef,
  type CaseActionSourceType,
} from "./caseActionDecision";
import { p0Phase2AGatePermitAuthorizes } from "./phase2Flags";
import type {
  P0PrismaTransactionalClient,
  P0PrismaTransactionalPrincipalRevalidator,
} from "./prismaReportIngestionRepository";

export const P0_PRISMA_CASE_ACTION_REPOSITORY_VERSION =
  "p0-prisma-case-action-repository-v1" as const;

export interface P0PrismaCaseActionRepositoryDependencies {
  readonly client: P0PrismaTransactionalClient;
  readonly principalRevalidator: P0PrismaTransactionalPrincipalRevalidator;
  readonly maxWaitMs?: number;
  readonly timeoutMs?: number;
}

const STABLE = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,199}$/;
const CONSUMER_STATES = new Set(["CONSUMER_SELECTED", "DECLINED", "WAITING"]);

function semantic(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

function dateIso(value: unknown): string {
  const date = value instanceof Date ? value : new Date(String(value));
  if (!Number.isFinite(date.getTime())) throw new Error("invalid decision timestamp");
  return date.toISOString();
}

function readOperationId(purpose: string, ...refs: readonly string[]): string {
  return `p0read_${semantic([purpose, ...refs]).slice(0, 48)}`;
}

function authorized(principal: P0Principal, scope: P0Scope): boolean {
  return (
    validateP0Principal(principal).length === 0 &&
    p0PrincipalAuthorizesScope(principal, scope)
  );
}

function gateAuthorized(
  input: {
    readonly principal: P0Principal;
    readonly scope: P0Scope;
    readonly gatePermit: Parameters<CaseActionDecisionRepository["appendCaseActionDecision"]>[0]["gatePermit"];
  },
): boolean {
  return Boolean(
    authorized(input.principal, input.scope) &&
      p0Phase2AGatePermitAuthorizes({
        permit: input.gatePermit,
        principal: input.principal,
        scope: input.scope,
        stage: "ROUND0_REVIEW",
        mode: input.gatePermit.mode,
        operationId: input.gatePermit.operationId,
      }),
  );
}

function exactDecisionAuthority(
  input: Parameters<CaseActionDecisionRepository["appendCaseActionDecision"]>[0],
): boolean {
  const decision = input.decision;
  try {
    return Boolean(
      gateAuthorized(input) &&
        decision.contractVersion === CASE_ACTION_DECISION_CONTRACT_VERSION &&
        decision.operationId === input.gatePermit.operationId &&
        decision.tenantId === input.scope.tenantId &&
        decision.consumerId === input.scope.consumerId &&
        decision.decidedByActorId === input.principal.actorId &&
        decision.decidedAt === input.gatePermit.issuedAt &&
        CASE_ACTION_CODES.includes(decision.actionCode) &&
        CASE_ACTION_STATES.includes(decision.state) &&
        decision.chronologyAuthority === "ORDERING_ONLY_NOT_POLICY_AUTHORITY" &&
        Number.isSafeInteger(decision.chronologyRound) &&
        decision.chronologyRound > 0 &&
        Number.isSafeInteger(decision.version) &&
        decision.version > 0 &&
        Number.isSafeInteger(decision.expectedSourceCount) &&
        decision.expectedSourceCount === decision.sourceSet.length &&
        computeCaseActionSourceSetSha256(decision.sourceSet) ===
          decision.sourceSetSha256 &&
        ((decision.version === 1 && decision.supersedesDecisionId === null) ||
          (decision.version > 1 &&
            typeof decision.supersedesDecisionId === "string" &&
            STABLE.test(decision.supersedesDecisionId))) &&
        (!CONSUMER_STATES.has(decision.state) ||
          input.principal.authorizationKind === "DIRECT_CONSUMER")
    );
  } catch {
    return false;
  }
}

function sourceRef(
  sourceType: CaseActionSourceType,
  row: any,
  extra?: any,
): CaseActionSourceRef | null {
  if (!row) return null;
  switch (sourceType) {
    case "FIELD_OBSERVATION":
      return row.presence === "PRESENT"
        ? Object.freeze({ sourceType, sourceId: row.id, sourceVersion: row.revision, bureau: row.bureau, integritySha256: row.integritySha256 })
        : null;
    case "DERIVED_ACCOUNT_ASSESSMENT":
      return Object.freeze({ sourceType, sourceId: row.id, sourceVersion: row.assessmentVersion, bureau: null, integritySha256: row.inputSetSha256 });
    case "CONSUMER_ASSERTION":
      return row.disposition !== "REVOKED"
        ? Object.freeze({ sourceType, sourceId: row.id, sourceVersion: row.version, bureau: row.bureau, integritySha256: row.integritySha256 })
        : null;
    case "CONSUMER_ACCOUNT_REVIEW":
      return row.reviewState !== "REVOKED"
        ? Object.freeze({ sourceType, sourceId: row.id, sourceVersion: row.version, bureau: row.bureau, integritySha256: row.sourceSetSha256 })
        : null;
    case "IDENTITY_FACT":
      return row.presence === "PRESENT" && row.classification !== "REVIEW_NEEDED" && extra
        ? Object.freeze({ sourceType, sourceId: row.id, sourceVersion: extra.version, bureau: row.bureau, integritySha256: row.integritySha256 })
        : null;
    case "IDENTITY_CORRESPONDENCE_ASSERTION":
      return row.status === "ATTESTED"
        ? Object.freeze({ sourceType, sourceId: row.id, sourceVersion: row.version, bureau: row.factBureau, integritySha256: row.sourceSetSha256 })
        : null;
    case "IDENTITY_CATEGORY_COMPLETION":
      return row.disposition === "NOT_APPLICABLE"
        ? Object.freeze({ sourceType, sourceId: row.id, sourceVersion: row.identityBaselineVersion, bureau: null, integritySha256: row.sourceCompletenessSha256 })
        : null;
  }
}

async function resolveSource(
  transaction: any,
  scope: P0Scope,
  reportVersionId: string,
  sourceType: CaseActionSourceType,
  sourceId: string,
): Promise<CaseActionSourceRef | null> {
  const where = {
    tenantId: scope.tenantId,
    consumerId: scope.consumerId,
    reportVersionId,
    id: sourceId,
  };
  switch (sourceType) {
    case "FIELD_OBSERVATION":
      return sourceRef(sourceType, await transaction.fieldObservation.findFirst({ where }));
    case "DERIVED_ACCOUNT_ASSESSMENT":
      return sourceRef(sourceType, await transaction.derivedAccountAssessment.findFirst({ where }));
    case "CONSUMER_ASSERTION":
      return sourceRef(sourceType, await transaction.consumerAssertion.findFirst({ where }));
    case "CONSUMER_ACCOUNT_REVIEW":
      return sourceRef(sourceType, await transaction.consumerAccountReviewReceipt.findFirst({ where }));
    case "IDENTITY_FACT": {
      const row = await transaction.identityFact.findFirst({ where });
      if (!row) return null;
      const baseline = await transaction.identityBaseline.findFirst({
        where: { ...where, id: row.identityBaselineId, status: "CONFIRMED" },
      });
      return sourceRef(sourceType, row, baseline);
    }
    case "IDENTITY_CORRESPONDENCE_ASSERTION":
      return sourceRef(sourceType, await transaction.identityCorrespondenceAssertion.findFirst({ where }));
    case "IDENTITY_CATEGORY_COMPLETION":
      return sourceRef(sourceType, await transaction.identityCategoryCompletion.findFirst({ where }));
  }
}

async function resolveSourceSet(
  transaction: any,
  scope: P0Scope,
  reportVersionId: string,
  caseId: string,
  selectors: readonly { readonly sourceType: CaseActionSourceType; readonly sourceId: string }[],
): Promise<readonly CaseActionSourceRef[]> {
  const disputeCase = await transaction.disputeCase.findFirst({
    where: {
      tenantId: scope.tenantId,
      consumerId: scope.consumerId,
      reportVersionId,
      id: caseId,
    },
    select: { id: true },
  });
  if (!disputeCase) return Object.freeze([]);
  const result: CaseActionSourceRef[] = [];
  for (const selector of selectors) {
    const source = await resolveSource(
      transaction,
      scope,
      reportVersionId,
      selector.sourceType,
      selector.sourceId,
    );
    if (source) result.push(source);
  }
  return Object.freeze(result);
}

async function readDecision(
  transaction: any,
  scope: P0Scope,
  decisionId: string,
): Promise<CaseActionDecisionRecord | null> {
  const row = await transaction.caseActionDecision.findFirst({
    where: { tenantId: scope.tenantId, consumerId: scope.consumerId, id: decisionId },
  });
  if (!row) return null;
  const refs = await transaction.caseActionSourceRef.findMany({
    where: { tenantId: scope.tenantId, consumerId: scope.consumerId, decisionId: row.id },
    orderBy: { ordinal: "asc" },
  });
  return Object.freeze({
    contractVersion: CASE_ACTION_DECISION_CONTRACT_VERSION,
    decisionId: row.id,
    operationId: row.idempotencyKey,
    tenantId: row.tenantId,
    consumerId: row.consumerId,
    reportVersionId: row.reportVersionId,
    caseId: row.caseId,
    actionCode: row.actionCode,
    state: row.state,
    chronologyRound: row.chronologyRound,
    chronologyAuthority: "ORDERING_ONLY_NOT_POLICY_AUTHORITY",
    sourceSet: Object.freeze(refs.map((ref: any) => Object.freeze({
      sourceType: ref.sourceType,
      sourceId: ref.sourceId,
      sourceVersion: ref.sourceVersion,
      bureau: ref.bureau,
      integritySha256: ref.integritySha256,
    }))),
    expectedSourceCount: row.expectedSourceCount,
    sourceSetSha256: row.sourceSetSha256,
    decisionSeriesKey: row.decisionSeriesKey,
    version: row.version,
    supersedesDecisionId: row.supersedesDecisionId,
    decidedByActorId: row.recordedByActorId,
    decidedAt: dateIso(row.recordedAt),
  });
}

async function sourceIsCurrent(
  transaction: any,
  scope: P0Scope,
  source: CaseActionSourceRef,
): Promise<boolean> {
  const reportConstraint = { tenantId: scope.tenantId, consumerId: scope.consumerId, id: source.sourceId };
  if (source.sourceType === "CONSUMER_ASSERTION") {
    const row = await transaction.consumerAssertion.findFirst({ where: reportConstraint });
    if (!row || semantic(sourceRef(source.sourceType, row)) !== semantic(source)) return false;
    return !(await transaction.consumerAssertion.findFirst({ where: { tenantId: scope.tenantId, consumerId: scope.consumerId, supersedesAssertionId: row.id }, select: { id: true } }));
  }
  if (source.sourceType === "IDENTITY_CORRESPONDENCE_ASSERTION") {
    const row = await transaction.identityCorrespondenceAssertion.findFirst({ where: reportConstraint });
    if (!row || semantic(sourceRef(source.sourceType, row)) !== semantic(source)) return false;
    const successor = await transaction.identityCorrespondenceAssertion.findFirst({ where: { tenantId: scope.tenantId, consumerId: scope.consumerId, supersedesAssertionId: row.id }, select: { id: true } });
    const baselineSuccessor = await transaction.identityBaseline.findFirst({ where: { tenantId: scope.tenantId, consumerId: scope.consumerId, supersedesIdentityBaselineId: row.identityBaselineId }, select: { id: true } });
    return !successor && !baselineSuccessor;
  }
  if (source.sourceType === "CONSUMER_ACCOUNT_REVIEW") {
    const row = await transaction.consumerAccountReviewReceipt.findFirst({ where: reportConstraint });
    if (!row || semantic(sourceRef(source.sourceType, row)) !== semantic(source)) return false;
    return !(await transaction.consumerAccountReviewReceipt.findFirst({ where: { tenantId: scope.tenantId, consumerId: scope.consumerId, supersedesReviewId: row.id }, select: { id: true } }));
  }
  if (source.sourceType === "IDENTITY_CATEGORY_COMPLETION") {
    const row = await transaction.identityCategoryCompletion.findFirst({ where: reportConstraint });
    if (!row || semantic(sourceRef(source.sourceType, row)) !== semantic(source)) return false;
    return !(await transaction.identityBaseline.findFirst({ where: { tenantId: scope.tenantId, consumerId: scope.consumerId, supersedesIdentityBaselineId: row.identityBaselineId }, select: { id: true } }));
  }
  return false;
}

export function createP0PrismaCaseActionRepository(
  dependencies: P0PrismaCaseActionRepositoryDependencies,
): CaseActionDecisionRepository {
  const options = { isolationLevel: "Serializable" as const, maxWait: dependencies.maxWaitMs ?? 5_000, timeout: dependencies.timeoutMs ?? 10_000 };
  return Object.freeze({
    async readCaseActionSourceSet(
      input: Parameters<CaseActionDecisionRepository["readCaseActionSourceSet"]>[0],
    ) {
      if (!authorized(input.principal, input.scope) || !STABLE.test(input.reportVersionId) || !STABLE.test(input.caseId)) return Object.freeze([]);
      return dependencies.client.$transaction(async (transaction: any) => {
        const operationId = readOperationId(input.purpose, input.reportVersionId, input.caseId);
        const live = await dependencies.principalRevalidator.revalidateInTransaction({ transaction, principal: input.principal, scope: input.scope, purpose: input.purpose, operationId });
        return live ? resolveSourceSet(transaction, input.scope, input.reportVersionId, input.caseId, input.sourceSelectors) : Object.freeze([]);
      }, options);
    },

    async readCaseActionDecision(
      input: Parameters<CaseActionDecisionRepository["readCaseActionDecision"]>[0],
    ) {
      if (!gateAuthorized(input) || !STABLE.test(input.decisionId)) return null;
      return dependencies.client.$transaction(async (transaction: any) => {
        const live = await dependencies.principalRevalidator.revalidateInTransaction({ transaction, principal: input.principal, scope: input.scope, purpose: input.purpose, operationId: input.gatePermit.operationId });
        return live ? readDecision(transaction, input.scope, input.decisionId) : null;
      }, options);
    },

    async appendCaseActionDecision(
      input: Parameters<CaseActionDecisionRepository["appendCaseActionDecision"]>[0],
    ) {
      if (!exactDecisionAuthority(input)) {
        throw new Error("case action authority denied");
      }
      return dependencies.client.$transaction(async (transaction: any) => {
        const live = await dependencies.principalRevalidator.revalidateInTransaction({ transaction, principal: input.principal, scope: input.scope, purpose: input.purpose, operationId: input.decision.operationId });
        if (!live) throw new Error("live principal revalidation failed");
        const selectors = input.decision.sourceSet.map(({ sourceType, sourceId }) => ({ sourceType, sourceId }));
        const liveSources = await resolveSourceSet(transaction, input.scope, input.decision.reportVersionId, input.decision.caseId, selectors);
        if (semantic(liveSources) !== semantic(input.decision.sourceSet)) throw new Error("case action source set changed");
        const existing = await readDecision(transaction, input.scope, input.decision.decisionId);
        const byOperation = await transaction.caseActionDecision.findFirst({ where: { tenantId: input.scope.tenantId, consumerId: input.scope.consumerId, idempotencyKey: input.decision.operationId }, select: { id: true } });
        let disposition: "CREATED" | "IDEMPOTENT_REPLAY" = "CREATED";
        if (existing || byOperation) {
          if (!existing || byOperation?.id !== input.decision.decisionId || semantic(existing) !== semantic(input.decision)) throw new Error("case action replay conflict");
          disposition = "IDEMPOTENT_REPLAY";
        } else {
          if (input.decision.version > 1) {
            const predecessor = await transaction.caseActionDecision.findFirst({ where: { tenantId: input.scope.tenantId, consumerId: input.scope.consumerId, id: input.decision.supersedesDecisionId, decisionSeriesKey: input.decision.decisionSeriesKey, version: input.decision.version - 1 } });
            if (!predecessor) throw new Error("case action predecessor changed");
            const successor = await transaction.caseActionDecision.findFirst({ where: { tenantId: input.scope.tenantId, consumerId: input.scope.consumerId, supersedesDecisionId: predecessor.id }, select: { id: true } });
            if (successor) throw new Error("case action predecessor already superseded");
          }
          await transaction.caseActionDecision.create({ data: {
            id: input.decision.decisionId, tenantId: input.scope.tenantId, consumerId: input.scope.consumerId,
            reportVersionId: input.decision.reportVersionId, caseId: input.decision.caseId,
            decisionSeriesKey: input.decision.decisionSeriesKey, version: input.decision.version,
            state: input.decision.state, actionCode: input.decision.actionCode,
            chronologyRound: input.decision.chronologyRound, expectedSourceCount: input.decision.expectedSourceCount,
            sourceSetSha256: input.decision.sourceSetSha256, idempotencyKey: input.decision.operationId,
            recordedByActorId: input.principal.actorId, recordedAt: new Date(input.decision.decidedAt),
            supersedesDecisionId: input.decision.supersedesDecisionId,
          } });
          for (let ordinal = 0; ordinal < input.decision.sourceSet.length; ordinal += 1) {
            const source = input.decision.sourceSet[ordinal]!;
            await transaction.caseActionSourceRef.create({ data: {
              tenantId: input.scope.tenantId, consumerId: input.scope.consumerId,
              reportVersionId: input.decision.reportVersionId, caseId: input.decision.caseId,
              decisionId: input.decision.decisionId, sourceType: source.sourceType,
              sourceId: source.sourceId, sourceVersion: source.sourceVersion, bureau: source.bureau,
              integritySha256: source.integritySha256, ordinal,
            } });
          }
        }
        const persisted = await readDecision(transaction, input.scope, input.decision.decisionId);
        if (!persisted || semantic(persisted) !== semantic(input.decision)) throw new Error("case action readback mismatch");
        return Object.freeze({ disposition });
      }, options);
    },

    async verifyCurrentCaseActionAssertionSource(input: Parameters<CaseActionDecisionRepository["verifyCurrentCaseActionAssertionSource"]>[0]) {
      if (!gateAuthorized(input)) return false;
      return dependencies.client.$transaction(async (transaction: any) => {
        const live = await dependencies.principalRevalidator.revalidateInTransaction({ transaction, principal: input.principal, scope: input.scope, purpose: input.purpose, operationId: input.gatePermit.operationId });
        return live && sourceIsCurrent(transaction, input.scope, input.source);
      }, options);
    },
    async verifyCurrentCaseActionAccountReviewSource(input: Parameters<CaseActionDecisionRepository["verifyCurrentCaseActionAccountReviewSource"]>[0]) {
      if (!gateAuthorized(input)) return false;
      return dependencies.client.$transaction(async (transaction: any) => {
        const live = await dependencies.principalRevalidator.revalidateInTransaction({ transaction, principal: input.principal, scope: input.scope, purpose: input.purpose, operationId: input.gatePermit.operationId });
        return live && sourceIsCurrent(transaction, input.scope, input.source);
      }, options);
    },
    async verifyCurrentCaseActionIdentityCategoryCompletionSource(input: Parameters<CaseActionDecisionRepository["verifyCurrentCaseActionIdentityCategoryCompletionSource"]>[0]) {
      if (!gateAuthorized(input)) return false;
      return dependencies.client.$transaction(async (transaction: any) => {
        const live = await dependencies.principalRevalidator.revalidateInTransaction({ transaction, principal: input.principal, scope: input.scope, purpose: input.purpose, operationId: input.gatePermit.operationId });
        return live && sourceIsCurrent(transaction, input.scope, input.source);
      }, options);
    },
  });
}
