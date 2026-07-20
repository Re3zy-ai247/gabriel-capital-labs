// Operator Network feature flag. Fail-closed opt-in: ON only when the env var is
// exactly "true". No !== "false", no ?? true — a typo or missing value leaves the
// network disabled, never enabled.
//
//   owner:            platform owner
//   purpose:          gate the governed Operator Network (channels, messaging,
//                     presence) until tenant isolation is runtime-proven, the
//                     moderation path is operational, and the privacy package is
//                     counsel-reviewed
//   default:          OFF (unset => off)
//   rollout cohort:   owner/admin first, then an internal cohort, then paying
//                     members; unrestricted public access is gated on counsel review
//   rollback:         unset OPERATOR_NETWORK_ENABLED (or set != "true") and redeploy
//   removal:          delete this flag once the network is GA and stable
export function operatorNetworkEnabled(): boolean {
  return process.env.OPERATOR_NETWORK_ENABLED === "true";
}
