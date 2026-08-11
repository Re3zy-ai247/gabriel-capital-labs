import { createHash } from "node:crypto";
import type { P0Principal, P0Scope } from "./principal";
import {
  p0PrincipalAuthorizesScope,
  validateP0Principal,
} from "./principal";
import { isStrictIsoInstant } from "./progressIntelligence";

export const P0_SENSITIVE_ACCESS_CONTRACT_VERSION =
  "p0-sensitive-access-v1" as const;

export const P0_SENSITIVE_ACCESS_KINDS = [
  "DECRYPT",
  "PREVIEW",
  "DOWNLOAD",
  "EXPORT",
  "AGENCY",
  "ADMIN",
  "WORKER",
] as const;
export type P0SensitiveAccessKind =
  (typeof P0_SENSITIVE_ACCESS_KINDS)[number];

export const P0_SENSITIVE_ACCESS_PURPOSE_CODES = [
  "REPORT_INGESTION",
  "ROUND0_REVIEW",
  "CONSUMER_CONFIRMATION",
  "INTEGRITY_VERIFICATION",
  "CONSUMER_EXPORT",
  "AGENCY_MANAGED_CLIENT_SERVICE",
  "ADMIN_SUPPORT",
  "WORKER_EXTRACTION",
] as const;
export type P0SensitiveAccessPurposeCode =
  (typeof P0_SENSITIVE_ACCESS_PURPOSE_CODES)[number];

export const P0_SENSITIVE_RESOURCE_TYPES = [
  "REPORT_INGESTION",
  "REPORT_SOURCE",
  "NORMALIZED_REPORT_TEXT",
  "REPORT_VERSION",
  "IDENTITY_FACT_VALUE",
  "CONSUMER_ASSERTION_STATEMENT",
  "ARTIFACT",
] as const;
export type P0SensitiveResourceType =
  (typeof P0_SENSITIVE_RESOURCE_TYPES)[number];

export const P0_SENSITIVE_ACCESS_REASON_CODES = [
  "AUTHORIZED",
  "SCOPE_DENIED",
  "PURPOSE_DENIED",
  "RESOURCE_NOT_FOUND",
  "GATE_DISABLED",
  "INTEGRITY_FAILURE",
  "OTHER_SAFE_DENIAL",
] as const;
export type P0SensitiveAccessReasonCode =
  (typeof P0_SENSITIVE_ACCESS_REASON_CODES)[number];

export interface P0SensitiveResourceRefCandidate {
  readonly resourceType: P0SensitiveResourceType;
  readonly resourceId: string;
  readonly resourceVersion: number;
}

export interface P0SensitiveResourceRefVerifier {
  readonly verifierId: string;
  verifyResourceRef(input: {
    readonly principal: P0Principal;
    readonly scope: P0Scope;
    readonly candidate: P0SensitiveResourceRefCandidate;
    readonly semanticSha256: string;
  }): Promise<boolean>;
}

const VERIFIED_SENSITIVE_RESOURCE_REF = Symbol(
  "verified-p0-sensitive-resource-ref",
);
const verifiedResourceRefs = new WeakSet<object>();
const verifiedResourceRefDigests = new WeakMap<object, string>();

export interface VerifiedP0SensitiveResourceRef
  extends P0SensitiveResourceRefCandidate {
  readonly tenantId: string;
  readonly consumerId: string;
  readonly verifierId: string;
  readonly semanticSha256: string;
  readonly [VERIFIED_SENSITIVE_RESOURCE_REF]: true;
}

export interface P0SensitiveAuditRefCandidate {
  readonly operationRef: string;
  readonly eventRef: string;
}

export interface P0SensitiveAuditRefVerifier {
  readonly verifierId: string;
  verifyAuditRefs(input: {
    readonly principal: P0Principal;
    readonly scope: P0Scope;
    readonly candidate: P0SensitiveAuditRefCandidate;
    readonly resource: VerifiedP0SensitiveResourceRef;
    readonly accessKind: P0SensitiveAccessKind;
    readonly purposeCode: P0SensitiveAccessPurposeCode;
    readonly occurredAt: string;
    readonly expiresAt: string;
    readonly semanticSha256: string;
  }): Promise<boolean>;
}

