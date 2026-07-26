// Operator Identity — ORGANIZATIONS RUNTIME (Implementation Slice 3).
//
// Implements Identity Constitution v1.0 §2.4 (Organization), §2.5 (Constitutional
// Ownership), §6.1-6.7 (states, transitions, creation authority, the ownership invariant,
// suspension, reactivation, archival), §8.1 gate 5 (tenant match), §11.2 (evidence), as
// amended by ICAP-1 A-6 (the definition of "owner Membership"). Semantics are FROZEN.
//
// WHAT ORGANIZATIONS OWNS: organization lifecycle, the current-owner projection, and the
// ownership invariant. WHAT IT DOES NOT DO: issue Membership, activate operators, issue
// Platform Authority, run enrollment, or grant organization roles. Membership rows are
// READ here to resolve the owner (§6.4 makes the owner's membership part of the
// invariant); nothing writes one — Membership Runtime is Slice 4.
//
// THE CENTRAL DELIVERABLE is the canonical owner resolution. ICAP-1 A-6 fixed the
// definition that v1.0 used thirteen times and never defined: the owner Membership is the
// membership whose OperatorIdentity resolves to the Organization's current
// `ownerAccountId` — identified by RESOLUTION, never by a role value, because §1.8 and
// §2.5 make `OrgRole.OWNER` derived and non-assignable. A-6 also fixed the failure mode:
// "An implementation that cannot resolve account -> OperatorIdentity -> Membership
// deterministically may not enforce §6.4, §7.5, or §6.8, and fails closed."
//
// This module supplies the atomic resolver that Slice 1's lifecycle command hard-blocked
// on, so the operator §4.7 owner guard now consumes real Organizations truth instead of a
// blanket denial.
import { prisma } from "@/lib/prisma";
import { canonicalJson, decisionDigest } from "./canonical";
import { operatorIdentityEnabled } from "./flags";
import { type IdentityPrincipal } from "./principal";
import { canTransitionOrganization, type OrganizationState } from "./state";

export const ORGANIZATION_POLICY_VERSION = "operator-organization@1";

export const ORGANIZATION_AUTHORITIES = ["OWNER", "PLATFORM_COMPLIANCE", "PLATFORM_SECURITY"] as const;
export type OrganizationAuthority = (typeof ORGANIZATION_AUTHORITIES)[number];

// Bounded reason classes (§11.2). Key is `basis`, never `reason*` — the Event Fabric PII
// guard denylists keys containing "reason" and is not weakened to suit this module.
export const ORGANIZATION_BASES = [
  "OWNER_REQUESTED",
  "COMPLIANCE_HOLD",
  "SECURITY_HOLD",
  "OWNER_CLOSED",
  "COMPLIANCE_CLOSED",
] as const;
export type OrganizationBasis = (typeof ORGANIZATION_BASES)[number];

// ── Owner resolution (§2.5, §6.4, ICAP-1 A-6) ────────────────────────────────
// Three hops, each of which can fail. Every failure is a DISTINCT verdict so a denial
// names the real defect instead of collapsing to "no owner".
export const OWNER_VERDICTS = [
  "OWNER_RESOLVED",              // all three hops present and ACTIVE
  "ORGANIZATION_NOT_FOUND",
  "OWNER_ACCOUNT_MISSING",       // dangling ownerAccountId (FK is RESTRICT, so a defect)
  "OWNER_OPERATOR_MISSING",      // the owner account has no OperatorIdentity
  "OWNER_OPERATOR_NOT_ACTIVE",   // §6.4 — normal owner operations need an ACTIVE identity
  "OWNER_MEMBERSHIP_MISSING",    // §6.4 — the owner holds no membership in their own org
  "OWNER_MEMBERSHIP_NOT_ACTIVE", // §6.4 — membership exists but is SUSPENDED/REMOVED
  "RIVAL_OWNER_CLAIM",           // a membership row asserts OrgRole.OWNER (§1.8 forbids)
] as const;
export type OwnerVerdict = (typeof OWNER_VERDICTS)[number];

