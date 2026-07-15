import { NextResponse } from "next/server";
import { currentUserOrDemo } from "@/lib/session";
import { executionEngine } from "@/lib/execution";

export const dynamic = "force-dynamic";

// The Execution Engine API (Sprint XX, ADR-0020) — the deterministic Executive
// Queue: what to do now, what's waiting, what's blocked, what's optional, what's
// done. Pure orchestration over the existing engines; scoped to the signed-in user.
export async function GET() {
  const user = await currentUserOrDemo();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const execution = await executionEngine(user.id, user);
  return NextResponse.json({ execution });
}
