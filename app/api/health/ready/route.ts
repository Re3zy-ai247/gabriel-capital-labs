import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { docCryptoReady } from "@/lib/docCrypto";

export const dynamic = "force-dynamic";

// Tables this release HARD-depends on and which are created ONLY by a reviewed
// migration — never by runtime self-heal (migration-first law, CLAUDE.md gotcha
// 1). If a deployment lands before `prisma migrate deploy` has been run against
// its database, POST /api/register throws with no try/catch: no consumer can
// create an account. That is the single worst failure this probe can be asked to
// notice, and until now it could not notice it at all.
const REQUIRED_TABLES = ["TermsAcceptance", "ConsumerAssertion"] as const;

// Readiness (RC1 P0-2): can we serve real traffic? Not "is the process up" and
// not "is the connection open" — is every dependency present whose absence takes
// a core consumer flow down 100% of the time? Returns 503 on failure so an uptime
// monitor, a load balancer, and scripts/release-verify.sh can all refuse a
// promotion. Never leaks error internals, never echoes a value — each dependency
// is reported as usable or not.
//
// S11 · MEDIUM_BLOCKING-1 and X-1/X-6: this probe used to answer
// {"status":"ready","db":"ok"} on a deployment where every report upload was
// guaranteed to fail (DOCUMENT_ENCRYPTION_KEY absent) and on one where no account
// could be created (migrations not applied). A readiness probe that cannot go red
// for the dependencies that take the product down is not a readiness probe; it is
// a liveness probe wearing the wrong name, and it converts a loud outage into a
// silent one.
// The database half of this probe is cached briefly (S11 · lens-B LOW). The route
// is deliberately unauthenticated — an uptime monitor and a load balancer must be
// able to reach it — which also means anyone can, and every request was issuing a
// database round-trip. A short memo makes a flood cost at most one query per
// process per window while staying far below any monitor's interval, and it caches
// failures too, which is the case where the database can least afford extra load.
// The environment half (encryption) is a pure in-process check with no I/O, so it
// stays live and recovers the instant the variable is fixed.
//
// Next.js route modules may only export the recognised handler names, so the
// window is tuned through the environment rather than a test seam:
// HEALTH_READY_DB_TTL_MS, default 5 s, and 0 disables caching entirely.
type DbProbe = { db: "ok" | "unreachable"; missingTables: string[] };
let dbProbeCache: { at: number; result: DbProbe } | null = null;

function dbProbeTtlMs(): number {
  const raw = Number.parseInt(process.env.HEALTH_READY_DB_TTL_MS || "", 10);
  if (!Number.isFinite(raw) || raw < 0) return 5_000;
  return Math.min(raw, 60_000);
}

async function probeDatabase(): Promise<DbProbe> {
  const now = Date.now();
  const ttl = dbProbeTtlMs();
  if (ttl > 0 && dbProbeCache && now - dbProbeCache.at < ttl) return dbProbeCache.result;
  const result = await runDatabaseProbe();
  dbProbeCache = { at: now, result };
  return result;
}

async function runDatabaseProbe(): Promise<DbProbe> {
  let db: "ok" | "unreachable" = "unreachable";
  let missingTables: string[] = [];
  try {
    // to_regclass returns NULL for a relation that does not exist instead of
    // throwing, so one round-trip answers the connection AND the schema.
    const rows = await prisma.$queryRaw<Array<Record<string, string | null>>>`
      SELECT to_regclass('"TermsAcceptance"')::text AS terms,
             to_regclass('"ConsumerAssertion"')::text AS assertion
    `;
    db = "ok";
    const row = rows?.[0] ?? {};
    const present = new Set(
      Object.values(row)
        .filter((v): v is string => typeof v === "string" && v.length > 0)
        .map((v) => v.replace(/^public\./, "").replace(/"/g, ""))
    );
    missingTables = REQUIRED_TABLES.filter((t) => !present.has(t));
  } catch {
    db = "unreachable";
  }
  return { db, missingTables };
}

export async function GET() {
  const encryption = docCryptoReady();
  const { db, missingTables } = await probeDatabase();

  const schema = db === "ok" && missingTables.length === 0 ? "ok" : "incomplete";
  const ready = db === "ok" && encryption && schema === "ok";

  const body = {
    status: ready ? "ready" : "degraded",
    db,
    encryption: encryption ? "ok" : "unavailable",
    schema,
    // Names only — a table name is not a secret, and an operator staring at a
    // failed promotion needs to know WHICH migration was skipped.
    ...(missingTables.length > 0 ? { missingTables } : {}),
  };
  return ready ? NextResponse.json(body) : NextResponse.json(body, { status: 503 });
}
