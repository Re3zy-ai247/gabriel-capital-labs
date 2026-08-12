import { createHash } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import type { PrismaClient } from "@prisma/client";
import {
  evaluateAndMintP0Phase2AGatePermit,
  p0Phase2AFlagsFromEnv,
  resolveP0Phase2ACohortFromServerEnvironment,
  type P0Phase2AGatePermit,
  type ResolvedP0Phase2AFlags,
  type VerifiedP0Phase2ACohortDecision,
} from "./phase2Flags";
import type {
  P0Phase2AReadinessEvidence,
  P0ReadinessMode,
} from "./phase2Readiness";
import { evaluateP0Phase2AReadiness } from "./phase2Readiness";
import type { P0Principal, P0Scope } from "./principal";
import {
  isVerifiedP0Principal,
  p0PrincipalAuthorizesScope,
  p0ScopeFromPrincipal,
} from "./principal";
import type { P0ServerPrincipalDependencies } from "./principalServer";
import {
  resolveP0InteractivePrincipal,
  resolveP0WorkerPrincipal,
} from "./principalServer";
import type {
  P0ReportIngestion,
  P0ReportIngestionService,
} from "./reportIngestion";
import {
  deriveP0ReportSeriesKey,
  type P0PrismaReportVersionRepository,
} from "./prismaReportVersionRepository";
import {
  inspectP0ReportSource,
  type P0ReportSourcePreflightResult,
} from "./reportSourceSafety";
import {
  P0_PRISMA_SOURCE_PROVIDER_KEY,
  P0_SOURCE_ARTIFACT_CONTRACT_VERSION,
  computeP0SourceArtifactSha256,
  deriveP0SourceArtifactOperationIdentity,
  dispatchP0SourceArtifactWrite,
  isVerifiedP0SourceArtifactWriteReceipt,
  verifyP0SourceArtifactCapability,
  type P0SourceArtifactKind,
  type VerifiedP0SourceArtifactWriteReceipt,
} from "./sourceArtifact";
import type { P0PrismaSourceArtifactAdapterBundle } from "./prismaSourceArtifactProvider";
import {
  authorizeAndAuditP0SensitiveAccess,
  verifyAndDeriveP0SensitiveAuditRefs,
  verifyP0SensitiveResourceRef,
  type P0SensitiveAccessRepository,
} from "./sensitiveAccessAudit";
import type {
  P0ReportUploadShadowHook,
  P0ReportUploadShadowHookInput,
} from "./shadowExtractionService";
import {
  createP0ProductionServerPrincipalDependencies,
  issueP0WorkerOperationToken,
  p0WorkerTokenConfigurationFromServerEnvironment,
  revalidateP0PrismaPrincipal,
  type P0PrincipalPrismaClient,
  type P0WorkerOperationPurpose,
  type P0WorkerTokenConfiguration,
} from "./principalPrismaAdapter";
import {
  createPrismaP0ReportIngestionRepository,
  type P0PrismaTransactionalPrincipalRevalidator,
} from "./prismaReportIngestionRepository";
import { createP0ReportIngestionService } from "./reportIngestion";
import { createP0PrismaReportVersionRepository } from "./prismaReportVersionRepository";
import { createP0PrismaSourceArtifactAdapter } from "./prismaSourceArtifactProvider";
import { createP0PrismaSensitiveAccessRepository } from "./prismaSensitiveAccessRepository";
import type { P0TrustedWriterValueProtectionAdapter } from "./trustedWriterValueProtection";
import { createServerEnvironmentP0ValueProtectionAdapter } from "./trustedWriterValueProtection";
import { loadP0TrustedWriterReadinessFromServerEnvironment } from "./trustedWriterReadiness";
import {
  createP0ProductionTrustedWriterPrismaClientProvider,
  isP0TrustedWriterDatabaseRoleBoundPrismaClient,
} from "./trustedWriterPrismaClient";

export const P0_TRUSTED_WRITER_UPLOAD_HOOK_VERSION =
  "p0-trusted-writer-upload-hook-v1" as const;
export const P0_TRUSTED_WRITER_RUNTIME_MODE_ENV =
  "P0_TRUSTED_WRITER_RUNTIME_MODE" as const;
export const P0_TRUSTED_WRITER_DISPOSABLE_MODE =
  "DISPOSABLE_ATTESTATION" as const;
export const P0_TRUSTED_WRITER_PRODUCTION_DORMANT_MODE =
  "PRODUCTION_DORMANT_INSTALLATION" as const;

const STABLE = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,199}$/;
const SAFE = /^[A-Z][A-Z0-9_]{0,63}$/;

export interface P0TrustedWriterSelectedUploadSource {
  readonly kind: "ORIGINAL_PDF" | "ORIGINAL_TEXT";
  readonly mimeType: "application/pdf" | "text/plain";
  readonly content: Uint8Array;
  readonly sha256: string;
  readonly byteLength: number;
  readonly preflight: Extract<P0ReportSourcePreflightResult, { readonly ok: true }>;
}

export interface P0TrustedWriterLegacyReportOwner {
  readonly reportId: string;
  readonly consumerId: string;
}

