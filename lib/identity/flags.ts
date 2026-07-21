// Operator Identity — feature flag (Sprint 9).
//
// Fail-closed: the ENTIRE identity runtime is a no-op unless OPERATOR_IDENTITY_ENABLED
// is EXACTLY the string "true" (unset / empty / "TRUE" / "1" all read as false). Mirrors
// the network + eventBus flag idiom. Dormant in production until BOTH the owner-gated
// migration is applied (the tables exist) AND this flag is set — activation is Gate F.
export function operatorIdentityEnabled(): boolean {
  return process.env.OPERATOR_IDENTITY_ENABLED === "true";
}
