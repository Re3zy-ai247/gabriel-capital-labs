import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "./prisma";
import { ensureBriefTables } from "./brief";
import { sendEmail, emailConfigured } from "./email";

// Weekly CreditVector Brief email digest. Marketing-class email, so it is built to
// be CAN-SPAM compliant: opt-in only (User.briefDigest, default false), accurate
// from/subject, a one-click unsubscribe (link + List-Unsubscribe header), the
// educational disclaimer, and a physical postal address. It REFUSES TO SEND if the
// postal address isn't configured — we never put a non-compliant marketing email
// on the wire. Fails safe everywhere (a bad recipient never aborts the batch).

// Self-heal the opt-in column (User table; additive, idempotent).
let digestColReady = false;
export async function ensureDigestColumn(): Promise<void> {
  if (digestColReady) return;
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "briefDigest" BOOLEAN NOT NULL DEFAULT false`
  );
  digestColReady = true;
}

// --- Stateless, signed unsubscribe tokens (no DB token storage) -------------
function sign(userId: string): string {
  const secret = process.env.NEXTAUTH_SECRET || "dev-secret";
  return createHmac("sha256", secret).update(`brief-digest:${userId}`).digest("base64url");
}
export function digestToken(userId: string): string {
  return `${Buffer.from(userId).toString("base64url")}.${sign(userId)}`;
}
export function verifyDigestToken(token: string): string | null {
  const [b64, sig] = (token || "").split(".");
  if (!b64 || !sig) return null;
  let userId: string;
  try {
    userId = Buffer.from(b64, "base64url").toString("utf8");
  } catch {
    return null;
  }
  if (!userId) return null;
  const expected = sign(userId);
  const a = Buffer.from(sig);
  const e = Buffer.from(expected);
  if (a.length !== e.length || !timingSafeEqual(a, e)) return null;
  return userId;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function plain(md: string, n: number): string {
  return md.replace(/[#>*`_[\]]+/g, "").replace(/\s+/g, " ").trim().slice(0, n);
}

interface DigestArticle {
  slug: string;
  title: string;
  socialCaption: string | null;
  summary: string;
}

// Build the digest email (plain text + branded HTML). Includes the disclaimer,
// postal address, and unsubscribe — the CAN-SPAM essentials.
function renderDigestEmail(articles: DigestArticle[], unsubUrl: string, base: string, postal: string) {
  const subject = "CreditVector Brief — this week in consumer-credit news";
  const intro = "Here are the educational consumer-credit news summaries we published this week.";

  const text = [
    "CreditVector Brief — this week in consumer credit",
    "",
    intro,
    "",
    ...articles.flatMap((a) => {
      const cap = a.socialCaption?.trim() || plain(a.summary, 160);
      return [`• ${a.title}`, `  ${cap}`, `  ${base}/brief/${a.slug}`, ""];
    }),
    "This is an educational news summary and does not constitute legal advice.",
    "",
    "CreditVector by Gabriel Capital Labs",
    postal,
    `Unsubscribe: ${unsubUrl}`,
  ].join("\n");

  const items = articles
    .map((a) => {
      const cap = escapeHtml(a.socialCaption?.trim() || plain(a.summary, 180));
      const url = `${base}/brief/${a.slug}`;
      return `<tr><td style="padding:0 0 22px;">
        <a href="${url}" style="color:#0f766e;font-size:17px;font-weight:600;text-decoration:none;line-height:1.3;">${escapeHtml(a.title)}</a>
        <div style="color:#475569;font-size:14px;line-height:1.5;margin-top:6px;">${cap}</div>
        <a href="${url}" style="color:#0891b2;font-size:13px;text-decoration:none;margin-top:6px;display:inline-block;">Read the brief &rarr;</a>
      </td></tr>`;
    })
    .join("");

  const html = `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px;"><tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr><td style="background:#0a1224;padding:22px 28px;">
          <span style="color:#ffffff;font-size:18px;font-weight:700;">CreditVector Brief</span>
          <span style="color:#7dd3fc;font-size:13px;">&nbsp;by Gabriel Capital Labs</span>
        </td></tr>
        <tr><td style="padding:24px 28px 6px;">
          <div style="color:#0f172a;font-size:15px;line-height:1.5;margin-bottom:18px;">${escapeHtml(intro)}</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${items}</table>
        </td></tr>
        <tr><td style="padding:14px 28px 24px;border-top:1px solid #e2e8f0;">
          <div style="color:#94a3b8;font-size:12px;line-height:1.6;">
            This is an educational news summary and does not constitute legal advice.<br/>
            CreditVector by Gabriel Capital Labs &middot; ${escapeHtml(postal)}<br/>
            You're receiving this because you subscribed to the CreditVector Brief digest. <a href="${unsubUrl}" style="color:#64748b;">Unsubscribe</a>.
          </div>
        </td></tr>
      </table>
    </td></tr></table>
  </body></html>`;

  return { subject, text, html };
}

export interface DigestResult {
  ok: boolean;
  sent: number;
  articles: number;
  skipped?: string;
  error?: string;
}

// Send the weekly digest to every opted-in user (or one test recipient). Refuses to
// send without a configured postal address. Skips (no send) when nothing was
// published in the last 7 days.
export async function sendWeeklyDigest(opts: { testTo?: string } = {}): Promise<DigestResult> {
  const postal = (process.env.COMPANY_POSTAL_ADDRESS || "").trim();
  if (!postal) {
    return { ok: false, sent: 0, articles: 0, error: "COMPANY_POSTAL_ADDRESS is not set — refusing to send a marketing email without a CAN-SPAM postal address." };
  }
  if (!emailConfigured()) {
    return { ok: false, sent: 0, articles: 0, error: "Email is not configured (RESEND_API_KEY)." };
  }

  await ensureBriefTables();
  await ensureDigestColumn();

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const articles = (await prisma.briefArticle.findMany({
    where: { status: "published", publishedAt: { gte: since } },
    orderBy: { publishedAt: "desc" },
    take: 12,
    select: { slug: true, title: true, socialCaption: true, summary: true },
  })) as DigestArticle[];

  if (articles.length === 0) {
    return { ok: true, sent: 0, articles: 0, skipped: "no articles published in the last 7 days" };
  }

  const base = process.env.NEXTAUTH_URL || "https://www.creditvector.app";

  // Test send: one email to the admin so they can preview without a real list.
  if (opts.testTo) {
    const unsubUrl = `${base}/settings`;
    const { subject, text, html } = renderDigestEmail(articles, unsubUrl, base, postal);
    const ok = await sendEmail({ to: opts.testTo, subject: `[TEST] ${subject}`, text, html, headers: { "List-Unsubscribe": `<${unsubUrl}>` } });
    return { ok, sent: ok ? 1 : 0, articles: articles.length };
  }

  const recipients = await prisma.user.findMany({
    where: { briefDigest: true, disabled: false },
    select: { id: true, email: true },
  });

  const mailto = process.env.RESEND_REPLY_TO || process.env.ADMIN_EMAIL || "support@creditvector.app";
  let sent = 0;
  for (const r of recipients) {
    const unsubUrl = `${base}/api/brief/digest/unsubscribe?token=${encodeURIComponent(digestToken(r.id))}`;
    const { subject, text, html } = renderDigestEmail(articles, unsubUrl, base, postal);
    const ok = await sendEmail({
      to: r.email,
      subject,
      text,
      html,
      headers: {
        "List-Unsubscribe": `<${unsubUrl}>, <mailto:${mailto}?subject=unsubscribe>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });
    if (ok) sent++;
  }

  return { ok: true, sent, articles: articles.length };
}
