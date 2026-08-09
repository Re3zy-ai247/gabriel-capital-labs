import { createHash } from "node:crypto";

/**
 * Vendor-neutral canonical-artifact storage contract for the P0 bounded context.
 *
 * Phase 1 deliberately provides no concrete adapter and performs no external I/O.
 * A later adapter must sit behind the application authorization boundary and
 * persist provider binding fields only through the encrypted Artifact envelope.
 */

export const ARTIFACT_STORAGE_CONTRACT_VERSION = "artifact-storage-v1" as const;
export const MAX_ARTIFACT_READ_GRANT_SECONDS = 300 as const;
export const MAX_ARTIFACT_ERASURE_DECISION_SECONDS = 30 as const;
export const MAX_ARTIFACT_BYTES = 50 * 1024 * 1024;

const VERIFIED_ARTIFACT_CAPABILITY = Symbol("verified-artifact-capability");
const VERIFIED_ARTIFACT_SOURCE = Symbol("verified-artifact-source");
const VERIFIED_ARTIFACT_GRANT = Symbol("verified-artifact-grant");
const VERIFIED_ERASURE_ELIGIBILITY = Symbol("verified-erasure-eligibility");
const verifiedCapabilityIdentities = new WeakSet<object>();
const verifiedSourceIdentities = new WeakSet<object>();
const verifiedGrantIdentities = new WeakSet<object>();
const verifiedErasureIdentities = new WeakSet<object>();
const verifiedCapabilityBindingDigests = new WeakMap<object, string>();
const verifiedSourceBindingDigests = new WeakMap<object, string>();
const verifiedGrantBindingDigests = new WeakMap<object, string>();
const verifiedErasureBindingDigests = new WeakMap<object, string>();

export type ArtifactAccessPurpose =
  | "STORE_CANONICAL"
  | "STORE_ENCLOSURE"
  | "STORE_RESPONSE"
  | "PREVIEW"
  | "DOWNLOAD"
  | "PRINT"
  | "FULFILLMENT"
  | "EXPORT"
  | "INTEGRITY_VERIFY"
  | "ERASURE";

export interface ArtifactStorageScope {
  readonly tenantId: string;
  readonly consumerId: string;
  readonly reportVersionId: string;
  readonly caseId: string;
  readonly artifactId: string;
  readonly artifactVersion: number;
}

/**
 * Capability metadata is value-free and exact-resource scoped. The application
 * creates it only after authenticating the real actor and authorizing the scope
 * and purpose. Storage adapters must never infer authority from object names.
 */
export interface AuthorizedArtifactCapability {
  readonly scope: ArtifactStorageScope;
  readonly purpose: ArtifactAccessPurpose;
  readonly actorId: string;
  readonly authorizationDecisionId: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
}

export interface ArtifactAuthorizationDecisionVerifier {
  verifyDecision(input: {
    readonly capability: AuthorizedArtifactCapability;
    readonly expectedScope: ArtifactStorageScope;
    readonly allowedPurposes: readonly ArtifactAccessPurpose[];
    readonly now: Date;
  }): Promise<boolean>;
}

/**
 * Only the async verification factory below can normally create this branded
 * capability. Storage operations therefore consume a checked server decision,
 * not caller-provided metadata or an object-name convention.
 */
export interface VerifiedArtifactCapability extends AuthorizedArtifactCapability {
  readonly decisionSha256: string;
  readonly [VERIFIED_ARTIFACT_CAPABILITY]: true;
}

export type ArtifactContentKind = "PDF" | "PNG" | "JPEG" | "TIFF";

export interface ArtifactSourceBinding {
  readonly kind: "APPROVED_CANONICAL" | "APPROVED_ENCLOSURE" | "INGESTED_RESPONSE";
  readonly decisionId: string;
  readonly sourceVersionId: string;
  readonly sourceInputSha256: string;
  readonly policyVersion: string;
}

export interface ArtifactSourceDecisionVerifier {
  verifyDecision(input: {
    readonly sourceBinding: ArtifactSourceBinding;
    readonly scope: ArtifactStorageScope;
    readonly purpose: ArtifactAccessPurpose;
  }): Promise<boolean>;
}

export interface VerifiedArtifactSourceBinding extends ArtifactSourceBinding {
  readonly authorizedScope: ArtifactStorageScope;
  readonly authorizedPurpose: ArtifactAccessPurpose;
  readonly verificationSha256: string;
  readonly [VERIFIED_ARTIFACT_SOURCE]: true;
}

export interface ImmutableArtifactWriteRequest {
  readonly contractVersion: typeof ARTIFACT_STORAGE_CONTRACT_VERSION;
  readonly selectedProviderKey: string;
  readonly scope: ArtifactStorageScope;
  readonly capability: VerifiedArtifactCapability;
  readonly content: Uint8Array;
  readonly sha256: string;
  readonly byteLength: number;
  readonly contentKind: ArtifactContentKind;
  readonly mimeType: string;
  readonly idempotencyKey: string;
  readonly sourceBinding: VerifiedArtifactSourceBinding;
  readonly writeMode: "CREATE_EXACT_VERSION_ONLY";
  readonly immutability: "REQUIRED";
  readonly serverSideEncryption: "REQUIRED";
  readonly aadVersion: string;
}

export interface ArtifactEncryptionReceipt {
  readonly serverSideEncrypted: true;
  readonly algorithm: string;
  readonly keyReferenceOpaque: string;
  readonly keyVersion: string;
  readonly aadVersion: string;
  readonly encryptionContextSha256: string;
}

/**
 * Exact provider object binding. It is never a URL and is AEAD-encrypted before
 * persistence. Authorized server code decrypts it only after checking the exact
 * ArtifactStorageScope and requested purpose.
 */
export interface StoredArtifactObject {
  readonly scope: ArtifactStorageScope;
  readonly providerKey: string;
  readonly providerObjectVersion: string;
  readonly providerLocatorOpaque: string;
  readonly sha256: string;
  readonly byteLength: number;
  readonly contentKind: ArtifactContentKind;
  readonly mimeType: string;
  readonly sourceBindingSha256: string;
  readonly encryption: ArtifactEncryptionReceipt;
  readonly writeDisposition: "CREATED" | "IDEMPOTENT_REPLAY";
  readonly immutable: true;
}

export interface ArtifactReadGrantRequest {
  readonly contractVersion: typeof ARTIFACT_STORAGE_CONTRACT_VERSION;
  readonly capability: VerifiedArtifactCapability;
  readonly object: StoredArtifactObject;
  readonly expiresInSeconds: number;
  readonly singleUse: true;
}

/**
 * A broker token is intentionally not a provider URL. The server atomically
 * redeems it once for the exact scope, purpose, digest and object version.
 */
export interface ArtifactReadGrant {
  readonly brokerGrantId: string;
  readonly brokerGrantToken: string;
  readonly tokenFormat: "SIGNED_OPAQUE";
  readonly scope: ArtifactStorageScope;
  readonly purpose: ArtifactAccessPurpose;
  readonly providerKey: string;
  readonly providerObjectVersion: string;
  readonly objectBindingSha256: string;
  readonly expectedSha256: string;
  readonly expectedByteLength: number;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly singleUse: true;
}

