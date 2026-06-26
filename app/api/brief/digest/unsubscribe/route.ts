import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureDigestColumn, verifyDigestToken } from "@/lib/briefDigest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// One-click unsubscribe — NO login required (the signed token identifies the user).
// IMPORTANT: GET is NON-MUTATING. It renders a confirmation page whose button POSTs
// the token — so email security-scanners / link-prefetchers (which GET every link)
// can't silently unsubscribe an engaged subscriber. Only the POST changes state.
// POST also serves RFC 8058 List-Unsubscribe-Post one-click (mail clients POST
// directly, which is fine — they ignore the HTML body).
async function doUnsubscribe(token: string): Promise<boolean> {
  const userId = verifyDigestToken(token);
  if (!userId) return false;
  await ensureDigestColumn();
  await prisma.user.update({ where: { id: userId }, data: { briefDigest: false } }).catch(() => {});
  return true;
}

function shell(title: string, inner: string): NextResponse {
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
  <body style="margin:0;background:#0a1224;color:#e2e8f0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;">
    <div style="max-width:440px;padding:32px;text-align:center;">
      <div style="font-size:18px;font-weight:700;color:#fff;">CreditVector Brief</div>
      ${inner}
      <div style="margin-top:14px;"><a href="https://www.creditvector.app/brief" style="color:#22d3ee;text-decoration:none;font-size:14px;">Back to the Brief &rarr;</a></div>
    </div>
  </body></html>`;
  return new NextResponse(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Non-mutating: show a confirm button that POSTs.
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") || "";
  if (!verifyDigestToken(token)) {
    return shell("Link expired", `<p style="font-size:15px;line-height:1.6;color:#cbd5e1;margin-top:16px;">We couldn't process that unsubscribe link. You can manage the digest from your account settings.</p>`);
  }
  return shell(
    "Unsubscribe",
    `<p style="font-size:15px;line-height:1.6;color:#cbd5e1;margin-top:16px;">Unsubscribe from the weekly CreditVector Brief digest?</p>
     <form method="POST" action="/api/brief/digest/unsubscribe?token=${escapeAttr(token)}" style="margin-top:18px;">
       <button type="submit" style="background:#22d3ee;color:#06202a;border:0;border-radius:10px;padding:11px 22px;font-size:15px;font-weight:600;cursor:pointer;">Yes, unsubscribe</button>
     </form>`
  );
}

// Mutating: the confirm-page form AND mail-client one-click both POST here.
export async function POST(req: Request) {
  let token = new URL(req.url).searchParams.get("token") || "";
  if (!token) {
    const form = await req.formData().catch(() => null);
    token = (form?.get("token") as string) || "";
  }
  const ok = await doUnsubscribe(token);
  // A mail-client one-click expects only a 2xx (it ignores the body); a browser
  // form submit renders this page. JSON would be fine for clients but ugly for
  // humans, so return HTML either way.
  return shell(
    ok ? "Unsubscribed" : "Link expired",
    ok
      ? `<p style="font-size:15px;line-height:1.6;color:#cbd5e1;margin-top:16px;">You've been unsubscribed from the weekly CreditVector Brief digest. You can re-subscribe anytime from your account settings.</p>`
      : `<p style="font-size:15px;line-height:1.6;color:#cbd5e1;margin-top:16px;">We couldn't process that unsubscribe link. You can manage the digest from your account settings.</p>`
  );
}
