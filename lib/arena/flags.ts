// Arena feature flag. Fail-closed opt-in: ON only when the env var is exactly
// "true". Any other value, or unset, is OFF. There is no !== "false" or ?? true
// anywhere — a misconfiguration or a typo leaves Arena disabled, never enabled.
//
//   owner:            platform owner
//   purpose:          gate the Arena progression surfaces until they are verified
//   default:          OFF (unset => off)
//   rollout cohort:   owner/admin first, then internal, then paying members
//   rollback:         unset ARENA_ENABLED (or set anything != "true") and redeploy
//   removal:          delete this flag once Arena is generally available and stable
export function arenaEnabled(): boolean {
  return process.env.ARENA_ENABLED === "true";
}
