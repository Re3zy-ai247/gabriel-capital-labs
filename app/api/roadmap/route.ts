import { NextResponse } from "next/server";
import { currentUserOrDemo } from "@/lib/session";
import { financialRoadmap } from "@/lib/roadmap";

export const dynamic = "force-dynamic";

// The Financial Roadmap Engine API (Sprint XVII, ADR-0017) — the deterministic
// credit-journey roadmap. Scoped to the signed-in user.
export async function GET() {
  const user = await currentUserOrDemo();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const roadmap = await financialRoadmap(user.id, user);
  return NextResponse.json({ roadmap });
}
