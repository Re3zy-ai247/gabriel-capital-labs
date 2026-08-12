import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import {
  P0_PARSER_SHADOW_ENVELOPE_VERSION,
  P0_ROUND0_COMPLETENESS_CATEGORIES,
  verifyP0ParserShadowEnvelope,
} from "../lib/creditTruth/parserShadowEnvelope";
import { computeP0RepositorySemanticSha256 } from "../lib/creditTruth/repositoryAttestation";
import {
  P0_TRUSTED_PARSER_EXECUTION_CONTRACT_VERSION,
  computeP0TrustedParserExecutionSigningPayload,
  isVerifiedP0TrustedParserExecution,
  verifyP0TrustedParserExecutionFromServerEnvironment,
  type P0TrustedParserExecutionCandidate,
} from "../lib/creditTruth/trustedWriterParserExecution";

const ENV = [
  "P0_TRUSTED_PARSER_PUBLIC_KEY_SPKI_BASE64",
  "P0_TRUSTED_PARSER_IMPLEMENTATION_ID",
  "P0_TRUSTED_PARSER_IMPLEMENTATION_VERSION",
  "P0_TRUSTED_PARSER_IMPLEMENTATION_SHA256",
] as const;
const previous = new Map(ENV.map((key) => [key, process.env[key]]));
const implementation = Object.freeze({
  id: "creditvector-parser-v2",
  version: "2.0.0",
  sha256: "a".repeat(64),
});
const scope = Object.freeze({
  tenantId: "tenant-parser-authority",
  consumerId: "consumer-parser-authority",
});
const source = Object.freeze({
  ingestionId: "ingestion-parser-authority",
  artifactId: "artifact-parser-authority",
  artifactVersion: 1,
  artifactKind: "NORMALIZED_TEXT" as const,
  mimeType: "text/plain" as const,
  sha256: "b".repeat(64),
  byteLength: 128,
  normalizationVersion: "newline-preserving-v1",
});
const parsedEnvelope = verifyP0ParserShadowEnvelope({
  contractVersion: P0_PARSER_SHADOW_ENVELOPE_VERSION,
  parser: "REGEX_V2",
  parserVersion: "regex-v2.1",
  source,
  coveredBureaus: ["EQUIFAX"],
  accounts: [],
  bureauEvidence: [
    {
      bureau: "EQUIFAX",
      reportDate: { presence: "UNKNOWN", precision: "UNKNOWN" },
      scores: [
        {
          presence: "UNKNOWN",
          occurrence: 0,
          model: { presence: "UNKNOWN" },
        },
      ],
      identity: [],
      round0Completeness: P0_ROUND0_COMPLETENESS_CATEGORIES.map(
        (category) => ({
          category,
          status: "UNKNOWN" as const,
          ruleKey: "trusted-writer-parser-identity",
          ruleVersion: "v1",
        }),
      ),
      errors: [{ code: "PARSER_TIMEOUT", severity: "ERROR" }],
    },
  ],
  status: "FAILED",
  safeErrorCodes: ["PARSER_TIMEOUT"],
});
if (!parsedEnvelope) throw new Error("trusted parser fixture must verify");
const envelope = parsedEnvelope;

const { privateKey, publicKey } = generateKeyPairSync("ed25519");
process.env.P0_TRUSTED_PARSER_PUBLIC_KEY_SPKI_BASE64 = publicKey
  .export({ format: "der", type: "spki" })
  .toString("base64");

function setAcceptedIdentity(value = implementation): void {
  process.env.P0_TRUSTED_PARSER_IMPLEMENTATION_ID = value.id;
  process.env.P0_TRUSTED_PARSER_IMPLEMENTATION_VERSION = value.version;
  process.env.P0_TRUSTED_PARSER_IMPLEMENTATION_SHA256 = value.sha256;
}

