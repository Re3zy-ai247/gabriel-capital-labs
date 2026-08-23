// Adopted from the p0 score-intelligence lane: 96da6d1 ("fix: make Score Tracker
// explicitly self-reported") for the stable-ordering + self-reported shape, and
// 2d2e3e5 ("fix(scores): restore authenticated preview history") for the
// server-side future-date rejection.
//
// REQUIRED ADAPTATION (RC1): the p0 lane resolved the user via
// `currentScoreEntryUserId()`, a function added to lib/session.ts by a rejected
// preview-auth commit that does not exist on this base and is out of this
// slice's owned paths. This route keeps the base's own `currentUserOrDemo()` —
// unchanged from the pre-adoption version of this same file, and the identical
// resolver app/api/tradelines/route.ts already uses — so user resolution is
// zero-risk here and every read/write stays scoped to `userId: user.id`.
import { NextResponse } from "next/server";
import type { Bureau } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { currentUserOrDemo } from "@/lib/session";
import { isFutureLocalDate } from "@/lib/selfReportedScores";

export const dynamic = "force-dynamic";

const VALID_BUREAUS: Bureau[] = ["EQUIFAX", "EXPERIAN", "TRANSUNION"];

export async function GET() {
  const user = await currentUserOrDemo();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const entries = await prisma.scoreEntry.findMany({
    where: { userId: user.id },
    // recordedAt is day-granular in the UI. Stable tie-breaks (createdAt, then
    // id) prevent the displayed first-to-latest direction — and therefore the
    // "+N since <month>" delta and its color — from flipping after a reload.
    orderBy: [{ recordedAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
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
  // Server-side mirror of the client's `max={today}` — the client bound alone
  // is only a UI nicety; a direct POST (or a client bug) must still be refused.
  //
  // M-1 remediation: comparing recordedAt's UTC-midnight parse against the
  // server's own Date.now() rejected the visitor's OWN today whenever their
  // local time is ahead of UTC (Berlin 00:00-02:00, Kolkata 00:00-05:30,
  // Sydney 00:00-10:00) — a regression vs. base, which had no future check
  // at all. isFutureLocalDate compares calendar dates in the SUBMITTER's own
  // frame when the client sends its date-only string plus its own
  // timezoneOffset (see app/scores/page.tsx), and fails closed to this exact
  // original instant-vs-instant check for every other input shape.
  if (isFutureLocalDate(body?.recordedAt, recordedAt.getTime(), body?.timezoneOffset, Date.now())) {
    return NextResponse.json({ error: "Date recorded cannot be in the future." }, { status: 400 });
  }

  const entry = await prisma.scoreEntry.create({
    data: { userId: user.id, bureau: bureau as Bureau, score: Math.round(score), recordedAt },
  });
  return NextResponse.json({ ok: true, entry });
}
