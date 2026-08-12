import {
  createHash,
  createPublicKey,
  verify as verifySignature,
} from "node:crypto";
import { isStrictIsoInstant } from "./progressIntelligence";

export const P0_TRUSTED_WRITER_READINESS_CONTRACT_VERSION =
  "p0-trusted-writer-readiness-v3" as const;

export const P0_TRUSTED_WRITER_REQUIRED_ADAPTERS = [
  "AUTHENTICATED_SESSION_PRINCIPAL",
  "AUTHENTICATED_WORKER_PRINCIPAL",
  "TENANT_SCOPED_PRISMA_REPOSITORY",
  "DEDICATED_DATABASE_ROLE_CLIENT",
  "TRANSACTIONAL_READBACK",
  "PRIVILEGED_VALIDATOR_BOUNDARY",
  "IMMUTABLE_SOURCE_STORAGE",
  // Local attestation covers the versioned AEAD/keyring adapter contract. It
  // does not claim deployed managed-KMS or secret-manager custody.
  "VALUE_PROTECTION_KEYRING",
  "SOURCE_REPORTED_AUTHORITY_FILTER",
  "PII_SAFE_ACCESS_AUDIT",
] as const;

export const P0_TRUSTED_WRITER_REQUIRED_SAFETY_FLAGS = [
  "DORMANT_BY_DEFAULT",
  "ROOT_KILL_SWITCH",
  "SERVER_RESOLVED_COHORT",
  "NO_LEGACY_AUTO_PROMOTION",
  "NO_CALLER_AUTHORITY_FIELDS",
  "EXACT_DATABASE_SESSION_ROLE",
] as const;

export const P0_TRUSTED_WRITER_CAPABILITIES = [
  "LIVE_GRANT_REVALIDATION",
  "COMPOSITE_TENANT_CONSUMER_SCOPE",
  "SOURCE_VERSION_DIGEST_BINDING",
  "WRITE_READBACK_SEMANTIC_VERIFY",
  "ABSENT_CONFIRMED_NON_AUTHORITY",
  "BOUNDED_IDEMPOTENT_RETRY",
] as const;

/**
 * Exact repository-relative source inventory bound into a trusted-writer
 * readiness receipt. This includes every concrete authority writer plus the
 * server trust-chain, schema/migrations, privilege boundary, and executable
 * verifier that establishes the local pre-activation result.
 */
