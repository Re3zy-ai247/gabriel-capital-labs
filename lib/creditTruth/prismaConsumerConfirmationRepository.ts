import { createHash } from "node:crypto";
import type { P0Principal, P0Scope } from "./principal";
import {
  p0PrincipalAuthorizesScope,
  validateP0Principal,
} from "./principal";
import {
  CONSUMER_ASSERTION_BINDING_VERSION,
  CONSUMER_ASSERTION_DISPOSITIONS,
  validateConsumerAssertionBinding,
  type ObservationBinding,
} from "./consumerAssertion";
import {
  CONSUMER_CONFIRMATION_RUNTIME_VERSION,
  computeConsumerAssertionRuntimeIntegritySha256,
  type ConsumerAssertionRuntimeRecord,
  type ConsumerAssertionRuntimeRepository,
  type ConsumerAssertionSourceRead,
} from "./consumerConfirmationRuntime";
import {
  p0Phase2AGatePermitAuthorizes,
} from "./phase2Flags";
import type {
  P0PrismaTransactionalClient,
  P0PrismaTransactionalPrincipalRevalidator,
} from "./prismaReportIngestionRepository";

export const P0_PRISMA_CONSUMER_CONFIRMATION_REPOSITORY_VERSION =
  "p0-prisma-consumer-confirmation-repository-v1" as const;

export interface P0PrismaConsumerConfirmationRepositoryDependencies {
  readonly client: P0PrismaTransactionalClient;
  readonly principalRevalidator: P0PrismaTransactionalPrincipalRevalidator;
  readonly maxWaitMs?: number;
  readonly timeoutMs?: number;
}

const STABLE = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,199}$/;

