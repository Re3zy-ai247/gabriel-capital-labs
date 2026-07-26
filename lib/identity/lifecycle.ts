// Operator Identity — OPERATOR LIFECYCLE RUNTIME (Implementation Slice 1).
//
// Implements Identity Constitution v1.0 §4 (Operator Lifecycle) as amended by ICAP-1.
// Semantics are FROZEN (Identity Semantic Baseline 1.0); this module implements them and
// invents nothing. Every denial below cites the clause that requires it.
//
// SHAPE. Three pure layers plus one command:
//   1. STATE MACHINE  — lib/identity/state.ts (unchanged, already ratified-correct).
//   2. VALIDATOR      — `decideTransition`, pure and total: (request) -> decision.
//   3. STEP-UP        — `stepUpCapabilityAvailable()`, fail-closed at the auth boundary.
//   4. COMMAND        — `transitionOperator`, the single door that performs the effect.
//
// WHY DEACTIVATED IS CURRENTLY UNREACHABLE. ICAP-1 A-10 requires authenticator step-up on
// any transition to DEACTIVATED and makes step-up availability a Stage 5 (Gate F)
// precondition: "the command may not be reachable before it exists." Authentication
// exposes no step-up capability today, so `stepUpCapabilityAvailable()` returns false and
// every path to DEACTIVATED denies. That is the intended constitutional outcome, not a
// defect, and it is pinned by test. The gate is on the CAPABILITY, never on a
// caller-supplied object, so a caller cannot fabricate an assertion to bypass it.
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
import { operatorIdentityEnabled } from "./flags";
import { type IdentityPrincipal } from "./principal";
import { canTransitionOperator, type OperatorState } from "./state";
import * as repo from "./repository";
import { buildOperatorStateChangedEvent, draftIdentityEvent, type EvidenceInput } from "./events";
import type { OperatorIdentity } from "@prisma/client";

// The policy version pinned into every decision and every evidence record (§1.16, §11.2).
// Bump ONLY when the decision function's behaviour changes; a replay of an old command
// must be evaluated against the version it was decided under.
export const OPERATOR_LIFECYCLE_POLICY_VERSION = "operator-lifecycle@1";

// Bounded authority classes (§9.1). SELF is the subject acting on their own identity;
// the two platform classes are §9.1 classes this command consumes but does not issue —
// Platform Authority issuance is Slice 5, so a platform class is asserted by the caller
// and is itself gated by the caller's own authorization. This module never grants it.
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
  | "step_up_required"     // ICAP-1 A-10 — irreversible command without step-up
  | "owner_invariant"      // §4.7 — sole owner of an ACTIVE/SUSPENDED Organization
  | "authority_insufficient" // §4.3 / §4.5 — authority class may not perform this edge
  | "self_approval"        // §7.8 / §15.14 — actor approving their own platform action
  | "basis_incoherent";    // basis does not match the authority/edge it claims

export interface StepUpAssertion { readonly method: string; readonly assertedAt: number }

export interface TransitionRequest {
  readonly from: OperatorState;
  readonly to: OperatorState;
  readonly authority: TransitionAuthority;
  readonly basis: TransitionBasis;
  readonly actorIsSubject: boolean;
  readonly stepUp: StepUpAssertion | null;
  readonly ownsActiveOrSuspendedOrganization: boolean;
}

export type TransitionDecision =
  | { readonly allowed: true; readonly stepUpRequired: boolean }
  | { readonly allowed: false; readonly code: DenialCode };

const deny = (code: DenialCode): TransitionDecision => ({ allowed: false, code });

// ── Step-up boundary ─────────────────────────────────────────────────────────
// Identity does NOT implement authentication (§17.1). It asks Authentication whether a
// step-up capability exists. None does today, so this is `false` and every irreversible
// command fails closed. When Authentication ships step-up, this reads its capability —
// it must never become a caller-supplied claim.
export function stepUpCapabilityAvailable(): boolean {
  return false;
}

// Which edges are irreversible and therefore demand step-up (ICAP-1 A-10).
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
  // §7.8 / §15.14 — nobody exercises platform authority over their own identity.
  if (req.authority !== "SELF" && req.actorIsSubject) return deny("self_approval");

  // §4.7 owner protection. Deactivation of a sole owner is barred outright. Suspension is
  // barred too: §4.7 permits it "only when the resulting Organization control and
  // resolution path is explicitly handled", and no such path exists (Organization
  // lifecycle commands are Slice 3) — so it fails closed (§1.11).
  if (req.ownsActiveOrSuspendedOrganization && (req.to === "DEACTIVATED" || req.to === "SUSPENDED")) {
    return deny("owner_invariant");
  }

  // ICAP-1 A-10 — irreversible commands require step-up, gated on the CAPABILITY.
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

