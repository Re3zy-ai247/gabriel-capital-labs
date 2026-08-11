import {
  type P0Principal,
  type P0PrincipalCandidate,
  verifyP0PrincipalCandidate,
} from "./principal";

/**
 * Dependency-injected server resolver. It deliberately imports neither Prisma,
 * cookies, Next headers, nor a production identity provider. Concrete runtime
 * authentication remains a separately reviewed adapter boundary.
 */

export interface P0AuthenticatedActor {
  readonly id: string;
  readonly disabled: boolean;
  readonly role: "USER" | "ADMIN";
  readonly isAgency: boolean;
}

interface P0AuthorizationReceiptBase {
  readonly actorId: string;
  readonly tenantId: string;
  readonly consumerId: string;
  readonly authorizationVersion: string;
  readonly active: true;
}

export interface P0DirectConsumerAuthorizationReceipt
  extends P0AuthorizationReceiptBase {
  readonly kind: "DIRECT_CONSUMER";
  readonly grantId: string;
}

export interface P0ManagedClientAuthorizationReceipt
  extends P0AuthorizationReceiptBase {
  readonly kind: "AGENCY_MANAGED_CLIENT";
  readonly grantId: string;
}

export interface P0AdminAuthorizationReceipt
  extends P0AuthorizationReceiptBase {
  readonly kind: "ADMIN_IMPERSONATION";
  readonly delegationId: string;
}

export interface P0WorkerAuthorizationReceipt
  extends P0AuthorizationReceiptBase {
  readonly kind: "SYSTEM_WORKER";
  readonly operationId: string;
  readonly expiresAt: string;
}

export interface P0ServerPrincipalDependencies {
  resolveAuthenticatedActor(): Promise<P0AuthenticatedActor | null>;
  revalidateDirectConsumerGrant(input: {
    readonly actorId: string;
  }): Promise<P0DirectConsumerAuthorizationReceipt | null>;
  revalidateManagedClientGrant(input: {
    readonly actorId: string;
    readonly consumerId: string;
  }): Promise<P0ManagedClientAuthorizationReceipt | null>;
  revalidateAdminDelegation(input: {
    readonly actorId: string;
    readonly consumerId: string;
  }): Promise<P0AdminAuthorizationReceipt | null>;
  resolveWorkerOperation(input: {
    readonly operationId: string;
  }): Promise<P0WorkerAuthorizationReceipt | null>;
}

export type P0InteractiveAuthorizationIntent =
  | "DIRECT_OR_MANAGED"
  | "ADMIN_IMPERSONATION";

export interface P0InteractivePrincipalRequest {
  /** A selector only. Authority comes from a fresh server-side grant read. */
  readonly consumerSelector?: string;
  /** Chosen by the server route, never copied from a request body/query. */
  readonly authorizationIntent: P0InteractiveAuthorizationIntent;
}

function exactCandidate(
  candidate: Readonly<P0PrincipalCandidate>,
  expected: Readonly<P0PrincipalCandidate>,
): boolean {
  return (
    candidate.actorId === expected.actorId &&
    candidate.tenantId === expected.tenantId &&
    candidate.consumerId === expected.consumerId &&
    candidate.authorizationKind === expected.authorizationKind &&
    candidate.authorizationVersion === expected.authorizationVersion
  );
}

async function mintExpectedPrincipal(
  candidate: P0PrincipalCandidate,
  expiresAt: string = new Date(Date.now() + 60_000).toISOString(),
): Promise<P0Principal | null> {
  const expected = Object.freeze({ ...candidate });
  return verifyP0PrincipalCandidate(expected, {
    async verifyCandidate({ candidate: actual }) {
      return exactCandidate(actual, expected);
    },
  }, { expiresAt });
}

