// P0 Phase 1.1 PostgreSQL 40P01 transaction-boundary regression tests.
// Synthetic and DB-less: the disposable PostgreSQL harness separately proves
// the real sealed-packet race emits exact SQLSTATE 40P01 with zero inserted rows.
// Run: npx --no-install tsx scripts/p0-postgres-transaction.test.ts

import assert from "node:assert/strict";

import {
  P0_POSTGRES_DEADLOCK_SQLSTATE,
  P0_POSTGRES_MAX_TRANSACTION_ATTEMPTS,
  P0_POSTGRES_TRANSACTION_CONTRACT_VERSION,
  P0TransactionValidationError,
  runP0PostgresTransaction,
  verifyP0PostgresRetryAttestation,
  type P0PostgresRetryAttestationCandidate,
  type P0PostgresRetryAttestationVerifier,
  type VerifiedP0PostgresRetryAttestation,
} from "../lib/creditTruth/postgresTransaction";

let passed = 0;

async function check(label: string, run: () => void | Promise<void>): Promise<void> {
  await run();
  passed += 1;
  console.log(`PASS ${label}`);
}

function databaseError(code: string, nested?: unknown): Error & { code: string; cause?: unknown } {
  const error = new Error("synthetic database detail must not escape") as Error & {
    code: string;
    cause?: unknown;
  };
  error.code = code;
  if (nested !== undefined) error.cause = nested;
  return error;
}

function retryCandidate(
  overrides: Partial<P0PostgresRetryAttestationCandidate> = {}
): P0PostgresRetryAttestationCandidate {
  return {
    contractVersion: P0_POSTGRES_TRANSACTION_CONTRACT_VERSION,
    operationId: "packet.seal.synthetic-001",
    idempotencyKey: "packet.seal.synthetic-001.v1",
    maxAttempts: 2,
    retryClass: "EXACT_POSTGRES_40P01_ONLY",
    semanticAttestationId: "writer-attestation.synthetic-001",
    ...overrides,
  };
}

const acceptingVerifier: P0PostgresRetryAttestationVerifier = {
  async verifyIdempotentOperation() {
    return true;
  },
};

async function verifiedRetry(
  overrides: Partial<P0PostgresRetryAttestationCandidate> = {}
): Promise<VerifiedP0PostgresRetryAttestation> {
  const verified = await verifyP0PostgresRetryAttestation(
    retryCandidate(overrides),
    acceptingVerifier
  );
  assert.ok(verified);
  return verified;
}

