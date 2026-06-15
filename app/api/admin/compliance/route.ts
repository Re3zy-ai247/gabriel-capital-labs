import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { applyCompliance, COMPLIANCE_RULES, DISCLAIMER } from "@/lib/compliance";

export const dynamic = "force-dynamic";

// GET: recent generated letters, each re-scanned against the prohibited-phrase
// rules so an admin can audit what's going out the door. `flagged` means the
// stored body still trips a rule (it shouldn't — letters are scrubbed at
// generation — so any flag is worth a look).
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const letters = await prisma.letter.findMany({
    orderBy: { createdAt: "desc" },
    take: 40,
    select: {
      id: true, body: true, strategy: true, recipientType: true, recipientName: true,
      status: true, round: true, complianceFlags: true, createdAt: true,
      user: { select: { email: true } },
    },
  });

  const items = letters.map((l) => {
    const rescan = applyCompliance(l.body);
    return {
      id: l.id,
      userEmail: l.user.email,
      strategy: l.strategy,
      recipientType: l.recipientType,
      recipientName: l.recipientName,
      status: l.status,
      round: l.round,
      createdAt: l.createdAt,
      storedFlags: l.complianceFlags,
      rescanFlags: rescan.flags,
      flagged: rescan.flags.length > 0,
      body: l.body,
    };
  });

  return NextResponse.json({
    letters: items,
    flaggedCount: items.filter((i) => i.flagged).length,
    rules: COMPLIANCE_RULES,
    disclaimer: DISCLAIMER,
  });
}
