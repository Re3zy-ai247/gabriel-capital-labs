import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { IMPERSONATE_COOKIE } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// POST: stop impersonating. Always safe to call — it only clears the cookie for
// the current session. Requires a signed-in session so a stray request can't
// manipulate cookies.
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(IMPERSONATE_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