async function main(): Promise<void> {
  await check("contract exposes exact 40P01 and hard attempt ceiling", () => {
    assert.equal(P0_POSTGRES_DEADLOCK_SQLSTATE, "40P01");
    assert.equal(P0_POSTGRES_MAX_TRANSACTION_ATTEMPTS, 3);
  });

  await check("valid retry attestation is independently verified and frozen", async () => {
    let verifierCalled = 0;
    const verified = await verifyP0PostgresRetryAttestation(retryCandidate(), {
      async verifyIdempotentOperation({ candidate }) {
        verifierCalled += 1;
        assert.equal(Object.isFrozen(candidate), true);
        assert.equal(candidate.operationId, "packet.seal.synthetic-001");
        return true;
      },
    });
    assert.ok(verified);
    assert.equal(verifierCalled, 1);
    assert.equal(Object.isFrozen(verified), true);
  });

  await check("attestation verifier denial fails closed", async () => {
    const result = await verifyP0PostgresRetryAttestation(retryCandidate(), {
      async verifyIdempotentOperation() {
        return false;
      },
    });
    assert.equal(result, null);
  });

  await check("attestation verifier failure fails closed", async () => {
    const result = await verifyP0PostgresRetryAttestation(retryCandidate(), {
      async verifyIdempotentOperation() {
        throw new Error("synthetic verifier unavailable");
      },
    });
    assert.equal(result, null);
  });

  await check("invalid candidate is rejected before verifier invocation", async () => {
    let verifierCalled = false;
    const result = await verifyP0PostgresRetryAttestation(
      retryCandidate({ operationId: "contains whitespace" }),
      {
        async verifyIdempotentOperation() {
          verifierCalled = true;
          return true;
        },
      }
    );
    assert.equal(result, null);
    assert.equal(verifierCalled, false);
  });

  await check("caller mutation cannot retarget a minted attestation", async () => {
    const callerCandidate = retryCandidate();
    const verified = await verifyP0PostgresRetryAttestation(
      callerCandidate,
      acceptingVerifier
    );
    assert.ok(verified);
    (callerCandidate as { operationId: string }).operationId = "retargeted.operation";
    assert.equal(verified.operationId, "packet.seal.synthetic-001");
  });

  await check("forged retry policy is rejected without executing", async () => {
    let executions = 0;
    const forged = retryCandidate() as VerifiedP0PostgresRetryAttestation;
    const result = await runP0PostgresTransaction({
      operationId: forged.operationId,
      retryAttestation: forged,
      async execute() {
        executions += 1;
        return "must-not-run";
      },
    });
    assert.deepEqual(result, {
      ok: false,
      kind: "INPUT_REJECTED",
      outcome: "NOT_ATTEMPTED",
      operationId: forged.operationId,
      attempts: 0,
      reason: "UNVERIFIED_RETRY_ATTESTATION",
    });
    assert.equal(executions, 0);
  });

  await check("verified policy cannot authorize another operation", async () => {
    const retryAttestation = await verifiedRetry();
    let executions = 0;
    const result = await runP0PostgresTransaction({
      operationId: "packet.seal.synthetic-002",
      retryAttestation,
      async execute() {
        executions += 1;
        return "must-not-run";
      },
    });
    assert.equal(result.ok, false);
    assert.equal(result.kind, "INPUT_REJECTED");
    if (result.kind === "INPUT_REJECTED") {
      assert.equal(result.reason, "RETRY_ATTESTATION_OPERATION_MISMATCH");
    }
    assert.equal(executions, 0);
  });

  await check("ordinary transaction commits once with retry disabled", async () => {
    const contexts: unknown[] = [];
    const result = await runP0PostgresTransaction({
      operationId: "report.version.synthetic-001",
      async execute(context) {
        contexts.push(context);
        return { reportVersionId: "rv-synthetic-001" };
      },
    });
    assert.equal(result.ok, true);
    assert.equal(result.kind, "COMMITTED");
    assert.equal(result.attempts, 1);
    assert.deepEqual(contexts, [
      {
        operationId: "report.version.synthetic-001",
        idempotencyKey: null,
        attempt: 1,
        maxAttempts: 1,
      },
    ]);
    assert.equal(Object.isFrozen(contexts[0] as object), true);
  });

  await check("40P01 without attestation is explicit failure, never success", async () => {
    let executions = 0;
    const result = await runP0PostgresTransaction({
      operationId: "packet.seal.no-retry",
      async execute() {
        executions += 1;
        throw databaseError("40P01");
      },
    });
    assert.deepEqual(result, {
      ok: false,
      kind: "DEADLOCK_DETECTED",
      outcome: "ROLLED_BACK",
      operationId: "packet.seal.no-retry",
      attempts: 1,
      databaseCode: "40P01",
      retryable: false,
      retryAuthorized: false,
    });
    assert.equal(executions, 1);
  });

  await check("nested driver SQLSTATE 40P01 is translated exactly", async () => {
    const result = await runP0PostgresTransaction({
      operationId: "packet.seal.nested-deadlock",
      async execute() {
        throw databaseError("P2010", { sqlState: "40p01" });
      },
    });
    assert.equal(result.kind, "DEADLOCK_DETECTED");
    assert.equal(result.databaseCode, "40P01");
  });

  await check("outer Prisma code cannot hide nested exact 40P01", async () => {
    const retryAttestation = await verifiedRetry();
    let attempt = 0;
    const result = await runP0PostgresTransaction({
      operationId: retryAttestation.operationId,
      retryAttestation,
      async execute() {
        attempt += 1;
        if (attempt === 1) {
          throw databaseError("P2010", { meta: { code: "40P01" } });
        }
        return "committed";
      },
    });
    assert.equal(result.kind, "COMMITTED");
    assert.equal(result.attempts, 2);
  });

  await check("verified idempotent 40P01 retry reuses exact stable identity", async () => {
    const retryAttestation = await verifiedRetry();
    const contexts: Array<{
      operationId: string;
      idempotencyKey: string | null;
      attempt: number;
      maxAttempts: number;
    }> = [];
    const result = await runP0PostgresTransaction({
      operationId: retryAttestation.operationId,
      retryAttestation,
      async execute(context) {
        contexts.push(context);
        if (context.attempt === 1) throw databaseError("40P01");
        return "one-canonical-row";
      },
    });
    assert.equal(result.kind, "COMMITTED");
    assert.equal(result.attempts, 2);
    assert.equal(contexts.length, 2);
    assert.equal(contexts[0].operationId, contexts[1].operationId);
    assert.equal(contexts[0].idempotencyKey, contexts[1].idempotencyKey);
    assert.equal(contexts[0].idempotencyKey, retryAttestation.idempotencyKey);
  });

  await check("three-attempt policy can commit only within the hard bound", async () => {
    const retryAttestation = await verifiedRetry({ maxAttempts: 3 });
    let executions = 0;
    const result = await runP0PostgresTransaction({
      operationId: retryAttestation.operationId,
      retryAttestation,
      async execute() {
        executions += 1;
        if (executions < 3) throw databaseError("40P01");
        return "committed-at-bound";
      },
    });
    assert.equal(result.kind, "COMMITTED");
    assert.equal(result.attempts, 3);
    assert.equal(executions, 3);
  });

  await check("two-attempt deadlock exhaustion is structurally explicit", async () => {
    const retryAttestation = await verifiedRetry({ maxAttempts: 2 });
    let executions = 0;
    const result = await runP0PostgresTransaction({
      operationId: retryAttestation.operationId,
      retryAttestation,
      async execute() {
        executions += 1;
        throw databaseError("40P01");
      },
    });
    assert.deepEqual(result, {
      ok: false,
      kind: "DEADLOCK_RETRY_EXHAUSTED",
      outcome: "ROLLED_BACK",
      operationId: retryAttestation.operationId,
      attempts: 2,
      databaseCode: "40P01",
      retryable: false,
      retryAuthorized: true,
      idempotencyKey: retryAttestation.idempotencyKey,
    });
    assert.equal(executions, 2);
  });

  await check("three-attempt exhaustion cannot become an infinite retry", async () => {
    const retryAttestation = await verifiedRetry({ maxAttempts: 3 });
    let executions = 0;
    const result = await runP0PostgresTransaction({
      operationId: retryAttestation.operationId,
      retryAttestation,
      async execute() {
        executions += 1;
        throw databaseError("40P01");
      },
    });
    assert.equal(result.kind, "DEADLOCK_RETRY_EXHAUSTED");
    assert.equal(result.attempts, 3);
    assert.equal(executions, 3);
  });

  await check("validation after a deadlock stops retrying", async () => {
    const retryAttestation = await verifiedRetry({ maxAttempts: 3 });
    let executions = 0;
    const result = await runP0PostgresTransaction({
      operationId: retryAttestation.operationId,
      retryAttestation,
      async execute() {
        executions += 1;
        if (executions === 1) throw databaseError("40P01");
        throw databaseError("23514");
      },
    });
    assert.equal(result.kind, "VALIDATION_REJECTED");
    assert.equal(result.attempts, 2);
    assert.equal(executions, 2);
  });

  await check("unknown outcome after a deadlock stops retrying", async () => {
    const retryAttestation = await verifiedRetry({ maxAttempts: 3 });
    let executions = 0;
    const result = await runP0PostgresTransaction({
      operationId: retryAttestation.operationId,
      retryAttestation,
      async execute() {
        executions += 1;
        if (executions === 1) throw databaseError("40P01");
        throw databaseError("P1001");
      },
    });
    assert.equal(result.kind, "TRANSACTION_OUTCOME_UNKNOWN");
    assert.equal(result.outcome, "UNKNOWN");
    assert.equal(result.attempts, 2);
    assert.equal(executions, 2);
  });

  await check("Prisma P2034 without exact SQLSTATE fails closed without retry", async () => {
    const retryAttestation = await verifiedRetry({ maxAttempts: 3 });
    let executions = 0;
    const result = await runP0PostgresTransaction({
      operationId: retryAttestation.operationId,
      retryAttestation,
      async execute() {
        executions += 1;
        throw databaseError("P2034");
      },
    });
    assert.equal(result.kind, "TRANSACTION_OUTCOME_UNKNOWN");
    assert.equal(result.databaseCode, "P2034");
    assert.equal(result.attempts, 1);
    assert.equal(executions, 1);
  });

  await check("connection error is unknown and never retried", async () => {
    const result = await runP0PostgresTransaction({
      operationId: "packet.seal.connection-loss",
      async execute() {
        throw databaseError("P1001");
      },
    });
    assert.equal(result.kind, "TRANSACTION_OUTCOME_UNKNOWN");
    assert.equal(result.outcome, "UNKNOWN");
    assert.equal(result.databaseCode, "P1001");
  });

  await check("unclassified exception is unknown and redacted", async () => {
    const result = await runP0PostgresTransaction({
      operationId: "packet.seal.unclassified",
      async execute() {
        throw new Error("synthetic secret-like detail");
      },
    });
    assert.equal(result.kind, "TRANSACTION_OUTCOME_UNKNOWN");
    assert.equal(result.databaseCode, null);
    assert.doesNotMatch(JSON.stringify(result), /secret-like detail/);
  });

  for (const code of ["23514", "55000", "22007", "P2002"] as const) {
    await check(`${code} is validation, not deadlock/unknown/success`, async () => {
      const result = await runP0PostgresTransaction({
        operationId: `validation.${code}`,
        async execute() {
          throw databaseError(code);
        },
      });
      assert.equal(result.kind, "VALIDATION_REJECTED");
      assert.equal(result.outcome, "ROLLED_BACK");
      assert.equal(result.databaseCode, code);
    });
  }

  await check("typed application validation remains structurally distinct", async () => {
    const result = await runP0PostgresTransaction({
      operationId: "validation.semantic-binding",
      async execute() {
        throw new P0TransactionValidationError("bureau_binding_rejected");
      },
    });
    assert.equal(result.kind, "VALIDATION_REJECTED");
    assert.equal(result.databaseCode, "BUREAU_BINDING_REJECTED");
  });

  await check("invalid operation identity is rejected before execution", async () => {
    let executions = 0;
    const result = await runP0PostgresTransaction({
      operationId: "invalid operation id",
      async execute() {
        executions += 1;
        return "must-not-run";
      },
    });
    assert.equal(result.kind, "INPUT_REJECTED");
    assert.equal(result.attempts, 0);
    assert.equal(executions, 0);
  });

  await check("invalid idempotency identity cannot mint retry authority", async () => {
    const result = await verifyP0PostgresRetryAttestation(
      retryCandidate({ idempotencyKey: "contains whitespace" }),
      acceptingVerifier
    );
    assert.equal(result, null);
  });

  await check("attempt count outside 2..3 cannot mint retry authority", async () => {
    const result = await verifyP0PostgresRetryAttestation(
      retryCandidate({ maxAttempts: 4 as 2 }),
      acceptingVerifier
    );
    assert.equal(result, null);
  });

  await check("wrong retry class cannot mint retry authority", async () => {
    const result = await verifyP0PostgresRetryAttestation(
      retryCandidate({ retryClass: "ALL_ERRORS" as "EXACT_POSTGRES_40P01_ONLY" }),
      acceptingVerifier
    );
    assert.equal(result, null);
  });

  await check("message text alone cannot authorize a 40P01 retry", async () => {
    const retryAttestation = await verifiedRetry({ maxAttempts: 3 });
    let executions = 0;
    const result = await runP0PostgresTransaction({
      operationId: retryAttestation.operationId,
      retryAttestation,
      async execute() {
        executions += 1;
        throw new Error("40P01 deadlock detected");
      },
    });
    assert.equal(result.kind, "TRANSACTION_OUTCOME_UNKNOWN");
    assert.equal(executions, 1);
  });

  await check("code getter is not invoked during classification", async () => {
    let getterCalls = 0;
    const malicious = new Error("synthetic getter");
    Object.defineProperty(malicious, "code", {
      get() {
        getterCalls += 1;
        return "40P01";
      },
    });
    const result = await runP0PostgresTransaction({
      operationId: "packet.seal.getter",
      async execute() {
        throw malicious;
      },
    });
    assert.equal(result.kind, "TRANSACTION_OUTCOME_UNKNOWN");
    assert.equal(getterCalls, 0);
  });

  await check("cyclic error metadata remains bounded and fail closed", async () => {
    const cyclic: { code: string; cause?: unknown } = { code: "P1001" };
    cyclic.cause = cyclic;
    const result = await runP0PostgresTransaction({
      operationId: "packet.seal.cyclic",
      async execute() {
        throw cyclic;
      },
    });
    assert.equal(result.kind, "TRANSACTION_OUTCOME_UNKNOWN");
    assert.equal(result.databaseCode, "P1001");
  });

  console.log(`\n${passed}/${passed} P0 PostgreSQL transaction tests passed`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