export interface P0TrustedWriterSourcePersister {
  persistExact(input: {
    readonly principal: P0Principal;
    readonly gatePermit: P0Phase2AGatePermit;
    readonly operationId: string;
    readonly ingestion: P0ReportIngestion;
    readonly source: P0TrustedWriterSelectedUploadSource;
  }): Promise<
    | {
        readonly kind: "VERIFIED" | "IDEMPOTENT_REPLAY";
        readonly receipt: VerifiedP0SourceArtifactWriteReceipt;
      }
    | {
        readonly kind: "DENIED" | "OUTCOME_UNKNOWN";
        readonly safeCode: string;
      }
  >;
}

export interface P0TrustedWriterPrismaSourcePersisterDependencies {
  readonly sourceAdapter: P0PrismaSourceArtifactAdapterBundle;
  readonly sensitiveAccessRepository: P0SensitiveAccessRepository;
}

export interface P0TrustedWriterUploadRuntimeDependencies {
  readonly mode: P0ReadinessMode;
  readonly principalDependencies: P0ServerPrincipalDependencies;
  readonly ingestionService: P0ReportIngestionService;
  readonly sourcePersister: P0TrustedWriterSourcePersister;
  readonly reportVersionRepository: P0PrismaReportVersionRepository;
  readonly readLegacyReportOwner: (
    legacyReportId: string,
  ) => Promise<P0TrustedWriterLegacyReportOwner | null>;
  readonly resolveReadinessEvidence: () =>
    | P0Phase2AReadinessEvidence
    | Promise<P0Phase2AReadinessEvidence>;
  readonly resolveFlags?: () => ResolvedP0Phase2AFlags;
  readonly resolveCohort?: (input: {
    readonly principal: P0Principal;
    readonly scope: P0Scope;
  }) => Promise<VerifiedP0Phase2ACohortDecision | null>;
  readonly issueWorkerOperationToken: (input: {
    readonly ingestionId: string;
    readonly purpose: P0WorkerOperationPurpose;
  }) => Promise<string | null>;
}

interface P0TrustedWriterUploadIdentity {
  readonly publicOperationId: string;
  readonly reservationOperationId: string;
  readonly idempotencyKey: string;
}

function semanticDigest(parts: readonly unknown[]): string {
  return createHash("sha256").update(JSON.stringify(parts), "utf8").digest("hex");
}

function uploadIdentity(input: {
  readonly scope: P0Scope;
  readonly legacyReportId: string;
  readonly sourceSha256: string;
}): P0TrustedWriterUploadIdentity {
  const binding = semanticDigest([
    P0_TRUSTED_WRITER_UPLOAD_HOOK_VERSION,
    input.scope.tenantId,
    input.scope.consumerId,
    input.legacyReportId,
    input.sourceSha256,
  ]);
  return Object.freeze({
    publicOperationId: `p0upload_${binding.slice(0, 40)}`,
    reservationOperationId: `p0uploadop_${binding.slice(0, 40)}`,
    idempotencyKey: `p0uploadidem_${binding.slice(0, 40)}`,
  });
}

function validSourceShape(
  source: P0ReportUploadShadowHookInput["sources"][number],
): boolean {
  return Boolean(
    source &&
      source.content instanceof Uint8Array &&
      ((source.kind === "ORIGINAL_PDF" &&
        source.mimeType === "application/pdf") ||
        (source.kind === "ORIGINAL_TEXT" && source.mimeType === "text/plain")),
  );
}

/**
 * Selects one immutable original. A PDF is the source of record when present;
 * derived PDF text and request bureau selectors are never source authority.
 */
export function selectP0TrustedWriterUploadSource(
  sources: P0ReportUploadShadowHookInput["sources"],
): P0TrustedWriterSelectedUploadSource | null {
  if (!Array.isArray(sources) || sources.length < 1 || sources.length > 2) {
    return null;
  }
  if (sources.some((source) => !validSourceShape(source))) return null;
  const pdfs = sources.filter((source) => source.kind === "ORIGINAL_PDF");
  const texts = sources.filter((source) => source.kind === "ORIGINAL_TEXT");
  if (pdfs.length > 1 || texts.length > 1) return null;
  const selected = pdfs[0] ?? texts[0];
  if (!selected) return null;
  const content = new Uint8Array(selected.content);
  const preflight = inspectP0ReportSource({
    content,
    declaredMimeType: selected.mimeType,
  });
  if (!preflight.ok || preflight.detectedMimeType !== selected.mimeType) {
    return null;
  }
  return Object.freeze({
    kind: selected.kind,
    mimeType: selected.mimeType,
    content,
    sha256: computeP0SourceArtifactSha256(content),
    byteLength: content.byteLength,
    preflight,
  });
}

function safeFailure(value: unknown, fallback: string): string {
  return typeof value === "string" && SAFE.test(value) ? value : fallback;
}

function exactScopePrincipal(principal: P0Principal, scope: P0Scope): boolean {
  return (
    isVerifiedP0Principal(principal) &&
    p0PrincipalAuthorizesScope(principal, scope)
  );
}

/**
 * Concrete protected-source composition used by the real-adapter harness and,
 * after a separate activation checkpoint, the server factory. All authority
 * inputs are derived from the reserved ingestion and branded worker permit.
 */