export const P0_TRUSTED_WRITER_IMPLEMENTATION_SOURCE_MANIFEST = Object.freeze([
  "app/api/reports/upload/route.ts",
  "lib/auth.ts",
  "lib/classify.ts",
  "lib/prisma.ts",
  "lib/session.ts",
  "lib/creditTruth/accountReview.ts",
  "lib/creditTruth/caseActionDecision.ts",
  "lib/creditTruth/consumerConfirmationRuntime.ts",
  "lib/creditTruth/consumerAssertion.ts",
  "lib/creditTruth/parserAiV2.ts",
  "lib/creditTruth/parserRegexV2.ts",
  "lib/creditTruth/parserShadowAdapter.ts",
  "lib/creditTruth/parserShadowEnvelope.ts",
  "lib/creditTruth/parserV2.ts",
  "lib/creditTruth/phase2Flags.ts",
  "lib/creditTruth/phase2Readiness.ts",
  "lib/creditTruth/postgresTransaction.ts",
  "lib/creditTruth/principal.ts",
  "lib/creditTruth/principalPrismaAdapter.ts",
  "lib/creditTruth/principalServer.ts",
  "lib/creditTruth/prismaCaseActionRepository.ts",
  "lib/creditTruth/prismaConsumerConfirmationRepository.ts",
  "lib/creditTruth/prismaExtractionInputRepository.ts",
  "lib/creditTruth/prismaReportIngestionRepository.ts",
  "lib/creditTruth/prismaReportVersionRepository.ts",
  "lib/creditTruth/prismaRound0Repository.ts",
  "lib/creditTruth/prismaSensitiveAccessRepository.ts",
  "lib/creditTruth/prismaShadowTruthGraphRepository.ts",
  "lib/creditTruth/prismaSourceArtifactProvider.ts",
  "lib/creditTruth/progressIntelligence.ts",
  "lib/creditTruth/reportIngestion.ts",
  "lib/creditTruth/reportSourceExtraction.ts",
  "lib/creditTruth/reportSourceSafety.ts",
  "lib/creditTruth/repository.ts",
  "lib/creditTruth/repositoryAttestation.ts",
  "lib/creditTruth/round0.ts",
  "lib/creditTruth/round0Runtime.ts",
  "lib/creditTruth/round0SourceSeal.ts",
  "lib/creditTruth/sensitiveAccessAudit.ts",
  "lib/creditTruth/shadowExtractionService.ts",
  "lib/creditTruth/sourceArtifact.ts",
  "lib/creditTruth/trustedWriterParserExecution.ts",
  "lib/creditTruth/trustedWriterPrismaClient.ts",
  "lib/creditTruth/trustedWriterReadiness.ts",
  "lib/creditTruth/trustedWriterShadowValueProtector.ts",
  "lib/creditTruth/trustedWriterUploadHook.ts",
  "lib/creditTruth/trustedWriterValueProtection.ts",
  "lib/creditTruth/types.ts",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "prisma/schema.prisma",
  "prisma/migrations/migration_lock.toml",
  "prisma/migrations/20260808_p0_credit_truth_foundation/migration.sql",
  "prisma/migrations/20260810_p0_phase2a_ingestion_round0/migration.sql",
  "prisma/migrations/20260811_p0_trusted_writer_gate/migration.sql",
  "scripts/p0-trusted-writer-disposable-verify.sh",
  "scripts/p0-trusted-writer-migration-guard.test.ts",
  "scripts/p0-trusted-writer-principal-readiness.test.ts",
  "scripts/p0-trusted-writer-prisma-repositories.test.ts",
  "scripts/p0-trusted-writer-real-adapter.test.ts",
  "scripts/p0-trusted-writer-source-storage.test.ts",
  "scripts/p0-trusted-writer-surface-audit.test.ts",
  "scripts/p0-trusted-writer-upload-hook.test.ts",
  "scripts/p0-trusted-writer-validator-boundary.test.ts",
  "scripts/sql/p0-trusted-writer-db-role-contract.sql",
  "scripts/sql/p0-trusted-writer-validator-boundary.sql",
] as const);

export type P0TrustedWriterRequiredAdapter =
  (typeof P0_TRUSTED_WRITER_REQUIRED_ADAPTERS)[number];
export type P0TrustedWriterSafetyFlag =
  (typeof P0_TRUSTED_WRITER_REQUIRED_SAFETY_FLAGS)[number];
export type P0TrustedWriterCapability =
  (typeof P0_TRUSTED_WRITER_CAPABILITIES)[number];

/**
 * Signed pre-activation proof for the concrete trusted-writer implementation.
 * It proves a source/configuration contract, not a production deployment or
 * permission to activate. Deployed DB-role, PDF isolation, retention/counsel,
 * migration, cohort and Founder gates remain separate.
 */
export interface P0TrustedWriterReadinessCandidate {
  readonly contractVersion: typeof P0_TRUSTED_WRITER_READINESS_CONTRACT_VERSION;
  readonly receiptKind: "AUTHENTICATED_PRODUCTION";
  readonly receiptId: string;
  readonly configurationMode: "DORMANT_DEFAULT_OFF";
  readonly codeRevision: string;
  readonly implementationSourceSha256: string;
  readonly schemaSha256: string;
  readonly migrationSha256: string;
  readonly adapterManifestSha256: string;
  readonly storageContractSha256: string;
  readonly valueProtectionContractSha256: string;
  readonly dbRoleContractSha256: string;
  readonly databaseRoleIdentitySha256: string;
  readonly privilegedValidatorManifestSha256: string;
  readonly dbRoleContractStatus: "LOCAL_CONTRACT_PROVEN";
  readonly trustedWriterVerifierId: string;
  readonly trustedWriterVerifierVersion: string;
  readonly requiredAdapters: readonly P0TrustedWriterRequiredAdapter[];
  readonly safetyFlags: readonly P0TrustedWriterSafetyFlag[];
  readonly capabilities: readonly P0TrustedWriterCapability[];
  readonly attestationResult: "PASS";
  readonly issuedAt: string;
  readonly expiresAt: string;
}

export interface P0TrustedWriterReadinessEnvelope {
  readonly keyId: string;
  readonly candidate: P0TrustedWriterReadinessCandidate;
  readonly signatureBase64Url: string;
}

