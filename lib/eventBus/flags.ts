// Event Bus feature flag. Fail-closed opt-in: ON only when the env var is exactly
// "true" (no !== "false", no ?? true). Mirrors lib/network/flags.ts.
//
//   default:  OFF (unset => off)
//   purpose:  keep the platform Event Bus dormant until the prod migration is applied
//             (owner-gated) and the consumer integrations are wired + reviewed
//   rollback: unset EVENT_BUS_ENABLED (or set != "true") and redeploy
export function eventBusEnabled(): boolean {
  return process.env.EVENT_BUS_ENABLED === "true";
}
