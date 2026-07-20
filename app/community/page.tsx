import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { EduBanner } from "@/components/Disclaimer";
import { AmbientGrid, type AmbientState } from "@/components/community/AmbientGrid";
import { LivingIntelligence } from "@/components/community/LivingIntelligence";
import { OperatorRail, ChannelChips, type RoomState } from "@/components/community/OperatorRail";
import { NowPanel } from "@/components/community/NowPanel";
import { FeedCard } from "@/components/community/FeedCard";
import { Composer } from "@/components/community/Composer";
import { compareThreads, isOpenLoop, type OperatorThread } from "@/components/community/format";
import { prisma } from "@/lib/prisma";
import { currentAccount } from "@/lib/session";
import { canAccessCommunity, ensureCommunityTables, CATEGORY_KEYS } from "@/lib/community";
import { CATEGORIES, BRIEFING_ROOM } from "@/lib/communityShared";
import { Network, ArrowRight, MessagesSquare, ChevronDown, Search } from "lucide-react";

// The Operator Network (Phase 1.2) — an Intelligence Operations Center. The
// mental model is WORKSPACES (rooms inside headquarters) over the frozen
// category keys, an ATTENTION QUEUE sectioned into operational groups (never a
// social feed), and a SITUATION panel. Server-rendered: rail, queue, and
// situation panel ship as HTML with zero hydration; the client islands are the
// composer (existing posting behavior, preserved), the ambient field (real
// aggregate state), and the Living Intelligence layer (one delegated listener).
//
// Access: every PAYING member via the ONE canonical predicate
// (lib/community.canAccessCommunity → entitlements isPremium). Fail-closed.
// Records, routes, and the composer contract are UNCHANGED. No new backend.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ACTIVE_WINDOW_MS = 7 * 24 * 3600 * 1000; // "recently active" = last 7 days

// Each room has its own atmosphere — a server-chosen tint on the ambient base,
// so entering another workspace genuinely changes the environment with zero JS.
// All at sub-perceptual alpha; gold is reserved for the attention family and
// green for verified, so room atmospheres stay in the neutral/brand/ocean range.
const ATMOSPHERE: Record<string, string> = {
  "": "from-ocean-500/[0.04]",
  general: "from-slate-400/[0.04]",
  wins: "from-gold-500/[0.03]",
  strategy: "from-ocean-500/[0.06]",
  tools: "from-slate-400/[0.05]",
  questions: "from-brand-500/[0.05]",
};

async function loadThreads(): Promise<{ threads: OperatorThread[]; degraded: boolean }> {
  try {
    await ensureCommunityTables();
    // Same data contract as /api/community/threads GET (cap 200, isKai annotation).
    const rows = await prisma.communityThread.findMany({
      orderBy: [{ pinned: "desc" }, { lastActivityAt: "desc" }],
      take: 200,
    });
    const ids = rows.map((t) => t.id);
    const kaiRows = ids.length
      ? await prisma.communityReply.findMany({
          where: { threadId: { in: ids }, isKai: true },
          distinct: ["threadId"],
          select: { threadId: true },
        })
      : [];
    const kaiSet = new Set(kaiRows.map((r) => r.threadId));
    return {
      degraded: false,
      threads: rows.map((t) => ({
        id: t.id,
        title: t.title,
        category: t.category,
        authorName: t.authorName,
        pinned: t.pinned,
        locked: t.locked,
        replyCount: t.replyCount,
        kaiAnswered: kaiSet.has(t.id),
        lastActivityAt: t.lastActivityAt.toISOString(),
        excerpt: t.body.slice(0, 200),
      })),
    };
  } catch (e) {
    console.error("operator network: thread load failed", e);
    return { threads: [], degraded: true };
  }
}

// Search runs against the DATABASE, not the capped page set: filtering the
// already-loaded 200 would silently omit older matches and quietly lie about
// what the network holds. One extra read, only when a member actually searches.
// Fail-closed: a failed search returns nothing and the UI says so.
async function searchThreads(q: string, channel: string): Promise<OperatorThread[]> {
  try {
    await ensureCommunityTables();
    const rows = await prisma.communityThread.findMany({
      where: {
        ...(channel ? { category: channel } : {}),
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { body: { contains: q, mode: "insensitive" } },
        ],
      },
      orderBy: [{ pinned: "desc" }, { lastActivityAt: "desc" }],
      take: 100,
    });
    const ids = rows.map((t) => t.id);
    const kaiRows = ids.length
      ? await prisma.communityReply.findMany({
          where: { threadId: { in: ids }, isKai: true },
          distinct: ["threadId"],
          select: { threadId: true },
        })
      : [];
    const kaiSet = new Set(kaiRows.map((r) => r.threadId));
    return rows.map((t) => ({
      id: t.id,
      title: t.title,
      category: t.category,
      authorName: t.authorName,
      pinned: t.pinned,
      locked: t.locked,
      replyCount: t.replyCount,
      kaiAnswered: kaiSet.has(t.id),
      lastActivityAt: t.lastActivityAt.toISOString(),
      excerpt: t.body.slice(0, 200),
    }));
  } catch (e) {
    console.error("operator network: search failed", e);
    return [];
  }
}

