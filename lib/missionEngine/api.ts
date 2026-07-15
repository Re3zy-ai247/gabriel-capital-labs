// Mission Engine API — loads CVI + Mission Control once and ranks. Future modules
// (Credit Builder, Funding Hub, Business Credit, Monitoring, Mobile, the public
// API) call THIS to get the user's prioritized mission queue. On the dashboard we
// call assembleMissions() directly with the already-loaded intel + mc (no reload).
import { creditIntelligence } from "@/lib/intelligence";
import { getMissionControl } from "@/lib/missionControl";
import { assembleMissions } from "./engine";
import type { FinancialMission } from "./types";

export async function financialMission(
  userId: string, user: { fullName?: string | null; name?: string | null },
): Promise<FinancialMission> {
  const [intel, mc] = await Promise.all([creditIntelligence(userId), getMissionControl(userId, user)]);
  return assembleMissions(intel, mc);
}
