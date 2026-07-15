// Roadmap API — loads CVI + Mission Control once and sequences. On the dashboard
// we call buildRoadmap() directly with the already-loaded intel/mission/mc (no
// reload); this is for standalone/external consumers.
import { creditIntelligence } from "@/lib/intelligence";
import { getMissionControl } from "@/lib/missionControl";
import { assembleMissions } from "@/lib/missionEngine";
import { buildRoadmap } from "./engine";
import type { FinancialRoadmap } from "./types";

export async function financialRoadmap(
  userId: string, user: { fullName?: string | null; name?: string | null },
): Promise<FinancialRoadmap> {
  const [intel, mc] = await Promise.all([creditIntelligence(userId), getMissionControl(userId, user)]);
  return buildRoadmap(intel, assembleMissions(intel, mc), mc);
}