/** The facts the invariant is evaluated over. Pure input — no I/O in the evaluator. */
export interface OwnerFacts {
  readonly organizationFound: boolean;
  readonly organizationState: OrganizationState | null;
  readonly ownerAccountId: string | null;
  readonly ownerOperatorId: string | null;
  readonly ownerOperatorState: string | null;
  readonly ownerMembershipState: string | null;
  /** Count of membership rows asserting OrgRole.OWNER. Must always be zero (§1.8). */
  readonly rivalOwnerClaims: number;
}

export interface OwnerResolution {
  readonly verdict: OwnerVerdict;
  readonly organizationId: string;
  readonly ownerAccountId: string | null;
  readonly ownerOperatorId: string | null;
  /** True only for OWNER_RESOLVED. Anything else grants nothing (§1.11). */
  readonly valid: boolean;
}

/**
 * PURE, TOTAL, fail-closed. Evaluates §6.4 over resolved facts.
 *
 * Ordered so the most fundamental defect wins: a rival OWNER claim is reported before any
 * missing-hop verdict, because a second ownership authority is a worse condition than an
 * incomplete one and must never be masked.
 */
export function evaluateOwnerInvariant(facts: OwnerFacts): OwnerVerdict {
  if (!facts.organizationFound) return "ORGANIZATION_NOT_FOUND";
  // §1.8 / §2.5 — ownership is derived from the Organization row. A membership row
  // claiming OWNER is a second authority and is rejected outright.
  if (facts.rivalOwnerClaims > 0) return "RIVAL_OWNER_CLAIM";
  if (!facts.ownerAccountId) return "OWNER_ACCOUNT_MISSING";
  if (!facts.ownerOperatorId) return "OWNER_OPERATOR_MISSING";
  if (facts.ownerOperatorState !== "ACTIVE") return "OWNER_OPERATOR_NOT_ACTIVE";
  if (!facts.ownerMembershipState) return "OWNER_MEMBERSHIP_MISSING";
  if (facts.ownerMembershipState !== "ACTIVE") return "OWNER_MEMBERSHIP_NOT_ACTIVE";
  return "OWNER_RESOLVED";
}

export function ownerVerdictIsValid(v: OwnerVerdict): boolean {
  return v === "OWNER_RESOLVED";
}

/**
 * The ATOMIC owner resolution Slice 1 hard-blocked on. All three hops plus the rival-claim
 * scan run inside ONE transaction, so the resolution cannot straddle a concurrent
 * ownership or membership change and report a state that never simultaneously existed.
 */
export async function resolveOrganizationOwner(organizationId: string): Promise<OwnerResolution> {
  const facts = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, state: true, ownerAccountId: true },
    });
    if (!org) {
      return {
        organizationFound: false, organizationState: null, ownerAccountId: null,
        ownerOperatorId: null, ownerOperatorState: null, ownerMembershipState: null,
        rivalOwnerClaims: 0,
      } satisfies OwnerFacts;
    }
    const rivalOwnerClaims = await tx.organizationMembership.count({
      where: { organizationId, role: "OWNER" },
    });
    const operator = org.ownerAccountId
      ? await tx.operatorIdentity.findUnique({
        where: { accountId: org.ownerAccountId }, select: { id: true, state: true },
      })
      : null;
    const membership = operator
      ? await tx.organizationMembership.findUnique({
        where: { organizationId_operatorId: { organizationId, operatorId: operator.id } },
        select: { state: true },
      })
      : null;
    return {
      organizationFound: true,
      organizationState: org.state as OrganizationState,
      ownerAccountId: org.ownerAccountId ?? null,
      ownerOperatorId: operator?.id ?? null,
      ownerOperatorState: operator?.state ?? null,
      ownerMembershipState: membership?.state ?? null,
      rivalOwnerClaims,
    } satisfies OwnerFacts;
  });

  const verdict = evaluateOwnerInvariant(facts);
  return {
    verdict, organizationId,
    ownerAccountId: facts.ownerAccountId,
    ownerOperatorId: facts.ownerOperatorId,
    valid: ownerVerdictIsValid(verdict),
  };
}

// ── Capability the operator lifecycle consumes (§4.7) ────────────────────────

