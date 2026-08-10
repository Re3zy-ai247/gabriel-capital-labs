import { createHash } from "node:crypto";

/**
 * Vendor-neutral canonical-artifact storage contract for the P0 bounded context.
 *
 * Phase 1 deliberately provides no concrete adapter and performs no external I/O.
 * A later adapter must sit behind the application authorization boundary and
 * persist provider binding fields only through the encrypted Artifact envelope.
 */

export const ARTIFACT_STORAGE_CONTRACT_VERSION = "artifact-storage-v1.1" as const;
export const MAX_ARTIFACT_READ_GRANT_SECONDS = 300 as const;
export const MAX_ARTIFACT_ERASURE_DECISION_SECONDS = 30 as const;
export const MAX_ARTIFACT_BYTES = 50 * 1024 * 1024;
export const MAX_ARTIFACT_AUTHORITY_MEMBERS = 256 as const;

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
export type ArtifactBureau = "EQUIFAX" | "EXPERIAN" | "TRANSUNION";

export interface ArtifactRecipientAuthority {
  readonly recipientId: string;
  readonly recipientKind: "CRA" | "NON_CRA";
  readonly bureau: ArtifactBureau | null;
}

export interface ArtifactAuthorityMember {
  readonly kind: "CORRESPONDENCE_VERSION" | "ENCLOSURE";
  readonly memberId: string;
  readonly ordinal: number;
  readonly sha256: string;
}

/**
 * Value-free domain authority that must survive provider persistence exactly.
 * The member IDs identify immutable correspondence/enclosure versions; their
 * ordered digest prevents a successful storage response from blessing a
 * substituted recipient, bureau, or membership set.
 */
export interface ArtifactAuthorityManifest {
  readonly recipient: ArtifactRecipientAuthority;
  readonly members: readonly ArtifactAuthorityMember[];
  readonly membershipSha256: string;
}

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
  readonly authorityManifest: ArtifactAuthorityManifest;
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
  readonly authorityManifestSha256: string;
  readonly encryption: ArtifactEncryptionReceipt;
  readonly writeDisposition: "CREATED" | "IDEMPOTENT_REPLAY";
  readonly immutable: true;
}

export interface ImmutableArtifactReadbackRequest {
  readonly contractVersion: typeof ARTIFACT_STORAGE_CONTRACT_VERSION;
  readonly capability: VerifiedArtifactCapability;
  readonly object: StoredArtifactObject;
  readonly expectedAuthorityManifestSha256: string;
}

export interface ImmutableArtifactReadbackResult {
  readonly object: StoredArtifactObject;
  readonly authorityManifest: ArtifactAuthorityManifest;
  readonly content: Uint8Array;
  readonly readAt: string;
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

interface ArtifactIntegrityResultIdentity {
  readonly providerKey: string;
  readonly providerObjectVersion: string;
  readonly objectBindingSha256: string;
  readonly observedSha256: string;
  readonly observedByteLength: number;
  readonly verifiedAt: string;
}

export interface ArtifactIntegrityVerifiedResult extends ArtifactIntegrityResultIdentity {
  readonly kind: "ARTIFACT_INTEGRITY_VERIFIED";
}

export type ArtifactIntegrityFailureCode =
  | "DIGEST_MISMATCH"
  | "BYTE_LENGTH_MISMATCH"
  | "DIGEST_AND_BYTE_LENGTH_MISMATCH";

export interface ArtifactIntegrityFailureResult extends ArtifactIntegrityResultIdentity {
  readonly kind: "ARTIFACT_INTEGRITY_FAILURE";
  readonly failure: {
    readonly code: ArtifactIntegrityFailureCode;
  };
}

/**
 * Integrity failure is deliberately not a boolean business-negative. Callers
 * must branch on the discriminant and cannot type it as Clean, absent,
 * unknown, uncertain, deleted, unsupported, or not-evaluated.
 */
export type ArtifactIntegrityResult = ArtifactIntegrityVerifiedResult | ArtifactIntegrityFailureResult;

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
  readBackImmutable(request: ImmutableArtifactReadbackRequest): Promise<ImmutableArtifactReadbackResult>;
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
  | "INVALID_AUTHORITY_MANIFEST"
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
  | "INVALID_PROVIDER_ADAPTER"
  | "INVALID_POST_WRITE_READBACK"
  | "MALFORMED_ARTIFACT_INPUT"
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
const ARTIFACT_BUREAUS = ["EQUIFAX", "EXPERIAN", "TRANSUNION"] as const;
const ARTIFACT_PURPOSES: readonly ArtifactAccessPurpose[] = [
  "STORE_CANONICAL",
  "STORE_ENCLOSURE",
  "STORE_RESPONSE",
  "PREVIEW",
  "DOWNLOAD",
  "PRINT",
  "FULFILLMENT",
  "EXPORT",
  "INTEGRITY_VERIFY",
  "ERASURE",
];
const MAX_ARTIFACT_MACHINE_STRING_LENGTH = 512;
const ISO_INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|([+-])(\d{2}):(\d{2}))$/;
const MIME_BY_KIND: Readonly<Record<ArtifactContentKind, string>> = Object.freeze({
  PDF: "application/pdf",
  PNG: "image/png",
  JPEG: "image/jpeg",
  TIFF: "image/tiff",
});

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(value: unknown, expectedKeys: readonly string[]): value is Record<string, unknown> {
  if (!isPlainRecord(value)) return false;
  const actualKeys = Object.keys(value);
  return actualKeys.length === expectedKeys.length && expectedKeys.every((key) => actualKeys.includes(key));
}

function nonEmpty(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= MAX_ARTIFACT_MACHINE_STRING_LENGTH &&
    value.trim().length > 0
  );
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return leap ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/** Strict RFC-3339-style instant: a real calendar value with an explicit zone. */
export function isStrictIsoInstant(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = ISO_INSTANT.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offsetHour = match[10] === undefined ? 0 : Number(match[10]);
  const offsetMinute = match[11] === undefined ? 0 : Number(match[11]);
  if (
    year < 1 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month) ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    offsetHour > 14 ||
    offsetMinute > 59 ||
    (offsetHour === 14 && offsetMinute !== 0)
  ) {
    return false;
  }
  // RFC 3339's -00:00 means "unknown local offset", not a proven instant.
  if (match[9] === "-" && offsetHour === 0 && offsetMinute === 0) return false;
  return Number.isFinite(Date.parse(value));
}

function strictInstantMs(value: unknown): number | null {
  return isStrictIsoInstant(value) ? Date.parse(value) : null;
}

function validNow(now: Date): boolean {
  return now instanceof Date && Number.isFinite(now.getTime());
}

const SCOPE_KEYS = ["tenantId", "consumerId", "reportVersionId", "caseId", "artifactId", "artifactVersion"] as const;

function validScope(scope: unknown): scope is ArtifactStorageScope {
  return (
    hasExactKeys(scope, SCOPE_KEYS) &&
    nonEmpty(scope.tenantId) &&
    nonEmpty(scope.consumerId) &&
    nonEmpty(scope.reportVersionId) &&
    nonEmpty(scope.caseId) &&
    nonEmpty(scope.artifactId) &&
    Number.isSafeInteger(scope.artifactVersion) &&
    (scope.artifactVersion as number) > 0
  );
}

