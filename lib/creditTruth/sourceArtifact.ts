import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import type { P0Principal, P0Scope } from "./principal";
import { p0PrincipalAuthorizesScope, p0ScopeFromPrincipal } from "./principal";
import { isStrictIsoInstant } from "./progressIntelligence";
import type { P0ReportIngestionState } from "./reportIngestion";
import {
  p0Phase2AGatePermitAuthorizes,
  type P0Phase2AGatePermit,
} from "./phase2Flags";
import {
  p0SensitiveAccessGrantAllows,
  type P0SensitiveAccessKind,
  type P0SensitiveAccessPurposeCode,
  type VerifiedP0SensitiveResourceRef,
  type VerifiedP0SensitiveAccessGrant,
} from "./sensitiveAccessAudit";
import {
  P0_LOCAL_REPOSITORY_ID,
  P0_LOCAL_REPOSITORY_SEMANTICS_VERSION,
  computeP0RepositorySemanticSha256,
  computeP0RepositorySourceSetSha256,
  isVerifiedP0RepositoryAttestation,
  verifyLocalP0RepositoryReadback,
  type P0RepositorySourceRef,
  type VerifiedP0RepositoryAttestation,
} from "./repositoryAttestation";

export const P0_SOURCE_ARTIFACT_CONTRACT_VERSION = "p0-source-artifact-v1" as const;
export const P0_LOCAL_SOURCE_PROVIDER_KEY = "P0_LOCAL_SYNTHETIC_SOURCE" as const;
export const P0_MAX_SOURCE_ARTIFACT_BYTES = 15 * 1024 * 1024;

export type P0SourceArtifactKind =
  | "ORIGINAL_PDF"
  | "ORIGINAL_TEXT"
  | "NORMALIZED_TEXT";
export type P0SourceArtifactPurpose =
  | "STORE_SOURCE"
  | "READ_SOURCE"
  | "ERASE_SOURCE";

export interface P0SourceArtifactScope {
  readonly tenantId: string;
  readonly consumerId: string;
  readonly ingestionId: string;
  readonly artifactId: string;
  readonly artifactVersion: number;
}

export interface P0SourceArtifactCapabilityCandidate {
  readonly scope: P0SourceArtifactScope;
  readonly purpose: P0SourceArtifactPurpose;
  readonly actorId: string;
  readonly authorizationDecisionId: string;
  readonly authorizationVersion: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
}

const VERIFIED_SOURCE_CAPABILITY = Symbol("verified-source-capability");
const verifiedCapabilities = new WeakMap<object, string>();

export interface VerifiedP0SourceArtifactCapability
  extends P0SourceArtifactCapabilityCandidate {
  readonly [VERIFIED_SOURCE_CAPABILITY]: true;
}

export interface P0SourceArtifactCapabilityVerifier {
  verifyDecision(input: {
    readonly candidate: Readonly<P0SourceArtifactCapabilityCandidate>;
    readonly now: Date;
  }): Promise<boolean>;
}

export interface P0SourceArtifactStoreGate {
  readonly principal: P0Principal;
  readonly permit: P0Phase2AGatePermit;
  readonly operationId: string;
}

const VERIFIED_SOURCE_WRITE_FENCE_PERMIT = Symbol("verified-source-write-fence-permit");
const verifiedWriteFencePermits = new WeakMap<object, string>();

export interface VerifiedP0SourceWriteFencePermit {
  readonly tenantId: string;
  readonly consumerId: string;
  readonly ingestionId: string;
  readonly ingestionRevision: number;
  readonly operationId: string;
  readonly sourceOperationId: string;
  readonly [VERIFIED_SOURCE_WRITE_FENCE_PERMIT]: true;
}

export type P0SourceWriteFenceResult<T> =
  | { readonly kind: "EXECUTED"; readonly value: T }
  | { readonly kind: "DENIED" | "OUTCOME_UNKNOWN" };

/**
 * A production implementation must hold an atomic retained-ingestion fence for
 * the full provider put + byte readback. The local implementation below is
 * synthetic only; it does not close the authenticated production adapter gate.
 */
export interface P0SourceArtifactWriteFence {
  runWhileRetained<T>(input: {
    readonly principal: P0Principal;
    readonly scope: P0SourceArtifactScope;
    readonly ingestionRevision: number;
    readonly operationId: string;
    readonly sourceOperationId: string;
    readonly execute: (permit: VerifiedP0SourceWriteFencePermit) => Promise<T>;
  }): Promise<P0SourceWriteFenceResult<T>>;
}

export interface P0SourceLocatorEnvelope {
  readonly ciphertextBase64: string;
  readonly ivBase64: string;
  readonly authTagBase64: string;
  readonly algorithm: "AES_256_GCM";
  readonly keyVersion: string;
  readonly envelopeVersion: "p0-local-source-locator-v1";
  readonly aadVersion: string;
  readonly aadSha256: string;
}

export interface P0StoredSourceArtifact {
  readonly contractVersion: typeof P0_SOURCE_ARTIFACT_CONTRACT_VERSION;
  readonly scope: P0SourceArtifactScope;
  readonly providerKey: typeof P0_LOCAL_SOURCE_PROVIDER_KEY;
  /** Deterministic provider operation identity derived from durable ingestion identity. */
  readonly providerOperationId: string;
  readonly providerObjectVersion: string;
  readonly locator: P0SourceLocatorEnvelope;
  readonly kind: P0SourceArtifactKind;
  readonly mimeType: string;
  readonly sha256: string;
  readonly byteLength: number;
  readonly writeDisposition: "CREATED" | "IDEMPOTENT_REPLAY";
  readonly immutable: true;
  readonly storedAt: string;
}

export interface P0SourceArtifactWriteRequest {
  readonly contractVersion: typeof P0_SOURCE_ARTIFACT_CONTRACT_VERSION;
  readonly selectedProviderKey: typeof P0_LOCAL_SOURCE_PROVIDER_KEY;
  readonly capability: VerifiedP0SourceArtifactCapability & {
    readonly purpose: "STORE_SOURCE";
  };
  readonly principal: P0Principal;
  readonly gatePermit: P0Phase2AGatePermit;
  readonly operationId: string;
  /** Durable ReportIngestion.operationKey; stable across worker retries. */
  readonly sourceOperationId: string;
  readonly writeFence: P0SourceArtifactWriteFence;
  /** Exact durable ReportIngestion revision that authorizes pre-artifact storage. */
  readonly ingestionRevision: number;
  /** Required for the protected post-write byte readback. */
  readonly sensitiveAccessGrant: VerifiedP0SensitiveAccessGrant;
  readonly sensitiveResource: VerifiedP0SensitiveResourceRef;
  readonly sensitiveAccessKind: "WORKER";
  readonly sensitiveAccessPurposeCode: "REPORT_INGESTION";
  readonly scope: P0SourceArtifactScope;
  readonly kind: P0SourceArtifactKind;
  readonly mimeType: string;
  readonly content: Uint8Array;
  readonly sha256: string;
  readonly byteLength: number;
  readonly idempotencyKey: string;
}

export interface P0SourceArtifactReadRequest {
  readonly contractVersion: typeof P0_SOURCE_ARTIFACT_CONTRACT_VERSION;
  readonly capability: VerifiedP0SourceArtifactCapability & {
    readonly purpose: "READ_SOURCE";
  };
  readonly principal: P0Principal;
  readonly sensitiveAccessGrant: VerifiedP0SensitiveAccessGrant;
  readonly sensitiveResource: VerifiedP0SensitiveResourceRef;
  readonly sensitiveAccessKind: P0SensitiveAccessKind;
  readonly sensitiveAccessPurposeCode: P0SensitiveAccessPurposeCode;
  readonly object: P0StoredSourceArtifact;
}

export interface P0SourceArtifactWriteReadbackRequest {
  readonly contractVersion: typeof P0_SOURCE_ARTIFACT_CONTRACT_VERSION;
  readonly capability: VerifiedP0SourceArtifactCapability & {
    readonly purpose: "STORE_SOURCE";
  };
  readonly principal: P0Principal;
  readonly operationId: string;
  readonly sourceOperationId: string;
  readonly ingestionRevision: number;
  readonly writeFencePermit: VerifiedP0SourceWriteFencePermit;
  readonly sensitiveAccessGrant: VerifiedP0SensitiveAccessGrant;
  readonly sensitiveResource: VerifiedP0SensitiveResourceRef;
  readonly sensitiveAccessKind: "WORKER";
  readonly sensitiveAccessPurposeCode: "REPORT_INGESTION";
  readonly readKind: "WRITE_READBACK";
  readonly object: P0StoredSourceArtifact;
}

export interface P0SourceArtifactOrphanReconciliationRequest {
  readonly contractVersion: typeof P0_SOURCE_ARTIFACT_CONTRACT_VERSION;
  readonly selectedProviderKey: typeof P0_LOCAL_SOURCE_PROVIDER_KEY;
  readonly capability: VerifiedP0SourceArtifactCapability & { readonly purpose: "STORE_SOURCE" };
  readonly principal: P0Principal;
  readonly gatePermit: P0Phase2AGatePermit;
  readonly operationId: string;
  readonly sourceOperationId: string;
  readonly writeFence: P0SourceArtifactWriteFence;
  readonly ingestionRevision: number;
  readonly sensitiveAccessGrant: VerifiedP0SensitiveAccessGrant;
  readonly sensitiveResource: VerifiedP0SensitiveResourceRef;
  readonly sensitiveAccessKind: "WORKER";
  readonly sensitiveAccessPurposeCode: "REPORT_INGESTION";
  readonly scope: P0SourceArtifactScope;
  readonly kind: P0SourceArtifactKind;
  readonly mimeType: string;
  readonly sha256: string;
  readonly byteLength: number;
}

export interface P0SourceArtifactReadback {
  readonly object: P0StoredSourceArtifact;
  readonly content: Uint8Array;
  readonly readAt: string;
}

const VERIFIED_SOURCE_WRITE_RECEIPT = Symbol("verified-source-write-receipt");
const verifiedWriteReceipts = new WeakMap<object, string>();

/** Proof that exact bytes were written and independently read back. */
export interface VerifiedP0SourceArtifactWriteReceipt {
  readonly object: P0StoredSourceArtifact;
  readonly objectBindingSha256: string;
  readonly readbackSha256: string;
  readonly readbackByteLength: number;
  readonly verifiedAt: string;
  readonly [VERIFIED_SOURCE_WRITE_RECEIPT]: true;
}

export interface P0SourceArtifactErasureCandidate {
  readonly decisionId: string;
  readonly decisionVersion: string;
  readonly disposition: "DELETE_OR_CRYPTO_SHRED";
  readonly scope: P0SourceArtifactScope;
  readonly objectBindingSha256: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
}

const VERIFIED_SOURCE_ERASURE = Symbol("verified-source-erasure");
const verifiedErasureDecisions = new WeakMap<object, string>();

