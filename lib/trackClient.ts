// Client-side helper to report a whitelisted funnel event to POST /api/events.
// Fire-and-forget with keepalive so it still completes when the click navigates
// away. Never throws, never blocks the UI. Only the events in
// CLIENT_REPORTABLE_EVENTS are accepted server-side.
export function trackClient(name: "onboarding_started" | "onboarding_completed" | "ai_plan_viewed"): void {
  try {
    if (typeof window === "undefined") return;
    void fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
      keepalive: true,
    }).catch(() => {
      /* analytics is best-effort */
    });
  } catch {
    /* never let telemetry break the UI */
  }
}