// Slice 3 supplies the atomic resolver, so the operator §4.7 guard is no longer a blanket
// denial. It now consumes real Organizations truth.
export function ownerControlResolverAvailable(): boolean {
  return true;
}

/**
 * §4.7 input: does this account currently own an ACTIVE or SUSPENDED Organization?
 * Owned by Organizations, not by the Identity repository — ownership is Organizations'
 * fact to state (§17.3).
 */
export function countOwnedActiveOrSuspendedOrganizations(accountId: string): Promise<number> {
  return prisma.organization.count({
    where: { ownerAccountId: accountId, state: { in: ["ACTIVE", "SUSPENDED"] } },
  });
}

// ── Lifecycle policy (§6.2, §6.5-6.7) ────────────────────────────────────────

export type OrganizationDenial =
  | "illegal_transition"       // §6.2 — edge not in the frozen table
  | "authority_insufficient"   // §6.5-6.7 — this class may not drive this edge
  | "basis_incoherent"         // §11.2 — basis does not belong to the edge/authority
  | "wrong_organization"       // §8.1 gate 5 — asserted org does not match the record
  | "owner_invariant"          // §6.4 — the org has no valid canonical owner
  | "reinstatement_unresolved";// §6.6 — the imposing authority class cannot be determined

export interface OrganizationDecisionRequest {
  readonly from: OrganizationState;
  readonly to: OrganizationState;
  readonly authority: OrganizationAuthority;
  readonly basis: OrganizationBasis;
  readonly organizationMatches: boolean;
  /** §6.4 — the org's canonical owner resolution at decision time. */
  readonly ownerVerdict: OwnerVerdict;
  /** §6.6 — the authority class that imposed the current suspension, if determinable. */
  readonly suspendingAuthority: OrganizationAuthority | null;
}

export type OrganizationDecision =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly code: OrganizationDenial };

const denyO = (code: OrganizationDenial): OrganizationDecision => ({ allowed: false, code });

// Who may drive each legal edge. §6.5 suspension: the owner or bounded Platform Authority.
// §6.7 archival: the current owner or bounded Platform Authority.
const EDGE_AUTHORITY: Record<string, readonly OrganizationAuthority[]> = {
  "ACTIVE->SUSPENDED": ["OWNER", "PLATFORM_COMPLIANCE", "PLATFORM_SECURITY"],
  "ACTIVE->ARCHIVED": ["OWNER", "PLATFORM_COMPLIANCE"],
  "SUSPENDED->ACTIVE": ["OWNER", "PLATFORM_COMPLIANCE", "PLATFORM_SECURITY"],
  "SUSPENDED->ARCHIVED": ["OWNER", "PLATFORM_COMPLIANCE"],
};

const BASIS_AUTHORITY: Record<OrganizationBasis, readonly OrganizationAuthority[]> = {
  OWNER_REQUESTED: ["OWNER"],
  COMPLIANCE_HOLD: ["PLATFORM_COMPLIANCE"],
  SECURITY_HOLD: ["PLATFORM_SECURITY"],
  OWNER_CLOSED: ["OWNER"],
  COMPLIANCE_CLOSED: ["PLATFORM_COMPLIANCE"],
};

const ARCHIVAL_BASES: readonly OrganizationBasis[] = ["OWNER_CLOSED", "COMPLIANCE_CLOSED"];

