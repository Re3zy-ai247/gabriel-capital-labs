// Operator Reputation — feature flag (Sprint 10).
//
// Fail-closed: the entire reputation runtime is a no-op unless
// OPERATOR_REPUTATION_ENABLED is EXACTLY "true". Mirrors the identity/network/eventBus
// idiom. Activation is owner-gated (Gate F) and requires the operator_identity +
// operator_reputation migrations applied first.
export function operatorReputationEnabled(): boolean {
  return process.env.OPERATOR_REPUTATION_ENABLED === "true";
}
