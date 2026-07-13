import { NextResponse } from "next/server";
import { currentUserOrDemo } from "@/lib/session";
import { getKaiHomeData } from "@/lib/kaiHome";

export const dynamic = "force-dynamic";

// Lightweight context for the floating Kai presence: the same passive
// intelligence Kai Home renders, trimmed to what the pill needs. No AI calls.
export async function GET() {
  const user = await currentUserOrDemo();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const kai = await getKaiHomeData(user.id);
  const nextDeadline = kai.deadlines[0] ?? null;
  return NextResponse.json({
    recommendation: kai.recommendation
      ? { title: kai.recommendation.title, cta: kai.recommendation.cta, href: kai.recommendation.href, basis: kai.recommendation.basis }
      : null,
    deadline: nextDeadline
      ? { recipient: nextDeadline.recipient, daysLeft: nextDeadline.daysLeft }
      : null,
    overnightCount: kai.overnight.length,
  });
}