export function createP0TrustedWriterPrismaSourcePersister(
  dependencies: P0TrustedWriterPrismaSourcePersisterDependencies,
): P0TrustedWriterSourcePersister {
  if (
    dependencies.sourceAdapter?.adapterClass !== "AUTHENTICATED_PRODUCTION" ||
    dependencies.sourceAdapter.provider?.providerKey !==
      P0_PRISMA_SOURCE_PROVIDER_KEY ||
    typeof dependencies.sourceAdapter.writeFence?.runWhileRetained !==
      "function" ||
    typeof dependencies.sensitiveAccessRepository?.appendSensitiveAccessEvent !==
      "function" ||
    typeof dependencies.sensitiveAccessRepository?.readSensitiveAccessEvent !==
      "function"
  ) {
    throw new Error("concrete trusted-writer source dependencies required");
  }
  return Object.freeze({
    async persistExact(
      input: Parameters<P0TrustedWriterSourcePersister["persistExact"]>[0],
    ) {
      const ingestion = input.ingestion;
      const source = input.source;
      let principalScope: P0Scope;
      try {
        principalScope = p0ScopeFromPrincipal(input.principal);
      } catch {
        return { kind: "DENIED", safeCode: "UNVERIFIED_SOURCE_PRINCIPAL" } as const;
      }
      if (
        input.principal.authorizationKind !== "SYSTEM_WORKER" ||
        ingestion.tenantId !== principalScope.tenantId ||
        ingestion.consumerId !== principalScope.consumerId ||
        ingestion.state !== "RECEIVED" ||
        !ingestion.leaseToken ||
        ingestion.leaseOwnerId !== input.principal.actorId ||
        ingestion.sourceDisposition !== "RETAINED" ||
        ingestion.sourceSha256 !== source.sha256 ||
        ingestion.sourceByteLength !== source.byteLength ||
        ingestion.sourceDeclaredMimeType !== source.mimeType ||
        ingestion.sourceDetectedMimeType !== source.mimeType ||
        source.sha256 !== computeP0SourceArtifactSha256(source.content)
      ) {
        return { kind: "DENIED", safeCode: "SOURCE_INGESTION_BINDING_DENIED" } as const;
      }

      let identity: ReturnType<typeof deriveP0SourceArtifactOperationIdentity>;
      try {
        identity = deriveP0SourceArtifactOperationIdentity({
          ...principalScope,
          ingestionId: ingestion.id,
          operationId: ingestion.operationKey,
          kind: source.kind,
        });
      } catch {
        return { kind: "DENIED", safeCode: "SOURCE_IDENTITY_DENIED" } as const;
      }
      const sourceScope = Object.freeze({
        ...principalScope,
        ingestionId: ingestion.id,
        artifactId: identity.artifactId,
        artifactVersion: 1,
      });
      const resourceCandidate = Object.freeze({
        resourceType: "REPORT_INGESTION" as const,
        resourceId: ingestion.id,
        resourceVersion: ingestion.revision,
      });
      const resource = await verifyP0SensitiveResourceRef({
        principal: input.principal,
        scope: principalScope,
        candidate: resourceCandidate,
        verifier: {
          verifierId: "p0-trusted-writer-upload-resource-v1",
          async verifyResourceRef({ principal, scope, candidate }) {
            return (
              exactScopePrincipal(principal, principalScope) &&
              scope.tenantId === principalScope.tenantId &&
              scope.consumerId === principalScope.consumerId &&
              candidate.resourceType === resourceCandidate.resourceType &&
              candidate.resourceId === resourceCandidate.resourceId &&
              candidate.resourceVersion === resourceCandidate.resourceVersion
            );
          },
        },
      });
      if (!resource) {
        return { kind: "DENIED", safeCode: "SOURCE_ACCESS_RESOURCE_DENIED" } as const;
      }
      const auditOpaqueRef = `p0op_${semanticDigest([
        input.operationId,
        ingestion.id,
        ingestion.revision,
        identity.artifactId,
      ])}`;
      const auditRefs = await verifyAndDeriveP0SensitiveAuditRefs({
        principal: input.principal,
        scope: principalScope,
        candidate: {
          operationRef: auditOpaqueRef,
          eventRef: auditOpaqueRef,
        },
        resource,
        accessKind: "WORKER",
        purposeCode: "REPORT_INGESTION",
        verifier: {
          verifierId: "p0-trusted-writer-upload-audit-refs-v1",
          async verifyAuditRefs(request) {
            return (
              request.principal === input.principal &&
              request.scope.tenantId === principalScope.tenantId &&
              request.scope.consumerId === principalScope.consumerId &&
              request.candidate.operationRef === auditOpaqueRef &&
              request.candidate.eventRef === auditOpaqueRef &&
              request.resource === resource &&
              request.accessKind === "WORKER" &&
              request.purposeCode === "REPORT_INGESTION"
            );
          },
        },
      });
      if (!auditRefs) {
        return { kind: "DENIED", safeCode: "SOURCE_ACCESS_REFS_DENIED" } as const;
      }
      const access = await authorizeAndAuditP0SensitiveAccess({
        principal: input.principal,
        scope: principalScope,
        operationId: input.operationId,
        accessKind: "WORKER",
        purposeCode: "REPORT_INGESTION",
        resource,
        auditRefs,
        grantTtlSeconds: 30,
        authorizer: {
          async authorizeSensitiveAccess(request) {
            return exactScopePrincipal(request.principal, principalScope) &&
              request.resource === resource &&
              request.accessKind === "WORKER" &&
              request.purposeCode === "REPORT_INGESTION"
              ? { allowed: true, reasonCode: "AUTHORIZED" }
              : { allowed: false, reasonCode: "SCOPE_DENIED" };
          },
        },
        repository: dependencies.sensitiveAccessRepository,
      });
      if (!access.allowed) {
        return { kind: "DENIED", safeCode: "SOURCE_ACCESS_AUDIT_DENIED" } as const;
      }

      const nowMs = Date.now();
      const candidate = Object.freeze({
        scope: sourceScope,
        purpose: "STORE_SOURCE" as const,
        actorId: input.principal.actorId,
        authorizationDecisionId: input.operationId,
        authorizationVersion: input.principal.authorizationVersion,
        issuedAt: new Date(nowMs - 1_000).toISOString(),
        expiresAt: new Date(nowMs + 30_000).toISOString(),
      });
      const capability = await verifyP0SourceArtifactCapability(
        candidate,
        {
          async verifyDecision({ candidate: actual }) {
            return (
              actual.scope.tenantId === sourceScope.tenantId &&
              actual.scope.consumerId === sourceScope.consumerId &&
              actual.scope.ingestionId === sourceScope.ingestionId &&
              actual.scope.artifactId === sourceScope.artifactId &&
              actual.scope.artifactVersion === sourceScope.artifactVersion &&
              actual.purpose === "STORE_SOURCE" &&
              actual.actorId === input.principal.actorId &&
              actual.authorizationDecisionId === input.operationId &&
              actual.authorizationVersion ===
                input.principal.authorizationVersion
            );
          },
        },
        {
          principal: input.principal,
          permit: input.gatePermit,
          operationId: input.operationId,
        },
      );
      if (!capability) {
        return { kind: "DENIED", safeCode: "SOURCE_CAPABILITY_DENIED" } as const;
      }

      const result = await dispatchP0SourceArtifactWrite(
        dependencies.sourceAdapter.provider,
        {
          contractVersion: P0_SOURCE_ARTIFACT_CONTRACT_VERSION,
          selectedProviderKey: P0_PRISMA_SOURCE_PROVIDER_KEY,
          capability: capability as typeof capability & {
            readonly purpose: "STORE_SOURCE";
          },
          principal: input.principal,
          gatePermit: input.gatePermit,
          operationId: input.operationId,
          sourceOperationId: ingestion.operationKey,
          writeFence: dependencies.sourceAdapter.writeFence,
          ingestionRevision: ingestion.revision,
          sensitiveAccessGrant: access.grant,
          sensitiveResource: resource,
          sensitiveAccessKind: "WORKER",
          sensitiveAccessPurposeCode: "REPORT_INGESTION",
          scope: sourceScope,
          kind: source.kind,
          mimeType: source.mimeType,
          content: source.content,
          sha256: source.sha256,
          byteLength: source.byteLength,
          idempotencyKey: identity.providerOperationId,
        },
      );
      if (!result.ok || !isVerifiedP0SourceArtifactWriteReceipt(result.value)) {
        return {
          kind: result.ok ? "OUTCOME_UNKNOWN" : result.kind === "DENIED" ? "DENIED" : "OUTCOME_UNKNOWN",
          safeCode: result.ok ? "SOURCE_READBACK_UNATTESTED" : safeFailure(result.code, "SOURCE_WRITE_OUTCOME_UNKNOWN"),
        } as const;
      }
      return Object.freeze({
        kind:
          result.value.object.writeDisposition === "IDEMPOTENT_REPLAY"
            ? ("IDEMPOTENT_REPLAY" as const)
            : ("VERIFIED" as const),
        receipt: result.value,
      });
    },
  });
}

