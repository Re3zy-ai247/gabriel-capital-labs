import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { currentAccount } from "../session";
import {
  isVerifiedP0Principal,
  p0PrincipalAuthorizesScope,
  type P0Principal,
} from "./principal";
import type {
  P0AuthenticatedActor,
  P0ServerPrincipalDependencies,
} from "./principalServer";

export const P0_PRISMA_PRINCIPAL_ADAPTER_ID =
  "creditvector-p0-prisma-principal" as const;
export const P0_PRISMA_PRINCIPAL_ADAPTER_VERSION = "v1" as const;
export const P0_WORKER_TOKEN_CONTRACT_VERSION = "p0w1" as const;

export const P0_WORKER_OPERATION_PURPOSES = [
  "CLAIM",
  "STORE_SOURCE",
  "COMMIT_VERSION",
  "EXTRACT",
  "TRANSITION",
  "RECOVER",
  "RECONCILE",
] as const;
export type P0WorkerOperationPurpose =
  (typeof P0_WORKER_OPERATION_PURPOSES)[number];

export interface P0PrincipalUserRow {
  readonly id: string;
  readonly disabled: boolean;
  readonly role: "USER" | "ADMIN";
  readonly isAgency: boolean;
  readonly managedByAgencyId: string | null;
  readonly p0AuthorizationRevision: number;
}

export interface P0PrincipalIngestionRow {
  readonly id: string;
  readonly tenantId: string;
  readonly consumerId: string;
  readonly revision: number;
  readonly state: string;
}

export interface P0PrincipalPrismaClient {
  readonly user: {
    findUnique(input: {
      readonly where: { readonly id: string };
      readonly select: {
        readonly id: true;
        readonly disabled: true;
        readonly role: true;
        readonly isAgency: true;
        readonly managedByAgencyId: true;
        readonly p0AuthorizationRevision: true;
      };
    }): Promise<P0PrincipalUserRow | null>;
  };
  readonly reportIngestion: {
    findUnique(input: {
      readonly where: { readonly id: string };
      readonly select: {
        readonly id: true;
        readonly tenantId: true;
        readonly consumerId: true;
        readonly revision: true;
        readonly state: true;
      };
    }): Promise<P0PrincipalIngestionRow | null>;
  };
}

export interface P0TransactionalPrincipalPrismaClient
  extends P0PrincipalPrismaClient {
  $transaction<T>(
    work: (transaction: P0PrincipalPrismaClient) => Promise<T>,
    options?: {
      readonly isolationLevel?: "Serializable";
      readonly maxWait?: number;
      readonly timeout?: number;
    },
  ): Promise<T>;
}

export interface P0WorkerTokenConfiguration {
  readonly workerActorId: string;
  readonly hmacKey: Uint8Array;
}

export interface P0PrismaPrincipalAdapterDependencies {
  readonly client: P0PrincipalPrismaClient;
  readonly resolveAuthenticatedAccount: () => Promise<P0PrincipalUserRow | null>;
  readonly resolveWorkerTokenConfiguration: () => P0WorkerTokenConfiguration | null;
}

export interface P0IssueWorkerTokenInput {
  /** Selector only; scope and revision are always reread from ReportIngestion. */
  readonly ingestionId: string;
  readonly purpose: P0WorkerOperationPurpose;
  readonly lifetimeMs?: number;
}

interface ParsedP0WorkerToken {
  readonly operationId: string;
  readonly ingestionId: string;
  readonly expectedRevision: number;
  readonly purpose: P0WorkerOperationPurpose;
  readonly issuedAtMs: number;
  readonly expiresAtMs: number;
  readonly nonce: string;
}

const USER_SELECT = Object.freeze({
  id: true,
  disabled: true,
  role: true,
  isAgency: true,
  managedByAgencyId: true,
  p0AuthorizationRevision: true,
} as const);

const INGESTION_SELECT = Object.freeze({
  id: true,
  tenantId: true,
  consumerId: true,
  revision: true,
  state: true,
} as const);