// ── Canonical serialization + decision digest ────────────────────────────────
// §10.4 requires byte-identical canonical evidence on replay. `canonicalJson` fixes key
// order and rejects anything non-deterministic, so the digest is a stable function of the
// sealed inputs alone.
export function canonicalJson(value: unknown): string {
  if (value === null) return "null";
  const t = typeof value;
  if (t === "string") return JSON.stringify(value);
  if (t === "boolean") return String(value);
  if (t === "number") {
    if (!Number.isFinite(value as number)) throw new Error("non-finite number is not canonical");
    if (!Number.isInteger(value as number)) throw new Error("non-integer number is not canonical");
    return String(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (t === "object") {
    const rec = value as Record<string, unknown>;
    const keys = Object.keys(rec).filter((k) => rec[k] !== undefined).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(rec[k])}`).join(",")}}`;
  }
  throw new Error(`value of type ${t} is not canonical`);
}

// `sha256:` prefixed so the digest can never begin with a digit run. The Event Fabric PII
// value scan rejects a bare 13-19 digit run; the prefix makes a false positive
// impossible rather than merely improbable, keeping this path deterministic.
export function decisionDigest(sealed: Record<string, unknown>): string {
  return `sha256:${createHash("sha256").update(canonicalJson(sealed)).digest("hex")}`;
}

// ── The command ──────────────────────────────────────────────────────────────

export type LifecycleErrorCode =
  | "disabled" | "forbidden" | "invalid" | "conflict" | "not_found"
  | "idempotency_conflict" | DenialCode;

export type LifecycleResult =
  | { ok: true; operator: OperatorIdentity; eventId: string; replayed: boolean }
  | { ok: false; code: LifecycleErrorCode; error: string };

const fail = (code: LifecycleErrorCode, error: string): LifecycleResult => ({ ok: false, code, error });

export interface TransitionCommand {
  readonly operatorId: string;
  readonly to: OperatorState;
  readonly authority: TransitionAuthority;
  readonly basis: TransitionBasis;
  /** Idempotency key (§11.2, ICAP-1 A-8). Same id + same material inputs => replay. */
  readonly commandId: string;
  /** SEALED input (§11.2). Never derived from the clock inside this module. */
  readonly effectiveAt: number;
  readonly correlationId?: string;
  readonly causationId?: string;
  readonly stepUp?: StepUpAssertion | null;
}

function isNonEmpty(s: unknown): s is string {
  return typeof s === "string" && s.trim().length > 0 && s.length <= 200;
}

/**
 * The ONE door for an operator lifecycle transition.
 *
 * Pipeline: flag -> principal -> input shape -> load subject -> owner invariant ->
 * pure decision -> idempotency pre-check -> atomic { guarded state write + evidence }.
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
  if (!Number.isInteger(cmd.effectiveAt) || cmd.effectiveAt <= 0) return fail("invalid", "effectiveAt must be a sealed integer timestamp");

  const operator = await repo.findOperatorById(cmd.operatorId);
  if (!operator) return fail("not_found", "operator not found");

  const from = operator.state as OperatorState;
  const actorIsSubject = operator.accountId === principal.id;

  // §4.7 guard input. Reading Organization state is a guard on THIS command; no
  // Organization command is implemented or reachable here (Slice 3 owns those).
  const ownedOrgs = await repo.countOwnedActiveOrSuspendedOrganizations(operator.accountId);

  const decision = decideTransition({
    from, to: cmd.to, authority: cmd.authority, basis: cmd.basis,
    actorIsSubject, stepUp: cmd.stepUp ?? null,
    ownsActiveOrSuspendedOrganization: ownedOrgs > 0,
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
    causationId: cmd.causationId ?? null,
  };

  const draft = draftIdentityEvent(
    buildOperatorStateChangedEvent(operator, evidence, principal.id, cmd.correlationId),
  );
  if (!draft.ok) return fail("invalid", draft.error);

  // ICAP-1 A-8 — idempotency BEFORE the effect. Same commandId with the same material
  // inputs replays; the same commandId with DIFFERENT inputs is an error, never a
  // silent no-op. The event log is the idempotency ledger: the id is derived from the
  // commandId, so a repeat collides deterministically.
  const prior = await repo.findEventById(draft.event.id);
  if (prior) {
    const same = canonicalJson(prior.payload) === canonicalJson(draft.event.payload);
    if (!same) return fail("idempotency_conflict", "commandId reused with different material inputs");
    return { ok: true, operator, eventId: prior.id, replayed: true };
  }

  // ICAP-1 A-7 — the mutation and its evidence succeed together or neither is durable.
  try {
    const applied = await prisma.$transaction(async (tx) => {
      const res = await repo.transitionOperator(cmd.operatorId, from, cmd.to, tx);
      if (res.count !== 1) return null; // concurrent change — abort, write no evidence
      await appendEvent(draft.event, tx);
      return res.operator;
    });
    if (!applied) return fail("conflict", "state changed concurrently");
    return { ok: true, operator: applied, eventId: draft.event.id, replayed: false };
  } catch {
    // A unique collision here is a genuine race with another writer of the same command.
    // Neither the state change nor the evidence is durable; the caller may retry and the
    // idempotency pre-check will resolve it.
    return fail("conflict", "transition did not commit");
  }
}
