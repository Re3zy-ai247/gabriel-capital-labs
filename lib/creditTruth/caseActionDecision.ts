import { createHash } from "node:crypto";
import type { Bureau } from "@prisma/client";
import type { P0Principal, P0Scope } from "./principal";
import {
  p0PrincipalAuthorizesScope,
  validateP0Principal,
} from "./principal";
import { isStrictIsoInstant } from "./progressIntelligence";
import {
  p0Phase2AGatePermitAuthorizes,
  type P0Phase2AGatePermit,
} from "./phase2Flags";

export const CASE_ACTION_DECISION_CONTRACT_VERSION =
  "p0-case-action-decision-v1" as const;

export const CASE_ACTION_CODES = [
  "REVIEW_ACCOUNT_FACT",
  "REVIEW_IDENTITY_FACT",
  "REQUEST_ACCOUNT_CORRECTION",
  "REQUEST_IDENTITY_CORRECTION",
  "TAKE_NO_ACTION",
  "DEFER_REVIEW",
] as const;
export type CaseActionCode = (typeof CASE_ACTION_CODES)[number];

export const CASE_ACTION_STATES = [
  "PROPOSED",
  "CONSUMER_SELECTED",
  "DECLINED",
  "WAITING",
  "BLOCKED",
] as const;
export type CaseActionState = (typeof CASE_ACTION_STATES)[number];

export const CASE_ACTION_SOURCE_TYPES = [
  "FIELD_OBSERVATION",
  "DERIVED_ACCOUNT_ASSESSMENT",
  "CONSUMER_ASSERTION",
  "CONSUMER_ACCOUNT_REVIEW",
  "IDENTITY_FACT",
  "IDENTITY_CORRESPONDENCE_ASSERTION",
  "IDENTITY_CATEGORY_COMPLETION",
] as const;
export type CaseActionSourceType = (typeof CASE_ACTION_SOURCE_TYPES)[number];

export interface CaseActionSourceRef {
  readonly sourceType: CaseActionSourceType;
  readonly sourceId: string;
  readonly sourceVersion: number;
  readonly bureau: Bureau | null;
  readonly integritySha256: string;
}

export interface CaseActionDecisionRecord {
  readonly contractVersion: typeof CASE_ACTION_DECISION_CONTRACT_VERSION;
  readonly decisionId: string;
  readonly operationId: string;
  readonly tenantId: string;
  readonly consumerId: string;
  readonly reportVersionId: string;
  readonly caseId: string;
  readonly actionCode: CaseActionCode;
  readonly state: CaseActionState;
  readonly chronologyRound: number;
  readonly chronologyAuthority: "ORDERING_ONLY_NOT_POLICY_AUTHORITY";
  readonly sourceSet: readonly CaseActionSourceRef[];
  readonly expectedSourceCount: number;
  readonly sourceSetSha256: string;
  readonly decisionSeriesKey: string;
  readonly version: number;
  readonly supersedesDecisionId: string | null;
  readonly decidedByActorId: string;
  readonly decidedAt: string;
}

export interface CaseActionDecisionRepository {
  readCaseActionSourceSet(input: {
    readonly principal: P0Principal;
    readonly scope: P0Scope;
    readonly purpose: "CASE_ACTION_SOURCE_READ";
    readonly reportVersionId: string;
    readonly caseId: string;
    readonly sourceSelectors: readonly {
      readonly sourceType: CaseActionSourceType;
      readonly sourceId: string;
    }[];
  }): Promise<readonly CaseActionSourceRef[]>;
  readCaseActionDecision(input: {
    readonly principal: P0Principal;
    readonly scope: P0Scope;
    readonly purpose: "CASE_ACTION_DECISION_READ" | "CASE_ACTION_DECISION_READBACK";
    readonly gatePermit: P0Phase2AGatePermit;
    readonly decisionId: string;
  }): Promise<CaseActionDecisionRecord | null>;
  appendCaseActionDecision(input: {
    readonly principal: P0Principal;
    readonly scope: P0Scope;
    readonly purpose: "CASE_ACTION_DECISION_APPEND";
    readonly gatePermit: P0Phase2AGatePermit;
    readonly decision: CaseActionDecisionRecord;
  }): Promise<{ readonly disposition: "CREATED" | "IDEMPOTENT_REPLAY" }>;
  verifyCurrentCaseActionAssertionSource(input: {
    readonly principal: P0Principal;
    readonly scope: P0Scope;
    readonly purpose: "CASE_ACTION_CURRENT_ASSERTION_VERIFY";
    readonly gatePermit: P0Phase2AGatePermit;
    /**
     * Verifies both the assertion head and its confirmed IdentityBaseline head;
     * an immutable assertion on a superseded baseline is historical only.
     */
    readonly source: CaseActionSourceRef;
  }): Promise<boolean>;
  verifyCurrentCaseActionAccountReviewSource(input: {
    readonly principal: P0Principal;
    readonly scope: P0Scope;
    readonly purpose: "CASE_ACTION_CURRENT_ACCOUNT_REVIEW_VERIFY";
    readonly gatePermit: P0Phase2AGatePermit;
    /** Exact current receipt: version, bureau, and source-set digest. */
    readonly source: CaseActionSourceRef & {
      readonly sourceType: "CONSUMER_ACCOUNT_REVIEW";
    };
  }): Promise<boolean>;
  verifyCurrentCaseActionIdentityCategoryCompletionSource(input: {
    readonly principal: P0Principal;
    readonly scope: P0Scope;
    readonly purpose: "CASE_ACTION_CURRENT_IDENTITY_COMPLETION_VERIFY";
    readonly gatePermit: P0Phase2AGatePermit;
    /**
     * Must prove both the immutable completion and its CONFIRMED
     * IdentityBaseline remain current. A completion on a superseded baseline is
     * historical evidence, never current action authority.
     */
    readonly source: CaseActionSourceRef & {
      readonly sourceType: "IDENTITY_CATEGORY_COMPLETION";
    };
  }): Promise<boolean>;
}

