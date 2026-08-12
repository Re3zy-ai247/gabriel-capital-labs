import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";

export const P0_TRUSTED_WRITER_DATABASE_CLIENT_CONTRACT_VERSION =
  "p0-trusted-writer-dedicated-database-client-v1" as const;
export const P0_TRUSTED_WRITER_DATABASE_URL_ENV =
  "P0_TRUSTED_WRITER_DATABASE_URL" as const;
export const P0_TRUSTED_WRITER_DATABASE_ROLE_ENV =
  "P0_TRUSTED_WRITER_DATABASE_ROLE" as const;

const SAFE_WRITER_ROLE = /^p0_writer_[a-z0-9_]{1,48}$/;
const MAX_DATABASE_URL_LENGTH = 4_096;

interface P0DatabaseRoleRow {
  readonly currentRole: string;
  readonly sessionRole: string;
}

interface P0RoleQueryTransaction {
  $queryRaw<T = unknown>(
    query: TemplateStringsArray,
    ...values: readonly unknown[]
  ): Promise<T>;
}

interface P0DedicatedDatabaseConfiguration {
  readonly databaseUrl: string;
  readonly expectedRole: string;
  readonly roleIdentitySha256: string;
  readonly privateConfigurationSha256: string;
}

export interface P0ProductionTrustedWriterPrismaClientProvider {
  readonly contractVersion: typeof P0_TRUSTED_WRITER_DATABASE_CLIENT_CONTRACT_VERSION;
  readonly expectedRole: string;
  readonly roleIdentitySha256: string;
  /** Lazily constructs a client; construction performs no connection or query. */
  readonly getClient: () => PrismaClient;
}

interface P0ProductionClientState {
  readonly privateConfigurationSha256: string;
  readonly rawClient: PrismaClient;
  readonly roleBoundClient: PrismaClient;
}

let productionClientState: P0ProductionClientState | null = null;
const roleBoundClients = new WeakMap<object, string>();

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function p0TrustedWriterDatabaseRoleIdentitySha256(
  expectedRole: string,
): string {
  return sha256(
    `${P0_TRUSTED_WRITER_DATABASE_CLIENT_CONTRACT_VERSION}\n${expectedRole}`,
  );
}