const STABLE = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,199}$/;
const BASE64URL = /^[A-Za-z0-9_-]+$/;
const NONCE = /^[A-Za-z0-9_-]{16,43}$/;
const WORKER_TOKEN_MAX_LIFETIME_MS = 45_000;
const WORKER_TOKEN_MAX_CLOCK_SKEW_MS = 2_000;
const WORKER_TOKEN_ENV_KEY = "P0_WORKER_TOKEN_HMAC_KEY_BASE64URL";
const WORKER_ACTOR_ENV_KEY = "P0_WORKER_PRINCIPAL_ID";

function semanticHash(parts: readonly (string | number | boolean | null)[]): string {
  const hash = createHash("sha256");
  for (const part of parts) {
    const value = part === null ? "null" : String(part);
    hash.update(String(Buffer.byteLength(value, "utf8")), "utf8");
    hash.update(":", "utf8");
    hash.update(value, "utf8");
    hash.update(";", "utf8");
  }
  return hash.digest("hex");
}

function validUser(row: P0PrincipalUserRow | null): row is P0PrincipalUserRow {
  return Boolean(
    row &&
      STABLE.test(row.id) &&
      typeof row.disabled === "boolean" &&
      (row.role === "USER" || row.role === "ADMIN") &&
      typeof row.isAgency === "boolean" &&
      (row.managedByAgencyId === null || STABLE.test(row.managedByAgencyId)) &&
      Number.isSafeInteger(row.p0AuthorizationRevision) &&
      row.p0AuthorizationRevision >= 1,
  );
}

function validIngestion(
  row: P0PrincipalIngestionRow | null,
): row is P0PrincipalIngestionRow {
  return Boolean(
    row &&
      STABLE.test(row.id) &&
      STABLE.test(row.tenantId) &&
      STABLE.test(row.consumerId) &&
      Number.isSafeInteger(row.revision) &&
      row.revision >= 1 &&
      STABLE.test(row.state),
  );
}

async function readUser(
  client: P0PrincipalPrismaClient,
  id: string,
): Promise<P0PrincipalUserRow | null> {
  if (!STABLE.test(id)) return null;
  try {
    const row = await client.user.findUnique({
      where: { id },
      select: USER_SELECT,
    });
    return validUser(row) ? row : null;
  } catch {
    return null;
  }
}

async function readIngestion(
  client: P0PrincipalPrismaClient,
  id: string,
): Promise<P0PrincipalIngestionRow | null> {
  if (!STABLE.test(id)) return null;
  try {
    const row = await client.reportIngestion.findUnique({
      where: { id },
      select: INGESTION_SELECT,
    });
    return validIngestion(row) ? row : null;
  } catch {
    return null;
  }
}

function directAuthorizationVersion(row: P0PrincipalUserRow): string {
  return `p0-authz-direct:${semanticHash([
    P0_PRISMA_PRINCIPAL_ADAPTER_VERSION,
    row.id,
    row.p0AuthorizationRevision,
    row.disabled,
    row.role,
    row.isAgency,
    row.managedByAgencyId,
  ])}`;
}

function managedAuthorizationVersion(
  actor: P0PrincipalUserRow,
  consumer: P0PrincipalUserRow,
): string {
  return `p0-authz-managed:${semanticHash([
    P0_PRISMA_PRINCIPAL_ADAPTER_VERSION,
    actor.id,
    actor.p0AuthorizationRevision,
    actor.disabled,
    actor.role,
    actor.isAgency,
    consumer.id,
    consumer.p0AuthorizationRevision,
    consumer.disabled,
    consumer.managedByAgencyId,
  ])}`;
}

function grantId(kind: "direct" | "managed", parts: readonly string[]): string {
  return `p0-grant-${kind}:${semanticHash([kind, ...parts])}`;
}