const VERIFIED_SENSITIVE_AUDIT_REFS = Symbol(
  "verified-p0-sensitive-audit-refs",
);
const verifiedAuditRefs = new WeakSet<object>();
const verifiedAuditRefDigests = new WeakMap<object, string>();

export interface VerifiedP0SensitiveAuditRefs {
  readonly eventKey: string;
  readonly correlationId: string;
  readonly actorId: string;
  readonly tenantId: string;
  readonly consumerId: string;
  readonly accessKind: P0SensitiveAccessKind;
  readonly purposeCode: P0SensitiveAccessPurposeCode;
  readonly resourceType: P0SensitiveResourceType;
  readonly resourceId: string;
  readonly resourceVersion: number;
  readonly occurredAt: string;
  readonly expiresAt: string;
  readonly verifierId: string;
  readonly semanticSha256: string;
  readonly [VERIFIED_SENSITIVE_AUDIT_REFS]: true;
}

export interface P0SensitiveAccessAuthorizationDecision {
  readonly allowed: boolean;
  readonly reasonCode: P0SensitiveAccessReasonCode;
}

export interface P0SensitiveAccessAuthorizer {
  authorizeSensitiveAccess(input: {
    readonly principal: P0Principal;
    readonly scope: P0Scope;
    readonly accessKind: P0SensitiveAccessKind;
    readonly purposeCode: P0SensitiveAccessPurposeCode;
    readonly resource: VerifiedP0SensitiveResourceRef;
  }): Promise<P0SensitiveAccessAuthorizationDecision>;
}

export interface P0SensitiveAccessEventDraft {
  readonly eventKey: string;
  readonly correlationId: string;
  readonly actorId: string;
  readonly tenantId: string;
  readonly consumerId: string;
  readonly authorizationKind: P0Principal["authorizationKind"];
  readonly authorizationVersion: string;
  readonly accessKind: P0SensitiveAccessKind;
  readonly purposeCode: P0SensitiveAccessPurposeCode;
  readonly decision: "ALLOW" | "DENY";
  readonly decisionCode: P0SensitiveAccessReasonCode;
  readonly resourceType: P0SensitiveResourceType;
  readonly resourceId: string;
  readonly resourceVersion: number;
  readonly occurredAt: string;
}

export interface P0SensitiveAccessRepository {
  appendSensitiveAccessEvent(input: {
    readonly principal: P0Principal;
    readonly scope: P0Scope;
    readonly purpose: "SENSITIVE_ACCESS_AUDIT_APPEND";
    readonly event: P0SensitiveAccessEventDraft;
  }): Promise<{ readonly disposition: "CREATED" | "IDEMPOTENT_REPLAY" }>;
  readSensitiveAccessEvent(input: {
    readonly principal: P0Principal;
    readonly scope: P0Scope;
    readonly purpose: "SENSITIVE_ACCESS_AUDIT_READBACK";
    readonly eventKey: string;
  }): Promise<P0SensitiveAccessEventDraft | null>;
}

const VERIFIED_ACCESS_GRANT = Symbol("verified-p0-sensitive-access-grant");
const verifiedAccessGrants = new WeakSet<object>();
const verifiedAccessGrantDigests = new WeakMap<object, string>();

export interface VerifiedP0SensitiveAccessGrant {
  readonly contractVersion: typeof P0_SENSITIVE_ACCESS_CONTRACT_VERSION;
  readonly auditEventKey: string;
  readonly correlationId: string;
  readonly actorId: string;
  readonly tenantId: string;
  readonly consumerId: string;
  readonly authorizationKind: P0Principal["authorizationKind"];
  readonly authorizationVersion: string;
  readonly accessKind: P0SensitiveAccessKind;
  readonly purposeCode: P0SensitiveAccessPurposeCode;
  readonly resource: P0SensitiveResourceRefCandidate;
  readonly auditSemanticSha256: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly [VERIFIED_ACCESS_GRANT]: true;
}

