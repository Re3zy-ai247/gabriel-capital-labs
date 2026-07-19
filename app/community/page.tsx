import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { EduBanner } from "@/components/Disclaimer";
import { AmbientGrid, type AmbientState } from "@/components/community/AmbientGrid";
import { OperatorRail, ChannelChips } from "@/components/community/OperatorRail";
import { NowPanel } from "@/components/community/NowPanel";
import { FeedCard } from "@/components/community/FeedCard";
import { Composer } from "@/components/community/Composer";
import { compareThreads, isOpenLoop, type OperatorThread } from "@/components/community/format";
import { prisma } from "@/lib/prisma";
import { currentAccount } from "@/lib/session";
import { canAccessCommunity, ensureCommunityTables, CATEGORY_KEYS } from "@/lib/community";
import { CATEGORIES, categoryLabel } from "@/lib/communityShared";
import { Network, ArrowRight, MessagesSquare, ChevronDown } from "lucide-react";

// The Operator Network (Phase 1.1) — an Intelligence Operations Center, not a
// forum. Server-rendered: rail, attention queue, and Network State ship as HTML
// with zero hydration; the only client islands are the composer (existing
// posting behavior, preserved) and the ambient layer (deferred, driven by real
// aggregate state, non-informational).
//
// Access: every PAYING member (founder decision, Phase 1.1) via the ONE
// canonical predicate — lib/community.canAccessCommunity → entitlements
// isPremium. Fail-closed. Records, routes, and the composer contract are
// UNCHANGED: same CommunityThread/CommunityReply tables, channels map 1:1 onto
// the existing `category` column. No new backend of any kind.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ACTIVE_WINDOW_MS = 7 * 24 * 3600 * 1000; // "recently active" = last 7 days

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

export default async function CommunityPage({ searchParams }: { searchParams?: { channel?: string } }) {
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
            Compare notes with members working the same process, and bring <strong>Kai</strong> into any thread for
            answers grounded in statutes and process — never promises.
          </p>
          <Link href="/pricing" className="btn-primary inline-flex">See plans <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
        </div>
      </AppShell>
    );
  }

  const raw = searchParams?.channel ?? "";
  const channel = CATEGORY_KEYS.includes(raw) ? raw : "";
  const { threads, degraded } = await loadThreads();

  // The attention queue: pinned → open loops → recency → stable id (format.ts).
  const scoped = channel ? threads.filter((t) => t.category === channel) : threads;
  const feed = scoped.slice().sort(compareThreads);

  // Real, derived state — the strip describes the SAME set the queue below shows
  // (channel-scoped); the ambient layer always reads the whole network. No
  // fabricated numbers anywhere.
  const now = Date.now();
  const isRecent = (t: OperatorThread) => now - +new Date(t.lastActivityAt) < ACTIVE_WINDOW_MS;
  const awaiting = scoped.filter(isOpenLoop).length;
  const activeRecent = scoped.filter(isRecent).length;
  const pinnedCount = scoped.filter((t) => t.pinned).length;
  const ambient: AmbientState = {
    total: threads.length,
    awaiting: threads.filter(isOpenLoop).length,
    active: threads.filter(isRecent).length,
  };
  const channelMeta = channel ? CATEGORIES.find((c) => c.key === channel) : null;

  return (
    <AppShell title="/ Operator Network">
      <div className="relative isolate">
        <AmbientGrid state={ambient} />
        <EduBanner />

        {/* Operational strip — current network state, useful on the fiftieth
            visit. No hero, no marketing copy; chrome plane (border, no card). */}
        <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-ink-700/50 pb-3">
          <h2 className="text-sm font-semibold text-slate-100">
            {channelMeta ? `#${channelMeta.label}` : "Operator Network"}
          </h2>
          <span className="text-xs text-slate-500 tnum">
            {awaiting > 0 ? (
              <>
                <span className="font-medium text-gold-400">{awaiting}</span> awaiting response
                <span aria-hidden="true"> · </span>
              </>
            ) : null}
            <span className="font-medium text-slate-300">{activeRecent}</span> active this week
            {pinnedCount > 0 ? (
              <>
                <span aria-hidden="true"> · </span>
                <span className="font-medium text-slate-300">{pinnedCount}</span> pinned
              </>
            ) : null}
          </span>
        </div>

        {/* Small-viewport channel chips (the rail's links, chip form). */}
        <div className="mb-4">
          <ChannelChips channel={channel} />
        </div>

        {/* Small-viewport Network State disclosure — native details, zero JS. */}
        <details className="group mb-4 xl:hidden">
          <summary className="card flex min-h-[44px] cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-sm text-slate-400 [&::-webkit-details-marker]:hidden">
            <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden="true" />
            Network state
          </summary>
          <div className="mt-3">
            <NowPanel threads={threads} />
          </div>
        </details>

        <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_280px]">
          {/* Rail — navigation plane */}
          <aside className="hidden self-start lg:sticky lg:top-20 lg:block">
            <OperatorRail channel={channel} />
          </aside>

          {/* The attention queue — workspace plane */}
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
            ) : feed.length === 0 ? (
              <div className="card flex flex-col items-center gap-3 p-10 text-center">
                <MessagesSquare className="h-8 w-8 text-slate-600" aria-hidden="true" />
                <span className="rounded bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-brand-300">KAI</span>
                <p className="max-w-md text-sm text-slate-400">
                  {channelMeta ? (
                    <>
                      <span className="font-medium text-slate-300">#{channelMeta.label}</span> — {channelMeta.blurb}{" "}
                      Nothing posted here yet. Start the first discussion and, if the law speaks to it, I&apos;ll answer with the statute.
                    </>
                  ) : (
                    <>
                      Nothing posted here yet. Start the first discussion: a question, a win, or a bureau response
                      you&apos;re unsure about. If the law speaks to it, I&apos;ll answer with the statute.
                    </>
                  )}
                </p>
              </div>
            ) : (
              <>
                <ul className="space-y-2" aria-label={channel ? `${categoryLabel(channel)} — attention queue` : "Attention queue"}>
                  {feed.map((t) => (
                    <li key={t.id}>
                      <FeedCard t={t} />
                    </li>
                  ))}
                </ul>
                {/* The feed ends (Design Bible Law F6) — an honest end, never infinite scroll. */}
                <p className="mt-6 text-center text-[11px] text-slate-400">
                  You&apos;re caught up — <span className="tnum">{feed.length}</span>{" "}
                  {feed.length === 1 ? "discussion" : "discussions"}
                  {channel ? ` in #${categoryLabel(channel)}` : " in the network"}.
                </p>
              </>
            )}
          </div>

          {/* Network State — context plane */}
          <aside className="hidden self-start xl:sticky xl:top-20 xl:block" aria-label="Network state">
            <NowPanel threads={threads} />
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