export interface VerifiedP0SourceArtifactErasure
  extends P0SourceArtifactErasureCandidate {
  readonly [VERIFIED_SOURCE_ERASURE]: true;
}

export interface P0SourceArtifactErasureVerifier {
  verifyDecision(input: {
    readonly candidate: Readonly<P0SourceArtifactErasureCandidate>;
    readonly object: Readonly<P0StoredSourceArtifact>;
    readonly now: Date;
  }): Promise<boolean>;
}

export interface P0SourceArtifactTombstoneRequest {
  readonly contractVersion: typeof P0_SOURCE_ARTIFACT_CONTRACT_VERSION;
  readonly capability: VerifiedP0SourceArtifactCapability & {
    readonly purpose: "ERASE_SOURCE";
  };
  readonly object: P0StoredSourceArtifact;
  readonly eligibility: VerifiedP0SourceArtifactErasure;
  readonly tombstoneEventKey: string;
}

export interface P0SourceArtifactTombstoneResult {
  readonly status: "OBJECT_DELETED" | "CRYPTO_SHREDDED" | "FAILED";
  readonly providerKey: typeof P0_LOCAL_SOURCE_PROVIDER_KEY;
  readonly providerObjectVersion: string;
  readonly objectBindingSha256: string;
  readonly tombstoneRef?: string;
  readonly completedAt: string;
}

export interface P0SourceArtifactProvider {
  readonly providerKey: typeof P0_LOCAL_SOURCE_PROVIDER_KEY;
  putImmutable(request: P0SourceArtifactWriteRequest & { readonly writeFencePermit: VerifiedP0SourceWriteFencePermit }): Promise<P0StoredSourceArtifact>;
  readBackAfterWrite(
    request: P0SourceArtifactWriteReadbackRequest,
  ): Promise<P0SourceArtifactReadback>;
  discoverAfterUnknownWrite(
    request: P0SourceArtifactOrphanReconciliationRequest & { readonly writeFencePermit: VerifiedP0SourceWriteFencePermit },
  ): Promise<P0SourceArtifactReadback>;
  readExact(request: P0SourceArtifactReadRequest): Promise<P0SourceArtifactReadback>;
  tombstoneExact(
    request: P0SourceArtifactTombstoneRequest,
  ): Promise<P0SourceArtifactTombstoneResult>;
}

export type P0SourceArtifactDispatchResult<T> =
  | { readonly ok: true; readonly kind: "VERIFIED"; readonly value: T }
  | {
      readonly ok: false;
      readonly kind: "DENIED" | "INTEGRITY_FAILURE" | "OUTCOME_UNKNOWN";
      readonly code: string;
    };

const SHA256 = /^[a-f0-9]{64}$/;
const STABLE = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,199}$/;
const SAFE_REASON = /^[A-Z][A-Z0-9_]{0,127}$/;
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

function exactKeys(value: unknown, expected: readonly string[]): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const permitted = [...expected].sort();
  return actual.length === permitted.length && actual.every((key, index) => key === permitted[index]);
}

function validBase64(value: unknown, minimumLength: number, maximumLength: number): value is string {
  return typeof value === "string" && value.length >= minimumLength && value.length <= maximumLength && value.length % 4 === 0 && BASE64.test(value);
}

