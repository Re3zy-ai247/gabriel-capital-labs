import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Signed-in visitors skip the marketing landing and go straight to Kai Home.
// Doing this here (instead of getServerSession inside app/page.tsx) lets the
// landing render fully static — the auth check was the only thing forcing it
// dynamic. getToken reads the JWT cookie on the edge; no DB hit.
export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (token) return NextResponse.redirect(new URL("/dashboard", req.url));
  return NextResponse.next();
}

// Only the landing needs this — app routes guard themselves server-side.
export const config = { matcher: ["/"] };