/** PURE, TOTAL, fail-closed. Same request => same decision, always. */
export function decideOrganizationTransition(req: OrganizationDecisionRequest): OrganizationDecision {
  // §6.2 — the frozen table is the first and hardest gate. ARCHIVED is terminal.
  if (!canTransitionOrganization(req.from, req.to)) return denyO("illegal_transition");
  // §8.1 gate 5 — a record is only ever operated within its own tenant.
  if (!req.organizationMatches) return denyO("wrong_organization");

  const edge = `${req.from}->${req.to}`;
  const allowed = EDGE_AUTHORITY[edge];
  if (!allowed || !allowed.includes(req.authority)) return denyO("authority_insufficient");

  const basisAuthorities = BASIS_AUTHORITY[req.basis];
  if (!basisAuthorities || !basisAuthorities.includes(req.authority)) return denyO("basis_incoherent");

  // Archival and suspension use disjoint reason classes: closing an Organization is not
  // the same act as holding it.
  const isArchival = req.to === "ARCHIVED";
  if (isArchival !== ARCHIVAL_BASES.includes(req.basis)) return denyO("basis_incoherent");

  // §6.4 — an OWNER-authority act requires a valid canonical owner. An Organization with
  // no resolvable owner cannot authorize its own lifecycle change.
  if (req.authority === "OWNER" && !ownerVerdictIsValid(req.ownerVerdict)) return denyO("owner_invariant");

  // §6.6 — reactivation requires the SAME authority class that imposed the suspension, or
  // a higher separately ratified class. Determining the imposing class requires the
  // suspension's own evidence; where it cannot be determined, this fails closed rather
  // than guessing.
  if (req.from === "SUSPENDED" && req.to === "ACTIVE") {
    if (!req.suspendingAuthority) return denyO("reinstatement_unresolved");
    if (req.suspendingAuthority !== req.authority) return denyO("authority_insufficient");
  }

  return { allowed: true };
}

// ── Capability gates (fail-closed, mirroring Slices 1-2) ─────────────────────

// §6.5-6.7 permit "bounded Platform Authority" to suspend or archive. §9 requires that
// class to be issued, scoped, expiring and revocable; issuance is Slice 5. Until then a
// platform-authority act cannot be verified and fails closed.
export function platformAuthorityVerifierAvailable(): boolean {
  return false;
}

// §6.6 needs the authority class that imposed the current suspension. That is a query over
// durable lifecycle evidence, which is the Evidence Runtime (Slice 6).
export function suspensionAuthorityLedgerAvailable(): boolean {
  return false;
}

// §5.3 requires Organization creation to atomically establish the Organization, the owner
// projection, the owner's ACTIVE Membership, and evidence. Membership issuance is Slice 4,
// so a compliant creation is not yet constructible. §5.3 is explicit that the current
// non-transactional, membership-less creation "is noncompliant ... That is an activation
// blocker, not authority to weaken this clause" — so creation fails closed here rather
// than continuing to produce an Organization that violates §6.4 the moment it exists.
export function organizationCreationBlock(): "membership_runtime_unavailable" | null {
  return "membership_runtime_unavailable";
}

/** Capabilities a lifecycle command needs but Organizations does not own. */
export function organizationExecutionBlock(
  authority: OrganizationAuthority, from: OrganizationState, to: OrganizationState,
): "forbidden" | "reinstatement_unresolved" | null {
  if (authority !== "OWNER" && !platformAuthorityVerifierAvailable()) return "forbidden";
  if (from === "SUSPENDED" && to === "ACTIVE" && !suspensionAuthorityLedgerAvailable()) {
    return "reinstatement_unresolved";
  }
  return null;
}

// ── Evidence ─────────────────────────────────────────────────────────────────

export function organizationEventId(organizationId: string, commandId: string): string {
  return decisionDigest({ organizationId, commandId }).replace("sha256:", "evt_").slice(0, 36);
}

/** The sealed decision record every organization command digests (§11.2, §10.4). */
export function sealOrganization(input: {
  organizationId: string; ownerAccountId: string | null; from: OrganizationState | null;
  to: OrganizationState; authorityClass: OrganizationAuthority; basis: OrganizationBasis;
  ownerVerdict: OwnerVerdict; actorId: string; commandId: string; effectiveAt: number;
}): Record<string, unknown> {
  return { policyVersion: ORGANIZATION_POLICY_VERSION, ...input };
}

export function organizationDecisionDigest(sealed: Record<string, unknown>): string {
  return decisionDigest(sealed);
}

export function replayedOrganization(
  existingPayload: unknown, intendedPayload: Record<string, unknown>,
): { replay: boolean } {
  return { replay: canonicalJson(existingPayload) === canonicalJson(intendedPayload) };
}

// ── Commands ─────────────────────────────────────────────────────────────────

export type OrganizationErrorCode =
  | "disabled" | "forbidden" | "invalid" | "not_found" | "conflict"
  | "membership_runtime_unavailable" | OrganizationDenial;