export function createP0TrustedWriterUploadHook(
  dependencies: P0TrustedWriterUploadRuntimeDependencies,
): P0ReportUploadShadowHook {
  const resolveFlags = dependencies.resolveFlags ?? p0Phase2AFlagsFromEnv;
  const resolveCohort =
    dependencies.resolveCohort ??
    ((input: { readonly principal: P0Principal; readonly scope: P0Scope }) =>
      resolveP0Phase2ACohortFromServerEnvironment({
        ...input,
        stage: "INGESTION_SHADOW",
      }));

  async function mintPermit(input: {
    readonly principal: P0Principal;
    readonly operationId: string;
  }): Promise<P0Phase2AGatePermit | null> {
    let scope: P0Scope;
    try {
      scope = p0ScopeFromPrincipal(input.principal);
    } catch {
      return null;
    }
    try {
      const cohortDecision = await resolveCohort({
        principal: input.principal,
        scope,
      });
      const readinessEvidence = await dependencies.resolveReadinessEvidence();
      return evaluateAndMintP0Phase2AGatePermit({
        stage: "INGESTION_SHADOW",
        mode: dependencies.mode,
        operationId: input.operationId,
        flags: resolveFlags(),
        principal: input.principal,
        scope,
        cohortDecision,
        readinessEvidence,
      });
    } catch {
      return null;
    }
  }

  async function workerAuthority(input: {
    readonly ingestionId: string;
    readonly purpose: P0WorkerOperationPurpose;
    readonly expectedScope: P0Scope;
  }): Promise<{
    readonly principal: P0Principal;
    readonly operationId: string;
    readonly permit: P0Phase2AGatePermit;
  } | null> {
    const operationId = await dependencies
      .issueWorkerOperationToken({
        ingestionId: input.ingestionId,
        purpose: input.purpose,
      })
      .catch(() => null);
    if (!operationId || !STABLE.test(operationId)) return null;
    const principal = await resolveP0WorkerPrincipal(
      operationId,
      dependencies.principalDependencies,
    ).catch(() => null);
    if (!principal || !exactScopePrincipal(principal, input.expectedScope)) {
      return null;
    }
    const permit = await mintPermit({ principal, operationId });
    return permit ? Object.freeze({ principal, operationId, permit }) : null;
  }

  return Object.freeze({
    async dispatch(input: P0ReportUploadShadowHookInput) {
      if (
        !input ||
        !STABLE.test(input.legacyReportId) ||
        !Array.isArray(input.bureauSelectors)
      ) {
        return { kind: "FAILED", safeCode: "INVALID_UPLOAD_SELECTOR" } as const;
      }
      const source = selectP0TrustedWriterUploadSource(input.sources);
      if (!source) {
        return { kind: "FAILED", safeCode: "SOURCE_PREFLIGHT_REJECTED" } as const;
      }

      // No legacy owner lookup or durable work occurs until the deployment's
      // readiness evidence independently passes for this exact stage.
      let readinessPreflight: P0Phase2AReadinessEvidence;
      try {
        readinessPreflight = await dependencies.resolveReadinessEvidence();
      } catch {
        return { kind: "FAILED", safeCode: "TRUSTED_WRITER_READINESS_DENIED" } as const;
      }
      if (
        !evaluateP0Phase2AReadiness({
          stage: "INGESTION_SHADOW",
          mode: dependencies.mode,
          evidence: readinessPreflight,
          now: new Date(),
        }).ready
      ) {
        return { kind: "FAILED", safeCode: "TRUSTED_WRITER_READINESS_DENIED" } as const;
      }

      const legacy = await dependencies
        .readLegacyReportOwner(input.legacyReportId)
        .catch(() => null);
      if (
        !legacy ||
        legacy.reportId !== input.legacyReportId ||
        !STABLE.test(legacy.consumerId)
      ) {
        return { kind: "FAILED", safeCode: "LEGACY_REPORT_SCOPE_DENIED" } as const;
      }
      const interactivePrincipal = await resolveP0InteractivePrincipal(
        {
          authorizationIntent: "DIRECT_OR_MANAGED",
          consumerSelector: legacy.consumerId,
        },
        dependencies.principalDependencies,
      ).catch(() => null);
      if (!interactivePrincipal) {
        return { kind: "FAILED", safeCode: "AUTHENTICATED_PRINCIPAL_REQUIRED" } as const;
      }
      const scope = p0ScopeFromPrincipal(interactivePrincipal);
      if (
        scope.consumerId !== legacy.consumerId ||
        !exactScopePrincipal(interactivePrincipal, scope)
      ) {
        return { kind: "FAILED", safeCode: "LEGACY_REPORT_SCOPE_DENIED" } as const;
      }
      const identity = uploadIdentity({
        scope,
        legacyReportId: legacy.reportId,
        sourceSha256: source.sha256,
      });
      const reservationPermit = await mintPermit({
        principal: interactivePrincipal,
        operationId: identity.reservationOperationId,
      });
      if (!reservationPermit) {
        return { kind: "FAILED", safeCode: "TRUSTED_WRITER_GATE_DENIED" } as const;
      }

      const reservation = await dependencies.ingestionService
        .reserve({
          principal: interactivePrincipal,
          gatePermit: reservationPermit,
          idempotencyKey: identity.idempotencyKey,
          operationKey: identity.reservationOperationId,
          reportSeriesKey: deriveP0ReportSeriesKey(legacy.reportId),
          reservedVersion: 1,
          sourceSha256: source.sha256,
          sourceByteLength: source.byteLength,
          sourceDeclaredMimeType: source.mimeType,
          sourceDetectedMimeType: source.preflight.detectedMimeType,
          maxAttempts: 3,
        })
        .catch(() => null);
      if (!reservation?.ok) {
        return {
          kind: "FAILED",
          safeCode: safeFailure(
            reservation?.code,
            "INGESTION_RESERVATION_OUTCOME_UNKNOWN",
          ),
        } as const;
      }

      const claimAuthority = await workerAuthority({
        ingestionId: reservation.ingestion.id,
        purpose: "CLAIM",
        expectedScope: scope,
      });
      if (!claimAuthority) {
        return { kind: "FAILED", safeCode: "WORKER_CLAIM_AUTHORITY_DENIED" } as const;
      }
      const claimed = await dependencies.ingestionService
        .claim({
          principal: claimAuthority.principal,
          gatePermit: claimAuthority.permit,
          ingestionId: reservation.ingestion.id,
          operationId: claimAuthority.operationId,
          leaseMs: 60_000,
        })
        .catch(() => null);
      if (!claimed?.ok || !claimed.ingestion.leaseToken) {
        return {
          kind: "FAILED",
          safeCode: safeFailure(
            claimed && !claimed.ok ? claimed.code : null,
            "INGESTION_CLAIM_OUTCOME_UNKNOWN",
          ),
        } as const;
      }

      const storeAuthority = await workerAuthority({
        ingestionId: claimed.ingestion.id,
        purpose: "STORE_SOURCE",
        expectedScope: scope,
      });
      if (!storeAuthority) {
        return { kind: "FAILED", safeCode: "SOURCE_WORKER_AUTHORITY_DENIED" } as const;
      }
      const stored = await dependencies.sourcePersister
        .persistExact({
          principal: storeAuthority.principal,
          gatePermit: storeAuthority.permit,
          operationId: storeAuthority.operationId,
          ingestion: claimed.ingestion,
          source,
        })
        .catch(() => null);
      if (
        !stored ||
        (stored.kind !== "VERIFIED" && stored.kind !== "IDEMPOTENT_REPLAY") ||
        !isVerifiedP0SourceArtifactWriteReceipt(stored.receipt)
      ) {
        return {
          kind: "FAILED",
          safeCode: safeFailure(
            stored && "safeCode" in stored ? stored.safeCode : null,
            "SOURCE_WRITE_OUTCOME_UNKNOWN",
          ),
        } as const;
      }
      const sourceTransitionAuthority = await workerAuthority({
        ingestionId: claimed.ingestion.id,
        purpose: "TRANSITION",
        expectedScope: scope,
      });
      if (!sourceTransitionAuthority) {
        return { kind: "FAILED", safeCode: "SOURCE_TRANSITION_AUTHORITY_DENIED" } as const;
      }
      const sourceTransition = await dependencies.ingestionService
        .transition({
          principal: sourceTransitionAuthority.principal,
          gatePermit: sourceTransitionAuthority.permit,
          ingestionId: claimed.ingestion.id,
          operationId: sourceTransitionAuthority.operationId,
          expectedRevision: claimed.ingestion.revision,
          leaseToken: claimed.ingestion.leaseToken,
          to: "SOURCE_STORED_AND_VERIFIED",
          sourceReceipt: stored.receipt,
        })
        .catch(() => null);
      if (!sourceTransition?.ok || !sourceTransition.ingestion.leaseToken) {
        return {
          kind: "FAILED",
          safeCode: safeFailure(
            sourceTransition && !sourceTransition.ok
              ? sourceTransition.code
              : null,
            "SOURCE_TRANSITION_OUTCOME_UNKNOWN",
          ),
        } as const;
      }

      const commitAuthority = await workerAuthority({
        ingestionId: sourceTransition.ingestion.id,
        purpose: "COMMIT_VERSION",
        expectedScope: scope,
      });
      if (!commitAuthority) {
        return { kind: "FAILED", safeCode: "VERSION_WORKER_AUTHORITY_DENIED" } as const;
      }
      const committed = await dependencies.reportVersionRepository
        .commitExact({
          principal: commitAuthority.principal,
          gatePermit: commitAuthority.permit,
          operationId: commitAuthority.operationId,
          ingestion: sourceTransition.ingestion,
          legacyReportId: legacy.reportId,
          sourceReceipt: stored.receipt,
        })
        .catch(() => null);
      if (
        !committed ||
        (committed.kind !== "CREATED" &&
          committed.kind !== "IDEMPOTENT_REPLAY")
      ) {
        return {
          kind: "FAILED",
          safeCode: safeFailure(
            committed && "code" in committed ? committed.code : null,
            "REPORT_VERSION_COMMIT_OUTCOME_UNKNOWN",
          ),
        } as const;
      }
      const versionTransition = await dependencies.ingestionService
        .transition({
          principal: commitAuthority.principal,
          gatePermit: commitAuthority.permit,
          ingestionId: sourceTransition.ingestion.id,
          operationId: commitAuthority.operationId,
          expectedRevision: sourceTransition.ingestion.revision,
          leaseToken: sourceTransition.ingestion.leaseToken,
          to: "VERSION_COMMITTED",
          reportVersionReceipt: committed.attestation,
        })
        .catch(() => null);
      if (!versionTransition?.ok) {
        return {
          kind: "FAILED",
          safeCode: safeFailure(
            versionTransition && !versionTransition.ok
              ? versionTransition.code
              : null,
            "VERSION_TRANSITION_OUTCOME_UNKNOWN",
          ),
        } as const;
      }
      return {
        kind: "ACCEPTED",
        operationId: identity.publicOperationId,
      } as const;
    },
  });
}

