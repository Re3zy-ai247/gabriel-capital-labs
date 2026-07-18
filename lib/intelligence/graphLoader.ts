// graphInputFromSnapshot — the DB-case → GraphInput loader (Phase C prerequisite).
// ─────────────────────────────────────────────────────────────────────────────
// The single cross-cutting build the roadmap names as highest-leverage: it
// projects a user's PERSISTED case into the Unified Credit Graph input shape so
// Kai can reason over the real record (evidence strength, Decision-Card
// citations, Case Presence) instead of a synthetic fixture. The pure projection
// lives in ./graphProject (no I/O, unit-testable); this module is only the
// tenant-safe database read that feeds it.
//
// AUTHORITY: introduces NO new concept — a loader for the already-ratified
// Unified Credit Graph (graph.ts, Phase C / ADR-0019). Reuse-first: it reads the
// same Prisma models loadSnapshot reads; adds no second graph model, no engine.
import { prisma } from "@/lib/prisma";
import { projectGraphInput } from "./graphProject";
import type { GraphInput } from "./graph";

/**
 * Server-side, tenant-safe loader. Reads ONLY the given user's rows
 * (`where: { userId }`) from the same Prisma models loadSnapshot uses, then runs
 * the pure projection. Fail-closed: refuses an empty userId so a missing caller
 * identity can never become an unscoped read. Deterministic given (DB state,
 * asOf); asOf defaults to the boundary clock and may be pinned by callers/tests.
 */
export async function graphInputFromSnapshot(userId: string, opts?: { asOf?: Date }): Promise<GraphInput> {
  if (!userId) throw new Error("graphInputFromSnapshot: userId is required (fail-closed; no unscoped read)");
  const [tradelines, letters] = await Promise.all([
    prisma.tradeline.findMany({
      where: { userId },
      orderBy: { id: "asc" },
      select: { id: true, creditorName: true, accountType: true, isDebtBuyer: true, balance: true, probability: true, bureauData: true, dateReported: true, dateOpened: true },
    }),
    prisma.letter.findMany({
      where: { userId },
      orderBy: { id: "asc" },
      select: { id: true, tradelineId: true, recipientName: true, recipientType: true, targetBureau: true, round: true, status: true, mailedAt: true, responseAt: true, responseOutcome: true },
    }),
  ]);
  return projectGraphInput({ userId, tradelines, letters }, opts?.asOf ?? new Date());
}
