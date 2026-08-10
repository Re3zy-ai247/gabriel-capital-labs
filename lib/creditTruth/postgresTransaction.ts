/**
 * Fail-closed PostgreSQL transaction boundary for P0 durable-truth writers.
 *
 * This module does not open a database connection. A trusted repository adapter
 * supplies one operation which resolves only after its transaction commits.
 * Retries are disabled unless an independent verifier attests that the exact
 * operation is idempotent under one stable operation identity.
 */

export const P0_POSTGRES_TRANSACTION_CONTRACT_VERSION =
  "p0-postgres-transaction-v1" as const;
export const P0_POSTGRES_DEADLOCK_SQLSTATE = "40P01" as const;
export const P0_POSTGRES_MAX_TRANSACTION_ATTEMPTS = 3 as const;

const VERIFIED_RETRY_ATTESTATION = Symbol("verified-p0-retry-attestation");
const verifiedRetryAttestations = new WeakSet<object>();
const verifiedRetryBindings = new WeakMap<object, string>();

export type P0PostgresRetryAttempts = 2 | 3;

export interface P0PostgresRetryAttestationCandidate {
  readonly contractVersion: typeof P0_POSTGRES_TRANSACTION_CONTRACT_VERSION;
  readonly operationId: string;
  readonly idempotencyKey: string;
  readonly maxAttempts: P0PostgresRetryAttempts;
  readonly retryClass: "EXACT_POSTGRES_40P01_ONLY";
  readonly semanticAttestationId: string;
}

export interface P0PostgresRetryAttestationVerifier {
  /**
   * The verifier is the trusted-writer boundary. It must establish that the
   * operation uses the supplied idempotency key inside the same transaction and
   * that replay cannot mint a second durable truth object or side effect.
   */
  verifyIdempotentOperation(input: {
    readonly candidate: P0PostgresRetryAttestationCandidate;
  }): Promise<boolean>;
}

export interface VerifiedP0PostgresRetryAttestation
  extends P0PostgresRetryAttestationCandidate {
  readonly [VERIFIED_RETRY_ATTESTATION]: true;
}

export interface P0PostgresTransactionAttemptContext {
  readonly operationId: string;
  readonly idempotencyKey: string | null;
  readonly attempt: number;
  readonly maxAttempts: number;
}

export interface P0PostgresTransactionRequest<T> {
  readonly operationId: string;
  /**
   * Must resolve only after the database transaction has committed. A thrown or
   * rejected value is never converted to a successful business result.
   */
  readonly execute: (context: P0PostgresTransactionAttemptContext) => Promise<T>;
  readonly retryAttestation?: VerifiedP0PostgresRetryAttestation;
}

interface P0PostgresTransactionResultBase {
  readonly operationId: string;
  readonly attempts: number;
}

export interface P0PostgresTransactionCommitted<T>
  extends P0PostgresTransactionResultBase {
  readonly ok: true;
  readonly kind: "COMMITTED";
  readonly outcome: "COMMITTED";
  readonly value: T;
}

export interface P0PostgresTransactionInputRejected
  extends P0PostgresTransactionResultBase {
  readonly ok: false;
  readonly kind: "INPUT_REJECTED";
  readonly outcome: "NOT_ATTEMPTED";
  readonly reason:
    | "INVALID_OPERATION_ID"
    | "INVALID_EXECUTOR"
    | "UNVERIFIED_RETRY_ATTESTATION"
    | "RETRY_ATTESTATION_OPERATION_MISMATCH";
}

export interface P0PostgresTransactionValidationRejected
  extends P0PostgresTransactionResultBase {
  readonly ok: false;
  readonly kind: "VALIDATION_REJECTED";
  readonly outcome: "ROLLED_BACK";
  readonly databaseCode: string;
  readonly retryable: false;
}

export interface P0PostgresDeadlockDetected
  extends P0PostgresTransactionResultBase {
  readonly ok: false;
  readonly kind: "DEADLOCK_DETECTED";
  readonly outcome: "ROLLED_BACK";
  readonly databaseCode: typeof P0_POSTGRES_DEADLOCK_SQLSTATE;
  readonly retryable: false;
  readonly retryAuthorized: false;
}

export interface P0PostgresDeadlockRetryExhausted
  extends P0PostgresTransactionResultBase {
  readonly ok: false;
  readonly kind: "DEADLOCK_RETRY_EXHAUSTED";
  readonly outcome: "ROLLED_BACK";
  readonly databaseCode: typeof P0_POSTGRES_DEADLOCK_SQLSTATE;
  readonly retryable: false;
  readonly retryAuthorized: true;
  readonly idempotencyKey: string;
}

export interface P0PostgresTransactionOutcomeUnknown
  extends P0PostgresTransactionResultBase {
  readonly ok: false;
  readonly kind: "TRANSACTION_OUTCOME_UNKNOWN";
  readonly outcome: "UNKNOWN";
  readonly databaseCode: string | null;
  readonly retryable: false;
}