/**
 * Exact legacy ownership lookup. It is only a selector resolution; the
 * report-version transaction independently re-proves ownership before writing.
 */
export function createP0PrismaLegacyReportOwnerReader(
  client: Pick<PrismaClient, "report">,
): P0TrustedWriterUploadRuntimeDependencies["readLegacyReportOwner"] {
  return async (legacyReportId) => {
    if (!STABLE.test(legacyReportId)) return null;
    const row = await client.report.findUnique({
      where: { id: legacyReportId },
      select: { id: true, userId: true },
    });
    return row && STABLE.test(row.id) && STABLE.test(row.userId)
      ? Object.freeze({ reportId: row.id, consumerId: row.userId })
      : null;
  };
}

export interface P0TrustedWriterPrismaUploadHookDependencies {
  /** A caller-selected deployment URL is never accepted here; the server owns this client. */
  readonly client: PrismaClient;
  readonly mode: P0ReadinessMode;
  readonly principalDependencies: P0ServerPrincipalDependencies;
  readonly workerConfiguration: P0WorkerTokenConfiguration;
  readonly valueProtection: P0TrustedWriterValueProtectionAdapter;
  readonly resolveReadinessEvidence: P0TrustedWriterUploadRuntimeDependencies["resolveReadinessEvidence"];
  readonly resolveFlags?: P0TrustedWriterUploadRuntimeDependencies["resolveFlags"];
  readonly resolveCohort?: P0TrustedWriterUploadRuntimeDependencies["resolveCohort"];
}

