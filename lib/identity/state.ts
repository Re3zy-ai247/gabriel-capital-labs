// Operator Identity — lifecycle state machines (Sprint 9).
//
// PURE, fail-closed, no I/O. The single source of truth for which lifecycle
// transitions are legal. Terminal states (DEACTIVATED / ARCHIVED / REMOVED) have NO
// outgoing transitions, which is what makes "identity resurrection" impossible: once
// an operator is DEACTIVATED it can never be silently reactivated — a new decision
// (a new record) would be required, and even that is blocked by the account-unique
// constraint. Unknown states and no-op self-transitions are rejected.
//
// String-literal unions (kept in lockstep with prisma/schema.prisma by
// identity-core.test.ts) so this module has zero dependency on the generated client
// and is unit-testable without a database.

export const OPERATOR_STATES = ["PENDING", "ACTIVE", "SUSPENDED", "DEACTIVATED"] as const;
export type OperatorState = (typeof OPERATOR_STATES)[number];

export const ORGANIZATION_STATES = ["ACTIVE", "SUSPENDED", "ARCHIVED"] as const;
export type OrganizationState = (typeof ORGANIZATION_STATES)[number];

export const MEMBERSHIP_STATES = ["ACTIVE", "SUSPENDED", "REMOVED"] as const;
export type MembershipState = (typeof MEMBERSHIP_STATES)[number];

// Adjacency lists. An empty list = a terminal state.
const OPERATOR_TRANSITIONS: Record<OperatorState, readonly OperatorState[]> = {
  PENDING: ["ACTIVE", "DEACTIVATED"],
  ACTIVE: ["SUSPENDED", "DEACTIVATED"],
  SUSPENDED: ["ACTIVE", "DEACTIVATED"],
  DEACTIVATED: [], // terminal — no resurrection
};

const ORGANIZATION_TRANSITIONS: Record<OrganizationState, readonly OrganizationState[]> = {
  ACTIVE: ["SUSPENDED", "ARCHIVED"],
  SUSPENDED: ["ACTIVE", "ARCHIVED"],
  ARCHIVED: [], // terminal
};

const MEMBERSHIP_TRANSITIONS: Record<MembershipState, readonly MembershipState[]> = {
  ACTIVE: ["SUSPENDED", "REMOVED"],
  SUSPENDED: ["ACTIVE", "REMOVED"],
  REMOVED: [], // terminal
};

// Generic, fail-closed transition check. Rejects: unknown `from`, unknown `to`,
// a self-transition (from === to), and any edge not explicitly declared.
function canTransition(map: Record<string, readonly string[]>, from: string, to: string): boolean {
  if (from === to) return false;
  const allowed = map[from];
  if (!allowed) return false; // unknown source state → deny
  return allowed.includes(to);
}

export function canTransitionOperator(from: string, to: string): boolean {
  return canTransition(OPERATOR_TRANSITIONS, from, to);
}
export function canTransitionOrganization(from: string, to: string): boolean {
  return canTransition(ORGANIZATION_TRANSITIONS, from, to);
}
export function canTransitionMembership(from: string, to: string): boolean {
  return canTransition(MEMBERSHIP_TRANSITIONS, from, to);
}

export function isTerminalOperatorState(s: string): boolean {
  return (OPERATOR_TRANSITIONS as Record<string, readonly string[]>)[s]?.length === 0;
}

// Exported for the guard test to assert the maps match the schema enums exactly.
export const _TRANSITION_MAPS = {
  operator: OPERATOR_TRANSITIONS,
  organization: ORGANIZATION_TRANSITIONS,
  membership: MEMBERSHIP_TRANSITIONS,
} as const;
