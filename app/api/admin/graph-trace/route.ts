import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { graphInputFromSnapshot, buildCreditGraph, reason, validateReasoningTrace } from "@/lib/intelligence";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Read-only ADMIN proof surface for the graphInputFromSnapshot loader (the Phase C
// cross-cutting prerequisite). It is the single representative consumer that
// proves the loader projects a REAL case into the Unified Credit Graph and yields
// a validated per-item evidence trace — without touching the live alpha journey.
//
// Fail-closed by construction:
//   • OFF by default — returns 404 unless KAI_GRAPH_LOADER === "true", so the
//     surface does not exist in production and no user journey changes.
//   • ADMIN-only — requireAdmin() resolves the REAL session admin (never an
//     impersonated user); non-admins get 403.
//   • Tenant-safe — reads the signed-in admin's OWN case (admin.id), never a
//     query-param userId, so there is no cross-tenant read and no id/PII in the URL.
//   • No-hallucination law — if validateReasoningTrace finds ANY error, the trace
//     is withheld and the errors are returned instead; an invalid trace is never shown.
// Deterministic, read-only, no LLM. Does not activate Phase C globally and does
// not touch MAIL_LIVE or KERNEL_DURABLE.
export async function GET() {
  if (process.env.KAI_GRAPH_LOADER !== "true") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const graphInput = await graphInputFromSnapshot(admin.id); // own tenant only
  const graph = buildCreditGraph(graphInput);
  const trace = reason(graph);
  const errors = validateReasoningTrace(trace, graph);
  if (errors.length) {
    // Fail closed: never render a trace the validator rejects.
    return NextResponse.json({ ok: false, valid: false, errors });
  }
  return NextResponse.json({
    ok: true,
    valid: true,
    userId: admin.id,
    graph: { nodes: graph.nodes.length, edges: graph.edges.length },
    findings: trace.findings,
    recommendations: trace.recommendations,
  });
}