function signedCandidate(
  overrides: Partial<P0TrustedParserExecutionCandidate> = {},
): P0TrustedParserExecutionCandidate {
  const now = Date.now();
  const unsigned: P0TrustedParserExecutionCandidate = {
    contractVersion: P0_TRUSTED_PARSER_EXECUTION_CONTRACT_VERSION,
    executionId: "parser-execution-authority-1",
    parserImplementationId: implementation.id,
    parserImplementationVersion: implementation.version,
    parserImplementationSha256: implementation.sha256,
    operationId: "parser-operation-authority-1",
    tenantId: scope.tenantId,
    consumerId: scope.consumerId,
    ingestionId: source.ingestionId,
    reportVersionId: "report-version-parser-authority",
    sourceArtifactId: source.artifactId,
    sourceArtifactVersion: source.artifactVersion,
    sourceSha256: source.sha256,
    envelopeSemanticSha256: computeP0RepositorySemanticSha256(envelope),
    issuedAt: new Date(now - 1_000).toISOString(),
    expiresAt: new Date(now + 60_000).toISOString(),
    signatureBase64: Buffer.alloc(64).toString("base64"),
    ...overrides,
  };
  return {
    ...unsigned,
    signatureBase64: sign(
      null,
      computeP0TrustedParserExecutionSigningPayload(unsigned),
      privateKey,
    ).toString("base64"),
  };
}

function verify(candidate: P0TrustedParserExecutionCandidate) {
  return verifyP0TrustedParserExecutionFromServerEnvironment({
    candidate,
    envelope,
    scope,
    operationId: "parser-operation-authority-1",
    ingestionId: source.ingestionId,
    reportVersionId: "report-version-parser-authority",
  });
}

let passed = 0;
async function check(name: string, run: () => void | Promise<void>) {
  await run();
  passed += 1;
  process.stdout.write(`ok ${passed} - ${name}\n`);
}

async function main(): Promise<void> {
try {
  await check("missing deployment parser identity denies a valid signature", () => {
    for (const key of ENV.slice(1)) delete process.env[key];
    assert.equal(verify(signedCandidate()), null);
  });
  await check("exact server-owned parser identity mints verified authority", () => {
    setAcceptedIdentity();
    const receipt = verify(signedCandidate());
    assert(receipt);
    assert(
      isVerifiedP0TrustedParserExecution({
        receipt,
        envelope,
        scope,
        operationId: receipt.operationId,
        ingestionId: receipt.ingestionId,
        reportVersionId: receipt.reportVersionId,
      }),
    );
  });
  await check("caller-controlled implementation id fails closed", () => {
    assert.equal(
      verify(signedCandidate({ parserImplementationId: "unknown-parser" })),
      null,
    );
  });
  await check("stale implementation version fails closed", () => {
    assert.equal(
      verify(signedCandidate({ parserImplementationVersion: "1.9.9" })),
      null,
    );
  });
  await check("implementation source hash substitution fails closed", () => {
    assert.equal(
      verify(signedCandidate({ parserImplementationSha256: "c".repeat(64) })),
      null,
    );
  });
  await check("signature tampering cannot manufacture parser authority", () => {
    const candidate = signedCandidate();
    assert.equal(
      verify({ ...candidate, signatureBase64: Buffer.alloc(64, 0x31).toString("base64") }),
      null,
    );
  });
  await check("deployment identity rotation invalidates a previously verified receipt", () => {
    const receipt = verify(signedCandidate());
    assert(receipt);
    setAcceptedIdentity({ ...implementation, sha256: "d".repeat(64) });
    assert.equal(
      isVerifiedP0TrustedParserExecution({
        receipt,
        envelope,
        scope,
        operationId: receipt.operationId,
        ingestionId: receipt.ingestionId,
        reportVersionId: receipt.reportVersionId,
      }),
      false,
    );
    setAcceptedIdentity();
  });
  process.stdout.write(`${passed}/${passed} PASS p0-trusted-writer-parser-identity\n`);
} finally {
  for (const key of ENV) {
    const value = previous.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