export type P0PostgresTransactionResult<T> =
  | P0PostgresTransactionCommitted<T>
  | P0PostgresTransactionInputRejected
  | P0PostgresTransactionValidationRejected
  | P0PostgresDeadlockDetected
  | P0PostgresDeadlockRetryExhausted
  | P0PostgresTransactionOutcomeUnknown;

/**
 * Application semantic validation can use this error without pretending it is
 * a PostgreSQL integrity result. The code is value-free and safe to expose to
 * the transaction classifier.
 */
export class P0TransactionValidationError extends Error {
  readonly code: string;

  constructor(code: string) {
    super("P0 transaction validation rejected");
    this.name = "P0TransactionValidationError";
    this.code = normalizeValidationCode(code) ?? "P0_VALIDATION_REJECTED";
  }
}

function isStableIdentity(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 1 &&
    value.length <= 200 &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value)
  );
}

function retryBinding(candidate: P0PostgresRetryAttestationCandidate): string {
  return [
    candidate.contractVersion,
    candidate.operationId,
    candidate.idempotencyKey,
    String(candidate.maxAttempts),
    candidate.retryClass,
    candidate.semanticAttestationId,
  ].join("\u001f");
}

function isValidRetryCandidate(
  candidate: P0PostgresRetryAttestationCandidate
): boolean {
  return (
    candidate.contractVersion === P0_POSTGRES_TRANSACTION_CONTRACT_VERSION &&
    isStableIdentity(candidate.operationId) &&
    isStableIdentity(candidate.idempotencyKey) &&
    (candidate.maxAttempts === 2 || candidate.maxAttempts === 3) &&
    candidate.retryClass === "EXACT_POSTGRES_40P01_ONLY" &&
    isStableIdentity(candidate.semanticAttestationId)
  );
}

/**
 * Mints an in-memory, exact-operation retry authority. A copied or caller-made
 * object is not accepted, even when it has the same visible fields.
 */
export async function verifyP0PostgresRetryAttestation(
  candidate: P0PostgresRetryAttestationCandidate,
  verifier: P0PostgresRetryAttestationVerifier
): Promise<VerifiedP0PostgresRetryAttestation | null> {
  if (!isValidRetryCandidate(candidate)) return null;

  const verifierInput = Object.freeze({ ...candidate });
  let accepted = false;
  try {
    accepted = await verifier.verifyIdempotentOperation({
      candidate: verifierInput,
    });
  } catch {
    return null;
  }
  if (accepted !== true) return null;

  const verified = {
    ...verifierInput,
    [VERIFIED_RETRY_ATTESTATION]: true as const,
  } as VerifiedP0PostgresRetryAttestation;
  Object.freeze(verified);
  verifiedRetryAttestations.add(verified);
  verifiedRetryBindings.set(verified, retryBinding(verified));
  return verified;
}

function retryAttestationState(
  candidate: VerifiedP0PostgresRetryAttestation | undefined,
  operationId: string
): "ABSENT" | "VERIFIED" | "UNVERIFIED" | "MISMATCH" {
  if (candidate === undefined) return "ABSENT";
  if (
    !verifiedRetryAttestations.has(candidate) ||
    verifiedRetryBindings.get(candidate) !== retryBinding(candidate)
  ) {
    return "UNVERIFIED";
  }
  return candidate.operationId === operationId ? "VERIFIED" : "MISMATCH";
}

function ownDataValue(object: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  return descriptor && "value" in descriptor ? descriptor.value : undefined;
}

function normalizeDatabaseCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return /^(?:[0-9A-Z]{5}|P[0-9]{4})$/.test(normalized)
    ? normalized
    : null;
}

function collectDatabaseCodes(error: unknown): readonly string[] {
  const codes: string[] = [];
  const seen = new WeakSet<object>();
  const queue: Array<{ value: unknown; depth: number }> = [{ value: error, depth: 0 }];
  const codeKeys = ["sqlState", "sqlstate", "pgCode", "code"] as const;
  const nestedKeys = ["cause", "meta", "originalError", "driverError", "error"] as const;

  while (queue.length > 0 && codes.length < 12) {
    const current = queue.shift();
    if (!current || current.depth > 4) continue;
    const value = current.value;
    if ((typeof value !== "object" && typeof value !== "function") || value === null) {
      continue;
    }
    const object = value as object;
    if (seen.has(object)) continue;
    seen.add(object);

    for (const key of codeKeys) {
      const code = normalizeDatabaseCode(ownDataValue(object, key));
      if (code && !codes.includes(code)) codes.push(code);
    }
    for (const key of nestedKeys) {
      const nested = ownDataValue(object, key);
      if (nested !== undefined) queue.push({ value: nested, depth: current.depth + 1 });
    }
  }
  return Object.freeze(codes);
}

function normalizeValidationCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return /^[A-Z][A-Z0-9_]{2,63}$/.test(normalized) ? normalized : null;
}

function validationDatabaseCode(error: unknown, codes: readonly string[]): string | null {
  if (error instanceof P0TransactionValidationError) return error.code;

  for (const code of codes) {
    if (/^(?:22|23)[0-9A-Z]{3}$/.test(code) || code === "55000") return code;
    if (["P2000", "P2002", "P2003", "P2004", "P2011", "P2014"].includes(code)) {
      return code;
    }
  }
  return null;
}

/**
 * Executes a caller-supplied transaction operation. Exact 40P01 is the only
 * automatically retryable failure, and only under a verified bounded policy.
 * Any unclassified/connection/Prisma-conflict error has an unknown outcome and
 * is returned fail-closed without retry.
 */
export async function runP0PostgresTransaction<T>(
  request: P0PostgresTransactionRequest<T>
): Promise<P0PostgresTransactionResult<T>> {
  if (!isStableIdentity(request.operationId)) {
    return {
      ok: false,
      kind: "INPUT_REJECTED",
      outcome: "NOT_ATTEMPTED",
      operationId: typeof request.operationId === "string" ? request.operationId : "",
      attempts: 0,
      reason: "INVALID_OPERATION_ID",
    };
  }
  if (typeof request.execute !== "function") {
    return {
      ok: false,
      kind: "INPUT_REJECTED",
      outcome: "NOT_ATTEMPTED",
      operationId: request.operationId,
      attempts: 0,
      reason: "INVALID_EXECUTOR",
    };
  }

  const attestationState = retryAttestationState(
    request.retryAttestation,
    request.operationId
  );
  if (attestationState === "UNVERIFIED" || attestationState === "MISMATCH") {
    return {
      ok: false,
      kind: "INPUT_REJECTED",
      outcome: "NOT_ATTEMPTED",
      operationId: request.operationId,
      attempts: 0,
      reason:
        attestationState === "MISMATCH"
          ? "RETRY_ATTESTATION_OPERATION_MISMATCH"
          : "UNVERIFIED_RETRY_ATTESTATION",
    };
  }

  const verifiedRetry =
    attestationState === "VERIFIED" ? request.retryAttestation : undefined;
  const maxAttempts = verifiedRetry?.maxAttempts ?? 1;
  const idempotencyKey = verifiedRetry?.idempotencyKey ?? null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const context = Object.freeze({
      operationId: request.operationId,
      idempotencyKey,
      attempt,
      maxAttempts,
    });
    try {
      const value = await request.execute(context);
      return {
        ok: true,
        kind: "COMMITTED",
        outcome: "COMMITTED",
        operationId: request.operationId,
        attempts: attempt,
        value,
      };
    } catch (error) {
      const codes = collectDatabaseCodes(error);
      if (codes.includes(P0_POSTGRES_DEADLOCK_SQLSTATE)) {
        if (!verifiedRetry) {
          return {
            ok: false,
            kind: "DEADLOCK_DETECTED",
            outcome: "ROLLED_BACK",
            operationId: request.operationId,
            attempts: attempt,
            databaseCode: P0_POSTGRES_DEADLOCK_SQLSTATE,
            retryable: false,
            retryAuthorized: false,
          };
        }
        if (attempt < maxAttempts) {
          await Promise.resolve();
          continue;
        }
        return {
          ok: false,
          kind: "DEADLOCK_RETRY_EXHAUSTED",
          outcome: "ROLLED_BACK",
          operationId: request.operationId,
          attempts: attempt,
          databaseCode: P0_POSTGRES_DEADLOCK_SQLSTATE,
          retryable: false,
          retryAuthorized: true,
          idempotencyKey: verifiedRetry.idempotencyKey,
        };
      }

      const validationCode = validationDatabaseCode(error, codes);
      if (validationCode) {
        return {
          ok: false,
          kind: "VALIDATION_REJECTED",
          outcome: "ROLLED_BACK",
          operationId: request.operationId,
          attempts: attempt,
          databaseCode: validationCode,
          retryable: false,
        };
      }

      return {
        ok: false,
        kind: "TRANSACTION_OUTCOME_UNKNOWN",
        outcome: "UNKNOWN",
        operationId: request.operationId,
        attempts: attempt,
        databaseCode: codes[0] ?? null,
        retryable: false,
      };
    }
  }

  // maxAttempts is validated to 1..3, so this branch is unreachable. Retain an
  // explicit fail-closed result if the loop is ever changed incorrectly.
  return {
    ok: false,
    kind: "TRANSACTION_OUTCOME_UNKNOWN",
    outcome: "UNKNOWN",
    operationId: request.operationId,
    attempts: maxAttempts,
    databaseCode: null,
    retryable: false,
  };
}
