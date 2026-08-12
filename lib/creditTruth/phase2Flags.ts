import { createHash } from "node:crypto";
import type {
  P0AuthorizationKind,
  P0Principal,
  P0Scope,
} from "./principal";
import {
  p0PrincipalAuthorizesScope,
  validateP0Principal,
} from "./principal";
import {
  P0_PHASE2A_STAGES,
  evaluateP0Phase2AReadiness,
  type P0Phase2AReadinessDecision,
  type P0Phase2AReadinessEvidence,
  type P0Phase2AStage,
  type P0ReadinessMode,
} from "./phase2Readiness";
import { isStrictIsoInstant } from "./progressIntelligence";

export const P0_PHASE2A_FLAG_CONTRACT_VERSION = "p0-phase2a-flags-v1" as const;
const SHA256 = /^[0-9a-f]{64}$/;

export interface P0Phase2AFlags {
  readonly phase2Enabled: boolean;
  readonly killSwitchEngaged: boolean;
  readonly ingestionShadowEnabled: boolean;
  readonly round0ReviewEnabled: boolean;
  readonly assertionRuntimeEnabled: boolean;
}

export type P0Phase2AFlagResolutionKind =
  | "SERVER_ENVIRONMENT"
  | "LOCAL_SYNTHETIC";

export interface P0Phase2ALocalSyntheticFlagAttestor {
  readonly attestorId: string;
  verifyLocalSyntheticFlags(input: {
    readonly flags: Readonly<P0Phase2AFlags>;
    readonly semanticSha256: string;
  }): Promise<boolean>;
}

const RESOLVED_P0_PHASE2A_FLAGS = Symbol("resolved-p0-phase2a-flags");
const resolvedFlagSets = new WeakSet<object>();
const resolvedFlagDigests = new WeakMap<object, string>();

export interface ResolvedP0Phase2AFlags extends P0Phase2AFlags {
  readonly resolutionKind: P0Phase2AFlagResolutionKind;
  readonly resolverId: string;
  readonly resolvedAt: string;
  readonly semanticSha256: string;
  readonly [RESOLVED_P0_PHASE2A_FLAGS]: true;
}

export interface P0Phase2ACohortDecisionCandidate {
  readonly contractVersion: typeof P0_PHASE2A_FLAG_CONTRACT_VERSION;
  readonly decisionId: string;
  readonly stage: P0Phase2AStage;
  readonly actorId: string;
  readonly tenantId: string;
  readonly consumerId: string;
  readonly authorizationKind: P0AuthorizationKind;
  readonly authorizationVersion: string;
  readonly cohortVersion: string;
  readonly included: boolean;
  readonly decidedAt: string;
  readonly expiresAt: string;
}

export interface P0Phase2ACohortResolver {
  readonly resolverId: string;
  verifyServerResolvedCohort(input: {
    readonly candidate: P0Phase2ACohortDecisionCandidate;
    readonly semanticSha256: string;
  }): Promise<boolean>;
}

const VERIFIED_COHORT_DECISION = Symbol("verified-p0-phase2a-cohort-decision");
const verifiedCohortDecisions = new WeakSet<object>();
const verifiedCohortDigests = new WeakMap<object, string>();

export interface VerifiedP0Phase2ACohortDecision
  extends P0Phase2ACohortDecisionCandidate {
  readonly resolverId: string;
  readonly semanticSha256: string;
  readonly [VERIFIED_COHORT_DECISION]: true;
}

export type P0Phase2AGateReason =
  | "ALLOWED"
  | "INVALID_PRINCIPAL_OR_SCOPE"
  | "PHASE2_MASTER_DISABLED"
  | "KILL_SWITCH_ENGAGED"
  | "INGESTION_SHADOW_DISABLED"
  | "ROUND0_REVIEW_DISABLED"
  | "ASSERTION_RUNTIME_DISABLED"
  | "SERVER_FLAGS_MISSING_OR_INVALID"
  | "LOCAL_SYNTHETIC_FLAGS_NOT_PRODUCTION_AUTHORITY"
  | "COHORT_DECISION_MISSING_OR_INVALID"
  | "COHORT_EXCLUDED"
  | "READINESS_NOT_SATISFIED";