// Runtime-only provenance for concrete compositions. This is intentionally not
// an enumerable symbol/property: copying, serializing, spreading, proxying, or
// duck-typing a hook cannot manufacture installation authority.
const concretePrismaUploadHooks = new WeakSet<object>();

/**
 * Side-effect-free concrete composition. Construction opens no connection and
 * performs no query; the disposable real-adapter harness supplies its local
 * Prisma client. Deployment installation remains a separately authorized gate.
 */
export function createP0TrustedWriterPrismaUploadHook(
  dependencies: P0TrustedWriterPrismaUploadHookDependencies,
): P0ReportUploadShadowHook {
  if (!isP0TrustedWriterDatabaseRoleBoundPrismaClient(dependencies.client)) {
    throw new Error("trusted-writer database role-bound client required");
  }
  const principalRevalidator: P0PrismaTransactionalPrincipalRevalidator =
    Object.freeze({
      async revalidateInTransaction(
        input: Parameters<
          P0PrismaTransactionalPrincipalRevalidator["revalidateInTransaction"]
        >[0],
      ) {
        return revalidateP0PrismaPrincipal({
          client: input.transaction,
          principal: input.principal,
          operationId: input.operationId,
          repositoryPurpose: input.purpose,
          workerConfiguration: dependencies.workerConfiguration,
        });
      },
    });
  const ingestionRepository = createPrismaP0ReportIngestionRepository({
    client: dependencies.client,
    principalRevalidator,
  });
  const sensitiveAccessRepository =
    createP0PrismaSensitiveAccessRepository({
      client: dependencies.client,
      principalRevalidator,
    });
  const sourceAdapter = createP0PrismaSourceArtifactAdapter({
    prisma: dependencies.client,
    protector: dependencies.valueProtection,
    revalidatePrincipal: (
      transaction,
      principal,
      operationId,
      repositoryPurpose,
    ) =>
      revalidateP0PrismaPrincipal({
        client: transaction as never,
        principal,
        operationId,
        repositoryPurpose,
        workerConfiguration: dependencies.workerConfiguration,
      }),
  });
  const reportVersionRepository = createP0PrismaReportVersionRepository({
    client: dependencies.client,
    revalidatePrincipal: ({
      transaction,
      principal,
      operationId,
      repositoryPurpose,
    }) =>
      revalidateP0PrismaPrincipal({
        client: transaction,
        principal,
        operationId,
        repositoryPurpose,
        workerConfiguration: dependencies.workerConfiguration,
      }),
  });
  const hook = createP0TrustedWriterUploadHook({
    mode: dependencies.mode,
    principalDependencies: dependencies.principalDependencies,
    ingestionService: createP0ReportIngestionService(ingestionRepository),
    sourcePersister: createP0TrustedWriterPrismaSourcePersister({
      sourceAdapter,
      sensitiveAccessRepository,
    }),
    reportVersionRepository,
    readLegacyReportOwner: createP0PrismaLegacyReportOwnerReader(
      dependencies.client,
    ),
    resolveReadinessEvidence: dependencies.resolveReadinessEvidence,
    issueWorkerOperationToken: (request) =>
      dependencies.client.$transaction(
        (transaction) =>
          issueP0WorkerOperationToken(request, {
            client: transaction as unknown as P0PrincipalPrismaClient,
            configuration: dependencies.workerConfiguration,
          }),
        { isolationLevel: "Serializable" },
      ),
    resolveFlags: dependencies.resolveFlags,
    resolveCohort: dependencies.resolveCohort,
  });
  concretePrismaUploadHooks.add(hook);
  return hook;
}

