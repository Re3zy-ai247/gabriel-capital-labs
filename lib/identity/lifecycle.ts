// Operator Identity — OPERATOR LIFECYCLE RUNTIME (Implementation Slice 1).
//
// Implements the ratified Identity Constitution v1.0 §4 (Operator Lifecycle).
// It does not claim authority from an untracked amendment or semantic-baseline artifact.
//
// SHAPE. Three pure layers plus one command:
//   1. STATE MACHINE  — lib/identity/state.ts (unchanged, already ratified-correct).
//   2. VALIDATOR      — `decideTransition`, pure and total: (request) -> decision.
//   3. EXECUTION GATES — fail-closed seams for Authentication, Platform Authority, and
//                         Organization control that are not implemented in this slice.
//   4. COMMAND        — `transitionOperator`, the single door that performs the effect.
//
// EXECUTION STATUS. The pure policy models the ratified state table. The executable command
// is deliberately stricter while the prerequisite owners are absent: Platform Authority has
// no verifier, Authentication has no step-up verifier, and Organizations has no atomic
// owner-control resolver. Those facts deny execution before any state/evidence write. This is
// a temporary fail-closed implementation choice, not a constitutional amendment or activation.
//
// DETERMINISM. No `Date.now()`, no randomness, no ambient state. `effectiveAt` is a
// SEALED INPUT supplied by the caller (§1.16, §11.2). Identical sealed inputs plus an
// identical policy version produce an identical decision, an identical evidence payload,
// and an identical event id — which is what makes replay verifiable (§10.4).
//
// NOT IN THIS SLICE: enrollment, Membership, Organization commands, Platform Authority
// issuance, the evidence runtime, erasure, retention, activation. Organization state is
// READ here only to enforce §4.7's owner protection — a guard on this command, not
// Organization runtime.
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { appendEvent } from "@/lib/eventBus/store";
import { deriveEventId } from "@/lib/eventBus/envelope";
import { operatorIdentityEnabled } from "./flags";
import { type IdentityPrincipal } from "./principal";
import { canTransitionOperator, OPERATOR_STATES, type OperatorState } from "./state";
import * as repo from "./repository";
import { buildOperatorStateChangedEvent, draftIdentityEvent, type EvidenceInput } from "./events";

// The policy version pinned into every decision and every evidence record (§1.16, §11.2).
// Bump ONLY when the decision function's behaviour changes; a replay of an old command
// must be evaluated against the version it was decided under.
export const OPERATOR_LIFECYCLE_POLICY_VERSION = "operator-lifecycle@1";

// Bounded authority classes (§9.1). The pure policy recognizes platform classes, but the
// command hard-denies them until Platform Authority owns a verified grant resolver.
export const TRANSITION_AUTHORITIES = ["SELF", "PLATFORM_IDENTITY_REVIEW", "PLATFORM_SECURITY"] as const;
export type TransitionAuthority = (typeof TRANSITION_AUTHORITIES)[number];

// Bounded reason CLASSES (§11.2 "reason code"), never free text.
// NOTE: the key carrying this in the event payload is `basis`, not `reason*`. The Event
// Fabric PII guard (lib/eventBus/validate.ts PII_DENYLIST) denylists any payload key
// containing "reason". The guard is correct and is NOT weakened to fit this module; a
// bounded enum under a compliant key satisfies §11.2 exactly.
export const TRANSITION_BASES = [
  "SUBJECT_SELF_SERVICE_EXIT",     // §4.5 self-service disablement -> SUSPENDED
  "SUBJECT_WITHDRAWAL",            // §4.6 subject withdraws a PENDING enrollment
  "SUBJECT_CONFIRMED_DEACTIVATION", // §4.6 separately confirmed irreversible intent
  "PLATFORM_REVIEW_APPROVED",      // §4.3 Platform Identity Review activates PENDING
  "PLATFORM_REVIEW_REJECTED",      // §4.3 review rejects enrollment
  "PLATFORM_SECURITY_HOLD",        // §4.5 security/compliance suspension
  "PLATFORM_SECURITY_CLEARED",     // §4.5 suspension resolved
] as const;
export type TransitionBasis = (typeof TRANSITION_BASES)[number];

