import {
  type P0Principal,
  type P0Scope,
  p0PrincipalAuthorizesScope,
} from "./principal";
import {
  P0_LOCAL_REPOSITORY_ID,
  P0_LOCAL_REPOSITORY_SEMANTICS_VERSION,
  computeP0RepositorySemanticSha256,
  type P0RepositorySourceRef,
  type VerifiedP0RepositoryAttestation,
  verifyLocalP0RepositoryReadback,
} from "./repositoryAttestation";
import {
  p0Phase2AGatePermitAuthorizes,
  type P0Phase2AGatePermit,
} from "./phase2Flags";

export const P0_REPOSITORY_PURPOSES = [
  "INGESTION_RESERVE",
  "INGESTION_CLAIM",
  "INGESTION_TRANSITION",
  "INGESTION_RECOVERY",
  "SOURCE_ARTIFACT_WRITE",
  "SOURCE_ARTIFACT_READ",
  "SOURCE_ARTIFACT_ERASURE",
  "SHADOW_EXTRACTION_WRITE",
  "SHADOW_EXTRACTION_READ",
] as const;

export type P0RepositoryPurpose = (typeof P0_REPOSITORY_PURPOSES)[number];

export interface P0RepositoryContext {
  readonly principal: P0Principal;
  readonly scope: P0Scope;
  readonly purpose: P0RepositoryPurpose;
  readonly operationId: string;
  /** Required for new writes; recovery/read operations remain separately bounded. */
  readonly gatePermit?: P0Phase2AGatePermit;
}

export interface P0RepositoryResourceKey {
  readonly resourceType: string;
  readonly resourceId: string;
  readonly resourceVersion: string;
}

export type P0RepositoryReadResult<T> =
  | { readonly kind: "DENIED" }
  | { readonly kind: "NOT_FOUND" }
  | {
      readonly kind: "FOUND";
      readonly value: T;
      readonly attestation: VerifiedP0RepositoryAttestation<T>;
    }
  | { readonly kind: "OUTCOME_UNKNOWN" };

export type P0RepositoryWriteResult<T> =
  | { readonly kind: "DENIED" }
  | { readonly kind: "CONFLICT" }
  | { readonly kind: "OUTCOME_UNKNOWN" }
  | {
      readonly kind: "CREATED" | "UPDATED" | "IDEMPOTENT_REPLAY";
      readonly value: T;
      readonly attestation: VerifiedP0RepositoryAttestation<T>;
    };

/** Narrow repository port. Every operation requires full scope and purpose. */
export interface P0Repository {
  readExact<T>(
    context: P0RepositoryContext,
    resource: P0RepositoryResourceKey,
    sourceRefs?: readonly P0RepositorySourceRef[],
  ): Promise<P0RepositoryReadResult<T>>;
  createExact<T>(
    context: P0RepositoryContext,
    resource: P0RepositoryResourceKey,
    value: T,
    sourceRefs?: readonly P0RepositorySourceRef[],
  ): Promise<P0RepositoryWriteResult<T>>;
  compareAndSwapExact<T>(
    context: P0RepositoryContext,
    resource: P0RepositoryResourceKey,
    expected: T,
    next: T,
    sourceRefs?: readonly P0RepositorySourceRef[],
  ): Promise<P0RepositoryWriteResult<T>>;
}

export interface LocalSyntheticP0RepositoryOptions {
  /** Test-only fault injection, applied after write and before readback. */
  readonly mutateReadback?: (input: {
    readonly resource: P0RepositoryResourceKey;
    readonly snapshot: unknown;
  }) => unknown;
}

const MACHINE_KEY = /^[A-Z][A-Z0-9_]{0,127}$/;
const STABLE_ID = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,199}$/;

function validContext(context: P0RepositoryContext): boolean {
  return Boolean(
    context &&
      P0_REPOSITORY_PURPOSES.includes(context.purpose) &&
      STABLE_ID.test(context.operationId) &&
      p0PrincipalAuthorizesScope(context.principal, context.scope),
  );
}

function validWriteContext(context: P0RepositoryContext): boolean {
  if (!validContext(context)) return false;
  return Boolean(
    p0Phase2AGatePermitAuthorizes({
        permit: context.gatePermit,
        principal: context.principal,
        scope: context.scope,
        stage: "INGESTION_SHADOW",
        mode: "LOCAL_BUILD",
        operationId: context.operationId,
      }),
  );
}

function validResource(resource: P0RepositoryResourceKey): boolean {
  return Boolean(
    resource &&
      MACHINE_KEY.test(resource.resourceType) &&
      STABLE_ID.test(resource.resourceId) &&
      STABLE_ID.test(resource.resourceVersion),
  );
}

function resourceRef(resource: P0RepositoryResourceKey): P0RepositorySourceRef {
  return Object.freeze({ ...resource });
}

function storageKey(scope: P0Scope, resource: P0RepositoryResourceKey): string {
  return [
    scope.tenantId,
    scope.consumerId,
    resource.resourceType,
    resource.resourceId,
    resource.resourceVersion,
  ].join("\u001f");
}

function cloneJson<T>(value: T): T {
  // Canonicalization rejects non-JSON shapes before this helper is reached.
  return structuredClone(value);
}

/**
 * Local synthetic adapter only. It has no Prisma import, database credential,
 * network access, object storage, or activation receipt.
 */
