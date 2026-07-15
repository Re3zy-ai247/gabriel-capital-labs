// CreditVector Execution Engine — public surface (Sprint XX, ADR-0020). Pure
// orchestration over the existing engines; no new intelligence, no new query, no AI.
// On the dashboard we call assembleExecution() directly with the already-loaded
// intel/mission/roadmap/builder/knowledge/mc/snap (no reload). `executionEngine` is
// the thin standalone loader for the API — it REUSES the existing loaders only and
// adds ZERO new database calls.
import { loadSnapshot, assembleIntelligence } from "@/lib/intelligence";
import { getMissionControl } from "@/lib/missionControl";
import { assembleMissions } from "@/lib/missionEngine";
import { buildRoadmap } from "@/lib/roadmap";
import { buildBuilder } from "@/lib/builder";
import { financialGraph } from "@/lib/knowledge";
import { assembleExecution, type ExecutionResult } from "./ExecutionEngine";

export * from "./ExecutionEngine";
export { LADDER, type LadderKey, type ExecutionPriority } from "./ExecutionPriority";
export { BUCKETS, bucketOf, type ExecutionBucket } from "./ExecutionQueue";

export async function executionEngine(
  userId: string,
  user: { fullName?: string | null; name?: string | null },
): Promise<ExecutionResult> {
  // The exact single-load the dashboard uses — existing loaders only, in parallel.
  const [mc, snap, knowledge] = await Promise.all([
    getMissionControl(userId, user),
    loadSnapshot(userId),
    financialGraph(userId),
  ]);
  const intel = assembleIntelligence(snap);
  const mission = assembleMissions(intel, mc);
  const roadmap = buildRoadmap(intel, mission, mc);
  const builder = buildBuilder(snap, intel);
  return assembleExecution({ intel, mission, roadmap, builder, knowledge, mc, snap });
}