function strictBase64UrlBytes(value: unknown): Buffer | null {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > 256 ||
    !BASE64URL.test(value)
  ) {
    return null;
  }
  try {
    const decoded = Buffer.from(value, "base64url");
    return decoded.length > 0 && decoded.toString("base64url") === value
      ? decoded
      : null;
  } catch {
    return null;
  }
}

function validWorkerConfiguration(
  configuration: P0WorkerTokenConfiguration | null | undefined,
): configuration is P0WorkerTokenConfiguration {
  return Boolean(
    configuration &&
      STABLE.test(configuration.workerActorId) &&
      configuration.hmacKey instanceof Uint8Array &&
      configuration.hmacKey.byteLength >= 32 &&
      configuration.hmacKey.byteLength <= 64,
  );
}

export function p0WorkerTokenConfigurationFromServerEnvironment():
  | P0WorkerTokenConfiguration
  | null {
  const workerActorId = process.env[WORKER_ACTOR_ENV_KEY];
  const key = strictBase64UrlBytes(process.env[WORKER_TOKEN_ENV_KEY]);
  if (
    typeof workerActorId !== "string" ||
    !STABLE.test(workerActorId) ||
    !key
  ) {
    return null;
  }
  const configuration = Object.freeze({
    workerActorId,
    hmacKey: new Uint8Array(key),
  });
  return validWorkerConfiguration(configuration) ? configuration : null;
}

function workerTokenMac(
  unsignedToken: string,
  configuration: P0WorkerTokenConfiguration,
): string {
  return createHmac("sha256", configuration.hmacKey)
    .update("CreditVector/P0/worker-operation/v1\n", "utf8")
    .update(unsignedToken, "utf8")
    .digest("base64url");
}

function parseWorkerToken(
  operationId: string,
  configuration: P0WorkerTokenConfiguration,
  nowMs: number,
): ParsedP0WorkerToken | null {
  if (!STABLE.test(operationId) || operationId.length > 200) return null;
  const pieces = operationId.split(".");
  if (pieces.length !== 8 || pieces[0] !== P0_WORKER_TOKEN_CONTRACT_VERSION) {
    return null;
  }
  const [version, encodedIngestion, revisionText, purpose, issuedText, expiresText, nonce, suppliedMac] = pieces;
  if (
    version !== P0_WORKER_TOKEN_CONTRACT_VERSION ||
    !P0_WORKER_OPERATION_PURPOSES.includes(purpose as P0WorkerOperationPurpose) ||
    !/^\d{1,10}$/.test(revisionText) ||
    !/^\d{10}$/.test(issuedText) ||
    !/^\d{10}$/.test(expiresText) ||
    !NONCE.test(nonce) ||
    !BASE64URL.test(suppliedMac)
  ) {
    return null;
  }
  const ingestionBytes = strictBase64UrlBytes(encodedIngestion);
  if (!ingestionBytes || ingestionBytes.length > 200) return null;
  const ingestionId = ingestionBytes.toString("utf8");
  if (!STABLE.test(ingestionId)) return null;
  const expectedRevision = Number(revisionText);
  const issuedAtMs = Number(issuedText) * 1_000;
  const expiresAtMs = Number(expiresText) * 1_000;
  if (
    !Number.isSafeInteger(expectedRevision) ||
    expectedRevision < 1 ||
    !Number.isFinite(issuedAtMs) ||
    !Number.isFinite(expiresAtMs) ||
    issuedAtMs > nowMs + WORKER_TOKEN_MAX_CLOCK_SKEW_MS ||
    expiresAtMs <= nowMs ||
    expiresAtMs <= issuedAtMs ||
    expiresAtMs - issuedAtMs > WORKER_TOKEN_MAX_LIFETIME_MS + 1_000
  ) {
    return null;
  }
  const unsigned = pieces.slice(0, 7).join(".");
  const expectedMac = workerTokenMac(unsigned, configuration);
  const supplied = Buffer.from(suppliedMac, "utf8");
  const expected = Buffer.from(expectedMac, "utf8");
  if (
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  ) {
    return null;
  }
  return Object.freeze({
    operationId,
    ingestionId,
    expectedRevision,
    purpose: purpose as P0WorkerOperationPurpose,
    issuedAtMs,
    expiresAtMs,
    nonce,
  });
}