export type P0SensitiveAccessResult =
  | {
      readonly allowed: true;
      readonly code: "ACCESS_GRANTED_AND_AUDITED";
      readonly grant: VerifiedP0SensitiveAccessGrant;
    }
  | {
      readonly allowed: false;
      readonly code:
        | "INVALID_PRINCIPAL_OR_SCOPE"
        | "INVALID_ACCESS_REQUEST"
        | "ACCESS_DENIED_AND_AUDITED"
        | "AUDIT_PERSISTENCE_FAILED";
      readonly grant: null;
    };

const EVENT_KEYS = [
  "eventKey",
  "correlationId",
  "actorId",
  "tenantId",
  "consumerId",
  "authorizationKind",
  "authorizationVersion",
  "accessKind",
  "purposeCode",
  "decision",
  "decisionCode",
  "resourceType",
  "resourceId",
  "resourceVersion",
  "occurredAt",
] as const;

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function opaqueRef(value: unknown): value is string {
  return (
    nonEmpty(value) &&
    value.length <= 160 &&
    !/[\s@]/.test(value) &&
    !/^https?:/i.test(value) &&
    !/\d{9,}/.test(value)
  );
}

function validResource(
  resource: unknown,
): resource is P0SensitiveResourceRefCandidate {
  if (!resource || typeof resource !== "object") return false;
  const value = resource as P0SensitiveResourceRefCandidate;
  return (
    Object.keys(value).length === 3 &&
    P0_SENSITIVE_RESOURCE_TYPES.includes(value.resourceType) &&
    opaqueRef(value.resourceId) &&
    Number.isSafeInteger(value.resourceVersion) &&
    value.resourceVersion > 0
  );
}

function resourceRefSemanticSha256(input: {
  readonly tenantId: string;
  readonly consumerId: string;
  readonly resource: P0SensitiveResourceRefCandidate;
}): string {
  return createHash("sha256")
    .update(
      JSON.stringify([
        input.tenantId,
        input.consumerId,
        input.resource.resourceType,
        input.resource.resourceId,
        input.resource.resourceVersion,
      ]),
      "utf8",
    )
    .digest("hex");
}