export default async function CommunityPage({
  searchParams,
}: {
  searchParams?: { channel?: string; q?: string };
}) {
  // ---- Access gating: paying members, fail-closed (canAccessCommunity → isPremium) ----
  let account: Awaited<ReturnType<typeof currentAccount>> = null;
  try {
    account = await currentAccount();
  } catch (e) {
    console.error("operator network: account resolve failed", e);
  }
  if (!canAccessCommunity(account)) {
    return (
      <AppShell title="/ Operator Network">
        <div className="card mx-auto mt-6 max-w-lg p-8 text-center">
          <Network className="mx-auto mb-3 h-9 w-9 text-brand-400" aria-hidden="true" />
          <h2 className="mb-2 text-lg font-semibold">The Operator Network is for members</h2>
          <p className="mb-5 text-sm text-slate-400">
            Operator Network access comes with an active paid CreditVector membership — every paid plan includes it.
            Compare notes with members working the same process, and bring <strong>Kai</strong> into any brief for
            answers grounded in statutes and process — never promises.
          </p>
          <Link href="/pricing" className="btn-primary inline-flex">See plans <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
        </div>
      </AppShell>
    );
  }

  const raw = searchParams?.channel ?? "";
  const channel = CATEGORY_KEYS.includes(raw) ? raw : "";
  const query = (searchParams?.q ?? "").trim().slice(0, 120);
  const { threads, degraded } = await loadThreads();

  // A search replaces the queue's set, and the command strip follows it — strip
  // counts always describe exactly the set rendered below them (guard-pinned).
  // The ambient field, workspace doors, and Network State keep describing the
  // whole network: they are the state of the building, not of your search.
  const results = query ? await searchThreads(query, channel) : null;

  // The attention queue: pinned → open loops → recency → stable id (format.ts),
  // then sectioned into operational groups for the workspace (not a feed).
  const scoped = results ?? (channel ? threads.filter((t) => t.category === channel) : threads);
  const queue = scoped.slice().sort(compareThreads);
  const requiresAttention = queue.filter((t) => t.pinned || isOpenLoop(t));
  const activeIntelligence = queue.filter((t) => !t.pinned && !isOpenLoop(t));

  // Real, derived state — the strip describes the SAME set the queue below shows
  // (room-scoped); the ambient field always reads the whole network. Per-room
  // live state feeds the workspace doors. No fabricated numbers anywhere.
  const now = Date.now();
  const isRecent = (t: OperatorThread) => now - +new Date(t.lastActivityAt) < ACTIVE_WINDOW_MS;
  const awaiting = scoped.filter(isOpenLoop).length;
  const activeRecent = scoped.filter(isRecent).length;
  const ambient: AmbientState = {
    total: threads.length,
    awaiting: threads.filter(isOpenLoop).length,
    active: threads.filter(isRecent).length,
  };
  const rooms: Record<string, RoomState> = {
    "": { total: threads.length, awaiting: ambient.awaiting },
  };
  for (const c of CATEGORIES) {
    const inRoom = threads.filter((t) => t.category === c.key);
    rooms[c.key] = { total: inRoom.length, awaiting: inRoom.filter(isOpenLoop).length };
  }
  const roomMeta = channel ? CATEGORIES.find((c) => c.key === channel) : null;
  const roomName = roomMeta ? roomMeta.label : BRIEFING_ROOM.label;

  return (
    <AppShell title="/ Operator Network">
      <div className="relative isolate">
        <AmbientGrid state={ambient} tint={ATMOSPHERE[channel] ?? ATMOSPHERE[""]} />
        <LivingIntelligence />
        <EduBanner />

        {/* Command strip — the room you're in + its live operational state.
            Chrome plane (border, no card); useful on the fiftieth visit. */}
        <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-ink-700/50 pb-3">
          <h2 className="text-sm font-semibold text-slate-100">{roomName}</h2>
          <span className="text-xs text-slate-500 tnum">
            {awaiting > 0 ? (
              <>
                <span className="font-medium text-gold-400">{awaiting}</span> awaiting response
                <span aria-hidden="true"> · </span>
              </>
            ) : null}
            <span className="font-medium text-slate-300">{activeRecent}</span> active this week
          </span>
          {roomMeta && <span className="hidden text-xs text-slate-500 md:block">{roomMeta.blurb}</span>}
        </div>

        {/* Small-viewport workspace chips (the rail's doors, chip form). */}
        <div className="mb-4">
          <ChannelChips channel={channel} />
        </div>

        {/* Search — a plain GET form: zero hydration, works without JS, and the
            query lives in the URL so a result set is linkable. Scoped to the
            current workspace; searching the whole network means leaving the room. */}
        <form method="get" role="search" className="mb-4 flex items-center gap-2">
          {channel && <input type="hidden" name="channel" value={channel} />}
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
              aria-hidden="true"
            />
            <input
              type="search"
              name="q"
              defaultValue={query}
              maxLength={120}
              className="input min-h-[44px] w-full pl-9"
              placeholder={roomMeta ? `Search ${roomMeta.label}…` : "Search the network…"}
              aria-label={roomMeta ? `Search ${roomMeta.label}` : "Search the Operator Network"}
            />
          </div>
          <button type="submit" className="btn-ghost min-h-[44px] px-4 text-sm">
            Search
          </button>
          {query && (
            <Link
              href={channel ? `/community?channel=${channel}` : "/community"}
              className="btn-ghost min-h-[44px] px-4 text-sm"
            >
              Clear
            </Link>
          )}
        </form>

        {/* Result header — states exactly what was searched and how deep the
            answer goes. Never implies the whole archive was returned. */}
        {results && (
          <p role="status" className="mb-4 text-xs text-slate-400">
            <span className="tnum">{results.length}</span>
            {results.length === 100 ? "+ " : " "}
            {results.length === 1 ? "brief" : "briefs"} matching{" "}
            <span className="font-medium text-slate-300">&ldquo;{query}&rdquo;</span>
            {roomMeta ? ` in ${roomMeta.label}` : " across the network"}
            {results.length === 100 && " — showing the first 100, most recent first"}.
          </p>
        )}

        {/* Small-viewport Situation disclosure — native details, zero JS. */}
        <details className="group mb-4 xl:hidden">
          <summary className="card flex min-h-[44px] cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-sm text-slate-400 [&::-webkit-details-marker]:hidden">
            <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden="true" />
            Situation report
          </summary>
          <div className="mt-3">
            <NowPanel threads={threads} />
          </div>
        </details>

        <div className="grid gap-6 lg:grid-cols-[236px_minmax(0,1fr)] xl:grid-cols-[236px_minmax(0,1fr)_280px]">
          {/* Workspaces — navigation plane */}
          <aside className="hidden self-start lg:sticky lg:top-20 lg:block">
            <OperatorRail channel={channel} rooms={rooms} />
          </aside>

          {/* The operational workspace — sectioned attention queue */}
          <div className="min-w-0">
            <div className="mb-4">
              <Composer initialCategory={channel} />
            </div>

            {degraded ? (
              <div className="card p-8 text-center">
                <p className="text-sm text-slate-400">
                  The network is unreachable right now — nothing about your account caused this.
                  Refresh in a moment; nothing was lost.
                </p>
              </div>
            ) : queue.length === 0 ? (
              <div className="card flex flex-col items-center gap-3 p-10 text-center">
                <MessagesSquare className="h-8 w-8 text-slate-600" aria-hidden="true" />
                <span className="rounded bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-brand-300">KAI</span>
                <p className="max-w-md text-sm text-slate-400">
                  {results ? (
                    <>
                      No brief matches <span className="font-medium text-slate-300">&ldquo;{query}&rdquo;</span>
                      {roomMeta ? ` in ${roomMeta.label}` : " across the network"}. Try fewer words, or search the
                      whole network from the Executive Briefing.
                    </>
                  ) : roomMeta ? (
                    <>
                      <span className="font-medium text-slate-300">{roomMeta.label}</span> — {roomMeta.blurb}{" "}
                      Nothing filed here yet. File the first brief and, if the law speaks to it, I&apos;ll answer with the statute.
                    </>
                  ) : (
                    <>
                      Nothing filed here yet. File the first brief: a question, a result, or a bureau response
                      you&apos;re unsure about. If the law speaks to it, I&apos;ll answer with the statute.
                    </>
                  )}
                </p>
              </div>
            ) : (
              <>
                {requiresAttention.length > 0 && (
                  <section aria-label="Requires attention" className="mb-5">
                    <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-gold-400">Requires attention</h3>
                    <ul className="space-y-2">
                      {requiresAttention.map((t) => (
                        <li key={t.id}>
                          <FeedCard t={t} />
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                {activeIntelligence.length > 0 && (
                  <section aria-label="Active intelligence">
                    <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">Active intelligence</h3>
                    <ul className="space-y-2">
                      {activeIntelligence.map((t) => (
                        <li key={t.id}>
                          <FeedCard t={t} />
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                {/* The queue ends (Design Bible Law F6) — an honest end, never infinite scroll. */}
                <p className="mt-6 text-center text-[11px] text-slate-400">
                  {results ? (
                    <>
                      End of results — <span className="tnum">{queue.length}</span>{" "}
                      {queue.length === 1 ? "brief" : "briefs"} matching &ldquo;{query}&rdquo;.
                    </>
                  ) : (
                    <>
                      You&apos;re caught up — <span className="tnum">{queue.length}</span>{" "}
                      {queue.length === 1 ? "brief" : "briefs"} in {roomMeta ? roomMeta.label : "the network"}.
                    </>
                  )}
                </p>
              </>
            )}
          </div>

          {/* Situation report — context plane */}
          <aside className="hidden self-start xl:sticky xl:top-20 xl:block" aria-label="Situation report">
            <NowPanel threads={threads} />
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