function workerAuthorizationVersion(input: {
  readonly token: ParsedP0WorkerToken;
  readonly row: P0PrincipalIngestionRow;
  readonly workerActorId: string;
}): string {
  return `p0-authz-worker:${semanticHash([
    P0_PRISMA_PRINCIPAL_ADAPTER_VERSION,
    input.workerActorId,
    input.token.operationId,
    input.token.purpose,
    input.row.id,
    input.row.tenantId,
    input.row.consumerId,
    input.row.revision,
  ])}`;
}

function productionWriterFlagsEnabled(): boolean {
  return (
    process.env.P0_PHASE2_ENABLED === "true" &&
    process.env.P0_PHASE2_KILL_SWITCH !== "true" &&
    process.env.P0_INGESTION_SHADOW_ENABLED === "true"
  );
}

export async function issueP0WorkerOperationToken(
  input: P0IssueWorkerTokenInput,
  dependencies: {
    readonly client: P0PrincipalPrismaClient;
    readonly configuration: P0WorkerTokenConfiguration;
    readonly now?: Date;
    readonly nonce?: string;
  },
): Promise<string | null> {
  if (
    !input ||
    !STABLE.test(input.ingestionId) ||
    !P0_WORKER_OPERATION_PURPOSES.includes(input.purpose) ||
    !validWorkerConfiguration(dependencies.configuration)
  ) {
    return null;
  }
  const now = dependencies.now ?? new Date(Date.now());
  const nowMs = now.getTime();
  const lifetimeMs = input.lifetimeMs ?? 30_000;
  if (
    !Number.isFinite(nowMs) ||
    !Number.isSafeInteger(lifetimeMs) ||
    lifetimeMs < 1_000 ||
    lifetimeMs > WORKER_TOKEN_MAX_LIFETIME_MS
  ) {
    return null;
  }
  const row = await readIngestion(dependencies.client, input.ingestionId);
  if (!row) return null;
  const nonce = dependencies.nonce ?? randomBytes(12).toString("base64url");
  if (!NONCE.test(nonce)) return null;
  const issuedSeconds = Math.floor(nowMs / 1_000);
  const expiresSeconds = Math.floor((nowMs + lifetimeMs) / 1_000);
  if (expiresSeconds <= issuedSeconds) return null;
  const unsigned = [
    P0_WORKER_TOKEN_CONTRACT_VERSION,
    Buffer.from(row.id, "utf8").toString("base64url"),
    row.revision,
    input.purpose,
    issuedSeconds,
    expiresSeconds,
    nonce,
  ].join(".");
  const token = `${unsigned}.${workerTokenMac(unsigned, dependencies.configuration)}`;
  return token.length <= 200 && STABLE.test(token) ? token : null;
}

/** Server-only issuer. Missing/default-off environment state is a denial. */
export async function issueP0ProductionWorkerOperationToken(
  input: P0IssueWorkerTokenInput,
  dependencies?: {
    readonly client: P0TransactionalPrincipalPrismaClient;
  },
): Promise<string | null> {
  if (!productionWriterFlagsEnabled() || !dependencies?.client) return null;
  const configuration = p0WorkerTokenConfigurationFromServerEnvironment();
  if (!configuration) return null;
  try {
    return await dependencies.client.$transaction(
      (transaction) =>
        issueP0WorkerOperationToken(input, {
          client: transaction,
          configuration,
        }),
      { isolationLevel: "Serializable" },
    );
  } catch {
    return null;
  }
}

