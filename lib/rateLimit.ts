import { NextResponse } from "next/server";
import { prisma } from "./prisma";

// DB-backed fixed-window rate limiter. Vercel serverless + Prisma Accelerate means
// in-memory counters don't survive across instances, so each (key, window) pair is
// one row whose count is atomically incremented per request. The limiter FAILS OPEN:
// any DB/limiter error returns ok so a transient fault can never lock out legit
// users — it only ever *adds* protection, never removes access. Counting is
// approximate (a race can let a few extra requests through near the boundary), which
// is fine for abuse mitigation.

// Self-heal: the RateHit table creates itself at runtime. CREATE TABLE IF NOT EXISTS
// via raw SQL works through the Accelerate proxy even though build-time
// `prisma db push` does not — mirrors ensureCommunityTables / ensureAttachmentTable.
let tableReady = false;
export async function ensureRateLimitTable(): Promise<void> {
  if (tableReady) return;
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "RateHit" (
       "id" TEXT NOT NULL PRIMARY KEY,
       "bucket" TEXT NOT NULL,
       "count" INTEGER NOT NULL DEFAULT 0,
       "windowStart" BIGINT NOT NULL,
       "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
     )`
  );
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "RateHit_bucket_key" ON "RateHit"("bucket")`
  );
  tableReady = true;
}

// Best-effort client IP from the proxy chain: the first hop of x-forwarded-for is
// the original client (Vercel sets this). Falls back to "unknown" so a missing
// header buckets everyone together rather than throwing.
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return "unknown";
}

// Increment the counter for `key` within the current fixed window and report
// whether the caller is still under `limit`. retryAfter is the seconds until the
// current window rolls over (0 when allowed). Never throws — fails open.
export async function rateLimit(
  key: string,
  limit: number,
  windowSec: number
): Promise<{ ok: boolean; retryAfter: number }> {
  try {
    const windowStart = Math.floor(Date.now() / 1000 / windowSec);
    const bucket = `${key}:${windowStart}`;
    await ensureRateLimitTable();
    const result = await prisma.rateHit.upsert({
      where: { bucket },
      create: { bucket, windowStart: BigInt(windowStart), count: 1 },
      update: { count: { increment: 1 } },
    });
    const ok = result.count <= limit;
    const retryAfter = ok
      ? 0
      : (windowStart + 1) * windowSec - Math.floor(Date.now() / 1000);
    return { ok, retryAfter };
  } catch (e) {
    console.error("rateLimit error (failing open)", e);
    return { ok: true, retryAfter: 0 };
  }
}

// Route helper: returns a ready-to-return 429 when the caller is over the limit,
// or null to continue. Call AFTER resolving the caller's identity and BEFORE any
// expensive work (DB-heavy queries, AI calls).
export async function enforceRateLimit(
  key: string,
  limit: number,
  windowSec: number
): Promise<NextResponse | null> {
  const { ok, retryAfter } = await rateLimit(key, limit, windowSec);
  if (ok) return null;
  return NextResponse.json(
    { error: "Too many requests. Please slow down and try again shortly." },
    { status: 429, headers: { "Retry-After": String(retryAfter) } }
  );
}
