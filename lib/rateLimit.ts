import { NextResponse } from "next/server";
import { prisma } from "./prisma";

// DB-backed fixed-window rate limiter. Vercel serverless + Prisma Accelerate means
// in-memory counters don't survive across instances, so each (key, window) pair is
// one row whose count is atomically incremented per request. Counting is
// approximate (a race can let a few extra requests through near the boundary), which
// is fine for abuse mitigation.
//
// P0-10 (E-07) — THIS LIMITER NOW FAILS CLOSED. It used to return `{ ok: true }`
// on any error, by explicit design, so that "a transient fault can never lock out
// legit users". Under a free consumer model that reasoning inverts: this is the
// only control in front of paid AI spend on every AI route, it is backed by the
// same Postgres those routes use, and so ONE database blip removed every AI quota
// in the product simultaneously — precisely when the product was least able to
// absorb the bill. The availability argument also does not survive inspection:
// every caller needs that same database for its own work, so a limiter fault is
// never the difference between a working request and a denied one; it is only the
// difference between a denial and an unmetered one.
//
// Callers distinguish the two denials: `reason: "over-limit"` is the consumer
// genuinely going too fast, `reason: "unavailable"` is our fault and says so.

// Self-heal: the RateHit table creates itself at runtime. CREATE TABLE IF NOT EXISTS
// via raw SQL works through the Accelerate proxy even though build-time
// `prisma db push` does not — mirrors ensureCommunityTables / ensureAttachmentTable.
// Single-flight (S11 · MEDIUM-5). `CREATE ... IF NOT EXISTS` is NOT concurrency
// safe in Postgres: two statements can both pass the existence check and one then
// fails on the pg_type unique index (P2010, "Key (typname, typnamespace) already
// exists"). The old `let ready = false` flag was only set AFTER the await, so a
// burst of concurrent first requests all issued the DDL and raced. Memoising the
// PROMISE means concurrent callers await the same statement; a failure clears it
// so the next caller retries rather than inheriting a poisoned "ready".
let tableReady: Promise<void> | null = null;
export async function ensureRateLimitTable(): Promise<void> {
  if (!tableReady) {
    tableReady = createRateLimitTable().catch((e) => {
      tableReady = null;
      throw e;
    });
  }
  return tableReady;
}
async function createRateLimitTable(): Promise<void> {
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
}

// Best-effort client IP from the proxy chain: the first hop of x-forwarded-for is
// the original client (Vercel sets this). Falls back to "unknown" so a missing
// header buckets everyone together rather than throwing.
export function clientIp(req: Request): string {
  // Prefer the platform-set x-real-ip (Vercel populates it at the edge) — it is NOT
  // client-controllable. The leftmost x-forwarded-for hop IS attacker-supplied, so relying on it
  // lets a spoofed header land each request in a fresh rate-limit bucket (auth brute-force bypass).
  const real = req.headers.get("x-real-ip");
  if (real && real.trim()) return real.trim();
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return "unknown";
}

export type RateLimitResult = {
  ok: boolean;
  retryAfter: number;
  /** Present only on a denial. "unavailable" = the limiter itself failed. */
  reason?: "over-limit" | "unavailable";
};

// Seconds a caller is asked to wait when the limiter backend is unavailable.
// Short: the fault is ours, and the caller should be able to retry as soon as it
// clears rather than serve out a punitive window.
const UNAVAILABLE_RETRY_AFTER_SEC = 5;

// Increment the counter for `key` within the current fixed window and report
// whether the caller is still under `limit`. retryAfter is the seconds until the
// current window rolls over (0 when allowed). Never throws — a limiter failure is
// reported as a DENIAL (`ok: false`, `reason: "unavailable"`), never as success.
export async function rateLimit(
  key: string,
  limit: number,
  windowSec: number
): Promise<RateLimitResult> {
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
    if (ok) return { ok: true, retryAfter: 0 };
    return {
      ok: false,
      retryAfter: (windowStart + 1) * windowSec - Math.floor(Date.now() / 1000),
      reason: "over-limit",
    };
  } catch (e) {
    console.error("rateLimit error (failing closed)", e);
    return { ok: false, retryAfter: UNAVAILABLE_RETRY_AFTER_SEC, reason: "unavailable" };
  }
}

// Route helper: returns a ready-to-return denial when the caller may not proceed,
// or null to continue. Call AFTER resolving the caller's identity and BEFORE any
// expensive work (DB-heavy queries, AI calls).
//
// Two denials, two truths: 429 means the consumer really did go too fast; 503
// means our limiter is down and we refused rather than run unmetered. Saying
// "too many requests" in the second case would blame the consumer for our fault.
export async function enforceRateLimit(
  key: string,
  limit: number,
  windowSec: number
): Promise<NextResponse | null> {
  const { ok, retryAfter, reason } = await rateLimit(key, limit, windowSec);
  if (ok) return null;
  if (reason === "unavailable") {
    return NextResponse.json(
      { error: "We can't process that right now — a service we depend on isn't responding. Please try again in a moment." },
      { status: 503, headers: { "Retry-After": String(retryAfter) } }
    );
  }
  return NextResponse.json(
    { error: "Too many requests. Please slow down and try again shortly." },
    { status: 429, headers: { "Retry-After": String(retryAfter) } }
  );
}