export interface P0Phase2AGateDecision {
  readonly allowed: boolean;
  readonly stage: P0Phase2AStage;
  readonly reasons: readonly P0Phase2AGateReason[];
  readonly readiness: P0Phase2AReadinessDecision;
}

const P0_PHASE2A_GATE_PERMIT = Symbol("p0-phase2a-gate-permit");
const verifiedGatePermits = new WeakSet<object>();
const verifiedGatePermitDigests = new WeakMap<object, string>();
const P0_PHASE2A_GATE_PERMIT_LIFETIME_MS = 60_000;

/**
 * Process-local proof that the exact principal/scope/stage passed every
 * server-side flag, cohort, and readiness gate. It cannot be reconstructed
 * from a plain gate decision or serialized across a process boundary.
 */
export interface P0Phase2AGatePermit {
  readonly contractVersion: typeof P0_PHASE2A_FLAG_CONTRACT_VERSION;
  readonly permitId: string;
  readonly stage: P0Phase2AStage;
  readonly mode: P0ReadinessMode;
  readonly operationId: string;
  readonly actorId: string;
  readonly tenantId: string;
  readonly consumerId: string;
  readonly authorizationKind: P0AuthorizationKind;
  readonly authorizationVersion: string;
  readonly cohortDecisionId: string;
  readonly cohortVersion: string;
  readonly cohortExpiresAt: string;
  readonly flagResolutionKind: P0Phase2AFlagResolutionKind;
  readonly flagSemanticSha256: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly semanticSha256: string;
  readonly [P0_PHASE2A_GATE_PERMIT]: true;
}

function exactTrue(value: unknown): boolean {
  return value === "true";
}

function flagsSemanticSha256(input: {
  readonly flags: P0Phase2AFlags;
  readonly resolutionKind: P0Phase2AFlagResolutionKind;
  readonly resolverId: string;
  readonly resolvedAt: string;
}): string {
  return createHash("sha256")
    .update(
      JSON.stringify([
        input.flags.phase2Enabled,
        input.flags.killSwitchEngaged,
        input.flags.ingestionShadowEnabled,
        input.flags.round0ReviewEnabled,
        input.flags.assertionRuntimeEnabled,
        input.resolutionKind,
        input.resolverId,
        input.resolvedAt,
      ]),
      "utf8",
    )
    .digest("hex");
}

function validPlainFlags(flags: unknown): flags is P0Phase2AFlags {
  if (!flags || typeof flags !== "object") return false;
  const value = flags as P0Phase2AFlags;
  return (
    Object.keys(value).length === 5 &&
    typeof value.phase2Enabled === "boolean" &&
    typeof value.killSwitchEngaged === "boolean" &&
    typeof value.ingestionShadowEnabled === "boolean" &&
    typeof value.round0ReviewEnabled === "boolean" &&
    typeof value.assertionRuntimeEnabled === "boolean"
  );
}

