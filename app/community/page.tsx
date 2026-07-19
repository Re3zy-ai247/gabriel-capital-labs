import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { EduBanner } from "@/components/Disclaimer";
import { KaiBadge } from "@/components/community/KaiAvatar";
import { AmbientGrid } from "@/components/community/AmbientGrid";
import { OperatorRail, ChannelChips } from "@/components/community/OperatorRail";
import { NowPanel } from "@/components/community/NowPanel";
import { FeedCard } from "@/components/community/FeedCard";
import { Composer } from "@/components/community/Composer";
import type { OperatorThread } from "@/components/community/format";
import { prisma } from "@/lib/prisma";
import { currentAccount } from "@/lib/session";
import { canAccessCommunity, ensureCommunityTables, CATEGORY_KEYS } from "@/lib/community";
import { CATEGORIES, categoryLabel } from "@/lib/communityShared";
import { Building2, ArrowRight, MessagesSquare, ChevronDown } from "lucide-react";

// The Operator Network shell (Phase 1 — UI foundation only). Server-rendered:
// the feed, rail, and Now panel ship as HTML with zero hydration; the only
// client islands are the composer (existing posting behavior, preserved) and
// the ambient layer (deferred, decorative, non-informational).
//
// Access, records, and routes are UNCHANGED from the existing Community Hub:
// same agency-only gate (lib/community.canAccessCommunity), same
// CommunityThread/CommunityReply tables, same category set — channels map 1:1
// onto the existing `category` column. No new backend of any kind.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function loadThreads(): Promise<{ threads: OperatorThread[]; degraded: boolean }> {
  try {
    await ensureCommunityTables();
    // Mirrors /api/community/threads GET exactly (order, cap, kaiAnswered).
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
  // ---- Access gating (unchanged semantics, now server-rendered) ----
  let account: Awaited<ReturnType<typeof currentAccount>> = null;
  try {
    account = await currentAccount();
  } catch (e) {
    console.error("operator network: account resolve failed", e);
  }
  if (!canAccessCommunity(account)) {
    return (
      <AppShell title="/ Community">
        <div className="card mx-auto mt-6 max-w-lg p-8 text-center">
          <Building2 className="mx-auto mb-3 h-9 w-9 text-brand-400" aria-hidden="true" />
          <h2 className="mb-2 text-lg font-semibold">The Community Hub is for Agency members</h2>
          <p className="mb-5 text-sm text-slate-400">
            Connect with other agency operators and share wins and strategy. Bring <strong>Kai</strong> into any thread and
            he answers with statutes and process — never promises. Unlock it with an Agency subscription.
          </p>
          <Link href="/pricing" className="btn-primary inline-flex">See Agency plans <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
        </div>
      </AppShell>
    );
  }

  const raw = searchParams?.channel ?? "";
  const channel = CATEGORY_KEYS.includes(raw) ? raw : "";
  const { threads, degraded } = await loadThreads();
  const feed = channel ? threads.filter((t) => t.category === channel) : threads;
  const contributors = new Set(threads.map((t) => t.authorName)).size;
  const kaiAnswers = threads.filter((t) => t.kaiAnswered).length;
  const totalLabel = threads.length === 200 ? "200+" : String(threads.length);
  const channelMeta = channel ? CATEGORIES.find((c) => c.key === channel) : null;

  return (
    <AppShell title="/ Community">
      <div className="relative isolate">
        <AmbientGrid />
        <EduBanner />

        {/* Masthead — identity + honest real-number stats (nothing fabricated). */}
        <header className="card mb-5 flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <KaiBadge className="h-14 w-14" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold">Operator Network</h2>
              <span className="pill border border-ink-600 bg-ink-700/60 text-slate-400">Agency Lounge</span>
              <span className="rounded bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-brand-300">KAI</span>
            </div>
            <p className="mt-1 text-sm text-slate-400">
              Ask anything about the dispute process. Bring me into a thread and I answer with receipts:
              the statute, the rule, or the process step. Never promises.
            </p>
            <p className="mt-2 text-[11px] text-slate-500">
              <span className="tnum font-medium text-slate-300">{totalLabel}</span> discussions ·{" "}
              <span className="tnum font-medium text-slate-300">{kaiAnswers}</span> Kai answers ·{" "}
              <span className="tnum font-medium text-slate-300">{contributors}</span> contributors
            </p>
          </div>
        </header>

        {/* Small-viewport channel chips (the rail's links, chip form). */}
        <div className="mb-4">
          <ChannelChips channel={channel} />
        </div>

        {/* Small-viewport "Now" disclosure — native details, zero JS. */}
        <details className="group mb-4 xl:hidden">
          <summary className="card flex min-h-[44px] cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-sm text-slate-400 [&::-webkit-details-marker]:hidden">
            <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden="true" />
            Now — activity in the lounge
          </summary>
          <div className="mt-3">
            <NowPanel threads={threads} />
          </div>
        </details>

        <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_280px]">
          {/* Rail */}
          <aside className="hidden self-start lg:sticky lg:top-20 lg:block">
            <OperatorRail channel={channel} />
          </aside>

          {/* Feed */}
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
                <ul className="space-y-2" aria-label={channel ? `${categoryLabel(channel)} discussions` : "All discussions"}>
                  {feed.map((t) => (
                    <li key={t.id}>
                      <FeedCard t={t} />
                    </li>
                  ))}
                </ul>
                {/* The feed ends (Design Bible §7, Law F6) — an honest end, never an infinite scroll. */}
                <p className="mt-6 text-center text-[11px] text-slate-600">
                  You&apos;re caught up — <span className="tnum">{feed.length}</span>{" "}
                  {feed.length === 1 ? "discussion" : "discussions"}
                  {channel ? ` in #${categoryLabel(channel)}` : " in the lounge"}.
                </p>
              </>
            )}
          </div>

          {/* Now panel */}
          <aside className="hidden self-start xl:sticky xl:top-20 xl:block" aria-label="Current activity">
            <NowPanel threads={threads} />
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