export async function resolveP0InteractivePrincipal(
  request: P0InteractivePrincipalRequest,
  dependencies: P0ServerPrincipalDependencies,
): Promise<P0Principal | null> {
  if (!request || typeof request !== "object") return null;
  const actor = await dependencies.resolveAuthenticatedActor().catch(() => null);
  if (!actor || actor.disabled || !actor.id) return null;

  if (request.authorizationIntent === "DIRECT_OR_MANAGED") {
    const selector = request.consumerSelector?.trim();
    const directReceipt = await dependencies
      .revalidateDirectConsumerGrant({ actorId: actor.id })
      .catch(() => null);
    if (
      directReceipt &&
      directReceipt.active === true &&
      directReceipt.kind === "DIRECT_CONSUMER" &&
      directReceipt.actorId === actor.id &&
      directReceipt.tenantId === directReceipt.consumerId &&
      (!selector || selector === directReceipt.consumerId) &&
      directReceipt.grantId
    ) {
      return mintExpectedPrincipal({
        actorId: directReceipt.actorId,
        tenantId: directReceipt.tenantId,
        consumerId: directReceipt.consumerId,
        authorizationKind: directReceipt.kind,
        authorizationVersion: directReceipt.authorizationVersion,
      });
    }
    if (!selector) return null;
    if (!actor.isAgency) return null;
    const receipt = await dependencies
      .revalidateManagedClientGrant({ actorId: actor.id, consumerId: selector })
      .catch(() => null);
    if (
      !receipt ||
      receipt.active !== true ||
      receipt.kind !== "AGENCY_MANAGED_CLIENT" ||
      receipt.actorId !== actor.id ||
      receipt.consumerId !== selector ||
      receipt.tenantId === receipt.consumerId ||
      !receipt.grantId
    ) {
      return null;
    }
    return mintExpectedPrincipal({
      actorId: receipt.actorId,
      tenantId: receipt.tenantId,
      consumerId: receipt.consumerId,
      authorizationKind: receipt.kind,
      authorizationVersion: receipt.authorizationVersion,
    });
  }

  if (request.authorizationIntent !== "ADMIN_IMPERSONATION" || actor.role !== "ADMIN") {
    return null;
  }
  const selector = request.consumerSelector?.trim();
  if (!selector) return null;
  const receipt = await dependencies
    .revalidateAdminDelegation({ actorId: actor.id, consumerId: selector })
    .catch(() => null);
  if (
    !receipt ||
    receipt.active !== true ||
    receipt.kind !== "ADMIN_IMPERSONATION" ||
    receipt.actorId !== actor.id ||
    receipt.consumerId !== selector ||
    !receipt.delegationId
  ) {
    return null;
  }
  return mintExpectedPrincipal({
    actorId: receipt.actorId,
    tenantId: receipt.tenantId,
    consumerId: receipt.consumerId,
    authorizationKind: receipt.kind,
    authorizationVersion: receipt.authorizationVersion,
  });
}

/**
 * Worker requests carry only an opaque operation id. The worker resolver must
 * reread its exact actor/scope grant; no scope supplied by a job is accepted.
 * Server-resolved direct/managed/admin principals are likewise short-lived
 * (60 seconds) and must be freshly resolved for a later operation.
 */
export async function resolveP0WorkerPrincipal(
  operationId: string,
  dependencies: Pick<P0ServerPrincipalDependencies, "resolveWorkerOperation">,
): Promise<P0Principal | null> {
  if (typeof operationId !== "string" || operationId.length < 1 || operationId.length > 200) {
    return null;
  }
  const receipt = await dependencies
    .resolveWorkerOperation({ operationId })
    .catch(() => null);
  if (
    !receipt ||
    receipt.active !== true ||
    receipt.kind !== "SYSTEM_WORKER" ||
    receipt.operationId !== operationId
  ) {
    return null;
  }
  return mintExpectedPrincipal({
    actorId: receipt.actorId,
    tenantId: receipt.tenantId,
    consumerId: receipt.consumerId,
    authorizationKind: receipt.kind,
    authorizationVersion: receipt.authorizationVersion,
  }, receipt.expiresAt);
}
