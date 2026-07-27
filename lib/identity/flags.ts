// Operator Identity — feature flag (Sprint 9).
//
// Fail-closed: the ENTIRE identity runtime is a no-op unless OPERATOR_IDENTITY_ENABLED
// is EXACTLY the string "true" (unset / empty / "TRUE" / "1" all read as false). Mirrors
// the network + eventBus flag idiom. Dormant in production until BOTH the owner-gated
// migration is applied (the tables exist) AND this flag is set — activation is Gate F.
export function operatorIdentityEnabled(): boolean {
  return process.env.OPERATOR_IDENTITY_ENABLED === "true";
}

// Enrollment-scoped gate (Slice 2). Constitution §14.6 and §22 #31: "A single global
// boolean is insufficient to separate Stage 5 from Stage 6." Enrollment therefore has its
// own reachability control, SUBORDINATE to the master kill switch — it can only ever
// narrow, never widen, what the master flag permits. Same exact-string discipline.
export function operatorEnrollmentEnabled(): boolean {
  return operatorIdentityEnabled() && process.env.OPERATOR_IDENTITY_ENROLLMENT_ENABLED === "true";
}