export function p0WorkerOperationAuthorizesRepositoryPurpose(
  operationId: string,
  repositoryPurpose: string,
  configuration: P0WorkerTokenConfiguration,
  nowMs: number = Date.now(),
): boolean {
  const token = parseWorkerToken(operationId, configuration, nowMs);
  if (!token) return false;
  const allowed: Readonly<Record<P0WorkerOperationPurpose, readonly string[]>> = {
    CLAIM: ["INGESTION_CLAIM"],
    STORE_SOURCE: [
      "SOURCE_ARTIFACT_WRITE",
      "SOURCE_ARTIFACT_READ",
      "SENSITIVE_ACCESS_AUDIT_APPEND",
      "SENSITIVE_ACCESS_AUDIT_READBACK",
    ],
    COMMIT_VERSION: [
      "REPORT_VERSION_COMMIT",
      "SOURCE_ARTIFACT_READ",
      "INGESTION_TRANSITION",
    ],
    EXTRACT: [
      "SOURCE_ARTIFACT_READ",
      "EXTRACTION_INPUT_COMMIT",
      "SHADOW_EXTRACTION_READ",
      "SHADOW_EXTRACTION_WRITE",
      "INGESTION_TRANSITION",
    ],
    TRANSITION: ["INGESTION_TRANSITION"],
    RECOVER: ["INGESTION_RECOVERY", "SOURCE_ARTIFACT_READ"],
    RECONCILE: ["INGESTION_RECOVERY"],
  };
  return allowed[token.purpose].includes(repositoryPurpose);
}

async function resolveWorkerReceipt(
  operationId: string,
  client: P0PrincipalPrismaClient,
  configuration: P0WorkerTokenConfiguration | null,
) {
  if (!validWorkerConfiguration(configuration)) return null;
  const token = parseWorkerToken(operationId, configuration, Date.now());
  if (!token) return null;
  const row = await readIngestion(client, token.ingestionId);
  if (!row || row.revision !== token.expectedRevision) return null;
  return {
    kind: "SYSTEM_WORKER" as const,
    operationId,
    actorId: configuration.workerActorId,
    tenantId: row.tenantId,
    consumerId: row.consumerId,
    authorizationVersion: workerAuthorizationVersion({
      token,
      row,
      workerActorId: configuration.workerActorId,
    }),
    active: true as const,
    expiresAt: new Date(token.expiresAtMs).toISOString(),
  };
}

export function createP0PrismaServerPrincipalDependencies(
  dependencies: P0PrismaPrincipalAdapterDependencies,
): P0ServerPrincipalDependencies {
  return Object.freeze({
    async resolveAuthenticatedActor(): Promise<P0AuthenticatedActor | null> {
      let account: P0PrincipalUserRow | null;
      try {
        account = await dependencies.resolveAuthenticatedAccount();
      } catch {
        return null;
      }
      if (!validUser(account) || account.disabled) return null;
      return Object.freeze({
        id: account.id,
        disabled: false,
        role: account.role,
        isAgency: account.isAgency,
      });
    },

    async revalidateDirectConsumerGrant({ actorId }: { readonly actorId: string }) {
      const actor = await readUser(dependencies.client, actorId);
      if (!actor || actor.disabled || actor.managedByAgencyId !== null) return null;
      return Object.freeze({
        kind: "DIRECT_CONSUMER" as const,
        grantId: grantId("direct", [actor.id, String(actor.p0AuthorizationRevision)]),
        actorId: actor.id,
        tenantId: actor.id,
        consumerId: actor.id,
        authorizationVersion: directAuthorizationVersion(actor),
        active: true as const,
      });
    },

    async revalidateManagedClientGrant({ actorId, consumerId }: {
      readonly actorId: string;
      readonly consumerId: string;
    }) {
      const actor = await readUser(dependencies.client, actorId);
      if (!actor || actor.disabled || !actor.isAgency) return null;
      const consumer = await readUser(dependencies.client, consumerId);
      if (
        !consumer ||
        consumer.disabled ||
        consumer.id === actor.id ||
        consumer.managedByAgencyId !== actor.id
      ) {
        return null;
      }
      return Object.freeze({
        kind: "AGENCY_MANAGED_CLIENT" as const,
        grantId: grantId("managed", [
          actor.id,
          String(actor.p0AuthorizationRevision),
          consumer.id,
          String(consumer.p0AuthorizationRevision),
        ]),
        actorId: actor.id,
        tenantId: actor.id,
        consumerId: consumer.id,
        authorizationVersion: managedAuthorizationVersion(actor, consumer),
        active: true as const,
      });
    },

    // Existing admin impersonation is cookie selection, not a durable delegated
    // P0 grant. It remains denied until separately modeled and authorized.
    async revalidateAdminDelegation() {
      return null;
    },

    async resolveWorkerOperation({ operationId }: { readonly operationId: string }) {
      return resolveWorkerReceipt(
        operationId,
        dependencies.client,
        dependencies.resolveWorkerTokenConfiguration(),
      );
    },
  });
}

