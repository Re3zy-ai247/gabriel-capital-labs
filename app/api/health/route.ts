import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const RELEASE = (process.env.VERCEL_GIT_COMMIT_SHA || "dev").slice(0, 12);

// Liveness (RC1 P0-2): the process is up and serving. NO database call — a DB blip must not fail
// liveness (that is what /api/health/ready is for). Public-safe: exposes only the release SHA,
// which is already on every response via the x-cv-release header. No secrets.
export async function GET() {
  return NextResponse.json({ status: "ok", release: RELEASE, time: new Date().toISOString() });
}