export interface ArtifactReadGrantSignatureVerifier {
  verifyGrant(input: {
    readonly request: ArtifactReadGrantRequest;
    readonly grant: ArtifactReadGrant;
    readonly now: Date;
  }): Promise<boolean>;
}

export interface VerifiedArtifactReadGrant extends ArtifactReadGrant {
  readonly [VERIFIED_ARTIFACT_GRANT]: true;
}

export interface ArtifactReadRedemptionRequest {
  readonly contractVersion: typeof ARTIFACT_STORAGE_CONTRACT_VERSION;
  readonly capability: VerifiedArtifactCapability;
  readonly grant: VerifiedArtifactReadGrant;
}

export interface ArtifactReadRedemptionResult {
  readonly status: "REDEEMED" | "ALREADY_REDEEMED" | "EXPIRED" | "DENIED";
  readonly brokerGrantId: string;
  readonly providerKey: string;
  readonly objectBindingSha256: string;
  readonly content?: Uint8Array;
  readonly observedSha256?: string;
  readonly observedByteLength?: number;
  readonly redeemedAt: string;
  readonly singleUseConsumed: boolean;
}

export interface ArtifactIntegrityRequest {
  readonly contractVersion: typeof ARTIFACT_STORAGE_CONTRACT_VERSION;
  readonly capability: VerifiedArtifactCapability;
  readonly object: StoredArtifactObject;
}

export interface ArtifactIntegrityResult {
  readonly matches: boolean;
  readonly providerKey: string;
  readonly providerObjectVersion: string;
  readonly objectBindingSha256: string;
  readonly observedSha256: string;
  readonly observedByteLength: number;
  readonly verifiedAt: string;
}

export interface ArtifactErasureEligibility {
  readonly retentionDecision: "ERASURE_ELIGIBLE";
  readonly legalHoldStatus: "CLEAR";
  readonly replicaDisposition: "TOMBSTONE_PROPAGATION_REQUIRED";
  readonly backupDisposition: "TOMBSTONE_PROPAGATION_REQUIRED";
  readonly decisionId: string;
  readonly decisionSha256: string;
  readonly retentionPolicyVersion: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly scope: ArtifactStorageScope;
  readonly providerObjectVersion: string;
  readonly objectBindingSha256: string;
  readonly objectSha256: string;
}

export interface ArtifactErasureDecisionVerifier {
  verifyDecision(input: {
    readonly eligibility: ArtifactErasureEligibility;
    readonly object: StoredArtifactObject;
    readonly now: Date;
  }): Promise<boolean>;
}

export interface VerifiedArtifactErasureEligibility extends ArtifactErasureEligibility {
  readonly [VERIFIED_ERASURE_ELIGIBILITY]: true;
}

export interface ArtifactTombstoneRequest {
  readonly contractVersion: typeof ARTIFACT_STORAGE_CONTRACT_VERSION;
  readonly capability: VerifiedArtifactCapability & { readonly purpose: "ERASURE" };
  readonly object: StoredArtifactObject;
  readonly eligibility: VerifiedArtifactErasureEligibility;
  readonly tombstoneEventKey: string;
}

export interface ArtifactTombstoneResult {
  readonly status: "OBJECT_DELETED" | "CRYPTO_SHREDDED" | "FAILED";
  readonly providerKey: string;
  readonly providerObjectVersion: string;
  readonly objectBindingSha256: string;
  readonly providerDeletionRef?: string;
  readonly replicaTombstoneEventKey?: string;
  readonly backupTombstoneEventKey?: string;
  readonly completedAt: string;
}

/**
 * Concrete providers remain swappable. Application code must invoke them only
 * through the exported dispatch functions, which reject provider mismatch and
 * invalid authority before provider I/O. Implementations must not return public
 * object URLs or expose provider locators to browsers, logs or event payloads.
 * `redeemReadGrantAtomically` must consume the grant in the same atomic operation
 * that authorizes the first read; subsequent calls return ALREADY_REDEEMED.
 * `tombstoneExactVersion` is called only after a fresh retention/legal-hold
 * decision is rechecked by the dispatcher. A concrete adapter must preserve that
 * decision boundary through its exact-version delete transaction.
 */
export interface ArtifactStorageProvider {
  readonly providerKey: string;
  putImmutable(request: ImmutableArtifactWriteRequest): Promise<StoredArtifactObject>;
  issueReadGrant(request: ArtifactReadGrantRequest): Promise<ArtifactReadGrant>;
  redeemReadGrantAtomically(request: ArtifactReadRedemptionRequest): Promise<ArtifactReadRedemptionResult>;
  verifyIntegrity(request: ArtifactIntegrityRequest): Promise<ArtifactIntegrityResult>;
  tombstoneExactVersion(request: ArtifactTombstoneRequest): Promise<ArtifactTombstoneResult>;
}

export type ArtifactProviderDispatchResult<T> =
  | { readonly dispatched: false; readonly errors: readonly ArtifactStorageContractErrorCode[] }
  | { readonly dispatched: true; readonly errors: readonly []; readonly result: T };

export type ArtifactStorageContractErrorCode =
  | "INVALID_CONTRACT_VERSION"
  | "INVALID_SCOPE"
  | "INVALID_CAPABILITY"
  | "INVALID_SHA256"
  | "CONTENT_DIGEST_MISMATCH"
  | "INVALID_BYTE_LENGTH"
  | "CONTENT_LENGTH_MISMATCH"
  | "CONTENT_TOO_LARGE"
  | "CONTENT_KIND_MISMATCH"
  | "INVALID_MIME_TYPE"
  | "INVALID_IDEMPOTENCY_KEY"
  | "INVALID_SOURCE_BINDING"
  | "CREATE_ONLY_REQUIRED"
  | "INVALID_AAD_VERSION"
  | "IMMUTABILITY_REQUIRED"
  | "SERVER_SIDE_ENCRYPTION_REQUIRED"
  | "INVALID_PROVIDER_KEY"
  | "INVALID_OBJECT_VERSION"
  | "INVALID_PROVIDER_LOCATOR"
  | "PUBLIC_URL_FORBIDDEN"
  | "INVALID_ENCRYPTION_RECEIPT"
  | "INVALID_STORED_OBJECT"
  | "INVALID_GRANT_TTL"
  | "INVALID_GRANT"
  | "SINGLE_USE_REQUIRED"
  | "GRANT_REPLAY_NOT_ENFORCED"
  | "INVALID_INTEGRITY_RESULT"
  | "RETENTION_NOT_ELIGIBLE"
  | "LEGAL_HOLD_ACTIVE"
  | "REPLICA_TOMBSTONE_REQUIRED"
  | "BACKUP_TOMBSTONE_REQUIRED"
  | "INVALID_ERASURE_DECISION"
  | "INVALID_TOMBSTONE_RESULT";

