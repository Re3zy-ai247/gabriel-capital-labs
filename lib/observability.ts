// Provider-agnostic error reporting + alert hook (RC1 P0-2). Zero new SDK/framework. ALWAYS
// structured-logs the error; ADDITIONALLY forwards a compact payload to ALERT_WEBHOOK_URL when
// configured (dormant otherwise — owner supplies the destination secret). Never throws: an
// observability failure must never break the request it is observing.
import { log } from "./log";

export function reportError(err: unknown, context?: Record<string, unknown>): void {
  const e = err instanceof Error ? err : new Error(String(err));
  log.error(e.message, { ...context, errName: e.name, stack: e.stack?.split("\n").slice(0, 5).join(" | ") });
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) return; // dormant until an alert destination (Slack/Discord/webhook) is configured
  // Fire-and-forget; never await on the hot path, never throw.
  fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text: `CreditVector error: ${e.name}: ${e.message}`.slice(0, 500), context }),
  }).catch(() => {});
}