function sameScope(left: unknown, right: unknown): boolean {
  return (
    validScope(left) &&
    validScope(right) &&
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

function immutableAuthorityManifestSnapshot(manifest: ArtifactAuthorityManifest): ArtifactAuthorityManifest {
  return Object.freeze({
    recipient: Object.freeze({ ...manifest.recipient }),
    members: Object.freeze(manifest.members.map((member) => Object.freeze({ ...member }))),
    membershipSha256: manifest.membershipSha256,
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

const AUTHORIZED_CAPABILITY_KEYS = [
  "scope",
  "purpose",
  "actorId",
  "authorizationDecisionId",
  "issuedAt",
  "expiresAt",
] as const;
const VERIFIED_CAPABILITY_KEYS = [...AUTHORIZED_CAPABILITY_KEYS, "decisionSha256"] as const;

function validAuthorizedCapabilityFields(
  capability: Record<string, unknown>,
  scope: ArtifactStorageScope,
  now: Date,
  allowedPurposes: readonly ArtifactAccessPurpose[]
): boolean {
  const issuedAt = strictInstantMs(capability.issuedAt);
  const expiresAt = strictInstantMs(capability.expiresAt);
  return (
    validScope(capability.scope) &&
    sameScope(capability.scope, scope) &&
    nonEmpty(capability.actorId) &&
    nonEmpty(capability.authorizationDecisionId) &&
    typeof capability.purpose === "string" &&
    ARTIFACT_PURPOSES.includes(capability.purpose as ArtifactAccessPurpose) &&
    issuedAt !== null &&
    expiresAt !== null &&
    validNow(now) &&
    issuedAt <= now.getTime() &&
    expiresAt > issuedAt &&
    expiresAt > now.getTime() &&
    allowedPurposes.includes(capability.purpose as ArtifactAccessPurpose)
  );
}

function validAuthorizedCapabilityMetadata(
  capability: unknown,
  scope: ArtifactStorageScope,
  now: Date,
  allowedPurposes: readonly ArtifactAccessPurpose[]
): capability is AuthorizedArtifactCapability {
  return (
    hasExactKeys(capability, AUTHORIZED_CAPABILITY_KEYS) &&
    validAuthorizedCapabilityFields(capability, scope, now, allowedPurposes)
  );
}

function validCapability(
  capability: unknown,
  scope: ArtifactStorageScope,
  now: Date,
  allowedPurposes: readonly ArtifactAccessPurpose[]
): capability is VerifiedArtifactCapability {
  if (
    !hasExactKeys(capability, VERIFIED_CAPABILITY_KEYS) ||
    !verifiedCapabilityIdentities.has(capability) ||
    (capability as unknown as VerifiedArtifactCapability)[VERIFIED_ARTIFACT_CAPABILITY] !== true ||
    !capability.scope ||
    !Object.isFrozen(capability) ||
    !Object.isFrozen(capability.scope)
  ) {
    return false;
  }
  const verified = capability as unknown as VerifiedArtifactCapability;
  const currentBindingDigest = capabilityBindingSha256(verified);
  return (
    typeof capability.decisionSha256 === "string" &&
    SHA256.test(capability.decisionSha256) &&
    capability.decisionSha256 === currentBindingDigest &&
    verifiedCapabilityBindingDigests.get(capability) === currentBindingDigest &&
    validAuthorizedCapabilityFields(capability, scope, now, allowedPurposes)
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

const SOURCE_BINDING_KEYS = ["kind", "decisionId", "sourceVersionId", "sourceInputSha256", "policyVersion"] as const;
const VERIFIED_SOURCE_BINDING_KEYS = [
  ...SOURCE_BINDING_KEYS,
  "authorizedScope",
  "authorizedPurpose",
  "verificationSha256",
] as const;

function validSourceBindingFields(binding: Record<string, unknown>): boolean {
  return (
    typeof binding.kind === "string" &&
    ["APPROVED_CANONICAL", "APPROVED_ENCLOSURE", "INGESTED_RESPONSE"].includes(binding.kind) &&
    nonEmpty(binding.decisionId) &&
    nonEmpty(binding.sourceVersionId) &&
    typeof binding.sourceInputSha256 === "string" &&
    SHA256.test(binding.sourceInputSha256) &&
    nonEmpty(binding.policyVersion)
  );
}

function validSourceBindingShape(binding: unknown): binding is ArtifactSourceBinding {
  return hasExactKeys(binding, SOURCE_BINDING_KEYS) && validSourceBindingFields(binding);
}

function validVerifiedSourceBinding(
  binding: unknown,
  expectedScope: ArtifactStorageScope,
  expectedPurpose: ArtifactAccessPurpose
): binding is VerifiedArtifactSourceBinding {
  if (
    !hasExactKeys(binding, VERIFIED_SOURCE_BINDING_KEYS) ||
    !validSourceBindingFields(binding) ||
    !verifiedSourceIdentities.has(binding) ||
    (binding as unknown as VerifiedArtifactSourceBinding)[VERIFIED_ARTIFACT_SOURCE] !== true ||
    !binding.authorizedScope ||
    !Object.isFrozen(binding) ||
    !Object.isFrozen(binding.authorizedScope)
  ) {
    return false;
  }
  const verified = binding as unknown as VerifiedArtifactSourceBinding;
  const currentBindingDigest = sourceVerificationSha256(verified, verified.authorizedScope, verified.authorizedPurpose);
  return (
    sameScope(binding.authorizedScope, expectedScope) &&
    binding.authorizedPurpose === expectedPurpose &&
    binding.verificationSha256 === currentBindingDigest &&
    verifiedSourceBindingDigests.get(binding) === currentBindingDigest
  );
}

const RECIPIENT_AUTHORITY_KEYS = ["recipientId", "recipientKind", "bureau"] as const;
const AUTHORITY_MEMBER_KEYS = ["kind", "memberId", "ordinal", "sha256"] as const;
const AUTHORITY_MANIFEST_KEYS = ["recipient", "members", "membershipSha256"] as const;

function validRecipientAuthority(value: unknown): value is ArtifactRecipientAuthority {
  if (!hasExactKeys(value, RECIPIENT_AUTHORITY_KEYS) || !nonEmpty(value.recipientId)) return false;
  if (value.recipientKind !== "CRA" && value.recipientKind !== "NON_CRA") return false;
  if (value.recipientKind === "CRA") {
    return typeof value.bureau === "string" && ARTIFACT_BUREAUS.includes(value.bureau as ArtifactBureau);
  }
  return value.bureau === null;
}

function validAuthorityMember(value: unknown): value is ArtifactAuthorityMember {
  return (
    hasExactKeys(value, AUTHORITY_MEMBER_KEYS) &&
    (value.kind === "CORRESPONDENCE_VERSION" || value.kind === "ENCLOSURE") &&
    nonEmpty(value.memberId) &&
    Number.isSafeInteger(value.ordinal) &&
    (value.ordinal as number) >= 0 &&
    typeof value.sha256 === "string" &&
    SHA256.test(value.sha256)
  );
}

function validAuthorityManifest(value: unknown): value is ArtifactAuthorityManifest {
  if (
    !hasExactKeys(value, AUTHORITY_MANIFEST_KEYS) ||
    !validRecipientAuthority(value.recipient) ||
    !Array.isArray(value.members) ||
    value.members.length < 1 ||
    value.members.length > MAX_ARTIFACT_AUTHORITY_MEMBERS ||
    typeof value.membershipSha256 !== "string" ||
    !SHA256.test(value.membershipSha256)
  ) {
    return false;
  }
  for (let index = 0; index < value.members.length; index += 1) {
    if (!Object.hasOwn(value.members, index) || !validAuthorityMember(value.members[index])) return false;
  }
  const memberIds = new Set<string>();
  const ordinals = new Set<number>();
  for (const member of value.members) {
    if (memberIds.has(member.memberId) || ordinals.has(member.ordinal)) return false;
    memberIds.add(member.memberId);
    ordinals.add(member.ordinal);
  }
  if (value.members.some((member, index) => member.ordinal !== index)) return false;
  return value.membershipSha256 === computeArtifactMembershipSha256(value.members);
}

const READ_GRANT_KEYS = [
  "brokerGrantId",
  "brokerGrantToken",
  "tokenFormat",
  "scope",
  "purpose",
  "providerKey",
  "providerObjectVersion",
  "objectBindingSha256",
  "expectedSha256",
  "expectedByteLength",
  "issuedAt",
  "expiresAt",
  "singleUse",
] as const;

function validVerifiedGrant(grant: unknown): grant is VerifiedArtifactReadGrant {
  if (
    !hasExactKeys(grant, READ_GRANT_KEYS) ||
    !verifiedGrantIdentities.has(grant) ||
    (grant as unknown as VerifiedArtifactReadGrant)[VERIFIED_ARTIFACT_GRANT] !== true ||
    !grant.scope ||
    !Object.isFrozen(grant) ||
    !Object.isFrozen(grant.scope)
  ) {
    return false;
  }
  const currentBindingDigest = grantBindingSha256(grant as unknown as ArtifactReadGrant);
  return verifiedGrantBindingDigests.get(grant) === currentBindingDigest;
}

const ERASURE_ELIGIBILITY_KEYS = [
  "retentionDecision",
  "legalHoldStatus",
  "replicaDisposition",
  "backupDisposition",
  "decisionId",
  "decisionSha256",
  "retentionPolicyVersion",
  "issuedAt",
  "expiresAt",
  "scope",
  "providerObjectVersion",
  "objectBindingSha256",
  "objectSha256",
] as const;

function validVerifiedErasureEligibility(
  eligibility: unknown,
  now: Date
): eligibility is VerifiedArtifactErasureEligibility {
  if (
    !hasExactKeys(eligibility, ERASURE_ELIGIBILITY_KEYS) ||
    !verifiedErasureIdentities.has(eligibility) ||
    (eligibility as unknown as VerifiedArtifactErasureEligibility)[VERIFIED_ERASURE_ELIGIBILITY] !== true ||
    !eligibility.scope ||
    !Object.isFrozen(eligibility) ||
    !Object.isFrozen(eligibility.scope)
  ) {
    return false;
  }
  const verified = eligibility as unknown as VerifiedArtifactErasureEligibility;
  const currentBindingDigest = erasureBindingSha256(verified);
  const issuedAt = strictInstantMs(eligibility.issuedAt);
  const expiresAt = strictInstantMs(eligibility.expiresAt);
  return (
    verifiedErasureBindingDigests.get(eligibility) === currentBindingDigest &&
    issuedAt !== null &&
    expiresAt !== null &&
    validNow(now) &&
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

export function computeArtifactMembershipSha256(members: readonly ArtifactAuthorityMember[]): string {
  return sha256Utf8(
    JSON.stringify(members.map((member) => [member.kind, member.memberId, member.ordinal, member.sha256]))
  );
}

export function computeArtifactAuthorityManifestSha256(manifest: ArtifactAuthorityManifest): string {
  return sha256Utf8(
    JSON.stringify([
      manifest.recipient.recipientId,
      manifest.recipient.recipientKind,
      manifest.recipient.bureau,
      manifest.membershipSha256,
      manifest.members.map((member) => [member.kind, member.memberId, member.ordinal, member.sha256]),
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
      object.authorityManifestSha256,
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
  if (
    !validScope(expectedScope) ||
    !Array.isArray(allowedPurposes) ||
    allowedPurposes.length < 1 ||
    allowedPurposes.length > ARTIFACT_PURPOSES.length ||
    !allowedPurposes.every((purpose) => ARTIFACT_PURPOSES.includes(purpose)) ||
    new Set(allowedPurposes).size !== allowedPurposes.length ||
    !validAuthorizedCapabilityMetadata(capability, expectedScope, now, allowedPurposes) ||
    typeof verifier?.verifyDecision !== "function"
  ) {
    return null;
  }
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
  if (
    !validSourceBindingShape(sourceBinding) ||
    !validScope(scope) ||
    !ARTIFACT_PURPOSES.includes(purpose) ||
    typeof verifier?.verifyDecision !== "function"
  ) {
    return null;
  }
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

const ENCRYPTION_RECEIPT_KEYS = [
  "serverSideEncrypted",
  "algorithm",
  "keyReferenceOpaque",
  "keyVersion",
  "aadVersion",
  "encryptionContextSha256",
] as const;
const STORED_OBJECT_KEYS = [
  "scope",
  "providerKey",
  "providerObjectVersion",
  "providerLocatorOpaque",
  "sha256",
  "byteLength",
  "contentKind",
  "mimeType",
  "sourceBindingSha256",
  "authorityManifestSha256",
  "encryption",
  "writeDisposition",
  "immutable",
] as const;

function validEncryptionReceipt(value: unknown, scope: ArtifactStorageScope): value is ArtifactEncryptionReceipt {
  return (
    hasExactKeys(value, ENCRYPTION_RECEIPT_KEYS) &&
    value.serverSideEncrypted === true &&
    typeof value.algorithm === "string" &&
    APPROVED_ENCRYPTION_ALGORITHMS.includes(value.algorithm as (typeof APPROVED_ENCRYPTION_ALGORITHMS)[number]) &&
    validOpaqueNotUrl(value.keyReferenceOpaque) &&
    nonEmpty(value.keyVersion) &&
    nonEmpty(value.aadVersion) &&
    value.encryptionContextSha256 === computeArtifactScopeSha256(scope)
  );
}

function storedObjectErrors(object: unknown, expectedScope?: ArtifactStorageScope): ArtifactStorageContractErrorCode[] {
  const errors: ArtifactStorageContractErrorCode[] = [];
  if (!hasExactKeys(object, STORED_OBJECT_KEYS)) return ["MALFORMED_ARTIFACT_INPUT", "INVALID_STORED_OBJECT"];
  if (!validScope(object.scope) || (expectedScope && !sameScope(object.scope, expectedScope))) errors.push("INVALID_SCOPE");
  if (!nonEmpty(object.providerKey)) errors.push("INVALID_PROVIDER_KEY");
  if (!nonEmpty(object.providerObjectVersion)) errors.push("INVALID_OBJECT_VERSION");
  if (!nonEmpty(object.providerLocatorOpaque)) errors.push("INVALID_PROVIDER_LOCATOR");
  else if (!validOpaqueNotUrl(object.providerLocatorOpaque)) errors.push("PUBLIC_URL_FORBIDDEN");
  if (typeof object.sha256 !== "string" || !SHA256.test(object.sha256)) errors.push("INVALID_SHA256");
  if (!Number.isSafeInteger(object.byteLength) || (object.byteLength as number) < 1) errors.push("INVALID_BYTE_LENGTH");
  if (
    typeof object.contentKind !== "string" ||
    !nonEmpty(object.mimeType) ||
    MIME_BY_KIND[object.contentKind as ArtifactContentKind] !== object.mimeType
  ) errors.push("INVALID_MIME_TYPE");
  if (typeof object.sourceBindingSha256 !== "string" || !SHA256.test(object.sourceBindingSha256)) {
    errors.push("INVALID_SOURCE_BINDING");
  }
  if (typeof object.authorityManifestSha256 !== "string" || !SHA256.test(object.authorityManifestSha256)) {
    errors.push("INVALID_AUTHORITY_MANIFEST");
  }
  if (
    object.immutable !== true ||
    (object.writeDisposition !== "CREATED" && object.writeDisposition !== "IDEMPOTENT_REPLAY") ||
    !validScope(object.scope) ||
    !validEncryptionReceipt(object.encryption, object.scope)
  ) {
    errors.push("INVALID_ENCRYPTION_RECEIPT");
  }
  return errors;
}

function validStoredObjectShape(object: unknown, expectedScope?: ArtifactStorageScope): object is StoredArtifactObject {
  return storedObjectErrors(object, expectedScope).length === 0;
}

export function computeArtifactSha256(content: Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}

const IMMUTABLE_WRITE_KEYS = [
  "contractVersion",
  "selectedProviderKey",
  "scope",
  "capability",
  "content",
  "sha256",
  "byteLength",
  "contentKind",
  "mimeType",
  "idempotencyKey",
  "sourceBinding",
  "authorityManifest",
  "writeMode",
  "immutability",
  "serverSideEncryption",
  "aadVersion",
] as const;

export function validateImmutableArtifactWrite(
  request: ImmutableArtifactWriteRequest,
  now: Date
): ArtifactStorageContractErrorCode[] {
  const errors: ArtifactStorageContractErrorCode[] = [];
  if (!hasExactKeys(request, IMMUTABLE_WRITE_KEYS)) return ["MALFORMED_ARTIFACT_INPUT"];
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
  if (typeof request.sha256 !== "string" || !SHA256.test(request.sha256)) errors.push("INVALID_SHA256");
  else if (!(request.content instanceof Uint8Array) || computeArtifactSha256(request.content) !== request.sha256) {
    errors.push("CONTENT_DIGEST_MISMATCH");
  }
  if (!Number.isSafeInteger(request.byteLength) || (request.byteLength as number) < 1) errors.push("INVALID_BYTE_LENGTH");
  if (typeof request.byteLength === "number" && request.byteLength > MAX_ARTIFACT_BYTES) errors.push("CONTENT_TOO_LARGE");
  if (!(request.content instanceof Uint8Array) || request.content.byteLength !== request.byteLength) {
    errors.push("CONTENT_LENGTH_MISMATCH");
  }
  if (
    !(request.content instanceof Uint8Array) ||
    typeof request.contentKind !== "string" ||
    !Object.hasOwn(MIME_BY_KIND, request.contentKind) ||
    !contentMatchesKind(request.content, request.contentKind as ArtifactContentKind)
  ) errors.push("CONTENT_KIND_MISMATCH");
  if (
    typeof request.contentKind !== "string" ||
    !nonEmpty(request.mimeType) ||
    MIME_BY_KIND[request.contentKind as ArtifactContentKind] !== request.mimeType
  ) {
    errors.push("INVALID_MIME_TYPE");
  }
  if (
    !validScope(request.scope) ||
    typeof request.sha256 !== "string" ||
    request.idempotencyKey !== computeArtifactIdempotencyKey(request.scope, request.sha256)
  ) {
    errors.push("INVALID_IDEMPOTENCY_KEY");
  }
  if (
    !validCapability(request.capability, request.scope, now, [
      "STORE_CANONICAL",
      "STORE_ENCLOSURE",
      "STORE_RESPONSE",
    ]) ||
    !validVerifiedSourceBinding(request.sourceBinding, request.scope, request.capability.purpose) ||
    !sourceBindingMatchesPurpose(request.sourceBinding, request.capability.purpose)
  ) {
    errors.push("INVALID_SOURCE_BINDING");
  }
  if (!validAuthorityManifest(request.authorityManifest)) errors.push("INVALID_AUTHORITY_MANIFEST");
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
  if (!hasExactKeys(request, IMMUTABLE_WRITE_KEYS)) return ["MALFORMED_ARTIFACT_INPUT"];
  const errors = storedObjectErrors(object, request.scope);
  if (!hasExactKeys(object, STORED_OBJECT_KEYS)) return [...new Set(errors)];
  const sourceBindingSha256 =
    hasExactKeys(request.sourceBinding, VERIFIED_SOURCE_BINDING_KEYS) && validSourceBindingFields(request.sourceBinding)
      ? computeArtifactSourceBindingSha256(request.sourceBinding as unknown as ArtifactSourceBinding)
      : null;
  const authorityManifestSha256 = validAuthorityManifest(request.authorityManifest)
    ? computeArtifactAuthorityManifestSha256(request.authorityManifest)
    : null;
  if (!nonEmpty(expectedProviderKey) || object.providerKey !== expectedProviderKey) {
    errors.push("INVALID_PROVIDER_KEY");
  }
  if (
    object.sha256 !== request.sha256 ||
    object.byteLength !== request.byteLength ||
    object.contentKind !== request.contentKind ||
    object.mimeType !== request.mimeType ||
    sourceBindingSha256 === null ||
    object.sourceBindingSha256 !== sourceBindingSha256 ||
    authorityManifestSha256 === null ||
    object.authorityManifestSha256 !== authorityManifestSha256 ||
    !validEncryptionReceipt(object.encryption, object.scope) ||
    object.encryption.aadVersion !== request.aadVersion
  ) {
    errors.push("INVALID_STORED_OBJECT");
  }
  return [...new Set(errors)];
}

const IMMUTABLE_READBACK_REQUEST_KEYS = [
  "contractVersion",
  "capability",
  "object",
  "expectedAuthorityManifestSha256",
] as const;
const IMMUTABLE_READBACK_RESULT_KEYS = ["object", "authorityManifest", "content", "readAt"] as const;

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  return left.every((byte, index) => byte === right[index]);
}

function validateImmutableArtifactReadbackRequest(
  request: unknown,
  now: Date
): ArtifactStorageContractErrorCode[] {
  if (!hasExactKeys(request, IMMUTABLE_READBACK_REQUEST_KEYS)) return ["MALFORMED_ARTIFACT_INPUT"];
  const errors: ArtifactStorageContractErrorCode[] = [];
  if (request.contractVersion !== ARTIFACT_STORAGE_CONTRACT_VERSION) errors.push("INVALID_CONTRACT_VERSION");
  const objectErrors = storedObjectErrors(request.object);
  errors.push(...objectErrors);
  if (
    !validStoredObjectShape(request.object) ||
    !validCapability(request.capability, request.object.scope, now, [
      "STORE_CANONICAL",
      "STORE_ENCLOSURE",
      "STORE_RESPONSE",
    ])
  ) {
    errors.push("INVALID_CAPABILITY");
  }
  if (
    typeof request.expectedAuthorityManifestSha256 !== "string" ||
    !SHA256.test(request.expectedAuthorityManifestSha256) ||
    (validStoredObjectShape(request.object) &&
      request.object.authorityManifestSha256 !== request.expectedAuthorityManifestSha256)
  ) {
    errors.push("INVALID_AUTHORITY_MANIFEST");
  }
  return [...new Set(errors)];
}

export function validateImmutableArtifactReadback(
  writeRequest: ImmutableArtifactWriteRequest,
  firstResult: StoredArtifactObject,
  readback: ImmutableArtifactReadbackResult,
  expectedProviderKey: string,
  now: Date
): ArtifactStorageContractErrorCode[] {
  const errors: ArtifactStorageContractErrorCode[] = [];
  if (!hasExactKeys(writeRequest, IMMUTABLE_WRITE_KEYS)) return ["MALFORMED_ARTIFACT_INPUT"];
  const writeErrors = validateImmutableArtifactWrite(writeRequest, now);
  if (writeErrors.length > 0) return [...new Set([...writeErrors, "INVALID_POST_WRITE_READBACK"] as const)];
  if (!validStoredObjectShape(firstResult, writeRequest.scope)) {
    return ["MALFORMED_ARTIFACT_INPUT", "INVALID_POST_WRITE_READBACK"];
  }
  if (!hasExactKeys(readback, IMMUTABLE_READBACK_RESULT_KEYS)) {
    return ["MALFORMED_ARTIFACT_INPUT", "INVALID_POST_WRITE_READBACK"];
  }
  errors.push(...validateStoredArtifactObject(writeRequest, readback.object as StoredArtifactObject, expectedProviderKey));
  if (!validStoredObjectShape(readback.object, writeRequest.scope)) {
    errors.push("INVALID_POST_WRITE_READBACK");
    return [...new Set(errors)];
  }
  if (
    computeStoredArtifactObjectBindingSha256(readback.object as unknown as StoredArtifactObject) !==
    computeStoredArtifactObjectBindingSha256(firstResult)
  ) {
    errors.push("INVALID_POST_WRITE_READBACK");
  }
  const validManifest = validAuthorityManifest(readback.authorityManifest);
  if (
    !validManifest ||
    !validAuthorityManifest(writeRequest.authorityManifest) ||
    (validManifest &&
      computeArtifactAuthorityManifestSha256(readback.authorityManifest) !==
        computeArtifactAuthorityManifestSha256(writeRequest.authorityManifest)) ||
    (validManifest &&
      computeArtifactAuthorityManifestSha256(readback.authorityManifest) !== readback.object.authorityManifestSha256)
  ) {
    errors.push("INVALID_AUTHORITY_MANIFEST", "INVALID_POST_WRITE_READBACK");
  }
  if (!(readback.content instanceof Uint8Array)) {
    errors.push("MALFORMED_ARTIFACT_INPUT", "INVALID_POST_WRITE_READBACK");
  } else {
    if (readback.content.byteLength !== writeRequest.byteLength) errors.push("CONTENT_LENGTH_MISMATCH");
    if (computeArtifactSha256(readback.content) !== writeRequest.sha256) errors.push("CONTENT_DIGEST_MISMATCH");
    if (!bytesEqual(readback.content, writeRequest.content)) errors.push("INVALID_POST_WRITE_READBACK");
  }
  const readAt = strictInstantMs(readback.readAt);
  const capabilityExpiresAt = strictInstantMs(writeRequest.capability.expiresAt);
  if (
    readAt === null ||
    capabilityExpiresAt === null ||
    !validNow(now) ||
    readAt < now.getTime() ||
    readAt >= capabilityExpiresAt
  ) {
    errors.push("INVALID_POST_WRITE_READBACK");
  }
  if (errors.length > 0 && !errors.includes("INVALID_POST_WRITE_READBACK")) {
    errors.push("INVALID_POST_WRITE_READBACK");
  }
  return [...new Set(errors)];
}

export function validateArtifactReadGrantRequest(
  request: ArtifactReadGrantRequest,
  now: Date
): ArtifactStorageContractErrorCode[] {
  const requestKeys = ["contractVersion", "capability", "object", "expiresInSeconds", "singleUse"] as const;
  if (!hasExactKeys(request, requestKeys)) return ["MALFORMED_ARTIFACT_INPUT"];
  const errors: ArtifactStorageContractErrorCode[] = [];
  if (request.contractVersion !== ARTIFACT_STORAGE_CONTRACT_VERSION) errors.push("INVALID_CONTRACT_VERSION");
  const capabilityScope =
    hasExactKeys(request.capability, VERIFIED_CAPABILITY_KEYS) && validScope(request.capability.scope)
      ? request.capability.scope
      : undefined;
  errors.push(...storedObjectErrors(request.object, capabilityScope));
  const validObject = validStoredObjectShape(request.object);
  const validReadCapability =
    validObject && validCapability(request.capability, request.object.scope, now, READ_PURPOSES);
  const expiresAt = validReadCapability ? strictInstantMs(request.capability.expiresAt) : null;
  if (!validReadCapability) {
    errors.push("INVALID_CAPABILITY");
  }
  if (
    !Number.isSafeInteger(request.expiresInSeconds) ||
    (request.expiresInSeconds as number) < 1 ||
    (request.expiresInSeconds as number) > MAX_ARTIFACT_READ_GRANT_SECONDS ||
    expiresAt === null ||
    !validNow(now) ||
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
  const requestKeys = ["contractVersion", "capability", "object", "expiresInSeconds", "singleUse"] as const;
  if (!hasExactKeys(request, requestKeys)) return ["MALFORMED_ARTIFACT_INPUT", "INVALID_GRANT"];
  const errors: ArtifactStorageContractErrorCode[] = [...validateArtifactReadGrantRequest(request, now)];
  if (!hasExactKeys(grant, READ_GRANT_KEYS)) return [...new Set([...errors, "MALFORMED_ARTIFACT_INPUT", "INVALID_GRANT"] as const)];
  const issuedAt = strictInstantMs(grant.issuedAt);
  const expiresAt = strictInstantMs(grant.expiresAt);
  if (!nonEmpty(grant.brokerGrantId) || !validOpaqueNotUrl(grant.brokerGrantToken) || grant.tokenFormat !== "SIGNED_OPAQUE") {
    errors.push(typeof grant.brokerGrantToken === "string" && looksLikeUrl(grant.brokerGrantToken) ? "PUBLIC_URL_FORBIDDEN" : "INVALID_GRANT");
  }
  const validRequestObject = validStoredObjectShape(request.object);
  const validRequestCapability = validRequestObject && validCapability(request.capability, request.object.scope, now, READ_PURPOSES);
  const requestCapabilityExpiresAt = validRequestCapability ? strictInstantMs(request.capability.expiresAt) : null;
  if (
    !validRequestObject ||
    !validRequestCapability ||
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
    issuedAt === null ||
    expiresAt === null ||
    !validNow(now) ||
    issuedAt > now.getTime() ||
    expiresAt <= now.getTime() ||
    expiresAt - issuedAt > request.expiresInSeconds * 1000 ||
    requestCapabilityExpiresAt === null ||
    expiresAt > requestCapabilityExpiresAt
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
  if (
    validateArtifactReadGrantResult(request, grant, now).length > 0 ||
    typeof verifier?.verifyGrant !== "function" ||
    !validStoredObjectShape(request.object) ||
    !hasExactKeys(grant, READ_GRANT_KEYS) ||
    !validScope(grant.scope)
  ) {
    return null;
  }
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
  const requestKeys = ["contractVersion", "capability", "grant"] as const;
  if (!hasExactKeys(request, requestKeys)) return ["MALFORMED_ARTIFACT_INPUT"];
  const errors: ArtifactStorageContractErrorCode[] = [];
  const validGrant = validVerifiedGrant(request.grant);
  const grantIssuedAt = validGrant ? strictInstantMs(request.grant.issuedAt) : null;
  const grantExpiresAt = validGrant ? strictInstantMs(request.grant.expiresAt) : null;
  if (request.contractVersion !== ARTIFACT_STORAGE_CONTRACT_VERSION) errors.push("INVALID_CONTRACT_VERSION");
  if (
    !validGrant ||
    !validCapability(request.capability, validGrant ? request.grant.scope : ({} as ArtifactStorageScope), now, READ_PURPOSES) ||
    request.capability.purpose !== request.grant.purpose
  ) {
    errors.push("INVALID_CAPABILITY");
  }
  if (
    !validGrant ||
    !validOpaqueNotUrl(request.grant.brokerGrantToken) ||
    request.grant.tokenFormat !== "SIGNED_OPAQUE" ||
    !READ_PURPOSES.includes(request.grant.purpose as (typeof READ_PURPOSES)[number]) ||
    grantIssuedAt === null ||
    grantExpiresAt === null ||
    !validNow(now) ||
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
  if (!hasExactKeys(request, ["contractVersion", "capability", "grant"])) {
    return ["MALFORMED_ARTIFACT_INPUT", "INVALID_GRANT"];
  }
  const errors: ArtifactStorageContractErrorCode[] = [...validateArtifactReadRedemptionRequest(request, now)];
  const baseResultKeys = [
    "status",
    "brokerGrantId",
    "providerKey",
    "objectBindingSha256",
    "redeemedAt",
    "singleUseConsumed",
  ] as const;
  const redeemedResultKeys = [...baseResultKeys, "content", "observedSha256", "observedByteLength"] as const;
  if (
    !isPlainRecord(result) ||
    (result.status === "REDEEMED"
      ? !hasExactKeys(result, redeemedResultKeys)
      : !hasExactKeys(result, baseResultKeys))
  ) {
    return [...new Set([...errors, "MALFORMED_ARTIFACT_INPUT", "INVALID_GRANT"] as const)];
  }
  if (!validVerifiedGrant(request.grant)) return [...new Set([...errors, "INVALID_GRANT"] as const)];
  if (result.brokerGrantId !== request.grant.brokerGrantId) errors.push("INVALID_GRANT");
  if (
    result.providerKey !== request.grant.providerKey ||
    result.objectBindingSha256 !== request.grant.objectBindingSha256
  ) {
    errors.push("INVALID_PROVIDER_KEY");
  }
  if (
    !["REDEEMED", "ALREADY_REDEEMED", "EXPIRED", "DENIED"].includes(result.status) ||
    !isStrictIsoInstant(result.redeemedAt)
  ) {
    errors.push("INVALID_GRANT");
  }
  if (result.status === "REDEEMED") {
    if (!result.singleUseConsumed) errors.push("GRANT_REPLAY_NOT_ENFORCED");
    if (!(result.content instanceof Uint8Array) || result.content.byteLength !== request.grant.expectedByteLength) {
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
  const requestKeys = ["contractVersion", "capability", "object"] as const;
  if (!hasExactKeys(request, requestKeys)) return ["MALFORMED_ARTIFACT_INPUT"];
  const errors: ArtifactStorageContractErrorCode[] = [];
  if (request.contractVersion !== ARTIFACT_STORAGE_CONTRACT_VERSION) errors.push("INVALID_CONTRACT_VERSION");
  errors.push(...storedObjectErrors(request.object));
  if (
    !validStoredObjectShape(request.object) ||
    !validCapability(request.capability, request.object.scope, now, ["INTEGRITY_VERIFY"])
  ) {
    errors.push("INVALID_CAPABILITY");
  }
  return [...new Set(errors)];
}

export function validateArtifactIntegrityResult(
  request: ArtifactIntegrityRequest,
  result: ArtifactIntegrityResult
): ArtifactStorageContractErrorCode[] {
  const commonKeys = [
    "kind",
    "providerKey",
    "providerObjectVersion",
    "objectBindingSha256",
    "observedSha256",
    "observedByteLength",
    "verifiedAt",
  ] as const;
  const failureKeys = [...commonKeys, "failure"] as const;
  if (
    !hasExactKeys(request, ["contractVersion", "capability", "object"]) ||
    !validStoredObjectShape(request.object) ||
    !isPlainRecord(result) ||
    (result.kind === "ARTIFACT_INTEGRITY_VERIFIED"
      ? !hasExactKeys(result, commonKeys)
      : result.kind === "ARTIFACT_INTEGRITY_FAILURE"
        ? !hasExactKeys(result, failureKeys)
        : true)
  ) return ["MALFORMED_ARTIFACT_INPUT", "INVALID_INTEGRITY_RESULT"];
  if (
    !nonEmpty(result.providerKey) ||
    !nonEmpty(result.providerObjectVersion) ||
    typeof result.objectBindingSha256 !== "string" ||
    !SHA256.test(result.objectBindingSha256) ||
    typeof result.observedSha256 !== "string" ||
    !SHA256.test(result.observedSha256) ||
    !Number.isSafeInteger(result.observedByteLength) ||
    (result.observedByteLength as number) < 0 ||
    !isStrictIsoInstant(result.verifiedAt)
  ) return ["INVALID_INTEGRITY_RESULT"];
  const exactObjectIdentity =
    result.providerKey === request.object.providerKey &&
    result.providerObjectVersion === request.object.providerObjectVersion &&
    result.objectBindingSha256 === computeStoredArtifactObjectBindingSha256(request.object);
  const contentMatches =
    result.observedSha256 === request.object.sha256 &&
    result.observedByteLength === request.object.byteLength;
  if (!exactObjectIdentity) return ["INVALID_INTEGRITY_RESULT"];
  if (result.kind === "ARTIFACT_INTEGRITY_VERIFIED") {
    return contentMatches ? [] : ["INVALID_INTEGRITY_RESULT"];
  }
  if (!hasExactKeys(result.failure, ["code"])) return ["MALFORMED_ARTIFACT_INPUT", "INVALID_INTEGRITY_RESULT"];
  const digestMismatch = result.observedSha256 !== request.object.sha256;
  const byteLengthMismatch = result.observedByteLength !== request.object.byteLength;
  const expectedFailureCode: ArtifactIntegrityFailureCode | null =
    digestMismatch && byteLengthMismatch
      ? "DIGEST_AND_BYTE_LENGTH_MISMATCH"
      : digestMismatch
        ? "DIGEST_MISMATCH"
        : byteLengthMismatch
          ? "BYTE_LENGTH_MISMATCH"
          : null;
  return expectedFailureCode !== null && result.failure.code === expectedFailureCode
    ? []
    : ["INVALID_INTEGRITY_RESULT"];
}

export function artifactIntegrityPermitsRelease(
  request: ArtifactIntegrityRequest,
  result: ArtifactIntegrityResult
): result is ArtifactIntegrityVerifiedResult {
  return validateArtifactIntegrityResult(request, result).length === 0 && result.kind === "ARTIFACT_INTEGRITY_VERIFIED";
}

function erasureEligibilityMatchesObject(
  eligibility: unknown,
  object: unknown,
  now: Date
): eligibility is ArtifactErasureEligibility {
  if (
    !hasExactKeys(eligibility, ERASURE_ELIGIBILITY_KEYS) ||
    !validStoredObjectShape(object)
  ) return false;
  const issuedAt = strictInstantMs(eligibility.issuedAt);
  const expiresAt = strictInstantMs(eligibility.expiresAt);
  return (
    eligibility.retentionDecision === "ERASURE_ELIGIBLE" &&
    eligibility.legalHoldStatus === "CLEAR" &&
    eligibility.replicaDisposition === "TOMBSTONE_PROPAGATION_REQUIRED" &&
    eligibility.backupDisposition === "TOMBSTONE_PROPAGATION_REQUIRED" &&
    nonEmpty(eligibility.decisionId) &&
    typeof eligibility.decisionSha256 === "string" &&
    SHA256.test(eligibility.decisionSha256) &&
    nonEmpty(eligibility.retentionPolicyVersion) &&
    issuedAt !== null &&
    expiresAt !== null &&
    validNow(now) &&
    issuedAt <= now.getTime() &&
    expiresAt > now.getTime() &&
    expiresAt > issuedAt &&
    expiresAt - issuedAt <= MAX_ARTIFACT_ERASURE_DECISION_SECONDS * 1000 &&
    sameScope(eligibility.scope, object.scope) &&
    eligibility.providerObjectVersion === object.providerObjectVersion &&
    eligibility.objectBindingSha256 === computeStoredArtifactObjectBindingSha256(object as unknown as StoredArtifactObject) &&
    eligibility.objectSha256 === object.sha256
  );
}

export async function verifyArtifactErasureEligibility(
  eligibility: ArtifactErasureEligibility,
  object: StoredArtifactObject,
  now: Date,
  verifier: ArtifactErasureDecisionVerifier
): Promise<VerifiedArtifactErasureEligibility | null> {
  if (
    !erasureEligibilityMatchesObject(eligibility, object, now) ||
    typeof verifier?.verifyDecision !== "function"
  ) return null;
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
  const requestKeys = ["contractVersion", "capability", "object", "eligibility", "tombstoneEventKey"] as const;
  if (!hasExactKeys(request, requestKeys)) return ["MALFORMED_ARTIFACT_INPUT"];
  const errors: ArtifactStorageContractErrorCode[] = [];
  if (request.contractVersion !== ARTIFACT_STORAGE_CONTRACT_VERSION) errors.push("INVALID_CONTRACT_VERSION");
  errors.push(...storedObjectErrors(request.object));
  const validObject = validStoredObjectShape(request.object);
  if (!validObject || !validCapability(request.capability, request.object.scope, now, ["ERASURE"])) {
    errors.push("INVALID_CAPABILITY");
  }
  const validEligibility = validVerifiedErasureEligibility(request.eligibility, now);
  if (
    !validEligibility ||
    !validObject ||
    (validEligibility && request.eligibility.objectBindingSha256 !== computeStoredArtifactObjectBindingSha256(request.object))
  ) {
    errors.push("INVALID_ERASURE_DECISION");
  }
  if (!validEligibility || request.eligibility.retentionDecision !== "ERASURE_ELIGIBLE") errors.push("RETENTION_NOT_ELIGIBLE");
  if (!validEligibility || request.eligibility.legalHoldStatus !== "CLEAR") errors.push("LEGAL_HOLD_ACTIVE");
  if (!validEligibility || request.eligibility.replicaDisposition !== "TOMBSTONE_PROPAGATION_REQUIRED") {
    errors.push("REPLICA_TOMBSTONE_REQUIRED");
  }
  if (!validEligibility || request.eligibility.backupDisposition !== "TOMBSTONE_PROPAGATION_REQUIRED") {
    errors.push("BACKUP_TOMBSTONE_REQUIRED");
  }
  if (
    !validEligibility ||
    !validObject ||
    !nonEmpty(request.eligibility.decisionId) ||
    !SHA256.test(request.eligibility.decisionSha256) ||
    !nonEmpty(request.eligibility.retentionPolicyVersion) ||
    !isStrictIsoInstant(request.eligibility.issuedAt) ||
    !isStrictIsoInstant(request.eligibility.expiresAt) ||
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
  const baseKeys = ["status", "providerKey", "providerObjectVersion", "objectBindingSha256", "completedAt"] as const;
  const successKeys = [
    ...baseKeys,
    "providerDeletionRef",
    "replicaTombstoneEventKey",
    "backupTombstoneEventKey",
  ] as const;
  if (
    !hasExactKeys(request, ["contractVersion", "capability", "object", "eligibility", "tombstoneEventKey"]) ||
    !validStoredObjectShape(request.object) ||
    !isPlainRecord(result) ||
    (result.status === "FAILED" ? !hasExactKeys(result, baseKeys) : !hasExactKeys(result, successKeys))
  ) return ["MALFORMED_ARTIFACT_INPUT", "INVALID_TOMBSTONE_RESULT"];
  if (!["OBJECT_DELETED", "CRYPTO_SHREDDED", "FAILED"].includes(result.status)) {
    errors.push("INVALID_TOMBSTONE_RESULT");
  }
  if (
    result.providerKey !== request.object.providerKey ||
    result.providerObjectVersion !== request.object.providerObjectVersion ||
    result.objectBindingSha256 !== computeStoredArtifactObjectBindingSha256(request.object) ||
    !isStrictIsoInstant(result.completedAt) ||
    (result.providerDeletionRef !== undefined && !validOpaqueNotUrl(result.providerDeletionRef))
  ) {
    errors.push(typeof result.providerDeletionRef === "string" && looksLikeUrl(result.providerDeletionRef) ? "PUBLIC_URL_FORBIDDEN" : "INVALID_TOMBSTONE_RESULT");
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
  const selectedProviderKey = provider?.providerKey;
  const preflightErrors = [
    ...validateArtifactProviderSelection(selectedProviderKey, request?.selectedProviderKey),
    ...validateImmutableArtifactWrite(request, now),
  ];
  if (typeof provider?.putImmutable !== "function" || typeof provider?.readBackImmutable !== "function") {
    preflightErrors.push("INVALID_PROVIDER_ADAPTER");
  }
  if (preflightErrors.length > 0) return deniedDispatch(preflightErrors);
  const requestSnapshot = Object.freeze({
    ...request,
    scope: immutableScopeSnapshot(request.scope),
    content: new Uint8Array(request.content),
    authorityManifest: immutableAuthorityManifestSnapshot(request.authorityManifest),
  });
  const errors = [
    ...validateArtifactProviderSelection(selectedProviderKey, request.selectedProviderKey),
    ...validateImmutableArtifactWrite(requestSnapshot, now),
  ];
  if (errors.length > 0) return deniedDispatch(errors);

  const rawResult = await provider.putImmutable(requestSnapshot);
  const resultErrors = validateStoredArtifactObject(requestSnapshot, rawResult, selectedProviderKey);
  if (resultErrors.length > 0) return deniedDispatch(resultErrors);
  const result = immutableStoredObjectSnapshot(rawResult);
  const readbackRequest = Object.freeze({
    contractVersion: ARTIFACT_STORAGE_CONTRACT_VERSION,
    capability: requestSnapshot.capability,
    object: result,
    expectedAuthorityManifestSha256: computeArtifactAuthorityManifestSha256(requestSnapshot.authorityManifest),
  });
  const readbackRequestErrors = validateImmutableArtifactReadbackRequest(readbackRequest, now);
  if (readbackRequestErrors.length > 0) return deniedDispatch(readbackRequestErrors);
  const rawReadback = await provider.readBackImmutable(readbackRequest);
  const readbackErrors = validateImmutableArtifactReadback(
    requestSnapshot,
    result,
    rawReadback,
    selectedProviderKey,
    now
  );
  if (readbackErrors.length > 0) return deniedDispatch(readbackErrors);
  const verifiedPersistedObject = immutableStoredObjectSnapshot(rawReadback.object);
  return successfulDispatch(verifiedPersistedObject);
}

export async function dispatchArtifactReadGrant(
  provider: ArtifactStorageProvider,
  request: ArtifactReadGrantRequest,
  now: Date
): Promise<ArtifactProviderDispatchResult<ArtifactReadGrant>> {
  const selectedProviderKey = provider?.providerKey;
  const preflightErrors = validateArtifactReadGrantRequest(request, now);
  if (typeof provider?.issueReadGrant !== "function") preflightErrors.push("INVALID_PROVIDER_ADAPTER");
  if (
    preflightErrors.length > 0 ||
    !validStoredObjectShape(request.object)
  ) return deniedDispatch(preflightErrors);
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
  const resultErrors = validateArtifactReadGrantResult(requestSnapshot, rawResult, now);
  if (resultErrors.length > 0 || !hasExactKeys(rawResult, READ_GRANT_KEYS) || !validScope(rawResult.scope)) {
    return deniedDispatch(resultErrors);
  }
  const result = Object.freeze({ ...rawResult, scope: immutableScopeSnapshot(rawResult.scope) });
  return successfulDispatch(result);
}

export async function dispatchArtifactReadRedemption(
  provider: ArtifactStorageProvider,
  request: ArtifactReadRedemptionRequest,
  now: Date
): Promise<ArtifactProviderDispatchResult<ArtifactReadRedemptionResult>> {
  const selectedProviderKey = provider?.providerKey;
  const preflightErrors = validateArtifactReadRedemptionRequest(request, now);
  if (typeof provider?.redeemReadGrantAtomically !== "function") preflightErrors.push("INVALID_PROVIDER_ADAPTER");
  if (preflightErrors.length > 0 || !validVerifiedGrant(request.grant)) return deniedDispatch(preflightErrors);
  const requestSnapshot = Object.freeze({ ...request });
  const errors = [
    ...validateArtifactProviderSelection(selectedProviderKey, request.grant.providerKey),
    ...validateArtifactReadRedemptionRequest(requestSnapshot, now),
  ];
  if (errors.length > 0) return deniedDispatch(errors);

  const rawResult = await provider.redeemReadGrantAtomically(requestSnapshot);
  const resultErrors = validateArtifactReadRedemption(requestSnapshot, rawResult, now);
  if (resultErrors.length > 0) return deniedDispatch(resultErrors);
  const result = Object.freeze(
    rawResult.status === "REDEEMED"
      ? { ...rawResult, content: new Uint8Array(rawResult.content as Uint8Array) }
      : { ...rawResult }
  ) as ArtifactReadRedemptionResult;
  return successfulDispatch(result);
}

export async function dispatchArtifactIntegrityVerification(
  provider: ArtifactStorageProvider,
  request: ArtifactIntegrityRequest,
  now: Date
): Promise<ArtifactProviderDispatchResult<ArtifactIntegrityResult>> {
  const selectedProviderKey = provider?.providerKey;
  const preflightErrors = validateArtifactIntegrityRequest(request, now);
  if (typeof provider?.verifyIntegrity !== "function") preflightErrors.push("INVALID_PROVIDER_ADAPTER");
  if (preflightErrors.length > 0 || !validStoredObjectShape(request.object)) {
    return deniedDispatch(preflightErrors);
  }
  const requestSnapshot = Object.freeze({
    ...request,
    object: immutableStoredObjectSnapshot(request.object),
  });
  const errors = [
    ...validateArtifactProviderSelection(selectedProviderKey, requestSnapshot.object.providerKey),
    ...validateArtifactIntegrityRequest(requestSnapshot, now),
  ];
  if (errors.length > 0) return deniedDispatch(errors);

  const rawResult = await provider.verifyIntegrity(requestSnapshot);
  const resultErrors = validateArtifactIntegrityResult(requestSnapshot, rawResult);
  if (resultErrors.length > 0) return deniedDispatch(resultErrors);
  const result = Object.freeze(
    rawResult.kind === "ARTIFACT_INTEGRITY_FAILURE"
      ? { ...rawResult, failure: Object.freeze({ ...rawResult.failure }) }
      : { ...rawResult }
  ) as ArtifactIntegrityResult;
  return successfulDispatch(result);
}

export async function dispatchArtifactTombstone(
  provider: ArtifactStorageProvider,
  request: ArtifactTombstoneRequest,
  now: Date,
  verifier: ArtifactErasureDecisionVerifier
): Promise<ArtifactProviderDispatchResult<ArtifactTombstoneResult>> {
  const selectedProviderKey = provider?.providerKey;
  const preflightErrors = validateArtifactTombstoneRequest(request, now);
  if (typeof provider?.tombstoneExactVersion !== "function" || typeof verifier?.verifyDecision !== "function") {
    preflightErrors.push("INVALID_PROVIDER_ADAPTER");
  }
  if (preflightErrors.length > 0 || !validStoredObjectShape(request.object)) {
    return deniedDispatch(preflightErrors);
  }
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

  const rawResult = await provider.tombstoneExactVersion(requestSnapshot);
  const resultErrors = validateArtifactTombstoneResult(requestSnapshot, rawResult);
  return resultErrors.length > 0 ? deniedDispatch(resultErrors) : successfulDispatch(Object.freeze({ ...rawResult }));
}