const SHA256 = /^[0-9a-f]{64}$/;
const URI_SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const PROTOCOL_RELATIVE_URI = /^[\\/]{2}/;
const ASCII_CONTROL = /[\u0000-\u001f\u007f]/;
const READ_PURPOSES = ["PREVIEW", "DOWNLOAD", "PRINT", "FULFILLMENT", "EXPORT"] as const;
const APPROVED_ENCRYPTION_ALGORITHMS = ["AES-256-GCM", "PROVIDER-SSE-KMS"] as const;
const MIME_BY_KIND: Readonly<Record<ArtifactContentKind, string>> = Object.freeze({
  PDF: "application/pdf",
  PNG: "image/png",
  JPEG: "image/jpeg",
  TIFF: "image/tiff",
});

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validIsoInstant(value: unknown): boolean {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function validScope(scope: ArtifactStorageScope): boolean {
  return (
    nonEmpty(scope.tenantId) &&
    nonEmpty(scope.consumerId) &&
    nonEmpty(scope.reportVersionId) &&
    nonEmpty(scope.caseId) &&
    nonEmpty(scope.artifactId) &&
    Number.isSafeInteger(scope.artifactVersion) &&
    scope.artifactVersion > 0
  );
}

function sameScope(left: ArtifactStorageScope, right: ArtifactStorageScope): boolean {
  return (
    left.tenantId === right.tenantId &&
    left.consumerId === right.consumerId &&
    left.reportVersionId === right.reportVersionId &&
    left.caseId === right.caseId &&
    left.artifactId === right.artifactId &&
    left.artifactVersion === right.artifactVersion
  );
}

function immutableScopeSnapshot(scope: ArtifactStorageScope): ArtifactStorageScope {
  return Object.freeze({
    tenantId: scope.tenantId,
    consumerId: scope.consumerId,
    reportVersionId: scope.reportVersionId,
    caseId: scope.caseId,
    artifactId: scope.artifactId,
    artifactVersion: scope.artifactVersion,
  });
}

function immutableStoredObjectSnapshot(object: StoredArtifactObject): StoredArtifactObject {
  return Object.freeze({
    ...object,
    scope: immutableScopeSnapshot(object.scope),
    encryption: Object.freeze({ ...object.encryption }),
  });
}

function capabilityBindingSha256(capability: AuthorizedArtifactCapability): string {
  return sha256Utf8(
    JSON.stringify([
      capability.authorizationDecisionId,
      capability.actorId,
      capability.purpose,
      computeArtifactScopeSha256(capability.scope),
      capability.issuedAt,
      capability.expiresAt,
    ])
  );
}

function sourceVerificationSha256(
  binding: ArtifactSourceBinding,
  scope: ArtifactStorageScope,
  purpose: ArtifactAccessPurpose
): string {
  return sha256Utf8(
    JSON.stringify([
      computeArtifactSourceBindingSha256(binding),
      computeArtifactScopeSha256(scope),
      purpose,
    ])
  );
}

function grantBindingSha256(grant: ArtifactReadGrant): string {
  return sha256Utf8(
    JSON.stringify([
      grant.brokerGrantId,
      grant.brokerGrantToken,
      grant.tokenFormat,
      computeArtifactScopeSha256(grant.scope),
      grant.purpose,
      grant.providerKey,
      grant.providerObjectVersion,
      grant.objectBindingSha256,
      grant.expectedSha256,
      grant.expectedByteLength,
      grant.issuedAt,
      grant.expiresAt,
      grant.singleUse,
    ])
  );
}

function erasureBindingSha256(eligibility: ArtifactErasureEligibility): string {
  return sha256Utf8(
    JSON.stringify([
      eligibility.retentionDecision,
      eligibility.legalHoldStatus,
      eligibility.replicaDisposition,
      eligibility.backupDisposition,
      eligibility.decisionId,
      eligibility.decisionSha256,
      eligibility.retentionPolicyVersion,
      eligibility.issuedAt,
      eligibility.expiresAt,
      computeArtifactScopeSha256(eligibility.scope),
      eligibility.providerObjectVersion,
      eligibility.objectBindingSha256,
      eligibility.objectSha256,
    ])
  );
}

function validAuthorizedCapabilityMetadata(
  capability: AuthorizedArtifactCapability,
  scope: ArtifactStorageScope,
  now: Date,
  allowedPurposes: readonly ArtifactAccessPurpose[]
): boolean {
  const issuedAt = Date.parse(capability.issuedAt);
  const expiresAt = Date.parse(capability.expiresAt);
  return (
    validScope(capability.scope) &&
    sameScope(capability.scope, scope) &&
    nonEmpty(capability.actorId) &&
    nonEmpty(capability.authorizationDecisionId) &&
    Number.isFinite(issuedAt) &&
    Number.isFinite(expiresAt) &&
    issuedAt <= now.getTime() &&
    expiresAt > issuedAt &&
    expiresAt > now.getTime() &&
    allowedPurposes.includes(capability.purpose)
  );
}

function validCapability(
  capability: VerifiedArtifactCapability,
  scope: ArtifactStorageScope,
  now: Date,
  allowedPurposes: readonly ArtifactAccessPurpose[]
): boolean {
  if (
    !verifiedCapabilityIdentities.has(capability) ||
    capability[VERIFIED_ARTIFACT_CAPABILITY] !== true ||
    !capability.scope ||
    !Object.isFrozen(capability) ||
    !Object.isFrozen(capability.scope)
  ) {
    return false;
  }
  const currentBindingDigest = capabilityBindingSha256(capability);
  return (
    SHA256.test(capability.decisionSha256) &&
    capability.decisionSha256 === currentBindingDigest &&
    verifiedCapabilityBindingDigests.get(capability) === currentBindingDigest &&
    validAuthorizedCapabilityMetadata(capability, scope, now, allowedPurposes)
  );
}

function looksLikeUrl(value: string): boolean {
  const browserNormalized = value.trim().replace(/[\u0009\u000a\u000d]/g, "");
  return URI_SCHEME.test(browserNormalized) || PROTOCOL_RELATIVE_URI.test(browserNormalized);
}

function validOpaqueNotUrl(value: unknown): value is string {
  return nonEmpty(value) && !ASCII_CONTROL.test(value) && !looksLikeUrl(value);
}

function sha256Utf8(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function validSourceBindingShape(binding: ArtifactSourceBinding): boolean {
  return (
    ["APPROVED_CANONICAL", "APPROVED_ENCLOSURE", "INGESTED_RESPONSE"].includes(binding.kind) &&
    nonEmpty(binding.decisionId) &&
    nonEmpty(binding.sourceVersionId) &&
    SHA256.test(binding.sourceInputSha256) &&
    nonEmpty(binding.policyVersion)
  );
}

function validVerifiedSourceBinding(
  binding: VerifiedArtifactSourceBinding,
  expectedScope: ArtifactStorageScope,
  expectedPurpose: ArtifactAccessPurpose
): boolean {
  if (
    !verifiedSourceIdentities.has(binding) ||
    binding[VERIFIED_ARTIFACT_SOURCE] !== true ||
    !binding.authorizedScope ||
    !Object.isFrozen(binding) ||
    !Object.isFrozen(binding.authorizedScope)
  ) {
    return false;
  }
  const currentBindingDigest = sourceVerificationSha256(binding, binding.authorizedScope, binding.authorizedPurpose);
  return (
    validSourceBindingShape(binding) &&
    sameScope(binding.authorizedScope, expectedScope) &&
    binding.authorizedPurpose === expectedPurpose &&
    binding.verificationSha256 === currentBindingDigest &&
    verifiedSourceBindingDigests.get(binding) === currentBindingDigest
  );
}

function validVerifiedGrant(grant: VerifiedArtifactReadGrant): boolean {
  if (
    !verifiedGrantIdentities.has(grant) ||
    grant[VERIFIED_ARTIFACT_GRANT] !== true ||
    !grant.scope ||
    !Object.isFrozen(grant) ||
    !Object.isFrozen(grant.scope)
  ) {
    return false;
  }
  const currentBindingDigest = grantBindingSha256(grant);
  return verifiedGrantBindingDigests.get(grant) === currentBindingDigest;
}

function validVerifiedErasureEligibility(
  eligibility: VerifiedArtifactErasureEligibility,
  now: Date
): boolean {
  if (
    !verifiedErasureIdentities.has(eligibility) ||
    eligibility[VERIFIED_ERASURE_ELIGIBILITY] !== true ||
    !eligibility.scope ||
    !Object.isFrozen(eligibility) ||
    !Object.isFrozen(eligibility.scope)
  ) {
    return false;
  }
  const currentBindingDigest = erasureBindingSha256(eligibility);
  const issuedAt = Date.parse(eligibility.issuedAt);
  const expiresAt = Date.parse(eligibility.expiresAt);
  return (
    verifiedErasureBindingDigests.get(eligibility) === currentBindingDigest &&
    Number.isFinite(issuedAt) &&
    Number.isFinite(expiresAt) &&
    issuedAt <= now.getTime() &&
    expiresAt > now.getTime() &&
    expiresAt > issuedAt &&
    expiresAt - issuedAt <= MAX_ARTIFACT_ERASURE_DECISION_SECONDS * 1000
  );
}

function sourceBindingMatchesPurpose(
  binding: ArtifactSourceBinding,
  purpose: ArtifactAccessPurpose
): boolean {
  return (
    (purpose === "STORE_CANONICAL" && binding.kind === "APPROVED_CANONICAL") ||
    (purpose === "STORE_ENCLOSURE" && binding.kind === "APPROVED_ENCLOSURE") ||
    (purpose === "STORE_RESPONSE" && binding.kind === "INGESTED_RESPONSE")
  );
}

function startsWithBytes(content: Uint8Array, bytes: readonly number[]): boolean {
  return content.byteLength >= bytes.length && bytes.every((byte, index) => content[index] === byte);
}

function contentMatchesKind(content: Uint8Array, kind: ArtifactContentKind): boolean {
  if (kind === "PDF") return startsWithBytes(content, [0x25, 0x50, 0x44, 0x46, 0x2d]);
  if (kind === "PNG") return startsWithBytes(content, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (kind === "JPEG") return startsWithBytes(content, [0xff, 0xd8, 0xff]);
  return startsWithBytes(content, [0x49, 0x49, 0x2a, 0x00]) || startsWithBytes(content, [0x4d, 0x4d, 0x00, 0x2a]);
}

export function computeArtifactScopeSha256(scope: ArtifactStorageScope): string {
  return sha256Utf8(
    JSON.stringify([
      scope.tenantId,
      scope.consumerId,
      scope.reportVersionId,
      scope.caseId,
      scope.artifactId,
      scope.artifactVersion,
    ])
  );
}

export function computeArtifactSourceBindingSha256(binding: ArtifactSourceBinding): string {
  return sha256Utf8(
    JSON.stringify([
      binding.kind,
      binding.decisionId,
      binding.sourceVersionId,
      binding.sourceInputSha256,
      binding.policyVersion,
    ])
  );
}

export function computeStoredArtifactObjectBindingSha256(object: StoredArtifactObject): string {
  return sha256Utf8(
    JSON.stringify([
      computeArtifactScopeSha256(object.scope),
      object.providerKey,
      object.providerObjectVersion,
      sha256Utf8(object.providerLocatorOpaque),
      object.sha256,
      object.byteLength,
      object.contentKind,
      object.mimeType,
      object.sourceBindingSha256,
      object.encryption.serverSideEncrypted,
      object.encryption.algorithm,
      sha256Utf8(object.encryption.keyReferenceOpaque),
      object.encryption.keyVersion,
      object.encryption.aadVersion,
      object.encryption.encryptionContextSha256,
      object.writeDisposition,
      object.immutable,
    ])
  );
}

export function computeArtifactIdempotencyKey(scope: ArtifactStorageScope, contentSha256: string): string {
  return sha256Utf8(`${computeArtifactScopeSha256(scope)}:${contentSha256}`);
}

export function validateArtifactProviderSelection(
  selectedProviderKey: string,
  boundProviderKey: string
): ArtifactStorageContractErrorCode[] {
  return nonEmpty(selectedProviderKey) && nonEmpty(boundProviderKey) && selectedProviderKey === boundProviderKey
    ? []
    : ["INVALID_PROVIDER_KEY"];
}

export async function verifyArtifactCapability(
  capability: AuthorizedArtifactCapability,
  expectedScope: ArtifactStorageScope,
  allowedPurposes: readonly ArtifactAccessPurpose[],
  now: Date,
  verifier: ArtifactAuthorizationDecisionVerifier
): Promise<VerifiedArtifactCapability | null> {
  const capabilitySnapshot = Object.freeze({
    ...capability,
    scope: immutableScopeSnapshot(capability.scope),
  });
  const expectedScopeSnapshot = immutableScopeSnapshot(expectedScope);
  const allowedPurposesSnapshot = Object.freeze([...allowedPurposes]);
  if (!validAuthorizedCapabilityMetadata(capabilitySnapshot, expectedScopeSnapshot, now, allowedPurposesSnapshot)) {
    return null;
  }
  if (
    !(await verifier.verifyDecision({
      capability: capabilitySnapshot,
      expectedScope: expectedScopeSnapshot,
      allowedPurposes: allowedPurposesSnapshot,
      now,
    }))
  ) {
    return null;
  }
  const decisionSha256 = capabilityBindingSha256(capabilitySnapshot);
  const verified = {
    ...capabilitySnapshot,
    scope: capabilitySnapshot.scope,
    decisionSha256,
  } as VerifiedArtifactCapability;
  Object.defineProperty(verified, VERIFIED_ARTIFACT_CAPABILITY, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  verifiedCapabilityIdentities.add(verified);
  verifiedCapabilityBindingDigests.set(verified, decisionSha256);
  return Object.freeze(verified);
}

export async function verifyArtifactSourceBinding(
  sourceBinding: ArtifactSourceBinding,
  scope: ArtifactStorageScope,
  purpose: ArtifactAccessPurpose,
  verifier: ArtifactSourceDecisionVerifier
): Promise<VerifiedArtifactSourceBinding | null> {
  const sourceBindingSnapshot = Object.freeze({ ...sourceBinding });
  const scopeSnapshot = immutableScopeSnapshot(scope);
  if (
    !validScope(scopeSnapshot) ||
    !validSourceBindingShape(sourceBindingSnapshot) ||
    !sourceBindingMatchesPurpose(sourceBindingSnapshot, purpose)
  ) {
    return null;
  }
  if (!(await verifier.verifyDecision({ sourceBinding: sourceBindingSnapshot, scope: scopeSnapshot, purpose }))) return null;
  const verificationSha256 = sourceVerificationSha256(sourceBindingSnapshot, scopeSnapshot, purpose);
  const verified = {
    ...sourceBindingSnapshot,
    authorizedScope: scopeSnapshot,
    authorizedPurpose: purpose,
    verificationSha256,
  } as VerifiedArtifactSourceBinding;
  Object.defineProperty(verified, VERIFIED_ARTIFACT_SOURCE, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  verifiedSourceIdentities.add(verified);
  verifiedSourceBindingDigests.set(verified, verificationSha256);
  return Object.freeze(verified);
}

function storedObjectErrors(object: StoredArtifactObject, expectedScope?: ArtifactStorageScope): ArtifactStorageContractErrorCode[] {
  const errors: ArtifactStorageContractErrorCode[] = [];
  if (!validScope(object.scope) || (expectedScope && !sameScope(object.scope, expectedScope))) errors.push("INVALID_SCOPE");
  if (!nonEmpty(object.providerKey)) errors.push("INVALID_PROVIDER_KEY");
  if (!nonEmpty(object.providerObjectVersion)) errors.push("INVALID_OBJECT_VERSION");
  if (!nonEmpty(object.providerLocatorOpaque)) errors.push("INVALID_PROVIDER_LOCATOR");
  else if (!validOpaqueNotUrl(object.providerLocatorOpaque)) errors.push("PUBLIC_URL_FORBIDDEN");
  if (!SHA256.test(object.sha256)) errors.push("INVALID_SHA256");
  if (!Number.isSafeInteger(object.byteLength) || object.byteLength < 1) errors.push("INVALID_BYTE_LENGTH");
  if (!nonEmpty(object.mimeType) || MIME_BY_KIND[object.contentKind] !== object.mimeType) errors.push("INVALID_MIME_TYPE");
  if (!SHA256.test(object.sourceBindingSha256)) errors.push("INVALID_SOURCE_BINDING");
  if (
    object.immutable !== true ||
    !["CREATED", "IDEMPOTENT_REPLAY"].includes(object.writeDisposition) ||
    object.encryption?.serverSideEncrypted !== true ||
    !APPROVED_ENCRYPTION_ALGORITHMS.includes(
      object.encryption.algorithm as (typeof APPROVED_ENCRYPTION_ALGORITHMS)[number]
    ) ||
    !validOpaqueNotUrl(object.encryption.keyReferenceOpaque) ||
    !nonEmpty(object.encryption.keyVersion) ||
    !nonEmpty(object.encryption.aadVersion) ||
    object.encryption.encryptionContextSha256 !== computeArtifactScopeSha256(object.scope)
  ) {
    errors.push("INVALID_ENCRYPTION_RECEIPT");
  }
  return errors;
}

export function computeArtifactSha256(content: Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}

export function validateImmutableArtifactWrite(
  request: ImmutableArtifactWriteRequest,
  now: Date
): ArtifactStorageContractErrorCode[] {
  const errors: ArtifactStorageContractErrorCode[] = [];
  if (request.contractVersion !== ARTIFACT_STORAGE_CONTRACT_VERSION) errors.push("INVALID_CONTRACT_VERSION");
  if (!nonEmpty(request.selectedProviderKey)) errors.push("INVALID_PROVIDER_KEY");
  if (!validScope(request.scope)) errors.push("INVALID_SCOPE");
  if (
    !validCapability(request.capability, request.scope, now, [
      "STORE_CANONICAL",
      "STORE_ENCLOSURE",
      "STORE_RESPONSE",
    ])
  ) {
    errors.push("INVALID_CAPABILITY");
  }
  if (!SHA256.test(request.sha256)) errors.push("INVALID_SHA256");
  else if (computeArtifactSha256(request.content) !== request.sha256) errors.push("CONTENT_DIGEST_MISMATCH");
  if (!Number.isSafeInteger(request.byteLength) || request.byteLength < 1) errors.push("INVALID_BYTE_LENGTH");
  if (request.byteLength > MAX_ARTIFACT_BYTES) errors.push("CONTENT_TOO_LARGE");
  if (request.content.byteLength !== request.byteLength) errors.push("CONTENT_LENGTH_MISMATCH");
  if (!contentMatchesKind(request.content, request.contentKind)) errors.push("CONTENT_KIND_MISMATCH");
  if (!nonEmpty(request.mimeType) || MIME_BY_KIND[request.contentKind] !== request.mimeType) {
    errors.push("INVALID_MIME_TYPE");
  }
  if (request.idempotencyKey !== computeArtifactIdempotencyKey(request.scope, request.sha256)) {
    errors.push("INVALID_IDEMPOTENCY_KEY");
  }
  if (
    !validVerifiedSourceBinding(request.sourceBinding, request.scope, request.capability.purpose) ||
    !sourceBindingMatchesPurpose(request.sourceBinding, request.capability.purpose)
  ) {
    errors.push("INVALID_SOURCE_BINDING");
  }
  if (request.writeMode !== "CREATE_EXACT_VERSION_ONLY") errors.push("CREATE_ONLY_REQUIRED");
  if (!nonEmpty(request.aadVersion)) errors.push("INVALID_AAD_VERSION");
  if (request.immutability !== "REQUIRED") errors.push("IMMUTABILITY_REQUIRED");
  if (request.serverSideEncryption !== "REQUIRED") errors.push("SERVER_SIDE_ENCRYPTION_REQUIRED");
  return [...new Set(errors)];
}

export function validateStoredArtifactObject(
  request: ImmutableArtifactWriteRequest,
  object: StoredArtifactObject,
  expectedProviderKey: string
): ArtifactStorageContractErrorCode[] {
  const errors = storedObjectErrors(object, request.scope);
  if (!nonEmpty(expectedProviderKey) || object.providerKey !== expectedProviderKey) {
    errors.push("INVALID_PROVIDER_KEY");
  }
  if (
    object.sha256 !== request.sha256 ||
    object.byteLength !== request.byteLength ||
    object.contentKind !== request.contentKind ||
    object.mimeType !== request.mimeType ||
    object.sourceBindingSha256 !== computeArtifactSourceBindingSha256(request.sourceBinding) ||
    object.encryption.aadVersion !== request.aadVersion
  ) {
    errors.push("INVALID_STORED_OBJECT");
  }
  return [...new Set(errors)];
}

export function validateArtifactReadGrantRequest(
  request: ArtifactReadGrantRequest,
  now: Date
): ArtifactStorageContractErrorCode[] {
  const errors: ArtifactStorageContractErrorCode[] = [];
  if (request.contractVersion !== ARTIFACT_STORAGE_CONTRACT_VERSION) errors.push("INVALID_CONTRACT_VERSION");
  errors.push(...storedObjectErrors(request.object, request.capability.scope));
  const expiresAt = Date.parse(request.capability.expiresAt);
  if (
    !validCapability(request.capability, request.object.scope, now, READ_PURPOSES)
  ) {
    errors.push("INVALID_CAPABILITY");
  }
  if (
    !Number.isSafeInteger(request.expiresInSeconds) ||
    request.expiresInSeconds < 1 ||
    request.expiresInSeconds > MAX_ARTIFACT_READ_GRANT_SECONDS ||
    now.getTime() + request.expiresInSeconds * 1000 > expiresAt
  ) {
    errors.push("INVALID_GRANT_TTL");
  }
  if (request.singleUse !== true) errors.push("SINGLE_USE_REQUIRED");
  return [...new Set(errors)];
}

export function validateArtifactReadGrantResult(
  request: ArtifactReadGrantRequest,
  grant: ArtifactReadGrant,
  now: Date
): ArtifactStorageContractErrorCode[] {
  const errors: ArtifactStorageContractErrorCode[] = [...validateArtifactReadGrantRequest(request, now)];
  const issuedAt = Date.parse(grant.issuedAt);
  const expiresAt = Date.parse(grant.expiresAt);
  if (!nonEmpty(grant.brokerGrantId) || !validOpaqueNotUrl(grant.brokerGrantToken) || grant.tokenFormat !== "SIGNED_OPAQUE") {
    errors.push(looksLikeUrl(grant.brokerGrantToken) ? "PUBLIC_URL_FORBIDDEN" : "INVALID_GRANT");
  }
  if (
    !sameScope(grant.scope, request.object.scope) ||
    grant.purpose !== request.capability.purpose ||
    grant.providerKey !== request.object.providerKey ||
    grant.providerObjectVersion !== request.object.providerObjectVersion ||
    grant.objectBindingSha256 !== computeStoredArtifactObjectBindingSha256(request.object) ||
    grant.expectedSha256 !== request.object.sha256 ||
    grant.expectedByteLength !== request.object.byteLength
  ) {
    errors.push("INVALID_GRANT");
  }
  if (
    !Number.isFinite(issuedAt) ||
    !Number.isFinite(expiresAt) ||
    issuedAt > now.getTime() ||
    expiresAt <= now.getTime() ||
    expiresAt - issuedAt > request.expiresInSeconds * 1000 ||
    expiresAt > Date.parse(request.capability.expiresAt)
  ) {
    errors.push("INVALID_GRANT_TTL");
  }
  if (grant.singleUse !== true) errors.push("SINGLE_USE_REQUIRED");
  return [...new Set(errors)];
}

export async function verifyArtifactReadGrant(
  request: ArtifactReadGrantRequest,
  grant: ArtifactReadGrant,
  now: Date,
  verifier: ArtifactReadGrantSignatureVerifier
): Promise<VerifiedArtifactReadGrant | null> {
  const requestSnapshot = Object.freeze({
    ...request,
    object: immutableStoredObjectSnapshot(request.object),
  });
  const grantSnapshot = Object.freeze({
    ...grant,
    scope: immutableScopeSnapshot(grant.scope),
  });
  if (validateArtifactReadGrantResult(requestSnapshot, grantSnapshot, now).length > 0) return null;
  if (!(await verifier.verifyGrant({ request: requestSnapshot, grant: grantSnapshot, now }))) return null;
  const verified = {
    ...grantSnapshot,
    scope: grantSnapshot.scope,
  } as VerifiedArtifactReadGrant;
  Object.defineProperty(verified, VERIFIED_ARTIFACT_GRANT, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  verifiedGrantIdentities.add(verified);
  verifiedGrantBindingDigests.set(verified, grantBindingSha256(verified));
  return Object.freeze(verified);
}

export function validateArtifactReadRedemptionRequest(
  request: ArtifactReadRedemptionRequest,
  now: Date
): ArtifactStorageContractErrorCode[] {
  const errors: ArtifactStorageContractErrorCode[] = [];
  const grantIssuedAt = Date.parse(request.grant.issuedAt);
  const grantExpiresAt = Date.parse(request.grant.expiresAt);
  if (request.contractVersion !== ARTIFACT_STORAGE_CONTRACT_VERSION) errors.push("INVALID_CONTRACT_VERSION");
  if (
    !validVerifiedGrant(request.grant) ||
    !validCapability(request.capability, request.grant.scope, now, READ_PURPOSES) ||
    request.capability.purpose !== request.grant.purpose
  ) {
    errors.push("INVALID_CAPABILITY");
  }
  if (
    !validScope(request.grant.scope) ||
    !validOpaqueNotUrl(request.grant.brokerGrantToken) ||
    request.grant.tokenFormat !== "SIGNED_OPAQUE" ||
    !READ_PURPOSES.includes(request.grant.purpose as (typeof READ_PURPOSES)[number]) ||
    !Number.isFinite(grantIssuedAt) ||
    !Number.isFinite(grantExpiresAt) ||
    grantIssuedAt > now.getTime() ||
    grantExpiresAt <= now.getTime() ||
    request.grant.singleUse !== true
  ) {
    errors.push("INVALID_GRANT");
  }
  return [...new Set(errors)];
}

export function validateArtifactReadRedemption(
  request: ArtifactReadRedemptionRequest,
  result: ArtifactReadRedemptionResult,
  now: Date
): ArtifactStorageContractErrorCode[] {
  const errors: ArtifactStorageContractErrorCode[] = [...validateArtifactReadRedemptionRequest(request, now)];
  if (result.brokerGrantId !== request.grant.brokerGrantId) errors.push("INVALID_GRANT");
  if (
    result.providerKey !== request.grant.providerKey ||
    result.objectBindingSha256 !== request.grant.objectBindingSha256
  ) {
    errors.push("INVALID_PROVIDER_KEY");
  }
  if (
    !["REDEEMED", "ALREADY_REDEEMED", "EXPIRED", "DENIED"].includes(result.status) ||
    !validIsoInstant(result.redeemedAt)
  ) {
    errors.push("INVALID_GRANT");
  }
  if (result.status === "REDEEMED") {
    if (!result.singleUseConsumed) errors.push("GRANT_REPLAY_NOT_ENFORCED");
    if (!result.content || result.content.byteLength !== request.grant.expectedByteLength) {
      errors.push("CONTENT_LENGTH_MISMATCH");
    } else if (computeArtifactSha256(result.content) !== request.grant.expectedSha256) {
      errors.push("CONTENT_DIGEST_MISMATCH");
    }
    if (
      result.observedSha256 !== request.grant.expectedSha256 ||
      result.observedByteLength !== request.grant.expectedByteLength
    ) {
      errors.push("INVALID_GRANT");
    }
  } else if (result.content || result.observedSha256 || result.observedByteLength !== undefined) {
    errors.push("INVALID_GRANT");
  }
  if (result.status === "ALREADY_REDEEMED" && !result.singleUseConsumed) errors.push("GRANT_REPLAY_NOT_ENFORCED");
  return [...new Set(errors)];
}

export function validateArtifactIntegrityRequest(
  request: ArtifactIntegrityRequest,
  now: Date
): ArtifactStorageContractErrorCode[] {
  const errors: ArtifactStorageContractErrorCode[] = [];
  if (request.contractVersion !== ARTIFACT_STORAGE_CONTRACT_VERSION) errors.push("INVALID_CONTRACT_VERSION");
  errors.push(...storedObjectErrors(request.object, request.capability.scope));
  if (!validCapability(request.capability, request.object.scope, now, ["INTEGRITY_VERIFY"])) {
    errors.push("INVALID_CAPABILITY");
  }
  return [...new Set(errors)];
}

export function validateArtifactIntegrityResult(
  request: ArtifactIntegrityRequest,
  result: ArtifactIntegrityResult
): ArtifactStorageContractErrorCode[] {
  const exactObjectIdentity =
    result.providerKey === request.object.providerKey &&
    result.providerObjectVersion === request.object.providerObjectVersion &&
    result.objectBindingSha256 === computeStoredArtifactObjectBindingSha256(request.object);
  const contentMatches =
    result.observedSha256 === request.object.sha256 &&
    result.observedByteLength === request.object.byteLength;
  return exactObjectIdentity && contentMatches === result.matches && validIsoInstant(result.verifiedAt)
    ? []
    : ["INVALID_INTEGRITY_RESULT"];
}

function erasureEligibilityMatchesObject(
  eligibility: ArtifactErasureEligibility,
  object: StoredArtifactObject,
  now: Date
): boolean {
  const issuedAt = Date.parse(eligibility.issuedAt);
  const expiresAt = Date.parse(eligibility.expiresAt);
  return (
    eligibility.retentionDecision === "ERASURE_ELIGIBLE" &&
    eligibility.legalHoldStatus === "CLEAR" &&
    eligibility.replicaDisposition === "TOMBSTONE_PROPAGATION_REQUIRED" &&
    eligibility.backupDisposition === "TOMBSTONE_PROPAGATION_REQUIRED" &&
    nonEmpty(eligibility.decisionId) &&
    SHA256.test(eligibility.decisionSha256) &&
    nonEmpty(eligibility.retentionPolicyVersion) &&
    Number.isFinite(issuedAt) &&
    Number.isFinite(expiresAt) &&
    issuedAt <= now.getTime() &&
    expiresAt > now.getTime() &&
    expiresAt > issuedAt &&
    expiresAt - issuedAt <= MAX_ARTIFACT_ERASURE_DECISION_SECONDS * 1000 &&
    sameScope(eligibility.scope, object.scope) &&
    eligibility.providerObjectVersion === object.providerObjectVersion &&
    eligibility.objectBindingSha256 === computeStoredArtifactObjectBindingSha256(object) &&
    eligibility.objectSha256 === object.sha256
  );
}

export async function verifyArtifactErasureEligibility(
  eligibility: ArtifactErasureEligibility,
  object: StoredArtifactObject,
  now: Date,
  verifier: ArtifactErasureDecisionVerifier
): Promise<VerifiedArtifactErasureEligibility | null> {
  const eligibilitySnapshot = Object.freeze({
    ...eligibility,
    scope: immutableScopeSnapshot(eligibility.scope),
  });
  const objectSnapshot = immutableStoredObjectSnapshot(object);
  if (!erasureEligibilityMatchesObject(eligibilitySnapshot, objectSnapshot, now)) return null;
  if (!(await verifier.verifyDecision({ eligibility: eligibilitySnapshot, object: objectSnapshot, now }))) return null;
  const verified = {
    ...eligibilitySnapshot,
    scope: eligibilitySnapshot.scope,
  } as VerifiedArtifactErasureEligibility;
  Object.defineProperty(verified, VERIFIED_ERASURE_ELIGIBILITY, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  verifiedErasureIdentities.add(verified);
  verifiedErasureBindingDigests.set(verified, erasureBindingSha256(verified));
  return Object.freeze(verified);
}

export function validateArtifactTombstoneRequest(
  request: ArtifactTombstoneRequest,
  now: Date
): ArtifactStorageContractErrorCode[] {
  const errors: ArtifactStorageContractErrorCode[] = [];
  if (request.contractVersion !== ARTIFACT_STORAGE_CONTRACT_VERSION) errors.push("INVALID_CONTRACT_VERSION");
  errors.push(...storedObjectErrors(request.object, request.capability.scope));
  if (!validCapability(request.capability, request.object.scope, now, ["ERASURE"])) errors.push("INVALID_CAPABILITY");
  if (
    !validVerifiedErasureEligibility(request.eligibility, now) ||
    request.eligibility.objectBindingSha256 !== computeStoredArtifactObjectBindingSha256(request.object)
  ) {
    errors.push("INVALID_ERASURE_DECISION");
  }
  if (request.eligibility.retentionDecision !== "ERASURE_ELIGIBLE") errors.push("RETENTION_NOT_ELIGIBLE");
  if (request.eligibility.legalHoldStatus !== "CLEAR") errors.push("LEGAL_HOLD_ACTIVE");
  if (request.eligibility.replicaDisposition !== "TOMBSTONE_PROPAGATION_REQUIRED") {
    errors.push("REPLICA_TOMBSTONE_REQUIRED");
  }
  if (request.eligibility.backupDisposition !== "TOMBSTONE_PROPAGATION_REQUIRED") {
    errors.push("BACKUP_TOMBSTONE_REQUIRED");
  }
  if (
    !nonEmpty(request.eligibility.decisionId) ||
    !SHA256.test(request.eligibility.decisionSha256) ||
    !nonEmpty(request.eligibility.retentionPolicyVersion) ||
    !validIsoInstant(request.eligibility.issuedAt) ||
    !validIsoInstant(request.eligibility.expiresAt) ||
    !sameScope(request.eligibility.scope, request.object.scope) ||
    request.eligibility.providerObjectVersion !== request.object.providerObjectVersion ||
    request.eligibility.objectBindingSha256 !== computeStoredArtifactObjectBindingSha256(request.object) ||
    request.eligibility.objectSha256 !== request.object.sha256 ||
    !nonEmpty(request.tombstoneEventKey)
  ) {
    errors.push("INVALID_TOMBSTONE_RESULT");
  }
  return [...new Set(errors)];
}

export function validateArtifactTombstoneResult(
  request: ArtifactTombstoneRequest,
  result: ArtifactTombstoneResult
): ArtifactStorageContractErrorCode[] {
  const errors: ArtifactStorageContractErrorCode[] = [];
  if (!["OBJECT_DELETED", "CRYPTO_SHREDDED", "FAILED"].includes(result.status)) {
    errors.push("INVALID_TOMBSTONE_RESULT");
  }
  if (
    result.providerKey !== request.object.providerKey ||
    result.providerObjectVersion !== request.object.providerObjectVersion ||
    result.objectBindingSha256 !== computeStoredArtifactObjectBindingSha256(request.object) ||
    !validIsoInstant(result.completedAt) ||
    (result.providerDeletionRef !== undefined && !validOpaqueNotUrl(result.providerDeletionRef))
  ) {
    errors.push(result.providerDeletionRef && looksLikeUrl(result.providerDeletionRef) ? "PUBLIC_URL_FORBIDDEN" : "INVALID_TOMBSTONE_RESULT");
  }
  if (result.status !== "FAILED") {
    if (!nonEmpty(result.replicaTombstoneEventKey)) errors.push("REPLICA_TOMBSTONE_REQUIRED");
    if (!nonEmpty(result.backupTombstoneEventKey)) errors.push("BACKUP_TOMBSTONE_REQUIRED");
  }
  return [...new Set(errors)];
}

function deniedDispatch<T>(errors: readonly ArtifactStorageContractErrorCode[]): ArtifactProviderDispatchResult<T> {
  return { dispatched: false, errors: Object.freeze([...new Set(errors)]) };
}

function successfulDispatch<T>(result: T): ArtifactProviderDispatchResult<T> {
  return { dispatched: true, errors: [], result };
}

/**
 * These dispatch functions are the only approved Phase 1 path to a concrete
 * provider. They complete provider selection and request validation before the
 * first provider call, then validate and snapshot the provider result.
 */
export async function dispatchImmutableArtifactWrite(
  provider: ArtifactStorageProvider,
  request: ImmutableArtifactWriteRequest,
  now: Date
): Promise<ArtifactProviderDispatchResult<StoredArtifactObject>> {
  const selectedProviderKey = provider.providerKey;
  const requestSnapshot = Object.freeze({
    ...request,
    scope: immutableScopeSnapshot(request.scope),
    content: new Uint8Array(request.content),
  });
  const errors = [
    ...validateArtifactProviderSelection(selectedProviderKey, request.selectedProviderKey),
    ...validateImmutableArtifactWrite(requestSnapshot, now),
  ];
  if (errors.length > 0) return deniedDispatch(errors);

  const result = immutableStoredObjectSnapshot(await provider.putImmutable(requestSnapshot));
  const resultErrors = validateStoredArtifactObject(requestSnapshot, result, selectedProviderKey);
  return resultErrors.length > 0 ? deniedDispatch(resultErrors) : successfulDispatch(result);
}

export async function dispatchArtifactReadGrant(
  provider: ArtifactStorageProvider,
  request: ArtifactReadGrantRequest,
  now: Date
): Promise<ArtifactProviderDispatchResult<ArtifactReadGrant>> {
  const selectedProviderKey = provider.providerKey;
  const requestSnapshot = Object.freeze({
    ...request,
    object: immutableStoredObjectSnapshot(request.object),
  });
  const errors = [
    ...validateArtifactProviderSelection(selectedProviderKey, requestSnapshot.object.providerKey),
    ...validateArtifactReadGrantRequest(requestSnapshot, now),
  ];
  if (errors.length > 0) return deniedDispatch(errors);

  const rawResult = await provider.issueReadGrant(requestSnapshot);
  const result = Object.freeze({ ...rawResult, scope: immutableScopeSnapshot(rawResult.scope) });
  const resultErrors = validateArtifactReadGrantResult(requestSnapshot, result, now);
  return resultErrors.length > 0 ? deniedDispatch(resultErrors) : successfulDispatch(result);
}

export async function dispatchArtifactReadRedemption(
  provider: ArtifactStorageProvider,
  request: ArtifactReadRedemptionRequest,
  now: Date
): Promise<ArtifactProviderDispatchResult<ArtifactReadRedemptionResult>> {
  const selectedProviderKey = provider.providerKey;
  const requestSnapshot = Object.freeze({ ...request });
  const errors = [
    ...validateArtifactProviderSelection(selectedProviderKey, request.grant.providerKey),
    ...validateArtifactReadRedemptionRequest(requestSnapshot, now),
  ];
  if (errors.length > 0) return deniedDispatch(errors);

  const rawResult = await provider.redeemReadGrantAtomically(requestSnapshot);
  const result = Object.freeze({
    ...rawResult,
    content: rawResult.content ? new Uint8Array(rawResult.content) : undefined,
  });
  const resultErrors = validateArtifactReadRedemption(requestSnapshot, result, now);
  return resultErrors.length > 0 ? deniedDispatch(resultErrors) : successfulDispatch(result);
}

export async function dispatchArtifactIntegrityVerification(
  provider: ArtifactStorageProvider,
  request: ArtifactIntegrityRequest,
  now: Date
): Promise<ArtifactProviderDispatchResult<ArtifactIntegrityResult>> {
  const selectedProviderKey = provider.providerKey;
  const requestSnapshot = Object.freeze({
    ...request,
    object: immutableStoredObjectSnapshot(request.object),
  });
  const errors = [
    ...validateArtifactProviderSelection(selectedProviderKey, requestSnapshot.object.providerKey),
    ...validateArtifactIntegrityRequest(requestSnapshot, now),
  ];
  if (errors.length > 0) return deniedDispatch(errors);

  const result = Object.freeze({ ...(await provider.verifyIntegrity(requestSnapshot)) });
  const resultErrors = validateArtifactIntegrityResult(requestSnapshot, result);
  return resultErrors.length > 0 ? deniedDispatch(resultErrors) : successfulDispatch(result);
}

export async function dispatchArtifactTombstone(
  provider: ArtifactStorageProvider,
  request: ArtifactTombstoneRequest,
  now: Date,
  verifier: ArtifactErasureDecisionVerifier
): Promise<ArtifactProviderDispatchResult<ArtifactTombstoneResult>> {
  const selectedProviderKey = provider.providerKey;
  const requestSnapshot = Object.freeze({
    ...request,
    object: immutableStoredObjectSnapshot(request.object),
  });
  const errors = [
    ...validateArtifactProviderSelection(selectedProviderKey, requestSnapshot.object.providerKey),
    ...validateArtifactTombstoneRequest(requestSnapshot, now),
  ];
  if (errors.length > 0) return deniedDispatch(errors);

  const liveDecisionApproved = await verifier.verifyDecision({
    eligibility: requestSnapshot.eligibility,
    object: requestSnapshot.object,
    now,
  });
  if (!liveDecisionApproved) return deniedDispatch(["INVALID_ERASURE_DECISION"]);

  const result = Object.freeze({ ...(await provider.tombstoneExactVersion(requestSnapshot)) });
  const resultErrors = validateArtifactTombstoneResult(requestSnapshot, result);
  return resultErrors.length > 0 ? deniedDispatch(resultErrors) : successfulDispatch(result);
}