export type AppendCaseActionDecisionResult =
  | {
      readonly ok: true;
      readonly disposition: "CREATED" | "IDEMPOTENT_REPLAY";
      readonly decision: CaseActionDecisionRecord;
    }
  | {
      readonly ok: false;
      readonly code:
        | "INVALID_PRINCIPAL_OR_SCOPE"
        | "CONSUMER_AUTHORITY_REQUIRED"
        | "GATE_DENIED"
        | "INVALID_REQUEST"
        | "SOURCE_SET_MISMATCH"
        | "SUPERSESSION_MISMATCH"
        | "READBACK_MISMATCH"
        | "OUTCOME_UNKNOWN";
    };

const SHA256 = /^[0-9a-f]{64}$/;
const SOURCE_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,190}$/;
const CONSUMER_AUTHORITY_STATES: readonly CaseActionState[] = [
  "CONSUMER_SELECTED",
  "DECLINED",
  "WAITING",
];
const ACCOUNT_REVIEW_ACTION_CODES: readonly CaseActionCode[] = [
  "REVIEW_ACCOUNT_FACT",
  "DEFER_REVIEW",
  "TAKE_NO_ACTION",
];

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validBureau(value: unknown): value is Bureau | null {
  return (
    value === null ||
    value === "EQUIFAX" ||
    value === "EXPERIAN" ||
    value === "TRANSUNION"
  );
}

function validSource(source: unknown): source is CaseActionSourceRef {
  if (!source || typeof source !== "object") return false;
  const value = source as CaseActionSourceRef;
  return (
    Object.keys(value).length === 5 &&
    CASE_ACTION_SOURCE_TYPES.includes(value.sourceType) &&
    SOURCE_ID.test(value.sourceId) &&
    Number.isSafeInteger(value.sourceVersion) &&
    value.sourceVersion > 0 &&
    validBureau(value.bureau) &&
    (value.sourceType !== "CONSUMER_ACCOUNT_REVIEW" ||
      value.bureau !== null) &&
    SHA256.test(value.integritySha256)
  );
}

function canonicalSourceSet(
  sources: readonly CaseActionSourceRef[],
): readonly CaseActionSourceRef[] {
  if (!Array.isArray(sources) || sources.length < 1 || sources.length > 256) {
    throw new Error("case action requires a bounded non-empty source set");
  }
  const snapshots = sources.map((source) => {
    if (!validSource(source)) throw new Error("invalid case action source");
    return Object.freeze({ ...source });
  });
  snapshots.sort((left, right) => {
    const leftStrings = [left.sourceType, left.sourceId, left.bureau ?? ""];
    const rightStrings = [right.sourceType, right.sourceId, right.bureau ?? ""];
    for (let index = 0; index < leftStrings.length; index += 1) {
      const leftValue = leftStrings[index] ?? "";
      const rightValue = rightStrings[index] ?? "";
      if (leftValue < rightValue) return -1;
      if (leftValue > rightValue) return 1;
      if (index === 1 && left.sourceVersion !== right.sourceVersion) {
        return left.sourceVersion - right.sourceVersion;
      }
    }
    return 0;
  });
  const identities = snapshots.map(
    (source) => `${source.sourceType}:${source.sourceId}:${source.sourceVersion}`,
  );
  if (new Set(identities).size !== identities.length) {
    throw new Error("duplicate case action source identity");
  }
  return Object.freeze(snapshots);
}

