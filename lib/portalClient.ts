// Billing-portal opener — the single implementation, shared by every client page.
//
// Client-safe on purpose: no prisma / next/headers imports, so a "use client"
// page can import it (CLAUDE.md gotcha 2).
//
// Why this exists: checkout REFUSES when the customer already has an active
// subscription (app/api/stripe/checkout/route.ts UPGRADE GUARD, added to stop
// double-billing) and answers 409 with `portal: true`. The Stripe billing portal
// is the only path that changes a plan WITH proration, so a caller that gets that
// flag must be able to send the customer there — otherwise the refusal is a dead
// end at the moment they were trying to pay more.
//
// Returns null on success (the browser is already navigating away), or a
// user-facing error string the caller can display.
export async function openBillingPortal(): Promise<string | null> {
  try {
    const res = await fetch("/api/stripe/portal", { method: "POST" });
    const data = await res.json();
    if (res.ok && data.url) {
      window.location.href = data.url;
      return null;
    }
    return data.error || "Could not open the billing portal.";
  } catch {
    return "The connection dropped mid-request. Try again — nothing was lost.";
  }
}