export async function verifyP0SensitiveResourceRef(input: {
  readonly principal: P0Principal;
  readonly scope: P0Scope;
  readonly candidate: P0SensitiveResourceRefCandidate;
  readonly verifier: P0SensitiveResourceRefVerifier;
}): Promise<VerifiedP0SensitiveResourceRef | null> {
  if (
    validateP0Principal(input.principal).length > 0 ||
    !p0PrincipalAuthorizesScope(input.principal, input.scope) ||
    !validResource(input.candidate) ||
    !nonEmpty(input.verifier?.verifierId)
  ) {
    return null;
  }
  const candidate = Object.freeze({ ...input.candidate });
  const semanticSha256 = resourceRefSemanticSha256({
    tenantId: input.scope.tenantId,
    consumerId: input.scope.consumerId,
    resource: candidate,
  });
  let approved = false;
  try {
    approved = await input.verifier.verifyResourceRef({
      principal: input.principal,
      scope: input.scope,
      candidate,
      semanticSha256,
    });
  } catch {
    return null;
  }
  if (!approved) return null;
  const verified = {
    ...candidate,
    tenantId: input.scope.tenantId,
    consumerId: input.scope.consumerId,
    verifierId: input.verifier.verifierId,
    semanticSha256,
  } as VerifiedP0SensitiveResourceRef;
  Object.defineProperty(verified, VERIFIED_SENSITIVE_RESOURCE_REF, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  verifiedResourceRefs.add(verified);
  verifiedResourceRefDigests.set(verified, semanticSha256);
  return Object.freeze(verified);
}

function validVerifiedResourceRef(
  resource: VerifiedP0SensitiveResourceRef | null | undefined,
  principal: P0Principal,
  scope: P0Scope,
): resource is VerifiedP0SensitiveResourceRef {
  if (
    !resource ||
    resource[VERIFIED_SENSITIVE_RESOURCE_REF] !== true ||
    !verifiedResourceRefs.has(resource) ||
    !validResource({
      resourceType: resource.resourceType,
      resourceId: resource.resourceId,
      resourceVersion: resource.resourceVersion,
    }) ||
    resource.tenantId !== scope.tenantId ||
    resource.consumerId !== scope.consumerId ||
    !nonEmpty(resource.verifierId)
  ) {
    return false;
  }
  const digest = resourceRefSemanticSha256({
    tenantId: scope.tenantId,
    consumerId: scope.consumerId,
    resource,
  });
  return (
    p0PrincipalAuthorizesScope(principal, scope) &&
    resource.semanticSha256 === digest &&
    verifiedResourceRefDigests.get(resource) === digest
  );
}

function auditRefSemanticSha256(input: {
  readonly principal: P0Principal;
  readonly scope: P0Scope;
  readonly candidate: P0SensitiveAuditRefCandidate;
  readonly resource: VerifiedP0SensitiveResourceRef;
  readonly accessKind: P0SensitiveAccessKind;
  readonly purposeCode: P0SensitiveAccessPurposeCode;
  readonly occurredAt: string;
  readonly expiresAt: string;
}): string {
  return createHash("sha256")
    .update(
      JSON.stringify([
        input.principal.actorId,
        input.scope.tenantId,
        input.scope.consumerId,
        input.candidate.operationRef,
        input.candidate.eventRef,
        input.accessKind,
        input.purposeCode,
        input.resource.resourceType,
        input.resource.resourceId,
        input.resource.resourceVersion,
        input.occurredAt,
        input.expiresAt,
      ]),
      "utf8",
    )
    .digest("hex");
}

function derivedAuditRef(kind: "event" | "correlation", digest: string): string {
  return `p0${kind === "event" ? "evt" : "corr"}_${createHash("sha256")
    .update(`${kind}:${digest}`, "utf8")
    .digest("hex")}`;
}

export async function verifyAndDeriveP0SensitiveAuditRefs(input: {
  readonly principal: P0Principal;
  readonly scope: P0Scope;
  readonly candidate: P0SensitiveAuditRefCandidate;
  readonly resource: VerifiedP0SensitiveResourceRef;
  readonly accessKind: P0SensitiveAccessKind;
  readonly purposeCode: P0SensitiveAccessPurposeCode;
  readonly verifier: P0SensitiveAuditRefVerifier;
}): Promise<VerifiedP0SensitiveAuditRefs | null> {
  if (
    validateP0Principal(input.principal).length > 0 ||
    !p0PrincipalAuthorizesScope(input.principal, input.scope) ||
    !validVerifiedResourceRef(input.resource, input.principal, input.scope) ||
    !input.candidate ||
    Object.keys(input.candidate).length !== 2 ||
    !opaqueRef(input.candidate.operationRef) ||
    !opaqueRef(input.candidate.eventRef) ||
    !P0_SENSITIVE_ACCESS_KINDS.includes(input.accessKind) ||
    !P0_SENSITIVE_ACCESS_PURPOSE_CODES.includes(input.purposeCode) ||
    !nonEmpty(input.verifier?.verifierId)
  ) {
    return null;
  }
  const candidate = Object.freeze({ ...input.candidate });
  const nowMs = Date.now();
  const occurredAt = new Date(nowMs).toISOString();
  const expiresAt = new Date(nowMs + 60_000).toISOString();
  const semanticSha256 = auditRefSemanticSha256({
    ...input,
    candidate,
    occurredAt,
    expiresAt,
  });
  let approved = false;
  try {
    approved = await input.verifier.verifyAuditRefs({
      principal: input.principal,
      scope: input.scope,
      candidate,
      resource: input.resource,
      accessKind: input.accessKind,
      purposeCode: input.purposeCode,
      occurredAt,
      expiresAt,
      semanticSha256,
    });
  } catch {
    return null;
  }
  if (!approved) return null;
  const verified = {
    eventKey: derivedAuditRef("event", semanticSha256),
    correlationId: derivedAuditRef("correlation", semanticSha256),
    actorId: input.principal.actorId,
    tenantId: input.scope.tenantId,
    consumerId: input.scope.consumerId,
    accessKind: input.accessKind,
    purposeCode: input.purposeCode,
    resourceType: input.resource.resourceType,
    resourceId: input.resource.resourceId,
    resourceVersion: input.resource.resourceVersion,
    occurredAt,
    expiresAt,
    verifierId: input.verifier.verifierId,
    semanticSha256,
  } as VerifiedP0SensitiveAuditRefs;
  Object.defineProperty(verified, VERIFIED_SENSITIVE_AUDIT_REFS, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  verifiedAuditRefs.add(verified);
  verifiedAuditRefDigests.set(verified, semanticSha256);
  return Object.freeze(verified);
}

function validVerifiedAuditRefs(input: {
  readonly refs: VerifiedP0SensitiveAuditRefs | null | undefined;
  readonly principal: P0Principal;
  readonly scope: P0Scope;
  readonly accessKind: P0SensitiveAccessKind;
  readonly purposeCode: P0SensitiveAccessPurposeCode;
  readonly resource: VerifiedP0SensitiveResourceRef;
}): input is typeof input & { readonly refs: VerifiedP0SensitiveAuditRefs } {
  const { refs } = input;
  return Boolean(
    refs &&
      refs[VERIFIED_SENSITIVE_AUDIT_REFS] === true &&
      verifiedAuditRefs.has(refs) &&
      verifiedAuditRefDigests.get(refs) === refs.semanticSha256 &&
      /^p0evt_[0-9a-f]{64}$/.test(refs.eventKey) &&
      /^p0corr_[0-9a-f]{64}$/.test(refs.correlationId) &&
      refs.actorId === input.principal.actorId &&
      refs.tenantId === input.scope.tenantId &&
      refs.consumerId === input.scope.consumerId &&
      refs.accessKind === input.accessKind &&
      refs.purposeCode === input.purposeCode &&
      refs.resourceType === input.resource.resourceType &&
      refs.resourceId === input.resource.resourceId &&
      refs.resourceVersion === input.resource.resourceVersion &&
      isStrictIsoInstant(refs.occurredAt) &&
      isStrictIsoInstant(refs.expiresAt) &&
      Date.parse(refs.occurredAt) <= Date.now() &&
      Date.parse(refs.expiresAt) > Date.now() &&
      Date.parse(refs.expiresAt) - Date.parse(refs.occurredAt) === 60_000,
  );
}

function validEvent(event: unknown): event is P0SensitiveAccessEventDraft {
  if (!event || typeof event !== "object") return false;
  const value = event as unknown as Record<string, unknown>;
  if (
    Object.keys(value).length !== EVENT_KEYS.length ||
    !EVENT_KEYS.every((key) => Object.hasOwn(value, key))
  ) {
    return false;
  }
  return (
    typeof value.eventKey === "string" &&
    /^p0evt_[0-9a-f]{64}$/.test(value.eventKey) &&
    typeof value.correlationId === "string" &&
    /^p0corr_[0-9a-f]{64}$/.test(value.correlationId) &&
    opaqueRef(value.actorId) &&
    opaqueRef(value.tenantId) &&
    opaqueRef(value.consumerId) &&
    nonEmpty(value.authorizationKind) &&
    opaqueRef(value.authorizationVersion) &&
    P0_SENSITIVE_ACCESS_KINDS.includes(
      value.accessKind as P0SensitiveAccessKind,
    ) &&
    P0_SENSITIVE_ACCESS_PURPOSE_CODES.includes(
      value.purposeCode as P0SensitiveAccessPurposeCode,
    ) &&
    (value.decision === "ALLOW" || value.decision === "DENY") &&
    P0_SENSITIVE_ACCESS_REASON_CODES.includes(
      value.decisionCode as P0SensitiveAccessReasonCode,
    ) &&
    P0_SENSITIVE_RESOURCE_TYPES.includes(
      value.resourceType as P0SensitiveResourceType,
    ) &&
    opaqueRef(value.resourceId) &&
    Number.isSafeInteger(value.resourceVersion) &&
    (value.resourceVersion as number) > 0 &&
    isStrictIsoInstant(value.occurredAt)
  );
}

function eventSemanticSha256(event: P0SensitiveAccessEventDraft): string {
  return createHash("sha256")
    .update(EVENT_KEYS.map((key) => JSON.stringify(event[key])).join("|"), "utf8")
    .digest("hex");
}

function sameEvent(
  expected: P0SensitiveAccessEventDraft,
  actual: P0SensitiveAccessEventDraft,
): boolean {
  return (
    validEvent(actual) &&
    eventSemanticSha256(expected) === eventSemanticSha256(actual)
  );
}

function denied(code: Exclude<P0SensitiveAccessResult, { allowed: true }>["code"]): P0SensitiveAccessResult {
  return Object.freeze({ allowed: false, code, grant: null });
}

export async function authorizeAndAuditP0SensitiveAccess(input: {
  readonly principal: P0Principal;
  readonly scope: P0Scope;
  readonly accessKind: P0SensitiveAccessKind;
  readonly purposeCode: P0SensitiveAccessPurposeCode;
  readonly resource: VerifiedP0SensitiveResourceRef;
  readonly auditRefs: VerifiedP0SensitiveAuditRefs;
  readonly grantTtlSeconds?: number;
  readonly authorizer: P0SensitiveAccessAuthorizer;
  readonly repository: P0SensitiveAccessRepository;
}): Promise<P0SensitiveAccessResult> {
  if (
    validateP0Principal(input.principal).length > 0 ||
    !p0PrincipalAuthorizesScope(input.principal, input.scope)
  ) {
    return denied("INVALID_PRINCIPAL_OR_SCOPE");
  }
  const ttl = input.grantTtlSeconds ?? 30;
  if (
    !P0_SENSITIVE_ACCESS_KINDS.includes(input.accessKind) ||
    !P0_SENSITIVE_ACCESS_PURPOSE_CODES.includes(input.purposeCode) ||
    !validVerifiedResourceRef(input.resource, input.principal, input.scope) ||
    !validVerifiedAuditRefs({
      refs: input.auditRefs,
      principal: input.principal,
      scope: input.scope,
      accessKind: input.accessKind,
      purposeCode: input.purposeCode,
      resource: input.resource,
    }) ||
    !Number.isSafeInteger(ttl) ||
    ttl < 1 ||
    ttl > 60
  ) {
    return denied("INVALID_ACCESS_REQUEST");
  }

  let decision: P0SensitiveAccessAuthorizationDecision;
  try {
    decision = await input.authorizer.authorizeSensitiveAccess({
      principal: input.principal,
      scope: input.scope,
      accessKind: input.accessKind,
      purposeCode: input.purposeCode,
      resource: input.resource,
    });
  } catch {
    decision = {
      allowed: false,
      reasonCode: "OTHER_SAFE_DENIAL",
    };
  }
  if (
    !decision ||
    typeof decision.allowed !== "boolean" ||
    !P0_SENSITIVE_ACCESS_REASON_CODES.includes(decision.reasonCode) ||
    (decision.allowed && decision.reasonCode !== "AUTHORIZED") ||
    (!decision.allowed && decision.reasonCode === "AUTHORIZED")
  ) {
    decision = {
      allowed: false,
      reasonCode: "OTHER_SAFE_DENIAL",
    };
  }

  const event: P0SensitiveAccessEventDraft = Object.freeze({
    eventKey: input.auditRefs.eventKey,
    correlationId: input.auditRefs.correlationId,
    actorId: input.principal.actorId,
    tenantId: input.scope.tenantId,
    consumerId: input.scope.consumerId,
    authorizationKind: input.principal.authorizationKind,
    authorizationVersion: input.principal.authorizationVersion,
    accessKind: input.accessKind,
    purposeCode: input.purposeCode,
    decision: decision.allowed ? "ALLOW" : "DENY",
    decisionCode: decision.reasonCode,
    resourceType: input.resource.resourceType,
    resourceId: input.resource.resourceId,
    resourceVersion: input.resource.resourceVersion,
    occurredAt: input.auditRefs.occurredAt,
  });
  if (!validEvent(event)) return denied("INVALID_ACCESS_REQUEST");

  try {
    const write = await input.repository.appendSensitiveAccessEvent({
      principal: input.principal,
      scope: input.scope,
      purpose: "SENSITIVE_ACCESS_AUDIT_APPEND",
      event,
    });
    if (
      write.disposition !== "CREATED" &&
      write.disposition !== "IDEMPOTENT_REPLAY"
    ) {
      return denied("AUDIT_PERSISTENCE_FAILED");
    }
    const readback = await input.repository.readSensitiveAccessEvent({
      principal: input.principal,
      scope: input.scope,
      purpose: "SENSITIVE_ACCESS_AUDIT_READBACK",
      eventKey: event.eventKey,
    });
    if (!readback || !sameEvent(event, readback)) {
      return denied("AUDIT_PERSISTENCE_FAILED");
    }
  } catch {
    return denied("AUDIT_PERSISTENCE_FAILED");
  }

  if (!decision.allowed) return denied("ACCESS_DENIED_AND_AUDITED");

  const digest = eventSemanticSha256(event);
  const grant = {
    contractVersion: P0_SENSITIVE_ACCESS_CONTRACT_VERSION,
    auditEventKey: event.eventKey,
    correlationId: event.correlationId,
    actorId: event.actorId,
    tenantId: event.tenantId,
    consumerId: event.consumerId,
    authorizationKind: event.authorizationKind,
    authorizationVersion: event.authorizationVersion,
    accessKind: event.accessKind,
    purposeCode: event.purposeCode,
    resource: Object.freeze({
      resourceType: input.resource.resourceType,
      resourceId: input.resource.resourceId,
      resourceVersion: input.resource.resourceVersion,
    }),
    auditSemanticSha256: digest,
    issuedAt: event.occurredAt,
    expiresAt: new Date(
      Math.min(
        Date.parse(input.auditRefs.occurredAt) + ttl * 1000,
        Date.parse(input.auditRefs.expiresAt),
      ),
    ).toISOString(),
  } as VerifiedP0SensitiveAccessGrant;
  Object.defineProperty(grant, VERIFIED_ACCESS_GRANT, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  verifiedAccessGrants.add(grant);
  verifiedAccessGrantDigests.set(grant, digest);
  return Object.freeze({
    allowed: true,
    code: "ACCESS_GRANTED_AND_AUDITED",
    grant: Object.freeze(grant),
  });
}

export function p0SensitiveAccessGrantAllows(input: {
  readonly grant: VerifiedP0SensitiveAccessGrant;
  readonly principal: P0Principal;
  readonly scope: P0Scope;
  readonly accessKind: P0SensitiveAccessKind;
  readonly purposeCode: P0SensitiveAccessPurposeCode;
  readonly resource: VerifiedP0SensitiveResourceRef;
}): boolean {
  const { grant } = input;
  const nowMs = Date.now();
  return (
    grant?.[VERIFIED_ACCESS_GRANT] === true &&
    verifiedAccessGrants.has(grant) &&
    verifiedAccessGrantDigests.get(grant) === grant.auditSemanticSha256 &&
    validateP0Principal(input.principal).length === 0 &&
    p0PrincipalAuthorizesScope(input.principal, input.scope) &&
    grant.actorId === input.principal.actorId &&
    grant.tenantId === input.scope.tenantId &&
    grant.consumerId === input.scope.consumerId &&
    grant.authorizationKind === input.principal.authorizationKind &&
    grant.authorizationVersion === input.principal.authorizationVersion &&
    grant.accessKind === input.accessKind &&
    grant.purposeCode === input.purposeCode &&
    validVerifiedResourceRef(input.resource, input.principal, input.scope) &&
    grant.resource.resourceType === input.resource.resourceType &&
    grant.resource.resourceId === input.resource.resourceId &&
    grant.resource.resourceVersion === input.resource.resourceVersion &&
    isStrictIsoInstant(grant.issuedAt) &&
    isStrictIsoInstant(grant.expiresAt) &&
    nowMs >= Date.parse(grant.issuedAt) &&
    nowMs < Date.parse(grant.expiresAt)
  );
}