export function computeCaseActionSourceSetSha256(
  sources: readonly CaseActionSourceRef[],
): string {
  const canonical = canonicalSourceSet(sources);
  return createHash("sha256")
    .update(
      JSON.stringify(
        canonical.map((source) => [
          source.sourceType,
          source.sourceId,
          source.sourceVersion,
          source.bureau,
          source.integritySha256,
        ]),
      ),
      "utf8",
    )
    .digest("hex");
}

function validDecision(value: unknown): value is CaseActionDecisionRecord {
  if (!value || typeof value !== "object") return false;
  const decision = value as CaseActionDecisionRecord;
  try {
    return (
      Object.keys(decision).length === 19 &&
      decision.contractVersion === CASE_ACTION_DECISION_CONTRACT_VERSION &&
      nonEmpty(decision.decisionId) &&
      nonEmpty(decision.operationId) &&
      nonEmpty(decision.tenantId) &&
      nonEmpty(decision.consumerId) &&
      nonEmpty(decision.reportVersionId) &&
      nonEmpty(decision.caseId) &&
      CASE_ACTION_CODES.includes(decision.actionCode) &&
      CASE_ACTION_STATES.includes(decision.state) &&
      Number.isSafeInteger(decision.chronologyRound) &&
      decision.chronologyRound > 0 &&
      decision.chronologyAuthority === "ORDERING_ONLY_NOT_POLICY_AUTHORITY" &&
      Number.isSafeInteger(decision.expectedSourceCount) &&
      decision.expectedSourceCount >= 1 &&
      decision.expectedSourceCount <= 256 &&
      decision.sourceSet.length === decision.expectedSourceCount &&
      computeCaseActionSourceSetSha256(decision.sourceSet) ===
        decision.sourceSetSha256 &&
      nonEmpty(decision.decisionSeriesKey) &&
      Number.isSafeInteger(decision.version) &&
      decision.version > 0 &&
      (decision.supersedesDecisionId === null ||
        nonEmpty(decision.supersedesDecisionId)) &&
      nonEmpty(decision.decidedByActorId) &&
      isStrictIsoInstant(decision.decidedAt)
    );
  } catch {
    return false;
  }
}

function sameDecision(
  left: CaseActionDecisionRecord,
  right: CaseActionDecisionRecord,
): boolean {
  return validDecision(right) && JSON.stringify(left) === JSON.stringify(right);
}

function validSupersession(
  decision: CaseActionDecisionRecord,
  prior: CaseActionDecisionRecord | null,
): boolean {
  if (decision.version === 1) {
    return decision.state === "PROPOSED" && decision.supersedesDecisionId === null;
  }
  const stateTransitionAllowed = Boolean(
    prior &&
      ((prior.state === "PROPOSED" &&
        ["CONSUMER_SELECTED", "DECLINED", "WAITING", "BLOCKED"].includes(
          decision.state,
        )) ||
        (prior.state === "WAITING" &&
          ["CONSUMER_SELECTED", "DECLINED", "BLOCKED"].includes(
            decision.state,
          ))),
  );
  return Boolean(
    prior &&
      stateTransitionAllowed &&
      decision.supersedesDecisionId === prior.decisionId &&
      decision.version === prior.version + 1 &&
      decision.decisionSeriesKey === prior.decisionSeriesKey &&
      decision.tenantId === prior.tenantId &&
      decision.consumerId === prior.consumerId &&
      decision.reportVersionId === prior.reportVersionId &&
      decision.caseId === prior.caseId &&
      decision.actionCode === prior.actionCode &&
      decision.chronologyRound === prior.chronologyRound &&
      decision.expectedSourceCount === prior.expectedSourceCount &&
      decision.sourceSetSha256 === prior.sourceSetSha256,
  );
}

