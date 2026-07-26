// Operator Identity — ENROLLMENT RUNTIME (Implementation Slice 2).
//
// Implements Identity Constitution v1.0 §2.8 (pre-membership evidence), §5.1 (enrollment
// conditions), §5.2 (joining an existing Organization), §5.4, §5.5 (consent), §11.2
// (evidence envelope), §15.9 (invitation properties). Semantics are FROZEN; this module
// implements them and invents nothing.
//
// THE ONE THING ENROLLMENT DOES: it produces pre-membership EVIDENCE and an eligibility
// record. It never activates an OperatorIdentity, never creates Membership, never assigns
// an Organization, never grants authority, and never issues Platform Authority. Every
// enrollment terminates at ACCEPTED, which is an evidence fact — Membership creation is
// Slice 4 and operator activation is the Slice 1 lifecycle command under §4.3.
//
// AUTHORITY IS ALWAYS NONE. Enrollment evidence carries `authorityClass: "NONE"` as a
// literal, pinned by test, so no downstream consumer can ever read an enrollment record
// as an authorization fact (§2.8, §5.2 "a pending invitation ... grants no Organization
// authority").
//
// TWO ENTRY MODES, ONE TERMINUS (§5.2). §5.2 requires "an Organization-issued invitation
// OR an Organization-approved application", then explicit operator acceptance AND
// authorized organization approval. Both facts must exist before ACCEPTED:
//   INVITATION  — the Organization acted first (INVITED); the operator's ACCEPT supplies
//                 the missing operator consent.
//   APPLICATION — the operator acted first (REQUESTED); the Organization's ACCEPT supplies
//                 the missing organization approval.
// Neither mode lets one party supply both facts (§5.5, §7.8: no self-approval).
//
// PERSISTENCE STOPS AT AN INTERFACE. No enrollment, invitation, or consent table exists,
// and creating one requires a 7th migration directory, which Gate D rejects until §13.3
// governance is owner-approved in Slice 7. So the durable store is a PORT and the only
// adapter is fail-closed unavailable. Decision policy, evidence construction, consent
// episodes, digests and idempotency keys are complete and exhaustively tested; the
// commands deny with `store_unavailable` until Slice 7 lands the reviewed migration.
// This is the ratified plan's Slice 2 exit gate, not a shortfall.
import { createHash } from "node:crypto";
import { canonicalJson, decisionDigest } from "./lifecycle";
import { operatorIdentityEnabled, operatorEnrollmentEnabled } from "./flags";
import { type IdentityPrincipal } from "./principal";
import { loadEnrollmentStore, type EnrollmentRecord } from "./enrollmentStore";

export const ENROLLMENT_POLICY_VERSION = "operator-enrollment@1";

// ── States (§2.8). ACCEPTED / EXPIRED / REVOKED are terminal for the record. ──
// Deliberately NO "ACTIVE": enrollment cannot activate anything (§5.1 item 8, §4.3).
export const ENROLLMENT_STATES = ["INVITED", "REQUESTED", "ACCEPTED", "EXPIRED", "REVOKED"] as const;
export type EnrollmentState = (typeof ENROLLMENT_STATES)[number];

// Entry mode decides which party still owes a fact before ACCEPTED (§5.2).
export const ENROLLMENT_ENTRIES = ["INVITATION", "APPLICATION"] as const;
export type EnrollmentEntry = (typeof ENROLLMENT_ENTRIES)[number];

export const ENTRY_INITIAL_STATE: Record<EnrollmentEntry, EnrollmentState> = {
  INVITATION: "INVITED",
  APPLICATION: "REQUESTED",
};

// Adjacency. An empty list is terminal — enrollment has no resurrection, mirroring the
// operator lifecycle's terminal discipline.
const ENROLLMENT_TRANSITIONS: Record<EnrollmentState, readonly EnrollmentState[]> = {
  INVITED: ["ACCEPTED", "EXPIRED", "REVOKED"],
  REQUESTED: ["ACCEPTED", "EXPIRED", "REVOKED"],
  ACCEPTED: [],
  EXPIRED: [],
  REVOKED: [],
};

