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

// Send an email to an arbitrary recipient. Returns whether it was handed to Resend.
// Never throws. NOTE: reaching non-owner addresses requires a Resend-VERIFIED `from`
// domain (set RESEND_FROM to e.g. alerts@creditvector.app); the onboarding@resend.dev
// fallback only delivers to the Resend account owner.
export async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false; // dormant until configured — no-op, not an error
  const from = process.env.RESEND_FROM || "CreditVector <onboarding@resend.dev>";
  // A real, monitored Reply-To (not a pure no-reply) is a modest deliverability +
  // trust signal. Configurable; falls back to ADMIN_EMAIL.
  const replyTo = process.env.RESEND_REPLY_TO || process.env.ADMIN_EMAIL;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: opts.to,
        subject: opts.subject,
        text: opts.text,
        ...(replyTo ? { reply_to: replyTo } : {}),
        ...(opts.html ? { html: opts.html } : {}),
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      console.error("sendEmail: Resend responded", res.status, await res.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (e) {
    console.error("sendEmail failed (non-fatal)", e);
    return false;
  }
}

// Send a plain-text email to the platform admin (ADMIN_EMAIL). Thin wrapper over
// sendEmail. Returns whether it was delivered to Resend. Never throws.
export async function sendAdminEmail(opts: { subject: string; text: string }): Promise<boolean> {
  const to = process.env.ADMIN_EMAIL || "admin@gabrielcapitallabs.com";
  return sendEmail({ to, subject: opts.subject, text: opts.text });
}
