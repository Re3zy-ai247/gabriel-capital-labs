import { NextResponse } from "next/server";
import type { Bureau } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { currentUserOrDemo } from "@/lib/session";

export const dynamic = "force-dynamic";

const VALID_BUREAUS: Bureau[] = ["EQUIFAX", "EXPERIAN", "TRANSUNION"];

export async function GET() {
  const user = await currentUserOrDemo();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const entries = await prisma.scoreEntry.findMany({
    where: { userId: user.id },
    orderBy: { recordedAt: "asc" },
  });
  return NextResponse.json({ entries });
}

export async function POST(req: Request) {
  const user = await currentUserOrDemo();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const bureau = String(body?.bureau || "").toUpperCase();
  const score = Number(body?.score);
  if (!VALID_BUREAUS.includes(bureau as Bureau)) {
    return NextResponse.json({ error: "Pick a bureau." }, { status: 400 });
  }
  if (!Number.isFinite(score) || score < 300 || score > 850) {
    return NextResponse.json({ error: "Score must be between 300 and 850." }, { status: 400 });
  }
  const recordedAt = body?.recordedAt ? new Date(body.recordedAt) : new Date();
  if (isNaN(recordedAt.getTime())) {
    return NextResponse.json({ error: "Invalid date." }, { status: 400 });
  }

  const entry = await prisma.scoreEntry.create({
    data: { userId: user.id, bureau: bureau as Bureau, score: Math.round(score), recordedAt },
  });
  return NextResponse.json({ ok: true, entry });
}
