import { NextResponse } from "next/server";
import { currentUserOrDemo } from "@/lib/session";
import { creditIntelligence } from "@/lib/intelligence";

export const dynamic = "force-dynamic";

// The internal Credit Intelligence Platform API (Sprint XV, ADR-0015). One
// deterministic answer for every future module. Scoped to the signed-in user.
export async function GET() {
  const user = await currentUserOrDemo();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const intelligence = await creditIntelligence(user.id);
  return NextResponse.json({ intelligence });
}
