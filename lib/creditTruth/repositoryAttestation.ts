import { createHash } from "node:crypto";
import type { P0Scope } from "./principal";

export const P0_REPOSITORY_ATTESTATION_CONTRACT_VERSION =
  "p0-repository-attestation-v1" as const;
export const P0_LOCAL_REPOSITORY_ID = "P0_LOCAL_SYNTHETIC_REPOSITORY" as const;
export const P0_LOCAL_REPOSITORY_SEMANTICS_VERSION =
  "p0-local-repository-semantics-v1" as const;

const VERIFIED_REPOSITORY_ATTESTATION = Symbol("verified-p0-repository-attestation");
const verifiedAttestations = new WeakMap<object, string>();
const SHA256 = /^[a-f0-9]{64}$/;
const MACHINE_KEY = /^[A-Z][A-Z0-9_]{0,127}$/;

export interface P0RepositorySourceRef {
  readonly resourceType: string;
  readonly resourceId: string;
  readonly resourceVersion: string;
  readonly integritySha256?: string;
}

export interface P0RepositoryReadbackVerification {
  readonly contractVersion: typeof P0_REPOSITORY_ATTESTATION_CONTRACT_VERSION;
  readonly adapterClass: "LOCAL_SYNTHETIC_ONLY";
  readonly repositoryId: typeof P0_LOCAL_REPOSITORY_ID;
  readonly semanticsVersion: typeof P0_LOCAL_REPOSITORY_SEMANTICS_VERSION;
  readonly operationId: string;
  readonly purpose: string;
  readonly scopeSha256: string;
  /** Ephemeral equality digest. Never persist or log it. */
  readonly semanticSha256: string;
  /** Durable-safe digest of refs only; never values. */
  readonly sourceSetSha256: string;
}

export interface P0LocalRepositoryAttestationVerifier {
  readonly repositoryId: typeof P0_LOCAL_REPOSITORY_ID;
  readonly semanticsVersion: typeof P0_LOCAL_REPOSITORY_SEMANTICS_VERSION;
  verifyReadback(input: P0RepositoryReadbackVerification): Promise<boolean>;
}

export interface VerifiedP0RepositoryAttestation<T> {
  readonly operationId: string;
  readonly purpose: string;
  readonly scope: P0Scope;
  readonly repositoryId: typeof P0_LOCAL_REPOSITORY_ID;
  readonly semanticsVersion: typeof P0_LOCAL_REPOSITORY_SEMANTICS_VERSION;
  readonly semanticSha256: string;
  readonly sourceSetSha256: string;
  readonly snapshot: T;
  readonly [VERIFIED_REPOSITORY_ATTESTATION]: true;
}