interface P0DisposableHookContext {
  readonly hook: P0ReportUploadShadowHook;
  active: boolean;
}

/**
 * Request/async-chain-local disposable installation. No environment string can
 * provide a client or hook, and only a hook minted by the concrete Prisma
 * composition factory can enter this context. The mutable active bit also
 * invalidates detached descendants after the awaited callback returns.
 */
const disposableHookContext = new AsyncLocalStorage<P0DisposableHookContext>();

export async function withP0DisposableTrustedWriterUploadHook<T>(input: {
  readonly hook: P0ReportUploadShadowHook;
  readonly execute: () => Promise<T>;
}): Promise<T> {
  const parentContext = disposableHookContext.getStore();
  if (
    process.env.NODE_ENV === "production" ||
    process.env[P0_TRUSTED_WRITER_RUNTIME_MODE_ENV] !==
      P0_TRUSTED_WRITER_DISPOSABLE_MODE ||
    !input?.hook ||
    !concretePrismaUploadHooks.has(input.hook) ||
    typeof input.execute !== "function" ||
    parentContext?.active === true
  ) {
    throw new Error("disposable trusted-writer installation denied");
  }
  const context: P0DisposableHookContext = {
    hook: input.hook,
    active: true,
  };
  return disposableHookContext.run(context, async () => {
    try {
      return await input.execute();
    } finally {
      context.active = false;
    }
  });
}