export type DenialCode =
  | "illegal_transition"   // §4.2 — edge not in the frozen table
  | "step_up_required"     // temporary Authentication-verifier gate for irreversible command
  | "owner_invariant"      // §4.7 — sole owner of an ACTIVE/SUSPENDED Organization
  | "authority_insufficient" // §4.3 / §4.5 — authority class may not perform this edge
  | "self_approval"        // conservative separation-of-duty choice for pure platform policy
  | "basis_incoherent";    // basis does not match the authority/edge it claims

// A pure-policy input only. It is NOT accepted by the executable command. Authentication
// must later supply a verified fact through its own adapter; a caller object is never proof.
export interface AuthenticationStepUpFact { readonly method: string; readonly verifiedAt: number }

export interface TransitionRequest {
  readonly from: OperatorState;
  readonly to: OperatorState;
  readonly authority: TransitionAuthority;
  readonly basis: TransitionBasis;
  readonly actorIsSubject: boolean;
  readonly stepUp: AuthenticationStepUpFact | null;
  readonly ownsActiveOrSuspendedOrganization: boolean;
}

export type TransitionDecision =
  | { readonly allowed: true; readonly stepUpRequired: boolean }
  | { readonly allowed: false; readonly code: DenialCode };

const deny = (code: DenialCode): TransitionDecision => ({ allowed: false, code });

// ── Execution prerequisites ───────────────────────────────────────────────────
// Identity does NOT implement Authentication, Platform Authority, or Organization control.
// No verifier/resolver exists today, so each seam is hard-fail-closed. Replacing any of
// these constants requires its owning domain's reviewed adapter; it must never be toggled
// from request input or a test-only hook.
export function stepUpCapabilityAvailable(): boolean {
  return false;
}

export function platformAuthorityVerifierAvailable(): boolean {
  return false;
}

// Organizations owns the future atomic owner-control adapter. Its current read resolver is
// not transaction-composable with this command, so §4.7 remains hard-fail-closed. Re-exported
// here so every pre-existing importer continues to use the Organizations-owned capability.
export { ownerControlResolverAvailable };

// Conservative execution requirement for irreversible transitions. It grants no authority
// and remains a temporary fail-closed guard unless separately ratified for activation.
export function transitionRequiresStepUp(to: OperatorState): boolean {
  return to === "DEACTIVATED";
}

// Which basis values may accompany which authority class.
const BASIS_AUTHORITY: Record<TransitionBasis, readonly TransitionAuthority[]> = {
  SUBJECT_SELF_SERVICE_EXIT: ["SELF"],
  SUBJECT_WITHDRAWAL: ["SELF"],
  SUBJECT_CONFIRMED_DEACTIVATION: ["SELF"],
  PLATFORM_REVIEW_APPROVED: ["PLATFORM_IDENTITY_REVIEW"],
  PLATFORM_REVIEW_REJECTED: ["PLATFORM_IDENTITY_REVIEW"],
  PLATFORM_SECURITY_HOLD: ["PLATFORM_SECURITY", "PLATFORM_IDENTITY_REVIEW"],
  PLATFORM_SECURITY_CLEARED: ["PLATFORM_SECURITY", "PLATFORM_IDENTITY_REVIEW"],
};

// Which authority classes may drive each legal edge. Absent an edge => no authority may.
// PENDING->ACTIVE is review-only: §4.3 permits same-command activation ONLY under a named
// versioned eligibility policy, and no such policy is ratified, so activation requires
// bounded Platform Identity Review. SUSPENDED->ACTIVE is platform-only: §4.5 requires
// resolution evidence and no self-reinstatement is ratified — fail closed (§1.11).
const EDGE_AUTHORITY: Record<string, readonly TransitionAuthority[]> = {
  "PENDING->ACTIVE": ["PLATFORM_IDENTITY_REVIEW"],
  "PENDING->DEACTIVATED": ["SELF", "PLATFORM_IDENTITY_REVIEW", "PLATFORM_SECURITY"],
  "ACTIVE->SUSPENDED": ["SELF", "PLATFORM_IDENTITY_REVIEW", "PLATFORM_SECURITY"],
  "ACTIVE->DEACTIVATED": ["SELF", "PLATFORM_IDENTITY_REVIEW", "PLATFORM_SECURITY"],
  "SUSPENDED->ACTIVE": ["PLATFORM_IDENTITY_REVIEW", "PLATFORM_SECURITY"],
  "SUSPENDED->DEACTIVATED": ["SELF", "PLATFORM_IDENTITY_REVIEW", "PLATFORM_SECURITY"],
};

