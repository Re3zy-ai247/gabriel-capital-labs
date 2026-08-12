import type { P0Principal, P0Scope } from "./principal";
import {
  p0PrincipalAuthorizesScope,
  validateP0Principal,
} from "./principal";
import type {
  P0SensitiveAccessEventDraft,
  P0SensitiveAccessRepository,
} from "./sensitiveAccessAudit";
import {
  P0_SENSITIVE_ACCESS_KINDS,
  P0_SENSITIVE_ACCESS_PURPOSE_CODES,
  P0_SENSITIVE_ACCESS_REASON_CODES,
  P0_SENSITIVE_RESOURCE_TYPES,
} from "./sensitiveAccessAudit";
import { isStrictIsoInstant } from "./progressIntelligence";
import type {
  P0PrismaTransactionalClient,
  P0PrismaTransactionalPrincipalRevalidator,
} from "./prismaReportIngestionRepository";

export const P0_PRISMA_SENSITIVE_ACCESS_REPOSITORY_VERSION =
  "p0-prisma-sensitive-access-repository-v1" as const;

export interface P0PrismaSensitiveAccessRepositoryDependencies {
  readonly client: P0PrismaTransactionalClient;
  readonly principalRevalidator: P0PrismaTransactionalPrincipalRevalidator;
  readonly maxWaitMs?: number;
  readonly timeoutMs?: number;
}

const STABLE = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,199}$/;

function dateIso(value: unknown): string {
  const date = value instanceof Date ? value : new Date(String(value));
  if (!Number.isFinite(date.getTime())) throw new Error("invalid audit timestamp");
  return date.toISOString();
}

function semantic(value: unknown): string {
  return JSON.stringify(value);
}

function authorized(
  principal: P0Principal,
  scope: P0Scope,
): boolean {
  return (
    validateP0Principal(principal).length === 0 &&
    p0PrincipalAuthorizesScope(principal, scope)
  );
}

function exactEventAuthority(
  event: P0SensitiveAccessEventDraft,
  principal: P0Principal,
  scope: P0Scope,
): boolean {
  const internalRef = (value: unknown): value is string => {
    const derived =
      typeof value === "string" &&
      (/^p0(?:ing|src|obj|rv|evt|corr|op)_[a-f0-9]{16,64}$/.test(value) ||
        /^p0-authz-(?:worker|direct|managed):[a-f0-9]{64}$/.test(value));
    return Boolean(
      typeof value === "string" &&
        value.length > 0 &&
        value.length <= 160 &&
        !/[\s@]/.test(value) &&
        !/^https?:/i.test(value) &&
        (!/\d{9,}/.test(value) || derived),
    );
  };
  return Boolean(
    event &&
      Object.keys(event).length === 15 &&
      /^p0evt_[0-9a-f]{64}$/.test(event.eventKey) &&
      /^p0corr_[0-9a-f]{64}$/.test(event.correlationId) &&
      internalRef(event.actorId) &&
      internalRef(event.tenantId) &&
      internalRef(event.consumerId) &&
      internalRef(event.authorizationVersion) &&
      event.actorId === principal.actorId &&
      event.tenantId === scope.tenantId &&
      event.consumerId === scope.consumerId &&
      event.authorizationKind === principal.authorizationKind &&
      event.authorizationVersion === principal.authorizationVersion &&
      P0_SENSITIVE_ACCESS_KINDS.includes(event.accessKind) &&
      P0_SENSITIVE_ACCESS_PURPOSE_CODES.includes(event.purposeCode) &&
      (event.decision === "ALLOW" || event.decision === "DENY") &&
      P0_SENSITIVE_ACCESS_REASON_CODES.includes(event.decisionCode) &&
      P0_SENSITIVE_RESOURCE_TYPES.includes(event.resourceType) &&
      internalRef(event.resourceId) &&
      Number.isSafeInteger(event.resourceVersion) &&
      event.resourceVersion > 0 &&
      isStrictIsoInstant(event.occurredAt),
  );
}

function fromRow(row: any): P0SensitiveAccessEventDraft {
  return Object.freeze({
    eventKey: row.eventKey,
    correlationId: row.correlationId,
    actorId: row.actorId,
    tenantId: row.tenantId,
    consumerId: row.consumerId,
    authorizationKind: row.authorizationKind,
    authorizationVersion: row.authorizationVersion,
    accessKind: row.accessKind,
    purposeCode: row.purposeCode,
    decision: row.decision,
    decisionCode: row.decisionCode,
    resourceType: row.resourceType,
    resourceId: row.resourceId,
    resourceVersion: row.resourceVersion,
    occurredAt: dateIso(row.occurredAt),
  });
}

