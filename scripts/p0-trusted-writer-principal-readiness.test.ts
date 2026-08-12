import assert from "node:assert/strict";
import {
  generateKeyPairSync,
  sign,
} from "node:crypto";
import { readFileSync } from "node:fs";
import {
  createP0PrismaServerPrincipalDependencies,
  issueP0ProductionWorkerOperationToken,
  issueP0WorkerOperationToken,
  p0WorkerOperationAuthorizesRepositoryPurpose,
  revalidateP0PrismaPrincipal,
  type P0PrincipalIngestionRow,
  type P0PrincipalPrismaClient,
  type P0PrincipalUserRow,
  type P0WorkerTokenConfiguration,
} from "../lib/creditTruth/principalPrismaAdapter";
import {
  resolveP0InteractivePrincipal,
  resolveP0WorkerPrincipal,
} from "../lib/creditTruth/principalServer";
import { p0ScopeFromPrincipal, type P0Principal } from "../lib/creditTruth/principal";
import {
  p0Phase2ACohortScopeSha256,
  resolveP0Phase2ACohortFromServerEnvironment,
} from "../lib/creditTruth/phase2Flags";
import {
  evaluateP0Phase2AReadiness,
  type P0Phase2AReadinessEvidence,
} from "../lib/creditTruth/phase2Readiness";
import {
  P0_TRUSTED_WRITER_CAPABILITIES,
  P0_TRUSTED_WRITER_READINESS_CONTRACT_VERSION,
  P0_TRUSTED_WRITER_REQUIRED_ADAPTERS,
  P0_TRUSTED_WRITER_REQUIRED_SAFETY_FLAGS,
  isVerifiedP0TrustedWriterReadinessReceipt,
  loadP0TrustedWriterReadinessFromServerEnvironment,
  p0TrustedWriterAttestationSigningPayload,
  type P0TrustedWriterReadinessCandidate,
  type P0TrustedWriterReadinessEnvelope,
  type VerifiedP0TrustedWriterReadinessReceipt,
} from "../lib/creditTruth/trustedWriterReadiness";
import { p0TrustedWriterDatabaseRoleIdentitySha256 } from "../lib/creditTruth/trustedWriterPrismaClient";

const users = new Map<string, P0PrincipalUserRow>();
const ingestions = new Map<string, P0PrincipalIngestionRow>();
let sessionActorId: string | null = null;

const client: P0PrincipalPrismaClient = {
  user: {
    async findUnique({ where }) {
      const row = users.get(where.id);
      return row ? { ...row } : null;
    },
  },
  reportIngestion: {
    async findUnique({ where }) {
      const row = ingestions.get(where.id);
      return row ? { ...row } : null;
    },
  },
};

const workerConfiguration: P0WorkerTokenConfiguration = Object.freeze({
  workerActorId: "p0-worker-real-adapter",
  hmacKey: new Uint8Array(Buffer.alloc(32, 0x5a)),
});

const dependencies = createP0PrismaServerPrincipalDependencies({
  client,
  async resolveAuthenticatedAccount() {
    const row = sessionActorId ? users.get(sessionActorId) : null;
    return row ? { ...row } : null;
  },
  resolveWorkerTokenConfiguration: () => workerConfiguration,
});

function user(
  id: string,
  overrides: Partial<P0PrincipalUserRow> = {},
): P0PrincipalUserRow {
  return {
    id,
    disabled: false,
    role: "USER",
    isAgency: false,
    managedByAgencyId: null,
    p0AuthorizationRevision: 1,
    ...overrides,
  };
}

async function directPrincipal(actorId = "consumer-direct"): Promise<P0Principal> {
  sessionActorId = actorId;
  const principal = await resolveP0InteractivePrincipal(
    {
      authorizationIntent: "DIRECT_OR_MANAGED",
      consumerSelector: actorId,
    },
    dependencies,
  );
  assert(principal);
  return principal;
}