const VERIFIED_TRUSTED_WRITER_RECEIPT = Symbol(
  "verified-p0-trusted-writer-readiness",
);
const verifiedReceipts = new WeakSet<object>();
const verifiedReceiptDigests = new WeakMap<object, string>();

export interface VerifiedP0TrustedWriterReadinessReceipt
  extends P0TrustedWriterReadinessCandidate {
  readonly keyId: string;
  readonly signatureBase64Url: string;
  readonly semanticSha256: string;
  readonly [VERIFIED_TRUSTED_WRITER_RECEIPT]: true;
}

const SHA256 = /^[0-9a-f]{64}$/;
const STABLE = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,199}$/;
const BASE64URL = /^[A-Za-z0-9_-]+$/;
const MAX_ENVELOPE_BYTES = 32_768;
const MAX_RECEIPT_LIFETIME_MS = 24 * 60 * 60 * 1_000;

const ENV = Object.freeze({
  envelope: "P0_TRUSTED_WRITER_ATTESTATION_ENVELOPE_BASE64URL",
  publicKey: "P0_TRUSTED_WRITER_ATTESTATION_PUBLIC_KEY_DER_BASE64URL",
  keyId: "P0_TRUSTED_WRITER_ATTESTATION_KEY_ID",
  codeRevision: "P0_TRUSTED_WRITER_CODE_REVISION",
  implementation: "P0_TRUSTED_WRITER_IMPLEMENTATION_SHA256",
  schema: "P0_TRUSTED_WRITER_SCHEMA_SHA256",
  migration: "P0_TRUSTED_WRITER_MIGRATION_SHA256",
  adapters: "P0_TRUSTED_WRITER_ADAPTER_MANIFEST_SHA256",
  storage: "P0_TRUSTED_WRITER_STORAGE_CONTRACT_SHA256",
  valueProtection: "P0_TRUSTED_WRITER_VALUE_PROTECTION_CONTRACT_SHA256",
  dbRole: "P0_TRUSTED_WRITER_DB_ROLE_CONTRACT_SHA256",
  databaseRoleIdentity:
    "P0_TRUSTED_WRITER_DATABASE_ROLE_IDENTITY_SHA256",
  privilegedValidators:
    "P0_TRUSTED_WRITER_PRIVILEGED_VALIDATOR_MANIFEST_SHA256",
});

function exactKeys(value: object, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  return (
    actual.length === expected.length &&
    expected.every((key, index) => key === actual[index])
  );
}

function exactOrderedSet<T extends string>(
  actual: readonly T[],
  expected: readonly T[],
): boolean {
  return (
    Array.isArray(actual) &&
    actual.length === expected.length &&
    expected.every((value, index) => actual[index] === value)
  );
}

function canonicalJson(value: unknown): string {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("non-finite attestation value");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (!value || typeof value !== "object") {
    throw new Error("non-JSON attestation value");
  }
  const record = value as Readonly<Record<string, unknown>>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}

/** Public signing payload for the offline/local verifier harness. */
export function p0TrustedWriterAttestationSigningPayload(
  candidate: P0TrustedWriterReadinessCandidate,
): Uint8Array {
  return Buffer.from(
    `CreditVector/P0/trusted-writer/readiness/v3\n${canonicalJson(candidate)}`,
    "utf8",
  );
}

function candidateSemanticSha256(
  candidate: P0TrustedWriterReadinessCandidate,
): string {
  return createHash("sha256")
    .update(p0TrustedWriterAttestationSigningPayload(candidate))
    .digest("hex");
}

function candidateSnapshot(
  value: P0TrustedWriterReadinessCandidate,
): P0TrustedWriterReadinessCandidate {
  return {
    contractVersion: value.contractVersion,
    receiptKind: value.receiptKind,
    receiptId: value.receiptId,
    configurationMode: value.configurationMode,
    codeRevision: value.codeRevision,
    implementationSourceSha256: value.implementationSourceSha256,
    schemaSha256: value.schemaSha256,
    migrationSha256: value.migrationSha256,
    adapterManifestSha256: value.adapterManifestSha256,
    storageContractSha256: value.storageContractSha256,
    valueProtectionContractSha256: value.valueProtectionContractSha256,
    dbRoleContractSha256: value.dbRoleContractSha256,
    databaseRoleIdentitySha256: value.databaseRoleIdentitySha256,
    privilegedValidatorManifestSha256:
      value.privilegedValidatorManifestSha256,
    dbRoleContractStatus: value.dbRoleContractStatus,
    trustedWriterVerifierId: value.trustedWriterVerifierId,
    trustedWriterVerifierVersion: value.trustedWriterVerifierVersion,
    requiredAdapters: value.requiredAdapters,
    safetyFlags: value.safetyFlags,
    capabilities: value.capabilities,
    attestationResult: value.attestationResult,
    issuedAt: value.issuedAt,
    expiresAt: value.expiresAt,
  };
}