// PURE, TOTAL, fail-closed. Same request => same decision, always.
export function decideTransition(req: TransitionRequest): TransitionDecision {
  // §4.2 — the frozen transition table is the first and hardest gate.
  if (!canTransitionOperator(req.from, req.to)) return deny("illegal_transition");

  const edge = `${req.from}->${req.to}`;
  const allowedAuthorities = EDGE_AUTHORITY[edge];
  if (!allowedAuthorities || !allowedAuthorities.includes(req.authority)) return deny("authority_insufficient");

  // §11.2 — the recorded basis must actually belong to the asserted authority class.
  const basisAuthorities = BASIS_AUTHORITY[req.basis];
  if (!basisAuthorities || !basisAuthorities.includes(req.authority)) return deny("basis_incoherent");

  // SELF authority is only SELF when the actor IS the subject.
  if (req.authority === "SELF" && !req.actorIsSubject) return deny("authority_insufficient");
  // Conservative separation of duties: a platform-policy action may not target its actor.
  if (req.authority !== "SELF" && req.actorIsSubject) return deny("self_approval");

  // §4.7 bars deactivation of a sole owner. It permits suspension only with an explicit
  // control/resolution path; denying it while no such path exists is a conservative choice.
  if (req.ownsActiveOrSuspendedOrganization && (req.to === "DEACTIVATED" || req.to === "SUSPENDED")) {
    return deny("owner_invariant");
  }

  // The current conservative execution policy requires an Authentication-owned step-up
  // fact for irreversible commands; no such capability exists today.
  const stepUpRequired = transitionRequiresStepUp(req.to);
  if (stepUpRequired && (!stepUpCapabilityAvailable() || !req.stepUp)) return deny("step_up_required");

  // §4.6 — a subject-initiated deactivation requires separately confirmed intent, which
  // is carried by the basis. A subject may not deactivate under a withdrawal basis from
  // a state that is not PENDING.
  if (req.to === "DEACTIVATED" && req.authority === "SELF") {
    const ok = req.from === "PENDING"
      ? req.basis === "SUBJECT_WITHDRAWAL" || req.basis === "SUBJECT_CONFIRMED_DEACTIVATION"
      : req.basis === "SUBJECT_CONFIRMED_DEACTIVATION";
    if (!ok) return deny("basis_incoherent");
  }

  return { allowed: true, stepUpRequired };
}

// Canonical serialization + decision digest now live in ./canonical so Identity,
// Enrollment and Organizations share ONE implementation (§17). Re-exported here so every
// pre-existing importer is unchanged.
import { canonicalJson, decisionDigest } from "./canonical";
import { ownerControlResolverAvailable } from "./organizations";
export { canonicalJson, decisionDigest };

// ── The command ──────────────────────────────────────────────────────────────

export type LifecycleErrorCode =
  | "disabled" | "forbidden" | "invalid" | "conflict" | "not_found"
  | "idempotency_conflict" | DenialCode;

export type LifecycleResult =
  | { ok: true; operatorId: string; from: OperatorState; to: OperatorState; eventId: string; replayed: boolean }
  | { ok: false; code: LifecycleErrorCode; error: string };

const fail = (code: LifecycleErrorCode, error: string): LifecycleResult => ({ ok: false, code, error });

export interface TransitionCommand {
  readonly operatorId: string;
  readonly to: OperatorState;
  readonly authority: TransitionAuthority;
  readonly basis: TransitionBasis;
  /** Idempotency key (§4.2, §11.2). Same id + same material inputs => replay. */
  readonly commandId: string;
  /** SEALED input (§11.2). Never derived from the clock inside this module. */
  readonly effectiveAt: number;
}

function isNonEmpty(s: unknown): s is string {
  return typeof s === "string" && s.trim().length > 0 && s.length <= 200;
}

