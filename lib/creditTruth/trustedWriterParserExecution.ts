import {
  createHash,
  createPublicKey,
  verify as verifySignature,
} from "node:crypto";
import type { P0Scope } from "./principal";
import type { VerifiedP0ParserShadowEnvelope } from "./parserShadowEnvelope";
import { isVerifiedP0ParserShadowEnvelope } from "./parserShadowEnvelope";
import { computeP0RepositorySemanticSha256 } from "./repositoryAttestation";

export const P0_TRUSTED_PARSER_EXECUTION_CONTRACT_VERSION =
  "p0-trusted-parser-execution-v1" as const;

const VERIFIED_TRUSTED_PARSER_EXECUTION = Symbol(
  "verified-p0-trusted-parser-execution",
);
const verifiedExecutions = new WeakMap<object, string>();
const STABLE = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,199}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

export interface P0TrustedParserExecutionCandidate {
  readonly contractVersion: typeof P0_TRUSTED_PARSER_EXECUTION_CONTRACT_VERSION;
  readonly executionId: string;
  readonly parserImplementationId: string;
  readonly parserImplementationVersion: string;
  readonly parserImplementationSha256: string;
  readonly operationId: string;
  readonly tenantId: string;
  readonly consumerId: string;
  readonly ingestionId: string;
  readonly reportVersionId: string;
  readonly sourceArtifactId: string;
  readonly sourceArtifactVersion: number;
  readonly sourceSha256: string;
  readonly envelopeSemanticSha256: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly signatureBase64: string;
}

export interface VerifiedP0TrustedParserExecution
  extends P0TrustedParserExecutionCandidate {
  readonly [VERIFIED_TRUSTED_PARSER_EXECUTION]: true;
}

function strictInstant(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?Z$/.exec(
    value,
  );
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return (
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= days[month - 1]! &&
    hour <= 23 &&
    minute <= 59 &&
    second <= 59
  );
}

function unsigned(candidate: P0TrustedParserExecutionCandidate): readonly unknown[] {
  return [
    candidate.contractVersion,
    candidate.executionId,
    candidate.parserImplementationId,
    candidate.parserImplementationVersion,
    candidate.parserImplementationSha256,
    candidate.operationId,
    candidate.tenantId,
    candidate.consumerId,
    candidate.ingestionId,
    candidate.reportVersionId,
    candidate.sourceArtifactId,
    candidate.sourceArtifactVersion,
    candidate.sourceSha256,
    candidate.envelopeSemanticSha256,
    candidate.issuedAt,
    candidate.expiresAt,
  ];
}

export function computeP0TrustedParserExecutionSigningPayload(
  candidate: P0TrustedParserExecutionCandidate,
): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(unsigned(candidate)));
}

function binding(candidate: P0TrustedParserExecutionCandidate): string {
  return createHash("sha256")
    .update(computeP0TrustedParserExecutionSigningPayload(candidate))
    .update(candidate.signatureBase64, "utf8")
    .digest("hex");
}

function validCandidate(candidate: P0TrustedParserExecutionCandidate): boolean {
  if (!candidate || typeof candidate !== "object") return false;
  const issuedAt = strictInstant(candidate.issuedAt)
    ? Date.parse(candidate.issuedAt)
    : Number.NaN;
  const expiresAt = strictInstant(candidate.expiresAt)
    ? Date.parse(candidate.expiresAt)
    : Number.NaN;
  return Boolean(
    candidate.contractVersion ===
      P0_TRUSTED_PARSER_EXECUTION_CONTRACT_VERSION &&
      STABLE.test(candidate.executionId) &&
      STABLE.test(candidate.parserImplementationId) &&
      STABLE.test(candidate.parserImplementationVersion) &&
      SHA256.test(candidate.parserImplementationSha256) &&
      STABLE.test(candidate.operationId) &&
      STABLE.test(candidate.tenantId) &&
      STABLE.test(candidate.consumerId) &&
      STABLE.test(candidate.ingestionId) &&
      STABLE.test(candidate.reportVersionId) &&
      STABLE.test(candidate.sourceArtifactId) &&
      Number.isSafeInteger(candidate.sourceArtifactVersion) &&
      candidate.sourceArtifactVersion > 0 &&
      SHA256.test(candidate.sourceSha256) &&
      SHA256.test(candidate.envelopeSemanticSha256) &&
      Number.isFinite(issuedAt) &&
      Number.isFinite(expiresAt) &&
      expiresAt > issuedAt &&
      expiresAt - issuedAt <= 5 * 60_000 &&
      candidate.signatureBase64.length >= 80 &&
      candidate.signatureBase64.length <= 256 &&
      candidate.signatureBase64.length % 4 === 0 &&
      BASE64.test(candidate.signatureBase64),
  );
}

interface P0AcceptedParserImplementationIdentity {
  readonly parserImplementationId: string;
  readonly parserImplementationVersion: string;
  readonly parserImplementationSha256: string;
}