/** Concrete application adapter: real session account only, never demo/effective user. */
export function createP0ProductionServerPrincipalDependencies(
  client: P0PrincipalPrismaClient,
): P0ServerPrincipalDependencies {
  return createP0PrismaServerPrincipalDependencies({
    client,
    async resolveAuthenticatedAccount() {
      const account = await currentAccount();
      return account ? (account as unknown as P0PrincipalUserRow) : null;
    },
    resolveWorkerTokenConfiguration:
      p0WorkerTokenConfigurationFromServerEnvironment,
  });
}

/**
 * Repository-side live revalidation. Concrete repositories call this inside
 * the same transaction as every authority-producing mutation/readback.
 */
export async function revalidateP0PrismaPrincipal(input: {
  readonly client: P0PrincipalPrismaClient;
  readonly principal: P0Principal;
  readonly operationId: string;
  readonly repositoryPurpose?: string;
  readonly workerConfiguration?: P0WorkerTokenConfiguration | null;
}): Promise<boolean> {
  const { principal } = input;
  if (
    !isVerifiedP0Principal(principal) ||
    !p0PrincipalAuthorizesScope(principal, {
      tenantId: principal.tenantId,
      consumerId: principal.consumerId,
    }) ||
    !STABLE.test(input.operationId)
  ) {
    return false;
  }

  if (principal.authorizationKind === "DIRECT_CONSUMER") {
    if (
      principal.actorId !== principal.tenantId ||
      principal.tenantId !== principal.consumerId
    ) {
      return false;
    }
    const actor = await readUser(input.client, principal.actorId);
    return Boolean(
      actor &&
        !actor.disabled &&
        actor.managedByAgencyId === null &&
        directAuthorizationVersion(actor) === principal.authorizationVersion,
    );
  }

  if (principal.authorizationKind === "AGENCY_MANAGED_CLIENT") {
    if (principal.actorId !== principal.tenantId) return false;
    const actor = await readUser(input.client, principal.actorId);
    if (!actor || actor.disabled || !actor.isAgency) return false;
    const consumer = await readUser(input.client, principal.consumerId);
    return Boolean(
      consumer &&
        !consumer.disabled &&
        consumer.managedByAgencyId === actor.id &&
        managedAuthorizationVersion(actor, consumer) ===
          principal.authorizationVersion,
    );
  }

  if (principal.authorizationKind === "ADMIN_IMPERSONATION") return false;

  const configuration = input.workerConfiguration === undefined
    ? p0WorkerTokenConfigurationFromServerEnvironment()
    : input.workerConfiguration;
  if (!configuration || input.operationId.length > 200) return false;
  if (
    input.repositoryPurpose &&
    !p0WorkerOperationAuthorizesRepositoryPurpose(
      input.operationId,
      input.repositoryPurpose,
      configuration,
    )
  ) {
    return false;
  }
  const receipt = await resolveWorkerReceipt(
    input.operationId,
    input.client,
    configuration,
  );
  return Boolean(
    receipt &&
      receipt.actorId === principal.actorId &&
      receipt.tenantId === principal.tenantId &&
      receipt.consumerId === principal.consumerId &&
      receipt.authorizationVersion === principal.authorizationVersion,
  );
}