function isOperatorState(value: unknown): value is OperatorState {
  return typeof value === "string" && (OPERATOR_STATES as readonly string[]).includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// The event id is the command ledger key. It is tenant-scoped by the subject account,
// so one command id cannot collide across operator identities on different accounts.
export function lifecycleEventId(accountId: string, commandId: string): string {
  return deriveEventId(accountId, "OPERATOR_STATE_CHANGED", "identity", `operator-lifecycle:${commandId}`);
}

export interface ExistingLifecycleEvent {
  readonly id: string;
  readonly type: string;
  readonly version: number;
  readonly correlationId: string;
  readonly payload: unknown;
}

export interface LifecycleReplayInput {
  readonly eventId: string;
  readonly operatorId: string;
  readonly to: OperatorState;
  readonly authority: TransitionAuthority;
  readonly basis: TransitionBasis;
  readonly actorId: string;
  readonly commandId: string;
  readonly effectiveAt: number;
}

// A replay compares every caller-controlled material input, but intentionally reads the
// original `from` state from durable evidence. The current projection may have advanced
// through later legal transitions; that must not turn a matching retry into a new command.
export function replayedLifecycleTransition(
  prior: ExistingLifecycleEvent,
  expected: LifecycleReplayInput,
): { from: OperatorState; to: OperatorState } | null {
  if (prior.type !== "OPERATOR_STATE_CHANGED" || prior.version !== 2 || prior.correlationId !== expected.eventId) return null;
  if (!isRecord(prior.payload)) return null;
  const p = prior.payload;
  const from = p.from;
  if (!isOperatorState(from) || !isOperatorState(p.to) || !canTransitionOperator(from, p.to)) return null;
  if (
    p.policyVersion !== OPERATOR_LIFECYCLE_POLICY_VERSION
    || p.operatorId !== expected.operatorId
    || p.to !== expected.to
    || p.authorityClass !== expected.authority
    || p.basis !== expected.basis
    || p.actorId !== expected.actorId
    || p.commandId !== expected.commandId
    || p.effectiveAt !== expected.effectiveAt
    || p.stepUp !== transitionRequiresStepUp(expected.to)
    || p.causationId !== null
  ) return null;

  const sealed = {
    policyVersion: p.policyVersion,
    operatorId: p.operatorId,
    from,
    to: p.to,
    authorityClass: p.authorityClass,
    basis: p.basis,
    actorId: p.actorId,
    commandId: p.commandId,
    effectiveAt: p.effectiveAt,
    stepUp: p.stepUp,
  };
  if (typeof p.decisionDigest !== "string" || p.decisionDigest !== decisionDigest(sealed)) return null;
  return { from, to: p.to };
}

// No command can exercise a missing owner domain's security authority. These hard blocks
// make accidental flag activation safe; pure policy remains available for deterministic
// review and later owner-integrated execution.
export function lifecycleExecutionBlock(
  authority: TransitionAuthority,
  to: OperatorState,
): "forbidden" | "step_up_required" | "owner_invariant" | null {
  if (authority !== "SELF" && !platformAuthorityVerifierAvailable()) return "forbidden";
  if (transitionRequiresStepUp(to) && !stepUpCapabilityAvailable()) return "step_up_required";
  if ((to === "SUSPENDED" || to === "DEACTIVATED") && !ownerControlResolverAvailable()) return "owner_invariant";
  return null;
}

/**
 * The ONE door for an operator lifecycle transition.
 *
 * Pipeline: flag -> principal -> input shape -> execution prerequisites -> load subject ->
 * idempotency ledger -> pure decision -> atomic { guarded state write + evidence }.
 */
export async function transitionOperator(
  principal: IdentityPrincipal | null, cmd: TransitionCommand,
): Promise<LifecycleResult> {
  if (!operatorIdentityEnabled()) return fail("disabled", "operator identity disabled");
  if (!principal || principal.disabled) return fail("forbidden", "no principal");

  if (!isNonEmpty(cmd.operatorId)) return fail("invalid", "invalid operatorId");
  if (!isNonEmpty(cmd.commandId)) return fail("invalid", "invalid commandId");
  if (!TRANSITION_AUTHORITIES.includes(cmd.authority)) return fail("invalid", "unknown authority class");
  if (!TRANSITION_BASES.includes(cmd.basis)) return fail("invalid", "unknown basis");
  if (!isOperatorState(cmd.to)) return fail("invalid", "unknown operator state");
  if (!Number.isInteger(cmd.effectiveAt) || cmd.effectiveAt <= 0) return fail("invalid", "effectiveAt must be a sealed integer timestamp");

  const executionBlock = lifecycleExecutionBlock(cmd.authority, cmd.to);
  if (executionBlock) return fail(executionBlock, `transition unavailable: ${executionBlock}`);

  let operator: Awaited<ReturnType<typeof repo.findOperatorById>>;
  try {
    operator = await repo.findOperatorById(cmd.operatorId);
  } catch {
    return fail("conflict", "operator lookup failed");
  }
  if (!operator) return fail("not_found", "operator not found");

  const from = operator.state as OperatorState;
  const actorIsSubject = operator.accountId === principal.id;
  const eventId = lifecycleEventId(operator.accountId, cmd.commandId);
  const replayInput: LifecycleReplayInput = {
    eventId, operatorId: operator.id, to: cmd.to, authority: cmd.authority,
    basis: cmd.basis, actorId: principal.id, commandId: cmd.commandId, effectiveAt: cmd.effectiveAt,
  };

  const existingReplay = async (): Promise<LifecycleResult | null> => {
    let prior: ExistingLifecycleEvent | null;
    try {
      prior = await repo.findEventById(eventId);
    } catch {
      return fail("conflict", "idempotency lookup failed");
    }
    if (!prior) return null;
    const original = replayedLifecycleTransition(prior, replayInput);
    if (!original) return fail("idempotency_conflict", "commandId reused with different material inputs");
    return { ok: true, operatorId: operator.id, ...original, eventId: prior.id, replayed: true };
  };

  const prior = await existingReplay();
  if (prior) return prior;

  const decision = decideTransition({
    from, to: cmd.to, authority: cmd.authority, basis: cmd.basis,
    actorIsSubject, stepUp: null,
    // Execution is hard-blocked above until Organizations supplies an atomic resolver that
    // can be evaluated in this mutation/evidence transaction.
    ownsActiveOrSuspendedOrganization: false,
  });
  if (!decision.allowed) return fail(decision.code, `transition denied: ${decision.code}`);

  // The sealed decision record. Everything the decision depended on, and nothing else.
  const sealed = {
    policyVersion: OPERATOR_LIFECYCLE_POLICY_VERSION,
    operatorId: operator.id,
    from, to: cmd.to,
    authorityClass: cmd.authority,
    basis: cmd.basis,
    actorId: principal.id,
    commandId: cmd.commandId,
    effectiveAt: cmd.effectiveAt,
    stepUp: decision.stepUpRequired,
  };
  const evidence: EvidenceInput = {
    ...sealed,
    decisionDigest: decisionDigest(sealed),
    // Slice 1 has no upstream domain command. A null causal predecessor and the
    // server-derived event-id correlation are more truthful than caller-provided text.
    causationId: null,
  };

  const draft = draftIdentityEvent(buildOperatorStateChangedEvent(operator, evidence, principal.id));
  if (!draft.ok) return fail("invalid", draft.error);
  if (draft.event.id !== eventId) return fail("invalid", "lifecycle event identity mismatch");

  // Ratified §11 requires new mutable state to be wrapped with durable evidence. The
  // duplicate mode is strict so a racing/mismatched ledger row rolls this transaction back.
  try {
    const applied = await prisma.$transaction(async (tx) => {
      const res = await repo.transitionOperator(cmd.operatorId, from, cmd.to, tx);
      if (res.count !== 1) return null; // concurrent change — abort, write no evidence
      await appendEvent(draft.event, tx, { onDuplicate: "error" });
      return true;
    });
    if (!applied) return (await existingReplay()) ?? fail("conflict", "state changed concurrently");
    return { ok: true, operatorId: operator.id, from, to: cmd.to, eventId: draft.event.id, replayed: false };
  } catch {
    // Strict duplicate handling rolls the state write back. A post-rollback ledger read
    // distinguishes a matching concurrent command from a material-input collision.
    return (await existingReplay()) ?? fail("conflict", "transition did not commit");
  }
}