export function canTransitionEnrollment(from: string, to: string): boolean {
  if (from === to) return false;
  const allowed = ENROLLMENT_TRANSITIONS[from as EnrollmentState];
  if (!allowed) return false;
  return (allowed as readonly string[]).includes(to);
}

export function isTerminalEnrollmentState(s: string): boolean {
  return ENROLLMENT_TRANSITIONS[s as EnrollmentState]?.length === 0;
}

export const _ENROLLMENT_TRANSITIONS = ENROLLMENT_TRANSITIONS;

// Who is acting. Enrollment has no authority classes of its own — these identify the
// PARTY supplying a required fact, never a permission (§2.8).
export const ENROLLMENT_ACTORS = ["SUBJECT", "ORGANIZATION", "SYSTEM"] as const;
export type EnrollmentActor = (typeof ENROLLMENT_ACTORS)[number];

// Bounded reason classes (§11.2). Key is `basis`, never `reason*` — the Event Fabric PII
// guard denylists keys containing "reason" and is not weakened to suit this module.
export const ENROLLMENT_BASES = [
  "ORGANIZATION_INVITED",
  "SUBJECT_APPLIED",
  "SUBJECT_ACCEPTED",
  "ORGANIZATION_APPROVED",
  "INVITATION_LAPSED",
  "ORGANIZATION_REVOKED",
  "SUBJECT_WITHDREW",
] as const;
export type EnrollmentBasis = (typeof ENROLLMENT_BASES)[number];

// ── Consent (§5.1 item 5, §5.5) ──────────────────────────────────────────────
// Consent is EVIDENCE, never a mutable flag. Each episode is immutable and additive: a
// withdrawal is a NEW episode, never an overwrite of the prior one. Operator consent is
// distinct from consumer-service consent (§5.1 item 5) — the purpose enum enforces it.
export const CONSENT_PURPOSES = ["OPERATOR_ENROLLMENT", "OPERATOR_TERMS", "OPERATOR_PROFILE"] as const;
export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];

export const CONSENT_MECHANISMS = ["EXPLICIT_CHECKBOX", "SIGNED_ACCEPTANCE", "ADMINISTRATIVE_RECORD"] as const;
export type ConsentMechanism = (typeof CONSENT_MECHANISMS)[number];

export interface ConsentEpisode {
  readonly purpose: ConsentPurpose;
  readonly scope: string;
  readonly mechanism: ConsentMechanism;
  readonly policyVersion: string;
  readonly actorId: string;
  readonly effectiveAt: number;
  readonly granted: boolean;
}

export function consentEpisodeDigest(e: ConsentEpisode): string {
  return `sha256:${createHash("sha256").update(canonicalJson({ ...e })).digest("hex")}`;
}

export function isValidConsentEpisode(e: ConsentEpisode): boolean {
  return CONSENT_PURPOSES.includes(e.purpose)
    && CONSENT_MECHANISMS.includes(e.mechanism)
    && typeof e.scope === "string" && e.scope.length > 0 && e.scope.length <= 120
    && typeof e.policyVersion === "string" && e.policyVersion.length > 0
    && typeof e.actorId === "string" && e.actorId.length > 0
    && Number.isInteger(e.effectiveAt) && e.effectiveAt > 0
    && typeof e.granted === "boolean";
}