function digest(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function computeP0SourceArtifactSha256(content: Uint8Array): string {
  return digest(content);
}

export function deriveP0SourceArtifactOperationIdentity(input: {
  readonly tenantId: string;
  readonly consumerId: string;
  readonly ingestionId: string;
  readonly operationId: string;
  readonly kind: P0SourceArtifactKind;
}): { readonly artifactId: string; readonly providerOperationId: string } {
  if (!STABLE.test(input.tenantId) || !STABLE.test(input.consumerId) || !STABLE.test(input.ingestionId) || !STABLE.test(input.operationId) || !["ORIGINAL_PDF", "ORIGINAL_TEXT", "NORMALIZED_TEXT"].includes(input.kind)) {
    throw new Error("invalid source operation identity");
  }
  const binding = digest(JSON.stringify([input.tenantId, input.consumerId, input.ingestionId, input.operationId, input.kind]));
  return Object.freeze({ artifactId: `p0src_${binding.slice(0, 40)}`, providerOperationId: `p0srcop_${binding}` });
}

function scopeTuple(scope: P0SourceArtifactScope): readonly unknown[] {
  return [
    scope.tenantId,
    scope.consumerId,
    scope.ingestionId,
    scope.artifactId,
    scope.artifactVersion,
  ];
}

function scopeBinding(scope: P0SourceArtifactScope): string {
  return digest(JSON.stringify(scopeTuple(scope)));
}

function writeFencePermitBinding(permit: Omit<VerifiedP0SourceWriteFencePermit, typeof VERIFIED_SOURCE_WRITE_FENCE_PERMIT>): string {
  return digest(JSON.stringify([permit.tenantId, permit.consumerId, permit.ingestionId, permit.ingestionRevision, permit.operationId, permit.sourceOperationId]));
}

function validWriteFencePermit(
  permit: VerifiedP0SourceWriteFencePermit | null | undefined,
  request: Pick<P0SourceArtifactWriteRequest, "scope" | "ingestionRevision" | "operationId" | "sourceOperationId">,
): boolean {
  return Boolean(
    permit &&
      permit[VERIFIED_SOURCE_WRITE_FENCE_PERMIT] === true &&
      verifiedWriteFencePermits.get(permit) === writeFencePermitBinding(permit) &&
      permit.tenantId === request.scope.tenantId &&
      permit.consumerId === request.scope.consumerId &&
      permit.ingestionId === request.scope.ingestionId &&
      permit.ingestionRevision === request.ingestionRevision &&
      permit.operationId === request.operationId &&
      permit.sourceOperationId === request.sourceOperationId,
  );
}

function sameScope(a: P0SourceArtifactScope, b: P0SourceArtifactScope): boolean {
  return scopeBinding(a) === scopeBinding(b);
}

function validScope(scope: P0SourceArtifactScope): boolean {
  return Boolean(
    scope &&
      STABLE.test(scope.tenantId) &&
      STABLE.test(scope.consumerId) &&
      STABLE.test(scope.ingestionId) &&
      STABLE.test(scope.artifactId) &&
      Number.isSafeInteger(scope.artifactVersion) &&
      scope.artifactVersion >= 1,
  );
}

function instant(value: unknown): number | null {
  if (!isStrictIsoInstant(value)) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function capabilityBinding(candidate: P0SourceArtifactCapabilityCandidate): string {
  return digest(
    JSON.stringify([
      ...scopeTuple(candidate.scope),
      candidate.purpose,
      candidate.actorId,
      candidate.authorizationDecisionId,
      candidate.authorizationVersion,
      candidate.issuedAt,
      candidate.expiresAt,
    ]),
  );
}

function validCapabilityShape(
  candidate: P0SourceArtifactCapabilityCandidate,
  now: Date,
): boolean {
  const issuedAt = instant(candidate?.issuedAt);
  const expiresAt = instant(candidate?.expiresAt);
  return Boolean(
    candidate &&
      validScope(candidate.scope) &&
      ["STORE_SOURCE", "READ_SOURCE", "ERASE_SOURCE"].includes(candidate.purpose) &&
      STABLE.test(candidate.actorId) &&
      STABLE.test(candidate.authorizationDecisionId) &&
      STABLE.test(candidate.authorizationVersion) &&
      issuedAt !== null &&
      expiresAt !== null &&
      issuedAt <= now.getTime() &&
      now.getTime() - issuedAt <= 30_000 &&
      expiresAt > now.getTime() &&
      expiresAt - issuedAt <= 5 * 60 * 1000,
  );
}

export async function verifyP0SourceArtifactCapability(
  candidate: P0SourceArtifactCapabilityCandidate,
  verifier: P0SourceArtifactCapabilityVerifier,
  storeGate?: P0SourceArtifactStoreGate,
): Promise<VerifiedP0SourceArtifactCapability | null> {
  const now = new Date();
  if (
    !validCapabilityShape(candidate, now) ||
    typeof verifier?.verifyDecision !== "function" ||
    (candidate.purpose === "STORE_SOURCE" &&
      !storeGateAllows(candidate, storeGate, now))
  ) {
    return null;
  }
  const snapshot = Object.freeze({
    ...candidate,
    scope: Object.freeze({ ...candidate.scope }),
  });
  let allowed = false;
  try {
    allowed = await verifier.verifyDecision({ candidate: snapshot, now });
  } catch {
    return null;
  }
  if (allowed !== true) return null;
  const verified = { ...snapshot } as VerifiedP0SourceArtifactCapability;
  Object.defineProperty(verified, VERIFIED_SOURCE_CAPABILITY, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  Object.freeze(verified);
  verifiedCapabilities.set(verified, capabilityBinding(verified));
  return verified;
}

function validCapability(
  capability: VerifiedP0SourceArtifactCapability,
  scope: P0SourceArtifactScope,
  purpose: P0SourceArtifactPurpose,
  now: Date,
): boolean {
  return Boolean(
    capability &&
      capability[VERIFIED_SOURCE_CAPABILITY] === true &&
      verifiedCapabilities.get(capability) === capabilityBinding(capability) &&
      validCapabilityShape(capability, now) &&
      capability.purpose === purpose &&
      sameScope(capability.scope, scope),
  );
}

function storeGateAllows(
  candidate: P0SourceArtifactCapabilityCandidate,
  gate: P0SourceArtifactStoreGate | undefined,
  now: Date,
): boolean {
  if (!gate || candidate.purpose !== "STORE_SOURCE") return false;
  const scope = {
    tenantId: candidate.scope.tenantId,
    consumerId: candidate.scope.consumerId,
  };
  return Boolean(
    candidate.actorId === gate.principal.actorId &&
      candidate.authorizationDecisionId === gate.operationId &&
      p0PrincipalAuthorizesScope(gate.principal, scope) &&
      p0Phase2AGatePermitAuthorizes({
        permit: gate.permit,
        principal: gate.principal,
        scope,
        stage: "INGESTION_SHADOW",
        mode: "LOCAL_BUILD",
        operationId: gate.operationId,
      }),
  );
}

function immutableObject(object: P0StoredSourceArtifact): P0StoredSourceArtifact {
  return Object.freeze({
    ...object,
    scope: Object.freeze({ ...object.scope }),
    locator: Object.freeze({ ...object.locator }),
  });
}

export function computeP0StoredSourceObjectBindingSha256(
  object: P0StoredSourceArtifact,
): string {
  return digest(
    JSON.stringify([
      object.contractVersion,
      ...scopeTuple(object.scope),
      object.providerKey,
      object.providerOperationId,
      object.providerObjectVersion,
      object.locator.ciphertextBase64,
      object.locator.ivBase64,
      object.locator.authTagBase64,
      object.locator.algorithm,
      object.locator.keyVersion,
      object.locator.envelopeVersion,
      object.locator.aadVersion,
      object.locator.aadSha256,
      object.kind,
      object.mimeType,
      object.sha256,
      object.byteLength,
      object.writeDisposition,
      object.immutable,
      object.storedAt,
    ]),
  );
}

function validObject(object: P0StoredSourceArtifact): boolean {
  return Boolean(
    object &&
      exactKeys(object, ["contractVersion", "scope", "providerKey", "providerOperationId", "providerObjectVersion", "locator", "kind", "mimeType", "sha256", "byteLength", "writeDisposition", "immutable", "storedAt"]) &&
      object.contractVersion === P0_SOURCE_ARTIFACT_CONTRACT_VERSION &&
      exactKeys(object.scope, ["tenantId", "consumerId", "ingestionId", "artifactId", "artifactVersion"]) &&
      validScope(object.scope) &&
      object.providerKey === P0_LOCAL_SOURCE_PROVIDER_KEY &&
      STABLE.test(object.providerOperationId) &&
      STABLE.test(object.providerObjectVersion) &&
      exactKeys(object.locator, ["ciphertextBase64", "ivBase64", "authTagBase64", "algorithm", "keyVersion", "envelopeVersion", "aadVersion", "aadSha256"]) &&
      object.locator?.algorithm === "AES_256_GCM" &&
      validBase64(object.locator.ciphertextBase64, 4, 4096) &&
      validBase64(object.locator.ivBase64, 16, 16) &&
      Buffer.from(object.locator.ivBase64, "base64").byteLength === 12 &&
      validBase64(object.locator.authTagBase64, 24, 24) &&
      Buffer.from(object.locator.authTagBase64, "base64").byteLength === 16 &&
      STABLE.test(object.locator.keyVersion) &&
      STABLE.test(object.locator.aadVersion) &&
      SHA256.test(object.locator.aadSha256) &&
      object.locator.envelopeVersion === "p0-local-source-locator-v1" &&
      ((object.kind === "ORIGINAL_PDF" && object.mimeType === "application/pdf") || ((object.kind === "ORIGINAL_TEXT" || object.kind === "NORMALIZED_TEXT") && object.mimeType === "text/plain")) &&
      SHA256.test(object.sha256) &&
      Number.isSafeInteger(object.byteLength) &&
      object.byteLength >= 0 &&
      object.byteLength <= P0_MAX_SOURCE_ARTIFACT_BYTES &&
      ["CREATED", "IDEMPOTENT_REPLAY"].includes(object.writeDisposition) &&
      object.immutable === true &&
      instant(object.storedAt) !== null,
  );
}

function storedSensitiveResource(
  scope: P0SourceArtifactScope,
  kind: P0SourceArtifactKind,
) {
  return Object.freeze({
    resourceType: kind === "NORMALIZED_TEXT" ? ("NORMALIZED_REPORT_TEXT" as const) : ("REPORT_SOURCE" as const),
    resourceId: scope.artifactId,
    resourceVersion: scope.artifactVersion,
  });
}

function validSensitiveByteRelease(input: {
  readonly principal: P0Principal;
  readonly grant: VerifiedP0SensitiveAccessGrant;
  readonly resource: VerifiedP0SensitiveResourceRef;
  readonly accessKind: P0SensitiveAccessKind;
  readonly purposeCode: P0SensitiveAccessPurposeCode;
  readonly scope: P0SourceArtifactScope;
  readonly kind: P0SourceArtifactKind;
  readonly boundary: "INGESTION_STORE" | "STORED_ARTIFACT";
  readonly ingestionRevision?: number;
}): boolean {
  const expected = input.boundary === "INGESTION_STORE"
    ? Object.freeze({ resourceType: "REPORT_INGESTION" as const, resourceId: input.scope.ingestionId, resourceVersion: input.ingestionRevision })
    : storedSensitiveResource(input.scope, input.kind);
  return (
    (input.boundary !== "INGESTION_STORE" || (Number.isSafeInteger(input.ingestionRevision) && input.ingestionRevision! >= 1)) &&
    (input.boundary !== "INGESTION_STORE" || (input.principal.authorizationKind === "SYSTEM_WORKER" && input.accessKind === "WORKER" && input.purposeCode === "REPORT_INGESTION")) &&
    input.resource.resourceType === expected.resourceType &&
    input.resource.resourceId === expected.resourceId &&
    input.resource.resourceVersion === expected.resourceVersion &&
    p0SensitiveAccessGrantAllows({
    grant: input.grant,
    principal: input.principal,
    scope: { tenantId: input.scope.tenantId, consumerId: input.scope.consumerId },
    accessKind: input.accessKind,
    purposeCode: input.purposeCode,
    resource: input.resource,
  })
  );
}

function validWrite(request: P0SourceArtifactWriteRequest, now: Date): boolean {
  if (!request || typeof request !== "object" || !validScope(request.scope)) return false;
  const mimeMatches =
    (request.kind === "ORIGINAL_PDF" && request.mimeType === "application/pdf") ||
    ((request.kind === "ORIGINAL_TEXT" || request.kind === "NORMALIZED_TEXT") &&
      request.mimeType === "text/plain");
  let identity: { readonly artifactId: string; readonly providerOperationId: string };
  try {
    identity = deriveP0SourceArtifactOperationIdentity({
      tenantId: request.scope.tenantId,
      consumerId: request.scope.consumerId,
      ingestionId: request.scope.ingestionId,
      operationId: request.sourceOperationId,
      kind: request.kind,
    });
  } catch {
    return false;
  }
  return Boolean(
      request.contractVersion === P0_SOURCE_ARTIFACT_CONTRACT_VERSION &&
      request.selectedProviderKey === P0_LOCAL_SOURCE_PROVIDER_KEY &&
      typeof request.writeFence?.runWhileRetained === "function" &&
      validScope(request.scope) &&
      request.scope.artifactId === identity.artifactId &&
      request.idempotencyKey === identity.providerOperationId &&
      validCapability(request.capability, request.scope, "STORE_SOURCE", now) &&
      storeGateAllows(
        request.capability,
        {
          principal: request.principal,
          permit: request.gatePermit,
          operationId: request.operationId,
        },
        now,
      ) &&
      validSensitiveByteRelease({
        principal: request.principal,
        grant: request.sensitiveAccessGrant,
        resource: request.sensitiveResource,
        accessKind: request.sensitiveAccessKind,
        purposeCode: request.sensitiveAccessPurposeCode,
        scope: request.scope,
        kind: request.kind,
        boundary: "INGESTION_STORE",
        ingestionRevision: request.ingestionRevision,
      }) &&
      request.content instanceof Uint8Array &&
      request.byteLength === request.content.byteLength &&
      request.byteLength <= P0_MAX_SOURCE_ARTIFACT_BYTES &&
      SHA256.test(request.sha256) &&
      request.sha256 === computeP0SourceArtifactSha256(request.content) &&
      STABLE.test(request.idempotencyKey) &&
      mimeMatches,
  );
}

function validOrphanReconciliationRequest(request: P0SourceArtifactOrphanReconciliationRequest, now: Date): boolean {
  if (!request || typeof request !== "object" || !validScope(request.scope)) return false;
  let identity: { readonly artifactId: string; readonly providerOperationId: string };
  try {
    identity = deriveP0SourceArtifactOperationIdentity({ tenantId: request.scope.tenantId, consumerId: request.scope.consumerId, ingestionId: request.scope.ingestionId, operationId: request.sourceOperationId, kind: request.kind });
  } catch {
    return false;
  }
  const mimeMatches = (request.kind === "ORIGINAL_PDF" && request.mimeType === "application/pdf") || ((request.kind === "ORIGINAL_TEXT" || request.kind === "NORMALIZED_TEXT") && request.mimeType === "text/plain");
  return Boolean(
    request.contractVersion === P0_SOURCE_ARTIFACT_CONTRACT_VERSION &&
      request.selectedProviderKey === P0_LOCAL_SOURCE_PROVIDER_KEY &&
      typeof request.writeFence?.runWhileRetained === "function" &&
      request.scope.artifactId === identity.artifactId &&
      validCapability(request.capability, request.scope, "STORE_SOURCE", now) &&
      storeGateAllows(request.capability, { principal: request.principal, permit: request.gatePermit, operationId: request.operationId }, now) &&
      validSensitiveByteRelease({ principal: request.principal, grant: request.sensitiveAccessGrant, resource: request.sensitiveResource, accessKind: request.sensitiveAccessKind, purposeCode: request.sensitiveAccessPurposeCode, scope: request.scope, kind: request.kind, boundary: "INGESTION_STORE", ingestionRevision: request.ingestionRevision }) &&
      SHA256.test(request.sha256) &&
      Number.isSafeInteger(request.byteLength) && request.byteLength >= 0 && request.byteLength <= P0_MAX_SOURCE_ARTIFACT_BYTES &&
      mimeMatches
  );
}

function exactReadback(
  request: P0SourceArtifactWriteRequest,
  result: P0SourceArtifactReadback,
): boolean {
  return Boolean(
    result &&
      validObject(result.object) &&
      sameScope(result.object.scope, request.scope) &&
      result.object.kind === request.kind &&
      result.object.mimeType === request.mimeType &&
      result.object.sha256 === request.sha256 &&
      result.object.byteLength === request.byteLength &&
      result.content instanceof Uint8Array &&
      result.content.byteLength === request.byteLength &&
      computeP0SourceArtifactSha256(result.content) === request.sha256 &&
      Buffer.from(result.content).equals(Buffer.from(request.content)) &&
      instant(result.readAt) !== null,
  );
}

export async function dispatchP0SourceArtifactWrite(
  provider: P0SourceArtifactProvider,
  request: P0SourceArtifactWriteRequest,
): Promise<P0SourceArtifactDispatchResult<VerifiedP0SourceArtifactWriteReceipt>> {
  if (
    provider?.providerKey !== request?.selectedProviderKey ||
    typeof provider?.putImmutable !== "function" ||
    typeof provider?.readBackAfterWrite !== "function" ||
    !validWrite(request, new Date())
  ) {
    return { ok: false, kind: "DENIED", code: "INVALID_SOURCE_WRITE" };
  }
  const snapshot = Object.freeze({
    ...request,
    scope: Object.freeze({ ...request.scope }),
    content: new Uint8Array(request.content),
  });
  try {
    const fenced = await snapshot.writeFence.runWhileRetained({
      principal: snapshot.principal,
      scope: snapshot.scope,
      ingestionRevision: snapshot.ingestionRevision,
      operationId: snapshot.operationId,
      sourceOperationId: snapshot.sourceOperationId,
      execute: async (writeFencePermit) => {
        const providerRequest = Object.freeze({ ...snapshot, writeFencePermit });
        const stored = await provider.putImmutable(providerRequest);
        if (!validObject(stored) || !sameScope(stored.scope, request.scope)) {
          return { ok: false as const, code: "INVALID_STORED_SOURCE" as const };
        }
        // Storage readback is part of the same fenced STORE_SOURCE operation.
        const readback = await provider.readBackAfterWrite({
          contractVersion: P0_SOURCE_ARTIFACT_CONTRACT_VERSION,
          capability: snapshot.capability,
          principal: snapshot.principal,
          operationId: snapshot.operationId,
          sourceOperationId: snapshot.sourceOperationId,
          ingestionRevision: snapshot.ingestionRevision,
          writeFencePermit,
          sensitiveAccessGrant: snapshot.sensitiveAccessGrant,
          sensitiveResource: snapshot.sensitiveResource,
          sensitiveAccessKind: snapshot.sensitiveAccessKind,
          sensitiveAccessPurposeCode: snapshot.sensitiveAccessPurposeCode,
          readKind: "WRITE_READBACK",
          object: stored,
        });
        if (!exactReadback(snapshot, readback)) {
          return { ok: false as const, code: "SOURCE_READBACK_MISMATCH" as const };
        }
        return { ok: true as const, readback };
      },
    });
    if (fenced.kind !== "EXECUTED") return { ok: false, kind: fenced.kind, code: fenced.kind === "DENIED" ? "SOURCE_WRITE_FENCE_DENIED" : "SOURCE_WRITE_FENCE_OUTCOME_UNKNOWN" };
    if (!fenced.value.ok) return { ok: false, kind: "INTEGRITY_FAILURE", code: fenced.value.code };
    const readback = fenced.value.readback;
    const object = immutableObject(readback.object);
    const receipt = {
      object,
      objectBindingSha256: computeP0StoredSourceObjectBindingSha256(object),
      readbackSha256: computeP0SourceArtifactSha256(readback.content),
      readbackByteLength: readback.content.byteLength,
      verifiedAt: readback.readAt,
    } as VerifiedP0SourceArtifactWriteReceipt;
    Object.defineProperty(receipt, VERIFIED_SOURCE_WRITE_RECEIPT, {
      value: true,
      enumerable: false,
      configurable: false,
      writable: false,
    });
    Object.freeze(receipt);
    verifiedWriteReceipts.set(receipt, sourceWriteReceiptBinding(receipt));
    return { ok: true, kind: "VERIFIED", value: receipt };
  } catch {
    return { ok: false, kind: "OUTCOME_UNKNOWN", code: "SOURCE_WRITE_OUTCOME_UNKNOWN" };
  }
}

function sourceWriteReceiptBinding(receipt: VerifiedP0SourceArtifactWriteReceipt): string {
  return digest(JSON.stringify([
    receipt.objectBindingSha256,
    receipt.readbackSha256,
    receipt.readbackByteLength,
    receipt.verifiedAt,
  ]));
}

export function isVerifiedP0SourceArtifactWriteReceipt(
  receipt: VerifiedP0SourceArtifactWriteReceipt | null | undefined,
): receipt is VerifiedP0SourceArtifactWriteReceipt {
  return Boolean(
    receipt &&
      receipt[VERIFIED_SOURCE_WRITE_RECEIPT] === true &&
      Object.isFrozen(receipt) &&
      verifiedWriteReceipts.get(receipt) === sourceWriteReceiptBinding(receipt) &&
      receipt.objectBindingSha256 === computeP0StoredSourceObjectBindingSha256(receipt.object) &&
      receipt.readbackSha256 === receipt.object.sha256 &&
      receipt.readbackByteLength === receipt.object.byteLength,
  );
}

/**
 * Recovers a crash-after-put outcome only by the durable source operation
 * identity and exact scoped byte readback. Any mismatch is quarantinable and
 * never becomes an adopted Artifact receipt.
 */
export async function reconcileP0SourceArtifactUnknownWrite(
  provider: P0SourceArtifactProvider,
  request: P0SourceArtifactOrphanReconciliationRequest,
): Promise<P0SourceArtifactDispatchResult<VerifiedP0SourceArtifactWriteReceipt>> {
  if (provider?.providerKey !== request?.selectedProviderKey || typeof provider?.discoverAfterUnknownWrite !== "function" || !validOrphanReconciliationRequest(request, new Date())) return { ok: false, kind: "DENIED", code: "INVALID_ORPHAN_RECONCILIATION" };
  try {
    const fenced = await request.writeFence.runWhileRetained({
      principal: request.principal,
      scope: request.scope,
      ingestionRevision: request.ingestionRevision,
      operationId: request.operationId,
      sourceOperationId: request.sourceOperationId,
      execute: (writeFencePermit) => provider.discoverAfterUnknownWrite(Object.freeze({ ...request, scope: Object.freeze({ ...request.scope }), writeFencePermit })),
    });
    if (fenced.kind !== "EXECUTED") return { ok: false, kind: fenced.kind, code: fenced.kind === "DENIED" ? "ORPHAN_WRITE_FENCE_DENIED" : "ORPHAN_WRITE_FENCE_OUTCOME_UNKNOWN" };
    const readback = fenced.value;
    const identity = deriveP0SourceArtifactOperationIdentity({ tenantId: request.scope.tenantId, consumerId: request.scope.consumerId, ingestionId: request.scope.ingestionId, operationId: request.sourceOperationId, kind: request.kind });
    if (!validObject(readback.object) || !sameScope(readback.object.scope, request.scope) || readback.object.providerOperationId !== identity.providerOperationId || readback.object.kind !== request.kind || readback.object.mimeType !== request.mimeType || readback.object.sha256 !== request.sha256 || readback.object.byteLength !== request.byteLength || !(readback.content instanceof Uint8Array) || readback.content.byteLength !== request.byteLength || computeP0SourceArtifactSha256(readback.content) !== request.sha256 || instant(readback.readAt) === null) return { ok: false, kind: "INTEGRITY_FAILURE", code: "ORPHAN_TOMBSTONE_REQUIRED" };
    const object = immutableObject(readback.object);
    const receipt = { object, objectBindingSha256: computeP0StoredSourceObjectBindingSha256(object), readbackSha256: computeP0SourceArtifactSha256(readback.content), readbackByteLength: readback.content.byteLength, verifiedAt: readback.readAt } as VerifiedP0SourceArtifactWriteReceipt;
    Object.defineProperty(receipt, VERIFIED_SOURCE_WRITE_RECEIPT, { value: true, enumerable: false, configurable: false, writable: false });
    Object.freeze(receipt);
    verifiedWriteReceipts.set(receipt, sourceWriteReceiptBinding(receipt));
    return { ok: true, kind: "VERIFIED", value: receipt };
  } catch {
    return { ok: false, kind: "OUTCOME_UNKNOWN", code: "ORPHAN_RECONCILIATION_OUTCOME_UNKNOWN" };
  }
}

export async function dispatchP0SourceArtifactRead(
  provider: P0SourceArtifactProvider,
  request: P0SourceArtifactReadRequest,
): Promise<P0SourceArtifactDispatchResult<P0SourceArtifactReadback>> {
  const now = new Date();
  if (
    provider?.providerKey !== request?.object?.providerKey ||
    !validObject(request?.object) ||
    !validCapability(request.capability, request.object.scope, "READ_SOURCE", now) ||
    !validSensitiveByteRelease({
      principal: request.principal,
      grant: request.sensitiveAccessGrant,
      resource: request.sensitiveResource,
      accessKind: request.sensitiveAccessKind,
      purposeCode: request.sensitiveAccessPurposeCode,
      scope: request.object.scope,
      kind: request.object.kind,
      boundary: "STORED_ARTIFACT",
    })
  ) {
    return { ok: false, kind: "DENIED", code: "INVALID_SOURCE_READ" };
  }
  try {
    const result = await provider.readExact(request);
    if (
      !validObject(result.object) ||
      computeP0StoredSourceObjectBindingSha256(result.object) !==
        computeP0StoredSourceObjectBindingSha256(request.object) ||
      !(result.content instanceof Uint8Array) ||
      result.content.byteLength !== request.object.byteLength ||
      computeP0SourceArtifactSha256(result.content) !== request.object.sha256
    ) {
      return { ok: false, kind: "INTEGRITY_FAILURE", code: "SOURCE_READBACK_MISMATCH" };
    }
    return {
      ok: true,
      kind: "VERIFIED",
      value: Object.freeze({
        object: immutableObject(result.object),
        content: new Uint8Array(result.content),
        readAt: result.readAt,
      }),
    };
  } catch {
    return { ok: false, kind: "OUTCOME_UNKNOWN", code: "SOURCE_READ_OUTCOME_UNKNOWN" };
  }
}

function erasureBinding(candidate: P0SourceArtifactErasureCandidate): string {
  return digest(
    JSON.stringify([
      candidate.decisionId,
      candidate.decisionVersion,
      candidate.disposition,
      ...scopeTuple(candidate.scope),
      candidate.objectBindingSha256,
      candidate.issuedAt,
      candidate.expiresAt,
    ]),
  );
}

export async function verifyP0SourceArtifactErasure(
  candidate: P0SourceArtifactErasureCandidate,
  object: P0StoredSourceArtifact,
  verifier: P0SourceArtifactErasureVerifier,
): Promise<VerifiedP0SourceArtifactErasure | null> {
  const now = new Date();
  const issuedAt = instant(candidate?.issuedAt);
  const expiresAt = instant(candidate?.expiresAt);
  if (
    !candidate ||
    !validObject(object) ||
    candidate.disposition !== "DELETE_OR_CRYPTO_SHRED" ||
    !STABLE.test(candidate.decisionId) ||
    !STABLE.test(candidate.decisionVersion) ||
    !sameScope(candidate.scope, object.scope) ||
    candidate.objectBindingSha256 !== computeP0StoredSourceObjectBindingSha256(object) ||
    issuedAt === null ||
    expiresAt === null ||
    issuedAt > now.getTime() ||
    now.getTime() - issuedAt > 5_000 ||
    expiresAt <= now.getTime() ||
    expiresAt - issuedAt > 30_000
  ) {
    return null;
  }
  const snapshot = Object.freeze({
    ...candidate,
    scope: Object.freeze({ ...candidate.scope }),
  });
  let allowed = false;
  try {
    allowed = await verifier.verifyDecision({ candidate: snapshot, object, now });
  } catch {
    return null;
  }
  if (allowed !== true) return null;
  const verified = { ...snapshot } as VerifiedP0SourceArtifactErasure;
  Object.defineProperty(verified, VERIFIED_SOURCE_ERASURE, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  Object.freeze(verified);
  verifiedErasureDecisions.set(verified, erasureBinding(verified));
  return verified;
}

function validVerifiedErasure(
  eligibility: VerifiedP0SourceArtifactErasure | null | undefined,
  object: P0StoredSourceArtifact,
  now: Date,
): boolean {
  const issuedAt = eligibility ? instant(eligibility.issuedAt) : null;
  const expiresAt = eligibility ? instant(eligibility.expiresAt) : null;
  return Boolean(
    eligibility &&
      eligibility[VERIFIED_SOURCE_ERASURE] === true &&
      verifiedErasureDecisions.get(eligibility) === erasureBinding(eligibility) &&
      sameScope(eligibility.scope, object.scope) &&
      eligibility.objectBindingSha256 === computeP0StoredSourceObjectBindingSha256(object) &&
      issuedAt !== null &&
      expiresAt !== null &&
      issuedAt <= now.getTime() &&
      now.getTime() - issuedAt <= 5_000 &&
      expiresAt > now.getTime() &&
      expiresAt - issuedAt <= 30_000,
  );
}

export async function dispatchP0SourceArtifactTombstone(
  provider: P0SourceArtifactProvider,
  request: P0SourceArtifactTombstoneRequest,
): Promise<P0SourceArtifactDispatchResult<P0SourceArtifactTombstoneResult>> {
  const now = new Date();
  if (
    provider?.providerKey !== request?.object?.providerKey ||
    !validObject(request?.object) ||
    !validCapability(request.capability, request.object.scope, "ERASE_SOURCE", now) ||
    !validVerifiedErasure(request.eligibility, request.object, now) ||
    !STABLE.test(request.tombstoneEventKey)
  ) {
    return { ok: false, kind: "DENIED", code: "INVALID_SOURCE_ERASURE" };
  }
  try {
    const result = await provider.tombstoneExact(request);
    const successful = result?.status === "OBJECT_DELETED" || result?.status === "CRYPTO_SHREDDED";
    if (
      !result ||
      !["OBJECT_DELETED", "CRYPTO_SHREDDED", "FAILED"].includes(result.status) ||
      result.providerKey !== request.object.providerKey ||
      result.providerObjectVersion !== request.object.providerObjectVersion ||
      result.objectBindingSha256 !== computeP0StoredSourceObjectBindingSha256(request.object) ||
      instant(result.completedAt) === null ||
      (successful ? !STABLE.test(result.tombstoneRef ?? "") : result.tombstoneRef !== undefined)
    ) {
      return { ok: false, kind: "INTEGRITY_FAILURE", code: "INVALID_TOMBSTONE_RESULT" };
    }
    return { ok: true, kind: "VERIFIED", value: Object.freeze({ ...result }) };
  } catch {
    return { ok: false, kind: "OUTCOME_UNKNOWN", code: "SOURCE_ERASURE_OUTCOME_UNKNOWN" };
  }
}

/** In-memory encrypted-locator provider for local/synthetic verification only. */
export function createLocalSyntheticP0SourceArtifactProvider(): P0SourceArtifactProvider {
  const locatorKey = randomBytes(32);
  const rows = new Map<string, { object: P0StoredSourceArtifact; content: Uint8Array }>();
  const operationIndex = new Map<string, string>();
  const tombstones = new Map<string, P0SourceArtifactTombstoneResult>();
  const keyFor = (scope: P0SourceArtifactScope) => scopeBinding(scope);

  function encryptLocator(locator: string, scope: P0SourceArtifactScope): P0SourceLocatorEnvelope {
    const iv = randomBytes(12);
    const aad = Buffer.from(scopeBinding(scope), "utf8");
    const cipher = createCipheriv("aes-256-gcm", locatorKey, iv);
    cipher.setAAD(aad);
    const ciphertext = Buffer.concat([cipher.update(locator, "utf8"), cipher.final()]);
    return Object.freeze({
      ciphertextBase64: ciphertext.toString("base64"),
      ivBase64: iv.toString("base64"),
      authTagBase64: cipher.getAuthTag().toString("base64"),
      algorithm: "AES_256_GCM" as const,
      keyVersion: "local-ephemeral-v1",
      envelopeVersion: "p0-local-source-locator-v1" as const,
      aadVersion: "p0-source-scope-v1",
      aadSha256: digest(aad),
    });
  }

  function assertLocator(object: P0StoredSourceArtifact): void {
    const aad = Buffer.from(scopeBinding(object.scope), "utf8");
    const decipher = createDecipheriv(
      "aes-256-gcm",
      locatorKey,
      Buffer.from(object.locator.ivBase64, "base64"),
    );
    decipher.setAAD(aad);
    decipher.setAuthTag(Buffer.from(object.locator.authTagBase64, "base64"));
    Buffer.concat([
      decipher.update(Buffer.from(object.locator.ciphertextBase64, "base64")),
      decipher.final(),
    ]);
  }

  function localRead(object: P0StoredSourceArtifact): P0SourceArtifactReadback {
    const stored = rows.get(keyFor(object.scope));
    if (!stored) throw new Error("local source missing");
    if (
      computeP0StoredSourceObjectBindingSha256(stored.object) !==
      computeP0StoredSourceObjectBindingSha256(object)
    ) {
      throw new Error("local source binding mismatch");
    }
    assertLocator(stored.object);
    return Object.freeze({
      object: stored.object,
      content: new Uint8Array(stored.content),
      readAt: new Date().toISOString(),
    });
  }

  return Object.freeze({
    providerKey: P0_LOCAL_SOURCE_PROVIDER_KEY,
    async putImmutable(request: P0SourceArtifactWriteRequest & { readonly writeFencePermit: VerifiedP0SourceWriteFencePermit }): Promise<P0StoredSourceArtifact> {
      if (!validWrite(request, new Date()) || !validWriteFencePermit(request.writeFencePermit, request)) throw new Error("invalid local source write authority");
      const key = keyFor(request.scope);
      const existing = rows.get(key);
      if (existing) {
        if (
          existing.object.sha256 !== request.sha256 ||
          existing.object.byteLength !== request.byteLength ||
          existing.object.kind !== request.kind
        ) {
          throw new Error("local source version conflict");
        }
        const replay = immutableObject({ ...existing.object, writeDisposition: "IDEMPOTENT_REPLAY" });
        rows.set(key, { object: replay, content: existing.content });
        operationIndex.set(request.idempotencyKey, key);
        return replay;
      }
      const storedAt = new Date().toISOString();
      const providerObjectVersion = `local-${digest(`${key}:${request.sha256}`).slice(0, 32)}`;
      const object = immutableObject({
        contractVersion: P0_SOURCE_ARTIFACT_CONTRACT_VERSION,
        scope: Object.freeze({ ...request.scope }),
        providerKey: P0_LOCAL_SOURCE_PROVIDER_KEY,
        providerOperationId: request.idempotencyKey,
        providerObjectVersion,
        locator: encryptLocator(`local-object:${providerObjectVersion}`, request.scope),
        kind: request.kind,
        mimeType: request.mimeType,
        sha256: request.sha256,
        byteLength: request.byteLength,
        writeDisposition: "CREATED",
        immutable: true,
        storedAt,
      });
      rows.set(key, { object, content: new Uint8Array(request.content) });
      operationIndex.set(request.idempotencyKey, key);
      return object;
    },
    async readBackAfterWrite(
      request: P0SourceArtifactWriteReadbackRequest,
    ): Promise<P0SourceArtifactReadback> {
      const now = new Date();
      if (
        request.readKind !== "WRITE_READBACK" ||
        !validWriteFencePermit(request.writeFencePermit, { scope: request.object.scope, ingestionRevision: request.ingestionRevision, operationId: request.operationId, sourceOperationId: request.sourceOperationId }) ||
        !validCapability(request.capability, request.object.scope, "STORE_SOURCE", now) ||
        !validSensitiveByteRelease({
          principal: request.principal,
          grant: request.sensitiveAccessGrant,
          resource: request.sensitiveResource,
          accessKind: request.sensitiveAccessKind,
          purposeCode: request.sensitiveAccessPurposeCode,
          scope: request.object.scope,
          kind: request.object.kind,
          boundary: "INGESTION_STORE",
          ingestionRevision: request.ingestionRevision,
        })
      ) {
        throw new Error("invalid local write readback authority");
      }
      return localRead(request.object);
    },
    async discoverAfterUnknownWrite(request: P0SourceArtifactOrphanReconciliationRequest & { readonly writeFencePermit: VerifiedP0SourceWriteFencePermit }): Promise<P0SourceArtifactReadback> {
      const now = new Date();
      if (!validOrphanReconciliationRequest(request, now) || !validWriteFencePermit(request.writeFencePermit, request)) throw new Error("invalid local orphan reconciliation authority");
      const identity = deriveP0SourceArtifactOperationIdentity({ tenantId: request.scope.tenantId, consumerId: request.scope.consumerId, ingestionId: request.scope.ingestionId, operationId: request.sourceOperationId, kind: request.kind });
      const key = operationIndex.get(identity.providerOperationId);
      const stored = key ? rows.get(key) : undefined;
      if (!stored || !sameScope(stored.object.scope, request.scope) || stored.object.providerOperationId !== identity.providerOperationId) throw new Error("local orphan source missing");
      return localRead(stored.object);
    },
    async readExact(request: P0SourceArtifactReadRequest): Promise<P0SourceArtifactReadback> {
      const now = new Date();
      if (
        !validCapability(request.capability, request.object.scope, "READ_SOURCE", now) ||
        !validSensitiveByteRelease({
          principal: request.principal,
          grant: request.sensitiveAccessGrant,
          resource: request.sensitiveResource,
          accessKind: request.sensitiveAccessKind,
          purposeCode: request.sensitiveAccessPurposeCode,
          scope: request.object.scope,
          kind: request.object.kind,
          boundary: "STORED_ARTIFACT",
        })
      ) {
        throw new Error("invalid local read authority");
      }
      return localRead(request.object);
    },
    async tombstoneExact(
      request: P0SourceArtifactTombstoneRequest,
    ): Promise<P0SourceArtifactTombstoneResult> {
      const now = new Date();
      if (
        !request ||
        !validObject(request.object) ||
        !validCapability(request.capability, request.object.scope, "ERASE_SOURCE", now) ||
        !validVerifiedErasure(request.eligibility, request.object, now) ||
        !STABLE.test(request.tombstoneEventKey)
      ) {
        throw new Error("invalid local source erasure authority");
      }
      const key = keyFor(request.object.scope);
      const objectBindingSha256 = computeP0StoredSourceObjectBindingSha256(request.object);
      const prior = tombstones.get(objectBindingSha256);
      if (prior) return prior;
      const stored = rows.get(key);
      if (!stored) throw new Error("local source missing");
      rows.delete(key);
      const result = Object.freeze({
        status: "OBJECT_DELETED" as const,
        providerKey: P0_LOCAL_SOURCE_PROVIDER_KEY,
        providerObjectVersion: request.object.providerObjectVersion,
        objectBindingSha256,
        tombstoneRef: `local-tombstone-${digest(request.tombstoneEventKey).slice(0, 24)}`,
        completedAt: new Date().toISOString(),
      });
      tombstones.set(objectBindingSha256, result);
      return result;
    },
  });
}

export const P0_SOURCE_ERASURE_COORDINATOR_VERSION = "p0-source-erasure-coordinator-v1" as const;

export interface P0ErasureSourceMember {
  readonly role: "ORIGINAL_SOURCE" | "DERIVED_NORMALIZED_INPUT";
  readonly extractionRunId: string | null;
  readonly object: P0StoredSourceArtifact;
  readonly objectBindingSha256: string;
}

export interface P0ErasureSetSnapshot {
  readonly contractVersion: typeof P0_SOURCE_ERASURE_COORDINATOR_VERSION;
  readonly tenantId: string;
  readonly consumerId: string;
  readonly ingestionId: string;
  readonly revision: number;
  readonly state: P0ReportIngestionState;
  readonly sourceDisposition: "RETAINED" | "TOMBSTONE_REQUESTED" | "OBJECT_DELETED" | "CRYPTO_SHREDDED" | "DISPOSITION_FAILED";
  readonly sourceDispositionReasonCode: string | null;
  readonly sourceDispositionAt: string | null;
  readonly safeFailureCode: string | null;
  readonly enumerationComplete: true;
  readonly members: readonly P0ErasureSourceMember[];
}

const LOCAL_SOURCE_RETENTION_STATE = Symbol("local-source-retention-state");
interface LocalSourceRetentionMutable {
  tenantId: string;
  consumerId: string;
  ingestionId: string;
  sourceOperationId: string;
  revision: number;
  state: P0ReportIngestionState;
  sourceDisposition: P0ErasureSetSnapshot["sourceDisposition"];
  activeWrites: number;
}
const localSourceRetentionStates = new WeakMap<object, LocalSourceRetentionMutable>();

export interface P0LocalSyntheticSourceRetentionState {
  readonly adapterClass: "LOCAL_SYNTHETIC_ONLY";
  readonly writeFence: P0SourceArtifactWriteFence;
  readonly [LOCAL_SOURCE_RETENTION_STATE]: true;
}

export function createLocalSyntheticP0SourceRetentionState(input: {
  readonly tenantId: string;
  readonly consumerId: string;
  readonly ingestionId: string;
  readonly sourceOperationId: string;
  readonly revision: number;
  readonly state: P0ReportIngestionState;
  readonly sourceDisposition: P0ErasureSetSnapshot["sourceDisposition"];
}): P0LocalSyntheticSourceRetentionState {
  if (!STABLE.test(input.tenantId) || !STABLE.test(input.consumerId) || !STABLE.test(input.ingestionId) || !STABLE.test(input.sourceOperationId) || !Number.isSafeInteger(input.revision) || input.revision < 1 || !["RECEIVED", "SOURCE_STORED_AND_VERIFIED", "VERSION_COMMITTED", "EXTRACTING", "SUCCEEDED", "PARTIAL", "FAILED", "ASSESSED", "ROUND0_READY", "OUTCOME_UNKNOWN", "QUARANTINED"].includes(input.state) || !["RETAINED", "TOMBSTONE_REQUESTED", "OBJECT_DELETED", "CRYPTO_SHREDDED", "DISPOSITION_FAILED"].includes(input.sourceDisposition)) throw new Error("invalid local retention state");
  const mutable: LocalSourceRetentionMutable = { ...input, activeWrites: 0 };
  const holder = {} as P0LocalSyntheticSourceRetentionState;
  const writeFence: P0SourceArtifactWriteFence = Object.freeze({
    async runWhileRetained<T>(request: { readonly principal: P0Principal; readonly scope: P0SourceArtifactScope; readonly ingestionRevision: number; readonly operationId: string; readonly sourceOperationId: string; readonly execute: (permit: VerifiedP0SourceWriteFencePermit) => Promise<T> }): Promise<P0SourceWriteFenceResult<T>> {
      if (
        !request ||
        !p0PrincipalAuthorizesScope(request.principal, { tenantId: mutable.tenantId, consumerId: mutable.consumerId }) ||
        request.scope.tenantId !== mutable.tenantId ||
        request.scope.consumerId !== mutable.consumerId ||
        request.scope.ingestionId !== mutable.ingestionId ||
        request.sourceOperationId !== mutable.sourceOperationId ||
        request.ingestionRevision !== mutable.revision ||
        !STABLE.test(request.operationId) ||
        mutable.sourceDisposition !== "RETAINED" ||
        mutable.state === "QUARANTINED"
      ) return { kind: "DENIED" };
      const candidate = {
        tenantId: mutable.tenantId,
        consumerId: mutable.consumerId,
        ingestionId: mutable.ingestionId,
        ingestionRevision: mutable.revision,
        operationId: request.operationId,
        sourceOperationId: request.sourceOperationId,
      };
      const permit = { ...candidate } as VerifiedP0SourceWriteFencePermit;
      Object.defineProperty(permit, VERIFIED_SOURCE_WRITE_FENCE_PERMIT, { value: true, enumerable: false, configurable: false, writable: false });
      Object.freeze(permit);
      verifiedWriteFencePermits.set(permit, writeFencePermitBinding(permit));
      mutable.activeWrites += 1;
      try {
        return { kind: "EXECUTED", value: await request.execute(permit) };
      } catch {
        return { kind: "OUTCOME_UNKNOWN" };
      } finally {
        verifiedWriteFencePermits.delete(permit);
        mutable.activeWrites -= 1;
      }
    },
  });
  Object.defineProperties(holder, {
    adapterClass: { value: "LOCAL_SYNTHETIC_ONLY", enumerable: true },
    writeFence: { value: writeFence, enumerable: true },
    [LOCAL_SOURCE_RETENTION_STATE]: { value: true, enumerable: false },
  });
  Object.freeze(holder);
  localSourceRetentionStates.set(holder, mutable);
  return holder;
}

export interface P0ArtifactTombstoneRecord {
  readonly contractVersion: typeof P0_SOURCE_ERASURE_COORDINATOR_VERSION;
  readonly tenantId: string;
  readonly consumerId: string;
  readonly ingestionId: string;
  readonly role: P0ErasureSourceMember["role"];
  readonly extractionRunId: string | null;
  readonly artifactId: string;
  readonly artifactVersion: number;
  readonly objectBindingSha256: string;
  readonly providerKey: string;
  readonly providerObjectVersion: string;
  readonly disposition: "OBJECT_DELETED" | "CRYPTO_SHREDDED";
  readonly tombstoneRef: string;
  readonly completedAt: string;
}

type ErasureRead<T> =
  | { readonly kind: "FOUND"; readonly value: T; readonly attestation: VerifiedP0RepositoryAttestation<T> }
  | { readonly kind: "NOT_FOUND" | "DENIED" | "OUTCOME_UNKNOWN" };
type ErasureWrite<T> =
  | { readonly kind: "UPDATED" | "CREATED" | "IDEMPOTENT_REPLAY"; readonly value: T; readonly attestation: VerifiedP0RepositoryAttestation<T> }
  | { readonly kind: "CONFLICT" | "DENIED" | "OUTCOME_UNKNOWN" };

export interface P0SourceErasureRepository {
  readErasureSet(input: { readonly principal: P0Principal; readonly scope: P0Scope; readonly ingestionId: string; readonly operationId: string }): Promise<ErasureRead<P0ErasureSetSnapshot>>;
  compareAndSwapErasureSet(input: { readonly principal: P0Principal; readonly scope: P0Scope; readonly operationId: string; readonly expected: P0ErasureSetSnapshot; readonly next: P0ErasureSetSnapshot }): Promise<ErasureWrite<P0ErasureSetSnapshot>>;
  readArtifactTombstone(input: { readonly principal: P0Principal; readonly scope: P0Scope; readonly ingestionId: string; readonly objectBindingSha256: string; readonly operationId: string }): Promise<ErasureRead<P0ArtifactTombstoneRecord>>;
  appendArtifactTombstone(input: { readonly principal: P0Principal; readonly scope: P0Scope; readonly operationId: string; readonly record: P0ArtifactTombstoneRecord }): Promise<ErasureWrite<P0ArtifactTombstoneRecord>>;
}

export interface P0SourceErasureAuthority {
  readonly objectBindingSha256: string;
  readonly provider: P0SourceArtifactProvider;
  readonly capability: VerifiedP0SourceArtifactCapability & { readonly purpose: "ERASE_SOURCE" };
  readonly eligibility: VerifiedP0SourceArtifactErasure;
  readonly tombstoneEventKey: string;
}

export type P0SourceErasureCoordinatorResult =
  | { readonly ok: true; readonly kind: "COMPLETED" | "IDEMPOTENT_REPLAY"; readonly snapshot: P0ErasureSetSnapshot; readonly tombstones: readonly P0ArtifactTombstoneRecord[] }
  | { readonly ok: false; readonly kind: "DENIED" | "CONFLICT" | "PARTIAL" | "OUTCOME_UNKNOWN"; readonly code: string; readonly snapshot?: P0ErasureSetSnapshot; readonly tombstones: readonly P0ArtifactTombstoneRecord[] };

function erasureMembersValid(snapshot: P0ErasureSetSnapshot, scope: P0Scope): boolean {
  if (!snapshot || snapshot.contractVersion !== P0_SOURCE_ERASURE_COORDINATOR_VERSION || snapshot.tenantId !== scope.tenantId || snapshot.consumerId !== scope.consumerId || snapshot.enumerationComplete !== true || !STABLE.test(snapshot.ingestionId) || !Number.isSafeInteger(snapshot.revision) || snapshot.revision < 1 || !["RECEIVED", "SOURCE_STORED_AND_VERIFIED", "VERSION_COMMITTED", "EXTRACTING", "SUCCEEDED", "PARTIAL", "FAILED", "ASSESSED", "ROUND0_READY", "OUTCOME_UNKNOWN", "QUARANTINED"].includes(snapshot.state) || !["RETAINED", "TOMBSTONE_REQUESTED", "OBJECT_DELETED", "CRYPTO_SHREDDED", "DISPOSITION_FAILED"].includes(snapshot.sourceDisposition) || !Array.isArray(snapshot.members) || snapshot.members.length < 1) return false;
  if (["FAILED", "OUTCOME_UNKNOWN", "QUARANTINED"].includes(snapshot.state) ? !SAFE_REASON.test(snapshot.safeFailureCode ?? "") : snapshot.safeFailureCode !== null && !SAFE_REASON.test(snapshot.safeFailureCode)) return false;
  if (snapshot.sourceDisposition === "RETAINED" ? snapshot.sourceDispositionReasonCode !== null || snapshot.sourceDispositionAt !== null : snapshot.state !== "QUARANTINED" || !SAFE_REASON.test(snapshot.sourceDispositionReasonCode ?? "") || instant(snapshot.sourceDispositionAt) === null) return false;
  const bindings = new Set<string>();
  let originalCount = 0;
  for (const member of snapshot.members) {
    if (!member || !validObject(member.object) || member.object.scope.tenantId !== scope.tenantId || member.object.scope.consumerId !== scope.consumerId || member.object.scope.ingestionId !== snapshot.ingestionId || member.objectBindingSha256 !== computeP0StoredSourceObjectBindingSha256(member.object) || bindings.has(member.objectBindingSha256)) return false;
    if (member.role === "ORIGINAL_SOURCE") { originalCount += 1; if (member.extractionRunId !== null || member.object.kind === "NORMALIZED_TEXT") return false; }
    else if (member.role === "DERIVED_NORMALIZED_INPUT") { if (!member.extractionRunId || member.object.kind !== "NORMALIZED_TEXT") return false; }
    else return false;
    bindings.add(member.objectBindingSha256);
  }
  return originalCount === 1;
}

function erasureNext(snapshot: P0ErasureSetSnapshot, input: Pick<P0ErasureSetSnapshot, "state" | "sourceDisposition" | "sourceDispositionReasonCode" | "sourceDispositionAt" | "safeFailureCode">): P0ErasureSetSnapshot {
  return Object.freeze({ ...snapshot, ...input, revision: snapshot.revision + 1, members: Object.freeze([...snapshot.members]) });
}

function erasureSetRefs(snapshot: P0ErasureSetSnapshot): readonly P0RepositorySourceRef[] {
  return Object.freeze(snapshot.members.map((member) => ({ resourceType: "SOURCE_ARTIFACT", resourceId: member.object.scope.artifactId, resourceVersion: String(member.object.scope.artifactVersion), integritySha256: member.object.sha256 })));
}

function tombstoneRefs(record: P0ArtifactTombstoneRecord): readonly P0RepositorySourceRef[] {
  return Object.freeze([{ resourceType: "SOURCE_ARTIFACT", resourceId: record.artifactId, resourceVersion: String(record.artifactVersion), integritySha256: record.objectBindingSha256 }]);
}

function exactErasureAttestation<T>(input: { readonly attestation: VerifiedP0RepositoryAttestation<T> | undefined; readonly value: T; readonly expected: T; readonly operationId: string; readonly purpose: string; readonly scope: P0Scope; readonly sourceRefs: readonly P0RepositorySourceRef[] }): boolean {
  try {
    const semanticSha256 = computeP0RepositorySemanticSha256(input.expected);
    return Boolean(isVerifiedP0RepositoryAttestation(input.attestation) && input.attestation.operationId === input.operationId && input.attestation.purpose === input.purpose && input.attestation.scope.tenantId === input.scope.tenantId && input.attestation.scope.consumerId === input.scope.consumerId && input.attestation.semanticSha256 === semanticSha256 && input.attestation.sourceSetSha256 === computeP0RepositorySourceSetSha256(input.sourceRefs) && computeP0RepositorySemanticSha256(input.attestation.snapshot) === semanticSha256 && computeP0RepositorySemanticSha256(input.value) === semanticSha256);
  } catch {
    return false;
  }
}

function tombstoneMatchesMember(record: P0ArtifactTombstoneRecord, member: P0ErasureSourceMember, snapshot: P0ErasureSetSnapshot): boolean {
  return Boolean(record && record.contractVersion === P0_SOURCE_ERASURE_COORDINATOR_VERSION && record.tenantId === snapshot.tenantId && record.consumerId === snapshot.consumerId && record.ingestionId === snapshot.ingestionId && record.role === member.role && record.extractionRunId === member.extractionRunId && record.artifactId === member.object.scope.artifactId && record.artifactVersion === member.object.scope.artifactVersion && record.objectBindingSha256 === member.objectBindingSha256 && record.providerKey === member.object.providerKey && record.providerObjectVersion === member.object.providerObjectVersion && ["OBJECT_DELETED", "CRYPTO_SHREDDED"].includes(record.disposition) && STABLE.test(record.tombstoneRef) && instant(record.completedAt) !== null);
}

/** Injected eligibility decides whether deletion is allowed; this coordinator intentionally defines no retention duration or legal-hold policy. */
export function createP0SourceErasureCoordinator(repository: P0SourceErasureRepository) {
  return Object.freeze({
    async erase(input: { readonly principal: P0Principal; readonly ingestionId: string; readonly operationId: string; readonly authorities: readonly P0SourceErasureAuthority[] }): Promise<P0SourceErasureCoordinatorResult> {
      let scope: P0Scope;
      try { scope = p0ScopeFromPrincipal(input.principal); } catch { return { ok: false, kind: "DENIED", code: "UNVERIFIED_PRINCIPAL", tombstones: [] }; }
      if (!STABLE.test(input.ingestionId) || !STABLE.test(input.operationId) || !Array.isArray(input.authorities)) return { ok: false, kind: "DENIED", code: "INVALID_ERASURE_REQUEST", tombstones: [] };
      const read = await repository.readErasureSet({ principal: input.principal, scope, ingestionId: input.ingestionId, operationId: `${input.operationId}:read` }).catch(() => ({ kind: "OUTCOME_UNKNOWN" as const }));
      if (read.kind !== "FOUND") return { ok: false, kind: read.kind === "OUTCOME_UNKNOWN" ? "OUTCOME_UNKNOWN" : "DENIED", code: "ERASURE_SET_UNAVAILABLE", tombstones: [] };
      let snapshot = read.value;
      if (!erasureMembersValid(snapshot, scope) || !exactErasureAttestation({ attestation: read.attestation, value: snapshot, expected: snapshot, operationId: `${input.operationId}:read`, purpose: "SOURCE_ERASURE_READ", scope, sourceRefs: erasureSetRefs(snapshot) })) return { ok: false, kind: "DENIED", code: "UNATTESTED_ERASURE_ENUMERATION", tombstones: [] };
      if (input.authorities.some((authority) => !authority?.capability || authority.capability.actorId !== input.principal.actorId || authority.capability.authorizationVersion !== input.principal.authorizationVersion)) return { ok: false, kind: "DENIED", code: "ERASURE_ACTOR_AUTHORITY_SUBSTITUTION", tombstones: [] };
      const authorityByBinding = new Map(input.authorities.map((authority) => [authority.objectBindingSha256, authority]));
      if (authorityByBinding.size !== snapshot.members.length || snapshot.members.some((member) => !authorityByBinding.has(member.objectBindingSha256))) return { ok: false, kind: "DENIED", code: "ERASURE_AUTHORITY_SUBSTITUTION", tombstones: [] };
      const existingTombstones: P0ArtifactTombstoneRecord[] = [];
      for (const member of snapshot.members) {
        const prior = await repository.readArtifactTombstone({ principal: input.principal, scope, ingestionId: snapshot.ingestionId, objectBindingSha256: member.objectBindingSha256, operationId: `${input.operationId}:tombstone-read` }).catch(() => ({ kind: "OUTCOME_UNKNOWN" as const }));
        if (prior.kind === "FOUND") {
          if (!tombstoneMatchesMember(prior.value, member, snapshot) || !exactErasureAttestation({ attestation: prior.attestation, value: prior.value, expected: prior.value, operationId: `${input.operationId}:tombstone-read`, purpose: "SOURCE_TOMBSTONE_READ", scope, sourceRefs: tombstoneRefs(prior.value) })) return { ok: false, kind: "OUTCOME_UNKNOWN", code: "TOMBSTONE_READ_UNATTESTED", snapshot, tombstones: existingTombstones };
          existingTombstones.push(prior.value);
        }
        else if (prior.kind === "OUTCOME_UNKNOWN") return { ok: false, kind: "OUTCOME_UNKNOWN", code: "TOMBSTONE_READ_OUTCOME_UNKNOWN", snapshot, tombstones: existingTombstones };
      }
      if ((snapshot.sourceDisposition === "OBJECT_DELETED" || snapshot.sourceDisposition === "CRYPTO_SHREDDED") && existingTombstones.length === snapshot.members.length) return { ok: true, kind: "IDEMPOTENT_REPLAY", snapshot, tombstones: Object.freeze(existingTombstones) };
      if (snapshot.sourceDisposition === "RETAINED" || snapshot.sourceDisposition === "DISPOSITION_FAILED") {
        const requestedAt = new Date().toISOString();
        const requested = erasureNext(snapshot, { state: "QUARANTINED", sourceDisposition: "TOMBSTONE_REQUESTED", sourceDispositionReasonCode: "SOURCE_ERASURE_REQUESTED", sourceDispositionAt: requestedAt, safeFailureCode: "SOURCE_ERASURE_REQUESTED" });
        const requestedWrite = await repository.compareAndSwapErasureSet({ principal: input.principal, scope, operationId: `${input.operationId}:request`, expected: snapshot, next: requested }).catch(() => ({ kind: "OUTCOME_UNKNOWN" as const }));
        if (!("value" in requestedWrite)) return { ok: false, kind: requestedWrite.kind === "CONFLICT" ? "CONFLICT" : "OUTCOME_UNKNOWN", code: "ERASURE_REQUEST_WRITE_UNATTESTED", snapshot, tombstones: existingTombstones };
        if (!erasureMembersValid(requestedWrite.value, scope) || !exactErasureAttestation({ attestation: requestedWrite.attestation, value: requestedWrite.value, expected: requested, operationId: `${input.operationId}:request`, purpose: "SOURCE_ERASURE_WRITE", scope, sourceRefs: erasureSetRefs(requested) })) return { ok: false, kind: "OUTCOME_UNKNOWN", code: "ERASURE_REQUEST_WRITE_UNATTESTED", snapshot, tombstones: existingTombstones };
        const stableRead = await repository.readErasureSet({ principal: input.principal, scope, ingestionId: input.ingestionId, operationId: `${input.operationId}:stable-enumeration` }).catch(() => ({ kind: "OUTCOME_UNKNOWN" as const }));
        if (stableRead.kind !== "FOUND" || !erasureMembersValid(stableRead.value, scope) || !exactErasureAttestation({ attestation: stableRead.attestation, value: stableRead.value, expected: stableRead.value, operationId: `${input.operationId}:stable-enumeration`, purpose: "SOURCE_ERASURE_READ", scope, sourceRefs: erasureSetRefs(stableRead.value) }) || computeP0RepositorySemanticSha256(stableRead.value) !== computeP0RepositorySemanticSha256(requestedWrite.value)) return { ok: false, kind: "OUTCOME_UNKNOWN", code: "ERASURE_ENUMERATION_CHANGED_AFTER_QUARANTINE", snapshot: requestedWrite.value, tombstones: existingTombstones };
        snapshot = stableRead.value;
      } else if (snapshot.sourceDisposition !== "TOMBSTONE_REQUESTED") return { ok: false, kind: "CONFLICT", code: "ERASURE_STATE_NOT_RECONCILABLE", snapshot, tombstones: existingTombstones };

      const completed = new Map(existingTombstones.map((record) => [record.objectBindingSha256, record]));
      let ambiguous = false;
      for (const member of snapshot.members) {
        if (completed.has(member.objectBindingSha256)) continue;
        const authority = authorityByBinding.get(member.objectBindingSha256)!;
        const result = await dispatchP0SourceArtifactTombstone(authority.provider, { contractVersion: P0_SOURCE_ARTIFACT_CONTRACT_VERSION, capability: authority.capability, object: member.object, eligibility: authority.eligibility, tombstoneEventKey: authority.tombstoneEventKey });
        if (!result.ok) { if (result.kind === "OUTCOME_UNKNOWN" || result.kind === "INTEGRITY_FAILURE") ambiguous = true; continue; }
        if (result.value.status === "FAILED" || !result.value.tombstoneRef) continue;
        const record: P0ArtifactTombstoneRecord = Object.freeze({ contractVersion: P0_SOURCE_ERASURE_COORDINATOR_VERSION, tenantId: scope.tenantId, consumerId: scope.consumerId, ingestionId: snapshot.ingestionId, role: member.role, extractionRunId: member.extractionRunId, artifactId: member.object.scope.artifactId, artifactVersion: member.object.scope.artifactVersion, objectBindingSha256: member.objectBindingSha256, providerKey: result.value.providerKey, providerObjectVersion: result.value.providerObjectVersion, disposition: result.value.status, tombstoneRef: result.value.tombstoneRef, completedAt: result.value.completedAt });
        const write = await repository.appendArtifactTombstone({ principal: input.principal, scope, operationId: `${input.operationId}:append:${member.object.scope.artifactId}`, record }).catch(() => ({ kind: "OUTCOME_UNKNOWN" as const }));
        if (!("value" in write) || !tombstoneMatchesMember(write.value, member, snapshot) || !exactErasureAttestation({ attestation: write.attestation, value: write.value, expected: record, operationId: `${input.operationId}:append:${member.object.scope.artifactId}`, purpose: "SOURCE_TOMBSTONE_APPEND", scope, sourceRefs: tombstoneRefs(record) })) { ambiguous = true; continue; }
        completed.set(member.objectBindingSha256, write.value);
      }
      const allComplete = completed.size === snapshot.members.length;
      const terminalAt = new Date().toISOString();
      const terminal = erasureNext(snapshot, allComplete ? { state: "QUARANTINED", sourceDisposition: [...completed.values()].some((record) => record.disposition === "CRYPTO_SHREDDED") ? "CRYPTO_SHREDDED" : "OBJECT_DELETED", sourceDispositionReasonCode: "SOURCE_ERASURE_COMPLETED", sourceDispositionAt: terminalAt, safeFailureCode: "SOURCE_ERASURE_COMPLETED" } : ambiguous ? { state: "QUARANTINED", sourceDisposition: "DISPOSITION_FAILED", sourceDispositionReasonCode: "SOURCE_ERASURE_OUTCOME_UNKNOWN", sourceDispositionAt: terminalAt, safeFailureCode: "SOURCE_ERASURE_OUTCOME_UNKNOWN" } : { state: "QUARANTINED", sourceDisposition: "DISPOSITION_FAILED", sourceDispositionReasonCode: "SOURCE_ERASURE_PARTIAL", sourceDispositionAt: terminalAt, safeFailureCode: "SOURCE_ERASURE_PARTIAL" });
      const finalWrite = await repository.compareAndSwapErasureSet({ principal: input.principal, scope, operationId: `${input.operationId}:final`, expected: snapshot, next: terminal }).catch(() => ({ kind: "OUTCOME_UNKNOWN" as const }));
      const tombstones = Object.freeze([...completed.values()]);
      if (!("value" in finalWrite) || !erasureMembersValid(finalWrite.value, scope) || !exactErasureAttestation({ attestation: finalWrite.attestation, value: finalWrite.value, expected: terminal, operationId: `${input.operationId}:final`, purpose: "SOURCE_ERASURE_WRITE", scope, sourceRefs: erasureSetRefs(terminal) })) return { ok: false, kind: "OUTCOME_UNKNOWN", code: "ERASURE_FINAL_WRITE_UNATTESTED", snapshot, tombstones };
      if (allComplete) return { ok: true, kind: "COMPLETED", snapshot: finalWrite.value, tombstones };
      return { ok: false, kind: ambiguous ? "OUTCOME_UNKNOWN" : "PARTIAL", code: ambiguous ? "SOURCE_ERASURE_OUTCOME_UNKNOWN" : "SOURCE_ERASURE_PARTIAL", snapshot: finalWrite.value, tombstones };
    },
  });
}

export function createLocalSyntheticP0SourceErasureRepository(initial: P0ErasureSetSnapshot, options: { readonly mutateReadback?: (resourceType: "ERASURE_SET" | "ARTIFACT_TOMBSTONE", value: unknown) => unknown; readonly retentionState?: P0LocalSyntheticSourceRetentionState } = {}): P0SourceErasureRepository {
  let snapshot = structuredClone(initial);
  const sharedRetention = options.retentionState ? localSourceRetentionStates.get(options.retentionState) : undefined;
  if (options.retentionState && (!sharedRetention || sharedRetention.tenantId !== initial.tenantId || sharedRetention.consumerId !== initial.consumerId || sharedRetention.ingestionId !== initial.ingestionId || sharedRetention.revision !== initial.revision || sharedRetention.state !== initial.state || sharedRetention.sourceDisposition !== initial.sourceDisposition)) throw new Error("local retention state mismatch");
  const tombstones = new Map<string, P0ArtifactTombstoneRecord>();
  const verifier = Object.freeze({ repositoryId: P0_LOCAL_REPOSITORY_ID, semanticsVersion: P0_LOCAL_REPOSITORY_SEMANTICS_VERSION, async verifyReadback() { return true; } });
  const refs = (value: P0ErasureSetSnapshot): readonly P0RepositorySourceRef[] => Object.freeze(value.members.map((member) => ({ resourceType: "SOURCE_ARTIFACT", resourceId: member.object.scope.artifactId, resourceVersion: String(member.object.scope.artifactVersion), integritySha256: member.object.sha256 })));
  async function attest<T>(operationId: string, scope: P0Scope, purpose: string, expected: T, actual: T, sourceRefs: readonly P0RepositorySourceRef[]) { return verifyLocalP0RepositoryReadback({ operationId, purpose, scope, expectedSnapshot: expected, readbackSnapshot: actual, sourceRefs, verifier }); }
  return Object.freeze({
    async readErasureSet(input: Parameters<P0SourceErasureRepository["readErasureSet"]>[0]): Promise<ErasureRead<P0ErasureSetSnapshot>> { if (!p0PrincipalAuthorizesScope(input.principal, input.scope) || input.ingestionId !== snapshot.ingestionId) return { kind: "DENIED" }; const actual = (options.mutateReadback?.("ERASURE_SET", structuredClone(snapshot)) ?? structuredClone(snapshot)) as P0ErasureSetSnapshot; const attestation = await attest(input.operationId, input.scope, "SOURCE_ERASURE_READ", snapshot, actual, refs(snapshot)); return attestation ? { kind: "FOUND", value: attestation.snapshot, attestation } : { kind: "OUTCOME_UNKNOWN" }; },
    async compareAndSwapErasureSet(input: Parameters<P0SourceErasureRepository["compareAndSwapErasureSet"]>[0]): Promise<ErasureWrite<P0ErasureSetSnapshot>> { if (!p0PrincipalAuthorizesScope(input.principal, input.scope)) return { kind: "DENIED" }; if (computeP0RepositorySemanticSha256(snapshot) !== computeP0RepositorySemanticSha256(input.expected) || (sharedRetention && (sharedRetention.activeWrites > 0 || sharedRetention.revision !== input.expected.revision || sharedRetention.state !== input.expected.state || sharedRetention.sourceDisposition !== input.expected.sourceDisposition))) return { kind: "CONFLICT" }; snapshot = structuredClone(input.next); if (sharedRetention) { sharedRetention.revision = input.next.revision; sharedRetention.state = input.next.state; sharedRetention.sourceDisposition = input.next.sourceDisposition; } const actual = (options.mutateReadback?.("ERASURE_SET", structuredClone(snapshot)) ?? structuredClone(snapshot)) as P0ErasureSetSnapshot; const attestation = await attest(input.operationId, input.scope, "SOURCE_ERASURE_WRITE", input.next, actual, refs(input.next)); return attestation ? { kind: "UPDATED", value: attestation.snapshot, attestation } : { kind: "OUTCOME_UNKNOWN" }; },
    async readArtifactTombstone(input: Parameters<P0SourceErasureRepository["readArtifactTombstone"]>[0]): Promise<ErasureRead<P0ArtifactTombstoneRecord>> { if (!p0PrincipalAuthorizesScope(input.principal, input.scope) || input.ingestionId !== snapshot.ingestionId) return { kind: "DENIED" }; const value = tombstones.get(input.objectBindingSha256); if (!value) return { kind: "NOT_FOUND" }; const actual = (options.mutateReadback?.("ARTIFACT_TOMBSTONE", structuredClone(value)) ?? structuredClone(value)) as P0ArtifactTombstoneRecord; const attestation = await attest(input.operationId, input.scope, "SOURCE_TOMBSTONE_READ", value, actual, [{ resourceType: "SOURCE_ARTIFACT", resourceId: value.artifactId, resourceVersion: String(value.artifactVersion), integritySha256: value.objectBindingSha256 }]); return attestation ? { kind: "FOUND", value: attestation.snapshot, attestation } : { kind: "OUTCOME_UNKNOWN" }; },
    async appendArtifactTombstone(input: Parameters<P0SourceErasureRepository["appendArtifactTombstone"]>[0]): Promise<ErasureWrite<P0ArtifactTombstoneRecord>> { if (!p0PrincipalAuthorizesScope(input.principal, input.scope)) return { kind: "DENIED" }; const prior = tombstones.get(input.record.objectBindingSha256); if (prior && computeP0RepositorySemanticSha256(prior) !== computeP0RepositorySemanticSha256(input.record)) return { kind: "CONFLICT" }; if (!prior) tombstones.set(input.record.objectBindingSha256, structuredClone(input.record)); const value = tombstones.get(input.record.objectBindingSha256)!; const actual = (options.mutateReadback?.("ARTIFACT_TOMBSTONE", structuredClone(value)) ?? structuredClone(value)) as P0ArtifactTombstoneRecord; const attestation = await attest(input.operationId, input.scope, "SOURCE_TOMBSTONE_APPEND", input.record, actual, [{ resourceType: "SOURCE_ARTIFACT", resourceId: input.record.artifactId, resourceVersion: String(input.record.artifactVersion), integritySha256: input.record.objectBindingSha256 }]); return attestation ? { kind: prior ? "IDEMPOTENT_REPLAY" : "CREATED", value: attestation.snapshot, attestation } : { kind: "OUTCOME_UNKNOWN" }; },
  });
}