export type OrganizationResult =
  | { ok: true; organizationId: string; state: OrganizationState; verdict: OwnerVerdict }
  | { ok: false; code: OrganizationErrorCode; error: string };

const failO = (code: OrganizationErrorCode, error: string): OrganizationResult => ({ ok: false, code, error });

export interface OrganizationCommand {
  readonly organizationId: string;
  readonly authority: OrganizationAuthority;
  readonly basis: OrganizationBasis;
  readonly commandId: string;
  /** SEALED input (§11.2) — never read from the clock inside this module. */
  readonly effectiveAt: number;
  readonly correlationId?: string;
  readonly causationId?: string;
}

function preambleO(principal: IdentityPrincipal | null, cmd: OrganizationCommand): OrganizationResult | null {
  if (!operatorIdentityEnabled()) return failO("disabled", "operator identity disabled");
  if (!principal || principal.disabled) return failO("forbidden", "no principal");
  const nonEmpty = (s: unknown) => typeof s === "string" && s.trim().length > 0 && s.length <= 200;
  if (!nonEmpty(cmd.organizationId)) return failO("invalid", "invalid organizationId");
  if (!nonEmpty(cmd.commandId)) return failO("invalid", "invalid commandId");
  if (!ORGANIZATION_AUTHORITIES.includes(cmd.authority)) return failO("invalid", "unknown authority class");
  if (!ORGANIZATION_BASES.includes(cmd.basis)) return failO("invalid", "unknown basis");
  if (!Number.isInteger(cmd.effectiveAt) || cmd.effectiveAt <= 0) {
    return failO("invalid", "effectiveAt must be a sealed integer timestamp");
  }
  return null;
}

/**
 * Validate the §6.4 ownership invariant for one Organization and report the verdict.
 * READ-ONLY: it changes nothing, issues nothing, and grants nothing. This is the command
 * behind the OwnerValidated fact.
 */
export async function validateOrganizationOwner(
  principal: IdentityPrincipal | null, organizationId: string,
): Promise<OrganizationResult> {
  if (!operatorIdentityEnabled()) return failO("disabled", "operator identity disabled");
  if (!principal || principal.disabled) return failO("forbidden", "no principal");
  if (typeof organizationId !== "string" || !organizationId.trim()) return failO("invalid", "invalid organizationId");

  const resolution = await resolveOrganizationOwner(organizationId);
  if (resolution.verdict === "ORGANIZATION_NOT_FOUND") return failO("not_found", "organization not found");
  return {
    ok: true, organizationId,
    state: "ACTIVE", // the caller reads `verdict`; state is reported by the read path
    verdict: resolution.verdict,
  };
}

export async function suspendOrganization(
  principal: IdentityPrincipal | null, cmd: OrganizationCommand,
): Promise<OrganizationResult> {
  const stop = preambleO(principal, cmd);
  if (stop) return stop;
  const block = organizationExecutionBlock(cmd.authority, "ACTIVE", "SUSPENDED");
  if (block) return failO(block, `organization command unavailable: ${block}`);
  return failO("membership_runtime_unavailable", "organization lifecycle commands require the owner Membership model (Slice 4)");
}

export async function archiveOrganization(
  principal: IdentityPrincipal | null, cmd: OrganizationCommand,
): Promise<OrganizationResult> {
  const stop = preambleO(principal, cmd);
  if (stop) return stop;
  const block = organizationExecutionBlock(cmd.authority, "ACTIVE", "ARCHIVED");
  if (block) return failO(block, `organization command unavailable: ${block}`);
  return failO("membership_runtime_unavailable", "organization lifecycle commands require the owner Membership model (Slice 4)");
}

export async function reinstateOrganization(
  principal: IdentityPrincipal | null, cmd: OrganizationCommand,
): Promise<OrganizationResult> {
  const stop = preambleO(principal, cmd);
  if (stop) return stop;
  const block = organizationExecutionBlock(cmd.authority, "SUSPENDED", "ACTIVE");
  if (block) return failO(block, `organization command unavailable: ${block}`);
  return failO("membership_runtime_unavailable", "organization lifecycle commands require the owner Membership model (Slice 4)");
}
