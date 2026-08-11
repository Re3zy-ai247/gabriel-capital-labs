/**
 * Exact Phase 2A principal contract.
 *
 * Visible identifiers are not authority.  A P0Principal is minted only after
 * an injected server-side verifier revalidates the authenticated actor and the
 * effective tenant/consumer grant.  Repository code also checks the in-memory
 * brand, so a request body shaped like this interface fails closed.
 */
import { isStrictIsoInstant } from "./progressIntelligence";

export const P0_PRINCIPAL_CONTRACT_VERSION = "p0-principal-v1" as const;

export const P0_AUTHORIZATION_KINDS = [
  "DIRECT_CONSUMER",
  "AGENCY_MANAGED_CLIENT",
  "ADMIN_IMPERSONATION",
  "SYSTEM_WORKER",
] as const;

export type P0AuthorizationKind = (typeof P0_AUTHORIZATION_KINDS)[number];

export interface P0Scope {
  readonly tenantId: string;
  readonly consumerId: string;
}

export interface P0PrincipalCandidate extends P0Scope {
  readonly actorId: string;
  readonly authorizationKind: P0AuthorizationKind;
  readonly authorizationVersion: string;
}

const VERIFIED_P0_PRINCIPAL = Symbol("verified-p0-principal");
const verifiedPrincipals = new WeakMap<object, string>();
const verifiedPrincipalExpiresAt = new WeakMap<object, number>();

export interface P0Principal extends P0PrincipalCandidate {
  readonly [VERIFIED_P0_PRINCIPAL]: true;
}

export interface P0PrincipalCandidateVerifier {
  verifyCandidate(input: {
    readonly candidate: Readonly<P0PrincipalCandidate>;
  }): Promise<boolean>;
}

const STABLE_ID = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,199}$/;
const AUTHORIZATION_VERSION = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,199}$/;

function stableId(value: unknown): value is string {
  return typeof value === "string" && STABLE_ID.test(value);
}

function candidateBinding(candidate: P0PrincipalCandidate): string {
  return [
    candidate.actorId,
    candidate.tenantId,
    candidate.consumerId,
    candidate.authorizationKind,
    candidate.authorizationVersion,
  ].join("\u001f");
}

export function validateP0PrincipalCandidate(
  candidate: P0PrincipalCandidate,
): readonly string[] {
  const errors: string[] = [];
  if (!candidate || typeof candidate !== "object") return ["INVALID_PRINCIPAL"];
  if (!stableId(candidate.actorId)) errors.push("INVALID_ACTOR_ID");
  if (!stableId(candidate.tenantId)) errors.push("INVALID_TENANT_ID");
  if (!stableId(candidate.consumerId)) errors.push("INVALID_CONSUMER_ID");
  if (!P0_AUTHORIZATION_KINDS.includes(candidate.authorizationKind)) {
    errors.push("INVALID_AUTHORIZATION_KIND");
  }
  if (
    typeof candidate.authorizationVersion !== "string" ||
    !AUTHORIZATION_VERSION.test(candidate.authorizationVersion)
  ) {
    errors.push("INVALID_AUTHORIZATION_VERSION");
  }
  if (
    candidate.authorizationKind === "DIRECT_CONSUMER" &&
    candidate.tenantId !== candidate.consumerId
  ) {
    errors.push("DIRECT_SCOPE_MISMATCH");
  }
  if (
    candidate.authorizationKind === "AGENCY_MANAGED_CLIENT" &&
    candidate.tenantId === candidate.consumerId
  ) {
    errors.push("MANAGED_SCOPE_NOT_DISTINCT");
  }
  return Object.freeze([...new Set(errors)]);
}

/**
 * Mint an immutable, process-local principal only after a server-owned verifier
 * confirms the exact candidate. A verifier exception is a denial.
 */
export async function verifyP0PrincipalCandidate(
  candidate: P0PrincipalCandidate,
  verifier: P0PrincipalCandidateVerifier,
  lifetime?: { readonly expiresAt: string },
): Promise<P0Principal | null> {
  if (validateP0PrincipalCandidate(candidate).length > 0) return null;
  if (typeof verifier?.verifyCandidate !== "function") return null;

  const snapshot = Object.freeze({ ...candidate });
  let allowed = false;
  try {
    allowed = await verifier.verifyCandidate({ candidate: snapshot });
  } catch {
    return null;
  }
  if (allowed !== true) return null;

  let expiresAtMs: number | null = null;
  if (lifetime) {
    const nowMs = Date.now();
    if (!isStrictIsoInstant(lifetime.expiresAt)) return null;
    expiresAtMs = Date.parse(lifetime.expiresAt);
    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= nowMs || expiresAtMs - nowMs > 60_000) return null;
  }

  const principal = { ...snapshot } as P0Principal;
  Object.defineProperty(principal, VERIFIED_P0_PRINCIPAL, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  Object.freeze(principal);
  verifiedPrincipals.set(principal, candidateBinding(principal));
  if (expiresAtMs !== null) verifiedPrincipalExpiresAt.set(principal, expiresAtMs);
  return principal;
}

export function isVerifiedP0Principal(
  principal: P0Principal | P0PrincipalCandidate | null | undefined,
): principal is P0Principal {
  if (!principal || typeof principal !== "object") return false;
  const branded = principal as P0Principal;
  return (
    branded[VERIFIED_P0_PRINCIPAL] === true &&
    Object.isFrozen(principal) &&
    verifiedPrincipals.get(principal) === candidateBinding(principal) &&
    (verifiedPrincipalExpiresAt.get(principal) === undefined || Date.now() < verifiedPrincipalExpiresAt.get(principal)!)
  );
}

export function p0ScopeFromPrincipal(principal: P0Principal): P0Scope {
  if (!isVerifiedP0Principal(principal)) {
    throw new Error("verified P0 principal required");
  }
  return Object.freeze({
    tenantId: principal.tenantId,
    consumerId: principal.consumerId,
  });
}

export function p0PrincipalAuthorizesScope(
  principal: P0Principal | null | undefined,
  scope: P0Scope,
): boolean {
  return Boolean(
    isVerifiedP0Principal(principal) &&
      scope &&
      principal.tenantId === scope.tenantId &&
      principal.consumerId === scope.consumerId,
  );
}

/** Compatibility alias used by narrow Phase 2A service ports. */
export function validateP0Principal(
  principal: P0Principal | null | undefined,
): readonly string[] {
  return isVerifiedP0Principal(principal)
    ? []
    : Object.freeze(["UNVERIFIED_PRINCIPAL"]);
}