// ── Denials ──────────────────────────────────────────────────────────────────
export type EnrollmentDenial =
  | "illegal_transition"      // §2.8 — edge not in the table
  | "wrong_actor"             // §5.2 / §5.5 — the acting party may not supply this fact
  | "self_approval"           // §5.5 / §7.8 — one party may not supply both facts
  | "wrong_organization"      // §8.1 gate 5 — record belongs to another Organization
  | "expired"                 // §15.9 — invitation past its expiry
  | "revoked"                 // §15.9 — invitation revoked
  | "terminal"                // record already ACCEPTED / EXPIRED / REVOKED
  | "consent_missing"         // §5.1 item 5 — acceptance without a valid consent episode
  | "basis_incoherent"        // basis does not match the edge / actor
  | "invitation_unverified";  // §15.9 — invitation could not be cryptographically bound

export interface EnrollmentDecisionRequest {
  readonly from: EnrollmentState;
  readonly to: EnrollmentState;
  readonly entry: EnrollmentEntry;
  readonly actor: EnrollmentActor;
  readonly basis: EnrollmentBasis;
  /** Subject account on the record vs the acting principal. */
  readonly actorIsSubject: boolean;
  /** Organization on the record vs the Organization asserted by the caller. */
  readonly organizationMatches: boolean;
  readonly expiresAt: number;
  readonly effectiveAt: number;
  readonly invitationVerified: boolean;
  readonly consent: ConsentEpisode | null;
}

export type EnrollmentDecision =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly code: EnrollmentDenial };

const denyE = (code: EnrollmentDenial): EnrollmentDecision => ({ allowed: false, code });

// Which party may drive each edge, per entry mode (§5.2). The party that CREATED the
// record may never also close it — that is the self-approval bar (§5.5, §7.8).
const EDGE_ACTOR: Record<string, readonly EnrollmentActor[]> = {
  // Invitation: the Organization invited, so the SUBJECT owes acceptance.
  "INVITATION:INVITED->ACCEPTED": ["SUBJECT"],
  "INVITATION:INVITED->REVOKED": ["ORGANIZATION", "SUBJECT"],
  "INVITATION:INVITED->EXPIRED": ["SYSTEM"],
  // Application: the subject applied, so the ORGANIZATION owes approval.
  "APPLICATION:REQUESTED->ACCEPTED": ["ORGANIZATION"],
  "APPLICATION:REQUESTED->REVOKED": ["ORGANIZATION", "SUBJECT"],
  "APPLICATION:REQUESTED->EXPIRED": ["SYSTEM"],
};

const BASIS_EDGE: Record<EnrollmentBasis, readonly string[]> = {
  ORGANIZATION_INVITED: ["INVITATION:->INVITED"],
  SUBJECT_APPLIED: ["APPLICATION:->REQUESTED"],
  SUBJECT_ACCEPTED: ["INVITATION:INVITED->ACCEPTED"],
  ORGANIZATION_APPROVED: ["APPLICATION:REQUESTED->ACCEPTED"],
  INVITATION_LAPSED: ["INVITATION:INVITED->EXPIRED", "APPLICATION:REQUESTED->EXPIRED"],
  ORGANIZATION_REVOKED: ["INVITATION:INVITED->REVOKED", "APPLICATION:REQUESTED->REVOKED"],
  SUBJECT_WITHDREW: ["INVITATION:INVITED->REVOKED", "APPLICATION:REQUESTED->REVOKED"],
};

