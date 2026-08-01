// CreditVector Growth Network — server-runtime dormancy controls.
//
// Feature flags narrow availability; they are never authorization. The package has no
// runtime consumers in the foundation and payout execution has no configurable path.

export function growthNetworkEnabled(): boolean {
  return process.env.GROWTH_NETWORK_ENABLED === "true";
}

// Deliberate hard-off sentinel. This is not a future provider adapter or permission
// check. Replacing `false` requires a separate owner-approved architecture/release.
export function growthPayoutExecutionEnabled(): false {
  return false;
}
