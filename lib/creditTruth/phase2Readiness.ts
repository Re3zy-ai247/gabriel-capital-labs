import { createHash } from "node:crypto";
import { isStrictIsoInstant } from "./progressIntelligence";

export const P0_PHASE2A_READINESS_CONTRACT_VERSION =
  "p0-phase2a-readiness-v1" as const;

export const P0_PHASE2A_STAGES = [
  "ROOT",
  "INGESTION_SHADOW",
  "ROUND0_REVIEW",
  "ASSERTION_RUNTIME",
] as const;

export type P0Phase2AStage = (typeof P0_PHASE2A_STAGES)[number];
export type P0ReadinessMode = "LOCAL_BUILD" | "PRODUCTION_ACTIVATION";

export const P0_REPOSITORY_CAPABILITIES = [
  "AUTHENTICATED_PRINCIPAL",
  "COMPOSITE_SCOPE",
  "WRITE_READBACK_SEMANTIC_VERIFY",
  "EXACT_40P01",
  "PII_SAFE_ACCESS_AUDIT",
] as const;

export type P0RepositoryCapability =
  (typeof P0_REPOSITORY_CAPABILITIES)[number];

export interface P0RepositoryReadinessReceiptCandidate {
  readonly contractVersion: typeof P0_PHASE2A_READINESS_CONTRACT_VERSION;
  readonly receiptId: string;
  /** Phase 2A can attest only the local/synthetic contract. */
  readonly receiptKind: "LOCAL_SYNTHETIC";
  readonly repositoryAdapterId: string;
  readonly repositoryAdapterVersion: string;
  readonly codeRevision: string;
  readonly migrationSha256: string;
  readonly semanticsVersion: string;
  readonly capabilities: readonly P0RepositoryCapability[];
  readonly issuedAt: string;
  readonly expiresAt: string;
}

export interface P0RepositoryReadinessVerifier {
  readonly verifierId: string;
  verifyRepositoryReceipt(input: {
    readonly candidate: P0RepositoryReadinessReceiptCandidate;
    readonly semanticSha256: string;
  }): Promise<boolean>;
}

const VERIFIED_REPOSITORY_RECEIPT = Symbol(
  "verified-p0-repository-readiness-receipt",
);
const verifiedRepositoryReceipts = new WeakSet<object>();
const verifiedReceiptDigests = new WeakMap<object, string>();

export interface VerifiedP0RepositoryReadinessReceipt
  extends P0RepositoryReadinessReceiptCandidate {
  readonly verifierId: string;
  readonly semanticSha256: string;
  readonly [VERIFIED_REPOSITORY_RECEIPT]: true;
}

export interface P0Phase2AReadinessEvidence {
  readonly migrationVerified: boolean;
  readonly migrationSha256: string;
  readonly principalBoundaryVerified: boolean;
  readonly repositoryBoundaryVerified: boolean;
  readonly sourceArtifactBoundaryVerified: boolean;
  readonly ingestionBoundaryVerified: boolean;
  readonly round0BoundaryVerified: boolean;
  readonly assertionBoundaryVerified: boolean;
  readonly repositoryReceipt: VerifiedP0RepositoryReadinessReceipt | null;
}

export type P0Phase2AReadinessReason =
  | "READY"
  | "INVALID_READINESS_MODE"
  | "MIGRATION_NOT_VERIFIED"
  | "MIGRATION_DIGEST_INVALID"
  | "PRINCIPAL_BOUNDARY_NOT_VERIFIED"
  | "REPOSITORY_BOUNDARY_NOT_VERIFIED"
  | "REPOSITORY_RECEIPT_MISSING_OR_INVALID"
  | "REPOSITORY_RECEIPT_MIGRATION_MISMATCH"
  | "SOURCE_ARTIFACT_BOUNDARY_NOT_VERIFIED"
  | "INGESTION_BOUNDARY_NOT_VERIFIED"
  | "ROUND0_BOUNDARY_NOT_VERIFIED"
  | "ASSERTION_BOUNDARY_NOT_VERIFIED"
  | "AUTHENTICATED_PRODUCTION_REPOSITORY_RECEIPT_REQUIRED";