/** PURE, TOTAL, fail-closed. Same request => same decision, always. */
export function decideEnrollment(req: EnrollmentDecisionRequest): EnrollmentDecision {
  if (isTerminalEnrollmentState(req.from)) return denyE("terminal");
  if (!canTransitionEnrollment(req.from, req.to)) return denyE("illegal_transition");

  // §8.1 gate 5 — a record is only ever operated within its own Organization.
  if (!req.organizationMatches) return denyE("wrong_organization");

  const edge = `${req.entry}:${req.from}->${req.to}`;
  const actors = EDGE_ACTOR[edge];
  if (!actors || !actors.includes(req.actor)) return denyE("wrong_actor");

  if (!(BASIS_EDGE[req.basis] ?? []).includes(edge)) return denyE("basis_incoherent");

  // The acting party must actually BE who it claims (§5.2).
  if (req.actor === "SUBJECT" && !req.actorIsSubject) return denyE("wrong_actor");
  if (req.actor === "ORGANIZATION" && req.actorIsSubject) return denyE("self_approval");

  // §15.9 — an invitation is non-authoritative until accepted, and must still be valid
  // AT REDEMPTION, not merely at issue. Revocation and expiry are re-evaluated here.
  if (req.to === "ACCEPTED") {
    if (req.effectiveAt >= req.expiresAt) return denyE("expired");
    if (!req.invitationVerified) return denyE("invitation_unverified");
    // §5.1 item 5 — acceptance without a valid, granted operator-scoped consent episode
    // is not acceptance.
    if (!req.consent || !isValidConsentEpisode(req.consent)) return denyE("consent_missing");
    if (!req.consent.granted) return denyE("consent_missing");
    if (req.consent.purpose === "OPERATOR_PROFILE") return denyE("consent_missing");
  }

  // Expiry is a fact about time, not a decision: it may only be recorded once the
  // invitation has actually lapsed.
  if (req.to === "EXPIRED" && req.effectiveAt < req.expiresAt) return denyE("basis_incoherent");

  return { allowed: true };
}

// ── Capability gates (fail-closed, mirroring Slice 1) ────────────────────────

// §15.9 requires invitations to be single-purpose, expiring, revocable and identity-bound.
// Binding requires a purpose-dedicated signing key. No ratified verifier exists, and
// reusing an authentication or session secret would be an unreviewed trust binding, so this
// remains false and every acceptance fails closed rather than trusting an unverifiable invite.
export function invitationVerifierAvailable(): boolean {
  return false;
}

/**
 * Capabilities this runtime needs but does not own. Returns the blocking code, or null.
 * Ordered most-fundamental first so a denial names the real blocker.
 */
export function enrollmentExecutionBlock(): "store_unavailable" | "invitation_unverified" | null {
  if (!loadEnrollmentStore().available) return "store_unavailable";
  if (!invitationVerifierAvailable()) return "invitation_unverified";
  return null;
}

// ── Commands ─────────────────────────────────────────────────────────────────

export type EnrollmentErrorCode =
  | "disabled" | "forbidden" | "invalid" | "not_found" | "conflict"
  | "idempotency_conflict" | "store_unavailable" | EnrollmentDenial;

export type EnrollmentResult =
  | { ok: true; enrollmentId: string; state: EnrollmentState; eventId: string; replayed: boolean }
  | { ok: false; code: EnrollmentErrorCode; error: string };

const failE = (code: EnrollmentErrorCode, error: string): EnrollmentResult => ({ ok: false, code, error });

export interface EnrollmentCommandBase {
  readonly enrollmentId: string;
  readonly organizationId: string;
  /** Idempotency key (§11.2). The derived event id is a pure function of it. */
  readonly commandId: string;
  /** SEALED input (§11.2) — never read from the clock inside this module. */
  readonly effectiveAt: number;
  readonly correlationId?: string;
  readonly causationId?: string;
}

export interface RequestEnrollmentCommand extends EnrollmentCommandBase {
  readonly entry: EnrollmentEntry;
  readonly subjectAccountId: string;
  readonly expiresAt: number;
  readonly basis: Extract<EnrollmentBasis, "ORGANIZATION_INVITED" | "SUBJECT_APPLIED">;
}

export interface AcceptEnrollmentCommand extends EnrollmentCommandBase {
  readonly consent: ConsentEpisode;
  readonly invitationRef: string;
}

export interface CloseEnrollmentCommand extends EnrollmentCommandBase {
  readonly basis: Extract<EnrollmentBasis, "INVITATION_LAPSED" | "ORGANIZATION_REVOKED" | "SUBJECT_WITHDREW">;
}