function decodeUrlUsername(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function loadDedicatedDatabaseConfiguration(): P0DedicatedDatabaseConfiguration | null {
  const databaseUrl = process.env[P0_TRUSTED_WRITER_DATABASE_URL_ENV];
  const expectedRole = process.env[P0_TRUSTED_WRITER_DATABASE_ROLE_ENV];
  if (
    typeof databaseUrl !== "string" ||
    databaseUrl.length < 1 ||
    databaseUrl.length > MAX_DATABASE_URL_LENGTH ||
    typeof expectedRole !== "string" ||
    !SAFE_WRITER_ROLE.test(expectedRole) ||
    (typeof process.env.DATABASE_URL === "string" &&
      process.env.DATABASE_URL === databaseUrl)
  ) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    return null;
  }
  const username = decodeUrlUsername(parsed.username);
  if (
    (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") ||
    parsed.hash !== "" ||
    !username ||
    username !== expectedRole ||
    parsed.password.length < 1 ||
    parsed.hostname.length < 1 ||
    parsed.pathname.length <= 1
  ) {
    return null;
  }

  const roleIdentitySha256 =
    p0TrustedWriterDatabaseRoleIdentitySha256(expectedRole);
  return Object.freeze({
    databaseUrl,
    expectedRole,
    roleIdentitySha256,
    // Never expose the URL or a digest that could be mistaken for attestation
    // evidence. This private key only prevents singleton reuse after config drift.
    privateConfigurationSha256: sha256(
      `${P0_TRUSTED_WRITER_DATABASE_CLIENT_CONTRACT_VERSION}\n${databaseUrl}`,
    ),
  });
}

/**
 * Checks the actual login and effective role in the transaction that is about
 * to perform authority work. SET ROLE from an admin connection cannot satisfy
 * the session-role check.
 */
export async function assertP0TrustedWriterDatabaseRoleInTransaction(
  transaction: P0RoleQueryTransaction,
  expectedRole: string,
): Promise<void> {
  if (!SAFE_WRITER_ROLE.test(expectedRole)) {
    throw new Error("trusted-writer database role verification failed");
  }
  let rows: readonly P0DatabaseRoleRow[];
  try {
    rows = await transaction.$queryRaw<readonly P0DatabaseRoleRow[]>`
      SELECT
        current_user::text AS "currentRole",
        session_user::text AS "sessionRole"
    `;
  } catch {
    throw new Error("trusted-writer database role verification failed");
  }
  const row = rows.length === 1 ? rows[0] : null;
  if (
    !row ||
    row.currentRole !== expectedRole ||
    row.sessionRole !== expectedRole
  ) {
    throw new Error("trusted-writer database role verification failed");
  }
}

/**
 * Wraps every interactive transaction with an exact role check before its
 * callback runs. Batch transactions are deliberately unavailable to this
 * boundary because they cannot insert the pre-mutation check atomically.
 */
export function bindP0TrustedWriterPrismaClientToDatabaseRole(input: {
  readonly client: PrismaClient;
  readonly expectedRole: string;
}): PrismaClient {
  if (!input?.client || !SAFE_WRITER_ROLE.test(input.expectedRole)) {
    throw new Error("trusted-writer database role binding denied");
  }
  const rawClient = input.client;
  const runTransaction = rawClient.$transaction.bind(rawClient) as unknown as <T>(
    work: (transaction: P0RoleQueryTransaction) => Promise<T>,
    options?: unknown,
  ) => Promise<T>;
  const guardedTransaction = async <T>(
    work: (transaction: P0RoleQueryTransaction) => Promise<T>,
    options?: unknown,
  ): Promise<T> => {
    if (typeof work !== "function") {
      throw new Error("trusted-writer batch transaction denied");
    }
    return runTransaction(async (transaction) => {
      await assertP0TrustedWriterDatabaseRoleInTransaction(
        transaction,
        input.expectedRole,
      );
      return work(transaction);
    }, options);
  };

  const roleBoundClient = new Proxy(rawClient, {
    get(target, property) {
      if (property === "$transaction") return guardedTransaction;
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as PrismaClient;
  roleBoundClients.set(roleBoundClient, input.expectedRole);
  return roleBoundClient;
}

export function isP0TrustedWriterDatabaseRoleBoundPrismaClient(
  client: PrismaClient,
  expectedRole?: string,
): boolean {
  const boundRole =
    client && typeof client === "object" ? roleBoundClients.get(client) : null;
  return Boolean(
    boundRole &&
      (expectedRole === undefined ||
        (SAFE_WRITER_ROLE.test(expectedRole) && boundRole === expectedRole)),
  );
}

/**
 * Resolves only server-owned configuration and captures the credential in a
 * closure. It does not instantiate Prisma, connect, or query. Missing,
 * malformed, shared-global, or role-mismatched configuration returns null.
 */
export function createP0ProductionTrustedWriterPrismaClientProvider(): P0ProductionTrustedWriterPrismaClientProvider | null {
  const configuration = loadDedicatedDatabaseConfiguration();
  if (!configuration) return null;
  return Object.freeze({
    contractVersion: P0_TRUSTED_WRITER_DATABASE_CLIENT_CONTRACT_VERSION,
    expectedRole: configuration.expectedRole,
    roleIdentitySha256: configuration.roleIdentitySha256,
    getClient(): PrismaClient {
      if (productionClientState) {
        if (
          productionClientState.privateConfigurationSha256 !==
          configuration.privateConfigurationSha256
        ) {
          throw new Error("trusted-writer database configuration drift");
        }
        return productionClientState.roleBoundClient;
      }
      const rawClient = new PrismaClient({
        datasources: { db: { url: configuration.databaseUrl } },
      });
      const roleBoundClient = bindP0TrustedWriterPrismaClientToDatabaseRole({
        client: rawClient,
        expectedRole: configuration.expectedRole,
      });
      productionClientState = Object.freeze({
        privateConfigurationSha256: configuration.privateConfigurationSha256,
        rawClient,
        roleBoundClient,
      });
      return roleBoundClient;
    },
  });
}

/** Explicit lifecycle hook for a graceful server shutdown or isolated test. */
export async function disconnectP0ProductionTrustedWriterPrismaClient(): Promise<void> {
  const state = productionClientState;
  productionClientState = null;
  if (state) await state.rawClient.$disconnect();
}
