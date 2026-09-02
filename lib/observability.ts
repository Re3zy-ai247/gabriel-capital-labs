// Provider-agnostic error reporting + alert hook (RC1 P0-2). Zero new SDK/framework. ALWAYS
// structured-logs the error; ADDITIONALLY forwards a compact payload to ALERT_WEBHOOK_URL when
// configured (dormant otherwise — owner supplies the destination secret). Never throws: an
// observability failure must never break the request it is observing.
import { log } from "./log";

const MAX_ALERT_MESSAGE_LENGTH = 500;
const ALERT_TIMEOUT_MS = 5_000;

export type AlertDeliveryResult =
  | { delivered: true }
  | { delivered: false; reason: "not_configured" | "rejected" | "network_error"; status?: number };

// Awaitable delivery is kept separate from reportError's hot-path isolation so an
// admin-only delivery proof can report Slack's real acceptance result. The URL is
// consumed only as fetch's destination and is never returned or logged.
export async function deliverAlertWebhook(
  message: string,
  context?: Record<string, unknown>
): Promise<AlertDeliveryResult> {
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) return { delivered: false, reason: "not_configured" };

  try {
    const response = await fetch(url, {
      method: "POST",
      redirect: "error",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: message.slice(0, MAX_ALERT_MESSAGE_LENGTH), context }),
      signal: AbortSignal.timeout(ALERT_TIMEOUT_MS),
    });
    if (!response.ok) {
      return { delivered: false, reason: "rejected", status: response.status };
    }
    return { delivered: true };
  } catch {
    return { delivered: false, reason: "network_error" };
  }
}

export function reportError(err: unknown, context?: Record<string, unknown>): void {
  // Error-like values can have hostile getters, and even String(value) can throw
  // (for example Object.create(null)). Normalize behind the isolation boundary so
  // reporting an unusual failure never becomes a second request-path failure.
  let name = "Error";
  let message = "Unknown error";
  let stack: string | undefined;
  try {
    if (err instanceof Error) {
      if (typeof err.name === "string") name = err.name;
      if (typeof err.message === "string") message = err.message;
      if (typeof err.stack === "string") stack = err.stack;
    } else {
      message = String(err);
    }
  } catch {
    // Keep the safe defaults above.
  }
  try {
    log.error(message, { ...context, errName: name, stack: stack?.split("\n").slice(0, 5).join(" | ") });
  } catch {
    // A malformed context must not turn error reporting into a second failure.
  }
  // Fire-and-forget; never await on the hot path, never throw.
  void deliverAlertWebhook(`CreditVector error: ${name}: ${message}`, context).catch(() => {});
}
