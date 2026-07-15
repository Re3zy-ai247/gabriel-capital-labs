import { NextResponse } from "next/server";
import { currentUserOrDemo } from "@/lib/session";
import { financialGraph } from "@/lib/knowledge";

export const dynamic = "force-dynamic";

// The Knowledge Graph API (Sprint XIX, ADR-0019) — the deterministic relationship
// graph over the user's own records. Scoped to the signed-in user.
export async function GET() {
  const user = await currentUserOrDemo();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const knowledge = await financialGraph(user.id);
  return NextResponse.json({ knowledge });
}