/**
 * Deployment readiness is always reconstructed from signed server state. The
 * receipt proves the installed adapters; it does not authorize activation.
 */
function productionReadinessEvidence(): P0Phase2AReadinessEvidence {
  const productionRepositoryReceipt =
    loadP0TrustedWriterReadinessFromServerEnvironment();
  const verified = productionRepositoryReceipt !== null;
  return Object.freeze({
    migrationVerified: verified,
    migrationSha256: productionRepositoryReceipt?.migrationSha256 ?? "",
    principalBoundaryVerified: verified,
    repositoryBoundaryVerified: verified,
    sourceArtifactBoundaryVerified: verified,
    ingestionBoundaryVerified: verified,
    round0BoundaryVerified: false,
    assertionBoundaryVerified: false,
    repositoryReceipt: null,
    productionRepositoryReceipt,
    // Installation is not activation. These independent gates remain false
    // until separately authorized and attested.
    deployedDbRoleAttested: false,
    hardProcessIsolatedPdfTerminationVerified: false,
    retentionLegalHoldApproved: false,
  });
}

/**
 * Live-route factory. Default/partial configuration returns null. Disposable
 * verification can expose a real concrete hook only to its own async chain.
 * The production-capable composition is server-owned, side-effect-free, and
 * remains non-activating: production uses PRODUCTION_ACTIVATION readiness,
 * whose independent Founder/PDF/retention/deployed-role gates are still closed.
 */
export function createP0ProductionTrustedWriterUploadHook(): P0ReportUploadShadowHook | null {
  const flags = p0Phase2AFlagsFromEnv();
  if (
    !flags.phase2Enabled ||
    flags.killSwitchEngaged ||
    !flags.ingestionShadowEnabled
  ) {
    return null;
  }

  const runtimeMode = process.env[P0_TRUSTED_WRITER_RUNTIME_MODE_ENV];
  if (
    process.env.NODE_ENV !== "production" &&
    runtimeMode === P0_TRUSTED_WRITER_DISPOSABLE_MODE
  ) {
    const context = disposableHookContext.getStore();
    return context?.active === true && concretePrismaUploadHooks.has(context.hook)
      ? context.hook
      : null;
  }

  if (runtimeMode !== P0_TRUSTED_WRITER_PRODUCTION_DORMANT_MODE) return null;
  const receipt = loadP0TrustedWriterReadinessFromServerEnvironment();
  const workerConfiguration =
    p0WorkerTokenConfigurationFromServerEnvironment();
  const valueProtection = createServerEnvironmentP0ValueProtectionAdapter();
  const databaseClientProvider =
    createP0ProductionTrustedWriterPrismaClientProvider();
  if (
    !receipt ||
    !workerConfiguration ||
    !valueProtection ||
    !databaseClientProvider ||
    receipt.databaseRoleIdentitySha256 !==
      databaseClientProvider.roleIdentitySha256
  ) {
    return null;
  }

  // Do not touch a Prisma delegate merely because the route asked whether a
  // hook is installed. The exact server configuration is reloaded at dispatch,
  // and only then is the real concrete composition materialized.
  return Object.freeze({
    async dispatch(input: P0ReportUploadShadowHookInput) {
      const currentFlags = p0Phase2AFlagsFromEnv();
      const currentReceipt =
        loadP0TrustedWriterReadinessFromServerEnvironment();
      const currentWorkerConfiguration =
        p0WorkerTokenConfigurationFromServerEnvironment();
      const currentValueProtection =
        createServerEnvironmentP0ValueProtectionAdapter();
      const currentDatabaseClientProvider =
        createP0ProductionTrustedWriterPrismaClientProvider();
      if (
        process.env[P0_TRUSTED_WRITER_RUNTIME_MODE_ENV] !==
          P0_TRUSTED_WRITER_PRODUCTION_DORMANT_MODE ||
        !currentFlags.phase2Enabled ||
        currentFlags.killSwitchEngaged ||
        !currentFlags.ingestionShadowEnabled ||
        !currentReceipt ||
        !currentWorkerConfiguration ||
        !currentValueProtection ||
        !currentDatabaseClientProvider ||
        currentReceipt.databaseRoleIdentitySha256 !==
          currentDatabaseClientProvider.roleIdentitySha256
      ) {
        return {
          kind: "FAILED",
          safeCode: "TRUSTED_WRITER_COMPOSITION_DENIED",
        } as const;
      }
      try {
        const trustedWriterClient = currentDatabaseClientProvider.getClient();
        return await createP0TrustedWriterPrismaUploadHook({
          client: trustedWriterClient,
          mode:
            process.env.NODE_ENV === "production"
              ? "PRODUCTION_ACTIVATION"
              : "PRE_ACTIVATION_ATTESTATION",
          principalDependencies: createP0ProductionServerPrincipalDependencies(
            trustedWriterClient as unknown as P0PrincipalPrismaClient,
          ),
          workerConfiguration: currentWorkerConfiguration,
          valueProtection: currentValueProtection,
          resolveReadinessEvidence: productionReadinessEvidence,
        }).dispatch(input);
      } catch {
        return {
          kind: "FAILED",
          safeCode: "TRUSTED_WRITER_COMPOSITION_DENIED",
        } as const;
      }
    },
  });
}

export type P0TrustedWriterSourceKind = P0SourceArtifactKind;
