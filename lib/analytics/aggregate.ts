// Analytics aggregation layer (Platform Phase B, Sprint 6).
// ─────────────────────────────────────────────────────────────────────────────
// Read models over the EXISTING ProductEvent sink (lib/events.ts) — no new
// pipeline, no third-party tool, no fake charts. Pure aggregation functions
// (unit-testable, deterministic) + one query service used by the admin API.
// Everything here is internal/ADMIN-only; nothing renders to customers.
import { prisma } from "@/lib/prisma";

export interface EventCount { name: string; count: number }
export interface FunnelStep { name: string; users: number }
export interface AdoptionRow { feature: string; users: number; events: number }

interface EventRow { name: string; userId: string | null; meta: unknown; createdAt: Date }

// ── Pure aggregations (rows in → read models out; no I/O) ────────────────────
export function countByName(rows: Array<Pick<EventRow, "name">>): EventCount[] {
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.name, (m.get(r.name) ?? 0) + 1);
  // Deterministic tiebreaker (code-unit name order) — replay-stable output.
  return [...m.entries()].map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

/** Distinct users reaching each named step, in the given order (a funnel read model). */
export function funnel(rows: Array<Pick<EventRow, "name" | "userId">>, steps: string[]): FunnelStep[] {
  const usersByStep = new Map<string, Set<string>>(steps.map((s) => [s, new Set<string>()]));
  for (const r of rows) {
    if (r.userId && usersByStep.has(r.name)) usersByStep.get(r.name)!.add(r.userId);
  }
  return steps.map((name) => ({ name, users: usersByStep.get(name)!.size }));
}

/** feature_adopted events → per-feature distinct users + totals. */
export function adoption(rows: Array<Pick<EventRow, "name" | "userId" | "meta">>): AdoptionRow[] {
  const users = new Map<string, Set<string>>();
  const events = new Map<string, number>();
  for (const r of rows) {
    if (r.name !== "feature_adopted") continue;
    const feature = typeof (r.meta as Record<string, unknown> | null)?.feature === "string"
      ? ((r.meta as Record<string, unknown>).feature as string) : "unknown";
    events.set(feature, (events.get(feature) ?? 0) + 1);
    if (r.userId) {
      if (!users.has(feature)) users.set(feature, new Set());
      users.get(feature)!.add(r.userId);
    }
  }
  return [...events.keys()].map((feature) => ({
    feature, users: users.get(feature)?.size ?? 0, events: events.get(feature) ?? 0,
  })).sort((a, b) => b.users - a.users || b.events - a.events || (a.feature < b.feature ? -1 : a.feature > b.feature ? 1 : 0));
}

// ── Query service (the only I/O; consumed by /api/admin/analytics) ──────────
export const ALPHA_FUNNEL_STEPS = [
  "onboarding_started", "onboarding_completed", "report_uploaded",
  "strategy_generated", "dispute_created", "subscription_completed",
] as const;

export async function analyticsWindow(days: number, now: number = Date.now()): Promise<{
  windowDays: number;
  totals: EventCount[];
  alphaFunnel: FunnelStep[];
  featureAdoption: AdoptionRow[];
  instrumented: boolean;
  available: boolean; // false = a REAL DB failure (distinct from not-yet-instrumented)
}> {
  const since = new Date(now - days * 24 * 60 * 60 * 1000);
  let rows: EventRow[] = [];
  try {
    rows = await prisma.$queryRawUnsafe<EventRow[]>(
      `SELECT "name","userId","meta","createdAt" FROM "ProductEvent" WHERE "createdAt" >= $1 ORDER BY "createdAt", "id"`,
      since
    );
  } catch (e) {
    // Distinguish "table not yet created" (honest zero-state: instrumented:false)
    // from a real DB failure (available:false) — a failure is never presented as
    // a zero-state (dashboard honesty law).
    const msg = e instanceof Error ? e.message : String(e);
    const tableMissing = /does not exist|42P01/i.test(msg);
    return { windowDays: days, totals: [], alphaFunnel: [], featureAdoption: [], instrumented: false, available: tableMissing };
  }
  return {
    windowDays: days,
    totals: countByName(rows),
    alphaFunnel: funnel(rows, [...ALPHA_FUNNEL_STEPS]),
    featureAdoption: adoption(rows),
    instrumented: true,
    available: true,
  };
}