export function createLocalSyntheticP0Repository(
  options: LocalSyntheticP0RepositoryOptions = {},
): P0Repository {
  const rows = new Map<string, unknown>();
  const verifier = Object.freeze({
    repositoryId: P0_LOCAL_REPOSITORY_ID,
    semanticsVersion: P0_LOCAL_REPOSITORY_SEMANTICS_VERSION,
    async verifyReadback(input: {
      readonly adapterClass: "LOCAL_SYNTHETIC_ONLY";
      readonly repositoryId: typeof P0_LOCAL_REPOSITORY_ID;
      readonly semanticsVersion: typeof P0_LOCAL_REPOSITORY_SEMANTICS_VERSION;
    }): Promise<boolean> {
      return (
        input.adapterClass === "LOCAL_SYNTHETIC_ONLY" &&
        input.repositoryId === P0_LOCAL_REPOSITORY_ID &&
        input.semanticsVersion === P0_LOCAL_REPOSITORY_SEMANTICS_VERSION
      );
    },
  });

  async function attest<T>(
    context: P0RepositoryContext,
    resource: P0RepositoryResourceKey,
    expected: T,
    readback: T,
    sourceRefs: readonly P0RepositorySourceRef[],
  ): Promise<VerifiedP0RepositoryAttestation<T> | null> {
    return verifyLocalP0RepositoryReadback({
      operationId: context.operationId,
      purpose: context.purpose,
      scope: context.scope,
      expectedSnapshot: expected,
      readbackSnapshot: readback,
      sourceRefs: [resourceRef(resource), ...sourceRefs],
      verifier,
    });
  }

  function readback<T>(resource: P0RepositoryResourceKey, value: T): T {
    const snapshot = cloneJson(value);
    return cloneJson(
      options.mutateReadback
        ? (options.mutateReadback({ resource, snapshot }) as T)
        : snapshot,
    );
  }

  return Object.freeze({
    async readExact<T>(
      context: P0RepositoryContext,
      resource: P0RepositoryResourceKey,
      sourceRefs: readonly P0RepositorySourceRef[] = [],
    ): Promise<P0RepositoryReadResult<T>> {
      if (!validContext(context) || !validResource(resource)) return { kind: "DENIED" };
      const stored = rows.get(storageKey(context.scope, resource));
      if (stored === undefined) return { kind: "NOT_FOUND" };
      let expected: T;
      let actual: T;
      try {
        expected = cloneJson(stored as T);
        actual = readback(resource, expected);
      } catch {
        return { kind: "OUTCOME_UNKNOWN" };
      }
      const attestation = await attest(context, resource, expected, actual, sourceRefs);
      return attestation
        ? { kind: "FOUND", value: attestation.snapshot, attestation }
        : { kind: "OUTCOME_UNKNOWN" };
    },

    async createExact<T>(
      context: P0RepositoryContext,
      resource: P0RepositoryResourceKey,
      value: T,
      sourceRefs: readonly P0RepositorySourceRef[] = [],
    ): Promise<P0RepositoryWriteResult<T>> {
      if (!validWriteContext(context) || !validResource(resource)) return { kind: "DENIED" };
      let expectedDigest: string;
      try {
        expectedDigest = computeP0RepositorySemanticSha256(value);
      } catch {
        return { kind: "DENIED" };
      }
      const key = storageKey(context.scope, resource);
      const existing = rows.get(key);
      if (existing !== undefined) {
        let existingDigest: string;
        try {
          existingDigest = computeP0RepositorySemanticSha256(existing);
        } catch {
          return { kind: "OUTCOME_UNKNOWN" };
        }
        if (existingDigest !== expectedDigest) return { kind: "CONFLICT" };
        const actual = readback(resource, existing as T);
        const attestation = await attest(context, resource, value, actual, sourceRefs);
        return attestation
          ? {
              kind: "IDEMPOTENT_REPLAY",
              value: attestation.snapshot,
              attestation,
            }
          : { kind: "OUTCOME_UNKNOWN" };
      }

      rows.set(key, cloneJson(value));
      let actual: T;
      try {
        actual = readback(resource, rows.get(key) as T);
      } catch {
        return { kind: "OUTCOME_UNKNOWN" };
      }
      const attestation = await attest(context, resource, value, actual, sourceRefs);
      return attestation
        ? { kind: "CREATED", value: attestation.snapshot, attestation }
        : { kind: "OUTCOME_UNKNOWN" };
    },

    async compareAndSwapExact<T>(
      context: P0RepositoryContext,
      resource: P0RepositoryResourceKey,
      expected: T,
      next: T,
      sourceRefs: readonly P0RepositorySourceRef[] = [],
    ): Promise<P0RepositoryWriteResult<T>> {
      if (!validWriteContext(context) || !validResource(resource)) return { kind: "DENIED" };
      const key = storageKey(context.scope, resource);
      const current = rows.get(key);
      if (current === undefined) return { kind: "CONFLICT" };
      try {
        if (
          computeP0RepositorySemanticSha256(current) !==
          computeP0RepositorySemanticSha256(expected)
        ) {
          return { kind: "CONFLICT" };
        }
        computeP0RepositorySemanticSha256(next);
      } catch {
        return { kind: "DENIED" };
      }

      rows.set(key, cloneJson(next));
      let actual: T;
      try {
        actual = readback(resource, rows.get(key) as T);
      } catch {
        return { kind: "OUTCOME_UNKNOWN" };
      }
      const attestation = await attest(context, resource, next, actual, sourceRefs);
      return attestation
        ? { kind: "UPDATED", value: attestation.snapshot, attestation }
        : { kind: "OUTCOME_UNKNOWN" };
    },
  });
}