export interface P0Phase2AReadinessDecision {
  readonly ready: boolean;
  readonly stage: P0Phase2AStage;
  readonly mode: P0ReadinessMode;
  readonly reasons: readonly P0Phase2AReadinessReason[];
  readonly trustedWriterDependency: "BOUNDED";
  readonly productionActivation:
    | "BLOCKED"
    | "REPOSITORY_RECEIPT_SATISFIED_OTHER_GATES_STILL_REQUIRED";
}

const SHA256 = /^[0-9a-f]{64}$/;

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function semanticSha256(value: unknown): string {
  const canonical = (input: unknown): string => {
    if (
      input === null ||
      typeof input === "string" ||
      typeof input === "boolean"
    ) {
      return JSON.stringify(input);
    }
    if (typeof input === "number") {
      if (!Number.isFinite(input)) throw new Error("non-finite readiness value");
      return JSON.stringify(input);
    }
    if (Array.isArray(input)) return `[${input.map(canonical).join(",")}]`;
    if (typeof input !== "object") throw new Error("non-JSON readiness value");
    const record = input as Readonly<Record<string, unknown>>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`)
      .join(",")}}`;
  };
  return createHash("sha256").update(canonical(value), "utf8").digest("hex");
}

function validCandidate(
  candidate: P0RepositoryReadinessReceiptCandidate,
): boolean {
  const issued = isStrictIsoInstant(candidate.issuedAt)
    ? Date.parse(candidate.issuedAt)
    : Number.NaN;
  const expires = isStrictIsoInstant(candidate.expiresAt)
    ? Date.parse(candidate.expiresAt)
    : Number.NaN;
  return (
    candidate.contractVersion === P0_PHASE2A_READINESS_CONTRACT_VERSION &&
    nonEmpty(candidate.receiptId) &&
    candidate.receiptKind === "LOCAL_SYNTHETIC" &&
    nonEmpty(candidate.repositoryAdapterId) &&
    nonEmpty(candidate.repositoryAdapterVersion) &&
    nonEmpty(candidate.codeRevision) &&
    SHA256.test(candidate.migrationSha256) &&
    nonEmpty(candidate.semanticsVersion) &&
    Array.isArray(candidate.capabilities) &&
    candidate.capabilities.length === P0_REPOSITORY_CAPABILITIES.length &&
    P0_REPOSITORY_CAPABILITIES.every((capability) =>
      candidate.capabilities.includes(capability),
    ) &&
    new Set(candidate.capabilities).size === candidate.capabilities.length &&
    Number.isFinite(issued) &&
    Number.isFinite(expires) &&
    expires > issued
  );
}

function receiptSnapshot(
  candidate: P0RepositoryReadinessReceiptCandidate,
): P0RepositoryReadinessReceiptCandidate {
  return Object.freeze({
    ...candidate,
    capabilities: Object.freeze([...candidate.capabilities]),
  });
}

