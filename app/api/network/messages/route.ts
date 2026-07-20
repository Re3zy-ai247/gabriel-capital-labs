import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { currentAccount } from "@/lib/session";
import { cleanText, LIMITS, screenCommunityText, communityDisplayName } from "@/lib/community";
import { enforceRateLimit } from "@/lib/rateLimit";
import { operatorNetworkAccessible } from "@/lib/network/cohort";
import { canViewChannel, canPostChannel, type NetworkAccount } from "@/lib/network/authz";
import { channelForCategory, channelAudienceId, KNOWN_CHANNEL_KEYS } from "@/lib/network/channels";

// Operator Network message layer — the FIRST migration-backed feature (tables
// NetworkMessage + NetworkMessageReadState ship as a reviewed Prisma migration,
// never runtime self-heal). Realtime is cursor-polling, not websockets: serverless
// has no persistent socket, so the client GETs new messages since a cursor.
//
// Two independent gates, both fail-closed, both server-side:
//   1. operatorNetworkAccessible — may this account reach the network at all
//      (flag ON + internal cohort). UI never substitutes for this.
//   2. canView/canPostChannel — may this account see/post in THIS channel
//      (membership + tenant isolation). audienceAgencyId is the row-level backstop.
// Identity is currentAccount() (the real signed-in account), NEVER currentUser():
// an agency posts AS itself, so it can never post into the network as a client it
// has opened, nor farm a client's identity.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 10;

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;

// Shape returned to the client. authorId is DELIBERATELY OMITTED — the raw author
// id is never exposed; ownership is pre-resolved server-side into `isOwn`.
function shape(
  m: { id: string; channelKey: string; authorName: string; body: string; isKai: boolean; authorId: string | null; createdAt: Date },
  viewerId: string,
) {
  return {
    id: m.id,
    channel: m.channelKey,
    authorName: m.authorName,
    body: m.body,
    isKai: m.isKai,
    isOwn: m.authorId != null && m.authorId === viewerId,
    createdAt: m.createdAt.toISOString(),
  };
}

// Resolve+authorize a channel key for the given account and verb. Returns the
// Channel value object on success, or a ready NextResponse (403/400) to return.
function resolveChannel(rawChannel: unknown, account: NetworkAccount, verb: "view" | "post") {
  const key = typeof rawChannel === "string" ? rawChannel : "";
  if (!KNOWN_CHANNEL_KEYS.includes(key)) {
    return { error: NextResponse.json({ error: "Unknown channel." }, { status: 400 }) };
  }
  const channel = channelForCategory(key);
  const ok = verb === "view" ? canViewChannel(account, channel) : canPostChannel(account, channel);
  if (!ok) return { error: NextResponse.json({ error: "Not authorized for this channel." }, { status: 403 }) };
  return { channel };
}

// POST { channel, body, clientMsgId } — send a message. Idempotent on
// (authorId, clientMsgId): a retried send returns the original row, replayed:true.
export async function POST(req: Request) {
  const account = await currentAccount();
  if (!operatorNetworkAccessible(account)) {
    return NextResponse.json({ error: "Operator Network is not available." }, { status: 403 });
  }

  const payload = (await req.json().catch(() => null)) as
    | { channel?: unknown; body?: unknown; clientMsgId?: unknown }
    | null;
  if (!payload) return NextResponse.json({ error: "Bad request." }, { status: 400 });

  const resolved = resolveChannel(payload.channel, account!, "post");
  if ("error" in resolved) return resolved.error;
  const { channel } = resolved;

  const clientMsgId = typeof payload.clientMsgId === "string" ? payload.clientMsgId.trim().slice(0, 100) : "";
  if (!clientMsgId) return NextResponse.json({ error: "Missing clientMsgId." }, { status: 400 });

  const body = cleanText(payload.body, LIMITS.reply);
  if (body.length < 1) return NextResponse.json({ error: "Write a message." }, { status: 400 });

  // CROA screen BEFORE any write — same bar as every other member-authored surface.
  const screened = screenCommunityText(body);
  if (!screened.ok) return NextResponse.json({ error: screened.error }, { status: 422 });

  // Write throttle keyed on the account (not the workspace client).
  const limited = await enforceRateLimit(`network-msg:${account!.id}`, 60, 3600);
  if (limited) return limited;

  const data = {
    channelKey: channel.key,
    authorId: account!.id,
    authorName: communityDisplayName(account!),
    body,
    isKai: false,
    audienceAgencyId: channelAudienceId(channel), // row-level tenant backstop
    clientMsgId,
  };

  try {
    const created = await prisma.networkMessage.create({ data });
    return NextResponse.json({ ok: true, replayed: false, message: shape(created, account!.id) }, { status: 201 });
  } catch (e) {
    // Idempotent replay: same (authorId, clientMsgId) already exists.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const existing = await prisma.networkMessage.findUnique({
        where: { authorId_clientMsgId: { authorId: account!.id, clientMsgId } },
      });
      if (existing) return NextResponse.json({ ok: true, replayed: true, message: shape(existing, account!.id) });
    }
    throw e;
  }
}

// GET ?channel=&since=<createdAtMs>:<id>&limit= — page forward through a channel in
// stable [createdAt asc, id asc] order. `since` is the cursor from a prior page;
// omit it for the first page. Returns { messages, cursor } where cursor feeds the
// next poll (null when the channel is empty on this page).
export async function GET(req: Request) {
  const account = await currentAccount();
  if (!operatorNetworkAccessible(account)) {
    return NextResponse.json({ error: "Operator Network is not available." }, { status: 403 });
  }

  const url = new URL(req.url);
  const resolved = resolveChannel(url.searchParams.get("channel"), account!, "view");
  if ("error" in resolved) return resolved.error;
  const { channel } = resolved;

  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt(url.searchParams.get("limit") ?? "", 10) || DEFAULT_LIMIT),
  );

  // Cursor: "<createdAtMs>:<id>". Malformed cursor => start from the beginning
  // (fail-safe: never throw on a bad client cursor; just page from the top).
  const since = url.searchParams.get("since") ?? "";
  let after: { createdAt: Date; id: string } | null = null;
  const colon = since.indexOf(":");
  if (colon > 0) {
    const ms = Number(since.slice(0, colon));
    const id = since.slice(colon + 1);
    if (Number.isFinite(ms) && id) after = { createdAt: new Date(ms), id };
  }

  // Row-level tenant backstop: re-assert the channel's audience in the WHERE, so a
  // mis-stamped row can never appear in the wrong channel even if authz were wrong.
  const where: Prisma.NetworkMessageWhereInput = {
    channelKey: channel.key,
    audienceAgencyId: channelAudienceId(channel),
    ...(after
      ? {
          OR: [
            { createdAt: { gt: after.createdAt } },
            { createdAt: after.createdAt, id: { gt: after.id } },
          ],
        }
      : {}),
  };

  const rows = await prisma.networkMessage.findMany({
    where,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: limit,
  });

  const messages = rows.map((m) => shape(m, account!.id));
  const last = rows[rows.length - 1];
  const cursor = last ? `${last.createdAt.getTime()}:${last.id}` : (since || null);

  return NextResponse.json({ messages, cursor });
}
