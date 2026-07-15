import { NextResponse } from "next/server";
import { currentUserOrDemo } from "@/lib/session";
import { builderOS } from "@/lib/builder";

export const dynamic = "force-dynamic";

// The Credit Builder OS API (Sprint XVIII, ADR-0018) — deterministic, cited
// builder recommendations. Scoped to the signed-in user.
export async function GET() {
  const user = await currentUserOrDemo();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const builder = await builderOS(user.id);
  return NextResponse.json({ builder });
}