function decodeBase64Url(value: unknown, maxBytes: number): Buffer | null {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > maxBytes * 2 ||
    !BASE64URL.test(value)
  ) {
    return null;
  }
  try {
    const decoded = Buffer.from(value, "base64url");
    if (
      decoded.length < 1 ||
      decoded.length > maxBytes ||
      decoded.toString("base64url") !== value
    ) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

function validCandidate(
  candidate: P0TrustedWriterReadinessCandidate,
  nowMs: number,
): boolean {
  if (!candidate || typeof candidate !== "object") return false;
  if (
    !exactKeys(candidate, [
      "adapterManifestSha256",
      "attestationResult",
      "capabilities",
      "codeRevision",
      "configurationMode",
      "contractVersion",
      "dbRoleContractSha256",
      "databaseRoleIdentitySha256",
      "dbRoleContractStatus",
      "expiresAt",
      "implementationSourceSha256",
      "issuedAt",
      "migrationSha256",
      "privilegedValidatorManifestSha256",
      "receiptId",
      "receiptKind",
      "requiredAdapters",
      "safetyFlags",
      "schemaSha256",
      "storageContractSha256",
      "trustedWriterVerifierId",
      "trustedWriterVerifierVersion",
      "valueProtectionContractSha256",
    ].sort())
  ) {
    return false;
  }
  const issued = isStrictIsoInstant(candidate.issuedAt)
    ? Date.parse(candidate.issuedAt)
    : Number.NaN;
  const expires = isStrictIsoInstant(candidate.expiresAt)
    ? Date.parse(candidate.expiresAt)
    : Number.NaN;
  return (
    candidate.contractVersion === P0_TRUSTED_WRITER_READINESS_CONTRACT_VERSION &&
    candidate.receiptKind === "AUTHENTICATED_PRODUCTION" &&
    STABLE.test(candidate.receiptId) &&
    candidate.configurationMode === "DORMANT_DEFAULT_OFF" &&
    STABLE.test(candidate.codeRevision) &&
    SHA256.test(candidate.implementationSourceSha256) &&
    SHA256.test(candidate.schemaSha256) &&
    SHA256.test(candidate.migrationSha256) &&
    SHA256.test(candidate.adapterManifestSha256) &&
    SHA256.test(candidate.storageContractSha256) &&
    SHA256.test(candidate.valueProtectionContractSha256) &&
    SHA256.test(candidate.dbRoleContractSha256) &&
    SHA256.test(candidate.databaseRoleIdentitySha256) &&
    SHA256.test(candidate.privilegedValidatorManifestSha256) &&
    candidate.dbRoleContractStatus === "LOCAL_CONTRACT_PROVEN" &&
    STABLE.test(candidate.trustedWriterVerifierId) &&
    STABLE.test(candidate.trustedWriterVerifierVersion) &&
    exactOrderedSet(
      candidate.requiredAdapters,
      P0_TRUSTED_WRITER_REQUIRED_ADAPTERS,
    ) &&
    exactOrderedSet(
      candidate.safetyFlags,
      P0_TRUSTED_WRITER_REQUIRED_SAFETY_FLAGS,
    ) &&
    exactOrderedSet(candidate.capabilities, P0_TRUSTED_WRITER_CAPABILITIES) &&
    candidate.attestationResult === "PASS" &&
    Number.isFinite(issued) &&
    Number.isFinite(expires) &&
    issued <= nowMs &&
    expires > nowMs &&
    expires > issued &&
    expires - issued <= MAX_RECEIPT_LIFETIME_MS
  );
}

function exactExpectedEnvironment(
  candidate: P0TrustedWriterReadinessCandidate,
  keyId: string,
): boolean {
  return (
    process.env[ENV.keyId] === keyId &&
    process.env[ENV.codeRevision] === candidate.codeRevision &&
    process.env[ENV.implementation] === candidate.implementationSourceSha256 &&
    process.env[ENV.schema] === candidate.schemaSha256 &&
    process.env[ENV.migration] === candidate.migrationSha256 &&
    process.env[ENV.adapters] === candidate.adapterManifestSha256 &&
    process.env[ENV.storage] === candidate.storageContractSha256 &&
    process.env[ENV.valueProtection] ===
      candidate.valueProtectionContractSha256 &&
    process.env[ENV.dbRole] === candidate.dbRoleContractSha256 &&
    process.env[ENV.databaseRoleIdentity] ===
      candidate.databaseRoleIdentitySha256 &&
    process.env[ENV.privilegedValidators] ===
      candidate.privilegedValidatorManifestSha256
  );
}

/**
 * Loads only deployment-controlled environment state. No request/caller
 * candidate, verifier, public key, or approval callback can be injected.
 */
export function loadP0TrustedWriterReadinessFromServerEnvironment():
  | VerifiedP0TrustedWriterReadinessReceipt
  | null {
  const encodedEnvelope = decodeBase64Url(
    process.env[ENV.envelope],
    MAX_ENVELOPE_BYTES,
  );
  const publicKeyDer = decodeBase64Url(process.env[ENV.publicKey], 1_024);
  if (!encodedEnvelope || !publicKeyDer) return null;

  let envelope: P0TrustedWriterReadinessEnvelope;
  try {
    envelope = JSON.parse(encodedEnvelope.toString("utf8")) as P0TrustedWriterReadinessEnvelope;
  } catch {
    return null;
  }
  if (
    !envelope ||
    typeof envelope !== "object" ||
    !exactKeys(envelope, ["candidate", "keyId", "signatureBase64Url"].sort()) ||
    !STABLE.test(envelope.keyId) ||
    !validCandidate(envelope.candidate, Date.now()) ||
    !exactExpectedEnvironment(envelope.candidate, envelope.keyId)
  ) {
    return null;
  }
  const signature = decodeBase64Url(envelope.signatureBase64Url, 128);
  if (!signature || signature.length !== 64) return null;

  let signatureValid = false;
  try {
    const publicKey = createPublicKey({
      key: publicKeyDer,
      format: "der",
      type: "spki",
    });
    signatureValid = verifySignature(
      null,
      p0TrustedWriterAttestationSigningPayload(envelope.candidate),
      publicKey,
      signature,
    );
  } catch {
    return null;
  }
  if (!signatureValid) return null;

  const semanticSha256 = candidateSemanticSha256(envelope.candidate);
  const receipt = {
    ...envelope.candidate,
    requiredAdapters: Object.freeze([...envelope.candidate.requiredAdapters]),
    safetyFlags: Object.freeze([...envelope.candidate.safetyFlags]),
    capabilities: Object.freeze([...envelope.candidate.capabilities]),
    keyId: envelope.keyId,
    signatureBase64Url: envelope.signatureBase64Url,
    semanticSha256,
  } as VerifiedP0TrustedWriterReadinessReceipt;
  Object.defineProperty(receipt, VERIFIED_TRUSTED_WRITER_RECEIPT, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  verifiedReceipts.add(receipt);
  verifiedReceiptDigests.set(receipt, semanticSha256);
  return Object.freeze(receipt);
}

export function isVerifiedP0TrustedWriterReadinessReceipt(
  receipt:
    | VerifiedP0TrustedWriterReadinessReceipt
    | P0TrustedWriterReadinessCandidate
    | null
    | undefined,
): receipt is VerifiedP0TrustedWriterReadinessReceipt {
  if (
    !receipt ||
    typeof receipt !== "object" ||
    (receipt as VerifiedP0TrustedWriterReadinessReceipt)[
      VERIFIED_TRUSTED_WRITER_RECEIPT
    ] !== true ||
    !verifiedReceipts.has(receipt)
  ) {
    return false;
  }
  const verified = receipt as VerifiedP0TrustedWriterReadinessReceipt;
  const candidate = candidateSnapshot(verified);
  if (!validCandidate(candidate, Date.now())) return false;
  const digest = candidateSemanticSha256(candidate);
  return (
    SHA256.test(verified.semanticSha256) &&
    verified.semanticSha256 === digest &&
    verifiedReceiptDigests.get(verified) === digest
  );
}