function mintResolvedFlags(input: {
  readonly flags: P0Phase2AFlags;
  readonly resolutionKind: P0Phase2AFlagResolutionKind;
  readonly resolverId: string;
  readonly resolvedAt: string;
}): ResolvedP0Phase2AFlags {
  const semanticSha256 = flagsSemanticSha256(input);
  const resolved = {
    ...input.flags,
    resolutionKind: input.resolutionKind,
    resolverId: input.resolverId,
    resolvedAt: input.resolvedAt,
    semanticSha256,
  } as ResolvedP0Phase2AFlags;
  Object.defineProperty(resolved, RESOLVED_P0_PHASE2A_FLAGS, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  resolvedFlagSets.add(resolved);
  resolvedFlagDigests.set(resolved, semanticSha256);
  return Object.freeze(resolved);
}

export function isResolvedP0Phase2AFlags(
  flags: ResolvedP0Phase2AFlags | P0Phase2AFlags | null | undefined,
): flags is ResolvedP0Phase2AFlags {
  if (
    !flags ||
    (flags as ResolvedP0Phase2AFlags)[RESOLVED_P0_PHASE2A_FLAGS] !== true ||
    !resolvedFlagSets.has(flags)
  ) {
    return false;
  }
  const resolved = flags as ResolvedP0Phase2AFlags;
  const plain = {
    phase2Enabled: resolved.phase2Enabled,
    killSwitchEngaged: resolved.killSwitchEngaged,
    ingestionShadowEnabled: resolved.ingestionShadowEnabled,
    round0ReviewEnabled: resolved.round0ReviewEnabled,
    assertionRuntimeEnabled: resolved.assertionRuntimeEnabled,
  };
  return (
    validPlainFlags(plain) &&
    (resolved.resolutionKind === "SERVER_ENVIRONMENT" ||
      resolved.resolutionKind === "LOCAL_SYNTHETIC") &&
    nonEmpty(resolved.resolverId) &&
    isStrictIsoInstant(resolved.resolvedAt) &&
    SHA256.test(resolved.semanticSha256) &&
    resolvedFlagDigests.get(resolved) === resolved.semanticSha256 &&
    flagsSemanticSha256({
      flags: plain,
      resolutionKind: resolved.resolutionKind,
      resolverId: resolved.resolverId,
      resolvedAt: resolved.resolvedAt,
    }) === resolved.semanticSha256
  );
}

/** Reads the live server environment only; no env/request object is injectable. */
export function p0Phase2AFlagsFromEnv(): ResolvedP0Phase2AFlags {
  return mintResolvedFlags({
    flags: {
      phase2Enabled: exactTrue(process.env.P0_PHASE2_ENABLED),
      killSwitchEngaged: exactTrue(process.env.P0_PHASE2_KILL_SWITCH),
      ingestionShadowEnabled: exactTrue(
        process.env.P0_INGESTION_SHADOW_ENABLED,
      ),
      round0ReviewEnabled: exactTrue(process.env.P0_ROUND0_REVIEW_ENABLED),
      assertionRuntimeEnabled: exactTrue(
        process.env.P0_ASSERTION_RUNTIME_ENABLED,
      ),
    },
    resolutionKind: "SERVER_ENVIRONMENT",
    resolverId: "process.env:p0-phase2a",
    resolvedAt: new Date(Date.now()).toISOString(),
  });
}

/** Explicit synthetic test/build seam; its brand is never production authority. */
export async function attestLocalSyntheticP0Phase2AFlags(
  flags: P0Phase2AFlags,
  attestor: P0Phase2ALocalSyntheticFlagAttestor,
): Promise<ResolvedP0Phase2AFlags | null> {
  if (
    process.env.NODE_ENV === "production" ||
    !validPlainFlags(flags) ||
    !nonEmpty(attestor?.attestorId)
  ) {
    return null;
  }
  const snapshot = Object.freeze({ ...flags });
  const resolvedAt = new Date(Date.now()).toISOString();
  const semanticSha256 = flagsSemanticSha256({
    flags: snapshot,
    resolutionKind: "LOCAL_SYNTHETIC",
    resolverId: attestor.attestorId,
    resolvedAt,
  });
  let approved = false;
  try {
    approved = await attestor.verifyLocalSyntheticFlags({
      flags: snapshot,
      semanticSha256,
    });
  } catch {
    return null;
  }
  if (!approved) return null;
  return mintResolvedFlags({
    flags: snapshot,
    resolutionKind: "LOCAL_SYNTHETIC",
    resolverId: attestor.attestorId,
    resolvedAt,
  });
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function cohortSemanticSha256(
  candidate: P0Phase2ACohortDecisionCandidate,
): string {
  return createHash("sha256")
    .update(
      JSON.stringify([
        candidate.contractVersion,
        candidate.decisionId,
        candidate.stage,
        candidate.actorId,
        candidate.tenantId,
        candidate.consumerId,
        candidate.authorizationKind,
        candidate.authorizationVersion,
        candidate.cohortVersion,
        candidate.included,
        candidate.decidedAt,
        candidate.expiresAt,
      ]),
      "utf8",
    )
    .digest("hex");
}

function validCohortCandidate(
  candidate: P0Phase2ACohortDecisionCandidate,
): boolean {
  const decided = isStrictIsoInstant(candidate.decidedAt)
    ? Date.parse(candidate.decidedAt)
    : Number.NaN;
  const expires = isStrictIsoInstant(candidate.expiresAt)
    ? Date.parse(candidate.expiresAt)
    : Number.NaN;
  return (
    candidate.contractVersion === P0_PHASE2A_FLAG_CONTRACT_VERSION &&
    nonEmpty(candidate.decisionId) &&
    ["ROOT", "INGESTION_SHADOW", "ROUND0_REVIEW", "ASSERTION_RUNTIME"].includes(
      candidate.stage,
    ) &&
    nonEmpty(candidate.actorId) &&
    nonEmpty(candidate.tenantId) &&
    nonEmpty(candidate.consumerId) &&
    nonEmpty(candidate.authorizationKind) &&
    nonEmpty(candidate.authorizationVersion) &&
    nonEmpty(candidate.cohortVersion) &&
    typeof candidate.included === "boolean" &&
    Number.isFinite(decided) &&
    Number.isFinite(expires) &&
    expires > decided
  );
}

export async function verifyP0Phase2ACohortDecision(
  candidate: P0Phase2ACohortDecisionCandidate,
  resolver: P0Phase2ACohortResolver,
): Promise<VerifiedP0Phase2ACohortDecision | null> {
  if (!validCohortCandidate(candidate) || !nonEmpty(resolver?.resolverId)) {
    return null;
  }
  const snapshot = Object.freeze({ ...candidate });
  const digest = cohortSemanticSha256(snapshot);
  let approved = false;
  try {
    approved = await resolver.verifyServerResolvedCohort({
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
    resolverId: resolver.resolverId,
    semanticSha256: digest,
  } as VerifiedP0Phase2ACohortDecision;
  Object.defineProperty(verified, VERIFIED_COHORT_DECISION, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  verifiedCohortDecisions.add(verified);
  verifiedCohortDigests.set(verified, digest);
  return Object.freeze(verified);
}

/** Opaque deployment-cohort key; no tenant/consumer value is stored in config. */
export function p0Phase2ACohortScopeSha256(scope: P0Scope): string {
  if (
    !scope ||
    !nonEmpty(scope.tenantId) ||
    !nonEmpty(scope.consumerId)
  ) {
    return "";
  }
  return createHash("sha256")
    .update("CreditVector/P0/phase2a/cohort-scope/v1\n", "utf8")
    .update(scope.tenantId, "utf8")
    .update("\u001f", "utf8")
    .update(scope.consumerId, "utf8")
    .digest("hex");
}

/**
 * Concrete deployment cohort resolver. It reads only server environment state;
 * request/query/body flags and scope claims cannot inject a decision. An absent
 * or malformed allowlist fails closed.
 */
export async function resolveP0Phase2ACohortFromServerEnvironment(input: {
  readonly principal: P0Principal;
  readonly scope: P0Scope;
  readonly stage: P0Phase2AStage;
}): Promise<VerifiedP0Phase2ACohortDecision | null> {
  if (
    validateP0Principal(input.principal).length > 0 ||
    !p0PrincipalAuthorizesScope(input.principal, input.scope) ||
    !P0_PHASE2A_STAGES.includes(input.stage)
  ) {
    return null;
  }
  const cohortVersion = process.env.P0_PHASE2_COHORT_VERSION?.trim();
  const encodedAllowlist = process.env.P0_PHASE2_COHORT_SCOPE_SHA256S;
  if (
    !cohortVersion ||
    cohortVersion.length > 200 ||
    !/^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,199}$/.test(cohortVersion) ||
    typeof encodedAllowlist !== "string" ||
    encodedAllowlist.length > 65_000
  ) {
    return null;
  }
  const entries = encodedAllowlist.length === 0
    ? []
    : encodedAllowlist.split(",");
  if (
    entries.length > 1_000 ||
    entries.some((entry) => !SHA256.test(entry)) ||
    new Set(entries).size !== entries.length
  ) {
    return null;
  }
  const scopeSha256 = p0Phase2ACohortScopeSha256(input.scope);
  if (!SHA256.test(scopeSha256)) return null;
  const nowMs = Date.now();
  const decidedAt = new Date(nowMs).toISOString();
  const expiresAt = new Date(nowMs + 60_000).toISOString();
  const included = entries.includes(scopeSha256);
  const decisionId = `p0-cohort:${createHash("sha256")
    .update(
      JSON.stringify([
        cohortVersion,
        input.stage,
        input.principal.actorId,
        scopeSha256,
        input.principal.authorizationVersion,
        decidedAt,
      ]),
      "utf8",
    )
    .digest("hex")}`;
  const candidate = Object.freeze({
    contractVersion: P0_PHASE2A_FLAG_CONTRACT_VERSION,
    decisionId,
    stage: input.stage,
    actorId: input.principal.actorId,
    tenantId: input.scope.tenantId,
    consumerId: input.scope.consumerId,
    authorizationKind: input.principal.authorizationKind,
    authorizationVersion: input.principal.authorizationVersion,
    cohortVersion,
    included,
    decidedAt,
    expiresAt,
  });
  const expectedDigest = cohortSemanticSha256(candidate);
  return verifyP0Phase2ACohortDecision(candidate, {
    resolverId: "server-env:p0-phase2a-cohort-v1",
    async verifyServerResolvedCohort({ semanticSha256 }) {
      return semanticSha256 === expectedDigest;
    },
  });
}

function validVerifiedCohort(
  decision: VerifiedP0Phase2ACohortDecision | null,
  principal: P0Principal,
  scope: P0Scope,
  stage: P0Phase2AStage,
  now: Date,
): boolean {
  if (
    !decision ||
    decision[VERIFIED_COHORT_DECISION] !== true ||
    !verifiedCohortDecisions.has(decision) ||
    !validCohortCandidate(decision) ||
    verifiedCohortDigests.get(decision) !== decision.semanticSha256 ||
    cohortSemanticSha256(decision) !== decision.semanticSha256
  ) {
    return false;
  }
  return (
    decision.stage === stage &&
    decision.actorId === principal.actorId &&
    decision.tenantId === scope.tenantId &&
    decision.consumerId === scope.consumerId &&
    decision.authorizationKind === principal.authorizationKind &&
    decision.authorizationVersion === principal.authorizationVersion &&
    Date.parse(decision.decidedAt) <= now.getTime() &&
    Date.parse(decision.expiresAt) > now.getTime()
  );
}

function requiredFlagReasons(
  flags: P0Phase2AFlags,
  stage: P0Phase2AStage,
): P0Phase2AGateReason[] {
  const reasons: P0Phase2AGateReason[] = [];
  if (!flags.phase2Enabled) reasons.push("PHASE2_MASTER_DISABLED");
  if (flags.killSwitchEngaged) reasons.push("KILL_SWITCH_ENGAGED");
  if (stage !== "ROOT" && !flags.ingestionShadowEnabled) {
    reasons.push("INGESTION_SHADOW_DISABLED");
  }
  if (
    (stage === "ROUND0_REVIEW" || stage === "ASSERTION_RUNTIME") &&
    !flags.round0ReviewEnabled
  ) {
    reasons.push("ROUND0_REVIEW_DISABLED");
  }
  if (stage === "ASSERTION_RUNTIME" && !flags.assertionRuntimeEnabled) {
    reasons.push("ASSERTION_RUNTIME_DISABLED");
  }
  return reasons;
}

export function evaluateP0Phase2AGate(input: {
  readonly stage: P0Phase2AStage;
  readonly mode: P0ReadinessMode;
  readonly flags: ResolvedP0Phase2AFlags;
  readonly principal: P0Principal;
  readonly scope: P0Scope;
  readonly cohortDecision: VerifiedP0Phase2ACohortDecision | null;
  readonly readinessEvidence: P0Phase2AReadinessEvidence;
}): P0Phase2AGateDecision {
  const now = new Date(Date.now());
  const readiness = evaluateP0Phase2AReadiness({
    stage: input.stage,
    mode: input.mode,
    evidence: input.readinessEvidence,
    now,
  });
  const flagsValid = isResolvedP0Phase2AFlags(input.flags);
  const reasons = flagsValid
    ? requiredFlagReasons(input.flags, input.stage)
    : (["SERVER_FLAGS_MISSING_OR_INVALID"] as P0Phase2AGateReason[]);
  if (
    flagsValid &&
    input.flags.resolutionKind === "LOCAL_SYNTHETIC" &&
    (input.mode !== "LOCAL_BUILD" || process.env.NODE_ENV === "production")
  ) {
    reasons.push("LOCAL_SYNTHETIC_FLAGS_NOT_PRODUCTION_AUTHORITY");
  }
  if (
    validateP0Principal(input.principal).length > 0 ||
    !p0PrincipalAuthorizesScope(input.principal, input.scope)
  ) {
    reasons.push("INVALID_PRINCIPAL_OR_SCOPE");
  }
  const cohortValid = validVerifiedCohort(
    input.cohortDecision,
    input.principal,
    input.scope,
    input.stage,
    now,
  );
  if (!cohortValid) {
    reasons.push("COHORT_DECISION_MISSING_OR_INVALID");
  } else if (!input.cohortDecision?.included) {
    reasons.push("COHORT_EXCLUDED");
  }
  if (!readiness.ready) reasons.push("READINESS_NOT_SATISFIED");
  const uniqueReasons = [...new Set(reasons)];
  return Object.freeze({
    allowed: uniqueReasons.length === 0,
    stage: input.stage,
    reasons: Object.freeze(
      uniqueReasons.length === 0 ? (["ALLOWED"] as const) : uniqueReasons,
    ),
    readiness,
  });
}

function gatePermitSemanticSha256(
  permit: Omit<P0Phase2AGatePermit, "semanticSha256" | typeof P0_PHASE2A_GATE_PERMIT>,
): string {
  return createHash("sha256")
    .update(
      JSON.stringify([
        permit.contractVersion,
        permit.permitId,
        permit.stage,
        permit.mode,
        permit.operationId,
        permit.actorId,
        permit.tenantId,
        permit.consumerId,
        permit.authorizationKind,
        permit.authorizationVersion,
        permit.cohortDecisionId,
        permit.cohortVersion,
        permit.cohortExpiresAt,
        permit.flagResolutionKind,
        permit.flagSemanticSha256,
        permit.issuedAt,
        permit.expiresAt,
      ]),
      "utf8",
    )
    .digest("hex");
}

/** Evaluates the live server gate and mints a short-lived permit only on allow. */
export function evaluateAndMintP0Phase2AGatePermit(input: {
  readonly stage: P0Phase2AStage;
  readonly mode: P0ReadinessMode;
  readonly operationId: string;
  readonly flags: ResolvedP0Phase2AFlags;
  readonly principal: P0Principal;
  readonly scope: P0Scope;
  readonly cohortDecision: VerifiedP0Phase2ACohortDecision | null;
  readonly readinessEvidence: P0Phase2AReadinessEvidence;
}): P0Phase2AGatePermit | null {
  const decision = evaluateP0Phase2AGate(input);
  if (!decision.allowed || !input.cohortDecision || !nonEmpty(input.operationId)) {
    return null;
  }
  const nowMs = Date.now();
  const issuedAt = new Date(nowMs).toISOString();
  const expiresAtMs = Math.min(
    nowMs + P0_PHASE2A_GATE_PERMIT_LIFETIME_MS,
    Date.parse(input.cohortDecision.expiresAt),
  );
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= nowMs) return null;
  const expiresAt = new Date(expiresAtMs).toISOString();
  const unsigned = {
    contractVersion: P0_PHASE2A_FLAG_CONTRACT_VERSION,
    permitId: `p0-gate:${input.cohortDecision.decisionId}:${input.stage}:${input.operationId}:${issuedAt}`,
    stage: input.stage,
    mode: input.mode,
    operationId: input.operationId,
    actorId: input.principal.actorId,
    tenantId: input.scope.tenantId,
    consumerId: input.scope.consumerId,
    authorizationKind: input.principal.authorizationKind,
    authorizationVersion: input.principal.authorizationVersion,
    cohortDecisionId: input.cohortDecision.decisionId,
    cohortVersion: input.cohortDecision.cohortVersion,
    cohortExpiresAt: input.cohortDecision.expiresAt,
    flagResolutionKind: input.flags.resolutionKind,
    flagSemanticSha256: input.flags.semanticSha256,
    issuedAt,
    expiresAt,
  } as const;
  const semanticSha256 = gatePermitSemanticSha256(unsigned);
  const permit = { ...unsigned, semanticSha256 } as P0Phase2AGatePermit;
  Object.defineProperty(permit, P0_PHASE2A_GATE_PERMIT, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  verifiedGatePermits.add(permit);
  verifiedGatePermitDigests.set(permit, semanticSha256);
  return Object.freeze(permit);
}

/** Exact, fail-closed validation for a service entrypoint. */
export function p0Phase2AGatePermitAuthorizes(input: {
  readonly permit: P0Phase2AGatePermit | null | undefined;
  readonly principal: P0Principal;
  readonly scope: P0Scope;
  readonly stage: P0Phase2AStage;
  readonly mode: P0ReadinessMode;
  readonly operationId: string;
}): input is typeof input & { readonly permit: P0Phase2AGatePermit } {
  const { permit, principal, scope, stage, mode, operationId } = input;
  const nowMs = Date.now();
  const liveFlags = p0Phase2AFlagsFromEnv();
  if (
    !permit ||
    permit[P0_PHASE2A_GATE_PERMIT] !== true ||
    !verifiedGatePermits.has(permit) ||
    verifiedGatePermitDigests.get(permit) !== permit.semanticSha256 ||
    !SHA256.test(permit.semanticSha256) ||
    validateP0Principal(principal).length > 0 ||
    !p0PrincipalAuthorizesScope(principal, scope) ||
    requiredFlagReasons(liveFlags, stage).length > 0
  ) {
    return false;
  }
  const unsigned = {
    contractVersion: permit.contractVersion,
    permitId: permit.permitId,
    stage: permit.stage,
    mode: permit.mode,
    operationId: permit.operationId,
    actorId: permit.actorId,
    tenantId: permit.tenantId,
    consumerId: permit.consumerId,
    authorizationKind: permit.authorizationKind,
    authorizationVersion: permit.authorizationVersion,
    cohortDecisionId: permit.cohortDecisionId,
    cohortVersion: permit.cohortVersion,
    cohortExpiresAt: permit.cohortExpiresAt,
    flagResolutionKind: permit.flagResolutionKind,
    flagSemanticSha256: permit.flagSemanticSha256,
    issuedAt: permit.issuedAt,
    expiresAt: permit.expiresAt,
  };
  return (
    gatePermitSemanticSha256(unsigned) === permit.semanticSha256 &&
    permit.contractVersion === P0_PHASE2A_FLAG_CONTRACT_VERSION &&
    permit.stage === stage &&
    permit.mode === mode &&
    permit.operationId === operationId &&
    permit.actorId === principal.actorId &&
    permit.tenantId === scope.tenantId &&
    permit.consumerId === scope.consumerId &&
    permit.authorizationKind === principal.authorizationKind &&
    permit.authorizationVersion === principal.authorizationVersion &&
    (permit.flagResolutionKind === "SERVER_ENVIRONMENT" ||
      (permit.flagResolutionKind === "LOCAL_SYNTHETIC" &&
        mode === "LOCAL_BUILD" &&
        process.env.NODE_ENV !== "production")) &&
    SHA256.test(permit.flagSemanticSha256) &&
    isStrictIsoInstant(permit.issuedAt) &&
    isStrictIsoInstant(permit.expiresAt) &&
    isStrictIsoInstant(permit.cohortExpiresAt) &&
    Date.parse(permit.issuedAt) <= nowMs &&
    Date.parse(permit.expiresAt) > nowMs &&
    Date.parse(permit.expiresAt) <= Date.parse(permit.cohortExpiresAt) &&
    Date.parse(permit.expiresAt) - Date.parse(permit.issuedAt) > 0 &&
    Date.parse(permit.expiresAt) - Date.parse(permit.issuedAt) <=
      P0_PHASE2A_GATE_PERMIT_LIFETIME_MS
  );
}