/** Deployment-controlled parser identity; request/candidate values are never authority. */
function serverAcceptedParserImplementation(): P0AcceptedParserImplementationIdentity | null {
  const parserImplementationId =
    process.env.P0_TRUSTED_PARSER_IMPLEMENTATION_ID;
  const parserImplementationVersion =
    process.env.P0_TRUSTED_PARSER_IMPLEMENTATION_VERSION;
  const parserImplementationSha256 =
    process.env.P0_TRUSTED_PARSER_IMPLEMENTATION_SHA256;
  return STABLE.test(parserImplementationId ?? "") &&
    STABLE.test(parserImplementationVersion ?? "") &&
    SHA256.test(parserImplementationSha256 ?? "")
    ? Object.freeze({
        parserImplementationId: parserImplementationId!,
        parserImplementationVersion: parserImplementationVersion!,
        parserImplementationSha256: parserImplementationSha256!,
      })
    : null;
}

function exactAcceptedParserImplementation(
  candidate: P0TrustedParserExecutionCandidate,
  accepted: P0AcceptedParserImplementationIdentity,
): boolean {
  return (
    candidate.parserImplementationId === accepted.parserImplementationId &&
    candidate.parserImplementationVersion ===
      accepted.parserImplementationVersion &&
    candidate.parserImplementationSha256 ===
      accepted.parserImplementationSha256
  );
}

function serverPublicKey(): ReturnType<typeof createPublicKey> | null {
  const encoded = process.env.P0_TRUSTED_PARSER_PUBLIC_KEY_SPKI_BASE64;
  if (!encoded || !BASE64.test(encoded)) return null;
  try {
    return createPublicKey({
      key: Buffer.from(encoded, "base64"),
      format: "der",
      type: "spki",
    });
  } catch {
    return null;
  }
}

/**
 * Verifies a parser-service receipt with the server-configured verify-only key.
 * No request-selected key or verifier is accepted by this production function.
 */
export function verifyP0TrustedParserExecutionFromServerEnvironment(input: {
  readonly candidate: P0TrustedParserExecutionCandidate;
  readonly envelope: VerifiedP0ParserShadowEnvelope;
  readonly scope: P0Scope;
  readonly operationId: string;
  readonly ingestionId: string;
  readonly reportVersionId: string;
  readonly now?: Date;
}): VerifiedP0TrustedParserExecution | null {
  const { candidate, envelope } = input;
  const now = input.now ?? new Date();
  const key = serverPublicKey();
  const acceptedParser = serverAcceptedParserImplementation();
  if (
    !key ||
    !acceptedParser ||
    !validCandidate(candidate) ||
    !exactAcceptedParserImplementation(candidate, acceptedParser) ||
    !isVerifiedP0ParserShadowEnvelope(envelope) ||
    candidate.operationId !== input.operationId ||
    candidate.tenantId !== input.scope.tenantId ||
    candidate.consumerId !== input.scope.consumerId ||
    candidate.ingestionId !== input.ingestionId ||
    candidate.reportVersionId !== input.reportVersionId ||
    candidate.sourceArtifactId !== envelope.source.artifactId ||
    candidate.sourceArtifactVersion !== envelope.source.artifactVersion ||
    candidate.sourceSha256 !== envelope.source.sha256 ||
    candidate.envelopeSemanticSha256 !==
      computeP0RepositorySemanticSha256(envelope) ||
    Date.parse(candidate.issuedAt) > now.getTime() ||
    Date.parse(candidate.expiresAt) <= now.getTime()
  ) {
    return null;
  }
  let valid = false;
  try {
    valid = verifySignature(
      null,
      computeP0TrustedParserExecutionSigningPayload(candidate),
      key,
      Buffer.from(candidate.signatureBase64, "base64"),
    );
  } catch {
    return null;
  }
  if (!valid) return null;
  const receipt = { ...candidate } as VerifiedP0TrustedParserExecution;
  Object.defineProperty(receipt, VERIFIED_TRUSTED_PARSER_EXECUTION, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  Object.freeze(receipt);
  verifiedExecutions.set(receipt, binding(receipt));
  return receipt;
}

export function isVerifiedP0TrustedParserExecution(input: {
  readonly receipt: VerifiedP0TrustedParserExecution | null | undefined;
  readonly envelope: VerifiedP0ParserShadowEnvelope;
  readonly scope: P0Scope;
  readonly operationId: string;
  readonly ingestionId: string;
  readonly reportVersionId: string;
  readonly now?: Date;
}): input is typeof input & {
  readonly receipt: VerifiedP0TrustedParserExecution;
} {
  const receipt = input.receipt;
  const now = input.now ?? new Date();
  const acceptedParser = serverAcceptedParserImplementation();
  return Boolean(
    receipt &&
      acceptedParser &&
      exactAcceptedParserImplementation(receipt, acceptedParser) &&
      receipt[VERIFIED_TRUSTED_PARSER_EXECUTION] === true &&
      Object.isFrozen(receipt) &&
      verifiedExecutions.get(receipt) === binding(receipt) &&
      receipt.operationId === input.operationId &&
      receipt.tenantId === input.scope.tenantId &&
      receipt.consumerId === input.scope.consumerId &&
      receipt.ingestionId === input.ingestionId &&
      receipt.reportVersionId === input.reportVersionId &&
      receipt.sourceArtifactId === input.envelope.source.artifactId &&
      receipt.sourceArtifactVersion === input.envelope.source.artifactVersion &&
      receipt.sourceSha256 === input.envelope.source.sha256 &&
      receipt.envelopeSemanticSha256 ===
        computeP0RepositorySemanticSha256(input.envelope) &&
      Date.parse(receipt.issuedAt) <= now.getTime() &&
      Date.parse(receipt.expiresAt) > now.getTime(),
  );
}