/** Deterministic enrollment event id — a pure function of subject account + commandId. */
export function enrollmentEventId(subjectAccountId: string, commandId: string): string {
  return `evt_${createHash("sha256")
    .update(`${subjectAccountId}|ENROLLMENT|identity|operator-enrollment:${commandId}`)
    .digest("hex").slice(0, 32)}`;
}

/** The sealed decision record every enrollment command digests (§11.2, §10.4). */
export function sealEnrollment(input: {
  enrollmentId: string; organizationId: string; subjectAccountId: string;
  entry: EnrollmentEntry; from: EnrollmentState | null; to: EnrollmentState;
  actor: EnrollmentActor; basis: EnrollmentBasis; actorId: string;
  commandId: string; effectiveAt: number; expiresAt: number; consentDigest: string | null;
}): Record<string, unknown> {
  return {
    policyVersion: ENROLLMENT_POLICY_VERSION,
    authorityClass: "NONE", // §2.8 — enrollment NEVER carries authority.
    ...input,
  };
}

export function enrollmentDecisionDigest(sealed: Record<string, unknown>): string {
  return decisionDigest(sealed);
}

// Shared fail-closed preamble for every command (§1.11, §14.9, §22 #31).
function preamble(principal: IdentityPrincipal | null, cmd: EnrollmentCommandBase): EnrollmentResult | null {
  if (!operatorIdentityEnabled()) return failE("disabled", "operator identity disabled");
  if (!operatorEnrollmentEnabled()) return failE("disabled", "operator enrollment disabled");
  if (!principal || principal.disabled) return failE("forbidden", "no principal");
  const nonEmpty = (s: unknown) => typeof s === "string" && s.trim().length > 0 && s.length <= 200;
  if (!nonEmpty(cmd.enrollmentId)) return failE("invalid", "invalid enrollmentId");
  if (!nonEmpty(cmd.organizationId)) return failE("invalid", "invalid organizationId");
  if (!nonEmpty(cmd.commandId)) return failE("invalid", "invalid commandId");
  if (!Number.isInteger(cmd.effectiveAt) || cmd.effectiveAt <= 0) return failE("invalid", "effectiveAt must be a sealed integer timestamp");
  const block = enrollmentExecutionBlock();
  if (block) return failE(block, `enrollment capability unavailable: ${block}`);
  return null;
}

export async function requestEnrollment(
  principal: IdentityPrincipal | null, cmd: RequestEnrollmentCommand,
): Promise<EnrollmentResult> {
  const stop = preamble(principal, cmd);
  if (stop) return stop;
  return failE("store_unavailable", "enrollment persistence is not available until Slice 7");
}

export async function acceptEnrollment(
  principal: IdentityPrincipal | null, cmd: AcceptEnrollmentCommand,
): Promise<EnrollmentResult> {
  const stop = preamble(principal, cmd);
  if (stop) return stop;
  return failE("store_unavailable", "enrollment persistence is not available until Slice 7");
}

export async function expireEnrollment(
  principal: IdentityPrincipal | null, cmd: CloseEnrollmentCommand,
): Promise<EnrollmentResult> {
  const stop = preamble(principal, cmd);
  if (stop) return stop;
  return failE("store_unavailable", "enrollment persistence is not available until Slice 7");
}

export async function revokeEnrollment(
  principal: IdentityPrincipal | null, cmd: CloseEnrollmentCommand,
): Promise<EnrollmentResult> {
  const stop = preamble(principal, cmd);
  if (stop) return stop;
  return failE("store_unavailable", "enrollment persistence is not available until Slice 7");
}

/**
 * Replay comparison (§10.4). A repeat of the same commandId with identical
 * material inputs is a replay; a reused commandId with DIFFERENT inputs is an error and
 * must never be reported as success.
 */
export function replayedEnrollment(
  existingPayload: unknown, intendedPayload: Record<string, unknown>,
): { replay: boolean } {
  return { replay: canonicalJson(existingPayload) === canonicalJson(intendedPayload) };
}

export type { EnrollmentRecord };