async function managedPrincipal(
  actorId = "agency-1",
  consumerId = "client-1",
): Promise<P0Principal> {
  sessionActorId = actorId;
  const principal = await resolveP0InteractivePrincipal(
    {
      authorizationIntent: "DIRECT_OR_MANAGED",
      consumerSelector: consumerId,
    },
    dependencies,
  );
  assert(principal);
  return principal;
}

const RECEIPT_ENV = [
  "P0_TRUSTED_WRITER_ATTESTATION_ENVELOPE_BASE64URL",
  "P0_TRUSTED_WRITER_ATTESTATION_PUBLIC_KEY_DER_BASE64URL",
  "P0_TRUSTED_WRITER_ATTESTATION_KEY_ID",
  "P0_TRUSTED_WRITER_CODE_REVISION",
  "P0_TRUSTED_WRITER_IMPLEMENTATION_SHA256",
  "P0_TRUSTED_WRITER_SCHEMA_SHA256",
  "P0_TRUSTED_WRITER_MIGRATION_SHA256",
  "P0_TRUSTED_WRITER_ADAPTER_MANIFEST_SHA256",
  "P0_TRUSTED_WRITER_STORAGE_CONTRACT_SHA256",
  "P0_TRUSTED_WRITER_VALUE_PROTECTION_CONTRACT_SHA256",
  "P0_TRUSTED_WRITER_DB_ROLE_CONTRACT_SHA256",
  "P0_TRUSTED_WRITER_DATABASE_ROLE_IDENTITY_SHA256",
  "P0_TRUSTED_WRITER_PRIVILEGED_VALIDATOR_MANIFEST_SHA256",
] as const;

function installSignedReceipt(
  overrides: Partial<P0TrustedWriterReadinessCandidate> = {},
): {
  readonly candidate: P0TrustedWriterReadinessCandidate;
  readonly restoreEnvelope: string;
} {
  const now = Date.now();
  const hash = (character: string) => character.repeat(64);
  const candidate: P0TrustedWriterReadinessCandidate = {
    contractVersion: P0_TRUSTED_WRITER_READINESS_CONTRACT_VERSION,
    receiptKind: "AUTHENTICATED_PRODUCTION",
    receiptId: "trusted-writer-attestation-1",
    configurationMode: "DORMANT_DEFAULT_OFF",
    codeRevision: "trusted-writer-worktree-v1",
    implementationSourceSha256: hash("a"),
    schemaSha256: hash("b"),
    migrationSha256: hash("c"),
    adapterManifestSha256: hash("d"),
    storageContractSha256: hash("e"),
    valueProtectionContractSha256: hash("f"),
    dbRoleContractSha256: hash("1"),
    databaseRoleIdentitySha256: p0TrustedWriterDatabaseRoleIdentitySha256(
      "p0_writer_readiness_test",
    ),
    privilegedValidatorManifestSha256: hash("2"),
    dbRoleContractStatus: "LOCAL_CONTRACT_PROVEN",
    trustedWriterVerifierId: "p0-real-adapter-harness",
    trustedWriterVerifierVersion: "v1",
    requiredAdapters: P0_TRUSTED_WRITER_REQUIRED_ADAPTERS,
    safetyFlags: P0_TRUSTED_WRITER_REQUIRED_SAFETY_FLAGS,
    capabilities: P0_TRUSTED_WRITER_CAPABILITIES,
    attestationResult: "PASS",
    issuedAt: new Date(now - 1_000).toISOString(),
    expiresAt: new Date(now + 60_000).toISOString(),
    ...overrides,
  };
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const signature = sign(
    null,
    p0TrustedWriterAttestationSigningPayload(candidate),
    privateKey,
  );
  const envelope: P0TrustedWriterReadinessEnvelope = {
    keyId: "trusted-writer-local-key-v1",
    candidate,
    signatureBase64Url: signature.toString("base64url"),
  };
  process.env.P0_TRUSTED_WRITER_ATTESTATION_ENVELOPE_BASE64URL = Buffer.from(
    JSON.stringify(envelope),
    "utf8",
  ).toString("base64url");
  process.env.P0_TRUSTED_WRITER_ATTESTATION_PUBLIC_KEY_DER_BASE64URL = (
    publicKey.export({ format: "der", type: "spki" }) as Buffer
  ).toString("base64url");
  process.env.P0_TRUSTED_WRITER_ATTESTATION_KEY_ID = envelope.keyId;
  process.env.P0_TRUSTED_WRITER_CODE_REVISION = candidate.codeRevision;
  process.env.P0_TRUSTED_WRITER_IMPLEMENTATION_SHA256 =
    candidate.implementationSourceSha256;
  process.env.P0_TRUSTED_WRITER_SCHEMA_SHA256 = candidate.schemaSha256;
  process.env.P0_TRUSTED_WRITER_MIGRATION_SHA256 = candidate.migrationSha256;
  process.env.P0_TRUSTED_WRITER_ADAPTER_MANIFEST_SHA256 =
    candidate.adapterManifestSha256;
  process.env.P0_TRUSTED_WRITER_STORAGE_CONTRACT_SHA256 =
    candidate.storageContractSha256;
  process.env.P0_TRUSTED_WRITER_VALUE_PROTECTION_CONTRACT_SHA256 =
    candidate.valueProtectionContractSha256;
  process.env.P0_TRUSTED_WRITER_DB_ROLE_CONTRACT_SHA256 =
    candidate.dbRoleContractSha256;
  process.env.P0_TRUSTED_WRITER_DATABASE_ROLE_IDENTITY_SHA256 =
    candidate.databaseRoleIdentitySha256;
  process.env.P0_TRUSTED_WRITER_PRIVILEGED_VALIDATOR_MANIFEST_SHA256 =
    candidate.privilegedValidatorManifestSha256;
  return {
    candidate,
    restoreEnvelope:
      process.env.P0_TRUSTED_WRITER_ATTESTATION_ENVELOPE_BASE64URL,
  };
}