export async function verifyP0RepositoryReadinessReceipt(
  candidate: P0RepositoryReadinessReceiptCandidate,
  verifier: P0RepositoryReadinessVerifier,
): Promise<VerifiedP0RepositoryReadinessReceipt | null> {
  // Deliberately no AUTHENTICATED_PRODUCTION branch. That receipt requires a
  // separately implemented adapter and a distinct non-forgeable brand.
  if (!validCandidate(candidate) || !nonEmpty(verifier?.verifierId)) return null;
  const snapshot = receiptSnapshot(candidate);
  const digest = semanticSha256(snapshot);
  let approved = false;
  try {
    approved = await verifier.verifyRepositoryReceipt({
      candidate: snapshot,
      semanticSha256: digest,
    });
  } catch {
    return null;
  }
  if (!approved) {
    return null;
  }
  const verified = {
    ...snapshot,
    verifierId: verifier.verifierId,
    semanticSha256: digest,
  } as VerifiedP0RepositoryReadinessReceipt;
  Object.defineProperty(verified, VERIFIED_REPOSITORY_RECEIPT, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  verifiedRepositoryReceipts.add(verified);
  verifiedReceiptDigests.set(verified, digest);
  return Object.freeze(verified);
}

export function isVerifiedP0RepositoryReadinessReceipt(
  receipt: VerifiedP0RepositoryReadinessReceipt | null | undefined,
): receipt is VerifiedP0RepositoryReadinessReceipt {
  if (
    !receipt ||
    receipt[VERIFIED_REPOSITORY_RECEIPT] !== true ||
    !verifiedRepositoryReceipts.has(receipt) ||
    !validCandidate(receipt)
  ) {
    return false;
  }
  const candidate = Object.fromEntries(
    Object.entries(receipt).filter(
      ([key]) => key !== "verifierId" && key !== "semanticSha256",
    ),
  );
  const digest = semanticSha256(candidate);
  return (
    receipt.semanticSha256 === digest &&
    verifiedReceiptDigests.get(receipt) === digest
  );
}

export function evaluateP0Phase2AReadiness(input: {
  readonly stage: P0Phase2AStage;
  readonly mode: P0ReadinessMode;
  readonly evidence: P0Phase2AReadinessEvidence;
  readonly now: Date;
}): P0Phase2AReadinessDecision {
  const { stage, mode, evidence, now } = input;
  const reasons: P0Phase2AReadinessReason[] = [];
  if (!P0_PHASE2A_STAGES.includes(stage)) {
    throw new Error("unknown Phase 2A readiness stage");
  }
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw new Error("invalid readiness evaluation time");
  }
  const modeValid =
    mode === "LOCAL_BUILD" || mode === "PRODUCTION_ACTIVATION";
  if (!modeValid) reasons.push("INVALID_READINESS_MODE");
  if (!evidence.migrationVerified) reasons.push("MIGRATION_NOT_VERIFIED");
  if (!SHA256.test(evidence.migrationSha256)) {
    reasons.push("MIGRATION_DIGEST_INVALID");
  }
  if (!evidence.principalBoundaryVerified) {
    reasons.push("PRINCIPAL_BOUNDARY_NOT_VERIFIED");
  }
  if (!evidence.repositoryBoundaryVerified) {
    reasons.push("REPOSITORY_BOUNDARY_NOT_VERIFIED");
  }

  const receipt = evidence.repositoryReceipt;
  const validReceipt = isVerifiedP0RepositoryReadinessReceipt(receipt);
  if (!validReceipt) {
    reasons.push("REPOSITORY_RECEIPT_MISSING_OR_INVALID");
  } else {
    const expiresAt = Date.parse(receipt.expiresAt);
    if (expiresAt <= now.getTime()) {
      reasons.push("REPOSITORY_RECEIPT_MISSING_OR_INVALID");
    }
    if (receipt.migrationSha256 !== evidence.migrationSha256) {
      reasons.push("REPOSITORY_RECEIPT_MIGRATION_MISMATCH");
    }
  }

  if (stage !== "ROOT") {
    if (!evidence.sourceArtifactBoundaryVerified) {
      reasons.push("SOURCE_ARTIFACT_BOUNDARY_NOT_VERIFIED");
    }
    if (!evidence.ingestionBoundaryVerified) {
      reasons.push("INGESTION_BOUNDARY_NOT_VERIFIED");
    }
  }
  if (stage === "ROUND0_REVIEW" || stage === "ASSERTION_RUNTIME") {
    if (!evidence.round0BoundaryVerified) {
      reasons.push("ROUND0_BOUNDARY_NOT_VERIFIED");
    }
  }
  if (stage === "ASSERTION_RUNTIME" && !evidence.assertionBoundaryVerified) {
    reasons.push("ASSERTION_BOUNDARY_NOT_VERIFIED");
  }

  // Anything except the exact local-build code must retain the production
  // trusted-writer blocker. A malformed mode cannot route around it.
  if (mode !== "LOCAL_BUILD") {
    reasons.push("AUTHENTICATED_PRODUCTION_REPOSITORY_RECEIPT_REQUIRED");
  }

  const uniqueReasons = [...new Set(reasons)];
  return Object.freeze({
    ready: uniqueReasons.length === 0,
    stage,
    mode,
    reasons: Object.freeze(
      uniqueReasons.length === 0 ? (["READY"] as const) : uniqueReasons,
    ),
    trustedWriterDependency: "BOUNDED",
    productionActivation: "BLOCKED",
  });
}