function canonical(value: unknown, ancestors = new Set<object>()): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("semantic values must be finite");
    return JSON.stringify(value);
  }
  if (typeof value !== "object") throw new Error("semantic values must be JSON-domain values");
  if (ancestors.has(value)) throw new Error("semantic values must not be cyclic");
  const nested = new Set(ancestors);
  nested.add(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonical(item, nested)).join(",")}]`;
  if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
    throw new Error("semantic values must be plain records");
  }
  const record = value as Readonly<Record<string, unknown>>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonical(record[key], nested)}`)
    .join(",")}}`;
}

function immutableSnapshot<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return Object.freeze(value.map((item) => immutableSnapshot(item))) as T;
  }
  if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
    throw new Error("semantic snapshots must be plain records");
  }
  const clone: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) clone[key] = immutableSnapshot(nested);
  return Object.freeze(clone) as T;
}

export function computeP0RepositorySemanticSha256(value: unknown): string {
  return createHash("sha256").update(canonical(value), "utf8").digest("hex");
}

export function computeP0RepositorySourceSetSha256(
  refs: readonly P0RepositorySourceRef[],
): string {
  const checked = refs.map((ref) => {
    if (
      !ref ||
      !MACHINE_KEY.test(ref.resourceType) ||
      typeof ref.resourceId !== "string" ||
      ref.resourceId.length < 1 ||
      ref.resourceId.length > 200 ||
      typeof ref.resourceVersion !== "string" ||
      ref.resourceVersion.length < 1 ||
      ref.resourceVersion.length > 200 ||
      (ref.integritySha256 !== undefined && !SHA256.test(ref.integritySha256))
    ) {
      throw new Error("source identity must contain bounded value-free refs");
    }
    return [
      ref.resourceType,
      ref.resourceId,
      ref.resourceVersion,
      ref.integritySha256 ?? null,
    ] as const;
  });
  return computeP0RepositorySemanticSha256(checked);
}

function scopeSha256(scope: P0Scope): string {
  return computeP0RepositorySemanticSha256([scope.tenantId, scope.consumerId]);
}

function attestationBinding(attestation: VerifiedP0RepositoryAttestation<unknown>): string {
  return computeP0RepositorySemanticSha256([
    attestation.operationId,
    attestation.purpose,
    attestation.scope.tenantId,
    attestation.scope.consumerId,
    attestation.repositoryId,
    attestation.semanticsVersion,
    attestation.semanticSha256,
    attestation.sourceSetSha256,
  ]);
}

/**
 * Local/synthetic contract proof only. Exact expected and readback snapshots
 * are compared in memory before a branded result is minted.
 */
export async function verifyLocalP0RepositoryReadback<T>(input: {
  readonly operationId: string;
  readonly purpose: string;
  readonly scope: P0Scope;
  readonly expectedSnapshot: T;
  readonly readbackSnapshot: T;
  readonly sourceRefs: readonly P0RepositorySourceRef[];
  readonly verifier: P0LocalRepositoryAttestationVerifier;
}): Promise<VerifiedP0RepositoryAttestation<T> | null> {
  if (
    typeof input.operationId !== "string" ||
    input.operationId.length < 1 ||
    input.operationId.length > 200 ||
    !MACHINE_KEY.test(input.purpose) ||
    !input.scope?.tenantId ||
    !input.scope?.consumerId ||
    input.verifier?.repositoryId !== P0_LOCAL_REPOSITORY_ID ||
    input.verifier?.semanticsVersion !== P0_LOCAL_REPOSITORY_SEMANTICS_VERSION
  ) {
    return null;
  }

  let expectedSha256: string;
  let readbackSha256: string;
  let sourceSetSha256: string;
  let snapshot: T;
  try {
    expectedSha256 = computeP0RepositorySemanticSha256(input.expectedSnapshot);
    readbackSha256 = computeP0RepositorySemanticSha256(input.readbackSnapshot);
    sourceSetSha256 = computeP0RepositorySourceSetSha256(input.sourceRefs);
    snapshot = immutableSnapshot(input.readbackSnapshot);
  } catch {
    return null;
  }
  if (expectedSha256 !== readbackSha256) return null;

  const verification = Object.freeze({
    contractVersion: P0_REPOSITORY_ATTESTATION_CONTRACT_VERSION,
    adapterClass: "LOCAL_SYNTHETIC_ONLY" as const,
    repositoryId: P0_LOCAL_REPOSITORY_ID,
    semanticsVersion: P0_LOCAL_REPOSITORY_SEMANTICS_VERSION,
    operationId: input.operationId,
    purpose: input.purpose,
    scopeSha256: scopeSha256(input.scope),
    semanticSha256: expectedSha256,
    sourceSetSha256,
  });
  let verified = false;
  try {
    verified = await input.verifier.verifyReadback(verification);
  } catch {
    return null;
  }
  if (verified !== true) return null;

  const attestation = {
    operationId: input.operationId,
    purpose: input.purpose,
    scope: Object.freeze({ ...input.scope }),
    repositoryId: P0_LOCAL_REPOSITORY_ID,
    semanticsVersion: P0_LOCAL_REPOSITORY_SEMANTICS_VERSION,
    semanticSha256: expectedSha256,
    sourceSetSha256,
    snapshot,
  } as VerifiedP0RepositoryAttestation<T>;
  Object.defineProperty(attestation, VERIFIED_REPOSITORY_ATTESTATION, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  Object.freeze(attestation);
  verifiedAttestations.set(attestation, attestationBinding(attestation));
  return attestation;
}

export function isVerifiedP0RepositoryAttestation<T>(
  attestation: VerifiedP0RepositoryAttestation<T> | null | undefined,
): attestation is VerifiedP0RepositoryAttestation<T> {
  if (!attestation || typeof attestation !== "object") return false;
  return (
    attestation[VERIFIED_REPOSITORY_ATTESTATION] === true &&
    Object.isFrozen(attestation) &&
    verifiedAttestations.get(attestation) === attestationBinding(attestation)
  );
}