function productionEvidence(
  receipt: VerifiedP0TrustedWriterReadinessReceipt | null,
  migrationSha256: string,
): P0Phase2AReadinessEvidence {
  return {
    migrationVerified: true,
    migrationSha256,
    principalBoundaryVerified: true,
    repositoryBoundaryVerified: true,
    sourceArtifactBoundaryVerified: true,
    ingestionBoundaryVerified: true,
    round0BoundaryVerified: true,
    assertionBoundaryVerified: true,
    repositoryReceipt: null,
    productionRepositoryReceipt: receipt,
  };
}

let passed = 0;
async function check(name: string, run: () => void | Promise<void>) {
  await run();
  passed += 1;
  process.stdout.write(`ok ${passed} - ${name}\n`);
}

async function main() {
  const trackedEnvironment = [
    ...RECEIPT_ENV,
    "P0_PHASE2_ENABLED",
    "P0_PHASE2_KILL_SWITCH",
    "P0_INGESTION_SHADOW_ENABLED",
    "P0_PHASE2_COHORT_VERSION",
    "P0_PHASE2_COHORT_SCOPE_SHA256S",
    "P0_WORKER_TOKEN_HMAC_KEY_BASE64URL",
    "P0_WORKER_PRINCIPAL_ID",
  ] as const;
  const priorEnvironment = new Map(
    trackedEnvironment.map((key) => [key, process.env[key]]),
  );
  try {
    users.set("consumer-direct", user("consumer-direct"));
    users.set("agency-1", user("agency-1", { isAgency: true }));
    users.set(
      "client-1",
      user("client-1", { managedByAgencyId: "agency-1" }),
    );
    users.set("agency-2", user("agency-2", { isAgency: true }));
    ingestions.set("ingestion-1", {
      id: "ingestion-1",
      tenantId: "consumer-direct",
      consumerId: "consumer-direct",
      revision: 7,
      state: "RECEIVED",
    });

    await check("production adapter source imports currentAccount and never demo/effective-user authority", () => {
      const source = readFileSync(
        new URL("../lib/creditTruth/principalPrismaAdapter.ts", import.meta.url),
        "utf8",
      );
      assert.match(source, /import \{ currentAccount \} from "\.\.\/session"/);
      assert.doesNotMatch(source, /currentUserOrDemo|\bcurrentUser\(/);
    });

    await check("direct principal is server-derived and exactly self-scoped", async () => {
      const principal = await directPrincipal();
      assert.equal(principal.actorId, "consumer-direct");
      assert.equal(principal.tenantId, "consumer-direct");
      assert.equal(principal.consumerId, "consumer-direct");
      assert.equal(principal.authorizationKind, "DIRECT_CONSUMER");
    });

    await check("caller selector cannot manufacture direct or managed authority", async () => {
      sessionActorId = "consumer-direct";
      const denied = await resolveP0InteractivePrincipal(
        {
          authorizationIntent: "DIRECT_OR_MANAGED",
          consumerSelector: "client-1",
        },
        dependencies,
      );
      assert.equal(denied, null);
    });

    await check("disabled authenticated actor fails closed", async () => {
      users.set("consumer-direct", user("consumer-direct", { disabled: true }));
      sessionActorId = "consumer-direct";
      assert.equal(
        await resolveP0InteractivePrincipal(
          { authorizationIntent: "DIRECT_OR_MANAGED" },
          dependencies,
        ),
        null,
      );
      users.set("consumer-direct", user("consumer-direct"));
    });

    await check("managed principal revalidates exact agency-client edge", async () => {
      const principal = await managedPrincipal();
      assert.equal(principal.actorId, "agency-1");
      assert.equal(principal.tenantId, "agency-1");
      assert.equal(principal.consumerId, "client-1");
      assert.equal(principal.authorizationKind, "AGENCY_MANAGED_CLIENT");
    });

    await check("cross-agency client substitution is denied", async () => {
      sessionActorId = "agency-2";
      assert.equal(
        await resolveP0InteractivePrincipal(
          {
            authorizationIntent: "DIRECT_OR_MANAGED",
            consumerSelector: "client-1",
          },
          dependencies,
        ),
        null,
      );
    });

    await check("revoked or disabled managed-client grant fails closed", async () => {
      users.set(
        "client-1",
        user("client-1", { managedByAgencyId: null, p0AuthorizationRevision: 2 }),
      );
      sessionActorId = "agency-1";
      assert.equal(
        await resolveP0InteractivePrincipal(
          {
            authorizationIntent: "DIRECT_OR_MANAGED",
            consumerSelector: "client-1",
          },
          dependencies,
        ),
        null,
      );
      users.set(
        "client-1",
        user("client-1", {
          managedByAgencyId: "agency-1",
          p0AuthorizationRevision: 3,
        }),
      );
    });

    await check("authorization revision prevents revoke-regrant ABA principal replay", async () => {
      const stale = await managedPrincipal();
      const clientRow = users.get("client-1");
      assert(clientRow);
      users.set("client-1", {
        ...clientRow,
        p0AuthorizationRevision: clientRow.p0AuthorizationRevision + 2,
      });
      assert.equal(
        await revalidateP0PrismaPrincipal({
          client,
          principal: stale,
          operationId: "managed-write-1",
        }),
        false,
      );
      const fresh = await managedPrincipal();
      assert.equal(
        await revalidateP0PrismaPrincipal({
          client,
          principal: fresh,
          operationId: "managed-write-2",
        }),
        true,
      );
    });

    await check("cookie-style admin impersonation remains denied without durable delegation", async () => {
      users.set("admin-1", user("admin-1", { role: "ADMIN" }));
      sessionActorId = "admin-1";
      assert.equal(
        await resolveP0InteractivePrincipal(
          {
            authorizationIntent: "ADMIN_IMPERSONATION",
            consumerSelector: "consumer-direct",
          },
          dependencies,
        ),
        null,
      );
    });

    let workerOperationId = "";
    await check("legitimate signed worker operation derives scope from fresh ingestion", async () => {
      workerOperationId =
        (await issueP0WorkerOperationToken(
          { ingestionId: "ingestion-1", purpose: "CLAIM", lifetimeMs: 30_000 },
          {
            client,
            configuration: workerConfiguration,
            nonce: "abcdefghijklmnop",
          },
        )) ?? "";
      assert(workerOperationId);
      const principal = await resolveP0WorkerPrincipal(
        workerOperationId,
        dependencies,
      );
      assert(principal);
      assert.equal(principal.tenantId, "consumer-direct");
      assert.equal(principal.consumerId, "consumer-direct");
      assert.equal(
        await revalidateP0PrismaPrincipal({
          client,
          principal,
          operationId: workerOperationId,
          repositoryPurpose: "INGESTION_CLAIM",
          workerConfiguration,
        }),
        true,
      );
    });

    await check("worker token purpose cannot authorize a different repository operation", () => {
      assert.equal(
        p0WorkerOperationAuthorizesRepositoryPurpose(
          workerOperationId,
          "SHADOW_EXTRACTION_WRITE",
          workerConfiguration,
        ),
        false,
      );
    });

    await check("worker replay becomes stale after ingestion revision advances", async () => {
      const principal = await resolveP0WorkerPrincipal(
        workerOperationId,
        dependencies,
      );
      assert(principal);
      const row = ingestions.get("ingestion-1");
      assert(row);
      ingestions.set("ingestion-1", { ...row, revision: row.revision + 1 });
      assert.equal(
        await revalidateP0PrismaPrincipal({
          client,
          principal,
          operationId: workerOperationId,
          repositoryPurpose: "INGESTION_CLAIM",
          workerConfiguration,
        }),
        false,
      );
    });

    await check("receipt-producing worker capabilities are exact-purpose and transition bounded", async () => {
      const commitOperation = await issueP0WorkerOperationToken(
        {
          ingestionId: "ingestion-1",
          purpose: "COMMIT_VERSION",
          lifetimeMs: 30_000,
        },
        {
          client,
          configuration: workerConfiguration,
          nonce: "VersionCommit1234",
        },
      );
      assert(commitOperation);
      assert.equal(
        p0WorkerOperationAuthorizesRepositoryPurpose(
          commitOperation,
          "REPORT_VERSION_COMMIT",
          workerConfiguration,
        ),
        true,
      );
      assert.equal(
        p0WorkerOperationAuthorizesRepositoryPurpose(
          commitOperation,
          "INGESTION_TRANSITION",
          workerConfiguration,
        ),
        true,
      );
      assert.equal(
        p0WorkerOperationAuthorizesRepositoryPurpose(
          commitOperation,
          "SHADOW_EXTRACTION_WRITE",
          workerConfiguration,
        ),
        false,
      );
      const principal = await resolveP0WorkerPrincipal(
        commitOperation,
        dependencies,
      );
      assert(principal);

      const extractionOperation = await issueP0WorkerOperationToken(
        {
          ingestionId: "ingestion-1",
          purpose: "EXTRACT",
          lifetimeMs: 30_000,
        },
        {
          client,
          configuration: workerConfiguration,
          nonce: "ExtractReceipt123",
        },
      );
      assert(extractionOperation);
      assert.equal(
        p0WorkerOperationAuthorizesRepositoryPurpose(
          extractionOperation,
          "SHADOW_EXTRACTION_WRITE",
          workerConfiguration,
        ),
        true,
      );
      assert.equal(
        p0WorkerOperationAuthorizesRepositoryPurpose(
          extractionOperation,
          "INGESTION_TRANSITION",
          workerConfiguration,
        ),
        true,
      );
      assert.equal(
        p0WorkerOperationAuthorizesRepositoryPurpose(
          extractionOperation,
          "SENSITIVE_ACCESS_AUDIT_APPEND",
          workerConfiguration,
        ),
        false,
      );
    });

    await check("tampered worker MAC is rejected", async () => {
      const last = workerOperationId.slice(-1);
      const tampered = `${workerOperationId.slice(0, -1)}${last === "A" ? "B" : "A"}`;
      assert.equal(await resolveP0WorkerPrincipal(tampered, dependencies), null);
    });

    await check("expired worker operation is rejected", async () => {
      const row = ingestions.get("ingestion-1");
      assert(row);
      const expired = await issueP0WorkerOperationToken(
        { ingestionId: "ingestion-1", purpose: "RECOVER", lifetimeMs: 1_000 },
        {
          client,
          configuration: workerConfiguration,
          now: new Date(Date.now() - 5_000),
          nonce: "qrstuvwxyzABCDEF",
        },
      );
      assert(expired);
      assert.equal(await resolveP0WorkerPrincipal(expired, dependencies), null);
    });

    await check("missing worker secret and default-off flags deny production issuance", async () => {
      delete process.env.P0_WORKER_TOKEN_HMAC_KEY_BASE64URL;
      delete process.env.P0_WORKER_PRINCIPAL_ID;
      delete process.env.P0_PHASE2_ENABLED;
      delete process.env.P0_INGESTION_SHADOW_ENABLED;
      assert.equal(
        await issueP0ProductionWorkerOperationToken({
          ingestionId: "ingestion-1",
          purpose: "RECOVER",
        }),
        null,
      );
    });

    await check("server cohort is absent-false and exact hashed-scope only", async () => {
      const principal = await directPrincipal();
      const scope = p0ScopeFromPrincipal(principal);
      delete process.env.P0_PHASE2_COHORT_VERSION;
      delete process.env.P0_PHASE2_COHORT_SCOPE_SHA256S;
      assert.equal(
        await resolveP0Phase2ACohortFromServerEnvironment({
          principal,
          scope,
          stage: "INGESTION_SHADOW",
        }),
        null,
      );
      process.env.P0_PHASE2_COHORT_VERSION = "cohort-v1";
      process.env.P0_PHASE2_COHORT_SCOPE_SHA256S =
        p0Phase2ACohortScopeSha256(scope);
      const included = await resolveP0Phase2ACohortFromServerEnvironment({
        principal,
        scope,
        stage: "INGESTION_SHADOW",
      });
      assert(included);
      assert.equal(included.included, true);
      process.env.P0_PHASE2_COHORT_SCOPE_SHA256S = "0".repeat(64);
      const excluded = await resolveP0Phase2ACohortFromServerEnvironment({
        principal,
        scope,
        stage: "INGESTION_SHADOW",
      });
      assert(excluded);
      assert.equal(excluded.included, false);
    });

    let receipt: VerifiedP0TrustedWriterReadinessReceipt | null = null;
    let receiptCandidate: P0TrustedWriterReadinessCandidate;
    await check("verify-only Ed25519 readiness receipt binds exact deployment manifests", () => {
      const installed = installSignedReceipt();
      receiptCandidate = installed.candidate;
      receipt = loadP0TrustedWriterReadinessFromServerEnvironment();
      assert(receipt);
      assert.equal(isVerifiedP0TrustedWriterReadinessReceipt(receipt), true);
      assert.equal(receipt.implementationSourceSha256, "a".repeat(64));
      assert.equal(
        receipt.privilegedValidatorManifestSha256,
        "2".repeat(64),
      );
      assert(
        receipt.requiredAdapters.includes("PRIVILEGED_VALIDATOR_BOUNDARY"),
      );
      assert(
        receipt.requiredAdapters.includes("DEDICATED_DATABASE_ROLE_CLIENT"),
      );
      assert(
        receipt.safetyFlags.includes("EXACT_DATABASE_SESSION_ROLE"),
      );
      assert.equal(receipt.configurationMode, "DORMANT_DEFAULT_OFF");
    });

    await check("database-role identity environment drift fails closed", () => {
      assert(receiptCandidate!);
      process.env.P0_TRUSTED_WRITER_DATABASE_ROLE_IDENTITY_SHA256 =
        "7".repeat(64);
      assert.equal(loadP0TrustedWriterReadinessFromServerEnvironment(), null);
      process.env.P0_TRUSTED_WRITER_DATABASE_ROLE_IDENTITY_SHA256 =
        receiptCandidate!.databaseRoleIdentitySha256;
    });

    await check("absent privileged-validator manifest environment fails closed", () => {
      assert(receiptCandidate!);
      delete process.env[
        "P0_TRUSTED_WRITER_PRIVILEGED_VALIDATOR_MANIFEST_SHA256"
      ];
      assert.equal(loadP0TrustedWriterReadinessFromServerEnvironment(), null);
      process.env.P0_TRUSTED_WRITER_PRIVILEGED_VALIDATOR_MANIFEST_SHA256 =
        receiptCandidate!.privilegedValidatorManifestSha256;
    });

    await check("stale privileged-validator manifest environment fails closed", () => {
      assert(receiptCandidate!);
      process.env.P0_TRUSTED_WRITER_PRIVILEGED_VALIDATOR_MANIFEST_SHA256 =
        "8".repeat(64);
      assert.equal(loadP0TrustedWriterReadinessFromServerEnvironment(), null);
      process.env.P0_TRUSTED_WRITER_PRIVILEGED_VALIDATOR_MANIFEST_SHA256 =
        receiptCandidate!.privilegedValidatorManifestSha256;
    });

    await check("privileged-validator manifest tampering invalidates the signature", () => {
      const encoded =
        process.env.P0_TRUSTED_WRITER_ATTESTATION_ENVELOPE_BASE64URL;
      assert(encoded);
      const envelope = JSON.parse(
        Buffer.from(encoded, "base64url").toString("utf8"),
      ) as P0TrustedWriterReadinessEnvelope;
      const forgedManifest = "7".repeat(64);
      const tamperedEnvelope: P0TrustedWriterReadinessEnvelope = {
        ...envelope,
        candidate: {
          ...envelope.candidate,
          privilegedValidatorManifestSha256: forgedManifest,
        },
      };
      process.env.P0_TRUSTED_WRITER_ATTESTATION_ENVELOPE_BASE64URL = Buffer.from(
        JSON.stringify(tamperedEnvelope),
        "utf8",
      ).toString("base64url");
      process.env.P0_TRUSTED_WRITER_PRIVILEGED_VALIDATOR_MANIFEST_SHA256 =
        forgedManifest;
      assert.equal(loadP0TrustedWriterReadinessFromServerEnvironment(), null);
      const restored = installSignedReceipt();
      receiptCandidate = restored.candidate;
    });

    await check("serialized or spread readiness receipt cannot retain authority", () => {
      assert(receipt);
      assert.equal(receipt.privilegedValidatorManifestSha256, "2".repeat(64));
      assert.equal(
        isVerifiedP0TrustedWriterReadinessReceipt({
          ...receipt,
        } as VerifiedP0TrustedWriterReadinessReceipt),
        false,
      );
    });

    await check("readiness signature tampering fails closed", () => {
      const encoded = process.env.P0_TRUSTED_WRITER_ATTESTATION_ENVELOPE_BASE64URL;
      assert(encoded);
      const envelope = JSON.parse(
        Buffer.from(encoded, "base64url").toString("utf8"),
      ) as P0TrustedWriterReadinessEnvelope;
      const final = envelope.signatureBase64Url.slice(-1);
      const tamperedEnvelope: P0TrustedWriterReadinessEnvelope = {
        ...envelope,
        signatureBase64Url: `${envelope.signatureBase64Url.slice(0, -1)}${final === "A" ? "B" : "A"}`,
      };
      process.env.P0_TRUSTED_WRITER_ATTESTATION_ENVELOPE_BASE64URL = Buffer.from(
        JSON.stringify(tamperedEnvelope),
        "utf8",
      ).toString("base64url");
      assert.equal(loadP0TrustedWriterReadinessFromServerEnvironment(), null);
      installSignedReceipt();
    });

    await check("signed receipt cannot be replayed against a different source manifest", () => {
      process.env.P0_TRUSTED_WRITER_IMPLEMENTATION_SHA256 = "9".repeat(64);
      assert.equal(loadP0TrustedWriterReadinessFromServerEnvironment(), null);
      assert(receiptCandidate!);
      process.env.P0_TRUSTED_WRITER_IMPLEMENTATION_SHA256 =
        receiptCandidate!.implementationSourceSha256;
    });

    await check("expired signed receipt is rejected", () => {
      installSignedReceipt({
        issuedAt: new Date(Date.now() - 120_000).toISOString(),
        expiresAt: new Date(Date.now() - 60_000).toISOString(),
      });
      assert.equal(loadP0TrustedWriterReadinessFromServerEnvironment(), null);
      installSignedReceipt();
    });

    await check("production readiness recognizes writer proof but preserves all activation blockers", () => {
      receipt = loadP0TrustedWriterReadinessFromServerEnvironment();
      assert(receipt);
      const result = evaluateP0Phase2AReadiness({
        stage: "ASSERTION_RUNTIME",
        mode: "PRODUCTION_ACTIVATION",
        evidence: productionEvidence(receipt, receipt.migrationSha256),
        now: new Date(),
      });
      assert.equal(result.ready, false);
      assert.equal(result.trustedWriterDependency, "BOUNDED");
      assert.equal(
        result.trustedWriterLocalAttestation,
        "SIGNED_RECEIPT_VERIFIED",
      );
      assert.equal(result.productionActivation, "BLOCKED");
      assert(!result.reasons.includes("AUTHENTICATED_PRODUCTION_REPOSITORY_RECEIPT_REQUIRED"));
      assert(result.reasons.includes("DEPLOYED_DB_ROLE_ATTESTATION_REQUIRED"));
      assert(result.reasons.includes("HARD_PROCESS_ISOLATED_PDF_TERMINATION_REQUIRED"));
      assert(result.reasons.includes("RETENTION_LEGAL_HOLD_APPROVAL_REQUIRED"));
      assert(result.reasons.includes("FOUNDER_ACTIVATION_AUTHORIZATION_REQUIRED"));
    });

    await check("production receipt migration substitution is explicit failure", () => {
      assert(receipt);
      const result = evaluateP0Phase2AReadiness({
        stage: "ROOT",
        mode: "PRODUCTION_ACTIVATION",
        evidence: productionEvidence(receipt, "9".repeat(64)),
        now: new Date(),
      });
      assert(result.reasons.includes("PRODUCTION_REPOSITORY_RECEIPT_MIGRATION_MISMATCH"));
      assert.equal(result.ready, false);
    });

    await check("even satisfied external evidence cannot bypass absent Founder activation authority", () => {
      assert(receipt);
      const result = evaluateP0Phase2AReadiness({
        stage: "ROOT",
        mode: "PRODUCTION_ACTIVATION",
        evidence: {
          ...productionEvidence(receipt, receipt.migrationSha256),
          deployedDbRoleAttested: true,
          hardProcessIsolatedPdfTerminationVerified: true,
          retentionLegalHoldApproved: true,
        },
        now: new Date(),
      });
      assert.deepEqual(result.reasons, ["FOUNDER_ACTIVATION_AUTHORIZATION_REQUIRED"]);
      assert.equal(result.ready, false);
    });

    process.stdout.write(
      `${passed}/${passed} PASS p0-trusted-writer-principal-readiness\n`,
    );
  } finally {
    for (const [key, value] of priorEnvironment.entries()) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