function semantic(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

function dateIso(value: unknown): string {
  const date = value instanceof Date ? value : new Date(String(value));
  if (!Number.isFinite(date.getTime())) throw new Error("invalid assertion timestamp");
  return date.toISOString();
}

function nullableDateIso(value: unknown): string | null {
  return value === null || value === undefined ? null : dateIso(value);
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

function assertionGateAuthorized(
  input: Parameters<ConsumerAssertionRuntimeRepository["appendConsumerAssertion"]>[0],
): boolean {
  return Boolean(
    authorized(input.principal, input.scope) &&
      input.principal.authorizationKind === "DIRECT_CONSUMER" &&
      input.principal.actorId === input.scope.consumerId &&
      input.assertion.runtimeVersion === CONSUMER_CONFIRMATION_RUNTIME_VERSION &&
      input.assertion.bindingVersion === CONSUMER_ASSERTION_BINDING_VERSION &&
      input.assertion.confirmedByActorId === input.principal.actorId &&
      input.assertion.confirmedAt === input.gatePermit.issuedAt &&
      CONSUMER_ASSERTION_DISPOSITIONS.includes(input.assertion.disposition) &&
      validateConsumerAssertionBinding(input.assertion, input.assertion.binding).valid &&
      computeConsumerAssertionRuntimeIntegritySha256(input.assertion) ===
        input.assertion.integritySha256 &&
      Number.isSafeInteger(input.assertion.version) &&
      input.assertion.version > 0 &&
      ((input.assertion.version === 1 &&
        input.assertion.supersedesAssertionId === null &&
        input.assertion.disposition !== "REVOKED") ||
        (input.assertion.version > 1 &&
          typeof input.assertion.supersedesAssertionId === "string" &&
          STABLE.test(input.assertion.supersedesAssertionId))) &&
      input.assertion.binding.tenantId === input.scope.tenantId &&
      input.assertion.binding.consumerId === input.scope.consumerId &&
      p0Phase2AGatePermitAuthorizes({
        permit: input.gatePermit,
        principal: input.principal,
        scope: input.scope,
        stage: "ASSERTION_RUNTIME",
        mode: input.gatePermit.mode,
        operationId: input.assertion.operationId,
      }),
  );
}

function observationBinding(row: any): ObservationBinding {
  return Object.freeze({
    tenantId: row.tenantId,
    consumerId: row.consumerId,
    observationId: row.id,
    reportVersionId: row.reportVersionId,
    extractionRunId: row.extractionRunId,
    accountId: row.accountId,
    bureau: row.bureau,
    field: row.fieldKey,
    observationSeriesKey: row.observationSeriesKey,
    observationRevision: row.revision,
    observationDigest: row.integritySha256,
  });
}

function sourceReadId(observation: ObservationBinding, assessment: any): string {
  return `p0assertsrc_${semantic([
    observation.tenantId,
    observation.consumerId,
    observation.observationId,
    observation.observationRevision,
    observation.observationDigest,
    assessment.id,
    assessment.assessmentVersion,
    assessment.inputSetSha256,
  ]).slice(0, 48)}`;
}

async function readSource(
  transaction: any,
  scope: P0Scope,
  observationId: string,
  assessmentId: string,
): Promise<ConsumerAssertionSourceRead | null> {
  const observation = await transaction.fieldObservation.findFirst({
    where: {
      tenantId: scope.tenantId,
      consumerId: scope.consumerId,
      id: observationId,
    },
  });
  if (
    !observation ||
    observation.presence !== "PRESENT" ||
    observation.coverageStatus !== "COVERED" ||
    !["COMPLETE", "PARTIAL"].includes(observation.sectionStatus) ||
    typeof observation.integritySha256 !== "string" ||
    typeof observation.sourceLocatorToken !== "string"
  ) {
    return null;
  }
  const assessment = await transaction.derivedAccountAssessment.findFirst({
    where: {
      tenantId: scope.tenantId,
      consumerId: scope.consumerId,
      id: assessmentId,
      reportVersionId: observation.reportVersionId,
      extractionRunId: observation.extractionRunId,
      accountId: observation.accountId,
    },
  });
  if (!assessment) return null;
  const binding = observationBinding(observation);
  return Object.freeze({
    repositoryReadId: sourceReadId(binding, assessment),
    observation: binding,
    assessment: Object.freeze({
      assessmentId: assessment.id,
      tenantId: assessment.tenantId,
      consumerId: assessment.consumerId,
      reportVersionId: assessment.reportVersionId,
      extractionRunId: assessment.extractionRunId,
      accountId: assessment.accountId,
      assessmentVersion: assessment.assessmentVersion,
      inputSetSha256: assessment.inputSetSha256,
    }),
  });
}

function fromRows(row: any, assessment: any): ConsumerAssertionRuntimeRecord {
  return Object.freeze({
    runtimeVersion: CONSUMER_CONFIRMATION_RUNTIME_VERSION,
    bindingVersion: CONSUMER_ASSERTION_BINDING_VERSION,
    assertionId: row.id,
    operationId: row.operationId,
    disposition: row.disposition,
    binding: Object.freeze({
      tenantId: row.tenantId,
      consumerId: row.consumerId,
      observationId: row.observationId,
      reportVersionId: row.reportVersionId,
      extractionRunId: row.extractionRunId,
      accountId: row.accountId,
      bureau: row.bureau,
      field: row.fieldKey,
      observationSeriesKey: row.observationSeriesKey,
      observationRevision: row.observationRevision,
      observationDigest: row.observationIntegritySha256,
    }),
    assessment: Object.freeze({
      assessmentId: assessment.id,
      tenantId: assessment.tenantId,
      consumerId: assessment.consumerId,
      reportVersionId: assessment.reportVersionId,
      extractionRunId: assessment.extractionRunId,
      accountId: assessment.accountId,
      assessmentVersion: assessment.assessmentVersion,
      inputSetSha256: assessment.inputSetSha256,
    }),
    assertionSeriesKey: row.assertionSeriesKey,
    version: row.version,
    supersedesAssertionId: row.supersedesAssertionId,
    confirmedByActorId: row.confirmedByActorId,
    confirmedAt: dateIso(row.confirmedAt),
    expiresAt: nullableDateIso(row.expiresAt),
    integritySha256: row.integritySha256,
  });
}

async function readAssertion(
  transaction: any,
  scope: P0Scope,
  assertionId: string,
): Promise<ConsumerAssertionRuntimeRecord | null> {
  const row = await transaction.consumerAssertion.findFirst({
    where: {
      tenantId: scope.tenantId,
      consumerId: scope.consumerId,
      id: assertionId,
    },
  });
  if (!row) return null;
  const assessment = await transaction.derivedAccountAssessment.findFirst({
    where: {
      tenantId: scope.tenantId,
      consumerId: scope.consumerId,
      id: row.assessmentId,
      reportVersionId: row.reportVersionId,
      extractionRunId: row.extractionRunId,
      accountId: row.accountId,
    },
  });
  return assessment ? fromRows(row, assessment) : null;
}

function createData(assertion: ConsumerAssertionRuntimeRecord): Record<string, unknown> {
  return {
    id: assertion.assertionId,
    operationId: assertion.operationId,
    tenantId: assertion.binding.tenantId,
    consumerId: assertion.binding.consumerId,
    reportVersionId: assertion.binding.reportVersionId,
    accountId: assertion.binding.accountId,
    extractionRunId: assertion.binding.extractionRunId,
    bureau: assertion.binding.bureau,
    fieldKey: assertion.binding.field,
    observationId: assertion.binding.observationId,
    observationSeriesKey: assertion.binding.observationSeriesKey,
    observationRevision: assertion.binding.observationRevision,
    observationIntegritySha256: assertion.binding.observationDigest,
    integritySha256: assertion.integritySha256,
    assessmentId: assertion.assessment.assessmentId,
    assertionSeriesKey: assertion.assertionSeriesKey,
    version: assertion.version,
    disposition: assertion.disposition,
    confirmedByActorId: assertion.confirmedByActorId,
    confirmedAt: new Date(assertion.confirmedAt),
    expiresAt: assertion.expiresAt === null ? null : new Date(assertion.expiresAt),
    supersedesAssertionId: assertion.supersedesAssertionId,
  };
}

export function createP0PrismaConsumerConfirmationRepository(
  dependencies: P0PrismaConsumerConfirmationRepositoryDependencies,
): ConsumerAssertionRuntimeRepository {
  const options = {
    isolationLevel: "Serializable" as const,
    maxWait: dependencies.maxWaitMs ?? 5_000,
    timeout: dependencies.timeoutMs ?? 10_000,
  };
  return Object.freeze({
    async readConsumerAssertionSource(
      input: Parameters<ConsumerAssertionRuntimeRepository["readConsumerAssertionSource"]>[0],
    ) {
      if (
        input.purpose !== "CONSUMER_ASSERTION_SOURCE_READ" ||
        !authorized(input.principal, input.scope) ||
        !STABLE.test(input.observationId) ||
        !STABLE.test(input.assessmentId)
      ) return null;
      return dependencies.client.$transaction(async (transaction: any) => {
        const operationId = readOperationId(
          input.purpose,
          input.observationId,
          input.assessmentId,
        );
        const live = await dependencies.principalRevalidator.revalidateInTransaction({
          transaction,
          principal: input.principal,
          scope: input.scope,
          purpose: input.purpose,
          operationId,
        });
        return live
          ? readSource(transaction, input.scope, input.observationId, input.assessmentId)
          : null;
      }, options);
    },

    async readConsumerAssertion(
      input: Parameters<ConsumerAssertionRuntimeRepository["readConsumerAssertion"]>[0],
    ) {
      if (
        !authorized(input.principal, input.scope) ||
        !STABLE.test(input.assertionId) ||
        !p0Phase2AGatePermitAuthorizes({
          permit: input.gatePermit,
          principal: input.principal,
          scope: input.scope,
          stage: "ASSERTION_RUNTIME",
          mode: input.gatePermit.mode,
          operationId: input.gatePermit.operationId,
        })
      ) return null;
      return dependencies.client.$transaction(async (transaction: any) => {
        const live = await dependencies.principalRevalidator.revalidateInTransaction({
          transaction,
          principal: input.principal,
          scope: input.scope,
          purpose: input.purpose,
          operationId: input.gatePermit.operationId,
        });
        return live ? readAssertion(transaction, input.scope, input.assertionId) : null;
      }, options);
    },

    async appendConsumerAssertion(
      input: Parameters<ConsumerAssertionRuntimeRepository["appendConsumerAssertion"]>[0],
    ) {
      if (!assertionGateAuthorized(input)) {
        throw new Error("consumer assertion authority denied");
      }
      return dependencies.client.$transaction(async (transaction: any) => {
        const live = await dependencies.principalRevalidator.revalidateInTransaction({
          transaction,
          principal: input.principal,
          scope: input.scope,
          purpose: input.purpose,
          operationId: input.assertion.operationId,
        });
        if (!live) throw new Error("live principal revalidation failed");

        const source = await readSource(
          transaction,
          input.scope,
          input.assertion.binding.observationId,
          input.assertion.assessment.assessmentId,
        );
        if (
          !source ||
          source.repositoryReadId !== input.sourceReadId ||
          semantic(source.observation) !== semantic(input.assertion.binding) ||
          semantic(source.assessment) !== semantic(input.assertion.assessment)
        ) {
          throw new Error("consumer assertion source changed");
        }

        const byId = await readAssertion(
          transaction,
          input.scope,
          input.assertion.assertionId,
        );
        const byOperation = await transaction.consumerAssertion.findFirst({
          where: {
            tenantId: input.scope.tenantId,
            consumerId: input.scope.consumerId,
            operationId: input.assertion.operationId,
          },
          select: { id: true },
        });
        let disposition: "CREATED" | "IDEMPOTENT_REPLAY" = "CREATED";
        if (byId || byOperation) {
          if (
            !byId ||
            byOperation?.id !== input.assertion.assertionId ||
            semantic(byId) !== semantic(input.assertion)
          ) {
            throw new Error("consumer assertion replay conflict");
          }
          disposition = "IDEMPOTENT_REPLAY";
        } else {
          if (input.assertion.version > 1) {
            const predecessor = await transaction.consumerAssertion.findFirst({
              where: {
                tenantId: input.scope.tenantId,
                consumerId: input.scope.consumerId,
                id: input.assertion.supersedesAssertionId,
                assertionSeriesKey: input.assertion.assertionSeriesKey,
                version: input.assertion.version - 1,
              },
            });
            if (!predecessor) throw new Error("assertion predecessor changed");
            const successor = await transaction.consumerAssertion.findFirst({
              where: {
                tenantId: input.scope.tenantId,
                consumerId: input.scope.consumerId,
                supersedesAssertionId: predecessor.id,
              },
              select: { id: true },
            });
            if (successor) throw new Error("assertion predecessor already superseded");
          }
          await transaction.consumerAssertion.create({
            data: createData(input.assertion),
          });
        }

        const persisted = await readAssertion(
          transaction,
          input.scope,
          input.assertion.assertionId,
        );
        if (!persisted || semantic(persisted) !== semantic(input.assertion)) {
          throw new Error("consumer assertion readback mismatch");
        }
        return Object.freeze({ disposition });
      }, options);
    },
  });
}
