import { NextResponse } from "next/server";
import { currentUserOrDemo } from "@/lib/session";
import { financialMission } from "@/lib/missionEngine";

export const dynamic = "force-dynamic";

// The Financial Mission Engine API (Sprint XVI, ADR-0016) — the prioritized
// mission queue every future module consumes. Scoped to the signed-in user.
export async function GET() {
  const user = await currentUserOrDemo();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const mission = await financialMission(user.id, user);
  return NextResponse.json({ mission });
}
