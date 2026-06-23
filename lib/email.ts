// Minimal transactional email via the Resend HTTP API — called with a plain
// `fetch`, so there is no SDK dependency to install and the whole thing cleanly
// no-ops when unconfigured. Used for internal admin alerts (e.g. the community
// moderation queue).
//
// FAILS SAFE: if RESEND_API_KEY is unset, or the request errors/times out, it logs
// and returns false. A missing key or a transient fault must never break the user
// action that triggered the send. Consistent with the project's security posture —
// the key is only ever a transport header, never interpolated into any prompt.
const RESEND_ENDPOINT = "https://api.resend.com/emails";

// True once an API key is present. Lets callers decide whether to bother building
// a message; the send itself is still safe to call when false (it just no-ops).
export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

// Send a plain-text email to the platform admin (ADMIN_EMAIL). Returns whether it
// was actually delivered to Resend. Never throws.
export async function sendAdminEmail(opts: { subject: string; text: string }): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false; // dormant until configured — no-op, not an error
  const to = process.env.ADMIN_EMAIL || "admin@gabrielcapitallabs.com";
  // Resend requires the From domain to be verified in the Resend dashboard.
  const from = process.env.RESEND_FROM || "CreditVector Alerts <alerts@creditvector.app>";
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject: opts.subject, text: opts.text }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      console.error("sendAdminEmail: Resend responded", res.status, await res.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (e) {
    console.error("sendAdminEmail failed (non-fatal)", e);
    return false;
  }
}
