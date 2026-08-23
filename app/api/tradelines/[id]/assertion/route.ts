import { NextResponse } from "next/server";
import type { Bureau } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { currentUserOrDemo } from "@/lib/session";
import { enforceRateLimit } from "@/lib/rateLimit";
import {
  ASSERTION_CHOICE_BY_TYPE,
  CONSUMER_NOTE_MAX,
  isConsumerAssertionType,
  normalizeConsumerNote,
} from "@/lib/letter";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// RC1-S4 — the consumer's own record of WHICH fact on one of their tradelines is
// wrong. This is the only writer of ConsumerAssertion, and it is the only thing
// in the product that may create one: no parser, no scorer, no AI, and no
// recommendation writes here. `lib/recommend.ts` may SUGGEST which facts are
// worth checking; only a POST from the account owner asserts one.
//
// APPEND-ORIENTED. POST appends an ACTIVE row. DELETE does not delete: it flips
// status to WITHDRAWN and stamps withdrawnAt, so the history of what the
// consumer confirmed — and when they took it back — survives the letters that
// were composed from it.
//
// FREE. There is no entitlement check anywhere in this file, deliberately.
// Confirming a fact about your own credit report is not a feature to be sold.

const VALID_BUREAUS: Bureau[] = ["EQUIFAX", "EXPERIAN", "TRANSUNION"];

/** The tradeline, but only if it belongs to the caller. Returns null otherwise —
 *  the caller answers 404 either way, so a foreign id is indistinguishable from
 *  a nonexistent one and the route leaks no other user's tradeline ids. */
async function ownTradeline(userId: string, tradelineId: string) {
  if (!tradelineId) return null;
  return prisma.tradeline.findFirst({
    where: { id: tradelineId, userId },
    select: { id: true, creditorName: true },
  });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await currentUserOrDemo();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const limited = await enforceRateLimit(`assertion:${user.id}`, 120, 3600);
  if (limited) return limited;

  const tradeline = await ownTradeline(user.id, params.id);
  if (!tradeline) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const assertionType = (body as { assertionType?: unknown }).assertionType;
  if (!isConsumerAssertionType(assertionType)) {
    return NextResponse.json(
      { error: "Choose which fact about this account is wrong." },
      { status: 400 }
    );
  }

  const rawNote = (body as { consumerNote?: unknown }).consumerNote;
  if (rawNote != null && typeof rawNote !== "string") {
    return NextResponse.json({ error: "Your note must be text." }, { status: 400 });
  }
  // Normalized WITHOUT the composer's cap, so an over-length note is REFUSED
  // here rather than silently cut in half — truncating a consumer's statement of
  // fact changes what they said in a letter they will sign.
  const note = normalizeConsumerNote(typeof rawNote === "string" ? rawNote : null);
  if (note.length > CONSUMER_NOTE_MAX) {
    return NextResponse.json(
      { error: `Please keep your note to ${CONSUMER_NOTE_MAX} characters or fewer, so it fits in the letter exactly as you wrote it.` },
      { status: 400 }
    );
  }
  // "Something else is wrong" says nothing on its own — the letter would have no
  // fact to carry. Every other choice carries its own meaning.
  if (ASSERTION_CHOICE_BY_TYPE[assertionType].requiresNote && !note) {
    return NextResponse.json(
      { error: "Describe in your own words what is wrong with this account." },
      { status: 400 }
    );
  }

  const rawScope = (body as { bureauScope?: unknown }).bureauScope;
  if (rawScope != null && !(typeof rawScope === "string" && VALID_BUREAUS.includes(rawScope as Bureau))) {
    return NextResponse.json({ error: "Unrecognized bureau." }, { status: 400 });
  }
  const bureauScope = (rawScope as Bureau | null | undefined) ?? null;

  const assertion = await prisma.consumerAssertion.create({
    data: {
      userId: user.id,
      tradelineId: tradeline.id,
      assertionType,
      consumerNote: note || null,
      bureauScope,
      status: "ACTIVE",
    },
  });

  // NOTE: no KaiEvent is recorded here. `KaiEventType` (lib/kaiEvents.ts) is a
  // closed union owned by another slice, and an assertion has no member in it;
  // inventing one would mean editing a file this slice does not own. The
  // ConsumerAssertion row is itself the durable, timestamped record of the act.

  return NextResponse.json({ ok: true, assertion }, { status: 201 });
}

// Withdraw one assertion. `assertionId` comes from the query string or the body,
// and must belong to BOTH this user and this tradeline — checking the pair is
// what stops a valid id of the caller's own from being used against someone
// else's tradeline, and vice versa.
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const user = await currentUserOrDemo();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const limited = await enforceRateLimit(`assertion:${user.id}`, 120, 3600);
  if (limited) return limited;

  const tradeline = await ownTradeline(user.id, params.id);
  if (!tradeline) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  const url = new URL(req.url);
  const fromQuery = url.searchParams.get("assertionId");
  const body = fromQuery ? {} : await req.json().catch(() => ({} as Record<string, unknown>));
  const assertionId = fromQuery ?? (body as { assertionId?: unknown }).assertionId;
  if (typeof assertionId !== "string" || !assertionId) {
    return NextResponse.json({ error: "Which confirmation do you want to withdraw?" }, { status: 400 });
  }

  const existing = await prisma.consumerAssertion.findFirst({
    where: { id: assertionId, userId: user.id, tradelineId: tradeline.id },
    select: { id: true, status: true },
  });
  if (!existing) return NextResponse.json({ error: "Confirmation not found" }, { status: 404 });
  // Idempotent: withdrawing an already-withdrawn row is a no-op success, and
  // never re-stamps withdrawnAt with a later time than the consumer's own act.
  if (existing.status === "WITHDRAWN") return NextResponse.json({ ok: true, alreadyWithdrawn: true });

  const assertion = await prisma.consumerAssertion.update({
    where: { id: existing.id },
    data: { status: "WITHDRAWN", withdrawnAt: new Date() },
  });

  // (No KaiEvent — see the note in POST. `withdrawnAt` on the row is the record.)

  return NextResponse.json({ ok: true, assertion });
}