function sameEvent(
  expected: P0SensitiveAccessEventDraft,
  actual: P0SensitiveAccessEventDraft,
): boolean {
  return semantic(expected) === semantic(actual);
}

/**
 * Refs-only audit persistence. The authenticated actor and effective scope are
 * revalidated in the same serializable transaction as the append/readback.
 */
export function createP0PrismaSensitiveAccessRepository(
  dependencies: P0PrismaSensitiveAccessRepositoryDependencies,
): P0SensitiveAccessRepository {
  const transactionOptions = {
    isolationLevel: "Serializable" as const,
    maxWait: dependencies.maxWaitMs ?? 5_000,
    timeout: dependencies.timeoutMs ?? 10_000,
  };

  return Object.freeze({
    async appendSensitiveAccessEvent(
      input: Parameters<P0SensitiveAccessRepository["appendSensitiveAccessEvent"]>[0],
    ) {
      if (
        input.purpose !== "SENSITIVE_ACCESS_AUDIT_APPEND" ||
        !STABLE.test(input.operationId) ||
        !authorized(input.principal, input.scope) ||
        !exactEventAuthority(input.event, input.principal, input.scope)
      ) {
        throw new Error("sensitive access audit authority denied");
      }

      return dependencies.client.$transaction(async (transaction: any) => {
        const live = await dependencies.principalRevalidator.revalidateInTransaction({
          transaction,
          principal: input.principal,
          scope: input.scope,
          purpose: input.purpose,
          operationId: input.operationId,
        });
        if (!live) throw new Error("live principal revalidation failed");

        const existing = await transaction.p0SensitiveAccessEvent.findFirst({
          where: {
            tenantId: input.scope.tenantId,
            consumerId: input.scope.consumerId,
            eventKey: input.event.eventKey,
          },
        });
        let disposition: "CREATED" | "IDEMPOTENT_REPLAY" = "CREATED";
        if (existing) {
          const replay = fromRow(existing);
          if (!sameEvent(input.event, replay)) {
            throw new Error("sensitive access audit replay conflict");
          }
          disposition = "IDEMPOTENT_REPLAY";
        } else {
          await transaction.p0SensitiveAccessEvent.create({
            data: {
              tenantId: input.scope.tenantId,
              consumerId: input.scope.consumerId,
              eventKey: input.event.eventKey,
              actorId: input.principal.actorId,
              authorizationKind: input.principal.authorizationKind,
              authorizationVersion: input.principal.authorizationVersion,
              accessKind: input.event.accessKind,
              purposeCode: input.event.purposeCode,
              decision: input.event.decision,
              decisionCode: input.event.decisionCode,
              resourceType: input.event.resourceType,
              resourceId: input.event.resourceId,
              resourceVersion: input.event.resourceVersion,
              correlationId: input.event.correlationId,
              occurredAt: new Date(input.event.occurredAt),
            },
          });
        }

        const persisted = await transaction.p0SensitiveAccessEvent.findFirst({
          where: {
            tenantId: input.scope.tenantId,
            consumerId: input.scope.consumerId,
            eventKey: input.event.eventKey,
          },
        });
        if (!persisted || !sameEvent(input.event, fromRow(persisted))) {
          throw new Error("sensitive access audit readback mismatch");
        }
        return Object.freeze({ disposition });
      }, transactionOptions);
    },

    async readSensitiveAccessEvent(
      input: Parameters<P0SensitiveAccessRepository["readSensitiveAccessEvent"]>[0],
    ) {
      if (
        input.purpose !== "SENSITIVE_ACCESS_AUDIT_READBACK" ||
        !STABLE.test(input.operationId) ||
        !authorized(input.principal, input.scope) ||
        !STABLE.test(input.eventKey)
      ) {
        return null;
      }
      return dependencies.client.$transaction(async (transaction: any) => {
        const live = await dependencies.principalRevalidator.revalidateInTransaction({
          transaction,
          principal: input.principal,
          scope: input.scope,
          purpose: input.purpose,
          operationId: input.operationId,
        });
        if (!live) return null;
        const row = await transaction.p0SensitiveAccessEvent.findFirst({
          where: {
            tenantId: input.scope.tenantId,
            consumerId: input.scope.consumerId,
            eventKey: input.eventKey,
          },
        });
        if (!row) return null;
        const event = fromRow(row);
        return exactEventAuthority(event, input.principal, input.scope)
          ? event
          : null;
      }, transactionOptions);
    },
  });
}