export async function appendCaseActionDecision(input: {
  readonly principal: P0Principal;
  readonly scope: P0Scope;
  readonly gatePermit: P0Phase2AGatePermit;
  readonly repository: CaseActionDecisionRepository;
  readonly request: {
    readonly decisionId: string;
    readonly operationId: string;
    readonly reportVersionId: string;
    readonly caseId: string;
    readonly actionCode: CaseActionCode;
    readonly state: CaseActionState;
    readonly chronologyRound: number;
    readonly sourceSelectors: readonly {
      readonly sourceType: CaseActionSourceType;
      readonly sourceId: string;
    }[];
    readonly expectedSourceCount: number;
    readonly expectedSourceSetSha256: string;
    readonly decisionSeriesKey: string;
    readonly version: number;
    readonly supersedesDecisionId?: string | null;
  };
}): Promise<AppendCaseActionDecisionResult> {
  const { principal, scope, repository, request } = input;
  if (
    validateP0Principal(principal).length > 0 ||
    !p0PrincipalAuthorizesScope(principal, scope)
  ) {
    return { ok: false, code: "INVALID_PRINCIPAL_OR_SCOPE" };
  }
  if (
    CONSUMER_AUTHORITY_STATES.includes(request.state) &&
    principal.authorizationKind !== "DIRECT_CONSUMER"
  ) {
    return { ok: false, code: "CONSUMER_AUTHORITY_REQUIRED" };
  }
  if (
    !p0Phase2AGatePermitAuthorizes({
      permit: input.gatePermit,
      principal,
      scope,
      stage: "ROUND0_REVIEW",
      mode: input.gatePermit.mode,
      operationId: request.operationId,
    })
  ) {
    return { ok: false, code: "GATE_DENIED" };
  }
  if (
    !nonEmpty(request.decisionId) ||
    !nonEmpty(request.operationId) ||
    !nonEmpty(request.reportVersionId) ||
    !nonEmpty(request.caseId) ||
    !CASE_ACTION_CODES.includes(request.actionCode) ||
    !CASE_ACTION_STATES.includes(request.state) ||
    !Number.isSafeInteger(request.chronologyRound) ||
    request.chronologyRound < 1 ||
    !Array.isArray(request.sourceSelectors) ||
    request.sourceSelectors.length < 1 ||
    request.sourceSelectors.some(
      (source) =>
        !CASE_ACTION_SOURCE_TYPES.includes(source.sourceType) ||
        !nonEmpty(source.sourceId),
    ) ||
    !Number.isSafeInteger(request.expectedSourceCount) ||
    request.expectedSourceCount < 1 ||
    request.expectedSourceCount > 256 ||
    request.expectedSourceCount !== request.sourceSelectors.length ||
    !SHA256.test(request.expectedSourceSetSha256) ||
    !nonEmpty(request.decisionSeriesKey) ||
    !Number.isSafeInteger(request.version) ||
    request.version < 1
  ) {
    return { ok: false, code: "INVALID_REQUEST" };
  }

  try {
    const sourceSet = canonicalSourceSet(
      await repository.readCaseActionSourceSet({
        principal,
        scope,
        purpose: "CASE_ACTION_SOURCE_READ",
        reportVersionId: request.reportVersionId,
        caseId: request.caseId,
        sourceSelectors: Object.freeze(
          request.sourceSelectors.map((source) => Object.freeze({ ...source })),
        ),
      }),
    );
    const sourceSetSha256 = computeCaseActionSourceSetSha256(sourceSet);
    if (
      sourceSet.length !== request.sourceSelectors.length ||
      sourceSet.length !== request.expectedSourceCount ||
      sourceSetSha256 !== request.expectedSourceSetSha256
    ) {
      return { ok: false, code: "SOURCE_SET_MISMATCH" };
    }
    const requestedIdentities = new Set(
      request.sourceSelectors.map(
        (source) => `${source.sourceType}:${source.sourceId}`,
      ),
    );
    if (
      requestedIdentities.size !== request.sourceSelectors.length ||
      sourceSet.some(
        (source) =>
          !requestedIdentities.has(`${source.sourceType}:${source.sourceId}`),
      )
    ) {
      return { ok: false, code: "SOURCE_SET_MISMATCH" };
    }
    const accountReviewSources = sourceSet.filter(
      (source): source is CaseActionSourceRef & {
        readonly sourceType: "CONSUMER_ACCOUNT_REVIEW";
      } => source.sourceType === "CONSUMER_ACCOUNT_REVIEW",
    );
    if (
      accountReviewSources.length > 0 &&
      !ACCOUNT_REVIEW_ACTION_CODES.includes(request.actionCode)
    ) {
      return { ok: false, code: "SOURCE_SET_MISMATCH" };
    }
    for (const source of accountReviewSources) {
      if (
        !(await repository.verifyCurrentCaseActionAccountReviewSource({
          principal,
          scope,
          purpose: "CASE_ACTION_CURRENT_ACCOUNT_REVIEW_VERIFY",
          gatePermit: input.gatePermit,
          source,
        }))
      ) {
        return { ok: false, code: "SOURCE_SET_MISMATCH" };
      }
    }
    const identityCategoryCompletionSources = sourceSet.filter(
      (source): source is CaseActionSourceRef & {
        readonly sourceType: "IDENTITY_CATEGORY_COMPLETION";
      } => source.sourceType === "IDENTITY_CATEGORY_COMPLETION",
    );
    for (const source of identityCategoryCompletionSources) {
      if (
        !(await repository.verifyCurrentCaseActionIdentityCategoryCompletionSource({
          principal,
          scope,
          purpose: "CASE_ACTION_CURRENT_IDENTITY_COMPLETION_VERIFY",
          gatePermit: input.gatePermit,
          source,
        }))
      ) {
        return { ok: false, code: "SOURCE_SET_MISMATCH" };
      }
    }
    const requiredCurrentAssertionType =
      request.state === "CONSUMER_SELECTED" &&
      request.actionCode === "REQUEST_ACCOUNT_CORRECTION"
        ? "CONSUMER_ASSERTION"
        : request.state === "CONSUMER_SELECTED" &&
            request.actionCode === "REQUEST_IDENTITY_CORRECTION"
          ? "IDENTITY_CORRESPONDENCE_ASSERTION"
          : null;
    if (requiredCurrentAssertionType) {
      const candidates = sourceSet.filter(
        (source) => source.sourceType === requiredCurrentAssertionType,
      );
      let currentAssertionFound = false;
      for (const source of candidates) {
        if (
          await repository.verifyCurrentCaseActionAssertionSource({
            principal,
            scope,
            purpose: "CASE_ACTION_CURRENT_ASSERTION_VERIFY",
            gatePermit: input.gatePermit,
            source,
          })
        ) {
          currentAssertionFound = true;
          break;
        }
      }
      if (!currentAssertionFound) {
        return { ok: false, code: "SOURCE_SET_MISMATCH" };
      }
    }
    const prior = request.supersedesDecisionId
      ? await repository.readCaseActionDecision({
          principal,
          scope,
          purpose: "CASE_ACTION_DECISION_READ",
          gatePermit: input.gatePermit,
          decisionId: request.supersedesDecisionId,
        })
      : null;
    const decision: CaseActionDecisionRecord = Object.freeze({
      contractVersion: CASE_ACTION_DECISION_CONTRACT_VERSION,
      decisionId: request.decisionId,
      operationId: request.operationId,
      tenantId: scope.tenantId,
      consumerId: scope.consumerId,
      reportVersionId: request.reportVersionId,
      caseId: request.caseId,
      actionCode: request.actionCode,
      state: request.state,
      chronologyRound: request.chronologyRound,
      chronologyAuthority: "ORDERING_ONLY_NOT_POLICY_AUTHORITY",
      sourceSet,
      expectedSourceCount: request.expectedSourceCount,
      sourceSetSha256,
      decisionSeriesKey: request.decisionSeriesKey,
      version: request.version,
      supersedesDecisionId: request.supersedesDecisionId ?? null,
      decidedByActorId: principal.actorId,
      decidedAt: input.gatePermit.issuedAt,
    });
    if (!validDecision(decision)) return { ok: false, code: "INVALID_REQUEST" };
    if (!validSupersession(decision, prior)) {
      return { ok: false, code: "SUPERSESSION_MISMATCH" };
    }
    const write = await repository.appendCaseActionDecision({
      principal,
      scope,
      purpose: "CASE_ACTION_DECISION_APPEND",
      gatePermit: input.gatePermit,
      decision,
    });
    if (
      write.disposition !== "CREATED" &&
      write.disposition !== "IDEMPOTENT_REPLAY"
    ) {
      return { ok: false, code: "OUTCOME_UNKNOWN" };
    }
    const readback = await repository.readCaseActionDecision({
      principal,
      scope,
      purpose: "CASE_ACTION_DECISION_READBACK",
      gatePermit: input.gatePermit,
      decisionId: decision.decisionId,
    });
    if (!readback || !sameDecision(decision, readback)) {
      return { ok: false, code: "READBACK_MISMATCH" };
    }
    return Object.freeze({
      ok: true,
      disposition: write.disposition,
      decision: Object.freeze({ ...readback, sourceSet: canonicalSourceSet(readback.sourceSet) }),
    });
  } catch {
    return { ok: false, code: "OUTCOME_UNKNOWN" };
  }
}

/** Closed structural guard: Phase 2A decisions cannot smuggle Phase 2B authority. */
export function caseActionDecisionContainsForbiddenAuthority(
  value: unknown,
): boolean {
  if (!value || typeof value !== "object") return true;
  const keys = Object.keys(value as object).map((key) => key.toLowerCase());
  return keys.some(
    (key) =>
      key.includes("policy") ||
      key.includes("legal") ||
      key.includes("eligib") ||
      key.includes("correspondence") ||
      key.includes("recipient"),
  );
}
